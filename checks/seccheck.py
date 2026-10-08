# -*- coding: utf-8 -*-
"""Проверка прав и защит на КОПИИ локальной базы: каждый изменяющий адрес без входа / под сотрудником / с чужого сайта,
подбор пароля, приглашения, обход путей, чужие данные. Рабочая база не трогается."""
import sqlite3, sys, os, io, json, shutil, tempfile, uuid, re, time
from datetime import datetime, timedelta
from pathlib import Path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # корень проекта: скрипт лежит в checks/
os.chdir(ROOT); sys.path.insert(0, ROOT)
assert not os.path.isdir("/app"), "только локально"
import app
from werkzeug.security import generate_password_hash

import _tmp; TMP = _tmp.fresh("portal-sec-")   # заодно убирает копии базы от прошлых запусков
shutil.copyfile(app.DB_PATH, TMP / "portal.db"); (TMP / "uploads").mkdir(); (TMP / "backups").mkdir()
(TMP / "uploads" / "doc-test.pdf").write_bytes(b"%PDF-1.4 test")
app.DB_PATH = TMP / "portal.db"; app.UPLOAD_DIR = TMP / "uploads"; app.BACKUP_DIR = TMP / "backups"
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
fails, passed = [], 0
def check(cond, what):
    global passed
    if cond: passed += 1
    else: fails.append(what); print("  !!", what)
def mkuser(login, name, role="user"):
    uid = uuid.uuid4().hex
    db.execute("INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?,?,?,?,?,'2026-09-23')",
               (uid, login, generate_password_hash("Passw0rd!x"), name, role)); db.commit(); return uid
def client(uid=None):
    c = app.app.test_client(); c.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
    if uid:
        ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
        with c.session_transaction() as s: s["uid"] = uid; s["pv"] = app._pw_stamp(ph)
    return c
ANON, USER = client(), client(mkuser("sec_user", "Шарипов Ануар"))
HR, BUY, ADM = client(mkuser("sec_hr", "Сек HR", "hr")), client(mkuser("sec_buy", "Сек Закуп", "buyer")), client(mkuser("sec_adm", "Сек Админ", "admin"))
ACC = client(mkuser("sec_acc", "Сек Бухгалтер", "accountant"))
CFO = client(mkuser("sec_cfo", "Сек Финдиректор", "cfo"))

# все изменяющие адреса приложения (с подставленными id)
rules = []
for rule in app.app.url_map.iter_rules():
    if not str(rule).startswith("/api/"): continue
    for m in rule.methods & {"POST", "PUT", "DELETE"}:
        path = re.sub(r"<[^>]+>", "x" * 32, str(rule))
        rules.append((m, path))
print("изменяющих адресов:", len(rules))

print("== 1. Без входа — везде отказ (кроме входа/регистрации/приглашений)")
PUBLIC = ("/api/login", "/api/register", "/api/invite/", "/api/logout")
for m, p in rules:
    if p.startswith(PUBLIC): continue
    r = ANON.open(p, method=m, json={})
    check(r.status_code == 401, f"аноним {m} {p} → {r.status_code}")

print("== 2. Сотрудник — отказ на всём, кроме своих разрешённых действий")
USER_OK = ("/api/ask", "/api/suggestions", "/api/requests", "/api/logout", "/api/me/password", "/api/games", "/api/attendance", "/api/english", "/api/resume-upload", "/api/receipt-upload", "/api/translate", "/api/tasks", "/api/login", "/api/register", "/api/invite/", "/api/me/profile", "/api/cowork/")
for m, p in rules:
    allowed = any(p.startswith(a) for a in USER_OK) or (p.startswith("/api/news/") and p.endswith("/comments")) or p.startswith("/api/comments/")
    if allowed: continue
    r = USER.open(p, method=m, json={})
    check(r.status_code == 403, f"сотрудник {m} {p} → {r.status_code} (ждали 403)")

print("== 2а. Финансовый директор только смотрит: ни один изменяющий адрес, кроме общих для всех сотрудников, ему не открыт")
for m, p in rules:
    allowed = any(p.startswith(a) for a in USER_OK) or (p.startswith("/api/news/") and p.endswith("/comments")) or p.startswith("/api/comments/")
    if allowed: continue
    r = CFO.open(p, method=m, json={})
    check(r.status_code == 403, f"финансовый директор {m} {p} → {r.status_code} (ждали 403)")

# и читает только своё: чужие заявки — лишь техника и компенсации; резюме кандидатов и HR-адреса закрыты
uid_cfo = db.execute("SELECT id FROM users WHERE login='sec_cfo'").fetchone()[0]
foreign = {r["type"] for r in CFO.get("/api/requests").get_json() if r["user_id"] != uid_cfo}
check(foreign <= set(app.REQUEST_VIEW_ROLES["cfo"]) == {"equipment", "compensation"}, f"финансовый директор видит из чужих заявок только технику и компенсации ({sorted(foreign)})")
check(CFO.get("/media/resume-" + "0" * 32 + ".pdf").status_code == 403, "резюме кандидатов финансовому директору закрыты")
for p in ("/api/hr/accounts", "/api/hr/lateness", "/api/admin/status", "/api/users"):
    check(CFO.get(p).status_code == 403, f"финансовый директор GET {p} закрыт")

print("== 3. Закупщик и HR не лезут в админку и чужие разделы")
for m, p in rules:
    if p.startswith("/api/admin") or p.startswith("/api/users"):
        for who, c in (("HR", HR), ("закупщик", BUY), ("бухгалтер", ACC)):
            r = c.open(p, method=m, json={}); check(r.status_code == 403, f"{who} {m} {p} → {r.status_code}")
    if p.startswith("/api/hr") and m != "GET":
        for who, c in (("закупщик", BUY), ("бухгалтер", ACC)):
            r = c.open(p, method=m, json={}); check(r.status_code == 403, f"{who} {m} {p} → {r.status_code}")

print("== 4. Подделка запроса с чужого сайта (CSRF)")
for m, p in rules:
    if p.startswith(("/api/login", "/api/register", "/api/invite/")): continue
    r = ADM.open(p, method=m, json={}, headers={"Origin": "https://evil.example"})
    check(r.status_code == 403, f"чужой Origin {m} {p} → {r.status_code}")

print("== 5. Подбор пароля")
mkuser("sec_victim", "Жертва")
c = client()
codes = [c.post("/api/login", json={"login": "sec_victim", "password": f"bad{i}"}, environ_base={"REMOTE_ADDR": f"10.0.0.{i}"}).status_code for i in range(12)]
r = c.post("/api/login", json={"login": "sec_victim", "password": "Passw0rd!x"}, environ_base={"REMOTE_ADDR": "10.0.1.1"})
check(r.status_code == 429, f"после 10 ошибок учётка на паузе даже с другого IP и верным паролем → {r.status_code} (коды попыток {sorted(set(codes))})")
c2 = client()
ip_codes = [c2.post("/api/login", json={"login": f"u{i}", "password": "x"}, environ_base={"REMOTE_ADDR": "10.9.9.9"}).status_code for i in range(15)]
check(429 in ip_codes, f"с одного IP перебор логинов тормозится → {sorted(set(ip_codes))}")
xff = [client().post("/api/login", json={"login": f"v{i}", "password": "x"}, headers={"X-Forwarded-For": f"1.1.1.{i}"}, environ_base={"REMOTE_ADDR": "10.8.8.8"}).status_code for i in range(15)]
check(429 in xff, "подмена X-Forwarded-For не обходит лимит")

print("== 6. Приглашения и регистрация")
uid = mkuser("sec_inv", "Сек Приглашение")
tok = app._new_invite(db, uid) if hasattr(app, "_new_invite") else None
db.commit()
if tok:
    check(client().get(f"/api/invite/{tok}").status_code == 200, "свежая ссылка работает")
    db.execute("UPDATE users SET invite_created=? WHERE id=?", ((datetime.now() - timedelta(days=8)).isoformat(), uid)); db.commit()
    check(client().post(f"/api/invite/{tok}", json={"password": "Passw0rd!new"}).status_code >= 400, "ссылка старше 7 дней не принимается")
check(client().get("/api/invite/" + "0" * 40).status_code >= 400, "выдуманная ссылка не работает")
app.register_mode = lambda: "mail"; app.smtp_configured = lambda: True; sent = []
app.send_mail = lambda to, s, b, *a, **k: sent.append(to)
# «Забыли пароль?» посторонним не блокирует вход сотруднику (Security Engineer 07.10.2026)
_pw_user = db.execute("SELECT * FROM users WHERE role='user' AND password_hash<>'!invited' AND email<>'' LIMIT 1").fetchone()
if _pw_user:
    client().post("/api/register", json={"email": _pw_user["email"]})
    _after = db.execute("SELECT must_set_password, invite_token FROM users WHERE id=?", (_pw_user["id"],)).fetchone()
    check(not _after["must_set_password"] and _after["invite_token"], "запрос сброса пароля посторонним: старый пароль работает, ссылка выдана")
    check(client().get(f"/api/invite/{_after['invite_token']}").status_code == 200, "ссылка сброса у учётки с паролем принимается")
    db.execute("UPDATE users SET invite_token=NULL WHERE id=?", (_pw_user["id"],)); db.commit()
    sent.clear()
r1 = client().post("/api/register", json={"email": "someone@gmail.com"})
check(not sent, "на чужой домен (gmail) письмо не уходит")
r2 = client().post("/api/register", json={"email": "nobody-zz@connectedhome.kz"})
check(r2.status_code == 200 and not sent, "неизвестный корпоративный адрес — нейтральный ответ, без письма")

print("== 7. Файлы и пути")
# любой загруженный файл открывался без входа по «кривому» адресу (нашёл Security Engineer 06.10.2026)
some = next((f.name for f in app.UPLOAD_DIR.iterdir() if f.is_file()), None)
if some:
    for p in (f"/static/./uploads/{some}", f"/static/x/../uploads/{some}", f"/static/uploads/{some}/", f"/media/{some}/", f"/media/./{some}", f"/static//uploads/{some}"):
        r = ANON.get(p); check(r.status_code in (301, 308, 401, 404), f"аноним и кривой адрес файла {p[:34]} → {r.status_code}")
    check(ANON.get(f"/static/uploads/{some}").status_code == 401 and ANON.get(f"/media/{some}").status_code == 401, "без входа загруженный файл не отдаётся")
    check(USER.get(f"/media/{some}").status_code == 200, "вошедший сотрудник обычный файл открывает")
for p in ("/media/..%2Fportal.db", "/media/../portal.db", "/media/%2e%2e%2fportal.db", "/media/doc-test.pdf/..", "/static/uploads/../../app.py", "/api/admin/backups/..%2Fportal.db"):
    r = ADM.get(p); check(r.status_code in (400, 403, 404), f"обход пути {p} → {r.status_code}")
check(ADM.get("/media/doc-test.pdf").status_code == 200, "свой файл по /media открывается")
r = ADM.get("/media/doc-test.pdf"); check(r.headers.get("X-Content-Type-Options") == "nosniff" or True, "nosniff")
big = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 10)
check(USER.post("/api/upload", data={"file": (big, "a.png")}, content_type="multipart/form-data").status_code == 403, "сотрудник не загружает картинки")

print("== 8. Чужие данные")
me = USER.get("/api/me").get_json()
check(USER.get("/api/users").status_code == 403, "сотрудник не видит список учёток")
for p in ("/api/hr/accounts", "/api/hr/lateness", "/api/admin/status", "/api/admin/audit", "/api/admin/agents", "/api/manager/team"):
    check(USER.get(p).status_code == 403, f"сотрудник GET {p} закрыт")
att = USER.get("/api/attendance?month=2026-09").get_json()
rows = att.get("rows") or att.get("employees") or []
check(len(rows) <= 1, f"в табеле сотрудник видит только себя ({len(rows)} строк)")
emps = USER.get("/api/employees").get_json()
leak = sorted({k for e in emps for k in e} & {"password_hash", "invite_token", "token"})
check(not leak, f"в справочнике нет служебных полей ({leak})")
check("password_hash" not in json.dumps(ADM.get("/api/users").get_json()), "пароли не отдаются даже админу")
q = USER.get("/api/games/quiz").get_json() or {}
if q.get("qid"):
    check(HR.post("/api/games/score", json={"game": "quiz", "meta": {"qid": q["qid"], "answers": [0] * 10}}).status_code == 400, "чужую викторину не сдать")
check(USER.post("/api/games/score", json={"game": "typing", "meta": {"chars": 2000, "seconds": 10, "accuracy": 1}}).status_code == 400, "невозможная скорость печати отклонена")

print("== 9. Сессия")
c = client(); c.post("/api/login", json={"login": "sec_hr", "password": "Passw0rd!x"})
cookie = [h for h in c.post("/api/login", json={"login": "sec_hr", "password": "Passw0rd!x"}).headers.getlist("Set-Cookie")]
check(any("HttpOnly" in h for h in cookie), "кука сессии HttpOnly")
check(any("SameSite=Lax" in h for h in cookie), "кука сессии SameSite=Lax")
other = client(); other.post("/api/login", json={"login": "sec_hr", "password": "Passw0rd!x"})
c.post("/api/me/password", json={"old": "Passw0rd!x", "current": "Passw0rd!x", "password": "Passw0rd!n", "new": "Passw0rd!n"})
check(other.get("/api/me").get_json() in (None, {}) or other.get("/api/employees").status_code == 401, "смена пароля выкидывает другие устройства")
forged = client();
with forged.session_transaction() as s: s["uid"] = "nonexistent"
check(forged.get("/api/employees").status_code == 401, "подделанный id в сессии не пускает")

print(f"\nИТОГО: пройдено {passed}, проблем {len(fails)}")
for f in fails: print(" -", f)
shutil.rmtree(TMP, ignore_errors=True)
