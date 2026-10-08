# -*- coding: utf-8 -*-
"""Портал в разных браузерах и на разных экранах (06.10.2026, просьба пользователя).
Три движка через Playwright: chromium (Chrome, Яндекс Браузер, Edge, Opera), firefox, webkit (Safari на iPhone и Mac).
В каждом — обход всех разделов и вкладок (checks/pages.js: ошибки в консоли, пустые страницы, «undefined», битые картинки,
обрезанное краем экрана), выпадающие меню вкладок, положение боковой панели, вход в чат Connect AI.
Только смотрит: входит служебной учёткой claude_check (помечается в журнале как проверка Claude), ничего не нажимает.

  python checks/browsers.py                    — сайт, все движки и экраны
  python checks/browsers.py --local            — http://localhost:5000 (нужен запущенный локальный портал)
  python checks/browsers.py --engine webkit    — один движок
  python checks/browsers.py --shots папка      — куда сложить снимки главной (по умолчанию не сохраняет)

Один раз на компьютере: python -m pip install playwright  и  python -m playwright install chromium firefox webkit
Код возврата 0 — проблем нет."""
import io, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://community.connectedhome.kz"
LOCAL = "http://localhost:5000"
# (название, ширина, высота, телефон?) — от большого монитора до маленького телефона; 1333×788 — ноутбук пользователя при 100%
SCREENS = [("монитор 1920", 1920, 1080, False), ("ноутбук 1536", 1536, 864, False), ("ноутбук 1366", 1366, 768, False),
           ("ноутбук 1333", 1333, 788, False), ("ноутбук 1280", 1280, 720, False), ("планшет лёжа 1024", 1024, 768, False),
           ("планшет стоя 768", 768, 1024, True), ("телефон 414", 414, 896, True), ("телефон 375", 375, 812, True),
           ("телефон 360", 360, 740, True)]
ENGINES = {"chromium": "Chrome / Яндекс / Edge", "firefox": "Firefox", "webkit": "Safari (iPhone, Mac)"}
IPHONE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
             "Version/18.0 Mobile/15E148 Safari/604.1")
# шум, который не является ошибкой портала: чужие расширения, отменённые запросы при уходе со страницы
NOISE = re.compile(r"favicon|net::ERR_ABORTED|NS_BINDING_ABORTED|Load failed|cancelled|ResizeObserver loop", re.I)


def prod_cookie():
    script = io.open(os.path.join(ROOT, "checks", "prod_session.py"), "rb").read()
    r = subprocess.run(["ssh", "-o", "BatchMode=yes", "staff-new", 'sg docker -c "docker exec -i -e PORTAL_NO_SCHEDULER=1 community-chome python - admin"'],
                       input=script, capture_output=True, timeout=120)
    m = re.search(rb"^COOKIE=(\S+)", r.stdout, re.M)
    if not m:
        raise SystemExit("не получил служебную куку с сервера: " + (r.stderr or r.stdout).decode("utf-8", "replace")[-300:])
    return m.group(1).decode()


def local_cookie():
    env = dict(os.environ, PYTHONPATH=ROOT, PYTHONIOENCODING="utf-8", PORTAL_NO_SCHEDULER="1")   # короткий импорт app не должен поднимать фоновые задачи
    code = ("import sys, uuid, sqlite3, app\nfrom werkzeug.security import generate_password_hash\n"
            "db = sqlite3.connect(app.DB_PATH); db.row_factory = sqlite3.Row\n"
            "row = db.execute(\"SELECT id FROM users WHERE login='claude_check'\").fetchone()\n"
            "uid = row['id'] if row else uuid.uuid4().hex\n"
            "if not row: db.execute(\"INSERT INTO users (id, login, password_hash, name, role, created) VALUES (?,?,?,?,?,date('now'))\", "
            "(uid, 'claude_check', generate_password_hash(uuid.uuid4().hex), 'Проверка Claude', 'admin'))\n"
            "else: db.execute(\"UPDATE users SET role='admin' WHERE id=?\", (uid,))\n"
            "db.commit(); ph = db.execute('SELECT password_hash FROM users WHERE id=?', (uid,)).fetchone()[0]\n"
            "print('COOKIE=' + app.app.session_interface.get_signing_serializer(app.app).dumps({'uid': uid, 'pv': app._pw_stamp(ph)}))\n")
    r = subprocess.run([sys.executable, "-c", code], cwd=ROOT, env=env, capture_output=True, timeout=120)
    m = re.search(rb"^COOKIE=(\S+)", r.stdout, re.M)
    if not m:
        raise SystemExit("не получил локальную куку: " + r.stderr.decode("utf-8", "replace")[-300:])
    return m.group(1).decode()


def check_engine(engine, base, cookie, shots):
    from playwright.sync_api import sync_playwright
    pages_js = io.open(os.path.join(ROOT, "checks", "pages.js"), encoding="utf-8").read()
    host = base.split("://", 1)[1].split(":")[0].split("/")[0]
    out = []
    with sync_playwright() as pw:
        # chromium: если движок Playwright не скачан, берём Edge, который уже стоит на Windows (тот же движок)
        try:
            browser = getattr(pw, engine).launch()
        except Exception:
            if engine != "chromium":
                raise
            browser = pw.chromium.launch(channel="msedge")
        for name, w, h, phone in SCREENS:
            res = {"engine": engine, "screen": name, "problems": [], "pages": 0}
            # bypass_csp: защита портала (CSP) запрещает выполнять код из строки, а проверочный сценарий именно так и попадает на страницу
            opts = {"viewport": {"width": w, "height": h}, "locale": "ru-RU", "bypass_csp": True}
            if phone and engine != "firefox":            # firefox не умеет притворяться телефоном — там просто узкое окно
                opts.update(has_touch=True, is_mobile=True)
                if engine == "webkit":
                    opts["user_agent"] = IPHONE_UA
            ctx = browser.new_context(**opts)
            ctx.add_cookies([{"name": "cc_session", "value": cookie, "domain": host, "path": "/", "secure": base.startswith("https")}])
            # Safari (webkit) не слушается bypass_csp для кода из строки — убираем заголовок защиты у самой страницы,
            # только в этой тестовой копии: на сайте защита остаётся как была
            def strip_csp(route):
                resp = route.fetch()
                route.fulfill(response=resp, headers={k: v for k, v in resp.headers.items() if k.lower() != "content-security-policy"})
            ctx.route(base + "/", strip_csp)
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append("ошибка в коде страницы: " + str(e)[:160]) if not NOISE.search(str(e)) else None)
            page.on("console", lambda m: errors.append("консоль: " + m.text[:160]) if m.type == "error" and not NOISE.search(m.text) else None)
            try:
                page.goto(base + "/#home", wait_until="domcontentloaded", timeout=45000)
                page.wait_for_function("typeof render === 'function' && typeof state !== 'undefined' && !!state.user && state.employees.length > 0",
                                       timeout=30000)
                page.wait_for_timeout(800)
                head = page.evaluate("""() => { const r = e => e.getBoundingClientRect(); const m = document.querySelector('.masthead');
                    const side = document.querySelector('.sidenav'); const tabs = [...document.querySelectorAll('.nav-tabs > .nav-item')];
                    const last = r(tabs[tabs.length - 1]), act = r(document.querySelector('.masthead-actions'));
                    return { rows: last.top > r(document.querySelector('.brand')).bottom - 5 ? 2 : 1,
                      tabsOverIcons: last.top < act.bottom && last.bottom > act.top && last.right > act.left + 1,
                      pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                      sideGap: getComputedStyle(side).position === 'fixed' ? Math.round(r(side).top - r(m).bottom) : 0,
                      mainText: document.getElementById('main').innerText.length }; }""")
                res["rows"] = head["rows"]
                if head["tabsOverIcons"]:
                    res["problems"].append("шапка: вкладки наехали на значки")
                if head["pageOver"] > 1:
                    res["problems"].append(f"главная шире экрана на {head['pageOver']}px")
                if abs(head["sideGap"]) > 2:
                    res["problems"].append(f"боковая панель не под шапкой (сдвиг {head['sideGap']}px)")
                if head["mainText"] < 100:
                    res["problems"].append("главная пустая")
                if shots:
                    page.screenshot(path=os.path.join(shots, f"{engine}_{w}x{h}.png"))
                page.evaluate("window.__pgDelay = 450")
                page.evaluate(pages_js)
                part = 0
                while True:
                    r = page.evaluate("p => pagesCheck(p)", part)
                    res["pages"] += r["checked"]
                    for where, bad in r["bad"].items():
                        bad.pop("errors", None)                  # ошибки консоли собираем сами, точнее
                        if bad:
                            res["problems"].append(f"{where}: " + "; ".join(f"{k} {v}" for k, v in bad.items()))
                    if r["done"]:
                        break
                    part += 1
                for m in page.evaluate("() => menusCheck()"):
                    res["problems"].append("меню: " + m)
                # чат Connect AI: поле ввода и кнопка видны и не уехали за экран
                page.wait_for_timeout(1500)                       # даём догрузиться последнему разделу, иначе он перерисует чат
                chat = page.evaluate("""async () => { state.view = 'aibot'; render(); await new Promise(r => setTimeout(r, 1200));
                    const i = document.getElementById('askInput'), b = document.getElementById('askBtn');
                    if (!i || !b) return 'нет поля ввода'; const r = b.getBoundingClientRect();
                    return r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1 && r.width > 0 ? '' : 'кнопка отправки за краем экрана'; }""")
                if chat:
                    res["problems"].append("чат Connect AI: " + chat)
            except Exception as e:  # noqa: BLE001
                res["problems"].append("не удалось пройти: " + str(e).splitlines()[0][:200])
            res["problems"] += sorted(set(errors))[:6]
            out.append(res)
            print(f"  {'ок ' if not res['problems'] else '!! '} {ENGINES[engine]:<22} {name:<18} разделов {res['pages']:>2}, шапка в {res.get('rows', '?')} стр."
                  + ("" if not res["problems"] else "\n" + "\n".join("        " + p for p in res["problems"])), flush=True)
            ctx.close()
        browser.close()
    return out


def main():
    try:
        sys.stdout.reconfigure(errors="replace")
    except (AttributeError, ValueError):
        pass
    args = sys.argv[1:]
    base = LOCAL if "--local" in args else SITE
    engines = [args[args.index("--engine") + 1]] if "--engine" in args else list(ENGINES)
    shots = args[args.index("--shots") + 1] if "--shots" in args else ""
    if shots:
        os.makedirs(shots, exist_ok=True)
    try:
        import playwright  # noqa: F401
    except ImportError:
        raise SystemExit("нет Playwright: python -m pip install playwright  и  python -m playwright install chromium firefox webkit")
    cookie = local_cookie() if base == LOCAL else prod_cookie()
    print(f"Портал в разных браузерах: {base}")
    results, t = [], time.time()
    for e in engines:
        results += check_engine(e, base, cookie, shots)
    bad = [r for r in results if r["problems"]]
    print(f"\nИТОГО: сочетаний браузер × экран {len(results)}, с проблемами {len(bad)} ({time.time() - t:.0f} с)")
    if shots:
        io.open(os.path.join(shots, "result.json"), "w", encoding="utf-8").write(json.dumps(results, ensure_ascii=False, indent=1))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
