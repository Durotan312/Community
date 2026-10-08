# -*- coding: utf-8 -*-
"""Сообщение пользователю в Telegram через бота отчётов портала (тот же, что шлёт утренний отчёт).
Нужно для еженедельной проверки: итог пишет Claude, а отправляет сам портал — токен бота с сервера не уходит.

  python checks/tg_say.py файл.txt        — текст из файла (UTF-8)
  echo текст | python checks/tg_say.py    — текст со стандартного ввода
В тексте можно <b>жирный</b> и <i>курсив</i>; знаки < > & в обычном тексте пиши как &lt; &gt; &amp;."""
import subprocess, sys

REMOTE = ("sg docker -c \"docker exec -i community-chome python -c "
          "\\\"import sys, app; print('отправлено:', app.tg_send(sys.stdin.buffer.read().decode('utf-8')))\\\"\"")


def main():
    text = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.buffer.read().decode("utf-8")
    text = text.strip()
    if not text:
        print("пустой текст — отправлять нечего"); return 1
    if len(text) > 3900:
        text = text[:3900].rsplit("\n", 1)[0] + "\n… (обрезано)"
    r = subprocess.run(["ssh", "-o", "BatchMode=yes", "staff-new", REMOTE], input=text.encode("utf-8"), capture_output=True, timeout=120)
    out = (r.stdout + r.stderr).decode("utf-8", "replace")
    print("\n".join(x for x in out.splitlines() if "отправлено" in x or "Error" in x or "Traceback" in x) or out.strip()[-300:])
    return 0 if "отправлено: True" in out else 1


if __name__ == "__main__":
    sys.exit(main())
