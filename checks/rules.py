# -*- coding: utf-8 -*-
"""Правила пользователя, которые можно проверить машиной (05.10.2026).
Правило, записанное здесь, нельзя забыть: без него `git push` не пройдёт (см. checks/run.py).
Новое проверяемое правило — добавляй сюда же отдельной функцией rule_*.
Запуск: python checks/rules.py   → код возврата 0, если всё чисто."""
import io, json, os, py_compile, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda rel: io.open(os.path.join(ROOT, rel), encoding="utf-8").read()
UI_FILES = ["static/app.js", "static/i18n.js", "static/i18n-auto.js", "templates/index.html", "static/style.css", "maintenance.html"]
problems, warnings, passed = [], [], []


def where(text, pos):
    return f"строка {text.count(chr(10), 0, pos) + 1}"


def rule_no_emoji():
    """«Без эмодзи в интерфейсе» (21.09.2026). Стрелки, галочки и крестики — типографика, они разрешены.
    Значки ✅⚠️❌ живут только в app.py — в сообщениях Telegram."""
    # пиктограммы всех блоков (первая версия пропускала часть значков — нашёл проверяющий 05.10.2026)
    emo = re.compile("[\U0001F000-\U0001FAFF\u2300-\u23FF\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2B00-\u2BFF\u2139\u20E3\u3030\u303D\uFE0F]")
    # типографика, которая уже есть в интерфейсе: галочки, крестики, флажок, стрелки-треугольники меню
    allowed = set("\u2713\u2714\u2715\u2716\u2691\u25BE\u25B8\u25B4\u25C2\u25CF\u25CB\u25A0\u25A1\u25AA\u25AB\u25C6\u25C7\u25B3\u25BD\u25B2\u25BC")
    for f in UI_FILES:
        s = read(f)
        for m in emo.finditer(s):
            if m.group() not in allowed:
                problems.append(f"эмодзи «{m.group()}» (U+{ord(m.group()):04X}) в {f}, {where(s, m.start())} — в интерфейсе только значки из ICONS")


def rule_no_ai_vendor():
    """«Никогда не называй вендора AI» — бот зовётся Connect AI. «Gemini X30» — модель замка, не AI."""
    bad = re.compile(r"(?i)google\s*ai|openai|chatgpt|anthropic|generativelanguage|gemini(?!\s*X30)|\bgpt-?\d")
    for f in UI_FILES:
        s = read(f)
        # список ИИ-инструментов в заявке на компенсацию — сервисы, за которые платят сотрудники, а не поставщик Connect AI
        # (просьба пользователя 06.10.2026); длину текста сохраняем, чтобы номера строк в сообщениях не съехали
        s = re.sub(r"/\* AI_TOOLS_BEGIN \*/.*?/\* AI_TOOLS_END \*/", lambda m: re.sub(r"[^\n]", " ", m.group()), s, flags=re.S)
        for m in bad.finditer(s):
            problems.append(f"название поставщика AI «{m.group()}» в {f}, {where(s, m.start())} — пользователь видит только «Connect AI»")


def rule_no_example_hints():
    """«Без подсказок и примеров в интерфейсе» (22.09.2026): плейсхолдеры только функциональные."""
    bad = re.compile(r'placeholder="\s*(Например|например|Пример|Иван |ivan@|name@|example)[^"]*"')
    for f in ("static/app.js", "templates/index.html"):
        s = read(f)
        for m in bad.finditer(s):
            problems.append(f"плейсхолдер-пример {m.group()} в {f}, {where(s, m.start())}")


# формы, которые открывает любой сотрудник или которые живут только внутри закрытой панели — правило в UI_RULES им не нужно
FORMS_OPEN_TO_ALL = {
    "openRequestForm": "заявку подаёт любой сотрудник",
    "openTripForm": "командировка — тоже заявка",
    "openReferralForm": "предложить кандидата может любой",
    "openTaskForm": "кнопку показывает сам раздел «Задачи» только тем, у кого есть подчинённые",
    "openAnnouncementForm": "кнопка есть только в панели HR, а она закрыта целиком",
    "openUserForm": "кнопка есть только в панели администратора, а она закрыта целиком",
    "openProfileForm": "свой профиль «О себе» заполняет любой сотрудник, кнопка только в его личном кабинете (07.10.2026)",
}


def rule_forms_have_permissions():
    """«Добавил новую кнопку редактирования — добавь её обработчик в UI_RULES, иначе её увидят все»."""
    s = read("static/app.js")
    block = s[s.index("const UI_RULES = ["):s.index("function applyUiPermissions")]
    for form in sorted(set(re.findall(r"function (open\w+Form)\(", s))):
        if form + r"\(" not in block and form not in FORMS_OPEN_TO_ALL:
            problems.append(f"форма {form}() не описана в UI_RULES (app.js) — её кнопку увидят все роли. "
                            "Добавь правило или, если форма для всех, впиши её в FORMS_OPEN_TO_ALL в checks/rules.py с причиной")


def rule_services_have_cards():
    """«Новая интеграция или фоновая задача = _svc_mark в ней + карточка в _services_state»."""
    py = read("app.py")
    marks, cards = set(re.findall(r'_svc_mark\("(\w+)"', py)), set(re.findall(r'\badd\("(\w+)", "', py))
    for k in sorted(marks - cards):
        problems.append(f"сервис «{k}» оставляет отметки (_svc_mark), но карточки на вкладке «Сервисы» у него нет (_services_state)")


def rule_python_compiles():
    for f in ["app.py", "manage.py"] + [os.path.join("checks", x) for x in sorted(os.listdir(os.path.join(ROOT, "checks"))) if x.endswith(".py")]:
        try:
            py_compile.compile(os.path.join(ROOT, f), doraise=True, cfile=os.path.join(tempfile.gettempdir(), "portal-rules.pyc"))
        except py_compile.PyCompileError as e:
            problems.append(f"{f} не компилируется: {str(e.msg).strip().splitlines()[-1]}")


def _edge():
    for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe"):
        if os.path.exists(p):
            return p
    return shutil.which("msedge") or shutil.which("chrome") or shutil.which("chromium")


def rule_js_syntax():
    """Синтаксическая ошибка в app.js = пустая страница у всех (22.09.2026 прод лежал 20 минут), а проверка здоровья
    при выкладке её не ловит. Node на машинах пользователя нет — разбираем файл браузером в скрытом режиме."""
    files = ["static/app.js", "static/i18n.js", "static/i18n-auto.js"]
    node = shutil.which("node")
    if node:
        for f in files:
            r = subprocess.run([node, "--check", os.path.join(ROOT, f)], capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode:
                problems.append(f"{f}: синтаксическая ошибка — {(r.stderr or '').strip().splitlines()[-1] if r.stderr.strip() else '?'}")
        return
    exe = _edge()
    if not exe:
        warnings.append("синтаксис app.js не проверен: нет ни Node, ни Edge/Chrome — перезагрузи страницу на localhost и убедись, что она отрисовалась")
        return
    tmp = tempfile.mkdtemp(prefix="portal-js-")
    try:
        srcs = {f: read(f) for f in files}
        page = ("<!doctype html><meta charset='utf-8'><body><script>const S=" + json.dumps(srcs).replace("</", "<\\/") + ";const out={};"
                "for(const f in S){try{new Function(S[f]);out[f]='ok'}catch(e){out[f]=String(e.message)}}"
                "document.body.textContent='JSCHECK'+JSON.stringify(out)+'JSEND'</script>")
        html = os.path.join(tmp, "check.html")
        io.open(html, "w", encoding="utf-8").write(page)
        # чистое окружение: с переменными приложения Claude (CHROME_CRASHPAD_PIPE_NAME и т.п.) браузер молча ничего не печатает
        keep = {"SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "PATH", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA",
                "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "COMMONPROGRAMFILES", "USERNAME", "HOMEDRIVE", "HOMEPATH", "COMSPEC", "HOME"}
        env = {k: v for k, v in os.environ.items() if k.upper() in keep}
        r = subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={os.path.join(tmp, 'profile')}",
                            "--dump-dom", "file:///" + html.replace("\\", "/")], capture_output=True, timeout=90, env=env)
        m = re.search(r"JSCHECK(\{.*?\})JSEND", r.stdout.decode("utf-8", "replace"), re.S)
        if not m:
            warnings.append("синтаксис app.js не проверен: браузер не вернул ответ — перезагрузи страницу на localhost и убедись, что она отрисовалась")
            return
        import html as _html
        for f, res in json.loads(_html.unescape(m.group(1))).items():
            if res != "ok":
                problems.append(f"{f}: синтаксическая ошибка — {res}. С такой ошибкой у всех будет пустая страница")
    except subprocess.TimeoutExpired:
        warnings.append("синтаксис app.js не проверен: браузер не ответил за 90 секунд")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


CLAUDE_MD_LIMIT = 25000   # знаков; подробности раздела живут в docs/, а не в ядре


def rule_docs_in_order():
    """Описание проекта: ядро короткое, каждый файл docs/ есть в таблице CLAUDE.md."""
    if not os.path.isdir(os.path.join(ROOT, "docs")):        # открытая копия кода (Community): описания в ней нет намеренно
        return
    core = read("CLAUDE.md")
    if len(core) > CLAUDE_MD_LIMIT:
        problems.append(f"CLAUDE.md разросся до {len(core)} знаков (предел {CLAUDE_MD_LIMIT}) — подробности раздела перенеси в его файл в docs/")
    for f in sorted(os.listdir(os.path.join(ROOT, "docs"))):
        if f.endswith(".md") and f"docs/{f}" not in core:
            problems.append(f"docs/{f} нет в таблице «Сначала прочитай» в CLAUDE.md — про этот файл никто не узнает")
    for ref in sorted(set(re.findall(r"`(docs/[\w.-]+\.md)`", core))):
        if not os.path.exists(os.path.join(ROOT, ref)):
            problems.append(f"CLAUDE.md ссылается на {ref}, а такого файла нет")


TAIL_KINDS = {"test", "text", "decision", "data", "todo"}


def rule_tails_readable():
    if not os.path.exists(os.path.join(ROOT, "tails.json")):  # открытая копия кода — хвостов в ней нет
        return
    try:
        tails = json.loads(read("tails.json"))
    except (OSError, ValueError) as e:
        problems.append(f"tails.json не читается: {e}")
        return
    for i, t in enumerate(tails, 1):
        if not isinstance(t, dict) or not str(t.get("text") or "").strip() or t.get("kind") not in TAIL_KINDS:
            problems.append(f"tails.json, запись {i}: нужны text и kind из {sorted(TAIL_KINDS)}")


def rule_no_live_data_in_git():
    """«portal.db в репозитории быть НЕ должно»: обновление кода затёрло бы данные сотрудников (урок 16.09.2026)."""
    try:
        tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout.splitlines()
    except OSError:
        return
    for f in tracked:
        if re.search(r"(^|/)portal[^/]*\.db($|-)", f) or f.endswith((".env", "qa_cookie.txt")):
            problems.append(f"в git попал файл с живыми данными или секретами: {f}")


PASSPORT_FIELDS = ("doc_number", "doc_valid", "latin_name")


def rule_passport_fields_not_for_ai():
    """Паспортные данные в командировке бот не спрашивает и не получает (05.10.2026): в схемах форм такие поля
    помечены secret, и описание формы для Connect AI собирается без них (botForms в app.js)."""
    s = read("static/app.js")
    # поле формы — строка вида «{ k: 'код', l: 'подпись', … }»; порядок ключей и кавычки могут быть любыми
    sensitive = re.compile(r"паспорт|удостовер|номер документа|срок действия документа|латиниц|\bиин\b|снилс|дата рождения", re.I)
    seen = set()
    for n, line in enumerate(s.splitlines(), 1):
        mk = re.search(r"""\bk:\s*['"](\w+)['"]""", line)
        if not mk or not re.search(r"\bl:\s*['\"`]", line):
            continue
        key = mk.group(1)
        if key in PASSPORT_FIELDS:
            seen.add(key)
        if (key in PASSPORT_FIELDS or sensitive.search(line)) and not re.search(r"\bsecret:\s*true\b", line):
            problems.append(f"поле {key} в форме заявки (app.js, строка {n}) похоже на личный документ, но не помечено secret: true — оно ушло бы в AI")
    for k in PASSPORT_FIELDS:
        if k not in seen:
            problems.append(f"не нашёл поле {k} в формах заявок (app.js) — если его переименовали, обнови PASSPORT_FIELDS в checks/rules.py")
    # поле-файл (чек) в AI не уходит никогда: бот файлов не принимает, а в чеках финансовые данные (06.10.2026)
    for n, line in enumerate(s.splitlines(), 1):
        if re.search(r"""\bt:\s*['"]file['"]""", line) and re.search(r"""\bk:\s*['"]""", line) and not re.search(r"\bsecret:\s*true\b", line):
            problems.append(f"поле-файл в форме заявки (app.js, строка {n}) не помечено secret: true")
    forms_fn = s[s.index("function botForms()"):s.index("function botDraftCheck")]
    check_fn = s[s.index("function botDraftCheck"):s.index("function botParseAnswer")]
    if "!f.secret" not in forms_fn:
        problems.append("botForms() в app.js больше не отбрасывает поля с пометкой secret — паспортные данные ушли бы в AI")
    if not re.search(r"if \(f\.secret\)\s*\{[^}]*continue", check_fn):
        problems.append("botDraftCheck() в app.js больше не пропускает поля с пометкой secret — бот смог бы вписать паспортные данные в заявку")


def rule_no_empty_list_hints():
    """Пояснения под пустыми списками убраны (решение пользователя 07.10.2026): в блоке .empty — только заголовок."""
    s = read("static/app.js")
    for m in re.finditer(r'class="empty[^"]*"[^>]*><strong>[^<\n]*</strong>(?!</div>)', s):
        problems.append(f"пояснение под пустым списком в static/app.js, {where(s, m.start())} — в .empty только заголовок, без второй строки")


RULES = [rule_python_compiles, rule_passport_fields_not_for_ai, rule_js_syntax, rule_no_emoji, rule_no_ai_vendor, rule_no_example_hints,
         rule_no_empty_list_hints, rule_forms_have_permissions, rule_services_have_cards, rule_docs_in_order, rule_tails_readable, rule_no_live_data_in_git]


def main():
    try:   # консоль Windows (cp866/cp1251) не знает части знаков — не падать с UnicodeEncodeError вместо причины
        sys.stdout.reconfigure(errors="replace")
    except (AttributeError, ValueError):
        pass
    for rule in RULES:
        before = len(problems)
        try:
            rule()
        except Exception as e:  # noqa: BLE001 — сломанная проверка не должна молча пропускать
            problems.append(f"проверка {rule.__name__} упала: {e}")
        if len(problems) == before:
            passed.append(rule.__name__)
    for w in warnings:
        print("  ?", w)
    for p in problems:
        print("  !!", p)
    print(f"ПРАВИЛА: проверок {len(RULES)}, нарушений {len(problems)}" + (f", не проверено {len(warnings)}" if warnings else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
