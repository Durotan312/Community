# -*- coding: utf-8 -*-
"""Быстрая проверка для GitHub (открытый репозиторий Community, 08.10.2026): портал запускается на пустой базе,
главная отдаётся, вход требуется, статика на месте. Настоящей базы с сотрудниками на GitHub нет, поэтому полные
автотесты (fullcheck, seccheck, боты) идут только на компьютере пользователя — через checks/run.py."""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["PORTAL_NO_SCHEDULER"] = "1"
sys.path.insert(0, ROOT)
fresh = not os.path.exists(os.path.join(ROOT, "portal.db"))   # на GitHub базы нет — app создаст пустую, после проверки уберём
import app  # noqa: E402

bad = []
c = app.app.test_client()
r = c.get("/")
if r.status_code != 200 or b"<html" not in r.data.lower():
    bad.append(f"GET / → {r.status_code}")
r = c.get("/api/news")
if r.status_code != 401:
    bad.append(f"GET /api/news без входа → {r.status_code}, ждали 401")
for f in ("static/app.js", "static/style.css", "static/i18n.js", "templates/index.html"):
    if not os.path.exists(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), f)):
        bad.append(f"нет файла {f}")
if fresh:
    try:
        os.remove(os.path.join(ROOT, "portal.db"))
    except OSError:
        pass
print("smoke:", "ок" if not bad else "проблемы: " + "; ".join(bad))
sys.exit(1 if bad else 0)
