# -*- coding: utf-8 -*-
"""ЛОКАЛЬНО, на копии базы, без настоящего Telegram: подключение бота, привязка по коду, отчёт, оповещения о сбое."""
import sqlite3, sys, os, json, shutil, tempfile
from pathlib import Path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # корень проекта: скрипт лежит в checks/
os.chdir(ROOT); sys.path.insert(0, ROOT)
assert not os.path.isdir("/app"), "только локально"
import app

import _tmp; TMP = _tmp.fresh("portal-tg-")   # заодно убирает копии базы от прошлых запусков
shutil.copyfile(app.DB_PATH, TMP / "portal.db")
app.DB_PATH = TMP / "portal.db"
app.app.config["TESTING"] = True
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
sent, fails, passed = [], [], 0
def check(cond, what):
    global passed
    if cond: passed += 1
    else: fails.append(what); print("  !!", what)

updates = []
def fake_call(token, method, params=None):
    if method == "getMe": return {"username": "cc_test_bot"}
    if method == "getUpdates": return updates
    if method == "sendMessage": sent.append(params["text"]); return {}
    raise RuntimeError(method)
app._tg_call = fake_call

from werkzeug.security import generate_password_hash
import uuid
def client(role):
    uid = uuid.uuid4().hex
    db.execute("INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?,?,?,?,?,'2026-10-01')",
               (uid, "tg_" + role, generate_password_hash("Passw0rd!x"), "Проверка " + role, role)); db.commit()
    c = app.app.test_client(); c.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
    ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
    with c.session_transaction() as s: s["uid"] = uid; s["pv"] = app._pw_stamp(ph)
    return c
ADM, HR, USR = client("admin"), client("hr"), client("user")

for c, who in ((HR, "HR"), (USR, "сотрудник")):
    check(c.get("/api/admin/telegram").status_code == 403, f"{who} не видит настройки бота")
    check(c.put("/api/admin/telegram", json={"token": "1"}).status_code == 403, f"{who} не может подключить бота")
    check(c.post("/api/admin/telegram/test").status_code == 403, f"{who} не может слать отчёт")
check(ADM.put("/api/admin/telegram", json={"token": "мусор"}).status_code == 400, "кривой токен — 400")
r = ADM.put("/api/admin/telegram", json={"token": "1234567890:" + "A" * 35}); j = r.get_json()
check(r.status_code == 200 and j["connected"] and not j["linked"] and j["bot"] == "cc_test_bot" and len(j["code"]) == 4, "бот подключён, выдан код")
check("token" not in json.dumps(j) and "AAAA" not in json.dumps(j), "токен наружу не отдаётся")
check(ADM.post("/api/admin/telegram/test").status_code == 400, "без привязки отчёт не шлётся")
updates.append({"message": {"text": "0000", "chat": {"id": 666, "first_name": "Чужой"}}})
check(ADM.post("/api/admin/telegram/link").status_code == 404, "чужое сообщение без кода — не привязывает")
updates.append({"message": {"text": j["code"], "chat": {"id": 777, "first_name": "Темирлан", "last_name": "А."}}})
r = ADM.post("/api/admin/telegram/link"); check(r.status_code == 200 and r.get_json()["chat"] == "Темирлан А.", "привязка по коду")
check(app._tg_cfg()["chat_id"] == 777 and len(sent) == 1, "чат запомнен, приветствие ушло")
j = ADM.get("/api/admin/telegram").get_json(); check(j["linked"] and j["code"] == "", "после привязки код не показывается")
check(ADM.post("/api/admin/telegram/test").status_code == 200 and len(sent) == 2, "отчёт по кнопке ушёл")
print("----- отчёт -----"); print(sent[-1]); print("-----------------")

with app.app.app_context():
    check(app.tg_daily_report(db) is True and len(sent) == 3, "ежедневный отчёт ушёл")
    check(app.tg_daily_report(db) is False and len(sent) == 3, "второй раз за день не шлётся")
    # сбой: сервис красный две проверки подряд → одно сообщение; починился → «снова работает»
    real = app._services_state
    def state(bad):
        return lambda d: [dict(s, state="bad", status="не читается", rows=[["Последняя ошибка", "HTTP 400 <test>"]]) if s["key"] == "sheet" and bad
                          else dict(s, state="ok") for s in real(d)]
    app._services_state = state(True)
    app.tg_watch(db); check(len(sent) == 3, "первая красная проверка — молчим")
    app.tg_watch(db); check(len(sent) == 4 and "Google-таблица" in sent[-1] and "&lt;test&gt;" in sent[-1], "вторая подряд — оповещение, текст экранирован")
    app.tg_watch(db); check(len(sent) == 4, "повторно о том же сбое не пишем")
    print("----- сбой -----"); print(sent[-1]); print("----------------")
    app._services_state = state(False)
    app.tg_watch(db); check(len(sent) == 5 and "снова работает" in sent[-1], "починился — сообщение")
    app.tg_watch(db); check(len(sent) == 5, "дальше тишина")
    app._services_state = real
    tg = next(s for s in app._services_state(db) if s["key"] == "tg")
    check(tg["state"] == "ok" and ["Кому", "Темирлан А."] in tg["rows"], "карточка «Отчёты в Telegram» зелёная")
# «хвосты»: список недоделанного — в админ-панели, по кнопке и в понедельничном отчёте
tails = ADM.get("/api/admin/services").get_json()
check(len(tails["tails"]) > 0 and all(t["text"] and t["kind"] for t in tails["tails"]), "хвосты отдаются во вкладку «Сервисы»")
check("Не доделано" in app.tails_text() and "•" in app.tails_text() and len(app.tails_text()) < 4000, "текст хвостов для Telegram влезает в сообщение")
with app.app.app_context():
    check("Не доделано" in app.tg_report_text(db, with_tails=True), "в понедельник хвосты есть в отчёте")
    check("Не доделано" not in app.tg_report_text(db, with_tails=False), "в остальные дни хвостов в отчёте нет")
    # вопросы, ждущие решения пользователя, — каждый день (06.10.2026), но не больше TG_DECISIONS_SHOWN
    real_tails = app._tails
    app._tails = lambda: [{"text": f"вопрос {i}", "kind": "decision", "since": f"2026-10-{i:02d}"} for i in range(1, 9)] + \
                         [{"text": "просто дело", "kind": "todo", "since": "2026-10-01"}]
    daily = app.tg_report_text(db, with_tails=False)
    check("Ждёт вашего решения: 8" in daily and daily.count("• вопрос") == app.TG_DECISIONS_SHOWN, "в ежедневном отчёте — вопросы, ждущие решения, не больше пяти")
    check("вопрос 8" in daily and "вопрос 1\n" not in daily and "ещё 3" in daily and "просто дело" not in daily, "свежие вопросы сверху, остальные дела в ежедневный отчёт не идут")
    app._tails = lambda: [{"text": "просто дело", "kind": "todo", "since": "2026-10-01"}]
    check("Ждёт вашего решения" not in app.tg_report_text(db, with_tails=False), "нет вопросов — нет и блока в отчёте")
    app._tails = real_tails
with app.app.app_context():
    real_state = app._services_state
    app._services_state = lambda d: [dict(s, state="bad", status="сбой", rows=[["Последняя ошибка", "x" * 150]] * 5) for s in real_state(d)]
    long_report = app.tg_report_text(db, with_tails=True)
    app._services_state = real_state
check("Сбой" in long_report, "отчёт в день многих сбоев собирается")
n = len(sent); app.tg_send(long_report + "я " * 4000)
check(len(sent) == n + 1 and len(sent[-1]) <= app.TG_MAX_LEN + 2, "слишком длинное сообщение обрезается, а не теряется")
check(HR.post("/api/admin/telegram/tails").status_code == 403, "HR не может слать хвосты")
n = len(sent)
check(ADM.post("/api/admin/telegram/tails").status_code == 200 and len(sent) == n + 1 and "Не доделано" in sent[-1], "хвосты по кнопке ушли")
print("----- хвосты -----"); print(sent[-1][:700]); print("------------------")
check(ADM.delete("/api/admin/telegram").status_code == 200 and not app.tg_ready(), "отключение бота")
print(f"\nИТОГО: пройдено {passed}, проблем {len(fails)}")
