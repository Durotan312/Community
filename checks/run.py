# -*- coding: utf-8 -*-
"""Шлагбаум перед выкладкой (05.10.2026): один запуск всех проверок портала.
Вызывается сам при `git push` (хук .githooks/pre-push); любой push в master через 5 минут оказывается на сайте,
поэтому сломанное не должно уйти дальше этого компьютера.

  python checks/run.py          — правила + тяжёлые проверки, если менялся код (не только .md и tails.json)
  python checks/run.py --all    — всё принудительно
  python checks/run.py --fast   — только правила (секунды)
  python checks/run.py --push   — так зовёт хук: то же, что без ключей, плюс запрет отправлять,
                                  пока в папке лежат незакоммиченные правки кода (проверяется папка, а уходит коммит)
Код возврата 0 — шлагбаум открыт."""
import os, re, sqlite3, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAVY = [("fullcheck.py", "все адреса API под каждой ролью"), ("seccheck.py", "права и защиты"),
         ("tg_test.py", "бот отчётов в Telegram"), ("staffbot_test.py", "бот для сотрудников"), ("hrbot_test.py", "бот для HR"),
         ("botreq_test.py", "Connect AI помогает с заявками")]
# правки только в этих файлах сайт сломать не могут; tails.json в образ идёт, но его читаемость проверяют правила
DOCS_ONLY = re.compile(r"(\.md$|^tails\.json$|^docs/|^\.claude/|^\.githooks/|\.bat$)")
# сам портал: правка здесь без строчки в описании забудется после сжатия разговора (06.10.2026)
PORTAL_CODE = re.compile(r"^(app\.py|manage\.py|static/[^/]+\.(js|css)|templates/)")
WRITTEN_DOWN = re.compile(r"^(docs/.+\.md|CLAUDE\.md|tails\.json)$")
NO_DOCS_MARK = "без описания:"   # в тексте коммита, с причиной — для опечаток и мелочей, о которых нечего писать
ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
ENV.pop("PYTHONIOENCODING", None)


def git(*args):
    """(получилось?, вывод). Не получилось — вызывающий обязан считать, что код менялся."""
    try:
        r = subprocess.run(("git", "-c", "core.quotepath=off") + args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return r.returncode == 0, r.stdout
    except OSError:
        return False, ""


def changed_files():
    """Что уйдёт на сайт этой отправкой: коммиты, которых ещё нет на GitHub, плюс незакоммиченное.
    Возвращает (файлы отправки, изменённые отслеживаемые файлы в папке) или None, если git не ответил."""
    ok1, diff = git("diff", "--name-only", "@{upstream}", "HEAD")
    ok2, status = git("status", "--porcelain")
    if not (ok1 and ok2):
        return None
    files, dirty = {x.strip() for x in diff.splitlines() if x.strip()}, set()
    for line in status.splitlines():
        if len(line) > 3:                       # «XY путь»; у переименования — «старый -> новый»
            path = line[3:].split(" -> ")[-1].strip().strip('"')
            files.add(path)
            if not line.startswith("??"):
                dirty.add(path)
    return files, dirty


def undocumented_push():
    """Код портала, который уходит этой отправкой без единой записи в описании. [] — всё в порядке или git не ответил."""
    ok1, diff = git("diff", "--name-only", "@{upstream}", "HEAD")
    ok2, msgs = git("log", "@{upstream}..HEAD", "--pretty=format:%B")
    if not (ok1 and ok2):
        return []
    files = [x.strip().replace("\\", "/") for x in diff.splitlines() if x.strip()]
    code = [f for f in files if PORTAL_CODE.search(f)]
    if not code or any(WRITTEN_DOWN.search(f) for f in files) or NO_DOCS_MARK in msgs.lower():
        return []
    return code


def is_code(path):
    return not DOCS_ONLY.search(path.replace("\\", "/"))


def local_db_ready():
    """Тяжёлые проверки работают на копии локальной базы; пустая или отсутствующая (новый компьютер) им не годится."""
    try:
        db = sqlite3.connect(os.path.join(ROOT, "portal.db"))
        n = db.execute("SELECT COUNT(*) FROM employees WHERE elpass_id<>''").fetchone()[0]
        db.close()
        return n >= 2
    except sqlite3.Error:
        return False


def run_script(name):
    t = time.time()
    r = subprocess.run([sys.executable, os.path.join(ROOT, "checks", name)], cwd=ROOT, env=dict(ENV, PYTHONIOENCODING="utf-8"),
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900)
    out = (r.stdout or "") + (r.stderr or "")
    m = re.search(r"ИТОГО: пройдено (\d+), проблем (\d+)", out)
    return r.returncode == 0 and m is not None and m.group(2) == "0", m, out, time.time() - t


def main():
    try:   # консоль Windows (cp866/cp1251) не знает части знаков — не падать с UnicodeEncodeError вместо причины
        sys.stdout.reconfigure(errors="replace")
    except (AttributeError, ValueError):
        pass
    mode = "all" if "--all" in sys.argv else "fast" if "--fast" in sys.argv else "auto"
    print("Шлагбаум перед выкладкой")
    failed, skipped = [], []

    r = subprocess.run([sys.executable, os.path.join(ROOT, "checks", "rules.py")], cwd=ROOT, env=dict(ENV, PYTHONIOENCODING="utf-8"),
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    print((r.stdout or "").rstrip() + ("\n" + r.stderr.rstrip() if r.stderr.strip() else ""))
    if r.returncode:
        failed.append("правила пользователя")

    heavy = mode == "all"
    if mode == "auto":
        ch = changed_files()
        if ch is None:
            heavy = True
            print("Не удалось спросить git, что изменилось, — на всякий случай запускаю все проверки.")
        else:
            files, dirty = ch
            heavy = any(is_code(f) for f in files)
            if not heavy:
                print("Код не менялся (только описание и хвосты) — тяжёлые проверки пропущены.")
            dirty_code = sorted(f for f in dirty if is_code(f))
            if "--push" in sys.argv and dirty_code:
                failed.append("незакоммиченные правки кода")
                print("  !! В папке есть несохранённые правки кода: " + ", ".join(dirty_code[:6]) + (" …" if len(dirty_code) > 6 else ""))
                print("     Проверяется то, что лежит в папке, а на сайт уходит то, что сохранено в git. Сохрани правки (2-SAVE.bat) и повтори.")

    if "--push" in sys.argv:
        lost = undocumented_push()
        if lost:
            failed.append("код без записи в описании")
            print("  !! Меняется портал (" + ", ".join(lost[:6]) + "), а в описании проекта об этом ни строчки.")
            print("     Допиши, что и зачем изменено, в docs/<раздел>.md (недоделанное — в tails.json) и сохрани вместе с кодом.")
            print(f"     Если писать нечего (опечатка) — добавь в текст коммита «{NO_DOCS_MARK} причина».")

    if heavy and not failed and not local_db_ready():
        heavy = False
        skipped.append("автотесты")
        print("  ?  На этом компьютере нет локальной базы с сотрудниками (portal.db) — автотесты запустить не на чем.")
        print("     Правила проверены, автотесты ПРОПУЩЕНЫ. Попроси Claude скачать копию базы с сервера, чтобы они заработали и здесь.")
    if heavy and not failed:
        for name, what in HEAVY:
            try:
                ok, m, out, sec = run_script(name)
            except subprocess.TimeoutExpired:
                ok, m, out, sec = False, None, "проверка не уложилась в 15 минут", 900
            print(f"  {'ок ' if ok else '!! '} {what}: " + (f"пройдено {m.group(1)}, проблем {m.group(2)}" if m else "не дошла до конца") + f" ({sec:.0f} с)")
            if not ok:
                failed.append(what)
                bad = [x for x in out.splitlines() if x.strip().startswith(("!!", "-")) or "Error" in x or "Traceback" in x]
                print("\n".join("       " + x.strip() for x in (bad or out.strip().splitlines())[-12:]))
                if "ModuleNotFoundError" in out:
                    print("       → на этом компьютере не хватает библиотек: python -m pip install -r requirements.txt pillow")
    elif mode != "fast" and failed and (mode == "all" or heavy):
        print("Автотесты не запускались: сначала почини то, что выше.")

    if failed:
        print("\nШЛАГБАУМ ЗАКРЫТ: " + "; ".join(failed) + ". На сайт это уходить не должно — почини и повтори.")
        return 1
    print("\nШЛАГБАУМ ОТКРЫТ" + (" (не проверено: " + ", ".join(skipped) + ")." if skipped else "."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
