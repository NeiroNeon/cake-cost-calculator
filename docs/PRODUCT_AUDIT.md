# Аудит продукта и адаптивности — release 1.1.1

Дата аудита исходного кода: 5 ноября 2026 года.

## Объём
Лендинг `index.html` + `site/`; калькулятор `app/index.html` + `app/src/domain.js`; localStorage `bento_cost_v3` и legacy `bento_cost_v2`; PWA manifest/service worker; GitHub Actions.

## Подтверждённые локальные проверки
- Синтаксис доменного JS, сайта, service worker и встроенного модуля приложения.
- Доменная логика: 12/12 unit-тестов.
- Синтаксис Termux Bash script.
- Синтаксис Python responsive audit script.

Playwright harness подготовлен, но браузерный запуск в среде подготовки не был успешно завершён: browser binary отсутствовал в ожидаемом каталоге Playwright, а локальная навигация ограничена системной политикой. Поэтому viewport не помечаются PASS до зелёного GitHub Actions run. CI устанавливает Chromium автоматически.

## Матрица Playwright
`npm run audit:responsive` рассчитан на viewport: 320×720, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800 и 1440×900.

Сценарии: горизонтальное переполнение, мобильное меню и Escape, пересчёт hero demo, открытие калькулятора, добавление ингредиента и выбор продукта, пересчёт суммы, сохранение после перезагрузки, экспорт JSON, reduced motion, ошибки консоли и page errors. Скриншоты и JSON report сохраняются в `test-results/`.

## Исправления
1. Service worker выбирает offline fallback по маршруту: `/app/` получает приложение, корневой маршрут — landing.
2. Ошибка записи в localStorage отображается пользователю с рекомендацией экспортировать JSON.
3. Диалоги возвращают фокус вызывающему элементу; Tab удерживается в открытом overlay.
4. Основные поля имеют доступные имена, итоговая сумма использует `aria-live`.
5. На узких экранах сокращены тяжёлые декоративные эффекты; touch targets увеличены.
6. CI запускает Chromium suite и сохраняет artifact `responsive-browser-audit`.

## Ограничения
Viewport emulation не заменяет физическую проверку Android/iOS: экранная клавиатура, safe areas, поворот, установка PWA и standalone mode. Safari/WebKit и Firefox не покрыты Chromium suite. Lighthouse/Core Web Vitals не заявляются без измерений на опубликованном URL. Offline PWA необходимо вручную проверить после первого HTTPS-визита.

## Запуск
```bash
npm run check
python3 -m pip install playwright
python3 -m playwright install chromium
npm run audit:responsive
```
