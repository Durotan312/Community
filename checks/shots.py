# -*- coding: utf-8 -*-
"""Снимки разделов портала для агента-дизайнера (06.10.2026, просьба пользователя: «агентов на проверку дизайна»).
Открывает раздел в браузере служебной учёткой claude_check, снимает его целиком на ноутбуке и на телефоне
и печатает пути к картинкам — агент смотрит на них глазами. Только смотрит, ничего не нажимает.

  python checks/shots.py home hr/requests tasks       — localhost:5000, ноутбук 1366 и телефон 375
  python checks/shots.py --site home                  — настоящий сайт
  python checks/shots.py --all                        — все разделы и вкладки (тот же набор, что обходит checks/pages.js)
  python checks/shots.py --out папка home             — куда сложить (по умолчанию временная папка, не репозиторий)
  python checks/shots.py --dark home                  — в тёмной теме (07.10.2026)

Раздел пишется как в адресе после #: home, hr/requests, admin/services."""
import os, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import browsers  # noqa: E402

SCREENS = [("ноутбук", 1366, 768, False), ("телефон", 375, 812, True)]
READY = "typeof render==='function' && !!state.user && state.employees.length>0"
LOADED = "!document.getElementById('main').innerText.includes('Загрузка…')"
# анимации на снимке — случайный кадр; выключаем, чтобы картинка была такой, как её видит человек через секунду
CALM = "*,*::before,*::after{animation:none!important;transition:none!important}"


# все разделы меню плюс вкладки панелей — тот же набор, что обходит checks/pages.js
ALL_VIEWS_JS = """() => {
  const v = [...new Set(['home', ...[...document.querySelectorAll('[data-view]')].map(e => e.dataset.view)])];
  const tabs = (name, list) => (list || []).map(t => name + '/' + (Array.isArray(t) ? t[0] : t));
  return [...v, ...tabs('admin', ['support', 'late', 'cabinets', 'users', 'status', 'services', 'agents', 'audit', 'backups']),
    ...tabs('hr', typeof HR_TABS !== 'undefined' ? HR_TABS : []), ...tabs('manager', typeof MGR_TABS !== 'undefined' ? MGR_TABS : []),
    'attendance/english', 'tasks/given', 'templates/tech'];
}"""


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    args = sys.argv[1:]
    site = "--site" in args
    out = args[args.index("--out") + 1] if "--out" in args else os.path.join(tempfile.gettempdir(), "portal-shots")
    views = [a for a in args if not a.startswith("--") and a != out]
    if not views and "--all" not in args:
        print(__doc__)
        return 1
    os.makedirs(out, exist_ok=True)
    base = browsers.SITE if site else browsers.LOCAL
    cookie = browsers.prod_cookie() if site else browsers.local_cookie()
    host = "community.connectedhome.kz" if site else "localhost"
    from playwright.sync_api import sync_playwright
    made, failed = [], []
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="msedge")
        for name, w, h, phone in SCREENS:
            ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=phone, is_mobile=phone, bypass_csp=True)
            ctx.add_cookies([{"name": "cc_session", "value": cookie, "domain": host, "path": "/", "secure": site}])
            page = ctx.new_page()
            page.goto(base + "/#home")
            page.wait_for_function(READY, timeout=30000)
            if "--all" in args:
                views = page.evaluate(ALL_VIEWS_JS)
            for v in views:
                try:
                    page.goto(base + "/#" + v)
                    if "--onb-done" in args:                  # WorkFlow: мастер первичной настройки уже пройден
                        page.evaluate("localStorage.setItem('cw_onboarding', 'done')")
                    if "--dark" in args:                      # тёмная тема — как её включает сам пользователь в настройках
                        page.evaluate("localStorage.setItem('cs_settings', JSON.stringify(Object.assign({}, JSON.parse(localStorage.getItem('cs_settings') || '{}'), {theme: 'dark'})))")
                    page.reload()
                    page.wait_for_function(READY, timeout=30000)
                    page.wait_for_function(LOADED, timeout=20000)
                    page.add_style_tag(content=CALM)
                    page.wait_for_timeout(700)
                    path = os.path.join(out, f"{v.replace('/', '_')}_{w}{'_dark' if '--dark' in args else ''}.png")
                    page.screenshot(path=path, full_page=True)
                    made.append((v, name, path))
                except Exception as e:  # noqa: BLE001 — один несостоявшийся снимок не должен отменять остальные
                    failed.append(f"{v} ({name}): {str(e).splitlines()[0][:120]}")
            ctx.close()
        b.close()
    print(f"СНИМКИ: {base}, папка {out}")
    for v, name, path in made:
        print(f"  {v} · {name}: {path}")
    for f in failed:
        print("  !! не снялось:", f)
    print(f"ИТОГО: снимков {len(made)}, не снялось {len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
