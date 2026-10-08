# -*- coding: utf-8 -*-
"""ЛОКАЛЬНО, на копии базы, без настоящего Telegram: бот для HR (06.10.2026) — подключение токена админом,
подключение своего Telegram сотрудником HR, понедельничный отчёт об опозданиях в бот вместо письма (письмо — запасной путь),
напоминание о днях рождения в сам день, кто что может."""
import sqlite3, sys, os, shutil, uuid
from datetime import datetime, date, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # корень проекта: скрипт лежит в checks/
os.chdir(ROOT); sys.path.insert(0, ROOT)
assert not os.path.isdir("/app"), "только локально"
os.environ["PORTAL_NO_SCHEDULER"] = "1"
import app
from werkzeug.security import generate_password_hash

import _tmp; TMP = _tmp.fresh("portal-hrbot-")
shutil.copyfile(app.DB_PATH, TMP / "portal.db")
app.DB_PATH = TMP / "portal.db"
app.app.config["TESTING"] = True
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
sent, updates, mails, fails, passed = [], [], [], [], 0
broken = {"on": False}


def check(cond, what):
    global passed
    if cond: passed += 1
    else: fails.append(what); print("  !!", what)


def fake_call(token, method, params=None):
    if method == "getMe": return {"username": "cc_hr_bot"}
    if method == "getUpdates": return updates
    if method == "sendMessage":
        if broken["on"]: raise RuntimeError("Telegram ответил 403: bot was blocked by the user")
        sent.append((params["chat_id"], params["text"])); modes.append(params.get("parse_mode")); return {}
    raise RuntimeError(method)


modes = []
app._tg_call = fake_call
app.send_mail = lambda to, subj, body, html=None, *a, **k: mails.append((to, subj))
app.smtp_configured = lambda: True
db.execute("DELETE FROM settings WHERE key IN ('tg_hr','tg_bot','tg_staff','late_report_sent')"); db.commit()


def client(role, login, email=None):
    uid = uuid.uuid4().hex
    db.execute("INSERT INTO users (id, login, password_hash, name, role, email, created) VALUES (?,?,?,?,?,?,'2026-10-01')",
               (uid, login, generate_password_hash("Passw0rd!x"), "Тест " + login, role, email)); db.commit()
    c = app.app.test_client(); c.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
    ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
    with c.session_transaction() as s: s["uid"] = uid; s["pv"] = app._pw_stamp(ph)
    return c, uid


ADM, adm_id = client("admin", "hb_admin", "hb_admin@connectedhome.kz")
HR, hr_id = client("hr", "hb_hr", "hb_hr@connectedhome.kz")
EMP, emp_id = client("user", "hb_emp")
ACC, _ = client("accountant", "hb_acc")
TOKEN = "1234567890:" + "A" * 35

print("== 1. Кто подключает бота")
check(HR.get("/api/hr/telegram").get_json() == {"available": False}, "пока бота нет — у HR блок пустой")
for who, c in (("HR", HR), ("сотрудник", EMP), ("бухгалтер", ACC)):
    check(c.put("/api/admin/hrbot", json={"token": TOKEN}).status_code == 403 and c.get("/api/admin/hrbot").status_code == 403, f"{who} токен бота не ставит и состояние не видит")
check(ADM.put("/api/admin/hrbot", json={"token": "мусор"}).status_code == 400, "не-токен отклонён")
app._set_setting("tg_bot", '{"token": "%s"}' % TOKEN)
check(ADM.put("/api/admin/hrbot", json={"token": TOKEN}).status_code == 400, "токен бота отчётов для HR не годится — нужен отдельный бот")
app._set_setting("tg_bot", "")
j = ADM.put("/api/admin/hrbot", json={"token": TOKEN}).get_json()
check(j["connected"] and j["bot"] == "cc_hr_bot" and j["linked"] == [] and TOKEN not in str(j), "админ подключил бота; токен наружу не отдаётся")
with app.app.app_context():
    card = next(s for s in app._services_state(db) if s["key"] == "hrbot")
check(card["state"] == "warn" and TOKEN not in str(card), "карточка «Бот для HR» на вкладке «Сервисы»: подключён, но Telegram никто не привязал")

print("== 2. HR подключает свой Telegram")
for who, c in (("сотрудник", EMP), ("бухгалтер", ACC)):
    check(c.get("/api/hr/telegram").status_code == 403 and c.post("/api/hr/telegram").status_code == 403 and c.post("/api/hr/telegram/sample").status_code == 403,
          f"{who} к боту HR не подключается")
t = HR.get("/api/hr/telegram").get_json()
code = t["url"].split("start=")[-1]
check(t["available"] and not t["linked"] and t["url"].startswith("https://t.me/cc_hr_bot?start=") and len(code) >= 8, "HR получает личную ссылку на бота")
check(HR.post("/api/hr/telegram").status_code == 400, "без «Старт» в Telegram привязка не создаётся")
updates.append({"message": {"text": "/start чужой-код", "chat": {"id": 666, "type": "private", "first_name": "Чужой"}}})
check(HR.post("/api/hr/telegram").status_code == 400, "чужой человек, написавший боту без кода, привязку не получит")
updates.append({"message": {"text": "/start " + code, "chat": {"id": 111, "type": "group"}}})
check(HR.post("/api/hr/telegram").status_code == 400, "код из группового чата не принимается")
updates.append({"message": {"text": "/start " + code, "chat": {"id": 777, "type": "private", "first_name": "Даниля"}}})
r = HR.post("/api/hr/telegram").get_json()
check(r["linked"] and r["name"] == "Даниля" and sent and sent[-1][0] == 777 and sent[-1][1].startswith("Привет, hb_hr! Я твой личный HR-бот-помощник."), "HR нажала «Старт» — привязка создана, пришло приветствие по имени")
check(HR.post("/api/hr/telegram/sample").status_code == 200 and len(sent) >= 3 and all(c == 777 for c, _ in sent), "«Прислать пример» шлёт отчёт и пример дня рождения только ей")
check(ADM.post("/api/hr/telegram/sample").status_code == 400, "админ, не подключивший Telegram, пример не получает")

print("== 3. Отчёт об опозданиях: в бот вместо письма")
today = date.fromisoformat(app._astana_today())
start = today - timedelta(days=today.weekday() + 7)
n, m0 = len(sent), len(mails)
with app.app.app_context():
    ok1 = app.send_weekly_lateness_report()
    ok2 = app.send_weekly_lateness_report()
check(ok1 and len(sent) > n and len(mails) == m0, "отчёт ушёл в бот, письмо не отправлялось")
check(len(sent) - n == 2 and modes[-2] == "HTML" and modes[-1] is None and "<b>Опоздания" in sent[-2][1] and "ВРЕМЯ ПОД КОНТРОЛЕМ" in sent[-1][1],
      "два сообщения: отчёт с жирным (HTML), следом пост для канала без разметки")
with app.app.app_context():
    _e = db.execute("SELECT id, name FROM employees WHERE name<>'' LIMIT 1").fetchone()
    db.execute("UPDATE employees SET name=? WHERE id=?", ("Тест <Амп&Ко>", _e["id"])); db.commit()
    _h = app.hrbot_weekly_text(db, start, start + timedelta(days=4))
    db.execute("UPDATE employees SET name=? WHERE id=?", (_e["name"], _e["id"])); db.commit()
check("<Амп&Ко>" not in _h and ("&lt;Амп&amp;Ко&gt;" in _h or "Амп" not in _h), "имена в HTML-отчёте экранированы")
check(not ok2, "за ту же неделю отчёт второй раз не уходит")
check(any("Опоздания" in t or "опоздан" in t.lower() for _, t in sent[n:]) and all(len(t) <= app.TG_MAX_LEN for _, t in sent[n:]), "в боте текст отчёта, каждое сообщение короче предела Telegram")
long = app._tg_chunks("\n".join("строка %d " % i + "я" * 60 for i in range(400)))
check(len(long) > 1 and all(len(x) <= app.TG_MAX_LEN for x in long) and "\n".join(long).count("строка") == 400, "длинный отчёт делится на сообщения по целым строкам, ничего не теряя")
# бот сломался — отчёт не пропадает, уходит письмом
db.execute("DELETE FROM settings WHERE key='late_report_sent'"); db.commit()
import time; time.sleep(1.1)       # отметки сервиса — с точностью до секунды: сбой должен быть новее последней удачи
broken["on"] = True; m0 = len(mails)
with app.app.app_context():
    ok3 = app.send_weekly_lateness_report()
    card = next(s for s in app._services_state(db) if s["key"] == "hrbot")
check(ok3 and len(mails) > m0, "Telegram не принял сообщение — отчёт ушёл письмом")
check(card["state"] == "bad", "сбой бота виден на вкладке «Сервисы»")
broken["on"] = False
# бот не подключён вовсе — как раньше, письмо
db.execute("DELETE FROM settings WHERE key='late_report_sent'"); db.commit()
saved = app._setting("tg_hr"); app._set_setting("tg_hr", ""); m0 = len(mails)
with app.app.app_context():
    ok4 = app.send_weekly_lateness_report()
check(ok4 and len(mails) > m0, "бота нет — отчёт по-прежнему уходит письмом")
app._set_setting("tg_hr", saved)

print("== 4. Дни рождения — в сам день")
emps = [dict(r) for r in db.execute("SELECT id, name FROM employees WHERE name<>'' LIMIT 3")]
db.execute("UPDATE employees SET birthday=''")
day = today.isoformat()
db.execute("UPDATE employees SET birthday=? WHERE id=?", ("2000" + day[4:], emps[0]["id"]))
db.execute("UPDATE employees SET birthday=? WHERE id=?", ("1990" + day[4:], emps[1]["id"]))
db.execute("UPDATE employees SET birthday=? WHERE id=?", ("2000" + (today + timedelta(days=1)).isoformat()[4:], emps[2]["id"])); db.commit()
at = lambda h: datetime.combine(today, datetime.min.time()) + timedelta(hours=h)
with app.app.app_context():
    n = len(sent)
    early = app.hrbot_birthdays(db, at(8))
    check(not early and len(sent) == n, "до 09:00 напоминание не уходит")
    first = app.hrbot_birthdays(db, at(9))
    check(first and len(sent) == n + 1 and emps[0]["name"] in sent[-1][1] and emps[1]["name"] in sent[-1][1] and emps[2]["name"] not in sent[-1][1],
          "в 09:00 — одно сообщение со всеми сегодняшними именинниками, завтрашнего в нём нет")
    check("2000" not in sent[-1][1] and "1990" not in sent[-1][1], "год рождения в сообщении не называется")
    check(not app.hrbot_birthdays(db, at(10)) and len(sent) == n + 1, "второй раз за день не шлёт")
    # следующий день без именинников — тишина, но день отмечен
    db.execute("UPDATE employees SET birthday=''"); db.commit()
    tomorrow = at(9) + timedelta(days=1)
    check(not app.hrbot_birthdays(db, tomorrow) and len(sent) == n + 1 and app._hrbot().get("bday_day") == tomorrow.date().isoformat(), "нет именинников — сообщений нет")
    # Telegram упал — повтор в следующую минуту, а не потеря
    db.execute("UPDATE employees SET birthday=? WHERE id=?", ("2000" + (today + timedelta(days=2)).isoformat()[4:], emps[0]["id"])); db.commit()
    d2 = at(9) + timedelta(days=2)
    broken["on"] = True
    try:
        app.hrbot_birthdays(db, d2); raised = False
    except Exception:
        raised = True
    broken["on"] = False
    check(raised and app._hrbot().get("bday_day") != d2.date().isoformat(), "сообщение не ушло — день не отмечен как отправленный")
    check(app.hrbot_birthdays(db, d2 + timedelta(minutes=1)) and emps[0]["name"] in sent[-1][1], "следующая попытка доставляет")
    check(not app.hrbot_birthdays(db, at(21) + timedelta(days=3)), "на ночь глядя не шлёт")

print("== 4б. Праздники — за два дня (07.10.2026)")
with app.app.app_context():
    cfg = app._hrbot(); cfg.pop("hol_day", None); app._hrbot_save(cfg)
    hol_day = date(2026, 3, 19)                              # четверг перед Наурызом: выходные 21–25 марта
    hat = lambda h, d=hol_day: datetime.combine(d, datetime.min.time()) + timedelta(hours=h)
    n = len(sent)
    check(not app.hrbot_holidays(db, hat(8)) and len(sent) == n, "до 09:00 напоминание о празднике не уходит")
    check(app.hrbot_holidays(db, hat(9)) and len(sent) == n + 1 and "Наурыз" in sent[-1][1] and "21–25 марта" in sent[-1][1] and "26 марта" in sent[-1][1],
          "за два дня до Наурыза: праздник, выходные 21–25 марта, на работу 26 марта")
    check(not app.hrbot_holidays(db, hat(10)) and len(sent) == n + 1, "второй раз за день не шлёт")
    check(not app.hrbot_holidays(db, hat(9, date(2026, 10, 8))) and len(sent) == n + 1, "обычная пятница впереди — тишина")
    check(app.hrbot_holiday_text(date(2026, 10, 22)).count("24–26 октября") == 1, "День Республики: суббота, воскресенье и перенос — одним блоком")
    check(app.hrbot_holiday_text(date(2026, 10, 9)) == "", "обычные суббота и воскресенье — без напоминания")

print("== 4а. Находки проверяющих")
mixed = app._tg_chunks("a\nb\n" + "X" * 25 + "\nc", limit=10)
check(mixed == ["a\nb", "X" * 10, "X" * 10, "X" * 5, "c"] or "".join(mixed).replace("\n", "") == "ab" + "X" * 25 + "c" and mixed[0].startswith("a"), "куски длинного текста идут в исходном порядке")
with app.app.app_context():
    db.execute("UPDATE employees SET birthday='2000-02-29' WHERE id=?", (emps[1]["id"],)); db.commit()
    check(emps[1]["name"] in app.hrbot_birthday_text(db, "2027-02-28") and emps[1]["name"] not in app.hrbot_birthday_text(db, "2028-02-28") and emps[1]["name"] in app.hrbot_birthday_text(db, "2028-02-29"),
          "родившегося 29 февраля в обычный год поздравляют 28-го, в високосный — 29-го")
    # второй получатель недоступен: первому отчёт в бот, второму — письмом, сбой виден
    t2 = ADM.get("/api/hr/telegram").get_json(); code2 = t2["url"].split("start=")[-1]
    updates.append({"message": {"text": "/start " + code2, "chat": {"id": 888, "type": "private", "first_name": "Админ"}}})
    check(ADM.post("/api/hr/telegram").get_json()["linked"], "админ тоже подключился к боту HR")
    real_call = app._tg_call
    def flaky(token, method, params=None):
        if method == "sendMessage" and params["chat_id"] == 888: raise RuntimeError("Telegram ответил 403")
        return real_call(token, method, params)
    app._tg_call = flaky
    db.execute("DELETE FROM settings WHERE key='late_report_sent'"); db.commit()
    n, m0 = len(sent), len(mails)
    okp = app.send_weekly_lateness_report()
    # отчёт админу не дошёл, а пост дошёл бы — письмо всё равно должно уйти именно за отчёт
    def flaky2(token, method, params=None):
        if method == "sendMessage" and params["chat_id"] == 888 and "Опоздания" in params["text"]: raise RuntimeError("Telegram ответил 403")
        return real_call(token, method, params)
    app._tg_call = flaky2
    db.execute("DELETE FROM settings WHERE key='late_report_sent'"); db.commit()
    m1 = len(mails)
    app.send_weekly_lateness_report()
    check([m for m in mails[m1:] if m[0] == "hb_admin@connectedhome.kz"], "отчёт не дошёл, а пост дошёл — письмо с отчётом всё равно ушло")
    app._tg_call = flaky
    db.execute("DELETE FROM settings WHERE key='late_report_sent'"); db.commit()
    n, m0 = len(sent), len(mails)
    okp = app.send_weekly_lateness_report()
    card = next(s for s in app._services_state(db) if s["key"] == "hrbot")
    check(okp and any(c == 777 for c, _ in sent[n:]) and [m for m in mails[m0:] if m[0] == "hb_admin@connectedhome.kz"] and not [m for m in mails[m0:] if m[0] == "hb_hr@connectedhome.kz"],
          "одному не дошло в бот — ему отчёт ушёл письмом, второму письмо не дублируется")
    check(card["state"] == "bad", "частичный сбой виден на вкладке «Сервисы»")
    app._tg_call = real_call
    # бывший сотрудник HR больше ничего не получает
    db.execute("UPDATE users SET role='user' WHERE id=?", (hr_id,)); db.commit()
    n = len(sent)
    app.hrbot_send("проверка")
    check(not any(c == 777 for c, _ in sent[n:]) and hr_id not in app._hrbot()["links"], "HR понизили до сотрудника — бот ей больше не пишет, привязка стёрта")
    # учётки, которой уже нет, среди получателей быть не может (привязка «призрак» стирается при первой же отправке)
    cfg = app._hrbot(); cfg["links"] = {"нет-такой-учётки": {"chat_id": 999, "name": "Призрак"}}; app._hrbot_save(cfg)
    check(not app.hrbot_ready() and app.hrbot_send("ещё проверка") == 0 and not app._hrbot()["links"], "учётку удалили — получателей нет, отчёт пойдёт письмом")
check(HR.get("/api/hr/telegram").status_code == 403, "пониженной сотруднице и сам блок бота закрыт")
db.execute("UPDATE users SET role='hr' WHERE id=?", (hr_id,)); db.commit()
# одной ссылкой воспользовались двое
t3 = HR.get("/api/hr/telegram").get_json(); code3 = t3["url"].split("start=")[-1]
updates.append({"message": {"text": "/start " + code3, "chat": {"id": 778, "type": "private", "first_name": "Даниля"}}})
updates.append({"message": {"text": "/start " + code3, "chat": {"id": 667, "type": "private", "first_name": "Чужой"}}})
r = HR.post("/api/hr/telegram")
check(r.status_code == 409 and HR.get("/api/hr/telegram").get_json()["url"].split("start=")[-1] != code3 and hr_id not in app._hrbot()["links"],
      "ссылкой воспользовались из двух Telegram — привязки нет, ссылка заменена")
code4 = HR.get("/api/hr/telegram").get_json()["url"].split("start=")[-1]
updates.append({"message": {"text": "/start " + code4, "chat": {"id": 778, "type": "private", "first_name": "Даниля"}}})
check(HR.post("/api/hr/telegram").get_json()["linked"], "по новой ссылке HR подключилась")
app._hrbot_sample_at.clear()
check(HR.post("/api/hr/telegram/sample").status_code == 200 and HR.post("/api/hr/telegram/sample").status_code == 429, "пример — не чаще раза в минуту")

print("== 5. Отключение")
check(HR.delete("/api/hr/telegram").get_json()["linked"] is False, "HR отключила свой Telegram")
check(not app.hrbot_ready(), "без привязок бот «не готов» — отчёт пойдёт письмом")
# подключён только админ — отчёт всё равно письмом всем, пока HR не в боте (решение пользователя 07.10.2026)
codeA = ADM.get("/api/hr/telegram").get_json()["url"].split("start=")[-1]
updates.append({"message": {"text": "/start " + codeA, "chat": {"id": 889, "type": "private", "first_name": "Админ"}}})
check(ADM.post("/api/hr/telegram").get_json()["linked"] and not app.hrbot_ready(), "подключён только админ — бот «не готов», отчёт пойдёт письмом")
db.execute("DELETE FROM settings WHERE key='late_report_sent'"); db.commit()
n, m0 = len(sent), len(mails)
with app.app.app_context():
    okA = app.send_weekly_lateness_report()
    card = next(s for s in app._services_state(db) if s["key"] == "hrbot")
check(okA and len(mails) > m0 and len(sent) == n, "отчёт ушёл письмом всем (и HR, и админу), в бот не ушёл")
check("пока HR не подключит Telegram" in str(card), "на «Сервисах» видно, что отчёт идёт письмом, пока HR не подключит Telegram")
check(ADM.delete("/api/hr/telegram").get_json()["linked"] is False, "админ отключил свой Telegram")
check(ADM.delete("/api/admin/hrbot").get_json()["connected"] is False and not app._setting("tg_hr"), "админ отключил бота — настройки стёрты")
check(HR.get("/api/hr/telegram").get_json() == {"available": False}, "после отключения блок у HR снова пустой")

db.close()
shutil.rmtree(TMP, ignore_errors=True)
print(f"\nИТОГО: пройдено {passed}, проблем {len(fails)}")
sys.exit(1 if fails else 0)
