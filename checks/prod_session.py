# -*- coding: utf-8 -*-
# НА ПРОДЕ (в контейнере): кука сессии служебной учётки claude_check для просмотра портала в браузере.
# claude_check входит в CHECK_LOGINS — её действия в журнале помечаются как проверки Claude. Аргумент: роль (по умолчанию admin).
import sys, uuid, sqlite3
sys.path.insert(0, "/app")
import app
from werkzeug.security import generate_password_hash
role = sys.argv[1] if len(sys.argv) > 1 else "admin"
db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
row = db.execute("SELECT id FROM users WHERE login='claude_check'").fetchone()
if row is None:
    uid = uuid.uuid4().hex
    db.execute("INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?,?,?,?,?,date('now'))",
               (uid, "claude_check", generate_password_hash(uuid.uuid4().hex), "Проверка Claude", role))
else:
    uid = row["id"]
    db.execute("UPDATE users SET role=?, must_set_password=0 WHERE id=?", (role, uid))
db.commit()
ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
s = app.app.session_interface.get_signing_serializer(app.app)
print("COOKIE=" + s.dumps({"uid": uid, "pv": app._pw_stamp(ph)}))
