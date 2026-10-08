# -*- coding: utf-8 -*-
"""Временная папка для проверок на копии базы (06.10.2026, нашёл Security Engineer: копии базы с личными данными
сотрудников скапливались во временной папке компьютера — 151 копия на 375 МБ; на Windows удаление в конце скрипта
не срабатывало, пока открыта база). Каждая проверка, начиная работу, убирает за прошлыми запусками."""
import shutil, tempfile, time
from pathlib import Path

PREFIXES = ("portal-check-", "portal-sec-", "portal-botreq-", "portal-sb-", "portal-tg-", "portal-sheet-", "portal-js-", "portal-hrbot-")
STALE_SECONDS = 30 * 60      # идущую рядом проверку не трогаем: самая долгая идёт меньше минуты


def cleanup():
    """Удалить папки прошлых запусков. Возвращает, сколько убрано."""
    n = 0
    for d in Path(tempfile.gettempdir()).iterdir():
        try:
            if d.is_dir() and d.name.startswith(PREFIXES) and time.time() - d.stat().st_mtime > STALE_SECONDS:
                shutil.rmtree(d, ignore_errors=True)
                n += not d.exists()
        except OSError:
            pass
    return n


def fresh(prefix):
    cleanup()
    return Path(tempfile.mkdtemp(prefix=prefix))


if __name__ == "__main__":
    print("убрано старых папок с копиями базы:", cleanup())
