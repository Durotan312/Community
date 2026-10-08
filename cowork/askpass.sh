#!/bin/sh
# GIT_ASKPASS исполнителя WorkFlow: git спрашивает логин и пароль — отдаём токен проекта из окружения git-процесса,
# в адрес репозитория и на диск токен не попадает.
case "$1" in
  *sername*) echo "oauth2" ;;
  *) echo "$CW_GIT_TOKEN" ;;
esac
