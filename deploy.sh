#!/usr/bin/env bash
set -euo pipefail
cd /opt/staff
DATA="${STAFF_DATA:-/opt/staff-data}"
for f in "$DATA/portal.db" "$DATA/api_key.txt"; do
  [ -f "$f" ] || { echo "ОСТАНОВЛЕНО: нет $f"; exit 1; }
done
cp -a "$DATA/portal.db" "$DATA/portal.db.before-deploy"
echo "база $(stat -c%s "$DATA/portal.db") байт, копия сделана"

echo "== код =="
git pull --ff-only
git log --oneline -1
git log -1 --format='%h %cI %s' > VERSION   # версия для админ-панели
docker compose up -d --build 2>&1 | tail -3
for _ in $(seq 1 40); do
  st=$(docker inspect -f "{{.State.Health.Status}}" community-chome 2>/dev/null || echo none)
  [ "$st" = healthy ] && break; sleep 2
done
echo "состояние: $st"
curl -s -o /dev/null -w "портал: %{http_code}\n" http://127.0.0.1:5050/
