// Обход всех разделов и вкладок портала в браузере (еженедельная проверка, см. docs/weekly-check.md).
// Вставь целиком в инструмент выполнения JavaScript на открытой странице портала под админом.
// Работает частями, чтобы уложиться в лимит времени одного вызова: await pagesCheck(0), потом await pagesCheck(1) …
// пока не вернёт done: true. Результат — только проблемные места; пустой список = всё в порядке.
window.__pgErrs = window.__pgErrs || [];
if (!window.__pgHooked) {
  window.__pgHooked = true;
  window.addEventListener('error', e => window.__pgErrs.push(String(e.message)));
  const oe = console.error; console.error = (...a) => { window.__pgErrs.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
}
// Пока панель браузера свёрнута, кадры не рисуются и CSS-анимации «замирают» на первом шаге: боковая панель на телефоне
// остаётся шириной 232px, а содержимое будто вылезает за край (ложная тревога 29.09 и 05.10.2026). Поэтому анимации выключаем.
if (!document.getElementById('pgNoAnim')) {
  const st = document.createElement('style'); st.id = 'pgNoAnim';
  st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.appendChild(st);
}
window.pagesCheck = async function (part) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // что вылезает за правый край экрана и не лежит в блоке с собственной прокруткой (таблица табеля, строка меню — лежат)
  const clipped = (root) => {
    const W = document.documentElement.clientWidth;
    return [...root.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0 && r.right > W + 2) || getComputedStyle(el).position === 'fixed') return false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return false;
      }
      return true;
    }).slice(0, 3).map(el => (String(el.className).trim().split(' ')[0] || el.tagName.toLowerCase()) + ' +' + Math.round(el.getBoundingClientRect().right - W) + 'px');
  };
  const views = [...new Set(['home', ...[...document.querySelectorAll('[data-view]')].map(e => e.dataset.view)])];
  const tabs = [
    ...['support', 'late', 'cabinets', 'users', 'status', 'services', 'agents', 'audit', 'backups'].map(t => ['admin', 'adminTab', t]),
    ...(typeof HR_TABS !== 'undefined' ? HR_TABS : []).map(t => ['hr', 'hrTab', t]),
    ...(typeof MGR_TABS !== 'undefined' ? MGR_TABS : []).map(t => ['manager', 'mgrTab', t]),
    ['attendance', 'attTab', 'english'], ['tasks', 'taskTab', 'given'], ['templates', 'tplTab', 'tech'],
  ];
  const all = [...views.map(v => [v, null, null]), ...tabs];
  const SIZE = 22, slice = all.slice(part * SIZE, (part + 1) * SIZE), bad = {};
  for (const [v, key, val] of slice) {
    window.__pgErrs.length = 0;
    if (v === 'home') goHome(); else { state.view = v; if (key) state[key] = val; render(); }
    // ждём, пока раздел догрузит данные («Загрузка…» исчезнет), но не дольше 8 секунд, и ещё чуть-чуть на отрисовку
    for (let t = 0; t < 8000 && document.getElementById('main').innerText.includes('Загрузка…'); t += 150) await sleep(150);
    await sleep(window.__pgDelay || 1300);
    const main = document.getElementById('main'), t = main.innerText;
    window.scrollTo(0, 0); window.scrollTo(4000, 0); const hscroll = window.scrollX; window.scrollTo(0, 0);
    const r = {};
    const junk = t.match(/undefined|NaN|\[object Object\]/g); if (junk) r.junk = [...new Set(junk)];
    if (hscroll > 0) r.hscroll = hscroll;                                   // страница прокручивается вбок
    const out = clipped(document.querySelector('.app') || document.body);    // у страницы overflow-x:hidden — лишнее просто обрезается, прокрутки не будет
    if (out.length) r.clipped = out;
    if (t.trim().length < 20 || /^\s*Загрузка…\s*$/.test(t)) r.empty = t.trim().slice(0, 40);
    const img = [...main.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.getAttribute('src').split('/').pop());
    if (img.length) r.brokenImages = [...new Set(img)].slice(0, 5);
    if (window.__pgErrs.length) r.errors = [...new Set(window.__pgErrs)].slice(0, 3);
    if (document.querySelector('.maint-overlay')) r.maintenance = true;
    if (Object.keys(r).length) bad[v + (val ? '/' + val : '')] = r;
  }
  return { part, checked: slice.length, total: all.length, done: (part + 1) * SIZE >= all.length, width: window.innerWidth, bad };
};
// Выпадающие меню вкладок («Сотрудники», «Компания», «Медиа»): открываются ли и не обрезаны ли. 05.10.2026 на ноутбуках
// меню открывалось, но строка вкладок его обрезала — «Все сотрудники», «Партнёры» и «Видео» были недоступны.
// Возвращает список проблем; пустой — всё в порядке. Запускать на каждой ширине: await menusCheck()
window.menusCheck = async function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms)), bad = [];
  for (const item of document.querySelectorAll('.nav-item.has-menu')) {
    const name = item.querySelector('span').innerText.trim(), menu = item.querySelector('.nav-menu');
    placeNavMenu(item); item.classList.add('open'); await sleep(150);
    for (const mi of menu.querySelectorAll('.nav-menu-item')) {
      const r = mi.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!(r.width > 0 && r.height > 0)) bad.push(`${name} → ${mi.innerText.trim()}: пункт не показан`);
      else if (!(top === mi || mi.contains(top))) bad.push(`${name} → ${mi.innerText.trim()}: пункт чем-то закрыт или обрезан`);
      else if (r.right > window.innerWidth || r.left < 0) bad.push(`${name} → ${mi.innerText.trim()}: вылезает за край экрана`);
    }
    item.classList.remove('open'); menu.style.display = '';
  }
  const side = document.querySelector('.sidenav'), head = document.querySelector('.masthead');
  if (side && getComputedStyle(side).position === 'fixed' && Math.abs(side.getBoundingClientRect().top - head.getBoundingClientRect().bottom) > 2)
    bad.push('боковая панель стоит не под шапкой: ' + Math.round(side.getBoundingClientRect().top) + ' вместо ' + Math.round(head.getBoundingClientRect().bottom));
  return bad;
};
'pagesCheck готов: await pagesCheck(0), потом await menusCheck()'
