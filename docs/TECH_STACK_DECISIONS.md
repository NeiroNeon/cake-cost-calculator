# Motion и UI-библиотеки: техническое решение

Сохраняем лёгкий local-first стек: vanilla HTML/CSS/JavaScript, CSS transitions/keyframes, IntersectionObserver и нативные Web APIs. Motion не участвует в расчётах, хранении или навигации.

- **Anime.js:** полезен для timelines, сложных SVG/DOM motion и синхронизированных последовательностей. Сейчас нет сценария, который оправдывает дополнительную runtime-зависимость. https://animejs.com/documentation/
- **Motion:** полезен для сложных layout transitions, draggable UI и shared elements. Текущие переходы проще реализовать CSS; предпочтительны `transform` и `opacity`. https://motion.dev/docs
- **Kokonut UI:** ориентирован на React + Tailwind CSS и shadcn/ui/Motion. Это не drop-in CSS toolkit для vanilla-приложения. Подключать только в рамках осознанной миграции. https://kokonutui.com/docs

Правила: короткие переходы 180–320 ms; уважать `prefers-reduced-motion`; на мобильных отключать тяжёлый blur и непрерывную декорацию; не добавлять CDN-зависимости, обязательные для offline. Каждая зависимость требует конкретного UX-сценария, оценки размера, лицензии, тестов и плана удаления.
