#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
info(){ printf "${GREEN}[+]${RESET} %s\n" "$*"; }
warn(){ printf "${YELLOW}[!]${RESET} %s\n" "$*"; }
fail(){ printf "${RED}[x]${RESET} %s\n" "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${1:-}" ]]; then PROJECT_DIR="$(cd "$1" && pwd)"
elif [[ -f "$SCRIPT_DIR/package.json" ]]; then PROJECT_DIR="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../package.json" ]]; then PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else fail "Не найден корень проекта. Передайте путь: bash publish-termux.sh /путь/к/проекту"; fi

[[ -f "$PROJECT_DIR/index.html" && -f "$PROJECT_DIR/app/index.html" ]] || fail "В каталоге нет index.html и app/index.html — это не корень проекта."
cd "$PROJECT_DIR"

printf '\nКалькулятор кондитера — публикация на GitHub\nКаталог: %s\n\n' "$PROJECT_DIR"

if command -v npm >/dev/null 2>&1 && [[ -f package.json ]]; then
  info "Запускаю pre-push проверки проекта…"
  npm run check || fail "Проверки не пройдены. Исправьте ошибки перед публикацией."
else
  warn "Node.js/npm не найдены — автоматические проверки пропущены. Установите nodejs-lts и повторите публикацию для полного preflight."
fi

if ! command -v git >/dev/null 2>&1; then
  command -v pkg >/dev/null 2>&1 || fail "Git не установлен. В Termux выполните: pkg install git"
  info "Устанавливаю Git через Termux pkg…"
  pkg update -y && pkg install git -y
fi

if ! git config user.name >/dev/null 2>&1; then
  read -r -p "Имя автора коммитов: " GIT_NAME
  [[ -n "$GIT_NAME" ]] || fail "Имя не может быть пустым."
  git config --global user.name "$GIT_NAME"
fi
if ! git config user.email >/dev/null 2>&1; then
  read -r -p "Email автора коммитов (можно GitHub noreply): " GIT_EMAIL
  [[ -n "$GIT_EMAIL" ]] || fail "Email не может быть пустым."
  git config --global user.email "$GIT_EMAIL"
fi

if [[ ! -d .git ]]; then
  info "Создаю Git-репозиторий…"
  git init
fi

git branch -M main
REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$REMOTE" ]]; then
  read -r -p "HTTPS или SSH URL пустого GitHub-репозитория: " REMOTE
  [[ -n "$REMOTE" ]] || fail "URL репозитория обязателен. Создайте пустой репозиторий на github.com и повторите."
  git remote add origin "$REMOTE"
else
  printf 'Текущий origin: %s\n' "$REMOTE"
  read -r -p "Использовать этот origin? [Y/n] " USE_REMOTE
  if [[ "$USE_REMOTE" =~ ^[Nn]$ ]]; then
    read -r -p "Новый URL GitHub-репозитория: " NEW_REMOTE
    [[ -n "$NEW_REMOTE" ]] || fail "URL не может быть пустым."
    git remote set-url origin "$NEW_REMOTE"
  fi
fi

info "Добавляю всё содержимое проекта в Git…"
git add -A
if git diff --cached --quiet; then
  warn "Нет новых изменений для коммита. Проверю отправку текущей ветки."
else
  COMMIT_MSG="Release: publish calculator $(date '+%Y-%m-%d %H:%M')"
  git commit -m "$COMMIT_MSG"
fi

info "Отправляю main в GitHub…"
git push -u origin main
info "Готово: содержимое проекта отправлено на GitHub."
printf '\nДальше: откройте Settings → Pages → Build and deployment → GitHub Actions.\nWorkflow проекта автоматически соберёт и опубликует GitHub Pages.\n'
