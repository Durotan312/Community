# -*- coding: utf-8 -*-
"""Обновить открытую копию кода (08.10.2026): собрать её public_export.py и отправить в Durotan312/Community.
Запускать после выкладки: python checks/public_push.py"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(ROOT), "connected-community-public")
r = subprocess.run([sys.executable, os.path.join(ROOT, "checks", "public_export.py"), OUT], capture_output=True, text=True, encoding="utf-8", errors="replace")
print(r.stdout.strip())
if r.returncode:
    print("экспорт не прошёл — в открытую копию ничего не отправлено"); sys.exit(1)
msg = subprocess.run(["git", "log", "-1", "--pretty=%s"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip()
g = lambda *a: subprocess.run(["git", "-c", "core.safecrlf=false"] + list(a), cwd=OUT, capture_output=True, text=True, encoding="utf-8", errors="replace")
g("add", "-A")
if not g("diff", "--cached", "--quiet").returncode == 1:
    print("открытая копия уже актуальна"); sys.exit(0)
g("commit", "-q", "-m", "Из закрытого репозитория: " + (msg or "обновление кода"))
p = g("push", "-q", "origin", "master")
print("отправлено в Community" if p.returncode == 0 else "push не удался:\n" + p.stderr)
sys.exit(p.returncode)
