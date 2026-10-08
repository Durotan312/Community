import calendar
import hashlib
import io
import json
import os
import posixpath
import re
import secrets
import shutil
import smtplib
import socket
import sys
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import random
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

from flask import Flask, g, jsonify, render_template, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "portal.db"
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
API_KEY_FILE = BASE_DIR / "api_key.txt"
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR") or (BASE_DIR / "backups"))   # копии базы; на сервере — /opt/staff-backups
APP_STARTED = __import__("time").time()
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 520 * 1024 * 1024  # общий потолок — под видео; для картинок свой лимит 64 МБ ниже
IMAGE_MAX_BYTES = 64 * 1024 * 1024
VIDEO_MAX_BYTES = 500 * 1024 * 1024
VIDEO_EXT = {"mp4", "m4v", "mov", "webm"}

# Сессии (кто вошёл). Куки недоступны из JS, живут 30 дней при «Запомнить меня».
# PORTAL_HTTPS=1 ставится на проде (docker-compose): куки только по HTTPS.
app.config.update(
    SESSION_COOKIE_NAME="cc_session",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("PORTAL_HTTPS") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.after_request
def no_stale_cache(resp):
    if request.path.startswith(("/media/", "/static/uploads/")):
        resp.headers["X-Content-Type-Options"] = "nosniff"      # картинка с HTML внутри не откроется как страница
    # Страница и статика всегда перепроверяются браузером — старая вёрстка не подсунется.
    if request.path == "/":
        # Главную не кэшировать вообще: иначе после выкладки у кого-то остаётся старая страница
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        # Откуда странице можно грузить код и картинки: только с портала (+ шрифты Google). Чужой скрипт не подключится.
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
        )
    elif request.path.startswith("/static/"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


AUDIT_SKIP = {"/api/ask", "/api/logout", "/api/cowork/chat"}   # вопросы боту и выход в журнал не пишем — это шум


CHECK_LOGINS = {"claude_check", "nobody_audit"}   # служебные учётки и логины технических проверок Claude


def _is_tech_check(who):
    """Запрос — техническая проверка Claude, а не действие человека. Снаружи не подделать: люди ходят через nginx,
    а он всегда ставит X-Real-IP; проверки идут изнутри сервера (скрипт в контейнере) без этого заголовка."""
    internal = not request.headers.get("X-Real-IP") and (request.remote_addr or "") in ("127.0.0.1", "::1", "")
    if internal and (IS_PROD or request.headers.get("X-Portal-Check") == "1"):
        return True
    return who in CHECK_LOGINS


@app.after_request
def audit_log(resp):
    """Журнал для админ-панели: все изменения данных, входы и отказы в доступе. Паролей и текстов не храним — только путь."""
    try:
        path = request.path
        if not path.startswith("/api/") or path in AUDIT_SKIP:
            return resp
        changing = request.method in ("POST", "PUT", "DELETE")
        denied = resp.status_code in (401, 403) and path not in ("/api/me",)
        if not changing and not denied:
            return resp
        who = ""
        uid = session.get("uid")
        if uid:
            row = get_db().execute("SELECT login FROM users WHERE id=?", (uid,)).fetchone()
            who = row["login"] if row else ""
        if path == "/api/login" and not who:
            who = str((request.get_json(silent=True) or {}).get("login") or "")[:80]
        ip = request.headers.get("X-Real-IP") or request.remote_addr or ""
        source = "check" if _is_tech_check(who) else ""
        db = get_db()
        db.execute("INSERT INTO audit (id, ts, user, ip, method, path, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                   (uuid.uuid4().hex, datetime.utcnow().isoformat(timespec="seconds"), who, ip,
                    request.method, path[:200], resp.status_code, source))
        if secrets.randbelow(50) == 0:   # изредка подрезаем хвост, чтобы журнал не рос бесконечно
            db.execute("DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY ts DESC LIMIT 5000)")
        db.commit()
    except Exception as e:  # журнал не должен ломать работу портала
        print(f"[журнал] {e}", flush=True)
    return resp


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


SCHEMA = {
    "users": {                           # учётные записи портала
        "id": "TEXT PRIMARY KEY",
        "login": "TEXT NOT NULL UNIQUE",
        "password_hash": "TEXT NOT NULL",
        "name": "TEXT",                  # как показывать в шапке; по нему же ищем карточку сотрудника
        "role": "TEXT NOT NULL DEFAULT 'user'",  # admin — всё; hr — новости и ивенты; user — просмотр, бот, предложения
        "email": "TEXT",                 # корпоративная почта — по ней тоже можно входить
        "invite_token": "TEXT",
        "invite_created": "TEXT",        # когда выпущена ссылка: старше INVITE_TTL_DAYS не принимаем          # ссылка-приглашение: сотрудник сам задаёт пароль
        "must_set_password": "INTEGER NOT NULL DEFAULT 0",
        "created": "TEXT NOT NULL DEFAULT ''",
        "last_login": "TEXT",
        "cowork": "INTEGER NOT NULL DEFAULT 0",   # допуск к Connected WorkFlow (08.10.2026): ставит админ; у admin всегда есть
    },
    "cowork_tasks": {                    # Connected WorkFlow (08.10.2026): задания агенту на изменение портала
        "id": "TEXT PRIMARY KEY",
        "author_id": "TEXT NOT NULL",
        "author_name": "TEXT",
        "title": "TEXT NOT NULL",
        "spec": "TEXT",                  # JSON: section, what, who, check — готовое задание из чата с приёмщиком
        "chat": "TEXT",                  # JSON: переписка с приёмщиком, из которой родилось задание
        "status": "TEXT NOT NULL DEFAULT 'queued'",   # queued → running → review → accepted / rejected / failed / cancelled
        "pr_url": "TEXT",                # ссылка на изменение (pull request в открытом репозитории)
        "result": "TEXT",                # отчёт исполнителя или комментарий владельца
        "created": "TEXT NOT NULL",
        "updated": "TEXT NOT NULL",
    },
    "cowork_notes": {                    # замечания к заданию WorkFlow (08.10.2026): «кнопка не там», агент дорабатывает
        "id": "TEXT PRIMARY KEY",
        "task_id": "TEXT NOT NULL",
        "author_id": "TEXT NOT NULL",
        "author_name": "TEXT",
        "text": "TEXT NOT NULL",
        "created": "TEXT NOT NULL",
    },
    "cowork_materials": {                # материалы для агента (08.10.2026): что он должен знать о продукте; ведёт админ
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "body": "TEXT",
        "url": "TEXT",
        "created": "TEXT NOT NULL",
        "updated": "TEXT NOT NULL",
    },
    "audit": {                           # журнал действий: кто, что и когда менял; входы и отказы
        "id": "TEXT PRIMARY KEY",
        "ts": "TEXT NOT NULL",           # UTC, ISO
        "user": "TEXT",
        "ip": "TEXT",
        "method": "TEXT",
        "path": "TEXT",
        "status": "INTEGER",
        "source": "TEXT",                # 'check' — техническая проверка Claude, пусто — действие человека (23.09.2026)
    },
    "settings": {                        # служебные пары ключ-значение (секрет сессий и т.п.)
        "key": "TEXT PRIMARY KEY",
        "value": "TEXT NOT NULL",
    },
    "requests": {                        # заявки сотрудников (командировка и т.д.)
        "id": "TEXT PRIMARY KEY",
        "type": "TEXT NOT NULL",         # trip — командировка
        "user_id": "TEXT NOT NULL",      # кто подал
        "author_name": "TEXT",
        "status": "TEXT NOT NULL DEFAULT 'new'",  # new / in_progress / done / rejected / cancelled
        "data": "TEXT NOT NULL DEFAULT '{}'",     # поля формы, JSON
        "hr_comment": "TEXT",
        "created": "TEXT NOT NULL DEFAULT ''",
        "updated": "TEXT NOT NULL DEFAULT ''",
        # согласование директором подразделения до HR (23.09.2026): статус «approval», пока он не решил
        "approver_id": "TEXT",           # employees.id директора, который согласует
        "approver_name": "TEXT",
        "approver_pos": "TEXT",
        "decided_by": "TEXT",            # кто фактически одобрил/отклонил (директор или админ за него)
        "decided_at": "TEXT",
        "approver_comment": "TEXT",
        # когда и кем заявка закрыта (06.10.2026, слова пользователя: «сделай даты, когда подана и когда выплачена»)
        "done_at": "TEXT",               # момент, когда поставили статус «Готово / Выдано / Выплачено»
        "done_by": "TEXT",               # имя того, кто поставил
    },
    "news": {
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "body": "TEXT NOT NULL",
        "author": "TEXT",
        "date": "TEXT NOT NULL",
        "pinned": "INTEGER NOT NULL DEFAULT 0",
        "image": "TEXT",
        "type": "TEXT NOT NULL DEFAULT 'news'",   # news — обычная новость; newcomer — «Новый сотрудник»
        "person_name": "TEXT",                    # для newcomer: кого представляем
        "person_position": "TEXT",
        "person_department": "TEXT",
    },
    "documents": {
        "id": "TEXT PRIMARY KEY",
        "category": "TEXT NOT NULL",
        "title": "TEXT NOT NULL",
        "description": "TEXT",
        "link": "TEXT",
        "required": "INTEGER NOT NULL DEFAULT 0",
        "text": "TEXT",          # текст файла, вытянутый при загрузке — по нему отвечает бот (22.09.2026)
        "section": "TEXT",       # knowledge (База знаний, по умолчанию) или templates (Шаблоны документов) — 23.09.2026
    },
    "employees": {
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT NOT NULL",
        "position": "TEXT",
        "department": "TEXT NOT NULL",
        "email": "TEXT",
        "phone": "TEXT",
        "telegram": "TEXT",   # имя в Telegram без @ — в карточке ссылка «написать»
        "office": "TEXT",     # в каком офисе рабочее место: Астана / Алматы
        "seat": "TEXT",       # номер места на плане офиса («Карта офиса»)
        "birthday": "TEXT",
        "photo": "TEXT",
        "schedule": "TEXT",   # график работы, например 09:00-18:00
        "elpass_id": "TEXT",  # карточки elpass через запятую: «avtodor:57,ch-almaty:25» — человек ездит между офисами
        "remote": "INTEGER NOT NULL DEFAULT 0",   # работает удалённо — через турникет не ходит, опоздания по нему не считаем
        "fieldwork": "TEXT",  # выезд на объекты: да / онлайн / пусто
        "company": "TEXT",    # юрлицо: Connected Home / Connected Premium / Elpass
        "is_head": "INTEGER NOT NULL DEFAULT 0",  # 1 = руководитель подразделения
        "english": "INTEGER NOT NULL DEFAULT 0",  # 1 = ходит на английский с носителем (табель английского, 24.09.2026)
        "unit": "TEXT",       # отдел внутри подразделения, например «ML Department»
        "reports_to": "TEXT", # имя непосредственного руководителя (как в поле name)
        "hired": "TEXT",      # в компании с (дата прихода) — заполняет HR, из неё считается стаж (07.10.2026)
    },
    "profiles": {                        # «О себе» — заполняет сам сотрудник, по желанию (07.10.2026); ключ — карточка справочника
        "employee_id": "TEXT PRIMARY KEY",
        "about": "TEXT",
        "edu_school": "TEXT", "edu_major": "TEXT", "edu_year": "TEXT",
        "hobbies": "TEXT", "skills": "TEXT", "languages": "TEXT",     # теги через запятую
        "hometown": "TEXT", "fav_book": "TEXT", "fav_film": "TEXT", "fav_music": "TEXT",
        "visible": "INTEGER NOT NULL DEFAULT 1",   # 0 — спрятан от коллег и бота
        "updated": "TEXT", "updated_by": "TEXT",
    },
    "comments": {
        "id": "TEXT PRIMARY KEY",
        "news_id": "TEXT NOT NULL",
        "author": "TEXT",
        "text": "TEXT NOT NULL",
        "date": "TEXT NOT NULL",
        "user_id": "TEXT",
    },
    "events": {
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "date": "TEXT NOT NULL",
        "type": "TEXT NOT NULL DEFAULT 'event'",
        "description": "TEXT",
    },
    "faq": {
        "id": "TEXT PRIMARY KEY",
        "question": "TEXT NOT NULL",
        "answer": "TEXT NOT NULL",
    },
    "gallery": {                         # прошедшие ивенты с фотографиями
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "date": "TEXT",                  # дата мероприятия, YYYY-MM-DD
        "description": "TEXT",
        "created": "TEXT NOT NULL DEFAULT ''",
    },
    "gallery_photos": {
        "id": "TEXT PRIMARY KEY",
        "event_id": "TEXT NOT NULL",
        "url": "TEXT NOT NULL",
        "created": "TEXT NOT NULL DEFAULT ''",
    },
    "partners": {                        # наши партнёры (из буклета «Мы работаем с»)
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT NOT NULL",
        "category": "TEXT",              # застройщики / госорганы / технологии / инвесторы
        "description": "TEXT",
        "website": "TEXT",
        "logo": "TEXT",                  # /static/uploads/... (необязательно)
        "sort": "INTEGER NOT NULL DEFAULT 0",
        "created": "TEXT NOT NULL DEFAULT ''",
    },
    "honors": {                          # доска почёта: сотрудник месяца
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT NOT NULL",
        "reason": "TEXT",
        "period": "TEXT",                # например «Сентябрь 2026»
        "created": "TEXT NOT NULL DEFAULT ''",
    },
    "projects": {
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",                 # название проекта / объект
        "client": "TEXT",                         # заказчик, ЖК, застройщик
        "status": "TEXT NOT NULL DEFAULT 'active'",  # planned / active / done
        "manager": "TEXT",                        # ответственный
        "deadline": "TEXT",                       # срок сдачи, YYYY-MM-DD
        "description": "TEXT",
        "created": "TEXT NOT NULL DEFAULT ''",
    },
    "suggestions": {
        "id": "TEXT PRIMARY KEY",
        "text": "TEXT NOT NULL",
        "author": "TEXT",                # пусто = анонимно
        "date": "TEXT NOT NULL",
        "user_id": "TEXT",               # у анонимных НЕ заполняется — автора не узнать даже по базе
        "status": "TEXT NOT NULL DEFAULT 'new'",  # new / seen
    },
    "about": {
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL DEFAULT ''",
        "body": "TEXT NOT NULL DEFAULT ''",
    },
    "leaders": {
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT NOT NULL",
        "position": "TEXT",
        "photo": "TEXT",
        "bio": "TEXT",
        "email": "TEXT",
        "story": "TEXT",   # рассказ от первого лица — открывается по клику на карточку (23.09.2026)
    },
    "elpass_cards": {                    # справочник карточек elpass (el_tcards) — чтобы HR сопоставляла сотрудников из списка
        "no": "TEXT PRIMARY KEY",        # «объект:табельный» — номера в разных объектах совпадают, поэтому с приставкой
        "object": "TEXT",                # avtodor (Астана) / ch-almaty (Алматы)
        "card_no": "TEXT",               # табельный номер как он есть в elpass
        "name": "TEXT",
        "title": "TEXT",
        "email": "TEXT",
        "active": "INTEGER NOT NULL DEFAULT 1",
        "ignored": "INTEGER NOT NULL DEFAULT 0",   # не сотрудник (партнёр, гость, родственник) — в подсчётах не участвует
        "note": "TEXT",                            # пояснение, почему карточка не привязана
        "synced": "TEXT",
    },
    "game_scores": {                     # мини-игры: каждая сыгранная партия и начисленные за неё баллы
        "id": "TEXT PRIMARY KEY",
        "user_id": "TEXT NOT NULL",
        "game": "TEXT NOT NULL",         # snake / mines / quiz / typing
        "score": "INTEGER DEFAULT 0",    # сырой результат (яблоки, верные ответы, знаков в минуту…)
        "points": "INTEGER DEFAULT 0",   # баллы в копилку
        "created": "TEXT NOT NULL",
    },
    "game_time": {                       # сколько секунд человек провёл в играх в рабочее время за день (лимит 30 минут)
        "id": "TEXT PRIMARY KEY",        # user_id:ГГГГ-ММ-ДД
        "user_id": "TEXT NOT NULL",
        "date": "TEXT NOT NULL",
        "seconds": "INTEGER DEFAULT 0",
    },
    "passes": {                          # проходы через турникет из elpass; заливает интеграция (пока — POST /api/admin/passes)
        "id": "TEXT PRIMARY KEY",
        "elpass_id": "TEXT NOT NULL",    # «объект:табельный», как в employees.elpass_id
        "object": "TEXT",
        "employee_id": "TEXT",           # сопоставленный сотрудник (по employees.elpass_id на момент загрузки)
        "ts": "TEXT NOT NULL",           # время прохода по Астане, ГГГГ-ММ-ДДTЧЧ:ММ:СС
        "direction": "TEXT NOT NULL",    # in / out
        "point": "TEXT",                 # точка прохода
    },
    "attendance": {                      # табель посещаемости: отметка = отклонение от обычного дня
        "id": "TEXT PRIMARY KEY",
        "employee_id": "TEXT NOT NULL",  # сотрудник из справочника employees
        "date": "TEXT NOT NULL",         # ГГГГ-ММ-ДД
        "code": "TEXT NOT NULL",         # З / У / Б / К / Т / БС / Л — см. ATTENDANCE_CODES
        "comment": "TEXT",
        "set_by": "TEXT",                # кто поставил (users.id)
        "updated": "TEXT NOT NULL",
    },
    "vacancies": {                       # открытые вакансии — раздел «Вакансии» (вернули 24.09.2026), ведут HR и админ
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "department": "TEXT",
        "office": "TEXT",                # Астана / Алматы
        "format": "TEXT",                # офис / гибрид / удалённо
        "description": "TEXT",           # чем заниматься
        "requirements": "TEXT",          # кого ищем
        "status": "TEXT NOT NULL DEFAULT 'open'",   # open — открыта, closed — закрыта (видят только HR и админ)
        "created": "TEXT NOT NULL",
        "updated": "TEXT",
    },
    "agent_runs": {                      # работа агентов Claude (06.10.2026): кто что делает и что сделал — вкладка «Агенты»
        "id": "TEXT PRIMARY KEY",
        "agent": "TEXT NOT NULL",        # ключ из AGENTS: main, reviewer, designer, chief, weekly
        "status": "TEXT NOT NULL",       # running — работает; done — закончил; failed — не получилось; lost — не отметил конец
        "task": "TEXT",                  # что делает (пишется в начале)
        "result": "TEXT",                # что сделано (пишется в конце)
        "started": "TEXT NOT NULL",      # UTC, ISO
        "finished": "TEXT",
    },
    "resumes": {                         # резюме кандидатов (07.10.2026): кто загрузил и в какой заявке лежит — как чеки
        "name": "TEXT PRIMARY KEY",
        "user_id": "TEXT NOT NULL",
        "created": "TEXT NOT NULL",
        "request_id": "TEXT",
    },
    "receipts": {                        # чеки к компенсациям (06.10.2026): кто загрузил и в какой заявке лежит
        "name": "TEXT PRIMARY KEY",      # имя файла receipt-<uuid>.ext
        "user_id": "TEXT NOT NULL",      # кто загрузил — только он может приложить чек к заявке и открыть его
        "created": "TEXT NOT NULL",      # UTC, ISO
        "request_id": "TEXT",            # заявка, к которой приложен; пусто — ещё не приложен
    },
    "tasks": {                           # задачник (25.09.2026): руководитель ставит задачу подчинённому, тот ведёт статус
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "description": "TEXT",
        "due": "TEXT",                   # срок, ГГГГ-ММ-ДД (необязательно)
        "assignee_id": "TEXT NOT NULL",  # исполнитель — employees.id
        "assignee_name": "TEXT",
        "author_id": "TEXT NOT NULL",    # кто поставил — users.id
        "author_emp_id": "TEXT",         # его карточка в справочнике (если есть)
        "author_name": "TEXT",
        "status": "TEXT NOT NULL DEFAULT 'new'",   # new → work → review → done (см. TASK_STATUSES)
        "report": "TEXT",                # комментарий исполнителя при сдаче
        "feedback": "TEXT",              # комментарий руководителя, если вернул на доработку
        "created": "TEXT NOT NULL",
        "updated": "TEXT",
        "done_at": "TEXT",
    },
    "translations": {                    # готовые переводы фраз портала (смена языка, 24.09.2026): одна фраза — один раз на весь портал
        "id": "TEXT PRIMARY KEY",        # sha1(язык + исходный текст)
        "lang": "TEXT NOT NULL",         # en / kk / zh
        "src": "TEXT NOT NULL",          # исходный русский текст
        "text": "TEXT NOT NULL",         # перевод
        "created": "TEXT NOT NULL",
    },
    "english_att": {                     # посещение занятий английским: сотрудник отмечает сам, HR видит всех (24.09.2026)
        "id": "TEXT PRIMARY KEY",
        "employee_id": "TEXT NOT NULL",
        "date": "TEXT NOT NULL",         # ГГГГ-ММ-ДД — день занятия
        "status": "TEXT NOT NULL",       # yes — был, no — не был
        "comment": "TEXT",               # причина, если не был
        "set_by": "TEXT",
        "updated": "TEXT NOT NULL",
    },
    "onboarding_steps": {
        "id": "TEXT PRIMARY KEY",
        "title": "TEXT NOT NULL",
        "description": "TEXT",
    },
}


# Старый код отметки посещаемости → нынешний: «Выезд на объект» (О) слит с «Выездом по работе» (З) 06.10.2026.
# Стоит здесь, а не рядом с ATTENDANCE_CODES: init_db вызывается при импорте, раньше, чем читается остальной файл.
ATTENDANCE_ALIASES = {"О": "З"}


def init_db():
    db = sqlite3.connect(DB_PATH)
    for table, cols in SCHEMA.items():
        col_defs = ", ".join(f"{name} {typ}" for name, typ in cols.items())
        db.execute(f"CREATE TABLE IF NOT EXISTS {table} ({col_defs})")
    db.commit()

    # migrate: add any missing columns to existing tables (keeps old data)
    for table, cols in SCHEMA.items():
        existing = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
        for name, typ in cols.items():
            if name not in existing:
                simple_type = typ.split(" NOT NULL")[0].split(" PRIMARY")[0]
                default = ""
                if "DEFAULT" in typ:
                    default = " DEFAULT " + typ.split("DEFAULT")[1].strip()
                try:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {simple_type}{default}")
                except sqlite3.OperationalError:
                    pass
    db.commit()

    if db.execute("SELECT COUNT(*) FROM about WHERE id='main'").fetchone()[0] == 0:
        db.execute(
            "INSERT INTO about (id, title, body) VALUES ('main', ?, ?)",
            ("Добро пожаловать в команду!", ""),
        )
    # разовые переводы данных; повторный запуск ничего не меняет
    for old, new in ATTENDANCE_ALIASES.items():
        db.execute("UPDATE attendance SET code=? WHERE code=?", (new, old))
    db.commit()
    db.close()


def row_to_dict(row):
    return dict(row)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


# Сигнатуры настоящих картинок: PNG, JPEG, GIF, WEBP(RIFF)
IMAGE_SIGNATURES = (bytes.fromhex("89504e470d0a1a0a"), bytes.fromhex("ffd8ff"), b"GIF87a", b"GIF89a", b"RIFF")


def looks_like_image(stream):
    """Первые байты должны быть от настоящей картинки, а не от скрипта с переименованным расширением."""
    head = stream.read(12)
    stream.seek(0)
    return any(head.startswith(sig) for sig in IMAGE_SIGNATURES)


# =========================================================
# АВТОРИЗАЦИЯ
# =========================================================
# Таблицы создаём при импорте, а не только при `python app.py`:
# под gunicorn в контейнере __main__ не выполняется, и новые таблицы иначе не появятся.
init_db()


def _setting(key, default=None):
    db = sqlite3.connect(DB_PATH)
    try:
        row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row[0] if row else default
    finally:
        db.close()


def _set_setting(key, value):
    db = sqlite3.connect(DB_PATH)
    try:
        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
        db.commit()
    finally:
        db.close()


# ---------- отметки о работе сервисов (вкладка «Сервисы» админ-панели, 01.10.2026) ----------
# Каждая интеграция после работы оставляет отметку: когда последний раз получилось и когда (и с чем) не получилось.
# Хранится в settings (ключ svc_<имя>) — переживает перезапуск портала.
_svc_written = {}   # (имя, удачно?) -> когда писали: частые удачные отметки (AI отвечает десятки раз в минуту) пишем не чаще раза в минуту


def _svc_get(key):
    try:
        return json.loads(_setting("svc_" + key) or "{}")
    except ValueError:
        return {}


def _svc_mark(key, ok, info=""):
    last_ok, last_err = _svc_written.get((key, True), 0), _svc_written.get((key, False), 0)
    if ok and time.time() - last_ok < 60 and last_err < last_ok:   # после сбоя удачу пишем сразу — иначе висел бы ложный «сбой»
        return
    _svc_written[(key, bool(ok))] = time.time()
    try:
        cur = _svc_get(key)
        now = datetime.utcnow().isoformat(timespec="seconds")
        if ok:
            cur["ok_at"], cur["ok_info"] = now, str(info)[:200]
        else:
            cur["err_at"], cur["err"] = now, str(info)[:300]
        db = sqlite3.connect(DB_PATH, timeout=1)      # отметка не должна задерживать сам сервис
        try:
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ("svc_" + key, json.dumps(cur, ensure_ascii=False)))
            db.commit()
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        pass


# Секрет для подписи сессий лежит в базе (она вне контейнера) —
# пересборка образа не разлогинит всех сотрудников.
_secret = _setting("secret_key")
if not _secret:
    _secret = secrets.token_hex(32)
    _set_setting("secret_key", _secret)
app.secret_key = _secret

# Пути, доступные без входа, и записи, разрешённые ролям (админу — всё).
AUTH_FREE = {"/api/login", "/api/me", "/api/register"}
AUTH_FREE_PREFIX = ("/api/invite/",)
USER_WRITABLE = {
    ("POST", "/api/ask"),
    ("POST", "/api/suggestions"),
    ("POST", "/api/requests"),           # подать заявку может любой сотрудник
    ("POST", "/api/logout"),
    ("POST", "/api/me/password"),
    ("POST", "/api/resume-upload"),      # резюме кандидата к рекомендации — любой сотрудник (24.09.2026)
    ("POST", "/api/receipt-upload"),     # чек к заявке на компенсацию — любой сотрудник (06.10.2026)
    ("POST", "/api/translate"),          # перевод фраз при смене языка портала — любой сотрудник (24.09.2026)
    ("POST", "/api/tasks"),              # поставить задачу — руководитель своим людям; остальных отсекает обработчик (25.09.2026)
    ("PUT", "/api/me/profile"),          # свой профиль «О себе» — любой сотрудник (07.10.2026)
    ("POST", "/api/me/telegram"),        # подключить свой Telegram к боту портала (01.10.2026); пока проба — пускает только админа
    ("DELETE", "/api/me/telegram"),
}
USER_WRITABLE_PREFIX = [
    ("POST", "/api/news/", "/comments"),     # комментарии к новостям
    ("POST", "/api/requests/", "/cancel"),   # отменить свою заявку
    ("POST", "/api/requests/", "/approve"),  # директор одобряет/отклоняет заявку своего человека
    ("DELETE", "/api/comments/", ""),        # удалить свой комментарий (чужой отсекает обработчик)
    ("PUT", "/api/attendance", ""),          # отметка в табеле: себе; чужую отсекает обработчик
    ("PUT", "/api/english", ""),             # отметка на английском: себе; чужую отсекает обработчик
    ("POST", "/api/cowork/", ""),            # Connected WorkFlow: чат, задания, замечания — только допущенным, проверяет обработчик (08.10.2026)
    ("POST", "/api/games", ""),              # мини-игры: результат партии и отсчёт времени — только за себя
    ("PUT", "/api/tasks/", ""),              # задачи: править — автор; статус — исполнитель/автор; чужое отсекает обработчик
    ("POST", "/api/tasks/", "/status"),
    ("DELETE", "/api/tasks/", ""),
]
# HR: новости (с картинками), ивенты с фото, комментарии
HR_WRITABLE_PREFIX = ("/api/news", "/api/gallery", "/api/upload", "/api/comments", "/api/requests", "/api/welcome-video",
                      "/api/suggestions", "/api/employees", "/api/hr", "/api/attendance", "/api/english",
                      "/api/events",     # календарь — HR ведёт с 22.09.2026
                      "/api/vacancies",  # вакансии — HR и админ (24.09.2026)
                      "/api/values",     # миссия и ценности — HR и админ (07.10.2026)
                      "/api/profiles",   # очистить чужой профиль «О себе» — HR и админ (07.10.2026)
                      "/api/documents", "/api/upload-doc")   # презентации и буклеты — HR и админ (22.09.2026)
IS_PROD = os.environ.get("PORTAL_HTTPS") == "1"
PORTAL_URL = os.environ.get("PORTAL_URL", "https://community.connectedhome.kz").rstrip("/")
TRUSTED_HOSTS = {PORTAL_URL.split("://", 1)[-1], "localhost", "127.0.0.1"}   # localhost — проверка здоровья контейнера
INVITE_TTL_DAYS = 7
ROLES = {"admin": "Администратор", "hr": "HR", "buyer": "Закупщик", "accountant": "Бухгалтер", "cfo": "Финансовый директор", "user": "Сотрудник"}
# Финансовый директор (06.10.2026, слова пользователя: «функционал для CFO — просмотр панели закупщика и панели бухгалтерии,
# пока только просмотр, без правок чего-либо»): видит заявки этих видов и чеки, но ничего не меняет — в can_write его нет.
REQUEST_VIEW_ROLES = {"cfo": ("equipment", "compensation")}


def can_write(user, method, path):
    if user["role"] == "admin":
        return True
    if (method, path) in USER_WRITABLE or any(
        method == m and path.startswith(pre) and path.endswith(suf) for m, pre, suf in USER_WRITABLE_PREFIX
    ):
        return True
    if user["role"] == "hr" and path.startswith(HR_WRITABLE_PREFIX):
        return True
    if user["role"] in ("buyer", "accountant") and path.startswith("/api/requests"):
        return True   # закупщик ведёт заявки на технику, бухгалтер — компенсации по чекам; чужие виды отсекают сами обработчики
    return False


def _pw_stamp(password_hash):
    """Отпечаток хэша пароля: сменился пароль — прежние входы на других устройствах перестают действовать."""
    return hashlib.sha256((password_hash or "").encode()).hexdigest()[:16]


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    if "user" not in g:
        row = get_db().execute("SELECT id, login, name, role, password_hash FROM users WHERE id=?", (uid,)).fetchone()
        g.user = None
        if row:
            stamp = _pw_stamp(row["password_hash"])
            if "pv" not in session:
                session["pv"] = stamp            # вход до появления отпечатка — дописываем молча
            if session["pv"] == stamp:
                g.user = {k: row[k] for k in ("id", "login", "name", "role")}
    return g.user


def user_json(u):
    return {"id": u["id"], "login": u["login"], "name": u["name"] or u["login"], "role": u["role"],
            "cowork": u["role"] == "admin" or bool(u["cowork"] if "cowork" in u.keys() else 0)}


def _can_cowork(user):
    """Connected WorkFlow открыт админу и тем, кому админ поставил допуск (08.10.2026, «только по допуску»)."""
    if not user:
        return False
    if user["role"] == "admin":
        return True
    row = get_db().execute("SELECT cowork FROM users WHERE id=?", (user["id"],)).fetchone()
    return bool(row and row["cowork"])


def me_json(u):
    """То, что фронт держит в state.user: учётка плюс «руководитель ли» — иначе сразу после входа
    кабинет руководителя закрыт до перезагрузки страницы (ошибка, замеченная 22.09.2026 на учётке CFO)."""
    d = user_json(u)
    d["is_manager"] = _is_manager(get_db(), d)
    emp = _my_employee(get_db(), d)
    d["emp_id"] = emp["id"] if emp else None
    d["english"] = bool(emp and emp["english"])   # есть ли вкладка «Английский язык» в посещаемости
    d["cowork"] = _can_cowork(u)                  # допуск к Connected WorkFlow — current_user() это поле не грузит
    return d


@app.before_request
def require_auth():
    path = request.path
    if IS_PROD and request.host.split(":")[0] not in TRUSTED_HOSTS:
        return "Неизвестный адрес портала.", 400
    # Изменяющие запросы принимаем только со своих страниц (защита от подделки запросов с чужих сайтов)
    if request.method in ("POST", "PUT", "DELETE"):
        origin = request.headers.get("Origin")
        if origin and origin.split("://", 1)[-1] != request.host:
            return jsonify({"error": "Запрос с чужого сайта отклонён."}), 403
    # Адрес файла принимаем только в прямом виде (06.10.2026, нашёл Security Engineer): «/static/./uploads/x»,
    # «/static/a/../uploads/x» и «…/x.jpg/» проверку ниже обходили, а Flask потом сам приводил путь и отдавал файл —
    # любой загруженный файл, включая резюме и чеки, открывался без входа.
    if path.startswith(("/static/", "/media/")) and (posixpath.normpath(path) != path or "\\" in path):
        return "not found", 404
    if path.lower().startswith(("/static/uploads/", "/media/")):
        path = path.lower() if os.name == "nt" else path          # Windows не различает регистр имён файлов
        # Загруженные фото и файлы — только для вошедших
        user = current_user()
        if not user:
            return "Нужно войти в портал.", 401
        # резюме кандидатов — персональные данные: открывают только HR и админ (24.09.2026)
        if path.rsplit("/", 1)[-1].startswith("resume-") and user["role"] not in ("admin", "hr"):
            return "Резюме открывают только HR и администратор.", 403
        # чеки к компенсациям — финансовые документы: бухгалтерия, админ и автор заявки (06.10.2026)
        fname = path.rsplit("/", 1)[-1]
        if fname.startswith("receipt-") and user["role"] not in ("admin", "accountant", "cfo") and not _receipt_is_mine(user, fname):
            return "Чек открывают только бухгалтерия и автор заявки.", 403
        return None
    if not path.startswith("/api/") or path in AUTH_FREE or path.startswith(AUTH_FREE_PREFIX):
        return None
    user = current_user()
    if not user:
        return jsonify({"error": "Нужно войти в портал.", "auth": "login"}), 401
    if request.method in ("POST", "PUT", "DELETE") and not can_write(user, request.method, path):
        return jsonify({"error": "У вашей учётной записи нет прав на это действие."}), 403
    if path.startswith("/api/admin/") and user["role"] != "admin":
        return jsonify({"error": "Админ-панель доступна только администратору."}), 403
    if path.startswith("/api/hr/") and user["role"] not in ("admin", "hr"):
        return jsonify({"error": "HR-панель доступна только отделу кадров."}), 403
    if path.startswith("/api/users") and user["role"] != "admin":
        return jsonify({"error": "Список учётных записей доступен только администратору."}), 403
    return None


# Защита от подбора пароля: после 5 неудач с одного адреса — пауза 60 секунд.
_login_fails = {}


def _client_ip():
    # nginx кладёт настоящий адрес клиента в X-Real-IP; X-Forwarded-For клиент может подделать
    return request.headers.get("X-Real-IP") or request.remote_addr or "?"


@app.route("/api/login", methods=["POST"])
def login():
    ip = _client_ip()
    fails, until = _login_fails.get(ip, (0, 0))
    if fails >= 5 and time.time() < until:
        return jsonify({"error": "Слишком много попыток. Подождите минуту и попробуйте снова."}), 429
    data = request.get_json(silent=True) or {}
    login_ = (data.get("login") or "").strip().lower()
    password = data.get("password") or ""
    row = get_db().execute(
        "SELECT * FROM users WHERE lower(login)=? OR lower(email)=?", (login_, login_)
    ).fetchone()
    acc_fails, acc_until = _login_fails.get("acc:" + login_, (0, 0))
    if acc_fails >= 10 and time.time() < acc_until:
        return jsonify({"error": "Слишком много неверных паролей для этой учётной записи. Подождите 15 минут."}), 429
    if row and row["must_set_password"]:
        return jsonify({"error": "Пароль ещё не задан. Откройте ссылку-приглашение от администратора."}), 403
    if not row or not check_password_hash(row["password_hash"], password):
        fails = fails + 1 if time.time() < until else 1
        _login_fails[ip] = (fails, time.time() + 60)
        if login_:
            _login_fails["acc:" + login_] = ((acc_fails + 1) if time.time() < acc_until else 1, time.time() + 900)
        if len(_login_fails) > 5000:            # чтобы словарь не рос бесконечно под перебором
            now_ = time.time()
            for k in [k for k, v in _login_fails.items() if v[1] < now_]:
                _login_fails.pop(k, None)
        return jsonify({"error": "Неверный логин или пароль."}), 401
    _login_fails.pop(ip, None)
    _login_fails.pop("acc:" + login_, None)
    session.clear()
    session["uid"] = row["id"]
    session.permanent = bool(data.get("remember"))
    session["pv"] = _pw_stamp(row["password_hash"])
    db = get_db()
    db.execute("UPDATE users SET last_login=? WHERE id=?", (datetime.now().isoformat(timespec="seconds"), row["id"]))
    db.commit()
    return jsonify(me_json(dict(row)))


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me", methods=["GET"])
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "Нужно войти в портал.", "auth": "login"}), 401
    return jsonify(me_json(user))


@app.route("/api/me/password", methods=["POST"])
def change_my_password():
    user = current_user()
    data = request.get_json(silent=True) or {}
    old, new = data.get("old") or "", data.get("new") or ""
    row = get_db().execute("SELECT password_hash FROM users WHERE id=?", (user["id"],)).fetchone()
    if not check_password_hash(row["password_hash"], old):
        return jsonify({"error": "Текущий пароль указан неверно."}), 400
    if len(new) < 8:
        return jsonify({"error": "Новый пароль должен быть не короче 8 символов."}), 400
    db = get_db()
    new_hash = generate_password_hash(new)
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (new_hash, user["id"]))
    db.commit()
    session["pv"] = _pw_stamp(new_hash)      # это устройство остаётся в портале, остальные выйдут
    return jsonify({"ok": True})


# ---- приглашение: сотрудник открывает ссылку и сам придумывает пароль ----
@app.route("/api/invite/<token>", methods=["GET", "POST"])
def invite(token):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE invite_token=?", (token,)).fetchone()   # и сброс пароля у учётки с паролем
    if not row:
        return jsonify({"error": "Ссылка недействительна или уже использована."}), 404
    if row["invite_created"] and datetime.now() - datetime.fromisoformat(row["invite_created"]) > timedelta(days=INVITE_TTL_DAYS):
        return jsonify({"error": "Срок действия ссылки истёк. Запросите новую на странице входа."}), 404
    if request.method == "GET":
        return jsonify({"login": row["login"], "name": row["name"] or row["login"], "email": row["email"]})
    data = request.get_json(silent=True) or {}
    new = data.get("password") or ""
    if len(new) < 8:
        return jsonify({"error": "Пароль должен быть не короче 8 символов."}), 400
    db.execute(
        "UPDATE users SET password_hash=?, invite_token=NULL, must_set_password=0, last_login=? WHERE id=?",
        (generate_password_hash(new), datetime.now().isoformat(timespec="seconds"), row["id"]),
    )
    db.commit()
    session.clear()
    session["uid"] = row["id"]
    session.permanent = True
    return jsonify(me_json(dict(row)))


# ---- почта: письма со ссылкой для первого входа / сброса пароля ----
ALLOWED_EMAIL_DOMAINS = {"connectedhome.kz", "elpass.kz"}


def smtp_configured():
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))


def send_mail(to, subject, body, html=None):
    """Отправляет письмо через SMTP из переменных окружения. Без настроек — пишет ссылку в лог."""
    if not smtp_configured():
        print(f"[почта не настроена] кому: {to}\n{body}", flush=True)
        return False
    try:
        _send_mail_smtp(to, subject, body, html)
    except Exception as e:
        _svc_mark("mail", False, e)
        raise
    _svc_mark("mail", True, subject)
    return True


def _send_mail_smtp(to, subject, body, html=None):
    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM") or os.environ["SMTP_USER"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")
    host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(msg)
    return True


_register_log = {}  # адрес/почта -> времена запросов за час


def _too_many(key, limit):
    now = time.time()
    recent = [t for t in _register_log.get(key, []) if now - t < 3600]
    _register_log[key] = recent + [now]
    return len(recent) >= limit


def register_mode():
    """Как сотрудники получают первый доступ: письмом (есть SMTP), по коду доступа, или никак (только админ)."""
    if smtp_configured():
        return "mail"
    if _setting("register_code"):
        return "code"
    return "off"


@app.route("/api/register", methods=["GET"])
def register_info():
    return jsonify({"mode": register_mode()})


@app.route("/api/users/register-code", methods=["GET", "PUT"])
def register_code():
    """Общий код доступа для первого входа. Только админ (проверка префикса /api/users в require_auth)."""
    if request.method == "GET":
        return jsonify({"code": _setting("register_code") or "", "mode": register_mode()})
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if code and len(code) < 6:
        return jsonify({"error": "Код должен быть не короче 6 символов."}), 400
    _set_setting("register_code", code)
    return jsonify({"code": code, "mode": register_mode()})


@app.route("/api/register", methods=["POST"])
def register():
    """Первый вход по корпоративной почте.
    Режим mail: высылаем письмо со ссылкой (ответ всегда одинаковый, чтобы не подсказывать, есть ли адрес).
    Режим code: почта + общий код доступа → сразу ссылка «придумайте пароль»."""
    generic = {"ok": True, "message": "Если этот адрес есть в справочнике сотрудников, письмо со ссылкой уже отправлено. "
                                      "Проверьте почту, в том числе папку «Спам»."}
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    mode = register_mode()
    if mode == "off":
        return jsonify({"error": "Самостоятельный вход пока не включён. Обратитесь к администратору портала."}), 400
    # По IP лимит щедрый: весь офис выходит в интернет с одного адреса, в день запуска зайдут все 61 разом.
    # От спама по ящикам защищает второй лимит — 3 письма в час на одну почту.
    if _too_many("ip:" + _client_ip(), 100) or _too_many("mail:" + email, 3):
        return jsonify({"error": "Слишком много попыток. Попробуйте через час."}), 429
    if not re.fullmatch(r"[a-z0-9._-]+@([a-z0-9.-]+\.[a-z]{2,})", email):
        return jsonify({"error": "Похоже, адрес указан с ошибкой."}), 400
    if email.split("@")[1] not in ALLOWED_EMAIL_DOMAINS:
        return jsonify({"error": "Подходит только корпоративная почта компании."}), 400
    db = get_db()
    emp = db.execute("SELECT name FROM employees WHERE lower(email)=?", (email,)).fetchone()
    user = db.execute("SELECT * FROM users WHERE lower(email)=? OR lower(login)=?", (email, email)).fetchone()

    if mode == "code":
        code = (data.get("code") or "").strip()
        if not code or not secrets.compare_digest(code, _setting("register_code") or ""):
            return jsonify({"error": "Неверный код доступа. Его сообщает администратор портала."}), 400
        if not emp and not user:
            return jsonify({"error": "Этого адреса нет в справочнике сотрудников. Обратитесь к администратору."}), 400
        if user and not user["must_set_password"]:
            return jsonify({"error": "Для этой почты пароль уже задан. Войдите с ним или попросите администратора сбросить."}), 400
        if user:
            uid, name = user["id"], user["name"] or emp["name"]
        else:
            uid, name = uuid.uuid4().hex, emp["name"]
            db.execute(
                "INSERT INTO users (id, login, password_hash, name, role, email, created) VALUES (?, ?, '!invited', ?, 'user', ?, ?)",
                (uid, email, name, email, datetime.now().isoformat(timespec="seconds")),
            )
        link = _invite_url(_new_invite(db, uid))
        db.commit()
        return jsonify({"ok": True, "link": link})

    if not emp and not user:
        return jsonify(generic)  # адреса нет в справочнике — молчим, чтобы не подсказывать
    if user:
        uid = user["id"]
        name = user["name"] or (emp["name"] if emp else email)
        first_time = bool(user["must_set_password"])
    else:
        uid = uuid.uuid4().hex
        name = emp["name"]
        first_time = True
        db.execute(
            "INSERT INTO users (id, login, password_hash, name, role, email, created) VALUES (?, ?, '!invited', ?, 'user', ?, ?)",
            (uid, email, name, email, datetime.now().isoformat(timespec="seconds")),
        )
    link = _invite_url(_new_invite(db, uid))
    db.commit()
    short = name.split()[-1] if name else ""
    body = (
        f"Здравствуйте, {short}!\n\n"
        + ("Вы запросили доступ к порталу Connected Community. " if first_time
           else "Вы запросили новый пароль для портала Connected Community. ")
        + "Откройте ссылку и придумайте пароль:\n\n"
        f"{link}\n\n"
        "Ссылка одноразовая. Если вы её не запрашивали — просто удалите это письмо, ничего не изменится.\n\n"
        "— Connected Community, внутренний портал Connected Home"
    )
    try:
        sent = send_mail(email, "Вход в портал Connected Community", body)
    except Exception as e:
        print(f"[ошибка отправки письма] {e}", flush=True)
        return jsonify({"error": "Не удалось отправить письмо. Обратитесь к администратору портала."}), 502
    out = dict(generic)
    if not sent and app.debug:
        out["dev_link"] = link  # только на localhost, для проверки без почты
    return jsonify(out)


def _new_invite(db, uid):
    """Ссылка для первого входа или сброса пароля. У учётки, где пароль уже задан, старый пароль работает до перехода
    по ссылке: иначе посторонний, зная почту сотрудника, одним запросом «Забыли пароль?» блокировал ему вход на 7 дней
    (нашёл Security Engineer 07.10.2026)."""
    token = secrets.token_urlsafe(24)
    db.execute("UPDATE users SET invite_token=?, invite_created=?, "
               "must_set_password=CASE WHEN password_hash='!invited' THEN 1 ELSE must_set_password END WHERE id=?",
               (token, datetime.now().isoformat(timespec="seconds"), uid))
    return token


def _invite_url(token):
    # Адрес берём из настроек, а не из заголовка Host: иначе письмо со ссылкой можно увести на чужой сайт
    # (запрос с поддельным Host → сотрудник кликает → одноразовый код утекает → чужой задаёт пароль).
    if IS_PROD:
        return f"{PORTAL_URL}/?invite={token}"
    return f"{request.scheme}://{request.host}/?invite={token}"


# ---- управление учётными записями (только админ; проверка — в require_auth) ----
@app.route("/api/users", methods=["GET", "POST"])
def users():
    db = get_db()
    if request.method == "GET":
        rows = db.execute(
            "SELECT id, login, name, role, email, must_set_password, created, last_login, cowork FROM users ORDER BY role, login"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    data = request.get_json(silent=True) or {}
    login_ = (data.get("login") or "").strip().lower()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = data.get("role") if data.get("role") in ROLES else "user"
    invite_mode = bool(data.get("invite"))
    if not login_ and email:
        login_ = email
    if not re.fullmatch(r"[a-z0-9._@-]{3,64}", login_):
        return jsonify({"error": "Логин: латиница, цифры, точка, дефис, подчёркивание или корпоративная почта."}), 400
    if email and not re.fullmatch(r"[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}", email):
        return jsonify({"error": "Похоже, почта указана с ошибкой."}), 400
    if not invite_mode and len(password) < 8:
        return jsonify({"error": "Пароль должен быть не короче 8 символов."}), 400
    if db.execute("SELECT 1 FROM users WHERE lower(login)=? OR (email<>'' AND lower(email)=?)",
                  (login_, email or "-")).fetchone():
        return jsonify({"error": "Такой логин или почта уже есть."}), 400
    uid = uuid.uuid4().hex
    db.execute(
        "INSERT INTO users (id, login, password_hash, name, role, email, created, cowork) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (uid, login_, generate_password_hash(password) if not invite_mode else "!invited",
         (data.get("name") or "").strip(), role, email, datetime.now().isoformat(timespec="seconds"),
         1 if data.get("cowork") in (1, True, "1", "true") else 0),   # допуск к Connected WorkFlow ставится и при создании
    )
    out = {"id": uid, "login": login_, "name": data.get("name") or "", "role": role, "email": email}
    if invite_mode:
        out["invite_url"] = _invite_url(_new_invite(db, uid))
    db.commit()
    return jsonify(out), 201


@app.route("/api/users/<item_id>", methods=["PUT", "DELETE"])
def user_item(item_id):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id=?", (item_id,)).fetchone()
    if not row:
        return jsonify({"error": "Учётная запись не найдена."}), 404
    me_ = current_user()
    if request.method == "DELETE":
        if row["id"] == me_["id"]:
            return jsonify({"error": "Нельзя удалить свою собственную учётную запись."}), 400
        db.execute("DELETE FROM users WHERE id=?", (item_id,))
        db.commit()
        return jsonify({"ok": True})
    data = request.get_json(silent=True) or {}
    if "name" in data:
        db.execute("UPDATE users SET name=? WHERE id=?", ((data.get("name") or "").strip(), item_id))
    if "role" in data:
        role = data["role"] if data["role"] in ROLES else "user"
        if row["id"] == me_["id"] and role != "admin":
            return jsonify({"error": "Нельзя снять права администратора с самого себя."}), 400
        db.execute("UPDATE users SET role=? WHERE id=?", (role, item_id))
    if "email" in data:
        db.execute("UPDATE users SET email=? WHERE id=?", ((data.get("email") or "").strip().lower(), item_id))
    if "cowork" in data:                                      # допуск к Connected WorkFlow — только админ (мы уже под /api/users)
        db.execute("UPDATE users SET cowork=? WHERE id=?", (1 if data["cowork"] in (1, True, "1", "true") else 0, item_id))
    invite_url = None
    if data.get("reinvite"):
        invite_url = _invite_url(_new_invite(db, item_id))
    if data.get("password"):
        if len(data["password"]) < 8:
            return jsonify({"error": "Пароль должен быть не короче 8 символов."}), 400
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(data["password"]), item_id))
    db.commit()
    row = db.execute(
        "SELECT id, login, name, role, email, must_set_password, created, last_login FROM users WHERE id=?", (item_id,)
    ).fetchone()
    out = dict(row)
    if invite_url:
        out["invite_url"] = invite_url
    return jsonify(out)


# ---------- pages ----------
@app.route("/")
def index():
    # Версия статики = время последнего изменения файлов: браузер не подсунет старый кэш
    # после обновления, обычного F5 достаточно.
    static_dir = BASE_DIR / "static"
    version = int(max(
        (static_dir / "app.js").stat().st_mtime,
        (static_dir / "style.css").stat().st_mtime,
        (static_dir / "i18n.js").stat().st_mtime,
        (static_dir / "i18n-auto.js").stat().st_mtime,
    ))
    return render_template("index.html", v=version)


# ---------- uploads ----------
@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400
    if (request.content_length or 0) > IMAGE_MAX_BYTES:
        return jsonify({"error": "file too large"}), 413
    file = request.files["file"]
    if file.filename == "" or not allowed_file(file.filename) or not looks_like_image(file.stream):
        return jsonify({"error": "invalid file"}), 400
    # Расширение берём из исходного имени: secure_filename выкидывает кириллицу,
    # и от «алихан.jpg» оставалось «jpg» без точки — загрузка падала с ошибкой 500.
    # Это безопасно: расширение уже проверено по белому списку, а имя файла мы генерируем сами.
    ext = file.filename.rsplit(".", 1)[1].lower()
    fname = f"{uuid.uuid4().hex}.{ext}"
    file.save(UPLOAD_DIR / fname)
    return jsonify({"url": f"/static/uploads/{fname}"}), 201


DOC_TEXT_MAX = 40000                     # сколько символов текста PDF храним для бота


def _pdf_text(path):
    """Текст из PDF для базы знаний бота. Дизайнерские PDF иногда без текста — тогда пустая строка."""
    try:
        from pypdf import PdfReader
        pages = PdfReader(str(path)).pages
        txt = "\n".join((p.extract_text() or "") for p in pages)
        txt = re.sub(r"[ \t]+", " ", txt)
        txt = re.sub(r"\n{3,}", "\n\n", txt).strip()
        return txt[:DOC_TEXT_MAX]
    except Exception as e:  # noqa: BLE001
        print(f"[pdf] текст не прочитался {path}: {e}", flush=True)
        return ""


def _office_text(path):
    """Текст из .docx/.xlsx (это zip с XML): вытаскиваем строки без тегов — для базы знаний бота."""
    import zipfile
    try:
        with zipfile.ZipFile(str(path)) as z:
            names = [n for n in z.namelist() if n in ("word/document.xml", "xl/sharedStrings.xml") or n.startswith("xl/worksheets/sheet")]
            chunks = []
            for n in names:
                x = z.read(n).decode("utf-8", "ignore")
                x = re.sub(r"</w:p>|</row>", "\n", x)
                x = re.sub(r"<[^>]+>", " ", x)
                chunks.append(x)
        txt = re.sub(r"[ \t]+", " ", "\n".join(chunks))
        txt = re.sub(r"\n\s*\n+", "\n", txt).strip()
        return txt[:DOC_TEXT_MAX]
    except Exception as e:  # noqa: BLE001
        print(f"[doc] текст не прочитался {path}: {e}", flush=True)
        return ""


def _doc_text(path):
    """Текст любого загруженного документа по расширению — PDF, Word или Excel."""
    ext = os.path.splitext(str(path).lower())[1]
    return _pdf_text(path) if ext == ".pdf" else _office_text(path)


DOC_MAX_BYTES = 64 * 1024 * 1024          # презентации, буклеты, бланки — файл до 64 МБ
DOC_TYPES = {".pdf": b"%PDF-", ".docx": b"PK\x03\x04", ".xlsx": b"PK\x03\x04"}   # расширение → сигнатура файла
PRESENTATIONS_CATEGORY = "Презентации"    # категория по умолчанию в таблице documents; раздел — «База знаний» (с 22.09.2026)


@app.route("/api/upload-doc", methods=["POST"])
def upload_doc():
    """Файл для «Базы знаний» или «Шаблонов документов»: PDF, Word (.docx) или Excel (.xlsx).
    Проверяем сигнатуру файла, не только расширение. Отдаётся через /media/<имя> — на проде файл отдаёт nginx."""
    if "file" not in request.files:
        return jsonify({"error": "Файл не выбран."}), 400
    if (request.content_length or 0) > DOC_MAX_BYTES:
        return jsonify({"error": "Файл больше 64 МБ."}), 413
    f = request.files["file"]
    ext = os.path.splitext(f.filename.lower())[1]
    head = f.stream.read(5)
    f.stream.seek(0)
    if ext not in DOC_TYPES or not head.startswith(DOC_TYPES[ext]):
        return jsonify({"error": "Нужен файл PDF, Word (.docx) или Excel (.xlsx)."}), 400
    fname = f"doc-{uuid.uuid4().hex}{ext}"
    f.save(UPLOAD_DIR / fname)
    return jsonify({"url": f"/media/{fname}", "size": (UPLOAD_DIR / fname).stat().st_size}), 201


RESUME_MAX_BYTES = 10 * 1024 * 1024


def _stream_size(f):
    """Настоящий размер загружаемого файла: заголовок Content-Length можно не прислать (chunked) — тогда предел не сработает
    (нашёл Security Engineer 07.10.2026)."""
    f.stream.seek(0, 2)
    size = f.stream.tell()
    f.stream.seek(0)
    return size
RESUME_TYPES = {".pdf": b"%PDF-", ".docx": b"PK\x03\x04"}


@app.route("/api/resume-upload", methods=["POST"])
def resume_upload():
    """Резюме кандидата к рекомендации: PDF или Word до 10 МБ, по сигнатуре. Файл resume-*.ext —
    открывают только HR и админ (проверка в require_auth)."""
    if "file" not in request.files:
        return jsonify({"error": "Файл не выбран."}), 400
    if (request.content_length or 0) > RESUME_MAX_BYTES:
        return jsonify({"error": "Резюме больше 10 МБ."}), 413
    f = request.files["file"]
    if _stream_size(f) > RESUME_MAX_BYTES:
        return jsonify({"error": "Резюме больше 10 МБ."}), 413
    ext = os.path.splitext(f.filename.lower())[1]
    head = f.stream.read(5)
    f.stream.seek(0)
    if ext not in RESUME_TYPES or not head.startswith(RESUME_TYPES[ext]):
        return jsonify({"error": "Резюме — файл PDF или Word (.docx)."}), 400
    # как у чеков: кто загрузил, брошенные старше суток убираем, не больше RECEIPT_PER_HOUR в час — иначе диск можно забить
    db, user = get_db(), current_user()
    now = datetime.utcnow()
    old = (now - timedelta(hours=RECEIPT_ORPHAN_HOURS)).isoformat(timespec="seconds")
    for r in db.execute("SELECT name FROM resumes WHERE request_id IS NULL AND created<?", (old,)).fetchall():
        (UPLOAD_DIR / r["name"]).unlink(missing_ok=True)
    db.execute("DELETE FROM resumes WHERE request_id IS NULL AND created<?", (old,))
    hour = (now - timedelta(hours=1)).isoformat(timespec="seconds")
    if db.execute("SELECT COUNT(*) FROM resumes WHERE user_id=? AND created>=?", (user["id"], hour)).fetchone()[0] >= RECEIPT_PER_HOUR:
        db.commit()
        return jsonify({"error": "Слишком много файлов за час — попробуйте позже."}), 429
    fname = f"resume-{uuid.uuid4().hex}{ext}"
    f.save(UPLOAD_DIR / fname)
    db.execute("INSERT INTO resumes (name, user_id, created) VALUES (?,?,?)", (fname, user["id"], now.isoformat(timespec="seconds")))
    db.commit()
    return jsonify({"url": f"/media/{fname}"}), 201


RESUME_URL = re.compile(r"^/media/resume-[0-9a-f]{32}\.(pdf|docx)$")


RECEIPT_MAX_BYTES = 10 * 1024 * 1024
RECEIPT_TYPES = {".pdf": b"%PDF-", ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff", ".png": b"\x89PNG\r\n\x1a\n"}
RECEIPT_URL = re.compile(r"^/media/receipt-[0-9a-f]{32}\.(pdf|jpg|jpeg|png)$")


@app.route("/api/receipt-upload", methods=["POST"])
def receipt_upload():
    """Чек к заявке «Компенсация по чекам» (06.10.2026): PDF, JPG или PNG до 10 МБ, по сигнатуре. Файл receipt-*.ext
    открывают только бухгалтерия, админ и автор заявки (проверка в require_auth). В базу знаний бота чеки не идут —
    сознательное исключение из правила «всё загруженное — в бота», как и резюме: это финансовые документы."""
    if "file" not in request.files:
        return jsonify({"error": "Файл не выбран."}), 400
    if (request.content_length or 0) > RECEIPT_MAX_BYTES:
        return jsonify({"error": "Чек больше 10 МБ."}), 413
    f = request.files["file"]
    if _stream_size(f) > RECEIPT_MAX_BYTES:
        return jsonify({"error": "Чек больше 10 МБ."}), 413
    ext = os.path.splitext(f.filename.lower())[1]
    head = f.stream.read(8)
    f.stream.seek(0)
    if ext not in RECEIPT_TYPES or not head.startswith(RECEIPT_TYPES[ext]):
        return jsonify({"error": "Чек — фото (JPG, PNG) или файл PDF."}), 400
    db, user = get_db(), current_user()
    now = datetime.utcnow()
    # брошенные чеки (загрузил, а заявку не подал) старше суток убираем; заодно это не даёт забить диск
    old = (now - timedelta(hours=RECEIPT_ORPHAN_HOURS)).isoformat(timespec="seconds")
    for r in db.execute("SELECT name FROM receipts WHERE request_id IS NULL AND created<?", (old,)).fetchall():
        (UPLOAD_DIR / r["name"]).unlink(missing_ok=True)
    db.execute("DELETE FROM receipts WHERE request_id IS NULL AND created<?", (old,))
    hour = (now - timedelta(hours=1)).isoformat(timespec="seconds")
    if db.execute("SELECT COUNT(*) FROM receipts WHERE user_id=? AND created>=?", (user["id"], hour)).fetchone()[0] >= RECEIPT_PER_HOUR:
        db.commit()
        return jsonify({"error": "Слишком много файлов за час — попробуйте позже."}), 429
    fname = f"receipt-{uuid.uuid4().hex}{ext}"
    f.save(UPLOAD_DIR / fname)
    db.execute("INSERT INTO receipts (name, user_id, created) VALUES (?,?,?)", (fname, user["id"], now.isoformat(timespec="seconds")))
    db.commit()
    return jsonify({"url": f"/media/{fname}"}), 201


# ИИ-инструменты, за которые можно просить компенсацию: только из списка (слова пользователя 06.10.2026).
# Тот же список — COMPENSATION_TOOLS в static/app.js; совпадение проверяет checks/fullcheck.py.
COMPENSATION_TOOLS = ("Claude", "Gemini", "ChatGPT", "DeepSeek", "Perplexity", "Microsoft Copilot", "GitHub Copilot", "Cursor", "Midjourney", "Grok")
RECEIPT_ORPHAN_HOURS = 24
RECEIPT_PER_HOUR = 20
REQUEST_FIELDS_MAX = 80        # полей в одной заявке: в самой длинной форме (подбор) их около сорока


def _receipt_is_mine(user, fname):
    """Чек открывает тот, кто его загрузил (он же автор заявки). Сверяем по записи о загрузке, а не по тексту заявки:
    иначе чужой чек можно было «присвоить», вписав его адрес в любое поле своей заявки (нашёл Security Engineer)."""
    row = get_db().execute("SELECT 1 FROM receipts WHERE name=? AND user_id=?", (fname, user["id"])).fetchone()
    return row is not None


# ---------- заявки ----------
REQUEST_TYPES = {"trip": "Командировка", "equipment": "Техника и оборудование", "it": "Поддержка IT",
                 "vacation": "Трудовой отпуск", "unpaid": "Отпуск без сохранения",
                 "hiring": "Подбор персонала", "dismissal": "Увольнение", "buddy": "Mentor для новичка",
                 "referral": "Рекомендация кандидата", "compensation": "Компенсация по чекам"}
REQUEST_STATUSES = {"approval", "new", "in_progress", "ordered", "done", "rejected", "cancelled"}
REQUEST_REQUIRED = {
    "trip": ("full_name", "purpose", "from_city", "to_city", "date_start", "date_end", "transport"),
    "equipment": ("full_name", "item", "reason"),
    "it": ("full_name", "problem"),
    "vacation": ("full_name", "purpose"),
    "unpaid": ("full_name", "date_start", "date_end", "reason"),
    "hiring": ("full_name", "position", "department", "reason", "duties"),
    "dismissal": ("full_name", "last_day", "reason"),
    "buddy": ("full_name", "motivation"),
    "referral": ("full_name", "vacancy", "candidate", "contact"),
    "compensation": ("full_name", "category", "receipt"),
}
REQUEST_OWNER_ROLE = {"trip": "hr", "equipment": "buyer", "it": "admin", "vacation": "hr",
                      "unpaid": "hr", "hiring": "hr", "dismissal": "hr",
                      "buddy": "hr", "referral": "hr", "compensation": "accountant"}   # кому падает заявка; рекомендация кандидата на вакансию — тоже сразу в HR; «Mentor для новичка» — сразу в HR, без согласования (24.09.2026)


MANAGER_ONLY_REQUESTS = {"hiring"}    # подать может только руководитель (решение пользователя 22.09.2026)

# Сначала директор подразделения, потом HR/закупщик (решение пользователя 23.09.2026).
# Подбор (его подаёт сам директор) и поддержка IT идут напрямую.
APPROVAL_TYPES = {"trip", "equipment", "vacation", "unpaid", "dismissal"}


def _ceo(db):
    return db.execute("SELECT * FROM employees WHERE department='Руководство' AND is_head=1 LIMIT 1").fetchone()


def _approver_for(db, user):
    """Кто согласует заявку сотрудника: глава его подразделения; у самих глав и у подразделений без главы — CEO.
    Заявки CEO и учёток без карточки в справочнике идут без согласования (None)."""
    me = _my_employee(db, user)
    if me is None:
        return None
    ceo = _ceo(db)
    if me["is_head"]:
        head = ceo
    else:
        head = db.execute("SELECT * FROM employees WHERE department=? AND is_head=1 LIMIT 1", (me["department"],)).fetchone() or ceo
    if head is None or head["id"] == me["id"]:
        return None
    return head


def _employees_with_accounts(db):
    """employees.id тех, у кого есть учётка (по почте или по имени) — чтобы HR видела, что директор ещё не в портале."""
    users = db.execute("SELECT email, name FROM users").fetchall()       # регистр сводим в Python: lower() SQLite кириллицу не трогает
    mails = {(u["email"] or "").lower() for u in users if u["email"]}
    names = {(u["name"] or "").strip().lower() for u in users if u["name"]}
    return {r["id"] for r in db.execute("SELECT id, email, name FROM employees")
            if (r["email"] or "").lower() in mails or (r["name"] or "").strip().lower() in names}


def _is_manager(db, user):
    """Руководитель подразделения: админ — всегда; сотрудник — только если в справочнике
    у него стоит флаг «руководитель подразделения» (is_head). Наличие подчинённых не считается,
    HR тоже не подаёт (она получает) — решение пользователя 22.09.2026: главы подразделений и админ."""
    if user["role"] == "admin":
        return True
    me_row = _my_employee(db, user)
    return bool(me_row and me_row["is_head"])


def _can_manage(user, rtype):
    """Админ ведёт всё; HR — командировки и отпуска; закупщик — технику; бухгалтер — компенсации по чекам."""
    return user["role"] == "admin" or user["role"] == REQUEST_OWNER_ROLE.get(rtype)


def _is_staff(user):
    """Кто видит все заявки и меняет статусы: HR и админ."""
    return user["role"] in ("admin", "hr")


def _request_json(row):
    d = dict(row)
    try:
        d["data"] = json.loads(d.get("data") or "{}")
    except ValueError:
        d["data"] = {}
    return d


# Писем о заявках НЕТ — решение пользователя 18.09.2026: заявки живут только внутри портала
# (HR-панель, панель закупщика, вкладка «Поддержка IT» в админ-панели + счётчики в меню и блок «К рассмотрению»).
# Почтой портал шлёт только два вида писем: ссылки для входа/сброса пароля и понедельничный отчёт об опозданиях.


@app.route("/api/requests", methods=["GET", "POST"])
def requests_collection():
    db = get_db()
    user = current_user()
    if request.method == "GET":
        # Админ видит всё; HR — командировки (в них паспортные данные), закупщик — технику, бухгалтер — компенсации; каждый ещё и свои.
        if user["role"] == "admin":
            rows = db.execute("SELECT * FROM requests ORDER BY created DESC").fetchall()
        else:
            managed = [t for t, role in REQUEST_OWNER_ROLE.items() if role == user["role"]] + list(REQUEST_VIEW_ROLES.get(user["role"], ())) or ["-"]
            marks = ",".join("?" * len(managed))
            me = _my_employee(db, user)
            rows = db.execute(
                f"SELECT * FROM requests WHERE user_id=? OR type IN ({marks}) OR (approver_id IS NOT NULL AND approver_id=?) ORDER BY created DESC",
                (user["id"], *managed, me["id"] if me else "-"),
            ).fetchall()
        online = _employees_with_accounts(db)
        out = []
        for r in rows:
            d = _request_json(r)
            if not _can_manage(user, d["type"]) and d["type"] not in REQUEST_VIEW_ROLES.get(user["role"], ()):
                d.pop("done_by", None)                # кто закрыл заявку — только тем, кто ведёт или просматривает этот вид
            if d.get("approver_id"):
                d["approver_online"] = d["approver_id"] in online
            out.append(d)
        return jsonify(out)

    payload = request.get_json(silent=True) or {}
    rtype = payload.get("type")
    if rtype not in REQUEST_TYPES:
        return jsonify({"error": "Неизвестный вид заявки."}), 400
    if rtype in MANAGER_ONLY_REQUESTS and not _is_manager(db, user):
        return jsonify({"error": "Эту заявку подаёт только руководитель подразделения."}), 403
    raw = payload.get("data") or {}
    if not isinstance(raw, dict):
        return jsonify({"error": "Форма заполнена некорректно."}), 400
    if len(raw) > REQUEST_FIELDS_MAX:
        return jsonify({"error": "Форма заполнена некорректно."}), 400
    data = {str(k)[:40]: str(v)[:2000].strip() for k, v in raw.items() if v not in (None, "")}
    missing = [f for f in REQUEST_REQUIRED[rtype] if not data.get(f)]
    if missing:
        return jsonify({"error": "Заполните обязательные поля, отмеченные звёздочкой."}), 400
    if rtype == "trip" and data["date_end"] < data["date_start"]:
        return jsonify({"error": "Дата окончания раньше даты начала."}), 400
    if rtype == "compensation":
        # Компенсация по чекам (06.10.2026): сразу в бухгалтерию, без согласования руководителем — выбор пользователя.
        # два вида компенсации (06.10.2026): за ИИ-инструмент — какой именно; «другое» — свободное описание покупки
        if data["category"] not in ("ai", "other") or not data.get("tool" if data["category"] == "ai" else "item"):
            return jsonify({"error": "Заполните обязательные поля, отмеченные звёздочкой."}), 400
        for extra in (("item",) if data["category"] == "ai" else ("tool",)):
            data.pop(extra, None)                             # поля другого вида в заявке не храним
        # чек — только свой, только что загруженный и ещё не приложенный к другой заявке: один чек — одна заявка
        receipt_name = data["receipt"].rsplit("/", 1)[-1] if RECEIPT_URL.match(data["receipt"]) else ""
        mine = db.execute("SELECT 1 FROM receipts WHERE name=? AND user_id=? AND request_id IS NULL", (receipt_name, user["id"])).fetchone()
        if not mine or not (UPLOAD_DIR / receipt_name).is_file():
            return jsonify({"error": "Приложите чек: фото или файл PDF."}), 400
        # сумму, период и дату покупки не спрашиваем — они есть в чеке (слова пользователя 06.10.2026); присланные лишние не храним
        for extra in ("amount", "date", "period"):
            data.pop(extra, None)
        if data["category"] == "ai" and data["tool"] not in COMPENSATION_TOOLS:
            return jsonify({"error": "Выберите ИИ-инструмент из списка."}), 400
    resume_name = ""
    if rtype == "referral" and str(data.get("resume") or "").startswith("/media/"):
        # резюме файлом — только своё, только что загруженное и ещё не приложенное (как чек): чужой адрес не присвоить
        resume_name = data["resume"].rsplit("/", 1)[-1] if RESUME_URL.match(data["resume"]) else ""
        mine = db.execute("SELECT 1 FROM resumes WHERE name=? AND user_id=? AND request_id IS NULL", (resume_name, user["id"])).fetchone()
        if not mine or not (UPLOAD_DIR / resume_name).is_file():
            return jsonify({"error": "Приложите резюме файлом или ссылкой."}), 400
    now = datetime.now().isoformat(timespec="seconds")
    head = _approver_for(db, user) if rtype in APPROVAL_TYPES else None
    item = {
        "id": uuid.uuid4().hex, "type": rtype, "user_id": user["id"],
        "author_name": data.get("full_name") or user["name"] or user["login"],
        "status": "approval" if head else "new", "data": data, "hr_comment": "", "created": now, "updated": now,
        "approver_id": head["id"] if head else None, "approver_name": head["name"] if head else None,
        "approver_pos": head["position"] if head else None,
    }
    db.execute(
        "INSERT INTO requests (id, type, user_id, author_name, status, data, hr_comment, created, updated, approver_id, approver_name, approver_pos) "
        "VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)",
        (item["id"], rtype, user["id"], item["author_name"], item["status"], json.dumps(data, ensure_ascii=False), now, now,
         item["approver_id"], item["approver_name"], item["approver_pos"]),
    )
    if rtype == "compensation":
        db.execute("UPDATE receipts SET request_id=? WHERE name=?", (item["id"], receipt_name))
    if resume_name:
        db.execute("UPDATE resumes SET request_id=? WHERE name=?", (item["id"], resume_name))
    db.commit()
    if head:
        item["approver_online"] = head["id"] in _employees_with_accounts(db)
    return jsonify(item), 201


@app.route("/api/requests/<item_id>", methods=["PUT", "DELETE"])
def request_item(item_id):
    """Статус и комментарий — HR/админ (обычного сотрудника сюда не пустит require_auth)."""
    db = get_db()
    row = db.execute("SELECT * FROM requests WHERE id=?", (item_id,)).fetchone()
    if row is None or not _can_manage(current_user(), row["type"]):
        return jsonify({"error": "Заявка не найдена."}), 404      # чужой вид заявок — как будто её нет
    if request.method == "DELETE":
        # пока директор не решил, закупщик и HR заявку не удаляют (решение пользователя 07.10.2026); админ может
        if row["status"] == "approval" and current_user()["role"] != "admin":
            return jsonify({"error": "Заявка ещё ждёт одобрения руководителя — удалить её можно после согласования."}), 400
        db.execute("DELETE FROM requests WHERE id=?", (item_id,))
        db.commit()
        # вместе с заявкой уходит и файл чека — по записи о загрузке, а не по адресу из заявки (чужой файл так не стереть)
        for r in db.execute("SELECT name FROM receipts WHERE request_id=?", (item_id,)).fetchall():
            (UPLOAD_DIR / r["name"]).unlink(missing_ok=True)
        db.execute("DELETE FROM receipts WHERE request_id=?", (item_id,))
        for r in db.execute("SELECT name FROM resumes WHERE request_id=?", (item_id,)).fetchall():
            (UPLOAD_DIR / r["name"]).unlink(missing_ok=True)
        db.execute("DELETE FROM resumes WHERE request_id=?", (item_id,))
        db.commit()
        return jsonify({"deleted": item_id})
    payload = request.get_json(silent=True) or {}
    status = payload.get("status", row["status"])
    if status not in REQUEST_STATUSES:
        return jsonify({"error": "Неизвестный статус."}), 400
    if row["status"] == "approval" and current_user()["role"] != "admin":
        return jsonify({"error": "Заявка ещё ждёт одобрения руководителя — обработать её можно после согласования."}), 400
    if status == "approval" and row["status"] != "approval":
        return jsonify({"error": "Вернуть заявку на согласование нельзя."}), 400
    comment = (payload.get("hr_comment", row["hr_comment"]) or "").strip()[:2000]
    now = datetime.now().isoformat(timespec="seconds")
    me = current_user()
    # дата закрытия ставится один раз, в момент перехода в «готово»; вернули из «готово» в работу — стирается
    done_at, done_by = row["done_at"], row["done_by"]
    if status == "done" and row["status"] != "done":
        done_at, done_by = now, (me["name"] or me["login"])
    elif status != "done":
        done_at, done_by = None, None
    db.execute("UPDATE requests SET status=?, hr_comment=?, updated=?, done_at=?, done_by=? WHERE id=?",
               (status, comment, now, done_at, done_by, item_id))
    db.commit()
    return jsonify(_request_json(db.execute("SELECT * FROM requests WHERE id=?", (item_id,)).fetchone()))


@app.route("/api/requests/<item_id>/cancel", methods=["POST"])
def request_cancel(item_id):
    """Сотрудник отменяет свою заявку, пока её не взяли в работу."""
    db = get_db()
    user = current_user()
    row = db.execute("SELECT * FROM requests WHERE id=?", (item_id,)).fetchone()
    if row is None or (row["user_id"] != user["id"] and not _can_manage(user, row["type"])):
        return jsonify({"error": "Заявка не найдена."}), 404
    if row["status"] not in ("new", "approval"):
        return jsonify({"error": "Заявку уже взяли в работу — для отмены напишите ответственному."}), 400
    db.execute("UPDATE requests SET status='cancelled', updated=? WHERE id=?",
               (datetime.now().isoformat(timespec="seconds"), item_id))
    db.commit()
    return jsonify(_request_json(db.execute("SELECT * FROM requests WHERE id=?", (item_id,)).fetchone()))


@app.route("/api/requests/<item_id>/approve", methods=["POST"])
def request_approve(item_id):
    """Директор подразделения одобряет или отклоняет заявку своего человека; админ может решить за него."""
    db = get_db()
    user = current_user()
    row = db.execute("SELECT * FROM requests WHERE id=?", (item_id,)).fetchone()
    me = _my_employee(db, user)
    is_approver = row is not None and me is not None and row["approver_id"] == me["id"]
    if row is None or not (is_approver or user["role"] == "admin"):
        return jsonify({"error": "Заявка не найдена."}), 404
    if row["status"] != "approval":
        return jsonify({"error": "Решение по этой заявке уже принято."}), 400
    data = request.get_json(silent=True) or {}
    decision = data.get("decision")
    if decision not in ("approve", "reject"):
        return jsonify({"error": "Нужно решение: одобрить или отклонить."}), 400
    comment = (data.get("comment") or "").strip()[:2000]
    if decision == "reject" and not comment:
        return jsonify({"error": "Напишите причину отказа — сотрудник её увидит."}), 400
    who = me["name"] if is_approver else f"{user['name'] or user['login']} (за {row['approver_name']})"
    now = datetime.now().isoformat(timespec="seconds")
    db.execute("UPDATE requests SET status=?, decided_by=?, decided_at=?, approver_comment=?, updated=? WHERE id=?",
               ("new" if decision == "approve" else "rejected", who, now, comment, now, item_id))
    db.commit()
    d = _request_json(db.execute("SELECT * FROM requests WHERE id=?", (item_id,)).fetchone())
    return jsonify(d)


# ---------- приветственное видео для новых сотрудников ----------
def _looks_like_video(stream):
    """MP4/MOV: на 4–8 байте стоит «ftyp»; WebM начинается с 1A 45 DF A3. Отсекает переименованные файлы."""
    head = stream.read(12)
    stream.seek(0)
    return head[4:8] == b"ftyp" or head[:4] == bytes.fromhex("1a45dfa3")


def _welcome_video():
    raw = _setting("welcome_video")
    if not raw:
        return {}
    try:
        v = json.loads(raw)
    except ValueError:
        return {}
    return v if v.get("file") and (UPLOAD_DIR / v["file"]).is_file() else {}


@app.route("/api/welcome-video", methods=["GET", "POST", "DELETE"])
def welcome_video():
    if request.method == "GET":
        return jsonify(_welcome_video())
    old = _welcome_video()
    if request.method == "DELETE":
        if old:
            (UPLOAD_DIR / old["file"]).unlink(missing_ok=True)
        _set_setting("welcome_video", "")
        return jsonify({})
    f = request.files.get("file")
    if not f or "." not in f.filename:
        return jsonify({"error": "Выберите видеофайл."}), 400
    ext = f.filename.rsplit(".", 1)[1].lower()
    if ext not in VIDEO_EXT or not _looks_like_video(f.stream):
        return jsonify({"error": "Подходит видео в формате MP4, MOV или WebM."}), 400
    if (request.content_length or 0) > VIDEO_MAX_BYTES:
        return jsonify({"error": "Файл больше 500 МБ. Сожмите видео до Full HD — на экране разницы не будет."}), 413
    name = f"welcome-{uuid.uuid4().hex}.{ext}"
    f.save(UPLOAD_DIR / name)
    user = current_user()
    v = {
        "file": name, "url": f"/media/{name}",
        "title": (request.form.get("title") or "").strip()[:120] or "Добро пожаловать в Connected Home",
        "size": (UPLOAD_DIR / name).stat().st_size,
        "author": user["name"] or user["login"],
        "uploaded": datetime.utcnow().isoformat(timespec="seconds"),
    }
    _set_setting("welcome_video", json.dumps(v, ensure_ascii=False))
    if old and old["file"] != name:
        (UPLOAD_DIR / old["file"]).unlink(missing_ok=True)   # видео одно — прежнее убираем, место не копится
    return jsonify(v), 201


@app.route("/media/<path:name>")
def media(name):
    """Видео отдаём мимо приложения: проверили вход (require_auth) — и поручаем файл nginx (X-Accel-Redirect).
    Так просмотр несколькими людьми сразу не тормозит портал. Локально отдаём сами, с поддержкой перемотки."""
    if "/" in name or not (UPLOAD_DIR / name).is_file():
        return "not found", 404
    if os.environ.get("MEDIA_ACCEL") == "1":
        resp = app.response_class(status=200)
        resp.headers["X-Accel-Redirect"] = "/_protected_uploads/" + name
        resp.headers["Content-Type"] = ""        # тип определит nginx по расширению
        return resp
    return send_from_directory(UPLOAD_DIR, name, conditional=True)


# ---------- news ----------
@app.route("/api/news", methods=["GET", "POST"])
def news_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute(
            "SELECT * FROM news ORDER BY pinned DESC, date DESC"
        ).fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    ntype = "newcomer" if data.get("type") == "newcomer" else "news"
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    author = (data.get("author") or "").strip()
    image = _clean_url(data.get("image"))
    person_name = (data.get("person_name") or "").strip()
    if ntype == "newcomer":
        if not person_name:
            return jsonify({"error": "Укажите имя нового сотрудника."}), 400
        title = title or "У нас пополнение!"
    if not title or not body:
        return jsonify({"error": "Заполните заголовок и текст."}), 400

    item = {
        "id": uuid.uuid4().hex,
        "title": title,
        "body": body,
        "author": author,
        "date": datetime.utcnow().isoformat(),
        "pinned": 0,
        "image": image,
        "type": ntype,
        "person_name": person_name,
        "person_position": (data.get("person_position") or "").strip(),
        "person_department": (data.get("person_department") or "").strip(),
    }
    db.execute(
        "INSERT INTO news (id, title, body, author, date, pinned, image, type, person_name, person_position, person_department) "
        "VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)",
        (item["id"], item["title"], item["body"], item["author"], item["date"], item["image"],
         item["type"], item["person_name"], item["person_position"], item["person_department"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/news/<item_id>", methods=["PUT", "DELETE"])
def news_item(item_id):
    db = get_db()
    if request.method == "PUT":
        row = db.execute("SELECT * FROM news WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            return jsonify({"error": "Новость не найдена."}), 404
        data = request.get_json(silent=True) or {}
        title = (data.get("title", row["title"]) or "").strip()
        body = (data.get("body", row["body"]) or "").strip()
        author = (data.get("author", row["author"]) or "").strip()
        image = _clean_url(data.get("image", row["image"]))  # пустая строка = убрать фото
        ntype = data.get("type", row["type"]) if data.get("type", row["type"]) in ("news", "newcomer") else "news"
        person_name = (data.get("person_name", row["person_name"]) or "").strip()
        person_position = (data.get("person_position", row["person_position"]) or "").strip()
        person_department = (data.get("person_department", row["person_department"]) or "").strip()
        if ntype == "newcomer" and not person_name:
            return jsonify({"error": "Укажите имя нового сотрудника."}), 400
        if not title or not body:
            return jsonify({"error": "Заголовок и текст не могут быть пустыми."}), 400
        db.execute(
            "UPDATE news SET title=?, body=?, author=?, image=?, type=?, person_name=?, person_position=?, person_department=? WHERE id=?",
            (title, body, author, image, ntype, person_name, person_position, person_department, item_id))
        db.commit()
        return jsonify(row_to_dict(db.execute("SELECT * FROM news WHERE id = ?", (item_id,)).fetchone()))
    db.execute("DELETE FROM news WHERE id = ?", (item_id,))
    db.execute("DELETE FROM comments WHERE news_id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


@app.route("/api/news/<item_id>/pin", methods=["POST"])
def toggle_pin(item_id):
    db = get_db()
    row = db.execute("SELECT pinned FROM news WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    new_val = 0 if row["pinned"] else 1
    db.execute("UPDATE news SET pinned = ? WHERE id = ?", (new_val, item_id))
    db.commit()
    return jsonify({"id": item_id, "pinned": new_val})


# ---------- comments ----------
@app.route("/api/news/<news_id>/comments", methods=["GET", "POST"])
def comments_collection(news_id):
    db = get_db()
    if request.method == "GET":
        rows = db.execute(
            "SELECT * FROM comments WHERE news_id = ? ORDER BY date ASC", (news_id,)
        ).fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()[:2000]
    user = current_user()
    author = user["name"] or user["login"]          # имя берём из учётки: присланному браузером не верим
    if not text:
        return jsonify({"error": "Напишите текст комментария."}), 400
    if not db.execute("SELECT 1 FROM news WHERE id=?", (news_id,)).fetchone():
        return jsonify({"error": "Новость не найдена."}), 404
    item = {
        "id": uuid.uuid4().hex,
        "news_id": news_id,
        "author": author,
        "text": text,
        "date": datetime.utcnow().isoformat(),
    }
    db.execute(
        "INSERT INTO comments (id, news_id, author, text, date, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        (item["id"], item["news_id"], item["author"], item["text"], item["date"], user["id"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/comments/<item_id>", methods=["DELETE"])
def comment_item(item_id):
    """Удалить комментарий: автор — свой, HR и админ — любой."""
    db = get_db()
    user = current_user()
    row = db.execute("SELECT user_id FROM comments WHERE id=?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Комментарий не найден."}), 404
    if user["role"] not in ("admin", "hr") and row["user_id"] != user["id"]:
        return jsonify({"error": "Удалить можно только свой комментарий."}), 403
    db.execute("DELETE FROM comments WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- documents ----------
@app.route("/api/documents", methods=["GET", "POST"])
def documents_collection():
    db = get_db()
    if request.method == "GET":
        out = []
        for r in db.execute("SELECT * FROM documents ORDER BY category, title"):
            d = row_to_dict(r)
            # Текст файла (до 40 тыс. знаков на документ) нужен только боту — он читает его из базы сам. В списке он раздувал
            # ответ до 500 КБ, и «База знаний» с «Шаблонами» открывались по 3–15 секунд (нашла проверка в браузерах 06.10.2026).
            d["has_text"] = bool((d.pop("text", "") or "").strip())
            if (d.get("link") or "").startswith("/media/"):
                p = UPLOAD_DIR / d["link"].split("/media/", 1)[1]
                d["size"] = p.stat().st_size if p.is_file() else 0
            out.append(d)
        return jsonify(out)

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "Общие").strip() or "Общие"
    description = (data.get("description") or "").strip()
    link = _clean_url(data.get("link"))
    required = 1 if data.get("required") else 0
    section = "templates" if data.get("section") == "templates" else "knowledge"
    if not title:
        return jsonify({"error": "title is required"}), 400

    text = ""
    if link.startswith("/media/doc-"):           # свой файл — вытягиваем текст, чтобы бот мог по нему отвечать
        p = UPLOAD_DIR / link.split("/media/", 1)[1]
        if p.is_file():
            text = _doc_text(p)
    item = {
        "id": uuid.uuid4().hex,
        "category": category,
        "title": title,
        "description": description,
        "link": link,
        "required": required,
        "section": section,
    }
    db.execute(
        "INSERT INTO documents (id, category, title, description, link, required, text, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (item["id"], item["category"], item["title"], item["description"], item["link"], required, text, section),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/documents/<item_id>", methods=["DELETE"])
def documents_item(item_id):
    db = get_db()
    row = db.execute("SELECT link FROM documents WHERE id = ?", (item_id,)).fetchone()
    if row and (row["link"] or "").startswith("/media/doc-"):     # свой загруженный PDF — убираем и файл
        p = UPLOAD_DIR / row["link"].split("/media/", 1)[1]
        if p.is_file():
            p.unlink()
    db.execute("DELETE FROM documents WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- профиль сотрудника «О себе» (07.10.2026) ----------
# Слова пользователя: «хочу чтобы у сотрудника был как профиль, не только контактные данные но можно было бы заполнить о себе
# хобби универ и т д»; «чтобы это уже заполнялось опционально, а нужная инфа от hr». Его ответы на вопросы: дату прихода
# заполняет HR (колонка employees.hired); заполненный профиль виден коллегам сразу (visible=1), выключатель — чтобы спрятать;
# очистить чужой профиль могут админ и HR. Отдельная таблица profiles по employee_id — чтобы скрытый профиль не утекал через
# SELECT * и выгрузку, а HR-форма не разрасталась. Скрытый профиль не уходит ни коллегам, ни боту.
PROFILE_TEXT = {"about": 1000, "edu_school": 200, "edu_major": 200, "hometown": 100, "fav_book": 200, "fav_film": 200, "fav_music": 200}
PROFILE_TAGS = ("hobbies", "skills", "languages")
PROFILE_TAG_MAX, PROFILE_TAG_LEN = 20, 40


def _tags(value):
    """Теги из списка или строки через запятую / точку с запятой / перенос: без пустых и повторов, не больше 20 по 40 знаков."""
    items = value if isinstance(value, list) else re.split(r"[,;\n]+", str(value or ""))
    out = []
    for t in items:
        t = str(t).strip()[:PROFILE_TAG_LEN]
        if t and t.lower() not in [x.lower() for x in out]:
            out.append(t)
    return out[:PROFILE_TAG_MAX]


def _profile_json(r):
    d = {k: (r[k] or "") for k in PROFILE_TEXT}
    d["edu_year"] = r["edu_year"] or ""
    for k in PROFILE_TAGS:
        d[k] = _tags(r[k])
    d["visible"] = bool(r["visible"])
    d["updated"] = r["updated"]
    return d


def _profile_filled(p):
    return any(p.get(k) for k in list(PROFILE_TEXT) + ["edu_year"] + list(PROFILE_TAGS))


# что о коллегах видит обычный сотрудник: без карточек турникета и без года рождения (хвост Security Engineer 07.10.2026);
# HR и админ получают строку целиком — им это нужно в форме карточки
EMPLOYEE_PUBLIC = ("id", "name", "position", "department", "email", "phone", "telegram", "office", "seat", "birthday", "photo",
                   "schedule", "remote", "fieldwork", "company", "is_head", "english", "unit", "reports_to", "hired")


def _employees_json(db, user):
    staff = user["role"] in ("admin", "hr")
    me = _my_employee(db, user)
    my_id = me["id"] if me else None
    profs = {r["employee_id"]: _profile_json(r) for r in db.execute("SELECT * FROM profiles")}
    out = []
    for r in db.execute("SELECT * FROM employees ORDER BY department, name").fetchall():
        d = row_to_dict(r) if staff else {k: r[k] for k in EMPLOYEE_PUBLIC}
        if not staff and re.fullmatch(r"\d{4}-\d{2}-\d{2}.*", d.get("birthday") or ""):
            d["birthday"] = "2000" + d["birthday"][4:10]        # коллегам нужен день и месяц, год — нет
        p = profs.get(r["id"])
        if p and _profile_filled(p) and (p["visible"] or staff or r["id"] == my_id):
            d["profile"] = p
        out.append(d)
    return out


@app.route("/api/me/profile", methods=["GET", "PUT"])
def my_profile():
    """Свой профиль: заполняет сам сотрудник, только для своей карточки в справочнике (по почте или имени учётки)."""
    db, user = get_db(), current_user()
    emp = _my_employee(db, user)
    if emp is None:
        return jsonify({"error": "Карточка сотрудника не найдена — попросите администратора связать учётную запись со справочником."}), 400
    if request.method == "GET":
        row = db.execute("SELECT * FROM profiles WHERE employee_id=?", (emp["id"],)).fetchone()
        return jsonify({"employee_id": emp["id"], "profile": _profile_json(row) if row else None})
    data = request.get_json(silent=True) or {}
    vals = {k: str(data.get(k) or "").strip()[:n] for k, n in PROFILE_TEXT.items()}
    year = re.sub(r"\D", "", str(data.get("edu_year") or ""))[:4]
    vals["edu_year"] = year if len(year) == 4 else ""
    for k in PROFILE_TAGS:
        vals[k] = ", ".join(_tags(data.get(k)))
    vals["visible"] = 0 if data.get("visible") in (False, 0, "0", "false") else 1
    now = datetime.now().isoformat(timespec="seconds")
    cols = list(vals)
    db.execute(f"INSERT INTO profiles (employee_id, {', '.join(cols)}, updated, updated_by) VALUES (?, {', '.join('?' * len(cols))}, ?, ?) "
               f"ON CONFLICT(employee_id) DO UPDATE SET {', '.join(f'{c}=excluded.{c}' for c in cols)}, updated=excluded.updated, updated_by=excluded.updated_by",
               [emp["id"]] + [vals[c] for c in cols] + [now, user["id"]])
    db.commit()
    row = db.execute("SELECT * FROM profiles WHERE employee_id=?", (emp["id"],)).fetchone()
    return jsonify({"employee_id": emp["id"], "profile": _profile_json(row)})


@app.route("/api/profiles/<employee_id>", methods=["DELETE"])
def profile_clear(employee_id):
    """Очистить чужой профиль — админ и HR (ответ пользователя 07.10.2026: «админ и HR»)."""
    db = get_db()
    db.execute("DELETE FROM profiles WHERE employee_id=?", (employee_id,))
    db.commit()
    return jsonify({"cleared": employee_id})


# ---------- employees ----------
@app.route("/api/employees", methods=["GET", "POST"])
def employees_collection():
    db = get_db()
    if request.method == "GET":
        return jsonify(_employees_json(db, current_user()))

    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    position = (data.get("position") or "").strip()
    department = (data.get("department") or "Без отдела").strip() or "Без отдела"
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip()
    telegram = _tg_username(data.get("telegram"))
    birthday = (data.get("birthday") or "").strip()
    photo = _clean_url(data.get("photo"))
    schedule = (data.get("schedule") or "").strip()
    if schedule and not SCHEDULE_RE.fullmatch(schedule):
        return jsonify({"error": "График — в формате 09:00-18:00."}), 400
    fieldwork = (data.get("fieldwork") or "").strip()
    company = (data.get("company") or "").strip()
    is_head = 1 if data.get("is_head") in (1, True, "1", "true") else 0
    if is_head and current_user()["role"] != "admin":   # глава подразделения даёт права кабинета и согласования — ставит только админ (аудит 23.09.2026)
        return jsonify({"error": "Отметить руководителя подразделения может только администратор."}), 403
    unit = (data.get("unit") or "").strip()
    reports_to = (data.get("reports_to") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    item = {
        "id": uuid.uuid4().hex,
        "name": name,
        "position": position,
        "department": department,
        "email": email,
        "phone": phone,
        "telegram": telegram,
        "birthday": birthday,
        "photo": photo,
        "schedule": schedule,
        "fieldwork": fieldwork,
        "company": company,
        "is_head": is_head,
        "unit": unit,
        "reports_to": reports_to,
    }
    db.execute(
        "INSERT INTO employees "
        "(id, name, position, department, email, phone, telegram, birthday, photo, "
        " schedule, fieldwork, company, is_head, unit, reports_to) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (item["id"], item["name"], item["position"], item["department"], item["email"],
         item["phone"], item["telegram"], item["birthday"], item["photo"], item["schedule"], item["fieldwork"],
         item["company"], item["is_head"], item["unit"], item["reports_to"]),
    )
    db.commit()
    return jsonify(item), 201


# Поля, которые можно менять через PUT (частичное обновление).
def _tg_username(v):
    """Имя в Telegram приводим к чистому виду: без @, без https://t.me/ — храним только логин."""
    v = (v or "").strip()
    changed = True
    while changed:                      # «@t.me/ivan» — снимаем слой за слоем
        changed = False
        for prefix in ("https://t.me/", "http://t.me/", "t.me/", "@"):
            if v.lower().startswith(prefix):
                v = v[len(prefix):].strip()
                changed = True
    return v.strip("/ ")


SAFE_URL_RE = re.compile(r"(/static/|/media/|https?://)[^\s\"'<>`\\]*")


def _clean_url(v):
    """Адрес картинки или ссылки: только свои загрузки или обычный http(s), без кавычек и пробелов.
    Иначе пустая строка — чтобы в src/href не попал javascript: или обрыв атрибута (аудит 23.09.2026)."""
    v = (v or "").strip()
    return v if SAFE_URL_RE.fullmatch(v) else ""


SCHEDULE_RE = re.compile(r"\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}")   # график работы — только время; свободный текст не храним (аудит 23.09.2026)

EMPLOYEE_EDITABLE = (
    "name", "position", "department", "email", "phone", "telegram", "birthday", "office", "seat",
    "photo", "schedule", "fieldwork", "company", "is_head", "unit", "reports_to", "elpass_id", "remote", "english", "hired",
)


@app.route("/api/employees/<item_id>", methods=["PUT", "DELETE"])
def employees_item(item_id):
    db = get_db()
    if request.method == "DELETE":
        db.execute("DELETE FROM employees WHERE id = ?", (item_id,))
        db.execute("DELETE FROM profiles WHERE employee_id = ?", (item_id,))   # профиль «О себе» уходит вместе с карточкой
        db.commit()
        return jsonify({"deleted": item_id})

    row = db.execute("SELECT * FROM employees WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(force=True) or {}
    updates = {}
    for field in EMPLOYEE_EDITABLE:
        if field not in data:
            continue
        if field in ("is_head", "remote", "english"):
            updates[field] = 1 if data[field] in (1, True, "1", "true") else 0
            if field == "is_head" and updates[field] != (row["is_head"] or 0) and current_user()["role"] != "admin":
                return jsonify({"error": "Отметить руководителя подразделения может только администратор."}), 403
        elif field == "telegram":
            updates[field] = _tg_username(data[field])
        elif field == "photo":
            updates[field] = _clean_url(data[field])
        else:
            updates[field] = (data[field] or "").strip()
    if updates.get("schedule") and not SCHEDULE_RE.fullmatch(updates["schedule"]):
        return jsonify({"error": "График — в формате 09:00-18:00."}), 400
    if updates.get("hired") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", updates["hired"]):
        return jsonify({"error": "Дата прихода — в формате ГГГГ-ММ-ДД."}), 400
    # учётка находит свою карточку по почте или имени (_my_employee): переписав их у карточки главы, HR стала бы
    # согласующим и руководителем его людей (нашёл Security Engineer 07.10.2026) — у глав это меняет только админ
    if (row["is_head"] or 0) and current_user()["role"] != "admin" and any(
            f in updates and updates[f] != (row[f] or "").strip() for f in ("email", "name")):
        return jsonify({"error": "Почту и имя руководителя подразделения меняет только администратор."}), 403
    if "department" in updates and not updates["department"]:
        updates["department"] = "Без отдела"
    if "name" in updates and not updates["name"]:
        return jsonify({"error": "name is required"}), 400
    if not updates:
        return jsonify(row_to_dict(row))

    assignments = ", ".join(f"{f} = ?" for f in updates)
    db.execute(
        f"UPDATE employees SET {assignments} WHERE id = ?",
        (*updates.values(), item_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM employees WHERE id = ?", (item_id,)).fetchone()
    return jsonify(row_to_dict(row))


# ---------- events (calendar) ----------
@app.route("/api/events", methods=["GET", "POST"])
def events_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM events ORDER BY date ASC").fetchall()
        return jsonify(sorted([row_to_dict(r) for r in rows] + holiday_events(), key=lambda e: e["date"]))

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    date = (data.get("date") or "").strip()
    etype = (data.get("type") or "event").strip()
    description = (data.get("description") or "").strip()
    if not title or not date:
        return jsonify({"error": "title and date are required"}), 400
    if etype not in ("event", "vacation"):            # «праздник» — только из HOLIDAYS_KZ, руками не создать (нашёл проверяющий 07.10.2026)
        return jsonify({"error": "Вид события — событие или отпуск."}), 400

    item = {
        "id": uuid.uuid4().hex,
        "title": title,
        "date": date,
        "type": etype,
        "description": description,
    }
    db.execute(
        "INSERT INTO events (id, title, date, type, description) VALUES (?, ?, ?, ?, ?)",
        (item["id"], item["title"], item["date"], item["type"], item["description"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/events/<item_id>", methods=["DELETE"])
def events_item(item_id):
    if item_id.startswith("holiday-"):
        return jsonify({"error": "Государственный праздник из календаря убрать нельзя."}), 400
    db = get_db()
    db.execute("DELETE FROM events WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- gallery (прошедшие ивенты с фото) ----------
def gallery_event_dict(db, row):
    photos = db.execute(
        "SELECT id, url FROM gallery_photos WHERE event_id = ? ORDER BY created", (row["id"],)
    ).fetchall()
    item = row_to_dict(row)
    item["photos"] = [row_to_dict(p) for p in photos]
    return item


@app.route("/api/gallery", methods=["GET", "POST"])
def gallery_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM gallery ORDER BY date DESC, created DESC").fetchall()
        return jsonify([gallery_event_dict(db, r) for r in rows])

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    event_id = uuid.uuid4().hex
    now = datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO gallery (id, title, date, description, created) VALUES (?, ?, ?, ?, ?)",
        (event_id, title, (data.get("date") or "").strip(),
         (data.get("description") or "").strip(), now),
    )
    for url in data.get("photos") or []:
        url = _clean_url(url)
        if url:
            db.execute(
                "INSERT INTO gallery_photos (id, event_id, url, created) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, event_id, url, datetime.utcnow().isoformat()),
            )
    db.commit()
    row = db.execute("SELECT * FROM gallery WHERE id = ?", (event_id,)).fetchone()
    return jsonify(gallery_event_dict(db, row)), 201


def _gallery_next_stamp(db, event_id):
    """Метка «created» для нового фото — позже всех фото ивента, чтобы добавленные вставали в конец
    (у фото из скриптов время местное, у загруженных через портал — UTC; сравнивать с часами нельзя)."""
    last = db.execute("SELECT max(created) FROM gallery_photos WHERE event_id = ?", (event_id,)).fetchone()[0] or ""
    return max(last, datetime.utcnow().isoformat())


def _stamp_after(stamp, k):
    """stamp + k микросекунд, в том же формате ISO."""
    try:
        return (datetime.fromisoformat(stamp) + timedelta(microseconds=k)).isoformat(timespec="microseconds")
    except ValueError:
        return datetime.utcnow().isoformat(timespec="microseconds")


@app.route("/api/gallery/<item_id>", methods=["PUT", "DELETE"])
def gallery_item(item_id):
    db = get_db()
    if request.method == "PUT":   # правка названия, даты и описания — HR и админ (25.09.2026)
        row = db.execute("SELECT * FROM gallery WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            return jsonify({"error": "not found"}), 404
        data = request.get_json(silent=True) or {}
        title = str(data.get("title", row["title"]) or "").strip()
        if not title:
            return jsonify({"error": "Укажите название."}), 400
        date_ = str(data.get("date", row["date"]) or "").strip()
        if date_ and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_):
            return jsonify({"error": "Дата в формате ГГГГ-ММ-ДД."}), 400
        db.execute("UPDATE gallery SET title = ?, date = ?, description = ? WHERE id = ?",
                   (title[:300], date_, str(data.get("description", row["description"]) or "").strip()[:4000], item_id))
        db.commit()
        return jsonify(gallery_event_dict(db, db.execute("SELECT * FROM gallery WHERE id = ?", (item_id,)).fetchone()))
    db.execute("DELETE FROM gallery_photos WHERE event_id = ?", (item_id,))
    db.execute("DELETE FROM gallery WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


@app.route("/api/gallery/<item_id>/photos", methods=["POST"])
def gallery_add_photos(item_id):
    db = get_db()
    row = db.execute("SELECT * FROM gallery WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    data = request.get_json(force=True) or {}
    stamp = _gallery_next_stamp(db, item_id)
    for k, url in enumerate(data.get("photos") or []):
        url = _clean_url(url)
        if url:
            db.execute(
                "INSERT INTO gallery_photos (id, event_id, url, created) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, item_id, url, _stamp_after(stamp, k + 1)),
            )
    db.commit()
    return jsonify(gallery_event_dict(db, row))


@app.route("/api/gallery/<item_id>/cover", methods=["POST"])
def gallery_cover(item_id):
    """{photo_id} — поставить фото первым в ивенте (обложка). HR и админ (25.09.2026)."""
    db = get_db()
    row = db.execute("SELECT * FROM gallery WHERE id = ?", (item_id,)).fetchone()
    photo_id = (request.get_json(silent=True) or {}).get("photo_id")
    if row is None or db.execute("SELECT 1 FROM gallery_photos WHERE id = ? AND event_id = ?", (photo_id, item_id)).fetchone() is None:
        return jsonify({"error": "not found"}), 404
    first = db.execute("SELECT min(created) FROM gallery_photos WHERE event_id = ?", (item_id,)).fetchone()[0] or ""
    db.execute("UPDATE gallery_photos SET created = ? WHERE id = ?", (_stamp_after(first, -1), photo_id))
    db.commit()
    return jsonify(gallery_event_dict(db, row))


@app.route("/api/gallery/photos/<photo_id>", methods=["DELETE"])
def gallery_photo(photo_id):
    db = get_db()
    db.execute("DELETE FROM gallery_photos WHERE id = ?", (photo_id,))
    db.commit()
    return jsonify({"deleted": photo_id})


# ---------- partners (наши партнёры) ----------
PARTNER_EDITABLE = ("name", "category", "description", "website", "logo", "sort")


@app.route("/api/partners", methods=["GET", "POST"])
def partners_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM partners ORDER BY sort, created").fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    item = {
        "id": uuid.uuid4().hex, "name": name,
        "category": (data.get("category") or "").strip(),
        "description": (data.get("description") or "").strip(),
        "website": _clean_url(data.get("website")),
        "logo": _clean_url(data.get("logo")),
        "sort": int(data.get("sort") or 0),
        "created": datetime.utcnow().isoformat(),
    }
    db.execute(
        "INSERT INTO partners (id, name, category, description, website, logo, sort, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (item["id"], item["name"], item["category"], item["description"], item["website"],
         item["logo"], item["sort"], item["created"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/partners/<item_id>", methods=["PUT", "DELETE"])
def partners_item(item_id):
    db = get_db()
    if request.method == "DELETE":
        db.execute("DELETE FROM partners WHERE id = ?", (item_id,))
        db.commit()
        return jsonify({"deleted": item_id})
    row = db.execute("SELECT * FROM partners WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    data = request.get_json(force=True) or {}
    updates = {}
    for f in PARTNER_EDITABLE:
        if f in data:
            updates[f] = int(data[f] or 0) if f == "sort" else _clean_url(data[f]) if f in ("logo", "website") else (data[f] or "").strip()
    if updates:
        assignments = ", ".join(f"{f} = ?" for f in updates)
        db.execute(f"UPDATE partners SET {assignments} WHERE id = ?", (*updates.values(), item_id))
        db.commit()
        row = db.execute("SELECT * FROM partners WHERE id = ?", (item_id,)).fetchone()
    return jsonify(row_to_dict(row))


# ---------- honors (доска почёта) ----------
@app.route("/api/honors", methods=["GET", "POST"])
def honors_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM honors ORDER BY created DESC").fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    item = {
        "id": uuid.uuid4().hex, "name": name,
        "reason": (data.get("reason") or "").strip(),
        "period": (data.get("period") or "").strip(),
        "created": datetime.utcnow().isoformat(),
    }
    db.execute("INSERT INTO honors (id, name, reason, period, created) VALUES (?, ?, ?, ?, ?)",
               (item["id"], item["name"], item["reason"], item["period"], item["created"]))
    db.commit()
    return jsonify(item), 201


@app.route("/api/honors/<item_id>", methods=["DELETE"])
def honors_item(item_id):
    db = get_db()
    db.execute("DELETE FROM honors WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- вакансии (раздел вернули по просьбе пользователя 24.09.2026) ----------
VACANCY_FIELDS = ("title", "department", "office", "format", "description", "requirements")


@app.route("/api/vacancies", methods=["GET", "POST"])
def vacancies_collection():
    db = get_db()
    if request.method == "GET":
        staff = current_user()["role"] in ("admin", "hr")
        rows = db.execute("SELECT * FROM vacancies " + ("" if staff else "WHERE status='open' ") + "ORDER BY status DESC, created DESC").fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    data = request.get_json(force=True) or {}
    item = {f: (data.get(f) or "").strip()[:4000] for f in VACANCY_FIELDS}
    if not item["title"]:
        return jsonify({"error": "Укажите должность."}), 400
    item.update(id=uuid.uuid4().hex, status="open", created=datetime.now().isoformat(timespec="seconds"), updated=None)
    cols = ", ".join(item)
    db.execute(f"INSERT INTO vacancies ({cols}) VALUES ({', '.join('?' * len(item))})", tuple(item.values()))
    db.commit()
    return jsonify(item), 201


@app.route("/api/vacancies/<item_id>", methods=["PUT", "DELETE"])
def vacancies_item(item_id):
    db = get_db()
    if request.method == "DELETE":
        db.execute("DELETE FROM vacancies WHERE id = ?", (item_id,))
        db.commit()
        return jsonify({"deleted": item_id})
    row = db.execute("SELECT * FROM vacancies WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    data = request.get_json(force=True) or {}
    upd = {f: (data[f] or "").strip()[:4000] for f in VACANCY_FIELDS if f in data}
    if "status" in data:
        upd["status"] = "closed" if data["status"] == "closed" else "open"
    if "title" in upd and not upd["title"]:
        return jsonify({"error": "Укажите должность."}), 400
    upd["updated"] = datetime.now().isoformat(timespec="seconds")
    db.execute(f"UPDATE vacancies SET {', '.join(f'{k} = ?' for k in upd)} WHERE id = ?", (*upd.values(), item_id))
    db.commit()
    return jsonify(row_to_dict(db.execute("SELECT * FROM vacancies WHERE id = ?", (item_id,)).fetchone()))


# ---------- projects ----------
PROJECT_STATUSES = ("planned", "active", "done")
PROJECT_EDITABLE = ("title", "client", "status", "manager", "deadline", "description")


@app.route("/api/projects", methods=["GET", "POST"])
def projects_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM projects ORDER BY created DESC").fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    status = (data.get("status") or "active").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    if status not in PROJECT_STATUSES:
        status = "active"

    item = {
        "id": uuid.uuid4().hex,
        "title": title,
        "client": (data.get("client") or "").strip(),
        "status": status,
        "manager": (data.get("manager") or "").strip(),
        "deadline": (data.get("deadline") or "").strip(),
        "description": (data.get("description") or "").strip(),
        "created": datetime.utcnow().isoformat(),
    }
    db.execute(
        "INSERT INTO projects (id, title, client, status, manager, deadline, description, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (item["id"], item["title"], item["client"], item["status"], item["manager"],
         item["deadline"], item["description"], item["created"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/projects/<item_id>", methods=["PUT", "DELETE"])
def projects_item(item_id):
    db = get_db()
    if request.method == "DELETE":
        db.execute("DELETE FROM projects WHERE id = ?", (item_id,))
        db.commit()
        return jsonify({"deleted": item_id})

    row = db.execute("SELECT * FROM projects WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(force=True) or {}
    updates = {f: (data[f] or "").strip() for f in PROJECT_EDITABLE if f in data}
    if "title" in updates and not updates["title"]:
        return jsonify({"error": "title is required"}), 400
    if "status" in updates and updates["status"] not in PROJECT_STATUSES:
        return jsonify({"error": "bad status"}), 400
    if updates:
        assignments = ", ".join(f"{f} = ?" for f in updates)
        db.execute(f"UPDATE projects SET {assignments} WHERE id = ?", (*updates.values(), item_id))
        db.commit()
        row = db.execute("SELECT * FROM projects WHERE id = ?", (item_id,)).fetchone()
    return jsonify(row_to_dict(row))


# ---------- faq ----------
@app.route("/api/faq", methods=["GET", "POST"])
def faq_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM faq ORDER BY rowid ASC").fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    question = (data.get("question") or "").strip()
    answer = (data.get("answer") or "").strip()
    if not question or not answer:
        return jsonify({"error": "question and answer are required"}), 400

    item = {"id": uuid.uuid4().hex, "question": question, "answer": answer}
    db.execute(
        "INSERT INTO faq (id, question, answer) VALUES (?, ?, ?)",
        (item["id"], item["question"], item["answer"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/faq/<item_id>", methods=["DELETE"])
def faq_item(item_id):
    db = get_db()
    db.execute("DELETE FROM faq WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- suggestions ----------
@app.route("/api/suggestions", methods=["GET", "POST"])
def suggestions_collection():
    db = get_db()
    user = current_user()
    if request.method == "GET":
        # HR и админ читают все обращения; сотрудник — только свои неанонимные
        if user["role"] in ("admin", "hr"):
            rows = db.execute("SELECT * FROM suggestions ORDER BY date DESC").fetchall()
        else:
            rows = db.execute("SELECT * FROM suggestions WHERE user_id=? ORDER BY date DESC", (user["id"],)).fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()[:4000]
    if not text:
        return jsonify({"error": "Напишите текст обращения."}), 400
    anonymous = bool(data.get("anonymous"))
    item = {
        "id": uuid.uuid4().hex,
        "text": text,
        "author": "" if anonymous else (user["name"] or user["login"]),
        "date": datetime.utcnow().isoformat(),
        "user_id": None if anonymous else user["id"],
        "status": "new",
    }
    db.execute(
        "INSERT INTO suggestions (id, text, author, date, user_id, status) VALUES (?, ?, ?, ?, ?, 'new')",
        (item["id"], item["text"], item["author"], item["date"], item["user_id"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/suggestions/<item_id>", methods=["PUT", "DELETE"])
def suggestions_item(item_id):
    """Отметить прочитанным / удалить — HR и админ (обычного сотрудника не пустит require_auth)."""
    db = get_db()
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        status = "seen" if data.get("status") == "seen" else "new"
        db.execute("UPDATE suggestions SET status=? WHERE id=?", (status, item_id))
        db.commit()
        row = db.execute("SELECT * FROM suggestions WHERE id=?", (item_id,)).fetchone()
        return jsonify(row_to_dict(row)) if row else (jsonify({"error": "not found"}), 404)
    db.execute("DELETE FROM suggestions WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- HR-панель (только HR и админ — проверка префикса /api/hr/ в require_auth) ----------
# ---------- админ-панель (только админ — проверка префикса /api/admin/ в require_auth) ----------
def _app_version():
    """Версия кода: на сервере её пишет скрипт выкладки в файл VERSION, локально спрашиваем у git."""
    f = BASE_DIR / "VERSION"
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    try:
        import subprocess
        return subprocess.check_output(["git", "log", "-1", "--format=%h %cI %s"], cwd=BASE_DIR,
                                       text=True, encoding="utf-8", timeout=5).strip()
    except Exception:
        return ""


def _backup_files():
    if not BACKUP_DIR.exists():
        return []
    files = sorted(BACKUP_DIR.glob("portal-*.db"), key=lambda x: x.stat().st_mtime, reverse=True)
    return [{"name": x.name, "size": x.stat().st_size,
             "time": datetime.utcfromtimestamp(x.stat().st_mtime).isoformat(timespec="seconds")} for x in files]


@app.route("/api/admin/status", methods=["GET"])
def admin_status():
    db = get_db()
    counts = {}
    for t in SCHEMA:
        if t in ("settings", "audit"):
            continue
        counts[t] = db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    uploads = [x for x in UPLOAD_DIR.glob("*") if x.is_file() and x.name != ".gitkeep"]
    disk = shutil.disk_usage(str(DB_PATH.parent))
    try:
        from importlib.metadata import version as _v
        flask_v = _v("flask")
    except Exception:
        flask_v = ""
    log_tail = []
    logf = BACKUP_DIR / "auto-update.log"
    if logf.exists():
        log_tail = logf.read_text(encoding="utf-8", errors="replace").strip().splitlines()[-12:]
    ver = _app_version().split(" ", 2)
    return jsonify({
        "version": {"hash": ver[0] if ver else "", "time": ver[1] if len(ver) > 1 else "", "message": ver[2] if len(ver) > 2 else ""},
        "uptime_sec": int(time.time() - APP_STARTED),
        "server_time_utc": datetime.utcnow().isoformat(timespec="seconds"),
        "db": {"size": DB_PATH.stat().st_size, "counts": counts},
        "uploads": {"count": len(uploads), "size": sum(x.stat().st_size for x in uploads)},
        "disk": {"total": disk.total, "free": disk.free},
        "backups": _backup_files()[:1],
        "backup_dir_ok": BACKUP_DIR.exists(),
        "elpass": {"configured": elpass_configured(), "objects": elpass_objects(), "last": _setting("elpass_last_sync")},
        "mail": {"configured": smtp_configured(), "from": os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or ""},
        "ai": {"key": bool(get_api_key()), "models": AI_MODELS, "per_hour": ASK_PER_HOUR},
        "register_mode": register_mode(),
        "https_cookies": app.config["SESSION_COOKIE_SECURE"],
        "python": sys.version.split()[0], "flask": flask_v,
        "deploy_log": log_tail,
        "users": {"total": db.execute("SELECT COUNT(*) FROM users").fetchone()[0],
                  "active": db.execute("SELECT COUNT(*) FROM users WHERE last_login IS NOT NULL AND last_login<>''").fetchone()[0],
                  "pending": db.execute("SELECT COUNT(*) FROM users WHERE must_set_password=1").fetchone()[0]},
    })


@app.route("/api/admin/audit", methods=["GET"])
def admin_audit():
    rows = get_db().execute("SELECT ts, user, ip, method, path, status, source FROM audit ORDER BY ts DESC LIMIT 300").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/admin/backups", methods=["GET", "POST"])
def admin_backups():
    if request.method == "POST":
        try:
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            name = f"portal-{datetime.utcnow():%Y-%m-%d_%H%M%S}-manual.db"
            src = sqlite3.connect(DB_PATH)
            dst = sqlite3.connect(BACKUP_DIR / name)
            with dst:
                src.backup(dst)      # штатное копирование SQLite: безопасно при работающем портале
            dst.close()
            src.close()
            os.chmod(BACKUP_DIR / name, 0o600)   # в копии все данные портала — читает только владелец (аудит 23.09.2026)
        except Exception as e:
            return jsonify({"error": f"Не удалось сделать копию: {e}"}), 500
    return jsonify(_backup_files())


@app.route("/api/admin/backups/<name>", methods=["GET", "DELETE"])
def admin_backup_file(name):
    if not re.fullmatch(r"portal-[A-Za-z0-9_.-]+\.db", name) or not (BACKUP_DIR / name).is_file():
        return jsonify({"error": "Копия не найдена."}), 404
    if request.method == "DELETE":
        (BACKUP_DIR / name).unlink()
        return jsonify(_backup_files())
    return send_from_directory(BACKUP_DIR, name, as_attachment=True)


@app.route("/api/admin/test-mail", methods=["POST"])
def admin_test_mail():
    to = ((request.get_json(silent=True) or {}).get("to") or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}", to):
        return jsonify({"error": "Укажите адрес, куда отправить проверочное письмо."}), 400
    if not smtp_configured():
        return jsonify({"error": "Почта не настроена: на сервере нет файла /opt/staff-data/smtp.env."}), 400
    try:
        send_mail(to, "Проверка почты — Connected Community",
                  "Это проверочное письмо с портала Connected Community. Если вы его читаете — отправка работает.")
    except Exception as e:
        return jsonify({"error": f"Письмо не ушло: {e}"}), 502
    return jsonify({"ok": True})


# ---------- вкладка «Сервисы»: состояние всего, что подключено к порталу и работает в фоне (01.10.2026) ----------
# Состояния: ok — работает, warn — работает с оговоркой, bad — сбой, off — не настроено (обычно это localhost).
def _svc_when(utc_iso):
    """«5 мин назад · 01.10 14:07» по Астане из отметки в UTC."""
    if not utc_iso:
        return "ещё ни разу"
    try:
        dt = datetime.fromisoformat(utc_iso)
    except ValueError:
        return utc_iso
    sec = max(0, int((datetime.utcnow() - dt).total_seconds()))
    ago = "только что" if sec < 90 else f"{sec // 60} мин назад" if sec < 5400 else f"{sec // 3600} ч назад" if sec < 172800 else f"{sec // 86400} дн. назад"
    return f"{ago} · {(dt + timedelta(hours=5)).strftime('%d.%m %H:%M')}"


def _svc_age(utc_iso):
    try:
        return (datetime.utcnow() - datetime.fromisoformat(utc_iso)).total_seconds()
    except (TypeError, ValueError):
        return None


def _svc_seed(m, last):
    """Пока отметок ещё нет (первые минуты после выкладки) — берём время из журнала последней сверки (оно в местном времени сервера)."""
    if not m.get("ok_at") and last.get("at") and not last.get("errors"):
        try:
            m["ok_at"] = (datetime.utcnow() - (datetime.now() - datetime.fromisoformat(last["at"]))).isoformat(timespec="seconds")
        except ValueError:
            pass
    return m


def _svc_failed(m):
    """Последняя отметка — сбой (сбой новее удачи)."""
    return bool(m.get("err_at")) and m.get("err_at", "") > m.get("ok_at", "")


_cert_cache = {"at": 0, "days": None, "until": "", "error": ""}


def _cert_info(force=False):
    """Сколько дней до конца сертификата сайта. Спрашиваем сам сайт; ответ помним 6 часов."""
    if not force and time.time() - _cert_cache["at"] < 6 * 3600:
        return _cert_cache
    import ssl
    host = PORTAL_URL.split("://", 1)[-1].split("/")[0]
    _cert_cache.update(at=time.time(), days=None, until="", error="")
    try:
        with socket.create_connection((host, 443), timeout=8) as sock:
            with ssl.create_default_context().wrap_socket(sock, server_hostname=host) as tls:
                end = datetime.strptime(tls.getpeercert()["notAfter"], "%b %d %H:%M:%S %Y %Z")
        _cert_cache.update(days=(end - datetime.utcnow()).days, until=end.strftime("%d.%m.%Y"))
    except Exception as e:  # noqa: BLE001
        _cert_cache["error"] = str(e)[:150]
    return _cert_cache


def _services_state(db):
    out = []

    def add(key, title, state, status, rows, check=False):
        out.append({"key": key, "title": title, "state": state, "status": status,
                    "rows": [[k, str(v)] for k, v in rows if v not in (None, "")], "check": check})

    # фоновые задачи — от них зависят турникеты, таблица, письмо и переводы
    beat = time.time() - _sched_beat if _sched_beat else None
    alive = beat is not None and beat < 180
    add("scheduler", "Фоновые задачи портала", "ok" if alive else "bad", "работают" if alive else "остановились",
        [("Последний запуск", "только что" if alive else ("ни разу с перезапуска" if beat is None else f"{int(beat // 60)} мин назад")),
         ("Портал без перезапуска", f"{int((time.time() - APP_STARTED) // 3600)} ч {int((time.time() - APP_STARTED) % 3600 // 60)} мин")])

    # турникеты elpass
    m = _svc_get("elpass")
    try:
        last = json.loads(_setting("elpass_last_sync") or "null") or {}
    except ValueError:
        last = {}
    if not elpass_configured():
        add("elpass", "Турникеты elpass", "off", "не подключены", [("Причина", "нет доступа в файле elpass.env")])
    else:
        m = _svc_seed(m, {"at": last.get("at")})
        age, errs = _svc_age(m.get("ok_at")), last.get("errors") or []
        state = "bad" if (age is None or age > 20 * 60) else "warn" if errs else "ok"
        rows = [("Последнее обновление", _svc_when(m.get("ok_at"))), ("Как часто", f"каждые {ELPASS_SYNC_MINUTES} минут")]
        for o in last.get("objects") or []:
            rows.append((ELPASS_LABELS.get(o.get("object"), o.get("object") or "объект"),
                         f"карточек {o.get('cards', 0)}, новых проходов {o.get('added', 0)}"))
        for e in errs:
            rows.append((e.get("label") or e.get("object"), "ошибка: " + (e.get("error") or "")))
        if state == "bad" and m.get("err"):
            rows.append(("Последняя ошибка", f"{m['err']} ({_svc_when(m.get('err_at'))})"))
        rows.append(("Проходов сегодня", db.execute("SELECT COUNT(*) FROM passes WHERE ts LIKE ?", (_astana_today() + "%",)).fetchone()[0]))
        add("elpass", "Турникеты elpass", state, {"ok": "работают", "warn": "часть объектов не отвечает", "bad": "не обновляются"}[state], rows, check=True)

    # Google-таблица HR
    m = _svc_get("sheet")
    try:
        last = json.loads(_setting("sheet_last_sync") or "null") or {}
    except ValueError:
        last = {}
    m = _svc_seed(m, last)
    age = _svc_age(m.get("ok_at"))
    state = "bad" if _svc_failed(m) or age is None or age > 45 * 60 else "ok"
    rows = [("Последнее чтение", _svc_when(m.get("ok_at"))), ("Как часто", f"каждые {ATT_SHEET_SYNC_MINUTES} минут")]
    for mm in last.get("months") or []:
        rows.append((f"Вкладка за {mm['month'][5:]}.{mm['month'][:4]}", f"сотрудников {mm['matched']}" + (f", не распознано {len(mm['unmatched'])}" if mm.get("unmatched") else "")
                     + (f", непонятных отметок {sum(mm['unknown'].values())}" if mm.get("unknown") else "")))
    if state == "bad" and m.get("err"):
        rows.append(("Последняя ошибка", f"{m['err']} ({_svc_when(m.get('err_at'))})"))
    add("sheet", "Google-таблица табеля", state, "читается" if state == "ok" else "не читается", rows, check=True)

    # почта
    m = _svc_get("mail")
    if not smtp_configured():
        add("mail", "Почта портала", "off", "не настроена", [("Причина", "нет файла smtp.env — письма не уходят")])
    else:
        state = "bad" if _svc_failed(m) else "ok"
        rows = [("Ящик", os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or ""),
                ("Последнее письмо ушло", _svc_when(m.get("ok_at"))), ("Тема", m.get("ok_info"))]
        if m.get("err_at"):
            rows.append(("Последняя ошибка", f"{m.get('err')} ({_svc_when(m['err_at'])})"))
        add("mail", "Почта портала", state, "работает" if state == "ok" else "письма не уходят", rows, check=True)

    # письмо об опозданиях
    now = _astana_now()
    this_monday = now.date() - timedelta(days=now.weekday())
    due = this_monday - timedelta(days=7) if (now.weekday(), now.hour) >= (0, 10) else this_monday - timedelta(days=14)
    sent = _setting("late_report_sent") or ""
    to = [r["email"] for r in db.execute("SELECT email FROM users WHERE role IN ('hr','admin') AND email<>''")]
    nxt = this_monday + timedelta(days=7) if (now.weekday(), now.hour) >= (0, 9) else this_monday
    state = "off" if not smtp_configured() else "ok" if sent >= due.isoformat() else "bad"
    week = lambda s: f"{date.fromisoformat(s).strftime('%d.%m')}–{(date.fromisoformat(s) + timedelta(days=4)).strftime('%d.%m')}"  # noqa: E731
    add("late", "Письмо об опозданиях", state,
        {"ok": "отправлено", "bad": "за прошлую неделю не ушло", "off": "почта не настроена"}[state],
        [("Последнее — за неделю", week(sent) if sent else "ещё не отправлялось"),
         ("Следующее", f"{nxt.strftime('%d.%m')} в 09:00"), ("Получателей", len(to))])

    # Connect AI
    m = _svc_get("ai")
    if not get_api_key():
        add("ai", "Connect AI", "bad", "нет ключа", [("Причина", "файл api_key.txt пуст — бот и перевод не работают")], check=False)
    else:
        state = "warn" if _svc_failed(m) else "ok"
        rows = [("Последний ответ", _svc_when(m.get("ok_at"))), ("Ответила модель", m.get("ok_info")),
                ("Вопросов боту сегодня", db.execute("SELECT COUNT(*) FROM audit WHERE path='/api/ask' AND status=200 AND ts LIKE ?",
                                                    (datetime.utcnow().date().isoformat() + "%",)).fetchone()[0])]
        if m.get("err_at"):
            rows.append(("Последняя ошибка", f"{m.get('err')} ({_svc_when(m['err_at'])})"))
        add("ai", "Connect AI", state, "отвечает" if state == "ok" else "последний запрос не прошёл", rows, check=True)

    # перевод портала
    m = _svc_get("translate")
    age = _svc_age(m.get("ok_at"))
    state = "warn" if _svc_failed(m) or (age is not None and age > 2.5 * 3600) else "ok"
    langs = db.execute("SELECT lang, COUNT(*) n FROM translations GROUP BY lang ORDER BY lang").fetchall()
    add("translate", "Перевод портала", state, "переводит" if state == "ok" else "давно не запускался",
        [("Последний запуск", _svc_when(m.get("ok_at"))), ("Как часто", "раз в час"),
         ("Готовых переводов", ", ".join(f"{r['lang'].upper()} — {r['n']}" for r in langs) or "пока нет"),
         ("Последняя ошибка", f"{m.get('err')} ({_svc_when(m.get('err_at'))})" if m.get("err_at") else "")])

    # резервные копии
    files = _backup_files()
    if not BACKUP_DIR.exists():
        add("backup", "Резервные копии базы", "off", "недоступны", [("Причина", "папки копий нет (на localhost её не бывает)")])
    else:
        age = _svc_age(files[0]["time"]) if files else None
        state = "ok" if age is not None and age < 8 * 86400 else "bad"
        add("backup", "Резервные копии базы", state, "делаются" if state == "ok" else "копия устарела",
            [("Последняя копия", _svc_when(files[0]["time"]) if files else "копий нет"), ("Как часто", "раз в неделю, в ночь на воскресенье"),
             ("Всего копий", len(files))])

    # автообновление портала
    logf = BACKUP_DIR / "auto-update.log"
    if not logf.exists():
        add("deploy", "Автообновление портала", "off", "недоступно", [("Причина", "журнал ведётся только на сервере")])
    else:
        tail = logf.read_text(encoding="utf-8", errors="replace").strip().splitlines()[-3:]
        lastline = tail[-1] if tail else ""
        state = "bad" if any("НЕ ПОДНЯЛСЯ" in x or "после отката" in x for x in tail) else "warn" if "обновляюсь" in lastline else "ok"
        ver = _app_version().split(" ", 2)
        add("deploy", "Автообновление портала", state,
            {"ok": "работает", "warn": "идёт обновление", "bad": "последнее обновление откатилось"}[state],
            [("Версия на сайте", ver[0] if ver else ""), ("Последняя запись", lastline[:160]), ("Как часто", "проверка каждые 5 минут")])

    # сертификат
    c = _cert_info()
    state = "warn" if c["days"] is None else "bad" if c["days"] < 7 else "warn" if c["days"] < 21 else "ok"
    add("cert", "Сертификат сайта (HTTPS)", state,
        "не удалось проверить" if c["days"] is None else f"действует ещё {c['days']} дн.",
        [("Действует до", c["until"]), ("Продление", "автоматическое"), ("Ошибка проверки", c["error"])], check=True)

    # отчёты админу в Telegram
    cfg, m = _tg_cfg(), _svc_get("tg")
    if not (cfg.get("token") and cfg.get("chat_id")):
        add("tg", "Отчёты в Telegram", "off", "не подключены", [("Бот", "@" + cfg["bot"] if cfg.get("bot") else "")])
    else:
        state = "bad" if _svc_failed(m) else "ok"
        add("tg", "Отчёты в Telegram", state, "приходят" if state == "ok" else "не доходят",
            [("Бот", "@" + (cfg.get("bot") or "")), ("Кому", cfg.get("chat")), ("Ежедневный отчёт", f"в {TG_REPORT_HOUR:02d}:00"),
             ("Последнее сообщение", _svc_when(m.get("ok_at"))),
             ("Последняя ошибка", f"{m.get('err')} ({_svc_when(m.get('err_at'))})" if m.get("err_at") else "")])

    # бот для сотрудников: личные напоминания
    sb, m = _staffbot(), _svc_get("staffbot")
    if not sb.get("token"):
        add("staffbot", "Бот для сотрудников", "off", "не подключён", [])
    else:
        state = "bad" if _svc_failed(m) else "ok"
        add("staffbot", "Бот для сотрудников", state, "работает" if state == "ok" else "сообщения не доходят",
            [("Бот", "@" + (sb.get("bot") or "")), ("Режим", "открыт для всех сотрудников" if sb.get("open") else "проба — только админ"),
             ("Подключили Telegram", len(sb["links"])), ("Напоминание об опоздании", ", ".join(TG_LATE_SLOTS)),
             ("Последнее сообщение", _svc_when(m.get("ok_at"))),
             ("Последняя ошибка", f"{m.get('err')} ({_svc_when(m.get('err_at'))})" if m.get("err_at") else "")])

    # бот для HR: понедельничный отчёт об опозданиях и дни рождения
    hb, m = _hrbot(), _svc_get("hrbot")
    if not hb.get("token"):
        add("hrbot", "Бот для HR", "off", "не подключён", [])
    else:
        state = "bad" if _svc_failed(m) else ("warn" if not hb["links"] else "ok")
        add("hrbot", "Бот для HR", state, {"ok": "работает", "warn": "никто не подключил Telegram", "bad": "сообщения не доходят"}[state],
            [("Бот", "@" + (hb.get("bot") or "")), ("Подключили Telegram", len(hb["links"])),
             ("Отчёт об опозданиях", "понедельник, 09:00 — вместо письма" if hrbot_ready() else "понедельник, 09:00 — письмом, пока HR не подключит Telegram"), ("Дни рождения", f"в сам день, {HRBOT_BDAY_HOUR:02d}:00"), ("Праздники", f"за {HRBOT_HOLIDAY_DAYS} дня, {HRBOT_BDAY_HOUR:02d}:00"),
             ("Последнее сообщение", _svc_when(m.get("ok_at"))),
             ("Последняя ошибка", f"{m.get('err')} ({_svc_when(m.get('err_at'))})" if m.get("err_at") else "")])
    # Connected WorkFlow: приёмщик (тот же ключ AI), очередь заданий, исполнитель — этап 2
    m = _svc_get("cowork")
    q = {r[0]: r[1] for r in db.execute("SELECT status, COUNT(*) FROM cowork_tasks GROUP BY status")}
    cw_state = "off" if not get_api_key() else ("bad" if _svc_failed(m) else "ok")
    add("cowork", "Connected WorkFlow", cw_state, {"off": "нет ключа AI", "bad": "приёмщик не отвечает", "ok": "работает"}[cw_state],
        [("В очереди", q.get("queued", 0)), ("Ждут приёмки", q.get("review", 0)), ("Принято", q.get("accepted", 0)),
         ("Исполнитель", "не подключён — этап 2 (GitHub)"), ("Замечаний", db.execute("SELECT COUNT(*) FROM cowork_notes").fetchone()[0]),
         ("Последнее сообщение", _svc_when(m.get("ok_at"))),
         ("Последняя ошибка", f"{m.get('err')} ({_svc_when(m.get('err_at'))})" if m.get("err_at") else "")])
    return out


# ---------- «хвосты»: всё временное, тестовое, не утверждённое и отложенное (05.10.2026) ----------
# Список ведёт Claude в файле tails.json в корне репозитория (приезжает на сервер вместе с кодом). Портал только показывает его
# в админ-панели и по понедельникам добавляет в утренний отчёт в Telegram — чтобы недоделанное не забывалось.
# Вопросы, ждущие решения пользователя (вид decision), приходят в отчёте каждый день — decisions_text (06.10.2026).
TAIL_KINDS = [("test", "Тестовое — заменить или удалить"), ("text", "Ждёт вашего текста"), ("decision", "Ждёт вашего решения"),
              ("todo", "Нужно сделать"), ("data", "Не хватает данных")]


def _tails():
    try:
        raw = json.loads((BASE_DIR / "tails.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(raw, list):                      # в файле не список — считаем, что хвостов нет, а не роняем вкладку и отчёт
        return []
    known = {k for k, _ in TAIL_KINDS}
    return [{"text": str(t.get("text") or "").strip(), "kind": t.get("kind") if t.get("kind") in known else "todo",
             "since": str(t.get("since") or "")} for t in raw if isinstance(t, dict) and str(t.get("text") or "").strip()]


def tails_text(limit=3300):
    """Хвосты для Telegram: по группам, коротко. Пусто — пустая строка."""
    tails = _tails()
    if not tails:
        return ""
    lines = [f"<b>Не доделано: {len(tails)}</b>"]
    for kind, label in TAIL_KINDS:
        group = [t for t in tails if t["kind"] == kind]
        if group:
            lines.append(f"\n<i>{_tg_esc(label)}</i>")
            lines += [f"• {_tg_esc(t['text'])}" for t in group]
    out = "\n".join(lines)
    return out if len(out) <= limit else out[:limit].rsplit("\n", 1)[0] + "\n… полный список — в админ-панели"


TG_DECISIONS_SHOWN = 5   # сколько вопросов показывать в ежедневном отчёте; остальные — в админ-панели


def decisions_text(limit=1200):
    """Вопросы, которые ждут решения пользователя, — каждый день в утреннем отчёте (06.10.2026, его выбор:
    «в чат после работы + Telegram утром»). Свежие сверху. Пусто — пустая строка."""
    waiting = sorted((t for t in _tails() if t["kind"] == "decision"), key=lambda t: t["since"], reverse=True)
    if not waiting:
        return ""
    lines = [f"<b>Ждёт вашего решения: {len(waiting)}</b>"]
    one = max(80, (limit - 120) // min(len(waiting), TG_DECISIONS_SHOWN))   # длинный вопрос укорачиваем, а не теряем целиком
    lines += [f"• {_tg_esc(t['text'] if len(t['text']) <= one else t['text'][:one - 1].rstrip() + '…')}" for t in waiting[:TG_DECISIONS_SHOWN]]
    if len(waiting) > TG_DECISIONS_SHOWN:
        lines.append(f"… и ещё {len(waiting) - TG_DECISIONS_SHOWN} — в админ-панели")
    out = "\n".join(lines)
    return out if len(out) <= limit else out[:limit].rsplit("\n", 1)[0] + "\n… полный список — в админ-панели"


@app.route("/api/admin/services", methods=["GET"])
def admin_services():
    items = _services_state(get_db())
    return jsonify({"items": items, "problems": sum(1 for x in items if x["state"] in ("bad", "warn")),
                    "checked": _astana_now().strftime("%d.%m %H:%M"),
                    "tails": _tails(), "tail_kinds": TAIL_KINDS})


@app.route("/api/admin/services/<key>/check", methods=["POST"])
def admin_service_check(key):
    """«Проверить сейчас»: настоящий запрос к сервису, а не чтение старых отметок."""
    db = get_db()
    try:
        if key == "elpass":
            r = elpass_sync(db)
            if r.get("error") or r.get("errors"):
                return jsonify({"ok": False, "message": r.get("error") or "; ".join(f"{e['label']}: {e['error']}" for e in r["errors"])})
            msg = f"elpass отвечает: карточек {r['cards']}, новых проходов {r['added']}"
        elif key == "sheet":
            r = sheet_sync(db)
            if r["errors"] or r["no_tab"]:
                return jsonify({"ok": False, "message": "; ".join(r["errors"]) or "нет вкладки за " + ", ".join(r["no_tab"])})
            msg = f"Таблица прочитана: вкладок {len(r['months'])}"
        elif key == "mail":
            if not smtp_configured():
                return jsonify({"ok": False, "message": "Почта не настроена."})
            with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587")), timeout=20) as smtp:
                smtp.starttls()
                smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            _svc_mark("mail", True, "проверка входа в почтовый ящик")
            msg = "Почтовый сервер принял логин и пароль"
        elif key == "ai":
            res = "нет ключа"
            for model in AI_MODELS:
                ok, res = call_gemini(model, get_api_key(), "Отвечай одним словом.", [{"role": "user", "parts": [{"text": "Скажи: готов"}]}], max_tokens=20)
                if ok:
                    return jsonify({"ok": True, "message": f"Connect AI ответил (модель {model})"})
            ai_all_failed(res)
            return jsonify({"ok": False, "message": str(res).replace("__TRY_NEXT__ ", "")})
        elif key == "cert":
            c = _cert_info(force=True)
            if c["days"] is None:
                return jsonify({"ok": False, "message": "Не удалось проверить: " + c["error"]})
            msg = f"Сертификат действует до {c['until']}"
        else:
            return jsonify({"error": "Этот сервис проверяется сам."}), 400
    except Exception as e:  # noqa: BLE001
        if key in ("elpass", "sheet", "mail"):
            _svc_mark(key, False, e)
        return jsonify({"ok": False, "message": str(e)[:200]})
    return jsonify({"ok": True, "message": msg})


# ---------- Telegram-бот админа: утренний отчёт о сервисах и оповещения о сбоях (01.10.2026, просьба пользователя) ----------
# Бота заводит сам админ в @BotFather и вставляет токен на вкладке «Сервисы». Чтобы портал узнал, кому писать,
# админ отправляет боту код с экрана — так чужой человек, написавший боту, отчёты не получит.
# Всё хранится одной записью settings.tg_bot: {token, bot, code, chat_id, chat, daily_sent, seen, alerted}. Токен наружу не отдаём.
TG_REPORT_HOUR = 8          # во сколько по Астане приходит ежедневный отчёт
TG_WATCH_MINUTES = 10       # как часто смотрим, не сломалось ли что-то
TG_MAX_LEN = 3900           # предел Telegram — 4096 знаков на сообщение; держим запас


def _tg_cfg():
    try:
        return json.loads(_setting("tg_bot") or "{}")
    except ValueError:
        return {}


def _tg_save(cfg):
    _set_setting("tg_bot", json.dumps(cfg, ensure_ascii=False))


def _tg_call(token, method, params=None):
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", method="POST",
                                 data=json.dumps(params or {}).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            desc = json.loads(e.read().decode("utf-8", "replace")).get("description") or ""
        except ValueError:
            desc = ""
        raise RuntimeError(f"Telegram ответил {e.code}" + (f": {desc}" if desc else "")) from None
    if not data.get("ok"):
        raise RuntimeError(data.get("description") or "Telegram не принял запрос")
    return data["result"]


def tg_ready():
    cfg = _tg_cfg()
    return bool(cfg.get("token") and cfg.get("chat_id"))


def tg_send(text):
    """Сообщение админу в Telegram. Оставляет отметку для вкладки «Сервисы»."""
    cfg = _tg_cfg()
    if not (cfg.get("token") and cfg.get("chat_id")):
        return False
    if len(text) > TG_MAX_LEN:                         # длиннее Telegram не примет — режем по целой строке
        text = text[:TG_MAX_LEN].rsplit(chr(10), 1)[0] + chr(10) + "…"
    try:
        _tg_call(cfg["token"], "sendMessage", {"chat_id": cfg["chat_id"], "text": text, "parse_mode": "HTML",
                                              "disable_web_page_preview": True})
    except Exception as e:
        _svc_mark("tg", False, e)
        raise
    _svc_mark("tg", True, text.split("\n", 1)[0][:80])
    return True


def _tg_esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


TG_MARK = {"ok": "✅", "warn": "⚠️", "bad": "❌", "off": "➖"}   # значки — только в Telegram, в интерфейсе портала эмодзи нет


def tg_report_text(db, with_tails=None):
    """Утренний отчёт: одна строка, если всё хорошо; иначе — что именно сломалось и с какой ошибкой."""
    items = [s for s in _services_state(db) if s["key"] != "tg"]
    bad = [s for s in items if s["state"] == "bad"]
    warn = [s for s in items if s["state"] == "warn"]
    good = [s for s in items if s["state"] == "ok"]
    lines = [f"<b>Connected Community</b> · {_astana_now().strftime('%d.%m, %H:%M')}"]
    if not bad and not warn:
        lines.append(f"✅ Все сервисы работают ({len(good)})")
    else:
        lines.append(" · ".join(x for x in [f"❌ Сбой: {len(bad)}" if bad else "", f"⚠️ Внимание: {len(warn)}" if warn else ""] if x))
        for s in bad + warn:
            lines.append(f"\n{TG_MARK[s['state']]} <b>{_tg_esc(s['title'])}</b> — {_tg_esc(s['status'])}")
            for k, v in s["rows"][:5]:
                lines.append(f"   {_tg_esc(k)}: {_tg_esc(v)}")
        if good:
            lines.append(f"\n✅ В порядке: {len(good)}")
    yday = (date.fromisoformat(_astana_today()) - timedelta(days=1)).isoformat()
    passes = db.execute("SELECT COUNT(*) FROM passes WHERE ts LIKE ?", (yday + "%",)).fetchone()[0]
    waiting = db.execute("SELECT COUNT(*) FROM requests WHERE status='new'").fetchone()[0]
    approval = db.execute("SELECT COUNT(*) FROM requests WHERE status='approval'").fetchone()[0]
    lines.append(f"\nВчера проходов через турникет: {passes}")
    lines.append(f"Заявок ждут обработки: {waiting}" + (f", ждут руководителя: {approval}" if approval else ""))
    if with_tails is None:
        with_tails = _astana_now().weekday() == 0          # по понедельникам — ещё и список недоделанного
    # Telegram не принимает сообщения длиннее 4096 знаков: хвостам отдаём только то место, что осталось после сбоев,
    # иначе в день, когда сломано сразу несколько сервисов, отчёт не ушёл бы вовсе
    room = TG_MAX_LEN - sum(len(x) + 1 for x in lines) - 140   # запас на приписку «полный список…» и строку со ссылкой
    if with_tails:
        tails = tails_text(limit=room) if room > 400 else ""
    else:                                                   # в остальные дни — только то, что ждёт решения пользователя
        tails = decisions_text(limit=min(room, 1200)) if room > 300 else ""
    if tails:
        lines.append("\n" + tails)
    lines.append(f"\n{PORTAL_URL}/#admin/services")
    return "\n".join(lines)


def tg_daily_report(db):
    """Раз в день в TG_REPORT_HOUR по Астане. Не ушло — планировщик попробует ещё раз через минуту."""
    cfg = _tg_cfg()
    today = _astana_today()
    if not (cfg.get("token") and cfg.get("chat_id")) or cfg.get("daily_sent") == today:
        return False
    tg_send(tg_report_text(db))
    cfg = _tg_cfg()
    cfg["daily_sent"] = today
    _tg_save(cfg)
    return True


def tg_watch(db):
    """Оповещение о сбое, не дожидаясь утра. Пишем, только если сервис «красный» две проверки подряд
    (одиночный сбой связи — не повод будить), и один раз; когда починился — сообщаем, что восстановлен."""
    cfg = _tg_cfg()
    if not (cfg.get("token") and cfg.get("chat_id")):
        return
    items = {s["key"]: s for s in _services_state(db) if s["key"] != "tg"}
    bad = sorted(k for k, s in items.items() if s["state"] == "bad")
    seen, alerted = set(cfg.get("seen") or []), set(cfg.get("alerted") or [])
    new = [k for k in bad if k in seen and k not in alerted]
    fixed = [k for k in alerted if k not in bad]
    msgs = []
    for k in new:
        s = items[k]
        err = next((v for kk, v in s["rows"] if "ошибк" in kk.lower() or kk == "Причина"), "")
        msgs.append(f"❌ <b>{_tg_esc(s['title'])}</b> — {_tg_esc(s['status'])}" + (f"\n   {_tg_esc(err)}" if err else ""))
    for k in fixed:
        if k in items:
            msgs.append(f"✅ <b>{_tg_esc(items[k]['title'])}</b> — снова работает")
    if msgs:
        tg_send("<b>Connected Community</b>\n" + "\n".join(msgs) + f"\n\n{PORTAL_URL}/#admin/services")
    cfg = _tg_cfg()
    cfg["seen"], cfg["alerted"] = bad, sorted((alerted | set(new)) - set(fixed))
    _tg_save(cfg)


# ---------- агенты Claude: кто за что отвечает, что делает сейчас и что сделал (06.10.2026) ----------
# Просьба пользователя: «выведи агентов в портал, отдельно окно „Агенты“ в админ-панель: название агента, за что он
# отвечает, что делает сейчас и что было сделано». Агенты работают на компьютере пользователя, а не на сервере, поэтому
# о начале и конце работы они сообщают сами: скрипт checks/agent_log.py вызывает agent_mark внутри контейнера.
# Портал только хранит отметки и показывает их; наружу адреса для записи нет.
# Названия — должностями, как в команде разработки (06.10.2026, слова пользователя: «назвать их по должностям, и на
# портале тоже, чтобы я видел, как моя команда работает»); по-английски, как принято для должностей «Технологий».
AGENTS = [
    {"key": "chief", "name": "Team Lead", "icon": "list", "when": "Когда находок накопилось много",
     "duty": "Решает, что команда чинит сразу, а что несёт вам, и готовит короткий доклад с рекомендацией."},
    {"key": "analyst", "name": "Business Analyst", "icon": "search", "when": "Перед новой функцией или разделом",
     "duty": "Разбирает вашу просьбу до начала работы: что уже есть на портале, что она затронет, какие вопросы вам задать."},
    {"key": "main", "name": "Developer", "icon": "laptop", "when": "Когда вы пишете в чат",
     "duty": "Пишет код портала, отвечает вам, проверяет результат в браузере и выкладывает на сайт."},
    {"key": "reviewer", "name": "Code Reviewer", "icon": "check", "when": "Перед выкладкой кода",
     "duty": "Читает каждую правку до выкладки: не нарушены ли ваши правила, права ролей и защита данных, всё ли записано в описание проекта."},
    {"key": "designer", "name": "UI/UX Designer", "icon": "layers", "when": "После правки интерфейса и по пятницам",
     "duty": "Смотрит снимки разделов на ноутбуке и телефоне: вылезший текст, съехавшие блоки, оформление вразнобой."},
    {"key": "tester", "name": "QA Engineer", "icon": "monitor", "when": "После правки форм и сценариев, перед запуском",
     "duty": "Проходит портал как живой сотрудник на копии базы: подаёт заявку, согласует её директором, закрывает как HR."},
    {"key": "security", "name": "Security Engineer", "icon": "lock", "when": "Когда правка касается входа, прав или личных данных, и по пятницам",
     "duty": "Ищет, как портал можно сломать или подсмотреть чужое: права ролей, личные данные, загрузки файлов, сервер."},
    {"key": "weekly", "name": "Auditor", "icon": "calendar", "when": "Пятница, 16:00",
     "duty": "Еженедельная проверка: обходит весь сайт, сервер, описание проекта и оформление, итог присылает вам в Telegram."},
]
AGENT_STALE_HOURS = 3      # «работает» дольше этого без отметки о конце — считаем, что агент конец не отметил
AGENT_TEXT_MAX = 600
AGENT_HISTORY = 40


def agent_mark(db, agent, action, text=""):
    """Отметка агента: action = start (начал, text — что делает) | done | fail (закончил, text — что сделано).
    Возвращает id записи. Незнакомый агент или действие — ValueError."""
    if agent not in {a["key"] for a in AGENTS} or action not in ("start", "done", "fail"):
        raise ValueError("agent_mark: неизвестный агент или действие")
    text = " ".join(str(text or "").split())[:AGENT_TEXT_MAX]
    now = datetime.utcnow().isoformat(timespec="seconds")
    running = db.execute("SELECT id FROM agent_runs WHERE agent=? AND status='running' ORDER BY started DESC", (agent,)).fetchall()
    if action == "start":
        for r in running:                                   # прошлый запуск конец не отметил — не оставляем «работает» навсегда
            db.execute("UPDATE agent_runs SET status='lost', finished=? WHERE id=?", (now, r[0]))
        rid = uuid.uuid4().hex
        db.execute("INSERT INTO agent_runs (id, agent, status, task, started) VALUES (?,?,?,?,?)", (rid, agent, "running", text, now))
    else:
        status = "done" if action == "done" else "failed"
        if running:
            rid = running[0][0]
            db.execute("UPDATE agent_runs SET status=?, result=?, finished=? WHERE id=?", (status, text, now, rid))
            for r in running[1:]:
                db.execute("UPDATE agent_runs SET status='lost', finished=? WHERE id=?", (now, r[0]))
        else:                                               # конец без начала — всё равно записываем, что сделано
            rid = uuid.uuid4().hex
            db.execute("INSERT INTO agent_runs (id, agent, status, result, started, finished) VALUES (?,?,?,?,?,?)",
                       (rid, agent, status, text, now, now))
    db.commit()
    return rid


def _agent_when(iso):
    """UTC из базы → «сегодня 11:40» / «05.10 16:02» по Астане."""
    try:
        t = datetime.fromisoformat(iso) + timedelta(hours=5)
    except (TypeError, ValueError):
        return ""
    return ("сегодня " if t.date().isoformat() == _astana_today() else t.strftime("%d.%m ")) + t.strftime("%H:%M")


def _agent_minutes(row):
    try:
        return max(0, int((datetime.fromisoformat(row["finished"]) - datetime.fromisoformat(row["started"])).total_seconds() // 60))
    except (TypeError, ValueError):
        return 0


@app.route("/api/admin/agents", methods=["GET"])
def admin_agents():
    db = get_db()
    stale = (datetime.utcnow() - timedelta(hours=AGENT_STALE_HOURS)).isoformat(timespec="seconds")
    week = (datetime.utcnow() - timedelta(days=7)).isoformat(timespec="seconds")
    names = {a["key"]: a["name"] for a in AGENTS}
    items = []
    for a in AGENTS:
        run = db.execute("SELECT * FROM agent_runs WHERE agent=? AND status='running' AND started>=? ORDER BY started DESC LIMIT 1",
                         (a["key"], stale)).fetchone()
        last = db.execute("SELECT * FROM agent_runs WHERE agent=? AND status IN ('done','failed') ORDER BY finished DESC LIMIT 1",
                          (a["key"],)).fetchone()
        runs = db.execute("SELECT COUNT(*) FROM agent_runs WHERE agent=? AND started>=?", (a["key"], week)).fetchone()[0]
        items.append(dict(a, runs_week=runs,
                          now={"task": run["task"] or "", "since": _agent_when(run["started"])} if run else None,
                          last={"result": last["result"] or "", "when": _agent_when(last["finished"]), "failed": last["status"] == "failed"} if last else None))
    history = [{"agent": names.get(r["agent"], r["agent"]), "status": "lost" if r["status"] == "running" and r["started"] < stale else r["status"],
                "task": r["task"] or "", "result": r["result"] or "", "when": _agent_when(r["finished"] or r["started"]),
                "minutes": _agent_minutes(r)}
               for r in db.execute("SELECT * FROM agent_runs ORDER BY COALESCE(finished, started) DESC LIMIT ?", (AGENT_HISTORY,)).fetchall()]
    return jsonify({"agents": items, "history": history, "working": sum(1 for x in items if x["now"]),
                    "checked": _astana_now().strftime("%d.%m %H:%M")})


@app.route("/api/admin/telegram", methods=["GET", "PUT", "DELETE"])
def admin_telegram():
    """GET — подключён ли бот; PUT {token} — подключить бота (проверяем токен у Telegram); DELETE — отключить."""
    cfg = _tg_cfg()
    if request.method == "DELETE":
        _set_setting("tg_bot", "")
        return jsonify({"connected": False})
    if request.method == "PUT":
        token = ((request.get_json(silent=True) or {}).get("token") or "").strip()
        if not re.fullmatch(r"\d{6,}:[A-Za-z0-9_-]{30,}", token):
            return jsonify({"error": "Это не похоже на токен бота. Он выглядит так: 1234567890:AAH…"}), 400
        try:
            me = _tg_call(token, "getMe")
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Telegram не принял токен: {e}"}), 400
        cfg = {"token": token, "bot": me.get("username") or "", "code": f"{secrets.randbelow(9000) + 1000}"}
        _tg_save(cfg)
    return jsonify({"connected": bool(cfg.get("token")), "linked": bool(cfg.get("chat_id")), "bot": cfg.get("bot") or "",
                    "code": cfg.get("code") if cfg.get("token") and not cfg.get("chat_id") else "",
                    "chat": cfg.get("chat") or "", "hour": TG_REPORT_HOUR, "daily_sent": cfg.get("daily_sent") or ""})


@app.route("/api/admin/telegram/link", methods=["POST"])
def admin_telegram_link():
    """Админ отправил боту код с экрана — ищем это сообщение и запоминаем чат."""
    cfg = _tg_cfg()
    if not cfg.get("token"):
        return jsonify({"error": "Сначала подключите бота."}), 400
    try:
        updates = _tg_call(cfg["token"], "getUpdates", {"timeout": 0, "allowed_updates": ["message"]})
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Не удалось спросить Telegram: {e}"}), 502
    for u in reversed(updates):
        msg = u.get("message") or {}
        if (msg.get("text") or "").strip().replace("/start", "").strip() == cfg.get("code"):
            chat = msg.get("chat") or {}
            cfg["chat_id"] = chat.get("id")
            cfg["chat"] = (chat.get("title") or " ".join(x for x in [chat.get("first_name"), chat.get("last_name")] if x)
                           or chat.get("username") or str(chat.get("id")))
            _tg_save(cfg)
            try:
                tg_send("<b>Connected Community</b>\nБот подключён. Каждый день в "
                        f"{TG_REPORT_HOUR:02d}:00 сюда будет приходить отчёт о сервисах портала, а при сбое — сообщение сразу.")
            except Exception as e:  # noqa: BLE001
                return jsonify({"error": f"Чат нашёлся, но сообщение не ушло: {e}"}), 502
            return jsonify({"linked": True, "chat": cfg["chat"]})
    return jsonify({"error": f"Не вижу сообщения с кодом {cfg.get('code')}. Отправьте его боту @{cfg.get('bot')} и нажмите ещё раз."}), 404


@app.route("/api/admin/telegram/tails", methods=["POST"])
def admin_telegram_tails():
    """Список недоделанного — админу в Telegram сейчас, не дожидаясь понедельника."""
    if not tg_ready():
        return jsonify({"error": "Бот отчётов ещё не подключён."}), 400
    text = tails_text()
    if not text:
        return jsonify({"error": "Список пуст — всё доделано."}), 400
    try:
        tg_send("<b>Connected Community</b>\n" + text + f"\n\n{PORTAL_URL}/#admin/services")
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Список не ушёл: {e}"}), 502
    return jsonify({"ok": True})


@app.route("/api/admin/telegram/test", methods=["POST"])
def admin_telegram_test():
    if not tg_ready():
        return jsonify({"error": "Бот ещё не подключён."}), 400
    try:
        tg_send(tg_report_text(get_db()))
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Отчёт не ушёл: {e}"}), 502
    return jsonify({"ok": True})


# ---------- Telegram-бот для сотрудников: личные напоминания (01.10.2026, первая проба — опоздание без отметки) ----------
# Отдельный бот (не тот, что шлёт админу отчёты о сервисах) — решение пользователя. Сотрудник подключает его сам в личном
# кабинете: открывает бота по ссылке t.me/<бот>?start=<код> и жмёт «Старт» — портал находит это сообщение и запоминает чат.
# Пока идёт проба (`open` = False), подключиться может только админ; «Открыть для всех» — кнопка на вкладке «Сервисы».
# Всё в settings.tg_staff: {token, bot, open, links: {user_id: {chat_id, name, at}}, codes: {user_id: код}, late: {date, slots}}.
TG_LATE_SLOTS = ["11:00", "14:00", "17:30"]   # когда напоминаем об опоздании без отметки (выбор пользователя 01.10.2026)
TG_LATE_WINDOW_MIN = 20                       # портал мог перезапускаться ровно в минуту напоминания — шлём в течение 20 минут
TG_LATE_TEXT = [
    "{name}, здравствуйте. Сегодня вы пришли в {arrived} — позже начала рабочего дня ({schedule}). Отметки в табеле на сегодня нет.\n\n"
    "Если была причина, поставьте отметку в «Посещаемости»:\n{url}",
    "{name}, напоминаем: сегодня вы пришли в {arrived}, отметки в табеле пока нет.\n\n"
    "Поставить отметку в «Посещаемости»:\n{url}",
    "{name}, последнее напоминание на сегодня: вы пришли в {arrived}, отметки в табеле нет. "
    "Без отметки день попадёт в отчёт об опозданиях.\n\nПоставить отметку в «Посещаемости»:\n{url}",
]


def _staffbot():
    try:
        cfg = json.loads(_setting("tg_staff") or "{}")
    except ValueError:
        cfg = {}
    cfg.setdefault("links", {})
    cfg.setdefault("codes", {})
    return cfg


def _staffbot_save(cfg):
    _set_setting("tg_staff", json.dumps(cfg, ensure_ascii=False))


def _staffbot_allowed(cfg, user):
    """Кому можно подключаться: всем, когда бот открыт; во время пробы — только админу."""
    return bool(cfg.get("token")) and (bool(cfg.get("open")) or user["role"] == "admin")


def staffbot_send(user_id, text):
    """Личное сообщение сотруднику от бота портала. False — человек не подключён (или бот закрыт для него)."""
    cfg = _staffbot()
    link = cfg["links"].get(user_id)
    if not (cfg.get("token") and link):
        return False
    try:
        _tg_call(cfg["token"], "sendMessage", {"chat_id": link["chat_id"], "text": text, "disable_web_page_preview": True})
    except Exception as e:
        _svc_mark("staffbot", False, e)
        raise
    _svc_mark("staffbot", True, "личное сообщение сотруднику")
    return True


def _first_name(full):
    """«Абдуллаев Темирлан» → «Темирлан» (в справочнике сначала фамилия)."""
    parts = (full or "").split()
    return parts[1] if len(parts) > 1 else (parts[0] if parts else "")


def _late_text(slot_i, item):
    return TG_LATE_TEXT[slot_i].format(name=_first_name(item["name"]), arrived=item["arrived"], schedule=item["schedule"],
                                       url=f"{PORTAL_URL}/#attendance")


def tg_late_reminders(db, now=None):
    """Три раза в рабочий день: кто сегодня опоздал и до сих пор без отметки в табеле — тому личное напоминание.
    Поставил отметку — следующих напоминаний не будет. Пишем только тем, кто сам подключил бота."""
    cfg = _staffbot()
    if not cfg.get("token") or not cfg["links"]:
        return 0
    now = now or _astana_now()
    today = now.date()
    if not is_workday(today):
        return 0
    state = cfg.get("late") or {}
    if state.get("date") != today.isoformat():
        state = {"date": today.isoformat(), "slots": []}
    due = None
    for i, slot in enumerate(TG_LATE_SLOTS):
        h, m = map(int, slot.split(":"))
        at = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if slot not in state["slots"] and at <= now < at + timedelta(minutes=TG_LATE_WINDOW_MIN):
            due = (i, slot)
    if not due:
        return 0
    late = {x["employee_id"]: x for x in compute_lateness(db, today, today)["late"]}   # late — только без отметки
    sent = 0
    for uid in list(cfg["links"]):
        u = db.execute("SELECT id, name, email, role FROM users WHERE id=?", (uid,)).fetchone()
        if not u or not _staffbot_allowed(cfg, u):
            continue
        emp = _my_employee(db, dict(u))
        item = late.get(emp["id"]) if emp else None
        if not item:
            continue
        try:
            sent += bool(staffbot_send(uid, _late_text(due[0], item)))
        except Exception as e:  # noqa: BLE001
            print(f"[бот сотрудников] напоминание не ушло ({u['name']}): {e}", flush=True)
    cfg = _staffbot()
    state["slots"].append(due[1])
    cfg["late"] = state
    _staffbot_save(cfg)
    return sent


def _staffbot_json(cfg, db):
    names = []
    for uid in cfg["links"]:
        u = db.execute("SELECT name, login FROM users WHERE id=?", (uid,)).fetchone()
        if u:
            names.append(u["name"] or u["login"])
    return {"connected": bool(cfg.get("token")), "bot": cfg.get("bot") or "", "open": bool(cfg.get("open")),
            "linked": sorted(names), "slots": TG_LATE_SLOTS}


@app.route("/api/admin/staffbot", methods=["GET", "PUT", "DELETE"])
def admin_staffbot():
    """Бот для сотрудников: GET — состояние; PUT {token} — подключить бота, PUT {open: true|false} — открыть для всех
    или вернуть режим пробы; DELETE — отключить (все привязки сотрудников забываются)."""
    cfg, db = _staffbot(), get_db()
    if request.method == "DELETE":
        _set_setting("tg_staff", "")
        return jsonify(_staffbot_json(_staffbot(), db))
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        if "open" in data:
            if not cfg.get("token"):
                return jsonify({"error": "Сначала подключите бота."}), 400
            cfg["open"] = bool(data["open"])
        else:
            token = (data.get("token") or "").strip()
            if not re.fullmatch(r"\d{6,}:[A-Za-z0-9_-]{30,}", token):
                return jsonify({"error": "Это не похоже на токен бота. Он выглядит так: 1234567890:AAH…"}), 400
            if token == _tg_cfg().get("token"):
                return jsonify({"error": "Это токен бота для отчётов о сервисах. Для сотрудников нужен отдельный бот."}), 400
            try:
                me_bot = _tg_call(token, "getMe")
            except Exception as e:  # noqa: BLE001
                return jsonify({"error": f"Telegram не принял токен: {e}"}), 400
            cfg = {"token": token, "bot": me_bot.get("username") or "", "open": False, "links": {}, "codes": {}}
        _staffbot_save(cfg)
    return jsonify(_staffbot_json(cfg, db))


@app.route("/api/admin/staffbot/sample", methods=["POST"])
def admin_staffbot_sample():
    """Пример напоминания об опоздании — админу в его собственный Telegram (посмотреть, как это выглядит)."""
    user = current_user()
    if user["id"] not in _staffbot()["links"]:
        return jsonify({"error": "Сначала подключите свой Telegram к этому боту — кнопка ниже."}), 400
    n = int((request.get_json(silent=True) or {}).get("n") or 0) % len(TG_LATE_TEXT)
    try:
        staffbot_send(user["id"], _late_text(n, {"name": user["name"] or "", "arrived": "09:40", "schedule": "09:00"}))
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Сообщение не ушло: {e}"}), 502
    return jsonify({"ok": True})


@app.route("/api/me/telegram", methods=["GET", "POST", "DELETE"])
def me_telegram():
    """Свой Telegram: GET — подключён ли и ссылка на бота; POST — «я нажал Старт» (ищем сообщение с кодом); DELETE — отключить."""
    user, cfg = current_user(), _staffbot()
    if not _staffbot_allowed(cfg, user):
        if request.method == "GET":
            return jsonify({"available": False})
        return jsonify({"error": "Уведомления в Telegram пока не включены."}), 403
    uid = user["id"]
    if request.method == "DELETE":
        cfg["links"].pop(uid, None)
        _staffbot_save(cfg)
    elif request.method == "POST":
        code = cfg["codes"].get(uid)
        try:
            updates = _tg_call(cfg["token"], "getUpdates", {"timeout": 0, "allowed_updates": ["message"]})
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Не удалось спросить Telegram: {e}"}), 502
        found = None
        for upd in reversed(updates):
            msg = upd.get("message") or {}
            if code and (msg.get("text") or "").replace("/start", "").strip() == code and (msg.get("chat") or {}).get("type") == "private":
                found = msg["chat"]
                break
        if not found:
            return jsonify({"error": "Не вижу, чтобы вы нажали «Старт» у бота. Откройте бота по ссылке, нажмите «Старт» и попробуйте ещё раз."}), 404
        cfg = _staffbot()
        cfg["links"][uid] = {"chat_id": found.get("id"), "at": datetime.utcnow().isoformat(timespec="seconds"),
                             "name": " ".join(x for x in [found.get("first_name"), found.get("last_name")] if x) or found.get("username") or ""}
        cfg["codes"].pop(uid, None)
        _staffbot_save(cfg)
        try:
            staffbot_send(uid, "Готово: Telegram подключён к порталу Connected Community. Сюда будут приходить личные напоминания.")
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Чат нашёлся, но сообщение не ушло: {e}"}), 502
    link = cfg["links"].get(uid)
    if not link and uid not in cfg["codes"]:
        cfg["codes"][uid] = secrets.token_urlsafe(8).replace("-", "a").replace("_", "b")
        _staffbot_save(cfg)
    return jsonify({"available": True, "bot": cfg.get("bot") or "", "linked": bool(link), "name": (link or {}).get("name") or "",
                    "url": "" if link else f"https://t.me/{cfg.get('bot')}?start={cfg['codes'][uid]}"})


# ---------- бот для HR в Telegram (06.10.2026) ----------
# Слова пользователя: «хочу сделать для неё бота в телеграме… бот новый давай; теперь вместо почты будет в 9 утра приходить
# ей в этот бот; и напоминание о днях рождения сотрудников именно в этот день». Третий бот портала (первый — отчёты админу,
# второй — личные напоминания сотрудникам). Токен вставляет админ на вкладке «Сервисы», свой Telegram HR подключает сама
# в HR-панели: ссылка на бота → «Старт» → кнопка на портале. Пишет бот всем, кто подключился (HR и, если захочет, админ).
# Всё в settings.tg_hr: token, bot, links{user_id: {chat_id, name, at}}, codes{user_id}, bday_day.
HRBOT_BDAY_HOUR = 9            # дни рождения — в 09:00 по Астане, в сам день
HRBOT_BDAY_LAST_HOUR = 20      # сервер лежал утром — пришлём позже, но не на ночь глядя
HRBOT_HOLIDAY_DAYS = 2         # о праздничных выходных — за два дня (карточка задачи пользователя, 07.10.2026)
WEEKDAYS_RU = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
MONTHS_GEN_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def _ru_date(d):
    return f"{d.day} {MONTHS_GEN_RU[d.month - 1]}"


def _hrbot():
    try:
        cfg = json.loads(_setting("tg_hr") or "{}")
    except ValueError:
        cfg = {}
    cfg.setdefault("links", {})
    cfg.setdefault("codes", {})
    return cfg


def _hrbot_save(cfg):
    _set_setting("tg_hr", json.dumps(cfg, ensure_ascii=False))


def _hrbot_active(cfg=None):
    """Привязки тех, кто СЕЙЧАС работает в HR или админ. Понизили роль или удалили учётку — привязка стирается сама:
    иначе бывший сотрудник HR продолжал бы получать отчёты с фамилиями (нашёл Security Engineer 06.10.2026)."""
    cfg = cfg or _hrbot()
    db = sqlite3.connect(DB_PATH, timeout=5)                 # своё соединение: функция нужна и планировщику, и проверкам вне запроса
    try:
        staff = {r[0] for r in db.execute("SELECT id FROM users WHERE role IN ('hr','admin')")}
    finally:
        db.close()
    keep = {uid: link for uid, link in cfg["links"].items() if uid in staff}
    if len(keep) != len(cfg["links"]):
        cfg["links"] = keep
        cfg["codes"] = {u: c for u, c in cfg["codes"].items() if u in staff}
        _hrbot_save(cfg)
    return cfg


def _hrbot_hr_linked(cfg):
    """Подключил ли Telegram хоть один сотрудник HR (не админ). Решение пользователя 07.10.2026: пока HR не в боте —
    отчёт об опозданиях идёт письмом всем, как раньше; подключилась — только в бот, письмо не дублируется."""
    db = sqlite3.connect(DB_PATH, timeout=5)
    try:
        hr = {r[0] for r in db.execute("SELECT id FROM users WHERE role='hr'")}
    finally:
        db.close()
    return any(uid in hr for uid in cfg["links"])


def hrbot_ready():
    cfg = _hrbot()
    return bool(cfg.get("token")) and _hrbot_hr_linked(_hrbot_active(cfg))


hrbot_last_failed = []        # кому не дошло последнее сообщение бота HR (user_id) — им отчёт уходит письмом


def _tg_chunks(text, limit=None):
    """Длинный текст — несколькими сообщениями, по целым строкам: Telegram не принимает больше 4096 знаков."""
    limit = limit or TG_MAX_LEN
    out, cur = [], ""
    for line in text.split("\n"):
        if len(line) > limit and cur:                        # перед длинной строкой отдаём накопленное — иначе порядок сломается
            out.append(cur); cur = ""
        while len(line) > limit:                             # одна строка длиннее предела — режем её саму
            out.append(line[:limit]); line = line[limit:]
        if cur and len(cur) + 1 + len(line) > limit:
            out.append(cur); cur = line
        else:
            cur = f"{cur}\n{line}" if cur else line
    if cur.strip():
        out.append(cur)
    return out


def hrbot_send(text, only=None, html=False):
    """Сообщение HR от бота: всем подключившимся (или одному — only=user_id). Возвращает, скольким дошло.
    Не дошло никому — исключение; дошло хотя бы одному — сервис считается работающим.
    html=True — жирный и прочая разметка Telegram (parse_mode HTML); текст тогда должен быть экранирован (html.escape)."""
    global hrbot_last_failed
    cfg = _hrbot_active()
    links = {u: l for u, l in cfg["links"].items() if only is None or u == only}
    hrbot_last_failed = []
    if not (cfg.get("token") and links):
        return 0
    ok, err = 0, None
    for uid, link in links.items():
        try:
            for part in _tg_chunks(text):
                params = {"chat_id": link["chat_id"], "text": part, "disable_web_page_preview": True}
                if html:
                    params["parse_mode"] = "HTML"
                _tg_call(cfg["token"], "sendMessage", params)
            ok += 1
        except Exception as e:  # noqa: BLE001
            err = e
            hrbot_last_failed.append(uid)
    if not ok:
        _svc_mark("hrbot", False, err)
        raise RuntimeError(str(err))
    _svc_mark("hrbot", True, text.split("\n", 1)[0][:80])
    if err:                                                  # дошло не всем — сбой должен быть виден на вкладке «Сервисы»
        time.sleep(1.05)                                     # отметки с точностью до секунды: сбой должен быть новее удачи
        _svc_mark("hrbot", False, f"дошло не всем ({len(hrbot_last_failed)} из {len(links)} не получили): {err}")
    return ok


def hrbot_hello_text(user):
    """Приветствие при подключении. Первая фраза — слова пользователя 06.10.2026: «привет, Даниля, я твой личный HR-бот-помощник»;
    вопросов бот не принимает (свободные ответы он отклонил: «свободный ответ не надо, просто… приветственный текст»)."""
    name = _first_name(user["name"] or "")
    hello = "Привет" + (", " + name if name else "") + "! Я твой личный HR-бот-помощник."
    return "\n".join([
        hello,
        "",
        "Что здесь будет:",
        "• по понедельникам в 09:00 — отчёт об опозданиях за неделю с готовым постом;",
        f"• в день рождения сотрудника, в {HRBOT_BDAY_HOUR:02d}:00, — напоминание, кого сегодня поздравить.",
        "",
        "Отвечать на сообщения я пока не умею — только присылаю.",
    ])


def hrbot_weekly_text(db, start, end):
    """Понедельничный отчёт об опозданиях для бота — свой формат под Telegram (07.10.2026, слова пользователя: «скудный
    текст приходит, сделай ярче и понятнее»): жирные заголовки (HTML), цветные метки, только суть — без списка всех,
    кто не опаздывал (он есть на портале). Готовый пост для канала уходит отдельным сообщением (hrbot_weekly_post)."""
    from html import escape as esc
    r = _for_report(compute_lateness(db, start, end))
    period = f"{start.strftime('%d.%m')}–{end.strftime('%d.%m')}"
    if not r["has_passes"]:
        return f"\U0001F552 <b>Опоздания за неделю {period}</b>" + chr(10) + "Данных из elpass пока нет." + chr(10) + "https://community.connectedhome.kz/#hr/late"
    late, exc, on_time = _lateness_groups(r)
    L = [f"\U0001F552 <b>Опоздания за неделю {period}</b>",
         f"Турникет elpass · пн–пт · допуск {LATE_GRACE_MIN} минут", "",
         "\U0001F4CA <b>Итоги</b>",
         f"\U0001F7E2 Без опозданий — {len(on_time)} чел.",
         f"\U0001F534 Опоздали без отметки в табеле — {len(late)} чел. ({_times_word(len(r['late']))})",
         f"\U0001F7E1 Опоздали, но есть отметка — {len(exc)} чел. ({_times_word(len(r['excused']))})"]
    tail = []
    if r.get("remote_names"):
        tail.append(f"\U0001F3E0 Удалённо — {len(r['remote_names'])}")
    if r["unmapped_names"]:
        tail.append(f"\u2754 Нет в турникете — {len(r['unmapped_names'])}")
    if tail:
        L.append(" · ".join(tail))
    L += ["", "\U0001F534 <b>Без отметки в табеле</b>"]
    if late:
        for name, items in late:
            days = ", ".join(f"{_fmt_day(x['date'], True)} {x['arrived']}" for x in items)
            L.append(f"\u2022 <b>{esc(name)}</b> — {_times_word(len(items))}: {days}")
    else:
        L.append("Никого \U0001F44D")
    if exc:
        L += ["", "\U0001F7E1 <b>Опоздали, но отметились</b>"]
        for name, items in exc:
            days = "; ".join(f"{_fmt_day(x['date'], True)} {x['arrived']} — {esc(ATTENDANCE_CODES.get(x['excuse']['code'], x['excuse']['code']))}"
                             + (f" ({esc(x['excuse']['comment'])})" if x["excuse"]["comment"] else "") for x in items)
            L.append(f"\u2022 <b>{esc(name)}</b>: {days}")
    for blk in lateness_top_by_office(r):
        if not blk["people"]:
            continue
        L += ["", f"\u26A0\uFE0F <b>Топ опоздавших · {esc(blk['office'])}</b>"]
        for i, p in enumerate(blk["people"]):
            L.append(f"{MEDALS[i] if i < 3 else '\u2022'} {esc(p['name'])} — {_times_word(p['count'])}, в среднем приходил(а) в {p['avg_at']}")
    for blk in early_top_by_office(db, start, end, report=True):
        if not blk["people"]:
            continue
        L += ["", f"\U0001F3C6 <b>Самые пунктуальные · {esc(blk['office'])}</b>"]
        for i, e in enumerate(blk["people"]):
            L.append(f"{MEDALS[i] if i < 3 else '\u2022'} {esc(e['name'])} — раньше графика на {e['avg_ahead']} мин, рекорд {e['earliest']}")
    if r["unmapped_names"]:
        L += ["", f"\u2754 <b>Нет в турникете:</b> {esc(', '.join(sorted(r['unmapped_names'])))}"]
    L += ["", "\U0001F517 Подробнее: https://community.connectedhome.kz/#hr/late",
          "\U0001F4CB Готовый пост для канала — следующим сообщением, его можно переслать как есть."]
    return chr(10).join(L)


def hrbot_weekly_post(db, start, end):
    """Второе сообщение понедельника: готовый пост рубрики «Время под контролем» — HR пересылает в канал без правок."""
    return telegram_post(db, start, end)


def hrbot_birthday_text(db, day=None):
    """Кто сегодня именинник. Год в дате рождения условный — сравниваем только день и месяц. Пусто — пустая строка."""
    d = date.fromisoformat(day or _astana_today())
    mds = {d.isoformat()[5:10]}
    if d.month == 2 and d.day == 28 and not calendar.isleap(d.year):
        mds.add("02-29")                                     # родившихся 29 февраля в обычный год поздравляют 28-го
    people = [e for e in db.execute("SELECT name, position, department, birthday FROM employees WHERE birthday<>'' ORDER BY name").fetchall()
              if (e["birthday"] or "")[5:10] in mds]
    if not people:
        return ""
    head = "\U0001F382 Сегодня день рождения" + (" у сотрудника" if len(people) == 1 else f" у {len(people)} сотрудников")
    return "\n".join([head, ""] + ["• " + " — ".join(x for x in [e["name"], e["position"], e["department"]] if x) for e in people])


def _holiday_block(start):
    """Выходные подряд, начиная с даты start (праздники + соседние субботы и воскресенья): конец блока и названия праздников в нём."""
    end, names = start, []
    while True:
        n = HOLIDAYS_KZ.get(end.isoformat())
        if n and "перенос" not in n and n not in names:
            names.append(n)
        nxt = end + timedelta(days=1)
        if is_workday(nxt):
            break
        end = nxt
    return end, names


def hrbot_holiday_text(today):
    """За два дня до выходных с праздником: какие дни отдыхаем и когда на работу. Нет такого — пустая строка."""
    start = today + timedelta(days=HRBOT_HOLIDAY_DAYS)
    if is_workday(start) or not is_workday(start - timedelta(days=1)):
        return ""                                   # блок выходных должен начинаться ровно через два дня
    end, names = _holiday_block(start)
    if not names:
        return ""                                   # обычные суббота и воскресенье — не напоминаем
    back = end + timedelta(days=1)
    while not is_workday(back):
        back += timedelta(days=1)
    days = (end - start).days + 1
    span = _ru_date(start) if days == 1 else f"{start.day if start.month == end.month else _ru_date(start)}–{_ru_date(end)}"
    word = "день" if days == 1 else ("дня" if days < 5 else "дней")
    return (f"\U0001F1F0\U0001F1FF Через два дня праздник: {', '.join(names)}." + chr(10) +
            f"Выходные: {span} ({days} {word}). На работу — {WEEKDAYS_RU[back.weekday()]}, {_ru_date(back)}.")


def hrbot_holidays(db, now=None):
    """Раз в день, с 09:00 по Астане: за два дня до праздничных выходных — сообщение HR. Не ушло — повтор через минуту."""
    cfg = _hrbot()
    now = now or _astana_now()
    today = now.date().isoformat()
    if not cfg.get("token") or cfg.get("hol_day") == today or not HRBOT_BDAY_HOUR <= now.hour < HRBOT_BDAY_LAST_HOUR:
        return False
    if not _hrbot_active(cfg)["links"]:
        return False
    text = hrbot_holiday_text(now.date())
    if text:
        hrbot_send(text)
    cfg = _hrbot()
    cfg["hol_day"] = today
    _hrbot_save(cfg)
    return bool(text)


def hrbot_birthdays(db, now=None):
    """Раз в день, с 09:00 по Астане: если сегодня у кого-то день рождения — сообщение HR. Не ушло — повтор через минуту."""
    cfg = _hrbot()
    now = now or _astana_now()
    today = now.date().isoformat()
    if not cfg.get("token") or cfg.get("bday_day") == today or not HRBOT_BDAY_HOUR <= now.hour < HRBOT_BDAY_LAST_HOUR:
        return False
    if not _hrbot_active(cfg)["links"]:
        return False
    text = hrbot_birthday_text(db, today)
    if text:
        hrbot_send(text)
    cfg = _hrbot()
    cfg["bday_day"] = today
    _hrbot_save(cfg)
    return bool(text)


def _hrbot_json(cfg, db):
    cfg = _hrbot_active(cfg) if cfg.get("token") else cfg
    names = []
    for uid in cfg["links"]:
        u = db.execute("SELECT name, login FROM users WHERE id=?", (uid,)).fetchone()
        if u:
            names.append(u["name"] or u["login"])
    return {"connected": bool(cfg.get("token")), "bot": cfg.get("bot") or "", "linked": sorted(names)}


@app.route("/api/admin/hrbot", methods=["GET", "PUT", "DELETE"])
def admin_hrbot():
    """Бот для HR: GET — состояние; PUT {token} — подключить; DELETE — отключить (привязки забываются). Только админ."""
    cfg, db = _hrbot(), get_db()
    if request.method == "DELETE":
        _set_setting("tg_hr", "")
        return jsonify(_hrbot_json(_hrbot(), db))
    if request.method == "PUT":
        token = ((request.get_json(silent=True) or {}).get("token") or "").strip()
        if not re.fullmatch(r"\d{6,}:[A-Za-z0-9_-]{30,}", token):
            return jsonify({"error": "Это не похоже на токен бота. Он выглядит так: 1234567890:AAH…"}), 400
        if token in (_tg_cfg().get("token"), _staffbot().get("token")):
            return jsonify({"error": "Этот бот уже подключён к порталу для другого. Для HR нужен отдельный бот."}), 400
        try:
            me_bot = _tg_call(token, "getMe")
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Telegram не принял токен: {e}"}), 400
        cfg = {"token": token, "bot": me_bot.get("username") or "", "links": {}, "codes": {}}
        _hrbot_save(cfg)
    return jsonify(_hrbot_json(cfg, db))


@app.route("/api/hr/telegram", methods=["GET", "POST", "DELETE"])
def hr_telegram():
    """Telegram сотрудника HR (и админа): GET — подключён ли и ссылка на бота; POST — «я нажал Старт»; DELETE — отключить.
    Адрес под /api/hr — остальным ролям закрыт даже на чтение."""
    user, cfg = current_user(), _hrbot()
    if not cfg.get("token"):
        if request.method == "GET":
            return jsonify({"available": False})
        return jsonify({"error": "Бот для HR ещё не подключён."}), 400
    uid = user["id"]
    if request.method == "DELETE":
        cfg["links"].pop(uid, None)
        _hrbot_save(cfg)
    elif request.method == "POST":
        code = cfg["codes"].get(uid)
        try:
            updates = _tg_call(cfg["token"], "getUpdates", {"timeout": 0, "allowed_updates": ["message"]})
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Не удалось спросить Telegram: {e}"}), 502
        found = None
        for upd in reversed(updates):
            msg = upd.get("message") or {}
            if code and (msg.get("text") or "").replace("/start", "").strip() == code and (msg.get("chat") or {}).get("type") == "private":
                found = msg["chat"]
                break
        if not found:
            return jsonify({"error": "Не вижу, чтобы вы нажали «Старт» у бота. Откройте бота по ссылке, нажмите «Старт» и попробуйте ещё раз."}), 400
        chats = {((u.get("message") or {}).get("chat") or {}).get("id") for u in updates
                 if (u.get("message") or {}).get("text", "").replace("/start", "").strip() == code and ((u.get("message") or {}).get("chat") or {}).get("type") == "private"}
        if len(chats) > 1:                                   # ссылкой воспользовался кто-то ещё — не гадаем, чей чат настоящий
            cfg["codes"][uid] = secrets.token_urlsafe(8).replace("-", "a").replace("_", "b")
            _hrbot_save(cfg)
            return jsonify({"error": "Этой ссылкой воспользовались из двух разных Telegram. Ссылка заменена — откройте бота заново и нажмите «Старт»."}), 409
        cfg = _hrbot()
        cfg["links"][uid] = {"chat_id": found.get("id"), "at": datetime.utcnow().isoformat(timespec="seconds"),
                             "name": " ".join(x for x in [found.get("first_name"), found.get("last_name")] if x) or found.get("username") or ""}
        cfg["codes"].pop(uid, None)
        _hrbot_save(cfg)
        try:
            hrbot_send(hrbot_hello_text(user), only=uid)
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Чат нашёлся, но сообщение не ушло: {e}"}), 502
    link = cfg["links"].get(uid)
    if not link and uid not in cfg["codes"]:
        cfg["codes"][uid] = secrets.token_urlsafe(8).replace("-", "a").replace("_", "b")
        _hrbot_save(cfg)
    return jsonify({"available": True, "bot": cfg.get("bot") or "", "linked": bool(link), "name": (link or {}).get("name") or "",
                    "url": "" if link else f"https://t.me/{cfg.get('bot')}?start={cfg['codes'][uid]}"})


_hrbot_sample_at = {}          # user_id → когда последний раз просил пример


@app.route("/api/hr/telegram/sample", methods=["POST"])
def hr_telegram_sample():
    """«Прислать пример» — себе в Telegram: отчёт за прошлую неделю и пример напоминания о дне рождения."""
    user, db = current_user(), get_db()
    if user["id"] not in _hrbot()["links"]:
        return jsonify({"error": "Сначала подключите свой Telegram к боту."}), 400
    if time.time() - _hrbot_sample_at.get(user["id"], 0) < 60:
        return jsonify({"error": "Пример уже отправлен — следующий можно запросить через минуту."}), 429
    _hrbot_sample_at[user["id"]] = time.time()
    today = date.fromisoformat(_astana_today())
    start = today - timedelta(days=today.weekday() + 7)
    bday = hrbot_birthday_text(db) or "\U0001F382 Сегодня день рождения у сотрудника\n\n• Фамилия Имя — должность, подразделение\n\n(это пример: сегодня именинников нет)"
    try:
        hrbot_send(hrbot_weekly_text(db, start, start + timedelta(days=4)), only=user["id"], html=True)
        hrbot_send(hrbot_weekly_post(db, start, start + timedelta(days=4)), only=user["id"])
        hrbot_send(bday, only=user["id"])
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Сообщение не ушло: {e}"}), 502
    return jsonify({"ok": True})


def _astana_today():
    return (datetime.utcnow() + timedelta(hours=5)).date().isoformat()


def _astana_now():
    return datetime.utcnow() + timedelta(hours=5)


# ---------- мини-игры (22.09.2026, идея пользователя) ----------
# Доступ считает сервер по времени Астаны: до 09:00 — если уже пришёл в офис (есть вход через турникет сегодня;
# удалённым и тем, у кого нет карточки, — просто по времени), 13:00–14:00 и после 18:00 — свободно,
# в остальное рабочее время — не больше GAME_WORK_LIMIT_MIN минут в день (портал отсчитывает, пока игра открыта).
# Выходные — свободно. Баллы за партию считает сервер (потолки GAME_POINTS_CAP), чтобы нельзя было накрутить из консоли.
GAMES = {"snake": "Змейка", "mines": "Сапёр", "quiz": "Викторина о компании", "typing": "Скоропечатание"}
GAME_POINTS_CAP = {"snake": 40, "mines": 30, "quiz": 30, "typing": 30}
GAME_WORK_LIMIT_MIN = 30
GAMES_UNLIMITED_ROLES = {"admin"}   # 23.09.2026 по просьбе пользователя: у админа (Темирлан) игры без ограничений по времени, у остальных — окна и лимит
GAME_FREE_BEFORE, GAME_LUNCH, GAME_FREE_AFTER = "09:00", ("13:00", "14:00"), "18:00"
GAME_DAILY_GAMES = 40                     # партий с баллами в день на человека
QUIZ_QUESTIONS = 10
_quiz_sessions = {}                       # qid → {"user": id, "answers": [...], "expires": datetime}


def _came_early_today(db, user, today_s):
    """Есть ли у сотрудника вход через турникет сегодня. None — проверить нельзя (нет карточки/карточки сотрудника, удалённый)."""
    emp = _my_employee(db, user)
    if not emp or emp["remote"] or not (emp["elpass_id"] or "").strip():
        return None
    cards = [c.strip() for c in emp["elpass_id"].split(",") if c.strip()]
    q = "SELECT 1 FROM passes WHERE direction='in' AND ts LIKE ? AND elpass_id IN (%s) LIMIT 1" % ",".join("?" * len(cards))
    return db.execute(q, (today_s + "%", *cards)).fetchone() is not None


def _games_used_today(db, user_id, today_s):
    row = db.execute("SELECT seconds FROM game_time WHERE id=?", (f"{user_id}:{today_s}",)).fetchone()
    return int(row["seconds"]) if row else 0


def games_window(db, user):
    """Режим на сейчас: free (без ограничений), limited (осталось N секунд) или closed (почему и когда откроется)."""
    if user["role"] in GAMES_UNLIMITED_ROLES:
        return {"mode": "free", "reason": "", "remaining": None, "used": 0}
    now = _astana_now()
    t, today_s = now.strftime("%H:%M"), now.date().isoformat()
    limit = GAME_WORK_LIMIT_MIN * 60
    used = _games_used_today(db, user["id"], today_s)
    if not is_workday(now.date()):
        return {"mode": "free", "reason": "Выходной — играйте сколько хотите", "remaining": None, "used": used}
    if t < GAME_FREE_BEFORE:
        early = _came_early_today(db, user, today_s)
        if early is False:
            return {"mode": "closed", "reason": f"До {GAME_FREE_BEFORE} игры открыты тем, кто уже пришёл в офис, — турникет вас ещё не видел",
                    "next": f"после прохода через турникет или с {GAME_FREE_BEFORE} (лимит {GAME_WORK_LIMIT_MIN} минут)", "remaining": None, "used": used}
        return {"mode": "free", "reason": f"До {GAME_FREE_BEFORE} — без ограничений", "remaining": None, "used": used}
    if GAME_LUNCH[0] <= t < GAME_LUNCH[1]:
        return {"mode": "free", "reason": f"Обед {GAME_LUNCH[0]}–{GAME_LUNCH[1]} — без ограничений", "remaining": None, "used": used}
    if t >= GAME_FREE_AFTER:
        return {"mode": "free", "reason": f"После {GAME_FREE_AFTER} — без ограничений", "remaining": None, "used": used}
    remaining = max(0, limit - used)
    nxt = f"с {GAME_LUNCH[0]} до {GAME_LUNCH[1]} и после {GAME_FREE_AFTER}" if t < GAME_LUNCH[0] else f"после {GAME_FREE_AFTER}"
    if remaining <= 0:
        return {"mode": "closed", "reason": f"Лимит {GAME_WORK_LIMIT_MIN} минут на сегодня исчерпан", "next": nxt, "remaining": 0, "used": used}
    return {"mode": "limited", "reason": f"Рабочее время — не больше {GAME_WORK_LIMIT_MIN} минут в день", "next": nxt, "remaining": remaining, "used": used}


def _games_summary(db, user_id):
    total = db.execute("SELECT COALESCE(SUM(points),0) AS p, COUNT(*) AS n FROM game_scores WHERE user_id=?", (user_id,)).fetchone()
    best = {g: 0 for g in GAMES}
    for r in db.execute("SELECT game, MAX(score) AS s FROM game_scores WHERE user_id=? GROUP BY game", (user_id,)):
        best[r["game"]] = int(r["s"] or 0)
    today_s = _astana_today()
    today = db.execute("SELECT COALESCE(SUM(points),0) AS p, COUNT(*) AS n FROM game_scores WHERE user_id=? AND created LIKE ?",
                       (user_id, today_s + "%")).fetchone()
    return {"points": int(total["p"]), "games": int(total["n"]), "best": best, "today_points": int(today["p"]), "today_games": int(today["n"])}


def _games_leaderboard(db, limit=10):
    rows = db.execute("""SELECT s.user_id, u.name, COALESCE(SUM(s.points),0) AS points, COUNT(*) AS games
                         FROM game_scores s LEFT JOIN users u ON u.id = s.user_id
                         GROUP BY s.user_id ORDER BY points DESC, games ASC LIMIT ?""", (limit,)).fetchall()
    return [{"user_id": r["user_id"], "name": r["name"] or "Сотрудник", "points": int(r["points"]), "games": int(r["games"])} for r in rows]


@app.route("/api/games")
def games_status():
    db = get_db()
    user = current_user()
    return jsonify({"games": GAMES, "caps": GAME_POINTS_CAP, "window": games_window(db, user),
                    "me": _games_summary(db, user["id"]), "top": _games_leaderboard(db)})


@app.route("/api/games/tick", methods=["POST"])
def games_tick():
    """Пока игра открыта в рабочее время, фронт раз в полминуты присылает, сколько секунд прошло."""
    db = get_db()
    user = current_user()
    data = request.get_json(silent=True) or {}
    try:
        sec = max(0, min(60, int(data.get("seconds") or 0)))
    except (TypeError, ValueError):
        sec = 0
    w = games_window(db, user)
    if w["mode"] == "limited" and sec:
        today_s = _astana_today()
        key = f"{user['id']}:{today_s}"
        db.execute("INSERT INTO game_time (id, user_id, date, seconds) VALUES (?,?,?,?) "
                   "ON CONFLICT(id) DO UPDATE SET seconds = seconds + excluded.seconds", (key, user["id"], today_s, sec))
        db.commit()
        w = games_window(db, user)
    return jsonify({"window": w})


# Факты программы лояльности для викторины: (вопрос, верный ответ, правдоподобные неверные). Меняешь условия в
# LOYALTY / LOYALTY_KB — поправь и здесь.
QUIZ_FACTS = [
    ("Сколько оплачиваемых дней дополнительного отпуска можно взять по заявлению (свадьба, рождение ребёнка, потеря близкого)?",
     "до 3 дней", ["до 5 дней", "до 2 дней", "до 7 дней"]),
    ("Сколько компания компенсирует за абонемент в спортзал сотруднику со стажем от 1 года?", "50 000 ₸", ["30 000 ₸", "75 000 ₸", "100 000 ₸"]),
    ("Сколько раз в неделю проходят занятия английским с носителем языка?", "3 раза", ["2 раза", "1 раз", "5 раз"]),
    ("Какая материальная помощь положена при потере близких (родители, супруг(а), дети)?", "200 000 ₸",
     ["100 000 ₸", "150 000 ₸", "78 000 ₸"]),
    # семь вопросов про годовой бонус и Community Coins сняты 06.10.2026: обе программы на пересмотре, карточки закрыты
    # как «Скоро» (LOYALTY_SOON в app.js). Вернуть вместе с карточками — с новыми условиями.
]
QUIZ_FACTS += [
    ("Какое корпоративное мероприятие проходит в августе и куда приглашают семьи сотрудников?", "день рождения компании",
     ["Наурыз", "Новый год", "летний тимбилдинг"]),
    ("Сколько Community Coins дают за прочитанную книгу месяца от CEO и сданный тест?", "100 coins", ["50 coins", "70 coins", "150 coins"]),
    ("Какой праздник для компании — «точка перезапуска», когда подводят итоги года?", "Наурыз",
     ["Новый год", "день рождения компании", "день знаний"]),
]
QUIZ_FACT_SHARE = 3        # из десяти вопросов — три о программе лояльности, остальные о коллегах


def _quiz_build(db):
    """Вопросы посложнее (просьба пользователя 24.09.2026): кто чей руководитель, отделы, «кто НЕ работает в…»,
    численность, должности, факты программы лояльности. Неверные варианты — правдоподобные: коллеги из того же
    подразделения, соседние отделы, близкие числа. Ответы остаются на сервере."""
    emps = [dict(r) for r in db.execute("SELECT name, position, department, unit, reports_to, is_head FROM employees WHERE name<>''")]
    names = [e["name"] for e in emps]
    by_dep = {}
    for e in emps:
        by_dep.setdefault(e["department"] or "", []).append(e)
    deps = [d for d in by_dep if d and d != "Без отдела"]
    same = lambda e, key: [x for x in by_dep.get(e["department"] or "", []) if x["name"] != e["name"] and x.get(key)]

    def pick(right, wrong, extra=()):
        wrong = [w for w in dict.fromkeys(list(wrong) + list(extra)) if w and w != right]
        return (right, random.sample(wrong, 3)) if len(wrong) >= 3 else None

    pool = []
    for e in emps:
        # непосредственный руководитель — варианты из того же подразделения
        if e["reports_to"] and e["reports_to"] in names:
            q = pick(e["reports_to"], [x["name"] for x in same(e, "name") if x["name"] != e["reports_to"]], random.sample(names, min(6, len(names))))
            if q: pool.append(("boss", "У кого в подчинении " + e["name"] + "?", *q))
        # отдел внутри подразделения — варианты: другие отделы того же подразделения, потом любые
        if e["unit"]:
            units = {x["unit"] for x in same(e, "unit")} | {x["unit"] for x in emps if x["unit"]}
            q = pick(e["unit"], [u for u in units if u != e["unit"]])
            if q: pool.append(("unit", "В каком отделе работает " + e["name"] + "?", *q))
        # кто занимает должность — только если должность уникальная; варианты из того же подразделения
        if e["position"] and sum(1 for x in emps if x["position"] == e["position"]) == 1:
            q = pick(e["name"], [x["name"] for x in same(e, "name")], random.sample(names, min(6, len(names))))
            if q: pool.append(("pos", "Кто в компании занимает должность «" + e["position"] + "»?", *q))
    for d in deps:
        members = [x["name"] for x in by_dep[d]]
        outside = [n for n in names if n not in members]
        if len(members) >= 3 and outside:
            odd = random.choice(outside)
            ins = random.sample(members, 3)
            pool.append(("odd", "Кто из этих людей НЕ работает в подразделении «" + d + "»?", odd, ins))
        n = len(members)
        if n >= 3:
            q = pick(str(n), [str(n + k) for k in (-3, -2, -1, 1, 2, 3) if n + k > 0])
            if q: pool.append(("count", "Сколько человек работает в подразделении «" + d + "»?", *q))
    # кто руководит отделом (unit): тот, кому подчиняются остальные в отделе
    units = {}
    for e in emps:
        if e["unit"]:
            units.setdefault(e["unit"], []).append(e)
    for u, members in units.items():
        bosses = [m["reports_to"] for m in members if m["reports_to"]]
        lead = max(set(bosses), key=bosses.count) if bosses else None
        if lead and bosses.count(lead) >= 2:
            dep_names = [x["name"] for x in by_dep.get(members[0]["department"] or "", [])]
            q = pick(lead, [n for n in dep_names if n != lead], random.sample(names, min(6, len(names))))
            if q: pool.append(("lead", "Кто возглавляет «" + u + "»?", *q))
    # виды вопросов чередуем по кругу — иначе половина была бы «кто руководитель», их в справочнике больше всего
    kinds = {}
    for kind, *rest in pool:
        kinds.setdefault(kind, []).append(tuple(rest))
    for lst in kinds.values():
        random.shuffle(lst)
    order = list(kinds)
    random.shuffle(order)
    facts = [(t, r, random.sample(w, 3)) for t, r, w in random.sample(QUIZ_FACTS, min(QUIZ_FACT_SHARE, len(QUIZ_FACTS)))]
    people = []
    while len(people) < QUIZ_QUESTIONS - len(facts) and any(kinds.values()):
        for k in order:
            if kinds[k] and len(people) < QUIZ_QUESTIONS - len(facts):
                people.append(kinds[k].pop())
    chosen = people + facts
    random.shuffle(chosen)
    out = []
    for text, right, wrong in chosen:
        opts = list(wrong) + [right]
        random.shuffle(opts)
        out.append({"text": text, "options": opts, "answer": opts.index(right)})
    return out


@app.route("/api/games/quiz")
def games_quiz():
    db = get_db()
    user = current_user()
    if games_window(db, user)["mode"] == "closed":
        return jsonify({"error": "Сейчас игры закрыты."}), 403
    qs = _quiz_build(db)
    if len(qs) < 4:
        return jsonify({"error": "В справочнике пока мало данных для викторины."}), 400
    now = datetime.utcnow()
    for k in [k for k, v in _quiz_sessions.items() if v["expires"] < now]:
        _quiz_sessions.pop(k, None)
    qid = uuid.uuid4().hex
    _quiz_sessions[qid] = {"user": user["id"], "answers": [q["answer"] for q in qs], "chosen": {}, "expires": now + timedelta(minutes=30)}
    return jsonify({"qid": qid, "questions": [{"text": q["text"], "options": q["options"]} for q in qs]})


@app.route("/api/games/quiz/answer", methods=["POST"])
def games_quiz_answer():
    """Ответ на один вопрос: сервер запоминает первый выбор (переответить нельзя) и сразу говорит, какой вариант верный —
    фронт подсвечивает ошибку и правильный ответ до перехода к следующему вопросу (24.09.2026)."""
    data = request.get_json(silent=True) or {}
    sess = _quiz_sessions.get(str(data.get("qid") or ""))
    if not sess or sess["user"] != current_user()["id"]:
        return jsonify({"error": "Викторина не найдена."}), 400
    try:
        i, choice = int(data.get("index")), int(data.get("choice"))
    except (TypeError, ValueError):
        return jsonify({"error": "Неверный запрос."}), 400
    if not 0 <= i < len(sess["answers"]):
        return jsonify({"error": "Нет такого вопроса."}), 400
    sess["chosen"].setdefault(i, choice)
    right = sess["answers"][i]
    return jsonify({"correct": sess["chosen"][i] == right, "answer": right})


@app.route("/api/games/score", methods=["POST"])
def games_score():
    """Партия сыграна: сервер сам считает баллы по правилам игры и потолкам, фронту верит только в пределах разумного."""
    db = get_db()
    user = current_user()
    data = request.get_json(silent=True) or {}
    game = str(data.get("game") or "")
    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    if game not in GAMES:
        return jsonify({"error": "Неизвестная игра."}), 400
    w = games_window(db, user)
    if w["mode"] == "closed":
        return jsonify({"error": "Сейчас игры закрыты: " + w["reason"] + "."}), 403
    summary = _games_summary(db, user["id"])
    if summary["today_games"] >= GAME_DAILY_GAMES:
        return jsonify({"error": f"На сегодня достаточно — {GAME_DAILY_GAMES} партий с баллами уже сыграно."}), 429

    def num(k, lo, hi):
        try:
            return max(lo, min(hi, float(meta.get(k) or 0)))
        except (TypeError, ValueError):
            return lo

    score, points, extra = 0, 0, {}
    if game == "snake":
        score = int(num("apples", 0, 200))
        if num("seconds", 0, 3600) < score * 0.6:      # яблоко быстрее чем за ~0,6 с — не бывает
            return jsonify({"error": "Результат не принят."}), 400
        points = min(GAME_POINTS_CAP["snake"], score)
    elif game == "mines":
        won = bool(meta.get("won"))
        secs = num("seconds", 0, 3600)
        score = int(num("opened", 0, 81))
        if won and secs < 5:
            return jsonify({"error": "Результат не принят."}), 400
        points = GAME_POINTS_CAP["mines"] if won else min(5, score // 10)
        extra = {"won": won}
    elif game == "quiz":
        sess = _quiz_sessions.pop(str(meta.get("qid") or ""), None)
        if not sess or sess["user"] != user["id"]:
            return jsonify({"error": "Викторина не найдена или уже сдана."}), 400
        # считаем по ответам, записанным сервером в /api/games/quiz/answer (фронту не верим)
        score = sum(1 for i, a in enumerate(sess["answers"]) if sess.get("chosen", {}).get(i) == a)
        points = min(GAME_POINTS_CAP["quiz"], score * 3)
        extra = {"correct": score, "total": len(sess["answers"])}
    elif game == "typing":
        chars, secs, acc = num("chars", 0, 2000), num("seconds", 1, 1800), num("accuracy", 0, 1)
        if secs < 10 or chars < 40:
            return jsonify({"error": "Слишком короткий текст, чтобы засчитать."}), 400
        wpm = chars / 5 / (secs / 60)
        if wpm > 160:
            return jsonify({"error": "Результат не принят."}), 400
        score = int(round(wpm))
        points = min(GAME_POINTS_CAP["typing"], int(round(wpm / 4))) if acc >= 0.9 else 0
        extra = {"wpm": score, "accuracy": round(acc, 2)}
    db.execute("INSERT INTO game_scores (id, user_id, game, score, points, created) VALUES (?,?,?,?,?,?)",
               (uuid.uuid4().hex, user["id"], game, score, points, _astana_now().isoformat(timespec="seconds")))
    db.commit()
    return jsonify({"ok": True, "score": score, "points": points, **extra,
                    "me": _games_summary(db, user["id"]), "window": games_window(db, user)})


def _current_announcement():
    """Действующее объявление или None. Просроченное («показывать до») считается снятым."""
    raw = _setting("announcement")
    if not raw:
        return None
    try:
        a = json.loads(raw)
    except ValueError:
        return None
    if not a.get("text") or (a.get("until") and a["until"] < _astana_today()):
        return None
    return a


# ---------- табель посещаемости ----------
# Как в таблице HR: строки — сотрудники справочника, столбцы — дни месяца, в ячейке код отклонения.
ATTENDANCE_CODES = {
    # «Выезд на объект» (О) и «Выезд по работе» (З) объединены в одну отметку 06.10.2026 (слова пользователя: «это одно
    # и то же, надо объединить и назвать одним»; название выбрал он). Прежние «О» переводятся в «З» — ATTENDANCE_ALIASES.
    "З": "Выезд по работе", "У": "Работаю онлайн", "Б": "Официальный больничный",
    "К": "Командировка", "Т": "Трудовой отпуск", "БС": "Отпуск без сохранения ЗП",
    "Л": "Отпросился по личным обстоятельствам",
}
EMPLOYEE_MARK_PAST_DAYS = 7     # сотрудник сам правит неделю назад и неделю вперёд (25.09.2026, было 14); HR — без ограничений
EMPLOYEE_MARK_FUTURE_DAYS = 7
ENGLISH_MARK_PAST_DAYS = 14     # отметка на английском — две недели назад, как было


def _my_employee(db, user):
    """Строка справочника для учётки: по почте, иначе по имени."""
    email = (user.get("email") or db.execute("SELECT email FROM users WHERE id=?", (user["id"],)).fetchone()["email"] or "").lower()
    row = None
    if email:
        row = db.execute("SELECT * FROM employees WHERE lower(email)=?", (email,)).fetchone()
    if row is None and user.get("name"):
        # сравниваем в Python: lower() в SQLite кириллицу не сворачивает, и «Туреханова Асель» не находилась
        want = user["name"].strip().lower()
        row = next((r for r in db.execute("SELECT * FROM employees") if (r["name"] or "").strip().lower() == want), None)
    return row


# Трудовой отпуск по ТК РК — 24 календарных дня за отработанный год (2 дня за месяц).
# Остаток дней пока ведёт HR вручную: истории отпусков за прошлые годы в портале нет,
# поэтому раздел «Мой отпуск» показывает только то, что отмечено в табеле, и даёт задать вопрос HR.
VACATION_NORM_DAYS = 24


OFFICES = ["Астана", "Алматы"]        # офисы компании


def _plan_rooms(raw):
    """Подписи помещений: «Бухгалтерия», «Кофейня», «Стол 3»."""
    out = []
    for r in (raw or [])[:200]:
        label = str(r.get("label") or "").strip()[:60]
        try:
            x, y = float(r.get("x")), float(r.get("y"))
        except (TypeError, ValueError):
            continue
        if label and 0 <= x <= 100 and 0 <= y <= 100:
            out.append({"label": label, "x": round(x, 2), "y": round(y, 2)})
    return out


def _plan_areas(raw):
    """Области общего плана, по которым «проваливаются» в схему отдела: {zone, x, y, w, h} в процентах."""
    out = []
    for a in (raw or [])[:50]:
        zone = str(a.get("zone") or "").strip()[:60]
        try:
            x, y, w, h = (float(a.get(k)) for k in ("x", "y", "w", "h"))
        except (TypeError, ValueError):
            continue
        if zone and 0 <= x <= 100 and 0 <= y <= 100 and 0 < w <= 100 and 0 < h <= 100:
            out.append({"zone": zone, "x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2)})
    return out


def _plan_marks(raw):
    """Люди на схеме: кто где сидит."""
    out = []
    for m in (raw or [])[:300]:
        try:
            x, y = float(m.get("x")), float(m.get("y"))
        except (TypeError, ValueError):
            continue
        if m.get("id") and 0 <= x <= 100 and 0 <= y <= 100:
            out.append({"id": str(m["id"])[:40], "x": round(x, 2), "y": round(y, 2)})
    return out


@app.route("/api/office-plans", methods=["GET", "POST"])
def office_plans():
    """Схемы офиса и расставленные на них люди. Картинки рисует и загружает админ или HR,
    метки (кто где сидит) они же расставляют кликом по схеме; координаты — в процентах,
    чтобы подписи не разъезжались на другом экране.
    У офиса есть общий план этажа и отдельные схемы отделов (`zones`) — по одной на комнату,
    там уже столы и кто за каким сидит."""
    db = get_db()
    try:
        plans = json.loads(_setting("office_plans") or "{}")
    except ValueError:
        plans = {}
    if request.method == "GET":
        return jsonify({"offices": OFFICES, "plans": plans})

    if current_user()["role"] != "admin":     # схемы меняет только админ (решение пользователя 22.09.2026), остальным — просмотр
        return jsonify({"error": "Менять схемы офиса может только администратор."}), 403
    data = request.get_json(silent=True) or {}
    office = (data.get("office") or "").strip()
    if office not in OFFICES:
        return jsonify({"error": "Неизвестный офис."}), 400
    plan = dict(plans.get(office) or {})
    zones = list(plan.get("zones") or [])

    def save():
        plan["zones"] = zones
        plan["updated"] = datetime.now().isoformat(timespec="seconds")
        plans[office] = plan
        _set_setting("office_plans", json.dumps(plans, ensure_ascii=False))
        return jsonify({"offices": OFFICES, "plans": plans})

    # новая схема отдела: «Технический отдел», «Бухгалтерия» — со своей картинкой
    if data.get("newZone"):
        name = str(data["newZone"]).strip()[:60]
        url = (data.get("url") or "").strip()
        if not name or not url:
            return jsonify({"error": "Нужны название отдела и картинка схемы."}), 400
        zones.append({"name": name, "url": url, "rooms": [], "marks": []})
        return save()

    zi = data.get("zone")
    if zi is not None:                   # правим схему отдела, а не общий план этажа
        try:
            zi = int(zi)
        except (TypeError, ValueError):
            return jsonify({"error": "Неизвестная схема."}), 400
        if not 0 <= zi < len(zones):
            return jsonify({"error": "Неизвестная схема."}), 400
        if data.get("remove"):
            zones.pop(zi)
            return save()
        z = dict(zones[zi])
        if data.get("rename"):
            z["name"] = str(data["rename"]).strip()[:60] or z["name"]
        if "url" in data and (data.get("url") or "").strip():
            z["url"] = data["url"].strip()
        if "rooms" in data:
            z["rooms"] = _plan_rooms(data.get("rooms"))
        if "marks" in data:
            z["marks"] = _plan_marks(data.get("marks"))
        zones[zi] = z
        return save()

    if "url" in data:
        url = (data.get("url") or "").strip()
        if not url:                  # убрали общий план — его метки и подписи тоже; схемы отделов остаются
            if not zones:
                plans.pop(office, None)
                _set_setting("office_plans", json.dumps(plans, ensure_ascii=False))
                return jsonify({"offices": OFFICES, "plans": plans})
            for k in ("url", "rooms", "marks", "areas"):
                plan.pop(k, None)
            return save()
        plan["url"] = url
    if "rooms" in data:
        plan["rooms"] = _plan_rooms(data.get("rooms"))
    if "marks" in data:
        plan["marks"] = _plan_marks(data.get("marks"))
    if "areas" in data:
        plan["areas"] = _plan_areas(data.get("areas"))
    return save()


@app.route("/api/vacation")
def vacation_summary():
    """Личная справка: сколько дней отпуска отмечено в табеле за год. Только про себя."""
    db = get_db()
    me = _my_employee(db, current_user())
    year = request.args.get("year") or _astana_today()[:4]
    if not re.fullmatch(r"\d{4}", year):
        return jsonify({"error": "Год в формате ГГГГ."}), 400
    out = {"year": year, "norm": VACATION_NORM_DAYS, "found": me is not None,
           "periods": [], "used": 0, "unpaid": 0}
    if me is None:
        return jsonify(out)
    rows = db.execute(
        "SELECT date, code, comment FROM attendance WHERE employee_id=? AND date LIKE ? "
        "AND code IN ('Т','БС') ORDER BY date",
        (me["id"], year + "-%"),
    ).fetchall()
    for r in rows:                       # подряд идущие дни с одним кодом собираем в период
        last = out["periods"][-1] if out["periods"] else None
        if last and last["code"] == r["code"] and \
                date.fromisoformat(last["end"]) + timedelta(days=1) == date.fromisoformat(r["date"]):
            last["end"] = r["date"]
            last["days"] += 1
        else:
            out["periods"].append({"code": r["code"], "start": r["date"], "end": r["date"], "days": 1})
    out["used"] = sum(p["days"] for p in out["periods"] if p["code"] == "Т")
    out["unpaid"] = sum(p["days"] for p in out["periods"] if p["code"] == "БС")
    out["periods"].reverse()             # свежие сверху
    return jsonify(out)


@app.route("/api/attendance", methods=["GET", "PUT"])
def attendance():
    db = get_db()
    user = current_user()
    staff = user["role"] in ("admin", "hr")
    if request.method == "GET":
        month = request.args.get("month") or _astana_today()[:7]
        if not re.fullmatch(r"\d{4}-\d{2}", month):
            return jsonify({"error": "Месяц в формате ГГГГ-ММ."}), 400
        if staff:
            emps = db.execute("SELECT id, name, position, department, schedule, email FROM employees ORDER BY name").fetchall()
        else:
            me = _my_employee(db, user)
            emps = [me] if me else []
        ids = [e["id"] for e in emps]
        marks = {}
        if ids:
            q = f"SELECT * FROM attendance WHERE date LIKE ? AND employee_id IN ({','.join('?' * len(ids))})"
            for r in db.execute(q, (month + "-%", *ids)).fetchall():
                marks.setdefault(r["employee_id"], {})[r["date"]] = {"code": r["code"], "comment": r["comment"] or ""}
        return jsonify({
            # коды — списком пар: jsonify сортирует ключи словаря, а порядок легенды важен
            "month": month, "codes": list(ATTENDANCE_CODES.items()), "staff": staff, "today": _astana_today(),
            "employees": [{"id": e["id"], "name": e["name"], "position": e["position"] or "", "department": e["department"],
                           "schedule": e["schedule"] or ""} for e in emps],
            "marks": marks,
            "can_edit_from": None if staff else (date.fromisoformat(_astana_today()) - timedelta(days=EMPLOYEE_MARK_PAST_DAYS)).isoformat(),
            "can_edit_to": None if staff else (date.fromisoformat(_astana_today()) + timedelta(days=EMPLOYEE_MARK_FUTURE_DAYS)).isoformat(),
        })

    data = request.get_json(silent=True) or {}
    emp_id, day = data.get("employee_id"), data.get("date") or ""
    code = (data.get("code") or "").strip().upper()
    comment = (data.get("comment") or "").strip()[:300]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return jsonify({"error": "Дата в формате ГГГГ-ММ-ДД."}), 400
    code = ATTENDANCE_ALIASES.get(code, code)
    if code and code not in ATTENDANCE_CODES:
        return jsonify({"error": "Неизвестное обозначение."}), 400
    if not staff:
        me = _my_employee(db, user)
        if me is None or me["id"] != emp_id:
            return jsonify({"error": "Отметку можно ставить только себе."}), 403
        today = date.fromisoformat(_astana_today())
        try:
            d = date.fromisoformat(day)
        except ValueError:          # «2026-13-45» проходит маску, но такой даты нет — 400, а не 500 (аудит 25.09.2026)
            return jsonify({"error": "Такой даты нет."}), 400
        if not (today - timedelta(days=EMPLOYEE_MARK_PAST_DAYS) <= d <= today + timedelta(days=EMPLOYEE_MARK_FUTURE_DAYS)):
            return jsonify({"error": "Так далеко отметку может поставить только HR."}), 400
    elif not db.execute("SELECT 1 FROM employees WHERE id=?", (emp_id,)).fetchone():
        return jsonify({"error": "Сотрудник не найден."}), 404
    now = datetime.now().isoformat(timespec="seconds")
    db.execute("DELETE FROM attendance WHERE employee_id=? AND date=?", (emp_id, day))
    if code:
        db.execute("INSERT INTO attendance (id, employee_id, date, code, comment, set_by, updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (uuid.uuid4().hex, emp_id, day, code, comment, user["id"], now))
    db.commit()
    return jsonify({"employee_id": emp_id, "date": day, "code": code, "comment": comment})


# ---------- английский с носителем: табель посещения (24.09.2026) ----------
# Участники — employees.english. Дни занятий HR выставляет сама (settings.english_days, 0 = пн … 6 = вс).
ENGLISH_DAYS_DEFAULT = [0, 2, 4]          # пн, ср, пт — пока HR не выставила свои
ENGLISH_STATUSES = {"yes": "Был", "no": "Не был"}


def _english_days():
    try:
        days = json.loads(_setting("english_days") or "null")
    except ValueError:
        days = None
    return sorted({int(x) for x in days if str(x).isdigit() and 0 <= int(x) <= 6}) if days else list(ENGLISH_DAYS_DEFAULT)


@app.route("/api/english", methods=["GET", "PUT"])
def english_attendance():
    db = get_db()
    user = current_user()
    staff = user["role"] in ("admin", "hr")
    me = _my_employee(db, user)
    if request.method == "GET":
        month = request.args.get("month") or _astana_today()[:7]
        if not re.fullmatch(r"\d{4}-\d{2}", month):
            return jsonify({"error": "Месяц в формате ГГГГ-ММ."}), 400
        if staff:
            emps = db.execute("SELECT id, name, position, department FROM employees WHERE english=1 ORDER BY name").fetchall()
        else:
            emps = [me] if me is not None and me["english"] else []
        wd = _english_days()
        y, m = map(int, month.split("-"))
        first = date(y, m, 1)
        days = [(first + timedelta(days=i)).isoformat() for i in range(31)
                if (first + timedelta(days=i)).month == m and (first + timedelta(days=i)).weekday() in wd]
        ids = [e["id"] for e in emps]
        marks = {}
        if ids:
            q = f"SELECT * FROM english_att WHERE date LIKE ? AND employee_id IN ({','.join('?' * len(ids))})"
            for r in db.execute(q, (month + "-%", *ids)).fetchall():
                marks.setdefault(r["employee_id"], {})[r["date"]] = {"status": r["status"], "comment": r["comment"] or ""}
        return jsonify({
            "month": month, "today": _astana_today(), "staff": staff, "weekdays": wd, "days": days,
            "participant": bool(me is not None and me["english"]),
            "employees": [{"id": e["id"], "name": e["name"], "position": e["position"] or "", "department": e["department"] or ""}
                          for e in emps],
            "marks": marks,
            "can_edit_from": None if staff else (date.fromisoformat(_astana_today()) - timedelta(days=ENGLISH_MARK_PAST_DAYS)).isoformat(),
        })

    data = request.get_json(silent=True) or {}
    emp_id, day = data.get("employee_id"), data.get("date") or ""
    status = (data.get("status") or "").strip()
    comment = (data.get("comment") or "").strip()[:300]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return jsonify({"error": "Дата в формате ГГГГ-ММ-ДД."}), 400
    if status and status not in ENGLISH_STATUSES:
        return jsonify({"error": "Отметка — «был» или «не был»."}), 400
    emp = db.execute("SELECT id, english FROM employees WHERE id=?", (emp_id,)).fetchone()
    if emp is None or not emp["english"]:
        return jsonify({"error": "Этот сотрудник не записан на английский."}), 404
    if not staff:
        if me is None or me["id"] != emp_id:
            return jsonify({"error": "Отметку можно ставить только себе."}), 403
        today = date.fromisoformat(_astana_today())
        try:
            d = date.fromisoformat(day)
        except ValueError:          # «2026-13-45» проходит маску, но такой даты нет — 400, а не 500 (аудит 25.09.2026)
            return jsonify({"error": "Такой даты нет."}), 400
        if d > today:
            return jsonify({"error": "Отметить можно только прошедшее занятие."}), 400
        if d < today - timedelta(days=ENGLISH_MARK_PAST_DAYS):
            return jsonify({"error": "Так давно отметку может поставить только HR."}), 400
        if d.weekday() not in _english_days():
            return jsonify({"error": "В этот день занятия нет."}), 400
    now = datetime.now().isoformat(timespec="seconds")
    db.execute("DELETE FROM english_att WHERE employee_id=? AND date=?", (emp_id, day))
    if status:
        db.execute("INSERT INTO english_att (id, employee_id, date, status, comment, set_by, updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (uuid.uuid4().hex, emp_id, day, status, comment, user["id"], now))
    db.commit()
    return jsonify({"employee_id": emp_id, "date": day, "status": status, "comment": comment})


@app.route("/api/hr/english-days", methods=["PUT"])
def english_days_set():
    """Дни занятий английским — HR и админ."""
    days = (request.get_json(silent=True) or {}).get("days") or []
    days = sorted({int(x) for x in days if str(x).isdigit() and 0 <= int(x) <= 6})
    if not days:
        return jsonify({"error": "Отметьте хотя бы один день."}), 400
    _set_setting("english_days", json.dumps(days))
    return jsonify({"weekdays": days})


@app.route("/api/announcement", methods=["GET"])
def announcement_get():
    """Объявление видят все вошедшие сотрудники."""
    return jsonify(_current_announcement() or {})


@app.route("/api/hr/announcement", methods=["PUT", "DELETE"])
def announcement_set():
    """Поставить или снять объявление — HR и админ (префикс /api/hr/ закрыт для остальных)."""
    if request.method == "DELETE":
        _set_setting("announcement", "")
        return jsonify({})
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Напишите текст объявления."}), 400
    if len(text) > 300:
        return jsonify({"error": "Объявление должно быть коротким — до 300 символов. Подробности лучше вынести в новость."}), 400
    until = (data.get("until") or "").strip()
    if until and (not re.fullmatch(r"\d{4}-\d{2}-\d{2}", until) or until < _astana_today()):
        return jsonify({"error": "Дата «показывать до» должна быть сегодня или позже."}), 400
    user = current_user()
    a = {
        "text": text,
        "important": bool(data.get("important")),
        "until": until,
        "author": user["name"] or user["login"],
        "created": datetime.now().isoformat(timespec="seconds"),
    }
    _set_setting("announcement", json.dumps(a, ensure_ascii=False))
    return jsonify(a)


# ---------- книга месяца от CEO (главная, под «Моими заявками»; 24.09.2026) ----------
def _current_book():
    try:
        return json.loads(_setting("book_of_month") or "{}") or {}
    except ValueError:
        return {}


@app.route("/api/book", methods=["GET"])
def book_get():
    """Книгу месяца видят все вошедшие."""
    return jsonify(_current_book())


@app.route("/api/hr/book", methods=["PUT", "DELETE"])
def book_set():
    """Поставить или снять книгу месяца — HR и админ (префикс /api/hr/ закрыт для остальных)."""
    if request.method == "DELETE":
        _set_setting("book_of_month", "")
        return jsonify({})
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Укажите название книги."}), 400
    user = current_user()
    b = {
        "title": title[:200],
        "author": (data.get("author") or "").strip()[:200],
        "note": (data.get("note") or "").strip()[:1500],
        "cover": _clean_url(data.get("cover")),
        "by": user["name"] or user["login"],
        "updated": datetime.now().isoformat(timespec="seconds"),
    }
    _set_setting("book_of_month", json.dumps(b, ensure_ascii=False))
    return jsonify(b)


# ---------- опоздания: проходы elpass × график × отметки табеля ----------
LATE_GRACE_MIN = 15                  # столько минут после начала графика — ещё не опоздание
DEFAULT_SCHEDULE = "09:00-18:00"     # если график в карточке не указан
WORKDAYS = {0, 1, 2, 3, 4}           # пн–пт; суббота и воскресенье не считаются

# Праздники Республики Казахстан (07.10.2026, слова пользователя: «вшей праздники в календарь портала согласно постановлению РК»).
# 2026 — по графику праздничных и выходных дней, опубликованному на egov.kz (переносы постановлением правительства);
# 2027 — только даты из Закона «О праздниках» и перенос за 2 января; остальные переносы и дата Курбан-айта — после
# постановления (хвост). Ключ — дата, значение — название; перенесённый выходной подписан словом «перенос».
HOLIDAYS_KZ = {
    "2026-01-01": "Новый год", "2026-01-02": "Новый год", "2026-01-07": "Рождество Христово",
    "2026-03-08": "Международный женский день", "2026-03-09": "Выходной за 8 марта (перенос)",
    "2026-03-21": "Наурыз мейрамы", "2026-03-22": "Наурыз мейрамы", "2026-03-23": "Наурыз мейрамы",
    "2026-03-24": "Выходной за 21 марта (перенос)", "2026-03-25": "Выходной за 22 марта (перенос)",
    "2026-05-01": "Праздник единства народа Казахстана", "2026-05-07": "День защитника Отечества",
    "2026-05-09": "День Победы", "2026-05-11": "Выходной за 9 мая (перенос)", "2026-05-27": "Курбан-айт",
    "2026-07-06": "День столицы", "2026-08-30": "День Конституции", "2026-08-31": "Выходной за 30 августа (перенос)",
    "2026-10-25": "День Республики", "2026-10-26": "Выходной за 25 октября (перенос)", "2026-12-16": "День Независимости",
    "2027-01-01": "Новый год", "2027-01-02": "Новый год", "2027-01-04": "Выходной за 2 января (перенос)",
    "2027-01-07": "Рождество Христово", "2027-03-08": "Международный женский день",
    "2027-03-21": "Наурыз мейрамы", "2027-03-22": "Наурыз мейрамы", "2027-03-23": "Наурыз мейрамы",
    "2027-05-01": "Праздник единства народа Казахстана", "2027-05-07": "День защитника Отечества", "2027-05-09": "День Победы",
    "2027-07-06": "День столицы", "2027-08-30": "День Конституции", "2027-10-25": "День Республики", "2027-12-16": "День Независимости",
}


def is_workday(d):
    """Рабочий день: пн–пт и не праздник (и не перенесённый выходной) из HOLIDAYS_KZ."""
    return d.weekday() in WORKDAYS and d.isoformat() not in HOLIDAYS_KZ


def holiday_events():
    """Праздники для календаря портала — как события вида holiday; удалить их нельзя, они не в базе."""
    out = []
    for day, name in sorted(HOLIDAYS_KZ.items()):
        out.append({"id": "holiday-" + day, "title": name, "date": day, "type": "holiday",
                    "description": "Перенесённый выходной день" if "перенос" in name else "Государственный праздник Республики Казахстан. Выходной день."})
    return out


def _schedule_start(schedule):
    """«09:00-18:00» → «09:00»; мусор → начало графика по умолчанию."""
    m = re.match(r"\s*(\d{1,2}):(\d{2})", schedule or "")
    if not m:
        m = re.match(r"(\d{2}):(\d{2})", DEFAULT_SCHEDULE)
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def compute_lateness(db, start, end):
    """За каждый рабочий день недели (до сегодняшнего включительно): первый вход каждого сотрудника с ID elpass.
    Пришёл позже начала графика + допуск → опоздание; если в табеле на этот день есть отметка — оправдано."""
    today = date.fromisoformat(_astana_today())
    emps = db.execute("SELECT id, name, position, department, schedule, elpass_id, remote FROM employees "
                      "WHERE remote=0 ORDER BY name").fetchall()
    remote_names = [r["name"] for r in db.execute("SELECT name FROM employees WHERE remote=1 ORDER BY name")]
    mapped = [e for e in emps if (e["elpass_id"] or "").strip()]
    first_in = {}   # (employee_id, date) -> ts
    for r in db.execute("SELECT employee_id, ts, object FROM passes WHERE direction='in' AND employee_id IS NOT NULL "
                        "AND ts >= ? AND ts < ? ORDER BY ts",
                        (start.isoformat(), (end + timedelta(days=1)).isoformat())):
        first_in.setdefault((r["employee_id"], r["ts"][:10]), (r["ts"], r["object"] or ""))
    marks = {(r["employee_id"], r["date"]): {"code": r["code"], "comment": r["comment"] or ""}
             for r in db.execute("SELECT employee_id, date, code, comment FROM attendance WHERE date BETWEEN ? AND ?",
                                 (start.isoformat(), end.isoformat()))}
    late, excused = [], []
    d = start
    while d <= min(end, today):
        if is_workday(d):
            for e in mapped:
                got = first_in.get((e["id"], d.isoformat()))
                ts, obj = got if got else (None, "")
                if not ts:
                    continue   # прохода нет: отпуск, больничный, забыл карту — это не опоздание, а тема для отметки в табеле
                sched = _schedule_start(e["schedule"])
                h, mnt = map(int, sched.split(":"))
                limit = datetime.combine(d, datetime.min.time()).replace(hour=h, minute=mnt) + timedelta(minutes=LATE_GRACE_MIN)
                arrived = datetime.fromisoformat(ts)
                if arrived <= limit:
                    continue
                item = {"employee_id": e["id"], "name": e["name"], "position": e["position"] or "", "department": e["department"],
                        "date": d.isoformat(), "schedule": sched, "arrived": arrived.strftime("%H:%M"),
                        "office": ELPASS_LABELS.get(obj, obj or ""),
                        "late_min": int((arrived - limit).total_seconds() // 60) + LATE_GRACE_MIN}
                mk = marks.get((e["id"], d.isoformat()))
                if mk:
                    item["excuse"] = mk
                    excused.append(item)
                else:
                    late.append(item)
        d += timedelta(days=1)
    has_passes = db.execute("SELECT 1 FROM passes LIMIT 1").fetchone() is not None
    return {"late": late, "excused": excused, "mapped": len(mapped), "unmapped": len(emps) - len(mapped),
            "mapped_names": [e["name"] for e in mapped], "unmapped_names": [e["name"] for e in emps if e not in mapped],
            "remote_names": remote_names,
            "has_passes": has_passes, "grace": LATE_GRACE_MIN}


EARLY_TOP = 3            # сколько человек показывать в топе ранних приходов (по каждому офису)
EARLY_MIN_DAYS = 3       # меньше трёх дней в офисе — в топ не берём, статистика не показательная


def compute_early(db, start, end, top=EARLY_TOP):
    """Кто приходит раньше графика. Берём только тех, кто за неделю ни разу не опоздал,
    и был минимум EARLY_MIN_DAYS рабочих дней. Сортировка — по среднему запасу до начала графика."""
    today = date.fromisoformat(_astana_today())
    emps = {e["id"]: e for e in db.execute(
        "SELECT id, name, position, department, schedule FROM employees WHERE elpass_id<>'' AND remote=0")}
    first = {}
    for r in db.execute("SELECT employee_id, ts, object FROM passes WHERE direction='in' AND employee_id IS NOT NULL "
                        "AND ts >= ? AND ts < ? ORDER BY ts",
                        (start.isoformat(), (end + timedelta(days=1)).isoformat())):
        first.setdefault((r["employee_id"], r["ts"][:10]), (r["ts"], r["object"] or ""))
    by_person = {}
    for (eid, d), (ts, obj) in first.items():
        day = date.fromisoformat(d)
        if not is_workday(day) or day > today:
            continue
        e = emps.get(eid)
        if not e:
            continue
        h, mnt = map(int, _schedule_start(e["schedule"]).split(":"))
        limit = datetime.combine(day, datetime.min.time()).replace(hour=h, minute=mnt)
        ahead = int((limit - datetime.fromisoformat(ts)).total_seconds() // 60)
        by_person.setdefault(e["name"], {"name": e["name"], "position": e["position"] or e["department"],
                                         "offices": {}, "days": []})
        by_person[e["name"]]["days"].append({"date": d, "arrived": ts[11:16], "ahead": ahead})
        office = ELPASS_LABELS.get(obj, obj or "")
        by_person[e["name"]]["offices"][office] = by_person[e["name"]]["offices"].get(office, 0) + 1
    out = []
    for p in by_person.values():
        if len(p["days"]) < EARLY_MIN_DAYS or any(d["ahead"] < -LATE_GRACE_MIN for d in p["days"]):
            continue        # опаздывал на этой неделе — в топ ранних не попадает
        p["avg_ahead"] = round(sum(d["ahead"] for d in p["days"]) / len(p["days"]))
        p["earliest"] = min(d["arrived"] for d in p["days"])
        p["office"] = max(p["offices"], key=p["offices"].get) if p["offices"] else ""   # где чаще проходил
        if p["avg_ahead"] > 0:
            out.append(p)
    out.sort(key=lambda x: (-x["avg_ahead"], x["name"]))
    return out[:top]


# Кого не упоминать в понедельничном письме и тексте для Telegram совсем (ни в опозданиях, ни в пунктуальных,
# ни в «удалённо» / «нет в турникете»). Просьба пользователя 28.09.2026: его самого. В админ-панели и кабинете
# руководителя эти люди остаются — фильтр только для письма. Имена — как в справочнике, регистр не важен.
LATE_REPORT_EXCLUDE = {"абдуллаев темирлан"}


def _report_skip(name):
    return (name or "").strip().lower() in LATE_REPORT_EXCLUDE


def _for_report(r):
    """Результат compute_lateness без людей из LATE_REPORT_EXCLUDE — для письма и поста в Telegram."""
    r = dict(r)
    for k in ("late", "excused"):
        r[k] = [x for x in r[k] if not _report_skip(x["name"])]
    for k in ("mapped_names", "unmapped_names", "remote_names"):
        r[k] = [n for n in r.get(k, []) if not _report_skip(n)]
    r["mapped"], r["unmapped"] = len(r["mapped_names"]), len(r["unmapped_names"])
    return r


def early_top_by_office(db, start, end, top=EARLY_TOP, report=False):
    """Пунктуальные отдельно по офисам: Астана и Алматы. report=True — без LATE_REPORT_EXCLUDE (для письма)."""
    by = {}
    for p in compute_early(db, start, end, top=999):
        if report and _report_skip(p["name"]):
            continue
        by.setdefault(p["office"] or "Другой офис", []).append(p)
    out = []
    for office in sorted(by, key=lambda o: (o != "Астана", o != "Алматы", o)):
        out.append({"office": office, "people": by[office][:top]})
    return out


def _week_bounds(start_s):
    """Рабочая неделя: понедельник — пятница. Суббота и воскресенье в опозданиях не участвуют."""
    today = date.fromisoformat(_astana_today())
    start = date.fromisoformat(start_s) if start_s else today
    start -= timedelta(days=start.weekday())
    return start, start + timedelta(days=4)


@app.route("/api/hr/lateness", methods=["GET"])
def hr_lateness():
    start_s = request.args.get("start") or ""
    if start_s and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start_s):
        return jsonify({"error": "Дата в формате ГГГГ-ММ-ДД."}), 400
    start, end = _week_bounds(start_s)
    out = compute_lateness(get_db(), start, end)
    out.update({"start": start.isoformat(), "end": end.isoformat(), "today": _astana_today(), "codes": list(ATTENDANCE_CODES.items())})
    return jsonify(out)


def employee_by_card(db):
    """Карточка elpass → сотрудник. У человека может быть несколько карточек (по одной на офис)."""
    out = {}
    for r in db.execute("SELECT id, elpass_id FROM employees WHERE elpass_id<>''"):
        for card in (r["elpass_id"] or "").split(","):
            card = card.strip()
            if card:
                out[card] = r["id"]
    return out


def import_passes(db, events):
    """Кладёт события проходов в базу. events: [{elpass_id, ts, direction, point}]. Повторы не дублируются."""
    by_elpass = employee_by_card(db)
    added = skipped = 0
    for ev in events:
        eid, ts, direction = str(ev.get("elpass_id") or "").strip(), str(ev.get("ts") or "").strip()[:19], str(ev.get("direction") or "in").lower()
        if not eid or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?", ts) or direction not in ("in", "out"):
            skipped += 1
            continue
        if len(ts) == 16:
            ts += ":00"
        if db.execute("SELECT 1 FROM passes WHERE elpass_id=? AND ts=? AND direction=?", (eid, ts, direction)).fetchone():
            skipped += 1
            continue
        db.execute("INSERT INTO passes (id, elpass_id, object, employee_id, ts, direction, point) VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (uuid.uuid4().hex, eid, str(ev.get("object") or eid.split(":")[0]), by_elpass.get(eid), ts, direction,
                    str(ev.get("point") or "")[:100]))
        added += 1
    db.commit()
    return added, skipped


@app.route("/api/admin/passes", methods=["POST"])
def admin_passes():
    """Ручная загрузка проходов (список событий или {events: [...]}) — до появления интеграции с API elpass."""
    payload = request.get_json(silent=True)
    events = payload.get("events") if isinstance(payload, dict) else payload
    if not isinstance(events, list):
        return jsonify({"error": "Ожидается список событий."}), 400
    added, skipped = import_passes(get_db(), events[:5000])
    return jsonify({"added": added, "skipped": skipped})


def lateness_top_by_office(r, top=3):
    """Топ опоздавших отдельно по офисам (Астана, Алматы) — по числу опозданий без отметки в табеле.
    При равном числе выше тот, у кого больше среднее опоздание (просьба пользователя 21.09.2026)."""
    by = {}
    for x in r["late"]:
        by.setdefault(x.get("office") or "Другой офис", {}).setdefault(x["name"], []).append(x)
    out = []
    for office in sorted(by, key=lambda o: (o != "Астана", o != "Алматы", o)):
        people = []
        for n, v in by[office].items():
            mins = [int(i["arrived"][:2]) * 60 + int(i["arrived"][3:5]) for i in v]
            avg_min = round(sum(mins) / len(mins))
            people.append({"name": n, "count": len(v), "avg": round(sum(i["late_min"] for i in v) / len(v)),
                           "avg_at": f"{avg_min // 60:02d}:{avg_min % 60:02d}",
                           "dates": sorted(i["date"] for i in v)})
        people.sort(key=lambda p: (-p["count"], -p["avg"], p["name"]))
        out.append({"office": office, "people": people[:top]})
    return out


RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
             "июля", "августа", "сентября", "октября", "ноября", "декабря"]
MEDALS = ["\U0001F947", "\U0001F948", "\U0001F949"]     # 1, 2, 3 место


def _late_word(n):
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} опоздание"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return f"{n} опоздания"
    return f"{n} опозданий"


def telegram_post(db, start, end):
    """Текст для рассылки в Telegram — HR копирует его из письма и постит без правок.
    Формат повторяет рубрику «Время под контролем», которую она ведёт."""
    r = _for_report(compute_lateness(db, start, end))
    period = f"{start.day} {RU_MONTHS[start.month - 1]} – {end.day} {RU_MONTHS[end.month - 1]}"
    L = ["\U0001F4E3 Еженедельная рубрика — «ВРЕМЯ ПОД КОНТРОЛЕМ» \U0001F3C6", "",
         f"\U0001F4C5 Итоги недели: {period}", "",
         "\U0001F3C6 ТОП-3 самых пунктуальных сотрудников:", ""]
    for blk in early_top_by_office(db, start, end, report=True):
        if not blk["people"]:
            continue
        L.append(f"\U0001F4CD Офис {blk['office']}:")
        for i, p in enumerate(blk["people"]):
            L.append(f"{MEDALS[i] if i < 3 else '\u2022'} {p['name']}")
        L.append("")
    L += ["\U0001F44F Спасибо за пунктуальность, ответственность и отличный пример для всей команды!",
          "Пусть эта неделя начнётся с хорошей привычки — приходить вовремя и держать своё время под контролем! \u23F0",
          "", "\u23F0 ЗОНА ВНИМАНИЯ", "",
          "В этот блок попадают сотрудники, у которых за неделю было больше всего опозданий, а также сотрудники, "
          "у которых отсутствуют отметки или комментарии в табеле.",
          "Если информация в табеле не внесена, мы не можем корректно определить фактическое время прихода сотрудника. "
          "Поэтому просим внимательно и своевременно фиксировать рабочее время и оставлять необходимые комментарии.", ""]
    any_late = False
    for blk in lateness_top_by_office(r):
        if not blk["people"]:
            continue
        any_late = True
        L.append(f"\U0001F4CD Офис {blk['office']}:")
        for i, p in enumerate(blk["people"]):
            L.append(f"{MEDALS[i] if i < 3 else '\u2022'} {p['name']} — {_late_word(p['count'])}")
        L.append("")
    if not any_late:
        L += ["На этой неделе опозданий без отметки в табеле не было \U0001F44D", ""]
    return "\n".join(L).strip()


def _lateness_groups(r):
    """Сводим отметки по людям: {имя: [записи]} отдельно для «без причины» и «с причиной», плюс список без опозданий."""
    late, exc = {}, {}
    for x in r["late"]:
        late.setdefault(x["name"], []).append(x)
    for x in r["excused"]:
        exc.setdefault(x["name"], []).append(x)
    for d in (late, exc):
        for v in d.values():
            v.sort(key=lambda x: x["date"])
    on_time = sorted(n for n in r["mapped_names"] if n not in late)
    # самые частые сверху, при равенстве — у кого больше суммарных минут
    order = sorted(late.items(), key=lambda kv: (-len(kv[1]), -sum(x["late_min"] for x in kv[1]), kv[0]))
    return order, sorted(exc.items()), on_time


def _times_word(n):
    """1 раз, 2 раза, 5 раз — чтобы в письме не было «4 раз»."""
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} раз"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return f"{n} раза"
    return f"{n} раз"


def _fmt_day(iso, short=False):
    """«пн 14.09» или коротко «пн» — внутри письма неделя одна, дата не нужна."""
    d = date.fromisoformat(iso)
    wd = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"][d.weekday()]
    return wd if short else f"{wd} {d.strftime('%d.%m')}"


def lateness_report_text(db, start, end):
    """Тот же отчёт простым текстом — запасной вариант для почтовых программ без HTML."""
    r = _for_report(compute_lateness(db, start, end))
    period = f"{start.strftime('%d.%m')}–{end.strftime('%d.%m')}"
    if not r["has_passes"]:
        return f"Опоздания за {period}: данных из elpass пока нет.\nhttps://community.connectedhome.kz/#hr/late"
    late, exc, on_time = _lateness_groups(r)
    L = [f"ОПОЗДАНИЯ ЗА НЕДЕЛЮ {period}",
         f"Турникет elpass · пн–пт · опоздание = приход позже графика более чем на {LATE_GRACE_MIN} минут", "",
         f"Опоздали и не отметились в табеле: {len(late)} чел. ({_times_word(len(r['late']))})",
         f"Опоздали, но есть отметка в табеле: {len(exc)} чел. ({_times_word(len(r['excused']))})",
         f"Ни разу не опоздали: {len(on_time)} чел.", ""]
    for blk in lateness_top_by_office(r):
        L.append(f"--- ТОП-{len(blk['people'])} ОПОЗДАВШИХ · {blk['office'].upper()} ---")
        for i, pp in enumerate(blk["people"], 1):
            L.append(f"  {i}. {pp['name']} — {_times_word(pp['count'])}, в среднем приходил(а) в {pp['avg_at']}")
        L.append("")

    L.append(f"--- НЕТ ОТМЕТКИ В ТАБЕЛЕ ({len(late)}) ---")
    for name, items in late or []:
        days = ", ".join(f"{_fmt_day(x['date'], True)} {x['arrived']}" for x in items)
        L.append(f"  {name} — {_times_word(len(items))}: {days}")
    if not late:
        L.append("нет")
    L.append("")
    if exc:
        L.append(f"--- ЕСТЬ ОТМЕТКА В ТАБЕЛЕ ({len(exc)}) ---")
        for name, items in exc:
            days = "; ".join(
                f"{_fmt_day(x['date'], True)} {x['arrived']} — {x['excuse']['code']} {ATTENDANCE_CODES.get(x['excuse']['code'], '')}"
                + (f" ({x['excuse']['comment']})" if x["excuse"]["comment"] else "")
                for x in items)
            L.append(f"  {name}: {days}")
        L.append("")
    L.append(f"--- БЕЗ ОПОЗДАНИЙ ({len(on_time)}) ---")
    L.append(", ".join(on_time) if on_time else "нет")
    for blk in early_top_by_office(db, start, end, report=True):
        if not blk["people"]:
            continue
        L += ["", f"--- ПРИХОДЯТ РАНЬШЕ ВСЕХ · {blk['office'].upper()} ---"]
        for i, e in enumerate(blk["people"], 1):
            L.append(f"  {i}. {e['name']} — раньше графика на {e['avg_ahead']} мин, рекорд {e['earliest']}")
    if r.get("remote_names"):
        L += ["", f"--- РАБОТАЮТ УДАЛЁННО ({len(r['remote_names'])}) — через турникет не ходят ---",
              ", ".join(r["remote_names"])]
    if r["unmapped_names"]:
        L += ["", f"--- НЕТ В ТУРНИКЕТЕ ({len(r['unmapped_names'])}) — по ним данных нет ---",
              ", ".join(sorted(r["unmapped_names"]))]
    L += ["", "=" * 46, "ГОТОВЫЙ ТЕКСТ ДЛЯ TELEGRAM (скопируйте целиком)", "=" * 46, "",
          telegram_post(db, start, end), "", "=" * 46, "",
          "Подробнее: https://community.connectedhome.kz/#hr/late"]
    return "\n".join(L)


def lateness_report_html(db, start, end):
    """Письмо для HR: сводка цифрами, затем таблицы. Стили только inline — почтовые программы иначе их выбрасывают."""
    r = _for_report(compute_lateness(db, start, end))
    period = f"{start.strftime('%d.%m')} – {end.strftime('%d.%m.%Y')}"
    O, INK, SOFT, LINE, BG = "#FF6B00", "#1B1F24", "#6B7480", "#E6E9EC", "#F7F8F9"
    head = (f'<div style="border-top:4px solid {O};background:#fff;padding:20px 24px 4px">'
            f'<div style="font:800 11px/1 Arial;letter-spacing:.1em;color:{O}">CONNECTED COMMUNITY</div>'
            f'<div style="font:700 21px/1.3 Arial;color:{INK};margin:8px 0 2px">Опоздания за неделю</div>'
            f'<div style="font:400 14px/1.4 Arial;color:{SOFT}">{period}</div></div>')
    if not r["has_passes"]:
        return (f'<div style="background:{BG};padding:24px;font-family:Arial">{head}'
                f'<div style="background:#fff;padding:20px 28px 28px;font:15px/1.5 Arial;color:{INK}">'
                f'Данные проходов из elpass пока не поступали.</div></div>')
    late, exc, on_time = _lateness_groups(r)

    def tile(num, label, color):
        return (f'<td width="33%" style="padding:4px"><div style="background:{BG};border-radius:10px;padding:14px 12px;text-align:center">'
                f'<div style="font:800 30px/1 Arial;color:{color}">{num}</div>'
                f'<div style="font:400 12px/1.4 Arial;color:{SOFT};margin-top:6px">{label}</div></div></td>')

    parts = [f'<div style="background:{BG};padding:24px 12px;font-family:Arial,sans-serif">',
             f'<div style="max-width:660px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden">', head,
             f'<div style="padding:12px 21px 2px"><table width="100%" cellspacing="0" cellpadding="0"><tr>'
             + tile(len(late), "опоздали и не отметились<br>в табеле", "#C4432B")
             + tile(len(exc), "опоздали, но есть<br>отметка в табеле", O)
             + tile(len(on_time), "ни разу<br>не опоздали", "#1F7A3C")
             + '</tr></table></div>',
             f'<div style="padding:2px 24px 0;font:400 12px/1.45 Arial;color:{SOFT}">'
             f'Опоздание — приход позже графика более чем на {LATE_GRACE_MIN} мин. Рабочие дни, данные турникета elpass.</div>']

    def section(title, sub, color):
        return (f'<div style="padding:18px 24px 7px"><div style="font:700 15px/1.3 Arial;color:{INK}">'
                f'<span style="color:{color}">■</span> {title}</div>'
                f'<div style="font:400 12px/1.4 Arial;color:{SOFT};margin-top:3px">{sub}</div></div>')

    # топ по офисам — сразу после цифр
    tops = lateness_top_by_office(r)
    if any(b["people"] for b in tops):
        parts.append(section("Топ опоздавших по офисам", "Кто чаще приходил позже без отметки в табеле. При равном числе опозданий выше тот, кто в среднем приходил позже.", "#C4432B"))
        cells = []
        for blk in tops:
            rows = "".join(
                f'<tr><td width="26" style="padding:5px 0;font:800 13px/1 Arial;color:#C4432B">{i}</td>'
                f'<td style="padding:5px 0;font:700 14px/1.35 Arial;color:{INK}">{pp["name"]}</td>'
                f'<td align="right" style="padding:5px 0;font:400 12.5px/1.35 Arial;color:{SOFT};white-space:nowrap">'
                f'{_times_word(pp["count"])} · в среднем <b style="color:{INK}">{pp["avg_at"]}</b></td></tr>'
                for i, pp in enumerate(blk["people"], 1))
            cells.append(f'<td width="50%" valign="top" style="padding:4px"><div style="background:{BG};border-radius:10px;padding:12px 14px">'
                         f'<div style="font:800 11px/1 Arial;letter-spacing:.09em;color:{O};margin-bottom:8px">{blk["office"].upper()}</div>'
                         f'<table width="100%" cellspacing="0" cellpadding="0">{rows}</table></div></td>')
        parts.append(f'<div style="padding:2px 20px 0"><table width="100%" cellspacing="0" cellpadding="0"><tr>{"".join(cells)}</tr></table></div>')

    # без причины
    parts.append(section(f"Нет отметки в табеле — {len(late)} чел.", "Опоздали и никак это не объяснили. С ними стоит поговорить.", "#C4432B"))
    if late:
        rows = []
        for name, items in late:
            days = " · ".join(f'<span style="color:{SOFT}">{_fmt_day(x["date"], True)}</span> {x["arrived"]}' for x in items)
            rows.append(f'<tr><td style="padding:7px 8px 7px 24px;border-top:1px solid {LINE};font:700 14px/1.4 Arial;color:{INK};white-space:nowrap">'
                        f'{name}<span style="font:700 11px/1 Arial;color:#C4432B;background:#FFECE8;border-radius:20px;padding:3px 7px;margin-left:6px">'
                        f'{len(items)}</span></td>'
                        f'<td align="right" style="padding:7px 24px 7px 8px;border-top:1px solid {LINE};font:400 13px/1.4 Arial;color:{INK}">{days}</td></tr>')
        parts.append(f'<table width="100%" cellspacing="0" cellpadding="0">{"".join(rows)}</table>')
    else:
        parts.append(f'<div style="padding:0 24px 4px;font:14px Arial;color:#1F7A3C">Таких нет — все опоздания объяснены.</div>')

    # с причиной
    if exc:
        parts.append(section(f"Есть отметка в табеле — {len(exc)} чел.", "Пришли позже, но причина указана — объект, работа, личные дела. Это не опоздание.", O))
        rows = []
        for name, items in exc:
            days = "<br>".join(
                f'<span style="color:{SOFT}">{_fmt_day(x["date"], True)}</span> {x["arrived"]} · <b>{x["excuse"]["code"]}</b> {ATTENDANCE_CODES.get(x["excuse"]["code"], "")}'
                + (f' <span style="color:{SOFT}">({x["excuse"]["comment"]})</span>' if x["excuse"]["comment"] else "")
                for x in items)
            rows.append(f'<tr><td valign="top" style="padding:7px 8px 7px 24px;border-top:1px solid {LINE};font:700 14px/1.4 Arial;color:{INK};white-space:nowrap">{name}</td>'
                        f'<td align="right" style="padding:7px 24px 7px 8px;border-top:1px solid {LINE};font:400 13px/1.5 Arial;color:{INK}">{days}</td></tr>')
        parts.append(f'<table width="100%" cellspacing="0" cellpadding="0">{"".join(rows)}</table>')

    # без опозданий
    parts.append(section(f"Без опозданий — {len(on_time)} чел.", "Всю неделю приходили вовремя.", "#1F7A3C"))
    parts.append(f'<div style="padding:0 24px;font:400 13px/1.6 Arial;color:{INK}">{", ".join(on_time) if on_time else "нет"}</div>')

    # самые пунктуальные — по офисам, топ-3
    early_blocks = [b for b in early_top_by_office(db, start, end, report=True) if b["people"]]
    if early_blocks:
        parts.append(section("Приходят раньше всех — топ-3 по офисам", "Ни разу не опоздали и стабильно приходят до начала графика.", "#1F7A3C"))
        cells = []
        for blk in early_blocks:
            rows = "".join(
                f'<tr><td width="26" style="padding:5px 0;font:800 13px/1 Arial;color:#1F7A3C">{i}</td>'
                f'<td style="padding:5px 0;font:700 14px/1.35 Arial;color:{INK}">{e["name"]}</td>'
                f'<td align="right" style="padding:5px 0;font:400 12.5px/1.35 Arial;color:{SOFT};white-space:nowrap">'
                f'в среднем <b style="color:{INK}">{e["avg_ahead"]} мин</b> раньше</td></tr>'
                for i, e in enumerate(blk["people"], 1))
            cells.append(f'<td width="50%" valign="top" style="padding:4px"><div style="background:{BG};border-radius:10px;padding:12px 14px">'
                         f'<div style="font:800 11px/1 Arial;letter-spacing:.09em;color:#1F7A3C;margin-bottom:8px">{blk["office"].upper()}</div>'
                         f'<table width="100%" cellspacing="0" cellpadding="0">{rows}</table></div></td>')
        parts.append(f'<div style="padding:2px 20px 0"><table width="100%" cellspacing="0" cellpadding="0"><tr>{"".join(cells)}</tr></table></div>')

    if r.get("remote_names"):
        parts.append(section(f"Работают удалённо — {len(r['remote_names'])} чел.", "Через турникет не ходят, опоздания по ним не считаются.", SOFT))
        parts.append(f'<div style="padding:0 24px;font:400 12px/1.6 Arial;color:{SOFT}">{", ".join(r["remote_names"])}</div>')

    if r["unmapped_names"]:
        parts.append(section(f"Нет в турникете — {len(r['unmapped_names'])} чел.", "Карточка elpass не привязана, приходы не видны.", SOFT))
        parts.append(f'<div style="padding:0 24px;font:400 12px/1.6 Arial;color:{SOFT}">{", ".join(sorted(r["unmapped_names"]))}</div>')

    # готовый текст для Telegram — последним блоком, чтобы HR скопировала и отправила
    tg = telegram_post(db, start, end)
    parts.append(section("Готовый текст для Telegram", "Выделите текст ниже, скопируйте и отправьте в рабочий чат — править ничего не нужно.", O))
    parts.append(f'<div style="padding:0 24px 4px"><div style="background:{BG};border:1px dashed {LINE};border-radius:10px;'
                 f'padding:16px 18px;font:400 13.5px/1.65 Arial;color:{INK};white-space:pre-wrap">{tg.replace("&", "&amp;").replace("<", "&lt;")}</div></div>')

    parts.append(f'<div style="padding:18px 24px 22px"><a href="https://community.connectedhome.kz/#hr/late" '
                 f'style="display:inline-block;background:{O};color:#fff;text-decoration:none;font:700 14px Arial;padding:11px 20px;border-radius:9px">'
                 f'Открыть в портале</a></div>')
    parts.append(f'<div style="padding:11px 24px;background:{BG};font:400 11px/1.5 Arial;color:{SOFT}">'
                 f'Письмо приходит автоматически каждый понедельник. Connected Community.</div>')
    parts.append('</div></div>')
    return "".join(parts)


def send_weekly_lateness_report():
    """Понедельничное письмо HR за прошлую неделю. Вызывается планировщиком; повторно за ту же неделю не шлёт."""
    db = get_db()
    today = date.fromisoformat(_astana_today())
    start = today - timedelta(days=today.weekday() + 7)
    end = start + timedelta(days=4)          # пн–пт: выходные в отчёт не попадают
    if _setting("late_report_sent") == start.isoformat():
        return False
    # С 06.10.2026 отчёт уходит HR в Telegram-бот «вместо почты» (слова пользователя). Письмо осталось запасным путём:
    # бот не подключён или сообщение не дошло никому — отчёт не должен пропасть.
    if hrbot_ready():
        try:
            if hrbot_send(hrbot_weekly_text(db, start, end), html=True):
                _set_setting("late_report_sent", start.isoformat())
                failed = list(hrbot_last_failed)                  # запомнить до второго сообщения: оно перепишет список (нашёл проверяющий 07.10.2026)
                try:                                              # пост для канала — вторым сообщением; не ушёл — отчёт всё равно доставлен
                    hrbot_send(hrbot_weekly_post(db, start, end))
                except Exception as e:  # noqa: BLE001
                    print(f"[бот HR] пост для канала не ушёл: {e}", flush=True)
                for uid in failed:                                # кому в бот не дошёл отчёт — тому письмом, как раньше
                    u = db.execute("SELECT email FROM users WHERE id=? AND email<>''", (uid,)).fetchone()
                    if u and smtp_configured():
                        try:
                            send_mail(u["email"], f"Опоздания за неделю {start.strftime('%d.%m')}–{end.strftime('%d.%m')}",
                                      lateness_report_text(db, start, end), lateness_report_html(db, start, end))
                        except Exception as e:  # noqa: BLE001
                            print(f"[письмо об опозданиях не ушло] {u['email']}: {e}", flush=True)
                return True
        except Exception as e:  # noqa: BLE001
            print(f"[бот HR] отчёт об опозданиях не ушёл, шлю письмом: {e}", flush=True)
    to = [r["email"] for r in db.execute("SELECT email FROM users WHERE role IN ('hr','admin') AND email<>''")]
    if not to or not smtp_configured():
        return False
    body = lateness_report_text(db, start, end)
    html = lateness_report_html(db, start, end)
    for addr in to:
        try:
            send_mail(addr, f"Опоздания за неделю {start.strftime('%d.%m')}–{end.strftime('%d.%m')}", body, html)
        except Exception as e:  # noqa: BLE001
            print(f"[письмо об опозданиях не ушло] {addr}: {e}", flush=True)
    _set_setting("late_report_sent", start.isoformat())
    return True


_sched_beat = 0.0   # когда планировщик последний раз «проснулся» (в памяти процесса)


def _scheduler_loop():
    """Фоновые задачи внутри приложения (в контейнере нет cron): раз в минуту смотрим, не пора ли что-то сделать."""
    import threading
    global _sched_beat
    while True:
        _sched_beat = time.time()                                 # «пульс» для вкладки «Сервисы»
        try:
            with app.app_context():
                now = datetime.utcnow() + timedelta(hours=5)      # Астана
                if now.weekday() == 0 and now.hour == 9:          # понедельник, 09:00–09:59
                    send_weekly_lateness_report()
                if now.minute % ATT_SHEET_SYNC_MINUTES == 7:      # не в ту же минуту, что elpass
                    try:
                        sheet_sync(get_db())
                    except Exception as e:  # noqa: BLE001
                        _svc_mark("sheet", False, e)
                        print(f"[google-таблица] не прочиталась: {e}", flush=True)
                if now.minute == 41:                              # раз в час: висит сбой Connect AI — перепроверить, не разовый ли
                    try:
                        ai_selfcheck()
                    except Exception as e:  # noqa: BLE001
                        print(f"[connect ai] самопроверка не удалась: {e}", flush=True)
                if now.minute == 23:                              # раз в час доперевести новые тексты портала (смена языка)
                    try:
                        n = prewarm_translations(get_db())
                        _svc_mark("translate", True, f"запросов к AI: {n}")
                        if n:
                            print(f"[перевод] запросов к AI: {n}", flush=True)
                    except Exception as e:  # noqa: BLE001
                        _svc_mark("translate", False, e)
                        print(f"[перевод] не удалось: {e}", flush=True)
                if elpass_configured() and now.minute % ELPASS_SYNC_MINUTES == 0:
                    try:
                        r = elpass_sync(get_db())
                        if r.get("added"):
                            print(f"[elpass] новых проходов: {r['added']}", flush=True)
                    except Exception as e:  # noqa: BLE001
                        _svc_mark("elpass", False, e)
                        print(f"[elpass] синхронизация не удалась: {e}", flush=True)
                if tg_ready():                                    # отчёт админу в Telegram и оповещения о сбоях
                    try:
                        if now.hour == TG_REPORT_HOUR:
                            tg_daily_report(get_db())
                        if now.minute % TG_WATCH_MINUTES == 4:
                            tg_watch(get_db())
                    except Exception as e:  # noqa: BLE001
                        print(f"[telegram] не отправилось: {e}", flush=True)
                try:                                              # бот HR: дни рождения сотрудников — в сам день
                    if hrbot_birthdays(get_db()):
                        print("[бот HR] напоминание о дне рождения отправлено", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"[бот HR] {e}", flush=True)
                try:                                              # бот HR: за два дня о праздничных выходных
                    if hrbot_holidays(get_db()):
                        print("[бот HR] напоминание о празднике отправлено", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"[бот HR] праздники: {e}", flush=True)
                try:                                              # личные напоминания сотрудникам об опоздании без отметки
                    n = tg_late_reminders(get_db())
                    if n:
                        print(f"[бот сотрудников] напоминаний об опоздании: {n}", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"[бот сотрудников] {e}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[планировщик] {e}", flush=True)
        threading.Event().wait(60)


def start_scheduler():
    # под `python app.py` отладчик запускает два процесса — поток нужен только в рабочем (WERKZEUG_RUN_MAIN);
    # под gunicorn переменной нет, и поток стартует сразу
    import threading
    if __name__ == "__main__" and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return
    if os.environ.get("PORTAL_NO_SCHEDULER"):          # служебные скрипты (checks/agent_log.py) импортируют app на секунду —
        print("[планировщик] не запущен: задана PORTAL_NO_SCHEDULER", flush=True)   # фоновые задачи им запускать незачем
        return
    threading.Thread(target=_scheduler_loop, name="scheduler", daemon=True).start()
    print("[планировщик] запущен: письмо об опозданиях по понедельникам в 09:00 по Астане", flush=True)


# ---------- интеграция с elpass (avtodor.elpass.kz): карточки и проходы ----------
# Доступ — в /opt/staff-data/elpass.env: ELPASS_EMAIL, ELPASS_PASSWORD (и при необходимости ELPASS_URL).
# Токен живёт 72 часа; обновляем за час до конца и при 401. Ответы — по 100 записей, листаем offset'ом.
# Объектов elpass несколько: avtodor — офис в Астане, ch-almaty — офис в Алматы. У каждого свой поддомен;
# токен привязывается к объекту по доменному имени, поэтому логинимся в каждый отдельно.
# Табельные номера в разных объектах совпадают, поэтому наш идентификатор — «объект:номер».
ELPASS_OBJECTS = [o.strip() for o in os.environ.get("ELPASS_OBJECTS", "avtodor,ch-almaty").split(",") if o.strip()]
ELPASS_LABELS = {"avtodor": "Астана", "ch-almaty": "Алматы"}
ELPASS_SYNC_MINUTES = 5   # было 15; с 22.09.2026 каждые 5 минут — кабинет руководителя показывает, кто вернулся
_elpass_tokens = {}                      # объект -> {"token": ..., "expire": ...}


def _elpass_url(obj):
    return os.environ.get(f"ELPASS_URL_{obj.upper().replace('-', '_')}", f"https://{obj}.elpass.kz/api").rstrip("/")


def _elpass_password(obj):
    """Пароль объекта: своя переменная, иначе общая ELPASS_PASSWORD."""
    return os.environ.get(f"ELPASS_PASSWORD_{obj.upper().replace('-', '_')}") or os.environ.get("ELPASS_PASSWORD") or ""


def elpass_objects():
    """Объекты, для которых есть доступ."""
    if not os.environ.get("ELPASS_EMAIL"):
        return []
    return [o for o in ELPASS_OBJECTS if _elpass_password(o)]


def elpass_configured():
    return bool(elpass_objects())


def _elpass_login(obj):
    req = urllib.request.Request(_elpass_url(obj) + "/rpc/login", method="POST",
                                 data=json.dumps({"email": os.environ["ELPASS_EMAIL"], "pass": _elpass_password(obj)}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _elpass_tokens[obj] = {"token": data["token"], "expire": int(data.get("expire") or 0)}


def _elpass_get(obj, path, params, retry=True):
    tok = _elpass_tokens.get(obj)
    if not tok or not tok.get("token") or tok["expire"] - time.time() < 3600:
        _elpass_login(obj)
        tok = _elpass_tokens[obj]
    url = _elpass_url(obj) + path + "?" + "&".join(f"{k}={urllib.parse.quote(str(v), safe='.*,')}" for k, v in params)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok["token"]})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 401 and retry:
            _elpass_tokens.pop(obj, None)
            return _elpass_get(obj, path, params, retry=False)
        raise


def _elpass_all(obj, path, params):
    """Забирает всё постранично: страница — не больше 100, меньше 100 — конец."""
    out, offset = [], 0
    while True:
        page = _elpass_get(obj, path, params + [("limit", 100), ("offset", offset)])
        out.extend(page)
        if len(page) < 100 or offset > 200000:
            return out
        offset += 100


# --- сравнение ФИО между справочником и elpass ---
_KZ_FOLD = str.maketrans("әғқңөұүһі", "агкноуухи")
_TRANSLIT = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k",
             "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh",
             "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"}


def _name_skeleton(name):
    """ФИО → список «скелетов» слов латиницей: казахские буквы сведены к русским, всё транслитерировано,
    q=k, kh=h, zh=j, ss=s, y=i, двойные буквы схлопнуты. «Ақтай Саят» и «Aqtai Sayat» дают одно и то же."""
    s = (name or "").lower().replace("ё", "е").translate(_KZ_FOLD)
    s = "".join(_TRANSLIT.get(ch, ch) for ch in s)
    s = re.sub(r"[^a-z\s-]", "", s).replace("-", " ")
    for a, b in (("q", "k"), ("kh", "h"), ("zh", "j"), ("dj", "j"), ("ss", "s"), ("y", "i"), ("ii", "i")):
        s = s.replace(a, b)
    s = re.sub(r"(.)\1+", r"\1", s)
    return sorted(s.split())


def _name_score(a, b):
    """0..1 — насколько похожи два ФИО: среднее по словам первого имени лучшего совпадения со словами второго."""
    import difflib
    A, B = _name_skeleton(a), _name_skeleton(b)
    if not A or not B:
        return 0.0
    return sum(max(difflib.SequenceMatcher(None, w, x).ratio() for x in B) for w in A) / len(A)


def _elpass_migrate_ids(db):
    """Раньше elpass_id хранил голый табельный номер (был один объект). Дописываем приставку объекта."""
    first = ELPASS_OBJECTS[0] if ELPASS_OBJECTS else "avtodor"
    if _setting("elpass_ids_prefixed") == "1":
        return
    db.execute("UPDATE employees SET elpass_id=? || ':' || elpass_id WHERE elpass_id<>'' AND instr(elpass_id, ':')=0", (first,))
    db.execute("UPDATE passes SET elpass_id=? || ':' || elpass_id, object=? WHERE instr(elpass_id, ':')=0", (first, first))
    db.execute("DELETE FROM elpass_cards WHERE instr(no, ':')=0")   # соберутся заново при ближайшем синке
    db.commit()
    _set_setting("elpass_ids_prefixed", "1")


def _elpass_sync_object(db, obj, full, now):
    """Карточки и проходы одного объекта. Идентификатор карточки у нас — «объект:табельный»."""
    cards = _elpass_all(obj, "/el_tcards", [("select", "no,name,meta_,deleted_at,isBlocked"), ("order", "name.asc")])
    for c in cards:
        meta = c.get("meta_") or {}
        active = 0 if (c.get("deleted_at") or c.get("isBlocked")) else 1
        card_no = str(c.get("no") or "")
        prev = db.execute("SELECT ignored, note FROM elpass_cards WHERE no=?", (f"{obj}:{card_no}",)).fetchone()
        db.execute("INSERT OR REPLACE INTO elpass_cards (no, object, card_no, name, title, email, active, ignored, note, synced) "
                   "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (f"{obj}:{card_no}", obj, card_no, (c.get("name") or "").strip(), (meta.get("title") or "").strip(),
                    (meta.get("email") or "").strip().lower(), active,
                    (prev["ignored"] if prev else 0), (prev["note"] if prev else ""), now))
    db.commit()

    key = "elpass_last_pass_" + obj
    last = _setting(key)
    since = (date.fromisoformat(_astana_today()).replace(day=1)).isoformat() if full or not last \
        else (date.fromisoformat(last[:10]) - timedelta(days=1)).isoformat()
    visits = _elpass_all(obj, "/el_tvisits", [("select", "no,loged_at,isOut,zone,terminal"),
                                              ("loged_at", "gte." + since), ("order", "loged_at.asc")])
    events, newest = [], last or ""
    for v in visits:
        try:
            ts = datetime.fromisoformat(str(v["loged_at"]).replace("Z", "+00:00"))
            ts = (ts.astimezone(timezone(timedelta(hours=5))) if ts.tzinfo else ts).replace(tzinfo=None).isoformat(timespec="seconds")
        except (KeyError, ValueError):
            continue
        events.append({"elpass_id": f"{obj}:{v.get('no')}", "ts": ts, "direction": "out" if v.get("isOut") else "in",
                       "point": f"{v.get('zone') or ''}/{v.get('terminal') or ''}", "object": obj})
        newest = max(newest, ts)
    added, skipped = import_passes(db, events)
    if newest:
        _set_setting(key, newest)
    return {"object": obj, "label": ELPASS_LABELS.get(obj, obj), "cards": len(cards), "visits": len(visits),
            "added": added, "skipped": skipped}


def _elpass_automap(db):
    """Привязывает карточки к сотрудникам: по почте, иначе по «скелету» ФИО.
    Человеку можно добавить вторую карточку, но только из другого офиса — чтобы случайное
    совпадение не приклеило ему второй пропуск того же турникета. Сомнительное оставляем HR."""
    cards_of = lambda v: [c.strip() for c in (v or "").split(",") if c.strip()]
    emps = [dict(r) for r in db.execute("SELECT id, name, email, elpass_id FROM employees")]
    taken = {c for e in emps for c in cards_of(e["elpass_id"])}
    cards = [dict(r) for r in db.execute("SELECT no, object, name, email FROM elpass_cards WHERE active=1 AND ignored=0")]
    auto = 0
    for e in emps:
        mine = cards_of(e["elpass_id"])
        objs = {c.split(":")[0] for c in mine}
        for c in cards:
            if c["no"] in taken or (c["object"] or "") in objs:
                continue
            if c["email"] and c["email"] == (e["email"] or "").lower():
                pass                                  # почта совпала — этого достаточно
            else:
                score = _name_score(e["name"], c["name"])
                if score < 0.8:
                    continue
                # однозначность: если на эту же карточку похож кто-то ещё — не гадаем
                if any(o["id"] != e["id"] and _name_score(o["name"], c["name"]) >= score - 0.1 for o in emps):
                    continue
            mine.append(c["no"])
            objs.add(c["object"] or "")
            taken.add(c["no"])
            auto += 1
        if mine != cards_of(e["elpass_id"]):
            db.execute("UPDATE employees SET elpass_id=? WHERE id=?", (",".join(mine), e["id"]))
    db.commit()
    return auto


def elpass_sync(db, full=False):
    """Обходит все объекты elpass (Астана и Алматы), тянет карточки и проходы, сопоставляет сотрудников."""
    objs = elpass_objects()
    if not objs:
        return {"error": "Доступ к elpass не настроен."}
    _elpass_migrate_ids(db)
    now = datetime.now().isoformat(timespec="seconds")
    per, errors = [], []
    for obj in objs:
        try:
            per.append(_elpass_sync_object(db, obj, full, now))
        except Exception as e:  # noqa: BLE001
            errors.append({"object": obj, "label": ELPASS_LABELS.get(obj, obj), "error": str(e)[:200]})
    auto = _elpass_automap(db)
    # проходы, залитые до того, как HR проставила карточку, — досопоставляем
    for card, eid in employee_by_card(db).items():
        db.execute("UPDATE passes SET employee_id=? WHERE employee_id IS NULL AND elpass_id=?", (eid, card))
    db.commit()
    out = {"at": now, "objects": per, "errors": errors, "auto_mapped": auto,
           "cards": sum(x["cards"] for x in per), "visits": sum(x["visits"] for x in per),
           "added": sum(x["added"] for x in per)}
    _set_setting("elpass_last_sync", json.dumps(out, ensure_ascii=False))
    if errors:
        _svc_mark("elpass", False, "; ".join(f"{e['label']}: {e['error']}" for e in errors))
    if per:
        _svc_mark("elpass", True, f"карточек {out['cards']}, новых проходов {out['added']}")
    return out


# ---------- Google-таблица посещаемости HR: временный источник отметок, пока сотрудники не заполняют табель на портале ----------
# Лист: легенда в строках 1–8, шапка в строке 9 (A «№», C ФИО, D должность, E график, G.. — числа месяца), дальше по строке
# на сотрудника. Таблица ведётся на текущий месяц. «В» — выходной, не отметка. «Л (онлайн)» → Л с комментарием «онлайн».
# Отметки из таблицы помечаются set_by='gsheet' и при следующем чтении обновляются; поставленное людьми на портале не трогаем.
ATT_SHEET_ID = os.environ.get("ATT_SHEET_ID", "13fgezj8CY7EZDtdgDOG_Vd4ZGDewzkta0s_1ccUrGdk")
ATT_SHEET_SYNC_MINUTES = 15
# какая вкладка (gid) за какой месяц: имён вкладок без входа в Google не видно, поэтому карта хранится в settings
# (`sheet_tabs`). Новая незнакомая вкладка считается вкладкой текущего месяца — HR заводит по одной на месяц.
ATT_SHEET_TABS_DEFAULT = {"2026-08": "0", "2026-09": "2089623715"}


def _sheet_fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ConnectedCommunity/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8-sig", "replace")


def _sheet_gids():
    """Все вкладки таблицы в порядке появления в html-виде (доступен при открытии «всем по ссылке»)."""
    html = _sheet_fetch(f"https://docs.google.com/spreadsheets/d/{ATT_SHEET_ID}/htmlview")
    out = []
    for g in re.findall(r"gid=(\d+)", html):
        if g not in out:
            out.append(g)
    return out


def _sheet_tabs():
    try:
        tabs = json.loads(_setting("sheet_tabs") or "null") or dict(ATT_SHEET_TABS_DEFAULT)
    except ValueError:
        tabs = dict(ATT_SHEET_TABS_DEFAULT)
    return tabs


def _sheet_import_month(db, month, gid, emps, now):
    import csv
    text = _sheet_fetch(f"https://docs.google.com/spreadsheets/d/{ATT_SHEET_ID}/export?format=csv&gid={gid}")
    rows = list(csv.reader(io.StringIO(text)))
    head_i = next((i for i, r in enumerate(rows) if len(r) > 6 and r[6].strip() == "1"), None)
    if head_i is None:
        raise ValueError(f"на вкладке за {month} не нашёл шапку с числами месяца")
    day_cols = {j: int(v) for j, v in enumerate(rows[head_i]) if j >= 6 and v.strip().isdigit()}
    y, m = map(int, month.split("-"))
    days_in_month = (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)).day
    seen_keys, matched, unmatched, unknown_codes, upserts = set(), 0, [], {}, 0
    for r in rows[head_i + 1:]:
        name = (r[2] if len(r) > 2 else "").strip()
        if not name:
            continue
        scored = sorted(((_name_score(name, e["name"]), e["id"]) for e in emps), reverse=True)
        if not scored or scored[0][0] < 0.8 or (len(scored) > 1 and scored[0][0] - scored[1][0] <= 0.1):
            unmatched.append(name)
            continue
        matched += 1
        emp_id = scored[0][1]
        for j, day in day_cols.items():
            if day > days_in_month or j >= len(r):
                continue
            raw = r[j].strip()
            if not raw:
                continue
            # латинские двойники букв (O, B, K, T, C, 3) — в таблице их набирают, не переключая раскладку
            raw = raw.translate(str.maketrans("OBKTCYobktcy3", "ОВКТСУовктсуЗ"))
            code, comment = raw.upper().replace(" ", ""), ""
            mm = re.match(r"^([А-ЯЁ]{1,2})\s*\((.+)\)$", raw, re.I)
            if mm:
                code, comment = mm.group(1).upper(), mm.group(2).strip()
            if code == "В":
                continue                       # выходной — не отметка
            code = ATTENDANCE_ALIASES.get(code, code)      # в таблице HR по-прежнему могут ставить «О»
            if code not in ATTENDANCE_CODES:
                unknown_codes[raw] = unknown_codes.get(raw, 0) + 1
                continue
            d = f"{month}-{day:02d}"
            seen_keys.add((emp_id, d))
            cur = db.execute("SELECT code, comment, set_by FROM attendance WHERE employee_id=? AND date=?", (emp_id, d)).fetchone()
            if cur and cur["set_by"] != "gsheet":
                continue                       # поставлено человеком на портале — таблица не перебивает
            if cur and cur["code"] == code and (cur["comment"] or "") == comment:
                continue
            db.execute("DELETE FROM attendance WHERE employee_id=? AND date=?", (emp_id, d))
            db.execute("INSERT INTO attendance (id, employee_id, date, code, comment, set_by, updated) VALUES (?, ?, ?, ?, ?, 'gsheet', ?)",
                       (uuid.uuid4().hex, emp_id, d, code, comment, now))
            upserts += 1
    removed = 0
    for r in db.execute("SELECT id, employee_id, date FROM attendance WHERE set_by='gsheet' AND date LIKE ?", (month + "-%",)).fetchall():
        if (r["employee_id"], r["date"]) not in seen_keys:
            db.execute("DELETE FROM attendance WHERE id=?", (r["id"],))
            removed += 1
    return {"month": month, "gid": gid, "matched": matched, "unmatched": unmatched, "unknown": unknown_codes, "changed": upserts, "removed": removed}


def sheet_sync(db):
    """Читает вкладки текущего и прошлого месяца. Отметки из таблицы — set_by='gsheet'; поставленное на портале не трогаем."""
    today = date.fromisoformat(_astana_today())
    cur_month = today.strftime("%Y-%m")
    prev = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    tabs = _sheet_tabs()
    # Вкладку могли удалить и завести заново (так было с октябрём 2026: портал запомнил первую, HR её пересоздала —
    # и сверка падала целиком). Поэтому сверяемся с тем, что в таблице есть сейчас: пропавшие вкладки забываем.
    try:
        live = _sheet_gids()
    except Exception:
        live = None                               # список вкладок не прочитался — работаем с тем, что помним
    if live:
        gone = [m for m, g in tabs.items() if g not in live]
        for m in gone:
            del tabs[m]
        fresh = [g for g in live if g not in tabs.values()]
        if cur_month not in tabs and len(fresh) == 1:
            tabs[cur_month] = fresh[0]
        if gone or tabs.get(cur_month) in fresh:
            _set_setting("sheet_tabs", json.dumps(tabs))
    emps = [dict(r) for r in db.execute("SELECT id, name FROM employees")]
    now = datetime.now().isoformat(timespec="seconds")
    result = {"at": now, "months": [], "no_tab": [], "errors": []}
    for month in (prev, cur_month):
        if month not in tabs:
            result["no_tab"].append(month)
            continue
        try:                                      # сбой одной вкладки не должен ломать сверку другой
            result["months"].append(_sheet_import_month(db, month, tabs[month], emps, now))
        except Exception as e:
            result["errors"].append(f"{month}: {e}")
    db.commit()
    _set_setting("sheet_last_sync", json.dumps(result, ensure_ascii=False))
    if result["errors"] or cur_month in result["no_tab"]:
        _svc_mark("sheet", False, "; ".join(result["errors"]) or f"нет вкладки за {cur_month}")
    else:
        _svc_mark("sheet", True, f"вкладок прочитано: {len(result['months'])}")
    return result


@app.route("/api/hr/sheet", methods=["GET", "POST"])
def hr_sheet():
    """GET — когда и как читалась Google-таблица; POST — прочитать сейчас."""
    if request.method == "POST":
        try:
            return jsonify(sheet_sync(get_db()))
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Не удалось прочитать таблицу: {e}"}), 502
    try:
        return jsonify({"last": json.loads(_setting("sheet_last_sync") or "null"), "url": f"https://docs.google.com/spreadsheets/d/{ATT_SHEET_ID}/edit"})
    except ValueError:
        return jsonify({"last": None})


@app.route("/api/hr/elpass", methods=["GET", "POST"])
def hr_elpass():
    """GET — состояние интеграции и список карточек (для выбора в карточке сотрудника); POST — обновить сейчас."""
    db = get_db()
    if request.method == "POST":
        try:
            return jsonify(elpass_sync(db, full=bool((request.get_json(silent=True) or {}).get("full"))))
        except urllib.error.HTTPError as e:
            return jsonify({"error": f"elpass ответил {e.code}" + (" — неверный логин или пароль" if e.code == 403 else "")}), 502
        except Exception as e:  # noqa: BLE001
            return jsonify({"error": f"Не удалось связаться с elpass: {e}"}), 502
    try:
        last = json.loads(_setting("elpass_last_sync") or "null")
    except ValueError:
        last = None
    mapped = {}
    for r in db.execute("SELECT elpass_id, name FROM employees WHERE elpass_id<>''"):
        for card in (r["elpass_id"] or "").split(","):
            if card.strip():
                mapped[card.strip()] = r["name"]
    cards = [{"no": r["no"], "card_no": r["card_no"] or r["no"], "object": r["object"] or "",
              "label": ELPASS_LABELS.get(r["object"] or "", r["object"] or ""),
              "name": r["name"], "title": r["title"], "active": r["active"],
              "ignored": r["ignored"], "note": r["note"] or "", "mapped_to": mapped.get(r["no"])}
             for r in db.execute("SELECT * FROM elpass_cards ORDER BY active DESC, name").fetchall()]
    return jsonify({"configured": elpass_configured(), "objects": elpass_objects(), "last": last, "cards": cards})


@app.route("/api/hr/attendance-week", methods=["GET"])
def hr_attendance_week():
    """Отметки посещаемости за неделю (пн–вс) с именами — для вкладки в HR-панели. ?start=понедельник, по умолчанию текущая неделя."""
    db = get_db()
    today = date.fromisoformat(_astana_today())
    start_s = request.args.get("start") or (today - timedelta(days=today.weekday())).isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start_s):
        return jsonify({"error": "Дата в формате ГГГГ-ММ-ДД."}), 400
    start = date.fromisoformat(start_s)
    start -= timedelta(days=start.weekday())            # всегда с понедельника
    end = start + timedelta(days=6)
    rows = db.execute(
        "SELECT a.*, e.name AS emp_name, e.department AS emp_department, e.position AS emp_position, u.name AS set_by_name, u.login AS set_by_login "
        "FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN users u ON u.id = a.set_by "
        "WHERE a.date BETWEEN ? AND ? ORDER BY e.name, a.date", (start.isoformat(), end.isoformat())).fetchall()
    return jsonify({
        "start": start.isoformat(), "end": end.isoformat(), "today": today.isoformat(),
        "codes": list(ATTENDANCE_CODES.items()),
        "marks": [{"employee_id": r["employee_id"], "name": r["emp_name"], "department": r["emp_department"], "position": r["emp_position"] or "",
                   "date": r["date"], "code": r["code"], "comment": r["comment"] or "",
                   "set_by": r["set_by_name"] or r["set_by_login"] or "", "updated": r["updated"]} for r in rows],
    })


@app.route("/api/hr/accounts", methods=["GET"])
def hr_accounts():
    """По каждому сотруднику: есть ли учётка и заходил ли он. Нужно, чтобы видеть, кого «дожимать» к запуску."""
    db = get_db()
    users_ = [dict(r) for r in db.execute("SELECT login, email, name, last_login, must_set_password FROM users")]
    by_email = {(u["email"] or u["login"] or "").lower(): u for u in users_}
    by_name = {(u["name"] or "").lower(): u for u in users_ if u["name"]}
    out = []
    for e in db.execute("SELECT id, name, department, email FROM employees ORDER BY department, name"):
        u = by_email.get((e["email"] or "").lower()) if e["email"] else None
        u = u or by_name.get((e["name"] or "").lower())
        if not u:
            state = "none"
        elif u["must_set_password"]:
            state = "invited"
        elif u["last_login"]:
            state = "active"
        else:
            state = "ready"          # пароль задан, но ещё ни разу не входил
        out.append({"employee_id": e["id"], "name": e["name"], "department": e["department"],
                    "email": e["email"] or "", "state": state, "last_login": (u or {}).get("last_login")})
    return jsonify(out)


def _account_state_map(db):
    """employee_id → состояние учётки: none / invited / ready / active (та же логика, что в HR-панели)."""
    users_ = [dict(r) for r in db.execute("SELECT login, email, name, last_login, must_set_password FROM users")]
    by_email = {(u["email"] or u["login"] or "").lower(): u for u in users_}
    by_name = {(u["name"] or "").lower(): u for u in users_ if u["name"]}
    out = {}
    for e in db.execute("SELECT id, name, email FROM employees"):
        u = by_email.get((e["email"] or "").lower()) if e["email"] else None
        u = u or by_name.get((e["name"] or "").lower())
        out[e["id"]] = "none" if not u else ("invited" if u["must_set_password"] else ("active" if u["last_login"] else "ready"))
    return out


# ---------- задачник (25.09.2026, просьба пользователя) ----------
# Ставить задачи могут главы подразделений (своей команде, как в кабинете руководителя) и все, у кого в справочнике
# есть подчинённые (reports_to, вся цепочка вниз); админ — кому угодно. Исполнитель видит свои задачи и двигает статус:
# «Новая» → «В работе» → «На проверке»; руководитель принимает («Готово») или возвращает в работу с комментарием.
TASK_STATUSES = ("new", "work", "review", "done")


def _task_team(db, user):
    """(моя карточка, кому я могу ставить задачи)."""
    me_row = _my_employee(db, user)
    everyone = [dict(r) for r in db.execute("SELECT * FROM employees ORDER BY name")]
    if user["role"] == "admin":
        return me_row, [e for e in everyone if me_row is None or e["id"] != me_row["id"]]
    if me_row is None:
        return None, []
    ids = set()
    if me_row["is_head"]:
        ids = {e["id"] for e in _manager_team(db, user)[1]}
    bosses = {(me_row["name"] or "").strip().lower()}
    while True:      # подчинённые по reports_to и их подчинённые (сравнение в Python — lower() SQLite не сворачивает кириллицу)
        more = {e["id"] for e in everyone if e["id"] != me_row["id"] and e["id"] not in ids
                and (e["reports_to"] or "").strip().lower() in bosses}
        if not more:
            break
        ids |= more
        bosses |= {(e["name"] or "").strip().lower() for e in everyone if e["id"] in more}
    return me_row, [e for e in everyone if e["id"] in ids]


def _task_due(v):
    v = str(v or "").strip()
    return v if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) else ""


@app.route("/api/tasks", methods=["GET", "POST"])
def tasks_collection():
    db, user = get_db(), current_user()
    me_row, team = _task_team(db, user)
    if request.method == "GET":
        mine = [row_to_dict(r) for r in db.execute("SELECT * FROM tasks WHERE assignee_id=? ORDER BY created DESC",
                                                     (me_row["id"] if me_row is not None else "-",))]
        given = [row_to_dict(r) for r in db.execute("SELECT * FROM tasks WHERE author_id=? ORDER BY created DESC", (user["id"],))]
        return jsonify({"mine": mine, "given": given, "can_assign": bool(team),
                        "team": [{"id": e["id"], "name": e["name"], "position": e["position"] or "",
                                  "department": e["department"] or "", "unit": e["unit"] or ""} for e in team]})
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()[:300]
    if not title:
        return jsonify({"error": "Напишите, что нужно сделать."}), 400
    who = next((e for e in team if e["id"] == data.get("assignee_id")), None)
    if who is None:
        return jsonify({"error": "Ставить задачи можно только своим подчинённым."}), 403
    item = {"id": uuid.uuid4().hex, "title": title, "description": str(data.get("description") or "").strip()[:4000],
            "due": _task_due(data.get("due")), "assignee_id": who["id"], "assignee_name": who["name"],
            "author_id": user["id"], "author_emp_id": me_row["id"] if me_row is not None else None,
            "author_name": (me_row["name"] if me_row is not None else None) or user.get("name") or user["login"],
            "status": "new", "report": "", "feedback": "", "created": datetime.now().isoformat(timespec="seconds"),
            "updated": None, "done_at": None}
    db.execute(f"INSERT INTO tasks ({', '.join(item)}) VALUES ({', '.join('?' * len(item))})", tuple(item.values()))
    db.commit()
    return jsonify(item), 201


@app.route("/api/tasks/<item_id>", methods=["PUT", "DELETE"])
def tasks_item(item_id):
    """Править и удалять задачу может тот, кто её поставил, и админ."""
    db, user = get_db(), current_user()
    row = db.execute("SELECT * FROM tasks WHERE id=?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Задача не найдена."}), 404
    if row["author_id"] != user["id"] and user["role"] != "admin":
        return jsonify({"error": "Менять задачу может только тот, кто её поставил."}), 403
    if request.method == "DELETE":
        db.execute("DELETE FROM tasks WHERE id=?", (item_id,))
        db.commit()
        return jsonify({"deleted": item_id})
    data = request.get_json(silent=True) or {}
    upd = {}
    if "title" in data:
        upd["title"] = str(data["title"] or "").strip()[:300]
        if not upd["title"]:
            return jsonify({"error": "Напишите, что нужно сделать."}), 400
    if "description" in data:
        upd["description"] = str(data["description"] or "").strip()[:4000]
    if "due" in data:
        upd["due"] = _task_due(data["due"])
    if "assignee_id" in data and data["assignee_id"] != row["assignee_id"]:
        who = next((e for e in _task_team(db, user)[1] if e["id"] == data["assignee_id"]), None)
        if who is None:
            return jsonify({"error": "Ставить задачи можно только своим подчинённым."}), 403
        upd.update(assignee_id=who["id"], assignee_name=who["name"])
    upd["updated"] = datetime.now().isoformat(timespec="seconds")
    db.execute(f"UPDATE tasks SET {', '.join(f'{k}=?' for k in upd)} WHERE id=?", (*upd.values(), item_id))
    db.commit()
    return jsonify(row_to_dict(db.execute("SELECT * FROM tasks WHERE id=?", (item_id,)).fetchone()))


@app.route("/api/tasks/<item_id>/status", methods=["POST"])
def tasks_status(item_id):
    """{status, comment}. Исполнитель: new → work, new/work → review (сдать). Автор (и админ): review → done (принять),
    review/done → work (вернуть — только с комментарием)."""
    db, user = get_db(), current_user()
    row = db.execute("SELECT * FROM tasks WHERE id=?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Задача не найдена."}), 404
    data = request.get_json(silent=True) or {}
    to = str(data.get("status") or "")
    comment = str(data.get("comment") or "").strip()[:2000]
    me_row = _my_employee(db, user)
    is_assignee = me_row is not None and me_row["id"] == row["assignee_id"]
    is_author = row["author_id"] == user["id"] or user["role"] == "admin"
    cur = row["status"]
    upd = {"status": to}
    if is_assignee and to == "work" and cur == "new":
        pass
    elif is_assignee and to == "review" and cur in ("new", "work"):
        upd["report"] = comment
    elif is_author and to == "done" and cur in ("review", "work", "new"):
        upd["done_at"] = datetime.now().isoformat(timespec="seconds")
    elif is_author and to == "work" and cur in ("review", "done"):
        if not comment:
            return jsonify({"error": "Напишите, что нужно доработать."}), 400
        upd.update(feedback=comment, done_at=None)
    else:
        return jsonify({"error": "Этот статус сейчас поставить нельзя."}), 400
    upd["updated"] = datetime.now().isoformat(timespec="seconds")
    db.execute(f"UPDATE tasks SET {', '.join(f'{k}=?' for k in upd)} WHERE id=?", (*upd.values(), item_id))
    db.commit()
    return jsonify(row_to_dict(db.execute("SELECT * FROM tasks WHERE id=?", (item_id,)).fetchone()))


# ---------- кабинет руководителя: своя команда, её опоздания, табель, кто не в портале ----------
# Пункт меню виден всем, но внутрь пускаем только глав подразделений (is_head) и админа — решение пользователя 22.09.2026.
def _manager_team(db, user):
    """(карточка руководителя, его команда). Команда = его подразделение плюс все, кто указал его
    непосредственным руководителем. Админ без флага главы видит всю компанию — как наблюдатель."""
    me_row = _my_employee(db, user)
    everyone = [dict(r) for r in db.execute("SELECT * FROM employees ORDER BY department, name")]
    if me_row is not None and me_row["is_head"]:
        me_d = dict(me_row)
        # подразделение плюс вся цепочка подчинённых вниз (подчинённые подчинённых тоже) — иначе, например,
        # у CEO терялся Карибаев Азамат, который подчиняется Калиевой, а не CEO напрямую (23.09.2026)
        ids = {e["id"] for e in everyone if e["id"] != me_d["id"] and e["department"] == me_d["department"]}
        bosses = {me_d["name"].strip().lower()}
        while True:
            more = {e["id"] for e in everyone if e["id"] != me_d["id"] and e["id"] not in ids
                    and (e["reports_to"] or "").strip().lower() in bosses}
            if not more:
                break
            ids |= more
            bosses |= {e["name"].strip().lower() for e in everyone if e["id"] in more}
        team = [e for e in everyone if e["id"] in ids]
        return me_d, team
    if user["role"] == "admin":
        return (dict(me_row) if me_row is not None else {"name": user.get("name") or "Администратор", "department": ""}), \
            [e for e in everyone if me_row is None or e["id"] != me_row["id"]]
    return None, []


def _manager_team_req(db):
    """Команда для текущего запроса. Админ может открыть кабинет любого главы: ?as=<employee_id>."""
    user = current_user()
    as_id = (request.args.get("as") or "").strip()
    # временный режим «смотреть как руководитель N» для админа: settings.cabinet_view_as = employee_id
    # (включён по просьбе пользователя 22.09.2026, снять — очистить настройку)
    if not as_id and user["role"] == "admin":
        as_id = (_setting("cabinet_view_as") or "").strip()
    if as_id and user["role"] == "admin":
        row = db.execute("SELECT * FROM employees WHERE id=? AND is_head=1", (as_id,)).fetchone()
        if row is not None:
            return _manager_team(db, {"id": "as", "role": "user", "name": row["name"], "email": row["email"] or ""})
    return _manager_team(db, user)


def _manager_only():
    """403, если это не руководитель. Возвращает None, когда всё в порядке."""
    if not _is_manager(get_db(), current_user()):
        return jsonify({"error": "Кабинет руководителя доступен только руководителям подразделений."}), 403
    return None


AWAY_MIN = 30                 # вышел и не вернулся дольше получаса — «нет в офисе»; короче — не показываем вовсе (пользователь 22.09.2026)
LUNCH = ("13:00", "14:00")    # обед в отсутствие не засчитываем


def _today_presence(db, ids, today_s):
    """По проходам за сегодня: когда пришёл, последний проход (вход/выход) и сколько минут отсутствует.
    Турникет пишет и входы, и выходы — обед и короткий выезд отличаем от долгого по AWAY_MIN."""
    if not ids:
        return {}
    q = ",".join("?" * len(ids))
    events = {}
    for r in db.execute(f"SELECT employee_id, ts, direction, object FROM passes WHERE ts LIKE ? "
                        f"AND employee_id IN ({q}) ORDER BY ts", (today_s + "%", *ids)):
        events.setdefault(r["employee_id"], []).append((r["ts"], r["direction"], r["object"] or ""))
    now = datetime.utcnow() + timedelta(hours=5)
    out = {}
    for eid, evs in events.items():
        ins = [e for e in evs if e[1] == "in"]
        if not ins:
            continue                      # только выходы без входа — считать нечего
        first_ts, _, obj = ins[0]
        last_ts, last_dir, _ = evs[-1]
        p = {"arrived": first_ts[11:16], "office": ELPASS_LABELS.get(obj, obj), "last_dir": last_dir, "last_at": last_ts[11:16],
             "exits": sum(1 for e in evs if e[1] == "out")}
        if last_dir == "out":
            left = datetime.fromisoformat(last_ts)
            away = (now - left).total_seconds() / 60
            # обеденный час не считаем: вычитаем, сколько из отсутствия пришлось на 13:00–14:00
            l_start = datetime.combine(left.date(), datetime.strptime(LUNCH[0], "%H:%M").time())
            l_end = datetime.combine(left.date(), datetime.strptime(LUNCH[1], "%H:%M").time())
            overlap = (min(now, l_end) - max(left, l_start)).total_seconds() / 60
            p["away_min"] = int(away - max(0, overlap))
        out[eid] = p
    return out


@app.route("/api/manager/team")
def manager_team():
    """Команда сегодня: кто в офисе (по турникету), кто на объекте / болеет / в отпуске (по табелю),
    кто удалённо, у кого скоро день рождения, у кого нет учётки в портале."""
    if (deny := _manager_only()) is not None:
        return deny
    db = get_db()
    me_d, team = _manager_team_req(db)
    today_s = _astana_today()
    today = date.fromisoformat(today_s)
    ids = [e["id"] for e in team]
    if not ids:
        return jsonify({"me": me_d, "today": today_s, "team": [], "codes": list(ATTENDANCE_CODES.items())})
    q = ",".join("?" * len(ids))
    presence = _today_presence(db, ids, today_s)
    mark_today = {r["employee_id"]: {"code": r["code"], "comment": r["comment"] or ""}
                  for r in db.execute(f"SELECT employee_id, code, comment FROM attendance WHERE date=? AND employee_id IN ({q})",
                                      (today_s, *ids))}
    # отпуска: сегодня и в ближайшие две недели (конец периода ищем до +45 дней)
    horizon = (today + timedelta(days=14)).isoformat()
    vac_rows = {}
    for r in db.execute(f"SELECT employee_id, date, code FROM attendance WHERE code IN ('Т','БС') AND date BETWEEN ? AND ? "
                        f"AND employee_id IN ({q}) ORDER BY date", (today_s, (today + timedelta(days=45)).isoformat(), *ids)):
        vac_rows.setdefault(r["employee_id"], []).append((r["date"], r["code"]))
    accounts = _account_state_map(db)
    out = []
    for e in team:
        st = {"id": e["id"], "name": e["name"], "position": e["position"] or "", "department": e["department"],
              "unit": e["unit"] or "", "is_head": bool(e["is_head"]), "schedule": e["schedule"] or "",
              "photo": e["photo"] or "", "remote": bool(e["remote"]), "account": accounts.get(e["id"], "none"),
              "has_card": bool((e["elpass_id"] or "").strip())}
        if e["id"] in presence:
            st.update(presence[e["id"]])
            st["present"] = presence[e["id"]]["last_dir"] == "in" or presence[e["id"]].get("away_min", 0) <= AWAY_MIN
        if e["id"] in mark_today:
            st["mark"] = mark_today[e["id"]]
        rows = vac_rows.get(e["id"], [])
        if rows and rows[0][0] <= horizon:
            start_d = rows[0][0]
            end_d = start_d
            for d_s, _ in rows[1:]:
                if date.fromisoformat(d_s) == date.fromisoformat(end_d) + timedelta(days=1):
                    end_d = d_s
                else:
                    break
            st["vacation"] = {"start": start_d, "end": end_d, "code": rows[0][1], "now": start_d <= today_s}
        if e["birthday"]:
            try:
                bd = date.fromisoformat(e["birthday"][:10])
                nxt = bd.replace(year=today.year)
                if nxt < today:
                    nxt = nxt.replace(year=today.year + 1)
                if (nxt - today).days <= 14:
                    st["birthday_in"] = (nxt - today).days
            except ValueError:
                pass
        out.append(st)
    return jsonify({"me": me_d, "today": today_s, "team": out, "codes": list(ATTENDANCE_CODES.items()), "away_min": AWAY_MIN,
                    "view_as": bool(current_user()["role"] == "admin" and not request.args.get("as") and _setting("cabinet_view_as")),
                    "has_passes": db.execute("SELECT 1 FROM passes LIMIT 1").fetchone() is not None})


@app.route("/api/manager/lateness")
def manager_lateness():
    """Опоздания только своей команды — тот же расчёт, что у админа, отфильтрованный по людям."""
    if (deny := _manager_only()) is not None:
        return deny
    start_s = request.args.get("start") or ""
    if start_s and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start_s):
        return jsonify({"error": "Дата в формате ГГГГ-ММ-ДД."}), 400
    start, end = _week_bounds(start_s)
    db = get_db()
    _, team = _manager_team_req(db)
    ids = {e["id"] for e in team}
    names = {e["name"] for e in team}
    r = compute_lateness(db, start, end)
    r["late"] = [x for x in r["late"] if x["employee_id"] in ids]
    r["excused"] = [x for x in r["excused"] if x["employee_id"] in ids]
    r["remote_names"] = [n for n in r["remote_names"] if n in names]
    r["unmapped_names"] = [n for n in r["unmapped_names"] if n in names]
    r["unmapped"] = len(r["unmapped_names"])
    r["mapped_names"] = [n for n in r["mapped_names"] if n in names]
    r["mapped"] = len(r["mapped_names"])
    r.update({"start": start.isoformat(), "end": end.isoformat(), "today": _astana_today(),
              "codes": list(ATTENDANCE_CODES.items()), "team_size": len(team)})
    return jsonify(r)


@app.route("/api/manager/attendance")
def manager_attendance():
    """Табель своей команды за месяц — только просмотр, отметки ставят сами сотрудники и HR."""
    if (deny := _manager_only()) is not None:
        return deny
    month = request.args.get("month") or _astana_today()[:7]
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        return jsonify({"error": "Месяц в формате ГГГГ-ММ."}), 400
    db = get_db()
    _, team = _manager_team_req(db)
    ids = [e["id"] for e in team]
    marks = {}
    if ids:
        q = ",".join("?" * len(ids))
        for r in db.execute(f"SELECT * FROM attendance WHERE date LIKE ? AND employee_id IN ({q})", (month + "-%", *ids)):
            marks.setdefault(r["employee_id"], {})[r["date"]] = {"code": r["code"], "comment": r["comment"] or ""}
    return jsonify({"month": month, "codes": list(ATTENDANCE_CODES.items()), "staff": False, "readonly": True,
                    "today": _astana_today(), "can_edit_from": None, "can_edit_to": None,
                    "employees": [{"id": e["id"], "name": e["name"], "position": e["position"] or "",
                                   "department": e["department"], "schedule": e["schedule"] or ""} for e in team],
                    "marks": marks})


@app.route("/api/hr/invite", methods=["POST"])
def hr_invite():
    """HR выдаёт сотруднику ссылку-приглашение. Роль всегда «Сотрудник» — админов и HR назначает только админ."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    emp = db.execute("SELECT * FROM employees WHERE id=?", (data.get("employee_id"),)).fetchone()
    if emp is None:
        return jsonify({"error": "Сотрудник не найден."}), 404
    email = (emp["email"] or "").strip().lower()
    if not email:
        return jsonify({"error": "Сначала укажите сотруднику корпоративную почту — по ней он будет входить."}), 400
    user = db.execute("SELECT * FROM users WHERE lower(email)=? OR lower(login)=?", (email, email)).fetchone()
    if user and not user["must_set_password"]:
        return jsonify({"error": "У этого сотрудника уже есть пароль. Сбросить его может администратор."}), 400
    if user:
        uid = user["id"]
    else:
        uid = uuid.uuid4().hex
        db.execute(
            "INSERT INTO users (id, login, password_hash, name, role, email, created) VALUES (?, ?, '!invited', ?, 'user', ?, ?)",
            (uid, email, emp["name"], email, datetime.now().isoformat(timespec="seconds")),
        )
    link = _invite_url(_new_invite(db, uid))
    db.commit()
    return jsonify({"invite_url": link, "name": emp["name"], "login": email})


# ---------- about (company intro for roadmap) ----------
@app.route("/api/about", methods=["GET", "PUT"])
def about_singleton():
    db = get_db()
    if request.method == "GET":
        row = db.execute("SELECT * FROM about WHERE id='main'").fetchone()
        if row is None:
            return jsonify({"id": "main", "title": "", "body": ""})
        return jsonify(row_to_dict(row))

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    db.execute(
        "INSERT INTO about (id, title, body) VALUES ('main', ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body",
        (title, body),
    )
    db.commit()
    return jsonify({"id": "main", "title": title, "body": body})

# ---------- «Миссия и ценности» (07.10.2026) ----------
# Слова пользователя: «надо сделать ценности компании и миссию, проверь весь документ, сделай новую вкладку после программы
# лояльности», название «Миссия и ценности» — его выбор. Миссия и видение — дословно со стр. 4 презентации
# «CH_RU_General Profile» (она же лежит в базе знаний); ценностей в презентации нет — черновик по её духу составил Claude
# («сформируй из пдф как-нибудь сам»), ждёт утверждения (хвост). Тексты хранятся в таблице about строками mission / vision /
# values; пока строки нет — показывается текст отсюда. Правят админ и HR (/api/values в HR_WRITABLE_PREFIX).
VALUES_KEYS = ("mission", "vision", "values")
VALUES_DEFAULT = {
    "mission": """Наша миссия в Connected Home — использовать инновации, исследования и передовую IT-экспертизу для создания комплексных умных решений, повышающих уровень комфорта, безопасности и эффективности. С 2018 года мы разрабатываем современные платформы и приложения на базе искусственного интеллекта, которые:
• трансформируют жилые пространства с помощью автоматизации домов и зданий;
• оптимизируют мобильность благодаря интеллектуальным парковочным и городским решениям;
• повышают уровень безопасности с использованием систем распознавания лиц и мониторинга автозаправочных станций;
• переосмысливают отрасли за счёт индивидуальных решений для гостиничного бизнеса, складской автоматизации и умных кинотеатров;
• внедряют инновации в сфере кино, предоставляя комплексные решения для внутренних и уличных кинотеатров — от аппаратной инфраструктуры до иммерсивных программных платформ, формируя новые стандарты индустрии развлечений.

Благодаря сильному R&D, стратегическим партнёрствам и постоянным инновациям мы помогаем нашим клиентам достигать операционного совершенства, оптимизировать ресурсы и предотвращать риски ещё до их возникновения. Наша цель — задавать новые стандарты в сфере умной инфраструктуры и IT, создавая долгосрочную ценность для людей, бизнеса и сообществ.""",
    "vision": """Наше видение — переосмыслить современные жилые и рабочие пространства, создавая интеллектуальные экосистемы, управляемые искусственным интеллектом. Мы стремимся сделать каждый дом, виллу и коммерческий объект умнее, безопаснее и экологичнее за счёт бесшовной автоматизации и подключения в реальном времени.

Развивая IT-решения в различных отраслях — от жилой автоматизации до городской мобильности, гостиничного бизнеса, киноиндустрии и промышленности — мы создаём будущее, в котором технологии не только упрощают повседневную жизнь, но и обеспечивают устойчивость, энергоэффективность и проактивную безопасность.""",
    "values": """Инновации — Создаём, а не копируем: собственный R&D и платформы на базе искусственного интеллекта.
Безопасность — Предотвращаем риски до их возникновения: спокойствие людей заложено в каждое решение.
Качество — Премиальный уровень и промышленная надёжность во всём, что делаем.
Партнёрство — Растём вместе с клиентами и партнёрами: их результат — наш результат.
Устойчивость — Энергоэффективность и экологичность в каждом проекте.
Ответственность — Бесперебойная работа и мгновенная реакция — наша норма, а не исключение.""",
}


def _values(db):
    """Миссия, видение и ценности: из таблицы about (строки mission/vision/values), иначе текст по умолчанию."""
    rows = {r["id"]: r["body"] for r in db.execute("SELECT id, body FROM about WHERE id IN ('mission','vision','values')")}
    return {k: (rows.get(k) or VALUES_DEFAULT[k]) for k in VALUES_KEYS}


@app.route("/api/values", methods=["GET"])
def values_get():
    return jsonify(_values(get_db()))


@app.route("/api/values/<key>", methods=["PUT"])
def values_put(key):
    """Правят админ и HR. Пустой текст возвращает текст по умолчанию."""
    if key not in VALUES_KEYS:
        return jsonify({"error": "Нет такого блока."}), 404
    db = get_db()
    body = ((request.get_json(silent=True) or {}).get("body") or "").strip()[:8000]
    db.execute("INSERT INTO about (id, title, body) VALUES (?, '', ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body", (key, body))
    db.commit()
    return jsonify(_values(db))


# ---------- Connected WorkFlow (08.10.2026) ----------
# Слова пользователя: «PM или аналитик пишут агенту „хочу поменять на портале то-то“, и через агента это всё делается»;
# «пусть он будет внутри Community: создай в инструментах вкладку Connected Cowork» (переименовано в WorkFlow 08.10). Его решения кнопками: доступ только по
# допуску; исполнитель — Claude, позже, работает в GitHub отдельно от сайта; лимита заданий нет; переписка в базу знаний
# Connect AI не попадает; ничего не уезжает на сайт без его кнопки «Принять». Этап 1 — приёмщик, очередь, приёмка;
# этап 2 — исполнитель (docs/cowork.md).
COWORK_PER_HOUR = 60
COWORK_PROMPT = """Ты — приёмщик заданий в Connected WorkFlow, инструменте внутреннего портала компании Connected Home. \
К тебе приходят менеджеры и аналитики, которые хотят что-то изменить на портале. Твоя работа — превратить просьбу в чёткое \
задание для разработчика, не делая его самому.

Разделы портала: Новости, Сотрудники (справочник, Community Road Map), Компания (Проекты, Партнёры, Руководство), \
Новым сотрудникам, Программа лояльности, Миссия и ценности, Вакансии, Медиа (ивенты, видео), База знаний, \
Connect AI (помощник), Календарь, Заявки (командировка, техника, отпуск, увольнение, компенсация и другие), Задачи, \
Шаблоны документов, Посещаемость, Мой отпуск, Карта офиса, Кабинет руководителя, Предложения, Мини-игры, \
HR-панель, Панель закупщика, Панель бухгалтера, Админ-панель, Личный кабинет.

Как работать:
- Отвечай по-русски, коротко, простым текстом без markdown и без звёздочек.
- Если непонятно, задай не больше одного уточняющего вопроса за раз; всего уточнений — не больше трёх. \
Выясни: в каком разделе, что именно должно измениться на экране, кто это увидит (все, HR, руководители…), как понять, что сделано.
- Не проси личные данные людей (телефоны, паспорта, зарплаты) — заданию они не нужны.
- Когда всё ясно, напиши одну фразу «Собрал задание, проверьте карточку» и в самой последней строке выведи ровно: \
[[ЗАДАНИЕ]] {"title": "...", "section": "...", "what": "...", "who": "...", "check": "..."}
где title — короткое название (до 60 знаков), section — раздел портала, what — что сделать (2–4 предложения), \
who — кто увидит, check — как проверить. JSON в одну строку, без переносов."""

_cowork_log = {}


def _cowork_json(r):
    d = dict(r)
    for k in ("spec", "chat"):
        try:
            d[k] = json.loads(d[k] or "null")
        except ValueError:
            d[k] = None
    return d


@app.route("/api/cowork/chat", methods=["POST"])
def cowork_chat():
    """Чат с приёмщиком: уточняет просьбу и в конце отдаёт карточку задания; отправляет его в работу сам человек кнопкой."""
    user = current_user()
    if not _can_cowork(user):
        return jsonify({"error": "Connected WorkFlow открыт только по допуску администратора."}), 403
    now = time.time()
    recent = [t for t in _cowork_log.get(user["id"], []) if now - t < 3600]
    if len(recent) >= COWORK_PER_HOUR:
        return jsonify({"error": "Слишком много сообщений за час. Продолжим чуть позже."}), 429
    _cowork_log[user["id"]] = recent + [now]
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()[:2000]
    if not message:
        return jsonify({"error": "Сообщение пустое"}), 400
    api_key = get_api_key()
    if not api_key:
        return jsonify({"error": "Приёмщик пока не настроен. Обратитесь к администратору портала."}), 503
    contents = []
    for m in (data.get("history") or [])[-20:]:
        if isinstance(m, dict) and m.get("role") in ("user", "bot") and str(m.get("text") or "").strip():
            contents.append({"role": "user" if m["role"] == "user" else "model", "parts": [{"text": str(m["text"])[:2000]}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    reply, last_err = "", None
    for model in AI_MODELS:
        ok, result = call_gemini(model, api_key, COWORK_PROMPT, contents)
        if ok and str(result or "").strip():
            reply = str(result).strip()
            break
        last_err = result
    if not reply:
        _svc_mark("cowork", False, last_err or "нет ответа")
        return jsonify({"error": "Приёмщик не ответил. Попробуйте ещё раз через минуту."}), 502
    task = None
    m = re.search(r"\[\[ЗАДАНИЕ\]\]\s*`*(?:json)?\s*(\{.*\})", reply, re.S)
    if m:
        try:
            raw = json.loads(m.group(1), strict=False)          # модель может вставить перенос строки внутри текста
            task = {k: str(raw.get(k) or "").strip()[:1500] for k in ("title", "section", "what", "who", "check")}
            task["title"] = task["title"][:80] or "Задание"
        except ValueError:
            task = None
        reply = reply[:m.start()].strip()
        if task is None:
            reply = (reply + chr(10) + "Не получилось собрать карточку задания. Напишите ещё раз, что нужно сделать, одним сообщением.").strip()
        elif not reply:
            reply = "Собрал задание, проверьте карточку."
    _svc_mark("cowork", True, "приёмщик ответил")
    return jsonify({"reply": reply, "task": task})


@app.route("/api/cowork/tasks", methods=["GET", "POST"])
def cowork_tasks():
    user = current_user()
    if not _can_cowork(user):
        return jsonify({"error": "Connected WorkFlow открыт только по допуску администратора."}), 403
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM cowork_tasks ORDER BY created DESC LIMIT 200").fetchall()
        out = []
        for r in rows:
            d = _cowork_json(r)
            if r["author_id"] != user["id"] and user["role"] != "admin":
                d["chat"] = None                              # переписку с приёмщиком видят только автор и админ (Security Engineer 08.10.2026)
            out.append(d)
        return jsonify(out)
    data = request.get_json(silent=True) or {}
    spec = data.get("spec") if isinstance(data.get("spec"), dict) else {}
    spec = {k: str(spec.get(k) or "").strip()[:1500] for k in ("section", "what", "who", "check")}
    title = (data.get("title") or "").strip()[:80]
    if not title or not spec["what"]:
        return jsonify({"error": "В задании нужны название и описание, что сделать."}), 400
    chat = [m for m in (data.get("chat") or []) if isinstance(m, dict) and m.get("role") in ("user", "bot")][-40:]
    chat = [{"role": m["role"], "text": str(m.get("text") or "")[:2000]} for m in chat]
    now = datetime.now().isoformat(timespec="seconds")
    item = {"id": uuid.uuid4().hex, "author_id": user["id"], "author_name": user["name"] or user["login"], "title": title,
            "spec": json.dumps(spec, ensure_ascii=False), "chat": json.dumps(chat, ensure_ascii=False), "status": "queued",
            "pr_url": "", "result": "", "created": now, "updated": now}
    db.execute("INSERT INTO cowork_tasks (id, author_id, author_name, title, spec, chat, status, pr_url, result, created, updated) "
               "VALUES (:id, :author_id, :author_name, :title, :spec, :chat, :status, :pr_url, :result, :created, :updated)", item)
    db.commit()
    return jsonify(_cowork_json(db.execute("SELECT * FROM cowork_tasks WHERE id=?", (item["id"],)).fetchone())), 201


@app.route("/api/cowork/tasks/<item_id>/cancel", methods=["POST"])
def cowork_cancel(item_id):
    """Автор отзывает своё задание, пока его не взяли в работу; админ — любое."""
    user = current_user()
    if not _can_cowork(user):
        return jsonify({"error": "Нет доступа."}), 403
    db = get_db()
    row = db.execute("SELECT * FROM cowork_tasks WHERE id=?", (item_id,)).fetchone()
    if row is None or (row["author_id"] != user["id"] and user["role"] != "admin"):
        return jsonify({"error": "Задание не найдено."}), 404
    if row["status"] not in ("queued", "review", "failed"):
        return jsonify({"error": "Это задание уже нельзя отменить."}), 400
    db.execute("UPDATE cowork_tasks SET status='cancelled', updated=? WHERE id=?", (datetime.now().isoformat(timespec="seconds"), item_id))
    db.commit()
    return jsonify(_cowork_json(db.execute("SELECT * FROM cowork_tasks WHERE id=?", (item_id,)).fetchone()))


@app.route("/api/cowork/tasks/<item_id>/decide", methods=["POST"])
def cowork_decide(item_id):
    """Владелец принимает или отклоняет изменение; этап 1 — только статус и ссылка, этап 2 — слияние на GitHub."""
    user = current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Принимать изменения может только администратор."}), 403
    db = get_db()
    row = db.execute("SELECT * FROM cowork_tasks WHERE id=?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Задание не найдено."}), 404
    data = request.get_json(silent=True) or {}
    decision = data.get("decision")
    comment = (data.get("comment") or "").strip()[:2000]
    pr_url = _clean_url(data.get("pr_url")) if data.get("pr_url") else row["pr_url"]
    now = datetime.now().isoformat(timespec="seconds")
    if decision == "link":                                     # этап 1: приложить ссылку на изменение и выставить на приёмку
        if not pr_url:
            return jsonify({"error": "Нужна ссылка на изменение (адрес pull request)."}), 400
        if row["status"] not in ("queued", "running", "review"):
            return jsonify({"error": "Это задание уже закрыто."}), 400
        db.execute("UPDATE cowork_tasks SET pr_url=?, status='review', updated=? WHERE id=?", (pr_url or "", now, item_id))
    elif decision in ("accept", "reject"):
        if decision == "reject" and not comment:
            return jsonify({"error": "Напишите причину отказа — автор её увидит."}), 400
        db.execute("UPDATE cowork_tasks SET status=?, result=?, pr_url=?, updated=? WHERE id=?",
                   ("accepted" if decision == "accept" else "rejected", comment, pr_url or "", now, item_id))
    else:
        return jsonify({"error": "Неизвестное решение."}), 400
    db.commit()
    return jsonify(_cowork_json(db.execute("SELECT * FROM cowork_tasks WHERE id=?", (item_id,)).fetchone()))


@app.route("/api/cowork/tasks/<item_id>/notes", methods=["GET", "POST"])
def cowork_notes(item_id):
    """Замечания к заданию: любой допущенный читает и пишет (это рабочий разговор о правке, не личные данные)."""
    user = current_user()
    if not _can_cowork(user):
        return jsonify({"error": "Нет доступа."}), 403
    db = get_db()
    if db.execute("SELECT 1 FROM cowork_tasks WHERE id=?", (item_id,)).fetchone() is None:
        return jsonify({"error": "Задание не найдено."}), 404
    if request.method == "GET":
        return jsonify([dict(r) for r in db.execute("SELECT * FROM cowork_notes WHERE task_id=? ORDER BY created", (item_id,))])
    text = str((request.get_json(silent=True) or {}).get("text") or "").strip()[:2000]
    if not text:
        return jsonify({"error": "Пустое замечание."}), 400
    now = datetime.now().isoformat(timespec="seconds")
    nid = uuid.uuid4().hex
    db.execute("INSERT INTO cowork_notes (id, task_id, author_id, author_name, text, created) VALUES (?,?,?,?,?,?)",
               (nid, item_id, user["id"], user["name"] or user["login"], text, now))
    db.execute("UPDATE cowork_tasks SET updated=? WHERE id=?", (now, item_id))
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM cowork_notes WHERE id=?", (nid,)).fetchone())), 201


@app.route("/api/cowork/notes", methods=["GET"])
def cowork_notes_all():
    """Вкладка «Замечания»: последние замечания по всем заданиям, с названием задания."""
    if not _can_cowork(current_user()):
        return jsonify({"error": "Нет доступа."}), 403
    rows = get_db().execute("SELECT n.*, t.title AS task_title, t.status AS task_status FROM cowork_notes n JOIN cowork_tasks t ON t.id=n.task_id "
                            "ORDER BY n.created DESC LIMIT 100").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/cowork/materials", methods=["GET", "POST"])
def cowork_materials():
    """Материалы для агента: читают допущенные, ведёт админ."""
    user = current_user()
    if not _can_cowork(user):
        return jsonify({"error": "Нет доступа."}), 403
    db = get_db()
    if request.method == "GET":
        return jsonify([dict(r) for r in db.execute("SELECT * FROM cowork_materials ORDER BY updated DESC")])
    if user["role"] != "admin":
        return jsonify({"error": "Материалы ведёт администратор."}), 403
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()[:200]
    if not title:
        return jsonify({"error": "Нужно название."}), 400
    now = datetime.now().isoformat(timespec="seconds")
    mid = uuid.uuid4().hex
    db.execute("INSERT INTO cowork_materials (id, title, body, url, created, updated) VALUES (?,?,?,?,?,?)",
               (mid, title, str(data.get("body") or "").strip()[:8000], _clean_url(str(data.get("url") or "")), now, now))
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM cowork_materials WHERE id=?", (mid,)).fetchone())), 201


@app.route("/api/cowork/materials/<item_id>", methods=["PUT", "DELETE"])
def cowork_material(item_id):
    user = current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Материалы ведёт администратор."}), 403
    db = get_db()
    if db.execute("SELECT 1 FROM cowork_materials WHERE id=?", (item_id,)).fetchone() is None:
        return jsonify({"error": "Материал не найден."}), 404
    if request.method == "DELETE":
        db.execute("DELETE FROM cowork_materials WHERE id=?", (item_id,)); db.commit()
        return jsonify({"deleted": item_id})
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()[:200]
    if not title:
        return jsonify({"error": "Нужно название."}), 400
    db.execute("UPDATE cowork_materials SET title=?, body=?, url=?, updated=? WHERE id=?",
               (title, str(data.get("body") or "").strip()[:8000], _clean_url(str(data.get("url") or "")), datetime.now().isoformat(timespec="seconds"), item_id))
    db.commit()
    return jsonify(dict(db.execute("SELECT * FROM cowork_materials WHERE id=?", (item_id,)).fetchone()))


@app.route("/api/cowork/settings", methods=["GET"])
def cowork_settings():
    """Вкладка «Настройки» (только админ): что подключено. Ключи наружу не отдаются — только «есть / нет»."""
    user = current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Настройки видит только администратор."}), 403
    db = get_db()
    q = {r[0]: r[1] for r in db.execute("SELECT status, COUNT(*) FROM cowork_tasks GROUP BY status")}
    return jsonify({"ai_key": bool(get_api_key()), "repo": "https://github.com/Durotan312/Community", "executor": None,
                    "queue": q, "users": [dict(r) for r in db.execute("SELECT id, login, name, role, cowork FROM users WHERE role<>'admin' ORDER BY name, login")]})


# ---------- leaders (roadmap tab) ----------
@app.route("/api/leaders", methods=["GET", "POST"])
def leaders_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM leaders ORDER BY rowid ASC").fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    position = (data.get("position") or "").strip()
    photo = _clean_url(data.get("photo"))
    bio = (data.get("bio") or "").strip()
    email = (data.get("email") or "").strip()
    story = (data.get("story") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    item = {
        "id": uuid.uuid4().hex,
        "name": name,
        "position": position,
        "photo": photo,
        "bio": bio,
        "email": email,
        "story": story,
    }
    db.execute(
        "INSERT INTO leaders (id, name, position, photo, bio, email, story) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (item["id"], item["name"], item["position"], item["photo"], item["bio"], item["email"], item["story"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/leaders/<item_id>", methods=["PUT", "DELETE"])
def leaders_item(item_id):
    db = get_db()
    if request.method == "PUT":
        row = db.execute("SELECT * FROM leaders WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            return jsonify({"error": "not found"}), 404
        data = request.get_json(force=True) or {}
        updates = {}
        for f in ("name", "position", "photo", "bio", "email", "story"):
            if f in data:
                updates[f] = _clean_url(data[f]) if f == "photo" else (data[f] or "").strip()
        if "name" in updates and not updates["name"]:
            return jsonify({"error": "name is required"}), 400
        if updates:
            db.execute(f"UPDATE leaders SET {', '.join(f'{f} = ?' for f in updates)} WHERE id = ?", (*updates.values(), item_id))
            db.commit()
        return jsonify(row_to_dict(db.execute("SELECT * FROM leaders WHERE id = ?", (item_id,)).fetchone()))
    db.execute("DELETE FROM leaders WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"deleted": item_id})


# ---------- onboarding steps (roadmap checklist) ----------
@app.route("/api/onboarding", methods=["GET", "POST"])
def onboarding_collection():
    db = get_db()
    if request.method == "GET":
        rows = db.execute("SELECT * FROM onboarding_steps ORDER BY rowid ASC").fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    item = {"id": uuid.uuid4().hex, "title": title, "description": description}
    db.execute(
        "INSERT INTO onboarding_steps (id, title, description) VALUES (?, ?, ?)",
        (item["id"], item["title"], item["description"]),
    )
    db.commit()
    return jsonify(item), 201


@app.route("/api/onboarding/<item_id>", methods=["PUT", "DELETE"])
def onboarding_item(item_id):
    db = get_db()
    if request.method == "DELETE":
        db.execute("DELETE FROM onboarding_steps WHERE id = ?", (item_id,))
        db.commit()
        return jsonify({"deleted": item_id})

    row = db.execute("SELECT * FROM onboarding_steps WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    data = request.get_json(force=True) or {}
    title = (data.get("title") or row["title"]).strip()
    description = (data.get("description") if "description" in data else row["description"] or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    db.execute("UPDATE onboarding_steps SET title = ?, description = ? WHERE id = ?", (title, description, item_id))
    db.commit()
    return jsonify({"id": item_id, "title": title, "description": description})


# =========================================================
# AI ASSISTANT ("ИИ Справочник")
# =========================================================

AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Пробуются по очереди: если модель занята или отключена, берётся следующая.
# Первая — быстрая и умная, вторая — самая быстрая, третья — самая сильная (но медленнее).
# Порядок — по скорости ответа (замер 09.09.2026): lite-модели отвечают за 1–4 с,
# «полные» flash — 20–30 с и чаще упираются в бесплатный лимит.
AI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]

# Сколько последних сообщений диалога передавать модели (чтобы помнила контекст).
MAX_HISTORY = 12

AI_SYSTEM_PROMPT = """Ты — Connect AI, внутренний помощник компании Connected Home \
на корпоративном портале "Connected Community". Ты отвечаешь на вопросы сотрудников.

ГЛАВНОЕ ПРАВИЛО: отвечай ТОЛЬКО на основании данных портала, которые приведены ниже \
в блоке «ДАННЫЕ ПОРТАЛА». Не придумывай факты, не используй общие знания о том, как \
"обычно бывает в компаниях", не догадывайся.

Если в данных портала нет ответа на вопрос — так и скажи: коротко сообщи, что такой \
информации в справочнике пока нет, и посоветуй обратиться к HR или руководителю. \
Не пытайся ответить приблизительно.

Как отвечать:
- По-русски, вежливо и коротко — 1–4 предложения, если вопрос не требует большего.
- Простым текстом, без markdown-разметки, без звёздочек и решёток.
- Если вопрос про конкретного человека (контакты, отдел, должность) — бери данные из \
списка сотрудников и руководителей.
- Вопросы «кто знает…», «кто умеет…», «кто увлекается…», «кто говорит по-…» — отвечай по полям \
«знает / чем может помочь», «хобби», «языки» в списке сотрудников (их люди заполняют сами в личном кабинете, \
раздел «О себе»); если таких отметок ни у кого нет — так и скажи.
- Если уместно, укажи, в каком разделе портала сотрудник найдёт подробности. \
- Бланки для скачивания (заявка на командировку, заявка на подбор, технические шаблоны) лежат в разделе «Шаблоны документов» в левом меню. \
- Буклеты, прайсы, брендбук, презентации, регламенты и инструкции лежат только в разделе «База знаний» — \
  отвечая по их содержимому, ссылайся именно на этот раздел, а не на другие. \
Разделы называются так: «Новости», «Сотрудники», «Календарь», «Проекты», \
«Шаблоны документов», «Новым сотрудникам», «Программа лояльности», «Наши партнёры». \
С кем работает компания (застройщики, госорганы, поставщики оборудования) — раздел «Наши партнёры». \
Все сотрудники, их контакты, кто кому подчиняется и из каких \
подразделений состоит компания — раздел «Сотрудники» (подразделы «Community Road Map» и «Все сотрудники»). \
Фотографии прошедших мероприятий — подраздел «Ивенты» внутри раздела «Новости». Список вопросов и ответов называется \
«Частые вопросы» и открывается кнопкой внутри раздела «Новым сотрудникам». \
Про объекты и продукты компании — это раздел «Проекты».
- Это живой диалог: учитывай предыдущие сообщения. Если сотрудник уточняет или \
задаёт короткий вопрос вроде «а если нет?» — пойми его в контексте переписки.
- Не здоровайся в каждом сообщении. Приветствие уместно только в первом ответе."""


def get_api_key():
    """Ключ берётся из файла api_key.txt рядом с app.py либо из переменной окружения."""
    if API_KEY_FILE.exists():
        for line in API_KEY_FILE.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                return line
    return (os.environ.get("GEMINI_API_KEY") or "").strip()


def call_gemini(model, api_key, system_text, contents, max_tokens=2048):
    """Возвращает (True, ответ) либо (False, текст ошибки). Оставляет отметку для вкладки «Сервисы»."""
    ok, result = _call_gemini(model, api_key, system_text, contents, max_tokens)
    # Сбой одной модели — ещё не сбой Connect AI: следующая по списку обычно отвечает. Раньше каждая неответившая модель
    # оставляла отметку «не прошёл», и на вкладке «Сервисы» и в утреннем отчёте висело ложное предупреждение
    # (07.10.2026: пользователю в Telegram пришло «последний запрос не прошёл», хотя бот отвечал). Теперь сбоем считается
    # только случай, когда не ответила ни одна модель, — его отмечает ai_all_failed() там, где перебор закончился.
    if ok:
        _svc_mark("ai", True, model)
    elif not str(result).startswith("__TRY_NEXT__"):
        _svc_mark("ai", False, str(result))
    return ok, result


def ai_all_failed(skipped):
    """Ни одна модель из AI_MODELS не ответила — вот это и есть сбой Connect AI."""
    last = [str(x).replace("__TRY_NEXT__ ", "") for x in (skipped if isinstance(skipped, (list, tuple)) else [skipped]) if x]
    _svc_mark("ai", False, "не ответила ни одна модель: " + "; ".join(last)[:300] if last else "не ответила ни одна модель")


def ai_selfcheck():
    """Раз в час, только если последняя отметка — сбой: короткий вопрос первой ответившей модели. Сбой был разовым —
    предупреждение снимется само, а не будет висеть до следующего вопроса сотрудника."""
    if not get_api_key() or not _svc_failed(_svc_get("ai")):
        return None
    skipped = []
    for model in AI_MODELS:
        ok, res = call_gemini(model, get_api_key(), "Отвечай одним словом.", [{"role": "user", "parts": [{"text": "Скажи: готов"}]}], max_tokens=20)
        if ok:
            return True
        skipped.append(res)
    ai_all_failed(skipped)
    return False


def _call_gemini(model, api_key, system_text, contents, max_tokens=2048):
    payload = json.dumps(
        {
            "systemInstruction": {"parts": [{"text": system_text}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens,
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        AI_ENDPOINT.format(model=model),
        data=payload,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        app.logger.error("Gemini HTTP %s: %s", e.code, body[:500])
        # 404 — модель отключена Google, 503 — временно перегружена.
        # И то и другое лечится переходом к следующей модели из списка.
        if e.code in (404, 503):
            return False, f"__TRY_NEXT__ {model} (HTTP {e.code})"
        if e.code in (401, 403):
            return False, (
                "Ключ доступа не принят. Проверьте файл api_key.txt — "
                "обратитесь к администратору портала."
            )
        if e.code == 429:
            # Лимит бывает поминутный (сбрасывается за секунды) и суточный.
            # Разбираем ответ Google, чтобы сказать сотруднику правду.
            kind = "minute"
            try:
                err = json.loads(body).get("error", {})
                for det in err.get("details", []):
                    for v in det.get("violations", []):
                        if "PerDay" in (v.get("quotaId") or ""):
                            kind = "day"
                # Если Google просит повторить через минуту-другую — это не суточный лимит,
                # что бы ни было написано в quotaId.
                m = re.search(r"retry in ([\d.]+)s", err.get("message", ""))
                if m and float(m.group(1)) < 600:
                    kind = "minute"
            except (ValueError, AttributeError):
                pass
            # Пробуем другую модель — у каждой свой отдельный лимит.
            return False, f"__TRY_NEXT__ {model} (лимит: {kind})"
        if e.code == 400:
            return False, "Не удалось обработать запрос. Обратитесь к администратору портала."
        return False, "Что-то пошло не так. Попробуйте ещё раз через минуту."
    except urllib.error.URLError:
        return False, "Сейчас нет связи с помощником. Попробуйте чуть позже."
    except (TimeoutError, socket.timeout):
        return False, "Я задумался слишком надолго — задайте вопрос ещё раз."

    candidates = data.get("candidates") or []
    if not candidates:
        blocked = (data.get("promptFeedback") or {}).get("blockReason")
        if blocked:
            return True, "Я не могу ответить на этот вопрос."
        return False, "Не удалось получить ответ. Попробуйте переформулировать вопрос."

    parts = (candidates[0].get("content") or {}).get("parts") or []
    answer = "".join(p.get("text", "") for p in parts).strip()
    if not answer:
        # Пустой ответ — пробуем следующую модель, она может справиться.
        return False, f"__TRY_NEXT__ {model} (пустой ответ)"
    return True, answer


# Цены на продукты — на страницах проектов их не показываем (решение пользователя 21.09.2026:
# сотрудникам это смотреть не нужно), но бот по ним отвечает, если спросят.
PRICES_KB = """Умный дом, пакеты (ориентировочные цены «от»):
Light (свет) — от 1 099 900 ₸; Standard (безопасность) — от 699 900 ₸;
Business (+свет, пульт, планшет) — от 2 101 900 ₸; Premium (+шторы, ТВ, климат) — от 2 335 900 ₸.
Гарантия 2 года, сервис 24/7, единое приложение Connected Home. Полный прайс на дополнительные устройства — у отдела продаж.
Умные замки (направление SDL), ориентировочные цены: Alpha 50 — 80 000 ₸; Gemini X30 — 150 000 ₸; Viso — 260 000 ₸; Infinity — 300 000 ₸.
Подробный прайс — у отдела продаж."""


# Программа лояльности живёт в разметке app.js (renderLoyalty) — тот же текст для Connect AI. Меняешь карточку — поправь и здесь.
LOYALTY_KB = """Раздел «Программа лояльности».
1. Дополнительный отпуск — до 3 оплачиваемых дней по заявлению: рождение или усыновление ребёнка, потеря близкого родственника, регистрация брака.
2. Материальная помощь (нужны подтверждающие документы в HR): регистрация брака — до 2 лет в компании 50 000 ₸, свыше 2 лет 100 000 ₸; рождение или усыновление ребёнка — до 2 лет 78 000 ₸, свыше 2 лет 100 000 ₸; инвалидность или онкология — 100 000 ₸; потеря близких (родители, супруг(а), дети) — 200 000 ₸.
3. Компенсация спортзала — годовой абонемент в фитнес-клуб или тренажёрный зал: ТОП-менеджеры, руководители отделов (опыт от 1 года), сотрудники со стажем от 3 лет — 100 000 ₸; сотрудники со стажем от 1 года — 50 000 ₸.
4. «Приведи друга»: отправьте резюме HR в личные сообщения; когда кандидат прошёл испытательный срок, вы получаете подарок.
5. Корпоративный английский язык (занятия с носителем языка): компания оплачивает занятия три раза в неделю. Для руководителей и сотрудников, которые работают в компании больше года. Условия участия обсуждаются индивидуально и согласуются с генеральным директором.
9. Корпоративные мероприятия — три главных события года: март — Наурыз (точка перезапуска: подводим итоги года, фиксируем результаты, задаём вектор на новый, празднуем командой вместе с партнёрами); август — день рождения компании (неформальный праздник с семьями сотрудников, на открытом воздухе, с активностями для детей и взрослых); декабрь — Новый год (полностью неформально, без отчётов и официальной части). Даты и детали — в новостях и календаре портала.
8. Community Coins: условия сейчас пересматриваются, карточка на портале временно закрыта и помечена «Скоро». Прежние условия не действуют — не называй ни сумм, ни сроков, ни количества coins; скажи, что обновлённые условия появятся на портале. Единственное исключение, которое остаётся в силе, — 100 Community Coins за прочитанную книгу месяца от CEO и сданный тест.
7. Годовой бонусный фонд: условия сейчас пересматриваются, карточка на портале временно закрыта и помечена «Скоро». Прежние условия не действуют — не называй ни сумм, ни сроков, ни количества coins; скажи, что обновлённые условия появятся на портале.
6. Mentor для новичка (программа наставничества, раньше называлась «бадди»): Mentor помогает новому сотруднику освоиться — знакомит с коллегами, рассказывает о традициях и правилах, отвечает на вопросы в первые недели. Участвовать может сотрудник, который хорошо знает внутренние процессы и готов уделять время новому коллеге. Как стать: подать заявку на портале (Заявки → «Mentor для новичка» или кнопка «Подать заявку» в карточке «Mentor для новичка» программы лояльности, уходит сразу в HR без согласования руководителя), пройти короткий инструктаж, получить закрепление за новичком и сопровождать его в период адаптации, в конце заполнить короткую обратную связь вместе с новичком.8). Точный стаж для участия и срок сопровождения — уточнять у HR."""


def build_knowledge_base(db):
    """Собирает всё содержимое портала в один текст — это и есть знания ИИ."""
    parts = ["=== ЦЕНЫ И ПАКЕТЫ ПРОДУКТОВ ===\n" + PRICES_KB]

    about = db.execute("SELECT * FROM about WHERE id='main'").fetchone()
    if about and (about["title"] or about["body"]):
        parts.append(f"=== О КОМПАНИИ ===\n{about['title']}\n{about['body']}")

    faq = db.execute("SELECT * FROM faq").fetchall()
    if faq:
        block = "\n\n".join(f"Вопрос: {r['question']}\nОтвет: {r['answer']}" for r in faq)
        parts.append(f"=== ВОПРОСЫ И ОТВЕТЫ (СПРАВОЧНИК) ===\n{block}")

    steps = db.execute("SELECT * FROM onboarding_steps").fetchall()
    if steps:
        block = "\n".join(
            f"{i}. {r['title']}" + (f" — {r['description']}" if r["description"] else "")
            for i, r in enumerate(steps, 1)
        )
        parts.append(f"=== ПЕРВЫЕ ШАГИ НОВОГО СОТРУДНИКА ===\n{block}")

    v = _values(db)
    parts.append("=== МИССИЯ, ВИДЕНИЕ И ЦЕННОСТИ КОМПАНИИ (верхнее меню → «Миссия и ценности») ===\n"
                 f"МИССИЯ:\n{v['mission']}\n\nВИДЕНИЕ:\n{v['vision']}\n\nЦЕННОСТИ (название — что это значит):\n{v['values']}")
    parts.append(f"=== ПРОГРАММА ЛОЯЛЬНОСТИ ===\n{LOYALTY_KB}")
    parts.append("=== РАЗДЕЛ «ЗАДАЧИ» (левое меню) ===\n"
                 "Руководитель ставит задачу своему подчинённому: кнопка «Поставить задачу», исполнитель, что сделать, подробности, срок. "
                 "Ставить задачи могут главы подразделений (своей команде) и все, у кого в справочнике есть подчинённые. "
                 "Исполнитель видит задачу во вкладке «Мне поручено»: «Взять в работу», затем «Сдать на проверку» (можно с комментарием). "
                 "Руководитель во вкладке «Я поручил» принимает задачу («Готово») или возвращает на доработку с комментарием. "
                 "Просроченные сроки подсвечиваются красным; новые задачи и задачи на проверке видны в блоке «К рассмотрению» и цифрой на пункте меню.")

    vac = db.execute("SELECT * FROM vacancies WHERE status='open' ORDER BY created DESC").fetchall()
    parts.append("=== ОТКРЫТЫЕ ВАКАНСИИ (раздел «Вакансии»; порекомендовать друга — кнопка «Рекомендовать друга» в вакансии, заявка уходит в HR) ===\n"
                 + ("\n".join(" | ".join(filter(None, [r["title"], r["department"], r["office"], r["format"], r["requirements"]])) for r in vac)
                    or "Сейчас открытых вакансий нет."))

    eng = [r["name"] for r in db.execute("SELECT name FROM employees WHERE english=1 ORDER BY name")]
    if eng:
        wd = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
        parts.append("=== КОРПОРАТИВНЫЙ АНГЛИЙСКИЙ ЯЗЫК: УЧАСТНИКИ ===\n" + ", ".join(eng)
                     + "\nДни занятий: " + ", ".join(wd[i] for i in _english_days())
                     + ". Посещение отмечают сами в разделе «Посещаемость» → вкладка «Английский язык».")

    book = _current_book()
    if book.get("title"):
        parts.append("=== КНИГА МЕСЯЦА ОТ CEO (главная страница, справа) ===\n"
                     + " — ".join(filter(None, [f"«{book['title']}»", book.get("author")]))
                     + (f"\nПочему советует CEO: {book['note']}" if book.get("note") else "")
                     + "\nКарточка книги открывается по клику на неё. Кто прочитает книгу и сдаст тест по ней — получает 100 Community Coins.")

    leaders = db.execute("SELECT * FROM leaders").fetchall()
    if leaders:
        block = "\n".join(
            " | ".join(
                filter(None, [r["name"], r["position"], r["email"], r["bio"]])   # story боту не отдаём: пока это тестовые тексты (23.09.2026)
            )
            for r in leaders
        )
        parts.append(f"=== РУКОВОДИТЕЛИ ===\n{block}")

    employees = db.execute("SELECT * FROM employees ORDER BY department, name").fetchall()
    profs = {r["employee_id"]: _profile_json(r) for r in db.execute("SELECT * FROM profiles WHERE visible=1")}   # скрытые боту не уходят

    def _prof(r):
        p = profs.get(r["id"])
        if not p or not _profile_filled(p):
            return []
        edu = ", ".join(x for x in (p["edu_school"], p["edu_major"], p["edu_year"]) if x)
        return [f"знает / чем может помочь: {', '.join(p['skills'])}" if p["skills"] else None,
                f"хобби: {', '.join(p['hobbies'])}" if p["hobbies"] else None,
                f"языки: {', '.join(p['languages'])}" if p["languages"] else None,
                f"образование: {edu}" if edu else None,
                f"родной город: {p['hometown']}" if p["hometown"] else None,
                f"о себе: {p['about']}" if p["about"] else None,
                f"любит: {', '.join(x for x in (p['fav_book'], p['fav_film'], p['fav_music']) if x)}" if (p["fav_book"] or p["fav_film"] or p["fav_music"]) else None]
    if employees:
        block = "\n".join(
            " | ".join(
                filter(
                    None,
                    [
                        r["name"],
                        r["position"],
                        "РУКОВОДИТЕЛЬ ПОДРАЗДЕЛЕНИЯ" if r["is_head"] else None,
                        f"подразделение: {r['department']}" if r["department"] else None,
                        f"отдел: {r['unit']}" if r["unit"] else None,
                        f"непосредственный руководитель: {r['reports_to']}" if r["reports_to"] else None,
                        f"компания: {r['company']}" if r["company"] else None,
                        f"график: {r['schedule']}" if r["schedule"] else None,
                        f"выезд на объекты: {r['fieldwork']}" if r["fieldwork"] else None,
                        f"email: {r['email']}" if r["email"] else None,
                        f"тел: {r['phone']}" if r["phone"] else None,
                        f"др: {r['birthday']}" if r["birthday"] else None,
                        f"в компании с: {r['hired']}" if r["hired"] else None,
                    ] + _prof(r),
                )
            )
            for r in employees
        )
        parts.append(f"=== СОТРУДНИКИ ===\n{block}")

    docs = db.execute("SELECT title, description, category, text, section FROM documents ORDER BY section, category, title").fetchall()
    where = lambda r: "Шаблоны документов" if r["section"] == "templates" else "База знаний"
    if docs:
        block = "\n".join(f"{r['title']}" + (f" — {r['description']}" if r["description"] else "") + f" (раздел «{where(r)}», категория «{r['category']}»)"
                          for r in docs)
        parts.append(f"=== ФАЙЛЫ НА ПОРТАЛЕ: презентации, регламенты, инструкции («База знаний») и бланки для скачивания («Шаблоны документов») ===\n{block}")
        for r in docs:                       # содержимое файлов — бот отвечает по нему (22.09.2026)
            if (r["text"] or "").strip():
                parts.append(f"=== СОДЕРЖАНИЕ ФАЙЛА «{r['title']}» (раздел «{where(r)}», категория «{r['category']}») ===\n{r['text']}")

    projects = db.execute("SELECT * FROM projects ORDER BY created DESC").fetchall()
    if projects:
        status_ru = {"planned": "планируется", "active": "в работе", "done": "завершён"}
        block = "\n".join(
            " | ".join(
                filter(
                    None,
                    [
                        r["title"],
                        f"заказчик: {r['client']}" if r["client"] else None,
                        f"статус: {status_ru.get(r['status'], r['status'])}",
                        f"ответственный: {r['manager']}" if r["manager"] else None,
                        f"срок: {r['deadline']}" if r["deadline"] else None,
                        r["description"],
                    ],
                )
            )
            for r in projects
        )
        parts.append(f"=== ПРОЕКТЫ (ОБЪЕКТЫ) ===\n{block}")

    partners = db.execute("SELECT * FROM partners ORDER BY sort").fetchall()
    if partners:
        block = "\n".join(
            " | ".join(filter(None, [r["name"], r["category"], r["description"], r["website"]]))
            for r in partners
        )
        parts.append(f"=== НАШИ ПАРТНЁРЫ (С КЕМ РАБОТАЕТ КОМПАНИЯ) ===\n{block}")

    honors = db.execute("SELECT * FROM honors ORDER BY created DESC LIMIT 6").fetchall()
    if honors:
        block = "\n".join(" | ".join(filter(None, [r["period"], r["name"], r["reason"]])) for r in honors)
        parts.append(f"=== ДОСКА ПОЧЁТА (СОТРУДНИКИ МЕСЯЦА) ===\n{block}")

    gallery = db.execute("SELECT * FROM gallery ORDER BY date DESC").fetchall()
    if gallery:
        block = "\n".join(
            " | ".join(filter(None, [r["date"], r["title"], r["description"]]))
            for r in gallery
        )
        parts.append(f"=== ПРОШЕДШИЕ ИВЕНТЫ КОМПАНИИ (ФОТОАРХИВ) ===\n{block}")

    events = db.execute("SELECT * FROM events ORDER BY date").fetchall()
    if events:
        block = "\n".join(
            " | ".join(
                filter(
                    None,
                    [
                        r["date"],
                        "отпуск" if r["type"] == "vacation" else "событие",
                        r["title"],
                        r["description"],
                    ],
                )
            )
            for r in events
        )
        parts.append(f"=== КАЛЕНДАРЬ СОБЫТИЙ И ОТПУСКОВ ===\n{block}")

    news = db.execute("SELECT * FROM news ORDER BY date DESC LIMIT 20").fetchall()
    if news:
        block = "\n\n".join(
            f"[{r['date'][:10]}] {r['title']}\n{r['body']}" for r in news
        )
        parts.append(f"=== ПОСЛЕДНИЕ НОВОСТИ ===\n{block}")

    if not parts:
        return ""
    return "\n\n".join(parts)


_ask_log = {}  # id учётки -> времена вопросов за последний час
ASK_PER_HOUR = 30


# ---------- смена языка портала (24.09.2026): интерфейс переводит словарь static/i18n.js, всё остальное —
# этот перевод через тот же AI, что у Connect AI; каждая фраза переводится один раз и хранится в таблице translations.
TRANSLATE_LANGS = {"en": "английский", "kk": "казахский", "zh": "китайский (упрощённые иероглифы)"}
TRANSLATE_BATCH_CHARS = 6000       # столько знаков исходного текста за один запрос к AI
TRANSLATE_AI_PER_HOUR = 150        # запросов к AI на перевод в час на учётку (готовые переводы — без ограничений)
_translate_hits = {}
TRANSLATE_PROMPT = (
    "Ты переводчик внутреннего корпоративного портала компании Connected Home (умный дом, Казахстан). "
    "Переведи каждую строку массива с русского на {lang}. Правила: имена и фамилии людей не переводи и не транслитерируй — "
    "оставь как в исходнике; названия компаний, проектов и продуктов (Connected Home, Connected Community, Connect AI, Elpass, "
    "Elpark, AIVA, SDL, SimSim, Community Coins, Mentor, AI Factory и другие латиницей) не переводи; должности и названия отделов "
    "переводи; числа, даты, суммы в тенге (₸), эмодзи, стрелки и знаки препинания сохраняй; стиль — деловой и дружелюбный, как в интерфейсе. "
    "Единые термины (переводи строго так): {glossary}. "
    "Ответь ТОЛЬКО JSON-массивом строк той же длины и в том же порядке, без пояснений."
)
# Единые термины — чтобы одно слово переводилось одинаково по всему порталу: русский → (en, kk, zh)
TRANSLATE_GLOSSARY = {
    "подразделение": ("division", "бөлімше", "部门"), "отдел": ("department", "бөлім", "科室"),
    "заявка": ("request", "өтінім", "申请"), "сотрудник": ("employee", "қызметкер", "员工"),
    "руководитель подразделения": ("head of division", "бөлімше басшысы", "部门负责人"),
    "программа лояльности": ("loyalty program", "лоялдылық бағдарламасы", "员工福利计划"),
    "посещаемость": ("attendance", "қатысу", "考勤"), "табель": ("timesheet", "табель", "考勤表"),
    "командировка": ("business trip", "іссапар", "出差"), "трудовой отпуск": ("annual leave", "еңбек демалысы", "年假"),
    "отпуск без сохранения": ("unpaid leave", "жалақысыз демалыс", "无薪假"),
    "кабинет руководителя": ("manager dashboard", "басшы кабинеті", "管理者面板"), "база знаний": ("knowledge base", "білім қоры", "知识库"),
    "шаблоны документов": ("document templates", "құжат үлгілері", "文件模板"), "вакансия": ("vacancy", "бос орын", "职位空缺"),
    "закупщик": ("procurement officer", "сатып алушы", "采购员"), "опоздание": ("late arrival", "кешігу", "迟到"),
    "турникет": ("turnstile", "турникет", "闸机"), "HR": ("HR", "HR", "HR"),
}


def _tr_id(lang, src):
    return hashlib.sha1((lang + "\0" + src).encode("utf-8")).hexdigest()


def _translate_batch(lang, texts):
    """Переводит список строк через AI; вернёт список той же длины или None."""
    api_key = get_api_key()
    if not api_key:
        return None
    contents = [{"role": "user", "parts": [{"text": json.dumps(texts, ensure_ascii=False)}]}]
    i = {"en": 0, "kk": 1, "zh": 2}[lang]
    system = TRANSLATE_PROMPT.format(lang=TRANSLATE_LANGS[lang],
                                     glossary="; ".join(f"«{ru}» → «{tr[i]}»" for ru, tr in TRANSLATE_GLOSSARY.items()))
    skipped = []
    for model in AI_MODELS:
        ok, result = call_gemini(model, api_key, system, contents, max_tokens=8192)
        if not ok:
            if str(result).startswith("__TRY_NEXT__"):
                skipped.append(result)
                continue
            return None
        raw = result.strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw[raw.find("["):]
        try:
            out = json.loads(raw[raw.find("["): raw.rfind("]") + 1])
        except ValueError:
            continue
        if isinstance(out, list) and len(out) == len(texts) and all(isinstance(x, str) for x in out):
            return out
    if len(skipped) == len(AI_MODELS):                      # не ответила ни одна модель — это сбой AI, а не кривой перевод
        ai_all_failed(skipped)
    return None


def _prewarm_texts(db):
    """Тексты из базы, которые люди увидят на портале: переводим заранее, чтобы при смене языка всё было готово сразу."""
    q = lambda sql: [r[0] for r in db.execute(sql).fetchall()]
    texts = list(VALUES_DEFAULT.values())      # миссия и ценности по умолчанию живут в коде, а не в about (07.10.2026)
    for sql in ("SELECT DISTINCT position FROM employees", "SELECT DISTINCT department FROM employees", "SELECT DISTINCT unit FROM employees",
                "SELECT title FROM news", "SELECT body FROM news", "SELECT question FROM faq", "SELECT answer FROM faq",
                "SELECT title FROM onboarding_steps", "SELECT description FROM onboarding_steps", "SELECT title FROM about", "SELECT body FROM about",
                "SELECT position FROM leaders", "SELECT bio FROM leaders", "SELECT story FROM leaders",
                "SELECT title FROM documents", "SELECT description FROM documents", "SELECT DISTINCT category FROM documents",
                "SELECT title FROM vacancies", "SELECT description FROM vacancies", "SELECT requirements FROM vacancies",
                "SELECT title FROM events", "SELECT description FROM projects"):
        try:
            texts += q(sql)
        except sqlite3.Error:
            pass
    b = _current_book()
    texts.append(b.get("title") or "")
    cyr = re.compile(r"[А-Яа-яЁё]")
    return [t.strip() for t in dict.fromkeys(texts) if t and cyr.search(t) and len(t.strip()) <= 3000]


def prewarm_translations(db, max_batches=6):
    """Доперевести тексты из базы, которых ещё нет в translations (в фоне раз в час; не больше max_batches запросов к AI)."""
    texts, done = _prewarm_texts(db), 0
    stamp = datetime.now().isoformat(timespec="seconds")
    for lang in TRANSLATE_LANGS:
        missing = [t for t in texts if not db.execute("SELECT 1 FROM translations WHERE id=?", (_tr_id(lang, t),)).fetchone()]
        while missing and done < max_batches:
            batch, size = [], 0
            while missing and (not batch or size + len(missing[0]) <= TRANSLATE_BATCH_CHARS) and len(batch) < 60:
                t = missing.pop(0); batch.append(t); size += len(t)
            done += 1
            res = _translate_batch(lang, batch)
            if not res:
                continue
            for src, txt in zip(batch, res):
                db.execute("INSERT OR REPLACE INTO translations (id, lang, src, text, created) VALUES (?, ?, ?, ?, ?)",
                           (_tr_id(lang, src), lang, src, txt, stamp))
            db.commit()
    return done


@app.route("/api/translate", methods=["GET", "POST"])
def translate():
    """GET ?lang= — все готовые переводы языка (браузер берёт их сразу после входа, чтобы ничего не ждать).
    POST {lang, texts: [...]} → {map: {исходник: перевод}}. Сначала таблица translations, недостающее — через AI партиями."""
    if request.method == "GET":
        lang = request.args.get("lang") or ""
        if lang not in TRANSLATE_LANGS:
            return jsonify({"error": "Неизвестный язык."}), 400
        rows = get_db().execute("SELECT src, text FROM translations WHERE lang=? ORDER BY created DESC LIMIT 20000", (lang,)).fetchall()
        return jsonify({"map": {r["src"]: r["text"] for r in rows}})
    data = request.get_json(silent=True) or {}
    lang = str(data.get("lang") or "")
    if lang not in TRANSLATE_LANGS:
        return jsonify({"error": "Неизвестный язык."}), 400
    texts = [t for t in dict.fromkeys(data.get("texts") or []) if isinstance(t, str) and t.strip() and len(t) <= 3000][:80]
    db = get_db()
    out = {}
    for t in texts:
        row = db.execute("SELECT text FROM translations WHERE id=?", (_tr_id(lang, t),)).fetchone()
        if row:
            out[t] = row["text"]
    missing = [t for t in texts if t not in out]
    if missing:
        uid = current_user()["id"]
        now = time.time()
        hits = [h for h in _translate_hits.get(uid, []) if now - h < 3600]
        batch, size, batches = [], 0, []
        for t in missing:
            if batch and size + len(t) > TRANSLATE_BATCH_CHARS:
                batches.append(batch); batch, size = [], 0
            batch.append(t); size += len(t)
        if batch:
            batches.append(batch)
        stamp = datetime.now().isoformat(timespec="seconds")
        for b in batches:
            if len(hits) >= TRANSLATE_AI_PER_HOUR:
                break
            hits.append(now)
            res = _translate_batch(lang, b)
            if not res:
                continue
            for src, txt in zip(b, res):
                out[src] = txt
                db.execute("INSERT OR REPLACE INTO translations (id, lang, src, text, created) VALUES (?, ?, ?, ?, ?)",
                           (_tr_id(lang, src), lang, src, txt, stamp))
            db.commit()
        _translate_hits[uid] = hits
    return jsonify({"map": out})


# ---------- Connect AI помогает заполнить заявку (05.10.2026, идея пользователя: «пишешь боту: сделай мне заявку на
# оборудование — он в чате помогает её заполнить и отправляет Айдару») ----------
# Формы заявок описаны во фронте (REQ_KINDS в app.js), поэтому их краткое описание чат присылает вместе с вопросом (`forms`):
# дублировать схемы на сервере — значит однажды забыть обновить вторую копию. Бот сам ничего не отправляет: когда всё собрано,
# он дописывает в конец ответа строку-черновик, портал показывает сотруднику карточку заявки с кнопкой «Отправить», и уходит
# она обычным POST /api/requests — с теми же проверками и согласованием, что и из формы.
# Паспортные данные (командировка) бот не спрашивает и не получает: эти поля во фронте помечены secret и в `forms` не попадают.
REQUEST_FORMS_MAX = 14000
REQUEST_DRAFT_MARK = "<<<ЗАЯВКА"
WEEKDAYS_RU = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
REQUEST_HELP_PROMPT = """

=== ПОМОЩЬ С ЗАЯВКАМИ ===
Сотрудник может попросить оформить заявку: техника, отпуск, командировка, поддержка IT и другие виды из списка ниже. \
Это единственный случай, когда ты не только отвечаешь, но и помогаешь что-то сделать. Правила:
1. Определи вид заявки по списку ниже. Если непонятно, какой нужен, — уточни одним вопросом.
2. Возьми из слов сотрудника всё, что он уже сказал. Обязательные поля (помечены «обязательно»), которых не хватает, спроси: \
один-два коротких вопроса за раз, обычными словами, без перечисления названий полей. Необязательные поля не выпытывай: \
заполни те, о которых сотрудник сказал сам, и один раз в конце спроси, не хочет ли он что-то добавить.
3. У полей с вариантами бери только код варианта из списка (то, что перед знаком «=»). Не подходит ни один — выбери ближайший или спроси.
4. Даты записывай как ГГГГ-ММ-ДД, время — ЧЧ:ММ, числа — только цифрами. Сегодня {today}, {weekday}. «Завтра», «в пятницу», \
«до конца недели» переводи в дату сам. В тексте для сотрудника даты называй по-человечески («20 октября»), а не цифрами через дефис.
5. Ничего не выдумывай: чего сотрудник не говорил — того в заявке нет.
6. Фамилию, должность, подразделение, телефон и почту портал обычно знает сам — тогда этих полей в списке вида нет, и \
спрашивать их не нужно. Если такое поле в списке есть — портал его не знает: обязательное спроси, сказанное сотрудником запиши. \
Никогда не спрашивай и не записывай номера документов и паспортные данные: если сотрудник их прислал, не повторяй их и скажи, \
что их вписывают только в форме заявки.
7. Когда все обязательные поля собраны, одной-двумя фразами скажи, что заявка готова и её нужно проверить, и В САМОМ КОНЦЕ \
ответа отдельной строкой добавь черновик строго такого вида (JSON в одну строку, все значения — строки):
<<<ЗАЯВКА {{"type":"код вида","data":{{"код поля":"значение"}}}}>>>
Портал сам покажет сотруднику заполненную заявку и кнопку «Отправить». Не пересказывай заявку по полям — он увидит её в карточке. \
На каком бы языке ты ни отвечал, строку-черновик не переводи: слово ЗАЯВКА, коды видов, полей и вариантов остаются как есть.
8. Ты заявку НЕ отправляешь. Никогда не пиши, что она отправлена или принята: отправляет сотрудник кнопкой.
9. Сотрудник просит что-то поправить — выдай строку-черновик заново, целиком, с исправлением.
10. Вида заявки нет в списке (например, подбор персонала — он только для руководителей) — так и скажи, без черновика.
11. Пока идёт разговор о заявке, не отвлекайся на справки из данных портала, если о них не спросили.

Виды заявок и их поля (код | название | тип | варианты | условие показа):
"""


@app.route("/api/ask", methods=["POST"])
def ask_ai():
    uid = current_user()["id"]
    now = time.time()
    recent = [t for t in _ask_log.get(uid, []) if now - t < 3600]
    if len(recent) >= ASK_PER_HOUR:
        return jsonify({"error": "Вы задали много вопросов за последний час. Продолжим чуть позже."}), 429
    _ask_log[uid] = recent + [now]
    data = request.get_json(force=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "Вопрос пустой"}), 400
    if len(question) > 1000:
        return jsonify({"error": "Вопрос слишком длинный"}), 400

    api_key = get_api_key()
    if not api_key:
        return jsonify(
            {
                "error": "Помощник пока не настроен. Обратитесь к администратору портала."
            }
        ), 503

    knowledge = build_knowledge_base(get_db())
    if not knowledge.strip():
        return jsonify(
            {
                "answer": "На портале пока нет данных, на основании которых я мог бы "
                "ответить. Наполните «Частые вопросы» и «Сотрудники»."
            }
        )

    system_text = AI_SYSTEM_PROMPT + "\n\n=== ДАННЫЕ ПОРТАЛА ===\n\n" + knowledge
    forms = str(data.get("forms") or "").strip()[:REQUEST_FORMS_MAX]
    if forms:                     # чат на портале прислал описание форм — бот умеет помогать с заявками (05.10.2026)
        now_a = _astana_now()
        system_text += REQUEST_HELP_PROMPT.format(today=now_a.strftime("%Y-%m-%d"), weekday=WEEKDAYS_RU[now_a.weekday()]) + forms
    lang = str(data.get("lang") or "ru")
    if lang in TRANSLATE_LANGS:   # портал переключён на другой язык — бот отвечает на нём (24.09.2026)
        system_text += f"\n\nОтвечай на языке: {TRANSLATE_LANGS[lang]}. Имена людей и названия проектов оставляй как есть."

    # История переписки: берём последние сообщения, чтобы бот помнил контекст.
    contents = []
    # Заявку собирают в несколько вопросов-ответов (командировка — длинная), поэтому, пока речь о заявке, помним разговор
    # дольше и не режем черновик. В обычном разговоре — прежние пределы: чат шлёт описание форм всегда, и без этого
    # условия каждый вопрос стал бы тяжелее для бесплатного лимита AI (заметил проверяющий 05.10.2026).
    history = [m for m in (data.get("history") or []) if isinstance(m, dict)]
    about_request = bool(forms) and any(REQUEST_DRAFT_MARK in str(m.get("text") or "") or "заявк" in str(m.get("text") or "").lower()
                                        for m in history[-30:] + [{"text": question}])
    for msg in history[-(30 if about_request else MAX_HISTORY):]:
        text = (msg.get("text") or "").strip()
        if not text:
            continue
        role = "model" if msg.get("role") == "bot" else "user"
        contents.append({"role": role, "parts": [{"text": text[:4000 if REQUEST_DRAFT_MARK in text else 2000]}]})
    contents.append({"role": "user", "parts": [{"text": question}]})

    skipped = []
    for model in AI_MODELS:
        ok, result = call_gemini(model, api_key, system_text, contents)
        if ok:
            return jsonify({"answer": result})
        if result.startswith("__TRY_NEXT__"):
            app.logger.warning("Пропускаю модель: %s", result)
            skipped.append(result)
            continue
        return jsonify({"error": result}), 502

    # Ни одна модель не ответила — объясняем причину по-человечески.
    ai_all_failed(skipped)
    if any("лимит: day" in s for s in skipped):
        msg = "На сегодня я ответил на все вопросы, что мог. Вернусь завтра с новыми силами!"
    elif any("лимит: minute" in s for s in skipped):
        msg = "Сейчас ко мне много вопросов — подождите минутку и спросите ещё раз."
    else:
        msg = "Мне нужна небольшая пауза. Подождите минутку и спросите ещё раз."
    return jsonify({"error": msg}), 502


start_scheduler()

if __name__ == "__main__":
    init_db()
    # Отладчик Werkzeug позволяет выполнять код — наружу его не выставляем. Нужен доступ с телефона: PORTAL_LAN=1.
    app.run(host="0.0.0.0" if os.environ.get("PORTAL_LAN") == "1" else "127.0.0.1", port=5000, debug=True)
