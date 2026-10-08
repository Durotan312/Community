FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

# Портал работает не от root (аудит 23.09.2026). uid/gid совпадают с владельцем данных на сервере (chadmin 1001:1002),
# чтобы писать в смонтированные portal.db, uploads и backups. Сама папка /app — его, потому что SQLite кладёт журнал
# рядом с базой; код внутри остаётся root и приложению только для чтения.
RUN groupadd -g 1002 portal && useradd -u 1001 -g 1002 -M -d /app -s /usr/sbin/nologin portal && chown portal:portal /app
USER portal

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5050/ -o /dev/null || exit 1

CMD ["gunicorn", "--workers", "1", "--threads", "8", \
     "--bind", "0.0.0.0:5050", "--forwarded-allow-ips=*", \
     "--access-logfile", "-", "--error-logfile", "-", "app:app"]
