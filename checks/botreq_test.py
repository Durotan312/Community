# -*- coding: utf-8 -*-
"""ЛОКАЛЬНО, на копии базы, без настоящего AI: Connect AI помогает с заявками (05.10.2026).
Проверяем серверную часть: когда чат присылает описание форм, бот получает правила про заявки и сегодняшнюю дату;
без форм — работает как раньше; описание форм не может раздуть запрос; сам бот заявок не создаёт."""
import sqlite3, sys, os, shutil, tempfile, uuid
from pathlib import Path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # корень проекта: скрипт лежит в checks/
os.chdir(ROOT); sys.path.insert(0, ROOT)
assert not os.path.isdir("/app"), "только локально"
import app
from werkzeug.security import generate_password_hash

import _tmp; TMP = _tmp.fresh("portal-botreq-")   # заодно убирает копии базы от прошлых запусков
shutil.copyfile(app.DB_PATH, TMP / "portal.db")
app.DB_PATH = TMP / "portal.db"
app.app.config["TESTING"] = True
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
fails, passed, calls = [], 0, []
def check(cond, what):
    global passed
    if cond: passed += 1
    else: fails.append(what); print("  !!", what)

DRAFT = '<<<ЗАЯВКА {"type":"equipment","data":{"item":"Монитор","reason":"для работы"}}>>>'
def fake_ai(model, api_key, system_text, contents, max_tokens=2048):
    calls.append({"system": system_text, "contents": contents})
    return True, "Заявка готова, проверьте её.\n" + DRAFT
app.call_gemini = fake_ai
app.get_api_key = lambda: "test-key"

uid = uuid.uuid4().hex
db.execute("INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?,?,?,?,?,'2026-10-05')",
           (uid, "botreq_user", generate_password_hash("Passw0rd!x"), "Проверка Бота", "user")); db.commit()
c = app.app.test_client(); c.environ_base["HTTP_X_PORTAL_CHECK"] = "1"
ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
with c.session_transaction() as s: s["uid"] = uid; s["pv"] = app._pw_stamp(ph)

FORMS = "ВИД equipment — «Техника и оборудование», уходит закупщику\n  item | Что именно нужно | текст | обязательно"
before = db.execute("SELECT COUNT(*) FROM requests").fetchone()[0]

r = c.post("/api/ask", json={"question": "Кто руководит операционным отделом?"})
check(r.status_code == 200 and "ПОМОЩЬ С ЗАЯВКАМИ" not in calls[-1]["system"], "без описания форм бот работает как раньше")

r = c.post("/api/ask", json={"question": "сделай заявку на монитор", "forms": FORMS})
sys_text = calls[-1]["system"]
check(r.status_code == 200 and "ПОМОЩЬ С ЗАЯВКАМИ" in sys_text and FORMS in sys_text, "с описанием форм бот получает правила про заявки")
check(app._astana_today() in sys_text and any(d in sys_text for d in app.WEEKDAYS_RU), "бот знает сегодняшнюю дату и день недели")
check("{today}" not in sys_text and "{weekday}" not in sys_text and '{"type":"код вида"' in sys_text, "шаблон правил подставлен без мусора")
check("НЕ отправляешь" in sys_text and "паспортные данные" in sys_text, "в правилах: не отправлять самому и не собирать паспортные данные")
check(app.REQUEST_DRAFT_MARK in r.get_json()["answer"], "черновик доходит до чата как есть")
check(db.execute("SELECT COUNT(*) FROM requests").fetchone()[0] == before, "сам бот заявок не создаёт — только сотрудник кнопкой")

c.post("/api/ask", json={"question": "заявка", "forms": "я" * 50000})
check(len(calls[-1]["system"]) - len(sys_text) < app.REQUEST_FORMS_MAX + 200, "описание форм обрезается — раздуть запрос нельзя")

hist = [{"role": "user" if i % 2 == 0 else "bot", "text": f"сообщение {i}"} for i in range(40)]
c.post("/api/ask", json={"question": "дальше", "history": hist, "forms": FORMS})
check(len(calls[-1]["contents"]) == app.MAX_HISTORY + 1, "обычный разговор — прежний предел истории, хотя формы присланы")
c.post("/api/ask", json={"question": "оформи заявку на монитор", "history": hist, "forms": FORMS})
check(len(calls[-1]["contents"]) == 31, "речь о заявке — бот помнит 30 последних сообщений")
long_draft = "Проверьте.\n" + app.REQUEST_DRAFT_MARK + ' {"type":"trip","data":{"notes":"' + "я" * 3000 + '"}}>>>'
c.post("/api/ask", json={"question": "поправь дату", "history": hist[:4] + [{"role": "bot", "text": long_draft}], "forms": FORMS})
check(any(len(x["parts"][0]["text"]) > 3000 for x in calls[-1]["contents"]) and len(calls[-1]["contents"]) == 6, "длинный черновик в истории не обрезается посередине")
check(not isinstance(c.post("/api/ask", json={"question": "заявка", "history": ["мусор", 5, None], "forms": FORMS}).get_json(), type(None)), "мусор в истории не роняет бота")

# заявка из чата уходит обычным адресом и проходит те же проверки, что из формы
r = c.post("/api/requests", json={"type": "equipment", "data": {"full_name": "Проверка Бота", "item": "Монитор", "reason": "для работы", "qty": "1"}})
check(r.status_code == 201 and r.get_json()["type"] == "equipment", "черновик бота отправляется обычным POST /api/requests")
check(c.post("/api/requests", json={"type": "equipment", "data": {"item": "Монитор"}}).status_code == 400, "неполная заявка отклоняется, как из формы")
check(c.post("/api/requests", json={"type": "hiring", "data": {"full_name": "x", "position": "y"}}).status_code == 403, "подбор — только руководителю, и через чат тоже")

print(f"\nИТОГО: пройдено {passed}, проблем {len(fails)}")
for f in fails: print(" -", f)
shutil.rmtree(TMP, ignore_errors=True)
