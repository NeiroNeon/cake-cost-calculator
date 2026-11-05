# Публикация из Termux

1. Распакуйте архив проекта в отдельный каталог.
2. Установите Termux из актуального источника и выполните `pkg update && pkg upgrade`.
3. Установите Git: `pkg install git -y`.
4. Создайте пустой репозиторий на GitHub (без README, LICENSE и .gitignore, поскольку они уже есть в проекте).
5. Авторизуйте Git push через GitHub CLI (`pkg install gh && gh auth login`) либо используйте HTTPS с credential helper / SSH-ключом.
6. Запустите из корня проекта:

```bash
bash scripts/publish-termux.sh
```

Скрипт запросит URL репозитория, создаст локальный Git-репозиторий, добавит все файлы, создаст коммит и отправит ветку `main`. Токен в скрипте не хранится и не запрашивается. При HTTPS GitHub может запросить Personal Access Token как пароль через Git credential flow; безопаснее использовать `gh auth login` или SSH.

Можно передать путь к каталогу первым аргументом:

```bash
bash /путь/к/publish-to-github-termux.sh /путь/к/распакованному-проекту
```

После push откройте GitHub → Settings → Pages → Build and deployment → GitHub Actions. Workflow `pages.yml` выполнит тесты и опубликует сайт.
