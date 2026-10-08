// =========================================================
// СМЕНА ЯЗЫКА ПОРТАЛА (24.09.2026): RU / EN / KZ / 中文.
// Интерфейс переводит словарь I18N ниже (быстро и без запросов), всё остальное — новости, должности, тексты HR —
// один раз переводит /api/translate (тот же AI, что у Connect AI) и хранит в базе на весь портал.
// Имена людей и названия проектов не переводятся. Страница рисуется по-русски, после отрисовки текст подменяется:
// так перевод работает во всех разделах сразу и не требует правок в каждом шаблоне.
// =========================================================
const LANGS = [['ru', 'RU', 'Русский'], ['en', 'EN', 'English'], ['kk', 'KZ', 'Қазақша'], ['zh', '中文', '中文']];
const LOCALES = { ru: 'ru-RU', en: 'en-GB', kk: 'kk-KZ', zh: 'zh-CN' };
const TR_IDX = { en: 0, kk: 1, zh: 2 };
let LANG = (() => { try { return localStorage.getItem('portal_lang') || 'ru'; } catch (_) { return 'ru'; } })();
if (!LOCALES[LANG]) LANG = 'ru';

// Словарь интерфейса: 'русский текст': [English, Қазақша, 中文]
const I18N = {
  // праздники в календаре и кнопка подачи (07.10.2026)
  'Праздник': ['Holiday', 'Мереке', '节日'],
  'Отправить заявку': ['Submit request', 'Өтінім жіберу', '提交申请'],
  'Государственный праздник Республики Казахстан. Выходной день.': ['Public holiday of the Republic of Kazakhstan. Day off.', 'Қазақстан Республикасының мемлекеттік мерекесі. Демалыс күні.', '哈萨克斯坦共和国法定节日。休息日。'],
  'Перенесённый выходной день': ['Transferred day off', 'Ауыстырылған демалыс күні', '调休日'],
  // верхнее меню и шапка
  'Новости': ['News', 'Жаңалықтар', '新闻'],
  'Сотрудники': ['Employees', 'Қызметкерлер', '员工'],
  'Все сотрудники': ['All employees', 'Барлық қызметкерлер', '全体员工'],
  'Компания': ['Company', 'Компания', '公司'],
  'Проекты': ['Projects', 'Жобалар', '项目'],
  'Наши партнёры': ['Our partners', 'Біздің серіктестер', '合作伙伴'],
  'Новым сотрудникам': ['For newcomers', 'Жаңа қызметкерлерге', '新员工指南'],
  'Программа лояльности': ['Loyalty program', 'Лоялдылық бағдарламасы', '员工福利计划'],
  'Миссия и ценности': ['Mission and values', 'Миссия мен құндылықтар', '使命与价值观'],
  // Connected Cowork (08.10.2026)
  'Новое задание': ['New task', 'Жаңа тапсырма', '新任务'],
  'Приёмщик заданий': ['Task intake', 'Тапсырма қабылдаушы', '任务受理'],
  'Отправить в работу': ['Send to work', 'Жұмысқа жіберу', '提交执行'],
  'Ждёт приёмки': ['Awaiting approval', 'Қабылдауды күтуде', '等待验收'],
  'В очереди': ['Queued', 'Кезекте', '排队中'],
  'Принято': ['Accepted', 'Қабылданды', '已接受'],
  'Отклонено': ['Rejected', 'Қабылданбады', '已拒绝'],
  'Отменено': ['Cancelled', 'Болдырылмады', '已取消'],
  'Доступ к Connected Cowork': ['Access to Connected Cowork', 'Connected Cowork қолжетімділігі', 'Connected Cowork 访问权限'],
  // профиль «О себе» (07.10.2026)
  'О себе': ['About me', 'Өзім туралы', '关于我'],
  'Образование': ['Education', 'Білімі', '教育'],
  'Хобби и интересы': ['Hobbies and interests', 'Хобби мен қызығушылықтар', '爱好与兴趣'],
  'Чем могу помочь': ['How I can help', 'Немен көмектесе аламын', '我能帮什么'],
  'Языки': ['Languages', 'Тілдер', '语言'],
  'Родной город': ['Hometown', 'Туған қала', '家乡'],
  'В компании с': ['With the company since', 'Компанияда жұмыс істейді', '入职时间'],
  'Любимая книга': ['Favourite book', 'Сүйікті кітап', '最喜欢的书'],
  'Любимый фильм': ['Favourite film', 'Сүйікті фильм', '最喜欢的电影'],
  'Любимая музыка': ['Favourite music', 'Сүйікті музыка', '最喜欢的音乐'],
  'Заполнить профиль': ['Fill in profile', 'Профильді толтыру', '填写资料'],
  'Изменить профиль': ['Edit profile', 'Профильді өзгерту', '编辑资料'],
  'Показывать профиль коллегам': ['Show my profile to colleagues', 'Профильді әріптестерге көрсету', '向同事显示我的资料'],
  'Очистить профиль': ['Clear profile', 'Профильді тазалау', '清除资料'],
  'скрыт от коллег': ['hidden from colleagues', 'әріптестерден жасырылған', '对同事隐藏'],
  'Вуз': ['University', 'ЖОО', '大学'],
  'Специальность': ['Major', 'Мамандық', '专业'],
  'Год выпуска': ['Graduation year', 'Бітірген жылы', '毕业年份'],
  'Миссия': ['Mission', 'Миссия', '使命'],
  'Видение': ['Vision', 'Көзқарас', '愿景'],
  'Ценности': ['Values', 'Құндылықтар', '价值观'],
  'Вакансии': ['Vacancies', 'Бос орындар', '职位空缺'],
  'Медиа': ['Media', 'Медиа', '媒体'],
  'Прошедшие ивенты': ['Past events', 'Өткен іс-шаралар', '往期活动'],
  'Видео': ['Video', 'Бейне', '视频'],
  'База знаний': ['Knowledge base', 'Білім қоры', '知识库'],
  'Поиск по порталу (Ctrl+K)': ['Search the portal (Ctrl+K)', 'Портал бойынша іздеу (Ctrl+K)', '搜索门户 (Ctrl+K)'],
  'Личный кабинет': ['My profile', 'Жеке кабинет', '个人中心'],
  'Настройки': ['Settings', 'Баптаулар', '设置'],
  'Тёмная тема': ['Dark theme', 'Қараңғы тақырып', '深色主题'],
  'Светлая тема': ['Light theme', 'Ашық тақырып', '浅色主题'],
  'Выйти из аккаунта': ['Log out', 'Шығу', '退出登录'],
  'На главную': ['Home', 'Басты бетке', '返回首页'],
  'Язык портала': ['Portal language', 'Портал тілі', '门户语言'],
  // левое меню
  'Инструменты': ['Tools', 'Құралдар', '工具'],
  'Календарь': ['Calendar', 'Күнтізбе', '日历'],
  'Заявки': ['Requests', 'Өтінімдер', '申请'],
  'Шаблоны документов': ['Document templates', 'Құжат үлгілері', '文件模板'],
  'Посещаемость': ['Attendance', 'Қатысу', '考勤'],
  'Мой отпуск': ['My vacation', 'Менің демалысым', '我的休假'],
  'Карта офиса': ['Office map', 'Кеңсе картасы', '办公室地图'],
  'Кабинет руководителя': ['Manager dashboard', 'Басшы кабинеті', '管理者面板'],
  'Предложения': ['Suggestions', 'Ұсыныстар', '建议'],
  'Мини-игры': ['Mini games', 'Шағын ойындар', '小游戏'],
  'Отдел кадров': ['HR', 'Кадр бөлімі', '人力资源'],
  'HR-панель': ['HR panel', 'HR панелі', 'HR 面板'],
  'Закупки': ['Procurement', 'Сатып алу', '采购'],
  'Панель закупщика': ['Procurement panel', 'Сатып алушы панелі', '采购面板'],
  'Администрирование': ['Administration', 'Әкімшілік', '系统管理'],
  'Админ-панель': ['Admin panel', 'Әкімші панелі', '管理面板'],
  'Свернуть / развернуть панель': ['Collapse / expand panel', 'Панельді жию / ашу', '收起 / 展开面板'],
  // правая колонка
  'Ближайшие события': ['Upcoming events', 'Жақын оқиғалар', '近期活动'],
  'К рассмотрению': ['For review', 'Қарауға', '待处理'],
  'Мои заявки': ['My requests', 'Менің өтінімдерім', '我的申请'],
  'Книга месяца от CEO': ["CEO's book of the month", 'CEO ұсынған айдың кітабы', 'CEO 本月推荐书'],
  'Подать заявку →': ['Submit a request →', 'Өтінім беру →', '提交申请 →'],
  'Активных заявок нет': ['No active requests', 'Белсенді өтінімдер жоқ', '暂无进行中的申请'],
  'В ближайшие две недели событий нет': ['No events in the next two weeks', 'Алдағы екі аптада оқиғалар жоқ', '未来两周没有活动'],
  'день рождения': ['birthday', 'туған күн', '生日'],
  'сегодня': ['today', 'бүгін', '今天'],
  'завтра': ['tomorrow', 'ертең', '明天'],
  'есть ответ': ['reply received', 'жауап бар', '已回复'],
  // общие кнопки и подписи
  'Загрузка…': ['Loading…', 'Жүктелуде…', '加载中…'],
  'Отмена': ['Cancel', 'Болдырмау', '取消'],
  'Удалить': ['Delete', 'Жою', '删除'],
  'Сохранить': ['Save', 'Сақтау', '保存'],
  'Изменить': ['Edit', 'Өзгерту', '编辑'],
  'Добавить': ['Add', 'Қосу', '添加'],
  'Закрыть': ['Close', 'Жабу', '关闭'],
  'Открыть': ['Open', 'Ашу', '打开'],
  'Скачать': ['Download', 'Жүктеп алу', '下载'],
  'Загрузить': ['Upload', 'Жүктеп салу', '上传'],
  'Скачать CSV': ['Download CSV', 'CSV жүктеп алу', '下载 CSV'],
  'Подробнее →': ['Learn more →', 'Толығырақ →', '了解更多 →'],
  'Читать →': ['Read →', 'Оқу →', '阅读 →'],
  'Читать далее ↓': ['Read more ↓', 'Толығырақ оқу ↓', '展开全文 ↓'],
  'Свернуть ↑': ['Show less ↑', 'Жию ↑', '收起 ↑'],
  'Открыть папку →': ['Open folder →', 'Папканы ашу →', '打开文件夹 →'],
  'Дальше →': ['Next →', 'Келесі →', '下一题 →'],
  'Завершить': ['Finish', 'Аяқтау', '完成'],
  'Сегодня': ['Today', 'Бүгін', '今天'],
  'Название': ['Title', 'Атауы', '名称'],
  'Должность': ['Position', 'Лауазымы', '职位'],
  'Подразделение': ['Division', 'Бөлімше', '部门'],
  'Отдел': ['Department', 'Бөлім', '科室'],
  'Офис': ['Office', 'Кеңсе', '办公室'],
  'Телефон': ['Phone', 'Телефон', '电话'],
  'Почта': ['Email', 'Пошта', '邮箱'],
  'Статус': ['Status', 'Мәртебесі', '状态'],
  'Дата': ['Date', 'Күні', '日期'],
  'Файл': ['File', 'Файл', '文件'],
  'Фото': ['Photo', 'Фото', '照片'],
  'Сотрудник': ['Employee', 'Қызметкер', '员工'],
  'Имя и фамилия': ['Full name', 'Аты-жөні', '姓名'],
  'Был': ['Attended', 'Болды', '已出席'],
  'Не был': ['Missed', 'Болмады', '缺席'],
  'впереди': ['upcoming', 'алда', '即将进行'],
  'не отмечено': ['not marked', 'белгіленбеген', '未标记'],
  // заявки и статусы
  'Новая': ['New', 'Жаңа', '新'],
  'В работе': ['In progress', 'Жұмыста', '处理中'],
  'Заказано': ['Ordered', 'Тапсырыс берілді', '已订购'],
  'Оформлена': ['Completed', 'Рәсімделді', '已办理'],
  'Отклонена': ['Rejected', 'Қабылданбады', '已拒绝'],
  'Отменена': ['Cancelled', 'Тоқтатылды', '已取消'],
  'Командировка': ['Business trip', 'Іссапар', '出差'],
  'Техника и оборудование': ['Equipment', 'Техника және жабдық', '设备'],
  'Поддержка IT': ['IT support', 'IT қолдау', 'IT 支持'],
  'Трудовой отпуск': ['Annual leave', 'Еңбек демалысы', '年假'],
  'Отпуск без сохранения': ['Unpaid leave', 'Жалақысыз демалыс', '无薪假'],
  'Подбор персонала': ['Hiring', 'Персонал іріктеу', '招聘'],
  'Увольнение': ['Dismissal', 'Жұмыстан шығу', '离职'],
  'Mentor для новичка': ['Mentor for a newcomer', 'Жаңа қызметкерге Mentor', '新人导师 Mentor'],
  // программа лояльности
  'Привет, команда!': ['Hi, team!', 'Сәлем, команда!', '大家好！'],
  'Годовой бонусный фонд': ['Annual bonus fund', 'Жылдық бонус қоры', '年度奖金'],
  'Дополнительный отпуск': ['Extra leave', 'Қосымша демалыс', '额外假期'],
  'Материальная помощь': ['Financial assistance', 'Материалдық көмек', '经济补助'],
  'Компенсация спортзала': ['Gym compensation', 'Спортзал өтемақысы', '健身补贴'],
  '«Приведи друга»': ['“Refer a friend”', '«Досыңды әкел»', '“推荐朋友”'],
  'Корпоративный английский язык': ['Corporate English', 'Корпоративтік ағылшын тілі', '企业英语'],
  'Корпоративные мероприятия': ['Corporate events', 'Корпоративтік іс-шаралар', '企业活动'],
  'Задачи': ['Tasks', 'Тапсырмалар', '任务'],
  'Поставить задачу': ['Assign a task', 'Тапсырма беру', '分配任务'],
  'Мне поручено': ['Assigned to me', 'Маған тапсырылған', '分配给我的'],
  'Я поручил': ['Assigned by me', 'Мен тапсырғандар', '我分配的'],
  'Новая задача': ['New task', 'Жаңа тапсырма', '新任务'],
  'Задача': ['Task', 'Тапсырма', '任务'],
  'На проверке': ['Under review', 'Тексеруде', '待审核'],
  'Взять в работу': ['Start working', 'Жұмысқа алу', '开始处理'],
  'Сдать на проверку': ['Submit for review', 'Тексеруге тапсыру', '提交审核'],
  'Принять': ['Accept', 'Қабылдау', '验收'],
  'Вернуть на доработку': ['Send back for rework', 'Пысықтауға қайтару', '退回修改'],
  'Вернуть в работу': ['Reopen', 'Жұмысқа қайтару', '重新打开'],
  'Выполненные': ['Completed', 'Орындалғандар', '已完成'],
  'Готово': ['Done', 'Дайын', '已完成'],
  'Все исполнители': ['All assignees', 'Барлық орындаушылар', '全部执行人'],
  'Исполнитель': ['Assignee', 'Орындаушы', '执行人'],
  'Поставил': ['Assigned by', 'Тапсырған', '分配人'],
  'Поставлена': ['Assigned on', 'Берілген күні', '分配日期'],
  'Принята': ['Accepted on', 'Қабылданған күні', '验收日期'],
  'Новые задачи': ['New tasks', 'Жаңа тапсырмалар', '新任务'],
  'Задачи на проверке': ['Tasks to review', 'Тексерудегі тапсырмалар', '待审核任务'],
  'Что нужно сделать': ['What needs to be done', 'Не істеу керек', '需要做什么'],
  'Подробности (необязательно)': ['Details (optional)', 'Толығырақ (міндетті емес)', '详情（可选）'],
  'Срок (необязательно)': ['Deadline (optional)', 'Мерзімі (міндетті емес)', '截止日期（可选）'],
  'Комментарий к сдаче (необязательно)': ['Comment on submission (optional)', 'Тапсыру туралы пікір (міндетті емес)', '提交说明（可选）'],
  'Комментарий исполнителя': ['Assignee comment', 'Орындаушының пікірі', '执行人备注'],
  'Вернули на доработку': ['Sent back for rework', 'Пысықтауға қайтарылды', '已退回修改'],
  'Что доработать': ['What to improve', 'Нені пысықтау керек', '需要修改的内容'],
  'Активных задач нет': ['No active tasks', 'Белсенді тапсырмалар жоқ', '没有进行中的任务'],
  'Активных задач у команды нет': ['The team has no active tasks', 'Команданың белсенді тапсырмалары жоқ', '团队没有进行中的任务'],
  // вакансии и база знаний
  'Предложить кандидата': ['Refer a candidate', 'Үміткерді ұсыну', '推荐候选人'],
  'Рекомендовать друга': ['Refer a friend', 'Досыңды ұсыну', '推荐朋友'],
  'Отправить в HR': ['Send to HR', 'HR-ға жіберу', '发送给 HR'],
  'Добавить вакансию': ['Add vacancy', 'Бос орын қосу', '添加职位'],
  'Добавить файл': ['Add file', 'Файл қосу', '添加文件'],
  'О компании': ['About the company', 'Компания туралы', '关于公司'],
  'Умный дом': ['Smart home', 'Ақылды үй', '智能家居'],
  'Регламенты': ['Regulations', 'Регламенттер', '规章制度'],
  'Инструкции': ['Instructions', 'Нұсқаулықтар', '操作指南'],
  // вход
  'Вход в портал': ['Sign in to the portal', 'Порталға кіру', '登录门户'],
  'Логин или корпоративная почта': ['Login or work email', 'Логин немесе корпоративтік пошта', '用户名或工作邮箱'],
  'Пароль': ['Password', 'Құпиясөз', '密码'],
  'Запомнить меня на этом устройстве': ['Remember me on this device', 'Осы құрылғыда есте сақтау', '在此设备上记住我'],
  'Войти': ['Sign in', 'Кіру', '登录'],
  'Впервые в портале?': ['New to the portal?', 'Порталға алғаш кірдіңіз бе?', '第一次使用门户？'],
  'Первый вход': ['First sign-in', 'Алғашқы кіру', '首次登录'],
  'Забыли пароль?': ['Forgot password?', 'Құпиясөзді ұмыттыңыз ба?', '忘记密码？'],
};

// ---- кэш переводов от сервера: в памяти и в браузере (чтобы не ждать при каждом заходе)
const trCache = {};
function trStore(lang) {
  if (!trCache[lang]) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('portal_tr_' + lang) || '{}'); } catch (_) { /* пусто */ }
    trCache[lang] = new Map(Object.entries(saved));
  }
  return trCache[lang];
}
let trSaveTimer = null;
function trSave() {
  clearTimeout(trSaveTimer);
  trSaveTimer = setTimeout(() => {
    try {
      const m = trStore(LANG);
      const entries = [...m.entries()].slice(-4000);   // держим последние 4000 фраз, чтобы не упереться в лимит браузера
      localStorage.setItem('portal_tr_' + LANG, JSON.stringify(Object.fromEntries(entries)));
    } catch (_) { /* браузер не даёт хранить — переведём заново */ }
  }, 800);
}

const CYR = /[А-Яа-яЁёҚқҒғҮүҰұӘәІіӨөҢңҺһ]/;
const trPending = new Set(), trFailed = new Set();
let trTimer = null, trBusy = false;

function trLookup(core) {
  const row = I18N[core] || (typeof I18N_AUTO !== 'undefined' && I18N_AUTO[core]);   // ручной словарь важнее готового (i18n-auto.js)
  if (row && row[TR_IDX[LANG]]) return row[TR_IDX[LANG]];
  const c = trStore(LANG).get(core);
  return c === undefined ? null : c;
}
// сразу после входа забираем с сервера все готовые переводы языка — чтобы новости, должности и тексты не ждали AI
const trPreloaded = {};
async function trPreload() {
  if (LANG === 'ru' || trPreloaded[LANG] || typeof state === 'undefined' || !state.user) return;
  const lang = LANG; trPreloaded[lang] = true;
  try {
    const r = await fetch('/api/translate?lang=' + lang);
    const d = r.ok ? await r.json() : {};
    const store = trStore(lang);
    for (const [k, v] of Object.entries(d.map || {})) store.set(k, v);
    trSave();
  } catch (_) { trPreloaded[lang] = false; }
  if (lang === LANG) translateTree(document.body);
}
// имена людей и названия проектов не переводим (решение пользователя 24.09.2026)
function trIsName(core) {
  if (typeof state === 'undefined') return false;
  if (!trIsName._set || trIsName._n !== (state.employees || []).length + (state.projects || []).length) {
    trIsName._set = new Set([...(state.employees || []).map(e => e.name), ...(state.projects || []).map(p => p.title),
      ...(state.leaders || []).map(l => l.name)].filter(Boolean).map(s => s.trim()));
    trIsName._n = (state.employees || []).length + (state.projects || []).length;
  }
  return trIsName._set.has(core);
}

const TR_SKIP = 'script,style,textarea,.no-tr,.msg.user';
const TR_ATTRS = ['placeholder', 'title', 'aria-label'];
function trOne(src) {           // текст узла → перевод или null (тогда фраза уходит в очередь)
  const core = src.trim();
  if (!core || !CYR.test(core) || trIsName(core)) return src;
  const t = trLookup(core);
  if (t !== null) return src.replace(core, t);
  if (!trFailed.has(core)) trPending.add(core);
  return null;
}
let trWaitTimer = null;
function trWait(on) {
  const main = document.getElementById('main');
  if (!main) return;
  clearTimeout(trWaitTimer);
  main.classList.toggle('tr-wait', on);
  if (on) trWaitTimer = setTimeout(() => main.classList.remove('tr-wait'), 1500);
}
function translateTree(root) {
  if (!root || !root.nodeType) return;
  if (LANG !== 'ru' && !trPreloaded[LANG]) trPreload();
  const main = document.getElementById('main');
  let waitMain = false;
  const texts = [];
  if (root.nodeType === 3) texts.push(root);
  else {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) texts.push(n);
  }
  for (const n of texts) {
    const p = n.parentElement;
    if (!p || p.closest(TR_SKIP)) continue;
    if (n.__ru === undefined) {
      if (!CYR.test(n.nodeValue)) continue;
      n.__ru = n.nodeValue;
    }
    if (LANG === 'ru') { if (n.nodeValue !== n.__ru) n.nodeValue = n.__ru; continue; }
    const t = trOne(n.__ru);
    if (t !== null && n.nodeValue !== t) n.nodeValue = t;
    else if (t === null && main && main.contains(n)) waitMain = true;
  }
  if (root.nodeType === 1) {
    const els = root.matches && root.matches('[placeholder],[title],[aria-label]') ? [root] : [];
    els.push(...root.querySelectorAll('[placeholder],[title],[aria-label]'));
    for (const el of els) {
      if (el.closest(TR_SKIP)) continue;
      el.__ruAttr = el.__ruAttr || {};
      for (const a of TR_ATTRS) {
        const v = el.getAttribute(a);
        if (v == null) continue;
        if (el.__ruAttr[a] === undefined) { if (!CYR.test(v)) continue; el.__ruAttr[a] = v; }
        const src = el.__ruAttr[a];
        const t = LANG === 'ru' ? src : trOne(src);
        if (t !== null && v !== t) el.setAttribute(a, t);
      }
    }
  }
  if (LANG !== 'ru' && trPending.size) { trSchedule(); if (waitMain) trWait(true); }
}
function trSchedule() {
  clearTimeout(trTimer);
  trTimer = setTimeout(trFlush, 250);
}
async function trFlush() {
  if (trBusy || LANG === 'ru' || !trPending.size) return;
  if (typeof state === 'undefined' || !state.user) return;          // переводчик на сервере — только для вошедших
  trBusy = true;
  const lang = LANG, batch = [...trPending].slice(0, 80);
  batch.forEach(s => trPending.delete(s));
  try {
    const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, texts: batch }) });
    const d = r.ok ? await r.json() : {};
    const map = d.map || {};
    const store = trStore(lang);
    for (const s of batch) {
      if (map[s] !== undefined) store.set(s, map[s]); else trFailed.add(s);
    }
    trSave();
  } catch (_) { batch.forEach(s => trFailed.add(s)); }
  trBusy = false;
  if (lang === LANG) translateTree(document.body);
  if (!trPending.size) trWait(false);
  if (trPending.size) trSchedule();
}

// даты — на выбранном языке («24 сент.» → «24 Sep»)
['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'].forEach(fn => {
  const orig = Date.prototype[fn];
  Date.prototype[fn] = function (loc, opts) {
    const useLoc = LANG !== 'ru' && (!loc || String(loc).startsWith('ru')) ? LOCALES[LANG] : loc;
    return orig.call(this, useLoc, opts);
  };
});

// переключатель в шапке
function langSwitchHtml() {
  const cur = LANGS.find(l => l[0] === LANG) || LANGS[0];
  return `<button class="lang-btn" onclick="toggleLangMenu(event)" title="Язык портала" aria-label="Язык портала">${cur[1]}<i class="nav-caret">▾</i></button>
    <div class="lang-menu">${LANGS.map(l => `<button class="lang-opt${l[0] === LANG ? ' active' : ''}" onclick="setLang('${l[0]}')"><b>${l[1]}</b><span>${l[2]}</span></button>`).join('')}</div>`;
}
function paintLangSwitch() {
  document.querySelectorAll('.lang-switch').forEach(el => { el.innerHTML = langSwitchHtml(); el.classList.remove('open'); });
}
function toggleLangMenu(e) {
  e.stopPropagation();
  const w = e.currentTarget.closest('.lang-switch');
  w.classList.toggle('open');
}
document.addEventListener('click', () => document.querySelectorAll('.lang-switch.open').forEach(el => el.classList.remove('open')));
function setLang(l) {
  if (!LOCALES[l]) return;
  LANG = l;
  try { localStorage.setItem('portal_lang', l); } catch (_) { /* без памяти — только на эту вкладку */ }
  document.documentElement.lang = l === 'kk' ? 'kk' : l;
  trFailed.clear();
  paintLangSwitch();
  trPreload();
  if (typeof render === 'function' && typeof state !== 'undefined' && state.user) render();
  translateTree(document.body);
}

// следим за всем, что появляется на странице: разделы, окна, всплывающие подсказки
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = LANG;
  paintLangSwitch();
  translateTree(document.body);
  new MutationObserver(muts => {
    if (LANG === 'ru') return;
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 || n.nodeType === 3) translateTree(n.nodeType === 3 ? n : n);
    }
  }).observe(document.body, { childList: true, subtree: true });
});
