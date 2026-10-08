# -*- coding: utf-8 -*-
"""Ревизия памяти проекта (06.10.2026, выбор пользователя: проверяющий при каждой отправке + ревизия раз в неделю).
Ищет в описании то, чего в коде уже нет: функции, константы, файлы и адреса API, названные в CLAUDE.md и docs/,
старые хвосты и разлад в папке личной памяти Claude. Ничего не правит — только печатает список «проверь».

  python checks/memory_audit.py           — всё
  python checks/memory_audit.py --diff    — только имена из строк описания, изменённых в неотправленных коммитах

Код возврата всегда 0: находки — повод посмотреть глазами, а не запрет (часть имён живёт только на сервере)."""
import datetime, glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(os.path.dirname(ROOT), "claude-scripts")
MEMORY = os.path.join(os.path.expanduser("~"), ".claude", "projects", "C--Users-Tima-Desktop-staff", "memory")
TAIL_OLD_DAYS = 30
CODE_GLOBS = ["*.py", "*.sh", "*.bat", "*.yml", "*.yaml", "Dockerfile", "*.html", "requirements.txt", ".gitignore", ".dockerignore",
              "static/*.js", "static/*.css", "templates/*.html", "checks/*.py", "checks/*.js", "checks/*.sh", ".githooks/*", ".claude/*.json", ".claude/agents/*.md"]
# имена, которых в коде нет по понятной причине: живут на сервере, в базе или у внешних сервисов
KNOWN_ELSEWHERE = re.compile(r"^(staff[-_]|certbot|community[-_.]|chadmin|cloud-user|portal-weekly-check|claude_check|nobody_audit|"
                             r"backup\.sh$|enabledPlugins$|Desktop/|ELPASS_PASSWORD_|INSTALLATION_COMPLETE$|"
                             r"smtp\.|elpass\.env|smtp\.env|maintenance\.html|X-|getUpdates|sg docker|ssh |git |python |docker |sudo |systemctl |curl |scp )")


def read(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def code_corpus():
    parts, names = [], set()
    for g in CODE_GLOBS:
        for p in glob.glob(os.path.join(ROOT, g)):
            if os.path.isfile(p):
                parts.append(read(p))
    for base in (ROOT, SCRIPTS):
        for d, dirs, files in os.walk(base):
            dirs[:] = [x for x in dirs if x not in (".git", "__pycache__", "uploads", "node_modules", ".venv", "worktrees")]
            for f in files:
                names.add(f)
                names.add(os.path.relpath(os.path.join(d, f), base).replace("\\", "/"))
    if os.path.isdir(MEMORY):
        names.update(os.listdir(MEMORY))
    names.add("MEMORY.md")   # оглавление личной памяти есть на компьютере пользователя, но не в репозитории
    return "\n".join(parts), names


def doc_files():
    return [os.path.join(ROOT, "CLAUDE.md")] + sorted(glob.glob(os.path.join(ROOT, "docs", "*.md")))


def changed_doc_lines():
    """Строки описания, добавленные в неотправленных коммитах и в папке: {файл: текст}."""
    out = {}
    for args in (("diff", "-U0", "@{upstream}", "HEAD", "--", "CLAUDE.md", "docs"), ("diff", "-U0", "--", "CLAUDE.md", "docs")):
        try:
            r = subprocess.run(("git", "-c", "core.quotepath=off") + args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
        except OSError:
            continue
        cur = None
        for line in r.stdout.splitlines():
            if line.startswith("+++ b/"):
                cur = line[6:]
            elif line.startswith("+") and not line.startswith("+++") and cur:
                out[cur] = out.get(cur, "") + line[1:] + "\n"
    return out


IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
FILE_EXT = re.compile(r"\.(py|js|css|html|md|json|sh|bat|txt|yml|conf)$")


def classify(tok):
    """('file'|'route'|'name'|None, что искать)."""
    t = tok.strip()
    if not t or len(t) > 80 or KNOWN_ELSEWHERE.search(t) or any(c in t for c in "…*«»") or re.search(r"[А-Яа-яЁё]", t):
        return None, None
    m = re.match(r"^(?:GET|POST|PUT|DELETE|GET/POST|GET/PUT/DELETE|PUT/DELETE|GET/DELETE|GET/POST/DELETE)?\s*(/api/[\w/<>.-]+)", t)
    if m:
        return "route", m.group(1)
    if t.startswith(("/", "~", "http", "#", "--", ".", "$")) and not t.startswith((".claude/", ".githooks/")):
        return None, None
    t = t.split("(")[0].strip() if re.match(r"^[\w.]+\(", t) else t
    if FILE_EXT.search(t) and " " not in t:
        return "file", t
    if IDENT.match(t) and len(t) >= 5 and ("_" in t or re.search(r"[a-z][A-Z]", t) or (t.isupper() and len(t) >= 6)):
        return "name", t
    return None, None


def route_known(route, code):
    """Адрес из описания есть в app.py: <id> и <имя> в описании соответствуют любому параметру Flask."""
    base = re.sub(r"<[^>]*>.*$", "", route).rstrip("/.")
    base = re.sub(r"/(\.\.\.|…)$", "", base)
    return base in code


def audit_docs(code, names, only=None):
    found = []
    for path in doc_files():
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        text = only.get(rel, "") if only is not None else read(path)
        seen = set()
        for tok in re.findall(r"`([^`\n]+)`", text):
            kind, what = classify(tok)
            if not kind or (kind, what) in seen:
                continue
            seen.add((kind, what))
            if kind == "route" and not route_known(what, code):
                found.append(f"{rel}: адрес {what} — в app.py такого нет")
            elif kind == "file" and what not in names and os.path.basename(what) not in names and not os.path.exists(os.path.join(ROOT, what)):
                found.append(f"{rel}: файл {what} — не найден ни в проекте, ни в claude-scripts")
            elif kind == "name" and what not in code and what not in names:
                found.append(f"{rel}: имя {what} — в коде не встречается (переименовано или удалено?)")
    return found


def audit_tails():
    found = []
    try:
        tails = json.loads(read(os.path.join(ROOT, "tails.json")))
    except (OSError, ValueError) as e:
        return [f"tails.json не читается: {e}"]
    today = datetime.date.today()
    for t in tails if isinstance(tails, list) else []:
        try:
            age = (today - datetime.date.fromisoformat(str(t.get("since")))).days
        except ValueError:
            found.append(f"хвост без даты: {t.get('text', '')[:70]}")
            continue
        if age > TAIL_OLD_DAYS:
            found.append(f"хвост висит {age} дн.: {t.get('text', '')[:90]}")
    return found


def audit_memory():
    """Личная память Claude на компьютере пользователя: каждый файл есть в оглавлении и наоборот."""
    if not os.path.isdir(MEMORY):
        return ["папки личной памяти на этом компьютере нет — пропущено"]
    found, index = [], read(os.path.join(MEMORY, "MEMORY.md")) if os.path.exists(os.path.join(MEMORY, "MEMORY.md")) else ""
    files = sorted(f for f in os.listdir(MEMORY) if f.endswith(".md") and f != "MEMORY.md")
    for f in files:
        if f"({f})" not in index:
            found.append(f"память: {f} нет в оглавлении MEMORY.md — в начале сессии о нём не узнать")
        body = read(os.path.join(MEMORY, f))
        if not re.search(r"^description:\s*\S", body, re.M):
            found.append(f"память: у {f} нет строки description")
    for f in re.findall(r"\(([\w.-]+\.md)\)", index):
        if f not in files:
            found.append(f"память: оглавление ссылается на {f}, а файла нет")
    return found


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    code, names = code_corpus()
    if "--diff" in sys.argv:
        found = audit_docs(code, names, changed_doc_lines())
        print("РЕВИЗИЯ ПАМЯТИ (только новые строки описания)")
    else:
        found = audit_docs(code, names) + audit_tails() + audit_memory()
        print("РЕВИЗИЯ ПАМЯТИ ПРОЕКТА")
    for x in found:
        print("  ?", x)
    print(f"ИТОГО: проверь {len(found)}" if found else "ИТОГО: расхождений не найдено")
    return 0


if __name__ == "__main__":
    sys.exit(main())
