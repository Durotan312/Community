# -*- coding: utf-8 -*-
"""Служебные команды портала. Пароль передаётся через переменную окружения
PORTAL_PASSWORD, чтобы не светился в истории команд.

  python manage.py create-user admin --admin --name "Администратор"
  python manage.py set-password admin
  python manage.py list-users
  python manage.py invite danilya.azimova@connectedhome.kz --name "Азимова Даниля" --role hr --url https://community.connectedhome.kz
"""
import os
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

from werkzeug.security import generate_password_hash

DB_PATH = Path(__file__).resolve().parent / "portal.db"


def die(msg):
    print(msg)
    sys.exit(1)


def password_from_env():
    pw = os.environ.get("PORTAL_PASSWORD", "")
    if len(pw) < 8:
        die("Задайте пароль (не короче 8 символов) в переменной PORTAL_PASSWORD.")
    return pw


def main(argv):
    if not argv:
        die(__doc__)
    import app as portal  # создаёт таблицы, если их ещё нет
    cmd, args = argv[0], argv[1:]
    db = sqlite3.connect(DB_PATH)

    if cmd == "create-user":
        if not args:
            die("Укажите логин.")
        login = args[0].strip().lower()
        role = "admin" if "--admin" in args else "user"
        name = args[args.index("--name") + 1] if "--name" in args else ""
        if db.execute("SELECT 1 FROM users WHERE lower(login)=?", (login,)).fetchone():
            die(f"Логин «{login}» уже есть. Чтобы сменить пароль: set-password {login}")
        db.execute(
            "INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?, ?, ?, ?, ?, ?)",
            (uuid.uuid4().hex, login, generate_password_hash(password_from_env()), name, role,
             datetime.now().isoformat(timespec="seconds")),
        )
        db.commit()
        print(f"Создана учётная запись «{login}», роль: {role}")

    elif cmd == "set-password":
        if not args:
            die("Укажите логин.")
        login = args[0].strip().lower()
        n = db.execute("UPDATE users SET password_hash=? WHERE lower(login)=?",
                       (generate_password_hash(password_from_env()), login)).rowcount
        db.commit()
        print(f"Пароль для «{login}» обновлён" if n else f"Логин «{login}» не найден")

    elif cmd == "invite":
        import secrets
        if not args:
            die("Укажите почту или логин.")
        login = args[0].strip().lower()
        name = args[args.index("--name") + 1] if "--name" in args else ""
        role = args[args.index("--role") + 1] if "--role" in args else "user"
        url = args[args.index("--url") + 1] if "--url" in args else "http://localhost:5000"
        email = login if "@" in login else ""
        token = secrets.token_urlsafe(24)
        row = db.execute("SELECT id FROM users WHERE lower(login)=?", (login,)).fetchone()
        if row:
            db.execute("UPDATE users SET invite_token=?, must_set_password=1 WHERE id=?", (token, row[0]))
            print(f"Для «{login}» выпущена новая ссылка-приглашение")
        else:
            db.execute(
                "INSERT INTO users (id, login, password_hash, name, role, email, invite_token, must_set_password, created) "
                "VALUES (?, ?, '!invited', ?, ?, ?, ?, 1, ?)",
                (uuid.uuid4().hex, login, name, role, email, token, datetime.now().isoformat(timespec="seconds")),
            )
            print(f"Создана учётная запись «{login}», роль: {role}")
        db.commit()
        print(f"Ссылка-приглашение: {url}/?invite={token}")

    elif cmd == "list-users":
        rows = db.execute("SELECT login, role, name, last_login, must_set_password FROM users ORDER BY role, login").fetchall()
        if not rows:
            print("Учётных записей нет.")
        for login, role, name, last, pending in rows:
            state = "ждёт приглашения" if pending else f"последний вход: {last or '—'}"
            print(f"{login:<40} {role:<6} {name or '':<24} {state}")

    else:
        die(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
