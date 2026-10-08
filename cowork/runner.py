# -*- coding: utf-8 -*-
"""Исполнитель Connected WorkFlow (этап 2, 08.10.2026). Отдельный контейнер рядом с порталом, без доступа к его базе.

Цикл: раз в 20 секунд спрашивает портал (/api/cowork/runner/next) о задании. Получив задание:
  1. делает рабочую копию репозитория проекта (клон с токеном в адрес не пишем — токен уходит через GIT_ASKPASS);
  2. создаёт или продолжает ветку wf/<id> от основной ветки проекта;
  3. подкладывает правила проекта и описание в CLAUDE.md рабочей копии (в git не попадает: файл снимается с учёта);
  4. запускает Claude Code без человека (claude -p) с текстом задания, замечаниями и материалами;
  5. прогоняет команду проверки проекта, если задана; не прошла — одна попытка починить и повтор;
  6. ищет секреты в добавленных строках (ограничители портала); нашёл — задание не публикуется;
  7. коммит, push ветки, merge request через API GitHub/GitLab, отчёт порталу: ссылка, журнал, расход.
Нужные переменные (файл /opt/staff-data/cowork.env): PORTAL_URL, CW_RUNNER_TOKEN, ANTHROPIC_API_KEY.
Разделение прав (Security Engineer 08.10.2026): этот скрипт идёт от root и держит секреты; агент и команда проверки
проекта запускаются от пользователя CW_AGENT_USER (setpriv) с чистым окружением — им достаётся только ключ модели.
Всё, что уходит наружу (правка, ответ агента, сообщение коммита, текст merge request), проверяется ограничителями
портала и буквальными значениями наших секретов: нашлось — задание не публикуется.
Проверка без Claude и без Git: CW_MOCK=1 — вместо агента правка-заглушка, вместо push — отчёт с местной ссылкой."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

VERSION = "2026.10.08"
PORTAL = (os.environ.get("PORTAL_URL") or "http://community-chome:5050").rstrip("/")
TOKEN = (os.environ.get("CW_RUNNER_TOKEN") or "").strip()
MOCK = os.environ.get("CW_MOCK") == "1"
WORK = os.environ.get("CW_WORK") or os.path.join(tempfile.gettempdir(), "cw-work")
POLL = int(os.environ.get("CW_POLL") or 20)
MAX_LOG = 50000
AGENT_USER = os.environ.get("CW_AGENT_USER") or ""          # пусто (локальная проверка на Windows) — без смены пользователя
MODEL_KEY = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
ASKPASS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "askpass.sh")


def as_agent(cmd, env):
    """Команда от имени непривилегированного пользователя с чистым окружением (только то, что передали)."""
    if not AGENT_USER:
        return cmd, env
    return ["setpriv", "--reuid=" + AGENT_USER, "--regid=" + AGENT_USER, "--init-groups", "--reset-env", "env"] + \
           ["%s=%s" % (k, v) for k, v in env.items()] + cmd, None


def secrets_in(text, extra):
    """Буквальные значения наших секретов в тексте — это утечка независимо от формата."""
    return [name for name, val in extra if val and val in (text or "")]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def api(path, body=None, timeout=30):
    req = urllib.request.Request(PORTAL + path, data=json.dumps(body or {}).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "X-Runner-Token": TOKEN, "User-Agent": "connected-workflow-runner"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "null")


def run(cmd, cwd, env=None, timeout=600, input_text=None):
    """Запустить команду, вернуть (код, вывод). Вывод обрезаем, чтобы журнал не раздувался."""
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout, input=input_text)
        out = (p.stdout or "") + (("\n" + p.stderr) if p.stderr else "")
        return p.returncode, out[-20000:]
    except subprocess.TimeoutExpired:
        return 124, "превышено время ожидания (%s с)" % timeout
    except FileNotFoundError as e:
        return 127, "нет команды: %s" % e


class Job:
    def __init__(self, data):
        self.task, self.project = data["task"], data["project"]
        self.max_turns = int(data.get("max_turns") or 40)
        self.guardrails = [(n, re.compile(rx)) for n, rx in data.get("guardrails") or []]
        self.lines = []
        self.usage = {"tokens_in": 0, "tokens_out": 0, "cost": 0.0}
        self.dir = os.path.join(WORK, self.task["id"])
        self.base = self.project.get("branch") or "main"
        self.branch = self.task["branch"]
        self.model = self.project.get("model") or ""

    def say(self, text):
        self.lines.append(text)
        log(text)

    # --- git ---
    def git_env(self):
        env = dict(os.environ)
        # токен не кладём в адрес и не пишем на диск: git спрашивает его через GIT_ASKPASS у этого же скрипта
        env.update({"GIT_ASKPASS": ASKPASS, "CW_GIT_TOKEN": self.project["token"], "GIT_TERMINAL_PROMPT": "0",
                    "GIT_AUTHOR_NAME": "Connected WorkFlow", "GIT_AUTHOR_EMAIL": "workflow@connectedhome.kz",
                    "GIT_COMMITTER_NAME": "Connected WorkFlow", "GIT_COMMITTER_EMAIL": "workflow@connectedhome.kz"})
        return env

    def git(self, *args, timeout=300):
        return run(["git", *args], self.dir, self.git_env(), timeout)

    def clone(self):
        shutil.rmtree(self.dir, ignore_errors=True)
        os.makedirs(self.dir, exist_ok=True)
        if AGENT_USER:
            os.chmod(WORK, 0o711)
        repo = self.project["repo"]
        # core.symlinks=false: ссылка в чужом коде не выведет запись за пределы рабочей копии (Security Engineer 08.10.2026)
        code, out = run(["git", "-c", "core.symlinks=false", "clone", "--quiet", "--branch", self.base, repo, self.dir], WORK, self.git_env(), 600)
        if code:
            raise RuntimeError("не удалось скачать код: " + out.strip()[-600:])
        # ветка доработки: продолжаем, если она уже есть на сервере
        code, _ = self.git("fetch", "--quiet", "origin", self.branch)
        if code == 0:
            self.git("checkout", "--quiet", "-B", self.branch, "origin/" + self.branch)
            self.git("merge", "--quiet", "--no-edit", "origin/" + self.base)
            self.say("Продолжаю ветку %s, подтянул %s" % (self.branch, self.base))
        else:
            self.git("checkout", "--quiet", "-b", self.branch)
            self.say("Ветка %s от %s" % (self.branch, self.base))
        if AGENT_USER:                                     # рабочая копия — агенту, .git остаётся root: историю и настройки не трогает
            run(["chown", "-R", AGENT_USER + ":" + AGENT_USER, self.dir], WORK, timeout=120)
            run(["chown", "-R", "root:root", os.path.join(self.dir, ".git")], WORK, timeout=120)
            run(["chmod", "-R", "a+rX", os.path.join(self.dir, ".git")], WORK, timeout=120)
            run(["chmod", "-R", "g+w", os.path.join(self.dir, ".git", "index")], WORK, timeout=60)

    # --- контекст для агента ---
    def write_rules(self):
        pr, t = self.project, self.task
        parts = ["# %s" % pr["name"], pr.get("body") or ""]
        if pr.get("stack"):
            parts.append("Стек: " + pr["stack"])
        if pr.get("rules"):
            parts += ["", "## Правила проекта", pr["rules"]]
        if pr.get("materials"):
            parts += ["", "## Материалы"]
            for m in pr["materials"]:
                parts.append("- **%s**%s%s" % (m["title"], (": " + m["body"]) if m.get("body") else "", (" (%s)" % m["url"]) if m.get("url") else ""))
        parts += ["", "## Как работать", "Меняй только то, что просит задание. Не трогай секреты, ключи, пароли и файлы с данными. "
                  "Не переписывай историю git, не меняй настройки выкладки. Пиши комментарии и тексты интерфейса на языке проекта. "
                  "В конце коротко перечисли, что изменил и как это проверить."]
        path = os.path.join(self.dir, "CLAUDE.md")
        if os.path.islink(path):
            raise RuntimeError("CLAUDE.md в репозитории — символическая ссылка, так нельзя")
        existed = os.path.exists(path)
        if existed:                                        # свой CLAUDE.md у проекта остаётся, наш — дописывается сверху
            own = open(path, encoding="utf-8", errors="replace").read()
            parts += ["", "---", own]
        open(path, "w", encoding="utf-8").write("\n".join(parts))
        if existed:                                        # свой файл проекта: наши дописки git не видит
            self.git("update-index", "--assume-unchanged", "CLAUDE.md")
        else:                                              # нового файла в проекте нет — исключаем его из учёта
            with open(os.path.join(self.dir, ".git", "info", "exclude"), "a", encoding="utf-8") as f:
                f.write("\nCLAUDE.md\n")
        return existed

    def prompt(self):
        t, sp = self.task, self.task.get("spec") or {}
        lines = ["Задание: " + t["title"]]
        for k, name in (("section", "Раздел"), ("what", "Что сделать"), ("who", "Кто увидит"), ("check", "Как проверить")):
            if sp.get(k):
                lines.append("%s: %s" % (name, sp[k]))
        if t.get("rework"):
            lines += ["", "Это доработка (раз №%d). Замечание владельца: %s" % (t["rework"], t.get("result") or "")]
        if t.get("notes"):
            lines += ["", "Замечания к заданию:"] + ["- %s: %s" % (n["author_name"], n["text"]) for n in t["notes"]]
        return "\n".join(lines)

    # --- агент ---
    def agent(self, text):
        if MOCK:
            open(os.path.join(self.dir, "WORKFLOW.md"), "a", encoding="utf-8").write("- %s\n" % self.task["title"])
            self.usage["tokens_in"] += 1000; self.usage["tokens_out"] += 200; self.usage["cost"] += 0.01
            return "Заглушка: добавил строку в WORKFLOW.md"
        # агенту — только ключ модели и путь; секрет портала и токен репозитория ему не передаются
        env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"), "HOME": "/home/" + AGENT_USER if AGENT_USER else os.environ.get("HOME", ""),
               "ANTHROPIC_API_KEY": MODEL_KEY, "LANG": "C.UTF-8", "TERM": "dumb"}
        cmd = ["claude", "-p", text, "--output-format", "json", "--permission-mode", "acceptEdits", "--max-turns", str(self.max_turns),
               "--disallowedTools", "WebFetch,WebSearch"]   # в сеть агенту незачем
        if self.model:
            cmd += ["--model", self.model]
        hidden = self.hide_hooks()
        try:
            cmd, env = as_agent(cmd, env)
            code, out = run(cmd, self.dir, env, timeout=3600)
        finally:
            self.restore_hooks(hidden)
        if code:
            raise RuntimeError("агент завершился с ошибкой: " + out.strip()[-800:])
        try:
            j = json.loads(out[out.index("{"):out.rindex("}") + 1])
        except (ValueError, json.JSONDecodeError):
            return out.strip()[-2000:]
        u = j.get("usage") or {}
        self.usage["tokens_in"] += int(u.get("input_tokens") or 0) + int(u.get("cache_read_input_tokens") or 0)
        self.usage["tokens_out"] += int(u.get("output_tokens") or 0)
        self.usage["cost"] += float(j.get("total_cost_usd") or 0)
        return str(j.get("result") or "").strip()[-4000:]

    def hide_hooks(self):
        """Хуки Claude Code из клонированного проекта (.claude/settings*.json) не запускаем: это чужой код."""
        d = os.path.join(self.dir, ".claude")
        if os.path.islink(d):
            raise RuntimeError(".claude в репозитории — символическая ссылка, так нельзя")
        if not os.path.isdir(d):
            return None
        aside = os.path.join(WORK, self.task["id"] + ".claude-aside")
        shutil.rmtree(aside, ignore_errors=True)
        shutil.move(d, aside)
        return aside

    def restore_hooks(self, aside):
        if aside and os.path.isdir(aside):
            d = os.path.join(self.dir, ".claude")
            shutil.rmtree(d, ignore_errors=True)
            shutil.move(aside, d)

    # --- проверки и ограничители ---
    def checks(self):
        cmd = (self.project.get("checks") or "").strip()
        if not cmd:
            return True, ""
        env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"), "HOME": "/home/" + AGENT_USER if AGENT_USER else os.environ.get("HOME", ""),
               "LANG": "C.UTF-8"}                           # команде проекта — ни секретов, ни ключа модели
        cmd2, env2 = as_agent(["bash", "-lc", cmd], env)
        code, out = run(cmd2, self.dir, env2, timeout=1200)
        return code == 0, out[-3000:]

    def leak(self, *texts):
        """Ограничители портала и буквальные секреты — по любому тексту, который уйдёт наружу."""
        hits = set()
        own = [("секрет исполнителя", TOKEN), ("токен репозитория", self.project.get("token") or ""), ("ключ модели", MODEL_KEY)]
        for t in texts:
            hits.update(secrets_in(t, own))
            for name, rx in self.guardrails:
                if rx.search(t or ""):
                    hits.add(name)
        return sorted(hits)

    def guard(self):
        """Секреты в добавленных строках — правка не публикуется (ограничители портала, как политики у образца)."""
        self.git("add", "-A")
        code, diff = self.git("diff", "--cached", "--unified=0", "--", ".", ":(exclude)CLAUDE.md")
        added = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
        return self.leak(added)

    def changed(self):
        code, out = self.git("status", "--porcelain", "--", ".", ":(exclude)CLAUDE.md")
        return bool(out.strip())

    # --- публикация ---
    def publish(self, summary):
        self.git("add", "-A", "--", ".", ":(exclude)CLAUDE.md")
        msg = "WorkFlow: %s\n\n%s\n\nЗадание %s" % (self.task["title"], summary[:1500], self.task["id"])
        code, out = self.git("commit", "--quiet", "-m", msg)
        if code and "nothing to commit" not in out:
            raise RuntimeError("коммит не удался: " + out.strip()[-400:])
        if MOCK:
            return {"pr_url": self.project["repo"].rstrip("/") + "/-/merge_requests/0", "mr_id": ""}
        code, out = self.git("push", "--quiet", "-u", "origin", self.branch)
        if code:
            raise RuntimeError("push не прошёл: " + out.strip()[-600:])
        return self.open_mr(summary)

    def open_mr(self, summary):
        repo, token = self.project["repo"], self.project["token"]
        u = urllib.parse.urlparse(repo)
        parts = [x for x in u.path.strip("/").removesuffix(".git").split("/") if x]
        title = "WorkFlow: " + self.task["title"][:80]
        body = "%s\n\nЗадание Connected WorkFlow %s — принять или отклонить можно на портале." % (summary[:3000], self.task["id"])
        if u.netloc == "github.com":
            url = "https://api.github.com/repos/%s/%s/pulls" % (parts[0], parts[1])
            headers = {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"}
            data = {"title": title, "head": self.branch, "base": self.base, "body": body}
            find = "https://api.github.com/repos/%s/%s/pulls?head=%s:%s&state=open" % (parts[0], parts[1], parts[0], urllib.parse.quote(self.branch))
        else:
            proj = urllib.parse.quote("/".join(parts), safe="")
            url = "%s://%s/api/v4/projects/%s/merge_requests" % (u.scheme, u.netloc, proj)
            headers = {"PRIVATE-TOKEN": token}
            data = {"title": title, "source_branch": self.branch, "target_branch": self.base, "description": body, "remove_source_branch": True}
            find = "%s?source_branch=%s&state=opened" % (url, urllib.parse.quote(self.branch))
        headers.update({"Content-Type": "application/json", "User-Agent": "connected-workflow-runner"})
        # merge request уже есть (доработка) — берём его
        try:
            with urllib.request.urlopen(urllib.request.Request(find, headers=headers), timeout=20) as r:
                existing = json.loads(r.read().decode() or "[]")
            if existing:
                e = existing[0]
                return {"pr_url": e.get("html_url") or e.get("web_url"), "mr_id": str(e.get("number") or e.get("iid") or "")}
        except (urllib.error.URLError, ValueError):
            pass
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(data).encode(), method="POST", headers=headers), timeout=30) as r:
                j = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            raise RuntimeError("merge request не создан (%s): %s" % (e.code, e.read().decode()[:300]))
        return {"pr_url": j.get("html_url") or j.get("web_url"), "mr_id": str(j.get("number") or j.get("iid"))}

    # --- весь ход ---
    def execute(self):
        self.say("Задание «%s» по проекту %s" % (self.task["title"], self.project["name"]))
        self.clone()
        self.write_rules()
        self.say("Агент работает (модель: %s)…" % (self.model or "по умолчанию"))
        summary = self.agent(self.prompt())
        self.lines.append("Агент: " + summary[:1500]); log("Агент ответил, %d знаков" % len(summary))
        if not self.changed():
            raise RuntimeError("агент ничего не изменил. Его ответ: " + summary[:600])
        ok, out = self.checks()
        if not ok:
            self.say("Проверки не прошли, одна попытка починить:\n" + out[-1500:])
            summary2 = self.agent("Проверки проекта не прошли. Вывод:\n%s\n\nПочини причину, не отключая проверки." % out[-6000:])
            self.lines.append("Агент: " + summary2[:1000]); log("Агент ответил на починку")
            ok, out = self.checks()
            if not ok:
                raise RuntimeError("проверки проекта не прошли и после починки:\n" + out[-1200:])
            summary += "\n\nДоработка после проверок: " + summary2
        elif self.project.get("checks"):
            self.say("Проверки проекта прошли")
        hits = self.guard() + self.leak(summary, "\n".join(self.lines))
        if hits:
            self.lines = [l for l in self.lines if not self.leak(l)]   # и в журнал такое не пишем
            raise RuntimeError("в правке или ответе агента найдено похожее на секрет (%s) — не публикую. Уберите секрет из задания или кода." % ", ".join(sorted(set(hits))))
        res = self.publish(summary)
        self.say("Merge request: " + str(res["pr_url"]))
        return res, summary


def report(task_id, status, **kw):
    try:
        api("/api/cowork/runner/report/" + task_id, dict(status=status, **kw))
    except (urllib.error.URLError, ValueError) as e:
        log("отчёт не отправлен:", e)


def heartbeat():
    code, out = run(["claude", "--version"], WORK, {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "")}, timeout=30) if not MOCK else (0, "mock")
    try:
        return api("/api/cowork/runner/heartbeat", {"version": VERSION, "has_key": bool(MODEL_KEY) or MOCK,
                                                    "claude": out.strip()[:60] if code == 0 else "нет claude"})
    except (urllib.error.URLError, ValueError) as e:
        log("портал не отвечает:", e)
        return None


def one(data):
    job = Job(data)
    try:
        res, summary = job.execute()
        report(job.task["id"], "review", pr_url=res["pr_url"], mr_id=res["mr_id"], log="\n".join(job.lines)[-MAX_LOG:],
               summary=summary, usage=job.usage, model=job.model)
    except Exception as e:  # noqa: BLE001 — любая ошибка: задание помечается неудавшимся, исполнитель живёт дальше
        job.say("Не удалось: %s" % e)
        report(job.task["id"], "failed", log="\n".join(job.lines)[-MAX_LOG:], summary=str(e)[:1500], usage=job.usage, model=job.model)
    finally:
        shutil.rmtree(job.dir, ignore_errors=True)


def main():
    if not TOKEN:                                            # нет cowork.env на сервере: ждём, не перезапускаясь каждые секунды
        log("нет CW_RUNNER_TOKEN — исполнитель спит, пока администратор не создаст /opt/staff-data/cowork.env")
        while True:
            time.sleep(3600)
    os.makedirs(WORK, exist_ok=True)
    log("исполнитель %s, портал %s%s" % (VERSION, PORTAL, " (заглушка)" if MOCK else ""))
    last_hb = 0
    while True:
        if time.time() - last_hb > 60:
            heartbeat(); last_hb = time.time()
        try:
            data = api("/api/cowork/runner/next")
        except urllib.error.HTTPError as e:
            log("портал отказал: %s %s" % (e.code, "— не совпадает CW_RUNNER_TOKEN" if e.code == 403 else ""))
            if os.environ.get("CW_ONCE"):
                sys.exit(2)
            time.sleep(POLL); continue
        except (urllib.error.URLError, ValueError) as e:
            log("портал не отвечает:", e)
            if os.environ.get("CW_ONCE"):
                sys.exit(2)
            time.sleep(POLL); continue
        if data and data.get("task"):
            one(data); last_hb = 0
            continue
        if os.environ.get("CW_ONCE"):
            break
        time.sleep(POLL)


if __name__ == "__main__":
    main()
