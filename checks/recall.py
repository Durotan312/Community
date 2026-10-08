# -*- coding: utf-8 -*-
"""Памятка для Claude (06.10.2026): что делалось в последние дни и что не доделано.
Запускается сама в начале каждой сессии и после каждого сжатия разговора (хук SessionStart в .claude/settings.json) —
то, что написано здесь, Claude видит всегда, даже если переписка уже забыта.

  python checks/recall.py"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMMITS = 15          # сколько последних изменений показывать
TAILS_SHOWN = 30
KIND_RU = {"test": "тестовое", "text": "текст не утверждён", "decision": "ждёт решения", "data": "нет данных", "todo": "сделать"}


def git(*args):
    try:
        r = subprocess.run(("git", "-c", "core.quotepath=off") + args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
        return r.stdout.strip() if r.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    out = ["ПАМЯТКА ПО ПОРТАЛУ (собрана автоматически из git и tails.json, а не из переписки)", ""]

    log = git("log", f"-{COMMITS}", "--date=format:%d.%m %H:%M", "--pretty=format:%ad  %s")
    out.append(f"Последние изменения (новые сверху):")
    out += ["  " + x for x in log.splitlines()] or ["  git не ответил"]

    ahead = git("log", "@{upstream}..HEAD", "--pretty=format:%s")
    if ahead:
        out += ["", "НЕ ОТПРАВЛЕНО на GitHub (на сайте этого ещё нет):"] + ["  " + x for x in ahead.splitlines()]
    dirty = git("status", "--porcelain")
    if dirty:
        out += ["", "НЕ СОХРАНЕНО в git (правки лежат только в папке — работа была прервана на середине?):"]
        out += ["  " + x for x in dirty.splitlines()[:25]]

    touched = git("log", "--since=3 days ago", "--name-only", "--pretty=format:", "--", "docs", "CLAUDE.md")
    docs = sorted({x.strip() for x in touched.splitlines() if x.strip()})
    if docs:
        out += ["", "Описание, которое менялось за 3 дня (там подробности свежих работ): " + ", ".join(docs)]

    try:
        with open(os.path.join(ROOT, "tails.json"), encoding="utf-8") as f:
            tails = json.load(f)
        tails = tails if isinstance(tails, list) else []
        out += ["", f"Хвосты — не доделано или ждёт пользователя ({len(tails)}):"]
        for t in tails[:TAILS_SHOWN]:
            out.append(f"  [{KIND_RU.get(t.get('kind'), '?')}] {t.get('text', '')}")
    except (OSError, ValueError) as e:
        out += ["", f"tails.json не читается: {e}"]

    out += ["", "Правило: изменение не сделано, пока не записано — подробности в docs/<раздел>.md, недоделанное в tails.json,",
            "привычки пользователя в память. Шлагбаум не пустит на сайт код без записи в описании.",
            "Вкладка «Агенты» на портале: в начале задачи — python checks/agent_log.py start main \"что делаю\", в конце — done."]
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
