#!/usr/bin/env bash
# Автообновление портала: проверяет GitHub и выкладывает, только если код изменился.
# Если после обновления портал не поднялся — откат на предыдущую версию.
# Запускается таймером systemd каждые 5 минут. Лог: /opt/staff-backups/auto-update.log
set -uo pipefail
cd /opt/staff || exit 1
DATA="${STAFF_DATA:-/opt/staff-data}"
LOG=/opt/staff-backups/auto-update.log
say() { echo "$(date '+%F %T') $*" >> "$LOG"; }

# Не запускать две выкладки одновременно
exec 9>/tmp/staff-auto-update.lock
flock -n 9 || exit 0

git fetch -q origin master 2>/dev/null || { say "нет связи с GitHub"; exit 0; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
[ "$LOCAL" = "$REMOTE" ] && exit 0          # изменений нет — тихо выходим

say "новая версия: ${REMOTE:0:7} — обновляюсь"

# Данные должны быть на месте, иначе не трогаем ничего
for f in "$DATA/portal.db" "$DATA/api_key.txt"; do
  [ -f "$f" ] || { say "ОСТАНОВЛЕНО: нет $f"; exit 1; }
done
cp -a "$DATA/portal.db" "$DATA/portal.db.before-deploy"

git pull -q --ff-only || { say "ОШИБКА: git pull не прошёл (есть локальные правки?)"; exit 1; }
git log -1 --format='%h %cI %s' > VERSION   # версия для админ-панели
docker compose up -d --build >/dev/null 2>&1

st=none
for _ in $(seq 1 40); do
  st=$(docker inspect -f '{{.State.Health.Status}}' community-chome 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 2
done

if [ "$st" = healthy ]; then
  say "готово: $(git log --oneline -1)"
  # Каждая пересборка оставляет кэш сборки (сотни мегабайт). Держим не больше 300 МБ, старые образы убираем —
  # иначе при частых выкладках диск забьётся за пару месяцев.
  docker builder prune -f --keep-storage 300MB >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
else
  say "ПОРТАЛ НЕ ПОДНЯЛСЯ ($st) — откат на ${LOCAL:0:7}"
  git reset -q --hard "$LOCAL"
  git log -1 --format='%h %cI %s' > VERSION   # после отката
  docker compose up -d --build >/dev/null 2>&1
  for _ in $(seq 1 40); do
    st=$(docker inspect -f '{{.State.Health.Status}}' community-chome 2>/dev/null || echo none)
    [ "$st" = healthy ] && break
    sleep 2
  done
  say "после отката: $st"
fi
