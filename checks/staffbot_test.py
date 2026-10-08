# -*- coding: utf-8 -*-
"""ЛОКАЛЬНО, на копии базы, без настоящего Telegram: бот для сотрудников — проба только для админа,
подключение своего Telegram по ссылке, три напоминания об опоздании без отметки, открытие для всех."""
import sqlite3, sys, os, json, shutil, tempfile, uuid
from datetime import datetime, timedelta
from pathlib import Path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # корень проекта: скрипт лежит в checks/
os.chdir(ROOT); sys.path.insert(0, ROOT)
assert not os.path.isdir("/app"), "только локально"
import app
from werkzeug.security import generate_password_hash

import _tmp; TMP = _tmp.fresh("portal-sb-")   # заодно убирает копии базы от прошлых запусков
shutil.copyfile(app.DB_PATH, TMP / "portal.db")
app.DB_PATH = TMP / "portal.db"
app.app.config["TESTING"] = True
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
sent, updates, fails, passed = [], [], [], 0
def check(cond, what):
    global passed
    if cond: passed += 1
    else: fails.append(what); print("  !!", what)
def fake_call(token, method, params=None):
    if method == "getMe": return {"username": "cc_staff_bot"}
    if method == "getUpdates": return updates
    if method == "sendMessage": sent.append((params["chat_id"], params["text"])); return {}
    raise RuntimeError(method)
app._tg_call = fake_call

# два настоящих сотрудника с карточкой турникета: один станет «админом», другой — обычным сотрудником
emps = [dict(r) for r in db.execute("SELECT id, name, email, elpass_id, schedule FROM employees WHERE elpass_id<>'' AND remote=0 LIMIT 2")]
def client(emp, role, login):
    uid = uuid.uuid4().hex
    db.execute("DELETE FROM users WHERE lower(name)=lower(?)", (emp["name"],))
    db.execute("INSERT INTO users (id, login, password_hash, name, role, email, created) VALUES (?,?,?,?,?,?,'2026-10-01')",
               (uid, login, generate_password_hash("Passw0rd!x"), emp["name"], role, None)); db.commit()
    c = app.app.test_client(); c.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
    ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
    with c.session_transaction() as s: s["uid"] = uid; s["pv"] = app._pw_stamp(ph)
    return c, uid
ADM, adm_id = client(emps[0], "admin", "sb_admin")
USR, usr_id = client(emps[1], "user", "sb_user")

check(USR.get("/api/admin/staffbot").status_code == 403, "сотрудник не видит настройки бота")
check(USR.get("/api/me/telegram").get_json() == {"available": False}, "бота нет — у сотрудника блока нет")
check(ADM.put("/api/admin/staffbot", json={"token": "x"}).status_code == 400, "кривой токен — 400")
r = ADM.put("/api/admin/staffbot", json={"token": "2222222222:" + "B" * 35}); j = r.get_json()
check(r.status_code == 200 and j["connected"] and not j["open"] and j["bot"] == "cc_staff_bot" and "B" * 10 not in json.dumps(j), "бот подключён, проба, токен не отдаётся")
check(USR.get("/api/me/telegram").get_json() == {"available": False}, "проба: сотруднику бот недоступен")
check(USR.post("/api/me/telegram").status_code == 403, "проба: сотрудник подключиться не может")
check(ADM.post("/api/admin/staffbot/sample").status_code == 400, "пример без подключённого Telegram — 400")
t = ADM.get("/api/me/telegram").get_json()
check(t["available"] and not t["linked"] and t["url"].startswith("https://t.me/cc_staff_bot?start="), "админу выдана личная ссылка")
code = t["url"].split("start=")[1]
check(ADM.post("/api/me/telegram").status_code == 404, "не нажал «Старт» — не подключается")
updates.append({"message": {"text": "/start " + code, "chat": {"id": 501, "type": "private", "first_name": "Tim"}}})
r = ADM.post("/api/me/telegram"); t = r.get_json()
check(r.status_code == 200 and t["linked"] and t["name"] == "Tim" and t["url"] == "" and sent[-1][0] == 501, "админ подключил свой Telegram")
check(ADM.post("/api/admin/staffbot/sample").status_code == 200 and "09:40" in sent[-1][1], "пример напоминания ушёл")
print("----- пример -----"); print(sent[-1][1]); print("------------------")

# сегодня оба «опоздали»: вход в 09:40 при графике с 09:00
today = datetime.fromisoformat(app._astana_today())
def passes(emp, hhmm):
    db.execute("DELETE FROM passes WHERE employee_id=? AND ts LIKE ?", (emp["id"], today.date().isoformat() + "%"))
    db.execute("DELETE FROM attendance WHERE employee_id=? AND date=?", (emp["id"], today.date().isoformat()))
    db.execute("UPDATE employees SET schedule='09:00-18:00' WHERE id=?", (emp["id"],))
    cols = [r[1] for r in db.execute("PRAGMA table_info(passes)")]
    row = {"id": uuid.uuid4().hex, "elpass_id": emp["elpass_id"].split(",")[0], "employee_id": emp["id"],
           "ts": f"{today.date().isoformat()}T{hhmm}:00", "direction": "in", "object": emp["elpass_id"].split(":")[0]}
    row = {k: v for k, v in row.items() if k in cols}
    db.execute(f"INSERT INTO passes ({','.join(row)}) VALUES ({','.join('?' * len(row))})", list(row.values())); db.commit()
passes(emps[0], "09:40"); passes(emps[1], "09:50")
workday = today
while workday.weekday() > 4: workday -= timedelta(days=1)
is_workday = workday == today
at = lambda h, m: today.replace(hour=h, minute=m)
with app.app.app_context():
    n0 = len(sent)
    check(app.tg_late_reminders(db, at(10, 30)) == 0 and len(sent) == n0, "10:30 — рано, молчим")
    if is_workday:
        check(app.tg_late_reminders(db, at(11, 3)) == 1 and sent[-1][0] == 501 and "09:40" in sent[-1][1] and "здравствуйте" in sent[-1][1], "11:00 — напоминание админу")
        check(app.tg_late_reminders(db, at(11, 4)) == 0, "в тот же слот второй раз не шлём")
        check(app.tg_late_reminders(db, at(12, 0)) == 0, "между слотами молчим")
        check(app.tg_late_reminders(db, at(14, 0)) == 1 and "напоминаем" in sent[-1][1], "14:00 — второе напоминание")
        db.execute("INSERT INTO attendance (id, employee_id, date, code, comment, set_by, updated) VALUES (?,?,?,?,?,?,?)",
                   (uuid.uuid4().hex, emps[0]["id"], today.date().isoformat(), "З", "", "test", "x")); db.commit()
        check(app.tg_late_reminders(db, at(17, 30)) == 0, "поставил отметку — 17:30 уже не пишем")
        check(len([s for s in sent if s[0] != 501]) == 0, "сотруднику без подключения ничего не ушло")
    else:
        check(app.tg_late_reminders(db, at(11, 3)) == 0, "выходной — молчим")

# открываем для всех
check(USR.put("/api/admin/staffbot", json={"open": True}).status_code == 403, "сотрудник не может открыть бота")
check(ADM.put("/api/admin/staffbot", json={"open": True}).get_json()["open"] is True, "админ открыл бота для всех")
t = USR.get("/api/me/telegram").get_json()
check(t["available"] and not t["linked"], "теперь сотруднику бот доступен")
ucode = t["url"].split("start=")[1]
check(ucode != code, "у каждого свой код")
updates.append({"message": {"text": "/start " + ucode, "chat": {"id": 502, "type": "private", "first_name": "Коллега"}}})
check(USR.post("/api/me/telegram").get_json()["linked"], "сотрудник подключился")
check(len(ADM.get("/api/admin/staffbot").get_json()["linked"]) == 2, "админ видит двоих подключённых")
if is_workday:
    cfg = app._staffbot(); cfg["late"] = {}; app._staffbot_save(cfg)          # новый «день»
    db.execute("DELETE FROM attendance WHERE employee_id=? AND date=?", (emps[0]["id"], today.date().isoformat())); db.commit()
    with app.app.app_context():
        n0 = len(sent)
        check(app.tg_late_reminders(db, at(17, 35)) == 2 and {s[0] for s in sent[n0:]} == {501, 502} and "последнее" in sent[-1][1], "17:30 — оба получили, каждый своё")
        check("09:50" in next(s[1] for s in sent[n0:] if s[0] == 502), "сотруднику — его время прихода")
check(ADM.put("/api/admin/staffbot", json={"open": False}).get_json()["open"] is False, "вернули режим пробы")
check(USR.get("/api/me/telegram").get_json() == {"available": False}, "проба: сотруднику снова недоступно")
if is_workday:
    cfg = app._staffbot(); cfg["late"] = {}; app._staffbot_save(cfg)
    with app.app.app_context():
        n0 = len(sent)
        check(app.tg_late_reminders(db, at(11, 0)) == 1 and sent[-1][0] == 501, "в пробе сотруднику не пишем, даже если он был подключён")
check(USR.delete("/api/me/telegram").status_code == 403, "проба: сотрудник — 403")
check(ADM.delete("/api/me/telegram").get_json()["linked"] is False, "админ отключил свой Telegram")
with app.app.app_context():
    sb = next(s for s in app._services_state(db) if s["key"] == "staffbot")
    check(sb["state"] == "ok" and ["Режим", "проба — только админ"] in sb["rows"], "карточка «Бот для сотрудников»")
check(ADM.delete("/api/admin/staffbot").get_json()["connected"] is False, "бот отключён")
print(f"\nИТОГО: пройдено {passed}, проблем {len(fails)}" + ("" if is_workday else " (сегодня выходной — часть проверок пропущена)"))
