# -*- coding: utf-8 -*-
"""Отметка агента для вкладки «Агенты» в панели администратора портала (06.10.2026, просьба пользователя:
«название агента, за что он отвечает, что делает сейчас и что было сделано»).

  python checks/agent_log.py start designer "Смотрит разделы «Заявки» и «Посещаемость» на ноутбуке и телефоне"
  python checks/agent_log.py done designer "6 снимков: одна поломка в «Заявках», остальное аккуратно"
  python checks/agent_log.py fail weekly "Не дошла до конца: сервер не ответил"

Агенты: chief (Team Lead), analyst (Business Analyst), main (Developer), reviewer (Code Reviewer), designer (UI/UX Designer),
tester (QA Engineer), security (Security Engineer), weekly (Auditor — пятничная проверка).
Текст — по-русски, простыми словами, без названий файлов: его читает пользователь, не программист. До 600 знаков.

Пишет и на сайт (внутри контейнера, через ssh), и в локальную базу. Сайт недоступен — скрипт об этом скажет
и вернёт 0: отметка не должна останавливать работу. Ключ --local — только локальная база."""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS = ("main", "reviewer", "designer", "chief", "security", "analyst", "tester", "weekly")
CODE = ("import sys, json, sqlite3, app\n"
        "d = json.loads(sys.stdin.buffer.read().decode('utf-8'))\n"
        "app.init_db()\n"
        "db = sqlite3.connect(app.DB_PATH, timeout=10); db.row_factory = sqlite3.Row\n"
        "print('отмечено:', app.agent_mark(db, d['agent'], d['action'], d['text']))\n")
REMOTE = "sg docker -c \"docker exec -i -e PORTAL_NO_SCHEDULER=1 community-chome python -c \\\"exec(__import__('base64').b64decode('%s'))\\\"\""


def run(cmd, payload, **kw):
    try:
        r = subprocess.run(cmd, input=payload, capture_output=True, timeout=60, **kw)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)
    out = (r.stdout + r.stderr).decode("utf-8", "replace")
    return "отмечено:" in out, out.strip().splitlines()[-1][:200] if out.strip() else "нет ответа"


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2 or args[0] not in ("start", "done", "fail") or args[1] not in AGENTS:
        print(__doc__)
        return 1
    payload = json.dumps({"action": args[0], "agent": args[1], "text": " ".join(args[2:])}, ensure_ascii=False).encode("utf-8")
    env = dict(os.environ, PORTAL_NO_SCHEDULER="1", PYTHONIOENCODING="utf-8", PYTHONPATH=ROOT)
    if os.path.exists(os.path.join(ROOT, "portal.db")):
        ok, msg = run([sys.executable, "-c", CODE], payload, cwd=ROOT, env=env)
        print("локально:", "записано" if ok else "не записано — " + msg)
    if "--local" not in sys.argv:
        import base64
        ok, msg = run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "staff-new", REMOTE % base64.b64encode(CODE.encode()).decode()], payload)
        print("на сайте:", "записано" if ok else "не записано — " + msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
