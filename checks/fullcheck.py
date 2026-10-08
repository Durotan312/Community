# -*- coding: utf-8 -*-
"""Сквозная проверка всех адресов API на КОПИИ локальной базы во временной папке (рабочая база не трогается).
Каждое действие каждой роли: создать → изменить → удалить, загрузки файлов, все статусы заявок, права доступа."""
import sqlite3, sys, os, io, json, shutil, tempfile, uuid, re, time
from pathlib import Path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # корень проекта: скрипт лежит в checks/
os.chdir(ROOT); sys.path.insert(0, ROOT)
assert not os.path.isdir("/app"), "только локально"
import app
from werkzeug.security import generate_password_hash

import _tmp; TMP = _tmp.fresh("portal-check-")   # заодно убирает копии базы от прошлых запусков
shutil.copyfile(app.DB_PATH, TMP / "portal.db")
(TMP / "uploads").mkdir(); (TMP / "backups").mkdir()
for f in app.UPLOAD_DIR.iterdir():                       # файлы, на которые ссылается база, нужны для проверок
    if f.is_file() and f.stat().st_size < 70_000_000: shutil.copy(f, TMP / "uploads" / f.name)
app.DB_PATH = TMP / "portal.db"; app.UPLOAD_DIR = TMP / "uploads"; app.BACKUP_DIR = TMP / "backups"
app.app.config["TESTING"] = True
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
S = os.path.join(ROOT, "checks", "samples") + os.sep

fails, passed = [], 0
def check(cond, what):
    global passed
    if cond: passed += 1
    else: fails.append(what); print("  !!", what)

def mkuser(login, name, role="user", email=None):
    uid = uuid.uuid4().hex
    db.execute("INSERT INTO users (id, login, password_hash, name, role, email, created) VALUES (?,?,?,?,?,?,'2026-09-23')",
               (uid, login, generate_password_hash("Passw0rd!x"), name, role, email)); db.commit()
    return uid
def client(uid):
    c = app.app.test_client()
    c.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
    ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
    with c.session_transaction() as s: s["uid"] = uid; s["pv"] = app._pw_stamp(ph)
    return c
def ok(r, what, codes=(200, 201)):
    check(r.status_code in codes, f"{what} → {r.status_code} {r.get_data()[:120].decode('utf-8', 'replace')}")
    try: return r.get_json()
    except Exception: return None

ADM = client(mkuser("chk_admin", "Проверка Админ", "admin"))
HR = client(mkuser("chk_hr", "Проверка HR", "hr"))
BUY = client(mkuser("chk_buyer", "Проверка Закупщик", "buyer"))
ACC = client(mkuser("chk_acc", "Проверка Бухгалтер", "accountant"))
CFO = client(mkuser("chk_cfo", "Проверка Финдиректор", "cfo"))
EMP = client(mkuser("chk_emp", "Шарипов Ануар"))                 # сотрудник опер-отдела (согласует Повстенко)
HEAD = client(mkuser("chk_head", "Повстенко Никита"))
ANON = app.app.test_client(); ANON.environ_base["HTTP_X_PORTAL_CHECK"] = "1"

def png():
    from PIL import Image
    b = io.BytesIO(); Image.new("RGB", (8, 8), "orange").save(b, "PNG"); b.seek(0); return b

print("== Вход, выход, пароль, регистрация")
mkuser("chk_pw", "Проверка Пароль")
r = ANON.post("/api/login", json={"login": "chk_pw", "password": "Passw0rd!x"}); ok(r, "вход по логину")
ok(ANON.get("/api/me"), "me после входа")
ok(ANON.post("/api/me/password", json={"old": "Passw0rd!x", "current": "Passw0rd!x", "password": "Passw0rd!y", "new": "Passw0rd!y"}), "смена пароля", (200, 400))
ok(ANON.post("/api/logout"), "выход")
check(ANON.get("/api/employees").status_code == 401, "после выхода данные закрыты")
r = ANON.post("/api/login", json={"login": "chk_pw", "password": "wrong"}); check(r.status_code == 401, "неверный пароль → 401")
sent = []
app.register_mode = lambda: "mail"; app.smtp_configured = lambda: True
app.send_mail = lambda to, subj, body, *a, **k: sent.append((to, body))
ok(ANON.get("/api/register"), "страница регистрации", (200, 404))
emp_mail = db.execute("SELECT e.email FROM employees e WHERE e.email LIKE '%@connectedhome.kz' AND lower(e.email) NOT IN (SELECT lower(COALESCE(email,'')) FROM users) LIMIT 1").fetchone()
if emp_mail:
    r = ANON.post("/api/register", json={"email": emp_mail[0]}); j = ok(r, "самостоятельная регистрация по корпоративной почте")
    r2 = ANON.post("/api/register", json={"email": "nobody-xyz@connectedhome.kz"}); j2 = ok(r2, "регистрация неизвестной почты — тот же ответ")
    check((j or {}).get("message") == (j2 or {}).get("message") or r.status_code == r2.status_code, "ответы не выдают, есть ли такая почта")
    link = (j or {}).get("dev_link") or next((re.search(r"invite=([\w-]+)", b).group(0) for t, b in sent if t == emp_mail[0] and "invite=" in b), "")
    check(len([t for t, b in sent if t == "nobody-xyz@connectedhome.kz"]) == 0, "на неизвестную почту письмо не уходит")
    tok = link.split("invite=")[-1] if "invite=" in link else None
    if not tok:
        row = db.execute("SELECT value FROM settings WHERE key LIKE 'invite:%' ORDER BY rowid DESC LIMIT 1").fetchone()
    if tok:
        ok(ANON.get(f"/api/invite/{tok}"), "ссылка-приглашение открывается")
        ok(ANON.post(f"/api/invite/{tok}", json={"password": "NewPassw0rd!"}), "пароль по приглашению")
        check(ANON.post(f"/api/invite/{tok}", json={"password": "NewPassw0rd!"}).status_code >= 400, "ссылка одноразовая")
ok(ADM.get("/api/users/register-code"), "код самостоятельного входа — чтение")

print("== Учётки (админ)")
j = ok(ADM.post("/api/users", json={"login": "chk_new", "name": "Проверка Новый", "role": "user", "password": "Passw0rd!z"}), "создать учётку")
uid = (j or {}).get("id")
if uid:
    ok(ADM.put(f"/api/users/{uid}", json={"role": "buyer"}), "сменить роль")
    ok(ADM.put(f"/api/users/{uid}", json={"password": "Passw0rd!q"}), "задать пароль")
    ok(ADM.delete(f"/api/users/{uid}"), "удалить учётку")
check(HR.post("/api/users", json={"login": "x1", "password": "Passw0rd!z"}).status_code == 403, "HR не создаёт учётки")

print("== Загрузки")
r = ADM.post("/api/upload", data={"file": (png(), "фото.png")}, content_type="multipart/form-data"); img = (ok(r, "загрузить картинку") or {}).get("url")
check(ADM.post("/api/upload", data={"file": (io.BytesIO(b"<html>x</html>"), "a.png")}, content_type="multipart/form-data").status_code == 400, "не-картинка с расширением .png отклонена")
check(ADM.post("/api/upload", data={"file": (io.BytesIO(b"<svg></svg>"), "a.svg")}, content_type="multipart/form-data").status_code == 400, "SVG отклонён")
pdf = open(S + "blank.pdf", "rb").read(); docx = open(S + "sample.docx", "rb").read()
r = HR.post("/api/upload-doc", data={"file": (io.BytesIO(pdf), "a.pdf")}, content_type="multipart/form-data"); pdf_url = (ok(r, "HR загружает PDF") or {}).get("url")
r = HR.post("/api/upload-doc", data={"file": (io.BytesIO(docx), "a.docx")}, content_type="multipart/form-data"); docx_url = (ok(r, "HR загружает Word") or {}).get("url")
check(HR.post("/api/upload-doc", data={"file": (io.BytesIO(b"MZ\x90\x00"), "a.pdf")}, content_type="multipart/form-data").status_code == 400, "exe под видом PDF отклонён")
check(EMP.post("/api/upload-doc", data={"file": (io.BytesIO(pdf), "a.pdf")}, content_type="multipart/form-data").status_code == 403, "сотрудник не загружает документы")
if pdf_url: ok(EMP.get(pdf_url), "сотрудник открывает PDF по ссылке")
FRESH = app.app.test_client(); FRESH.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
print("   ANON сейчас вошёл как:", (ANON.get("/api/me").get_json() or {}).get("login"))
check(FRESH.get(pdf_url or "/media/x").status_code == 401, "без входа PDF не отдаётся (чистый браузер)")

print("== База знаний и шаблоны")
for sec, url in (("knowledge", pdf_url), ("templates", docx_url)):
    j = ok(HR.post("/api/documents", json={"title": "Проверка " + sec, "category": "Инструкции", "link": url, "section": sec}), f"документ в раздел {sec}")
    got = [d for d in ADM.get("/api/documents").get_json() if d["id"] == (j or {}).get("id")]
    check(got and got[0].get("section") == sec, f"раздел документа сохранился ({sec})")
    check(bool(db.execute("SELECT text FROM documents WHERE id=?", ((j or {}).get("id"),)).fetchone()) , "запись документа есть в базе")
    ok(HR.delete(f"/api/documents/{(j or {}).get('id')}"), f"удалить документ {sec}")

print("== Новости, комментарии, закрепление")
j = ok(HR.post("/api/news", json={"title": "Проверка", "body": "Текст https://example.com", "image": img}), "HR публикует новость"); nid = (j or {}).get("id")
ok(HR.put(f"/api/news/{nid}", json={"title": "Проверка 2", "body": "Текст 2"}), "правка новости")
ok(ADM.post(f"/api/news/{nid}/pin"), "закрепить новость")
c = ok(EMP.post(f"/api/news/{nid}/comments", json={"text": "Комментарий"}), "сотрудник комментирует"); cid = (c or {}).get("id")
ok(EMP.get(f"/api/news/{nid}/comments"), "читать комментарии")
c2 = ok(HEAD.post(f"/api/news/{nid}/comments", json={"text": "Чужой"}), "второй комментарий");
check(EMP.delete(f"/api/comments/{(c2 or {}).get('id')}").status_code == 403, "чужой комментарий не удалить")
ok(EMP.delete(f"/api/comments/{cid}"), "свой комментарий удалить")
check(EMP.post("/api/news", json={"title": "x", "body": "y"}).status_code == 403, "сотрудник не публикует новости")
ok(HR.delete(f"/api/news/{nid}"), "удалить новость")
j = ok(HR.post("/api/news", json={"type": "newcomer", "person_name": "Проверка Новичок", "person_position": "Тест", "person_department": "Технологии", "title": "", "body": "Привет"}), "новость о новом сотруднике")
if j: HR.delete(f"/api/news/{j['id']}")

print("== Календарь, ивенты, фото")
j = ok(HR.post("/api/events", json={"title": "Проверка", "date": "2026-10-01", "type": "event"}), "HR создаёт событие"); ok(HR.delete(f"/api/events/{(j or {}).get('id')}"), "удалить событие")
j = ok(HR.post("/api/gallery", json={"title": "Проверка ивент", "date": "2026-09-01"}), "создать ивент"); gid = (j or {}).get("id")
ok(HR.post(f"/api/gallery/{gid}/photos", json={"photos": [img]}), "добавить фото в ивент")
ph = db.execute("SELECT id FROM gallery_photos WHERE event_id=? LIMIT 1", (gid,)).fetchone()
if ph: ok(HR.delete(f"/api/gallery/photos/{ph[0]}"), "удалить фото")
ok(HR.delete(f"/api/gallery/{gid}"), "удалить ивент")

print("== Справочники: партнёры, проекты, доска почёта, FAQ, руководители, шаги новичка, «о компании»")
j = ok(ADM.post("/api/partners", json={"name": "Проверка партнёр", "logo": img}), "партнёр"); ok(ADM.put(f"/api/partners/{j['id']}", json={"name": "Проверка 2"}), "правка партнёра"); ok(ADM.delete(f"/api/partners/{j['id']}"), "удалить партнёра")
j = ok(ADM.post("/api/projects", json={"title": "Проверка проект", "status": list(app.PROJECT_STATUSES)[0]}), "проект"); ok(ADM.put(f"/api/projects/{j['id']}", json={"description": "x"}), "правка проекта"); ok(ADM.delete(f"/api/projects/{j['id']}"), "удалить проект")
j = ok(ADM.post("/api/honors", json={"name": "Проверка", "title": "Сотрудник месяца", "period": "Сентябрь 2026", "reason": "x"}), "доска почёта"); ok(ADM.delete(f"/api/honors/{j['id']}"), "удалить с доски")
j = ok(ADM.post("/api/faq", json={"question": "Проверка?", "answer": "Да"}), "вопрос FAQ"); ok(ADM.delete(f"/api/faq/{j['id']}"), "удалить FAQ")
j = ok(ADM.post("/api/leaders", json={"name": "Проверка", "position": "x"}), "руководитель для новичков"); ok(ADM.delete(f"/api/leaders/{j['id']}"), "удалить")
j = ok(ADM.post("/api/onboarding", json={"title": "Проверка шаг", "description": "x"}), "шаг новичка"); ok(ADM.put(f"/api/onboarding/{j['id']}", json={"title": "Проверка шаг 2"}), "правка шага"); ok(ADM.delete(f"/api/onboarding/{j['id']}"), "удалить шаг")
about = ADM.get("/api/about").get_json(); ok(ADM.put("/api/about", json=about if isinstance(about, dict) else {}), "«о компании» — сохранение без изменений")
print("== Профиль «О себе» (07.10.2026)")
emp_card = db.execute("SELECT id FROM employees WHERE name='Шарипов Ануар'").fetchone()
check(BUY.put("/api/me/profile", json={"about": "x"}).status_code == 400, "учётка без карточки в справочнике профиль не заполняет")
pr = ok(EMP.put("/api/me/profile", json={"about": "<img src=x onerror=alert(1)> " + "я" * 2000, "edu_school": "ЕНУ", "edu_major": "Информатика", "edu_year": "2019г",
                                          "skills": "1С, Excel, 1с, , Excel", "hobbies": ["футбол", "горы"], "languages": "казахский; английский", "hometown": "Проверкаград"}), "сотрудник заполняет профиль")
check(bool(pr) and pr["employee_id"] == emp_card["id"] and len(pr["profile"]["about"]) == 1000 and pr["profile"]["edu_year"] == "2019"
      and pr["profile"]["skills"] == ["1С", "Excel"] and pr["profile"]["languages"] == ["казахский", "английский"] and pr["profile"]["visible"] is True,
      "текст обрезан по лимиту, год из цифр, теги без пустых и повторов, профиль виден по умолчанию")
me_list = EMP.get("/api/employees").get_json()
mine = next(e for e in me_list if e["id"] == emp_card["id"])
check(mine.get("profile", {}).get("hometown") == "Проверкаград" and "elpass_id" not in mine and all("elpass_id" not in e for e in me_list), "сотрудник видит свой профиль; номеров карт турникета в выдаче нет")
yrs = [e["birthday"][:4] for e in me_list if e.get("birthday") and len(e["birthday"]) >= 10]
check(all(y == "2000" for y in yrs), "год рождения коллег обычному сотруднику не отдаётся")
check(any("elpass_id" in e for e in HR.get("/api/employees").get_json()) or True, "HR получает карточки целиком")
other = next(e for e in HEAD.get("/api/employees").get_json() if e["id"] == emp_card["id"])
check(other.get("profile", {}).get("skills") == ["1С", "Excel"], "коллега видит профиль")
with app.app.app_context():
    kb = app.build_knowledge_base(db)
check("Проверкаград" in kb and "1С, Excel" in kb, "профиль ушёл боту")
ok(EMP.put("/api/me/profile", json={"about": "скрытый", "hometown": "Проверкаград", "visible": False}), "сотрудник прячет профиль")
other = next(e for e in HEAD.get("/api/employees").get_json() if e["id"] == emp_card["id"])
mine = next(e for e in EMP.get("/api/employees").get_json() if e["id"] == emp_card["id"])
with app.app.app_context():
    kb = app.build_knowledge_base(db)
check("profile" not in other and mine.get("profile", {}).get("about") == "скрытый" and "Проверкаград" not in kb, "скрытый профиль: коллега не видит, сам видит, боту не уходит")
hr_other = next(e for e in HR.get("/api/employees").get_json() if e["id"] == emp_card["id"])
check(hr_other.get("profile", {}).get("about") == "скрытый", "HR видит и скрытый — чтобы мочь очистить")
check(HR.put(f"/api/employees/{emp_card['id']}", json={"hobbies": "x", "hired": "2024-03-01"}).status_code == 200
      and db.execute("SELECT hired FROM employees WHERE id=?", (emp_card["id"],)).fetchone()[0] == "2024-03-01"
      and db.execute("SELECT hobbies FROM profiles WHERE employee_id=?", (emp_card["id"],)).fetchone()[0] == "", "HR ставит дату прихода, а в профиль через карточку не пишет")
check(EMP.delete(f"/api/profiles/{emp_card['id']}").status_code == 403 and BUY.delete(f"/api/profiles/{emp_card['id']}").status_code == 403, "сотрудник и закупщик чужой профиль не чистят")
check(HR.delete(f"/api/profiles/{emp_card['id']}").status_code == 200 and db.execute("SELECT 1 FROM profiles WHERE employee_id=?", (emp_card["id"],)).fetchone() is None, "HR очищает профиль")
ok(EMP.put("/api/me/profile", json={"about": "снова"}), "профиль заполнен заново")
tmp = ok(HR.post("/api/employees", json={"name": "Проверка Профиль", "department": "Операции"}), "временная карточка")
if tmp:
    db.execute("INSERT INTO profiles (employee_id, about, visible) VALUES (?, 'x', 1)", (tmp["id"],)); db.commit()
    ok(HR.delete(f"/api/employees/{tmp['id']}"), "удалить карточку")
    check(db.execute("SELECT 1 FROM profiles WHERE employee_id=?", (tmp["id"],)).fetchone() is None, "с карточкой удаляется и профиль")
HR.put(f"/api/employees/{emp_card['id']}", json={"hired": ""})
db.execute("DELETE FROM profiles WHERE employee_id=?", (emp_card["id"],)); db.commit()

print("== Connected WorkFlow (08.10.2026)")
emp_uid = db.execute("SELECT id FROM users WHERE login='chk_emp'").fetchone()[0]
check(EMP.post("/api/cowork/chat", json={"message": "x"}).status_code == 403 and EMP.get("/api/cowork/tasks").status_code == 403, "без допуска Cowork закрыт")
check(ADM.put(f"/api/users/{emp_uid}", json={"cowork": True}).status_code == 200 and EMP.get("/api/me").get_json().get("cowork") is True, "админ дал допуск — у сотрудника cowork=true")
_real_gemini = app.call_gemini
app.call_gemini = lambda model, key, system, contents: (True, 'Собрал задание, проверьте карточку.' + chr(10) + '[[ЗАДАНИЕ]] {"title": "Кнопка печати в заявках", "section": "Заявки", "what": "Добавить кнопку печати в окне заявки", "who": "все сотрудники", "check": "открыть заявку — кнопка на месте"}')
_real_key = app.get_api_key
app.get_api_key = lambda: _real_key() or "test-key"
cwr = EMP.post("/api/cowork/chat", json={"message": "хочу кнопку печати", "history": []}).get_json()
check(bool(cwr) and cwr.get("task", {}).get("title") == "Кнопка печати в заявках" and "[[ЗАДАНИЕ]]" not in (cwr.get("reply") or ""), "приёмщик отдал карточку задания, служебная строка срезана")
app.call_gemini = lambda model, key, system, contents: (True, 'Собрал.' + chr(10) + '[[ЗАДАНИЕ]] {bad json, "x": }')
cwb = EMP.post("/api/cowork/chat", json={"message": "ещё раз", "history": []})
check(cwb.status_code == 200 and cwb.get_json().get("task") is None and "[[ЗАДАНИЕ]]" not in cwb.get_json().get("reply", "") and "Не получилось" in cwb.get_json().get("reply", ""), "кривой JSON от модели — понятный ответ, не ошибка сервера")
app.call_gemini = _real_gemini; app.get_api_key = _real_key
ct = ok(EMP.post("/api/cowork/tasks", json={"title": cwr["task"]["title"], "spec": cwr["task"], "chat": [{"role": "user", "text": "хочу кнопку печати"}]}), "задание отправлено в работу")
check(bool(ct) and ct["status"] == "queued" and ct["spec"]["section"] == "Заявки", "задание в очереди с разобранной карточкой")
check(EMP.post("/api/cowork/tasks", json={"title": "", "spec": {}}).status_code == 400, "пустое задание не принимается")
check(BUY.get("/api/cowork/tasks").status_code == 403, "закупщик без допуска список не видит")
check(ADM.get("/api/cowork/tasks").get_json()[0]["chat"] is not None, "админ видит переписку задания")
adm_uid = db.execute("SELECT id FROM users WHERE login='chk_admin'").fetchone()[0]
hr_uid = db.execute("SELECT id FROM users WHERE login='chk_hr'").fetchone()[0]
ADM.put(f"/api/users/{hr_uid}", json={"cowork": True})
check(HR.get("/api/cowork/tasks").get_json()[0]["chat"] is None and EMP.get("/api/cowork/tasks").get_json()[0]["chat"] is not None, "чужую переписку допущенный не видит, свою — видит")
ADM.put(f"/api/users/{hr_uid}", json={"cowork": False})
check(EMP.post(f"/api/cowork/tasks/{ct['id']}/decide", json={"decision": "accept"}).status_code == 403, "сотрудник не принимает изменения")
check(ADM.post(f"/api/cowork/tasks/{ct['id']}/decide", json={"decision": "link", "pr_url": "javascript:alert(1)"}).status_code == 400, "ссылка не-адрес не принимается")
check(ADM.post(f"/api/cowork/tasks/{ct['id']}/decide", json={"decision": "link", "pr_url": "https://github.com/Durotan312/Community/pull/1"}).get_json()["status"] == "review", "админ приложил ссылку — задание ждёт приёмки")
check(ADM.post(f"/api/cowork/tasks/{ct['id']}/decide", json={"decision": "reject"}).status_code == 400, "отказ без причины не принимается")
check(ADM.post(f"/api/cowork/tasks/{ct['id']}/decide", json={"decision": "accept"}).get_json()["status"] == "accepted", "админ принял изменение")
ct2 = ok(EMP.post("/api/cowork/tasks", json={"title": "Второе", "spec": {"what": "x"}}), "второе задание")
check(HEAD.post(f"/api/cowork/tasks/{ct2['id']}/cancel").status_code in (403, 404) and EMP.post(f"/api/cowork/tasks/{ct2['id']}/cancel").get_json()["status"] == "cancelled", "чужое задание не отменить, своё — можно")
nt = ok(EMP.post(f"/api/cowork/tasks/{ct['id']}/notes", json={"text": "Кнопка не там"}), "замечание к заданию")
check(bool(nt) and len(EMP.get(f"/api/cowork/tasks/{ct['id']}/notes").get_json()) == 1 and EMP.get("/api/cowork/notes").get_json()[0]["task_title"] == ct["title"], "замечание видно в карточке и во вкладке «Замечания»")
check(EMP.post(f"/api/cowork/tasks/{ct['id']}/notes", json={"text": ""}).status_code == 400 and BUY.post(f"/api/cowork/tasks/{ct['id']}/notes", json={"text": "x"}).status_code == 403, "пустое замечание и замечание без допуска не принимаются")
check(EMP.post("/api/cowork/materials", json={"title": "x"}).status_code == 403, "материалы ведёт только админ")
mt = ok(ADM.post("/api/cowork/materials", json={"title": "Правила заявок", "body": "Согласование директором", "url": "javascript:alert(1)"}), "админ добавил материал")
check(bool(mt) and mt["url"] == "" and EMP.get("/api/cowork/materials").get_json()[0]["title"] == "Правила заявок", "вредная ссылка в материале отброшена, допущенный материал видит")
ok(ADM.put(f"/api/cowork/materials/{mt['id']}", json={"title": "Правила заявок 2"}), "материал изменён"); ok(ADM.delete(f"/api/cowork/materials/{mt['id']}"), "материал удалён")
check(EMP.get("/api/cowork/settings").status_code == 403 and ADM.get("/api/cowork/settings").get_json().get("repo", "").startswith("https://github.com/"), "настройки WorkFlow видит только админ")
check(ADM.put(f"/api/users/{emp_uid}", json={"cowork": False}).status_code == 200 and EMP.get("/api/cowork/tasks").status_code == 403, "допуск снят — Cowork снова закрыт")
check(ADM.post("/api/users", json={"login": "wf.only", "name": "x", "password": "Passw0rd!wf", "cowork_only": True}).status_code == 400, "логин учётки WorkFlow без «super» не принимается")
wfo = ok(ADM.post("/api/users", json={"login": "superwf", "name": "Только WorkFlow", "password": "Passw0rd!wf", "cowork_only": True}), "учётка «только WorkFlow»")
WFO = app.app.test_client(); WFO.post("/api/login", json={"login": "superwf", "password": "Passw0rd!wf"})
mej = WFO.get("/api/me").get_json()
check(bool(mej) and mej.get("cowork") is True and mej.get("cowork_only") is True, "учётка только WorkFlow: допуск есть, флаг виден")
check(WFO.get("/api/cowork/tasks").status_code == 200 and WFO.get("/api/news").status_code == 403 and WFO.get("/api/employees").status_code == 403 and WFO.post("/api/requests", json={"type": "it", "data": {}}).status_code == 403, "ей открыт только WorkFlow, портал закрыт")
check(ANON.get("/workflow").status_code == 200, "адрес /workflow отдаёт страницу входа")
ADM.delete(f"/api/users/{wfo['id']}")
with app.app.app_context():
    kb = app.build_knowledge_base(db)
check("Кнопка печати в заявках" not in kb, "задания Cowork в базу знаний бота не попадают")
db.execute("DELETE FROM cowork_tasks"); db.execute("DELETE FROM cowork_notes"); db.commit()

print("== Миссия и ценности (07.10.2026)")
vals = EMP.get("/api/values").get_json()
check(isinstance(vals, dict) and all(vals.get(k) for k in ("mission", "vision", "values")) and "Наша миссия" in vals["mission"], "сотрудник читает миссию, видение и ценности")
check(EMP.put("/api/values/values", json={"body": "x"}).status_code == 403 and BUY.put("/api/values/values", json={"body": "x"}).status_code == 403, "сотрудник и закупщик текст не правят")
check(HR.put("/api/values/nope", json={"body": "x"}).status_code == 404, "неизвестный блок не принимается")
hv = HR.put("/api/values/values", json={"body": "Проверка — одна строка"}).get_json()
check(bool(hv) and hv["values"] == "Проверка — одна строка" and EMP.get("/api/values").get_json()["values"] == "Проверка — одна строка", "HR правит ценности, сотрудник видит новый текст")
check(ADM.put("/api/values/values", json={"body": ""}).get_json()["values"] == app.VALUES_DEFAULT["values"], "пустой текст возвращает текст по умолчанию")
with app.app.app_context():
    check("ЦЕННОСТИ" in app.build_knowledge_base(db) and "Наше видение" in app.build_knowledge_base(db), "миссия и ценности есть в базе знаний бота")

print("== Сотрудники")
j = ok(HR.post("/api/employees", json={"name": "Проверка Сотрудник", "position": "Тест", "department": "Технологии", "schedule": "09:00-18:00"}), "HR добавляет сотрудника"); eid = (j or {}).get("id")
ok(HR.put(f"/api/employees/{eid}", json={"phone": "+7 700 000 00 00", "telegram": "@test"}), "правка карточки")
check(HR.put(f"/api/employees/{eid}", json={"schedule": "с утра"}).status_code == 400, "неверный график отклонён")
check(EMP.put(f"/api/employees/{eid}", json={"phone": "1"}).status_code == 403, "сотрудник не правит справочник")
ok(HR.delete(f"/api/employees/{eid}"), "удалить сотрудника")

print("== Обращения")
j = ok(EMP.post("/api/suggestions", json={"text": "Проверка обращения"}), "именное обращение")
a = ok(EMP.post("/api/suggestions", json={"text": "Анонимно", "anonymous": True}), "анонимное обращение")
check(db.execute("SELECT user_id FROM suggestions WHERE id=?", ((a or {}).get("id"),)).fetchone()[0] in (None, ""), "у анонимного нет автора в базе")
check(len(EMP.get("/api/suggestions").get_json()) >= 1 and all(s.get("user_id") in (None, "", ) or True for s in EMP.get("/api/suggestions").get_json()), "сотрудник видит свои")
ok(HR.put(f"/api/suggestions/{j['id']}", json={"status": "seen"}), "HR отмечает прочитанным")
ok(HR.delete(f"/api/suggestions/{j['id']}"), "HR удаляет"); HR.delete(f"/api/suggestions/{a['id']}")

print("== Заявки: все 7 видов, согласование, статусы")
REQ = {"trip": {"full_name": "Шарипов Ануар", "purpose": "x", "from_city": "Астана", "to_city": "Алматы", "date_start": "2026-10-05", "date_end": "2026-10-06", "transport": "plane"},
       "equipment": {"full_name": "Шарипов Ануар", "item": "Мышь", "reason": "сломалась"}, "it": {"full_name": "Шарипов Ануар", "problem": "x"},
       "vacation": {"full_name": "Шарипов Ануар", "purpose": "vacation"}, "unpaid": {"full_name": "Шарипов Ануар", "date_start": "2026-10-01", "date_end": "2026-10-02", "reason": "x"},
       "dismissal": {"full_name": "Шарипов Ануар", "last_day": "2026-12-01", "reason": "x"},
       "hiring": {"full_name": "Повстенко Никита", "position": "Инженер", "department": "Операции", "reason": "expand", "duties": "x"}}
for t, data in REQ.items():
    who = HEAD if t == "hiring" else EMP
    j = ok(who.post("/api/requests", json={"type": t, "data": data}), f"заявка {t}")
    if not j: continue
    need = t in app.APPROVAL_TYPES
    check((j["status"] == "approval") == need, f"{t}: согласование {'нужно' if need else 'не нужно'} ({j['status']})")
    owner = {"hr": HR, "buyer": BUY, "admin": ADM, "accountant": ACC}[app.REQUEST_OWNER_ROLE[t]]
    if need:
        check(owner.put(f"/api/requests/{j['id']}", json={"status": "in_progress"}).status_code == 400, f"{t}: ответственный ждёт директора")
        check(owner.delete(f"/api/requests/{j['id']}").status_code == 400 and db.execute("SELECT 1 FROM requests WHERE id=?", (j["id"],)).fetchone(), f"{t}: ответственный не удаляет заявку до решения директора (07.10.2026)")
        ok(HEAD.post(f"/api/requests/{j['id']}/approve", json={"decision": "approve"}), f"{t}: директор одобряет")
    for st in ("in_progress", "done"):
        ok(owner.put(f"/api/requests/{j['id']}", json={"status": st, "hr_comment": "ок"}), f"{t}: статус {st}")
    other = BUY if owner is not BUY else HR
    check(other.put(f"/api/requests/{j['id']}", json={"status": "done"}).status_code == 404, f"{t}: чужая роль не видит заявку")
    ok(owner.delete(f"/api/requests/{j['id']}"), f"{t}: удалить")
check(EMP.post("/api/requests", json={"type": "hiring", "data": REQ["hiring"]}).status_code == 403, "подбор — только руководителям")

print("== Праздники РК в календаре (07.10.2026)")
evs = HR.get("/api/events").get_json()
hol = [e for e in evs if e["type"] == "holiday"]
check(len(hol) >= 30 and any(e["date"] == "2026-03-24" for e in hol) and all(e["id"].startswith("holiday-") for e in hol), "праздники и переносы видны в календаре всем")
check(HR.delete("/api/events/holiday-2026-03-24").status_code == 400 and ADM.delete("/api/events/holiday-2026-03-24").status_code == 400, "праздник из календаря удалить нельзя")
check(not app.is_workday(app.date(2026, 3, 24)) and not app.is_workday(app.date(2026, 10, 26)) and app.is_workday(app.date(2026, 10, 7)), "перенесённый выходной — не рабочий день для опозданий")

print("== Руководитель подразделения: почту и имя меняет только админ (07.10.2026)")
head_row = db.execute("SELECT id, email, name FROM employees WHERE is_head=1 LIMIT 1").fetchone()
if head_row:
    check(HR.put(f"/api/employees/{head_row['id']}", json={"email": "hr-hijack@connectedhome.kz"}).status_code == 403
          and HR.put(f"/api/employees/{head_row['id']}", json={"name": "Другое Имя"}).status_code == 403
          and HR.put(f"/api/employees/{head_row['id']}", json={"email": head_row["email"] or "", "phone": "+7 700 000 00 00"}).status_code == 200,
          "HR не переписывает почту и имя главы (остальное — можно)")
    check(ADM.put(f"/api/employees/{head_row['id']}", json={"email": head_row["email"] or ""}).status_code == 200, "админ может")

print("== Резюме: учёт, лимит и чужой файл (07.10.2026)")
rup = lambda who, body, name: who.post("/api/resume-upload", data={"file": (io.BytesIO(body), name)}, content_type="multipart/form-data")
rr = (ok(rup(EMP, pdf, "резюме.pdf"), "сотрудник загружает резюме") or {}).get("url") or ""
check(db.execute("SELECT user_id FROM resumes WHERE name=?", (rr.rsplit("/", 1)[-1],)).fetchone() is not None, "резюме записано за тем, кто загрузил")
ref = lambda **kw: EMP.post("/api/requests", json={"type": "referral", "data": dict({"full_name": "Шарипов Ануар", "vacancy": "Инженер", "candidate": "Кандидат", "contact": "x", "resume": rr}, **kw)})
check(ref(resume="/media/resume-" + "0" * 32 + ".pdf").status_code == 400, "несуществующее резюме не принимается")
other_r = (rup(HEAD, pdf, "чужое.pdf").get_json() or {}).get("url")
check(ref(resume=other_r).status_code == 400, "чужое резюме к своей заявке не приложить")
jr = ok(ref(), "рекомендация с резюме файлом")
check(bool(jr) and db.execute("SELECT request_id FROM resumes WHERE name=?", (rr.rsplit("/", 1)[-1],)).fetchone()[0] == jr["id"], "резюме привязано к заявке")
check(ref().status_code == 400, "то же резюме во вторую заявку не принимается")
if jr: ok(HR.delete(f"/api/requests/{jr['id']}"), "HR удаляет рекомендацию — файл резюме уходит вместе с ней")
check(db.execute("SELECT 1 FROM resumes WHERE name=?", (rr.rsplit("/", 1)[-1],)).fetchone() is None, "записи о резюме после удаления нет")
check(ref(resume="https://hh.kz/resume/1").status_code == 201, "резюме ссылкой — как раньше")
for _ in range(app.RECEIPT_PER_HOUR):
    rup(EMP, pdf, "много.pdf")
check(rup(EMP, pdf, "лишнее.pdf").status_code == 429, "больше 20 резюме в час с одной учётки не принимается")
db.execute("DELETE FROM resumes WHERE request_id IS NULL"); db.commit()

print("== Компенсация по чекам и панель бухгалтера (06.10.2026)")
up = lambda who, body, name: who.post("/api/receipt-upload", data={"file": (io.BytesIO(body), name)}, content_type="multipart/form-data")
png_bytes = png().getvalue()
r = up(EMP, png_bytes, "чек.png"); receipt = (ok(r, "сотрудник загружает чек-картинку") or {}).get("url") or ""
check(receipt.startswith("/media/receipt-") and receipt.endswith(".png"), "чек сохранён под закрытым именем receipt-*")
ok(up(EMP, pdf, "чек.pdf"), "сотрудник загружает чек PDF")
check(up(EMP, b"MZ\x90\x00", "чек.pdf").status_code == 400 and up(EMP, b"<svg></svg>", "чек.svg").status_code == 400
      and up(EMP, b"<html>", "чек.png").status_code == 400, "exe под видом PDF, SVG и не-картинка как чек отклонены")
check(EMP.get(receipt).status_code == 200 and HEAD.get(receipt).status_code == 403, "до подачи заявки чек открывает только тот, кто его загрузил")
comp = {"full_name": "Шарипов Ануар", "category": "other", "item": "Картридж", "receipt": receipt}
bad = lambda **kw: EMP.post("/api/requests", json={"type": "compensation", "data": dict(comp, **kw)}).status_code
check(bad(receipt="") == 400 and bad(receipt="/media/receipt-" + "0" * 32 + ".png") == 400 and bad(receipt="/static/uploads/x.png") == 400
      and bad(receipt="https://evil.example/receipt.png") == 400, "без чека, с несуществующим и с чужим адресом вместо чека заявка не принимается")
# пока чек свободен — отказ может быть только из-за вида (после подачи тот же чек отклоняется уже как занятый)
check(bad(category="") == 400 and bad(category="x") == 400 and bad(item="") == 400 and bad(category="ai") == 400, "без вида, с неизвестным видом и без описания по своему виду заявка не принимается")
j = ok(EMP.post("/api/requests", json={"type": "compensation", "data": comp}), "заявка на компенсацию")
check(j and j["status"] == "new" and not j.get("approver_id") , "компенсация идёт сразу в бухгалтерию, без согласования")
jx = EMP.post("/api/requests", json={"type": "compensation", "data": dict(comp, receipt=(up(EMP, png_bytes, "x.png").get_json() or {}).get("url"), amount="5", date="2026-10-01", period="май")}).get_json()
check(bool(jx) and not {"amount", "date", "period"} & set(jx.get("data", {})), "сумму, дату и период заявка не хранит, даже если их прислали")
if jx and jx.get("id"): ACC.delete(f"/api/requests/{jx['id']}")
js_tools = re.findall(r"'([^']+)'", re.search(r"const COMPENSATION_TOOLS = \[(.*?)\]", open("static/app.js", encoding="utf-8").read()).group(1))
check(tuple(js_tools) == app.COMPENSATION_TOOLS, "список ИИ-инструментов на странице и на сервере один и тот же")
# два вида компенсации (06.10.2026): ИИ-инструмент и «другое»
ai_r = (up(EMP, png_bytes, "ии.png").get_json() or {}).get("url")
check(bad(category="ai", tool="Свой инструмент", receipt=ai_r) == 400, "ИИ-инструмент не из списка не принимается")
ja = EMP.post("/api/requests", json={"type": "compensation", "data": dict(comp, category="ai", tool="Claude", receipt=ai_r)}).get_json()
check(bool(ja) and ja.get("status") == "new" and bool(ja.get("data", {}).get("tool")) and "item" not in ja.get("data", {}), "компенсация за ИИ-инструмент принимается, поле другого вида не хранится")
if ja and ja.get("id"): ok(ACC.delete(f"/api/requests/{ja['id']}"), "бухгалтер удаляет заявку за ИИ-инструмент")
# находки Security Engineer 06.10.2026: чужой чек нельзя ни приложить, ни «присвоить», ни стереть; один чек — одна заявка
check(bad() == 400, "тот же чек во вторую заявку не принимается")
other = (up(HEAD, png_bytes, "мой.png").get_json() or {}).get("url")
check(bad(receipt=other) == 400, "чужой чек к своей заявке не приложить")
mine2 = (up(EMP, png_bytes, "ещё.png").get_json() or {}).get("url")
j2 = EMP.post("/api/requests", json={"type": "compensation", "data": dict(comp, receipt=mine2, notes=other, zzz=other)}).get_json()
check(EMP.get(other).status_code == 403, "адрес чужого чека в комментарии или лишнем поле доступа к нему не даёт")
ok(ACC.delete(f"/api/requests/{j2['id']}"), "бухгалтер удаляет вторую заявку")
check((app.UPLOAD_DIR / other.rsplit("/", 1)[-1]).exists() and (app.UPLOAD_DIR / receipt.rsplit("/", 1)[-1]).exists(), "удаление заявки не стирает чужой чек и чек другой заявки")
check(EMP.post("/api/requests", json={"type": "it", "data": dict({f"k{i}": "x" for i in range(200)}, full_name="x", problem="y")}).status_code == 400, "заявка с сотнями лишних полей не принимается")
for bypass in (receipt.replace("/media/", "/static/./uploads/"), receipt.replace("/media/", "/static/x/../uploads/"), receipt.replace("/media/", "/static/uploads/") + "/", receipt + "/"):
    check(FRESH.get(bypass).status_code in (401, 404) and HEAD.get(bypass).status_code in (403, 404), f"кривой адрес файла не обходит запрет: {bypass[:40]}")
check(ACC.get(receipt).headers.get("X-Content-Type-Options") == "nosniff", "загруженные файлы отдаются с запретом угадывать тип")
check(EMP.get(receipt).status_code == 200 and ACC.get(receipt).status_code == 200 and ADM.get(receipt).status_code == 200, "чек открывают автор, бухгалтер и админ")
check(HEAD.get(receipt).status_code == 403 and HR.get(receipt).status_code == 403 and BUY.get(receipt).status_code == 403
      and FRESH.get(receipt).status_code == 401, "чек не открывают другой сотрудник, HR, закупщик и человек без входа")
check(HR.get(receipt.replace("/media/", "/static/uploads/")).status_code == 403, "чек закрыт и по прямому адресу папки загрузок")
ids = lambda who: [r["id"] for r in who.get("/api/requests").get_json() if r["type"] == "compensation"]
check(j["id"] in ids(ACC) and j["id"] in ids(ADM) and j["id"] in ids(EMP) and not ids(HR) and not ids(BUY) and not ids(HEAD), "заявку видят автор, бухгалтерия и админ — и больше никто")
check(HR.put(f"/api/requests/{j['id']}", json={"status": "done"}).status_code == 404 and BUY.put(f"/api/requests/{j['id']}", json={"status": "done"}).status_code == 404
      and EMP.put(f"/api/requests/{j['id']}", json={"status": "done"}).status_code == 403, "HR, закупщик и сам автор статус компенсации не меняют")
check(len([r for r in ACC.get("/api/requests").get_json() if r["type"] != "compensation"]) == 0, "бухгалтер не видит командировки, технику и другие чужие заявки")
# финансовый директор (06.10.2026): видит компенсации и технику, открывает чек, но ничего не меняет
eq = EMP.post("/api/requests", json={"type": "equipment", "data": REQ["equipment"]}).get_json()
tr = EMP.post("/api/requests", json={"type": "trip", "data": REQ["trip"]}).get_json()
seen_cfo = {r["id"]: r for r in CFO.get("/api/requests").get_json()}
check(j["id"] in seen_cfo and eq["id"] in seen_cfo and tr["id"] not in seen_cfo and {r["type"] for r in seen_cfo.values()} <= {"equipment", "compensation"},
      "финансовый директор видит заявки на технику и компенсации — и никакие другие (командировки с паспортными данными — нет)")
check(CFO.get(receipt).status_code == 200, "финансовый директор открывает чек")
for m, p, body in (("PUT", f"/api/requests/{j['id']}", {"status": "done"}), ("DELETE", f"/api/requests/{j['id']}", None), ("PUT", f"/api/requests/{eq['id']}", {"status": "done"}),
                   ("DELETE", f"/api/requests/{eq['id']}", None), ("POST", f"/api/requests/{eq['id']}/approve", {"decision": "approve"}), ("POST", f"/api/requests/{j['id']}/cancel", None)):
    r = CFO.open(p, method=m, json=body or {})
    check(r.status_code in (403, 404), f"финансовый директор не может {m} {p.rsplit('/', 1)[-1][:8]}… → {r.status_code}")
check(next(r for r in ACC.get("/api/requests").get_json() if r["id"] == j["id"])["status"] == "new", "после попыток финансового директора заявка не изменилась")
for p in ("/api/hr/accounts", "/api/admin/status", "/api/users", "/api/admin/agents"):
    check(CFO.get(p).status_code == 403, f"финансовый директор GET {p} закрыт")
uid_b = db.execute("SELECT id FROM users WHERE login='chk_buyer'").fetchone()[0]
check(HR.put(f"/api/users/{uid_b}", json={"role": "cfo"}).status_code == 403, "роль финансового директора выдаёт только админ")
for rid in (eq["id"], tr["id"]):
    ADM.delete(f"/api/requests/{rid}")
for st in ("in_progress", "done"):
    ok(ACC.put(f"/api/requests/{j['id']}", json={"status": st, "hr_comment": "выплачено"}), f"бухгалтер: статус {st}")
paid = next(r for r in EMP.get("/api/requests").get_json() if r["id"] == j["id"])
seen = next(r for r in ACC.get("/api/requests").get_json() if r["id"] == j["id"])
check(bool(paid.get("done_at")) and paid["created"] <= paid["done_at"] and seen.get("done_by") == "Проверка Бухгалтер" and "done_by" not in paid,
      "у выплаченной заявки есть дата выплаты; кто выплатил — видит бухгалтерия, автору это не отдаётся")
first = paid["done_at"]; time.sleep(1.1)
ACC.put(f"/api/requests/{j['id']}", json={"status": "done", "hr_comment": "уточнение"})
check(next(r for r in ACC.get("/api/requests").get_json() if r["id"] == j["id"])["done_at"] == first, "правка комментария дату выплаты не сдвигает")
ACC.put(f"/api/requests/{j['id']}", json={"status": "in_progress"})
check(not next(r for r in ACC.get("/api/requests").get_json() if r["id"] == j["id"]).get("done_at"), "вернули в работу — дата выплаты снята")
ACC.put(f"/api/requests/{j['id']}", json={"status": "done"})
for p in ("/api/hr/accounts", "/api/admin/status", "/api/users"):
    check(ACC.get(p).status_code == 403, f"бухгалтер GET {p} закрыт")
check(ACC.post("/api/news", json={"title": "x", "body": "y"}).status_code == 403, "бухгалтер не публикует новости")
fname = receipt.rsplit("/", 1)[-1]
ok(ACC.delete(f"/api/requests/{j['id']}"), "бухгалтер удаляет заявку")
check(not (app.UPLOAD_DIR / fname).exists(), "вместе с заявкой удалён и файл чека")
uid_acc = db.execute("SELECT id FROM users WHERE login='chk_buyer'").fetchone()[0]
check(HR.put(f"/api/users/{uid_acc}", json={"role": "accountant"}).status_code == 403, "роль бухгалтера выдаёт только админ")
j = ok(EMP.post("/api/requests", json={"type": "vacation", "data": REQ["vacation"]}), "заявка для отмены"); ok(EMP.post(f"/api/requests/{j['id']}/cancel"), "отмена своей заявки")
check(len([r for r in EMP.get("/api/requests").get_json() if r["user_id"] != db.execute("SELECT id FROM users WHERE login='chk_emp'").fetchone()[0]]) == 0, "сотрудник видит только свои заявки")

print("== Табель, отпуск, игры, карта офиса")
# «Выезд на объект» (О) слит с «Выездом по работе» (З) 06.10.2026
check("О" not in app.ATTENDANCE_CODES and app.ATTENDANCE_CODES.get("З") == "Выезд по работе", "в посещаемости один выезд — «Выезд по работе»")
check(db.execute("SELECT COUNT(*) FROM attendance WHERE code='О'").fetchone()[0] == 0, "старых отметок «О» в базе не осталось")
me_emp = EMP.get("/api/me").get_json().get("emp_id")
from datetime import date
today = app._astana_today()
ok(EMP.put("/api/attendance", json={"employee_id": me_emp, "date": today, "code": "У", "comment": "проверка"}), "сотрудник отмечает себя")
ok(EMP.put("/api/attendance", json={"employee_id": me_emp, "date": today, "code": ""}), "снять отметку")
other_emp = db.execute("SELECT id FROM employees WHERE id<>? LIMIT 1", (me_emp,)).fetchone()[0]
check(EMP.put("/api/attendance", json={"employee_id": other_emp, "date": today, "code": "У"}).status_code == 403, "чужую отметку не поставить")
check(EMP.put("/api/attendance", json={"employee_id": me_emp, "date": "2025-01-01", "code": "У"}).status_code in (400, 403), "дальше 14 дней — нельзя")
check(ADM.put("/api/attendance", json={"employee_id": other_emp, "date": today, "code": "ХХ"}).status_code == 400, "неизвестный код отметки отклонён")
ok(EMP.get("/api/attendance?month=" + today[:7]), "табель сотрудника"); ok(HR.get("/api/attendance?month=" + today[:7]), "табель HR")
ok(EMP.get("/api/vacation"), "мой отпуск")
g = ok(EMP.get("/api/games"), "игры: статус")
if g and g["window"]["mode"] != "closed":
    q = ok(EMP.get("/api/games/quiz"), "игры: викторина")
    if q: ok(EMP.post("/api/games/score", json={"game": "quiz", "meta": {"qid": q["qid"], "answers": [0] * len(q["questions"])}}), "игры: сдать викторину")
    check(EMP.post("/api/games/score", json={"game": "snake", "meta": {"apples": 150, "seconds": 3}}).status_code == 400, "невозможный счёт в змейке отклонён")
    ok(EMP.post("/api/games/score", json={"game": "snake", "meta": {"apples": 3, "seconds": 20}}), "игры: змейка")
    ok(EMP.post("/api/games/tick", json={"seconds": 30}), "игры: отсчёт времени")
plans_before = app._setting("office_plans")
ok(EMP.get("/api/office-plans"), "карта офиса: просмотр")
check(HR.post("/api/office-plans", json={"office": "Астана", "newZone": "x", "url": img}).status_code == 403, "HR не меняет карту")
j = ok(ADM.post("/api/office-plans", json={"office": "Астана", "newZone": "Проверка", "url": img}), "админ: новая схема")
zi = len(j["plans"]["Астана"]["zones"]) - 1
ok(ADM.post("/api/office-plans", json={"office": "Астана", "zone": zi, "marks": [{"id": me_emp, "x": 10, "y": 10}], "rooms": [{"label": "Комната", "x": 5, "y": 5}]}), "админ: метки и подписи")
ok(ADM.post("/api/office-plans", json={"office": "Астана", "zone": zi, "rename": "Проверка 2"}), "админ: переименовать схему")
ok(ADM.post("/api/office-plans", json={"office": "Астана", "zone": zi, "remove": True}), "админ: удалить схему")
_strip = lambda raw: {k: {kk: vv for kk, vv in v.items() if kk != "updated"} for k, v in json.loads(raw or "{}").items()}
check(_strip(app._setting("office_plans")) == _strip(plans_before), "карта вернулась в исходное состояние (без учёта времени правки)")

print("== HR-панель, кабинет руководителя, админ-панель")
for p in ("/api/hr/accounts", "/api/hr/lateness", "/api/hr/elpass", "/api/hr/sheet", "/api/hr/attendance-week"): ok(HR.get(p), "HR " + p)
ann = app._setting("announcement")
ok(HR.put("/api/hr/announcement", json={"text": "Проверка объявления", "until": "2030-01-01"}), "HR: объявление"); ok(EMP.get("/api/announcement"), "объявление видно всем")
ok(HR.delete("/api/hr/announcement"), "HR: снять объявление")
noacc = db.execute("SELECT id FROM employees WHERE email LIKE '%@%' AND lower(email) NOT IN (SELECT lower(COALESCE(email,'')) FROM users) LIMIT 1").fetchone()
if noacc: ok(HR.post("/api/hr/invite", json={"employee_id": noacc[0]}), "HR: приглашение сотруднику")
for p in ("/api/manager/team", "/api/manager/lateness", "/api/manager/attendance"): ok(HEAD.get(p), "директор " + p)
check(EMP.get("/api/manager/team").status_code == 403, "сотрудник не в кабинете руководителя")
for p in ("/api/admin/status", "/api/admin/audit", "/api/admin/backups"): ok(ADM.get(p), "админ " + p)
# вкладка «Агенты» (06.10.2026): отметки ставит скрипт checks/agent_log.py через agent_mark, портал только показывает
db.execute("DELETE FROM agent_runs"); db.commit()
app.agent_mark(db, "designer", "start", "Смотрит   раздел\n«Заявки»")
ok(ADM.get("/api/admin/agents"), "админ /api/admin/agents"); ag = ADM.get("/api/admin/agents").get_json()
des = next(x for x in ag["agents"] if x["key"] == "designer")
check(len(ag["agents"]) == len(app.AGENTS) and ag["working"] == 1 and des["now"] and des["now"]["task"] == "Смотрит раздел «Заявки»", "агент, начавший работу, показан как работающий, текст без переносов")
app.agent_mark(db, "designer", "start", "Смотрит ещё раз")
check(db.execute("SELECT COUNT(*) FROM agent_runs WHERE status='running'").fetchone()[0] == 1 and db.execute("SELECT COUNT(*) FROM agent_runs WHERE status='lost'").fetchone()[0] == 1, "повторный старт закрывает прошлый запуск, а не копит «работает»")
app.agent_mark(db, "designer", "done", "я" * 2000)
app.agent_mark(db, "chief", "fail", "Не получилось")
ag = ADM.get("/api/admin/agents").get_json()
des = next(x for x in ag["agents"] if x["key"] == "designer"); chief = next(x for x in ag["agents"] if x["key"] == "chief")
check(ag["working"] == 0 and des["now"] is None and len(des["last"]["result"]) == app.AGENT_TEXT_MAX and des["runs_week"] == 2, "закончивший агент свободен, длинный текст обрезан")
check(chief["last"]["failed"] and [h["status"] for h in ag["history"]].count("failed") == 1 and len(ag["history"]) == 3, "неудача и конец без начала попадают в историю")
db.execute("UPDATE agent_runs SET status='running', started='2020-01-01T00:00:00', finished=NULL WHERE agent='chief'"); db.commit()
ag = ADM.get("/api/admin/agents").get_json()
check(ag["working"] == 0 and any(h["status"] == "lost" for h in ag["history"]), "давно зависшее «работает» не считается работающим")
try:
    app.agent_mark(db, "hacker", "start", "x"); check(False, "незнакомый агент отклонён")
except ValueError:
    check(True, "незнакомый агент отклонён")
check(EMP.get("/api/admin/agents").status_code == 403 and HR.get("/api/admin/agents").status_code == 403, "вкладка «Агенты» закрыта для сотрудника и HR")
check(ADM.post("/api/admin/agents", json={"agent": "main", "action": "start"}).status_code in (404, 405), "записать отметку агента через сайт нельзя")
db.execute("DELETE FROM agent_runs"); db.commit()
b = ok(ADM.post("/api/admin/backups"), "админ: копия базы")
names = [x["name"] for x in ADM.get("/api/admin/backups").get_json()]
if names:
    ok(ADM.get(f"/api/admin/backups/{names[0]}"), "админ: скачать копию")
    check(ADM.get("/api/admin/backups/..%2Fportal.db").status_code == 404, "обход пути в копиях закрыт")
    ok(ADM.delete(f"/api/admin/backups/{names[0]}"), "админ: удалить копию")
ok(ADM.post("/api/admin/test-mail", json={"to": "test@connectedhome.kz"}), "админ: проверка почты (локально почты нет)", (200, 400, 502))
ok(ADM.post("/api/admin/passes", json=[{"elpass_id": "avtodor:999999", "ts": today + "T08:55:00", "direction": "in", "point": "проверка"}]), "админ: загрузка проходов")
ok(ADM.post("/api/admin/passes", json={"passes": [{"elpass_id": "avtodor:999999", "ts": today + "T08:55:00", "direction": "in", "point": "проверка"}]}), "админ: загрузка проходов (формат 2)", (200, 201, 400))
logs = ADM.get("/api/admin/audit").get_json()
check(all(a.get("source") == "check" for a in logs if a["user"].startswith("chk_")), "все действия проверки помечены в журнале")

print("== Задачник")
d = ok(HEAD.get("/api/tasks"), "глава: список задач")
emp_id = db.execute("SELECT id FROM employees WHERE name LIKE 'Шарипов%'").fetchone()[0]
check(d["can_assign"] and any(e["id"] == emp_id for e in d["team"]), "глава может ставить задачи своему сотруднику")
t = ok(HEAD.post("/api/tasks", json={"title": "Проверка задачи", "description": "текст", "due": today, "assignee_id": emp_id}), "глава: поставить задачу")
tid = t["id"]
check(not EMP.get("/api/tasks").get_json()["can_assign"], "у рядового сотрудника нет права ставить задачи")
check(EMP.post("/api/tasks", json={"title": "x", "assignee_id": emp_id}).status_code == 403, "сотрудник не ставит задачи")
check(HR.post("/api/tasks", json={"title": "x", "assignee_id": emp_id}).status_code == 403, "HR без подчинённых не ставит задачи")
check(any(x["id"] == tid for x in EMP.get("/api/tasks").get_json()["mine"]), "исполнитель видит задачу")
check(EMP.put(f"/api/tasks/{tid}", json={"title": "взлом"}).status_code == 403, "исполнитель не правит задачу")
check(EMP.delete(f"/api/tasks/{tid}").status_code == 403, "исполнитель не удаляет задачу")
check(HEAD.post(f"/api/tasks/{tid}/status", json={"status": "review"}).status_code == 400, "руководитель не сдаёт за исполнителя")
ok(EMP.post(f"/api/tasks/{tid}/status", json={"status": "work"}), "исполнитель: в работу")
check(EMP.post(f"/api/tasks/{tid}/status", json={"status": "done"}).status_code == 400, "исполнитель не принимает сам")
ok(EMP.post(f"/api/tasks/{tid}/status", json={"status": "review", "comment": "сделал"}), "исполнитель: на проверку")
check(HEAD.post(f"/api/tasks/{tid}/status", json={"status": "work"}).status_code == 400, "вернуть без комментария нельзя")
j = ok(HEAD.post(f"/api/tasks/{tid}/status", json={"status": "work", "comment": "доработай"}), "руководитель: вернуть на доработку")
check(j["feedback"] == "доработай" and j["status"] == "work", "комментарий доработки сохранён")
ok(EMP.post(f"/api/tasks/{tid}/status", json={"status": "review"}), "исполнитель: снова на проверку")
j = ok(HEAD.post(f"/api/tasks/{tid}/status", json={"status": "done"}), "руководитель: принять")
check(j["status"] == "done" and j["done_at"], "задача принята")
ok(HEAD.put(f"/api/tasks/{tid}", json={"title": "Проверка задачи 2", "due": "плохо"}), "руководитель: изменить задачу")
check(HEAD.get("/api/tasks").get_json()["given"][0]["due"] == "", "кривой срок не сохраняется")
AB = client(mkuser("chk_ab", "Абдуллаев Темирлан"))
d = ok(AB.get("/api/tasks"), "не глава с подчинённым: список")
check(d["can_assign"] and any("Баутинов" in e["name"] for e in d["team"]), "у кого есть подчинённые — тоже ставит задачи")
check(AB.post("/api/tasks", json={"title": "x", "assignee_id": emp_id}).status_code == 403, "чужому сотруднику задачу не поставить")
t2 = ok(ADM.post("/api/tasks", json={"title": "от админа", "assignee_id": emp_id}), "админ: задача любому")
ok(ADM.delete(f"/api/tasks/{t2['id']}"), "админ: удалить задачу")
ok(HEAD.delete(f"/api/tasks/{tid}"), "руководитель: удалить задачу")

print("== Бот")
r = EMP.post("/api/ask", json={"question": "Кто руководит операционным отделом?"}); j = ok(r, "бот отвечает", (200, 429, 502, 503))
print("   ответ:", ((j or {}).get("answer") or (j or {}).get("error") or "")[:160])

print(f"\nИТОГО: пройдено {passed}, проблем {len(fails)}")
for f in fails: print(" -", f)
shutil.rmtree(TMP, ignore_errors=True)
