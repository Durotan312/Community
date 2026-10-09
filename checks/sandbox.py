# -*- coding: utf-8 -*-
"""Песочница для агента-тестировщика (06.10.2026, выбор пользователя: «тестировщик — проходит портал как живой сотрудник»).
Поднимает ВТОРОЙ портал на копии локальной базы во временной папке: в нём можно подавать заявки, согласовывать,
ставить задачи — рабочая база, localhost:5000 и настоящий сайт не затрагиваются. Фоновые задачи выключены,
Telegram-боты из копии убраны, почты локально нет — наружу из песочницы ничего не уходит (кроме вопросов Connect AI).

  python checks/sandbox.py start    — поднять http://localhost:5055 и завести тестовые учётки
  python checks/sandbox.py status   — работает ли
  python checks/sandbox.py stop     — остановить и удалить копию

Учётки (роль → кто это): admin — админ, hr — отдел кадров, buyer — закупщик, accountant — бухгалтер, cfo — финансовый директор (только смотрит),
emp — сотрудник опер-отдела Аманжолова Сандугаш, head — его директор Повстенко Никита (согласует заявки, ставит задачи).

В сценарии (Playwright):
    import sys; sys.path.insert(0, r"C:\\Users\\Tima\\Desktop\\staff\\checks"); import sandbox
    with sandbox.page_as("emp") as page:            # phone=True — экран телефона
        page.goto(sandbox.URL + "/#requests"); sandbox.ready(page)
        page.get_by_text("Техника и оборудование").click()
        ...
        sandbox.shot(page, "zayavka")                # снимок во временную папку, печатает путь
    print(page.errors)                               # ошибки консоли браузера за сценарий
"""
import contextlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5055
URL = f"http://localhost:{PORT}"
HOME = os.path.join(tempfile.gettempdir(), "portal-sandbox")
STATE = os.path.join(HOME, "state.json")
ROLES = [("admin", "sbx_admin", "Песочница Админ", "admin"), ("hr", "sbx_hr", "Песочница HR", "hr"),
         ("buyer", "sbx_buyer", "Песочница Закупщик", "buyer"), ("accountant", "sbx_acc", "Песочница Бухгалтер", "accountant"), ("cfo", "sbx_cfo", "Песочница Финдиректор", "cfo"),
         ("emp", "sbx_emp", "Аманжолова Сандугаш", "user"),
         ("head", "sbx_head", "Повстенко Никита", "user")]
QUIET_KEYS = ("tg_bot", "tg_staff")          # из копии убираем ботов: тестовые действия не должны писать людям в Telegram
with contextlib.suppress(AttributeError, ValueError):     # сценарии печатают по-русски — консоль Windows не должна падать
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
READY = "typeof render==='function' && !!state.user && state.employees.length>0"
LOADED = "!document.getElementById('main').innerText.includes('Загрузка…')"


def _alive():
    try:
        return urllib.request.urlopen(URL + "/", timeout=3).status == 200
    except Exception:  # noqa: BLE001
        return False


def _state():
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def serve():
    """Сам второй портал. Запускается командой start в отдельном процессе."""
    import sqlite3
    os.environ["PORTAL_NO_SCHEDULER"] = "1"
    for k in [k for k in os.environ if k.startswith(("SMTP_", "ELPASS_"))]:
        os.environ.pop(k)
    os.chdir(ROOT); sys.path.insert(0, ROOT)
    import app
    from pathlib import Path
    from werkzeug.security import generate_password_hash
    tmp = Path(HOME)
    app.DB_PATH = tmp / "portal.db"; app.UPLOAD_DIR = tmp / "uploads"; app.BACKUP_DIR = tmp / "backups"
    db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row
    for k in QUIET_KEYS:
        db.execute("DELETE FROM settings WHERE key=?", (k,))
    cookies = {}
    for role, login, name, kind in ROLES:
        row = db.execute("SELECT id FROM users WHERE login=?", (login,)).fetchone()
        uid = row["id"] if row else uuid.uuid4().hex
        if not row:
            db.execute("INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?,?,?,?,?,date('now'))",
                       (uid, login, generate_password_hash(uuid.uuid4().hex), name, kind))
        ph = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()[0]
        cookies[role] = app.app.session_interface.get_signing_serializer(app.app).dumps({"uid": uid, "pv": app._pw_stamp(ph)})
    db.commit(); db.close()
    with open(STATE, "w", encoding="utf-8") as f:
        json.dump({"pid": os.getpid(), "url": URL, "cookies": cookies}, f)
    app.app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)


def start():
    if _alive():
        print(f"песочница уже работает: {URL}")
        return 0
    src = os.path.join(ROOT, "portal.db")
    if not os.path.exists(src):
        print("нет локальной базы portal.db — песочницу поднять не из чего")
        return 1
    shutil.rmtree(HOME, ignore_errors=True)
    os.makedirs(os.path.join(HOME, "uploads")); os.makedirs(os.path.join(HOME, "backups"))
    import sqlite3
    a, b = sqlite3.connect(src), sqlite3.connect(os.path.join(HOME, "portal.db"))
    a.backup(b); a.close(); b.close()                       # копия средствами SQLite — цела, даже если портал сейчас пишет в базу
    up = os.path.join(ROOT, "static", "uploads")
    for f in os.listdir(up) if os.path.isdir(up) else []:   # картинки нужны, чтобы страницы выглядели как настоящие
        p = os.path.join(up, f)
        if os.path.isfile(p) and os.path.getsize(p) < 5_000_000:
            shutil.copy(p, os.path.join(HOME, "uploads", f))
    log = open(os.path.join(HOME, "server.log"), "w", encoding="utf-8")
    flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP) if os.name == "nt" else 0
    subprocess.Popen([sys.executable, os.path.abspath(__file__), "serve"], cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                     creationflags=flags, env=dict(os.environ, PYTHONIOENCODING="utf-8", PORTAL_NO_SCHEDULER="1"))
    for _ in range(40):
        if _alive() and _state().get("cookies"):
            print(f"песочница работает: {URL} (копия базы в {HOME})")
            print("роли: " + ", ".join(f"{r} — {n}" for r, _, n, _ in ROLES))
            return 0
        time.sleep(0.5)
    print("песочница не поднялась, журнал: " + os.path.join(HOME, "server.log"))
    return 1


def stop():
    pid = _state().get("pid")
    if pid:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], capture_output=True)
        else:
            with contextlib.suppress(OSError):
                os.kill(pid, 15)
    time.sleep(1)
    shutil.rmtree(HOME, ignore_errors=True)
    print("песочница остановлена" if not _alive() else "песочница всё ещё отвечает — проверь процесс на порту 5055")
    return 0


@contextlib.contextmanager
def page_as(role, phone=False):
    """Страница браузера, в которую уже вошёл нужный человек. page.errors — ошибки консоли за сценарий."""
    from playwright.sync_api import sync_playwright
    cookie = _state().get("cookies", {}).get(role)
    if not cookie or not _alive():
        raise SystemExit("песочница не запущена: python checks/sandbox.py start")
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="msedge")
        w, h = (375, 812) if phone else (1366, 768)
        ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=phone, is_mobile=phone, bypass_csp=True)
        ctx.add_cookies([{"name": "cc_session", "value": cookie, "domain": "localhost", "path": "/"}])
        page = ctx.new_page()
        page.set_default_timeout(15000)
        page.errors = []
        page.on("console", lambda m: page.errors.append(m.text[:200]) if m.type == "error" and "favicon" not in m.text and "status of 404" not in m.text else None)   # 404 — крупные файлы, которых нет в копии
        page.on("pageerror", lambda e: page.errors.append(str(e)[:200]))
        try:
            yield page
        finally:
            b.close()


def ready(page):
    """Дождаться, пока портал загрузился и раздел дорисовался."""
    page.wait_for_function(READY, timeout=30000)
    page.wait_for_function(LOADED, timeout=20000)
    page.wait_for_timeout(400)


def shot(page, name):
    os.makedirs(os.path.join(HOME, "shots"), exist_ok=True)
    path = os.path.join(HOME, "shots", name + ".png")
    page.screenshot(path=path, full_page=True)
    print("снимок:", path)
    return path


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "serve":
        serve()
    elif cmd == "start":
        sys.exit(start())
    elif cmd == "stop":
        sys.exit(stop())
    elif cmd == "status":
        print(f"работает: {URL}" if _alive() else "не запущена")
    else:
        print(__doc__)
