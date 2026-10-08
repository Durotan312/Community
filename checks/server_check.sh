#!/bin/bash
# Проверка прод-сервера (только чтение). Запуск: scp на сервер, bash server_check.sh
echo "=== контейнер"
sg docker -c "docker ps --format '{{.Names}} {{.Status}}'"
echo "=== ответ сайта"
curl -s -o /dev/null -w "изнутри: %{http_code}\n" http://127.0.0.1:5050/
curl -s -o /dev/null -w "снаружи: %{http_code}\n" https://community.connectedhome.kz/
echo "=== версия в контейнере"
sg docker -c "docker exec community-chome cat /app/VERSION" | head -c 120; echo
echo "=== ошибки в логе за 24 ч"
sg docker -c "docker logs --since 24h community-chome 2>&1" | grep -iE "error|traceback|exception" | grep -v "HTTP/1" | tail -15
echo "=== 5xx в nginx за 24 ч"
sudo awk '$9 ~ /^5/' /var/log/nginx/access.log 2>/dev/null | tail -10
echo "=== обновления безопасности ОС"
sudo dnf -q updateinfo list --security 2>/dev/null | awk '{print $3}' | sort -u | head -30
echo "=== перезагрузка нужна?"
sudo dnf -q needs-restarting -r 2>/dev/null; echo "код $?"
