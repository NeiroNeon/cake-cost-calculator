const rows = [...document.querySelectorAll('#demoRows input')];
const format = value => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
function updateDemo() {
  let total = 0;
  rows.forEach(input => {
    const qty = Math.max(0, Number(input.value) || 0);
    const cost = qty * Number(input.dataset.price);
    total += cost;
    input.closest('.demo-row').querySelector('.row-cost').textContent = `${format(cost)} BYN`;
  });
  document.querySelector('#demoTotal').innerHTML = `${format(total)} <small>BYN</small>`;
}
rows.forEach(input => input.addEventListener('input', updateDemo));
const menu = document.querySelector('.menu');
menu?.addEventListener('click', () => document.querySelector('.nav nav').classList.toggle('open'));
document.querySelectorAll('.nav nav a').forEach(link => link.addEventListener('click', () => document.querySelector('.nav nav').classList.remove('open')));
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
const revealItems = [...document.querySelectorAll('.metrics div, .step, .formula-card, .privacy-copy, .closing h2')];
revealItems.forEach((item, index) => {
  item.classList.add('reveal');
  item.style.setProperty('--reveal-delay', `${(index % 3) * 50}ms`);
});
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealItems.forEach(item => observer.observe(item));
} else {
  revealItems.forEach(item => item.classList.add('is-visible'));
}
