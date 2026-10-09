const state = {
  view: 'home', search: '', user: null,
  news: [], employees: [], events: [], faq: [], suggestions: [],
  about: { title: '', body: '' }, leaders: [], onboarding: [],
  // остальные списки тоже держим пустыми массивами: если запрос не прошёл (сеть моргнула,
  // сессия истекла), раздел покажет «пусто», а не свалится с ошибкой
  projects: [], gallery: [], partners: [], honors: [], documents: [], requests: [],
};


// =========================================================
// ИКОНКИ — строгий контурный набор вместо эмодзи (решение пользователя 21.09.2026).
// ico('calendar') → инлайн-SVG, размер = font-size родителя, цвет = currentColor.
// =========================================================
const ICONS = {
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  robot: '<rect x="4" y="9" width="16" height="11" rx="3"/><circle cx="9" cy="14.5" r="1" fill="currentColor"/><circle cx="15" cy="14.5" r="1" fill="currentColor"/><path d="M12 9V5M12 5H9M1 13v4M23 13v4"/>',
  gitBranch: '<circle cx="6" cy="4" r="2.5"/><circle cx="6" cy="20" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 6.5v11M18 10.5c0 5-7 4-12 7"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  receipt: '<path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L10 21l-2.5-1.7L5 21z"/><path d="M9 8h6M9 12h6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.4L20 15"/><path d="M20 20v-5h-5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16M8 7.5v.01M11.5 16v-3.2a2.3 2.3 0 0 1 4.5 0V16M11.5 10.5V16"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.83 17 22l-5-3-5 3 1.52-9.17"/>',
  gamepad: '<path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.54-.6-6.58-.68-7.26A4 4 0 0 0 17.32 5z"/>',
  g_snake: '<path d="M3 15c0-3 3-4 5-2s5 4 8 1 3-4 5-3"/><circle cx="20" cy="9" r="1.5"/>',
  g_mines: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  g_quiz: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  g_typing: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
  news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  video: '<path d="m22 8-6 4 6 4V8z"/><rect x="1" y="6" width="15" height="12" rx="2"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  presentation: '<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  map: '<path d="m1 6 7-3 8 3 7-3v15l-7 3-8-3-7 3z"/><path d="M8 3v15M16 6v15"/>',
  userminus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
};
function ico(name, cls) {
  const d = ICONS[name] || ICONS.folder;
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
// сайдбар в index.html: <i data-ico="calendar"></i> заполняем при старте
document.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = ico(el.dataset.ico); });

// ---------- generic helpers ----------
// =========================================================
// ТЕХНИЧЕСКИЕ РАБОТЫ: сервер не отвечает (перезагрузка, выкладка) — показываем окно и ждём.
// Перехватываем все запросы разом; как только портал снова отвечает — страница обновляется сама.
// =========================================================
const _realFetch = window.fetch.bind(window);
let _maintTimer = null;
function showMaintenance() {
  if (_maintTimer) return;
  const el = document.createElement('div');
  el.className = 'maint-overlay';
  el.innerHTML = `
    <div class="maint-card">
      <img src="/static/logo-mark.png" alt="">
      <div class="maint-title">Ведутся технические работы</div>
      <div class="maint-text">Портал обновляется и вернётся через пару минут.<br>Страница откроется сама — ничего нажимать не нужно.</div>
      <div class="maint-dots"><i></i><i></i><i></i></div>
    </div>`;
  document.body.appendChild(el);
  _maintTimer = setInterval(async () => {
    try {
      const r = await _realFetch('/api/me', { cache: 'no-store' });
      if (r.status < 500) { clearInterval(_maintTimer); location.reload(); }
    } catch (e) { /* ещё не поднялся */ }
  }, 4000);
}
// Одиночный сбой — ещё не работы: после сна компьютера, смены Wi-Fi/VPN или оборванного запроса fetch падает,
// хотя сервер жив (так окно всплывало у людей по утрам — 30.09.2026). Окно показываем, только если
// сервер не ответил на две перепроверки подряд с паузой 2 с.
let _maintProbe = null;
function suspectMaintenance() {
  if (_maintTimer || _maintProbe || navigator.onLine === false) return;   // пропал интернет у человека — это не наши работы
  _maintProbe = (async () => {
    for (let i = 0; i < 2; i++) {
      await new Promise(res => setTimeout(res, 2000));
      try {
        const r = await _realFetch('/api/me', { cache: 'no-store' });
        if (r.status < 500) return;                                  // сервер отвечает — ложная тревога
      } catch (e) { /* не ответил — проверяем ещё раз */ }
    }
    if (navigator.onLine !== false) showMaintenance();
  })().finally(() => { _maintProbe = null; });
}
window.fetch = async (...args) => {
  try {
    const r = await _realFetch(...args);
    if ([502, 503, 504].includes(r.status)) suspectMaintenance();
    return r;
  } catch (e) {
    if (e.name !== 'AbortError') suspectMaintenance();   // запрос отменили сами — это не сбой
    throw e;
  }
};

async function fetchJson(url, options) {
  try {
    const r = await fetch(url, options);
    if (!r.ok) {
      // Сессия кончилась или её нет — показываем экран входа, а не молчим.
      if (r.status === 401 && state.user) { state.user = null; showLogin(); }
      if (r.status === 403) showToast('Это действие доступно только администратору.');
      return null;
    }
    return await r.json();
  } catch (e) { return null; }
}
function isAdmin() { return !!(state.user && state.user.role === 'admin'); }
function canEditNews() { return !!(state.user && (state.user.role === 'admin' || state.user.role === 'hr')); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
// значение внутри JS-кода обработчика в HTML-атрибуте: onclick="fn(${jsArg(x)})".
// Одного escapeHtml там мало — браузер раскодирует &#39; обратно в кавычку и строка «вырвется» (аудит 23.09.2026)
function jsArg(v) { return escapeHtml(JSON.stringify(String(v == null ? '' : v))); }
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
// дата со временем (09.10.2026, заявки: «не просто дата, а именно со временем»)
function fmtTime(iso) { const d = new Date(iso); return isNaN(d) || !String(iso).includes('T') ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
function fmtDateTime(iso) { const t = fmtTime(iso); return fmtDate(iso) + (t ? ', ' + t : ''); }
function fmtShortDateTime(iso) { const t = fmtTime(iso); return fmtShortDate(iso) + (t ? ', ' + t : ''); }
function fmtShortDate(isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d)) return isoDate;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Сжимаем картинку в браузере: не больше 2000px по длинной стороне, JPEG.
// Фото с телефона весят 5–12 МБ — после сжатия 300–600 КБ, грузятся за секунды.
async function shrinkImage(file, maxSide = 2000, quality = 0.86) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;  // маленькое — как есть
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;  // формат не читается (например, HEIC) — отправим как есть, сервер ответит
  }
}

async function uploadOne(file) {
  const prepared = await shrinkImage(file);
  const fd = new FormData();
  fd.append('file', prepared);
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) {
      const why = r.status === 413 ? 'слишком большой' : r.status === 400 ? 'неподдерживаемый формат' : `ошибка ${r.status}`;
      return { url: null, error: `${file.name} — ${why}` };
    }
    const data = await r.json();
    return { url: data.url, error: null };
  } catch (e) {
    return { url: null, error: `${file.name} — нет связи с сервером` };
  }
}

async function uploadFile(inputEl) {
  const file = inputEl.files[0];
  if (!file) return null;
  const { url, error } = await uploadOne(file);
  if (error) showToast('Не удалось загрузить: ' + error);
  return url;
}

// ---------- load ----------
async function loadAll() {
  // Всё запрашиваем разом. Раньше семь запросов шли по одному, друг за другом: на медленной связи время складывалось,
  // а заминка на одном (05.10.2026 у пользователя дома — 19 секунд) держала всю страницу на «Загрузка…».
  const [news, emp, events, faq, sugg, about, leaders, onboarding, projects, gallery,
    honors, partners, requests, announcement, book, welcomeVideo] = await Promise.all([
    fetchJson('/api/news'), fetchJson('/api/employees'),
    fetchJson('/api/events'), fetchJson('/api/faq'), fetchJson('/api/suggestions'),
    fetchJson('/api/about'), fetchJson('/api/leaders'), fetchJson('/api/onboarding'),
    fetchJson('/api/projects'), fetchJson('/api/gallery'),
    fetchJson('/api/honors'), fetchJson('/api/partners'), fetchJson('/api/requests'),
    fetchJson('/api/announcement'), fetchJson('/api/book'), fetchJson('/api/welcome-video'),
    loadTasks(),
  ]);
  state.news = news || [];
  state.employees = emp || [];
  state.events = events || [];
  state.projects = projects || [];
  state.gallery = gallery || [];
  state.honors = honors || [];
  state.partners = partners || [];
  state.faq = faq || [];
  state.suggestions = sugg || [];
  state.about = about || { title: '', body: '' };
  state.leaders = leaders || [];
  state.onboarding = onboarding || [];
  state.requests = requests || [];
  state.announcement = announcement || {};
  state.books = Array.isArray(book) ? book : [];   // книги руководителей (09.10.2026), листаются в виджете
  state.welcomeVideo = welcomeVideo || {};
  state._liveSig = liveSignature(state.requests, state.suggestions);
  updateRequestsBadge();
}

// ---------- nav ----------
// Выпадающее меню вкладки («Сотрудники», «Компания», «Медиа»). На экранах уже 1461px строка вкладок прокручивается
// (overflow-x:auto) и обрезала меню: оно открывалось, но его не было видно — с ноутбука нельзя было попасть во
// «Все сотрудники», «Наши партнёры» и «Видео» (заметил пользователь 05.10.2026). Поэтому меню ставим поверх страницы
// (position:fixed) по координатам вкладки — так его ничто не обрежет. На сенсорных экранах наведения нет:
// первое касание вкладки открывает меню, выбор — вторым касанием.
const NAV_NO_HOVER = window.matchMedia('(hover: none)');
function placeNavMenu(item) {
  const menu = item.querySelector('.nav-menu');
  if (!menu) return;
  const r = item.getBoundingClientRect();
  menu.style.display = '';
  menu.style.position = 'fixed';
  menu.style.top = Math.round(r.bottom + 8) + 'px';
  // у правого края не даём вылезти за экран; ширину берём настоящую (в переводе пункты бывают длиннее), 236 — пока меню скрыто
  const w = menu.offsetWidth || 236;
  menu.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + 'px';
}
function closeNavMenus(except) {
  document.querySelectorAll('.nav-item.has-menu.open').forEach(n => { if (n !== except) n.classList.remove('open'); });
}
document.querySelectorAll('.nav-item.has-menu').forEach(item => {
  item.addEventListener('mouseenter', () => { placeNavMenu(item); requestAnimationFrame(() => placeNavMenu(item)); });   // второй раз — когда меню уже показано и известна его ширина
});
document.addEventListener('click', e => { if (!e.target.closest('.nav-item.has-menu')) closeNavMenus(); });
window.addEventListener('scroll', () => closeNavMenus(), { passive: true });
document.querySelector('.nav-tabs').addEventListener('scroll', () => {
  closeNavMenus();
  // меню, открытое наведением, едет вместе с вкладкой, когда строку вкладок прокручивают колесом
  document.querySelectorAll('.nav-item.has-menu:hover').forEach(placeNavMenu);
}, { passive: true });

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    if (el.classList.contains('has-menu') && NAV_NO_HOVER.matches && !el.classList.contains('open')) {
      closeNavMenus(el); placeNavMenu(el); el.classList.add('open');   // сенсорный экран: сначала показываем пункты
      return;
    }
    closeNavMenus();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    state.view = el.dataset.view;
    state.search = '';
    state.projectOpen = null;
    state.peopleDep = '';   // в «Сотрудники» заходим со всеми подразделениями
    if (state.view === 'org') state.orgCollapsed = null;  // на оргструктуру всегда заходим со свёрнутыми полосами
    if (state.view === 'news') state.newsTab = 'news';   // клик по самой вкладке — лента новостей
    render();
  });
});
// пункты выпадающего меню (подвкладки): «Новости» → Новости / Ивенты
document.querySelectorAll('.nav-menu-item').forEach(item => {
  item.addEventListener('click', e => {
    e.stopPropagation();
    const parent = item.closest('.nav-item');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    parent.classList.add('active');
    // пункт может вести либо в отдельный раздел (data-view), либо в подраздел родителя (data-sub)
    state.view = item.dataset.view || parent.dataset.view;
    if (item.dataset.sub) state.newsTab = item.dataset.sub;
    if (state.view === 'org') state.orgCollapsed = null;
    state.search = '';
    state.projectOpen = null;   // из меню всегда попадаем в список проектов, а не на последнюю открытую страницу
    state.peopleDep = '';
    // после выбора прячем меню, пока курсор не уйдёт с вкладки — иначе оно висит поверх страницы
    const menu = item.closest('.nav-menu');
    closeNavMenus();
    if (!NAV_NO_HOVER.matches) {          // на сенсорном экране mouseleave не случится — там меню закрывает класс open
      menu.style.display = 'none';
      parent.addEventListener('mouseleave', () => { menu.style.display = ''; }, { once: true });
    }
    render();
  });
});
function syncNavMenu() {
  document.querySelectorAll('.nav-menu-item').forEach(i => {
    const parentView = i.closest('.nav-item').dataset.view;
    const on = i.dataset.view
      ? state.view === i.dataset.view
      : state.view === parentView && i.dataset.sub === state.newsTab;
    i.classList.toggle('active', on);
  });
  // родительская вкладка подсвечена, если открыт любой её подраздел
  document.querySelectorAll('.nav-item[data-group]').forEach(p => {
    if (p.dataset.group.split(',').includes(state.view)) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      p.classList.add('active');
    }
  });
}

// ---------- левое меню: свернуть до иконок (запоминается в браузере) ----------
function toggleSidenav() {
  const collapsed = document.body.classList.toggle('sidenav-collapsed');
  try { localStorage.setItem('cs_sidenav', collapsed ? '1' : '0'); } catch (e) {}
}
try { if (localStorage.getItem('cs_sidenav') === '1') document.body.classList.add('sidenav-collapsed'); } catch (e) {}

// ---------- counts / render dispatch ----------
function updateCounts() {
  // Счётчики на вкладках убраны по просьбе пользователя — в шапке только названия разделов.
}

// ---------- адрес страницы = текущий раздел ----------
// Раздел и вкладка записываются в адрес после «#»: #news/gallery, #hr/requests, #projects/<id>.
// Поэтому F5 оставляет человека там же, где он был, ссылкой на раздел можно поделиться, а «Назад» возвращает на шаг.
const SUBSTATE = { attendance: 'attTab', news: 'newsTab', hr: 'hrTab', buyer: 'buyerTab', accountant: 'accTab', admin: 'adminTab', projects: 'projectOpen', requests: 'reqForm', manager: 'mgrTab', games: 'game', templates: 'tplTab', tasks: 'taskTab', cowork: 'coworkTab' };
function viewToHash() {
  let sub = SUBSTATE[state.view] ? state[SUBSTATE[state.view]] : '';
  if (state.view === 'news' && sub === 'news') sub = '';   // лента новостей — вид по умолчанию, в адресе не пишем
  return '#' + state.view + (sub ? '/' + encodeURIComponent(sub) : '');
}
function syncUrl() {
  const h = viewToHash();
  if (location.hash === h) return;
  if (!location.hash || state._urlReplace) history.replaceState(null, '', location.pathname + location.search + h);
  else history.pushState(null, '', location.pathname + location.search + h);
  state._urlReplace = false;
}
function applyHash() {
  let [view, sub] = location.hash.replace(/^#/, '').split('/');
  if (view === 'media_slides') view = 'knowledge';   // презентации переехали в «Базу знаний» (22.09.2026)
  const known = view && (view === 'home' || view === 'faq' || document.querySelector(`.nav-item[data-view="${CSS.escape(view)}"], .nav-menu-item[data-view="${CSS.escape(view)}"]`));
  state.view = known ? view : 'home';
  for (const k of Object.values(SUBSTATE)) if (k !== 'newsTab') state[k] = null;
  if (SUBSTATE[state.view] && sub) state[SUBSTATE[state.view]] = decodeURIComponent(sub);
  if (state.view === 'news') { if (sub === 'gallery') state.view = 'gallery_page'; state.newsTab = 'news'; }
  syncNavActive();
}
// подсветка вкладки по текущему разделу (при переходе по адресу кликов не было)
function syncNavActive() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const v = state.view === 'faq' ? 'roadmap' : state.view;
  const el = document.querySelector(`.nav-item[data-view="${CSS.escape(v)}"]`)
    || [...document.querySelectorAll('.nav-item[data-group]')].find(n => n.dataset.group.split(',').includes(v));
  if (el) el.classList.add('active');
}
window.addEventListener('popstate', () => { if (!state.user) return; applyHash(); closeModal(); render(); window.scrollTo(0, 0); });

function render() {
  updateViewAsBtn();
  if (state.user && (state.user.cowork_only || isWorkflowEntry()) && state.view !== 'cowork' && canCowork()) state.view = 'cowork';   // отдельный вход — только WorkFlow
  if (state.view !== 'office') state.officeSearch = '';   // поиск по карте офиса живёт только внутри раздела
  if (state.view !== 'games' && typeof gamesLeave === 'function') { gamesLeave(); state.game = null; }
  if (state.user) { updateRequestsBadge(); syncUrl(); }   // пункт «HR-панель» и счётчик — по роли; адрес — по разделу
  updateCounts();
  renderSideWidgets();
  syncNavActive();   // подсветку пунктов держим по текущему разделу, а не по последнему клику
  syncNavMenu();
  const main = document.getElementById('main');
  // лёгкое появление содержимого при смене раздела
  main.classList.remove('fade-in'); void main.offsetWidth; main.classList.add('fade-in');
  // на вкладке чата прячем правую колонку и растягиваем окно на всю высоту
  document.querySelector('.body-row').classList.toggle('chat-mode', state.view === 'aibot');
  document.body.classList.toggle('cw-mode', state.view === 'cowork' && !!state.user);   // Connected WorkFlow — отдельное пространство на весь экран (08.10.2026)
  // в чате страница не прокручивается — только лента сообщений; высоту считаем от реальной шапки
  if (state.view === 'aibot') window.scrollTo(0, 0);  // сначала наверх, потом мерим шапку
  document.documentElement.classList.toggle('chat-open', state.view === 'aibot');
  syncMastheadHeight();
  // на схеме оргструктуры тоже прячем колонку — схеме нужна вся ширина
  document.querySelector('.body-row').classList.toggle('org-mode', state.view === 'org' || state.view === 'attendance');   // табелю тоже нужна вся ширина
  if (state.view === 'home') { renderHome(main); return animateNumbers(main); }
  if (state.view === 'news') return renderNews(main);
  if (state.view === 'people') return renderPeople(main);
  if (state.view === 'org') return renderOrg(main);
  if (state.view === 'events') return renderEvents(main);
  if (state.view === 'projects') return renderProjects(main);
  if (state.view === 'gallery') return renderGallery(main);
  if (state.view === 'templates') return renderTemplates(main);
  if (state.view === 'aibot') return renderAiBot(main);
  if (state.view === 'messenger') return renderMessenger(main);
  if (state.view === 'loyalty') return renderLoyalty(main);
  if (state.view === 'values') return renderValues(main);
  if (state.view === 'cowork') return renderCowork(main);
  if (state.view === 'partners') return renderPartners(main);
  if (state.view === 'hr') return isStaff() ? renderHr(main) : goHome();
  if (state.view === 'buyer') return seesBuyer() ? renderBuyer(main) : goHome();
  if (state.view === 'accountant') return seesAccountant() ? renderAccountant(main) : goHome();
  if (state.view === 'requests') return renderRequests(main);
  if (state.view === 'tasks') return renderTasks(main);
  if (state.view === 'products' || state.view.startsWith('prod_')) return goToView('projects');
  if (state.view === 'gallery_page') return renderGallery(main);
  if (state.view === 'knowledge') return renderPresentations(main);
  if (state.view === 'media_slides') return goToView('knowledge');   // презентации переехали в «Базу знаний» (22.09.2026)
  if (state.view === 'honors') return goHome();   // «Доску почёта» убрали из меню 24.09.2026, код и данные остались
  if (state.view === 'vacancies') return renderVacancies(main);
  if (state.view === 'vacation') return renderVacation(main);
  if (state.view === 'office') return renderOffice(main);
  if (state.view === 'games') return renderGames(main);
  if (state.view === 'manager') return renderManager(main);
  if (state.view === 'itsupport') { state.reqForm = 'it'; return goToView('requests'); }
  if (state.view === 'polls') return goHome();
  if (SOON_PAGES[state.view]) return renderSoon(main, SOON_PAGES[state.view]);
  if (state.view === 'users') { state.adminTab = 'users'; return goToView('admin'); }   // учётки переехали в админ-панель
  if (state.view === 'admin') return isAdmin() ? renderAdmin(main) : goHome();
  if (state.view === 'profile') return renderProfile(main);
  if (state.view === 'settings') return renderSettings(main);
  if (state.view === 'faq') return renderFaq(main);
  if (state.view === 'attendance') return renderAttendance(main);
  if (state.view === 'suggestions') return renderSuggestions(main);
  if (state.view === 'roadmap') return renderRoadmap(main);
}

// ---------- lightbox ----------
// Просмотр фото. urls — все фото альбома: тогда можно листать стрелками, клавишами и свайпом.
function openLightbox(url, urls) {
  const list = (urls && urls.length) ? urls : [url];
  let idx = Math.max(0, list.indexOf(url));
  const many = list.length > 1;

  const wrap = document.createElement('div');
  wrap.className = 'lightbox-overlay';
  document.body.classList.add('modal-open');
  wrap.innerHTML = `
    <button class="lightbox-close" title="Закрыть (Esc)">&times;</button>
    ${many ? `<button class="lightbox-nav prev" title="Предыдущее (←)">&#8249;</button>
              <button class="lightbox-nav next" title="Следующее (→)">&#8250;</button>` : ''}
    <img src="${escapeHtml(list[idx])}" alt="" draggable="false">
    <div class="lightbox-hint">${many ? `<span class="lightbox-counter">${idx + 1} / ${list.length}</span> · ← → или свайп — листать · ` : ''}Esc или клик вне фото — закрыть</div>`;
  const img = wrap.querySelector('img');

  const show = (i) => {
    idx = (i + list.length) % list.length;
    img.src = list[idx];
    const c = wrap.querySelector('.lightbox-counter');
    if (c) c.textContent = `${idx + 1} / ${list.length}`;
    // подгружаем соседей заранее, чтобы листалось без задержки
    [idx + 1, idx - 1].forEach(j => { const p = new Image(); p.src = list[(j + list.length) % list.length]; });
  };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if (!document.getElementById('modalOverlay')) document.body.classList.remove('modal-open'); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (many && e.key === 'ArrowRight') show(idx + 1);
    else if (many && e.key === 'ArrowLeft') show(idx - 1);
  };

  wrap.addEventListener('click', (e) => {
    if (e.target.classList.contains('prev')) { show(idx - 1); return; }
    if (e.target.classList.contains('next')) { show(idx + 1); return; }
    if (e.target.tagName !== 'IMG') close();
  });

  // свайп пальцем и перетаскивание мышью
  let startX = null;
  const down = (e) => { startX = (e.touches ? e.touches[0] : e).clientX; };
  const up = (e) => {
    if (startX === null) return;
    const x = (e.changedTouches ? e.changedTouches[0] : e).clientX;
    const dx = x - startX; startX = null;
    if (many && Math.abs(dx) > 50) show(dx < 0 ? idx + 1 : idx - 1);
  };
  wrap.addEventListener('touchstart', down, { passive: true });
  wrap.addEventListener('touchend', up);
  img.addEventListener('mousedown', down);
  wrap.addEventListener('mouseup', up);

  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  if (many) show(idx);
}

// ---------- side widgets ----------
function renderSideWidgets() {
  const el = document.getElementById('sideWidgets');
  if (!el) return;
  // «сегодня» — по Астане, как и часы на главной
  const ast = astanaNow();
  const today = new Date(ast.getUTCFullYear(), ast.getUTCMonth(), ast.getUTCDate());
  const dayOnly = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const HORIZON = 14;          // «ближайшие события» — только две недели вперёд

  // всё ближайшее одной лентой: события календаря и дни рождения
  const items = [];
  for (const e of state.events) {
    const date = dayOnly(e.date);
    if (date >= today && (date - today) / 86400000 <= HORIZON)
      items.push({ date, icon: ico(e.type === 'vacation' ? 'sun' : e.type === 'holiday' ? 'star' : 'calendar'), title: e.title, kind: 'event' });
  }
  if ((state.settings || {}).showBirthdays !== false) {
    for (const p of state.employees.filter(p => p.birthday)) {
      const bd = dayOnly(p.birthday);
      const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      if ((next - today) / 86400000 <= HORIZON) items.push({ date: next, icon: ico('cake'), title: p.name, kind: 'birthday' });
    }
  }
  items.sort((a, b) => a.date - b.date);
  const when = d => {
    const days = Math.round((d - today) / 86400000);
    if (days === 0) return '<b class="widget-today">сегодня</b>';
    if (days === 1) return 'завтра';
    if (days <= 6) return `через ${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  el.innerHTML = `
    <div class="widget-card widget-upcoming" onclick="goToView('events')" role="button" title="Открыть календарь">
      <div class="widget-title">Ближайшие события</div>
      ${items.length ? items.slice(0, 3).map(it => `
        <div class="widget-row">
          <span class="widget-row-name"><i class="widget-row-icon">${it.icon}</i>${escapeHtml(it.title)}${it.kind === 'birthday' ? ' <em class="widget-row-note">день рождения</em>' : ''}</span>
          <span class="widget-row-date">${when(it.date)}</span>
        </div>`).join('') : '<div class="widget-empty">В ближайшие две недели событий нет</div>'}
    </div>
    ${inboxWidgetHtml()}
    ${myRequestsWidgetHtml()}
    ${bookWidgetHtml()}`;   // AI-бот справа не показываем — он живёт в левой панели «Инструменты»
  // меряем после того, как render() переключит раскладку: при переходе из Road Map / Посещаемости колонка ещё скрыта,
  // размеры нулевые — и книга вставала во весь рост (замечено на «Сотрудниках» и «Моём отпуске», 24.09.2026)
  requestAnimationFrame(fitBookCover);
  bookAutoStart();
}

// «К рассмотрению» — только тем, кто ведёт заявки: HR, закупщик, админ. Показывается, когда есть что разбирать.
function inboxWidgetHtml() {
  if (!state.user) return '';
  const fresh = type => (state.requests || []).filter(r => r.type === type && r.status === 'new').length;
  const rows = [];
  if (isStaff()) {
    const trips = fresh('trip'), sug = (state.suggestions || []).filter(s => s.status === 'new').length;
    if (trips) rows.push([ico('plane'), 'Новые командировки', trips, "openHr('requests')"]);
    const vac = fresh('vacation') + fresh('unpaid');
    if (vac) rows.push([ico('sun'), 'Новые заявки по отпуску', vac, "openHr('vacation')"]);
    const staff = fresh('hiring') + fresh('dismissal') + fresh('buddy');
    if (staff) rows.push([ico('userplus'), 'Подбор, увольнения, Mentor', staff, "openHr('staff')"]);
    const cands = fresh('referral');
    if (cands) rows.push([ico('users'), 'Предложенные кандидаты', cands, "openHr('cands')"]);
    if (sug) rows.push([ico('bulb'), 'Новые обращения', sug, "openHr('suggestions')"]);
  }
  if (isBuyer()) {
    const eq = fresh('equipment');
    if (eq) rows.push([ico('laptop'), 'Заявки на технику', eq, "state.buyerTab='new';goToView('buyer')"]);
  }
  if (isAccountant()) {
    const comp = fresh('compensation');
    if (comp) rows.push([ico('receipt'), 'Компенсации по чекам', comp, "state.accTab='new';goToView('accountant')"]);
  }
  const appr = state.user && state.user.emp_id ? pendingApprovals(state.user.emp_id).length : 0;
  if (appr) rows.unshift([ico('list'), 'Заявки на согласование', appr, "state.mgrTab='approve';goToView('manager')"]);
  if (isAdmin()) {
    const it = fresh('it');
    if (it) rows.push([ico('wrench'), 'Заявки в поддержку IT', it, "state.supportTab='new';openAdmin('support')"]);
  }
  if (state.tasks) {
    const w = tasksWaiting();
    if (w.fresh) rows.push([ico('check'), 'Новые задачи', w.fresh, "state.taskTab='mine';goToView('tasks')"]);
    if (w.review) rows.push([ico('check'), 'Задачи на проверке', w.review, "state.taskTab='given';goToView('tasks')"]);
  }
  if (!rows.length) return '';
  return `
    <div class="widget-card widget-inbox">
      <div class="widget-title">К рассмотрению</div>
      ${rows.map(([icon, label, n, go]) => `
        <div class="widget-row widget-link" onclick="${go}" role="button">
          <span class="widget-row-name"><i class="widget-row-icon">${icon}</i>${label}</span>
          <b class="widget-count">${n}</b>
        </div>`).join('')}
    </div>`;
}

// «Книга месяца от CEO» — в правой колонке под «Моими заявками» на всех страницах (24.09.2026: сначала только на главной, потом пользователь решил — везде).
// Ставят HR и админ (/api/hr/book), хранится одной записью в settings, как объявление.
// 09.10.2026: книги от всех руководителей, листаются стрелками (слова пользователя: «не только от CEO, но и от директоров,
// чтобы можно было листать и смотреть, какой директор какую книгу советует»). Текущая — state.bookIdx.
function curBook() { const list = state.books || []; if (!list.length) return null; state.bookIdx = ((state.bookIdx || 0) % list.length + list.length) % list.length; return list[state.bookIdx]; }
function bookShift(d, auto) {                     // меняется только блок книги, страница не перерисовывается (09.10.2026)
  state.bookIdx = (state.bookIdx || 0) + d; curBook();
  const el = document.querySelector('.widget-book');
  if (!el) { render(); return; }
  // размер карточки не пересчитываем: новая обложка получает те же ширину, высоту и режим, что у прежней — ничего не прыгает
  const prev = el.querySelector('.book-cover'), row = el.classList.contains('book-row');
  const size = prev ? { w: prev.style.width, h: prev.style.height } : null;
  el.outerHTML = bookWidgetHtml();
  const card = document.querySelector('.widget-book'), img = card && card.querySelector('.book-cover');
  if (card && row) card.classList.add('book-row');
  if (img && size) { img.style.width = size.w; img.style.height = size.h; }
  if (!auto) bookAutoStart();                       // после ручного клика отсчёт 5 секунд начинается заново
}
// книги листаются сами раз в 5 секунд (09.10.2026, просьба пользователя); наведение мышью, открытое окно
// и свёрнутая вкладка браузера ставят отсчёт на паузу
function bookAutoStart() {
  clearInterval(bookAutoStart._t);
  if ((state.books || []).length < 2) return;
  bookAutoStart._t = setInterval(() => {
    const el = document.querySelector('.widget-book');
    if (!el) { clearInterval(bookAutoStart._t); return; }
    if (document.hidden || el.matches(':hover') || document.body.classList.contains('modal-open')) return;
    bookShift(1, true);
  }, 5000);
}
// короткая роль для подписи «Советует …»: CTO, COO, SDL, CEO — длинная должность в строку не влезает (09.10.2026)
function bookRole(pos) {
  let s = (pos || '').split(' — ')[0].split(' / ')[0].trim();
  if (s.length > 12) { const m = s.match(/[A-Z]{2,5}/); s = m ? m[0] : (s === 'Генеральный директор' ? 'CEO' : s); }
  return s;
}
function bookByLine(b) { const r = bookRole(b.by_position); return `Советует ${escapeHtml((b.by || '').split(' ').slice(-1)[0] || b.by || '')}${r ? ' · ' + escapeHtml(r) : ''}`; }
function bookWidgetHtml() {
  const b = curBook();
  if (!b) return isStaff() ? `
    <div class="widget-card widget-book">
      <div class="widget-title">Книга месяца</div>
      <button class="btn secondary" onclick="openBookForm()">Добавить книгу</button>
    </div>` : '';
  const n = state.books.length;
  return `
    <div class="widget-card widget-book clickable" onclick="openBookCard()" role="button" title="Открыть карточку книги">
      <div class="widget-title">Книга месяца<a class="book-edit" href="#" onclick="event.stopPropagation();openBookForm();return false;">Изменить</a></div>
      <div class="book-by no-tr">${bookByLine(b)}</div>
      <div class="book-body">
        ${b.cover ? `<img class="book-cover" src="${escapeHtml(b.cover)}" alt="${escapeHtml(b.title)}">` : `<div class="book-cover book-cover-empty"><span>${escapeHtml(b.title)}</span></div>`}
        <div class="book-text">
          <div class="book-title book-link${b.title.length > 28 ? ' long' : ''}">${escapeHtml(b.title)}</div>
          ${b.author ? `<div class="book-author">${escapeHtml(b.author)}</div>` : ''}
        </div>
      </div>
      ${n > 1 ? `<div class="book-nav" onclick="event.stopPropagation()">
        <button class="book-arrow" onclick="bookShift(-1)" aria-label="Предыдущая книга">${ico('arrowLeft')}</button>
        <span class="book-dots">${state.books.map((_, i) => `<i class="${i === state.bookIdx ? 'on' : ''}"></i>`).join('')}</span>
        <button class="book-arrow" onclick="bookShift(1)" aria-label="Следующая книга">${ico('arrowLeft')}</button>
      </div>` : ''}
    </div>`;
}
// карточка книги: почему CEO советует и как получить coins за прочтение (25.09.2026)
function openBookCard() {
  const b = curBook();
  if (!b) return;
  openModal(`
    <div class="modal lp-modal book-modal">
      <div class="modal-head">
        <div class="lp-head"><span class="lp-ico">${ico('book')}</span><h3>Книга месяца</h3></div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="book-card-top">
          ${b.cover ? `<img class="book-card-cover" src="${escapeHtml(b.cover)}" alt="">` : ''}
          <div>
            <div class="book-card-title">${escapeHtml(b.title)}</div>
            ${b.author ? `<div class="book-author">${escapeHtml(b.author)}</div>` : ''}
          </div>
        </div>
        <div class="book-by no-tr">${bookByLine(b)}${b.by_position ? ` <span class="book-by-full">(${escapeHtml(b.by)}, ${escapeHtml(b.by_position)})</span>` : ''}</div>
        ${b.note ? `<div class="lp-label">Почему советует</div><div class="lp-text book-why">${escapeHtml(b.note)}</div>` : ''}
        <div class="lp-event">
          <div class="lp-event-title">Прочитайте и получите 100 Community Coins</div>
          <div class="lp-text">Прочитайте книгу месяца и сдайте короткий тест по ней — за это начисляется 100 Community Coins по программе лояльности.</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal();openBookForm()">Изменить</button>
        <button class="btn" onclick="closeModal()">Закрыть</button>
      </div>
    </div>`);
}
// Обложка книги месяца подстраивается под экран: на открытой главной книга видна целиком без прокрутки
// (просьба пользователя 24.09.2026). Высота = место от верха обложки до низа окна минус подписи под ней.
// Если места на обложку «во весь рост» меньше BOOK_MIN_H — книга встаёт строкой: обложка слева, название справа.
const BOOK_MIN_H = 230;
function fitBookCover() {
  const img = document.querySelector('.widget-book .book-cover');
  if (!img) return;
  if (!img.complete) { img.onload = fitBookCover; }
  const card = img.closest('.widget-book');
  if (!card.offsetParent) return;                   // колонка скрыта (Road Map, табель, чат) — мерить нечего
  card.classList.remove('book-row');
  img.style.width = img.style.height = '';
  if (window.innerWidth <= 1100) return;             // на планшете и телефоне колонка уходит вниз — там обычный размер
  const inner = card.clientWidth - 40;               // padding карточки 20+20
  const r = img.getBoundingClientRect();
  const top = r.top + window.scrollY;
  const below = card.getBoundingClientRect().bottom - r.bottom;   // всё, что под обложкой: название, автор, отступы карточки
  const room = window.innerHeight - top - below - 16;
  if (room < BOOK_MIN_H) { card.classList.add('book-row'); return; }
  const h = Math.min(room, inner * 1.5);
  img.style.height = h + 'px';
  img.style.width = Math.round(h / 1.5) + 'px';
}
window.addEventListener('resize', () => { clearTimeout(fitBookCover._t); fitBookCover._t = setTimeout(fitBookCover, 150); });

function openBookForm(leaderId) {
  const cur = curBook();
  const lid = leaderId || (cur && cur.leader_id) || ((state.leaders || [])[0] || {}).id || '';
  const b = (state.books || []).find(x => x.leader_id === lid) || {};
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Книга от руководителя</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Кто советует</label><select id="fBookLeader" onchange="closeModal();openBookForm(this.value)">${(state.leaders || []).map(l => `<option value="${escapeHtml(l.id)}"${l.id === lid ? ' selected' : ''}>${escapeHtml(l.name)}${l.position ? ' — ' + escapeHtml(l.position) : ''}${l.book_title ? ' · есть книга' : ''}</option>`).join('')}</select></div>
        <div class="field"><label>Название</label><input id="fBookTitle" type="text" value="${escapeHtml(b.title || '')}"></div>
        <div class="field"><label>Автор</label><input id="fBookAuthor" type="text" value="${escapeHtml(b.author || '')}"></div>
        <div class="field"><label>Почему советует эту книгу</label><textarea id="fBookNote">${escapeHtml(b.note || '')}</textarea></div>
        <div class="field"><label>Обложка</label>
          <input id="fBookCover" type="file" accept="image/*" onchange="previewImage(this,'bookPreview')">
          <img id="bookPreview" class="preview-thumb" ${b.cover ? `src="${escapeHtml(b.cover)}"` : 'style="display:none;"'}>
        </div>
      </div>
      <div class="modal-foot">
        ${b.title ? `<button class="btn text" onclick="removeBook(${jsArg(lid)})">Снять книгу</button>` : ''}
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="bookSave" onclick="saveBook()">Сохранить</button>
      </div>
    </div>`);
}
async function saveBook() {
  const title = document.getElementById('fBookTitle').value.trim();
  if (!title) return showToast('Укажите название книги');
  const btn = document.getElementById('bookSave'); btn.disabled = true;
  const input = document.getElementById('fBookCover');
  const lid = document.getElementById('fBookLeader').value;
  let cover = ((state.books || []).find(x => x.leader_id === lid) || {}).cover || '';
  if (input.files[0]) cover = await uploadFile(input) || cover;
  const r = await fetch('/api/hr/book', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leader_id: lid, title, author: document.getElementById('fBookAuthor').value.trim(),
      note: document.getElementById('fBookNote').value.trim(), cover }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; return showToast(res.error || 'Не удалось сохранить'); }
  state.books = res; state.bookIdx = Math.max(0, res.findIndex(x => x.leader_id === lid)); closeModal(); render(); showToast('Книга обновлена');
}
async function removeBook(lid) {
  const r = await fetch('/api/hr/book', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leader_id: lid }) });
  if (!r.ok) return showToast('Не удалось снять книгу');
  state.books = await r.json().catch(() => []); state.bookIdx = 0; closeModal(); render();
}

// «Мои заявки» в правой колонке — только то, что ещё в пути. Выполненная (выплачено, выдано, готово) и отменённая
// заявка из блока уходит сразу (слова пользователя 06.10.2026: «статус выплачено — думаю, заявка должна пропадать,
// зачем показывать, что она выплачена»); вся история остаётся в разделе «Заявки». Отклонённая висит три дня и
// пропадает (его слова в тот же день: «если заявка отклонена, пусть она висит 3 дня, потом пропадает»).
function myRequestsWidgetHtml() {
  if (!state.user) return '';
  const REJECTED_SHOWN_DAYS = 3;
  // время заявок сервер пишет без пояса, поэтому сравниваем как даты, а не как строки
  const fresh = r => Date.now() - new Date(r.updated || r.created).getTime() < REJECTED_SHOWN_DAYS * 86400000;
  const shown = r => !['done', 'cancelled'].includes(r.status) && (r.status !== 'rejected' || fresh(r));
  const mine = (state.requests || [])
    .filter(r => r.user_id === state.user.id && shown(r))
    .sort((a, b) => (a.status === 'rejected') - (b.status === 'rejected') || (b.updated || '').localeCompare(a.updated || ''))
    .slice(0, 2);   // компактно — чтобы книга месяца под заявками влезала без прокрутки
  return `
    <div class="widget-card widget-myreq compact">
      <div class="widget-title">Мои заявки</div>
      ${mine.length ? mine.map(r => {
        const [sl, sc] = reqStatus(r), k = reqKind(r);
        return `
        <div class="widget-req widget-link" onclick="openRequest('${r.id}')" role="button">
          <div class="widget-req-top"><i class="widget-row-icon">${ico(k.icon)}</i><span class="widget-req-title">${escapeHtml(k.rowTitle(r.data || {}))}</span></div>
          <div class="widget-req-bottom"><span class="req-status ${sc}">${sl}</span>${r.hr_comment ? '<span class="widget-req-note">есть ответ</span>' : ''}</div>
        </div>`; }).join('')
      : '<div class="widget-empty">Активных заявок нет</div>'}
      <a class="widget-more" href="#" onclick="goToView('requests');return false;">Подать заявку →</a>
    </div>`;
}

// =========================================================
// NEWS
// =========================================================
// «Новости» — только лента. Ивенты с фотографиями живут в «Медиа → Прошедшие ивенты» (перенесены 21.09.2026).
state.newsTab = state.newsTab || 'news';

function renderNews(main) {
  syncNavMenu();
  let items = state.news.slice();
  if (state.search) {
    items = items.filter(n => n.title.toLowerCase().includes(state.search) || n.body.toLowerCase().includes(state.search));
  }
  let html = `
    <div class="section-head">
      <div><div class="section-title">Новости</div></div>
      ${canEditNews() ? '<button class="btn" onclick="openNewsForm()">Опубликовать новость</button>' : ''}
    </div>`;

  if (!items.length) {
    html += `<div class="empty"><strong>Пока нет новостей</strong></div>`;
    main.innerHTML = html;
    return;
  }

  html += `<div class="news-list">` + items.map(n => newsCardHtml(n)).join('') + `</div>`;
  main.innerHTML = html;
}

// =========================================================
// ГЛАВНАЯ — открывается по клику на логотип
// =========================================================
function goHome() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  state.view = 'home';
  state.search = '';
  render();
  window.scrollTo({ top: 0 });
}

function renderHome(main) {
  syncNavMenu();
  // Новости живут только в разделе «Новости», сотрудник месяца — только на «Доске почёта».
  main.innerHTML = announcementHtml() + heroHtml() + statsHtml();
}

// плавный набег цифр и полосок при показе главной
function animateNumbers(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count) || 0;
    const t0 = Date.now(), dur = 900;
    // таймер, а не requestAnimationFrame: работает и в фоновой вкладке, финальное значение гарантировано
    const timer = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k >= 1) { el.textContent = target; clearInterval(timer); }
    }, 30);
  });
  root.querySelectorAll('.stats-fill[data-width]').forEach(el => {
    el.style.width = '0%';
    setTimeout(() => { el.style.width = el.dataset.width + '%'; }, 60);
  });
}

// быстрые ссылки на главной (заглушки — адреса подставим, когда дашь)
const QUICK_LINKS = [
  { icon: 'chat', title: 'Telegram-чат', sub: 'общий чат компании', href: '#', soon: true },
  { icon: 'mail', title: 'Почта', sub: 'корпоративная почта', href: '#', soon: true },
  { icon: 'key', title: 'Elpass', sub: 'пропуск и турникет', href: '#', soon: true },
  { icon: 'globe', title: 'connectedhome.kz', sub: 'сайт компании', href: 'https://connectedhome.kz', soon: false },
];
function quickLinksHtml() {
  return `
    <div class="quick-links">
      ${QUICK_LINKS.map(l => `
        <a class="quick-link${l.soon ? ' soon' : ''}" href="${l.href}" ${l.soon ? 'onclick="showToast(\'Ссылку добавим — скажите адрес\');return false;"' : 'target="_blank" rel="noopener"'}>
          <span class="quick-ico">${ico(l.icon)}</span>
          <span class="quick-text"><b>${l.title}</b><small>${l.sub}</small></span>
        </a>`).join('')}
    </div>`;
}

// доска почёта: сотрудник месяца
function honorsHtml() {
  const h = (state.honors || [])[0];
  if (!h) {
    return `
      <div class="honor honor-empty" onclick="openHonorForm()" role="button">
        <div class="honor-mark">${ico('trophy')}</div>
        <div><div class="honor-title">Доска почёта</div><div class="honor-sub">Назначьте сотрудника месяца — он появится здесь с фото и словами благодарности</div></div>
        <button class="btn" onclick="event.stopPropagation();openHonorForm()">Назначить</button>
      </div>`;
  }
  const p = state.employees.find(e => e.name === h.name) || { name: h.name };
  return `
    <div class="honor">
      <div class="honor-mark">${ico('trophy')}</div>
      ${p.photo ? `<img class="honor-photo" src="${escapeHtml(p.photo)}" alt="">` : `<div class="org-ava big honor-ava" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`}
      <div class="honor-text">
        <div class="honor-label">Сотрудник месяца${h.period ? ` · ${escapeHtml(h.period)}` : ''}</div>
        <div class="honor-name">${escapeHtml(p.name)}</div>
        ${p.position ? `<div class="honor-pos">${escapeHtml(p.position)}${p.department ? ' · ' + escapeHtml(p.department) : ''}</div>` : ''}
        ${h.reason ? `<div class="honor-reason">${escapeHtml(h.reason)}</div>` : ''}
      </div>
      <div class="honor-actions">
        <button class="btn secondary" onclick="openHonorForm()">Назначить другого</button>
        <button class="btn text" onclick="deleteItem('honors','${h.id}')">Убрать</button>
      </div>
    </div>`;
}
function openHonorForm() {
  const now = new Date();
  const period = MONTHS_RU[now.getMonth()] + ' ' + now.getFullYear();
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Сотрудник месяца</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Сотрудник</label>
          <input id="fHonName" list="honorList" type="text" placeholder="Начните вводить фамилию">
          <datalist id="honorList">${state.employees.map(e => `<option value="${escapeHtml(e.name)}">`).join('')}</datalist>
        </div>
        <div class="field"><label>Период</label><input id="fHonPeriod" type="text" value="${period}"></div>
        <div class="field"><label>За что (необязательно)</label><textarea id="fHonReason"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitHonor()">Назначить</button>
      </div>
    </div>`);
}
async function submitHonor() {
  const name = document.getElementById('fHonName').value.trim();
  if (!name) { showToast('Выберите сотрудника'); return; }
  const item = await fetchJson('/api/honors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, period: document.getElementById('fHonPeriod').value.trim(), reason: document.getElementById('fHonReason').value.trim() }),
  });
  closeModal();
  if (item) { state.honors.unshift(item); showToast('Назначено'); } else showToast('Не удалось сохранить');
  render();
}

// выгрузка сотрудников в Excel (CSV с BOM — Excel открывает кириллицу правильно)
function exportEmployees() {
  const cols = [['ФИО', 'name'], ['Должность', 'position'], ['Подразделение', 'department'], ['Отдел', 'unit'],
    ['Руководитель', 'reports_to'], ['Почта', 'email'], ['Телефон', 'phone'], ['Telegram', 'telegram'], ['График', 'schedule']];
  const esc = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  const rows = [cols.map(c => esc(c[0])).join(';')]
    .concat(state.employees.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map(e => cols.map(c => esc(e[c[1]])).join(';')));
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Сотрудники Connected Home ${isoDate(new Date())}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  showToast('Файл скачан — откройте в Excel');
}

// =========================================================
// ГЛОБАЛЬНЫЙ ПОИСК (лупа в шапке, Ctrl+K)
// =========================================================
function openSearch() {
  if (document.getElementById('searchOverlay')) return;
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'searchOverlay';
  wrap.innerHTML = `
    <div class="search-box">
      <div class="search-input-row">
        <span class="search-ico">${ico('search')}</span>
        <input id="searchInput" type="text" placeholder="Сотрудник, проект, новость, вопрос…" autocomplete="off">
        <span class="search-kbd">Esc</span>
      </div>
      <div class="search-results" id="searchResults">
        
      </div>
    </div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if (!document.getElementById('modalOverlay')) document.body.classList.remove('modal-open'); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  const input = document.getElementById('searchInput');
  input.addEventListener('input', () => renderSearchResults(input.value));
  input.focus();
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
});

function renderSearchResults(q) {
  const box = document.getElementById('searchResults');
  q = (q || '').trim().toLowerCase();
  if (q.length < 2) { box.innerHTML = '<div class="search-hint">Введите хотя бы две буквы</div>'; return; }
  const has = (...vals) => vals.some(v => (v || '').toLowerCase().includes(q));
  const groups = [];
  const emp = state.employees.filter(p => has(p.name, p.position, p.department, p.unit, p.email, p.phone, profileText(p.profile))).slice(0, 6);
  if (emp.length) groups.push({ title: 'Сотрудники', items: emp.map(p => ({
    icon: `<div class="org-ava" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`,
    title: p.name, sub: [p.position, p.department].filter(Boolean).join(' · '),
    go: `closeSearch();openEmployeeCard('${p.id}')` })) });
  const pr = state.projects.filter(p => has(p.title, p.client, p.description)).slice(0, 4);
  if (pr.length) groups.push({ title: 'Проекты', items: pr.map(p => ({ icon: ico('layers'), title: p.title, sub: p.client || '', go: `closeSearch();goToView('projects')` })) });
  const nw = state.news.filter(n => has(n.title, n.body)).slice(0, 4);
  if (nw.length) groups.push({ title: 'Новости', items: nw.map(n => ({ icon: ico('news'), title: n.title, sub: fmtDate(n.date), go: `closeSearch();state.newsTab='news';goToView('news')` })) });
  const gl = state.gallery.filter(g => has(g.title, g.description)).slice(0, 4);
  if (gl.length) groups.push({ title: 'Ивенты', items: gl.map(g => ({ icon: ico('camera'), title: g.title, sub: g.date ? fmtDate(g.date) : '', go: `closeSearch();goToView('gallery_page')` })) });
  const ev = state.events.filter(e => has(e.title, e.description)).slice(0, 4);
  if (ev.length) groups.push({ title: 'Календарь', items: ev.map(e => ({ icon: ico('calendar'), title: e.title, sub: fmtDate(e.date), go: `closeSearch();state.cal={y:${new Date(e.date).getFullYear()},m:${new Date(e.date).getMonth()}};goToView('events')` })) });
  const fq = state.faq.filter(f => has(f.question, f.answer)).slice(0, 4);
  if (fq.length) groups.push({ title: 'Частые вопросы', items: fq.map(f => ({ icon: ico('help'), title: f.question, sub: f.answer.slice(0, 90) + (f.answer.length > 90 ? '…' : ''), go: `closeSearch();openFaq()` })) });

  if (!groups.length) {
    box.innerHTML = `<div class="search-hint">Ничего не нашлось. <a href="#" onclick="closeSearch();goToAiBot(${jsArg(q)});return false;">Спросить Connect AI →</a></div>`;
    return;
  }
  box.innerHTML = groups.map(g => `
    <div class="search-group">${g.title}</div>
    ${g.items.map(i => `
      <div class="search-item" onclick="${i.go}">
        <div class="search-item-ico">${i.icon}</div>
        <div class="search-item-text"><div class="search-item-title">${escapeHtml(i.title)}</div>${i.sub ? `<div class="search-item-sub">${escapeHtml(i.sub)}</div>` : ''}</div>
      </div>`).join('')}`).join('');
}
function closeSearch() { const w = document.getElementById('searchOverlay'); if (w) w.remove(); }

// карточка сотрудника: кто, где, кому подчиняется, как связаться
function openEmployeeCard(id) {
  const p = state.employees.find(e => e.id === id);
  if (!p) return;
  const team = state.employees.filter(e => (e.reports_to || '').trim() === p.name);
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Сотрудник</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body emp-card">
        <div class="emp-top">
          ${p.photo ? `<img class="emp-photo zoomable" src="${escapeHtml(p.photo)}" alt="" title="Нажмите, чтобы увеличить"
                            onclick="openLightbox(${jsArg(p.photo)})">`
                    : `<div class="emp-photo-fallback" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`}
          <div class="emp-top-text">
            <div class="emp-name">${escapeHtml(p.name)}</div>
            <div class="emp-pos">${escapeHtml(p.position || '')}</div>
            ${p.department ? `<div class="emp-dep">${escapeHtml(p.department)}</div>` : ''}
          </div>
        </div>
        <div class="emp-rows">
          ${p.department ? `<div class="emp-row"><span>Подразделение</span><b>${escapeHtml(p.department)}</b></div>` : ''}
          ${p.unit ? `<div class="emp-row"><span>Отдел</span><b>${escapeHtml(p.unit)}</b></div>` : ''}
          ${p.reports_to ? `<div class="emp-row"><span>Руководитель</span><b>${escapeHtml(p.reports_to)}</b></div>` : ''}
          ${team.length ? `<div class="emp-row"><span>В команде</span><b>${team.length} ${pluralRu(team.length, 'человек', 'человека', 'человек')}</b></div>` : ''}
          ${p.schedule ? `<div class="emp-row"><span>График</span><b>${escapeHtml(p.schedule)}</b></div>` : ''}
          ${p.office ? `<div class="emp-row"><span>Офис</span><b>${escapeHtml(p.office)}${p.seat ? ' · место ' + escapeHtml(p.seat) : ''}</b></div>` : ''}
          ${Number(p.remote) ? `<div class="emp-row"><span>Формат работы</span><b>Удалённо</b></div>` : ''}
          ${p.birthday ? `<div class="emp-row"><span>День рождения</span><b>${fmtShortDate(p.birthday)}</b></div>` : ''}
          ${p.email ? `<div class="emp-row"><span>Почта</span><b><a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></b></div>` : ''}
          ${p.phone ? `<div class="emp-row"><span>Телефон</span><b><a href="tel:${escapeHtml(p.phone.replace(/[^+\d]/g, ''))}">${escapeHtml(p.phone)}</a></b></div>` : ''}
          ${p.telegram ? `<div class="emp-row"><span>Telegram</span><b><a class="tg-link" href="https://t.me/${escapeHtml(p.telegram)}" target="_blank" rel="noopener" title="Написать в Telegram">@${escapeHtml(p.telegram)}</a></b></div>` : ''}
          ${p.hired ? `<div class="emp-row"><span>В компании с</span><b>${fmtDate(p.hired)}${tenureText(p.hired) ? ' · ' + tenureText(p.hired) : ''}</b></div>` : ''}
        </div>
        ${p.profile && p.profile.visible === false ? '<div class="profile-hidden" style="margin-top:10px;">Профиль скрыт от коллег — видят только HR и администратор</div>' : ''}
        ${profileBlockHtml(p.profile)}
      </div>
      <div class="modal-foot">
        ${p.profile ? `<button class="btn text" onclick="clearProfile(${jsArg(p.id)})">Очистить профиль</button>` : ''}
        <button class="btn text" onclick="closeModal();openHrFill(${jsArg(p.id)})">Заполнить карточку</button>
        <button class="btn secondary" onclick="closeModal();state.orgCollapsed=null;goToView('org')">Открыть в Community Road Map</button>
        <button class="btn" onclick="closeModal()">Закрыть</button>
      </div>
    </div>`);
}

// ---------- профиль «О себе» (07.10.2026): заполняет сам сотрудник, видно в карточке, поиске и у Connect AI ----------
const PROFILE_LABELS = { about: 'О себе', edu: 'Образование', hobbies: 'Хобби и интересы', skills: 'Чем могу помочь', languages: 'Языки',
  hometown: 'Родной город', fav_book: 'Любимая книга', fav_film: 'Любимый фильм', fav_music: 'Любимая музыка' };
function profileText(p) {
  if (!p) return '';
  return [p.about, p.edu_school, p.edu_major, p.hometown, p.fav_book, p.fav_film, p.fav_music, ...(p.hobbies || []), ...(p.skills || []), ...(p.languages || [])].filter(Boolean).join(' ').toLowerCase();
}
function tenureText(hired) {
  if (!hired) return '';
  const d = new Date(hired), now = astanaNow();      // обе даты читаем как UTC — иначе в другом поясе день сползёт
  if (isNaN(d)) return '';
  let months = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth());
  if (now.getUTCDate() < d.getUTCDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12), m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${pluralRu(y, 'год', 'года', 'лет')}`);
  if (m || !y) parts.push(`${m} ${pluralRu(m, 'месяц', 'месяца', 'месяцев')}`);
  return parts.join(' ');
}
function profileBlockHtml(p, noAboutLabel) {
  if (!p) return '';
  const tags = list => (list || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const edu = [p.edu_school, p.edu_major, p.edu_year].filter(Boolean).join(', ');
  const favs = [['fav_book', p.fav_book], ['fav_film', p.fav_film], ['fav_music', p.fav_music]].filter(x => x[1]);
  return `
    <div class="emp-profile no-tr">
      ${p.about ? `<div class="emp-profile-row">${noAboutLabel ? '' : `<span>${PROFILE_LABELS.about}</span>`}<div class="emp-profile-text">${escapeHtml(p.about)}</div></div>` : ''}
      ${edu ? `<div class="emp-profile-row"><span>${PROFILE_LABELS.edu}</span><div>${escapeHtml(edu)}</div></div>` : ''}
      ${p.hometown ? `<div class="emp-profile-row"><span>${PROFILE_LABELS.hometown}</span><div>${escapeHtml(p.hometown)}</div></div>` : ''}
      ${(p.skills || []).length ? `<div class="emp-profile-row"><span>${PROFILE_LABELS.skills}</span><div class="tag-list">${tags(p.skills)}</div></div>` : ''}
      ${(p.hobbies || []).length ? `<div class="emp-profile-row"><span>${PROFILE_LABELS.hobbies}</span><div class="tag-list">${tags(p.hobbies)}</div></div>` : ''}
      ${(p.languages || []).length ? `<div class="emp-profile-row"><span>${PROFILE_LABELS.languages}</span><div class="tag-list">${tags(p.languages)}</div></div>` : ''}
      ${favs.map(([k, v]) => `<div class="emp-profile-row"><span>${PROFILE_LABELS[k]}</span><div>${escapeHtml(v)}</div></div>`).join('')}
    </div>`;
}
function allProfileTags(key) {
  const set = new Set();
  state.employees.forEach(e => ((e.profile || {})[key] || []).forEach(t => set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}
function openProfileForm() {
  const p = state.myProfile || {};
  const f = (id, label, val, extra = '') => `<div class="field"><label>${label}</label><input id="${id}" type="text" value="${escapeHtml(val || '')}" ${extra}></div>`;
  const tagsField = (id, label, key) => `<div class="field"><label>${label} — через запятую</label>
      <input id="${id}" type="text" list="${id}List" value="${escapeHtml((p[key] || []).join(', '))}">
      <datalist id="${id}List">${allProfileTags(key).map(t => `<option value="${escapeHtml(t)}">`).join('')}</datalist></div>`;
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>О себе</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>${PROFILE_LABELS.about}</label><textarea id="pfAbout" style="min-height:90px;" maxlength="1000">${escapeHtml(p.about || '')}</textarea></div>
        <div class="field-row three">
          ${f('pfSchool', 'Вуз', p.edu_school, 'maxlength="200"')}
          ${f('pfMajor', 'Специальность', p.edu_major, 'maxlength="200"')}
          ${f('pfYear', 'Год выпуска', p.edu_year, 'inputmode="numeric" maxlength="4"')}
        </div>
        ${tagsField('pfSkills', PROFILE_LABELS.skills, 'skills')}
        ${tagsField('pfHobbies', PROFILE_LABELS.hobbies, 'hobbies')}
        ${tagsField('pfLanguages', PROFILE_LABELS.languages, 'languages')}
        ${f('pfHometown', PROFILE_LABELS.hometown, p.hometown, 'maxlength="100"')}
        <div class="field-row three">
          ${f('pfBook', PROFILE_LABELS.fav_book, p.fav_book, 'maxlength="200"')}
          ${f('pfFilm', PROFILE_LABELS.fav_film, p.fav_film, 'maxlength="200"')}
          ${f('pfMusic', PROFILE_LABELS.fav_music, p.fav_music, 'maxlength="200"')}
        </div>
        <div class="field"><label class="hf-remote"><input id="pfVisible" type="checkbox" ${p.visible === false ? '' : 'checked'}> Показывать профиль коллегам</label></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitProfile()">Сохранить</button>
      </div>
    </div>`);
}
async function submitProfile() {
  const v = id => document.getElementById(id).value.trim();
  const body = { about: v('pfAbout'), edu_school: v('pfSchool'), edu_major: v('pfMajor'), edu_year: v('pfYear'),
    skills: v('pfSkills'), hobbies: v('pfHobbies'), languages: v('pfLanguages'), hometown: v('pfHometown'),
    fav_book: v('pfBook'), fav_film: v('pfFilm'), fav_music: v('pfMusic'), visible: document.getElementById('pfVisible').checked };
  const res = await fetchJson('/api/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  closeModal();
  if (!res) { showToast('Не удалось сохранить'); return; }
  state.myProfile = res.profile;
  const emp = state.employees.find(e => e.id === res.employee_id);
  if (emp) emp.profile = res.profile;
  showToast('Сохранено');
  render();
}
async function clearProfile(employeeId) {
  if (!confirm('Очистить профиль «О себе» этого сотрудника?')) return;
  const res = await fetchJson('/api/profiles/' + encodeURIComponent(employeeId), { method: 'DELETE' });
  if (!res) { showToast('Не удалось очистить'); return; }
  const emp = state.employees.find(e => e.id === employeeId);
  if (emp) delete emp.profile;
  closeModal(); showToast('Профиль очищен'); render();
}

// ---------- Connected WorkFlow (08.10.2026) ----------
// PM или аналитик пишет приёмщику, что изменить на портале; приёмщик уточняет и собирает карточку задания; в работу
// отправляет сам человек кнопкой. Задания видны всем допущенным, принимает только админ (его решение: «ты, одной кнопкой»).
const cw = { messages: [], draft: '', loading: false, tasks: null, materials: null, projects: null, project: '', taskFilter: '' };
// проекты (08.10.2026, слова пользователя: «правки будут делать не только для Community — все наши проекты»): выбранный
// проект запоминается в браузере; описание проекта уходит приёмщику вместе с просьбой
function cwProjects() { return cw.projects || []; }
function cwProject(key) { return cwProjects().find(p => p.key === (key || cw.project)) || null; }
function cwProjectName(key) { const p = cwProject(key); return p ? p.name : ''; }
function cwSetProject(key) { if (cw.project !== key) { cw.messages = []; cw.draft = ''; } cw.project = key; try { localStorage.setItem('cw_project', key); } catch (e) { /* приватный режим */ } }
// провалиться в проект: адрес #cowork/<ключ>.<вкладка>
function cwEnter(key, tab) { cwSetProject(key); state.coworkTab = key + '.' + (tab || 'chat'); render(); }
function cwGo(tab) { state.coworkTab = cw.project ? cw.project + '.' + tab : tab; render(); }
function cwProjectChip(key) { const p = cwProject(key); return p ? `<span class="cw-proj-chip">${escapeHtml(p.name)}</span>` : ''; }
const CW_STATUS = { queued: ['В очереди', 'queued'], running: ['В работе', 'running'], review: ['Ждёт приёмки', 'review'],
  accepted: ['Принято', 'accepted'], rejected: ['Отклонено', 'rejected'], failed: ['Не удалось', 'failed'], cancelled: ['Отменено', 'cancelled'] };
function canCowork() { return !!state.user; }   // пункт виден всем вошедшим; внутри — свой вход (08.10.2026)
function cwLoggedIn() { return !!(state.user && (state.user.role === 'admin' || state.user.cw_login)); }
function cwStatus(t) { const s = CW_STATUS[t.status] || [t.status, '']; return `<span class="req-status cw-status ${s[1]}">${s[0]}</span>`; }

const CW_TABS = [['chat', 'Чат-агент'], ['tasks', 'Мои задания'], ['notes', 'Замечания'], ['materials', 'Материалы'], ['settings', 'Настройки']];
const CW_NAV = [['chat', 'Чат-агент', 'chat'], ['tasks', 'Задания', 'check'], ['notes', 'Замечания', 'edit'], ['materials', 'Материалы', 'book']];
const CW_SET = [['ai', 'AI-провайдеры', 'Модели и учётки агентов'], ['services', 'Рабочие сервисы', 'Трекеры и базы знаний'], ['git', 'Доступ к Git', 'Репозитории и ключи'],
  ['notify', 'Уведомления', 'Telegram и отчёты'], ['dialogs', 'Мои диалоги', 'Разбор общения с агентом'], ['security', 'Безопасность', 'Защита, ключи и журнал']];
async function renderCowork(main) {
  if (!(state.user && (state.user.role === 'admin' || state.user.cowork_allowed))) { main.innerHTML = cwDeniedHtml(); return; }   // 08.10.2026: права только у админа и допущенных
  if (!cwLoggedIn()) { main.innerHTML = cwLoginHtml(); return; }
  if (state.user.cw_must_change) { main.innerHTML = cwPasswordHtml(true); return; }
  if (cw.tasks === null || Date.now() - (cw.loadedAt || 0) > 20000) {
    if (cw.tasks === null) main.innerHTML = '<div class="empty"><strong>Загрузка…</strong></div>';
    const [fresh, projects] = await Promise.all([fetchJson('/api/cowork/tasks'), fetchJson('/api/cowork/projects')]);
    if (fresh) { cw.tasks = fresh; cw.loadedAt = Date.now(); } else cw.tasks = cw.tasks || [];
    if (projects) cw.projects = projects;
    if (state.view !== 'cowork') return;
  }
  // адрес: projects | settings | <ключ проекта>.<chat|tasks|notes|materials|task-<id>>; старые #cowork/chat и #cowork/task-<id> — в последний проект
  let raw = state.coworkTab || 'projects', tab = raw, openId = null;
  if (raw.includes('.')) { const [pk, t] = raw.split('.', 2); if (cwProject(pk)) { cwSetProject(pk); tab = t || 'chat'; } else tab = 'projects'; }
  else if (raw !== 'projects' && raw !== 'settings' && raw !== 'agents') {
    let pk = cw.project; try { pk = pk || localStorage.getItem('cw_project') || ''; } catch (e) { /* приватный режим */ }
    const t = cw.tasks.find(x => x.id === raw || 'task-' + x.id === raw);
    if (t) pk = t.project;
    if (cwProject(pk)) { cwSetProject(pk); tab = t ? 'task-' + t.id : raw; } else tab = 'projects';
  }
  if (tab.startsWith('task-')) { openId = tab.slice(5); tab = 'tasks'; }
  const inProject = tab !== 'projects' && tab !== 'settings' && tab !== 'agents' && !!cwProject();
  if (tab === 'settings' && !isAdmin()) tab = 'projects';
  if (!inProject && tab !== 'settings' && tab !== 'agents') tab = 'projects';
  if (inProject && !CW_NAV.some(x => x[0] === tab)) tab = 'chat';
  state.coworkTab = ['projects', 'settings', 'agents'].includes(tab) ? tab : cw.project + '.' + (openId ? 'task-' + openId : tab);
  const u = state.user || {}, pr = inProject ? cwProject() : null;
  const navItem = (k, name, icon, go) => `<a class="cw-nav${k === tab ? ' active' : ''}" href="#" onclick="${go};return false;">${ico(icon)}<span>${name}</span>${k === 'tasks' && isAdmin() ? cwReviewCount() : ''}</a>`;
  const titles = { chat: 'Чат-агент', tasks: openId ? 'Задание' : 'Задания', projects: 'Проекты', agents: 'Агенты', notes: 'Замечания', materials: 'Материалы', settings: 'Настройки' };
  const crumbs = (tab === 'settings' ? 'Управление' : pr ? pr.name : 'Планирование') + (pr || !inProject ? ' · ' + titles[tab] : '');
  let body = '';
  if (openId) {
    const t = cw.tasks.find(x => x.id === openId);
    body = t ? coworkTaskHtml(t) : '<div class="empty"><strong>Задание не найдено</strong></div>';
  } else if (tab === 'chat') body = cwChatHtml();
  else if (tab === 'tasks') body = coworkListHtml();
  else if (tab === 'agents') body = cwAgentsHtml();
  else if (tab === 'projects') { body = cwProjectsHtml(); if (isAdmin() && !cw.settings) fetchJson('/api/cowork/settings').then(x => { if (x) { cw.settings = x; cw.settingsAt = Date.now(); } }); }
  else if (tab === 'notes') body = '<div id="cwNotesAll" class="empty"><strong>Загрузка…</strong></div>';
  else if (tab === 'materials') body = '<div id="cwMaterials" class="empty"><strong>Загрузка…</strong></div>';
  else if (tab === 'settings') body = cwSettingsShell();
  main.innerHTML = `
    <div class="cw-shell">
      <aside class="cw-side">
        <div class="cw-brand"><span class="cw-brand-mark">W</span><div><b>Connected WorkFlow</b><small>рабочая среда</small></div></div>
        ${pr ? `<a class="cw-nav cw-nav-back" href="#" onclick="state.coworkTab='projects';render();return false;">${ico('arrowLeft')}<span>Все проекты</span></a>
        <div class="cw-proj-head"><div class="cw-proj-mark">${ico('layers')}</div><div class="cw-user-text"><b>${escapeHtml(pr.name)}</b><small>${escapeHtml(pr.short || '')}</small></div></div>
        <div class="cw-group">Планирование</div>
        ${CW_NAV.map(([k, name, icon]) => navItem(k, name, icon, `cwGo(${jsArg(k)})`)).join('')}`
        : `<div class="cw-group">Планирование</div>${navItem('projects', 'Проекты', 'layers', "state.coworkTab='projects';render()")}${navItem('agents', 'Агенты', 'users', "state.coworkTab='agents';render()")}`}
        ${isAdmin() ? `<div class="cw-group">Управление</div>${navItem('settings', 'Настройки', 'settings', "state.coworkTab='settings';render()")}` : ''}
        ${u.cw_login ? `<a class="cw-nav" href="#" onclick="cwLogout();return false;">${ico('lock')}<span>Выйти из WorkFlow</span></a>` : ''}
        <a class="cw-nav cw-exit" href="#home" onclick="goToView('home');return false;">${ico('home')}<span>На портал</span></a>
        <div class="cw-user">
          <div class="org-ava" style="--h:${hueOf(u.name || '')}">${initials(u.name || '')}</div>
          <div class="cw-user-text"><b>${escapeHtml(u.name || '')}</b><small>${escapeHtml(u.cw_login || u.login || '')}</small></div>
        </div>
      </aside>
      <div class="cw-body">
        <div class="cw-top">
          <div>
            <div class="cw-crumbs">${escapeHtml(crumbs)} · ${fmtShortDate(new Date().toISOString())}</div>
            <h1 class="cw-h1">${pr && !openId && tab === 'chat' ? escapeHtml(pr.name) : titles[tab]}</h1>
          </div>
          <button class="btn secondary cw-onb-btn" onclick="cwOnboarding(0)">${ico('bulb')} Первичная настройка</button>
        </div>
        <div class="cw-content">${body}</div>
      </div>
    </div>`;
  if (openId) { const t = cw.tasks.find(x => x.id === openId); if (t) { cwLoadNotes(t.id); cwWatch(t); } }
  else if (tab === 'chat') { cwPaint(); const i = document.getElementById('cwInput'); if (i) { i.value = cw.draft; } }
  else if (tab === 'notes') cwRenderNotesAll();
  else if (tab === 'materials') cwRenderMaterials();
  else if (tab === 'settings') cwRenderSettings();
  else if (tab === 'agents') cwRenderAgents();
  if (!cwOnbDone()) { try { localStorage.setItem('cw_onboarding', 'done'); } catch (e) { /* приватный режим */ } cwOnboarding(0, true); }
}
// задание в работе или в очереди — карточка сама обновляется раз в 15 секунд
function cwWatch(t) {
  clearTimeout(cw.watchTimer);
  if (!['queued', 'running'].includes(t.status)) return;
  cw.watchTimer = setTimeout(async () => {
    if (state.view !== 'cowork' || !(state.coworkTab || '').endsWith('task-' + t.id)) return;
    const fresh = await fetchJson('/api/cowork/tasks');
    if (fresh) { cw.tasks = fresh; cw.loadedAt = Date.now(); }
    const nt = (cw.tasks || []).find(x => x.id === t.id);
    if (nt && nt.status !== t.status) render(); else if (nt) cwWatch(nt);
  }, 15000);
}
function cwReviewCount() { const n = (cw.tasks || []).filter(t => t.status === 'review' && t.project === cw.project).length; return n ? ` <span class="subtab-count">${n}</span>` : ''; }
function cwOpenTask(id) { const t = (cw.tasks || []).find(x => x.id === id); if (t && t.project !== cw.project && cwProject(t.project)) cwSetProject(t.project); state.coworkTab = cw.project + '.task-' + id; render(); }

function coworkListHtml() {
  const list = (cw.tasks || []).filter(t => t.project === cw.project);
  const rows = list.map(t => `
    <div class="req-row" onclick="cwOpenTask(${jsArg(t.id)})">
      <div class="req-row-mark">${ico('activity')}</div>
      <div class="req-row-main">
        <div class="req-row-title">${escapeHtml(t.title)}</div>
        <div class="req-row-sub">${escapeHtml(t.author_name || '')} · ${fmtShortDate(t.created)}${t.spec && t.spec.section ? ' · ' + escapeHtml(t.spec.section) : ''}</div>
      </div>
      ${cwStatus(t)}
    </div>`).join('');
  return `<div class="cw-list no-tr">${rows || '<div class="empty"><strong>Заданий пока нет</strong></div>'}</div>`;
}

// справочник агентов WorkFlow (08.10.2026, слова пользователя: «надо, чтобы были в справочнике на WorkFlow», а не среди
// сотрудников портала). Должности — по-английски, как у «Технологий». Состояние считается по настройкам исполнителя.
const CW_AGENTS = [
  ['Connect Intake', 'AI Intake Agent', 'Приёмщик заданий', 'Уточняет просьбу в чате и собирает карточку задания: раздел, что сделать, кто увидит, как проверить.', 'intake'],
  ['Connect Developer', 'AI Developer Agent', 'Разработчик', 'Берёт задание из очереди, правит код проекта в своей копии, прогоняет проверки и открывает merge request.', 'executor'],
  ['Connect Reviewer', 'AI Code Reviewer', 'Проверяющий', 'Сверяет правку с правилами проекта до того, как её увидит владелец.', 'soon'],
  ['Connect QA', 'AI QA Engineer', 'Тестировщик', 'Запускает проверки, открывает приложение и прикладывает снимок экрана.', 'soon'],
  ['Connect Security', 'AI Security Engineer', 'Безопасник', 'Смотрит правки, которые касаются входа, прав и личных данных.', 'soon'],
];
function cwAgentsHtml() { return '<div id="cwAgents" class="cw-proj-grid no-tr"><div class="empty"><strong>Загрузка…</strong></div></div>'; }
async function cwRenderAgents() {
  const box = document.getElementById('cwAgents');
  if (!box) return;
  if (isAdmin() && (!cw.settings || Date.now() - (cw.settingsAt || 0) > 20000)) { cw.settings = await fetchJson('/api/cowork/settings'); cw.settingsAt = Date.now(); }
  const s = cw.settings || {}, ex = s.executor || {};
  const stateOf = k => k === 'intake' ? (s.ai_key || !isAdmin() ? ['работает', 'done'] : ['нет ключа AI', 'cancelled'])
    : k === 'executor' ? (ex.alive ? ['работает', 'done'] : ex.configured ? ['не отвечает', 'queued'] : ['не подключён', 'cancelled'])
    : ['следующая итерация', 'cancelled'];
  box.innerHTML = CW_AGENTS.map(([name, title, role, about, k]) => { const [txt, cls] = stateOf(k); return `
    <div class="val-block cw-proj-card cw-agent-card">
      <div class="val-head"><div class="org-ava cw-agent-ava" style="--h:${hueOf(name)}">${initials(name)}</div>
        <div class="cw-user-text"><h3 class="cw-title">${escapeHtml(name)}</h3><small>${escapeHtml(title)}</small></div>
        <span class="req-status cw-status ${cls}">${txt}</span></div>
      <div class="cw-proj-short">${escapeHtml(role)}</div>
      <div class="emp-profile-text">${escapeHtml(about)}</div>
    </div>`; }).join('');
}

// страница «Проекты»: карточки продуктов с описанием для агента; правит админ
function cwProjectsHtml() {
  const cards = cwProjects().map(p => `
    <div class="val-block cw-proj-card no-tr" onclick="cwEnter(${jsArg(p.key)})">
      <div class="val-head"><div class="val-mark">${ico('layers')}</div><h3 class="cw-title">${escapeHtml(p.name)}</h3>
        ${cwProjBadge(p)}</div>
      ${p.short ? `<div class="cw-proj-short">${escapeHtml(p.short)}</div>` : ''}
      ${p.owner ? `<div class="emp-profile-row"><span>Отвечает</span><div>${escapeHtml(p.owner)}</div></div>` : ''}
      <div class="cw-proj-foot"><span>${p.tasks ? 'В работе: ' + p.tasks : 'Заданий нет'}</span>
        ${isAdmin() ? `<button class="btn text" onclick="event.stopPropagation();cwOpenProjectForm(${jsArg(p.key)})">Изменить</button>` : ''}
        <button class="btn" onclick="event.stopPropagation();cwEnter(${jsArg(p.key)})">Открыть</button></div>
    </div>`).join('');
  return `${isAdmin() ? `<div class="cw-proj-actions"><button class="btn secondary" onclick="cwOpenProjectForm('')">Добавить проект</button></div>` : ''}
    <div class="cw-proj-grid">${cards || '<div class="empty"><strong>Проектов пока нет</strong></div>'}</div>`;
}
// плашка готовности: агент берёт задания, только когда проект включён, есть репозиторий с токеном и исполнитель на связи
function cwProjBadge(p) {
  if (p.ready) return '<span class="req-status done">агент подключён</span>';
  if (p.status !== 'active') return '<span class="req-status cancelled">агент выключен</span>';
  if (!p.has_repo || !p.token_set) return '<span class="req-status cw-status queued">нет доступа к коду</span>';
  return '<span class="req-status cancelled">исполнитель не на связи</span>';
}
function cwOpenProjectForm(key) {
  const p = cwProject(key) && key ? cwProject(key) : { key: '', name: '', short: '', body: '', owner: '', repo: '', stack: '', status: 'soon', branch: '', rules: '', checks: '', model: '', token_set: false };
  const models = (cw.settings && cw.settings.models) || {};
  const isNew = !key;
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${isNew ? 'Новый проект' : escapeHtml(p.name)}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        ${isNew ? `<div class="field"><label>Ключ — латиницей, без пробелов</label><input id="cwpKey" type="text" autocapitalize="none" spellcheck="false" maxlength="40"></div>` : ''}
        <div class="field"><label>Название</label><input id="cwpName" type="text" value="${escapeHtml(p.name)}" maxlength="200"></div>
        <div class="field"><label>Одной строкой</label><input id="cwpShort" type="text" value="${escapeHtml(p.short || '')}" maxlength="200"></div>
        <div class="field"><label>Описание для агента</label><textarea id="cwpBody" style="min-height:160px;">${escapeHtml(p.body || '')}</textarea></div>
        <div class="field"><label>Кто отвечает</label><input id="cwpOwner" type="text" value="${escapeHtml(p.owner || '')}" maxlength="200"></div>
        <div class="field"><label>На чём написан</label><input id="cwpStack" type="text" value="${escapeHtml(p.stack || '')}" maxlength="200"></div>
        <div class="field"><label>Репозиторий — GitHub или GitLab</label><input id="cwpRepo" type="url" value="${escapeHtml(p.repo || '')}"></div>
        <div class="field"><label>Основная ветка</label><input id="cwpBranch" type="text" value="${escapeHtml(p.branch || '')}" placeholder="main" maxlength="100"></div>
        <div class="field"><label>Токен доступа${p.token_set ? ' — задан, вставьте новый, чтобы заменить' : ''}</label><input id="cwpToken" type="password" autocomplete="off" maxlength="300"></div>
        <div class="field"><label>Правила для агента</label><textarea id="cwpRules" style="min-height:140px;">${escapeHtml(p.rules || '')}</textarea></div>
        <div class="field"><label>Команда проверки после правки</label><input id="cwpChecks" type="text" value="${escapeHtml(p.checks || '')}" maxlength="200" spellcheck="false"></div>
        <div class="field"><label>Модель</label><select id="cwpModel"><option value="">Общая из настроек</option>${Object.keys(models).map(m => `<option value="${escapeHtml(m)}"${m === p.model ? ' selected' : ''}>${escapeHtml(models[m])}</option>`).join('')}</select></div>
        <div class="field"><label>Агент</label><select id="cwpStatus"><option value="soon"${p.status !== 'active' ? ' selected' : ''}>выключен — задания копятся в очереди</option><option value="active"${p.status === 'active' ? ' selected' : ''}>включён</option></select></div>
        <div class="login-error" id="cwpErr" role="alert"></div>
      </div>
      <div class="modal-foot">
        ${!isNew && key !== 'community' ? `<button class="btn text" onclick="cwDeleteProject(${jsArg(key)})">Удалить</button>` : ''}
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="cwSaveProject(${jsArg(key)})">Сохранить</button>
      </div>
    </div>`);
}
async function cwSaveProject(key) {
  const g = id => (document.getElementById(id) || { value: '' }).value.trim();
  const body = { name: g('cwpName'), short: g('cwpShort'), body: g('cwpBody'), owner: g('cwpOwner'), stack: g('cwpStack'), repo: g('cwpRepo'), status: g('cwpStatus'),
    branch: g('cwpBranch'), rules: g('cwpRules'), checks: g('cwpChecks'), model: g('cwpModel') };
  const tok = g('cwpToken');
  if (tok) body.token = tok;                      // пустое поле — токен не трогаем
  if (!key) body.key = g('cwpKey');
  if (!body.name) { document.getElementById('cwpName').focus(); return; }
  const r = await fetch('/api/cowork/projects' + (key ? '/' + encodeURIComponent(key) : ''), { method: key ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { document.getElementById('cwpErr').textContent = j.error || 'Не удалось сохранить.'; return; }
  closeModal(); showToast('Сохранено'); cw.loadedAt = 0; cw.tasks = cw.tasks || []; render();
}
async function cwDeleteProject(key) {
  const r = await fetch('/api/cowork/projects/' + encodeURIComponent(key), { method: 'DELETE' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { document.getElementById('cwpErr').textContent = j.error || 'Не удалось удалить.'; return; }
  closeModal(); showToast('Проект удалён'); if (cw.project === key) cw.project = ''; cw.loadedAt = 0; render();
}

function coworkTaskHtml(t) {
  const sp = t.spec || {};
  const mine = state.user && t.author_id === state.user.id;
  const row = (k, v) => v ? `<div class="emp-profile-row"><span>${k}</span><div class="emp-profile-text">${escapeHtml(v)}</div></div>` : '';
  return `
    <div class="cw-back"><button class="btn text" onclick="cwGo('tasks')">← К заданиям</button></div>
    <div class="val-block no-tr">
      <div class="val-head"><div class="val-mark">${ico('activity')}</div><h3 class="cw-title">${escapeHtml(t.title)}</h3>${cwStatus(t)}</div>
      <div class="emp-profile-row"><span>Автор</span><div>${escapeHtml(t.author_name || '')} · ${fmtDate(t.created)}</div></div>
      ${row('Раздел', sp.section)}${row('Что сделать', sp.what)}${row('Кто увидит', sp.who)}${row('Как проверить', sp.check)}
      ${t.status === 'running' ? `<div class="emp-profile-row"><span>Исполнитель</span><div class="cw-running"><span class="ask-dots"><i></i><i></i><i></i></span> работает${t.started ? ' с ' + fmtDate(t.started) : ''}</div></div>` : ''}
      ${t.status === 'queued' && t.rework ? row('Доработка', 'раз №' + t.rework + ', ждёт исполнителя') : ''}
      ${t.branch ? `<div class="emp-profile-row"><span>Ветка</span><div><code>${escapeHtml(t.branch)}</code></div></div>` : ''}
      ${t.pr_url ? `<div class="emp-profile-row"><span>Изменение</span><div><a class="cw-link" href="${escapeHtml(t.pr_url)}" target="_blank" rel="noopener">${escapeHtml(t.pr_url)}</a></div></div>` : ''}
      ${t.result ? row(t.status === 'rejected' ? 'Причина отказа' : t.status === 'failed' ? 'Почему не вышло' : t.status === 'queued' && t.rework ? 'Что доработать' : 'Итог', t.result) : ''}
      ${t.cost || t.tokens_in ? row('Расход', (t.cost ? t.cost.toFixed(2) + ' $ · ' : '') + (t.tokens_in + t.tokens_out).toLocaleString('ru-RU') + ' токенов' + (t.model ? ' · ' + t.model : '')) : ''}
      ${t.log ? `<details class="cw-log"><summary>Журнал исполнителя</summary><pre>${escapeHtml(t.log)}</pre></details>` : ''}
      <div class="profile-actions">
        ${(mine || isAdmin()) && ['queued', 'review', 'failed'].includes(t.status) ? `<button class="btn secondary" onclick="cwCancel(${jsArg(t.id)})">Отменить задание</button>` : ''}
        ${['queued', 'running', 'review'].includes(t.status) && !t.mr_id ? `<button class="btn secondary" onclick="coworkLink(${jsArg(t.id)})">Приложить ссылку на изменение</button>` : ''}
        ${['review', 'failed'].includes(t.status) ? `<button class="btn secondary" onclick="coworkDecide(${jsArg(t.id)}, 'rework')">На доработку</button>` : ''}
        ${t.status === 'review' ? `<button class="btn" onclick="coworkDecide(${jsArg(t.id)}, 'accept')">${t.mr_id ? 'Принять и влить' : 'Принять'}</button>
        <button class="btn secondary" onclick="coworkDecide(${jsArg(t.id)}, 'reject')">Отклонить</button>` : ''}
      </div>
    </div>
    <div class="val-block no-tr">
      <div class="val-head"><div class="val-mark">${ico('edit')}</div><h3>Замечания</h3></div>
      <div id="cwNotes" class="cw-notes"></div>
      <div class="cw-note-form">
        <textarea id="cwNoteText" rows="2" placeholder="Замечание…"></textarea>
        <button class="btn" onclick="cwAddNote(${jsArg(t.id)})">Добавить</button>
      </div>
    </div>
    ${(t.chat || []).length ? `<div class="val-block"><div class="val-head"><div class="val-mark">${ico('chat')}</div><h3>Переписка с приёмщиком</h3></div>
      <div class="chat-log cw-chat-static no-tr">${t.chat.map(m => m.role === 'user' ? `<div class="msg user"><div class="bubble">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div></div>`
        : `<div class="msg bot"><div class="msg-avatar"><img src="/static/bot-mark-white.svg" alt=""></div><div class="bubble bot">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div></div>`).join('')}</div></div>` : ''}`;
}
function cwNoteHtml(n, withTask) {
  return `<div class="cw-note"><div class="cw-note-head"><b>${escapeHtml(n.author_name || '')}</b><span>${fmtDate(n.created)}</span>${withTask ? `<a href="#" onclick="cwOpenTask(${jsArg(n.task_id)});return false;">${escapeHtml(n.task_title || '')}</a>` : ''}</div><div class="emp-profile-text">${escapeHtml(n.text)}</div></div>`;
}
async function cwLoadNotes(taskId) {
  const box = document.getElementById('cwNotes');
  if (!box) return;
  const notes = (await fetchJson('/api/cowork/tasks/' + encodeURIComponent(taskId) + '/notes')) || [];
  box.innerHTML = notes.length ? notes.map(n => cwNoteHtml(n, false)).join('') : '<div class="empty"><strong>Замечаний нет</strong></div>';
}
async function cwAddNote(taskId) {
  const el = document.getElementById('cwNoteText');
  const text = (el.value || '').trim();
  if (!text) { el.focus(); return; }
  const res = await fetchJson('/api/cowork/tasks/' + encodeURIComponent(taskId) + '/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!res) { showToast('Не удалось добавить'); return; }
  el.value = ''; showToast('Замечание добавлено'); cwLoadNotes(taskId);
}
async function cwRenderNotesAll() {
  const box = document.getElementById('cwNotesAll');
  if (!box) return;
  const notes = ((await fetchJson('/api/cowork/notes')) || []).filter(n => n.project === cw.project);
  box.className = 'cw-notes no-tr';
  box.innerHTML = notes.length ? notes.map(n => cwNoteHtml(n, true)).join('') : '<div class="empty"><strong>Замечаний пока нет</strong></div>';
}
async function cwRenderMaterials() {
  const box = document.getElementById('cwMaterials');
  if (!box) return;
  const items = ((await fetchJson('/api/cowork/materials')) || []).filter(m => !m.project || m.project === cw.project);
  box.className = 'no-tr';
  box.innerHTML = `
    <div class="val-block">
      <div class="val-head"><div class="val-mark">${ico('book')}</div><h3>Что агент знает о продукте</h3><button class="btn text" onclick="openCwMaterialForm()">Добавить материал</button></div>
      <div class="emp-profile-row"><span>Правила для агентов</span><div><a class="cw-link" href="https://github.com/Durotan312/Community/blob/master/AGENTS.md" target="_blank" rel="noopener">AGENTS.md в открытом репозитории</a></div></div>
      <div class="emp-profile-row"><span>Код портала</span><div><a class="cw-link" href="https://github.com/Durotan312/Community" target="_blank" rel="noopener">github.com/Durotan312/Community</a></div></div>
    </div>
    ${items.map(m => `
    <div class="val-block">
      <div class="val-head"><div class="val-mark">${ico('file')}</div><h3 class="cw-title">${escapeHtml(m.title)}</h3><button class="btn text" onclick="openCwMaterialForm(${jsArg(m.id)})">Изменить</button></div>
      ${!m.project ? `<div class="emp-profile-row"><span>Проект</span><div>Общий — для всех проектов</div></div>` : ''}
      ${m.body ? `<div class="emp-profile-text">${escapeHtml(m.body)}</div>` : ''}
      ${m.url ? `<div class="emp-profile-row"><span>Ссылка</span><div><a class="cw-link" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.url)}</a></div></div>` : ''}
    </div>`).join('') || '<div class="empty"><strong>Материалов пока нет</strong></div>'}`;
  cw.materials = items;
}
function openCwMaterialForm(id) {
  const m = (cw.materials || []).find(x => x.id === id) || { title: '', body: '', url: '', project: cw.project };
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${id ? 'Материал' : 'Новый материал'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Проект</label><select id="cwmProject"><option value="">Общий — для всех проектов</option>${cwProjects().map(p => `<option value="${escapeHtml(p.key)}"${p.key === (m.project || '') ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Название</label><input id="cwmTitle" type="text" value="${escapeHtml(m.title)}" maxlength="200"></div>
        <div class="field"><label>Текст</label><textarea id="cwmBody" style="min-height:140px;">${escapeHtml(m.body || '')}</textarea></div>
        <div class="field"><label>Ссылка</label><input id="cwmUrl" type="url" value="${escapeHtml(m.url || '')}"></div>
      </div>
      <div class="modal-foot">
        ${id ? `<button class="btn text" onclick="deleteCwMaterial(${jsArg(id)})">Удалить</button>` : ''}
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="saveCwMaterial(${jsArg(id || '')})">Сохранить</button>
      </div>
    </div>`);
}
async function saveCwMaterial(id) {
  const body = { title: document.getElementById('cwmTitle').value.trim(), body: document.getElementById('cwmBody').value.trim(), url: document.getElementById('cwmUrl').value.trim(), project: document.getElementById('cwmProject').value };
  if (!body.title) { document.getElementById('cwmTitle').focus(); return; }
  const res = await fetchJson('/api/cowork/materials' + (id ? '/' + encodeURIComponent(id) : ''), { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  closeModal();
  if (!res) { showToast('Не удалось сохранить'); return; }
  showToast('Сохранено'); cwRenderMaterials();
}
async function deleteCwMaterial(id) {
  const res = await fetchJson('/api/cowork/materials/' + encodeURIComponent(id), { method: 'DELETE' });
  closeModal();
  if (!res) { showToast('Не удалось удалить'); return; }
  showToast('Удалено'); cwRenderMaterials();
}
function cwSettingsShell() {
  const cur = cw.setTab || 'ai';
  return `
    <div class="cw-set">
      <div class="cw-set-nav">
        ${CW_SET.map(([k, name, sub]) => `<a class="cw-set-item${k === cur ? ' active' : ''}" href="#" onclick="cw.setTab=${jsArg(k)};render();return false;"><b>${name}</b><small>${sub}</small></a>`).join('')}
      </div>
      <div class="cw-set-body" id="cwSettings"><div class="empty"><strong>Загрузка…</strong></div></div>
    </div>`;
}
async function cwRenderSettings() {
  const box = document.getElementById('cwSettings');
  if (!box) return;
  if (!cw.settings || Date.now() - (cw.settingsAt || 0) > 20000) { cw.settings = await fetchJson('/api/cowork/settings'); cw.settingsAt = Date.now(); }
  const s = cw.settings;
  if (!s) { box.innerHTML = '<div class="empty"><strong>Не удалось загрузить</strong></div>'; return; }
  const cur = cw.setTab || 'ai';
  const yes = v => v ? '<span class="req-status done">подключено</span>' : '<span class="req-status cancelled">не подключено</span>';
  const block = (icon, title, badge, rows) => `<div class="val-block"><div class="val-head"><div class="val-mark">${ico(icon)}</div><h3>${title}</h3>${badge || ''}</div>${rows}</div>`;
  const row = (k, v) => `<div class="emp-profile-row"><span>${k}</span><div>${v}</div></div>`;
  let html = '';
  if (cur === 'ai') {
    const ex = s.executor || {}, st = s.settings || {};
    const exState = !ex.configured ? '<span class="req-status cancelled">не подключён</span>' : ex.alive ? '<span class="req-status done">на связи</span>' : '<span class="req-status queued">не отвечает</span>';
    html = block('key', 'Приёмщик заданий', yes(s.ai_key), row('Модель', 'Та же, что у Connect AI') + row('Ключ', 'На сервере портала, в чат не попадает'))
      + block('activity', 'Исполнитель — правит код', exState,
          row('Где работает', 'Контейнер на сервере портала, без доступа к его базе')
          + row('Ключ модели', ex.has_key ? 'есть' : ex.configured ? 'нет — ключ модели задаётся в cowork.env на сервере' : 'файл cowork.env на сервере')
          + (ex.seen ? row('Последний отклик', fmtDate(ex.seen) + (ex.claude ? ' · ' + escapeHtml(ex.claude) : '')) : '')
          + row('Как работает', 'Берёт задание из очереди, правит код в своей копии, прогоняет проверки, открывает merge request. «Принять» сливает его.'))
      + block('settings', 'Модель и бюджет', '',
          row('Модель по умолчанию', `<select id="cwsModel" onchange="cwSaveSettings()">${Object.keys(s.models || {}).map(m => `<option value="${escapeHtml(m)}"${m === st.model ? ' selected' : ''}>${escapeHtml(s.models[m])}</option>`).join('')}</select>`)
          + row('Бюджет на месяц, $', `<input id="cwsBudget" type="number" min="0" step="1" value="${Number(st.budget_usd || 0)}" style="width:120px" onchange="cwSaveSettings()"> <small>0 — без ограничения</small>`)
          + row('Предел ходов агента', `<input id="cwsTurns" type="number" min="5" max="200" value="${Number(st.max_turns || 40)}" style="width:120px" onchange="cwSaveSettings()">`)
          + row('Расход за месяц', `${Number(s.month_cost || 0).toFixed(2)} $ · заданий: ${s.month_tasks || 0}`));
  } else if (cur === 'services') {
    html = block('layers', 'Трекеры и базы знаний', '', '<div class="empty"><strong>Ничего не подключено</strong></div>');
  } else if (cur === 'git') {
    html = block('layers', 'Репозиторий', yes(true), row('Открытый код', `<a class="cw-link" href="${escapeHtml(s.repo)}" target="_blank" rel="noopener">${escapeHtml(s.repo)}</a>`)
      + row('Путь на сайт', 'Принятое изменение → закрытый репозиторий → сайт обновляется сам') + row('Правила для агентов', `<a class="cw-link" href="${escapeHtml(s.repo)}/blob/master/AGENTS.md" target="_blank" rel="noopener">AGENTS.md</a>`));
  } else if (cur === 'notify') {
    html = block('bell', 'Telegram', '', row('Бот отчётов администратору', 'Настраивается в Админ-панели → Сервисы') + row('Новые изменения на проверку', 'Приходят владельцу, когда подключён исполнитель'));
  } else if (cur === 'dialogs') {
    const mine = (cw.tasks || []).filter(t => t.chat && t.chat.length);
    html = block('chat', 'Диалоги с приёмщиком', '', mine.length ? mine.map(t => `<div class="emp-profile-row"><span>${fmtShortDate(t.created)}</span><div>${cwProjectChip(t.project)}<a href="#" onclick="cwOpenTask(${jsArg(t.id)});return false;">${escapeHtml(t.title)}</a> · ${t.chat.length} сообщений</div></div>`).join('') : '<div class="empty"><strong>Диалогов пока нет</strong></div>');
  } else if (cur === 'security') {
    html = block('lock', 'Вход и ключи', '', row('Вход в портал', 'Корпоративная учётная запись') + row('Вход в WorkFlow', state.user.cw_login ? escapeHtml(state.user.cw_login) : 'администратор') + (state.user.cw_login ? row('Пароль WorkFlow', '<button class="btn secondary" onclick="cwOpenPassword()">Сменить пароль WorkFlow</button>') : '') + row('Журнал действий', 'Админ-панель → Журнал действий'))
      + block('shield', 'Ограничители исполнителя', '', row('Правка не публикуется, если в ней', escapeHtml((s.guardrails || []).join(', '))) + row('Куда пишет агент', 'Только в отдельную ветку wf/… — в основную ветку без кнопки «Принять» ничего не попадает'))
      + block('users', 'Учётки WorkFlow', `<button class="btn text" onclick="cwOpenAccountForm()">Добавить учётку</button>`, `<div class="cw-users">${(s.accounts || []).map(a => `<div class="emp-profile-row"><span>${escapeHtml(a.login)}</span><div>${escapeHtml(a.name || '')}${a.must_change ? ' · пароль ещё не сменён' : ''}${a.last_login ? ' · был ' + fmtShortDate(a.last_login) : ''} <button class="btn text" onclick="cwDeleteAccount(${jsArg(a.login)})">Удалить</button></div></div>`).join('') || '<div class="empty"><strong>Учёток пока нет</strong></div>'}</div>`);
  }
  box.className = 'cw-set-body no-tr';
  box.innerHTML = html;
}
async function cwSaveSettings() {
  const body = { model: document.getElementById('cwsModel').value, budget_usd: document.getElementById('cwsBudget').value, max_turns: document.getElementById('cwsTurns').value };
  const res = await fetchJson('/api/cowork/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  cw.settingsAt = 0;
  showToast(res ? 'Настройки исполнителя сохранены' : 'Не удалось сохранить');
}
async function cwToggleUser(id, on) {
  const res = await fetchJson('/api/users/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cowork: on }) });
  cw.settingsAt = 0;   // галочки читать заново, а не из кэша
  showToast(res ? (on ? 'Доступ открыт' : 'Доступ закрыт') : 'Не удалось сохранить');
}

// мастер «Первичная настройка» (08.10.2026, образец пользователя: доступ к моделям, Git, трекер задач, безопасность);
// показывается один раз при первом входе, потом — по кнопке
const CW_STEPS = [
  ['key', 'Доступ к моделям', () => `<p>Основной инструмент платформы — агент на ключе AI портала. Ключ лежит на сервере, вставлять ничего не нужно.</p>${cwStepState(true)}`],
  ['layers', 'Доступ к Git', () => `<p>У каждого проекта свой репозиторий и токен — они задаются в карточке проекта. Агент пишет только в отдельную ветку и открывает merge request.</p>${cwStepState(cwProjects().some(p => p.token_set))}`],
  ['layers', 'Проекты', () => `<p>Задания принимаются по всем продуктам компании: ${escapeHtml(cwProjects().map(p => p.name).join(', '))}. Описание каждого — во вкладке «Проекты».</p>${cwStepState(cwProjects().length > 0)}`],
  ['activity', 'Трекер задач', () => `<p>Задания живут здесь, во вкладке «Мои задания». Внешние трекеры пока не подключены.</p>${cwStepState(false)}`],
  ['lock', 'Безопасность', () => `<p>Вход — по отдельной учётной записи WorkFlow, которую заводит администратор. Пароль можно сменить во вкладке «Настройки → Безопасность».</p>${cwStepState(true)}`],
];
function cwStepState(ok) { return ok ? '<span class="req-status done">подключено</span>' : '<span class="req-status cancelled">не подключено</span>'; }
function cwOnbDone() { try { return localStorage.getItem('cw_onboarding') === 'done'; } catch (e) { return true; } }
function cwOnbFinish() { try { localStorage.setItem('cw_onboarding', 'done'); } catch (e) { /* приватный режим */ } closeModal(); }
function cwOnboarding(step, first) {
  const u = state.user || {};
  const list = CW_STEPS.map(([icon, name], i) => `<div class="cw-onb-step${i === step - 1 ? ' active' : ''}${i < step - 1 ? ' done' : ''}">${ico(icon)}<div><b>${name}</b><small>Шаг ${i + 1} из ${CW_STEPS.length}</small></div></div>`).join('');
  const pct = Math.round(Math.max(0, step - 1) / CW_STEPS.length * 100);
  let right;
  if (step === 0) {
    right = `<div class="cw-onb-hero">${ico('activity')}</div><h3>Добро пожаловать, ${escapeHtml((u.name || '').split(' ').slice(-1)[0] || '')}!</h3>
      <p>Connected WorkFlow — рабочее пространство для заданий с AI-агентами. За минуту посмотрим доступ к моделям, Git, задачи и безопасность. Любой шаг можно пропустить.</p>
      <div class="cw-onb-foot"><button class="btn text" onclick="cwOnbFinish()">Пропустить всё</button><button class="btn" onclick="cwOnboarding(1)">Начать настройку</button></div>`;
  } else if (step > CW_STEPS.length) {
    right = `<div class="cw-onb-hero">${ico('check')}</div><h3>Готово</h3><p>Пространство настроено. Начните с вкладки «Чат-агент».</p>
      <div class="cw-onb-foot"><button class="btn" onclick="cwOnbFinish()">Открыть WorkFlow</button></div>`;
  } else {
    const [icon, name, content] = CW_STEPS[step - 1];
    right = `<div class="cw-onb-title">${ico(icon)}<h3>${name}</h3></div>${content()}
      <div class="cw-onb-foot"><button class="btn text" onclick="cwOnboarding(${step - 1})">Назад</button><span style="flex:1"></span>
        <button class="btn secondary" onclick="cwOnboarding(${step + 1})">Пропустить</button><button class="btn" onclick="cwOnboarding(${step + 1})">Дальше</button></div>`;
  }
  openModal(`
    <div class="modal cw-onb">
      <div class="modal-head"><h3>Первичная настройка</h3><button class="modal-close" onclick="${first ? 'cwOnbFinish()' : 'closeModal()'}">&times;</button></div>
      <div class="cw-onb-body">
        <div class="cw-onb-steps"><div class="cw-brand"><span class="cw-brand-mark">W</span><div><b>WorkFlow</b><small>Первичная настройка</small></div></div>${list}<div class="cw-onb-pct"><i style="width:${pct}%"></i></div><small>${pct}% настроено</small></div>
        <div class="cw-onb-right">${right}</div>
      </div>
    </div>`);
}

// нет допуска (08.10.2026, слова пользователя: «показать „у вас нет прав“ в это окно»)
function cwDeniedHtml() {
  return `
    <div class="cw-gate">
      <div class="cw-gate-box cw-denied">
        <div class="cw-brand"><span class="cw-brand-mark">W</span><div><b>Connected WorkFlow</b><small>рабочая среда</small></div></div>
        <div class="cw-denied-mark">${ico('lock')}</div>
        <h2>У вас нет прав</h2>
        <p>Доступ к Connected WorkFlow выдаёт администратор портала.</p>
        <div class="profile-actions"><button class="btn" type="button" onclick="goToView('home')">На портал</button></div>
      </div>
    </div>`;
}
// вход в WorkFlow отдельной учёткой (08.10.2026)
function cwLoginHtml() {
  return `
    <div class="cw-gate">
      <div class="cw-gate-box">
        <div class="cw-brand"><span class="cw-brand-mark">W</span><div><b>Connected WorkFlow</b><small>рабочая среда</small></div></div>
        <h2>Вход в WorkFlow</h2>
        <form onsubmit="cwLogin(event)" autocomplete="off">
          <div class="field"><label for="cwLoginUser">Логин WorkFlow</label><input id="cwLoginUser" autocapitalize="none" autocorrect="off" spellcheck="false" required></div>
          <div class="field"><label for="cwLoginPass">Пароль</label><input id="cwLoginPass" type="password" required></div>
          <div class="login-error" id="cwLoginErr" role="alert"></div>
          <div class="profile-actions"><button class="btn" type="submit">Войти</button><button class="btn secondary" type="button" onclick="goToView('home')">На портал</button></div>
        </form>
      </div>
    </div>`;
}
async function cwLogin(e) {
  e.preventDefault();
  const err = document.getElementById('cwLoginErr'); err.textContent = '';
  const r = await fetch('/api/cowork/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: document.getElementById('cwLoginUser').value.trim(), password: document.getElementById('cwLoginPass').value }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { err.textContent = j.error || 'Не удалось войти.'; return; }
  state.user.cw_login = j.cw_login; state.user.cw_must_change = j.cw_must_change;
  cw.tasks = null; render();
}
async function cwLogout() {
  await fetchJson('/api/cowork/logout', { method: 'POST' });
  state.user.cw_login = ''; state.user.cw_must_change = false; cw.tasks = null; render();
}
function cwPasswordHtml(first) {
  return `
    <div class="cw-gate">
      <div class="cw-gate-box">
        <div class="cw-brand"><span class="cw-brand-mark">W</span><div><b>Connected WorkFlow</b><small>рабочая среда</small></div></div>
        <h2>${first ? 'Задайте свой пароль' : 'Сменить пароль WorkFlow'}</h2>
        <form onsubmit="cwChangePassword(event)" autocomplete="off">
          <div class="field"><label for="cwOldPass">${first ? 'Временный пароль' : 'Старый пароль'}</label><input id="cwOldPass" type="password" required></div>
          <div class="field"><label for="cwNewPass">Новый пароль</label><input id="cwNewPass" type="password" minlength="8" required></div>
          <div class="field"><label for="cwNewPass2">Ещё раз</label><input id="cwNewPass2" type="password" minlength="8" required></div>
          <div class="login-error" id="cwPassErr" role="alert"></div>
          <div class="profile-actions"><button class="btn" type="submit">Сохранить</button>${first ? '' : '<button class="btn secondary" type="button" onclick="render()">Отмена</button>'}</div>
        </form>
      </div>
    </div>`;
}
function cwOpenPassword() { document.querySelector('.cw-content').innerHTML = cwPasswordHtml(false); }
async function cwChangePassword(e) {
  e.preventDefault();
  const err = document.getElementById('cwPassErr'); err.textContent = '';
  const a = document.getElementById('cwNewPass').value, b = document.getElementById('cwNewPass2').value;
  if (a !== b) { err.textContent = 'Пароли не совпадают.'; return; }
  const r = await fetch('/api/cowork/password', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old: document.getElementById('cwOldPass').value, new: a }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { err.textContent = j.error || 'Не удалось сменить пароль.'; return; }
  state.user.cw_must_change = false; showToast('Пароль WorkFlow изменён'); render();
}
function cwOpenAccountForm() {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Учётка WorkFlow</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Логин — начинается с «super»</label><input id="cwaLogin" type="text" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label>Имя</label><input id="cwaName" type="text"></div>
        <div class="field"><label>Временный пароль — не короче 8 знаков, при первом входе человек его сменит</label><input id="cwaPass" type="text" autocomplete="off"></div>
        <div class="login-error" id="cwaErr" role="alert"></div>
      </div>
      <div class="modal-foot"><button class="btn secondary" onclick="closeModal()">Отмена</button><button class="btn" onclick="cwSaveAccount()">Создать</button></div>
    </div>`);
}
async function cwSaveAccount() {
  const r = await fetch('/api/cowork/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: document.getElementById('cwaLogin').value.trim(), name: document.getElementById('cwaName').value.trim(), password: document.getElementById('cwaPass').value }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { document.getElementById('cwaErr').textContent = j.error || 'Не удалось создать.'; return; }
  closeModal(); showToast('Учётка создана'); cw.settingsAt = 0; render();
}
async function cwDeleteAccount(login) {
  const res = await fetchJson('/api/cowork/accounts/' + encodeURIComponent(login), { method: 'DELETE' });
  if (!res) { showToast('Не удалось удалить'); return; }
  showToast('Учётка удалена'); cw.settingsAt = 0; render();
}

function cwChatHtml() {
  return `
    <div class="chat-shell cw-chat">
      <div class="chat-topbar">
        <div class="chat-topbar-left">
          <span class="ask-spark"><img src="/static/bot-mark-white.svg" alt=""></span>
          <div><div class="chat-name">Приёмщик заданий</div><div class="chat-status">${escapeHtml(cwProjectName())}</div></div>
        </div>
        <button class="btn secondary chat-new" onclick="cw.messages=[];cw.draft='';render()">Новый чат</button>
      </div>
      <div class="chat-log no-tr" id="cwLog"></div>
      <div class="chat-composer">
        <textarea id="cwInput" rows="1" placeholder="Сообщение…" oninput="cw.draft=this.value; autoGrow(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();cwSend();}"></textarea>
        <button class="chat-send" id="cwBtn" onclick="cwSend()" title="Отправить">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </div>
    </div>`;
}
function cwPaint() {
  const log = document.getElementById('cwLog'), btn = document.getElementById('cwBtn');
  if (btn) btn.disabled = cw.loading;
  if (!log) return;
  if (!cw.messages.length && !cw.loading) {
    log.innerHTML = `<div class="chat-empty"><div class="chat-empty-mark"><img src="/static/bot-mark-white.svg" alt=""></div>
      <div class="chat-empty-title">Что изменить в ${escapeHtml(cwProjectName() || 'продукте')}?</div>
      ${(cwProject() || {}).body ? `<div class="cw-proj-about">${escapeHtml(cwProject().body)}</div>` : ''}</div>`;
    return;
  }
  let html = cw.messages.map((m, i) => {
    if (m.role === 'user') return `<div class="msg user"><div class="bubble">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div></div>`;
    const card = m.task ? `
      <div class="draft-card${m.sent ? ' sent' : ''}">
        <div class="draft-head">${ico('activity')}<span>${escapeHtml(m.task.title)}</span></div>
        <div class="draft-body no-tr">${['section', 'what', 'who', 'check'].filter(k => m.task[k]).map(k => `<div class="req-field"><span>${({section: 'Раздел', what: 'Что сделать', who: 'Кто увидит', check: 'Как проверить'})[k]}</span><b>${escapeHtml(m.task[k])}</b></div>`).join('')}</div>
        <div class="draft-foot">${m.sent ? `<div class="draft-done">${ico('check')} Отправлено в работу</div>` : `<button class="btn" onclick="cwSubmitTask(${i})">Отправить в работу</button>`}</div>
      </div>` : '';
    return `<div class="msg bot"><div class="msg-avatar"><img src="/static/bot-mark-white.svg" alt=""></div><div class="bot-col"><div class="bubble bot${m.role === 'error' ? ' error' : ''}">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>${card}</div></div>`;
  }).join('');
  if (cw.loading) html += `<div class="msg bot"><div class="msg-avatar"><img src="/static/bot-mark-white.svg" alt=""></div><div class="bubble bot thinking"><span class="ask-dots"><i></i><i></i><i></i></span></div></div>`;
  log.innerHTML = html;
  log.scrollTop = log.scrollHeight;
}
async function cwSend() {
  const input = document.getElementById('cwInput');
  if (!input || cw.loading) return;
  const message = input.value.trim();
  if (!message) return;
  const history = cw.messages.filter(m => m.role !== 'error').map(m => ({ role: m.role, text: m.text }));
  cw.messages.push({ role: 'user', text: message });
  cw.draft = ''; input.value = ''; autoGrow(input);
  cw.loading = true; cwPaint();
  let r, res;
  try {
    r = await fetch('/api/cowork/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history, project: cw.project }) });
    res = await r.json().catch(() => ({}));
  } catch (e) { r = null; }
  cw.loading = false;
  if (!r || !r.ok) cw.messages.push({ role: 'error', text: (res && res.error) || 'Не удалось получить ответ.' });
  else cw.messages.push({ role: 'bot', text: res.reply, task: res.task || null });
  cwPaint();
}
async function cwSubmitTask(i) {
  const m = cw.messages[i];
  if (!m || !m.task || m.sent) return;
  const chat = cw.messages.filter(x => x.role !== 'error').map(x => ({ role: x.role, text: x.text }));
  const res = await fetchJson('/api/cowork/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: m.task.title, spec: m.task, chat, project: m.task.project || cw.project }) });
  if (!res) { showToast('Не удалось отправить задание'); return; }
  m.sent = true;
  cw.tasks = [res, ...(cw.tasks || [])];
  cw.messages = [];
  state.coworkTab = cw.project + '.task-' + res.id;
  showToast('Задание отправлено в работу');
  render();
}
function cwCancel(id) {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Отменить задание</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body"><p>Задание будет снято с очереди. Вернуть его нельзя, но можно создать новое.</p></div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Оставить</button>
        <button class="btn" onclick="closeModal();cwCancelSend(${jsArg(id)})">Отменить задание</button>
      </div>
    </div>`);
}
async function cwCancelSend(id) {
  const res = await fetchJson('/api/cowork/tasks/' + encodeURIComponent(id) + '/cancel', { method: 'POST' });
  if (!res) { showToast('Не удалось отменить'); return; }
  cw.tasks = cw.tasks.map(t => t.id === id ? res : t);
  showToast('Задание отменено'); render();
}
// окно с одним полем — ссылка на изменение или причина отказа (правило: окна только через openModal)
function cwAsk(title, label, value, multiline, cb) {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body"><div class="field"><label>${label}</label>${multiline
        ? `<textarea id="cwAskVal" style="min-height:110px;">${escapeHtml(value || '')}</textarea>`
        : `<input id="cwAskVal" type="text" value="${escapeHtml(value || '')}">`}</div></div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="cwAskOk">Сохранить</button>
      </div>
    </div>`);
  document.getElementById('cwAskOk').onclick = () => {
    const el = document.getElementById('cwAskVal'), v = el.value.trim();
    if (!v) { el.focus(); el.classList.add('field-missing'); setTimeout(() => el.classList.remove('field-missing'), 1200); return; }   // без текста не отпускаем
    closeModal(); cb(v);
  };
  document.getElementById('cwAskVal').focus();
}
function coworkLink(id) {
  cwAsk('Ссылка на изменение', 'Ссылка на страницу изменения в репозитории', (cw.tasks.find(t => t.id === id) || {}).pr_url || '', false, async url => {
    if (!url) return;
    const res = await fetchJson('/api/cowork/tasks/' + encodeURIComponent(id) + '/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'link', pr_url: url }) });
    if (!res) { showToast('Не удалось сохранить'); return; }
    cw.tasks = cw.tasks.map(t => t.id === id ? res : t); render();
  });
}
async function cwDecideSend(id, decision, comment) {
  const r = await fetch('/api/cowork/tasks/' + encodeURIComponent(id) + '/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment }) });
  const res = await r.json().catch(() => null);
  if (!r.ok || !res) { showToast((res && res.error) || 'Не удалось сохранить решение'); return; }
  cw.tasks = cw.tasks.map(t => t.id === id ? res : t);
  showToast(decision === 'accept' ? (res.mr_id ? 'Изменение принято и влито' : 'Изменение принято') : decision === 'rework' ? 'Отправлено на доработку' : 'Изменение отклонено'); render();
}
function coworkDecide(id, decision) {
  if (decision === 'reject') { cwAsk('Отклонить изменение', 'Причина отказа — автор её увидит', '', true, c => { if (c) cwDecideSend(id, 'reject', c); }); return; }
  if (decision === 'rework') { cwAsk('На доработку', 'Что доработать — исполнитель это прочитает', '', true, c => { if (c) cwDecideSend(id, 'rework', c); }); return; }
  cwDecideSend(id, 'accept', '');
}

// ---------- приветственный баннер на главной ----------
// Время Астаны (UTC+5, без перехода на летнее время) — одинаковое для всех, где бы человек ни открыл портал.
// Возвращает дату, у которой «UTC-поля» равны астанинскому времени на часах.
function astanaNow() { return new Date(Date.now() + 5 * 3600 * 1000); }
function astanaClock() {
  const t = astanaNow(), p = n => String(n).padStart(2, '0');
  return { hm: p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()), s: p(t.getUTCSeconds()) };
}
// часы на главной идут сами; в полночь обновится дата, а на границах суток — приветствие
setInterval(() => {
  const hm = document.querySelector('.hero-clock-hm'), sec = document.querySelector('.hero-clock-sec');
  if (!hm || !sec) return;
  const now = astanaClock();
  sec.textContent = now.s;
  if (hm.textContent === now.hm) return;
  hm.textContent = now.hm;
  if (['00:00', '05:00', '12:00', '18:00'].includes(now.hm) && state.view === 'home') render();
}, 1000);

function heroHtml() {
  const now = new Date();
  const ast = astanaNow();
  const h = ast.getUTCHours();
  const greet = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const dateStr = ast.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const divisions = new Set(state.employees.map(e => e.department).filter(d => d && d !== 'Без отдела' && d !== 'Руководство')).size;
  // ближайший день рождения
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bd = state.employees.filter(p => p.birthday).map(p => {
    const d = new Date(p.birthday);
    const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    return { p, days: Math.round((next - today) / 86400000) };
  }).sort((a, b) => a.days - b.days)[0];
  const bdText = !bd ? '' : bd.days === 0
    ? `Сегодня день рождения у ${escapeHtml(bd.p.name)} — поздравьте!`
    : bd.days <= 14 ? `Через ${bd.days} ${pluralRu(bd.days, 'день', 'дня', 'дней')} день рождения у ${escapeHtml(bd.p.name)}` : '';
  // счётчик до ближайшего события из календаря
  const todayIso = isoDate(today);
  const nextEv = state.events.filter(e => e.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))[0];
  let evChip = '';
  if (nextEv) {
    const days = Math.round((new Date(nextEv.date) - today) / 86400000);
    evChip = `<div class="hero-chip" onclick="goToView('events')">${days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} ${pluralRu(days, 'день', 'дня', 'дней')}`} — ${escapeHtml(nextEv.title)}</div>`;
  }
  return `
    <div class="hero">
      <div class="hero-blob a"></div><div class="hero-blob b"></div>
      <div class="hero-text">
        <div class="hero-date">${dateStr[0].toUpperCase() + dateStr.slice(1)}</div>
        <div class="hero-title">${greet}, Connected Home!</div>
        <div class="hero-sub">${bdText || 'Здесь всё, что происходит в компании: новости, люди, проекты и помощник, который ответит на любой вопрос.'}</div>
        ${evChip}
      </div>
      <!-- цифры компании живут в дереве ниже, чтобы не дублировать их дважды на одном экране -->
    </div>`;
}

// «Компания в цифрах»: кольцевая диаграмма по подразделениям + разбивка списком.
// Сегменты кольца «прорисовываются» по очереди (анимация stroke-dasharray), строки списка проявляются следом.
const DIV_SHADES = ['#C24E00', '#E05E00', '#FF6B00', '#FF8330', '#FF9B57', '#FFB27E', '#FFC9A5', '#FFDCC2'];

function statsHtml() {
  const counts = {};
  state.employees.forEach(e => {
    const d = e.department;
    if (!d || d === 'Без отдела') return;   // «Руководство» тоже считаем, иначе сумма кольца не сойдётся с общим числом
    counts[d] = (counts[d] || 0) + 1;
  });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  const code = Object.fromEntries((typeof DIVISIONS !== 'undefined' ? DIVISIONS : []).map(([n, c]) => [n, c]));

  let acc = 0;
  const segments = rows.map(([name, n], i) => {
    const pct = n / total * 100;
    const seg = `<circle class="donut-seg" cx="100" cy="100" r="66" stroke="${DIV_SHADES[i % DIV_SHADES.length]}"
      stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"
      pathLength="100" style="animation-delay:${(i * 0.12).toFixed(2)}s"><title>${escapeHtml(name)} — ${n}</title></circle>`;
    acc += pct;
    return seg;
  }).join('');

  const legend = rows.map(([name, n], i) => `
    <div class="div-row${code[name] ? '' : ' no-code'}" style="animation-delay:${(0.35 + i * 0.07).toFixed(2)}s"
         onclick="state.orgCollapsed=null;goToView('org');setTimeout(()=>openOrgDiv(${jsArg(name)}),50)">
      <span class="div-dot" style="background:${DIV_SHADES[i % DIV_SHADES.length]}"></span>
      ${code[name] ? `<span class="org-code">${escapeHtml(code[name])}</span>` : ''}
      <span class="div-name">${escapeHtml(name)}</span>
      <span class="div-pct">${Math.round(n / total * 100)}%</span>
      <span class="div-num">${n}</span>
    </div>`).join('');

  const parts = [
    `${state.employees.length} ${pluralRu(state.employees.length, 'сотрудник', 'сотрудника', 'сотрудников')}`,
    `${rows.length} ${pluralRu(rows.length, 'подразделение', 'подразделения', 'подразделений')}`,
    `${state.projects.length} ${pluralRu(state.projects.length, 'проект', 'проекта', 'проектов')}`,
  ];

  return `
    <div class="stats">
      <div class="stats-head">
        <div class="stats-title">Компания в цифрах</div>
        <div class="stats-sub">${parts.join(' · ')}</div>
      </div>
      <div class="div-wrap">
        <svg class="donut" viewBox="0 0 200 200" role="img" aria-label="Распределение сотрудников по подразделениям">
          <g transform="rotate(-90 100 100)">
            <circle class="donut-bg" cx="100" cy="100" r="66"/>
            ${segments}
          </g>
          <text class="donut-total" x="100" y="97" text-anchor="middle" data-count="${total}">0</text>
          <text class="donut-cap" x="100" y="118" text-anchor="middle">${pluralRu(total, 'сотрудник', 'сотрудника', 'сотрудников')}</text>
        </svg>
        <div class="div-list">${legend}</div>
      </div>
    </div>`;
}

// цвет аватарки по имени — у каждого свой оттенок
function hueOf(name) {
  let h = 0;
  for (const ch of (name || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// ---------- переходы между разделами ----------
// «Частые вопросы» живут внутри «Новым сотрудникам», своей вкладки в шапке у них нет,
// поэтому подсветку меню оставляем на родительском разделе.
function goToView(view) {
  const tab = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (tab) { tab.click(); return; }
  state.view = view;
  state.search = '';
  render();
}
function openFaq() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[data-view="roadmap"]')?.classList.add('active');
  state.view = 'faq';
  state.search = '';
  render();
  window.scrollTo({ top: 0 });
}
function pluralRu(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ---------- приглашение к Connect AI (правая колонка, на всех вкладках) ----------
function aiTeaserHtml() {
  return `
    <div class="ai-teaser side" onclick="goToAiBot('')" role="button" title="Открыть Connect AI">
      <div class="ai-teaser-left">
        <span class="ask-spark"><img src="/static/bot-mark-white.svg" alt=""></span>
        <div>
          <div class="ai-teaser-title">Connect AI</div>
          <div class="ai-teaser-sub">Спросите про отпуск, зарплату, пропуск, коллег — отвечу по данным портала</div>
        </div>
      </div>
      <div class="ai-teaser-input" onclick="event.stopPropagation()">
        <input id="teaserInput" type="text" placeholder="Задайте вопрос…"
          onkeydown="if(event.key==='Enter'){event.preventDefault();goToAiBot(this.value);}">
        <button class="chat-send" onclick="goToAiBot(document.getElementById('teaserInput').value)" title="Спросить">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none"
               stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// Переход в чат; если передан текст — вопрос сразу отправляется.
function goToAiBot(question) {
  const tab = document.querySelector('.nav-item[data-view="aibot"]');
  if (tab) tab.click();  // штатное переключение вкладки + render()
  const q = (question || '').trim();
  if (!q) return;
  const input = document.getElementById('askInput');
  if (!input) return;
  input.value = q;
  autoGrow(input);
  submitAsk();
}

function newsActionsHtml(n) {
  return canEditNews() ? `
      <div class="card-actions">
        <button class="icon-btn ${n.pinned ? 'active' : ''}" onclick="togglePin('${n.id}')">${n.pinned ? 'Открепить' : 'Закрепить'}</button>
        <button class="icon-btn" onclick="openNewsForm('${n.id}')">Изменить</button>
        <button class="btn text" onclick="deleteItem('news','${n.id}')">Удалить</button>
      </div>` : '';
}

// длинная новость в ленте свёрнута: первые строки с затуханием и «Читать далее» (просьба пользователя 25.09.2026)
const NEWS_LONG_CHARS = 450, NEWS_LONG_LINES = 7;
function newsBodyHtml(n) {
  const body = n.body || '';
  const long = body.length > NEWS_LONG_CHARS || body.split(String.fromCharCode(10)).length > NEWS_LONG_LINES;
  if (!long) return `<div class="news-body">${escapeHtml(body)}</div>`;
  return `<div class="news-body clamp" id="nb-${n.id}">${escapeHtml(body)}</div>
          <button class="news-more" onclick="toggleNewsBody('${n.id}', this)">Читать далее ↓</button>`;
}
function toggleNewsBody(id, btn) {
  const el = document.getElementById('nb-' + id);
  if (!el) return;
  const open = el.classList.toggle('clamp') === false;
  btn.textContent = open ? 'Свернуть ↑' : 'Читать далее ↓';
  if (!open) el.closest('.news-card').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function newcomerCardHtml(n) {
  const sub = [n.person_position, n.person_department].filter(Boolean).join(' · ');
  return `
    <div class="news-card newcomer" style="${n.pinned ? 'border-color:var(--orange);' : ''}">
      <div class="newcomer-content">
        <div class="newcomer-text">
          <div class="newcomer-badges">
            <span class="badge newcomer-badge">Новый сотрудник</span>
            ${n.pinned ? `<span class="badge pinned">Закреплено</span>` : ''}
          </div>
          <div class="newcomer-title">${escapeHtml(n.title)}</div>
          <div class="newcomer-name">${escapeHtml(n.person_name)}</div>
          ${sub ? `<div class="newcomer-pos">${escapeHtml(sub)}</div>` : ''}
          ${newsBodyHtml(n)}
          <div class="news-meta newcomer-meta">${escapeHtml(n.author || 'Компания')} · ${fmtDate(n.date)}</div>
        </div>
        ${n.image
          ? `<img class="newcomer-photo zoomable" src="${escapeHtml(n.image)}" alt="" onclick="openLightbox(${jsArg(n.image)})">`
          : `<div class="newcomer-photo newcomer-ava" style="--h:${hueOf(n.person_name)}">${initials(n.person_name)}</div>`}
      </div>
      ${newsActionsHtml(n)}
    </div>`;
}

function newsCardHtml(n) {
  if (n.type === 'newcomer') return newcomerCardHtml(n);
  return `
    <div class="news-card${n.pinned ? '' : ''}" style="${n.pinned ? 'border-color:var(--orange);' : ''}">
      <div class="news-title-row">
        ${n.pinned ? `<span class="badge pinned">Закреплено</span>` : ''}
      </div>
      <div class="news-content${n.image ? ' has-photo' : ''}">
        <div class="news-text">
          <div class="news-title">${escapeHtml(n.title)}</div>
          <div class="news-meta">${escapeHtml(n.author || 'Компания')} · ${fmtDate(n.date)}</div>
          ${newsBodyHtml(n)}
        </div>
        ${n.image ? `<img class="news-image zoomable" src="${escapeHtml(n.image)}" alt="" onclick="openLightbox(${jsArg(n.image)})">` : ''}
      </div>
      ${newsActionsHtml(n)}
    </div>`;
}

async function togglePin(id) {
  const res = await fetchJson(`/api/news/${id}/pin`, { method: 'POST' });
  if (res) {
    const item = state.news.find(n => n.id === id);
    if (item) item.pinned = res.pinned;
    state.news.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.date) - new Date(a.date)));
    render();
  }
}

function openNewsForm(id, forceType) {
  const n = id ? state.news.find(x => x.id === id) : null;
  // при переключении вида сохраняем то, что человек уже набрал
  const keep = document.getElementById('modalOverlay') ? {
    title: document.getElementById('fTitle')?.value, author: document.getElementById('fAuthor')?.value,
    body: document.getElementById('fBody')?.value, pname: document.getElementById('fPersonName')?.value,
    ppos: document.getElementById('fPersonPos')?.value, pdept: document.getElementById('fPersonDept')?.value,
  } : {};
  closeModal();
  const type = forceType || (n && n.type) || 'news';
  const isNew = type === 'newcomer';
  // заголовок по умолчанию от другого вида публикации не переносим
  if (keep.title === 'У нас пополнение!' && !isNew) keep.title = '';
  const v = (kept, saved, dflt = '') => escapeHtml(kept ? kept : (saved || dflt));
  const depts = [...new Set(state.employees.map(e => e.department).filter(Boolean))].sort();
  const idArg = n ? `'${n.id}'` : 'null';
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${n ? 'Изменить публикацию' : 'Новая публикация'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="type-switch">
          <button type="button" class="${isNew ? '' : 'active'}" onclick="openNewsForm(${idArg}, 'news')">Новость</button>
          <button type="button" class="${isNew ? 'active' : ''}" onclick="openNewsForm(${idArg}, 'newcomer')">Новый сотрудник</button>
        </div>
        ${isNew ? `
        <div class="field"><label>Имя и фамилия</label>
          <input id="fPersonName" type="text" list="newsEmpList"
                 value="${v(keep.pname, n && n.person_name)}" oninput="fillNewcomerFromDirectory()">
          <datalist id="newsEmpList">${state.employees.map(e => `<option value="${escapeHtml(e.name)}">`).join('')}</datalist>
        </div>
        <div class="field-row">
          <div class="field"><label>Должность</label><input id="fPersonPos" type="text" value="${v(keep.ppos, n && n.person_position)}"></div>
          <div class="field"><label>Подразделение</label>
            <input id="fPersonDept" type="text" list="newsDeptList" value="${v(keep.pdept, n && n.person_department)}">
            <datalist id="newsDeptList">${depts.map(d => `<option value="${escapeHtml(d)}">`).join('')}</datalist>
          </div>
        </div>` : ''}
        <div class="field"><label>Заголовок</label><input id="fTitle" type="text"
         
          value="${v(keep.title, n && n.title, isNew ? 'У нас пополнение!' : '')}"></div>
        <div class="field">
          <label>${isNew ? 'Приветствие' : 'Текст'}</label>
          <textarea id="fBody">${v(keep.body, n && n.body)}</textarea>
          ${isNew ? `<button type="button" class="btn text field-helper" onclick="composeWelcome()">Составить приветствие по шаблону</button>` : ''}
        </div>
        <div class="field"><label>Автор (необязательно)</label><input id="fAuthor" type="text" value="${v(keep.author, n && n.author)}"></div>
        <div class="field">
          <label>${isNew ? 'Фото сотрудника' : (n && n.image ? 'Фото' : 'Фото (необязательно)')}</label>
          ${n && n.image ? `
            <div class="news-photo-current" id="newsPhotoCurrent">
              <img src="${escapeHtml(n.image)}" alt="">
              <button type="button" class="btn text" onclick="removeNewsPhoto()">Убрать фото</button>
            </div>` : ''}
          <input id="fImage" type="file" accept="image/*" onchange="previewImage(this,'newsPreview')">
          
          <img id="newsPreview" class="preview-thumb" style="display:none;">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="newsSubmitBtn" onclick="submitNews(${idArg}, '${type}')">${n ? 'Сохранить' : 'Опубликовать'}</button>
      </div>
    </div>`);
  state._newsPhotoRemoved = false;
}

// имя выбрали из справочника — подставляем должность и подразделение
function fillNewcomerFromDirectory() {
  const name = document.getElementById('fPersonName').value.trim().toLowerCase();
  const e = state.employees.find(x => x.name.toLowerCase() === name);
  if (!e) return;
  const pos = document.getElementById('fPersonPos'), dept = document.getElementById('fPersonDept');
  if (!pos.value) pos.value = e.position || '';
  if (!dept.value) dept.value = e.department || '';
}

function composeWelcome() {
  const name = document.getElementById('fPersonName').value.trim();
  const pos = document.getElementById('fPersonPos').value.trim();
  const dept = document.getElementById('fPersonDept').value.trim();
  if (!name) return showToast('Сначала укажите имя и фамилию.');
  const first = name.split(' ').slice(-1)[0];
  document.getElementById('fBody').value =
    `Команда, у нас пополнение! К нам присоединился ${name}` +
    // русскую должность пишем со строчной («менеджер»), английскую не трогаем («Junior AI Engineer»)
    (pos ? ` — ${/^[А-ЯЁ]/.test(pos) ? pos.charAt(0).toLowerCase() + pos.slice(1) : pos}` : '') +
    (dept ? ` в подразделении «${dept}»` : '') + '.\n\n' +
    `Подходите знакомиться, делитесь опытом и помогайте быстрее освоиться. ` +
    `${first}, добро пожаловать в команду!`;
}

function removeNewsPhoto() {
  state._newsPhotoRemoved = true;
  document.getElementById('newsPhotoCurrent')?.remove();
}
function previewImage(input, previewId) {
  const file = input.files[0];
  const img = document.getElementById(previewId);
  if (!file) { img.style.display = 'none'; return; }
  const reader = new FileReader();
  reader.onload = e => { img.src = e.target.result; img.style.display = 'block'; };
  reader.readAsDataURL(file);
}
async function submitNews(id, type) {
  const isNew = type === 'newcomer';
  const title = document.getElementById('fTitle').value.trim() || (isNew ? 'У нас пополнение!' : '');
  const body = document.getElementById('fBody').value.trim();
  const author = document.getElementById('fAuthor').value.trim();
  const imageInput = document.getElementById('fImage');
  const person = isNew ? {
    person_name: document.getElementById('fPersonName').value.trim(),
    person_position: document.getElementById('fPersonPos').value.trim(),
    person_department: document.getElementById('fPersonDept').value.trim(),
  } : { person_name: '', person_position: '', person_department: '' };
  if (isNew && !person.person_name) { showToast('Укажите имя и фамилию нового сотрудника'); return; }
  if (!title || !body) { showToast(isNew ? 'Напишите приветствие — или нажмите «Составить по шаблону»' : 'Заполните заголовок и текст'); return; }
  const btn = document.getElementById('newsSubmitBtn');
  btn.disabled = true; btn.textContent = imageInput.files[0] ? 'Загружаем фото…' : 'Сохраняем…';

  const payload = { title, body, author, type: isNew ? 'newcomer' : 'news', ...person };
  if (imageInput.files[0]) {
    const url = await uploadFile(imageInput);
    if (!url) { btn.disabled = false; btn.textContent = id ? 'Сохранить' : 'Опубликовать'; return; }
    payload.image = url;                       // новое фото
  } else if (id && state._newsPhotoRemoved) {
    payload.image = '';                        // фото убрали
  } else if (!id) {
    payload.image = '';
  }                                            // иначе фото не трогаем

  const item = await fetchJson(id ? `/api/news/${id}` : '/api/news', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  closeModal();
  if (!item) { showToast('Не удалось сохранить'); }
  else if (id) {
    const i = state.news.findIndex(x => x.id === id);
    if (i >= 0) state.news[i] = item;
    showToast('Новость обновлена');
  } else { state.news.unshift(item); showToast('Новость опубликована'); }
  render();
}

// =========================================================
// PEOPLE
// =========================================================
function renderPeople(main) {
  let items = state.employees.slice();
  if (state.search) {
    items = items.filter(p => p.name.toLowerCase().includes(state.search) ||
      (p.position || '').toLowerCase().includes(state.search) || p.department.toLowerCase().includes(state.search) ||
      profileText(p.profile).includes(state.search));
  }
  let html = `
    <div class="section-head">
      <div><div class="section-title">Сотрудники</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn secondary" onclick="exportEmployees()">${ico('download')} Скачать список (Excel)</button>
        <button class="btn" onclick="openPersonForm()">Добавить сотрудника</button>
      </div>
    </div>`;

  if (!items.length) {
    html += `<div class="empty"><strong>Справочник пуст</strong></div>`;
    main.innerHTML = html;
    return;
  }

  // 09.10.2026, слова пользователя: «на вкладке „Все сотрудники“ хочу, чтобы сначала показывали руководителей с их текстами»
  const leaders = state.search ? [] : (state.leaders || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  if (leaders.length) {
    html += `<div class="section-head people-leaders-head"><div><div class="section-title" style="font-size:20px;">Руководители</div></div></div>
    <div class="people-grid people-leaders">` + leaders.map(l => `
      <div class="person-card clickable leader-card" onclick="openLeaderCard('${l.id}')" role="button">
        ${l.photo ? `<img class="person-photo" src="${escapeHtml(l.photo)}" alt="">` : `<div class="person-photo-fallback">${initials(l.name)}</div>`}
        <div class="person-name">${escapeHtml(l.name)}</div>
        <div class="person-role">${escapeHtml(l.position || '')}</div>
        ${l.story ? `<div class="person-extra leader-excerpt">${escapeHtml(l.story.split(/\n/)[0].slice(0, 140))}${l.story.length > 140 ? '…' : ''}</div><div class="leader-more">Читать →</div>` : ''}
      </div>`).join('') + `</div>
    <div class="section-head"><div><div class="section-title" style="font-size:20px;">Все сотрудники</div></div></div>`;
  }
  const NO_DEP = 'Без отдела';
  const groups = {};
  items.forEach(p => { (groups[p.department || NO_DEP] ||= []).push(p); });
  // Отделы по алфавиту, «Без отдела» всегда в конце; внутри отдела руководитель первым.
  const depOrder = Object.keys(groups).sort((a, b) => {
    if (a === NO_DEP) return 1;
    if (b === NO_DEP) return -1;
    return a.localeCompare(b, 'ru');
  });
  const byHeadThenName = (a, b) => (Number(b.is_head) - Number(a.is_head)) || a.name.localeCompare(b.name, 'ru');

  // плашки подразделений: выбрал — показываем только его, без прокрутки вниз
  if (state.peopleDep && !groups[state.peopleDep]) state.peopleDep = '';
  html += `<div class="dep-chips">
    <button class="dep-chip${state.peopleDep ? '' : ' active'}" onclick="state.peopleDep='';render()">Все <span>${items.length}</span></button>
    ${depOrder.map(dep => `<button class="dep-chip${state.peopleDep === dep ? ' active' : ''}" onclick="state.peopleDep=${JSON.stringify(dep).replace(/"/g, '&quot;')};render()">${escapeHtml(dep)} <span>${groups[dep].length}</span></button>`).join('')}
  </div>`;
  const shown = state.peopleDep ? [state.peopleDep] : depOrder;

  html += `<div class="people-groups">` + shown.map(dep => `
    <div class="people-group">
      <div class="doc-group-title">${escapeHtml(dep)} · ${groups[dep].length}</div>
      <div class="people-grid">
        ${groups[dep].slice().sort(byHeadThenName).map(p => `
          <div class="person-card clickable${Number(p.is_head) ? ' is-head' : ''}" onclick="openEmployeeCard('${p.id}')" title="Открыть карточку">
            ${p.photo ? `<img class="person-photo" src="${escapeHtml(p.photo)}" alt="">`
                       : `<div class="person-photo-fallback" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`}
            ${Number(p.is_head) ? `<div class="person-tag head">Руководитель отдела</div>` : ''}
            <div class="person-name">${escapeHtml(p.name)}</div>
            <div class="person-role">${escapeHtml(p.position || '')}</div>
            ${p.unit ? `<div class="person-company">${escapeHtml(p.unit)}</div>` : ''}
            ${p.reports_to ? `<div class="person-extra">↑ ${escapeHtml(p.reports_to)}</div>` : ''}
            ${p.company ? `<div class="person-company">${escapeHtml(p.company)}</div>` : ''}
            ${p.schedule ? `<div class="person-extra">${ico('clock')} ${escapeHtml(p.schedule)}</div>` : ''}
            ${fieldworkBadge(p.fieldwork)}
            ${p.phone ? `<div class="person-extra">${escapeHtml(p.phone)}</div>` : ''}
            ${p.birthday ? `<div class="person-extra">${ico('cake')} ${fmtShortDate(p.birthday)}</div>` : ''}
            ${p.email ? `<a class="person-email" href="mailto:${escapeHtml(p.email)}" onclick="event.stopPropagation()">${escapeHtml(p.email)}</a>` : ''}
            ${p.telegram ? `<a class="person-email tg-link" href="https://t.me/${escapeHtml(p.telegram)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Написать в Telegram">@${escapeHtml(p.telegram)}</a>` : ''}
            <div class="card-actions">
              <button class="btn text" onclick="event.stopPropagation();deleteItem('employees','${p.id}')">Удалить</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('') + `</div>`;
  main.innerHTML = html;
}

function fieldworkBadge(v) {
  const s = (v || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'онлайн') return `<div class="person-tag online">Онлайн</div>`;
  return `<div class="person-tag field">Выезд на объекты</div>`;
}

function openPersonForm() {
  // Подсказки берём из уже существующих отделов и компаний, чтобы не плодить варианты написания.
  const uniq = key => [...new Set(state.employees.map(p => (p[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const depOptions = uniq('department').filter(d => d !== 'Без отдела').map(d => `<option value="${escapeHtml(d)}">`).join('');
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Новый сотрудник</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Имя и фамилия</label><input id="fName" type="text"></div>
        <div class="field"><label>Должность</label><input id="fRole" type="text"></div>
        <div class="field"><label>Подразделение</label>
          <input id="fDep" list="depList" type="text">
          <datalist id="depList">${depOptions}</datalist>
        </div>
        <div class="field"><label>Отдел внутри подразделения (необязательно)</label>
          <input id="fUnit" list="unitList" type="text">
          <datalist id="unitList">${uniq('unit').map(u => `<option value="${escapeHtml(u)}">`).join('')}</datalist>
        </div>
        <div class="field"><label>Непосредственный руководитель (необязательно)</label>
          <input id="fBoss" list="bossList" type="text" placeholder="Начните вводить фамилию">
          <datalist id="bossList">${state.employees.map(e => `<option value="${escapeHtml(e.name)}">`).join('')}</datalist>
        </div>
        ${isAdmin() ? `<div class="field field-check">
          <label><input id="fHead" type="checkbox"> Руководитель отдела</label>
        </div>` : ''}
        <div class="field"><label>График работы (необязательно)</label><input id="fSchedule" type="text" placeholder="09:00-18:00"></div>
        <div class="field"><label>Выезд на объекты (необязательно)</label>
          <select id="fFieldwork">
            <option value="">Не указано</option>
            <option value="да">Да, выезжает</option>
            <option value="онлайн">Работает онлайн</option>
          </select>
        </div>
        <div class="field"><label>Email (необязательно)</label><input id="fEmail" type="text"></div>
        <div class="field"><label>Телефон (необязательно)</label><input id="fPhone" type="text" placeholder="+7 900 000-00-00"></div>
        <div class="field"><label>Telegram (необязательно)</label><input id="fTelegram" type="text" placeholder="имя пользователя без @" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label>Дата рождения (необязательно)</label><input id="fBirthday" type="date"></div>
        <div class="field">
          <label>Фото (необязательно)</label>
          <input id="fPhoto" type="file" accept="image/*" onchange="previewImage(this,'personPreview')">
          <img id="personPreview" class="preview-thumb" style="display:none;">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitPerson()">Добавить</button>
      </div>
    </div>`);
}
async function submitPerson() {
  const name = document.getElementById('fName').value.trim();
  const position = document.getElementById('fRole').value.trim();
  const department = document.getElementById('fDep').value.trim() || 'Без отдела';
  const email = document.getElementById('fEmail').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const telegram = document.getElementById('fTelegram').value.trim();
  const birthday = document.getElementById('fBirthday').value;
  const schedule = document.getElementById('fSchedule').value.trim();
  const fieldwork = document.getElementById('fFieldwork').value;
  const company = '';  // компании пока не используем — все в Connected Home
  const is_head = document.getElementById('fHead')?.checked ? 1 : 0;
  const unit = document.getElementById('fUnit').value.trim();
  const reports_to = document.getElementById('fBoss').value.trim();
  const photoInput = document.getElementById('fPhoto');
  if (!name) { showToast('Укажите имя сотрудника'); return; }

  let photo = '';
  if (photoInput.files[0]) {
    photo = await uploadFile(photoInput) || '';
  }

  const item = await fetchJson('/api/employees', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, position, department, email, phone, telegram, birthday, photo, schedule, fieldwork, company, is_head, unit, reports_to }),
  });
  closeModal();
  if (item) { state.employees.push(item); showToast('Сотрудник добавлен'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

// =========================================================
// ORG STRUCTURE — полосы подразделений, отделы колонками
// =========================================================
// Порядок и коды подразделений — как в официальной оргструктуре.
const DIVISIONS = [
  ['Коммерция и развитие бизнеса', 'CBDO / TQM'],
  ['Технологии',                   'CTO'],
  ['Операции и внедрение',         'COO'],
  ['Региональный офис в Алматы',   'ALMATY'],
  ['Умный цифровой замок',         'SDL'],
  ['Финансы',                      'CFO'],
  ['Администрация',                'ADMIN'],
];

state.orgCollapsed = null;  // null = ещё не инициализировано; при первом показе сворачиваем все

// Полосы раскрываются ТОЛЬКО этими тремя действиями; любой другой рендер
// (загрузка страницы, переход на вкладку, обновление данных) сворачивает всё.
function toggleOrgDiv(name) {
  if (state.orgCollapsed.has(name)) state.orgCollapsed.delete(name);
  else state.orgCollapsed.add(name);
  state.orgKeep = true;
  render();
}
// клик по карточке руководителя наверху: раскрыть его подразделение и прокрутить к нему
function openOrgDiv(name) {
  state.orgCollapsed.delete(name);
  state.orgKeep = true;
  render();
  const band = [...document.querySelectorAll('.og-band')].find(b => b.dataset.div === name);
  if (band) band.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setAllOrg(collapsed) {
  state.orgCollapsed = collapsed ? new Set(DIVISIONS.map(d => d[0]).concat(
    state.employees.map(e => e.department))) : new Set();
  state.orgKeep = true;
  render();
}

// Плавные дуги от гендиректора к карточкам подразделений (рисуются после раскладки).
function drawOrgLinks() {
  const top = document.getElementById('orgTop');
  const svg = document.getElementById('orgLinks');
  const ceo = document.getElementById('orgCeo');
  if (!top || !svg || !ceo) return;
  if (window.innerWidth <= 860) { svg.innerHTML = ''; return; }
  const box = top.getBoundingClientRect();
  const c = ceo.getBoundingClientRect();
  const x0 = c.left + c.width / 2 - box.left;
  const y0 = c.bottom - box.top;
  const cards = [...top.querySelectorAll('.org-head-card')];
  const rowTop = Math.min(...cards.map(card => card.getBoundingClientRect().top));
  // карточка, перенесённая во второй ряд, линию не получает: та шла бы под карточками первого ряда и торчала обрывками
  const paths = cards.filter(card => card.getBoundingClientRect().top < rowTop + 10).map(card => {
    const r = card.getBoundingClientRect();
    const x1 = r.left + r.width / 2 - box.left;
    const y1 = r.top - box.top;
    const dy = y1 - y0;
    return `<path d="M ${x0} ${y0} C ${x0} ${y0 + dy * 0.6}, ${x1} ${y1 - dy * 0.6}, ${x1} ${y1}"/>`;
  });
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.setAttribute('width', box.width);
  svg.setAttribute('height', box.height);
  svg.innerHTML = paths.join('') + `<circle cx="${x0}" cy="${y0}" r="4"/>`;
}
window.addEventListener('resize', () => {
  if (state.view === 'org') drawOrgLinks();
  syncMastheadHeight();
});

// Высота шапки нужна боковой панели (она закреплена сразу под шапкой) и чату. Раньше её мерили только при отрисовке
// раздела и изменении окна: пока шла «Загрузка…», панель стояла на высоте однострочной шапки (68px) и на ноутбуках,
// где шапка в две строки, уезжала под неё — пропадал заголовок «Инструменты» (заметил пользователь 05.10.2026).
// Теперь мерим сразу при старте и следим за шапкой постоянно: шрифты, смена языка, появление пунктов меню.
function syncMastheadHeight() {
  fitMasthead();
  const m = document.querySelector('.masthead');
  if (m) document.documentElement.style.setProperty('--masthead-h', m.offsetHeight + 'px');
}

// Шапка в одну строку на ноутбуках (06.10.2026, просьба пользователя: «с любым масштабом должно отображаться одинаково» —
// при 100% на его ноутбуке окно 1333px, и вкладки уезжали на вторую строку, а при меньшем масштабе шапка была в одну).
// На ширине 1101–1460px пробуем плотную однострочную шапку (класс head-one-row, стили в конце style.css) и оставляем её,
// только если всё поместилось; иначе — прежние две строки. Жёсткой границы по ширине нет: на EN/KZ/中文 названия вкладок
// другой длины, и решает замер. Пересчитываем, только когда изменилась ширина окна или текст вкладок, — иначе
// наблюдатель за шапкой гонял бы замер по кругу.
let _headFitKey = '';
function fitMasthead(force) {
  const root = document.documentElement, m = document.querySelector('.masthead'), tabs = document.querySelector('.nav-tabs');
  const actions = document.querySelector('.masthead-actions');
  if (!m || !tabs || !actions || !tabs.lastElementChild) return;
  // текст берём только у самих вкладок: innerText захватил бы и пункты выпадающего меню, когда оно открыто наведением
  const w = window.innerWidth, key = w + '|' + [...tabs.children].map(t => (t.firstElementChild || t).textContent.trim()).join('|');
  if (!force && key === _headFitKey) return;
  _headFitKey = key;
  let one = false;
  if (w >= 1101 && w <= 1460) {
    root.classList.add('head-one-row');
    const last = tabs.lastElementChild.getBoundingClientRect(), act = actions.getBoundingClientRect();
    // Первый замер идёт до отрисовки раздела, когда у страницы ещё нет полосы прокрутки; с ней окно станет уже на ~17px.
    // Поэтому, пока полосы нет, требуем такой же запас — иначе у самой границы вкладки упёрлись бы в значки.
    const reserve = window.innerWidth - root.clientWidth > 0 ? 0 : 17;
    one = m.scrollWidth <= m.clientWidth + 1 && last.right + 6 + reserve <= act.left;
  }
  root.classList.toggle('head-one-row', one);
  // запоминаем решение: при следующей загрузке класс ставит крошечный скрипт в <head> (index.html) — шапка не «прыгает»
  try { localStorage.setItem('portal_head', w + '|' + (localStorage.getItem('portal_lang') || 'ru') + '|' + (one ? 1 : 0)); } catch (e) { /* хранилище недоступно — не страшно */ }
}
// сменился язык — у вкладок другой текст и другая ширина; размер самой шапки при этом может не измениться,
// и наблюдатель за размером промолчит, поэтому следим ещё и за текстом вкладок
let _headTextTimer = null;
new MutationObserver(() => {
  clearTimeout(_headTextTimer);
  _headTextTimer = setTimeout(syncMastheadHeight, 60);
}).observe(document.querySelector('.nav-tabs'), { subtree: true, characterData: true, childList: true });
syncMastheadHeight();
if (window.ResizeObserver) new ResizeObserver(syncMastheadHeight).observe(document.querySelector('.masthead'));
// шрифты догрузились — ширина надписей другая, перемеряем заново
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitMasthead(true); syncMastheadHeight(); });

function renderOrg(main) {
  // рисуем дуги после раскладки; второй вызов — когда догрузятся шрифты и размеры устаканятся
  setTimeout(drawOrgLinks, 0);
  setTimeout(drawOrgLinks, 250);
  const emps = state.employees;
  const byName = (a, b) => a.name.localeCompare(b.name, 'ru');

  // руководитель -> его подчинённые
  const kids = new Map();
  emps.forEach(e => {
    const k = (e.reports_to || '').trim();
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k).push(e);
  });
  const teamOf = e => (kids.get(e.name) || []).slice().sort(byName);
  // вся команда человека одним списком, с глубиной для отступа.
  // Подчинённый из другого отдела (unit) уходит в отдельную колонку spin, где его руководитель стоит во главе —
  // так человек может вести новый отдел и оставаться в своём (Абдуллаев: аппаратный + ИИ-автоматизация, 23.09.2026)
  const flatten = (e, depth = 0, out = [], unit = '', spin = null) => {
    teamOf(e).forEach(c => {
      const cu = (c.unit || '').trim();
      if (spin && unit && cu && cu !== unit) {
        if (!spin.has(cu)) spin.set(cu, { lead: e, people: [] });
        const g = spin.get(cu);
        g.people.push({ e: c, depth: 0 });
        flatten(c, 1, g.people, cu, spin);
        return;
      }
      out.push({ e: c, depth });
      flatten(c, depth + 1, out, unit, spin);
    });
    return out;
  };
  // ранг по должности: руководители → старшие → обычные → middle → младшие
  const rank = e => {
    const p = (e.position || '').toLowerCase();
    if (/директор|руководител|владелец продукта|\b(ceo|cto|coo|cfo|cbdo)\b|head of|chief|director/.test(p)) return 0;
    if (/старш|senior|\blead\b/.test(p)) return 1;
    if (/middle/.test(p)) return 3;
    if (/младш|junior/.test(p)) return 4;
    return 2;
  };
  // внутри ветки: сначала уровень выше, внутри уровня — по рангу, потом по имени
  const orderPeople = list => list.slice().sort((a, b) =>
    a.depth - b.depth || rank(a.e) - rank(b.e) || byName(a.e, b.e));

  const ceo = emps.find(e => e.department === 'Руководство') || null;
  const known = new Set(DIVISIONS.map(d => d[0]));
  const extra = [...new Set(emps.map(e => e.department))]
    .filter(d => d && !known.has(d) && d !== 'Руководство' && d !== 'Без отдела').sort();
  const divs = DIVISIONS.map(([name, code]) => ({ name, code }))
    .concat(extra.map(name => ({ name, code: '' })))
    .filter(d => emps.some(e => e.department === d.name));
  const unassigned = emps.filter(e => !e.department || e.department === 'Без отдела').sort(byName);
  // Всё свёрнуто, если рендер не вызван явным раскрытием/сворачиванием пользователем.
  if (!state.orgKeep || !state.orgCollapsed) state.orgCollapsed = new Set(divs.map(d => d.name));
  state.orgKeep = false;

  const ava = (e, cls = '') => `<div class="org-ava ${cls}" style="--h:${hueOf(e.name)}">${initials(e.name)}</div>`;
  const row = (e, depth = 0, lead = false) => `
    <div class="og-row clickable${lead ? ' lead' : ''}" style="${depth ? `margin-left:${depth * 18}px` : ''}"
         onclick="openEmployeeCard('${e.id}')" title="Открыть карточку">
      ${ava(e, lead ? 'orange' : '')}
      <div class="og-row-text">
        <div class="org-name">${escapeHtml(e.name)}</div>
        <div class="org-pos">${escapeHtml(e.position || '')}</div>
      </div>
    </div>`;

  const bands = divs.map(d => {
    const members = emps.filter(e => e.department === d.name);
    const head = members.find(e => Number(e.is_head)) || null;
    const inDiv = new Set(members.map(m => m.name));
    // верх ветки — все, кто не подчиняется кому-то другому внутри подразделения: подчинённые главы,
    // а также те, у кого руководитель не указан или он из другого подразделения — иначе такие люди пропадают из Road Map
    const roots = members.filter(e => e !== head && (() => {
      const rt = (e.reports_to || '').trim();
      return !inDiv.has(rt) || (head && rt === head.name);
    })()).sort(byName);
    const directToCeo = !head && ceo && roots.length && roots.every(e => (e.reports_to || '').trim() === ceo.name);

    // группы-колонки: каждый прямой подчинённый с командой = отдел; остальные — по названию отдела или общей колонкой
    const groups = [];
    const spin = new Map();
    roots.filter(r => teamOf(r).length).forEach(r => {
      groups.push({ title: (r.unit || '').trim() || `Команда — ${r.name}`, lead: r, people: orderPeople(flatten(r, 0, [], (r.unit || '').trim(), spin)) });
    });
    spin.forEach((g, u) => groups.push({ title: u, lead: g.lead, people: orderPeople(g.people) }));
    const singles = roots.filter(r => !teamOf(r).length);
    const byUnit = new Map();
    singles.forEach(r => {
      const u = (r.unit || '').trim();
      if (!byUnit.has(u)) byUnit.set(u, []);
      byUnit.get(u).push(r);
    });
    [...byUnit.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || a[0].localeCompare(b[0], 'ru')).forEach(([u, list]) => {
      groups.push({
        title: u || (head ? `Напрямую · ${d.code || head.name}` : 'Сотрудники'),
        lead: null, people: orderPeople(list.map(e => ({ e, depth: 0 }))),
      });
    });

    const collapsed = state.orgCollapsed.has(d.name);
    return `
      <div class="og-band${collapsed ? ' collapsed' : ''}" data-div="${escapeHtml(d.name)}">
        <div class="og-band-head" onclick="toggleOrgDiv(${jsArg(d.name)})" role="button">
          <div class="og-band-title" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>
          <div class="og-band-who${head ? '' : ' vacant'}">${head ? escapeHtml(head.name) : (directToCeo ? 'Напрямую CEO' : 'Вакансия')}</div>
          <span class="og-band-code">${d.code ? `<span class="org-code">${escapeHtml(d.code)}</span>` : ''}</span>
          <span class="og-chevron">${collapsed ? 'Показать сотрудников ▾' : 'Скрыть ▴'}</span>
        </div>
        ${collapsed ? '' : `
        <div class="og-groups">
          ${groups.length ? groups.map(g => `
            <div class="og-group">
              <div class="og-group-title">${escapeHtml(g.title)}</div>
              ${g.lead ? row(g.lead, 0, true) : ''}
              ${g.people.map(p => row(p.e, p.depth)).join('')}
            </div>`).join('') : '<div class="widget-empty">Пока никого</div>'}
        </div>`}
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="section-head">
      <div>
        <div class="section-title">Community Road Map</div>
      </div>
      <div class="og-tools">
        <button class="btn secondary" onclick="setAllOrg(true)">Свернуть все</button>
        <button class="btn secondary" onclick="setAllOrg(false)">Развернуть все</button>
        <button class="btn" onclick="openPersonForm()">Добавить сотрудника</button>
      </div>
    </div>
    <div class="org-top" id="orgTop">
    <svg class="org-links" id="orgLinks" aria-hidden="true"></svg>
    ${ceo ? `
      <div class="org-ceo" id="orgCeo">
        ${ava(ceo, 'big')}
        <div>
          <div class="org-ceo-label"><span class="org-ceo-tag">CEO</span> Генеральный директор</div>
          <div class="org-ceo-name">${escapeHtml(ceo.name)}</div>
          <div class="org-ceo-sub">${divs.length} подразделений подчиняются напрямую</div>
        </div>
      </div>` : ''}
    <div class="org-heads">
      ${divs.map(d => {
        const members = emps.filter(e => e.department === d.name);
        const head = members.find(e => Number(e.is_head)) || null;
        // без руководителя: либо группа под гендиректором, либо место вакантно
        const toCeo = !head && ceo && members.length && members.every(e => (e.reports_to || '').trim() === ceo.name || members.some(m => m.name === (e.reports_to || '').trim()));
        return `
          <div class="org-head-card${head ? '' : ' vacant'}" onclick="openOrgDiv(${jsArg(d.name)})" role="button" title="Открыть подразделение">
            ${d.code ? `<span class="org-code">${escapeHtml(d.code)}</span>` : ''}
            ${head ? ava(head, 'orange') : `<div class="org-ava vacant">${toCeo ? 'CEO' : '—'}</div>`}
            <div class="org-head-name">${head ? escapeHtml(head.name) : (toCeo ? 'Напрямую CEO' : 'Вакансия')}</div>
            <div class="org-head-pos">${head ? escapeHtml(head.position || '') : escapeHtml(d.name)}</div>
            <div class="org-head-count">${members.length} ${pluralRu(members.length, 'человек', 'человека', 'человек')}</div>
          </div>`;
      }).join('')}
    </div>
    </div>
    <div class="og-bands">${bands}</div>
    ${unassigned.length ? `
      <div class="og-band">
        <div class="og-band-head static">
          <div class="og-band-title">Вне структуры</div>
          <span class="org-count">${unassigned.length}</span>
        </div>
        <div class="og-groups"><div class="og-group">${unassigned.map(e => row(e)).join('')}</div></div>
      </div>` : ''}`;
}

// =========================================================
// PROJECTS — витрина направлений компании
// =========================================================
function renderProjects(main) {
  const opened = state.projectOpen && state.projects.find(p => p.id === state.projectOpen);
  if (opened) return renderProjectPage(main, opened);
  // Порядок — как добавляли: флагман первым.
  let items = state.projects.slice().sort((a, b) => (a.created || '').localeCompare(b.created || ''));
  if (state.search) {
    items = items.filter(p => [p.title, p.client, p.description]
      .some(v => (v || '').toLowerCase().includes(state.search)));
  }
  let html = `
    <div class="section-head">
      <div><div class="section-title">Проекты</div></div>
      <button class="btn" onclick="openProjectForm()">Добавить проект</button>
    </div>`;

  if (!items.length) {
    html += `<div class="empty"><strong>Проектов пока нет</strong></div>`;
    main.innerHTML = html;
    return;
  }

  html += `<div class="project-list">` + items.map(p => {
    const d = projectDetails(p);
    return `
    <div class="project-card clickable" onclick="openProject('${p.id}')" role="button">
      <div class="project-card-head">
        <div class="project-mark">${ico(d ? d.mark : 'folder')}</div>
        <div>
          <div class="project-title">${escapeHtml(p.title)}</div>
          ${p.client ? `<div class="project-client">${escapeHtml(p.client)}</div>` : ''}
        </div>
      </div>
      ${p.description ? `<div class="project-desc clamp">${escapeHtml(p.description)}</div>` : ''}
      <div class="project-foot">
        ${p.manager ? `<span class="project-lead">${ico('user')} ${escapeHtml(p.manager)}</span>` : '<span></span>'}
        <span class="project-more">Команда и подробности →</span>
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn text" onclick="deleteItem('projects','${p.id}')">Удалить</button>
      </div>
    </div>`; }).join('') + `</div>`;
  main.innerHTML = html;
}

function openProjectForm() {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Новый проект</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название</label><input id="fPrTitle" type="text"></div>
        <div class="field"><label>Короткая подпись (необязательно)</label><input id="fPrClient" type="text"></div>
        <div class="field"><label>Описание (необязательно)</label><textarea id="fPrDesc"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitProject()">Добавить</button>
      </div>
    </div>`);
}

async function submitProject() {
  const title = document.getElementById('fPrTitle').value.trim();
  if (!title) { showToast('Укажите название проекта'); return; }
  const item = await fetchJson('/api/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      client: document.getElementById('fPrClient').value.trim(),
      description: document.getElementById('fPrDesc').value.trim(),
    }),
  });
  closeModal();
  if (item) { state.projects.push(item); showToast('Проект добавлен'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

// =========================================================
// EVENTS (calendar)
// =========================================================
const EVENT_LABELS = { event: 'Событие', vacation: 'Отпуск', holiday: 'Праздник' };
const EVENT_BADGE = { event: 'required', vacation: 'vac', holiday: 'holiday' };   // плашки в фирменных цветах (08.10.2026: «не чёрные, в оранжевом стиле»)

// ---------- календарь на месяц ----------
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
state.cal = state.cal || (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();

function calShift(delta) {
  const d = new Date(state.cal.y, state.cal.m + delta, 1);
  state.cal = { y: d.getFullYear(), m: d.getMonth() };
  render();
}
function calToday() {
  const n = new Date();
  state.cal = { y: n.getFullYear(), m: n.getMonth() };
  render();
}

function renderEvents(main) {
  const { y, m } = state.cal;
  const todayIso = isoDate(new Date());
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;            // неделя с понедельника
  const gridStart = new Date(y, m, 1 - startOffset);

  // события по дням
  const byDay = {};
  state.events.forEach(e => { (byDay[e.date] ||= []).push(e); });
  // дни рождения коллег (по месяцу и дню)
  const bdays = {};
  state.employees.filter(p => p.birthday).forEach(p => {
    const d = new Date(p.birthday);
    if (!isNaN(d)) (bdays[`${d.getMonth()}-${d.getDate()}`] ||= []).push(p);
  });

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const iso = isoDate(d);
    const other = d.getMonth() !== m;
    const evs = byDay[iso] || [];
    const bds = bdays[`${d.getMonth()}-${d.getDate()}`] || [];
    cells += `
      <div class="cal-cell${other ? ' other' : ''}${iso === todayIso ? ' today' : ''}${(d.getDay() === 0 || d.getDay() === 6 || evs.some(e => e.type === 'holiday')) ? ' weekend' : ''}"
           onclick="openEventForm('${iso}')" title="Добавить событие на ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}">
        <div class="cal-day">${d.getDate()}</div>
        <div class="cal-items">
          ${evs.map(e => `<div class="cal-chip ${e.type === 'vacation' ? 'vac' : e.type === 'holiday' ? 'hol' : 'ev'}" onclick="event.stopPropagation();openEventDetail('${e.id}')" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</div>`).join('')}
          ${bds.map(p => `<div class="cal-chip bd" onclick="event.stopPropagation()" title="День рождения: ${escapeHtml(p.name)}">${ico('cake')} ${escapeHtml(p.name.split(' ')[0])}</div>`).join('')}
        </div>
      </div>`;
  }

  const upcoming = state.events.filter(e => e.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Календарь</div></div>
      <button class="btn" onclick="openEventForm()">Добавить событие</button>
    </div>

    <div class="cal">
      <div class="cal-head">
        <button class="cal-nav" onclick="calShift(-1)" title="Предыдущий месяц">‹</button>
        <div class="cal-title">${MONTHS_RU[m]} ${y}</div>
        <button class="cal-nav" onclick="calShift(1)" title="Следующий месяц">›</button>
        <button class="btn secondary cal-today" onclick="calToday()">Сегодня</button>
        <div class="cal-legend"><span class="ev">Событие</span><span class="vac">Отпуск</span><span class="hol">Праздник</span><span class="bd">День рождения</span></div>
      </div>
      <div class="cal-weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => `<div>${w}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>

    <div class="section-head" style="margin-top:30px;">
      <div><div class="section-title" style="font-size:20px;">Ближайшие</div></div>
    </div>
    ${upcoming.length ? `<div class="doc-group">` + upcoming.map(e => `
      <div class="event-row">
        <div class="event-date">${fmtShortDate(e.date)}</div>
        <div style="flex:1;">
          <div class="event-title">${escapeHtml(e.title)}</div>
          ${e.description ? `<div class="event-desc">${escapeHtml(e.description)}</div>` : ''}
        </div>
        <span class="badge ${EVENT_BADGE[e.type] || 'required'} event-type">${EVENT_LABELS[e.type] || 'Событие'}</span>
        ${e.type === 'holiday' ? '' : `<button class="btn text" onclick="deleteItem('events','${e.id}')">Удалить</button>`}
      </div>`).join('') + `</div>`
    : `<div class="empty"><strong>Впереди пока пусто</strong></div>`}`;
}

function openEventDetail(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${escapeHtml(e.title)}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div><span class="badge ${EVENT_BADGE[e.type] || 'required'}">${EVENT_LABELS[e.type] || 'Событие'}</span></div>
        <div class="event-title" style="margin-top:6px;">${fmtDate(e.date)}</div>
        ${e.description ? `<div class="event-desc" style="font-size:14px;margin-top:8px;white-space:pre-wrap;">${escapeHtml(e.description)}</div>` : ''}
      </div>
      <div class="modal-foot">
        ${e.type === 'holiday' ? '' : `<button class="btn text" onclick="closeModal();deleteItem('events','${e.id}')">Удалить</button>`}
        <button class="btn secondary" onclick="closeModal()">Закрыть</button>
      </div>
    </div>`);
}

function openEventForm(date) {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Новое событие</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название</label><input id="fEvTitle" type="text"></div>
        <div class="field"><label>Дата</label><input id="fEvDate" type="date" value="${date || ''}"></div>
        <div class="field"><label>Тип</label>
          <select id="fEvType">
            <option value="event">Событие</option>
            <option value="vacation">Отпуск</option>
          </select>
        </div>
        <div class="field"><label>Описание (необязательно)</label><textarea id="fEvDesc"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitEvent()">Добавить</button>
      </div>
    </div>`);
}
async function submitEvent() {
  const title = document.getElementById('fEvTitle').value.trim();
  const date = document.getElementById('fEvDate').value;
  const type = document.getElementById('fEvType').value;
  const description = document.getElementById('fEvDesc').value.trim();
  if (!title || !date) { showToast('Укажите название и дату'); return; }
  const item = await fetchJson('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, type, description }),
  });
  closeModal();
  if (item) { state.events.push(item); showToast('Событие добавлено'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

// =========================================================
// FAQ
// =========================================================
function renderFaq(main) {
  let items = state.faq.slice();
  if (state.search) {
    items = items.filter(f => f.question.toLowerCase().includes(state.search) || f.answer.toLowerCase().includes(state.search));
  }
  let html = `
    <div class="section-head">
      <div>
        <a class="back-link" href="#" onclick="goToView('roadmap');return false;">← Новым сотрудникам</a>
        <div class="section-title">Частые вопросы</div>
      </div>
      <button class="btn" onclick="openFaqForm()">Добавить вопрос</button>
    </div>`;

  if (!items.length) {
    html += `<div class="empty"><strong>Вопросов пока нет</strong></div>`;
    main.innerHTML = html;
    return;
  }

  html += `<div class="faq-list">` + items.map((f, i) => `
    <div class="faq-item" id="faq-${f.id}">
      <div class="faq-q" onclick="toggleFaq('${f.id}')">
        <span>${escapeHtml(f.question)}</span>
        <span class="faq-arrow">▾</span>
      </div>
      <div class="faq-a">
        ${linkify(f.answer)}
        <div class="card-actions"><button class="btn text" onclick="deleteItem('faq','${f.id}')">Удалить</button></div>
      </div>
    </div>`).join('') + `</div>
    <div class="back-bottom"><a class="back-link" href="#" onclick="goToView('roadmap');return false;">← Новым сотрудникам</a></div>`;
  main.innerHTML = html;
}

// =========================================================
// КАРТА ОФИСА — план, который нарисовал и загрузил админ, с именами прямо на схеме.
// Метки расставляет HR или админ кликом по плану; координаты хранятся в процентах.
// =========================================================
// режим «Расставить людей» — только админ; правило в UI_RULES ловит именно этот вызов.
// Раньше правило ловило любой «state.officeEdit», и у сотрудников пропадали плашки офисов и отделов (исправлено 24.09.2026)
function toggleOfficeEdit() { if (!isAdmin()) return; state.officeEdit = !state.officeEdit; render(); }

async function renderOffice(main) {
  if (!state.officePlans) {
    const d = await fetchJson('/api/office-plans') || { offices: [], plans: {} };
    state.officePlans = d.plans || {};
    state.officeList = d.offices || [];
  }
  const offices = state.officeList || [];
  const cur = offices.includes(state.officeTab) ? state.officeTab : offices[0] || '';
  const office = state.officePlans[cur] || {};
  const zones = office.zones || [];
  const noFloor = !office.url && zones.length > 0;   // общего плана пока нет — показываем только схемы отделов
  const zi = (typeof state.officeZone === 'number' && state.officeZone >= 0 && state.officeZone < zones.length)
    ? state.officeZone : (noFloor ? 0 : null);       // null = общий план этажа
  state.officeZone = zi;
  const plan = zi === null ? office : zones[zi];
  const where = zi === null ? {} : { zone: zi };     // что правим: общий план или схему отдела
  const marks = (plan.marks || []).filter(m => state.employees.some(e => e.id === m.id));
  const rooms = plan.rooms || [];
  const placed = new Set(marks.map(m => m.id));
  const edit = !!state.officeEdit && isAdmin();
  const q = (state.officeSearch || '').toLowerCase().trim();
  const found = q ? state.employees.filter(e => e.name.toLowerCase().includes(q)) : [];

  const markHtml = m => {
    const e = state.employees.find(x => x.id === m.id);
    const hit = q && e.name.toLowerCase().includes(q);
    return `
      <div class="seat-mark${hit ? ' hit' : (q ? ' dim' : '')}" style="left:${m.x}%;top:${m.y}%" data-id="${e.id}" data-name="${escapeHtml(e.name.toLowerCase())}"
           onclick="event.stopPropagation();${edit ? `removeSeatMark('${e.id}')` : `openEmployeeCard('${e.id}')`}"
           title="${escapeHtml(e.name)}${e.position ? ' — ' + escapeHtml(e.position) : ''}${edit ? ' · нажмите, чтобы убрать с плана' : ''}">
        <i class="seat-dot"></i><span class="seat-tag">${escapeHtml(e.name)}</span>
      </div>`;
  };
  const personRow = e => `
    <div class="seat-row clickable" onclick="openEmployeeCard('${e.id}')" title="Открыть карточку">
      ${e.photo ? `<img class="seat-photo" src="${escapeHtml(e.photo)}" alt="">`
                : `<div class="org-ava seat-ava" style="--h:${hueOf(e.name)}">${initials(e.name)}</div>`}
      <div class="seat-text">
        <div class="seat-name">${escapeHtml(e.name)}</div>
        <div class="seat-pos">${escapeHtml(e.position || e.department || '')}</div>
      </div>
      ${placed.has(e.id) ? '<span class="seat-office">на этой схеме</span>'
        : (officeWhere(e.id) ? `<button class="btn text" onclick="event.stopPropagation();officeGoTo('${e.id}')">${escapeHtml(officeWhere(e.id).name)} →</button>`
        : (e.office ? `<span class="seat-office">${escapeHtml(e.office)}</span>` : '<span class="seat-office">на схемах нет</span>'))}
    </div>`;

  const notPlaced = state.employees
    .filter(e => !placed.has(e.id) && (!e.office || e.office === cur))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Карта офиса</div>
        </div>
      ${isAdmin() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${plan.url ? `<button class="btn ${edit ? '' : 'secondary'}" onclick="toggleOfficeEdit()">${edit ? 'Готово' : 'Расставить людей'}</button>` : ''}
        <button class="btn secondary" onclick="openOfficePlanForm(${jsArg(cur)})">${plan.url ? 'Заменить схему' : 'Загрузить схему'}</button>
        ${zi !== null ? `<button class="btn text" onclick="removeZone(${zi})">Удалить схему</button>` : ''}
      </div>` : ''}
    </div>

    ${offices.length > 1 ? `<div class="dep-chips">${offices.map(o => `
      <button class="dep-chip${o === cur ? ' active' : ''}" onclick="state.officeTab=${JSON.stringify(o).replace(/"/g, '&quot;')};state.officeZone=null;state.officeEdit=false;render()">${escapeHtml(o)}</button>`).join('')}</div>` : ''}

    <div class="dep-chips zone-chips">
      ${noFloor ? '' : `<button class="dep-chip${zi === null ? ' active' : ''}" onclick="state.officeZone=null;state.officeEdit=false;render()">Весь офис
        ${(office.marks || []).length ? `<span>${office.marks.length}</span>` : ''}</button>`}
      ${zones.map((z, i) => `
        <button class="dep-chip${zi === i ? ' active' : ''}" onclick="state.officeZone=${i};state.officeEdit=false;render()">${escapeHtml(z.name)}
          ${(z.marks || []).length ? `<span>${z.marks.length}</span>` : ''}</button>`).join('')}
      ${isAdmin() ? `<button class="dep-chip add" onclick="openZoneForm()">+ схема отдела</button>` : ''}
      ${isAdmin() && noFloor ? `<button class="dep-chip add" onclick="state.officeZone=null;openOfficePlanForm(${JSON.stringify(cur).replace(/"/g, '&quot;')})">+ план всего офиса</button>` : ''}
    </div>

    ${edit ? `` : ''}

    <div class="office-search">
      <input type="text" placeholder="Найти человека на плане" value="${escapeHtml(state.officeSearch || '')}" autocomplete="off"
             oninput="officeSearchInput(this.value)">
      <div id="officeHint" class="field-hint">${officeHint(found, marks)}</div>
    </div>

    ${plan.url ? `
      <div class="office-plan${edit ? ' editing' : ''}">
        <div class="office-plan-wrap" onclick="officePlanClick(event)">
          <img src="${escapeHtml(plan.url)}" alt="План офиса ${escapeHtml(cur)}">
          ${rooms.map((r, i) => `
            <div class="room-tag${zi !== null && r.label === zones[zi].name ? ' title' : ''}" style="left:${r.x}%;top:${r.y}%"
                 ${edit ? `onclick="event.stopPropagation();removeRoomTag(${i})" title="Нажмите, чтобы убрать подпись"` : ''}>${escapeHtml(r.label)}</div>`).join('')}
          ${marks.map(markHtml).join('')}
          ${zi === null && !edit ? (plan.areas || []).map(a => {
            const idx = zones.findIndex(z => z.name === a.zone);
            if (idx < 0) return '';
            const n = (zones[idx].marks || []).length;
            return `<div class="plan-area" style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%"
                 onclick="event.stopPropagation();state.officeZone=${idx};state.officeEdit=false;render()" title="Открыть схему отдела">
              <span>${escapeHtml(a.zone)}${n ? ` · ${n}` : ''}</span></div>`;
          }).join('') : ''}
        </div>
      </div>`
    : `<div class="empty"><strong>Схемы пока нет</strong></div>`}



    ${(edit && notPlaced.length) ? `<div class="req-list-title">Ещё не на плане · ${notPlaced.length}</div>
      <div class="seat-list">${notPlaced.map(personRow).join('')}</div>` : ''}`;
}

// подсказка под полем поиска: никого нет / человек есть, но не на схемах
function officeHint(found, marksHere) {
  const q = (state.officeSearch || '').trim();
  if (!q) return '';
  if (!found.length) return 'Никого не нашёл — проверьте написание.';
  const here = new Set((marksHere || []).map(m => m.id));
  if (found.some(e => here.has(e.id))) return '';
  const w = found.map(e => officeWhere(e.id)).find(Boolean);
  return w ? '' : `${escapeHtml(found[0].name)} — на схемах офиса пока не отмечен${found.length > 1 ? ` (и ещё ${found.length - 1})` : ''}.`;
}

// на какой схеме офиса сидит человек: {zone: индекс или null (общий план), name}
function officeWhere(id) {
  for (const office of Object.values(state.officePlans || {})) {
    if ((office.marks || []).some(m => m.id === id)) return { zone: null, name: 'Весь офис' };
    const zi = (office.zones || []).findIndex(z => (z.marks || []).some(m => m.id === id));
    if (zi >= 0) return { zone: zi, name: office.zones[zi].name };
  }
  return null;
}

function officeGoTo(id) {
  const w = officeWhere(id);
  if (!w) return;
  const e = state.employees.find(x => x.id === id);
  state.officeZone = w.zone; state.officeEdit = false;
  if (e) state.officeSearch = e.name;
  render();
}

// поиск по схеме: подсвечиваем найденных прямо на месте, остальных гасим; раздел не перерисовываем,
// чтобы поле не теряло фокус на каждой букве. Если на этой схеме никого, а человек сидит на другой — переходим туда.
function officeSearchInput(v) {
  state.officeSearch = v;
  const q = v.toLowerCase().trim();
  const marks = [...document.querySelectorAll('.seat-mark')];
  let hits = 0;
  marks.forEach(m => {
    const hit = q && (m.dataset.name || '').includes(q);
    m.classList.toggle('hit', !!hit);
    m.classList.toggle('dim', !!q && !hit);
    if (hit) hits++;
  });
  const found = q ? state.employees.filter(e => e.name.toLowerCase().includes(q)) : [];
  if (q && !hits) {                     // никого здесь — а есть ли на другой схеме?
    const other = found.map(e => officeWhere(e.id)).find(Boolean);
    if (other && other.zone !== state.officeZone) {
      state.officeZone = other.zone; state.officeEdit = false;
      render();
      const inp = document.querySelector('.office-search input');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      return;
    }
  }
  const hint = document.getElementById('officeHint');
  if (hint) hint.innerHTML = officeHint(found, marks.map(m => ({ id: m.dataset.id })));
}

// клик по плану в режиме расстановки — запоминаем точку и выбираем человека
function officePlanClick(ev) {
  if (!state.officeEdit || !isAdmin()) return;
  const box = ev.currentTarget.getBoundingClientRect();
  const x = ((ev.clientX - box.left) / box.width) * 100;
  const y = ((ev.clientY - box.top) / box.height) * 100;
  openSeatPicker(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
}

function officeHint(found, marksHere) {
  const q = (state.officeSearch || '').trim();
  if (!q) return '';
  if (!found.length) return 'Никого не нашёл — проверьте написание.';
  const here = new Set((marksHere || []).map(m => m.id));
  if (found.some(e => here.has(e.id))) return '';
  const w = found.map(e => officeWhere(e.id)).find(Boolean);
  return w ? '' : `${escapeHtml(found[0].name)} — на схемах офиса пока не отмечен${found.length > 1 ? ` (и ещё ${found.length - 1})` : ''}.`;
}

// на какой схеме офиса сидит человек: {zone: индекс или null (общий план), name}
function officeWhere(id) {
  for (const office of Object.values(state.officePlans || {})) {
    if ((office.marks || []).some(m => m.id === id)) return { zone: null, name: 'Весь офис' };
    const zi = (office.zones || []).findIndex(z => (z.marks || []).some(m => m.id === id));
    if (zi >= 0) return { zone: zi, name: office.zones[zi].name };
  }
  return null;
}

function officeGoTo(id) {
  const w = officeWhere(id);
  if (!w) return;
  const e = state.employees.find(x => x.id === id);
  state.officeZone = w.zone; state.officeEdit = false;
  if (e) state.officeSearch = e.name;
  render();
}

// поиск по схеме: подсвечиваем найденных прямо на месте, остальных гасим; раздел не перерисовываем,
// чтобы поле не теряло фокус на каждой букве. Если на этой схеме никого, а человек сидит на другой — переходим туда.
function officeSearchInput(v) {
  state.officeSearch = v;
  const q = v.toLowerCase().trim();
  const marks = [...document.querySelectorAll('.seat-mark')];
  let hits = 0;
  marks.forEach(m => {
    const hit = q && (m.dataset.name || '').includes(q);
    m.classList.toggle('hit', !!hit);
    m.classList.toggle('dim', !!q && !hit);
    if (hit) hits++;
  });
  const found = q ? state.employees.filter(e => e.name.toLowerCase().includes(q)) : [];
  if (q && !hits) {                     // никого здесь — а есть ли на другой схеме?
    const other = found.map(e => officeWhere(e.id)).find(Boolean);
    if (other && other.zone !== state.officeZone) {
      state.officeZone = other.zone; state.officeEdit = false;
      render();
      const inp = document.querySelector('.office-search input');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      return;
    }
  }
  const hint = document.getElementById('officeHint');
  if (hint) hint.innerHTML = officeHint(found, marks.map(m => ({ id: m.dataset.id })));
}

// клик по плану в режиме расстановки — запоминаем точку и выбираем человека
function officePlanClick(ev) {
  if (!state.officeEdit || !isAdmin()) return;
  const box = ev.currentTarget.getBoundingClientRect();
  const x = ((ev.clientX - box.left) / box.width) * 100;
  const y = ((ev.clientY - box.top) / box.height) * 100;
  openSeatPicker(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
}

function openSeatPicker(x, y) {
  const placed = new Set((currentPlan().marks || []).map(m => m.id));
  const list = state.employees.filter(e => !placed.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Что здесь находится</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название помещения</label>
          <div class="seat-room-row">
            <input id="roomLabel" type="text" autocomplete="off"
                   onkeydown="if(event.key==='Enter'){addRoomTag(${x.toFixed(2)},${y.toFixed(2)})}">
            <button class="btn secondary" onclick="addRoomTag(${x.toFixed(2)},${y.toFixed(2)})">Подписать</button>
          </div>
        </div>
        <div class="field"><label>Или поставить сюда человека</label>
          <input id="seatSearch" type="text" placeholder="Начните вводить фамилию" autocomplete="off"
               oninput="filterSeatPicker(this.value)"></div>
        <div class="seat-picker" id="seatPicker">
          ${list.map(e => `
            <button class="seat-pick" data-name="${escapeHtml(e.name.toLowerCase())}" onclick="addSeatMark('${e.id}',${x.toFixed(2)},${y.toFixed(2)})">
              ${e.photo ? `<img src="${escapeHtml(e.photo)}" alt="">` : `<span class="org-ava seat-ava" style="--h:${hueOf(e.name)}">${initials(e.name)}</span>`}
              <span class="seat-pick-text"><b>${escapeHtml(e.name)}</b><small>${escapeHtml(e.position || e.department || '')}</small></span>
            </button>`).join('')}
        </div>
      </div>
    </div>`);
  setTimeout(() => { const i = document.getElementById('roomLabel'); if (i) i.focus(); }, 60);
}

function filterSeatPicker(q) {
  const s = (q || '').toLowerCase().trim();
  document.querySelectorAll('#seatPicker .seat-pick').forEach(b => {
    b.style.display = !s || b.dataset.name.includes(s) ? '' : 'none';
  });
}

async function saveOfficePlanPart(part) {
  const cur = state.officeTab || (state.officeList || [])[0] || '';
  const zone = typeof state.officeZone === 'number' ? { zone: state.officeZone } : {};
  const res = await fetchJson('/api/office-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ office: cur, ...zone, ...part }) });
  if (!res) return showToast('Не удалось сохранить');
  state.officePlans = res.plans || {};
  render();
}

// текущая схема: общий план офиса или схема отдела
function currentPlan() {
  const cur = state.officeTab || (state.officeList || [])[0] || '';
  const office = (state.officePlans || {})[cur] || {};
  return typeof state.officeZone === 'number' ? ((office.zones || [])[state.officeZone] || {}) : office;
}

function addRoomTag(x, y) {
  const input = document.getElementById('roomLabel');
  const label = (input ? input.value : '').trim();
  if (!label) return showToast('Впишите название');
  const rooms = (currentPlan().rooms || []).slice();
  rooms.push({ label, x, y });
  closeModal();
  saveOfficePlanPart({ rooms });
}

function removeRoomTag(i) {
  saveOfficePlanPart({ rooms: (currentPlan().rooms || []).filter((_, j) => j !== i) });
}

// схема отдела: добавить и удалить
function openZoneForm() {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Схема отдела</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название</label>
          <input id="zoneName" type="text" autocomplete="off"></div>
        <div class="field"><label>Картинка схемы</label>
          <input id="zoneFile" type="file" accept="image/*" onchange="previewImage(this,'zonePreview')">
          
          <img id="zonePreview" class="preview-thumb" style="display:none;">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="zoneSave" onclick="saveZone()">Добавить</button>
      </div>
    </div>`);
  setTimeout(() => { const i = document.getElementById('zoneName'); if (i) i.focus(); }, 60);
}

async function saveZone() {
  const name = (document.getElementById('zoneName').value || '').trim();
  const input = document.getElementById('zoneFile');
  if (!name) return showToast('Впишите название отдела');
  if (!input.files[0]) return showToast('Выберите картинку схемы');
  const btn = document.getElementById('zoneSave');
  if (btn) { btn.disabled = true; btn.textContent = 'Загружаем…'; }
  const url = await uploadFile(input);
  if (!url) { if (btn) { btn.disabled = false; btn.textContent = 'Добавить'; } return; }
  const cur = state.officeTab || (state.officeList || [])[0] || '';
  const res = await fetchJson('/api/office-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ office: cur, newZone: name, url }) });
  closeModal();
  if (!res) return showToast('Не удалось сохранить');
  state.officePlans = res.plans || {};
  state.officeZone = ((state.officePlans[cur] || {}).zones || []).length - 1;   // сразу открываем новую схему
  showToast('Схема добавлена');
  render();
}

async function removeZone(i) {
  const cur = state.officeTab || (state.officeList || [])[0] || '';
  const name = (((state.officePlans[cur] || {}).zones || [])[i] || {}).name || 'схему';
  if (!await confirmDialog({ title: 'Удалить схему?', text: `«${escapeHtml(name)}» будет удалена вместе с расставленными на ней людьми.` })) return;
  const res = await fetchJson('/api/office-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ office: cur, zone: i, remove: true }) });
  if (!res) return showToast('Не удалось удалить');
  state.officePlans = res.plans || {};
  state.officeZone = null;
  showToast('Схема удалена');
  render();
}

async function saveSeatMarks(marks) {
  return saveOfficePlanPart({ marks });     // сохраняем в текущую схему: общий план или отдел
}

function addSeatMark(id, x, y) {
  const marks = (currentPlan().marks || []).filter(m => m.id !== id);
  marks.push({ id, x, y });
  closeModal();
  saveSeatMarks(marks);
}

function removeSeatMark(id) {
  saveSeatMarks((currentPlan().marks || []).filter(m => m.id !== id));
}

function openOfficePlanForm(office) {
  const plan = currentPlan();
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>План офиса · ${escapeHtml(office)}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Картинка плана</label>
          <input id="opFile" type="file" accept="image/*" onchange="previewImage(this,'opPreview')">
          
          <img id="opPreview" class="preview-thumb" style="display:none;">
        </div>
        ${plan.url ? `<div class="news-photo-current"><img src="${escapeHtml(plan.url)}" alt=""></div>` : ''}
      </div>
      <div class="modal-foot">
        ${plan.url ? `<button class="btn text" onclick="saveOfficePlan(${jsArg(office)}, true)">Убрать план</button>` : ''}
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="opSave" onclick="saveOfficePlan(${jsArg(office)})">Сохранить</button>
      </div>
    </div>`);
}

async function saveOfficePlan(office, clear) {
  const zone = typeof state.officeZone === 'number' ? { zone: state.officeZone } : {};
  const btn = document.getElementById('opSave');
  let url = '';
  if (!clear) {
    const input = document.getElementById('opFile');
    if (!input.files[0]) return showToast('Выберите картинку плана');
    if (btn) { btn.disabled = true; btn.textContent = 'Загружаем…'; }
    url = await uploadFile(input);
    if (!url) { if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; } return; }
  }
  const res = await fetchJson('/api/office-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ office, ...zone, url }) });
  closeModal();
  if (!res) return showToast('Не удалось сохранить');
  state.officePlans = res.plans || {};
  showToast(clear ? 'План убран' : 'Схема обновлена');
  render();
}

// =========================================================
// КАБИНЕТ РУКОВОДИТЕЛЯ — своя команда: кто где сегодня, опоздания, табель, кто ещё не в портале.
// Пункт в меню виден всем; внутрь пускает только глав подразделений и админа (решение пользователя 22.09.2026).
// =========================================================
const MGR_TABS = ['approve', 'team', 'late', 'attendance', 'access'];
const ACCOUNT_LABEL = { active: ['Пользуется порталом', 'done'], ready: ['Пароль задан, не входил', 'progress'],
  invited: ['Приглашён, не активировал', 'new'], none: ['Нет учётной записи', 'cancelled'] };

async function renderManager(main) { return renderManagerInto(main, null); }
// пока кабинет открыт, обновляем его каждые 5 минут — вслед за опросом турникета (просьба пользователя 22.09.2026)
setInterval(() => {
  if (!state.user || document.querySelector('.modal-overlay, .modal')) return;   // не дёргаем открытое окно
  if (state.view === 'manager' || (state.view === 'admin' && state.adminTab === 'cabinets')) render();
}, 5 * 60 * 1000);

// box — куда рисовать (страница или вкладка админки); asId — чей кабинет показать (только админу)
async function renderManagerInto(main, asId) {
  const AS = asId ? `?as=${asId}` : '';
  if (!isManager()) {
    main.innerHTML = `
      <div class="section-head"><div><div class="section-title">Кабинет руководителя</div>
        </div></div>
      <div class="mgr-denied">
        <div class="mgr-denied-mark">${ico('lock')}</div>
        <div>
          <div class="mgr-denied-title">Только для руководителей подразделений</div>
          <div class="mgr-denied-text">Здесь руководитель видит свою команду: кто сегодня в офисе, кто на объекте или в отпуске,
            опоздания за неделю и табель. Доступ есть у глав подразделений — их отмечает отдел кадров в справочнике.</div>
          <div class="mgr-denied-text">Если вы руководите подразделением, а кабинет закрыт — напишите в отдел кадров, чтобы вас отметили руководителем.</div>
        </div>
      </div>`;
    return;
  }
  let tab = MGR_TABS.includes(state.mgrTab) ? state.mgrTab : 'team';
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  const T = await fetchJson('/api/manager/team' + AS);
  if (!T) { main.innerHTML = '<div class="empty"><strong>Не удалось загрузить команду</strong></div>'; return; }
  const team = T.team || [];
  const inOffice = team.filter(p => p.present).length;
  const away = team.filter(p => !p.present && (p.mark || (p.vacation && p.vacation.now) || p.arrived)).length;
  const notIn = team.filter(p => p.account !== 'active').length;
  const late = await fetchJson('/api/manager/lateness' + (AS ? AS + '&' : '?') + (state.mgrWeek ? 'start=' + state.mgrWeek : '')) || { late: [], excused: [], has_passes: false, unmapped: 0, remote_names: [] };
  const tile = (key, num, label, hot) => `
    <button class="hr-tile ${tab === key ? 'active' : ''} ${hot ? 'hot' : ''}" onclick="state.mgrTab='${key}';render()">
      <span class="hr-tile-num">${num}</span><span class="hr-tile-label">${label}</span></button>`;
  const me = T.me || {};
  const isHead = !!Number(me.is_head);
  const apprAll = me.id ? approvalsForMe(me.id) : [];
  const apprPending = apprAll.filter(r => r.status === 'approval');
  if (!MGR_TABS.includes(state.mgrTab)) tab = apprPending.length ? 'approve' : 'team';   // есть что согласовать — открываем сразу
  if (state.mgrTab !== tab) state.mgrTab = tab;
  const remoteN = team.filter(p => p.remote && !p.arrived && !p.mark).length;
  const vacN = team.filter(p => p.vacation && p.vacation.now).length;
  const todayStr = astanaNow().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const hero = `
    <div class="mgr-hero">
      ${me.photo ? `<img class="mgr-hero-photo" src="${escapeHtml(me.photo)}" alt="">`
                 : `<div class="mgr-hero-ava" style="--h:${hueOf(me.name || 'A')}">${initials(me.name || 'А')}</div>`}
      <div class="mgr-hero-text">
        <div class="mgr-hero-kicker">Кабинет руководителя · ${todayStr}${T.view_as ? ' · <span class="mgr-viewas">режим просмотра как у руководителя</span>' : ''}</div>
        <div class="mgr-hero-name">${escapeHtml(me.name || 'Администратор')}</div>
        <div class="mgr-hero-pos">${escapeHtml(me.position || '')}${me.position && me.department ? ' · ' : ''}${escapeHtml(me.department || '')}</div>
        <div class="mgr-hero-scope">${isHead ? `Ваша команда: <b>${team.length}</b> ${pluralRu(team.length, 'человек', 'человека', 'человек')}`
          : `Режим администратора: вся компания, <b>${team.length}</b> ${pluralRu(team.length, 'человек', 'человека', 'человек')}`}</div>
      </div>
      <div class="mgr-hero-stats">
        <div><b>${inOffice}</b><span>в офисе</span></div>
        <div><b>${away}</b><span>отсутствуют</span></div>
        <div><b>${remoteN}</b><span>удалённо</span></div>
        <div><b>${vacN}</b><span>в отпуске</span></div>
      </div>
    </div>`;

  let body = '';
  if (tab === 'approve') {
    const done = apprAll.filter(r => r.status !== 'approval').slice(0, 20);
    body = (apprPending.length ? `<div class="req-list-title">Ждут вашего решения · ${apprPending.length}</div>
        <div class="req-list">${apprPending.map(r => requestRowHtml(r, true)).join('')}</div>`
      : '<div class="empty"><strong>Нечего согласовывать</strong></div>')
      + (done.length ? `<div class="req-list-title" style="margin-top:22px">Уже решено</div>
        <div class="req-list">${done.map(r => requestRowHtml(r, true)).join('')}</div>` : '');
  }
  else if (tab === 'team') body = managerTeamHtml(T);
  else if (tab === 'late') body = hrLatenessHtml(late, { hideStatus: true, readonly: true, weekVar: 'mgrWeek' });
  else if (tab === 'attendance') body = '<div id="mgrAtt"><div class="loading">Загрузка…</div></div>';
  else if (tab === 'access') {
    const order = { none: 0, invited: 1, ready: 2, active: 3 };
    const list = team.slice().sort((a, b) => order[a.account] - order[b.account] || a.name.localeCompare(b.name, 'ru'));
    body = `
      
      <div class="hr-table">${list.map(p => { const [l, c] = ACCOUNT_LABEL[p.account] || ACCOUNT_LABEL.none; return `
        <div class="hr-row">
          ${p.photo ? `<img class="seat-photo" src="${escapeHtml(p.photo)}" alt="">` : `<div class="org-ava" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`}
          <div class="hr-row-main"><div class="hr-row-name">${escapeHtml(p.name)}</div><div class="hr-row-sub">${escapeHtml(p.position || p.department || '')}</div></div>
          <span class="req-status ${c}">${l}</span>
        </div>`; }).join('')}</div>`;
  }

  main.innerHTML = `
    ${hero}
    <div class="hr-tiles">
      ${tile('approve', apprPending.length, 'заявок на согласование', apprPending.length > 0)}
      ${tile('team', inOffice, 'сейчас в офисе', false)}
      ${tile('late', late.late.length, 'опозданий без причины за неделю', late.late.length > 0)}
      ${tile('attendance', away, 'отсутствуют по табелю сегодня', false)}
      ${tile('access', notIn, 'ещё не в портале', notIn > 0)}
    </div>
    <div class="hr-body">${body}</div>`;

  if (tab === 'attendance') {
    if (!att.month) att.month = astanaNow().toISOString().slice(0, 7);
    const d = await fetchJson('/api/manager/attendance?month=' + att.month + (AS ? '&as=' + asId : ''));
    const box = document.getElementById('mgrAtt');
    if (!box) return;
    if (!d) { box.innerHTML = '<div class="empty"><strong>Не удалось загрузить табель</strong></div>'; return; }
    d.embedded = true;
    att.data = d;
    drawAttendance(box);
  }
}

// «Команда сегодня»: одна строка на человека — где он и что с ним
function managerTeamHtml(T) {
  const team = T.team || [];
  const codeName = Object.fromEntries(T.codes || []);
  if (!team.length) return `<div class="empty"><strong>В команде пока никого</strong></div>`;
  const status = p => {
    if (p.vacation && p.vacation.now) return ['away', `${p.vacation.code === 'БС' ? 'Без сохранения' : 'В отпуске'} до ${fmtShortDate(p.vacation.end)}`];
    if (p.mark) return [p.mark.code === 'У' || p.mark.code === 'З' ? 'work' : 'away',
      `${codeName[p.mark.code] || p.mark.code}${p.mark.comment ? ' — ' + p.mark.comment : ''}`];
    if (p.arrived) {
      // вышел и нет дольше порога — «нет в офисе»; короткие выходы (перекур, обед) не показываем вовсе
      if (p.last_dir === 'out' && p.away_min > (T.away_min || 30))
        return ['away', `Нет в офисе с ${p.last_at} · пришёл в ${p.arrived}`];
      return ['in', `В офисе с ${p.arrived}${p.office ? ' · ' + p.office : ''}`];
    }
    if (p.remote) return ['work', 'Работает удалённо'];
    if (!p.has_card) return ['none', 'Нет карточки турникета'];
    return ['none', T.has_passes ? 'Прохода сегодня не было' : 'Турникет ещё не подключён'];
  };
  const order = { in: 0, work: 1, away: 2, none: 3 };
  const rows = team.map(p => ({ p, s: status(p) })).sort((a, b) => order[a.s[0]] - order[b.s[0]] || a.p.name.localeCompare(b.p.name, 'ru'));
  // группируем по отделам внутри подразделения (поле «отдел» в карточке); без отдела — в конец
  const groups = new Map();
  for (const x of rows) { const g = x.p.unit || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(x); }
  const keys = [...groups.keys()].sort((a, b) => (a === '') - (b === '') || groups.get(b).length - groups.get(a).length || a.localeCompare(b, 'ru'));
  const rowHtml = ({ p, s }) => `
      <div class="hr-row mgr-row clickable" onclick="openEmployeeCard('${p.id}')" title="Открыть карточку">
        ${p.photo ? `<img class="seat-photo" src="${escapeHtml(p.photo)}" alt="">` : `<div class="org-ava" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`}
        <div class="hr-row-main">
          <div class="hr-row-name">${escapeHtml(p.name)}</div>
          <div class="hr-row-sub">${escapeHtml(p.position || p.department || '')}</div>
        </div>
        <div class="mgr-extras">
          ${p.birthday_in !== undefined ? `<span class="mgr-chip">${ico('cake')} ${p.birthday_in === 0 ? 'день рождения сегодня' : p.birthday_in === 1 ? 'день рождения завтра' : 'день рождения через ' + p.birthday_in + ' ' + pluralRu(p.birthday_in, 'день', 'дня', 'дней')}</span>` : ''}
          ${p.vacation && !p.vacation.now ? `<span class="mgr-chip">${ico('sun')} отпуск с ${fmtShortDate(p.vacation.start)}</span>` : ''}
          ${p.account !== 'active' ? `<span class="mgr-chip muted">${ico('user')} не в портале</span>` : ''}
        </div>
        <span class="mgr-status ${s[0]}"><i></i>${escapeHtml(s[1])}</span>
      </div>`;
  const inG = g => g.filter(x => x.s[0] === 'in').length;
  return keys.map(k => {
    const g = groups.get(k);
    return `
      <div class="mgr-group">
        <div class="mgr-group-head"><span>${escapeHtml(k || (keys.length > 1 ? 'Без отдела' : 'Команда'))}</span>
          <small>${g.length} ${pluralRu(g.length, 'человек', 'человека', 'человек')}${inG(g) ? ` · в офисе ${inG(g)}` : ''}</small></div>
        <div class="hr-table">${g.map(rowHtml).join('')}</div>
      </div>`;
  }).join('');
}

// =========================================================
// МОЙ ОТПУСК — личная справка: что отмечено в табеле и как спросить остаток у HR.
// Остаток дней портал пока не считает: истории прошлых лет в нём нет, её ведёт отдел кадров.
// =========================================================
async function renderVacation(main) {
  const v = await fetchJson('/api/vacation') || { year: '', norm: 24, used: 0, unpaid: 0, periods: [], found: false };
  const mine = (state.requests || []).filter(r => r.type === 'vacation');
  const ask = (kind, preset) => `state.reqForm='${kind}';state.reqPreset=${JSON.stringify(preset || {}).replace(/"/g, '&quot;')};goToView('requests')`;
  const period = p => `
    <div class="vac-period">
      <div class="vac-period-when">${fmtDay(p.start)}${p.end !== p.start ? ' — ' + fmtDay(p.end) : ''}</div>
      <div class="vac-period-kind">${p.code === 'Т' ? 'Трудовой отпуск' : 'Без сохранения зарплаты'}</div>
      <b>${p.days} ${pluralRu(p.days, 'день', 'дня', 'дней')}</b>
    </div>`;
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Мой отпуск</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" onclick="${ask('vacation', { purpose: 'plan' })}">Оформить отпуск</button>
        <button class="btn secondary" onclick="${ask('unpaid')}">Без сохранения</button>
      </div>
    </div>

    <div class="vac-tiles">
      <div class="vac-tile"><span class="vac-num">${v.norm}</span><span class="vac-label">дней в год положено</span></div>
      <div class="vac-tile"><span class="vac-num">${v.used}</span><span class="vac-label">использовано в ${escapeHtml(v.year)} году</span></div>
      ${v.unpaid ? `<div class="vac-tile"><span class="vac-num">${v.unpaid}</span><span class="vac-label">дней без сохранения зарплаты</span></div>` : ''}
    </div>

    <div class="vac-ask">
      <div>
        <div class="vac-ask-title">Сколько дней осталось именно у вас</div>
        <div class="vac-ask-text">Остаток считает отдел кадров: он зависит от даты приёма на работу и отпусков прошлых лет,
          а в портале пока есть отметки только за ${escapeHtml(v.year)} год. Нажмите — вопрос уйдёт в отдел кадров, ответ придёт сюда же, в «Мои заявки».</div>
      </div>
      <button class="btn secondary" onclick="${ask('vacation', { purpose: 'question' })}">Спросить у отдела кадров</button>
    </div>

    <div class="vac-cols">
      <div>
        <div class="req-list-title">Отпуска в ${escapeHtml(v.year)} году</div>
        ${v.periods.length ? v.periods.map(period).join('')
          : `<div class="empty"><strong>В этом году отпусков не отмечено</strong></div>`}
      </div>
      <div>
        <div class="req-list-title">Мои заявки по отпуску</div>
        ${mine.length ? `<div class="req-list">${mine.map(r => requestRowHtml(r, false)).join('')}</div>`
          : '<div class="empty"><strong>Заявок нет</strong></div>'}
      </div>
    </div>

    `;
}

// =========================================================
// GALLERY — прошедшие ивенты с фотографиями
// =========================================================
// Список ивентов (раздел «Медиа → Прошедшие ивенты»)
function galleryBodyHtml() {
  const items = state.gallery.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!items.length) {
    return `<div class="empty"><strong>Пока нет ивентов</strong></div>`;
  }
  return items.map(ev => `
    <div class="gal-card">
      <div class="gal-head">
        <div>
          <div class="gal-title">${escapeHtml(ev.title)}</div>
          <div class="gal-meta">${ev.date ? fmtDate(ev.date) : ''}${ev.photos.length ? ` · ${ev.photos.length} ${pluralRu(ev.photos.length, 'фото', 'фото', 'фото')}` : ''}</div>
        </div>
        <div class="gal-actions">
          <label class="btn secondary gal-upload">
            + Фото
            <input type="file" accept="image/*" multiple onchange="addGalleryPhotos('${ev.id}', this)">
          </label>
          <button class="btn secondary" onclick="openGalleryForm('${ev.id}')">Изменить</button>
          <button class="btn text" onclick="deleteItem('gallery','${ev.id}')">Удалить</button>
        </div>
      </div>
      ${ev.description ? `<div class="gal-desc">${escapeHtml(ev.description)}</div>` : ''}
      ${ev.photos.length ? `
        <div class="gal-grid">
          ${ev.photos.map((p, i) => `
            <div class="gal-photo">
              <img src="${escapeHtml(p.url)}" alt="" loading="lazy" onclick="openLightbox(${jsArg(p.url)}, ${escapeHtml(JSON.stringify(ev.photos.map(x => x.url)))})">
              <button class="gal-photo-del" title="Удалить фото" onclick="deleteGalleryPhoto('${ev.id}','${p.id}')">&times;</button>
              ${i ? `<button class="gal-photo-first" title="Сделать первым (обложка)" onclick="setGalleryCover('${ev.id}','${p.id}')">${ico('star')}</button>` : ''}
            </div>`).join('')}
        </div>` : '<div class="widget-empty">Фотографий пока нет — нажмите «+ Фото»</div>'}
    </div>`).join('');
}

function renderGallery(main) {  // «Медиа → Прошедшие ивенты»
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Прошедшие ивенты</div></div>
      <button class="btn" onclick="openGalleryForm()">Добавить ивент</button>
    </div>
    ${galleryBodyHtml()}`;
}

// загрузить все выбранные файлы (со сжатием), вернуть адреса; об ошибках сказать вслух
async function uploadFiles(inputEl, onProgress) {
  const urls = [], errors = [];
  const files = [...inputEl.files];
  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(i + 1, files.length);
    const { url, error } = await uploadOne(files[i]);
    if (url) urls.push(url); else errors.push(error);
  }
  if (errors.length) {
    showToast(`Не загрузилось ${errors.length} из ${files.length}: ` + errors.slice(0, 2).join('; ') + (errors.length > 2 ? '…' : ''));
  }
  return urls;
}

// новый ивент или правка существующего (id) — название, дата, описание; фото правятся прямо в карточке ивента
function openGalleryForm(id) {
  const ev = id ? state.gallery.find(g => g.id === id) : null;
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${ev ? 'Изменить ивент' : 'Новый ивент'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название</label><input id="fGalTitle" type="text" value="${escapeHtml(ev ? ev.title : '')}"></div>
        <div class="field"><label>Дата</label><input id="fGalDate" type="date" value="${escapeHtml(ev ? ev.date || '' : '')}"></div>
        <div class="field"><label>Описание (необязательно)</label><textarea id="fGalDesc">${escapeHtml(ev ? ev.description || '' : '')}</textarea></div>
        <div class="field">
          <label>${ev ? 'Добавить фотографии' : 'Фотографии'} — можно выбрать сразу несколько</label>
          <input id="fGalPhotos" type="file" accept="image/*" multiple>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="fGalSubmit" onclick="${ev ? `saveGalleryEvent('${ev.id}')` : 'submitGallery()'}">${ev ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </div>`);
}
async function saveGalleryEvent(id) {
  const title = document.getElementById('fGalTitle').value.trim();
  if (!title) { showToast('Укажите название'); return; }
  const btn = document.getElementById('fGalSubmit');
  btn.disabled = true;
  const r = await fetch(`/api/gallery/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date: document.getElementById('fGalDate').value, description: document.getElementById('fGalDesc').value.trim() }) });
  let item = await r.json().catch(() => null);
  if (!r.ok) { btn.disabled = false; return showToast((item && item.error) || 'Не удалось сохранить'); }
  const inp = document.getElementById('fGalPhotos');
  if (inp.files.length) {
    btn.textContent = 'Загружаю…';
    const photos = await uploadFiles(inp, (i, n) => { btn.textContent = `Загружаю фото ${i} из ${n}…`; });
    if (photos.length) item = await fetchJson(`/api/gallery/${id}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos }) }) || item;
  }
  const i = state.gallery.findIndex(g => g.id === id);
  if (i >= 0) state.gallery[i] = item;
  closeModal(); render(); showToast('Ивент сохранён');
}
async function setGalleryCover(eventId, photoId) {
  const item = await fetchJson(`/api/gallery/${eventId}/cover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_id: photoId }) });
  if (!item) return showToast('Не удалось');
  const i = state.gallery.findIndex(g => g.id === eventId);
  if (i >= 0) state.gallery[i] = item;
  render(); showToast('Фото стало первым');
}

async function submitGallery() {
  const title = document.getElementById('fGalTitle').value.trim();
  if (!title) { showToast('Укажите название'); return; }
  const btn = document.getElementById('fGalSubmit');
  btn.disabled = true; btn.textContent = 'Загружаю…';
  const photos = await uploadFiles(document.getElementById('fGalPhotos'),
    (i, n) => { btn.textContent = `Загружаю фото ${i} из ${n}…`; });
  const item = await fetchJson('/api/gallery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      date: document.getElementById('fGalDate').value,
      description: document.getElementById('fGalDesc').value.trim(),
      photos,
    }),
  });
  closeModal();
  if (item) { state.gallery.unshift(item); showToast('Ивент добавлен'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

async function addGalleryPhotos(eventId, inputEl) {
  if (!inputEl.files.length) return;
  const photos = await uploadFiles(inputEl, (i, n) => showToast(`Загружаю фото ${i} из ${n}…`));
  if (!photos.length) return;
  const updated = await fetchJson(`/api/gallery/${eventId}/photos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos }),
  });
  if (!updated) { showToast('Не удалось загрузить'); return; }
  const i = state.gallery.findIndex(g => g.id === eventId);
  if (i >= 0) state.gallery[i] = updated;
  showToast(`Добавлено: ${photos.length}`);
  render();
}

async function deleteGalleryPhoto(eventId, photoId) {
  if (!await confirmDialog({ title: 'Удалить фотографию?', text: 'Фото будет удалено из ивента. Отменить это будет нельзя.' })) return;
  const res = await fetchJson(`/api/gallery/photos/${photoId}`, { method: 'DELETE' });
  if (!res) { showToast('Не удалось удалить'); return; }
  const ev = state.gallery.find(g => g.id === eventId);
  if (ev) ev.photos = ev.photos.filter(p => p.id !== photoId);
  render();
}

// =========================================================
// TEMPLATES — шаблоны документов (пока пусто)
// =========================================================
async function renderTemplates(main) {
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  const all = await fetchJson('/api/documents') || [];
  state.documents = all;
  const allItems = all.filter(d => (d.link || '').startsWith('/media/') && d.section === 'templates');
  // две вкладки: обычные бланки (первыми) и технические — по названию категории (решение пользователя 23.09.2026)
  const isTech = d => /^техн/i.test(d.category || '');
  const tab = state.tplTab === 'tech' ? 'tech' : 'common';
  const items = allItems.filter(d => isTech(d) === (tab === 'tech'));
  const ORDER = ['Отпуск', 'Приём и увольнение', 'Командировки и подбор', 'Материальная помощь'];   // порядок групп — самые частые сверху
  const pos = c => { const i = ORDER.indexOf(c); return i < 0 ? ORDER.length : i; };
  const cats = [...new Set(items.map(d => d.category || TEMPLATE_CATEGORY))]
    .sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, 'ru'));
  const nCommon = allItems.filter(d => !isTech(d)).length, nTech = allItems.length - nCommon;
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Шаблоны документов</div></div>
      <button class="btn" onclick="openPresentationForm('templates')">Добавить шаблон</button>
    </div>
    <div class="dep-chips">
      <button class="dep-chip${tab === 'common' ? ' active' : ''}" onclick="state.tplTab='common';render()">Обычные шаблоны${nCommon ? ` <span>${nCommon}</span>` : ''}</button>
      <button class="dep-chip${tab === 'tech' ? ' active' : ''}" onclick="state.tplTab='tech';render()">Технические бланки${nTech ? ` <span>${nTech}</span>` : ''}</button>
    </div>
    ${items.length ? cats.map(cat => `
      <div class="req-list-title">${escapeHtml(cat)} · ${items.filter(d => (d.category || TEMPLATE_CATEGORY) === cat).length}</div>
      <div class="pres-list" style="margin-bottom:22px">${items.filter(d => (d.category || TEMPLATE_CATEGORY) === cat).map(d => `
      <div class="pres-card">
        <div class="pres-mark">${ico('file')}</div>
        <div class="pres-text">
          <div class="pres-title">${escapeHtml(d.title)}</div>
        </div>
        <div class="pres-actions">
          <a class="btn secondary" href="${escapeHtml(d.link)}" download>Скачать</a>
          <button class="btn text" onclick="deleteItem('documents','${d.id}')">Удалить</button>
        </div>
      </div>`).join('')}</div>`).join('')
    : `<div class="empty"><strong>Шаблонов пока нет</strong></div>`}`;
}

// =========================================================
// LOYALTY — программа лояльности (наполним, когда будут условия)
// =========================================================
// Программа лояльности (24.09.2026): компактные карточки — значок, название, главная цифра;
// по клику окно с полными условиями. Условия для Connect AI — LOYALTY_KB в app.py, меняешь текст здесь — поправь и там.
const LOYALTY = [
  { key: 'bonus', icon: 'award', title: 'Годовой бонусный фонд', big: 'Раз в год', cap: 'бонус по итогам работы',
    body: () => `
      <div class="lp-text">Мы ценим вклад каждого сотрудника в общий результат компании, поэтому ежегодно выплачиваем бонусы по итогам работы за предыдущий год.</div>
      <div class="lp-label">Когда выплачивается</div>
      <div class="lp-text">Ежегодно в начале апреля за предыдущий календарный год.</div>
      <div class="lp-label">Кто получает</div>
      <div class="lp-text">Все сотрудники компании, проработавшие в предыдущем году не менее шести месяцев.</div>
      <div class="lp-label">Размер бонуса</div>
      <div class="lp-text">Устанавливается генеральным директором компании.</div>
      <div class="lp-label">Исключения</div>
      <div class="lp-text">Бонус не выплачивается сотрудникам, чья заработная плата изначально включает бонусную часть.</div>
      <div class="lp-note">Благодарим вас за труд и вовлечённость — ваши успехи делают компанию сильнее!</div>` },
  { key: 'points', icon: 'trophy', title: 'Community Coins', big: '', cap: '',
    body: () => `
      <div class="lp-text">Дорогие коллеги!</div>
      <div class="lp-text">Мы ценим ваш вклад, дисциплину и желание развиваться, поэтому запустили Community Coins. Выполняйте условия программы, копите coins и обменивайте их на приятные бонусы от компании.</div>
      <div class="lp-label">Как заработать coins</div>
      <div class="lp-tiers">
        <div class="lp-row"><span>Пригласил друга на собеседование</span><b>40 coins</b></div>
        <div class="lp-row"><span>Не пропустил ни одного занятия английским языком за месяц</span><b>50 coins</b></div>
        <div class="lp-row"><span>Ни разу не опоздал за месяц</span><b>50 coins</b></div>
        <div class="lp-row"><span>Опубликовал в социальных сетях информативную сторис или фото о компании</span><b>50 coins</b></div>
        <div class="lp-row"><span>Стал наставником (Mentor) для нового сотрудника</span><b>50 coins</b></div>
        <div class="lp-row"><span>Снял рилс о компании и опубликовал его в социальных сетях</span><b>70 coins</b></div>
        <div class="lp-row"><span>Принял участие в спортивных соревнованиях или олимпиаде, прошёл профессиональное обучение или курс по личностному росту <small>подтверждение: сертификат, грамота, медаль или фото</small></span><b>70 coins</b></div>
        <div class="lp-row"><span>Прочитал книгу месяца от CEO и сдал тест по ней</span><b>100 coins</b></div>
        <div class="lp-row"><span>Внедрил новый проект или автоматизировал рабочий процесс</span><b>150 coins</b></div>
      </div>
      <div class="lp-label">Как подводятся итоги и выдаются награды</div>
      <div class="lp-text">Coins суммируются в течение квартала. Итоги подводятся раз в квартал, а вознаграждения выдаются в начале месяца, следующего за отчётным кварталом. Неиспользованные coins в конце квартала сгорают, и в новом квартале начисление начинается заново.</div>
      <div class="lp-label">Накопленные coins можно обменять на</div>
      <div class="lp-tiers">
        <div class="lp-row"><span>мерч от компании</span><b>800 coins</b></div>
        <div class="lp-row"><span>дополнительный выходной в рабочий день</span><b>1 000 coins</b></div>
        <div class="lp-row"><span>сертификат на 40 000 тенге</span><b>1 500 coins</b></div>
      </div>
      <div class="lp-note">Копите coins, развивайтесь вместе с нами и получайте заслуженные награды!</div>` },
  { key: 'leave', icon: 'calendar', title: 'Дополнительный отпуск', big: 'до 3 дней', cap: 'оплачиваемых, по заявлению',
    body: () => `
      <div class="lp-label">В случае:</div>
      <ul class="lp-chips">
        <li>рождения или усыновления ребёнка</li>
        <li>потери близкого родственника</li>
        <li>регистрации брака</li>
      </ul>` },
  { key: 'help', icon: 'gift', title: 'Материальная помощь', big: 'до 200 000 ₸', cap: 'в важные моменты жизни',
    body: () => `
      <div class="lp-tiles">
        ${[
          ['Регистрация брака', [['до 2 лет в компании', '50 000 ₸'], ['свыше 2 лет', '100 000 ₸']]],
          ['Рождение / усыновление ребёнка', [['до 2 лет в компании', '78 000 ₸'], ['свыше 2 лет', '100 000 ₸']]],
          ['Инвалидность или онкология', [['', '100 000 ₸']]],
          ['Потеря близких (родители, супруг(а), дети)', [['', '200 000 ₸']]],
        ].map(([t, rows]) => `
          <div class="lp-tile">
            <div class="lp-tile-title">${t}</div>
            ${rows.map(([who, sum]) => `<div class="lp-row"><span>${who}</span><b>${sum}</b></div>`).join('')}
          </div>`).join('')}
      </div>
      <div class="lp-note">Достаточно предоставить подтверждающие документы в HR.</div>` },
  { key: 'sport', icon: 'activity', title: 'Компенсация спортзала', big: 'до 100 000 ₸', cap: 'в год на абонемент',
    body: () => `
      <div class="lp-text">Заботьтесь о себе — мы поможем с расходами. Компания компенсирует <b>годовой абонемент</b> в фитнес-клуб или тренажёрный зал:</div>
      <div class="lp-tiers">
        <div class="lp-row"><span>ТОП-менеджеры, руководители отделов (опыт от 1 года), сотрудники со стажем в компании от 3 лет</span><b>100 000 ₸</b></div>
        <div class="lp-row"><span>Сотрудники со стажем в компании от 1 года</span><b>50 000 ₸</b></div>
      </div>` },
  { key: 'friend', icon: 'users', title: '«Приведи друга»', big: 'Подарок', cap: 'рекомендуй и получай подарок',
    body: () => `
      <div class="lp-text">Знаете крутого специалиста, который ищет работу? Порекомендуйте его нам!</div>
      <ol class="lp-steps">
        <li><span>1</span>Отправьте резюме HR в личные сообщения</li>
        <li><span>2</span>Кандидат прошёл испытательный срок</li>
        <li><span>3</span>Вы получаете подарок</li>
      </ol>` },
  { key: 'english', icon: 'globe', title: 'Корпоративный английский язык', big: '3 раза в неделю', cap: 'занятия оплачивает компания',
    body: () => `
      <div class="lp-text">Хотите свободно говорить по-английски? Мы поможем! Компания оплачивает <b>занятия с носителем языка три раза в неделю</b> — живая практика, реальный прогресс.</div>
      <div class="lp-label">Кто может присоединиться:</div>
      <ul class="lp-chips">
        <li>руководители</li>
        <li>сотрудники, которые работают с нами больше года</li>
      </ul>
      <div class="lp-note">Условия участия обсуждаются индивидуально и согласуются с генеральным директором.</div>` },
  { key: 'events', icon: 'star', title: 'Корпоративные мероприятия', big: '', cap: '',
    body: () => `
      <div class="lp-text">Три главных события года, на которых мы собираемся всей командой.</div>
        <div class="lp-event"><div class="lp-event-title">Март — Наурыз</div><div class="lp-text">Для нас это точка перезапуска. Подводим итоги прошедшего года, фиксируем результаты и вместе задаём вектор на новый. Празднуем большой командой вместе с партнёрами — это повод поблагодарить друг друга за проделанную работу и настроиться на новые цели.</div></div>
        <div class="lp-event"><div class="lp-event-title">Август — день рождения компании</div><div class="lp-text">Самый тёплый и неформальный праздник года, на который мы приглашаем семьи сотрудников. Нам важно, чтобы близкие люди понимали, чем мы живём, и гордились тем, что делают их родные. Проводим его на открытом воздухе, с активностями для всех — от детей до взрослых.</div></div>
        <div class="lp-event"><div class="lp-event-title">Декабрь — Новый год</div><div class="lp-text">Полностью неформальный формат: без отчётов, презентаций и официальной части. Просто время побыть вместе, пообщаться, отдохнуть и завершить год на лёгкой ноте, чтобы в новый войти с хорошим настроением.</div></div>
      <div class="lp-note">Даты и детали каждого мероприятия появятся в новостях и календаре портала.</div>` },
  { key: 'buddy', icon: 'userplus', title: 'Mentor для новичка', big: 'Mentor', cap: 'помоги новому коллеге освоиться',
    body: () => `
      <div class="lp-text">Помните свой первый день? Mentor — это тот, кто помогает новичку быстро почувствовать себя своим: знакомит с коллегами, рассказывает о традициях и правилах, отвечает на вопросы в первые недели работы. Отличная возможность прокачать навыки наставничества и получить признание.</div>
      <div class="lp-label">Кто может участвовать</div>
      <div class="lp-text">Сотрудник, который уже уверенно ориентируется в компании, хорошо знает внутренние процессы и готов уделять время новому коллеге.</div>
      <div class="lp-label">Как присоединиться</div>
      <ol class="lp-steps">
        <li><span>1</span>Подайте заявку — она уходит сразу в HR</li>
        <li><span>2</span>Пройдите короткий инструктаж о роли Mentor</li>
        <li><span>3</span>Получите закрепление за новым сотрудником и сопровождайте его в период адаптации</li>
        <li><span>4</span>По окончании периода заполните короткую обратную связь вместе с новичком</li>
      </ol>
      <div class="lp-note">Присоединяйтесь к программе Mentor — помогайте новым коллегам почувствовать себя частью команды!</div>`,
    action: ['Подать заявку', "closeModal();state.reqForm='buddy';goToView('requests')"] },
];

// Временно закрытые карточки (06.10.2026, слова пользователя: «годовой бонусный фонд и комьюнити коинсы временно закрыть,
// сделать типа „скоро появится“ — там идёт пересмотр всего»). Условия в LOYALTY оставлены, чтобы вернуть одной правкой;
// окно закрытой карточки не открывается, боту условия не отдаются (LOYALTY_KB в app.py).
const LOYALTY_SOON = ['bonus', 'points'];
function renderLoyalty(main) {
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Программа лояльности</div></div>
    </div>

    <div class="loy-intro">
      <div class="loy-intro-mark">${ico('heart')}</div>
      <div>
        <div class="loy-intro-title">Привет, команда!</div>
        <div class="loy-intro-text">Мы хотим быть уверены, что каждый знает о программах поддержки, которые есть в компании. Ниже — что положено и как получить.</div>
      </div>
    </div>

    <div class="lp-deck">
      ${LOYALTY.map(x => LOYALTY_SOON.includes(x.key) ? `
        <div class="lp-card soon">
          <span class="lp-ico">${ico(x.icon)}</span>
          <div class="lp-title">${x.title}</div>
          <div class="lp-more">Скоро</div>
        </div>` : `
        <div class="lp-card clickable" onclick="openLoyalty('${x.key}')" onkeydown="if(event.key==='Enter')openLoyalty('${x.key}')" role="button" tabindex="0">
          <span class="lp-ico">${ico(x.icon)}</span>
          <div class="lp-title">${x.title}</div>
          <div class="lp-more">Подробнее →</div>
        </div>`).join('')}
    </div>`;
}

// =========================================================
// ВАКАНСИИ (вернули 24.09.2026): открытые позиции, ведут HR и админ; в каждой — «Рекомендовать друга» (заявка в HR)
// =========================================================
const VAC_FORMATS = ['Офис', 'Гибрид', 'Удалённо'];
async function renderVacancies(main) {
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  state.vacancies = await fetchJson('/api/vacancies') || [];
  const list = state.vacancies;
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Вакансии</div></div>
      <button class="btn" onclick="openVacancyForm()">Добавить вакансию</button>
    </div>
    ${list.length ? `<div class="lp-deck">${list.map(v => `
      <div class="lp-card vac-card${v.status === 'closed' ? ' closed' : ''}" onclick="openVacancy('${v.id}')" onkeydown="if(event.key==='Enter')openVacancy('${v.id}')" role="button" tabindex="0">
        <span class="lp-ico">${ico('userplus')}</span>
        <div class="kb-folder-name">${escapeHtml(v.title)}</div>
        <div class="lp-cap">${escapeHtml([v.department, v.office, v.format].filter(Boolean).join(' · '))}</div>
        ${v.status === 'closed' ? '<div class="vac-closed">Закрыта</div>' : ''}
        <div class="lp-more">Подробнее →</div>
      </div>`).join('')}</div>`
    : `<div class="empty"><strong>Открытых вакансий сейчас нет</strong></div>`}
    <div class="vac-refer">
      <span class="lp-ico">${ico('users')}</span>
      <div class="vac-refer-text">
        <div class="vac-refer-title">Знаете хорошего специалиста?</div>
        <div class="lp-cap">Отправьте его резюме в HR — даже если подходящей вакансии сейчас нет.</div>
      </div>
      <button class="btn" onclick="openReferralForm()">Предложить кандидата</button>
    </div>`;
}
// Предложить кандидата: резюме файлом (PDF/Word) или ссылкой; заявка referral уходит сразу в HR — вкладка «Предложенные кандидаты»
function openReferralForm(vacancy = '') {
  const open = (state.vacancies || []).filter(v => v.status === 'open');
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Предложить кандидата</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Вакансия</label>
          <select id="rfVacancy">${open.map(v => `<option ${v.title === vacancy ? 'selected' : ''}>${escapeHtml(v.title)}</option>`).join('')}
            <option ${vacancy ? '' : 'selected'}>Без конкретной вакансии</option></select></div>
        <div class="field"><label>Фамилия, имя кандидата</label><input id="rfName" type="text"></div>
        <div class="field"><label>Телефон или Telegram кандидата</label><input id="rfContact" type="text"></div>
        <div class="field"><label>Резюме</label><input id="rfFile" type="file" accept=".pdf,.docx,application/pdf">
          <div class="field-hint">PDF или Word (.docx), до 10 МБ</div></div>
        <div class="field"><label>Или ссылка на резюме</label><input id="rfLink" type="text" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label>Почему рекомендуете (необязательно)</label><textarea id="rfComment"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="rfSend" onclick="sendReferral()">Отправить в HR</button>
      </div>
    </div>`);
}
async function sendReferral() {
  const candidate = document.getElementById('rfName').value.trim();
  const contact = document.getElementById('rfContact').value.trim();
  const file = document.getElementById('rfFile').files[0];
  let resume = document.getElementById('rfLink').value.trim();
  if (!candidate) return showToast('Укажите имя кандидата');
  if (!contact) return showToast('Укажите телефон или Telegram кандидата');
  if (!file && !resume) return showToast('Приложите резюме файлом или ссылкой');
  const btn = document.getElementById('rfSend'); btn.disabled = true; btn.textContent = 'Отправляем…';
  if (file) {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/resume-upload', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Отправить в HR'; return showToast(j.error || 'Не удалось загрузить резюме'); }
    resume = j.url;
  }
  const me = state.employees.find(e => e.id === state.user.emp_id) || {};
  const r = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'referral', data: { full_name: me.name || state.user.name, department: me.department || '', phone: me.phone || '',
      vacancy: document.getElementById('rfVacancy').value, candidate, contact, resume, comment: document.getElementById('rfComment').value.trim() } }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; btn.textContent = 'Отправить в HR'; return showToast(res.error || 'Не удалось отправить'); }
  state.requests = [res, ...(state.requests || [])];
  closeModal(); render(); showToast('Кандидат отправлен в HR — статус видно в «Моих заявках»');
}
function openVacancy(id) {
  const v = (state.vacancies || []).find(x => x.id === id); if (!v) return;
  const para = t => escapeHtml(t).split(/\n\s*\n|\n/).filter(Boolean).map(p => `<div class="lp-text">${p}</div>`).join('');
  openModal(`
    <div class="modal lp-modal">
      <div class="modal-head">
        <div class="lp-head"><span class="lp-ico">${ico('userplus')}</span><h3>${escapeHtml(v.title)}</h3></div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${[v.department, v.office, v.format].some(Boolean) ? `<ul class="lp-chips">${[v.department, v.office, v.format].filter(Boolean).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
        ${v.description ? `<div class="lp-label">Чем предстоит заниматься</div>${para(v.description)}` : ''}
        ${v.requirements ? `<div class="lp-label">Кого ищем</div>${para(v.requirements)}` : ''}
        <div class="lp-note">Знаете подходящего человека? Порекомендуйте его — за друга, прошедшего испытательный срок, положен подарок по программе лояльности.</div>
      </div>
      <div class="modal-foot">
        <button class="btn text" onclick="deleteVacancy('${v.id}')">Удалить</button>
        <button class="btn text" onclick="setVacancyStatus('${v.id}','${v.status === 'open' ? 'closed' : 'open'}')">${v.status === 'open' ? 'Закрыть вакансию' : 'Открыть снова'}</button>
        <button class="btn secondary" onclick="closeModal();openVacancyForm('${v.id}')">Изменить</button>
        ${v.status === 'open' ? `<button class="btn" onclick="closeModal();openReferralForm(${jsArg(v.title)})">Рекомендовать друга</button>` : ''}
      </div>
    </div>`);
}
function openVacancyForm(id) {
  const v = id ? (state.vacancies || []).find(x => x.id === id) : null;
  const val = k => escapeHtml((v && v[k]) || '');
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${v ? 'Вакансия' : 'Новая вакансия'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Должность</label><input id="vfTitle" type="text" value="${val('title')}"></div>
        <div class="field-row">
          <div class="field"><label>Подразделение</label><input id="vfDep" type="text" list="vfDepList" value="${val('department')}">
            <datalist id="vfDepList">${[...new Set(state.employees.map(e => e.department).filter(Boolean))].map(d => `<option value="${escapeHtml(d)}">`).join('')}</datalist></div>
          <div class="field"><label>Офис</label><select id="vfOffice"><option value="">Не указан</option>${['Астана', 'Алматы'].map(o => `<option ${v && v.office === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Формат</label><select id="vfFormat"><option value="">Не указан</option>${VAC_FORMATS.map(o => `<option ${v && v.format === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Чем предстоит заниматься</label><textarea id="vfDesc">${val('description')}</textarea></div>
        <div class="field"><label>Кого ищем</label><textarea id="vfReq">${val('requirements')}</textarea></div>
      </div>
      <div class="modal-foot">
        ${v ? `<button class="btn text" onclick="deleteVacancy('${v.id}')">Удалить</button>
               <button class="btn secondary" onclick="saveVacancy('${v.id}', '${v.status === 'open' ? 'closed' : 'open'}')">${v.status === 'open' ? 'Закрыть вакансию' : 'Открыть снова'}</button>` : ''}
        <button class="btn" onclick="saveVacancy(${v ? `'${v.id}'` : ''})">Сохранить</button>
      </div>
    </div>`);
}
async function saveVacancy(id, status) {
  const body = { title: document.getElementById('vfTitle').value.trim(), department: document.getElementById('vfDep').value.trim(),
    office: document.getElementById('vfOffice').value, format: document.getElementById('vfFormat').value,
    description: document.getElementById('vfDesc').value.trim(), requirements: document.getElementById('vfReq').value.trim() };
  if (status) body.status = status;
  if (!body.title) return showToast('Укажите должность');
  const r = await fetch(id ? `/api/vacancies/${id}` : '/api/vacancies', { method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(res.error || 'Не удалось сохранить');
  closeModal(); render(); showToast(status === 'closed' ? 'Вакансия закрыта' : 'Вакансия сохранена');
}
// закрыть / открыть снова прямо из окна вакансии, без формы (просьба пользователя 24.09.2026)
async function setVacancyStatus(id, status) {
  const r = await fetch(`/api/vacancies/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!r.ok) return showToast('Не удалось сохранить');
  closeModal(); render(); showToast(status === 'closed' ? 'Вакансия закрыта — сотрудники её больше не видят' : 'Вакансия снова открыта');
}
async function deleteVacancy(id) {
  if (!await confirmDialog({ title: 'Удалить вакансию?' })) return;
  const r = await fetch(`/api/vacancies/${id}`, { method: 'DELETE' });
  if (!r.ok) return showToast('Не удалось удалить');
  closeModal(); render();
}

function openLoyalty(key) {
  if (LOYALTY_SOON.includes(key)) return;
  const x = LOYALTY.find(i => i.key === key);
  if (!x) return;
  openModal(`
    <div class="modal lp-modal">
      <div class="modal-head">
        <div class="lp-head"><span class="lp-ico">${ico(x.icon)}</span><h3>${x.title}</h3></div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${x.body()}
      </div>
      ${x.action ? `<div class="modal-foot"><button class="btn" onclick="${x.action[1]}">${x.action[0]}</button></div>` : ''}
    </div>`);
}


// =========================================================
// ВХОД В ПОРТАЛ
// =========================================================
// отдельный вход в WorkFlow: адрес /workflow (08.10.2026) или учётка «только WorkFlow»
function isWorkflowEntry() { return location.pathname.replace(/\/+$/, '') === '/workflow'; }
function showLogin(msg) {
  document.getElementById('modalOverlay')?.remove();
  document.querySelector('.login-screen')?.remove();
  document.body.classList.add('login-mode');
  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <div class="login-box">

      <aside class="login-aside">
        <div class="login-aside-top">
          <img class="login-logo" src="/static/logo-mark.png" alt="">
          <div class="login-word">Connected<br>Community</div>
        </div>
        <div class="login-aside-mid">
          ${isWorkflowEntry() ? `<div class="login-claim">Connected WorkFlow<br>рабочее пространство для заданий с AI-агентами</div>
          <ul class="login-points">
            <li>Опишите, что изменить на портале, — агент уточнит и соберёт задание</li>
            <li>Задания, замечания и материалы в одном месте</li>
            <li>Изменения попадают на сайт только после подтверждения владельца</li>
          </ul>` : `<div class="login-claim">Внутренний портал<br>компании Connected&nbsp;Home</div>
          <ul class="login-points">
            <li>Справочник сотрудников и структура компании</li>
            <li>Новости, события и жизнь компании</li>
            <li>Документы, заявки и ответы на частые вопросы</li>
            <li>AI&nbsp;Community&nbsp;Bot — ответит по данным портала</li>
          </ul>`}
        </div>
        <div class="login-aside-foot">Астана · с 2018 года</div>
      </aside>

      <main class="login-main">
        <div class="login-mobile-brand">
          <img src="/static/logo-mark.png" alt="">
          <span>Connected Community</span>
        </div>

        <div class="login-head">
          <h1 class="login-title">${isWorkflowEntry() ? 'Вход в WorkFlow' : 'Вход в портал'}</h1>
          <p class="login-sub">Войдите под своей рабочей учётной записью</p>
        </div>

        <form class="login-form" onsubmit="submitLogin(event)" autocomplete="on">
          <div class="field">
            <label for="loginUser">Логин или корпоративная почта</label>
            <input id="loginUser" name="username" autocomplete="username"
                   autocapitalize="none" autocorrect="off" spellcheck="false"
                   required>
          </div>

          <div class="field">
            <label for="loginPass">Пароль</label>
            <div class="login-pass-wrap">
              <input id="loginPass" type="password" name="password" autocomplete="current-password" required>
              <button type="button" class="login-eye" id="loginEye"
                      onclick="toggleLoginPass()" aria-label="Показать пароль" title="Показать пароль">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                     stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/>
                  <circle cx="12" cy="12" r="2.7"/>
                </svg>
              </button>
            </div>
          </div>

          <label class="login-remember">
            <input type="checkbox" id="loginRemember" checked>
            <span>Запомнить меня на этом устройстве</span>
          </label>

          <div class="login-error" id="loginError" role="alert">${msg ? escapeHtml(msg) : ''}</div>

          <button class="btn login-submit" type="submit" id="loginSubmit">Войти</button>
        </form>

        <div class="login-first">
          <div class="login-first-sep"><span>Впервые в портале?</span></div>
          <button type="button" class="login-first-btn" onclick="showRegister()">
            <b>Первый вход</b>
            <small>Введите корпоративную почту — пришлём ссылку, по ней придумаете пароль</small>
          </button>
          <a href="#" class="login-link login-forgot" onclick="showRegister(true);return false;">Забыли пароль?</a>
        </div>
      </main>

    </div>`;
  document.body.appendChild(wrap);
  setTimeout(() => document.getElementById('loginUser')?.focus(), 60);
}

const ROLE_LABELS = { admin: 'Администратор', hr: 'HR', buyer: 'Закупщик', accountant: 'Бухгалтер', cfo: 'Финансовый директор', user: 'Сотрудник' };

// ---- приглашение: сотрудник сам придумывает пароль ----
async function showInvite(token) {
  document.body.classList.add('login-mode');
  const info = await fetchJson(`/api/invite/${encodeURIComponent(token)}`);
  if (!info) {
    history.replaceState(null, '', '/');
    return showLogin('Ссылка-приглашение недействительна или уже использована. Попросите администратора выслать новую.');
  }
  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <div class="login-box">
      <aside class="login-aside">
        <div class="login-aside-top">
          <img class="login-logo" src="/static/logo-mark.png" alt="">
          <div class="login-word">Connected<br>Community</div>
        </div>
        <div class="login-aside-mid">
          <div class="login-claim">Добро пожаловать<br>в портал!</div>
          <ul class="login-points">
            <li>Придумайте пароль — и вы внутри</li>
            <li>Входить можно по корпоративной почте</li>
            <li>Пароль можно сменить в личном кабинете</li>
          </ul>
        </div>
        <div class="login-aside-foot">Астана · с 2018 года</div>
      </aside>
      <main class="login-main">
        <div class="login-mobile-brand"><img src="/static/logo-mark.png" alt=""><span>Connected Community</span></div>
        <div class="login-head">
          <h1 class="login-title">Здравствуйте, ${escapeHtml(info.name.split(' ').slice(-1)[0] || info.name)}!</h1>
          <p class="login-sub">Ваш логин — <b>${escapeHtml(info.email || info.login)}</b>. Осталось придумать пароль.</p>
        </div>
        <form class="login-form" onsubmit="submitInvite(event, ${jsArg(token)})">
          <div class="field">
            <label for="invPass">Новый пароль</label>
            <div class="login-pass-wrap">
              <input id="invPass" type="password" autocomplete="new-password" placeholder="не короче 8 символов" required minlength="8">
              <button type="button" class="login-eye" onclick="const i=document.getElementById('invPass');i.type=i.type==='password'?'text':'password';i.focus()" title="Показать пароль">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.7"/></svg>
              </button>
            </div>
          </div>
          <div class="field">
            <label for="invPass2">Пароль ещё раз</label>
            <input id="invPass2" type="password" autocomplete="new-password" required>
          </div>
          <div class="login-error" id="loginError" role="alert"></div>
          <button class="btn login-submit" type="submit" id="invSubmit">Сохранить пароль и войти</button>
        </form>
      </main>
    </div>`;
  document.body.appendChild(wrap);
  setTimeout(() => document.getElementById('invPass')?.focus(), 60);
}

async function submitInvite(e, token) {
  e.preventDefault();
  const err = document.getElementById('loginError');
  const p1 = document.getElementById('invPass').value, p2 = document.getElementById('invPass2').value;
  if (p1.length < 8) { err.textContent = 'Пароль должен быть не короче 8 символов.'; return; }
  if (p1 !== p2) { err.textContent = 'Пароли не совпадают.'; return; }
  const btn = document.getElementById('invSubmit'); btn.disabled = true; btn.textContent = 'Сохраняем…';
  try {
    const r = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: p1 }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { err.textContent = data.error || 'Не удалось сохранить пароль.'; return; }
    state.user = data;
    history.replaceState(null, '', '/');
    hideLogin();
    await loadAll();
    render();
    showToast(`Добро пожаловать, ${data.name}!`);
  } finally { btn.disabled = false; btn.textContent = 'Сохранить пароль и войти'; }
}

// ---- первый вход / сброс пароля по корпоративной почте ----
// reset = true — человек нажал «Забыли пароль?»: другой заголовок и текст, механика та же (письмо со ссылкой)
async function showRegister(reset) {
  const main = document.querySelector('.login-main');
  if (!main) return;
  const info = await fetchJson('/api/register') || { mode: 'off' };
  const byCode = info.mode === 'code';
  const sub = info.mode === 'mail'
    ? (reset ? 'Укажите корпоративную почту — пришлём письмо со ссылкой, по которой вы зададите новый пароль. Старый перестанет действовать.'
             : 'Укажите корпоративную почту — пришлём письмо со ссылкой, по которой вы придумаете пароль.')
    : byCode
      ? 'Укажите корпоративную почту и код доступа, который сообщил администратор, — и сразу придумайте пароль.'
      : 'Самостоятельный вход пока не включён. Попросите ссылку у администратора портала.';
  main.innerHTML = `
    <div class="login-mobile-brand"><img src="/static/logo-mark.png" alt=""><span>Connected Community</span></div>
    <div class="login-head">
      <h1 class="login-title">${reset ? 'Сброс пароля' : 'Первый вход'}</h1>
      <p class="login-sub">${sub}</p>
    </div>
    <form class="login-form" onsubmit="submitRegister(event)" ${info.mode === 'off' ? 'hidden' : ''}>
      <div class="field">
        <label for="regEmail">Корпоративная почта</label>
        <input id="regEmail" type="email" autocomplete="email" autocapitalize="none" spellcheck="false"
               required>
      </div>
      ${byCode ? `
      <div class="field">
        <label for="regCode">Код доступа</label>
        <input id="regCode" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" placeholder="сообщил администратор" required>
      </div>` : ''}
      <div class="login-error" id="loginError" role="alert"></div>
      <div class="login-ok" id="regOk" hidden></div>
      <button class="btn login-submit" type="submit" id="regSubmit">Отправить ссылку</button>
    </form>
    <div class="login-foot">
      <a href="#" class="login-link" onclick="showLogin();return false;">← Вернуться ко входу</a>
    </div>`;
  setTimeout(() => document.getElementById('regEmail')?.focus(), 60);
}

async function submitRegister(e) {
  e.preventDefault();
  const err = document.getElementById('loginError');
  const ok = document.getElementById('regOk');
  const btn = document.getElementById('regSubmit');
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const code = document.getElementById('regCode')?.value.trim();
  err.textContent = ''; ok.hidden = true;
  btn.disabled = true; btn.textContent = code ? 'Проверяем…' : 'Отправляем…';
  try {
    const r = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { err.textContent = data.error || 'Не получилось. Попробуйте ещё раз.'; return; }
    if (data.link) { location.href = data.link; return; }   // режим кода — сразу к «придумайте пароль»
    ok.innerHTML = escapeHtml(data.message) + (data.dev_link
      ? `<br><br><small>Почта не настроена — ссылка для проверки: <a href="${escapeHtml(data.dev_link)}">${escapeHtml(data.dev_link)}</a></small>` : '');
    ok.hidden = false;
    btn.textContent = 'Отправлено';
    return;
  } catch (_) {
    err.textContent = 'Нет связи с сервером. Проверьте подключение.';
  } finally {
    if (btn.textContent !== 'Отправлено') { btn.disabled = false; btn.textContent = 'Отправить ссылку'; }
  }
}

function toggleLoginPass() {
  const inp = document.getElementById('loginPass');
  const btn = document.getElementById('loginEye');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.classList.toggle('on', show);
  btn.title = btn.ariaLabel = show ? 'Скрыть пароль' : 'Показать пароль';
  inp.focus();
}

function hideLogin() {
  document.body.classList.remove('login-mode');
  document.querySelector('.login-screen')?.remove();
}

async function submitLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmit');
  const err = document.getElementById('loginError');
  const login = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const remember = document.getElementById('loginRemember').checked;
  btn.disabled = true; btn.textContent = 'Проверяем…'; err.textContent = '';
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password, remember }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      err.textContent = data.error || 'Не удалось войти.';
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
      return;
    }
    state.user = data;
    hideLogin();
    await loadAll();
    applyHash();
    if (isWorkflowEntry() || (state.user && state.user.cowork_only)) state.view = 'cowork';
    state._urlReplace = true;
    render();
    showToast(`Добро пожаловать, ${data.name}!`);
  } catch (_) {
    err.textContent = 'Нет связи с сервером. Проверьте подключение.';
  } finally {
    btn.disabled = false; btn.textContent = 'Войти';
  }
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  state.user = null;
  showLogin('Вы вышли из портала.');
}

function openChangePassword() {
  openModal(`
    <div class="modal">
      <div class="modal-title">Смена пароля</div>
      <div class="field"><label>Текущий пароль</label><input id="pwOld" type="password" autocomplete="current-password"></div>
      <div class="field"><label>Новый пароль</label><input id="pwNew" type="password" autocomplete="new-password" placeholder="не короче 8 символов"></div>
      <div class="field"><label>Новый пароль ещё раз</label><input id="pwNew2" type="password" autocomplete="new-password"></div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitChangePassword()">Сменить</button>
      </div>
    </div>`);
}

async function submitChangePassword() {
  const oldPw = document.getElementById('pwOld').value;
  const nw = document.getElementById('pwNew').value;
  const nw2 = document.getElementById('pwNew2').value;
  if (nw.length < 8) return showToast('Новый пароль должен быть не короче 8 символов.');
  if (nw !== nw2) return showToast('Пароли не совпадают.');
  const r = await fetch('/api/me/password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old: oldPw, new: nw }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось сменить пароль.');
  closeModal();
  showToast('Пароль изменён.');
}

// =========================================================
// УЧЁТНЫЕ ЗАПИСИ (только для админа)
// =========================================================
async function renderUsers(main) {
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  const list = await fetchJson('/api/users') || [];
  const rc = await fetchJson('/api/users/register-code') || { code: '', mode: 'off' };
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Учётные записи</div></div>
      <button class="btn" onclick="openUserForm()">Добавить учётную запись</button>
    </div>
    <div class="users-legend">
      <div><b>Администратор</b> — может добавлять и удалять любые данные портала.</div>
      <div><b>HR</b> — HR-панель: заявки на командировки, обращения, справочник, новости и ивенты.</div>
      <div><b>Закупщик</b> — панель закупщика: заявки сотрудников на технику и оборудование.</div>
      <div><b>Бухгалтер</b> — панель бухгалтера: заявки сотрудников на компенсацию по чекам.</div>
      <div><b>Финансовый директор</b> — видит панель закупщика и панель бухгалтера, ничего в них не меняет.</div>
      <div><b>Сотрудник</b> — смотрит разделы, спрашивает бота, пишет предложения и комментарии.</div>
      <div>Новому человеку удобнее выслать <b>ссылку-приглашение</b>: он сам придумает пароль и войдёт по корпоративной почте.</div>
    </div>
    <div class="regcode-box">
      <div class="regcode-head">
        <div class="regcode-title">Код доступа для первого входа</div>
        <div class="regcode-sub">${rc.mode === 'mail'
          ? 'Почта настроена: сотрудники получают ссылку письмом, код не нужен.'
          : 'Сообщите код сотрудникам в рабочем чате. На странице входа они вводят свою корпоративную почту и этот код — и сразу придумывают пароль. Подходят только адреса из справочника.'}</div>
      </div>
      <div class="regcode-row">
        <input id="regCodeInput" value="${escapeHtml(rc.code)}" placeholder="код не задан — самостоятельный вход выключен" spellcheck="false">
        <button class="btn secondary" onclick="document.getElementById('regCodeInput').value=Math.random().toString(36).slice(2,6).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()">Придумать</button>
        <button class="btn" onclick="saveRegisterCode()">Сохранить</button>
      </div>
    </div>
    <div class="users-list">
      ${list.map(u => `
        <div class="user-row">
          <div class="org-ava" style="--h:${hueOf(u.name || u.login)}">${initials(u.name || u.login)}</div>
          <div class="user-main">
            <div class="user-name">${escapeHtml(u.name || u.login)} ${u.id === state.user.id ? '<span class="user-you">это вы</span>' : ''}</div>
            <div class="user-login">${escapeHtml(u.email || u.login)}</div>
          </div>
          <div class="user-role ${u.role}">${ROLE_LABELS[u.role] || 'Сотрудник'}</div>
          <div class="user-last">${u.must_set_password ? '<span class="user-pending">ждёт приглашения</span>' : (u.last_login ? 'вход: ' + fmtShortDate(u.last_login) : 'ещё не входил')}</div>
          <div class="user-actions">
            ${u.must_set_password ? `<button class="btn text" onclick="reinviteUser('${u.id}')">Ссылка</button>` : ''}
            <button class="btn text" onclick="openUserForm('${u.id}')">Изменить</button>
            ${u.id === state.user.id ? '' : `<button class="btn text" onclick="deleteUser('${u.id}',${jsArg(u.login)})">Удалить</button>`}
          </div>
        </div>`).join('')}
    </div>`;
}

async function openUserForm(id) {
  const list = id ? (await fetchJson('/api/users') || []) : [];
  const u = list.find(x => x.id === id);
  openModal(`
    <div class="modal">
      <div class="modal-title">${u ? 'Изменить учётную запись' : 'Новая учётная запись'}</div>
      <div class="field"><label>Корпоративная почта (она же логин)</label>
        <input id="uEmail" value="${u ? escapeHtml(u.email || u.login) : ''}" ${u ? 'disabled' : ''} autocapitalize="none" spellcheck="false"
               oninput="this.value=this.value.trim()">
      </div>
      <div class="field"><label>Имя и фамилия</label>
        <input id="uName" value="${u ? escapeHtml(u.name || '') : ''}" list="empNames">
        <datalist id="empNames">${state.employees.map(e => `<option value="${escapeHtml(e.name)}">`).join('')}</datalist>
      </div>
      <div class="field"><label>Роль</label>
        <select id="uRole">
          <option value="user" ${!u || u.role === 'user' ? 'selected' : ''}>Сотрудник — только просмотр</option>
          <option value="hr" ${u && u.role === 'hr' ? 'selected' : ''}>HR — HR-панель, новости и ивенты</option>
          <option value="buyer" ${u && u.role === 'buyer' ? 'selected' : ''}>Закупщик — заявки на технику</option>
          <option value="accountant" ${u && u.role === 'accountant' ? 'selected' : ''}>Бухгалтер — компенсации по чекам</option>
          <option value="cfo" ${u && u.role === 'cfo' ? 'selected' : ''}>Финансовый директор — просмотр закупок и бухгалтерии</option>
          <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Администратор — полный доступ</option>
        </select>
      </div>
      ${u ? '' : `
      <label class="field field-check"><input type="checkbox" id="uInvite" checked onchange="document.getElementById('uPassField').hidden=this.checked">
        <span>Выслать ссылку-приглашение — сотрудник сам придумает пароль</span></label>`}
      <label class="field field-check"><input type="checkbox" id="uCowork" ${u && u.cowork ? 'checked' : ''}><span>Доступ к Connected WorkFlow</span></label>
      <label class="field field-check"><input type="checkbox" id="uCoworkOnly" ${u && u.cowork_only ? 'checked' : ''}><span>Только WorkFlow — вход по адресу /workflow, портал закрыт</span></label>
      <div class="field" id="uPassField" ${u ? '' : 'hidden'}><label>${u ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}</label>
        <input id="uPass" type="password" autocomplete="new-password" placeholder="не короче 8 символов">
      </div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="saveUser(${u ? `'${u.id}'` : 'null'})">Сохранить</button>
      </div>
    </div>`);
}

async function saveUser(id) {
  const body = {
    name: document.getElementById('uName').value.trim(),
    role: document.getElementById('uRole').value,
    cowork: document.getElementById('uCowork').checked,
    cowork_only: document.getElementById('uCoworkOnly').checked,
  };
  const pass = document.getElementById('uPass').value;
  if (pass) body.password = pass;
  if (!id) {
    const email = document.getElementById('uEmail').value.trim().toLowerCase();
    if (!email) return showToast('Укажите корпоративную почту.');
    body.login = email;
    if (email.includes('@')) body.email = email;
    body.invite = document.getElementById('uInvite').checked;
    if (!body.invite && !pass) return showToast('Задайте пароль или отметьте приглашение.');
  }
  const r = await fetch(id ? `/api/users/${id}` : '/api/users', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось сохранить.');
  closeModal();
  if (data.invite_url) showInviteLink(data);
  else showToast(id ? 'Изменения сохранены.' : 'Учётная запись создана.');
  render();
}

async function saveRegisterCode() {
  const code = document.getElementById('regCodeInput').value.trim();
  const r = await fetch('/api/users/register-code', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось сохранить.');
  showToast(code ? 'Код доступа сохранён.' : 'Код убран — самостоятельный вход выключен.');
}

async function reinviteUser(id) {
  const r = await fetch(`/api/users/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reinvite: true }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось выпустить ссылку.');
  showInviteLink(data);
}

function showInviteLink(u) {
  openModal(`
    <div class="modal">
      <div class="modal-title">Ссылка-приглашение</div>
      <p class="modal-text">Отправьте её <b>${escapeHtml(u.name || u.login)}</b> любым удобным способом — в Telegram или на почту.
        Открыв ссылку, человек придумает пароль и сразу войдёт в портал. Ссылка одноразовая.</p>
      <div class="field"><input id="inviteUrl" value="${escapeHtml(u.invite_url)}" readonly onclick="this.select()"></div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Закрыть</button>
        <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('inviteUrl').value).then(()=>showToast('Ссылка скопирована.'))">Скопировать</button>
      </div>
    </div>`);
}

async function deleteUser(id, login) {
  if (!await confirmDialog({ title: 'Удалить учётную запись?', text: `<b>${escapeHtml(login)}</b><br>Этот человек больше не сможет войти в портал.` })) return;
  const r = await fetch(`/api/users/${id}`, { method: 'DELETE' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось удалить.');
  showToast('Учётная запись удалена.');
  render();
}


// =========================================================
// ЗАЯВКИ
// =========================================================
function isStaff() { return !!(state.user && (state.user.role === 'admin' || state.user.role === 'hr')); }
function isBuyer() { return !!(state.user && (state.user.role === 'admin' || state.user.role === 'buyer')); }
function isAccountant() { return !!(state.user && (state.user.role === 'admin' || state.user.role === 'accountant')); }
// финансовый директор видит обе панели, но заявки не ведёт: «К рассмотрению», цифры в меню и кнопки правок — не для него
function isCfo() { return !!(state.user && state.user.role === 'cfo'); }
function seesBuyer() { return isBuyer() || isCfo(); }
function seesAccountant() { return isAccountant() || isCfo(); }
// кто ведёт заявки этого вида: командировки — HR, техника — закупщик, компенсации по чекам — бухгалтерия, админ — всё
function canManageRequest(r) { return r.type === 'it' ? isAdmin() : r.type === 'equipment' ? isBuyer() : r.type === 'compensation' ? isAccountant() : isStaff(); }

const REQ_STATUS = {
  approval: ['Ждёт одобрения руководителя', 'approval'],
  new: ['Новая', 'new'], in_progress: ['В работе', 'progress'], ordered: ['Заказано', 'progress'], done: ['Оформлена', 'done'],
  rejected: ['Отклонена', 'rejected'], cancelled: ['Отменена', 'cancelled'],
};
const YES_NO = [['no', 'Нет'], ['yes', 'Да']];

// Схема формы — по ней строится и сама форма, и просмотр заявки. Повторяет бланк «Заявка на оформление командировки».
const TRIP_FORM = [
  { title: '1. Информация о сотруднике', fields: [
    { k: 'org', l: 'Организация' },
    { k: 'full_name', l: 'Фамилия, имя', req: true },
    { k: 'position', l: 'Должность' },
    { k: 'phone', l: 'Контактный номер телефона', t: 'tel', half: true },
    { k: 'email', l: 'Электронная почта', t: 'email', half: true },
  ]},
  { title: '2. Информация о командировке', fields: [
    { k: 'purpose', l: 'Цель командировки', t: 'textarea', req: true },
    { k: 'from_city', l: 'Город отправления', req: true, half: true },
    { k: 'to_city', l: 'Город назначения', req: true, half: true },
    { k: 'date_start', l: 'Дата начала командировки', t: 'date', req: true, half: true },
    { k: 'date_end', l: 'Дата окончания командировки', t: 'date', req: true, half: true },
    { k: 'extend', l: 'Возможность продления командировки', t: 'radio', o: YES_NO },
    { k: 'extend_term', l: 'Возможный срок продления', showIf: ['extend', 'yes'] },
  ]},
  { title: '3. Билеты', fields: [
    { k: 'transport', l: 'Нужен билет и на каком транспорте', t: 'radio', req: true,
      o: [['plane', 'Самолёт'], ['train', 'Поезд'], ['car', 'Личный автомобиль'], ['none', 'Транспорт не нужен']] },
  ]},
  { title: '3.1 Авиабилет', showIf: ['transport', 'plane'], fields: [
    { k: 'doc_number', secret: true, l: 'Номер документа, удостоверяющего личность (загранпаспорт)', half: true },
    { k: 'doc_valid', secret: true, l: 'Срок действия документа', t: 'date', half: true },
    { k: 'latin_name', secret: true, l: 'Фамилия и имя на латинице (как в документе)' },
    { k: 'dep_from', l: 'Вылет из города отправления — с', t: 'time', half: true },
    { k: 'dep_to', l: 'до', t: 'time', half: true },
    { k: 'arrive_by', l: 'К какому времени необходимо прибыть в город назначения' },
    { k: 'airline_pref', l: 'Есть ли предпочтения по авиакомпании / рейсу', t: 'radio', o: YES_NO },
    { k: 'airline', l: 'Авиакомпания / рейс', showIf: ['airline_pref', 'yes'] },
    { k: 'return_ticket', l: 'Нужен ли обратный авиабилет сразу при оформлении', t: 'radio', o: [['yes', 'Да'], ['later', 'Нет, приобрести позже']] },
    { k: 'ret_from', l: 'Обратный вылет — с', t: 'time', half: true, showIf: ['return_ticket', 'yes'] },
    { k: 'ret_to', l: 'до', t: 'time', half: true, showIf: ['return_ticket', 'yes'] },
    { k: 'plane_notes', l: 'Дополнительные пожелания по перелёту', t: 'textarea' },
  ]},
  { title: '3.2 Железнодорожный билет', showIf: ['transport', 'train'], fields: [
    { k: 't_dep_from', l: 'Отправление из города отправления — с', t: 'time', half: true },
    { k: 't_dep_to', l: 'до', t: 'time', half: true },
    { k: 't_arrive_by', l: 'К какому времени необходимо прибыть в город назначения' },
    { k: 't_class', l: 'Предпочтительный тип вагона / класс обслуживания' },
    { k: 't_return', l: 'Нужен ли обратный ж/д билет сразу при оформлении', t: 'radio', o: [['yes', 'Да'], ['later', 'Нет, приобрести позже']] },
    { k: 't_ret_from', l: 'Обратное отправление — с', t: 'time', half: true, showIf: ['t_return', 'yes'] },
    { k: 't_ret_to', l: 'до', t: 'time', half: true, showIf: ['t_return', 'yes'] },
    { k: 't_notes', l: 'Дополнительные пожелания', t: 'textarea' },
  ]},
  { title: '3.3 Поездка на личном автомобиле', showIf: ['transport', 'car'], fields: [
    { k: 'route', l: 'Маршрут' },
    { k: 'car_model', l: 'Марка / модель автомобиля', half: true },
    { k: 'car_plate', l: 'Государственный номер автомобиля', half: true },
    { k: 'fuel_comp', l: 'Компенсация расходов на бензин', t: 'radio', o: YES_NO },
    { k: 'fuel_sum', l: 'Предполагаемая сумма компенсации, тенге', t: 'number', showIf: ['fuel_comp', 'yes'] },
    { k: 'other_comp', l: 'Компенсация иных расходов, связанных с поездкой', t: 'radio', o: YES_NO },
    { k: 'other_comp_text', l: 'Каких именно', showIf: ['other_comp', 'yes'] },
  ]},
  { title: '4. Проживание', fields: [
    { k: 'stay', l: 'Проживание необходимо', t: 'radio', o: YES_NO },
    { k: 'nights', l: 'Количество ночей', t: 'number', half: true, showIf: ['stay', 'yes'] },
    { k: 'stay_type', l: 'Предпочтительный вариант проживания', t: 'radio', showIf: ['stay', 'yes'],
      o: [['hotel', 'Гостиница'], ['flat', 'Квартира'], ['apart', 'Апартаменты'], ['any', 'Не имеет значения']] },
    { k: 'stay_option', l: 'Как оплачиваем', t: 'radio', showIf: ['stay', 'yes'],
      o: [['advance', 'Вариант 1 — компания перечисляет сумму заранее, бронирую сам и предоставляю счёт'],
          ['self', 'Вариант 2 — бронирую сам, предоставляю счёт на оплату или чек для компенсации по факту']] },
    { k: 'stay_sum', l: 'Необходимая сумма на проживание, тенге', t: 'number', showIf: ['stay_option', 'advance'] },
  ]},
  { title: '5. Дополнительные расходы и пожелания', fields: [
    { k: 'extra', l: 'Нужны ли дополнительные услуги / расходы в рамках командировки', t: 'radio', o: YES_NO },
    { k: 'extra_text', l: 'Какие именно', t: 'textarea', showIf: ['extra', 'yes'] },
    { k: 'notes', l: 'Дополнительная информация, которую необходимо учесть', t: 'textarea' },
  ]},
];

const TRIP_IMPORTANT = [
  'Если стоимость билета через агентства-партнёры компании превышает установленный лимит, сотрудник приобретает билет самостоятельно. При предоставлении подтверждающих документов расходы компенсируются компанией в ближайший день выплат.',
  'Лимит на проживание необходимо уточнять у ответственного лица, в бухгалтерии или HR в соответствии с действующими правилами компании.',
  'Изменение дат командировки, маршрута, билетов или проживания после подачи заявки необходимо предварительно согласовывать.',
  'Билеты, проживание и иные расходы оформляются только после получения согласования руководителя.',
];
const TRIP_AFTER = [
  'Отчёт по командировке — форму можно запросить в бухгалтерии или у HR',
  'Авансовый отчёт (выдаёт бухгалтерия, сотрудник подписывает)',
  'Копию приказа о командировке и копию приказа о продлении',
  'Билеты и посадочные талоны (авиа / ж-д) или чеки за бензин — при поездке на личном автомобиле',
  'Документы и чеки, подтверждающие оплату проживания',
  'Дополнительные чеки по расходам, подлежащим компенсации (если были)',
  'При зарубежной командировке — копию паспорта с отметками о пересечении границы',
];

// ---- заявка на технику и оборудование ----
const EQUIP_CATEGORIES = [['laptop', 'Ноутбук / компьютер'], ['monitor', 'Монитор'], ['periph', 'Мышь, клавиатура, гарнитура'],
  ['phone', 'Телефон / связь'], ['tools', 'Инструмент, оборудование для монтажа'], ['supplies', 'Расходники'],
  ['software', 'Программа / лицензия'], ['other', 'Другое']];
// Компенсация по чекам (06.10.2026, просьба пользователя: «в заявках добавь компенсация по чекам, и эти заявки должны
// прилетать Лейле»; он выбрал короткую форму, без согласования руководителем, заявки видит вся бухгалтерия).
// Поле с чеком — файл: грузится отдельным запросом перед отправкой заявки; secret — в Connect AI не уходит.
const COMPENSATION_KINDS = [['ai', 'ИИ-инструмент'], ['other', 'Другое']];
// Какой ИИ-инструмент — только из списка, руками не пишут (слова пользователя 06.10.2026: «чтобы человек не писал, а были
// только варианты… самые популярные, инструментов 10, сверху популярные, ниже менее популярные»). Это сервисы, за которые
// сотрудники просят компенсацию, а не поставщик Connect AI: правило «не называть вендора AI» сюда не относится,
// проверка в checks/rules.py пропускает список между метками.
/* AI_TOOLS_BEGIN */
const COMPENSATION_TOOLS = ['Claude', 'Gemini', 'ChatGPT', 'DeepSeek', 'Perplexity', 'Microsoft Copilot', 'GitHub Copilot', 'Cursor', 'Midjourney', 'Grok'].map(x => [x, x]);
/* AI_TOOLS_END */
const COMPENSATION_FORM = [
  { title: '1. Кто просит компенсацию', fields: [
    { k: 'full_name', l: 'Фамилия, имя', req: true },
    { k: 'position', l: 'Должность', half: true },
    { k: 'department', l: 'Подразделение', half: true },
    { k: 'phone', l: 'Контактный номер телефона', t: 'tel' },
  ]},
  { title: '2. Покупка', fields: [
    // два вида (06.10.2026, слова пользователя: «должно быть компенсация за ИИ инструмент и свободная форма компенсации
    // за что-то другое»): от выбора зависит, какие поля показываются
    { k: 'category', l: 'За что компенсация', t: 'radio', o: COMPENSATION_KINDS, req: true },
    { k: 'tool', l: 'Какой ИИ-инструмент', t: 'radio', o: COMPENSATION_TOOLS, req: true, showIf: ['category', 'ai'] },
    { k: 'item', l: 'Что купили и для чего', t: 'textarea', req: true, showIf: ['category', 'other'] },
    // период, сумму и дату покупки не спрашиваем: они есть в чеке (слова пользователя 06.10.2026)
    { k: 'receipt', l: 'Чек', t: 'file', req: true, secret: true, upload: '/api/receipt-upload',
      accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png', hint: 'Фото (JPG, PNG) или PDF, до 10 МБ' },
    { k: 'notes', l: 'Комментарий', t: 'textarea' },
  ]},
];
const EQUIP_FORM = [
  { title: '1. Кто заказывает', fields: [
    { k: 'full_name', l: 'Фамилия, имя', req: true },
    { k: 'position', l: 'Должность', half: true },
    { k: 'department', l: 'Подразделение', half: true },
    { k: 'phone', l: 'Контактный номер телефона', t: 'tel' },
  ]},
  { title: '2. Что нужно', fields: [
    { k: 'category', l: 'Категория', t: 'radio', o: EQUIP_CATEGORIES },
    { k: 'item', l: 'Что именно нужно', req: true },
    { k: 'qty', l: 'Количество', t: 'number', half: true },
    { k: 'budget', l: 'Примерная стоимость, тенге', t: 'number', half: true },
    { k: 'model', l: 'Желаемая модель или характеристики', t: 'textarea' },
    { k: 'link', l: 'Ссылка на пример (магазин, производитель)' },
  ]},
  { title: '3. Зачем и когда', fields: [
    { k: 'reason', l: 'Для чего нужно', t: 'textarea', req: true },
    { k: 'replace', l: 'Это замена сломанного или устаревшего', t: 'radio', o: YES_NO },
    { k: 'old_item', l: 'Что заменяем и что с ним случилось', showIf: ['replace', 'yes'] },
    { k: 'urgency', l: 'Срочность', t: 'radio', o: [['normal', 'Обычная'], ['urgent', 'Срочно — без этого работа стоит']] },
    { k: 'need_by', l: 'К какой дате нужно', t: 'date', half: true },
    { k: 'notes', l: 'Дополнительно', t: 'textarea' },
  ]},
];

// Виды заявок. Новый вид = схема формы + запись здесь + тип в REQUEST_TYPES на сервере.
// ---- заявка в поддержку IT: уходит администратору (админ-панель → «Поддержка IT») ----
const IT_CATEGORIES = [['pc', 'Компьютер / ноутбук'], ['net', 'Интернет, Wi-Fi, VPN'], ['mail', 'Почта и учётные записи'],
  ['soft', 'Программы и лицензии'], ['print', 'Принтер, сканер'], ['access', 'Доступы и пропуска'], ['other', 'Другое']];
const IT_FORM = [
  { title: '1. Кто обращается', fields: [
    { k: 'full_name', l: 'Фамилия, имя', req: true },
    { k: 'department', l: 'Подразделение', half: true },
    { k: 'phone', l: 'Контактный номер телефона', t: 'tel', half: true },
  ]},
  { title: '2. Что случилось', fields: [
    { k: 'category', l: 'С чем проблема', t: 'radio', o: IT_CATEGORIES },
    { k: 'problem', l: 'Опишите проблему: что делали, что пошло не так, что написано на экране', t: 'textarea', req: true },
    { k: 'place', l: 'Где вы находитесь (кабинет, рабочее место или «удалённо»)' },
    { k: 'urgency', l: 'Срочность', t: 'radio', o: [['normal', 'Обычная'], ['urgent', 'Срочно — без этого работа стоит']] },
    { k: 'remote', l: 'Можно подключиться к компьютеру удалённо', t: 'radio', o: YES_NO },
  ]},
];

// Трудовой отпуск и отпуск без сохранения — разные заявки (просьба HR от 21.09.2026):
// у них разные документы и разный порядок согласования.
const VAC_PURPOSE = [
  ['plan', 'Оформить отпуск на конкретные даты'],
  ['question', 'Уточнить, сколько дней осталось'],
];
const WHO_FIELDS = [
  { k: 'full_name', l: 'Фамилия, имя', req: true },
  { k: 'position', l: 'Должность', half: true },
  { k: 'department', l: 'Подразделение', half: true },
];
const VACATION_FORM = [
  { title: '1. Кто обращается', fields: WHO_FIELDS },
  { title: '2. Что нужно', fields: [
    { k: 'purpose', l: 'Что нужно', t: 'radio', o: VAC_PURPOSE },
    // botReq: в форме звёздочки нет, но Connect AI без дат заявку «оформить отпуск» собрать не должен
    { k: 'date_start', l: 'Первый день отпуска', t: 'date', half: true, showIf: ['purpose', 'plan'], botReq: true },
    { k: 'date_end', l: 'Последний день отпуска', t: 'date', half: true, showIf: ['purpose', 'plan'], botReq: true },
    { k: 'comment', l: 'Комментарий или вопрос к отделу кадров', t: 'textarea' },
  ]},
];
const UNPAID_FORM = [
  { title: '1. Кто обращается', fields: WHO_FIELDS },
  { title: '2. Даты и причина', fields: [
    { k: 'date_start', l: 'Первый день отпуска', t: 'date', req: true, half: true },
    { k: 'date_end', l: 'Последний день отпуска', t: 'date', req: true, half: true },
    { k: 'reason', l: 'Причина — зарплата за эти дни не начисляется, поэтому её указывают в приказе', t: 'textarea', req: true },
  ]},
];
// Поля и порядок — как в бланке HR «Заявка на подбор кандидата» (образец от Данили, 22.09.2026).
// Дата подачи в бланке есть, но её заполняет сам портал (created), поэтому в форме её нет.
const HIRE_TYPE = [['expand', 'Расширение штата'], ['replace', 'Замена действующего сотрудника'],
  ['vacant', 'Место уже свободно — сотрудник уволился']];
const CONTRACT_TYPE = [['labor', 'Трудовой договор'], ['gph', 'Договор ГПХ']];
const HIRING_FORM = [
  { title: '1. Информация о заявке', fields: [
    { k: 'full_name', l: 'Инициатор заявки — фамилия, имя', req: true },
    { k: 'initiator_position', l: 'Должность инициатора', half: true },
    { k: 'phone', l: 'Контактные данные', t: 'tel', half: true },
  ]},
  { title: '2. Информация о вакансии', fields: [
    { k: 'position', l: 'Название вакантной должности', req: true },
    { k: 'reason', l: 'Причина открытия вакансии', t: 'radio', o: HIRE_TYPE, req: true },
    { k: 'department', l: 'Подразделение / отдел', req: true, half: true },
    { k: 'chief', l: 'Непосредственный руководитель', half: true },
    { k: 'examples', l: 'Примеры компаний и должностей, где мог работать кандидат', t: 'textarea' },
  ]},
  { title: '3. Требования к кандидату', fields: [
    { k: 'requirements', l: 'Профессиональные требования', t: 'textarea', req: true },
    { k: 'education', l: 'Требования к образованию' },
    { k: 'duties', l: 'Должностные обязанности', t: 'textarea', req: true },
    { k: 'qualities', l: 'Личные качества' },
    { k: 'languages', l: 'Знание языков', half: true },
    { k: 'software', l: 'Знание программ', half: true },
    { k: 'gender', l: 'Предпочитаемый пол (необязательно)', half: true },
    { k: 'age', l: 'Предпочитаемый возраст (необязательно)', half: true },
  ]},
  { title: '4. Условия труда', fields: [
    { k: 'probation', l: 'Испытательный срок — есть ли и сколько', half: true },
    { k: 'schedule', l: 'График работы', half: true },
    { k: 'contract', l: 'Тип договора', t: 'radio', o: CONTRACT_TYPE },
    { k: 'salary', l: 'Заработная плата', half: true },
    { k: 'bonuses', l: 'Бонусы (если есть)', half: true },
    { k: 'benefits', l: 'Льготы / компенсации' },
    { k: 'workplace', l: 'Место работы нового сотрудника — город, улица, дом' },
  ]},
  { title: '5. Условия проведения собеседования', fields: [
    { k: 'interviewer', l: 'Кто будет проводить собеседование с кандидатом' },
    { k: 'stage3', l: 'Будет ли третий этап собеседования — если да, с кем (фамилия, имя, должность)' },
    { k: 'decider', l: 'Кто принимает решение о найме' },
  ]},
];
// как идёт подбор — из пояснений к бланку HR
const HIRING_PROCESS = [
  'Перед собеседованием с вами HR проводит с кандидатом телефонное или короткое видеоинтервью.',
  'Затем вам отправляют резюме кандидата, время и место второго этапа. Примерное время оговаривается заранее, за день.',
  'Если вы в другом городе, второй этап можно провести без HR.',
  'После собеседования важно вовремя дать HR обратную связь по кандидату.',
];
const FIRE_REASON = [['own', 'По собственному желанию'], ['agreement', 'По соглашению сторон'],
  ['probation', 'Не прошёл испытательный срок'], ['other', 'Другое — опишу ниже']];
const DISMISSAL_FORM = [
  { title: '1. Кто увольняется', fields: [
    { k: 'full_name', l: 'Фамилия, имя сотрудника', req: true },
    { k: 'position', l: 'Должность', half: true },
    { k: 'department', l: 'Подразделение', half: true },
    { k: 'last_day', l: 'Последний рабочий день', t: 'date', req: true, half: true },
  ]},
  { title: '2. Основание', fields: [
    { k: 'reason', l: 'Причина увольнения', t: 'radio', o: FIRE_REASON, req: true },
    { k: 'comment', l: 'Комментарий', t: 'textarea' },
  ]},
  { title: '3. Передача дел', fields: [
    { k: 'handover', l: 'Кому передаёт дела' , half: true },
    { k: 'equipment', l: 'Что нужно забрать: ноутбук, телефон, пропуск, ключи', t: 'textarea' },
  ]},
];

// «Mentor для новичка» (до 24.09.2026 — «бадди»; слово Mentor — по-английски, просьба пользователя) — из программы лояльности, уходит сразу в HR без согласования руководителя (24.09.2026)
const BUDDY_FORM = [
  { title: '1. О вас', fields: [
    { k: 'full_name', l: 'Фамилия, имя', req: true },
    { k: 'position', l: 'Должность', half: true },
    { k: 'department', l: 'Подразделение', half: true },
    { k: 'phone', l: 'Телефон', half: true },
  ]},
  { title: '2. Почему хотите участвовать', fields: [
    { k: 'motivation', l: 'Расскажите коротко, чем можете помочь новичку', t: 'textarea', req: true },
    { k: 'comment', l: 'Комментарий', t: 'textarea' },
  ]},
];

// «Рекомендовать друга» — из вакансии (24.09.2026): сразу в HR, видно, кто кого привёл (подарок и Community Coins по программе лояльности)
const REFERRAL_FORM = [
  { title: '1. Кто рекомендует', fields: [
    { k: 'full_name', l: 'Фамилия, имя', req: true },
    { k: 'department', l: 'Подразделение', half: true },
    { k: 'phone', l: 'Телефон', half: true },
  ]},
  { title: '2. Кандидат', fields: [
    { k: 'vacancy', l: 'Вакансия', req: true },
    { k: 'candidate', l: 'Фамилия, имя кандидата', req: true },
    { k: 'contact', l: 'Телефон или Telegram кандидата', req: true, half: true },
    { k: 'resume', l: 'Резюме', half: true },
    { k: 'comment', l: 'Почему рекомендуете', t: 'textarea' },
  ]},
];

const REQ_KINDS = {
  trip: {
    icon: 'plane', name: 'Командировка', cardSub: 'Билеты, проживание, расходы — одной заявкой', to: 'HR',
    formTitle: 'Заявка на оформление командировки',
    formSub: 'Заполните всё, что знаете, — так командировку оформят, купят билеты и организуют проживание без дополнительных уточнений',
    schema: TRIP_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    defaults: { extend: 'no', stay: 'no', extra: 'no' },
    rowTitle: d => `${d.from_city || ''} → ${d.to_city || ''}`,
    rowSub: d => `${fmtDay(d.date_start)} — ${fmtDay(d.date_end)}`,
    extraHtml: () => `
      <section class="trip-section trip-important">
        <h3 class="trip-section-title">Важно</h3>
        <ul>${TRIP_IMPORTANT.map(t => `<li>${t}</li>`).join('')}</ul>
        <div class="trip-after-title">По окончании командировки — предоставить в бухгалтерию в течение 3 рабочих дней:</div>
        <ul>${TRIP_AFTER.map(t => `<li>${t}</li>`).join('')}</ul>
      </section>`,
  },
  equipment: {
    icon: 'laptop', name: 'Техника и оборудование', cardSub: 'Ноутбук, монитор, инструмент, лицензия — всё, что нужно для работы', to: 'закупщику',
    formTitle: 'Заявка на технику и оборудование',
    formSub: 'Опишите, что нужно и зачем, — заявка сразу уйдёт закупщику. Чем точнее описание, тем быстрее купят именно то',
    schema: EQUIP_FORM, statuses: ['new', 'in_progress', 'ordered', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Выдано' },
    defaults: { qty: '1', replace: 'no', urgency: 'normal' },
    rowTitle: d => `${d.item || ''}${Number(d.qty) > 1 ? ' × ' + d.qty : ''}`,
    rowSub: d => [(EQUIP_CATEGORIES.find(c => c[0] === d.category) || [])[1], d.need_by ? 'нужно к ' + fmtDay(d.need_by) : ''].filter(Boolean).join(' · '),
    extraHtml: () => '',
  },
  compensation: {
    icon: 'receipt', name: 'Компенсация по чекам', cardSub: '', to: 'в бухгалтерию',
    formTitle: 'Заявка на компенсацию по чекам', formSub: '',
    schema: COMPENSATION_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Выплачено' },
    defaults: {},
    rowTitle: d => d.category === 'ai' ? 'ИИ-инструмент: ' + (d.tool || '') : (d.item || ''),
    rowSub: () => '',
    extraHtml: () => '',
    botNote: 'Чек (фото или PDF) бот не принимает: сотрудник прикладывает его сам в форме.',
    draftNote: 'Чек прикладывается в форме — фото или PDF.',
  },
  it: {
    icon: 'wrench', name: 'Поддержка IT', cardSub: 'Не работает компьютер, почта, VPN, принтер, нужен доступ', to: 'администратору',
    formTitle: 'Заявка в поддержку IT',
    formSub: 'Опишите, что случилось, — заявка сразу уйдёт системному администратору. Чем подробнее, тем быстрее починим',
    schema: IT_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Решено' },
    defaults: { urgency: 'normal', remote: 'yes' },
    rowTitle: d => (d.problem || '').length > 70 ? d.problem.slice(0, 70) + '…' : (d.problem || ''),
    rowSub: d => [(IT_CATEGORIES.find(c => c[0] === d.category) || [])[1], d.place].filter(Boolean).join(' · '),
    extraHtml: () => '',
  },
  vacation: {
    icon: 'sun', name: 'Трудовой отпуск', cardSub: 'Оплачиваемый отпуск — оформить или узнать остаток дней', to: 'HR',
    formTitle: 'Заявка на трудовой отпуск',
    formSub: 'Заявка уходит в отдел кадров. Если просто хотите узнать остаток дней — выберите это ниже, даты тогда не нужны',
    schema: VACATION_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Согласовано' },
    defaults: { purpose: 'plan' },
    rowTitle: d => d.purpose === 'question' ? 'Вопрос по отпуску' : 'Трудовой отпуск',
    rowSub: d => d.date_start ? `${fmtDay(d.date_start)}${d.date_end ? ' — ' + fmtDay(d.date_end) : ''}` : (d.comment || '').slice(0, 70),
    extraHtml: () => '',
  },
  unpaid: {
    icon: 'clock', name: 'Отпуск без сохранения', cardSub: 'Дни за свой счёт — с указанием причины', to: 'HR',
    formTitle: 'Заявка на отпуск без сохранения зарплаты',
    formSub: 'За эти дни зарплата не начисляется. Причина попадёт в приказ, поэтому опишите её коротко и по делу',
    schema: UNPAID_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Согласовано' },
    rowTitle: () => 'Отпуск без сохранения',
    rowSub: d => `${fmtDay(d.date_start)}${d.date_end ? ' — ' + fmtDay(d.date_end) : ''}`,
    extraHtml: () => '',
  },
  hiring: {
    icon: 'userplus', name: 'Подбор персонала', cardSub: 'Открыть вакансию в своём подразделении', to: 'HR', managerOnly: true,
    formTitle: 'Заявка на подбор персонала',
    formSub: 'Чем подробнее опишете задачи и требования, тем точнее отдел кадров подберёт кандидатов',
    schema: HIRING_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { in_progress: 'Ищем', done: 'Закрыта' },
    defaults: { reason: 'expand', contract: 'labor' },
    rowTitle: d => d.position || 'Подбор персонала',
    rowSub: d => [d.department, (HIRE_TYPE.find(x => x[0] === d.reason) || [])[1]].filter(Boolean).join(' · '),
    extraHtml: () => `
      <section class="trip-section trip-important">
        <h3 class="trip-section-title">Как проходит подбор</h3>
        <ul>${HIRING_PROCESS.map(t => `<li>${t}</li>`).join('')}</ul>
      </section>`,
  },
  dismissal: {
    icon: 'userminus', name: 'Увольнение', cardSub: 'Оформить увольнение и передачу дел', to: 'HR',
    formTitle: 'Заявка на увольнение',
    formSub: 'Заявка уходит в отдел кадров: подготовят документы, рассчитают и закроют доступы',
    schema: DISMISSAL_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Оформлено' },
    defaults: { reason: 'own' },
    // увольнение оформляют и на себя, и на своего сотрудника — Connect AI обязан уточнить, о ком речь
    botAsksWho: true,
    botNote: 'сначала уточни, кто увольняется — сам сотрудник или кто-то из его подчинённых. Если сам — поля full_name, position, department не заполняй, портал подставит их; если другой человек — спроси и запиши его фамилию и имя.',
    rowTitle: d => d.full_name ? `Увольнение — ${d.full_name}` : 'Увольнение',
    rowSub: d => [d.position, d.last_day ? `последний день ${fmtDay(d.last_day)}` : ''].filter(Boolean).join(' · '),
    extraHtml: () => '',
  },
  referral: {
    icon: 'userplus', name: 'Рекомендовать кандидата', cardSub: 'Привести друга на открытую вакансию', to: 'HR', hidden: true,
    formTitle: 'Рекомендация кандидата',
    formSub: 'Заявка уходит сразу в HR',
    schema: REFERRAL_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { in_progress: 'На рассмотрении', done: 'Принят на работу', rejected: 'Не подошёл' },
    rowTitle: d => `${d.candidate || 'Кандидат'} → ${d.vacancy || ''}`,
    rowSub: d => d.full_name ? `рекомендует ${d.full_name}` : '',
    extraHtml: () => '',
  },
  buddy: {
    icon: 'users', name: 'Mentor для новичка', cardSub: 'Помогать новичкам освоиться в компании', to: 'HR',
    formTitle: 'Заявка в программу Mentor',
    formSub: 'Заявка уходит сразу в HR',
    schema: BUDDY_FORM, statuses: ['new', 'in_progress', 'done', 'rejected', 'cancelled'],
    statusLabels: { done: 'Принято' },
    rowTitle: d => `Mentor — ${d.full_name || ''}`,
    rowSub: d => [d.position, d.department].filter(Boolean).join(' · '),
    extraHtml: () => '',
  },
};
function reqKind(r) { return REQ_KINDS[r.type] || REQ_KINDS.trip; }
function reqStatus(r) {
  if (r.status === 'approval') return [`Ждёт одобрения: ${escapeHtml(r.approver_name || 'руководителя')}`, 'approval'];   // имя из справочника — экранируем (аудит 25.09.2026)
  const [label, cls] = REQ_STATUS[r.status] || [r.status, 'new'];
  return [(reqKind(r).statusLabels || {})[r.status] || label, cls];
}

function updateRequestsBadge() {
  const staff = isStaff(), buyer = isBuyer(), acc = isAccountant();
  document.querySelectorAll('.staff-only').forEach(el => { el.hidden = !staff; });
  document.querySelectorAll('.buyer-only').forEach(el => { el.hidden = !seesBuyer(); });
  document.querySelectorAll('.accountant-only').forEach(el => { el.hidden = !seesAccountant(); });
  document.querySelectorAll('.admin-only').forEach(el => { el.hidden = !isAdmin(); });
  document.querySelectorAll('.cowork-only').forEach(el => { el.hidden = !canCowork(); });   // пункт WorkFlow теперь виден всем, без допуска внутри — «У вас нет прав»
  document.querySelectorAll('.side-badge').forEach(b => b.remove());
  const badge = (view, n, title) => {
    const el = document.querySelector(`.nav-item.side[data-view="${view}"]`);
    if (n && el) el.insertAdjacentHTML('beforeend', `<b class="side-badge" title="${title}: ${n}">${n}</b>`);
  };
  const fresh = type => (state.requests || []).filter(r => r.type === type && r.status === 'new').length;
  // цифра на пункте — только новые заявки (статус «новая»): взяли в работу — из счётчика ушла; ждущие одобрения директора ещё не у HR
  const hrTypes = Object.entries(REQ_KINDS).filter(([, k]) => k.to === 'HR').map(([t]) => t);
  if (staff) badge('hr', hrTypes.reduce((n, t) => n + fresh(t), 0), 'Новых заявок');
  if (buyer) badge('buyer', fresh('equipment'), 'Новых заявок на технику');
  if (acc) badge('accountant', fresh('compensation'), 'Новых заявок на компенсацию');
  if (isAdmin()) badge('admin', fresh('it'), 'Новых заявок в поддержку IT');
  if (state.user && state.user.emp_id) badge('manager', pendingApprovals(state.user.emp_id).length, 'Заявок ждут вашего одобрения');
  // «Задачи»: все мои незакрытые задачи (новые и в работе) плюс сданные мне на проверку (просьба пользователя 25.09.2026)
  if (state.tasks) { const w = tasksWaiting(); badge('tasks', w.active + w.review, 'Ваши задачи и задачи на проверке'); }
}

// ---------- задачник (25.09.2026) ----------
// Руководитель ставит задачу подчинённому (главы — своей команде, плюс все, у кого есть подчинённые в справочнике; админ — всем).
// Исполнитель: «Взять в работу» → «Сдать на проверку»; руководитель: «Принять» или «Вернуть на доработку» с комментарием.
const TASK_STATUS = { new: ['Новая', 'new'], work: ['В работе', 'progress'], review: ['На проверке', 'approval'], done: ['Готово', 'done'] };
function tasksData() { return state.tasks || { mine: [], given: [], team: [], can_assign: false }; }
function taskById(id) { const d = tasksData(); return d.mine.find(t => t.id === id) || d.given.find(t => t.id === id); }
function taskIsAuthor(t) { return !!(state.user && (t.author_id === state.user.id || isAdmin())); }
function taskIsAssignee(t) { return !!(state.user && state.user.emp_id && t.assignee_id === state.user.emp_id); }
function taskToday() { return astanaNow().toISOString().slice(0, 10); }
function taskDueHtml(t) {
  if (!t.due) return '';
  const today = taskToday(), open = t.status !== 'done';
  const cls = open && t.due < today ? ' late' : open && t.due === today ? ' today' : '';
  const word = cls === ' late' ? 'просрочено' : cls === ' today' ? 'сегодня' : 'срок';
  return `<span class="task-due${cls}">${ico('clock')}${word} · ${fmtDay(t.due)}</span>`;
}
function taskSort(a, b) {
  const order = { review: 0, new: 1, work: 2, done: 3 };
  if (a.status === 'done' || b.status === 'done') return (b.done_at || '').localeCompare(a.done_at || '');
  return (a.due || '9999').localeCompare(b.due || '9999') || order[a.status] - order[b.status] || b.created.localeCompare(a.created);
}
// сколько задач ждут действия: мне — новые и возвращённые; руководителю — сданные на проверку
function tasksWaiting() {
  const d = tasksData();
  return { fresh: d.mine.filter(t => t.status === 'new').length, review: d.given.filter(t => t.status === 'review').length,
           active: d.mine.filter(t => t.status === 'new' || t.status === 'work').length };   // на мне: новые и в работе
}
async function loadTasks() {
  const d = await fetchJson('/api/tasks');
  if (d) state.tasks = d;
  return d;
}
async function renderTasks(main) {
  if (!state.tasks) main.innerHTML = '<div class="loading">Загрузка…</div>';
  await loadTasks();
  if (state.view !== 'tasks') return;
  updateRequestsBadge(); renderSideWidgets();
  drawTasks(main);
}
function drawTasks(main) {
  const d = tasksData();
  const boss = d.can_assign || d.given.length > 0;
  const tab = boss && state.taskTab === 'given' ? 'given' : 'mine';
  let list = (tab === 'given' ? d.given : d.mine).slice();
  const people = [...new Map(d.given.map(t => [t.assignee_id, t.assignee_name])).entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || '', 'ru'));
  if (tab === 'given' && state.taskWho) list = list.filter(t => t.assignee_id === state.taskWho);
  const active = list.filter(t => t.status !== 'done').sort(taskSort);
  const done = list.filter(t => t.status === 'done').sort(taskSort);
  const openCount = arr => arr.filter(t => t.status !== 'done').length;
  const card = t => {
    const [sl, sc] = TASK_STATUS[t.status] || [t.status, 'new'];
    let act = '';
    if (tab === 'mine' && t.status === 'new') act = `<button class="btn secondary" onclick="event.stopPropagation();setTaskStatus('${t.id}','work')">Взять в работу</button>`;
    else if (tab === 'given' && t.status === 'review') act = `<button class="btn" onclick="event.stopPropagation();setTaskStatus('${t.id}','done')">Принять</button>`;
    return `
      <div class="task-card st-${t.status}" onclick="openTask('${t.id}')" role="button">
        <div class="task-main">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span>${tab === 'given' ? `${ico('user')}${escapeHtml(t.assignee_name || '')}` : `от ${escapeHtml(t.author_name || '')}`}</span>
            ${taskDueHtml(t)}
            ${t.status === 'work' && t.feedback ? `<span class="task-flag">вернули на доработку</span>` : ''}
          </div>
        </div>
        <span class="req-status ${sc}">${sl}</span>
        ${act}
      </div>`;
  };
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Задачи</div></div>
      ${d.can_assign ? `<button class="btn" onclick="openTaskForm()">Поставить задачу</button>` : ''}
    </div>
    ${boss ? `<div class="dep-chips">
      <button class="dep-chip${tab === 'mine' ? ' active' : ''}" onclick="state.taskTab='mine';render()">Мне поручено${openCount(d.mine) ? ' · ' + openCount(d.mine) : ''}</button>
      <button class="dep-chip${tab === 'given' ? ' active' : ''}" onclick="state.taskTab='given';render()">Я поручил${openCount(d.given) ? ' · ' + openCount(d.given) : ''}</button>
    </div>` : ''}
    ${tab === 'given' && people.length > 1 ? `<div class="field task-filter"><select onchange="state.taskWho=this.value;render()">
      <option value="">Все исполнители</option>${people.map(([id, n]) => `<option value="${escapeHtml(id)}" ${state.taskWho === id ? 'selected' : ''}>${escapeHtml(n || '')}</option>`).join('')}</select></div>` : ''}
    ${active.length ? `<div class="task-list">${active.map(card).join('')}</div>`
      : `<div class="empty"><strong>${tab === 'given' ? 'Активных задач у команды нет' : 'Активных задач нет'}</strong></div>`}
    ${done.length ? `<div class="req-list-title task-done-title">Выполненные</div><div class="task-list done">${done.slice(0, 30).map(card).join('')}</div>` : ''}`;
}
function openTask(id) {
  const t = taskById(id); if (!t) return;
  const [sl, sc] = TASK_STATUS[t.status] || [t.status, 'new'];
  const author = taskIsAuthor(t), assignee = taskIsAssignee(t);
  const foot = [];
  let extra = '';
  if (assignee && (t.status === 'new' || t.status === 'work')) {
    extra = `<div class="field"><label>Комментарий к сдаче (необязательно)</label><textarea id="tkComment"></textarea></div>`;
    if (t.status === 'new') foot.push(`<button class="btn secondary" onclick="setTaskStatus('${t.id}','work')">Взять в работу</button>`);
    foot.push(`<button class="btn" onclick="setTaskStatus('${t.id}','review')">Сдать на проверку</button>`);
  }
  if (author) {
    if (t.status === 'review' || t.status === 'done') extra += `<div class="field"><label>${t.status === 'review' ? 'Что доработать' : 'Почему возвращаете в работу'}</label><textarea id="tkBack"></textarea></div>`;
    foot.unshift(`<button class="btn text" onclick="deleteTask('${t.id}')">Удалить</button>`);
    if (t.status !== 'done') foot.push(`<button class="btn secondary" onclick="closeModal();openTaskForm('${t.id}')">Изменить</button>`);
    if (t.status === 'review' || t.status === 'done') foot.push(`<button class="btn secondary" onclick="setTaskStatus('${t.id}','work')">${t.status === 'review' ? 'Вернуть на доработку' : 'Вернуть в работу'}</button>`);
    if (t.status === 'review') foot.push(`<button class="btn" onclick="setTaskStatus('${t.id}','done')">Принять</button>`);
  }
  if (!foot.length || foot.every(b => b.includes('btn text'))) foot.push(`<button class="btn" onclick="closeModal()">Закрыть</button>`);
  openModal(`
    <div class="modal task-modal">
      <div class="modal-head"><h3>${escapeHtml(t.title)}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="task-meta big"><span class="req-status ${sc}">${sl}</span>${taskDueHtml(t)}</div>
        <div class="task-people">
          <div><span>Поставил</span>${escapeHtml(t.author_name || '')}</div>
          <div><span>Исполнитель</span>${escapeHtml(t.assignee_name || '')}</div>
          <div><span>Поставлена</span>${fmtDay(t.created)}</div>
          ${t.done_at ? `<div><span>Принята</span>${fmtDay(t.done_at)}</div>` : ''}
        </div>
        ${t.description ? `<div class="task-desc">${linkify(t.description)}</div>` : ''}
        ${t.feedback && t.status === 'work' ? `<div class="task-note back"><b>Вернули на доработку</b>${linkify(t.feedback)}</div>` : ''}
        ${t.report && (t.status === 'review' || t.status === 'done') ? `<div class="task-note"><b>Комментарий исполнителя</b>${linkify(t.report)}</div>` : ''}
        ${extra}
      </div>
      <div class="modal-foot">${foot.join('')}</div>
    </div>`);
}
function openTaskForm(id) {
  const d = tasksData();
  const t = id ? taskById(id) : null;
  const team = d.team.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (t && !team.some(e => e.id === t.assignee_id)) team.unshift({ id: t.assignee_id, name: t.assignee_name, position: '' });
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${t ? 'Задача' : 'Новая задача'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Исполнитель</label>
          <select id="tfWho">${t ? '' : '<option value="">Выберите сотрудника</option>'}${team.map(e => `<option value="${escapeHtml(e.id)}" ${(t ? t.assignee_id : state.taskWho) === e.id ? 'selected' : ''}>${escapeHtml(e.name)}${e.position ? ' — ' + escapeHtml(e.position) : ''}</option>`).join('')}</select></div>
        <div class="field"><label>Что нужно сделать</label><input id="tfTitle" type="text" maxlength="300" value="${escapeHtml(t ? t.title : '')}"></div>
        <div class="field"><label>Подробности (необязательно)</label><textarea id="tfDesc">${escapeHtml(t ? t.description || '' : '')}</textarea></div>
        <div class="field"><label>Срок (необязательно)</label><input id="tfDue" type="date" value="${escapeHtml(t ? t.due || '' : '')}"></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="tfSave" onclick="saveTask(${t ? `'${t.id}'` : ''})">${t ? 'Сохранить' : 'Поставить задачу'}</button>
      </div>
    </div>`);
}
async function saveTask(id) {
  const body = { assignee_id: document.getElementById('tfWho').value, title: document.getElementById('tfTitle').value.trim(),
    description: document.getElementById('tfDesc').value.trim(), due: document.getElementById('tfDue').value };
  if (!body.assignee_id) return showToast('Выберите исполнителя');
  if (!body.title) return showToast('Напишите, что нужно сделать');
  const btn = document.getElementById('tfSave'); btn.disabled = true;
  const r = await fetch(id ? `/api/tasks/${id}` : '/api/tasks', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; return showToast(res.error || 'Не удалось сохранить'); }
  await loadTasks();
  state.taskTab = 'given';
  closeModal(); render(); showToast(id ? 'Задача сохранена' : 'Задача поставлена');
}
async function setTaskStatus(id, status) {
  const back = document.getElementById('tkBack'), rep = document.getElementById('tkComment');
  const t = taskById(id);
  const comment = status === 'work' && t && taskIsAuthor(t) && !taskIsAssignee(t) ? (back ? back.value.trim() : '') : (rep ? rep.value.trim() : '');
  if (status === 'work' && t && taskIsAuthor(t) && (t.status === 'review' || t.status === 'done') && !comment) {
    if (!back) return openTask(id);
    back.focus(); return showToast('Напишите, что нужно доработать');
  }
  const r = await fetch(`/api/tasks/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, comment }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(res.error || 'Не удалось изменить статус');
  await loadTasks();
  closeModal(); render();
  showToast({ work: t && t.status !== 'new' ? 'Задача возвращена в работу' : 'Задача в работе', review: 'Задача сдана на проверку', done: 'Задача принята' }[status] || 'Готово');
}
async function deleteTask(id) {
  if (!(await confirmDialog({ title: 'Удалить задачу?' }))) return;
  const r = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!r.ok) return showToast('Не удалось удалить');
  await loadTasks();
  closeModal(); render(); showToast('Задача удалена');
}

// текст из базы: экранируем, а ссылки делаем кликабельными (в шагах для новичков и ответах FAQ
// пишут «напишите сюда: https://t.me/...», и такую ссылку удобнее нажать, чем копировать)
function linkify(text) {
  return escapeHtml(text || '').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, url =>
    `<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>`);
}

function fmtDay(iso) { return iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

function renderRequests(main) {
  if (state.reqForm && REQ_KINDS[state.reqForm]) return renderRequestForm(main, state.reqForm);
  const mine = (state.requests || []).filter(r => r.user_id === state.user.id);

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Заявки</div></div>
    </div>

    <div class="req-types">
      ${Object.entries(REQ_KINDS).filter(([, k]) => !k.hidden).map(([key, k]) => `
        <div class="req-type${k.managerOnly && !isManager() ? ' locked' : ''}" onclick="openRequestForm('${key}')" role="button">
          <div class="req-type-mark">${ico(k.icon)}</div>
          <div class="req-type-title">${k.name}</div>
          ${k.managerOnly ? `<div class="req-type-badge">${ico('lock')} Только для руководителей</div>` : ''}
          <div class="req-type-go">${k.managerOnly && !isManager() ? 'Недоступно' : 'Заполнить →'}</div>
        </div>`).join('')}
      ${[['clock', 'Отгул'], ['file', 'Справка с места работы']].map(([m, t]) => `
        <div class="req-type soon"><div class="req-type-mark">${ico(m)}</div><div class="req-type-title">${t}</div><div class="req-type-sub">Скоро</div></div>`).join('')}
    </div>

    <div class="req-list-title">Мои заявки
      <span class="req-links">
        ${isStaff() ? `<a class="req-hr-link" href="#" onclick="openHr('requests');return false;">Командировки всех — в HR-панели →</a>` : ''}
        ${seesBuyer() ? `<a class="req-hr-link" href="#" onclick="goToView('buyer');return false;">Заявки на технику — в панели закупщика →</a>` : ''}
        ${seesAccountant() ? `<a class="req-hr-link" href="#" onclick="goToView('accountant');return false;">Компенсации по чекам — в панели бухгалтера →</a>` : ''}
        ${isAdmin() ? `<a class="req-hr-link" href="#" onclick="openAdmin('support');return false;">Поддержка IT — в админ-панели →</a>` : ''}
      </span>
    </div>

    ${mine.length ? `<div class="req-list">${mine.map(r => requestRowHtml(r, false)).join('')}</div>`
    : `<div class="empty"><strong>Вы ещё не подавали заявок</strong></div>`}`;
}

function requestRowHtml(r, withAuthor) {
  const [sl, sc] = reqStatus(r);
  const k = reqKind(r), d = r.data || {};
  const urgent = d.urgency === 'urgent' && !['done', 'rejected', 'cancelled'].includes(r.status);
  return `
    <div class="req-row ${urgent ? 'urgent' : ''}" onclick="openRequest('${r.id}')" role="button">
      <div class="req-row-mark">${ico(k.icon)}</div>
      <div class="req-row-main">
        <div class="req-row-title">${escapeHtml(k.rowTitle(d))}${urgent ? ' <span class="req-urgent">срочно</span>' : ''}</div>
        <div class="req-row-sub">${[withAuthor ? r.author_name : '', k.rowSub(d)].filter(Boolean).map(escapeHtml).join(' · ')}</div>
      </div>
      <div class="req-status ${sc}">${sl}</div>
      <div class="req-row-date">подана ${fmtShortDateTime(r.created)}${r.done_at ? `<br>${reqDoneWord(r)} ${fmtShortDateTime(r.done_at)}` : ''}</div>
    </div>`;
}
// «выплачена 9 окт.» — дата, когда заявку закрыли (06.10.2026, слова пользователя: «даты, когда подана и когда выплачена»)
function reqDoneWord(r) { return r.type === 'compensation' ? 'выплачена' : r.type === 'equipment' ? 'выдана' : 'закрыта'; }

function isManager() { return !!(state.user && (state.user.is_manager || state.user.role === 'admin')); }
// заявки, которые ждут моего решения как директора (админ видит все ожидающие — может решить за директора)
function approvalsForMe(empId) {
  const me = empId || (state.user && state.user.emp_id);
  return (state.requests || []).filter(r => r.approver_id && (r.approver_id === me || (!empId && isAdmin() && r.approver_id)));
}
function pendingApprovals(empId) { return approvalsForMe(empId).filter(r => r.status === 'approval'); }

async function decideRequest(id, decision) {
  const comment = (document.getElementById('apprComment') || {}).value || '';
  if (decision === 'reject' && !comment.trim()) return showToast('Напишите причину отказа — сотрудник её увидит');
  const r = await fetch(`/api/requests/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, comment }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(res.error || 'Не удалось сохранить решение');
  const i = state.requests.findIndex(x => x.id === id);
  if (i >= 0) state.requests[i] = { ...state.requests[i], ...res };
  closeModal(); updateRequestsBadge(); render();
  showToast(decision === 'approve' ? 'Одобрено — заявка ушла дальше' : 'Заявка отклонена');
}
function openRequestForm(kind) {
  const k = REQ_KINDS[kind];
  if (k && k.managerOnly && !isManager()) {          // не руководитель — вежливый отказ, формы не показываем
    openModal(`
      <div class="modal">
        <div class="modal-head"><h3>Только для руководителей</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="modal-body">
          <p>Заявку на подбор персонала подаёт руководитель подразделения — тот, у кого есть команда в справочнике.</p>
          <p>Если в вашу команду нужен человек, скажите об этом своему руководителю: он подаст заявку. По остальным вопросам — отдел кадров.</p>
        </div>
        <div class="modal-foot"><button class="btn" onclick="closeModal()">Понятно</button></div>
      </div>`);
    return;
  }
  state.reqForm = kind; render(); window.scrollTo(0, 0);
}
function openTripForm() { openRequestForm('trip'); }
function closeTripForm() { state.reqForm = null; render(); }

function tripFieldHtml(fld, val) {
  const req = fld.req ? ' <i class="req-star">*</i>' : '';
  const show = fld.showIf ? ` data-showif="${fld.showIf[0]}=${fld.showIf[1]}"` : '';
  const cls = `field${fld.half ? ' half' : ''}`;
  if (fld.t === 'radio') {
    return `<div class="${cls} radio-field"${show}><label>${fld.l}${req}</label><div class="radio-row">${fld.o.map(([v, t]) => `
      <label class="radio-pill"><input type="radio" name="trip_${fld.k}" value="${v}" ${val === v ? 'checked' : ''} onchange="tripApplyVisibility()"><span>${t}</span></label>`).join('')}</div></div>`;
  }
  if (fld.t === 'file') return `<div class="${cls}"${show}><label>${fld.l}${req}</label><input id="trip_${fld.k}" type="file" accept="${fld.accept || ''}" onchange="tripFileChosen(this)"><div class="file-picked" hidden></div>${fld.hint ? `<div class="field-hint">${fld.hint}</div>` : ''}</div>`;
  if (fld.t === 'textarea') return `<div class="${cls}"${show}><label>${fld.l}${req}</label><textarea id="trip_${fld.k}">${escapeHtml(val || '')}</textarea></div>`;
  return `<div class="${cls}"${show}><label>${fld.l}${req}</label><input id="trip_${fld.k}" type="${fld.t || 'text'}" value="${escapeHtml(val || '')}"${fld.t === 'number' ? (fld.step ? ` min="0" step="${fld.step}" inputmode="decimal"` : ' min="0" inputmode="numeric"') : ''}></div>`;
}

// Файл выбран — поле зеленеет и под ним появляется строка с именем файла: иначе не видно, приложился ли чек
// (замечание пользователя 06.10.2026: «не подсвечивается, что чек загружен»).
function tripFileChosen(input) {
  const f = (input.files || [])[0], note = input.parentElement.querySelector('.file-picked');
  input.classList.toggle('has-file', !!f);
  const err = document.getElementById('tripError'); if (err && f) err.textContent = '';   // старая ошибка о файле не должна висеть рядом с «Файл приложен» (QA 07.10.2026)
  if (!note) return;
  note.hidden = !f;
  note.innerHTML = f ? `${ico('check')}<span>Файл приложен: ${escapeHtml(f.name)}</span>` : '';
}

function renderRequestForm(main, kindKey) {
  const k = REQ_KINDS[kindKey];
  // подставляем то, что уже знаем о человеке из справочника
  const me = state.employees.find(e => state.user.name && e.name.toLowerCase() === state.user.name.toLowerCase()) || {};
  const pre = { org: me.company || 'Connected Home', full_name: me.name || (state.user.role === 'admin' ? '' : state.user.name),
    position: me.position, department: me.department, phone: me.phone,
    email: me.email || (state.user.login.includes('@') ? state.user.login : ''), ...k.defaults, ...(state.reqPreset || {}) };
  // в подборе position — это «Название вакантной должности»: своя должность туда не годится (нашёл проверяющий 05.10.2026)
  if (kindKey === 'hiring' && !(state.reqPreset || {}).position) delete pre.position;
  state.reqPreset = null;
  main.innerHTML = `
    <div class="section-head">
      <div>
        <a class="back-link" href="#" onclick="closeTripForm();return false;">← Все заявки</a>
        <div class="section-title">${k.formTitle}</div>
        
      </div>
    </div>
    <form class="trip-form" onsubmit="submitRequestForm(event)">
      ${k.schema.map(sec => `
        <section class="trip-section"${sec.showIf ? ` data-showif="${sec.showIf[0]}=${sec.showIf[1]}"` : ''}>
          <h3 class="trip-section-title">${sec.title}</h3>
          <div class="trip-grid">${sec.fields.map(fl => tripFieldHtml(fl, pre[fl.k])).join('')}</div>
        </section>`).join('')}
      ${k.extraHtml()}
      <div class="trip-actions">
        <div class="login-error" id="tripError" role="alert"></div>
        <button type="button" class="btn secondary" onclick="closeTripForm()">Отмена</button>
        <button type="submit" class="btn" id="tripSubmit">Отправить заявку</button>
      </div>
    </form>`;
  tripApplyVisibility();
}

function tripValue(k) {
  const r = document.querySelector(`input[name="trip_${k}"]:checked`);
  if (r) return r.value;
  return (document.getElementById('trip_' + k)?.value || '').trim();
}

// показываем только те блоки, что относятся к выбранным ответам
function tripApplyVisibility() {
  document.querySelectorAll('.trip-form [data-showif]').forEach(el => {
    const [k, v] = el.dataset.showif.split('=');
    el.hidden = tripValue(k) !== v;
  });
}

async function submitRequestForm(e) {
  e.preventDefault();
  const kindKey = state.reqForm, k = REQ_KINDS[kindKey];
  const err = document.getElementById('tripError'); err.textContent = '';
  const data = {}, files = [];
  for (const sec of k.schema) {
    if (sec.showIf && tripValue(sec.showIf[0]) !== sec.showIf[1]) continue;       // скрытый раздел не отправляем
    for (const fl of sec.fields) {
      if (fl.showIf && tripValue(fl.showIf[0]) !== fl.showIf[1]) continue;
      if (fl.t === 'file') {                                   // файл уйдёт отдельным запросом после проверки остальных полей
        const f = (document.getElementById('trip_' + fl.k)?.files || [])[0];
        if (f) files.push([fl, f]);
        else if (fl.req) { err.textContent = `Приложите файл: «${fl.l}».`; document.getElementById('trip_' + fl.k)?.focus(); return; }
        continue;
      }
      const v = tripValue(fl.k);
      if (v) data[fl.k] = v;
      if (fl.req && !v) { err.textContent = `Заполните поле «${fl.l}».`; document.getElementById('trip_' + fl.k)?.focus(); return; }
    }
  }
  if (kindKey === 'trip' && data.date_end < data.date_start) { err.textContent = 'Дата окончания раньше даты начала.'; return; }
  const btn = document.getElementById('tripSubmit'); const btnText = btn.textContent; btn.disabled = true; btn.textContent = 'Отправляем…';
  for (const [fl, f] of files) {
    const fd = new FormData(); fd.append('file', f);
    const up = await fetch(fl.upload, { method: 'POST', body: fd });
    const ur = await up.json().catch(() => ({}));
    if (!up.ok || !ur.url) { err.textContent = ur.error || (up.status === 413 ? 'Файл слишком большой.' : 'Не удалось загрузить файл.'); btn.disabled = false; btn.textContent = btnText; return; }
    data[fl.k] = ur.url;
  }
  const r = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: kindKey, data }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) { err.textContent = res.error || 'Не удалось отправить заявку.'; btn.disabled = false; btn.textContent = btnText; return; }
  state.requests.unshift(res);
  state.reqForm = null;
  updateRequestsBadge(); render(); window.scrollTo(0, 0);
  showToast(res.status === 'approval' && res.approver_name ? `Заявка отправлена на одобрение: ${res.approver_name}` : `Заявка отправлена ${k.to}`);
}

function requestDetailHtml(r) {
  const d = r.data || {};
  return reqKind(r).schema.map(sec => {
    const rows = sec.fields.filter(fl => d[fl.k]).map(fl => {
      let v = d[fl.k];
      if (fl.t === 'radio') v = (fl.o.find(o => o[0] === v) || [0, v])[1];
      if (fl.t === 'date') v = fmtDay(v);
      if (fl.t === 'number') v = Number(v).toLocaleString('ru-RU');
      const isLink = (fl.k === 'link' || fl.k === 'resume' || fl.k === 'receipt') && /^(https?:\/\/|\/media\/)/i.test(String(v));
      const label = String(v).startsWith('/media/resume-') ? 'Открыть резюме' : String(v).startsWith('/media/receipt-') ? 'Открыть чек' : v;
      return `<div class="req-field"><span>${fl.l}</span><b>${isLink ? `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(String(v))}</b></div>`;
    }).join('');
    return rows ? `<div class="req-detail-sec"><h4>${sec.title}</h4>${rows}</div>` : '';
  }).join('');
}

function openRequest(id) {
  const r = state.requests.find(x => x.id === id); if (!r) return;
  const k = reqKind(r);
  const [sl, sc] = reqStatus(r);
  const manage = canManageRequest(r) && r.status !== 'approval', own = r.user_id === state.user.id;
  const who = r.type === 'it' ? 'администратора' : r.type === 'equipment' ? 'закупщика' : r.type === 'compensation' ? 'бухгалтерии' : 'HR';
  const iDecide = r.status === 'approval' && (r.approver_id === state.user.emp_id || isAdmin());
  const approvalHtml = !r.approver_id ? '' : r.status === 'approval' ? `
        <div class="req-approval wait">
          <div><b>Ждёт одобрения:</b> ${escapeHtml(r.approver_name || '')}${r.approver_pos ? ` · ${escapeHtml(r.approver_pos)}` : ''}</div>
          ${r.approver_online === false ? '<div class="req-approval-note">У руководителя пока нет доступа к порталу</div>' : ''}
          ${iDecide ? `
            <div class="field"><label>Комментарий${r.approver_id === state.user.emp_id ? '' : ' (решение за руководителя)'}</label><textarea id="apprComment"></textarea></div>` : ''}
        </div>`
      : r.decided_by ? `
        <div class="req-approval ${r.status === 'rejected' && r.approver_comment && !r.hr_comment ? 'no' : 'yes'}">
          <div><b>${r.status === 'rejected' && !r.hr_comment ? 'Отклонил руководитель' : 'Одобрил руководитель'}:</b> ${escapeHtml(r.decided_by)}${r.decided_at ? ` · ${fmtDateTime(r.decided_at)}` : ''}</div>
          ${r.approver_comment ? `<div class="req-approval-note">${escapeHtml(r.approver_comment)}</div>` : ''}
        </div>` : '';
  openModal(`
    <div class="modal req-modal">
      <div class="modal-head"><h3>${k.name} · ${escapeHtml(r.author_name || '')}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body" id="reqPrintArea" data-title="${escapeHtml(k.formTitle)}">
        <div class="req-detail-top"><span class="req-status ${sc}">${sl}</span><span class="req-row-date">подана ${fmtDateTime(r.created)}${r.done_at ? ` · ${reqDoneWord(r)} ${fmtDateTime(r.done_at)}${r.done_by && (canManageRequest(r) || isCfo()) ? ' — ' + escapeHtml(r.done_by) : ''}` : ''}</span></div>
        ${approvalHtml}
        ${r.hr_comment ? `<div class="req-comment"><b>Комментарий ${who}:</b> ${escapeHtml(r.hr_comment)}</div>` : ''}
        ${requestDetailHtml(r)}
        ${reqLogHtml(r, k)}
        ${manage ? `
        <div class="req-staff">
          <div class="field"><label>Статус</label>
            <select id="reqStatus">${k.statuses.map(st => `<option value="${st}" ${r.status === st ? 'selected' : ''}>${(k.statusLabels || {})[st] || REQ_STATUS[st][0]}</option>`).join('')}</select></div>
          <div class="field"><label>Комментарий для сотрудника</label><textarea id="reqComment">${escapeHtml(r.hr_comment || '')}</textarea></div>
        </div>` : ''}
      </div>
      <div class="modal-foot">
        ${own && (r.status === 'new' || r.status === 'approval') ? `<button class="btn text" onclick="cancelRequest('${r.id}')">Отменить заявку</button>` : ''}
        ${canManageRequest(r) && (r.status !== 'approval' || isAdmin()) ? `<button class="btn text" onclick="deleteRequest('${r.id}')">Удалить</button>` : ''}
        <button class="btn secondary" onclick="printRequest()">Печать</button>
        ${iDecide ? `<button class="btn secondary" onclick="decideRequest('${r.id}','reject')">Отклонить</button>
          <button class="btn" onclick="decideRequest('${r.id}','approve')">${r.approver_id === state.user.emp_id ? 'Одобрить' : 'Одобрить за руководителя'}</button>`
        : manage ? `<button class="btn" onclick="saveRequest('${r.id}')">Сохранить</button>` : `<button class="btn" onclick="closeModal()">Закрыть</button>`}
      </div>
    </div>`);
}

// история заявки по шагам с точным временем: подана, одобрена, взята в работу, закрыта (09.10.2026)
function reqLogHtml(r, k) {
  const log = r.log || [];
  if (!log.length) return '';
  const label = e => e.event === 'created' ? 'Подана' : e.event === 'approved' ? 'Одобрил руководитель' : e.event === 'declined' ? 'Отклонил руководитель'
    : e.event === 'cancelled' ? 'Отменена' : e.event === 'comment' ? 'Комментарий'
    : 'Статус: ' + (((k || {}).statusLabels || {})[e.status] || (REQ_STATUS[e.status] || [e.status])[0]);
  return `
    <div class="req-log no-tr">
      <div class="req-log-title">История</div>
      ${log.map(e => `
        <div class="req-log-row">
          <span class="req-log-time">${fmtShortDateTime(e.ts)}</span>
          <div class="req-log-what"><b>${escapeHtml(label(e))}</b>${e.actor ? ' · ' + escapeHtml(e.actor) : ''}${e.text ? `<div class="req-log-text">${escapeHtml(e.text)}</div>` : ''}</div>
        </div>`).join('')}
    </div>`;
}

async function saveRequest(id) {
  const res = await fetchJson(`/api/requests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: document.getElementById('reqStatus').value, hr_comment: document.getElementById('reqComment').value }) });
  if (!res) return showToast('Не удалось сохранить');
  state.requests[state.requests.findIndex(x => x.id === id)] = res;
  closeModal(); updateRequestsBadge(); render(); showToast('Заявка обновлена');
}

async function cancelRequest(id) {
  if (!await confirmDialog({ title: 'Отменить заявку?', text: 'Ответственный увидит, что заявка отменена. Если передумаете — подайте новую.', okText: 'Отменить заявку' })) return;
  const r = await fetch(`/api/requests/${id}/cancel`, { method: 'POST' });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(res.error || 'Не удалось отменить');
  state.requests[state.requests.findIndex(x => x.id === id)] = res;
  closeModal(); updateRequestsBadge(); render(); showToast('Заявка отменена');
}

async function deleteRequest(id) {
  if (!await confirmDialog({ title: 'Удалить заявку?', text: 'Заявка пропадёт и у сотрудника, и у вас. Отменить это будет нельзя.' })) return;
  const res = await fetchJson(`/api/requests/${id}`, { method: 'DELETE' });
  if (!res) return showToast('Не удалось удалить');
  state.requests = state.requests.filter(x => x.id !== id);
  closeModal(); updateRequestsBadge(); render(); showToast('Удалено');
}

function printRequest() {
  const html = document.getElementById('reqPrintArea').cloneNode(true);
  html.querySelector('.req-staff')?.remove();
  const printTitle = document.getElementById('reqPrintArea').dataset.title || 'Заявка';
  const w = window.open('', '_blank');
  if (!w) return showToast('Браузер заблокировал окно печати — разрешите всплывающие окна.');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(printTitle)}</title>
    <style>body{font:14px/1.5 Arial,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0 0 16px}h4{margin:18px 0 6px;font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px}
    .req-field{display:flex;gap:12px;padding:3px 0}.req-field span{flex:0 0 48%;color:#555}.req-status,.req-row-date{display:inline-block;margin-right:12px;color:#555}.req-comment{margin:10px 0;padding:8px;border:1px solid #ccc}</style>
    <h1>${escapeHtml(printTitle)}</h1>${html.innerHTML}`);
  w.document.close(); w.focus(); w.print();
}




// =========================================================
// ПРИВЕТСТВЕННОЕ ВИДЕО — в разделе «Новым сотрудникам». Загружают админ и HR, видео одно.
// =========================================================
function welcomeVideoHtml() {
  const v = state.welcomeVideo || {};
  if (!v.url) {
    return isStaff() ? `
      <div class="wv-empty">
        <div class="wv-empty-mark">${ico('film')}</div>
        <div class="wv-empty-text"><b>Приветственное видео</b><span>Загрузите ролик — новый сотрудник увидит его первым делом на этой странице. MP4, MOV или WebM, до 500 МБ.</span></div>
        <button class="btn" onclick="openWelcomeVideoForm()">Загрузить видео</button>
      </div>` : '';
  }
  return `
    <div class="wv-card">
      <div class="wv-head">
        <div><div class="wv-title">${escapeHtml(v.title)}</div><div class="wv-sub">Приветственное видео · посмотрите в первый день</div></div>
        <div class="wv-actions">
          <button class="icon-btn" onclick="openWelcomeVideoForm()">Заменить</button>
          <button class="btn text" onclick="deleteWelcomeVideo()">Удалить</button>
        </div>
      </div>
      <div class="wv-frame"><video controls preload="metadata" playsinline src="${escapeHtml(v.url)}"></video></div>
    </div>`;
}

function openWelcomeVideoForm() {
  const v = state.welcomeVideo || {};
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${v.url ? 'Заменить приветственное видео' : 'Приветственное видео'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Заголовок</label><input id="wvTitle" type="text" value="${escapeHtml(v.title || 'Добро пожаловать в Connected Home')}"></div>
        <div class="field"><label>Видеофайл</label>
          <input id="wvFile" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm">
          <div class="field-hint">MP4, MOV или WebM, до 500 МБ. Снятое в 4K лучше сжать до Full HD: на экране разницы не видно, а грузиться у коллег будет быстрее.${v.url ? ' Прежнее видео будет удалено.' : ''}</div>
        </div>
        <div class="wv-progress" id="wvProgress" hidden><div class="wv-progress-bar"><i id="wvBar"></i></div><span id="wvPct">0%</span></div>
        <div class="login-error" id="wvError" role="alert"></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="wvCancel" onclick="closeModal()">Отмена</button>
        <button class="btn" id="wvSubmit" onclick="submitWelcomeVideo()">Загрузить</button>
      </div>
    </div>`);
}

function submitWelcomeVideo() {
  const file = document.getElementById('wvFile').files[0];
  const err = document.getElementById('wvError'); err.textContent = '';
  if (!file) { err.textContent = 'Выберите видеофайл.'; return; }
  if (file.size > 500 * 1024 * 1024) { err.textContent = `Файл весит ${fmtBytes(file.size)} — больше 500 МБ. Сожмите видео до Full HD.`; return; }
  const fd = new FormData();
  fd.append('title', document.getElementById('wvTitle').value.trim());
  fd.append('file', file);
  const btn = document.getElementById('wvSubmit'); btn.disabled = true; btn.textContent = 'Загружаем…';
  document.getElementById('wvProgress').hidden = false;
  // большие файлы грузим через XMLHttpRequest — у него есть ход загрузки
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/welcome-video');
  xhr.upload.onprogress = e => { if (!e.lengthComputable) return; const p = Math.round(e.loaded / e.total * 100);
    document.getElementById('wvBar').style.width = p + '%'; document.getElementById('wvPct').textContent = p < 100 ? p + '%' : 'сохраняем…'; };
  const fail = msg => { err.textContent = msg; btn.disabled = false; btn.textContent = 'Загрузить'; document.getElementById('wvProgress').hidden = true; };
  xhr.onerror = () => fail('Связь оборвалась. Попробуйте ещё раз.');
  xhr.onload = () => {
    let data = {}; try { data = JSON.parse(xhr.responseText); } catch (_) {}
    if (xhr.status === 413) return fail(data.error || 'Файл слишком большой — больше 500 МБ.');
    if (xhr.status < 200 || xhr.status >= 300) return fail(data.error || `Не удалось загрузить (ошибка ${xhr.status}).`);
    state.welcomeVideo = data; closeModal(); render(); showToast('Видео загружено');
  };
  xhr.send(fd);
}

async function deleteWelcomeVideo() {
  if (!await confirmDialog({ title: 'Удалить приветственное видео?', text: 'Файл удалится с сервера. Загрузить новое можно будет в любой момент.' })) return;
  const r = await fetch('/api/welcome-video', { method: 'DELETE' });
  if (!r.ok) return showToast('Не удалось удалить');
  state.welcomeVideo = {}; render(); showToast('Видео удалено');
}

// =========================================================
// ОБЪЯВЛЕНИЕ НА ГЛАВНОЙ — одна плашка; ставит и снимает HR или админ из HR-панели
// =========================================================
function announcementHtml() {
  const a = state.announcement || {};
  if (!a.text) return '';
  return `
    <div class="announce ${a.important ? 'important' : ''}" role="status">
      <div class="announce-icon">${ico(a.important ? 'alert' : 'megaphone')}</div>
      <div class="announce-body">
        <div class="announce-text">${escapeHtml(a.text)}</div>
        <div class="announce-meta">${escapeHtml(a.author || 'Отдел кадров')}${a.until ? ' · актуально до ' + fmtDay(a.until) : ''}</div>
      </div>
      ${isStaff() ? `<button class="announce-edit" onclick="openAnnouncementForm()" title="Изменить или снять объявление">Изменить</button>` : ''}
    </div>`;
}

// карточка в HR-панели
function announcementAdminHtml() {
  const a = state.announcement || {};
  return `
    <div class="announce-admin">
      <div class="announce-admin-main">
        <div class="announce-admin-title">Объявление на главной</div>
        ${a.text
          ? `<div class="announce-admin-text">«${escapeHtml(a.text)}»</div>
             <div class="announce-admin-meta">висит сейчас${a.until ? ', снимется само после ' + fmtDay(a.until) : ', пока не снимете'}</div>`
          : `<div class="announce-admin-meta">Сейчас объявления нет.</div>`}
      </div>
      <div class="announce-admin-actions">
        ${a.text ? `<button class="btn text" onclick="removeAnnouncement()">Снять</button>` : ''}
        <button class="btn ${a.text ? 'secondary' : ''}" onclick="openAnnouncementForm()">${a.text ? 'Изменить' : 'Поставить объявление'}</button>
      </div>
    </div>`;
}

function openAnnouncementForm() {
  const a = state.announcement || {};
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Объявление на главной</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Текст — коротко, одной-двумя фразами</label>
          <textarea id="annText" maxlength="300" oninput="document.getElementById('annCount').textContent=this.value.length">${escapeHtml(a.text || '')}</textarea>
          
        </div>
        <div class="field"><label>Показывать до (необязательно)</label>
          <input id="annUntil" type="date" value="${escapeHtml(a.until || '')}">
          
        </div>
        <label class="field field-check"><input type="checkbox" id="annImportant" ${a.important ? 'checked' : ''}><span>Важное — выделить ярче</span></label>
      </div>
      <div class="modal-foot">
        ${a.text ? `<button class="btn text" onclick="removeAnnouncement()">Снять объявление</button>` : ''}
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="saveAnnouncement()">Опубликовать</button>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('annText')?.focus(), 60);
}

async function saveAnnouncement() {
  const body = { text: document.getElementById('annText').value.trim(), until: document.getElementById('annUntil').value,
    important: document.getElementById('annImportant').checked };
  if (!body.text) return showToast('Напишите текст объявления');
  const r = await fetch('/api/hr/announcement', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось опубликовать');
  state.announcement = data; closeModal(); render(); showToast('Объявление опубликовано — его видят все на главной');
}

async function removeAnnouncement() {
  if (!await confirmDialog({ title: 'Снять объявление?', text: 'Оно пропадёт с главной у всех сотрудников.', okText: 'Снять' })) return;
  const r = await fetch('/api/hr/announcement', { method: 'DELETE' });
  if (!r.ok) return showToast('Не удалось снять');
  state.announcement = {}; closeModal(); render(); showToast('Объявление снято');
}


// =========================================================
// АДМИН-ПАНЕЛЬ — видит только администратор
// =========================================================
function openAdmin(tab) { state.adminTab = tab || 'users'; goToView('admin'); }

const fmtBytes = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' ГБ' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
// время с сервера приходит в UTC — показываем по Астане
const fmtAstana = iso => { if (!iso) return '—'; const d = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z');
  return new Date(d.getTime() + 5 * 3600000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }); };
const fmtUptime = s => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return (d ? d + ' д ' : '') + (h ? h + ' ч ' : '') + m + ' мин'; };

const TABLE_NAMES = { agent_runs: 'Запуски агентов', users: 'Учётные записи', requests: 'Заявки', news: 'Новости', comments: 'Комментарии', documents: 'Документы',
  employees: 'Сотрудники', events: 'События календаря', faq: 'Частые вопросы', gallery: 'Ивенты', gallery_photos: 'Фото ивентов',
  partners: 'Партнёры', honors: 'Доска почёта', projects: 'Проекты', suggestions: 'Обращения', about: 'О компании',
  leaders: 'Руководители', onboarding_steps: 'Шаги для новичков', tasks: 'Задачи', attendance: 'Отметки посещаемости', elpass_cards: 'Карты турникета',
  english_att: 'Английский: отметки', game_scores: 'Мини-игры: результаты', game_time: 'Мини-игры: время', passes: 'Пропуски', profiles: 'Профили «О себе»',
  receipts: 'Чеки', resumes: 'Резюме', translations: 'Переводы', vacancies: 'Вакансии', settings: 'Настройки', audit: 'Журнал действий',
  request_log: 'История заявок', cowork_tasks: 'WorkFlow: задания', cowork_notes: 'WorkFlow: замечания', cowork_materials: 'WorkFlow: материалы', cowork_projects: 'WorkFlow: проекты', cowork_accounts: 'WorkFlow: учётки' };

// человеческое описание строки журнала
const AUDIT_WHAT = [[/^\/api\/login$/, 'вход в портал'], [/^\/api\/register$/, 'запрос первого входа'], [/^\/api\/invite\//, 'установка пароля по приглашению'],
  [/^\/api\/me\/password$/, 'смена своего пароля'], [/^\/api\/users\/register-code$/, 'код доступа'], [/^\/api\/users/, 'учётную запись'],
  [/^\/api\/hr\/invite$/, 'приглашение сотруднику'], [/^\/api\/hr\/announcement$/, 'объявление на главной'], [/^\/api\/admin\/backups/, 'копию базы'],
  [/^\/api\/admin\/test-mail$/, 'проверочное письмо'], [/^\/api\/requests\/.+\/cancel$/, 'отмена заявки'], [/^\/api\/requests/, 'заявку'],
  [/^\/api\/suggestions/, 'обращение'], [/^\/api\/news\/.+\/comments$/, 'комментарий'], [/^\/api\/news\/.+\/pin$/, 'закрепление новости'],
  [/^\/api\/news/, 'новость'], [/^\/api\/gallery\/photos/, 'фото ивента'], [/^\/api\/gallery/, 'ивент'], [/^\/api\/upload$/, 'загрузка файла'],
  [/^\/api\/employees/, 'сотрудника'], [/^\/api\/events/, 'событие'], [/^\/api\/projects/, 'проект'], [/^\/api\/partners/, 'партнёра'],
  [/^\/api\/honors/, 'запись доски почёта'], [/^\/api\/faq/, 'вопрос-ответ'], [/^\/api\/onboarding/, 'шаг для новичков'], [/^\/api\/tasks/, 'задача'], [/^\/api\/hr\//, 'HR-панель'], [/^\/api\/admin\//, 'админ-панель']];
function auditText(a) {
  const what = (AUDIT_WHAT.find(([re]) => re.test(a.path)) || [0, a.path])[1];
  const standalone = /вход|запрос|установка|смена|отмена|закрепление|загрузка|приглашение|проверочное/.test(what);
  if (a.status === 401 && a.path === '/api/login') return 'неудачный вход — неверный пароль';
  if (a.status === 429) return 'слишком много попыток — ' + what;
  if (a.status === 401) return 'нет входа — попытка: ' + what;
  if (a.status === 403) return 'отказано в доступе — ' + what;
  if (standalone) return what;
  return ({ POST: 'создал(а) ', PUT: 'изменил(а) ', DELETE: 'удалил(а) ' }[a.method] || '') + what;
}

async function renderAdmin(main) {
  const tab = state.adminTab || 'users';
  const tabs = [['support', 'Поддержка IT'], ['late', 'Опоздания'], ['cabinets', 'Кабинеты руководителей'], ['users', 'Учётные записи и роли'], ['status', 'Состояние системы'], ['services', 'Сервисы'], ['agents', 'Агенты'], ['audit', 'Журнал действий'], ['backups', 'Резервные копии']];
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Админ-панель</div></div>
      <button class="btn secondary" onclick="toggleViewAs()">${ico('eye')} Смотреть как сотрудник</button>
    </div>
    <div class="subtabs admin-tabs">${tabs.map(([k, l]) => `<button class="subtab ${tab === k ? 'active' : ''}" onclick="state.adminTab='${k}';render()">${l}</button>`).join('')}</div>
    <div id="adminBody"><div class="loading">Загрузка…</div></div>`;
  const body = document.getElementById('adminBody');
  if (tab === 'support') return renderAdminSupport(body);
  if (tab === 'late') return renderAdminLate(body);
  if (tab === 'cabinets') return renderAdminCabinets(body);
  if (tab === 'users') return renderUsers(body);
  if (tab === 'status') return renderAdminStatus(body);
  if (tab === 'services') return renderAdminServices(body);
  if (tab === 'agents') return renderAdminAgents(body);
  if (tab === 'audit') return renderAdminAudit(body);
  if (tab === 'backups') return renderAdminBackups(body);
}

// ---- админ-панель → «Опоздания»: проходы турникета и их состояние.
// У HR этого нет: ей каждый понедельник приходит готовый отчёт письмом (решение пользователя 21.09.2026).
async function renderAdminLate(body) {
  const late = await fetchJson('/api/hr/lateness' + (state.hrWeek ? '?start=' + state.hrWeek : '')) || { late: [], excused: [], has_passes: false, unmapped: 0 };
  if (!state.elpass) { state.elpass = await fetchJson('/api/hr/elpass') || { configured: false, cards: [] }; state.elpassCards = state.elpass.cards; }
  if (!state.sheet) state.sheet = await fetchJson('/api/hr/sheet') || { last: null };
  late.elpass = state.elpass;
  late.sheet = state.sheet;
  body.innerHTML = `
    
    ${hrLatenessHtml(late)}`;
}

// ---- админ-панель → «Кабинеты руководителей»: тот же кабинет, но глазами любого из глав подразделений ----
async function renderAdminCabinets(body) {
  const heads = state.employees.filter(e => Number(e.is_head)).sort((a, b) => (a.department || '').localeCompare(b.department || '', 'ru'));
  if (!heads.length) { body.innerHTML = '<div class="empty"><strong>Руководители подразделений не отмечены</strong></div>'; return; }
  if (!heads.some(h => h.id === state.adminCab)) state.adminCab = heads[0].id;
  body.innerHTML = `
    
    <div class="dep-chips">${heads.map(h => `
      <button class="dep-chip${h.id === state.adminCab ? ' active' : ''}" onclick="state.adminCab='${h.id}';state.mgrTab='team';render()">${escapeHtml(h.name)}
        <span>${escapeHtml(h.department || '')}</span></button>`).join('')}</div>
    <div id="mgrBox"><div class="loading">Загрузка…</div></div>`;
  await renderManagerInto(document.getElementById('mgrBox'), state.adminCab);
}

// ---- админ-панель → «Поддержка IT»: заявки сотрудников, устроено как панель закупщика ----
function renderAdminSupport(body) {
  const all = (state.requests || []).filter(r => r.type === 'it');
  const groups = { new: all.filter(r => r.status === 'new'), work: all.filter(r => r.status === 'in_progress'), all };
  let tab = state.supportTab || 'new';
  if (!groups[tab].length) tab = ['new', 'work', 'all'].find(t => groups[t].length) || tab;
  const list = groups[tab].slice().sort((a, b) =>
    ((b.data || {}).urgency === 'urgent') - ((a.data || {}).urgency === 'urgent') || (b.created || '').localeCompare(a.created || ''));
  const urgent = groups.new.filter(r => (r.data || {}).urgency === 'urgent').length;
  const tile = (key, num, label, hot) => `
    <button class="hr-tile ${tab === key ? 'active' : ''} ${hot ? 'hot' : ''}" onclick="state.supportTab='${key}';render()">
      <span class="hr-tile-num">${num}</span><span class="hr-tile-label">${label}</span></button>`;
  const empty = { new: 'Новых заявок нет', work: 'В работе ничего нет', all: 'Заявок пока не было' }[tab];
  body.innerHTML = `
    <div class="hr-tiles">
      ${tile('new', groups.new.length, urgent ? `новых, из них срочных: ${urgent}` : 'новых заявок', groups.new.length > 0)}
      ${tile('work', groups.work.length, 'в работе', false)}
      ${tile('all', all.length, 'всего заявок', false)}
    </div>
    <div class="hr-body">
      ${list.length ? `<div class="req-list">${list.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>${empty}</strong></div>`}
    </div>`;
}

async function renderAdminStatus(body) {
  const s = await fetchJson('/api/admin/status');
  if (!s) { body.innerHTML = '<div class="empty"><strong>Не удалось получить состояние</strong></div>'; return; }
  const usedPct = Math.round((1 - s.disk.free / s.disk.total) * 100);
  const last = s.backups[0];
  // копия делается раз в неделю — «устарела», если старше 8 дней
  const lastAgeH = last ? (Date.now() - new Date(last.time + 'Z').getTime()) / 3600000 : null;
  const ok = (good, text) => `<span class="adm-flag ${good ? 'ok' : 'bad'}">${text}</span>`;
  const card = (title, rows) => `<div class="adm-card"><div class="adm-card-title">${title}</div>${rows.map(([k, v]) => `<div class="adm-row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  body.innerHTML = `
    <div class="adm-grid">
      ${card('Версия портала', [
        ['Код', s.version.hash ? `<code>${escapeHtml(s.version.hash)}</code>` : 'неизвестно'],
        ['Выложено', s.version.time ? fmtAstana(s.version.time) : '—'],
        ['Последнее изменение', escapeHtml((s.version.message || '—').slice(0, 90) + ((s.version.message || '').length > 90 ? '…' : ''))],
        ['Работает без перезапуска', fmtUptime(s.uptime_sec)],
        ['Python / Flask', `${escapeHtml(s.python)} / ${escapeHtml(s.flask || '?')}`]])}
      ${card('Люди и доступ', [
        ['Учётных записей', s.users.total],
        ['Уже входили', s.users.active],
        ['Ждут приглашения', s.users.pending],
        ['Первый вход сотрудников', { mail: ok(true, 'письмом на почту'), code: ok(true, 'по коду доступа'), off: ok(false, 'выключен — только по ссылке от админа или HR') }[s.register_mode]],
        ['Защита куки (HTTPS)', ok(s.https_cookies, s.https_cookies ? 'включена' : 'выключена — это нормально только на localhost')]])}
      ${card('Данные', [
        ['База данных', fmtBytes(s.db.size)],
        ['Загруженные файлы', `${s.uploads.count} шт. · ${fmtBytes(s.uploads.size)}`],
        ['Диск сервера', `<span class="adm-bar"><i style="width:${usedPct}%" class="${usedPct > 85 ? 'bad' : ''}"></i></span> занято ${usedPct}% · свободно ${fmtBytes(s.disk.free)}`],
        ['Последняя копия базы', !s.backup_dir_ok ? ok(false, 'папка копий недоступна') : last ? ok(lastAgeH < 8 * 24, `${fmtAstana(last.time)} · ${fmtBytes(last.size)}`) : ok(false, 'копий нет')]])}
      ${card('Сервисы', [
        ['Почта', s.mail.configured ? ok(true, 'настроена · ' + escapeHtml(s.mail.from)) : ok(false, 'не настроена — письма не уходят')],
        ['Connect AI', s.ai.key ? ok(true, 'ключ на месте') : ok(false, 'нет ключа — бот не отвечает')],
        ['Лимит вопросов боту', `${s.ai.per_hour} в час на человека`],
        ['Модели по порядку', `<span class="adm-small">${s.ai.models.map(escapeHtml).join(' → ')}</span>`]])}
    </div>

    <div class="adm-card adm-wide">
      <div class="adm-card-title">Проверка почты</div>
      <div class="adm-inline">
        <input id="admMailTo" type="email" placeholder="куда отправить проверочное письмо" value="${escapeHtml((state.employees.find(e => e.name === state.user.name) || {}).email || '')}">
        <button class="btn secondary" onclick="adminTestMail()">Отправить</button>
      </div>
    </div>

    <div class="adm-card adm-wide">
      <div class="adm-card-title">Записей в базе</div>
      <div class="adm-counts">${Object.entries(s.db.counts).map(([t, n]) => `<div><b>${n}</b><span>${TABLE_NAMES[t] || t}</span></div>`).join('')}</div>
    </div>

    <div class="adm-card adm-wide">
      <div class="adm-card-title">История обновлений портала</div>
      ${s.deploy_log.length ? `<pre class="adm-log">${s.deploy_log.slice().reverse().map(escapeHtml).join('\n')}</pre>`
        : '<div class="adm-small">Журнал обновлений недоступен (на localhost его нет — он ведётся только на сервере).</div>'}
    </div>`;
}

// Вкладка «Сервисы»: всё, что подключено к порталу и работает в фоне, — одним взглядом (просьба пользователя 01.10.2026).
// Состояние считает сервер (`/api/admin/services`); «Проверить сейчас» делает настоящий запрос к сервису.
const SVC_FLAG = { ok: 'ok', warn: 'warn', bad: 'bad', off: 'off' };
async function renderAdminServices(body) {
  const d = await fetchJson('/api/admin/services');
  if (!d) { body.innerHTML = '<div class="empty"><strong>Не удалось получить состояние сервисов</strong></div>'; return; }
  const bad = d.items.filter(s => s.state === 'bad').length, warn = d.items.filter(s => s.state === 'warn').length;
  const sum = bad ? `<span class="adm-flag bad">Сбой: ${bad}</span>` : warn ? `<span class="adm-flag warn">Требуют внимания: ${warn}</span>` : '<span class="adm-flag ok">Все сервисы работают</span>';
  body.innerHTML = `
    <div class="svc-top">
      <div>${sum}${bad && warn ? ` <span class="adm-flag warn">Требуют внимания: ${warn}</span>` : ''} <span class="adm-small">на ${escapeHtml(d.checked)}</span></div>
      <button class="btn secondary" onclick="render()">${ico('refresh')} Обновить</button>
    </div>
    <div class="adm-grid">
      ${d.items.filter(s => !(['tg', 'staffbot'].includes(s.key) && s.state === 'off')).map(s => `
        <div class="adm-card svc-card ${SVC_FLAG[s.state] || ''}">
          <div class="svc-head">
            <div class="adm-card-title">${escapeHtml(s.title)}</div>
            <span class="adm-flag ${SVC_FLAG[s.state] || ''}">${escapeHtml(s.status)}</span>
          </div>
          ${s.rows.map(([k, v]) => `<div class="adm-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}
          ${s.check ? `<button class="btn secondary svc-check" onclick="adminSvcCheck(${jsArg(s.key)}, this)">Проверить сейчас</button>` : ''}
        </div>`).join('')}
    </div>
    <div class="adm-card adm-wide" id="tgBox"></div>
    <div class="adm-card adm-wide" id="staffBotBox"></div>
    <div class="adm-card adm-wide" id="hrBotBox"></div>
    ${tailsHtml(d)}`;
  drawTelegramBox();
  drawStaffBotBox();
  drawHrBotBox();
}

// ---- админ-панель → «Агенты» (06.10.2026, просьба пользователя: «название агента, за что он отвечает, что делает сейчас
// и что было сделано»). Агенты работают на компьютере пользователя и сами отмечают начало и конец работы
// (checks/agent_log.py); здесь только показываем. Пока вкладка открыта, она обновляется раз в полминуты.
const AGENT_RUN = { done: ['Сделано', 'ok'], failed: ['Не получилось', 'bad'], running: ['Работает', 'warn'], lost: ['Не отметил конец', 'off'] };
async function renderAdminAgents(body) {
  const d = await fetchJson('/api/admin/agents');
  if (!d) { body.innerHTML = '<div class="empty"><strong>Не удалось получить список агентов</strong></div>'; return; }
  body.innerHTML = `
    <div class="svc-top">
      <div><span class="adm-flag ${d.working ? 'warn' : 'off'}">${d.working ? 'Сейчас работают: ' + d.working : 'Сейчас никто не работает'}</span> <span class="adm-small">на ${escapeHtml(d.checked)}</span></div>
      <button class="btn secondary" onclick="render()">${ico('refresh')} Обновить</button>
    </div>
    <div class="adm-grid">
      ${d.agents.map(a => `
        <div class="adm-card svc-card agent-card ${a.now ? 'working' : ''}">
          <div class="svc-head">
            <div class="adm-card-title agent-name"><i>${ico(a.icon)}</i>${escapeHtml(a.name)}</div>
            <span class="adm-flag ${a.now ? 'warn' : 'off'}">${a.now ? 'Работает' : 'Свободен'}</span>
          </div>
          <div class="agent-duty">${escapeHtml(a.duty)}</div>
          <div class="adm-row"><span>Когда работает</span><b>${escapeHtml(a.when)}</b></div>
          <div class="adm-row agent-line"><span>Сейчас</span><b>${a.now ? escapeHtml(a.now.task || 'работает') + ` <em>с ${escapeHtml(a.now.since)}</em>` : 'не работает'}</b></div>
          <div class="adm-row agent-line"><span>Сделано</span><b>${a.last ? escapeHtml(a.last.result || (a.last.failed ? 'не получилось' : 'закончил')) + ` <em>${escapeHtml(a.last.when)}</em>` : 'запусков ещё не было'}</b></div>
          <div class="adm-row"><span>Запусков за неделю</span><b>${a.runs_week}</b></div>
        </div>`).join('')}
    </div>
    <div class="adm-card adm-wide">
      <div class="adm-card-title">Что было сделано</div>
      ${d.history.length ? `<div class="agent-log">${d.history.map(h => {
        const [label, cls] = AGENT_RUN[h.status] || AGENT_RUN.done;
        return `<div class="agent-log-row">
          <span class="agent-log-when">${escapeHtml(h.when)}</span>
          <span class="agent-log-who">${escapeHtml(h.agent)}</span>
          <span class="agent-log-what">${escapeHtml(h.result || h.task || '')}${h.status === 'done' && h.minutes ? ` <em>${h.minutes} мин</em>` : ''}</span>
          <span class="adm-flag ${cls}">${label}</span>
        </div>`; }).join('')}</div>` : '<div class="adm-small">Запусков ещё не было.</div>'}
    </div>`;
}
setInterval(() => {
  const box = document.getElementById('adminBody');   // перерисовываем только содержимое вкладки: без «Загрузка…» страница не прыгает
  if (box && state.user && state.view === 'admin' && state.adminTab === 'agents' && !document.querySelector('.modal-overlay, .modal')) renderAdminAgents(box);
}, 30 * 1000);

// «Хвосты»: всё временное, тестовое, не утверждённое и отложенное. Список ведётся в tails.json вместе с кодом,
// здесь только показываем; по понедельникам он же приходит в Telegram с утренним отчётом, а вопросы, ждущие решения, — каждый день.
function tailsHtml(d) {
  const tails = d.tails || [];
  if (!tails.length) return '';
  const groups = (d.tail_kinds || []).map(([kind, label]) => [label, tails.filter(t => t.kind === kind)]).filter(([, list]) => list.length);
  return `
    <div class="adm-card adm-wide tails-card">
      <div class="svc-head">
        <div class="adm-card-title">Не доделано</div>
        <span class="adm-flag warn">${tails.length}</span>
      </div>
      ${groups.map(([label, list]) => `
        <div class="tails-group">${escapeHtml(label)} <span>${list.length}</span></div>
        <ul class="tails-list">${list.map(t => `<li>${escapeHtml(t.text)}${t.since ? ` <span class="adm-small">с ${escapeHtml(t.since.slice(8, 10) + '.' + t.since.slice(5, 7))}</span>` : ''}</li>`).join('')}</ul>`).join('')}
      <button class="btn secondary" onclick="tailsToTelegram(this)">Прислать список в Telegram</button>
    </div>`;
}
async function tailsToTelegram(btn) {
  btn.disabled = true;
  if (await tgRequest('/api/admin/telegram/tails', 'POST')) showToast('Список отправлен в Telegram');
  btn.disabled = false;
}

// Бот для сотрудников (отдельный от бота отчётов): личные напоминания. Пока проба — подключиться может только админ.
async function drawStaffBotBox() {
  const box = document.getElementById('staffBotBox');
  if (!box) return;
  const b = await fetchJson('/api/admin/staffbot');
  if (!b) { box.innerHTML = ''; return; }
  let inner;
  if (!b.connected) {
    inner = `
      <div class="adm-small">Создайте у @BotFather ещё одного бота — для сотрудников — и вставьте сюда его токен.</div>
      <div class="adm-inline">
        <input id="staffBotToken" type="password" autocomplete="off" placeholder="Токен бота">
        <button class="btn" onclick="staffBotConnect()">Подключить бота</button>
      </div>`;
  } else {
    inner = `
      <div class="adm-row"><span>Бот</span><b>@${escapeHtml(b.bot)}</b></div>
      <div class="adm-row"><span>Кому пишет</span><b>${b.open ? 'всем, кто подключил Telegram в личном кабинете' : 'идёт проба — только вам'}</b></div>
      <div class="adm-row"><span>Опоздание без отметки</span><b>напоминание в ${b.slots.join(', ')}</b></div>
      <div class="adm-row"><span>Подключили Telegram</span><b>${b.linked.length ? b.linked.map(escapeHtml).join(', ') : 'пока никто'}</b></div>
      <div id="myTgAdmin" class="tg-mine"></div>
      <div class="adm-inline tg-actions">
        <button class="btn secondary" onclick="staffBotSample(this)">Прислать мне пример</button>
        <button class="btn secondary" onclick="staffBotOpen(${b.open ? 'false' : 'true'})">${b.open ? 'Вернуть режим пробы' : 'Открыть для всех сотрудников'}</button>
        <button class="btn secondary" onclick="staffBotDisconnect()">Отключить бота</button>
      </div>`;
  }
  box.innerHTML = `<div class="adm-card-title">Бот для сотрудников</div>${inner}`;
  drawMyTelegram('myTgAdmin');
}
// Бот для HR (06.10.2026): отчёт об опозданиях по понедельникам вместо письма и дни рождения сотрудников в сам день.
// Токен вставляет админ здесь; свой Telegram HR подключает в HR-панели (drawHrTelegram).
async function drawHrBotBox() {
  const box = document.getElementById('hrBotBox');
  if (!box) return;
  const b = await fetchJson('/api/admin/hrbot');
  if (!b) { box.innerHTML = ''; return; }
  const inner = !b.connected ? `
      <div class="adm-small">Создайте у @BotFather отдельного бота для HR и вставьте сюда его токен.</div>
      <div class="adm-inline">
        <input id="hrBotToken" type="password" autocomplete="off" placeholder="Токен бота">
        <button class="btn" onclick="hrBotConnect()">Подключить бота</button>
      </div>` : `
      <div class="adm-row"><span>Бот</span><b>@${escapeHtml(b.bot)}</b></div>
      <div class="adm-row"><span>Отчёт об опозданиях</span><b>понедельник, 09:00 — ${b.linked.length ? 'вместо письма' : 'пока письмом'}</b></div>
      <div class="adm-row"><span>Дни рождения сотрудников</span><b>в сам день, 09:00</b></div>
      <div class="adm-row"><span>Подключили Telegram</span><b>${b.linked.length ? b.linked.map(escapeHtml).join(', ') : 'пока никто'}</b></div>
      <div id="hrTgAdmin" class="tg-mine"></div>
      <div class="adm-inline tg-actions">
        <button class="btn secondary" onclick="hrBotDisconnect()">Отключить бота</button>
      </div>`;
  box.innerHTML = `<div class="adm-card-title">Бот для HR</div>${inner}`;
  drawHrTelegram('hrTgAdmin');
}
async function hrBotConnect() {
  const token = document.getElementById('hrBotToken').value.trim();
  if (token && await tgRequest('/api/admin/hrbot', 'PUT', { token })) render();
}
async function hrBotDisconnect() {
  if (!confirm('Отключить бота для HR? Отчёт об опозданиях снова будет приходить письмом, напоминания о днях рождения прекратятся.')) return;
  if (await tgRequest('/api/admin/hrbot', 'DELETE')) render();
}
// Свой Telegram у бота HR — для HR и админа (блок в HR-панели и в блоке бота на вкладке «Сервисы»)
async function drawHrTelegram(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  // прошлый ответ рисуем сразу, чтобы при перерисовке панели блок не исчезал и плитки под ним не прыгали
  if (drawHrTelegram.last && !box.innerHTML) box.innerHTML = drawHrTelegram.last;
  const t = isStaff() ? await fetchJson('/api/hr/telegram') : null;
  if (!t || !t.available) { box.innerHTML = drawHrTelegram.last = ''; return; }
  box.innerHTML = drawHrTelegram.last = t.linked
    ? `<div class="tg-mine-head"><span>Бот HR в Telegram</span><b>подключён${t.name ? ' · ' + escapeHtml(t.name) : ''}</b></div>
       <div class="adm-inline">
         <button class="btn secondary" onclick="hrTelegramSample(this)">Прислать пример</button>
         <button class="btn secondary" onclick="hrTelegramOff(${jsArg(boxId)})">Отключить Telegram</button>
       </div>`
    : `<div class="tg-mine-head"><span>Бот HR в Telegram</span><b>не подключён</b></div>
       <div class="adm-inline">
         <a class="btn" href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">Открыть бота @${escapeHtml(t.bot)}</a>
         <button class="btn secondary" onclick="hrTelegramLink(${jsArg(boxId)}, this)">Я нажал «Старт»</button>
       </div>`;
}
async function hrTelegramLink(boxId, btn) {
  btn.disabled = true;
  if (await tgRequest('/api/hr/telegram', 'POST')) { showToast('Telegram подключён'); if (state.view === 'admin') render(); else drawHrTelegram(boxId); } else btn.disabled = false;
}
async function hrTelegramOff(boxId) {
  if (!confirm('Отключить Telegram? Отчёт об опозданиях и дни рождения перестанут приходить вам в бот.')) return;
  if (await tgRequest('/api/hr/telegram', 'DELETE')) { if (state.view === 'admin') render(); else drawHrTelegram(boxId); }
}
async function hrTelegramSample(btn) {
  btn.disabled = true;
  if (await tgRequest('/api/hr/telegram/sample', 'POST')) showToast('Пример отправлен — проверьте Telegram');
  btn.disabled = false;
}
async function staffBotConnect() {
  const token = document.getElementById('staffBotToken').value.trim();
  if (token && await tgRequest('/api/admin/staffbot', 'PUT', { token })) render();
}
async function staffBotOpen(open) {
  if (open && !confirm('Открыть бота для всех? В личном кабинете у каждого сотрудника появится кнопка «Подключить Telegram».')) return;
  if (await tgRequest('/api/admin/staffbot', 'PUT', { open })) render();
}
let staffBotSampleN = 0;
async function staffBotSample(btn) {
  btn.disabled = true;
  if (await tgRequest('/api/admin/staffbot/sample', 'POST', { n: staffBotSampleN++ })) showToast('Пример отправлен — проверьте Telegram');
  btn.disabled = false;
}
async function staffBotDisconnect() {
  if (!confirm('Отключить бота для сотрудников? Все, кто его подключил, перестанут получать сообщения.')) return;
  if (await tgRequest('/api/admin/staffbot', 'DELETE')) render();
}

// Свой Telegram: один и тот же блок в личном кабинете и на вкладке «Сервисы».
// Человек открывает бота по ссылке (в ней его личный код), жмёт «Старт» и возвращается нажать «Я нажал Старт».
async function drawMyTelegram(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const t = await fetchJson('/api/me/telegram');
  if (!t || !t.available) { box.innerHTML = ''; return; }
  box.innerHTML = t.linked
    ? `<div class="tg-mine-head"><span>Telegram</span><b>подключён${t.name ? ' · ' + escapeHtml(t.name) : ''}</b></div>
       <button class="btn secondary" onclick="myTelegramOff(${jsArg(boxId)})">Отключить Telegram</button>`
    : `<div class="tg-mine-head"><span>Telegram</span><b>не подключён</b></div>
       <div class="adm-inline">
         <a class="btn" href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">Открыть бота @${escapeHtml(t.bot)}</a>
         <button class="btn secondary" onclick="myTelegramLink(${jsArg(boxId)}, this)">Я нажал «Старт»</button>
       </div>`;
}
async function myTelegramLink(boxId, btn) {
  btn.disabled = true;
  const d = await tgRequest('/api/me/telegram', 'POST');
  if (d) { showToast('Telegram подключён'); if (state.view === 'admin') render(); else drawMyTelegram(boxId); } else btn.disabled = false;
}
async function myTelegramOff(boxId) {
  if (!confirm('Отключить Telegram? Напоминания от портала перестанут приходить.')) return;
  if (await tgRequest('/api/me/telegram', 'DELETE')) { if (state.view === 'admin') render(); else drawMyTelegram(boxId); }
}

// Подключение Telegram-бота: токен от @BotFather → код боту (чтобы портал узнал, кому писать) → отчёты.
// Пока в поле что-то набрано, вкладка сама не перерисовывается (см. setInterval ниже).
async function drawTelegramBox() {
  const box = document.getElementById('tgBox');
  if (!box) return;
  const t = await fetchJson('/api/admin/telegram');
  if (!t) { box.innerHTML = ''; return; }
  const hour = String(t.hour).padStart(2, '0') + ':00';
  let inner;
  if (!t.connected) {
    inner = `
      <div class="adm-small">Создайте бота в Telegram у @BotFather (команда /newbot) и вставьте сюда токен, который он выдаст.</div>
      <div class="adm-inline">
        <input id="tgToken" type="password" autocomplete="off" placeholder="Токен бота">
        <button class="btn" onclick="tgConnect()">Подключить бота</button>
      </div>`;
  } else if (!t.linked) {
    inner = `
      <div class="tg-step">Откройте бота <b>@${escapeHtml(t.bot)}</b> в Telegram и отправьте ему код <span class="tg-code">${escapeHtml(t.code)}</span></div>
      <div class="adm-inline">
        <button class="btn" onclick="tgLink(this)">Я отправил код</button>
        <button class="btn secondary" onclick="tgDisconnect()">Отключить бота</button>
      </div>`;
  } else {
    inner = `
      <div class="adm-row"><span>Когда приходят</span><b>каждый день в ${hour}, при сбое сервиса — сразу</b></div>
      <div class="adm-inline tg-actions">
        <button class="btn secondary" onclick="tgTest(this)">Отправить отчёт сейчас</button>
        <button class="btn secondary" onclick="tgDisconnect()">Отключить бота</button>
      </div>`;
  }
  box.innerHTML = `<div class="adm-card-title">${t.linked ? 'Telegram-бот @' + escapeHtml(t.bot) : 'Отчёты в Telegram'}</div>${inner}`;
}

async function tgRequest(url, method, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) showToast(d.error || 'Не получилось');
  return r.ok ? d : null;
}
async function tgConnect() {
  const token = document.getElementById('tgToken').value.trim();
  if (!token) return;
  if (await tgRequest('/api/admin/telegram', 'PUT', { token })) render();
}
async function tgLink(btn) {
  btn.disabled = true;
  const d = await tgRequest('/api/admin/telegram/link', 'POST');
  if (d) { showToast('Бот подключён — проверьте Telegram'); render(); } else btn.disabled = false;
}
async function tgTest(btn) {
  btn.disabled = true;
  if (await tgRequest('/api/admin/telegram/test', 'POST')) showToast('Отчёт отправлен в Telegram');
  render();
}
async function tgDisconnect() {
  if (!confirm('Отключить бота? Отчёты в Telegram перестанут приходить.')) return;
  if (await tgRequest('/api/admin/telegram', 'DELETE')) render();
}

async function adminSvcCheck(key, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Проверяем…'; }
  const r = await fetch('/api/admin/services/' + encodeURIComponent(key) + '/check', { method: 'POST' });
  const d = await r.json().catch(() => ({}));
  showToast(d.message || d.error || 'Не удалось проверить');
  render();
}
// пока вкладка открыта, обновляем её раз в минуту — чтобы сбой был виден без F5
setInterval(() => {
  if (!state.user || document.querySelector('.modal-overlay, .modal')) return;
  const typing = (document.getElementById('tgToken') || {}).value || (document.getElementById('staffBotToken') || {}).value || (document.getElementById('hrBotToken') || {}).value;
  if (state.view === 'admin' && state.adminTab === 'services' && !typing && !document.querySelector('.svc-check:disabled, #tgBox button:disabled, #staffBotBox button:disabled, #hrBotBox button:disabled')) render();
}, 60 * 1000);

async function adminTestMail() {
  const to = document.getElementById('admMailTo').value.trim();
  const r = await fetch('/api/admin/test-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }) });
  const d = await r.json().catch(() => ({}));
  showToast(r.ok ? 'Письмо отправлено — проверьте ящик' : (d.error || 'Не удалось отправить'));
}

async function renderAdminAudit(body) {
  const all = await fetchJson('/api/admin/audit') || [];
  const f = state.auditFilter || 'all';
  const people = all.filter(a => a.source !== 'check');   // проверки Claude — отдельной вкладкой, чтобы не путать с людьми
  const checks = all.filter(a => a.source === 'check');
  const list = f === 'checks' ? checks
    : people.filter(a => f === 'all' ? true : f === 'logins' ? /\/api\/(login|register|invite)/.test(a.path) : [401, 403, 429].includes(a.status));
  const chip = (k, l, n) => `<button class="subtab ${f === k ? 'active' : ''}" onclick="state.auditFilter='${k}';render()">${l} <span>${n}</span></button>`;
  body.innerHTML = `
    
    <div class="subtabs admin-tabs">
      ${chip('all', 'Действия людей', people.length)}
      ${chip('logins', 'Входы', people.filter(a => /\/api\/(login|register|invite)/.test(a.path)).length)}
      ${chip('denied', 'Отказы и ошибки входа', people.filter(a => [401, 403, 429].includes(a.status)).length)}
      ${chip('checks', 'Проверки Claude', checks.length)}
    </div>
    ${list.length ? `<div class="adm-audit">${list.map(a => `
      <div class="adm-audit-row ${a.source === 'check' ? 'check' : [401, 403, 429].includes(a.status) ? 'bad' : ''}">
        <span class="adm-audit-time">${fmtAstana(a.ts)}</span>
        <span class="adm-audit-user">${a.source === 'check' ? '<b class="adm-audit-check">проверка Claude</b> ' : ''}${escapeHtml(a.user || 'без входа')}</span>
        <span class="adm-audit-what">${escapeHtml(auditText(a))}</span>
        <span class="adm-audit-ip">${escapeHtml(a.ip || '')}</span>
      </div>`).join('')}</div>`
    : '<div class="empty"><strong>Записей нет</strong></div>'}`;
}

async function renderAdminBackups(body, list) {
  list = list || await fetchJson('/api/admin/backups') || [];
  body.innerHTML = `
    
    <div class="adm-inline" style="margin-bottom:14px"><button class="btn" id="admBackupBtn" onclick="adminBackupNow()">Сделать копию сейчас</button></div>
    ${list.length ? `<div class="hr-table">${list.map(b => `
      <div class="hr-row">
        <div class="project-mark" style="width:38px;height:38px;font-size:18px">${ico('database')}</div>
        <div class="hr-row-main"><div class="hr-row-name">${escapeHtml(b.name)}</div><div class="hr-row-sub">${fmtAstana(b.time)} · ${fmtBytes(b.size)}${b.name.includes('manual') ? ' · сделана вручную' : ''}</div></div>
        <a class="icon-btn" href="/api/admin/backups/${encodeURIComponent(b.name)}" download>Скачать</a>
        <button class="btn text" onclick="adminDeleteBackup(${jsArg(b.name)})">Удалить</button>
      </div>`).join('')}</div>`
    : '<div class="empty"><strong>Копий пока нет</strong></div>'}`;
}

async function adminBackupNow() {
  const btn = document.getElementById('admBackupBtn'); btn.disabled = true; btn.textContent = 'Копируем…';
  const r = await fetch('/api/admin/backups', { method: 'POST' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; btn.textContent = 'Сделать копию сейчас'; return showToast(d.error || 'Не удалось сделать копию'); }
  showToast('Копия базы сделана');
  renderAdminBackups(document.getElementById('adminBody'), d);
}

async function adminDeleteBackup(name) {
  if (!await confirmDialog({ title: 'Удалить копию базы?', text: `<b>${escapeHtml(name)}</b><br>Восстановиться из неё будет уже нельзя.` })) return;
  const r = await fetch('/api/admin/backups/' + encodeURIComponent(name), { method: 'DELETE' });
  if (!r.ok) return showToast('Не удалось удалить');
  renderAdminBackups(document.getElementById('adminBody'), await r.json());
}

// =========================================================
// HR-ПАНЕЛЬ — видят только HR и админ
// =========================================================
function openHr(tab) { state.hrTab = (tab === 'attendance' || tab === 'late') ? 'requests' : (tab || 'requests'); goToView('hr'); }

// чего не хватает в карточке сотрудника
const HR_GAPS = [['phone', 'телефон'], ['email', 'почта'], ['telegram', 'telegram'], ['birthday', 'день рождения'], ['photo', 'фото']];
function employeeGaps(e) { return HR_GAPS.filter(([k]) => !e[k]).map(([, label]) => label); }

// Google-таблица HR как временный источник отметок: состояние и кнопка
function sheetStatusHtml(S) {
  const l = S && S.last;
  const cur = l && (l.months || []).slice(-1)[0];
  const unm = cur ? cur.unmatched || [] : [], unk = cur ? Object.keys(cur.unknown || {}) : [];
  const text = l ? `Google-таблица прочитана ${fmtDate(l.at)}${cur ? ` · ${cur.month}: найдено ${cur.matched}` : ''}${unm.length ? ` · <b>не узнал ${unm.length}</b>: ${escapeHtml(unm.join(', '))}` : ''}${unk.length ? ` · непонятные отметки: ${escapeHtml(unk.join(', '))}` : ''}${(l.no_tab || []).length ? ` · нет вкладки за ${l.no_tab.join(', ')}` : ''}`
    : 'Google-таблица ещё не читалась';
  return `<div class="hr-note elpass-status"><span>${text}</span>
    <span><a class="req-hr-link" href="${escapeHtml((S && S.url) || '#')}" target="_blank" rel="noopener">Открыть таблицу</a>
    <button class="icon-btn" id="sheetSync" onclick="sheetSyncNow()">Прочитать сейчас</button></span></div>`;
}
async function sheetSyncNow() {
  const b = document.getElementById('sheetSync'); if (b) { b.disabled = true; b.textContent = 'Читаем…'; }
  const r = await fetch('/api/hr/sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { showToast(j.error || 'Не удалось прочитать'); if (b) { b.disabled = false; b.textContent = 'Прочитать сейчас'; } return; }
  const c = (j.months || []).slice(-1)[0] || {}; showToast(`Таблица прочитана: найдено ${c.matched || 0}, отметок обновлено ${c.changed || 0}`);
  state.sheet = null; render();
}

// строка состояния интеграции с elpass + кнопка «Обновить сейчас»
function elpassStatusHtml(E, hasPasses) {
  if (!E || !E.configured) return `<div class="hr-note">Доступ к elpass на сервере ещё не настроен — как только появится, проходы начнут подтягиваться сами каждые 15 минут.</div>`;
  const last = E.last;
  const per = last && last.objects ? ' (' + last.objects.map(o => `${o.label}: ${o.cards}`).join(', ') + ')' : '';
  const when = last ? `обновлено ${fmtDate(last.at)} · карточек ${last.cards}${per} · проходов за раз ${last.visits}` : 'ещё ни разу не обновлялось';
  const unmappedCards = (E.cards || []).filter(c => c.active && !c.mapped_to && !c.ignored).length;
  return `<div class="hr-note elpass-status"><span>elpass: ${when}${unmappedCards ? ` · <b>${unmappedCards}</b> карточек elpass пока никому не присвоены` : ''}</span>
    <button class="icon-btn" id="elpassSync" onclick="elpassSyncNow()">Обновить сейчас</button></div>`
    + ((last && last.errors && last.errors.length) ? `<div class="hr-note">elpass не ответил по объектам: ${last.errors.map(x => escapeHtml(x.label + ' — ' + x.error)).join('; ')}</div>` : '');
}
async function elpassSyncNow() {
  const b = document.getElementById('elpassSync'); if (b) { b.disabled = true; b.textContent = 'Обновляем…'; }
  const r = await fetch('/api/hr/elpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { showToast(j.error || 'Не удалось обновить'); if (b) { b.disabled = false; b.textContent = 'Обновить сейчас'; } return; }
  showToast(`Готово: карточек ${j.cards}, новых проходов ${j.added}${j.auto_mapped ? `, сопоставлено автоматически ${j.auto_mapped}` : ''}`);
  state.elpass = null; state.employees = await fetchJson('/api/employees') || state.employees; render();
}

// HR-панель → «Опоздания»: проходы elpass × график × отметки табеля. Считает сервер (compute_lateness).
function hrLatenessHtml(L, opts = {}) {
  const codeName = Object.fromEntries(L.codes || []);
  const weekVar = opts.weekVar || 'hrWeek';          // кабинет руководителя листает недели своей переменной
  const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const startD = new Date(L.start + 'T00:00:00'), endD = new Date(L.end + 'T00:00:00');
  const title = `${startD.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${endD.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  const shift = (days) => { const d = new Date(L.start + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const isCurrent = L.start <= L.today && L.today <= L.end;
  const row = (x, excused) => `
    <div class="hr-row late-row ${excused ? 'excused' : ''}">
      <div class="org-ava" style="--h:${hueOf(x.name)}">${initials(x.name)}</div>
      <div class="hr-row-main">
        <div class="hr-row-name">${escapeHtml(x.name)}</div>
        <div class="hr-row-sub">${escapeHtml(x.position || x.department || '')}</div>
      </div>
      <div class="late-when"><b>${fmt(x.date)}</b><small>график с ${escapeHtml(x.schedule)}</small></div>
      <div class="late-time"><b>${x.arrived}</b><small>+${x.late_min} мин</small></div>
      ${excused ? `<div class="late-excuse"><b class="att-code ${ATT_CLASS[x.excuse.code] || ''}">${x.excuse.code}</b><span>${escapeHtml(codeName[x.excuse.code] || '')}${x.excuse.comment ? ` — ${escapeHtml(x.excuse.comment)}` : ''}</span></div>`
               : (opts.readonly ? '' : `<button class="icon-btn" onclick="att.month='${x.date.slice(0, 7)}';goToView('attendance')" title="Поставить причину в табеле">В табель</button>`)}
    </div>`;
  const byDate = (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ru');
  return `
    <div class="att-bar">
      <div class="att-nav">
        <button class="icon-btn" onclick="state.${weekVar}='${shift(-7)}';render()" title="Предыдущая неделя">‹</button>
        <b>${title}</b>
        <button class="icon-btn" onclick="state.${weekVar}='${shift(7)}';render()" title="Следующая неделя">›</button>
        ${isCurrent ? '<span class="att-week-now">текущая неделя</span>' : `<button class="btn text accent" onclick="state.${weekVar}=null;render()">К текущей</button>`}
      </div>
      <span class="att-week-now">допуск ${L.grace} мин · пн–пт · по первому входу через турникет</span>
    </div>
    ${opts.hideStatus ? '' : elpassStatusHtml(L.elpass, L.has_passes)}
    ${opts.hideStatus ? '' : sheetStatusHtml(L.sheet)}
    ${(L.remote_names || []).length ? `<div class="hr-note">Работают удалённо (${L.remote_names.length}): ${escapeHtml(L.remote_names.join(', '))} — через турникет не ходят, опоздания по ним не считаются.</div>` : ''}
    ${L.unmapped ? `<div class="hr-note">У <b>${L.unmapped}</b> ${opts.readonly ? 'человек из команды нет карточки турникета — по ним опоздания не считаются; это заполняет отдел кадров.' : 'сотрудников не указан ID в elpass — по ним опоздания не считаются. Указать: плитка «карточек заполнить» → «Заполнить».'}</div>` : ''}
    ${L.late.length ? `<div class="late-title">Без причины в табеле — ${L.late.length}</div><div class="hr-table">${L.late.slice().sort(byDate).map(x => row(x, false)).join('')}</div>`
      : (L.has_passes ? `<div class="empty"><strong>Неоправданных опозданий нет</strong></div>` : '')}
    ${L.excused.length ? `<div class="late-title">С причиной в табеле — ${L.excused.length}</div><div class="hr-table">${L.excused.slice().sort(byDate).map(x => row(x, true)).join('')}</div>` : ''}`;
}

// HR-панель → «Посещаемость за неделю»: кто и когда отсутствовал, с причинами. Сгруппировано по сотрудникам.
function hrAttendanceWeekHtml(week) {
  const codeName = Object.fromEntries(week.codes || []);
  const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const startD = new Date(week.start + 'T00:00:00'), endD = new Date(week.end + 'T00:00:00');
  const title = `${startD.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${endD.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  const shift = (days) => { const d = new Date(week.start + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const isCurrent = week.start <= week.today && week.today <= week.end;
  // сводка по кодам
  const byCode = {};
  for (const m of week.marks) byCode[m.code] = (byCode[m.code] || 0) + 1;
  const summary = (week.codes || []).filter(([c]) => byCode[c]).map(([c, t]) =>
    `<span class="att-legend-item"><b class="att-code ${ATT_CLASS[c] || ''}">${c}</b>${escapeHtml(t)}: <b>${byCode[c]}</b></span>`).join('');
  // по сотрудникам
  const groups = [];
  for (const m of week.marks) {
    let g = groups.find(x => x.id === m.employee_id);
    if (!g) { g = { id: m.employee_id, name: m.name, sub: m.position || m.department || '', items: [] }; groups.push(g); }
    g.items.push(m);
  }
  const rows = groups.map(g => `
    <div class="hr-row att-week-row">
      <div class="org-ava" style="--h:${hueOf(g.name)}">${initials(g.name)}</div>
      <div class="hr-row-main">
        <div class="hr-row-name">${escapeHtml(g.name)} <small class="att-week-n">${g.items.length}</small></div>
        <div class="hr-row-sub">${escapeHtml(g.sub)}</div>
        <div class="att-week-items">${g.items.map(m => `
          <div class="att-week-item" title="${m.set_by ? 'отметил(а) ' + escapeHtml(m.set_by) + ' · ' + fmtDate(m.updated) : ''}">
            <span class="att-week-day">${fmt(m.date)}</span>
            <b class="att-code ${ATT_CLASS[m.code] || ''}">${m.code}</b>
            <span class="att-week-what">${escapeHtml(codeName[m.code] || m.code)}${m.comment ? ` — <i>${escapeHtml(m.comment)}</i>` : ''}</span>
          </div>`).join('')}</div>
      </div>
    </div>`).join('');
  return `
    <div class="att-bar">
      <div class="att-nav">
        <button class="icon-btn" onclick="state.hrWeek='${shift(-7)}';render()" title="Предыдущая неделя">‹</button>
        <b>${title}</b>
        <button class="icon-btn" onclick="state.hrWeek='${shift(7)}';render()" title="Следующая неделя">›</button>
        ${isCurrent ? '<span class="att-week-now">текущая неделя</span>' : `<button class="btn text accent" onclick="state.hrWeek=null;render()">К текущей</button>`}
      </div>
      <button class="btn secondary" onclick="att.month='${week.start.slice(0, 7)}';goToView('attendance')">Открыть табель →</button>
    </div>
    ${sheetStatusHtml(week.sheet)}
    ${summary ? `<div class="att-legend att-week-summary">${summary}</div>` : ''}
    ${rows ? `<div class="hr-table">${rows}</div>`
      : `<div class="empty"><strong>За эту неделю отметок нет</strong></div>`}`;
}

const HR_TABS = ['requests', 'vacation', 'staff', 'cands', 'suggestions', 'gaps', 'access'];
async function renderHr(main) {
  // старые адреса вроде #hr/late ведут в несуществующую вкладку — открываем заявки
  const tab = HR_TABS.includes(state.hrTab) ? state.hrTab : 'requests';
  if (state.hrTab !== tab) state.hrTab = tab;
  const reqs = (state.requests || []).filter(r => r.type === 'trip'), sugg = state.suggestions || [];
  const vacs = (state.requests || []).filter(r => r.type === 'vacation' || r.type === 'unpaid');
  const newVac = vacs.filter(r => r.status === 'new').length;
  const staffReqs = (state.requests || []).filter(r => ['hiring', 'dismissal', 'buddy'].includes(r.type));
  const newStaff = staffReqs.filter(r => r.status === 'new').length;
  const cands = (state.requests || []).filter(r => r.type === 'referral');   // предложенные кандидаты со страницы «Вакансии»
  const newCands = cands.filter(r => r.status === 'new').length;
  const newReq = reqs.filter(r => r.status === 'new').length;
  const newSug = sugg.filter(s => s.status === 'new').length;
  const gaps = state.employees.map(e => ({ e, miss: employeeGaps(e) })).filter(x => x.miss.length);
  if (!state.hrAccounts) state.hrAccounts = await fetchJson('/api/hr/accounts') || [];
  const notIn = state.hrAccounts.filter(a => a.state !== 'active').length;

  const tile = (key, num, label, hot) => `
    <button class="hr-tile ${tab === key ? 'active' : ''} ${hot ? 'hot' : ''}" onclick="state.hrTab='${key}';render()">
      <span class="hr-tile-num">${num}</span><span class="hr-tile-label">${label}</span></button>`;

  let body = '';
  if (tab === 'requests') {
    body = reqs.length ? `<div class="req-list">${reqs.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>Заявок пока нет</strong></div>`;
  } else if (tab === 'vacation') {
    body = vacs.length ? `<div class="req-list">${vacs.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>Заявок по отпуску нет</strong></div>`;
  } else if (tab === 'staff') {
    body = staffReqs.length ? `<div class="req-list">${staffReqs.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>Заявок нет</strong></div>`;
  } else if (tab === 'cands') {
    body = cands.length ? `<div class="req-list">${cands.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>Кандидатов пока не предлагали</strong></div>`;
  } else if (tab === 'suggestions') {
    body = sugg.length ? sugg.map(s => `
      <div class="suggestion-card ${s.status === 'new' ? 'is-new' : ''}">
        <div class="suggestion-text">${escapeHtml(s.text)}</div>
        <div class="suggestion-meta">${escapeHtml(s.author || 'Анонимно')} · ${fmtDate(s.date)}${s.status === 'new' ? ' · <b class="hr-new">новое</b>' : ''}</div>
        <div class="card-actions">
          ${s.status === 'new' ? `<button class="icon-btn" onclick="markSuggestion('${s.id}','seen')">Отметить прочитанным</button>`
                               : `<button class="icon-btn" onclick="markSuggestion('${s.id}','new')">Вернуть в новые</button>`}
          <button class="btn text" onclick="deleteItem('suggestions','${s.id}')">Удалить</button>
        </div>
      </div>`).join('')
      : `<div class="empty"><strong>Обращений пока нет</strong></div>`;
  } else if (tab === 'gaps') {
    body = gaps.length ? `
      
      <div class="hr-table">${gaps.map(({ e, miss }) => `
        <div class="hr-row">
          <div class="org-ava" style="--h:${hueOf(e.name)}">${initials(e.name)}</div>
          <div class="hr-row-main"><div class="hr-row-name">${escapeHtml(e.name)}</div><div class="hr-row-sub">${escapeHtml(e.department || '')}</div></div>
          <div class="hr-chips">${miss.map(m => `<span class="hr-chip">нет: ${m}</span>`).join('')}</div>
          <button class="icon-btn" onclick="openHrFill('${e.id}')">Заполнить</button>
        </div>`).join('')}</div>`
      : `<div class="empty"><strong>Все карточки заполнены</strong></div>`;
  } else if (tab === 'access') {
    const label = { active: ['Пользуется', 'done'], ready: ['Пароль задан, не входил', 'progress'], invited: ['Приглашён, не активировал', 'new'], none: ['Нет доступа', 'cancelled'] };
    const order = { none: 0, invited: 1, ready: 2, active: 3 };
    const list = state.hrAccounts.slice().sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name, 'ru'));
    body = `
      
      <div class="hr-table">${list.map(a => {
        const [t, c] = label[a.state];
        return `
        <div class="hr-row">
          <div class="org-ava" style="--h:${hueOf(a.name)}">${initials(a.name)}</div>
          <div class="hr-row-main"><div class="hr-row-name">${escapeHtml(a.name)}</div><div class="hr-row-sub">${escapeHtml(a.email || 'почта не указана')}</div></div>
          <div class="req-status ${c}">${t}</div>
          <div class="req-row-date">${a.last_login ? 'был ' + fmtShortDate(a.last_login) : ''}</div>
          ${a.state === 'none' || a.state === 'invited' ? `<button class="icon-btn" onclick="hrInvite('${a.employee_id}')">${a.state === 'invited' ? 'Новая ссылка' : 'Пригласить'}</button>` : '<span class="hr-row-spacer"></span>'}
        </div>`; }).join('')}</div>`;
  }

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">HR-панель</div></div>
      <div class="hr-quick">
        <button class="btn secondary" onclick="goToView('news');openNewsForm(null,'newcomer')">Представить сотрудника</button>
        <button class="btn" onclick="goToView('news');openNewsForm()">Новость</button>
      </div>
    </div>
    ${announcementAdminHtml()}
    <div id="hrTgBox" class="tg-mine hr-tg"></div>
    <div class="hr-tiles hr-tiles-fit">
      ${tile('requests', newReq, 'новых командировок', newReq > 0)}
      ${tile('vacation', newVac, 'новых по отпуску', newVac > 0)}
      ${tile('staff', newStaff, 'подбор, увольнение, Mentor', newStaff > 0)}
      ${tile('cands', newCands, 'предложенных кандидатов', newCands > 0)}
      ${tile('suggestions', newSug, 'новых обращений', newSug > 0)}
      ${tile('gaps', gaps.length, 'карточек заполнить', false)}
      ${tile('access', notIn, 'ещё не в портале', false)}
    </div>
    <div class="hr-body">${body}</div>`;
  drawHrTelegram('hrTgBox');
}

async function markSuggestion(id, status) {
  const res = await fetchJson(`/api/suggestions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!res) return showToast('Не удалось сохранить');
  state.suggestions[state.suggestions.findIndex(x => x.id === id)] = res;
  updateRequestsBadge(); render();
}

async function openHrFill(id) {
  const e = state.employees.find(x => x.id === id); if (!e) return;
  // список карточек турникета нужен только этой форме — подгружаем здесь
  if (!state.elpassCards) { const E = await fetchJson('/api/hr/elpass'); state.elpassCards = (E && E.cards) || []; }
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${escapeHtml(e.name)}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>Телефон</label><input id="hfPhone" type="tel" value="${escapeHtml(e.phone || '')}" placeholder="+7 7__ ___ __ __"></div>
          <div class="field"><label>День рождения</label><input id="hfBirthday" type="date" value="${escapeHtml((e.birthday || '').slice(0, 10))}"></div>
          <div class="field"><label>В компании с</label><input id="hfHired" type="date" value="${escapeHtml((e.hired || '').slice(0, 10))}"></div>
        </div>
        <div class="field"><label class="hf-remote"><input id="hfRemote" type="checkbox" ${e.remote ? 'checked' : ''}> Работает удалённо — через турникет не ходит</label></div>
        <div class="field"><label class="hf-remote"><input id="hfEnglish" type="checkbox" ${Number(e.english) ? 'checked' : ''}> Ходит на английский</label></div>
        <div class="field"><label>Карточка в elpass (турникет)</label>
          <input id="hfElpass" type="text" list="elpassList" value="${escapeHtml(e.elpass_id || '')}" autocapitalize="none" spellcheck="false">
          <datalist id="elpassList">${(state.elpassCards || []).filter(c => !c.ignored).map(c => `<option value="${escapeHtml(c.no)}">${escapeHtml(c.name)}${c.label ? ' · ' + escapeHtml(c.label) : ''}${c.title ? ' — ' + escapeHtml(c.title) : ''}${c.mapped_to && c.mapped_to !== e.name ? ' (уже: ' + escapeHtml(c.mapped_to) + ')' : ''}</option>`).join('')}</datalist>
          </div>
        <div class="field"><label>Корпоративная почта</label><input id="hfEmail" type="email" value="${escapeHtml(e.email || '')}" autocapitalize="none"></div>
        <div class="field-row">
          <div class="field"><label>Офис</label>
            <select id="hfOffice">
              <option value="">Не указан</option>
              ${['Астана', 'Алматы'].map(o => `<option ${e.office === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select></div>
          <div class="field"><label>Место в офисе (необязательно)</label>
            <input id="hfSeat" type="text" value="${escapeHtml(e.seat || '')}"></div>
        </div>
        <div class="field"><label>Telegram</label><input id="hfTelegram" type="text" value="${escapeHtml(e.telegram || '')}" autocapitalize="none" spellcheck="false">
          </div>
        <div class="field"><label>Фото</label>
          ${e.photo ? `<div class="news-photo-current"><img src="${escapeHtml(e.photo)}" alt=""></div>` : ''}
          <input id="hfPhoto" type="file" accept="image/*" onchange="previewImage(this,'hfPreview')">
          
          <img id="hfPreview" class="preview-thumb" style="display:none;">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="hfSave" onclick="saveHrFill('${e.id}')">Сохранить</button>
      </div>
    </div>`);
}

async function saveHrFill(id) {
  const btn = document.getElementById('hfSave'); btn.disabled = true; btn.textContent = 'Сохраняем…';
  const body = {
    phone: document.getElementById('hfPhone').value.trim(),
    birthday: document.getElementById('hfBirthday').value,
    hired: document.getElementById('hfHired').value,
    email: document.getElementById('hfEmail').value.trim().toLowerCase(),
    telegram: document.getElementById('hfTelegram').value.trim(),
    office: document.getElementById('hfOffice').value,
    seat: document.getElementById('hfSeat').value.trim(),
    elpass_id: document.getElementById('hfElpass').value.trim(),
    remote: document.getElementById('hfRemote').checked ? 1 : 0,
    english: document.getElementById('hfEnglish').checked ? 1 : 0,
  };
  const photoInput = document.getElementById('hfPhoto');
  if (photoInput.files[0]) {
    const url = await uploadFile(photoInput);
    if (!url) { btn.disabled = false; btn.textContent = 'Сохранить'; return; }
    body.photo = url;
  }
  const res = await fetchJson(`/api/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  closeModal();
  if (!res) return showToast('Не удалось сохранить');
  const i = state.employees.findIndex(x => x.id === id);
  if (i >= 0) state.employees[i] = { ...state.employees[i], ...res };
  state.hrAccounts = null;            // почта могла измениться — статусы доступа пересчитаем
  state.elpass = null;                // и привязки карточек elpass
  showToast('Карточка обновлена'); render();
}

async function hrInvite(employeeId) {
  const r = await fetch('/api/hr/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: employeeId }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(data.error || 'Не удалось выдать ссылку');
  state.hrAccounts = null;
  render();
  showInviteLink(data);
}


// =========================================================
// ПАНЕЛЬ ЗАКУПЩИКА — видят только закупщик и админ
// =========================================================
function renderBuyer(main) {
  const all = (state.requests || []).filter(r => r.type === 'equipment');
  const groups = {
    new: all.filter(r => r.status === 'new'),
    work: all.filter(r => r.status === 'in_progress'),
    ordered: all.filter(r => r.status === 'ordered'),
    all,
  };
  // Не показываем пустую вкладку, когда заявки есть на соседней: иначе кажется, что заявок нет вовсе.
  let tab = state.buyerTab || 'new';
  if (!groups[tab].length) tab = ['new', 'work', 'ordered', 'all'].find(t => groups[t].length) || tab;
  // срочные — наверх, дальше по дате
  const list = groups[tab].slice().sort((a, b) =>
    ((b.data || {}).urgency === 'urgent') - ((a.data || {}).urgency === 'urgent') || (b.created || '').localeCompare(a.created || ''));
  const urgent = groups.new.filter(r => (r.data || {}).urgency === 'urgent').length;
  const budget = [...groups.new, ...groups.work].reduce((sum, r) => sum + (Number((r.data || {}).budget) || 0) * (Number((r.data || {}).qty) || 1), 0);

  const tile = (key, num, label, hot) => `
    <button class="hr-tile ${tab === key ? 'active' : ''} ${hot ? 'hot' : ''}" onclick="state.buyerTab='${key}';render()">
      <span class="hr-tile-num">${num}</span><span class="hr-tile-label">${label}</span></button>`;
  const empty = { new: 'Новых заявок нет', work: 'В работе ничего нет', ordered: 'Заказанного нет', all: 'Заявок пока не было' }[tab];

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Панель закупщика</div></div>
    </div>
    <div class="hr-tiles">
      ${tile('new', groups.new.length, urgent ? `новых, из них срочных: ${urgent}` : 'новых заявок', groups.new.length > 0)}
      ${tile('work', groups.work.length, 'в работе', false)}
      ${tile('ordered', groups.ordered.length, 'заказано, ждём', false)}
      ${tile('all', all.length, 'всего заявок', false)}
    </div>
    ${budget ? `<div class="hr-note">Примерная сумма по новым заявкам и заявкам в работе: <b>${budget.toLocaleString('ru-RU')} ₸</b> — по оценкам самих сотрудников.</div>` : ''}
    <div class="hr-body">
      ${list.length ? `<div class="req-list">${list.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>${empty}</strong></div>`}
    </div>`;
}

// ---- Панель бухгалтера (06.10.2026, просьба пользователя: «создай панель бухгалтера с доступом только для бухгалтеров»).
// По образцу панели закупщика: роль accountant, вид заявки compensation. Заявки приходят всей бухгалтерии сразу,
// без согласования руководителем (его выбор). «Пока» в панели один вид заявок — остальное добавится позже.
function renderAccountant(main) {
  const all = (state.requests || []).filter(r => r.type === 'compensation');
  const groups = {
    new: all.filter(r => r.status === 'new'),
    work: all.filter(r => r.status === 'in_progress'),
    paid: all.filter(r => r.status === 'done'),
    all,
  };
  let tab = state.accTab || 'new';
  if (!groups[tab]) tab = 'new';
  if (!groups[tab].length) tab = ['new', 'work', 'paid', 'all'].find(t => groups[t].length) || tab;
  // месяц: у выплаченных — по дате выплаты, у остальных — по дате подачи (06.10.2026, просьба пользователя: скачивание
  // выплаченного для бухгалтерии). Плитки считают всё, месяц сужает только список и выгрузку.
  state.accShown = tab;      // вкладка, которая показана на самом деле (пустую подменяем непустой) — её же берёт выгрузка
  const months = [...new Set(groups[tab].map(r => accMonthOf(r, tab)).filter(Boolean))].sort().reverse();
  if (state.accMonth && !months.includes(state.accMonth)) state.accMonth = '';
  const list = accList(groups[tab], tab);
  const monthName = m => { const t = new Date(m + '-01T00:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const tile = (key, num, label, hot) => `
    <button class="hr-tile ${tab === key ? 'active' : ''} ${hot ? 'hot' : ''}" onclick="state.accTab='${key}';render()">
      <span class="hr-tile-num">${num}</span><span class="hr-tile-label">${label}</span></button>`;
  const empty = { new: 'Новых заявок нет', work: 'В работе ничего нет', paid: 'Выплаченных пока нет', all: 'Заявок пока не было' }[tab];
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Панель бухгалтера</div></div>
    </div>
    <div class="hr-tiles">
      ${tile('new', groups.new.length, 'новых заявок', groups.new.length > 0)}
      ${tile('work', groups.work.length, 'в работе', false)}
      ${tile('paid', groups.paid.length, 'выплачено', false)}
      ${tile('all', all.length, 'всего заявок', false)}
    </div>
    ${all.length ? `
    <div class="acc-bar">
      <select id="accMonth" onchange="state.accMonth=this.value;render()">
        <option value="">За всё время</option>
        ${months.map(m => `<option value="${m}" ${state.accMonth === m ? 'selected' : ''}>${escapeHtml(monthName(m))}</option>`).join('')}
      </select>
      <button class="btn secondary" onclick="exportCompensation()" ${list.length ? '' : 'disabled'}>${ico('download')} Скачать таблицу</button>
    </div>` : ''}
    <div class="hr-body no-tr">
      ${list.length ? `<div class="req-list">${list.map(r => requestRowHtml(r, true)).join('')}</div>`
      : `<div class="empty"><strong>${state.accMonth ? 'За этот месяц заявок нет' : empty}</strong></div>`}
    </div>`;
}
function accMonthOf(r, tab) { return String((tab === 'paid' ? (r.done_at || r.updated) : r.created) || '').slice(0, 7); }
function accList(rows, tab) {
  return rows.filter(r => !state.accMonth || accMonthOf(r, tab) === state.accMonth).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}
// Таблица для бухгалтерии: то, что сейчас показано в панели (вкладка и месяц), файлом CSV — открывается в Excel.
// Сам чек в файл не попадает, только отметка, что он приложен.
function exportCompensation() {
  if (!seesAccountant()) return;
  const tab = ['new', 'work', 'paid', 'all'].includes(state.accShown) ? state.accShown : 'new';
  const all = (state.requests || []).filter(r => r.type === 'compensation');
  const rows = accList(tab === 'all' ? all : all.filter(r => r.status === { new: 'new', work: 'in_progress', paid: 'done' }[tab]), tab);
  if (!rows.length) return;
  const day = v => v ? new Date(v).toLocaleDateString('ru-RU') : '';
  const lines = [['Сотрудник', 'Должность', 'Подразделение', 'За что', 'Описание', 'Статус', 'Подана', 'Выплачена', 'Кто выплатил', 'Комментарий сотрудника', 'Комментарий бухгалтерии', 'Чек']];
  for (const r of rows) {
    const d = r.data || {};
    lines.push([r.author_name, d.position, d.department, d.category === 'ai' ? 'ИИ-инструмент' : 'Другое', d.category === 'ai' ? d.tool : d.item,
      reqStatus(r)[0], day(r.created), day(r.done_at), r.done_by, d.notes, r.hr_comment, d.receipt ? 'приложен' : 'нет']);
  }
  // значение, которое Excel принял бы за формулу (=, +, -, @ в начале), экранируем апострофом
  const cell = v => { v = String(v == null ? '' : v); if (/^\s*[=+@-]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const blob = new Blob(['\ufeff' + lines.map(l => l.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const name = { new: 'новые', work: 'в работе', paid: 'выплачено', all: 'все' }[tab];
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Компенсации по чекам — ${name}${state.accMonth ? ' ' + state.accMonth : ''}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// =========================================================
// ПРЕЗЕНТАЦИИ — брендбук, буклеты, прайсы: PDF-файлы, одна актуальная версия на всех.
// Хранятся в таблице documents с категорией «Презентации», файлы — /media/doc-*.pdf. Выкладывают HR и админ.
// =========================================================
const PRES_CATEGORY = 'Презентации';
function fmtSize(b) { return !b ? '' : b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1).replace('.0', '') + ' МБ' : Math.round(b / 1024) + ' КБ'; }

// База знаний по папкам (24.09.2026, как «Программа лояльности»): папка = documents.category, карточка-папка,
// по клику окно со списком файлов. Порядок и значки известных папок — KB_FOLDERS, новые папки идут следом по алфавиту.
const KB_FOLDERS = [
  ['О компании', 'globe'], ['Умный дом', 'home'], ['Elpass и Elpark', 'key'], ['AIVA', 'video'],
  ['Регламенты', 'book'], ['Инструкции', 'wrench'], [PRES_CATEGORY, 'presentation'],
];
function kbFolderIcon(name) { return (KB_FOLDERS.find(f => f[0] === name) || [])[1] || 'folder'; }
function kbItems() {
  return (state.documents || []).filter(d => (d.link || '').startsWith('/media/') && d.section !== 'templates');
}

async function renderPresentations(main) {
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  state.documents = await fetchJson('/api/documents') || [];
  const items = kbItems();
  const known = KB_FOLDERS.map(f => f[0]);
  const folders = [...new Set(items.map(d => d.category || PRES_CATEGORY))]
    .sort((a, b) => {
      const ia = known.indexOf(a), ib = known.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'ru');
    });
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">База знаний</div></div>
      <button class="btn" onclick="openPresentationForm()">Добавить файл</button>
    </div>
    ${items.length ? `<div class="lp-deck">${folders.map(f => {
      const n = items.filter(d => (d.category || PRES_CATEGORY) === f).length;
      return `
        <div class="lp-card kb-folder" onclick="openKbFolder(${jsArg(f)})" onkeydown="if(event.key==='Enter')openKbFolder(${jsArg(f)})" role="button" tabindex="0">
          <span class="lp-ico">${ico(kbFolderIcon(f))}</span>
          <div class="kb-folder-name">${escapeHtml(f)}</div>
          <div class="lp-cap">${n} ${pluralRu(n, 'файл', 'файла', 'файлов')}</div>
          <div class="lp-more">Открыть папку →</div>
        </div>`;
    }).join('')}</div>`
    : `<div class="empty"><strong>Файлов пока нет</strong></div>`}`;
}

function openKbFolder(name) {
  const files = kbItems().filter(d => (d.category || PRES_CATEGORY) === name);
  openModal(`
    <div class="modal lp-modal kb-modal">
      <div class="modal-head">
        <div class="lp-head"><span class="lp-ico">${ico(kbFolderIcon(name))}</span><h3>${escapeHtml(name)}</h3></div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${files.length ? files.map(d => `
          <div class="kb-file">
            <div class="kb-file-text">
              <div class="kb-file-title">${escapeHtml(d.title)}</div>
              ${d.description ? `<div class="kb-file-desc">${escapeHtml(d.description)}</div>` : ''}
              <div class="kb-file-meta">${docKind(d.link)}${d.size ? ' · ' + fmtSize(d.size) : ''}</div>
            </div>
            <div class="kb-file-actions">
              <a class="btn secondary" href="${escapeHtml(d.link)}" target="_blank" rel="noopener">Открыть</a>
              <a class="btn text" href="${escapeHtml(d.link)}" download>Скачать</a>
              <button class="btn text" onclick="closeModal();deleteItem('documents','${d.id}')">Удалить</button>
            </div>
          </div>`).join('') : '<div class="lp-text">В папке пока нет файлов.</div>'}
      </div>
      ${isStaff() ? `<div class="modal-foot"><button class="btn" onclick="closeModal();openPresentationForm('knowledge', ${jsArg(name)})">Добавить файл в папку</button></div>` : ''}
    </div>`);
}

function docKind(link) {   // подпись формата по расширению файла
  const ext = ((link || '').split('.').pop() || '').toLowerCase();
  return { pdf: 'PDF', docx: 'Word', xlsx: 'Excel' }[ext] || ext.toUpperCase();
}
const TEMPLATE_CATEGORY = 'Кадровые бланки';
function openPresentationForm(section = 'knowledge', folder = '') {
  const tpl = section === 'templates';
  const docs = (state.documents || []).filter(d => (d.section === 'templates') === tpl);
  const cats = tpl ? [TEMPLATE_CATEGORY, 'Технические бланки'] : KB_FOLDERS.map(f => f[0]).filter(f => f !== PRES_CATEGORY);
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${tpl ? 'Новый шаблон' : 'Новый файл'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название</label><input id="fPresTitle" type="text"></div>
        <div class="field"><label>Что внутри (необязательно)</label><input id="fPresDesc" type="text"></div>
        <div class="field"><label>${tpl ? 'Категория' : 'Папка'}</label>
          <input id="fPresCat" type="text" list="presCatList" value="${escapeHtml(folder || cats[0])}">
          <datalist id="presCatList">${[...new Set([...cats, ...docs.map(d => d.category)])].filter(Boolean).map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          </div>
        <div class="field"><label>Файл</label><input id="fPresFile" type="file" accept=".pdf,.docx,.xlsx,application/pdf">
          <div class="field-hint">PDF, Word (.docx) или Excel (.xlsx), до 64 МБ. Заменить файл — удалите старый и загрузите новый.</div></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" id="presSave" onclick="submitPresentation('${section}')">Загрузить</button>
      </div>
    </div>`);
}

async function submitPresentation(section = 'knowledge') {
  const title = document.getElementById('fPresTitle').value.trim();
  const description = document.getElementById('fPresDesc').value.trim();
  const input = document.getElementById('fPresFile');
  if (!title) return showToast('Укажите название');
  if (!input.files[0]) return showToast('Выберите файл');
  const btn = document.getElementById('presSave'); btn.disabled = true; btn.textContent = 'Загружаем…';
  const fd = new FormData(); fd.append('file', input.files[0]);
  const r = await fetch('/api/upload-doc', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { btn.disabled = false; btn.textContent = 'Загрузить'; return showToast(j.error || 'Не удалось загрузить'); }
  const category = (document.getElementById('fPresCat').value || '').trim() || (section === 'templates' ? TEMPLATE_CATEGORY : PRES_CATEGORY);
  const item = await fetchJson('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, title, description, link: j.url, section }) });
  closeModal();
  showToast(item ? 'Файл добавлен' : 'Не удалось сохранить');
  render();
}

// =========================================================
// МАКЕТНЫЕ РАЗДЕЛЫ — оформленные страницы «на вырост»
// =========================================================
const SOON_PAGES = {
  media_video: {
    title: 'Видео', sub: 'Ролики компании', mark: 'film',
    lead: 'Промо-ролики продуктов, записи с мероприятий и обучающие видео — в одном месте.',
    items: ['Промо Умного дома, Elpass, Elpark', 'Записи корпоративов и тимбилдингов', 'Обучающие видео для монтажников', 'Ссылки на YouTube и Instagram компании'],
  },
  media_slides: {
    title: 'Презентации', sub: 'Материалы для клиентов и партнёров', mark: 'presentation',
    lead: 'Актуальные презентации и буклеты компании — чтобы у всех была одна версия.',
    items: ['Презентация компании', 'Буклеты по пакетам умного дома', 'Прайс на дополнительные устройства и замки', 'Брендбук'],
  },
  knowledge: {
    title: 'База знаний', sub: 'Регламенты, инструкции, стандарты', mark: 'book',
    lead: 'Единое место для всех рабочих документов компании — от регламента отпусков до инструкции по монтажу контроллера.',
    items: ['Регламенты и политики компании', 'Инструкции по продуктам (Умный дом, Elpass, Elpark)', 'Стандарты монтажа и пусконаладки', 'Поиск по всем документам'],
  },
  requests: {
    title: 'Заявки', sub: 'Отпуск, отгул, справки — в пару кликов', mark: 'file',
    lead: 'Подал заявку — руководитель согласовал в один клик — HR получил уведомление. Без бумаг и беготни.',
    items: ['Заявление на отпуск с проверкой остатка дней', 'Отгул и работа из дома', 'Справка с места работы, справка о доходах', 'Статус заявки: на согласовании → одобрено → оформлено'],
  },
  itsupport: {
    title: 'Поддержка IT', sub: 'Не работает — напиши', mark: 'wrench',
    lead: 'Компьютер, почта, доступы, принтер — заявка уходит системному администратору, статус виден вам.',
    items: ['Заявка с описанием и скриншотом', 'Запрос доступа к системам', 'Заказ техники и канцелярии', 'История ваших обращений'],
  },
};

// ---- подробности проектов: команда, что важно знать, где искать. Привязываются к проекту по названию. ----
const PROJECT_DETAILS = {
  'умный дом': {
    title: 'Умный дом', sub: 'Флагманское направление · что нужно знать сотруднику', mark: 'home',
    lead: 'Основной продукт компании: проектирование, монтаж и настройка систем умного дома под ключ. Ставится на ранних этапах ремонта, управляется из приложения Connected Home.',
    sections: [
      { title: 'Кто за что отвечает', items: ['Внедрение и монтаж — Операции и внедрение (COO Повстенко Никита), направление умного дома ведёт Сапаргали Исатай', 'Оборудование и пусконаладка — отдел внедрения и аппаратного обеспечения (Әйтен Абзал)', 'Продажи пакетов — отдел продаж (Иванова Виктория)', 'Сервис и гарантия — сервисные инженеры'] },
      { title: 'Что важно знать', items: ['Пакеты: Light (свет), Standard (безопасность), Business (+свет, пульт, планшет), Premium (+шторы, ТВ, климат)', 'Гарантия 2 года, сервис 24/7, единое приложение', 'Цены и прайс на устройства — у отдела продаж, либо спросите Connect AI'] },
      { title: 'Где искать', items: ['Актуальные буклеты, прайсы и стандарты монтажа — База знаний', 'Вопросы по проекту — руководитель проекта в Community Road Map'] },
    ],
  },
  'elpass': {
    title: 'Elpass', sub: 'Система доступа по лицу · наш офис работает на ней', mark: 'key',
    lead: 'Face ID вместо карточек и ключей для бизнес-центров, ЖК и госучреждений. Так же устроен пропуск в наш офис — лицо в систему добавляет Арынғазы Динара.',
    sections: [
      { title: 'Команда', items: ['Владелец продукта — Шарипов Ануар', 'Директор проектов — Новиков Игорь (AIVA, Elpass)', 'Менеджер проекта Elpass — Арынғазы Динара', 'Разработка — Заманбек Әділхан, Абызбай Дияр'] },
      { title: 'Клиенты и оборудование', items: ['Внедрено у Нацбанка РК и Службы госохраны', 'Терминалы Hikvision / Dahua, интеграция с турникетами', 'Если у вас не работает пропуск — к Динаре'] },
    ],
  },
  'elpark': {
    title: 'Elpark', sub: 'Распознавание номеров для парковок', mark: 'camera',
    lead: 'Камера считывает госномер, сверяет со списком и открывает шлагбаум. Работает в связке с Elpass — единая система доступа на объекте.',
    sections: [
      { title: 'Команда', items: ['Внедрение — Войцеховский Алексей (Elpark, SimSim)', 'Менеджер продукта — Творогов Антон', 'Сервисные инженеры — Әлім Әділ, Жумашев Нұрзат'] },
      { title: 'Что важно знать', items: ['Резиденты въезжают автоматически, гостям — доступ на время по номеру', 'История въездов доступна управляющей компании', 'Типовые вопросы клиентов — в Базе знаний'] },
    ],
  },
  'aiva': {
    title: 'AIVA — AI Video Analytics', sub: 'Видеоаналитика на ИИ', mark: 'video',
    lead: 'Камеры распознают людей и события, фиксируют нештатные ситуации и присылают уведомления. Разрабатывается нашим ML Department.',
    sections: [
      { title: 'Команда', items: ['ML Department — Кайрбаев Омар-Саян (руководитель), Хайров Азат, Елеусинов Арман, Амангали Алихан', 'Директор проектов — Новиков Игорь', 'Архитектура — Джунусов Тимур'] },
      { title: 'Сценарии', items: ['Безопасность ЖК и БЦ, контроль периметра', 'Подсчёт людей и аналитика потоков', 'Уведомления в реальном времени'] },
    ],
  },
  'замк': {
    title: 'Умные замки', sub: 'Направление SDL', mark: 'lock',
    lead: 'Продажа и установка умных замков A2 Sweden и Yale: смартфон, код, карта, отпечаток, лицо. Интегрируются с умным домом.',
    sections: [
      { title: 'Команда', items: ['Руководитель направления — Беков Рустам', 'Специалисты SDL — Абдулвахид Аулиеата, Саматов Тамерлан'] },
      { title: 'Модели', items: ['Alpha 50, Gemini X30, Viso, Infinity', 'Цены и прайс — у отдела продаж, либо спросите Connect AI'] },
    ],
  },
};

function projectDetails(p) {
  const title = (p.title || '').toLowerCase();
  const key = Object.keys(PROJECT_DETAILS).find(k => title.includes(k));
  return key ? PROJECT_DETAILS[key] : null;
}
function openProject(id) { state.projectOpen = id; render(); window.scrollTo(0, 0); }
function closeProject() { state.projectOpen = null; render(); }

function renderProjectPage(main, p) {
  const d = projectDetails(p);
  main.innerHTML = `
    <div class="section-head">
      <div>
        <a class="back-link" href="#" onclick="closeProject();return false;">← Все проекты</a>
        <div class="section-title">${escapeHtml(p.title)}</div>
        ${p.client ? `<div class="section-sub">${escapeHtml(p.client)}</div>` : ''}
      </div>
    </div>
    <div class="soon-page project-page">
      <div class="soon-page-head">
        <div class="soon-page-mark">${ico(d ? d.mark : 'folder')}</div>
        <div class="soon-page-lead">${escapeHtml(p.description || (d && d.lead) || '')}</div>
      </div>
      ${p.manager ? `<div class="project-manager">Руководитель проекта — <b>${escapeHtml(p.manager)}</b></div>` : ''}
      ${d ? d.sections.map(s => `
        <div class="soon-page-title">${escapeHtml(s.title)}</div>
        <ul class="soon-page-list">${s.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`).join('') : ''}
    </div>`;
}

// ---- доска почёта: отдельная страница с историей ----
function renderHonorsPage(main) {
  const list = state.honors || [];
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Доска почёта</div></div>
      <button class="btn" onclick="openHonorForm()">Назначить</button>
    </div>
    ${list.length ? `<div class="honors-list">${list.map((h, i) => {
      const p = state.employees.find(e => e.name === h.name) || { name: h.name };
      return `
        <div class="honor${i === 0 ? '' : ' past'}">
          <div class="honor-mark">${ico(i === 0 ? 'trophy' : 'award')}</div>
          ${p.photo ? `<img class="honor-photo" src="${escapeHtml(p.photo)}" alt="">` : `<div class="org-ava big honor-ava" style="--h:${hueOf(p.name)}">${initials(p.name)}</div>`}
          <div class="honor-text">
            <div class="honor-label">${i === 0 ? 'Сотрудник месяца' : 'Ранее'}${h.period ? ` · ${escapeHtml(h.period)}` : ''}</div>
            <div class="honor-name">${escapeHtml(p.name)}</div>
            ${p.position ? `<div class="honor-pos">${escapeHtml(p.position)}${p.department ? ' · ' + escapeHtml(p.department) : ''}</div>` : ''}
            ${h.reason ? `<div class="honor-reason">${escapeHtml(h.reason)}</div>` : ''}
          </div>
          <div class="honor-actions"><button class="btn text" onclick="deleteItem('honors','${h.id}')">Убрать</button></div>
        </div>`; }).join('')}</div>`
    : `<div class="empty"><strong>Пока никого не отметили</strong></div>`}`;
}

function renderSoon(main, p) {
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">${p.title}</div><div class="section-sub">${p.sub}</div></div>
      <span class="set-soon">в разработке</span>
    </div>
    <div class="soon-page">
      <div class="soon-page-head">
        <div class="soon-page-mark">${ico(p.mark)}</div>
        <div class="soon-page-lead">${p.lead}</div>
      </div>
      <div class="soon-page-title">Что здесь будет</div>
      <ul class="soon-page-list">
        ${p.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
      </ul>
      <div class="soon-hint">Раздел появится после запуска учётных записей. Есть пожелания — напишите в «Предложения» или HR.</div>
    </div>`;
}

// =========================================================
// PARTNERS — наши партнёры
// =========================================================
const PARTNER_CATEGORIES = ['Застройщики и девелоперы', 'Государственные организации', 'Оборудование и технологии', 'Инвесторы и экосистема'];

function renderPartners(main) {
  const items = state.partners.slice().sort((a, b) => a.sort - b.sort);
  const groups = {};
  items.forEach(p => { (groups[p.category || 'Партнёры'] ||= []).push(p); });
  const order = PARTNER_CATEGORIES.filter(c => groups[c]).concat(Object.keys(groups).filter(c => !PARTNER_CATEGORIES.includes(c)));

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Наши партнёры</div></div>
      <button class="btn" onclick="openPartnerForm()">Добавить партнёра</button>
    </div>

    <div class="partners-wall">
      <img src="/static/partners.png" alt="Логотипы партнёров Connected Home">
    </div>

    ${items.length ? order.map(cat => `
      <div class="section-head" style="margin-top:26px;">
        <div><div class="section-title" style="font-size:19px;">${escapeHtml(cat)}</div></div>
      </div>
      <div class="partners-grid">
        ${groups[cat].map(p => `
          <div class="partner-card clickable" onclick="openPartnerCard('${p.id}')" title="Открыть карточку">
            <div class="partner-top">
              ${p.logo ? `<img class="partner-logo" src="${escapeHtml(p.logo)}" alt="">` : `<div class="partner-mono">${escapeHtml(partnerAbbr(p.name))}</div>`}
              <div class="partner-name">${escapeHtml(p.name)}</div>
            </div>
            ${p.description ? `<div class="partner-desc">${escapeHtml(p.description)}</div>` : ''}
            <div class="partner-foot">
              ${p.website ? `<a class="partner-link" href="${escapeHtml(p.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escapeHtml(p.website.replace(/^https?:\/\//, ''))}</a>` : '<span></span>'}
              <button class="btn text" onclick="event.stopPropagation();deleteItem('partners','${p.id}')">Удалить</button>
            </div>
          </div>`).join('')}
      </div>`).join('')
    : '<div class="empty"><strong>Партнёров пока нет</strong></div>'}`;
}

function openPartnerCard(id) {
  const p = state.partners.find(x => x.id === id);
  if (!p) return;
  const site = (p.website || '').trim();
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Партнёр</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body emp-card">
        <div class="emp-top">
          ${p.logo ? `<img class="partner-big-logo zoomable" src="${escapeHtml(p.logo)}" alt="" title="Нажмите, чтобы увеличить"
                           onclick="openLightbox(${jsArg(p.logo)})">`
                   : `<div class="partner-mono big">${escapeHtml(partnerAbbr(p.name))}</div>`}
          <div class="emp-top-text">
            <div class="emp-name">${escapeHtml(p.name)}</div>
            ${p.category ? `<div class="emp-pos">${escapeHtml(p.category)}</div>` : ''}
          </div>
        </div>
        ${p.description ? `<div class="partner-card-desc">${escapeHtml(p.description)}</div>` : ''}
        <div class="emp-rows">
          ${site ? `<div class="emp-row"><span>Сайт</span><b><a href="${escapeHtml(site)}" target="_blank" rel="noopener">${escapeHtml(site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></b></div>` : ''}
        </div>
      </div>
      <div class="modal-foot">
        ${site ? `<a class="btn secondary" href="${escapeHtml(site)}" target="_blank" rel="noopener">Открыть сайт</a>` : ''}
        <button class="btn" onclick="closeModal()">Закрыть</button>
      </div>
    </div>`);
}

function partnerAbbr(name) {
  const w = name.replace(/[«»"]/g, '').split(/\s+/).filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
}

function openPartnerForm() {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Новый партнёр</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название</label><input id="fPaName" type="text"></div>
        <div class="field"><label>Категория</label>
          <select id="fPaCat">${PARTNER_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Чем занимается / что делаем вместе</label><textarea id="fPaDesc"></textarea></div>
        <div class="field"><label>Сайт (необязательно)</label><input id="fPaSite" type="text" placeholder="https://"></div>
        <div class="field"><label>Логотип (необязательно)</label><input id="fPaLogo" type="file" accept="image/*"></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitPartner()">Добавить</button>
      </div>
    </div>`);
}
async function submitPartner() {
  const name = document.getElementById('fPaName').value.trim();
  if (!name) { showToast('Укажите название'); return; }
  let logo = '';
  const f = document.getElementById('fPaLogo');
  if (f.files[0]) logo = (await uploadOne(f.files[0])).url || '';
  const item = await fetchJson('/api/partners', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, category: document.getElementById('fPaCat').value,
      description: document.getElementById('fPaDesc').value.trim(),
      website: document.getElementById('fPaSite').value.trim(), logo,
      sort: state.partners.length + 1,
    }),
  });
  closeModal();
  if (item) { state.partners.push(item); showToast('Партнёр добавлен'); } else showToast('Не удалось сохранить');
  render();
}

// =========================================================
// PROFILE / SETTINGS — заглушки до появления учётных записей
// =========================================================
function renderProfile(main) {
  const u = state.user;
  // карточка — по emp_id с сервера (связь по почте, потом по имени — как в _my_employee), раньше искали только по имени
  const card = (u.emp_id && state.employees.find(e => e.id === u.emp_id)) || state.employees.find(e => u.name && e.name && e.name.toLowerCase() === u.name.toLowerCase());
  if (card && state.myProfile === undefined) {
    state.myProfile = null;
    fetchJson('/api/me/profile').then(r => { state.myProfile = (r && r.profile) || null; if (state.view === 'profile') render(); });
  }
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Личный кабинет</div></div>
    </div>
    <div class="profile-card">
      <div class="profile-head">
        ${card && card.photo
          ? `<img class="profile-photo" src="${escapeHtml(card.photo)}" alt="">`
          : `<div class="org-ava big" style="--h:${hueOf(u.name)}">${initials(u.name)}</div>`}
        <div>
          <div class="profile-name">${escapeHtml(u.name)}</div>
          <div class="profile-role">${card && card.position ? escapeHtml(card.position) : (u.role === 'admin' ? 'Сотрудник' : (ROLE_LABELS[u.role] || 'Сотрудник'))}</div>
          <div class="profile-login">Логин: ${escapeHtml(u.login)}</div>
        </div>
      </div>
      ${card ? `
        <div class="profile-rows">
          ${card.department ? `<div><span>Подразделение</span><b>${escapeHtml(card.department)}</b></div>` : ''}
          ${card.unit ? `<div><span>Отдел</span><b>${escapeHtml(card.unit)}</b></div>` : ''}
          ${card.reports_to ? `<div><span>Руководитель</span><b>${escapeHtml(card.reports_to)}</b></div>` : ''}
          ${card.email ? `<div><span>Почта</span><b>${escapeHtml(card.email)}</b></div>` : ''}
          ${card.phone ? `<div><span>Телефон</span><b>${escapeHtml(card.phone)}</b></div>` : ''}
          ${card.schedule ? `<div><span>График</span><b>${escapeHtml(card.schedule)}</b></div>` : ''}
          ${card.hired ? `<div><span>В компании с</span><b>${fmtDate(card.hired)}${tenureText(card.hired) ? ' · ' + tenureText(card.hired) : ''}</b></div>` : ''}
        </div>
        <div class="profile-about">
          <div class="profile-games-head"><span>О себе</span>${state.myProfile && state.myProfile.visible === false ? '<em class="profile-hidden">скрыт от коллег</em>' : ''}</div>
          ${profileBlockHtml(state.myProfile, true)}
          <button class="btn secondary" onclick="openProfileForm()">${state.myProfile ? 'Изменить профиль' : 'Заполнить профиль'}</button>
        </div>`
        : `<div class="profile-nocard">Карточка сотрудника не найдена по имени «${escapeHtml(u.name)}».
             Попросите администратора указать в учётной записи имя ровно так, как оно записано в разделе «Все сотрудники».</div>`}
      <div class="profile-games" id="profileGames"></div>
      <div class="tg-mine" id="profileTelegram"></div>
      <div class="profile-actions">
        <button class="btn secondary" onclick="openChangePassword()">Сменить пароль</button>
        <button class="btn secondary" onclick="doLogout()">Выйти из портала</button>
      </div>
    </div>`;
  drawMyTelegram('profileTelegram');
  fetchJson('/api/games').then(d => {
    const box = document.getElementById('profileGames');
    if (!box || !d) return;
    box.innerHTML = `
      <div class="profile-games-head"><span>Мини-игры</span><b>${d.me.points} ${pluralRu(d.me.points, 'балл', 'балла', 'баллов')}</b></div>
      <div class="profile-games-row">
        ${Object.entries(GAME_META).map(([k, g]) => `<div class="profile-game"><span>${g.name}</span><b>${d.me.best[k] ? gameScoreLabel(k, d.me.best[k]) : '—'}</b></div>`).join('')}
      </div>
      <button class="btn text" onclick="goToView('games')">Играть →</button>`;
  });
}

// ---------- мини-игры (22.09.2026, идея пользователя): баллы копятся в личном кабинете ----------
// Доступ решает сервер (/api/games → window.mode: free / limited / closed); в режиме limited фронт раз в 30 секунд
// сообщает серверу, что игра открыта (/api/games/tick), и закрывает игру, когда 30 минут на день кончились.
const GAME_META = {
  snake:  { icon: 'g_snake',  name: 'Змейка',               rule: 'Стрелки или WASD. Балл за каждое яблоко, до 40 за партию.' },
  mines:  { icon: 'g_mines',  name: 'Сапёр',                rule: '9×9, десять мин. Левая кнопка — открыть, правая — флажок. Победа — 30 баллов.' },
  quiz:   { icon: 'g_quiz',   name: 'Викторина о компании', rule: 'Десять вопросов о коллегах, отделах и программе лояльности. Три балла за верный ответ.' },
  typing: { icon: 'g_typing', name: 'Скоропечатание',       rule: 'Наберите текст как можно быстрее и без ошибок. Баллы — по скорости, до 30.' },
};
const TYPING_TEXTS = [
  'Умный дом начинается с простых вещей: свет включается, когда вы входите, шторы открываются с рассветом, а замок узнаёт вас по лицу.',
  'Хороший монтаж не виден заказчику: провода спрятаны, датчики стоят там, где нужно, а система работает так, будто была в доме всегда.',
  'Каждый проект проходит одинаковый путь: замер, проектирование, согласование, монтаж, настройка и передача заказчику с обучением.',
  'Портал собирает всё в одном месте: новости компании, справочник сотрудников, заявки, календарь событий и ответы на частые вопросы.',
  'Команда сильна, когда каждый знает, к кому идти с вопросом, где лежат документы и кто отвечает за результат на каждом этапе.',
];
let gamesTimer = null;      // секундный отсчёт лимита
let gamesLeft = null;       // сколько секунд осталось сегодня (режим limited)
let activeGame = null;      // { stop() } — текущая партия, чтобы остановить её при уходе

function gamesLeave() {
  if (gamesTimer) { clearInterval(gamesTimer); gamesTimer = null; }
  if (activeGame) { try { activeGame.stop(); } catch (e) { /* игра уже остановлена */ } activeGame = null; }
}
function fmtLeft(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function gameScoreLabel(k, s) {
  return { snake: `${s} ${pluralRu(s, 'яблоко', 'яблока', 'яблок')}`, mines: `${s} ${pluralRu(s, 'клетка', 'клетки', 'клеток')}`,
           quiz: `${s} из 10`, typing: `${s} сл/мин` }[k] || String(s);
}
function gamesWindowHtml(w) {   // строка состояния под названием раздела
  if (w.mode === 'free') return w.reason ? `<div class="games-status free">Без ограничений · ${escapeHtml(w.reason)}</div>` : '';
  if (w.mode === 'limited') return `<div class="games-status limited">Осталось сегодня <b id="gamesLeftTop">${fmtLeft(w.remaining)}</b>${w.next ? ` · без ограничений ${escapeHtml(w.next)}` : ''}</div>`;
  return `<div class="games-status closed">Закрыто · ${escapeHtml(w.reason)}${w.next ? ` · откроется ${escapeHtml(w.next)}` : ''}</div>`;
}

async function renderGames(main) {
  const d = await fetchJson('/api/games');
  if (!d) { main.innerHTML = '<div class="empty"><strong>Не удалось загрузить игры</strong></div>'; return; }
  state.gamesData = d;
  const w = d.window;
  if (state.game && GAME_META[state.game] && w.mode !== 'closed') return renderGameScreen(main, d);
  state.game = null;
  gamesLeave();
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Мини-игры</div>${gamesWindowHtml(w)}</div>
      <div class="games-me">${ico('award')} <b>${d.me.points}</b> ${pluralRu(d.me.points, 'балл', 'балла', 'баллов')}</div>
    </div>
    <div class="games-grid">
      ${Object.entries(GAME_META).map(([k, g]) => `
        <div class="game-tile${w.mode === 'closed' ? ' locked' : ''}" onclick="openGame('${k}')" role="button">
          <div class="game-mark">${ico(g.icon)}</div>
          <div class="game-title">${g.name}</div>
          <div class="game-best">${d.me.best[k] ? `Лучший результат: ${gameScoreLabel(k, d.me.best[k])}` : 'Ещё не играли'}</div>
          <div class="game-go">${w.mode === 'closed' ? 'Закрыто' : 'Играть →'}</div>
        </div>`).join('')}
    </div>
    <div class="req-list-title">Рейтинг</div>
    ${d.top.length ? `<div class="games-top">${d.top.map((t, i) => `
      <div class="games-row${t.user_id === state.user.id ? ' me' : ''}">
        <span class="games-pos">${i + 1}</span><span class="games-name">${escapeHtml(t.name)}</span>
        <span class="games-sub">${t.games} ${pluralRu(t.games, 'партия', 'партии', 'партий')}</span><span class="games-pts">${t.points}</span>
      </div>`).join('')}</div>`
    : '<div class="empty"><strong>Пока никто не играл</strong></div>'}`;
}

function openGame(k) {
  const w = (state.gamesData || {}).window || {};
  if (w.mode === 'closed') return showToast('Сейчас игры закрыты: ' + (w.reason || ''));
  state.game = k;
  render();
}
function closeGame() { state.game = null; render(); }

function renderGameScreen(main, d) {
  gamesLeave();
  const k = state.game, g = GAME_META[k], w = d.window;
  main.innerHTML = `
    <div class="section-head">
      <div><a class="back-link" href="#" onclick="closeGame();return false;">← Все игры</a><div class="section-title">${g.name}</div>${gamesWindowHtml(w)}</div>
      <div class="games-me">${ico('award')} <b id="gamesPts">${d.me.points}</b> ${pluralRu(d.me.points, 'балл', 'балла', 'баллов')}</div>
    </div>
    <div class="game-screen">
      <div class="game-bar">
        <div class="game-rule">${g.rule}</div>
        ${w.mode === 'limited' ? `<div class="game-left"><span id="gameLeft">${fmtLeft(w.remaining)}</span></div>` : ''}
      </div>
      <div class="game-box" id="gameBox"></div>
    </div>`;
  if (w.mode === 'limited') gamesStartTick(w.remaining);
  const box = document.getElementById('gameBox');
  ({ snake: startSnake, mines: startMines, quiz: startQuiz, typing: startTyping })[k](box);
}

// отсчёт лимита: раз в секунду на экране, раз в 30 секунд — на сервер
function gamesStartTick(remaining) {
  gamesLeft = remaining;
  let n = 0;
  gamesTimer = setInterval(async () => {
    n++; gamesLeft--;
    for (const id of ['gameLeft', 'gamesLeftTop']) { const el = document.getElementById(id); if (el) el.textContent = fmtLeft(gamesLeft); }
    if (n % 30 === 0) {
      const r = await fetchJson('/api/games/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds: 30 }) });
      if (r && r.window) {
        state.gamesData.window = r.window;
        if (r.window.mode === 'closed') return gamesTimeUp();
        gamesLeft = r.window.mode === 'limited' ? r.window.remaining : null;
        if (gamesLeft === null) { clearInterval(gamesTimer); gamesTimer = null; const e2 = document.getElementById('gameLeft'); if (e2) e2.textContent = '∞'; }
      }
    }
    if (gamesLeft !== null && gamesLeft <= 0) gamesTimeUp();
  }, 1000);
}
function gamesTimeUp() {
  gamesLeave();
  showToast('30 минут на сегодня закончились — игры откроются в обед или после 18:00');
  state.game = null;
  render();
}

async function submitScore(game, meta, box, againFn) {
  const r = await fetchJson('/api/games/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, meta }) });
  if (!r) return;
  if (r.me) { state.gamesData.me = r.me; const p = document.getElementById('gamesPts'); if (p) p.textContent = r.me.points; }
  if (r.window) state.gamesData.window = r.window;
  const detail = { snake: `${gameScoreLabel('snake', r.score)}`, mines: r.won ? 'Поле разминировано' : 'Подрыв',
                   quiz: `Верных ответов: ${r.correct} из ${r.total}`, typing: `${r.wpm} сл/мин · точность ${Math.round((r.accuracy || 0) * 100)}%` }[game];
  box.innerHTML = `
    <div class="game-result">
      <div class="game-result-detail">${detail}</div>
      <b>+${r.points}</b><div class="game-result-sub">${pluralRu(r.points, 'балл', 'балла', 'баллов')} · всего ${r.me.points}</div>
      <div class="game-result-actions">
        <button class="btn" onclick="(${againFn})()">Ещё раз</button>
        <button class="btn secondary" onclick="closeGame()">К списку игр</button>
      </div>
    </div>`;
}
window.gameAgain = () => render();   // «Ещё раз» — перерисовать экран текущей игры

// ---- Змейка ----
function startSnake(box) {
  const N = 18, CELL = 20, SIZE = N * CELL;
  box.innerHTML = `<div class="snake-wrap"><div class="snake-hud"><span>Яблок: <b id="snakeScore">0</b></span><button class="btn secondary" id="snakeStart">Начать</button></div>
    <canvas class="snake" id="snakeCv" width="${SIZE}" height="${SIZE}"></canvas></div>`;
  const cv = document.getElementById('snakeCv'), ctx = cv.getContext('2d');
  let snake, dir, nextDir, apple, apples, timer = null, startedAt = 0, alive = false;
  const css = getComputedStyle(document.documentElement);
  const orange = css.getPropertyValue('--orange').trim() || '#FF6600';
  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#FFE5D1';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * CELL, j * CELL, CELL, CELL);
    ctx.fillStyle = '#C4322A'; ctx.beginPath(); ctx.arc(apple.x * CELL + CELL / 2, apple.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2); ctx.fill();
    snake.forEach((s, i) => { ctx.fillStyle = i ? orange : '#D95700'; ctx.beginPath(); ctx.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 5); ctx.fill(); });
  }
  function placeApple() {
    do { apple = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; }
    while (snake.some(s => s.x === apple.x && s.y === apple.y));
  }
  function step() {
    dir = nextDir;
    const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some(s => s.x === h.x && s.y === h.y)) return die();
    snake.unshift(h);
    if (h.x === apple.x && h.y === apple.y) { apples++; document.getElementById('snakeScore').textContent = apples; placeApple(); }
    else snake.pop();
    draw();
  }
  function die() {
    alive = false; clearInterval(timer); timer = null;
    submitScore('snake', { apples, seconds: (Date.now() - startedAt) / 1000 }, box, 'gameAgain');
  }
  function start() {
    snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }]; dir = nextDir = { x: 1, y: 0 }; apples = 0; alive = true; startedAt = Date.now();
    document.getElementById('snakeScore').textContent = '0';
    placeApple(); draw();
    if (timer) clearInterval(timer);
    timer = setInterval(step, 130);
  }
  const onKey = e => {
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ц: [0, -1], ы: [0, 1], ф: [-1, 0], в: [1, 0] }[e.key];
    if (!m) return;
    e.preventDefault();
    if (!alive) return;
    if (m[0] === -dir.x && m[1] === -dir.y) return;   // разворот на 180° запрещён
    nextDir = { x: m[0], y: m[1] };
  };
  document.addEventListener('keydown', onKey);
  document.getElementById('snakeStart').onclick = start;
  snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }]; apples = 0; placeApple(); draw();
  activeGame = { stop() { document.removeEventListener('keydown', onKey); if (timer) clearInterval(timer); } };
}

// ---- Сапёр ----
function startMines(box) {
  const N = 9, M = 10;
  let cells, opened = 0, flags = 0, started = 0, over = false, placed = false;
  box.innerHTML = `<div class="mines-wrap"><div class="snake-hud"><span>Мин: <b>${M}</b> · флажков: <b id="minesFlags">0</b></span><button class="btn secondary" id="minesRestart">Заново</button></div><div class="mines" id="minesGrid"></div></div>`;
  const grid = document.getElementById('minesGrid');
  const idx = (x, y) => y * N + x;
  const around = (x, y) => { const r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < N && ny < N) r.push([nx, ny]); } return r; };
  function build() {
    cells = Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    opened = 0; flags = 0; over = false; placed = false; started = 0;
    grid.innerHTML = cells.map((c, i) => `<div class="mine-cell" data-i="${i}"></div>`).join('');
    document.getElementById('minesFlags').textContent = '0';
  }
  function place(sx, sy) {
    const safe = new Set([idx(sx, sy), ...around(sx, sy).map(([x, y]) => idx(x, y))]);
    let left = M;
    while (left) { const i = Math.floor(Math.random() * N * N); if (safe.has(i) || cells[i].mine) continue; cells[i].mine = true; left--; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cells[idx(x, y)].n = around(x, y).filter(([ax, ay]) => cells[idx(ax, ay)].mine).length;
    placed = true; started = Date.now();
  }
  function paint(i) {
    const c = cells[i], el = grid.children[i];
    el.className = 'mine-cell' + (c.open ? ' open' : '') + (c.flag ? ' flag' : '');
    el.textContent = c.open ? (c.mine ? '✕' : (c.n || '')) : (c.flag ? '⚑' : '');
    if (c.open && c.n) el.dataset.n = c.n;
  }
  function reveal(x, y) {
    const i = idx(x, y), c = cells[i];
    if (c.open || c.flag) return;
    c.open = true; opened++; paint(i);
    if (!c.n && !c.mine) around(x, y).forEach(([ax, ay]) => reveal(ax, ay));
  }
  function finish(won) {
    over = true;
    cells.forEach((c, i) => { if (c.mine) { c.open = true; c.flag = false; paint(i); if (!won) grid.children[i].classList.add('boom'); } });
    setTimeout(() => submitScore('mines', { won, opened, seconds: (Date.now() - started) / 1000 }, box, 'gameAgain'), won ? 400 : 900);
  }
  grid.addEventListener('click', e => {
    const el = e.target.closest('.mine-cell'); if (!el || over) return;
    const i = +el.dataset.i, x = i % N, y = Math.floor(i / N);
    if (!placed) place(x, y);
    if (cells[i].flag) return;
    if (cells[i].mine) { cells[i].open = true; paint(i); return finish(false); }
    reveal(x, y);
    if (opened === N * N - M) finish(true);
  });
  grid.addEventListener('contextmenu', e => {
    e.preventDefault();
    const el = e.target.closest('.mine-cell'); if (!el || over) return;
    const c = cells[+el.dataset.i]; if (c.open) return;
    c.flag = !c.flag; flags += c.flag ? 1 : -1; paint(+el.dataset.i);
    document.getElementById('minesFlags').textContent = flags;
  });
  document.getElementById('minesRestart').onclick = build;
  build();
  activeGame = { stop() { over = true; } };
}

// ---- Викторина ----
async function startQuiz(box) {
  box.innerHTML = '<div class="empty"><strong>Готовим вопросы…</strong></div>';
  const q = await fetchJson('/api/games/quiz');
  if (!q || !q.questions) { box.innerHTML = '<div class="empty"><strong>Викторина сейчас недоступна</strong></div>'; return; }
  let i = 0, right = 0, stopped = false;
  // после ответа сразу показываем: верно или нет, и какой ответ правильный; дальше — только по кнопке (24.09.2026)
  function show() {
    if (stopped) return;
    if (i >= q.questions.length) return submitScore('quiz', { qid: q.qid }, box, 'gameAgain');
    const cur = q.questions[i];
    box.innerHTML = `<div class="quiz">
      <div class="quiz-progress">Вопрос ${i + 1} из ${q.questions.length} · верных ${right}</div>
      <div class="quiz-q">${escapeHtml(cur.text)}</div>
      <div class="quiz-opts">${cur.options.map((o, j) => `<button class="quiz-opt" data-j="${j}">${escapeHtml(o)}</button>`).join('')}</div>
      <div class="quiz-feedback" id="quizFb"></div></div>`;
    box.querySelectorAll('.quiz-opt').forEach(b => b.onclick = async () => {
      const btns = [...box.querySelectorAll('.quiz-opt')];
      btns.forEach(x => { x.disabled = true; });
      const choice = +b.dataset.j;
      const r = await fetchJson('/api/games/quiz/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qid: q.qid, index: i, choice }) });
      if (!r || stopped) return;
      btns[r.answer].classList.add('right');
      if (!r.correct) b.classList.add('wrong'); else right++;
      const last = i === q.questions.length - 1;
      document.getElementById('quizFb').innerHTML = `
        <div class="quiz-verdict ${r.correct ? 'ok' : 'no'}">${r.correct ? 'Верно!' : `Неверно. Правильный ответ: <b>${escapeHtml(cur.options[r.answer])}</b>`}</div>
        <button class="btn" id="quizNext">${last ? 'Завершить' : 'Дальше →'}</button>`;
      document.getElementById('quizNext').onclick = () => { i++; show(); };
    });
  }
  show();
  activeGame = { stop() { stopped = true; } };
}

// ---- Скоропечатание ----
function startTyping(box) {
  const text = TYPING_TEXTS[Math.floor(Math.random() * TYPING_TEXTS.length)];
  let startedAt = 0, done = false;
  box.innerHTML = `<div class="typing">
    <div class="typing-text" id="typingText"></div>
    <textarea class="typing-input" id="typingInput" autocomplete="off" spellcheck="false"></textarea>
    <div class="typing-hud"><span id="typingStat">Начните печатать — время пойдёт с первой буквы</span></div></div>`;
  const tEl = document.getElementById('typingText'), inp = document.getElementById('typingInput');
  function paint(v) {
    tEl.innerHTML = [...text].map((ch, i) => {
      const cls = i < v.length ? (v[i] === ch ? 'ok' : 'bad') : (i === v.length ? 'cur' : '');
      return cls ? `<span class="${cls}">${escapeHtml(ch)}</span>` : escapeHtml(ch);
    }).join('');
  }
  paint('');
  inp.addEventListener('paste', e => e.preventDefault());
  inp.addEventListener('input', () => {
    if (done) return;
    const v = inp.value;
    if (!startedAt && v.length) startedAt = Date.now();
    paint(v);
    const secs = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    if (secs > 0) document.getElementById('typingStat').textContent = `${Math.round(v.length / 5 / (secs / 60))} сл/мин`;
    if (v.length >= text.length) {
      done = true; inp.disabled = true;
      let ok = 0; for (let i = 0; i < text.length; i++) if (v[i] === text[i]) ok++;
      submitScore('typing', { chars: text.length, seconds: secs, accuracy: ok / text.length }, box, 'gameAgain');
    }
  });
  inp.focus();
  activeGame = { stop() { done = true; } };
}


// ---------- настройки (хранятся в браузере, пока нет учёток) ----------
const SETTINGS_KEY = 'cs_settings';
const SETTINGS_DEFAULT = { theme: 'light', fontSize: 'normal', compact: false, showBirthdays: true, showAiTeaser: true };
function loadSettings() {
  try { return { ...SETTINGS_DEFAULT, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
  catch (e) { return { ...SETTINGS_DEFAULT }; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* приватный режим — просто не сохранится */ }
}
state.settings = loadSettings();

function applySettings() {
  const s = state.settings;
  const root = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.font = s.fontSize;
  root.dataset.compact = s.compact ? '1' : '0';
  updateThemeBtn(dark);
}
// кнопка темы в шапке (08.10.2026, слова пользователя: «смена тёмной и светлой темы должна быть не в настройках, а где-то сверху»):
// одно нажатие — противоположная тема; в настройках тот же выбор остаётся (и «как в системе»)
function updateThemeBtn(dark) {
  const b = document.getElementById('themeToggle');
  if (!b) return;
  b.title = dark ? 'Светлая тема' : 'Тёмная тема';
  b.innerHTML = dark
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}
// «Смотреть как сотрудник» (08.10.2026, просьба пользователя перед показом: «мне там нужен обычный доступ»).
// Кнопка-глаз в шапке только у админа; в режиме сотрудника кнопка оранжевая, и сервер отвечает ему как сотруднику.
// кнопка живёт в админ-панели («сделай как было, а глазик — в админ-панели»); в режиме сотрудника сверху тонкая полоса с возвратом
function updateViewAsBtn() {
  const bar = document.getElementById('viewAsBar');
  if (bar) bar.hidden = !(state.user && state.user.view_as);
}
async function toggleViewAs() {
  const on = !(state.user && state.user.view_as);
  const res = await fetchJson('/api/me/view-as', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) });
  if (!res) { showToast('Не удалось переключить'); return; }
  state.user = res;
  showToast(on ? 'Вы смотрите портал как сотрудник' : 'Права администратора возвращены');
  cw.tasks = null; cw.settings = null;
  if (on && ['admin', 'hr', 'buyer', 'accountant'].includes(state.view)) state.view = 'home';
  render();
}
function toggleTheme() {
  setSetting('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.settings.theme === 'system') applySettings();
});
applySettings();

function setSetting(key, value) {
  state.settings[key] = value;
  saveSettings(state.settings);
  applySettings();
  render();
}
function resetSettings() {
  state.settings = { ...SETTINGS_DEFAULT };
  saveSettings(state.settings);
  applySettings();
  showToast('Настройки сброшены');
  render();
}

function renderSettings(main) {
  const s = state.settings;
  const pill = (key, val, label) =>
    `<button class="seg${s[key] === val ? ' active' : ''}" onclick="setSetting('${key}','${val}')">${label}</button>`;
  const toggle = (key, label, hint) => `
    <label class="set-row">
      <div><div class="set-label">${label}</div>${hint ? `<div class="set-hint">${hint}</div>` : ''}</div>
      <span class="switch${s[key] ? ' on' : ''}" onclick="setSetting('${key}', ${!s[key]})"><i></i></span>
    </label>`;

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Настройки</div></div>
      <button class="btn secondary" onclick="resetSettings()">Сбросить</button>
    </div>

    <div class="set-group">
      <div class="set-group-title">Внешний вид</div>
      <div class="set-row">
        <div><div class="set-label">Тема</div></div>
        <div class="seg-group">${pill('theme', 'light', 'Светлая')}${pill('theme', 'dark', 'Тёмная')}${pill('theme', 'system', 'Как в системе')}</div>
      </div>
      <div class="set-row">
        <div><div class="set-label">Размер текста</div></div>
        <div class="seg-group">${pill('fontSize', 'normal', 'Обычный')}${pill('fontSize', 'large', 'Крупный')}</div>
      </div>
      ${toggle('compact', 'Компактный режим', 'Меньше отступов — больше информации на экране')}
    </div>

    <div class="set-group">
      <div class="set-group-title">Правая колонка</div>
      ${toggle('showBirthdays', 'Дни рождения в ближайших событиях', 'Показывать дни рождения коллег в ленте «Ближайшие события»')}
    </div>

    <div class="set-group muted">
      <div class="set-group-title">Появится с учётными записями</div>
      <div class="set-row"><div><div class="set-label">Пароль и вход</div></div><span class="set-soon">скоро</span></div>
      <div class="set-row"><div><div class="set-label">Уведомления</div></div><span class="set-soon">скоро</span></div>
      <div class="set-row"><div><div class="set-label">Фото профиля</div></div><span class="set-soon">скоро</span></div>
    </div>`;
}

// =========================================================
// MESSENGER — пока заглушка, внутренний чат появится позже
// =========================================================
function renderMessenger(main) {
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Мессенджер</div></div>
    </div>
    <div class="soon-card">
      <div class="soon-mark">${ico('chat')}</div>
      <div class="soon-title">Скоро здесь будет чат</div>
      <div class="soon-text">
        Общие каналы, каналы отделов и переписка с коллегами — прямо на портале,
        без сторонних мессенджеров. Раздел появится вместе с личными учётными записями.
      </div>
      <div class="soon-hint">
        А пока по рабочим вопросам — общий чат в Telegram, по вопросам о компании —
        <a href="#" onclick="goToAiBot('');return false;">Connect AI</a>.
      </div>
    </div>`;
}

// =========================================================
// AI STAFF BOT — чат
// =========================================================
// messages: [{role:'user'|'bot'|'error', text}]
const ai = { messages: [], draft: '', loading: false };

const AI_EXAMPLES = [
  'Кто руководит отделом ИИ и как с ним связаться?',
  'Какая матпомощь положена при рождении ребёнка?',
  'Что такое Elpark?',
  'У меня не работает компьютер, к кому идти?',
  'Оформи заявку на монитор',
];

function renderAiBot(main) {
  main.innerHTML = `
    <div class="chat-shell">
      <div class="chat-topbar">
        <div class="chat-topbar-left">
          <span class="ask-spark"><img src="/static/bot-mark-white.svg" alt=""></span>
          <div>
            <div class="chat-name">Connect AI</div>
            <div class="chat-status">Отвечает только по данным этого портала</div>
          </div>
        </div>
        <button class="btn secondary chat-new" onclick="newChat()">Новый чат</button>
      </div>

      <div class="chat-log" id="chatLog"></div>

      <div class="chat-composer">
        <textarea id="askInput" rows="1" placeholder="Напишите вопрос…"
          oninput="ai.draft=this.value; autoGrow(this)" onkeydown="askKeydown(event)"></textarea>
        <button class="chat-send" id="askBtn" onclick="submitAsk()" title="Отправить">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none"
               stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
      </div>
      
    </div>`;

  paintChat();
  const input = document.getElementById('askInput');
  if (input) {
    input.value = ai.draft;
    requestAnimationFrame(() => { autoGrow(input); input.focus(); });
  }
}

function newChat() {
  ai.messages = [];
  ai.draft = '';
  ai.loading = false;
  render();
}

function askExample(btn) {
  const input = document.getElementById('askInput');
  if (!input) return;
  input.value = btn.textContent;
  autoGrow(input);
  submitAsk();
}

function chatEmptyHtml() {
  return `
    <div class="chat-empty">
      <div class="chat-empty-mark"><img src="/static/bot-mark-white.svg" alt=""></div>
      <div class="chat-empty-title">Чем помочь?</div>
      <div class="chat-empty-sub">
        Спросите своими словами про отпуск, больничный, зарплату, пропуск —
        я отвечу по данным портала.
      </div>
      <div class="ask-examples">
        ${AI_EXAMPLES.map(q => `<button class="ask-chip" onclick="askExample(this)">${escapeHtml(q)}</button>`).join('')}
      </div>
    </div>`;
}

// ---------- Connect AI помогает заполнить заявку (05.10.2026) ----------
// Бот получает краткое описание форм (botForms), задаёт вопросы и в конце ответа дописывает строку-черновик
// «<<<ЗАЯВКА {json}>>>». Мы её вырезаем из текста, проверяем по схеме формы и показываем карточку с кнопкой «Отправить».
// Отправляет заявку сам сотрудник — тем же POST /api/requests, что и обычная форма.
// Маркер черновика бот обязан оставлять как есть, но на EN/KZ/中文 может перевести само слово — принимаем любое слово после «<<<».
const BOT_DRAFT_RE = /<<<\s*[^\s{}<>]{0,20}\s*(\{[\s\S]*\})\s*>>>/;
const BOT_KNOWN_FIELDS = ['org', 'full_name', 'position', 'department', 'phone', 'email'];   // подставляем сами из справочника

function botKinds() {
  return Object.entries(REQ_KINDS).filter(([, k]) => !k.hidden && (!k.managerOnly || isManager()));
}
// То, что портал уже знает о самом сотруднике. Только поля ПЕРВОГО раздела формы («Кто обращается»): дальше тот же ключ
// может значить другое — в подборе персонала position это «Название вакантной должности», а не должность руководителя
// (нашёл проверяющий 05.10.2026). Вид с пометкой botAsksWho (увольнение — оформляют и себя, и своего сотрудника)
// бот всё равно спрашивает, а подстановка работает как запасной вариант.
function botPrefill(k) {
  const me = state.employees.find(e => state.user.name && e.name.toLowerCase() === state.user.name.toLowerCase()) || {};
  // у учётки без карточки в справочнике (админ, служебная) имя берём из самой учётки: в чате заявку подают от себя
  const pre = { org: me.company || 'Connected Home', full_name: me.name || state.user.name,
    position: me.position, department: me.department, phone: me.phone,
    email: me.email || (state.user.login.includes('@') ? state.user.login : '') };
  const keys = new Set(k.schema[0].fields.map(f => f.k));
  return Object.fromEntries(Object.entries(pre).filter(([key, v]) => v && keys.has(key) && BOT_KNOWN_FIELDS.includes(key)));
}
const botFieldReq = f => !!(f.req || f.botReq);   // botReq — обязательно для бота, хотя в форме звёздочки нет (даты отпуска)
// описание форм для бота: только то, что ему нужно спросить; паспортные поля (secret) и уже известные личные данные не отдаём
function botForms() {
  return botKinds().map(([key, k]) => {
    const known = k.botAsksWho ? {} : botPrefill(k);
    const lines = k.schema.flatMap(sec => sec.fields.filter(f => !f.secret && !known[f.k]).map(f => {
      const cond = f.showIf || sec.showIf;
      return `  ${f.k} | ${f.l} | ${f.t === 'radio' ? 'выбор' : f.t === 'date' ? 'дата' : f.t === 'time' ? 'время' : f.t === 'number' ? 'число' : 'текст'}`
        + (botFieldReq(f) ? ' | обязательно' : '')
        + (f.o ? ' | ' + f.o.map(([v, t]) => `${v}=${t}`).join('; ') : '')
        + (cond ? ` | только если ${cond[0]}=${cond[1]}` : '');
    }));
    return `ВИД ${key} — «${k.name}», уходит ${k.to}${k.botNote ? '\n  Примечание: ' + k.botNote : ''}\n${lines.join('\n')}`;
  }).join('\n\n');
}

// проверяем черновик бота по схеме формы: лишнее и невозможное выбрасываем, чего не хватает — перечисляем
function botDraftCheck(type, raw) {
  const k = Object.prototype.hasOwnProperty.call(REQ_KINDS, type) ? REQ_KINDS[type] : null;
  if (!k || k.hidden || (k.managerOnly && !isManager())) return null;
  const src = { ...(k.defaults || {}), ...botPrefill(k) };
  for (const [key, v] of Object.entries(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})) {
    if (['string', 'number', 'boolean'].includes(typeof v) && String(v).trim()) src[key] = String(v).trim();   // вложенные объекты не берём
  }
  const fields = k.schema.flatMap(sec => sec.fields);
  // сначала приводим ответы-варианты к кодам («Самолёт» → plane): от них зависит, какие разделы формы показаны
  for (const f of fields) {
    if (f.t !== 'radio' || !src[f.k] || f.o.some(o => o[0] === src[f.k])) continue;
    const hit = f.o.find(o => o[1].toLowerCase() === src[f.k].toLowerCase());
    if (hit) src[f.k] = hit[0]; else delete src[f.k];
  }
  const shown = c => !c || src[c[0]] === c[1];
  const data = {}, missing = [];
  let needsForm = false;
  for (const sec of k.schema) {
    if (!shown(sec.showIf)) continue;
    for (const f of sec.fields) {
      if (!shown(f.showIf)) continue;
      if (f.secret) { needsForm = true; continue; }                     // паспортные данные — только в форме
      let v = src[f.k];
      if (v && f.t === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = '';
      if (v && f.t === 'time' && !/^\d{1,2}:\d{2}$/.test(v)) v = '';
      if (v && f.t === 'number') {                                       // «150 000», «1,5», «150000.00» — без выдуманных нулей
        const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
        v = Number.isFinite(n) && n >= 0 ? String(f.step ? Math.round(n * 100) / 100 : Math.round(n)) : '';   // сумма по чеку — с тиынами
      }
      if (v) data[f.k] = v.slice(0, 2000);
      else if (botFieldReq(f)) missing.push(f.l);
    }
  }
  const error = data.date_start && data.date_end && data.date_end < data.date_start ? 'Дата окончания раньше даты начала.' : '';
  return { type, data, missing, needsForm, error, sent: false, sending: false };
}

// разбираем ответ бота: текст для показа отдельно, черновик заявки отдельно
function botParseAnswer(answer) {
  const m = BOT_DRAFT_RE.exec(answer || '');
  if (!m) return { text: answer, draft: null, failed: false };
  let draft = null;
  try { const j = JSON.parse(m[1]); draft = botDraftCheck(j.type, j.data); } catch (e) { /* бот прислал не JSON — покажем только текст */ }
  const text = answer.replace(BOT_DRAFT_RE, '').replace(/\n{3,}/g, '\n\n').trim();   // бот иногда ставит черновик посреди текста — убираем дыру
  return { text: draft ? (text || 'Заявка готова — проверьте её.') : 'Не получилось собрать заявку. Попробуйте ещё раз или заполните форму в разделе «Заявки».',
    draft, failed: !draft };
}

function botDraftHtml(m, i) {
  const d = m.draft, k = REQ_KINDS[d.type];
  const body = requestDetailHtml({ type: d.type, data: d.data });
  let foot;
  // после исправления бот присылает заявку заново — прежний вариант остаётся в переписке, но отправить его уже нельзя
  const stale = !d.sent && botDraftStale(i);
  if (stale) {
    foot = `<div class="draft-note">Этот вариант заменён более новым — он ниже.</div>`;
  } else if (d.sent) {
    foot = `<div class="draft-done">${ico('check')} ${escapeHtml(d.sent)}</div>`;
  } else if (d.sending) {
    foot = `<button class="btn" disabled>Отправляем…</button>`;
  } else if (d.error || d.missing.length) {
    foot = `<div class="draft-note">${d.error ? escapeHtml(d.error) : 'Не хватает: ' + d.missing.map(escapeHtml).join('; ')}</div>
            <button class="btn secondary" onclick="botDraftToForm(${i})">Дописать в форме</button>`;
  } else if (d.needsForm) {
    foot = `<div class="draft-note">${escapeHtml(k.draftNote || 'Данные документа для билета вписываются только в форме — я их не спрашиваю.')}</div>
            <button class="btn" onclick="botDraftToForm(${i})">Открыть форму и дописать</button>`;
  } else {
    foot = `<button class="btn" onclick="botDraftSend(${i}, this)">Отправить ${escapeHtml(k.to)}</button>
            <button class="btn secondary" onclick="botDraftToForm(${i})">Изменить в форме</button>`;
  }
  return `
    <div class="draft-card${d.sent || stale ? ' sent' : ''}">
      <div class="draft-head">${ico(k.icon)}<span>${escapeHtml(k.name)}</span></div>
      <div class="draft-body no-tr">${body}</div>
      <div class="draft-foot">${foot}</div>
    </div>`;
}

// «Изменить в форме»: открываем обычную форму заявки с тем, что собрал бот
function botDraftToForm(i) {
  const d = (ai.messages[i] || {}).draft;
  if (!d) return;
  state.reqForm = d.type; state.reqPreset = { ...d.data };
  goToView('requests');
}

// более новый ответ бота с черновиком (даже неразобранным) отменяет прежнюю карточку
function botDraftStale(i) { return ai.messages.some((x, j) => j > i && (x.draft || x.draftFailed)); }

async function botDraftSend(i, btn) {
  const m = ai.messages[i], d = m && m.draft;
  if (!d || d.sent || d.sending || d.error || d.missing.length || d.needsForm || botDraftStale(i)) return;
  const k = REQ_KINDS[d.type];
  // флаг в самих данных, а не только на кнопке: чат может перерисоваться, пока идёт отправка, и кнопка появилась бы снова
  d.sending = true;
  btn.disabled = true; btn.textContent = 'Отправляем…';
  let r, res = {};
  try {
    r = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: d.type, data: d.data }) });
    res = await r.json().catch(() => ({}));
  } catch (e) { r = null; }
  d.sending = false;
  if (!r || !r.ok) { showToast(res.error || 'Не удалось отправить заявку.'); paintChat(); return; }
  state.requests.unshift(res);
  updateRequestsBadge(); renderSideWidgets();
  d.sent = res.status === 'approval' && res.approver_name
    ? `Отправлено на одобрение: ${res.approver_name}. После одобрения заявка уйдёт ${k.to}.`
    : `Отправлено ${k.to}.`;
  // в историю для бота: заявка ушла, чтобы он не предлагал отправить её ещё раз
  ai.messages.push({ role: 'bot', text: d.sent + ' Статус видно в разделе «Заявки».' });
  paintChat();
  showToast(res.status === 'approval' && res.approver_name ? `Заявка отправлена на одобрение: ${res.approver_name}` : `Заявка отправлена ${k.to}`);
}

function bubbleHtml(m, i) {
  if (m.role === 'user') {
    return `<div class="msg user"><div class="bubble">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div></div>`;
  }
  const cls = m.role === 'error' ? 'bubble bot error' : 'bubble bot';
  return `
    <div class="msg bot">
      <div class="msg-avatar"><img src="/static/bot-mark-white.svg" alt=""></div>
      <div class="bot-col">
        <div class="${cls}">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>
        ${m.draft ? botDraftHtml(m, i) : ''}
      </div>
    </div>`;
}

function paintChat() {
  const log = document.getElementById('chatLog');
  const btn = document.getElementById('askBtn');
  if (btn) btn.disabled = ai.loading;
  if (!log) return;

  if (!ai.messages.length && !ai.loading) {
    log.innerHTML = chatEmptyHtml();
    return;
  }

  let html = ai.messages.map(bubbleHtml).join('');
  if (ai.loading) {
    html += `
      <div class="msg bot">
        <div class="msg-avatar"><img src="/static/bot-mark-white.svg" alt=""></div>
        <div class="bubble bot thinking">
          <span class="ask-dots"><i></i><i></i><i></i></span>
          ${ai.slow ? '<span class="thinking-note">Секунду, уже почти готово…</span>' : ''}
        </div>
      </div>`;
  }
  log.innerHTML = html;
  log.scrollTop = log.scrollHeight;
}

function autoGrow(el) {
  if (!el.value) { el.style.height = ''; return; }  // пусто — обычная высота из CSS
  el.style.height = 'auto';
  const h = el.scrollHeight;
  el.style.height = (h > 0 ? Math.min(h, 160) : 44) + 'px';
}

function askKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAsk(); }
}

async function submitAsk() {
  const input = document.getElementById('askInput');
  if (!input || ai.loading) return;
  const question = input.value.trim();
  if (!question) return;

  // история до текущего вопроса — её и отправляем серверу
  // боту отдаём его ответы целиком, вместе со строкой-черновиком (raw): так он помнит, что уже собрал
  const history = ai.messages
    .filter(m => m.role !== 'error')
    .map(m => ({ role: m.role, text: m.raw || m.text }));

  ai.messages.push({ role: 'user', text: question });
  ai.draft = '';
  input.value = '';
  autoGrow(input);
  ai.loading = true;
  ai.slow = false;
  paintChat();
  // если ответ идёт долго — говорим об этом, а не молчим
  const slowTimer = setTimeout(() => { ai.slow = true; paintChat(); }, 8000);
  const ctrl = new AbortController();
  const killTimer = setTimeout(() => ctrl.abort(), 120000);

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history, lang: typeof LANG === 'undefined' ? 'ru' : LANG,   // бот отвечает на языке портала
        forms: botForms() }),                                                                     // и умеет помогать с заявками
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!res.ok) ai.messages.push({ role: 'error', text: data.error || 'Не удалось получить ответ.' });
    else {
      const parsed = botParseAnswer(data.answer || '');
      ai.messages.push({ role: 'bot', text: parsed.text || 'Пустой ответ. Попробуйте переформулировать вопрос.', raw: data.answer,
        draft: parsed.draft, draftFailed: parsed.failed });
    }
  } catch (e) {
    ai.messages.push({ role: 'error', text: e.name === 'AbortError'
      ? 'Сервис ИИ не ответил за две минуты. Попробуйте ещё раз чуть позже.'
      : 'Сервер недоступен. Проверьте, что портал запущен.' });
  }

  clearTimeout(slowTimer);
  clearTimeout(killTimer);
  ai.loading = false;
  ai.slow = false;
  paintChat();
  const el = document.getElementById('askInput');
  if (el) el.focus();
}

function toggleFaq(id) {
  const el = document.getElementById(`faq-${id}`);
  if (el) el.classList.toggle('open');
}
function openFaqForm() {
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>Новый вопрос</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Вопрос</label><input id="fQ" type="text"></div>
        <div class="field"><label>Ответ</label><textarea id="fA"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitFaq()">Добавить</button>
      </div>
    </div>`);
}
async function submitFaq() {
  const question = document.getElementById('fQ').value.trim();
  const answer = document.getElementById('fA').value.trim();
  if (!question || !answer) { showToast('Заполните вопрос и ответ'); return; }
  const item = await fetchJson('/api/faq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer }),
  });
  closeModal();
  if (item) { state.faq.push(item); showToast('Вопрос добавлен'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

// =========================================================
// SUGGESTIONS
// =========================================================
// =========================================================
// ПОСЕЩАЕМОСТЬ — табель как в таблице HR: строки — сотрудники, столбцы — дни месяца.
// Пустая ячейка = обычный рабочий день. Сотрудник отмечает только себя, HR и админ — всех.
// =========================================================
const ATT_CLASS = { 'З': 'work', 'У': 'remote', 'Б': 'sick', 'К': 'trip', 'Т': 'vac', 'БС': 'unpaid', 'Л': 'pers' };
const att = { month: null, data: null, filter: '' };

// Вкладки «Рабочий табель» / «Английский язык» — вторая есть у участников английского, HR и админа (24.09.2026)
function hasEnglishTab() { return isStaff() || !!(state.user && state.user.english); }
function attTabsHtml() {
  if (!hasEnglishTab()) return '';
  const t = state.attTab === 'english' ? 'english' : 'work';
  return `<div class="dep-chips">
    <button class="dep-chip${t === 'work' ? ' active' : ''}" onclick="state.attTab='work';render()">Рабочий табель</button>
    <button class="dep-chip${t === 'english' ? ' active' : ''}" onclick="state.attTab='english';render()">Английский язык</button>
  </div>`;
}

async function renderAttendance(main) {
  if (state.attTab === 'english' && hasEnglishTab()) return renderEnglish(main);
  if (!att.month) att.month = astanaNow().toISOString().slice(0, 7);
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  const d = await fetchJson('/api/attendance?month=' + att.month);
  if (!d) { main.innerHTML = '<div class="empty"><strong>Не удалось загрузить табель</strong></div>'; return; }
  att.data = d;
  drawAttendance(main);
}
function drawAttendance(main) {
  const d = att.data;
  const [y, m] = att.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const iso = day => `${att.month}-${String(day).padStart(2, '0')}`;
  const isWeekend = day => [0, 6].includes(new Date(y, m - 1, day).getDay());
  const canEdit = day => d.staff || (iso(day) >= d.can_edit_from && iso(day) <= d.can_edit_to);
  const emps = d.employees.filter(e => !att.filter || e.name.toLowerCase().includes(att.filter) || (e.department || '').toLowerCase().includes(att.filter));

  const legend = d.codes.map(([c, t]) => `<span class="att-legend-item"><b class="att-code ${ATT_CLASS[c] || ''}">${c}</b>${escapeHtml(t)}</span>`).join('');
  const head = Array.from({ length: days }, (_, i) => i + 1).map(day =>
    `<th class="${isWeekend(day) ? 'we' : ''} ${iso(day) === d.today ? 'today' : ''}"><span>${day}</span><small>${['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(y, m - 1, day).getDay()]}</small></th>`).join('');
  const rows = emps.map(e => {
    const marks = d.marks[e.id] || {};
    const cells = Array.from({ length: days }, (_, i) => i + 1).map(day => {
      const mk = marks[iso(day)];
      const editable = canEdit(day);
      return `<td class="${isWeekend(day) ? 'we' : ''} ${iso(day) === d.today ? 'today' : ''} ${editable ? 'can' : ''}"
        ${editable ? `onclick="openAttCell('${e.id}','${iso(day)}')"` : ''} ${mk && mk.comment ? `title="${escapeHtml(mk.comment)}"` : ''}>
        ${mk ? `<b class="att-code ${ATT_CLASS[mk.code] || ''}">${mk.code}</b>${mk.comment ? '<i class="att-dot"></i>' : ''}` : ''}</td>`;
    }).join('');
    const count = Object.keys(marks).length;
    return `<tr><th class="att-name"><div>${escapeHtml(e.name)}</div><small>${escapeHtml(e.position || e.department || '')}${e.schedule ? ' · ' + escapeHtml(e.schedule) : ''}</small></th>${cells}<td class="att-sum">${count || ''}</td></tr>`;
  }).join('');

  main.innerHTML = `
    ${d.embedded ? '' : `<div class="section-head">
      <div><div class="section-title">Посещаемость</div>
        </div>
      ${d.staff ? `<button class="btn secondary" onclick="exportAttendance()">Скачать CSV</button>` : ''}
    </div>
    ${attTabsHtml()}`}
    <div class="att-legend">${legend}</div>
    <div class="att-bar">
      <div class="att-nav">
        <button class="icon-btn" onclick="attShift(-1)" title="Предыдущий месяц">‹</button>
        <b>${monthName[0].toUpperCase() + monthName.slice(1)}</b>
        <button class="icon-btn" onclick="attShift(1)" title="Следующий месяц">›</button>
        ${att.month !== d.today.slice(0, 7) ? `<button class="btn text accent" onclick="att.month=null;render()">Сегодня</button>` : ''}
      </div>
      ${(d.staff || d.embedded) ? `<input class="att-filter" placeholder="Поиск по имени или отделу" value="${escapeHtml(att.filter)}" oninput="att.filter=this.value.trim().toLowerCase();renderAttendanceRows()">` : ''}
    </div>
    ${!d.employees.length ? (d.embedded ? `<div class="empty"><strong>В команде пока никого</strong></div>`
                                        : `<div class="empty"><strong>Вас нет в справочнике сотрудников</strong></div>`) : `
    <div class="att-wrap"><table class="att-table" id="attTable">
      <thead><tr><th class="att-name">Сотрудник</th>${head}<th class="att-sum">Σ</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="99" class="att-empty">Никого не нашлось</td></tr>'}</tbody>
    </table></div>
    ${d.readonly ? ``
      : (!d.staff ? `` : '')}`}`;
  attScrollToday(main);
}
// Табель шире экрана: на телефоне он открывался на первых числах месяца. Прокручиваем так, чтобы сегодняшний день
// (и пара дней до него) был виден сразу; колонка с фамилиями закреплена, поэтому отступаем на её ширину.
function attScrollToday(root) {
  const wrap = root && root.querySelector('.att-wrap'), th = wrap && wrap.querySelector('thead th.today');
  if (!wrap || !th || wrap.scrollWidth <= wrap.clientWidth) return;
  const name = wrap.querySelector('thead th.att-name');
  wrap.scrollLeft = Math.max(0, th.offsetLeft - (name ? name.offsetWidth : 0) - th.offsetWidth * 2);
}
// =========================================================
// АНГЛИЙСКИЙ — посещение занятий с носителем языка (24.09.2026).
// Сотрудник отмечает себя «был / не был» по прошедшим дням занятий, HR видит таблицу всех участников.
// =========================================================
const eng = { month: null, data: null };
const WD_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const WD_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
function engWd(iso) { return (new Date(iso + 'T00:00:00').getDay() + 6) % 7; }   // 0 = пн

async function renderEnglish(main) {
  if (!eng.month) eng.month = astanaNow().toISOString().slice(0, 7);
  main.innerHTML = '<div class="loading">Загрузка…</div>';
  const d = await fetchJson('/api/english?month=' + eng.month);
  if (!d) { main.innerHTML = '<div class="empty"><strong>Не удалось загрузить</strong></div>'; return; }
  eng.data = d;
  const [y, m] = eng.month.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const past = d.days.filter(x => x <= d.today);
  const mark = (id, day) => (d.marks[id] || {})[day];
  const pill = mk => mk ? `<span class="eng-pill ${mk.status}">${mk.status === 'yes' ? 'Был' : 'Не был'}</span>` : '';

  let body;
  if (!d.employees.length) {
    body = d.staff ? `<div class="empty"><strong>Участников пока нет</strong></div>`
                   : `<div class="empty"><strong>Вы не записаны на английский</strong></div>`;
  } else if (d.staff) {
    const head = d.days.map(day => `<th class="${day === d.today ? 'today' : ''}"><span>${Number(day.slice(8))}</span><small>${WD_SHORT[engWd(day)]}</small></th>`).join('');
    const rows = d.employees.map(e => {
      const cells = d.days.map(day => {
        const mk = mark(e.id, day);
        return `<td class="can ${day === d.today ? 'today' : ''}" onclick="openEngCell('${e.id}','${day}')" ${mk && mk.comment ? `title="${escapeHtml(mk.comment)}"` : ''}>
          ${mk ? `<b class="eng-mark ${mk.status}">${mk.status === 'yes' ? '✓' : '✕'}</b>` : (day <= d.today ? '<i class="eng-miss">·</i>' : '')}</td>`;
      }).join('');
      const yes = past.filter(day => (mark(e.id, day) || {}).status === 'yes').length;
      return `<tr><th class="att-name"><div>${escapeHtml(e.name)}</div><small>${escapeHtml(e.position || e.department || '')}</small></th>${cells}
        <td class="att-sum eng-sum">${yes}/${past.length}</td></tr>`;
    }).join('');
    body = `
      <div class="att-legend">
        <span class="att-legend-item"><b class="eng-mark yes">✓</b>был</span>
        <span class="att-legend-item"><b class="eng-mark no">✕</b>не был</span>
        <span class="att-legend-item"><i class="eng-miss">·</i>не отмечено</span>
        <span class="att-legend-item">Дни занятий: ${d.weekdays.map(i => WD_FULL[i]).join(', ')}</span>
      </div>
      <div class="att-wrap"><table class="att-table eng-table">
        <thead><tr><th class="att-name">Участник</th>${head}<th class="att-sum">Был</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  } else {
    const me = d.employees[0];
    const yes = past.filter(day => (mark(me.id, day) || {}).status === 'yes').length;
    body = `
      <div class="eng-summary">В этом месяце: <b>${yes} из ${past.length}</b> прошедших занятий · дни занятий: ${d.weekdays.map(i => WD_FULL[i]).join(', ')}</div>
      <div class="eng-list">${d.days.map(day => {
        const mk = mark(me.id, day);
        const t = new Date(day + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
        const can = day <= d.today && day >= d.can_edit_from;
        return `<div class="eng-row${day === d.today ? ' today' : ''}">
          <div class="eng-date">${t[0].toUpperCase() + t.slice(1)}${mk && mk.comment ? `<small>${escapeHtml(mk.comment)}</small>` : ''}</div>
          <div class="eng-actions">
            ${day > d.today ? '<span class="eng-future">впереди</span>'
              : can ? `<button class="btn ${mk && mk.status === 'yes' ? '' : 'secondary'}" onclick="setEnglish('${me.id}','${day}','yes')">Был</button>
                       <button class="btn ${mk && mk.status === 'no' ? '' : 'secondary'}" onclick="openEngCell('${me.id}','${day}')">Не был</button>`
              : (pill(mk) || '<span class="eng-future">не отмечено</span>')}
          </div>
        </div>`;
      }).join('') || '<div class="widget-empty">В этом месяце занятий нет</div>'}</div>`;
  }

  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Посещаемость</div></div>
      ${d.staff ? `<div style="display:flex;gap:8px">
        <button class="btn secondary" onclick="openEnglishDays()">Дни занятий</button>
        <button class="btn secondary" onclick="exportEnglish()">Скачать CSV</button></div>` : ''}
    </div>
    ${attTabsHtml()}
    <div class="att-bar">
      <div class="att-nav">
        <button class="icon-btn" onclick="engShift(-1)" title="Предыдущий месяц">‹</button>
        <b>${monthName[0].toUpperCase() + monthName.slice(1)}</b>
        <button class="icon-btn" onclick="engShift(1)" title="Следующий месяц">›</button>
        ${eng.month !== d.today.slice(0, 7) ? `<button class="btn text accent" onclick="eng.month=null;render()">Сегодня</button>` : ''}
      </div>
    </div>
    ${body}`;
}
function engShift(delta) {
  const [y, m] = eng.month.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  eng.month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  render();
}
async function setEnglish(empId, day, status, comment = '') {
  const r = await fetch('/api/english', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: empId, date: day, status, comment }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(res.error || 'Не удалось сохранить');
  closeModal(); render();
}
function openEngCell(empId, day) {
  const d = eng.data; const e = d.employees.find(x => x.id === empId); if (!e) return;
  const mk = (d.marks[empId] || {})[day] || {};
  const t = new Date(day + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  openModal(`<div class="modal att-modal">
    <div class="modal-head"><h3>${escapeHtml(e.name)}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="modal-text" style="margin:0">Английский · ${t}</div>
      <div class="field"><label>Причина, если не был (необязательно)</label><input id="engComment" type="text" value="${escapeHtml(mk.comment || '')}"></div>
    </div>
    <div class="modal-foot">
      ${mk.status ? `<button class="btn text" onclick="setEnglish('${empId}','${day}','')">Снять отметку</button>` : ''}
      ${d.staff ? `<button class="btn secondary" onclick="setEnglish('${empId}','${day}','yes')">Был</button>` : ''}
      <button class="btn" onclick="setEnglish('${empId}','${day}','no',document.getElementById('engComment').value)">Не был</button>
    </div>
  </div>`);
}
function openEnglishDays() {
  const d = eng.data;
  openModal(`<div class="modal">
    <div class="modal-head"><h3>Дни занятий английским</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body"><div class="eng-days">${WD_FULL.map((n, i) => `
      <label class="radio-pill"><input type="checkbox" value="${i}" ${d.weekdays.includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
    <div class="modal-foot"><button class="btn secondary" onclick="closeModal()">Отмена</button><button class="btn" onclick="saveEnglishDays()">Сохранить</button></div>
  </div>`);
}
async function saveEnglishDays() {
  const days = [...document.querySelectorAll('.eng-days input:checked')].map(i => Number(i.value));
  const r = await fetch('/api/hr/english-days', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) return showToast(res.error || 'Не удалось сохранить');
  closeModal(); render(); showToast('Дни занятий сохранены');
}
function exportEnglish() {
  const d = eng.data;
  const lines = [['ФИО', 'Должность', ...d.days, 'Был'].map(v => `"${v}"`).join(';')];
  for (const e of d.employees) {
    const m = d.marks[e.id] || {};
    const yes = d.days.filter(day => (m[day] || {}).status === 'yes').length;
    lines.push([e.name, e.position, ...d.days.map(day => m[day] ? (m[day].status === 'yes' ? 'был' : 'не был' + (m[day].comment ? ' — ' + m[day].comment : '')) : ''), yes]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';'));
  }
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Английский ${d.month}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function renderAttendanceRows() {
  const inp = document.querySelector('.att-filter');
  const pos = inp ? inp.selectionStart : 0;
  drawAttendance(document.getElementById('mgrAtt') || document.getElementById('main'));
  const i = document.querySelector('.att-filter'); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
}
function attShift(delta) {
  const [y, m] = att.month.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  att.month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  render();
}
function openAttCell(empId, day) {
  const d = att.data;
  const e = d.employees.find(x => x.id === empId); if (!e) return;
  const mk = (d.marks[empId] || {})[day] || { code: '', comment: '' };
  const title = new Date(day + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  openModal(`<div class="modal att-modal">
    <div class="modal-head"><h3>${escapeHtml(e.name)}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
    <div class="modal-text" style="margin:0">${title[0].toUpperCase() + title.slice(1)}</div>
    <div class="att-pick" id="attPick">
      ${d.codes.map(([c, t]) => `
        <label class="att-opt ${mk.code === c ? 'on' : ''}"><input type="radio" name="attCode" value="${c}" ${mk.code === c ? 'checked' : ''} onchange="document.querySelectorAll('.att-opt').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked))">
          <b class="att-code ${ATT_CLASS[c] || ''}">${c}</b><span>${escapeHtml(t)}</span></label>`).join('')}
    </div>
    <div class="field"><label>Комментарий (необязательно)</label><input id="attComment" maxlength="300" value="${escapeHtml(mk.comment)}"></div>
    <div class="modal-foot">
      ${mk.code ? `<button class="btn text" onclick="saveAttCell('${empId}','${day}','')">Снять отметку</button>` : ''}
      <span style="flex:1"></span>
      <button class="btn secondary" onclick="closeModal()">Отмена</button>
      <button class="btn" onclick="saveAttCell('${empId}','${day}')">Сохранить</button>
    </div></div></div>`);
}
async function saveAttCell(empId, day, forceCode) {
  const code = forceCode !== undefined ? forceCode : (document.querySelector('input[name=attCode]:checked') || {}).value || '';
  if (!code && forceCode === undefined) { showToast('Выберите обозначение или снимите отметку'); return; }
  const comment = code ? (document.getElementById('attComment') || {}).value || '' : '';
  const r = await fetch('/api/attendance', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: empId, date: day, code, comment }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { showToast(j.error || 'Не удалось сохранить'); return; }
  closeModal();
  showToast(code ? 'Отметка сохранена' : 'Отметка снята');
  render();
}
function exportAttendance() {
  const d = att.data; if (!d) return;
  const [y, m] = att.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const iso = day => `${att.month}-${String(day).padStart(2, '0')}`;
  const lines = [['Сотрудник', 'Должность', 'График', ...Array.from({ length: days }, (_, i) => i + 1)].join(';')];
  for (const e of d.employees) {
    const marks = d.marks[e.id] || {};
    lines.push([e.name, e.position, e.schedule, ...Array.from({ length: days }, (_, i) => (marks[iso(i + 1)] || {}).code || '')].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';'));
  }
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Посещаемость ${att.month}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function renderSuggestions(main) {
  const mine = (state.suggestions || []).filter(s => s.user_id === state.user.id);
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Предложения</div></div>
    </div>
    <div class="sug-form">
      <label class="sug-label" for="fSugText">Ваше предложение</label>
      <textarea id="fSugText"></textarea>
      <div class="sug-form-foot">
        <label class="login-remember"><input type="checkbox" id="fSugAnon"><span>Отправить анонимно — имя не сохранится нигде, даже в базе</span></label>
        <button class="btn" id="sugSubmit" onclick="submitSuggestion()">Отправить в HR</button>
      </div>
    </div>
    <div class="req-list-title">Мои обращения
      ${isStaff() ? `<a class="req-hr-link" href="#" onclick="openHr('suggestions');return false;">Обращения всех сотрудников — в HR-панели →</a>` : ''}
    </div>
    ${mine.length ? mine.map(s => `
      <div class="suggestion-card">
        <div class="suggestion-text">${escapeHtml(s.text)}</div>
        <div class="suggestion-meta">${fmtDate(s.date)} · ${s.status === 'seen' ? 'прочитано HR' : 'ещё не прочитано'}</div>
      </div>`).join('')
    : `<div class="empty"><strong>Вы пока ничего не отправляли</strong></div>`}`;
}

async function submitSuggestion() {
  const text = document.getElementById('fSugText').value.trim();
  const anonymous = document.getElementById('fSugAnon').checked;
  if (!text) { showToast('Напишите текст обращения'); return; }
  const btn = document.getElementById('sugSubmit'); btn.disabled = true;
  const item = await fetchJson('/api/suggestions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, anonymous }),
  });
  if (!item) { btn.disabled = false; return showToast('Не удалось отправить'); }
  if (!anonymous || isStaff()) state.suggestions.unshift(item);
  updateRequestsBadge();
  showToast(anonymous ? 'Отправлено анонимно. Спасибо!' : 'Отправлено в HR. Спасибо!');
  render();
}

// =========================================================
// ROADMAP (onboarding for new employees)
// =========================================================
// «С кем стоит познакомиться в первую очередь»: сотрудник видит только CEO и главу своего подразделения
// (решение пользователя 24.09.2026: новенький Бауыржан видит Мухтара и Михаила Кима). Всех видит только админ — он ведёт список.
function visibleLeaders() {
  const all = (state.leaders || []).slice();
  if (isAdmin()) return all;
  const norm = s => (s || '').trim().toLowerCase();
  const emps = state.employees || [];
  const me = emps.find(e => e.id === (state.user || {}).emp_id);
  const ceo = emps.find(e => e.department === 'Руководство' && Number(e.is_head));
  const head = me && me.department !== 'Руководство' ? emps.find(e => e.department === me.department && Number(e.is_head)) : null;
  const want = new Set([ceo, head].filter(e => e && e !== me).map(e => norm(e.name)));   // себя самого не показываем
  return all.filter(l => want.has(norm(l.name)));
}

function renderRoadmap(main) {
  const a = state.about || { title: '', body: '' };
  let leaders = visibleLeaders();
  const steps = state.onboarding.slice();
  if (state.search) {
    leaders = leaders.filter(l => l.name.toLowerCase().includes(state.search) || (l.position || '').toLowerCase().includes(state.search));
  }

  let html = `
    <div class="section-head">
      <div><div class="section-title">Новым сотрудникам</div></div>
      <button class="btn secondary" onclick="openAboutForm()">Редактировать текст</button>
    </div>
    ${welcomeVideoHtml()}
    <div class="news-feature" style="margin-bottom:32px;">
      <div class="news-title">${escapeHtml(a.title || 'О компании')}</div>
      <div class="news-body" style="max-width:none;">${a.body ? escapeHtml(a.body) : `<span style="color:var(--ink-soft)">${isAdmin() ? 'Расскажите новому сотруднику, чем занимается компания. Нажмите «Редактировать текст».' : 'Описание компании скоро появится.'}</span>`}</div>
    </div>

    <div class="faq-link" onclick="openFaq()" role="button">
      <div class="faq-link-left">
        <div class="faq-link-mark">?</div>
        <div>
          <div class="faq-link-title">Частые вопросы</div>
          <div class="faq-link-sub">Отпуск, больничный, зарплата, пропуск, IT — ${state.faq.length} ${pluralRu(state.faq.length, 'ответ', 'ответа', 'ответов')} на самые частые вопросы</div>
        </div>
      </div>
      <button class="btn" onclick="event.stopPropagation();openFaq()">Открыть</button>
    </div>

    <div class="section-head">
      <div><div class="section-title" style="font-size:20px;">Первые шаги</div></div>
      <button class="btn" onclick="openStepForm()">Добавить шаг</button>
    </div>`;

  if (!steps.length) {
    html += `<div class="empty" style="margin-bottom:32px;"><strong>Чек-лист пуст</strong></div>`;
  } else {
    html += `<div class="onboard-list" style="margin-bottom:32px;">` + steps.map((s, i) => `
      <div class="onboard-step">
        <div class="onboard-num">${i + 1}</div>
        <div style="flex:1;">
          <div class="onboard-title">${escapeHtml(s.title)}</div>
          ${s.description ? `<div class="onboard-desc">${linkify(s.description)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn text" onclick="openStepForm('${s.id}')">Изменить</button>
          <button class="btn text" onclick="deleteItem('onboarding','${s.id}')">Удалить</button>
        </div>
      </div>`).join('') + `</div>`;
  }

  if (!leaders.length && !isAdmin()) { main.innerHTML = html; return; }   // знакомиться не с кем (например, сам CEO) — блок не показываем
  html += `
    <div class="section-head">
      <div><div class="section-title" style="font-size:20px;">С кем стоит познакомиться в первую очередь</div></div>
      <button class="btn" onclick="openLeaderForm()">Добавить руководителя</button>
    </div>`;

  if (!leaders.length) {
    html += `<div class="empty"><strong>Пока никого не добавили</strong></div>`;
    main.innerHTML = html;
    return;
  }

  html += `<div class="people-grid">` + leaders.map(l => `
    <div class="person-card clickable leader-card" onclick="openLeaderCard('${l.id}')" role="button">
      ${l.photo ? `<img class="person-photo" src="${escapeHtml(l.photo)}" alt="">`
                 : `<div class="person-photo-fallback">${initials(l.name)}</div>`}
      <div class="person-name">${escapeHtml(l.name)}</div>
      <div class="person-role">${escapeHtml(l.position || '')}</div>
      ${l.bio ? `<div class="person-extra">${escapeHtml(l.bio)}</div>` : ''}
      ${l.story ? `<div class="leader-more">Читать →</div>` : ''}
      <div class="card-actions">
        <button class="btn text" onclick="event.stopPropagation();openLeaderForm('${l.id}')">Изменить</button>
        <button class="btn text" onclick="event.stopPropagation();deleteItem('leaders','${l.id}')">Удалить</button>
      </div>
    </div>`).join('') + `</div>`;
  main.innerHTML = html;
}

function openStepForm(id) {
  const s = id ? (state.onboarding || []).find(x => x.id === id) : null;
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${s ? 'Изменить шаг' : 'Новый шаг'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Название шага</label><input id="fStepTitle" type="text" value="${s ? escapeHtml(s.title) : ''}"></div>
        <div class="field"><label>Пояснение (необязательно)</label><textarea id="fStepDesc">${s ? escapeHtml(s.description || '') : ''}</textarea>
          </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitStep(${s ? `'${s.id}'` : ''})">${s ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </div>`);
}
async function submitStep(id) {
  const title = document.getElementById('fStepTitle').value.trim();
  const description = document.getElementById('fStepDesc').value.trim();
  if (!title) { showToast('Укажите название шага'); return; }
  const item = await fetchJson(id ? `/api/onboarding/${id}` : '/api/onboarding', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
  closeModal();
  if (!item) { showToast('Не удалось сохранить'); render(); return; }
  if (id) {
    const i = state.onboarding.findIndex(x => x.id === id);
    if (i >= 0) state.onboarding[i] = item;
    showToast('Шаг обновлён');
  } else {
    state.onboarding.push(item); showToast('Шаг добавлен');
  }
  render();
}

// ---------- «Миссия и ценности» (07.10.2026) ----------
// Три блока из таблицы about (mission / vision / values), правят админ и HR. Ценности хранятся строками «Название — текст».
function renderValues(main) {
  if (!state.values) {
    main.innerHTML = '<div class="empty"><strong>Загрузка…</strong></div>';
    fetchJson('/api/values').then(v => { state.values = v || {}; if (state.view === 'values') render(); });
    return;
  }
  const v = state.values;
  const paras = t => String(t || '').split(/\n\s*\n/).map(p => {
    const lines = p.split('\n');
    if (lines.every(l => l.trim().startsWith('•'))) return `<ul class="val-list">${lines.map(l => `<li>${escapeHtml(l.replace(/^\s*•\s*/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
  }).join('');
  const cards = String(v.values || '').split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
    const m = l.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    const title = m ? m[1] : l, text = m ? m[2] : '';
    return `<div class="val-card"><div class="val-num">${String(i + 1).padStart(2, '0')}</div><div class="val-title">${escapeHtml(title)}</div>${text ? `<div class="val-text">${escapeHtml(text)}</div>` : ''}</div>`;
  }).join('');
  const edit = key => `<button class="btn text" onclick="openValuesForm('${key}')">Редактировать</button>`;
  main.innerHTML = `
    <div class="section-head">
      <div><div class="section-title">Миссия и ценности</div></div>
    </div>
    <div class="val-block">
      <div class="val-head"><div class="val-mark">${ico('star')}</div><h3>Миссия</h3>${edit('mission')}</div>
      <div class="val-body">${paras(v.mission)}</div>
    </div>
    <div class="val-block">
      <div class="val-head"><div class="val-mark">${ico('globe')}</div><h3>Видение</h3>${edit('vision')}</div>
      <div class="val-body">${paras(v.vision)}</div>
    </div>
    <div class="val-block">
      <div class="val-head"><div class="val-mark">${ico('heart')}</div><h3>Ценности</h3>${edit('values')}</div>
      <div class="val-grid">${cards}</div>
    </div>`;
}

function openValuesForm(key) {
  const titles = { mission: 'Миссия', vision: 'Видение', values: 'Ценности' };
  const v = (state.values || {})[key] || '';
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${titles[key] || ''}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>${key === 'values' ? 'Ценности — по одной на строку: «Название — что это значит»' : 'Текст'}</label><textarea id="fValuesBody" style="min-height:260px;">${escapeHtml(v)}</textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitValues(${jsArg(key)})">Сохранить</button>
      </div>
    </div>`);
}
async function submitValues(key) {
  const body = document.getElementById('fValuesBody').value.trim();
  const res = await fetchJson('/api/values/' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
  closeModal();
  if (res) { state.values = res; showToast('Сохранено'); } else { showToast('Не удалось сохранить'); }
  render();
}

function openAboutForm() {
  const a = state.about || { title: '', body: '' };
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>О компании</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Заголовок</label><input id="fAboutTitle" type="text" value="${escapeHtml(a.title)}"></div>
        <div class="field"><label>Текст</label><textarea id="fAboutBody" style="min-height:180px;">${escapeHtml(a.body)}</textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitAbout()">Сохранить</button>
      </div>
    </div>`);
}
async function submitAbout() {
  const title = document.getElementById('fAboutTitle').value.trim();
  const body = document.getElementById('fAboutBody').value.trim();
  const res = await fetchJson('/api/about', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  closeModal();
  if (res) { state.about = res; showToast('Сохранено'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

// карточка руководителя: фото, должность и рассказ от первого лица
function openLeaderCard(id) {
  const l = (state.leaders || []).find(x => x.id === id);
  if (!l) return;
  const text = l.story || l.bio || '';
  openModal(`
    <div class="modal leader-modal">
      <div class="modal-head"><h3>Знакомство</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="leader-head">
          ${l.photo ? `<img class="leader-photo" src="${escapeHtml(l.photo)}" alt="">` : `<div class="leader-photo leader-initials">${initials(l.name)}</div>`}
          <div>
            <div class="leader-name">${escapeHtml(l.name)}</div>
            <div class="leader-pos">${escapeHtml(l.position || '')}</div>
            ${l.email ? `<a class="person-email" href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a>` : ''}
          </div>
        </div>
        <div class="leader-story">${text.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('')}</div>
      </div>
    </div>`);
}

function openLeaderForm(id) {
  const l = id ? (state.leaders || []).find(x => x.id === id) : null;
  const v = k => escapeHtml((l && l[k]) || '');
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${l ? 'Руководитель' : 'Новый руководитель'}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="field"><label>Имя и фамилия</label><input id="fLName" type="text" value="${v('name')}"></div>
        <div class="field"><label>Должность</label><input id="fLRole" type="text" value="${v('position')}"></div>
        <div class="field"><label>Коротко о человеке (необязательно)</label><textarea id="fLBio">${v('bio')}</textarea></div>
        <div class="field"><label>Рассказ от первого лица (необязательно)</label><textarea id="fLStory" style="min-height:180px">${v('story')}</textarea></div>
        <div class="field"><label>Email (необязательно)</label><input id="fLEmail" type="text" value="${v('email')}"></div>
        <div class="field">
          <label>Фото (необязательно)</label>
          <input id="fLPhoto" type="file" accept="image/*" onchange="previewImage(this,'leaderPreview')">
          <img id="leaderPreview" class="preview-thumb" style="display:none;">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" onclick="closeModal()">Отмена</button>
        <button class="btn" onclick="submitLeader(${l ? `'${l.id}'` : ''})">${l ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </div>`);
}
async function submitLeader(id) {
  const name = document.getElementById('fLName').value.trim();
  const position = document.getElementById('fLRole').value.trim();
  const bio = document.getElementById('fLBio').value.trim();
  const story = document.getElementById('fLStory').value.trim();
  const email = document.getElementById('fLEmail').value.trim();
  const photoInput = document.getElementById('fLPhoto');
  if (!name) { showToast('Укажите имя'); return; }

  const old = id ? (state.leaders || []).find(x => x.id === id) : null;
  let photo = old ? (old.photo || '') : '';
  if (photoInput.files[0]) {
    photo = await uploadFile(photoInput) || photo;
  }

  const item = await fetchJson(id ? `/api/leaders/${id}` : '/api/leaders', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, position, bio, story, email, photo }),
  });
  closeModal();
  if (item && id) { state.leaders = state.leaders.map(x => x.id === id ? item : x); showToast('Сохранено'); render(); return; }
  if (item) { state.leaders.push(item); showToast('Руководитель добавлен'); }
  else { showToast('Не удалось сохранить'); }
  render();
}

// =========================================================
// generic delete + modal
// =========================================================
// ---------- окно «Вы точно хотите удалить?» ----------
// Возвращает Promise<boolean>. Открывается поверх любых других окон; Esc и клик мимо — отмена.
// Фокус стоит на «Отмена», чтобы случайный Enter ничего не удалил.
function confirmDialog({ title = 'Удалить?', text = '', okText = 'Удалить' } = {}) {
  return new Promise(resolve => {
    document.getElementById('confirmOverlay')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'overlay confirm-overlay';
    wrap.id = 'confirmOverlay';
    wrap.innerHTML = `
      <div class="modal confirm-modal" role="alertdialog" aria-modal="true">
        <div class="confirm-icon">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </div>
        <div class="confirm-title">${escapeHtml(title)}</div>
        ${text ? `<div class="confirm-text">${text}</div>` : ''}
        <div class="confirm-actions">
          <button class="btn secondary" id="confirmNo">Отмена</button>
          <button class="btn danger" id="confirmYes">${escapeHtml(okText)}</button>
        </div>
      </div>`;
    const done = (answer) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); resolve(answer); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    wrap.querySelector('#confirmNo').onclick = () => done(false);
    wrap.querySelector('#confirmYes').onclick = () => done(true);
    wrap.querySelector('#confirmNo').focus();
  });
}

// что именно удаляем — чтобы в окне было написано по-человечески
const DELETE_LABELS = {
  news: ['новость', 'Новость и все комментарии к ней будут удалены.'],
  employees: ['сотрудника', 'Карточка сотрудника исчезнет из справочника и структуры компании.'],
  events: ['событие', 'Событие пропадёт из календаря.'],
  faq: ['вопрос', 'Вопрос и ответ пропадут из раздела «Частые вопросы», бот перестанет на него опираться.'],
  documents: ['файл', 'Файл будет удалён с портала. Если нужна новая версия — загрузите её заново.'],
  gallery: ['ивент', 'Ивент будет удалён вместе со всеми его фотографиями.'],
  partners: ['партнёра', ''],
  honors: ['запись с доски почёта', ''],
  projects: ['проект', ''],
  suggestions: ['предложение', ''],
  documents: ['документ', ''],
  leaders: ['руководителя', ''],
  onboarding: ['шаг', ''],
  comments: ['комментарий', ''],
};

async function deleteItem(kind, id) {
  const item = (state[kind] || []).find(x => x.id === id) || {};
  const name = item.title || item.name || item.person_name || item.question || (item.text || '').slice(0, 60);
  const [label, note] = DELETE_LABELS[kind] || ['запись', ''];
  const ok = await confirmDialog({
    title: `Удалить ${label}?`,
    text: (name ? `<b>«${escapeHtml(name)}»</b><br>` : '') + (note ? escapeHtml(note) + ' ' : '') + 'Отменить это будет нельзя.',
  });
  if (!ok) return;
  const result = await fetchJson(`/api/${kind}/${id}`, { method: 'DELETE' });
  if (result) {
    state[kind] = state[kind].filter(x => x.id !== id);
    showToast('Удалено');
  } else {
    showToast('Не удалось удалить');
  }
  render();
}

function openModal(html) {
  closeModal();                                   // одно окно за раз
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'modalOverlay';
  wrap.innerHTML = html;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
  // Esc закрывает окно — но только если оно сверху: у фото на весь экран и у вопроса «удалить?» свой Esc
  wrap._onKey = (e) => {
    if (e.key !== 'Escape') return;
    const top = [...document.body.children].reverse().find(el => el.id === 'modalOverlay' || /overlay/.test(el.className));
    if (top === wrap) { e.preventDefault(); closeModal(); }
  };
  document.addEventListener('keydown', wrap._onKey);
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');      // страница под окном не крутится колесиком (09.10.2026, просьба пользователя)
}
function closeModal() {
  const el = document.getElementById('modalOverlay');
  if (!el) return;
  if (el._onKey) document.removeEventListener('keydown', el._onKey);
  el.remove();
  document.body.classList.remove('modal-open');
}


// =========================================================
// ПРАВА В ИНТЕРФЕЙСЕ: кнопки, которыми человек не может воспользоваться, ему не показываем.
// Сервер и так откажет (403) — но видеть кнопку и получать отказ неприятно.
// Правило одно на весь сайт: смотрим, что вызывает кнопка, и решаем по роли.
// =========================================================
const UI_RULES = [
  // [что в обработчике, кому можно]
  [/openNewsForm\(|togglePin\(|deleteItem\('news'|removeNewsPhoto\(/, () => canEditNews()],
  [/openGalleryForm\(|addGalleryPhotos\(|deleteGalleryPhoto\(|setGalleryCover\(|deleteItem\('gallery'/, () => canEditNews()],
  [/openPersonForm\(|deleteItem\('employees'/, () => isStaff()],
  [/openOfficePlanForm\(|saveOfficePlan\(|toggleOfficeEdit\(|addRoomTag\(|removeRoomTag\(|openZoneForm\(|saveZone\(|removeZone\(/, () => isAdmin()],   // схемы офиса меняет только админ
  [/openWelcomeVideoForm\(|deleteWelcomeVideo\(/, () => isStaff()],
  [/openBookForm\(|saveBook\(|removeBook\(/, () => isStaff()],   // «Изменить» в карточке книги — тоже только HR и админ
  [/openEnglishDays\(|exportEnglish\(/, () => isStaff()],
  [/exportCompensation\(/, () => seesAccountant()],
  [/openVacancyForm\(|saveVacancy\(|deleteVacancy\(|setVacancyStatus\(/, () => isStaff()],   // вакансии ведут HR и админ   // дни занятий и выгрузка английского — HR и админ   // книгу месяца ставят HR и админ
  [/deleteItem\('suggestions'/, () => isStaff()],
  [/openEventForm\(|deleteItem\('events'/, () => isStaff()],   // календарь ведут HR и админ
  [/openValuesForm\(/, () => isStaff()],   // миссия и ценности правят HR и админ (07.10.2026)
  [/clearProfile\(|openHrFill\(/, () => isStaff()],     // очистить чужой профиль «О себе», заполнить карточку из карточки — HR и админ (07.10.2026)
  [/coworkDecide\(|coworkLink\(|openCwMaterialForm\(|cwToggleUser\(|cwOpenAccountForm\(|cwDeleteAccount\(|cwOpenProjectForm\(/, () => isAdmin()],   // приёмка заданий Connected WorkFlow — только админ (08.10.2026)
  [/openPresentationForm\(|deleteItem\('documents'/, () => isStaff()],   // презентации и буклеты — HR и админ
  [/openProjectForm\(|openPartnerForm\(|openHonorForm\(|openFaqForm\(|openStepForm\(|submitStep\(|openLeaderForm\(|openAboutForm\(|openDocForm\(|deleteItem\('/, () => isAdmin()],
];
function applyUiPermissions(root) {
  if (!state.user || !root.querySelectorAll) return;
  const nodes = [...root.querySelectorAll('[onclick],[onchange]')];
  if (root.matches && root.matches('[onclick],[onchange]')) nodes.push(root);
  for (const el of nodes) {
    const code = (el.getAttribute('onclick') || '') + ' ' + (el.getAttribute('onchange') || '');
    const rule = UI_RULES.find(([re]) => re.test(code));
    if (!rule || rule[1]()) continue;
    // поле выбора файла обычно завёрнуто в подпись-кнопку — убираем её целиком
    const wrap = el.tagName === 'INPUT' ? (el.closest('label') || el) : el;
    // не кнопка, а часть содержимого (ячейка календаря, карточка) — оставляем на месте, снимаем только действие
    if (wrap.classList.contains('cal-cell')) {
      el.removeAttribute('onclick'); el.removeAttribute('title');
      el.style.cursor = 'default';
      continue;
    }
    const parent = wrap.parentElement;
    wrap.remove();
    if (parent && parent.classList.contains('card-actions') && !parent.children.length) parent.remove();
  }
}
// следим за всем, что появляется на странице: разделы, окна, виджеты
new MutationObserver(muts => {
  for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) applyUiPermissions(n);
}).observe(document.body, { childList: true, subtree: true });


// =========================================================
// ЖИВОЕ ОБНОВЛЕНИЕ: заявки и обращения подтягиваются сами, без F5.
// Раз в 45 секунд и при возвращении на вкладку. Перерисовываем только там, где это безопасно:
// счётчики и правая колонка — всегда; сам раздел — только панели и список заявок, и только если
// человек не заполняет форму и не открыл окно (иначе сотрём то, что он набирает).
// =========================================================
function liveSignature(reqs, sugg) {
  return JSON.stringify([(reqs || []).map(r => [r.id, r.status, r.updated]), (sugg || []).map(s => [s.id, s.status])]);
}
async function refreshLive() {
  if (!state.user || document.hidden || state._liveBusy) return;
  state._liveBusy = true;
  try {
    const [reqs, sugg, ann, tasks] = await Promise.all([fetchJson('/api/requests'), fetchJson('/api/suggestions'), fetchJson('/api/announcement'), fetchJson('/api/tasks')]);
    if (!reqs || !sugg || !state.user) return;
    if (tasks && JSON.stringify(tasks) !== JSON.stringify(state.tasks || null)) {   // задачник (25.09.2026)
      state.tasks = tasks; updateRequestsBadge(); renderSideWidgets();
      if (state.view === 'tasks' && !document.getElementById('modalOverlay') && !document.getElementById('confirmOverlay')) drawTasks(document.getElementById('main'));
    }
    if (ann && JSON.stringify(ann) !== JSON.stringify(state.announcement || {})) {
      state.announcement = ann;
      if (state.view === 'home' || (state.view === 'hr' && !document.getElementById('modalOverlay'))) render();
    }
    const sig = liveSignature(reqs, sugg);
    if (sig === state._liveSig) return;                     // ничего не изменилось
    const hadNew = (state.requests || []).filter(r => r.status === 'new').length + (state.suggestions || []).filter(s => s.status === 'new').length;
    state._liveSig = sig; state.requests = reqs; state.suggestions = sugg;
    updateRequestsBadge();
    renderSideWidgets();
    const safeView = ['hr', 'buyer', 'accountant'].includes(state.view) || (state.view === 'admin' && state.adminTab === 'support') || (state.view === 'requests' && !state.reqForm);
    const windowOpen = document.getElementById('modalOverlay') || document.getElementById('confirmOverlay');
    if (safeView && !windowOpen) render();
    const nowNew = reqs.filter(r => r.status === 'new').length + sugg.filter(s => s.status === 'new').length;
    if (nowNew > hadNew && (isStaff() || isBuyer() || isAccountant())) showToast('Пришла новая заявка или обращение');
  } finally { state._liveBusy = false; }
}
setInterval(refreshLive, 45000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshLive(); });

// ---------- init ----------
(async function init() {
  // Пришли по ссылке-приглашению — сначала задаём пароль.
  const inviteToken = new URLSearchParams(location.search).get('invite');
  if (inviteToken) return showInvite(inviteToken);
  // Кто вошёл? Если сессии нет — показываем экран входа и данные не грузим.
  try {
    const r = await fetch('/api/me');
    if (r.ok) state.user = await r.json();
  } catch (_) { /* нет связи — покажем экран входа */ }
  if (!state.user) { showLogin(); return; }
  await loadAll();
  applyHash();            // открываем тот раздел, что в адресе: после F5 человек остаётся на месте
  state._urlReplace = true;
  render();
})();
