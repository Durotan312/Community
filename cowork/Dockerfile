# Исполнитель Connected WorkFlow (этап 2, 08.10.2026): Python + git + Claude Code. Базы портала не видит.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates bash util-linux \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/* /root/.npm

# Два пользователя (Security Engineer 08.10.2026): runner.py идёт от root и держит секреты (CW_RUNNER_TOKEN, токен
# репозитория), а агент и команда проверки проекта запускаются от непривилегированного agent через setpriv с чистым
# окружением — /proc/1/environ и файлы root им не видны. Агенту достаётся только ключ модели: без него он не работает.
RUN useradd -u 1003 -m -d /home/agent -s /bin/bash agent
WORKDIR /runner
COPY cowork/runner.py cowork/askpass.sh /runner/
RUN chmod 755 /runner/askpass.sh && git config --system --add safe.directory '*'
ENV CW_WORK=/tmp/cw-work CW_AGENT_USER=agent

CMD ["python", "-u", "/runner/runner.py"]
