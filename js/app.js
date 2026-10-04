/* global LOZA_ADMIN_API */
(function () {
  const API = window.LOZA_ADMIN_API;
  const app = document.getElementById('app');

  const state = {
    user: null,
    tab: 'overview',
    summary: null,
    users: [],
    payments: [],
    feedPosts: [],
    movies: [],
    selectedPostId: '',
    selectedMovieId: '',
    chatRooms: [],
    selectedRoomId: '',
    userQuery: '',
    userFilter: 'members',
    userSort: 'recent',
    userLimit: 40,
    cleanup: { loading: false, busy: false, data: null, picked: [], cancelStale: true },
    paymentQuery: '',
    library: [],
    librarySections: [],
    contentFilter: 'all',
    contentQuery: '',
    contentForm: { editId: '', sectionSlug: 'podcasts', title: '', summary: '', body: '', mediaUrl: '', type: 'VIDEO', coverUrl: '', audioFileName: '' },
    announce: { body: '', pin: true },
    post: { title: '', body: '', imageUrl: '', videoUrl: '', preview: '', fileName: '' },
    stockImages: [
      'https://lozapsy.help/assets/webp/background01.webp',
      'https://lozapsy.help/assets/webp/background02.webp',
      'https://lozapsy.help/assets/webp/background03.webp',
      'https://lozapsy.help/assets/webp/background04.webp',
      'https://lozapsy.help/assets/webp/background05.webp',
      'https://lozapsy.help/assets/webp/background06.webp',
      'https://lozapsy.help/assets/webp/background07.webp',
      'https://lozapsy.help/assets/webp/background08.webp',
      'https://lozapsy.help/assets/webp/background09.webp',
      'https://lozapsy.help/assets/webp/background10.webp',
    ],
    uploading: false,
    live: { ok: null, checkedAt: '' },
    status: { post: '', chat: '', user: '', movie: '', announce: '', content: '', error: '', password: '' },
  };

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU');
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU');
  }

  function roleLabel(role) {
    if (role === 'OWNER') return 'Владелец';
    if (role === 'ADMIN') return 'Админ';
    if (role === 'CURATOR') return 'Куратор';
    if (role === 'GUEST') return 'Гость';
    return 'Участник';
  }

  function roleChoices(entry) {
    const me = state.user;
    if (!me || entry.id === me.id || entry.role === 'OWNER') return [];
    if (me.role === 'OWNER') return ['MEMBER', 'CURATOR', 'ADMIN'];
    if (me.role === 'ADMIN' && entry.role !== 'ADMIN') return ['MEMBER', 'CURATOR'];
    return [];
  }

  function snapshotPostForm() {
    const title = document.getElementById('post-title');
    const body = document.getElementById('post-body');
    const url = document.getElementById('post-image-url');
    if (title) state.post.title = title.value;
    if (body) state.post.body = body.value;
    if (url && url.value.trim()) state.post.imageUrl = url.value.trim();
  }

  function stockImagePicker(selectedUrl, caption = 'Или выбрать готовую картинку') {
    return `<div class="stock-image-block">
      <p class="muted">${esc(caption)}</p>
      <div class="stock-image-grid">
        ${state.stockImages.map((url) => `
          <button type="button" class="stock-image-btn${selectedUrl === url ? ' is-active' : ''}" data-stock-image="${esc(url)}" aria-label="Выбрать картинку">
            <span class="stock-image-frame"><img src="${esc(url)}" alt="" /></span>
          </button>`).join('')}
      </div>
    </div>`;
  }

  function payLabel(status) {
    if (status === 'active') return { text: 'Оплачено', cls: 'is-active' };
    if (status === 'expired') return { text: 'Истекла', cls: 'is-expired' };
    if (status === 'pending') return { text: 'Ожидает оплату', cls: 'is-pending' };
    if (status === 'failed') return { text: 'Ошибка оплаты', cls: 'is-failed' };
    if (status === 'paid_no_sub') return { text: 'Оплата есть', cls: 'is-active' };
    return { text: 'Нет оплаты', cls: 'is-none' };
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function standaloneHint() {
    if (isStandalone()) return '';
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const text = ios
      ? 'Чтобы поставить на телефон: Поделиться → На экран «Домой»'
      : 'Можно установить как приложение — в меню браузера «Установить»';
    return `<p class="install-hint">${text}</p>`;
  }

  function liveChip() {
    if (state.live.ok === true) return '<span class="live-chip"><i></i>Timeweb онлайн</span>';
    if (state.live.ok === false) return '<span class="live-chip is-down"><i></i>Сервер недоступен</span>';
    return '<span class="live-chip"><i></i>Проверяем сервер…</span>';
  }

  async function pingLive() {
    try {
      await API.health();
      state.live = { ok: true, checkedAt: new Date().toISOString() };
    } catch {
      state.live = { ok: false, checkedAt: new Date().toISOString() };
    }
  }

  function renderLogin() {
    app.innerHTML = `<div class="admin-login">
      <form class="admin-card" id="login-form">
        <img class="login-logo" src="assets/logo.png" alt="Loza Admin" />
        <h1>Loza Admin</h1>
        <p class="muted">Панель команды</p>
        ${standaloneHint()}
        <div style="text-align:center;margin:8px 0 4px">${liveChip()}</div>
        <div class="admin-form">
          <label>Пароль<input id="login-password" type="password" autocomplete="current-password" autofocus /></label>
          <p class="error" id="login-error" hidden></p>
          <button type="submit" id="login-submit">Войти</button>
        </div>
      </form>
    </div>`;

    const loginErrors = {
      TOO_MANY_ATTEMPTS: 'Слишком много попыток. Подождите 15 минут и попробуйте снова.',
      PASSWORD_CHANGE_REQUIRED: 'Пароль задаётся на сервере: добавьте переменную ADMIN_PASSWORD и перезапустите сервис.',
      USER_BLOCKED: 'Этот аккаунт заблокирован.',
    };

    document.getElementById('login-form').onsubmit = async (event) => {
      event.preventDefault();
      const error = document.getElementById('login-error');
      const submit = document.getElementById('login-submit');
      error.hidden = true;
      const password = document.getElementById('login-password').value;
      if (!password) {
        error.hidden = false;
        error.textContent = 'Введите пароль.';
        return;
      }
      submit.disabled = true;
      submit.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>Входим…';
      try {
        const payload = await API.login('admin@loza.app', password);
        if (!['OWNER', 'ADMIN'].includes(payload.user?.role)) {
          API.clearToken();
          throw new Error('FORBIDDEN');
        }
        state.user = payload.user;
        await loadDashboard();
        render();
      } catch (loginError) {
        const code = loginError instanceof Error ? loginError.message : '';
        submit.disabled = false;
        submit.textContent = 'Войти';
        error.hidden = false;
        error.textContent = loginErrors[code] || 'Неверный пароль или нет прав администратора';
      }
    };
  }

  function renderTabs() {
    const tabs = [
      { id: 'overview', label: 'Обзор' },
      { id: 'announce', label: 'Анонсы' },
      { id: 'posts', label: 'Посты' },
      { id: 'content', label: 'Медиатека' },
      { id: 'users', label: 'Люди' },
      { id: 'payments', label: 'Оплаты' },
      { id: 'chats', label: 'Чаты' },
    ];
    return `<nav class="admin-tabs" aria-label="Разделы">
      ${tabs.map((tab) => `
        <button type="button" class="admin-tab${state.tab === tab.id ? ' is-active' : ''}" data-tab="${tab.id}">
          <span>${tab.label}</span>
        </button>`).join('')}
    </nav>`;
  }

  function renderStats() {
    const s = state.summary || {};
    const cards = {
      overview: [
        [s.users, 'Участники'],
        [s.paidUsers, 'С доступом'],
        [s.newUsersWeek, 'Новые за неделю'],
        [s.messagesWeek, 'Сообщений за неделю'],
      ],
      announce: [[s.rooms, 'Чаты'], [s.paidUsers, 'С доступом']],
      posts: [[s.posts, 'Посты'], [s.users, 'Участники']],
      users: [[s.users, 'Участники'], [s.paidUsers, 'С доступом'], [s.waitingClub, 'Ждут открытия клуба']],
      payments: [[s.paidUsers, 'С доступом'], [s.pendingPayments, 'Начали оплату за 2 дня']],
      chats: [[s.rooms, 'Чаты'], [s.messagesWeek, 'Сообщений / 7дн']],
      content: [[s.content, 'Материалы'], [s.movies, 'Киноклуб']],
    }[state.tab] || [[s.users, 'Пользователи'], [s.paidUsers, 'С доступом']];

    return `<section class="admin-stats admin-stats-compact">
      ${cards.map(([value, label]) => `<article><strong>${value ?? '—'}</strong><span>${label}</span></article>`).join('')}
    </section>`;
  }

  function renderOverview() {
    const ops = state.summary?.ops || {};
    const ai = ops.ai || {};
    const plans = ops.plans || [];
    return `<section class="admin-card tab-panel">
      <h2>Сервер Timeweb</h2>
      <p class="muted">Админка уже пишет и читает живой API клуба. После деплоя backend новые кнопки (доступ, блок, Лента) заработают сразу.</p>
      <div class="ops-grid">
        <article class="ops-card">
          <strong>${state.live.ok ? 'API отвечает' : 'API не отвечает'}</strong>
          <span>${esc(API.API_URL)}<br />${ops.time ? `сверка ${fmtDateTime(ops.time)}` : 'ждём ответ summary'}</span>
        </article>
        <article class="ops-card">
          <strong>${ops.prodamusReady ? 'Продамус готов' : 'Продамус не подключен'}</strong>
          <span>${ops.prodamusReady ? 'Оплата картой через Продамус' : 'Нужны домен и ключ Продамуса на Timeweb'}</span>
        </article>
        <article class="ops-card">
          <strong>AI ${ai.deepseek || ai.gemini ? 'подключён' : 'не настроен'}</strong>
          <span>Провайдер: ${esc(ai.provider || '—')} · DeepSeek ${ai.deepseek ? 'да' : 'нет'} · Gemini ${ai.gemini ? 'да' : 'нет'}</span>
        </article>
        <article class="ops-card">
          <strong>${ops.pushEnabled ? 'Push включены' : 'Push выключены'}</strong>
          <span>Уведомления в PWA о новых сообщениях и объявлениях</span>
        </article>
      </div>
    </section>
    <section class="admin-card tab-panel">
      <h2>Тарифы на сервере</h2>
      <div class="ops-grid">
        ${plans.map((plan) => `
          <article class="ops-card">
            <strong>${esc(plan.planName)}</strong>
            <span>${plan.priceRub} ₽ / ${plan.planDays} дн. · ${esc(plan.code)}</span>
          </article>`).join('') || '<p class="muted">Тарифы подтянутся после обновления backend</p>'}
      </div>
    </section>`;
  }

  function bindOverview() {}

  const PLAN_SHORT = {
    library_30: 'Медиатека',
    club_30: 'Клуб 30 дней',
    club_90: 'Клуб 90 дней',
    club_plus_30: 'Клуб Плюс',
  };
  const PLAN_TIER_NAME = {
    library_30: 'Медиатека',
    club_30: 'Клуб',
    club_90: 'Клуб',
    club_plus_30: 'Клуб Плюс',
  };
  const JUNK_KINDS = ['guest', 'test', 'nologin', 'password'];
  const JUNK_TITLES = {
    guest: 'Гости из тестового режима чата',
    test: 'Тестовый вход без Яндекса',
    nologin: 'Ни разу не входили в приложение',
    password: 'Вход по паролю, но не команда',
  };
  const USER_FILTERS = [
    ['members', 'Участники'],
    ['access', 'С доступом'],
    ['forever', 'Бессрочный доступ'],
    ['noaccess', 'Без доступа'],
    ['waiting', 'Ждут открытия клуба'],
    ['team', 'Команда'],
    ['blocked', 'Заблокированы'],
    ['junk', 'Тестовые и лишние'],
  ];
  const SPINNER = '<span class="btn-spinner" aria-hidden="true"></span>';

  function planShort(item) {
    if (item?.forever) return `${PLAN_TIER_NAME[item.planCode] || item.planName || 'Доступ'} бессрочно`;
    return PLAN_SHORT[item?.planCode] || item?.planName || 'Доступ';
  }

  function accessLabel(item) {
    return item.forever ? planShort(item) : `${planShort(item)} до ${fmtDate(item.accessUntil)}`;
  }

  // Revoked or replaced access ends when it was switched off, not on its paid-up date.
  function endedAt(item) {
    const until = new Date(item.accessUntil || 0).getTime();
    const cancelled = item.cancelledAt ? new Date(item.cancelledAt).getTime() : Infinity;
    return Math.min(until, cancelled);
  }

  function isJunk(entry) {
    return JUNK_KINDS.includes(entry.kind);
  }

  function activeSubsOf(entry) {
    const now = Date.now();
    return (entry.subscriptions || []).filter((item) => (
      item.active && item.accessUntil && new Date(item.accessUntil).getTime() > now
    ));
  }

  function isWaitingClub(entry) {
    return Boolean(entry.remindClubOpen) && !activeSubsOf(entry).some((item) => String(item.planCode || '').startsWith('club'));
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function rub(value) {
    return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
  }

  function fmtSeen(value) {
    if (!value) return 'ещё не заходил(а)';
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 15) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
    return fmtDate(value);
  }

  function accessSummary(entry) {
    const active = activeSubsOf(entry);
    if (active.length) {
      return {
        cls: 'is-active',
        pill: active[0].forever ? 'Доступ бессрочно' : `Доступ до ${fmtDate(active[0].accessUntil)}`,
        text: active.map((item) => `${accessLabel(item)}${item.source === 'MANUAL' ? ' (выдан вручную)' : ''}`).join(' · '),
      };
    }
    const last = (entry.subscriptions || []).slice().sort((a, b) => endedAt(b) - endedAt(a))[0];
    if (last) {
      const revoked = endedAt(last) < new Date(last.accessUntil || 0).getTime();
      return {
        cls: 'is-expired',
        pill: revoked ? 'Доступ забран' : 'Доступ закончился',
        text: `${planShort(last)}, ${revoked ? 'забран' : 'закончился'} ${fmtDate(revoked ? last.cancelledAt : last.accessUntil)}`,
      };
    }
    return { cls: 'is-none', pill: 'Без доступа', text: 'Только бесплатная часть' };
  }

  function paySummary(entry) {
    if (entry.paidTotalRub) {
      return `${rub(entry.paidTotalRub)} · ${entry.paidCount} ${plural(entry.paidCount, 'оплата', 'оплаты', 'оплат')}`;
    }
    if (entry.lastAttempt?.status === 'PENDING') return `Начал(а) оплату ${fmtDate(entry.lastAttempt.createdAt)}, не завершил(а)`;
    if (entry.lastAttempt?.status === 'FAILED') return `Оплата не прошла ${fmtDate(entry.lastAttempt.createdAt)}`;
    return 'Не платил(а)';
  }

  function loginBadge(entry) {
    if (entry.hasYandex) return '<span class="admin-badge">Яндекс</span>';
    if (entry.kind === 'team' && entry.hasPassword) return '<span class="admin-badge is-soft">Пароль</span>';
    if (entry.kind === 'guest') return '<span class="admin-badge is-gray">Гость чата</span>';
    if (entry.kind === 'test') return '<span class="admin-badge is-gray">Тестовый вход</span>';
    if (entry.kind === 'password') return '<span class="admin-badge is-gray">Пароль</span>';
    return '<span class="admin-badge is-gray">Не входил</span>';
  }

  function matchesUserFilter(entry, filter) {
    const junk = isJunk(entry);
    if (filter === 'junk') return junk;
    if (filter === 'team') return entry.kind === 'team';
    if (filter === 'blocked') return Boolean(entry.blockedAt);
    if (junk) return false;
    if (filter === 'access') return entry.payStatus === 'active';
    if (filter === 'forever') return activeSubsOf(entry).some((item) => item.forever);
    if (filter === 'noaccess') return entry.payStatus !== 'active';
    if (filter === 'waiting') return isWaitingClub(entry);
    return true;
  }

  function filteredUsers() {
    const q = state.userQuery.trim().toLowerCase();
    const list = state.users.filter((entry) => {
      if (!matchesUserFilter(entry, state.userFilter)) return false;
      if (!q) return true;
      return `${entry.name} ${entry.email} ${entry.phone || ''}`.toLowerCase().includes(q);
    });
    if (state.userSort === 'seen') {
      list.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
    } else if (state.userSort === 'name') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    }
    return list;
  }

  function renderUserCard(entry) {
    const avatar = entry.avatarUrl || '';
    const access = accessSummary(entry);
    const me = state.user?.id === entry.id;
    const canDelete = !me && entry.kind !== 'team';
    const roles = roleChoices(entry);
    const team = entry.kind === 'team' ? `<span class="admin-badge is-team">${esc(roleLabel(entry.role))}</span>` : '';
    const waiting = isWaitingClub(entry) ? '<span class="admin-badge is-wait">Ждёт открытия клуба</span>' : '';
    const blocked = entry.blockedAt ? '<span class="admin-badge is-danger">Заблокирован</span>' : '';
    return `<article class="user-card${entry.blockedAt ? ' is-blocked' : ''}" data-user-card="${esc(entry.id)}">
      <div class="user-card-head">
        <div class="admin-user-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />` : ''}<span>${esc((entry.name || '?').trim()[0]?.toUpperCase() || '?')}</span></div>
        <div class="user-card-meta">
          <strong>${esc(entry.name || 'Без имени')}${me ? ' <small>(вы)</small>' : ''}</strong>
          <span>${esc(entry.email)}</span>
          <span>${entry.phone ? esc(entry.phone) : 'Телефона нет'}</span>
        </div>
        <span class="pay-pill ${access.cls}">${esc(access.pill)}</span>
      </div>
      <div class="user-badges">${loginBadge(entry)}${team}${waiting}${blocked}</div>
      <dl class="user-facts">
        <div><dt>Доступ</dt><dd>${esc(access.text)}</dd></div>
        <div><dt>Оплаты</dt><dd>${esc(paySummary(entry))}</dd></div>
        <div><dt>В клубе с</dt><dd>${fmtDate(entry.createdAt)}</dd></div>
        <div><dt>Заходил(а)</dt><dd>${esc(fmtSeen(entry.lastSeenAt))}</dd></div>
        <div><dt>Сообщений в чатах</dt><dd>${entry.messagesCount || 0}</dd></div>
      </dl>
      <button type="button" class="user-manage-toggle" data-manage="${esc(entry.id)}" aria-expanded="false">Управление</button>
      <div class="user-actions" data-manage-panel="${esc(entry.id)}" hidden>
        <div class="user-action-row">
          <select data-grant-plan="${esc(entry.id)}" aria-label="Что выдать">
            <option value="club_30:forever">Клуб · бессрочно</option>
            <option value="club_30">Клуб · 30 дней</option>
            <option value="club_90">Клуб · 90 дней</option>
            <option value="club_plus_30:forever">Клуб Плюс · бессрочно</option>
            <option value="club_plus_30">Клуб Плюс · 30 дней</option>
            <option value="library_30">Медиатека · 30 дней</option>
          </select>
          <button type="button" class="ok-btn" data-grant="${esc(entry.id)}">Выдать доступ</button>
          ${activeSubsOf(entry).length ? `<button type="button" class="ghost-btn" data-revoke="${esc(entry.id)}">Забрать доступ</button>` : ''}
        </div>
        ${roles.length ? `<div class="user-action-row">
          <select data-role-select="${esc(entry.id)}" aria-label="Роль">
            ${roles.map((role) => `<option value="${role}" ${entry.role === role ? 'selected' : ''}>${esc(roleLabel(role))}</option>`).join('')}
          </select>
          <button type="button" class="ok-btn" data-role="${esc(entry.id)}">Назначить роль</button>
        </div>` : ''}
        ${me ? '' : `<div class="user-action-row">
          <button type="button" class="${entry.blockedAt ? 'ok-btn' : 'ghost-btn'}" data-block="${esc(entry.id)}" data-blocked="${entry.blockedAt ? '1' : '0'}">${entry.blockedAt ? 'Разблокировать' : 'Заблокировать вход'}</button>
          ${canDelete ? `<button type="button" class="danger-btn" data-delete-user="${esc(entry.id)}">Удалить аккаунт</button>` : ''}
        </div>`}
      </div>
    </article>`;
  }

  function renderUserList() {
    const list = filteredUsers();
    if (!list.length) {
      return `<p class="muted user-empty">${state.userQuery.trim() ? 'По этому запросу никого нет.' : 'В этом списке пока никого нет.'}</p>`;
    }
    const shown = list.slice(0, state.userLimit);
    const rest = list.length - shown.length;
    return `${shown.map(renderUserCard).join('')}
      ${rest > 0 ? `<button type="button" class="ghost-btn user-more" id="user-more">Показать ещё ${Math.min(rest, 40)} из ${rest}</button>` : ''}`;
  }

  function renderCleanup() {
    const c = state.cleanup;
    const junkCount = state.users.filter(isJunk).length;
    if (!c.data) {
      if (!junkCount) return '';
      return `<section class="admin-card tab-panel cleanup-card">
        <h2>Тестовые и лишние аккаунты: ${junkCount}</h2>
        <p class="muted">Это гости из тестового режима чата, тестовый вход и записи, у которых нет способа войти. Из-за них список казался огромным. Команду и тех, кто входил через Яндекс, очистка не трогает. Сначала покажем список, удалите только отмеченных.</p>
        <button type="button" class="ok-btn" id="cleanup-load" ${c.loading ? 'disabled' : ''}>${c.loading ? `${SPINNER}Собираем список…` : 'Показать, кого удалить'}</button>
      </section>`;
    }
    const groups = JUNK_KINDS.map((kind) => {
      const rows = c.data.users.filter((item) => item.kind === kind);
      if (!rows.length) return '';
      return `<div class="cleanup-group">
        <h3>${esc(JUNK_TITLES[kind])} · ${rows.length}</h3>
        ${rows.map((item) => `<label class="cleanup-row${item.warnings.length ? ' has-warning' : ''}">
          <input type="checkbox" data-cleanup-pick="${esc(item.id)}" ${c.picked.includes(item.id) ? 'checked' : ''} />
          <span class="cleanup-row-copy">
            <strong>${esc(item.name || 'Без имени')}</strong>
            <small>${esc(item.email)} · создан ${fmtDate(item.createdAt)}${item.messagesCount ? ` · сообщений: ${item.messagesCount}` : ''}</small>
            ${item.warnings.length ? `<em>Проверьте: ${esc(item.warnings.join(', '))}</em>` : ''}
          </span>
        </label>`).join('')}
      </div>`;
    }).join('');
    return `<section class="admin-card tab-panel cleanup-card">
      <h2>Очистка перед запуском</h2>
      <p class="muted">Отмечены все, у кого нет оплат и доступа. Записи с оплатой или открытым доступом не отмечены, решите сами. Вместе с аккаунтом пропадут его сообщения в чатах. Настоящие оплаты останутся в истории.</p>
      ${c.data.users.length ? `<div class="cleanup-tools">
        <button type="button" class="ghost-btn" id="cleanup-all">Отметить всех</button>
        <button type="button" class="ghost-btn" id="cleanup-none">Снять все</button>
      </div>${groups}` : '<p class="status">Лишних аккаунтов не осталось.</p>'}
      ${c.data.stalePayments ? `<label class="admin-checkbox cleanup-stale">
        <input type="checkbox" id="cleanup-stale" ${c.cancelStale ? 'checked' : ''} />
        Закрыть зависшие попытки оплаты старше 2 дней: ${c.data.stalePayments}
      </label>` : ''}
      <div class="cleanup-tools">
        <button type="button" class="danger-btn" id="cleanup-apply" ${c.busy ? 'disabled' : ''}>${c.busy ? `${SPINNER}Удаляем…` : cleanupApplyLabel()}</button>
        <button type="button" class="ghost-btn" id="cleanup-close">Скрыть</button>
      </div>
    </section>`;
  }

  function cleanupApplyLabel() {
    const c = state.cleanup;
    const n = c.picked.length;
    const stale = c.cancelStale && c.data?.stalePayments ? ' и закрыть попытки оплаты' : '';
    if (!n) return stale ? 'Закрыть зависшие попытки оплаты' : 'Ничего не отмечено';
    return `Удалить ${n} ${plural(n, 'аккаунт', 'аккаунта', 'аккаунтов')}${stale}`;
  }

  function renderUsers() {
    const counts = Object.fromEntries(USER_FILTERS.map(([id]) => [id, state.users.filter((entry) => matchesUserFilter(entry, id)).length]));
    return `${renderCleanup()}
    <section class="admin-card tab-panel">
      <h2>Участники</h2>
      <p class="muted">Карточка показывает, как человек входит, какой у него доступ и до какого числа, сколько он заплатил и когда заходил. Оплата через Продамус продлевается сама, пока человек не отключит подписку. Доступ, выданный здесь на 30 или 90 дней, сам не продлевается. Бессрочный действует, пока его не заберут кнопкой «Забрать доступ». «Заблокировать вход» закрывает приложение целиком. Из Telegram-клуба человек сам не удаляется.</p>
      <div class="toolbar">
        <input id="user-query" type="search" value="${esc(state.userQuery)}" placeholder="Имя, почта или телефон" autocomplete="off" />
        <select id="user-filter" aria-label="Кого показать">
          ${USER_FILTERS.map(([id, label]) => (id === 'junk' && !counts.junk ? '' : `<option value="${id}" ${state.userFilter === id ? 'selected' : ''}>${label} · ${counts[id]}</option>`)).join('')}
        </select>
        <select id="user-sort" aria-label="Порядок">
          <option value="recent" ${state.userSort === 'recent' ? 'selected' : ''}>Сначала новые</option>
          <option value="seen" ${state.userSort === 'seen' ? 'selected' : ''}>Недавно заходили</option>
          <option value="name" ${state.userSort === 'name' ? 'selected' : ''}>По имени</option>
        </select>
      </div>
      ${state.status.user ? `<p class="status">${esc(state.status.user)}</p>` : ''}
      <div class="user-card-list" id="user-card-list">${renderUserList()}</div>
    </section>`;
  }

  function renderAnnounce() {
    const lenta = state.chatRooms.find((room) => room.slug === 'posts');
    return `<section class="admin-card tab-panel">
      <h2>Анонсы закрытого клуба</h2>
      <p class="muted">Здесь пишут админы. Кураторы публикуют анонсы в приложении, в чате «Анонсы». Участники читают, гости чат не видят${lenta ? ` · ${lenta._count?.messages || 0} сообщений` : ''}.</p>
      <form class="admin-form announce-box" id="announce-form">
        <label>Текст объявления
          <textarea id="announce-body" required rows="5" placeholder="Вышел новый подкаст / собираемся в 20:00 в Zoom">${esc(state.announce.body)}</textarea>
        </label>
        <label class="admin-checkbox">
          <input type="checkbox" id="announce-pin" ${state.announce.pin ? 'checked' : ''} />
          Закрепить сверху
        </label>
        ${state.status.announce ? `<p class="status">${esc(state.status.announce)}</p>` : ''}
        <button type="submit">Опубликовать анонс</button>
      </form>
    </section>`;
  }

  function selectedFeedPost() {
    return state.feedPosts.find((post) => post.id === state.selectedPostId) || null;
  }

  function renderPostForm() {
    const p = state.post;
    const hasImage = Boolean(p.preview || p.imageUrl);
    const list = state.feedPosts.map((post) => {
      const preview = String(post.body || '').replace(/\s+/g, ' ').trim();
      return `<article class="feed-admin-card">
        <div class="feed-admin-top">
          <div>
            <strong>${esc(post.title || 'Без заголовка')}</strong>
            <span class="muted">${esc(post.author?.name || 'Лоза')} · ${fmtDateTime(post.createdAt)} · ${post._count?.comments || 0} комм.</span>
          </div>
          <div class="feed-admin-actions">
            <button type="button" data-open-post="${esc(post.id)}">Изменить</button>
            <button type="button" class="danger-btn" data-del-post="${esc(post.id)}">Удалить</button>
          </div>
        </div>
        ${post.imageUrl ? `<img class="feed-admin-thumb" src="${esc(post.imageUrl)}" alt="" />` : ''}
        <p>${esc(preview.slice(0, 160))}${preview.length > 160 ? '…' : ''}</p>
      </article>`;
    }).join('');

    return `
      <section class="admin-card tab-panel">
        <h2>Пост в ленту приложения</h2>
        <p class="muted">Лента клуба. Картинку лучше прикрепить файлом. Ссылка vk.com/photo не подойдёт, нужна прямая картинка (jpg/png/webp или userapi.com). Видео: отдельное поле Кинескоп.</p>
        <form class="admin-form" id="post-form">
          <label>Заголовок, его видят в ленте<input id="post-title" value="${esc(p.title)}" /></label>
          <label>Текст поста<textarea id="post-body" required rows="6">${esc(p.body)}</textarea></label>
          <label>Видео Кинескоп, если нужно<input id="post-video" value="${esc(p.videoUrl || '')}" placeholder="https://kinescope.io/..." /></label>
          <div class="image-attach">
            <input id="post-file" accept="image/jpeg,image/png,image/webp,image/gif" type="file" hidden />
            <button type="button" class="image-attach-btn${hasImage ? ' has-image' : ''}" id="post-pick-image" ${state.uploading ? 'disabled' : ''}>
              <span class="image-attach-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="3"/>
                  <circle cx="8.5" cy="10" r="1.5"/>
                  <path d="m21 15-4.5-4.5L8 19"/>
                </svg>
              </span>
              <span class="image-attach-copy">
                <strong>${state.uploading ? 'Загружаем…' : hasImage ? 'Картинка выбрана' : 'Прикрепить картинку'}</strong>
                <em>${hasImage ? esc(p.fileName || 'Готово к публикации') : 'JPG, PNG или WebP до 6 МБ'}</em>
              </span>
            </button>
            ${hasImage ? `<div class="admin-image-preview">
              <img alt="Превью" src="${esc(p.preview || p.imageUrl)}" />
              <button type="button" id="post-clear-image">Убрать</button>
            </div>` : ''}
            ${stockImagePicker(p.imageUrl)}
          </div>
          <details class="url-details">
            <summary>Или вставить URL картинки</summary>
            <label class="url-label"><input id="post-image-url" placeholder="https://…" value="${esc(p.imageUrl)}" /></label>
          </details>
          ${state.status.post ? `<p class="status">${esc(state.status.post)}</p>` : ''}
          <button type="submit" ${state.uploading ? 'disabled' : ''}>${state.uploading ? 'Подождите…' : 'Опубликовать'}</button>
        </form>
      </section>
      <section class="admin-card tab-panel">
        <h2>Все посты</h2>
        <div class="feed-admin-list">${list || '<p class="muted">Постов пока нет</p>'}</div>
      </section>`;
  }

  function renderPostEditor(post) {
    const comments = (post.comments || []).map((comment) => `
      <article class="feed-comment-card">
        <div class="feed-comment-top">
          <strong>${esc(comment.author?.name || 'Участник')}</strong>
          <time>${fmtDateTime(comment.createdAt)}</time>
        </div>
        <p>${esc(comment.body)}</p>
        <button type="button" class="danger-btn" data-del-comment="${esc(comment.id)}">Удалить комментарий</button>
      </article>`).join('');

    return `<section class="admin-card tab-panel">
      <div class="chat-thread-top">
        <button type="button" class="chat-back-btn" id="post-back">← Назад</button>
        <div>
          <h2>Редактирование поста</h2>
          <p class="muted">${fmtDateTime(post.createdAt)} · ${post._count?.comments || 0} комментариев</p>
        </div>
      </div>
      <form class="admin-form" id="post-edit-form">
        <label>Заголовок<input id="edit-post-title" value="${esc(post.title || '')}" /></label>
        <label>Текст<textarea id="edit-post-body" required rows="7">${esc(post.body || '')}</textarea></label>
        <label>Видео Кинескоп<input id="edit-post-video" value="${esc(post.videoUrl || '')}" placeholder="https://kinescope.io/..." /></label>
        <div class="image-attach">
          <input id="edit-post-file" accept="image/jpeg,image/png,image/webp,image/gif" type="file" hidden />
          <button type="button" class="image-attach-btn${post.imageUrl ? ' has-image' : ''}" id="edit-post-pick-image" ${state.uploading ? 'disabled' : ''}>
            <span class="image-attach-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="5" width="18" height="14" rx="3"/>
                <circle cx="8.5" cy="10" r="1.5"/>
                <path d="m21 15-4.5-4.5L8 19"/>
              </svg>
            </span>
            <span class="image-attach-copy">
              <strong>${state.uploading ? 'Загружаем…' : post.imageUrl ? 'Заменить картинку' : 'Прикрепить картинку'}</strong>
              <em>JPG, PNG или WebP до 6 МБ</em>
            </span>
          </button>
          ${post.imageUrl ? `<div class="admin-image-preview"><img alt="" src="${esc(post.imageUrl)}" /><button type="button" id="edit-post-clear-image">Убрать</button></div>` : ''}
          ${stockImagePicker(post.imageUrl || '')}
        </div>
        <details class="url-details">
          <summary>Или вставить URL картинки</summary>
          <label class="url-label"><input id="edit-post-image" value="${esc(post.imageUrl || '')}" placeholder="https://…" /></label>
        </details>
        ${state.status.post ? `<p class="status">${esc(state.status.post)}</p>` : ''}
        <div class="feed-admin-actions">
          <button type="submit">Сохранить</button>
          <button type="button" class="danger-btn" id="edit-post-delete">Удалить пост</button>
        </div>
      </form>
      <div class="feed-comments-block">
        <h3>Комментарии</h3>
        ${comments || '<p class="muted">Комментариев нет</p>'}
      </div>
    </section>`;
  }

  function paymentEmail(payment) {
    return payment.user?.email || payment.email || '';
  }

  function paymentPhone(payment) {
    return payment.user?.phone || payment.phone || '';
  }

  function filteredPayments() {
    const q = state.paymentQuery.trim().toLowerCase();
    return state.payments.filter((payment) => {
      if (!q) return true;
      return `${payment.user?.name || ''} ${paymentEmail(payment)} ${paymentPhone(payment)} ${payment.planName || ''}`.toLowerCase().includes(q);
    });
  }

  function renderPayments() {
    const cards = filteredPayments().map((payment) => {
      const pill = payment.status === 'PAID' ? 'is-active' : payment.status === 'PENDING' ? 'is-pending' : payment.status === 'FAILED' ? 'is-failed' : 'is-none';
      const email = paymentEmail(payment);
      const phone = paymentPhone(payment);
      return `<article class="pay-card">
        <div class="pay-card-top">
          <strong>${esc(payment.user?.name || email || '—')}</strong>
          <span class="pay-pill ${pill}">${esc(payment.status)}</span>
        </div>
        <div class="pay-card-meta">
          <span>${esc(email || 'Нет почты')}</span>
          <span>${esc(phone || 'Нет телефона')}</span>
          <span>${esc(payment.provider || '—')}</span>
          <span>${esc(payment.planName || '—')}${payment.planDays ? ` · ${payment.planDays} дн.` : ''}</span>
          <span>${payment.amountRub != null ? `${payment.amountRub} ₽` : '—'}</span>
          <span>${fmtDateTime(payment.createdAt)}</span>
        </div>
      </article>`;
    }).join('');

    return `<section class="admin-card tab-panel">
      <h2>Платежи</h2>
      <p class="muted">Поиск по имени, почте и телефону — в том числе с Продамуса.</p>
      <div class="toolbar">
        <input id="pay-query" value="${esc(state.paymentQuery)}" placeholder="Имя, почта или телефон" />
      </div>
      <div class="pay-card-list">${cards || '<p class="muted">Платежей нет</p>'}</div>
    </section>`;
  }

  function selectedRoom() {
    return state.chatRooms.find((room) => room.id === state.selectedRoomId) || null;
  }

  function lastMessagePreview(room) {
    const messages = [...(room.messages || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    const last = messages[0];
    if (!last) return 'Пока нет сообщений';
    const name = last.author?.name || 'Участник';
    const body = String(last.body || '').replace(/\s+/g, ' ').trim();
    return `${name}: ${body.slice(0, 72)}${body.length > 72 ? '…' : ''}`;
  }

  function renderChatRoomList() {
    const rooms = state.chatRooms.map((room) => {
      const count = room._count?.messages ?? (room.messages || []).length;
      return `<button type="button" class="chat-room-card" data-open-room="${esc(room.id)}">
        <div class="chat-room-avatar" aria-hidden="true">${esc((room.title || '?')[0].toUpperCase())}</div>
        <div class="chat-room-copy">
          <div class="chat-room-title-row">
            <strong>${esc(room.title)}</strong>
            <span>${count}</span>
          </div>
          <em>${esc(lastMessagePreview(room))}</em>
          <div class="chat-room-tags">
            <i class="${room.canPost ? 'is-open' : 'is-locked'}">${room.canPost ? 'Можно писать' : 'Только чтение'}</i>
            ${room.isPremium ? '<i class="is-premium">Закрытый</i>' : '<i>Открытый</i>'}
          </div>
        </div>
      </button>`;
    }).join('');

    return `<section class="admin-card tab-panel">
      <h2>Чаты клуба</h2>
      <p class="muted">Модерация сообщений на живом сервере</p>
      ${state.status.chat ? `<p class="status">${esc(state.status.chat)}</p>` : ''}
      <div class="chat-room-list">${rooms || '<p class="muted">Чатов пока нет</p>'}</div>
    </section>`;
  }

  function renderChatThread(room) {
    const messages = [...(room.messages || [])]
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    const bubbles = messages.map((message) => {
      const name = message.author?.name || 'Участник';
      const initial = (name[0] || '?').toUpperCase();
      const team = ['OWNER', 'ADMIN', 'CURATOR'].includes(message.author?.role);
      return `<article class="chat-bubble-card${message.isPinned ? ' is-pinned' : ''}${team ? ' is-team' : ''}">
        <div class="chat-bubble-avatar">${esc(initial)}</div>
        <div class="chat-bubble-main">
          <div class="chat-bubble-head">
            <strong>${esc(name)}</strong>
            <time>${fmtDateTime(message.createdAt)}</time>
          </div>
          ${message.isPinned ? '<span class="chat-pin-badge">Закреплено</span>' : ''}
          <p>${esc(message.body)}</p>
          <div class="chat-bubble-actions">
            <button type="button" data-pin-message="${esc(message.id)}" data-pinned="${message.isPinned ? '1' : '0'}">${message.isPinned ? 'Открепить' : 'Закрепить'}</button>
            <button type="button" data-edit-message="${esc(message.id)}">Изменить</button>
            <button type="button" class="danger" data-del-message="${esc(message.id)}">Удалить</button>
          </div>
        </div>
      </article>`;
    }).join('') || `<div class="chat-empty">
      <strong>Пока тихо</strong>
      <span>Когда участники напишут, сообщения появятся здесь</span>
    </div>`;

    return `<section class="admin-card tab-panel chat-thread-panel">
      <div class="chat-thread-top">
        <button type="button" class="chat-back-btn" id="chat-back">← Назад</button>
        <div>
          <h2>${esc(room.title)}</h2>
          <p class="muted">${room._count?.messages ?? messages.length} сообщений</p>
        </div>
      </div>
      <div class="chat-room-controls">
        <label class="chat-switch">
          <input type="checkbox" id="room-can-post" ${room.canPost ? 'checked' : ''} />
          <span>Участники могут писать</span>
        </label>
        <label class="chat-switch">
          <input type="checkbox" id="room-premium" ${room.isPremium ? 'checked' : ''} />
          <span>Только для подписки</span>
        </label>
      </div>
      ${state.status.chat ? `<p class="status">${esc(state.status.chat)}</p>` : ''}
      <div class="chat-thread">${bubbles}</div>
    </section>`;
  }

  function renderMovies() {
    const selected = state.movies.find((item) => item.id === state.selectedMovieId);
    if (selected) {
      return `<section class="admin-card tab-panel">
        <div class="chat-thread-top">
          <button type="button" class="chat-back-btn" id="movie-back">← Назад</button>
          <div><h2>${esc(selected.title)}</h2><p class="muted">Киноклуб в медиатеке</p></div>
        </div>
        <form class="admin-form" id="movie-edit-form">
          <label>Название<input id="movie-title" value="${esc(selected.title)}" /></label>
          <label>Год<input id="movie-year" value="${esc(selected.year || '')}" /></label>
          <label>Тема<input id="movie-theme" value="${esc(selected.theme || '')}" /></label>
          <label>Рекомендация / описание<textarea id="movie-description" rows="6">${esc(selected.description || '')}</textarea></label>
          <label>Вопрос для рефлексии<textarea id="movie-prompt" rows="4">${esc(selected.prompt || '')}</textarea></label>
          ${state.status.movie ? `<p class="status">${esc(state.status.movie)}</p>` : ''}
          <button type="submit">Сохранить в медиатеке</button>
        </form>
      </section>`;
    }

    const cards = state.movies.map((movie) => `
      <article class="movie-admin-card">
        <h3>${esc(movie.title)}</h3>
        <p class="muted">${esc(movie.year || '')} · ${esc(movie.theme || 'Киноклуб')}</p>
        <button type="button" data-open-movie="${esc(movie.id)}">Редактировать</button>
      </article>`).join('');

    return `<section class="admin-card tab-panel">
      <h2>Киноклуб</h2>
      <p class="muted">Рекомендации и вопросы для рефлексии. Разборы фильмов закрыты тарифом «Медиатека. Теория».</p>
      ${state.status.movie ? `<p class="status">${esc(state.status.movie)}</p>` : ''}
      <div class="feed-admin-list">${cards || '<p class="muted">Фильмы подтянутся после деплоя backend</p>'}</div>
    </section>`;
  }

  function contentSections() {
    const fallback = [
      { slug: 'podcasts', title: 'Подкасты' },
      { slug: 'questions', title: 'Вопросы и ответы' },
      { slug: 'webinars', title: 'Эфиры и вебинары' },
      { slug: 'movies', title: 'Киноклуб' },
      { slug: 'home_reviews', title: 'Задания' },
      { slug: 'club_reviews', title: 'Разборы' },
    ];
    const bySlug = new Map(fallback.map((item) => [item.slug, item]));
    (state.librarySections || []).forEach((item) => {
      if (!item?.slug) return;
      bySlug.set(item.slug, { slug: item.slug, title: item.title || bySlug.get(item.slug)?.title || item.slug });
    });
    if (!bySlug.has('movies')) bySlug.set('movies', { slug: 'movies', title: 'Киноклуб' });
    return [...bySlug.values()];
  }

  function blankContentForm() {
    return {
      editId: '',
      sectionSlug: state.contentForm.sectionSlug || 'podcasts',
      title: '',
      summary: '',
      body: '',
      mediaUrl: '',
      type: state.contentForm.type || 'VIDEO',
      coverUrl: '',
      audioFileName: '',
    };
  }

  function normalizeAdminMediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/https?:\/\/(?:www\.)?kinescope\.io\/[^\s<>"']+/i);
    if (match) return match[0].replace(/[),.;]+$/, '').replace(/\/embed\//i, '/');
    return raw;
  }

  function contentStatusMessage(code) {
    if (code === 'YANDEX_DISK_LINK') {
      return 'Ссылка с Яндекс.Диска не подойдёт. Прикрепите файл или вставьте ссылку Кинескопа.';
    }
    if (code === 'VIDEO_LINK_REQUIRED') return 'Для видео нужна ссылка Кинескопа или файл mp4.';
    if (code === 'UNSUPPORTED_VIDEO_LINK') return 'Такая ссылка в клубе не откроется. Нужна ссылка kinescope.io или файл mp4.';
    if (code === 'AUDIO_REQUIRED') return 'Прикрепите аудио или вставьте прямую ссылку на mp3.';
    if (code === 'UNSUPPORTED_AUDIO_LINK') return 'Эта ссылка не откроется как аудио. Прикрепите файл.';
    if (code === 'VIDEO_TOO_LARGE') return 'Видео больше 80 МБ. Для длинного фильма вставьте ссылку Кинескопа.';
    if (code === 'UNSUPPORTED_VIDEO_TYPE') return 'Нужен файл mp4.';
    if (code === 'TITLE_REQUIRED') return 'Напишите название материала';
    if (code === 'SECTION_NOT_FOUND') return 'Нет такого раздела';
    if (code === 'VALIDATION_ERROR') return 'Слишком длинный текст или пустое название. Сократите или заполните поля.';
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return 'Войдите в админку снова';
    if (code === 'AUDIO_TOO_LARGE') return 'Файл больше 80 МБ';
    if (code === 'INTERNAL_ERROR') return 'Сервер не сохранил материал. Попробуйте ещё раз.';
    return code || 'Не удалось сохранить';
  }

  function contentPayload() {
    return {
      sectionSlug: state.contentForm.sectionSlug,
      title: state.contentForm.title,
      type: state.contentForm.type,
      summary: state.contentForm.summary,
      body: state.contentForm.body,
      mediaUrl: normalizeAdminMediaUrl(state.contentForm.mediaUrl),
      coverUrl: state.contentForm.coverUrl,
    };
  }

  function renderContent() {
    const f = state.contentForm;
    const editing = Boolean(f.editId);
    const sections = contentSections();
    const filter = state.contentFilter || 'all';
    const query = (state.contentQuery || '').trim().toLowerCase();
    const visible = state.library.filter((entry) => {
      if (filter !== 'all' && entry.section?.slug !== filter) return false;
      if (!query) return true;
      return `${entry.title || ''} ${entry.summary || ''}`.toLowerCase().includes(query);
    });
    const typeLabel = (type) => ({
      VIDEO: 'Видео',
      AUDIO: 'Аудио',
      TEXT: 'Текст',
      LIVE: 'Эфир',
    }[type] || type || '');
    const mediaKind = (url) => {
      if (!url) return '';
      if (/kinescope/i.test(url)) return 'Кинескоп';
      if (/storage\.yandexcloud\.net/i.test(url)) return 'Бакет';
      return 'Ссылка';
    };
    const bucketAudio = /storage\.yandexcloud\.net/i.test(f.mediaUrl || '');
    const bucketVideo = bucketAudio && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(f.mediaUrl || '');
    const hasAudio = f.type === 'AUDIO' && (Boolean(f.mediaUrl) || editing);
    const mediaField = f.type === 'TEXT' ? '' : f.type === 'AUDIO'
      ? `<div class="image-attach">
          <input id="content-audio-file" accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,.mp3,.m4a,.aac,.wav,.ogg" type="file" hidden />
          <button type="button" class="image-attach-btn${hasAudio ? ' has-image' : ''}" id="content-pick-audio" ${state.uploading ? 'disabled' : ''}>
            <span class="image-attach-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M9 18V6l10-2v12"/>
                <circle cx="7" cy="18" r="2.4"/>
                <circle cx="17" cy="16" r="2.4"/>
              </svg>
            </span>
            <span class="image-attach-copy">
              <strong>${state.uploading ? 'Загружаем в бакет…' : bucketAudio ? 'Аудио в бакете' : hasAudio ? 'Аудио уже в клубе' : 'Прикрепить аудио'}</strong>
              <em>${hasAudio ? esc(f.audioFileName || (bucketAudio ? 'Готово' : 'Можно заменить файлом')) : 'MP3 или M4A до 80 МБ'}</em>
            </span>
          </button>
          ${hasAudio ? `<button type="button" id="content-clear-audio">Убрать аудио</button>` : ''}
        </div>
        <details class="url-details">
          <summary>Или вставить прямую ссылку на mp3</summary>
          <label class="url-label"><input id="content-media" placeholder="https://…" value="${esc(f.mediaUrl)}" /></label>
        </details>`
      : `<div class="image-attach">
          <input id="content-video-file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" type="file" hidden />
          <button type="button" class="image-attach-btn${bucketVideo ? ' has-image' : ''}" id="content-pick-video" ${state.uploading ? 'disabled' : ''}>
            <span class="image-attach-copy">
              <strong>${state.uploading ? 'Загружаем в бакет…' : bucketVideo ? 'Видео в бакете' : 'Прикрепить mp4'}</strong>
              <em>${bucketVideo ? 'Файл загружен' : 'До 80 МБ. Длинный фильм лучше ссылкой Кинескопа'}</em>
            </span>
          </button>
        </div>
        <label>Ссылка на видео<input id="content-media" value="${esc(f.mediaUrl)}" placeholder="https://kinescope.io/..." /></label>`;
    const chips = `
      <nav class="content-section-nav" aria-label="Разделы медиатеки">
        <button type="button" class="${filter === 'all' ? 'is-active' : ''}" data-content-filter="all">Все</button>
        ${sections.map((section) => `
          <button type="button" class="${filter === section.slug ? 'is-active' : ''}" data-content-filter="${esc(section.slug)}">${esc(section.title)}</button>
        `).join('')}
      </nav>`;
    const list = visible.map((entry) => `
      <article class="feed-admin-card">
        ${entry.coverUrl ? `<img class="feed-admin-thumb" src="${esc(entry.coverUrl)}" alt="" />` : ''}
        <div class="feed-admin-copy">
          <strong>${esc(entry.title)}</strong>
          <span class="muted">${[entry.section?.title, typeLabel(entry.type), mediaKind(entry.mediaUrl)].filter(Boolean).join(' · ')}</span>
        </div>
        <div class="feed-admin-actions">
          <button type="button" data-edit-content="${esc(entry.id)}">Изменить</button>
          <button type="button" class="danger-btn content-del-btn" data-del-content="${esc(entry.id)}">Удалить</button>
        </div>
      </article>`).join('');

    return `<section class="admin-card tab-panel">
      <h2>${editing ? 'Редактировать материал' : 'Добавить в медиатеку'}</h2>
      ${chips}
      <p class="muted">Видео: ссылка kinescope.io или mp4 до 80 МБ. Аудио: прикрепите файл, он уйдёт в бакет. Ссылка с YouTube, VK или Яндекс.Диска в клубе не откроется.</p>
      ${editing && f.type === 'AUDIO' && !bucketAudio
        ? '<p class="muted">Звук уже в клубе. Можно поменять название или прикрепить другой файл.</p>'
        : ''}
      <form class="admin-form" id="content-form">
        <div class="admin-form-row">
          <label>Раздел
            <select id="content-section">
              ${sections.map((section) => `<option value="${esc(section.slug)}" ${f.sectionSlug === section.slug ? 'selected' : ''}>${esc(section.title)}</option>`).join('')}
            </select>
          </label>
          <label>Тип
            <select id="content-type">
              <option value="VIDEO" ${f.type === 'VIDEO' ? 'selected' : ''}>Видео</option>
              <option value="AUDIO" ${f.type === 'AUDIO' ? 'selected' : ''}>Аудио</option>
              <option value="TEXT" ${f.type === 'TEXT' ? 'selected' : ''}>Текст</option>
              <option value="LIVE" ${f.type === 'LIVE' ? 'selected' : ''}>Эфир</option>
            </select>
          </label>
        </div>
        <label>Название<input id="content-title" required value="${esc(f.title)}" placeholder="Как в карточке увидят участники" /></label>
        <label>Короткое описание<span class="muted">В карточке у всех, даже без оплаты</span><textarea id="content-summary" rows="3" placeholder="О чём материал. Это видят все.">${esc(f.summary)}</textarea></label>
        <label>Текст материала<span class="muted">Практики и полный текст. Только у тех, кто оплатил</span><textarea id="content-body" rows="6" placeholder="То, что видят участники после оплаты">${esc(f.body)}</textarea></label>
        ${mediaField}
        <div class="image-attach">
          ${stockImagePicker(f.coverUrl, 'Картинка карточки в клубе')}
        </div>
        ${state.status.content ? `<p class="status">${esc(state.status.content)}</p>` : ''}
        <div class="feed-admin-actions">
          <button type="submit" ${state.uploading ? 'disabled' : ''}>${state.uploading ? 'Подождите…' : editing ? 'Сохранить' : 'Опубликовать в клуб'}</button>
          ${editing ? '<button type="button" id="content-cancel-edit">Отменить</button>' : ''}
        </div>
      </form>
    </section>
    <section class="admin-card tab-panel">
      <h2>${filter === 'movies' ? 'Киноклуб' : 'Материалы'}</h2>
      <label>Найти<input id="content-query" value="${esc(state.contentQuery)}" placeholder="Название" /></label>
      <div class="feed-admin-list">${list || `<p class="muted">${query ? 'Ничего не нашлось' : filter === 'movies' ? 'В киноклубе пока нет видео. Добавьте разбор сверху.' : 'Пока ничего не добавляли'}</p>`}</div>
    </section>`;
  }

  function renderTabContent() {
    if (state.tab === 'overview') return renderOverview();
    if (state.tab === 'announce') return renderAnnounce();
    if (state.tab === 'content') return renderContent();
    if (state.tab === 'users') return renderUsers();
    if (state.tab === 'payments') return renderPayments();
    if (state.tab === 'chats') return selectedRoom() ? renderChatThread(selectedRoom()) : renderChatRoomList();
    if (state.tab === 'movies') {
      state.tab = 'content';
      state.contentFilter = 'movies';
      state.contentForm.sectionSlug = 'movies';
      return renderContent();
    }
    const post = selectedFeedPost();
    if (post) return renderPostEditor(post);
    return renderPostForm();
  }

  function renderDashboard() {
    app.innerHTML = `<div class="admin-shell">
      <header class="admin-topbar">
        <div>
          <img class="admin-topbar-logo" src="assets/logo.png" alt="Loza Admin" />
          <div>
            <strong>Loza Admin</strong>
            <p class="muted">${esc(state.user?.name || '')} · ${esc(state.user?.role || '')}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${liveChip()}
          <button type="button" id="logout-btn">Выйти</button>
        </div>
      </header>
      ${renderTabs()}
      ${renderStats()}
      <div class="tab-content">${renderTabContent()}</div>
    </div>`;
    bindDashboard();
  }

  function bindDashboard() {
    document.getElementById('logout-btn').onclick = () => {
      API.clearToken();
      state.user = null;
      render();
    };

    app.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.onclick = () => {
        const next = btn.dataset.tab;
        if (next !== 'chats') state.selectedRoomId = '';
        if (next !== 'posts') state.selectedPostId = '';
        if (next !== 'movies') state.selectedMovieId = '';
        state.tab = next;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    if (state.tab === 'overview') bindOverview();
    if (state.tab === 'posts') bindPosts();
    if (state.tab === 'chats') bindChats();
    if (state.tab === 'users') bindUsers();
    if (state.tab === 'payments') bindPayments();
    if (state.tab === 'content') bindContent();
    if (state.tab === 'announce') bindAnnounce();
  }

  function bindPayments() {
    const query = document.getElementById('pay-query');
    query?.addEventListener('input', (event) => { state.paymentQuery = event.target.value; });
    query?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); render(); }
    });
    query?.addEventListener('blur', () => render());
  }

  function snapshotContentForm() {
    const section = document.getElementById('content-section');
    const type = document.getElementById('content-type');
    const title = document.getElementById('content-title');
    const summary = document.getElementById('content-summary');
    const body = document.getElementById('content-body');
    const media = document.getElementById('content-media');
    if (section) state.contentForm.sectionSlug = section.value;
    if (type) state.contentForm.type = type.value;
    if (title) state.contentForm.title = title.value;
    if (summary) state.contentForm.summary = summary.value;
    if (body) state.contentForm.body = body.value;
    if (media) {
      const typed = media.value.trim();
      if (typed || !state.contentForm.mediaUrl) state.contentForm.mediaUrl = typed;
    }
  }

  function bindContent() {
    document.getElementById('content-type')?.addEventListener('change', () => {
      snapshotContentForm();
      render();
    });
    document.getElementById('content-section')?.addEventListener('change', () => {
      snapshotContentForm();
      if (state.contentForm.editId) return;
      if (state.contentForm.sectionSlug === 'podcasts' || state.contentForm.sectionSlug === 'questions') {
        state.contentForm.type = 'AUDIO';
        render();
      }
    });
    const audioInput = document.getElementById('content-audio-file');
    const audioPick = document.getElementById('content-pick-audio');
    if (audioPick && audioInput) {
      audioPick.onclick = () => audioInput.click();
      audioInput.onchange = async () => {
        const file = audioInput.files?.[0];
        if (!file) return;
        snapshotContentForm();
        state.uploading = true;
        state.contentForm.audioFileName = file.name;
        state.contentForm.type = 'AUDIO';
        state.status.content = '';
        render();
        try {
          const uploaded = await API.uploadAudio(file);
          state.contentForm.mediaUrl = uploaded.url || '';
          state.contentForm.audioFileName = file.name;
          state.status.content = uploaded.storage === 'bucket'
            ? 'Аудио в бакете. Можно публиковать.'
            : 'Аудио загружено. Можно публиковать.';
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          state.contentForm.mediaUrl = '';
          state.contentForm.audioFileName = '';
          state.status.content = code === 'AUDIO_TOO_LARGE'
            ? 'Файл больше 80 МБ'
            : code === 'UNSUPPORTED_AUDIO_TYPE'
              ? 'Нужен mp3 или m4a'
              : (code || 'Не удалось загрузить аудио');
        } finally {
          state.uploading = false;
          render();
        }
      };
    }
    const videoInput = document.getElementById('content-video-file');
    const videoPick = document.getElementById('content-pick-video');
    if (videoPick && videoInput) {
      videoPick.onclick = () => videoInput.click();
      videoInput.onchange = async () => {
        const file = videoInput.files?.[0];
        if (!file) return;
        snapshotContentForm();
        state.uploading = true;
        state.contentForm.audioFileName = file.name;
        if (state.contentForm.type === 'TEXT') state.contentForm.type = 'VIDEO';
        state.status.content = '';
        render();
        try {
          const uploaded = await API.uploadVideo(file);
          state.contentForm.mediaUrl = uploaded.url || '';
          state.status.content = 'Видео в бакете. Можно публиковать.';
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          state.status.content = contentStatusMessage(code);
        } finally {
          state.uploading = false;
          render();
        }
      };
    }
    document.getElementById('content-clear-audio')?.addEventListener('click', () => {
      snapshotContentForm();
      state.contentForm.mediaUrl = '';
      state.contentForm.audioFileName = '';
      render();
    });
    document.getElementById('content-cancel-edit')?.addEventListener('click', () => {
      state.contentForm = blankContentForm();
      state.status.content = '';
      render();
    });
    const contentQuery = document.getElementById('content-query');
    contentQuery?.addEventListener('input', (event) => { state.contentQuery = event.target.value; });
    contentQuery?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); snapshotContentForm(); render(); }
    });
    contentQuery?.addEventListener('blur', () => { snapshotContentForm(); render(); });
    document.getElementById('content-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      snapshotContentForm();
      state.contentForm.mediaUrl = normalizeAdminMediaUrl(state.contentForm.mediaUrl);
      const editing = Boolean(state.contentForm.editId);
      state.uploading = true;
      state.status.content = editing ? 'Сохраняем…' : 'Публикуем…';
      render();
      try {
        if (editing) await API.updateContent(state.contentForm.editId, contentPayload());
        else await API.createContent(contentPayload());
        state.contentForm = blankContentForm();
        state.status.content = editing ? 'Сохранили' : 'Материал появился в клубе';
        const data = await API.content();
        state.library = data.entries || [];
        state.librarySections = data.sections || [];
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        state.status.content = contentStatusMessage(code);
      } finally {
        state.uploading = false;
        render();
      }
    });
    app.querySelectorAll('[data-content-filter]').forEach((btn) => {
      btn.onclick = () => {
        snapshotContentForm();
        const next = btn.dataset.contentFilter;
        state.contentFilter = next;
        if (!state.contentForm.editId && next && next !== 'all') state.contentForm.sectionSlug = next;
        if (!state.contentForm.editId) {
          if (next === 'podcasts' || next === 'questions') state.contentForm.type = 'AUDIO';
          if (next === 'movies' || next === 'webinars' || next === 'home_reviews' || next === 'club_reviews') {
            state.contentForm.type = 'VIDEO';
          }
        }
        render();
      };
    });
    app.querySelectorAll('[data-edit-content]').forEach((btn) => {
      btn.onclick = () => {
        const entry = state.library.find((item) => item.id === btn.dataset.editContent);
        if (!entry) return;
        state.contentForm = {
          editId: entry.id,
          sectionSlug: entry.section?.slug || 'podcasts',
          title: entry.title || '',
          type: entry.type || 'VIDEO',
          summary: entry.summary || '',
          body: entry.transcript || entry.body || '',
          mediaUrl: entry.mediaUrl || '',
          coverUrl: entry.coverUrl || '',
          audioFileName: '',
        };
        state.contentFilter = entry.section?.slug || state.contentFilter;
        state.status.content = '';
        render();
        document.getElementById('content-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
    app.querySelectorAll('[data-stock-image]').forEach((btn) => {
      btn.onclick = () => {
        snapshotContentForm();
        state.contentForm.coverUrl = btn.dataset.stockImage;
        render();
      };
    });
    app.querySelectorAll('[data-del-content]').forEach((btn) => {
      btn.onclick = async () => {
        if (!window.confirm('Удалить материал из клуба?')) return;
        try {
          await API.deleteContent(btn.dataset.delContent);
          if (state.contentForm.editId === btn.dataset.delContent) {
            state.contentForm = blankContentForm();
          }
          state.library = state.library.filter((item) => item.id !== btn.dataset.delContent);
          state.status.content = 'Удалено';
          render();
        } catch (error) {
          state.status.content = error instanceof Error ? error.message : 'Не удалось удалить';
          render();
        }
      };
    });
  }

  function refreshUserTab() {
    const panel = document.querySelector('.tab-content');
    if (!panel) { render(); return; }
    const stats = document.querySelector('.admin-stats');
    if (stats) stats.outerHTML = renderStats();
    panel.innerHTML = renderTabContent();
    bindUsers();
  }

  async function afterUserChange(message) {
    state.status.user = message;
    try {
      [state.summary] = await Promise.all([API.summary(), reloadUsers()]);
    } catch { /* keep what we have */ }
    refreshUserTab();
  }

  function runUserAction(btn, working, run) {
    btn.disabled = true;
    const label = btn.textContent;
    btn.innerHTML = `${SPINNER}${working}`;
    run().catch((error) => {
      state.status.user = error instanceof Error ? mapUserError(error.message) : 'Не удалось обновить';
      btn.disabled = false;
      btn.textContent = label;
      refreshUserTab();
    });
  }

  function mapUserError(code) {
    return {
      TEAM_MEMBER: 'Команду удалять нельзя.',
      CANNOT_MODIFY_SELF: 'Себя менять нельзя.',
      USER_NOT_FOUND: 'Аккаунт уже удалён.',
    }[code] || code || 'Не удалось обновить';
  }

  function bindUsers() {
    const query = document.getElementById('user-query');
    const filter = document.getElementById('user-filter');
    const sort = document.getElementById('user-sort');
    const listEl = document.getElementById('user-card-list');
    const rerenderList = () => {
      state.userLimit = 40;
      if (listEl) listEl.innerHTML = renderUserList();
      bindUserCards();
    };
    let typingTimer = 0;
    query?.addEventListener('input', (event) => {
      state.userQuery = event.target.value;
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(rerenderList, 180);
    });
    filter?.addEventListener('change', (event) => {
      state.userFilter = event.target.value;
      rerenderList();
    });
    sort?.addEventListener('change', (event) => {
      state.userSort = event.target.value;
      rerenderList();
    });
    bindUserCards();
    bindCleanup();
  }

  function bindUserCards() {
    document.getElementById('user-more')?.addEventListener('click', () => {
      state.userLimit += 40;
      const listEl = document.getElementById('user-card-list');
      if (listEl) listEl.innerHTML = renderUserList();
      bindUserCards();
    });

    app.querySelectorAll('[data-manage]').forEach((btn) => {
      btn.onclick = () => {
        const panel = app.querySelector(`[data-manage-panel="${btn.dataset.manage}"]`);
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = open ? 'Скрыть управление' : 'Управление';
      };
    });

    app.querySelectorAll('[data-grant]').forEach((btn) => {
      btn.onclick = () => {
        const select = app.querySelector(`[data-grant-plan="${btn.dataset.grant}"]`);
        const [planCode, term] = (select?.value || 'club_30').split(':');
        const forever = term === 'forever';
        runUserAction(btn, 'Выдаём…', async () => {
          const data = await API.grantAccess(btn.dataset.grant, forever ? { planCode, forever } : { planCode });
          const given = data?.subscription;
          await afterUserChange(`${given?.forever
            ? 'Доступ выдан без срока, сам он не закончится.'
            : `Доступ выдан до ${fmtDate(given?.accessUntil)}.`} Если был блок, вход снова открыт.`);
        });
      };
    });

    app.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.onclick = () => {
        const entry = state.users.find((item) => item.id === btn.dataset.revoke);
        const active = entry ? activeSubsOf(entry) : [];
        const renews = active.some((item) => item.source === 'PRODAMUS');
        const question = `Забрать доступ: ${active.map(accessLabel).join(', ') || 'весь'}?`;
        const note = renews
          ? '\n\nОплата через Продамус при этом не отменяется: при следующем списании доступ вернётся сам. Чтобы списаний не было, подписку отменяют в Продамусе.'
          : '';
        if (!window.confirm(question + note)) return;
        runUserAction(btn, 'Забираем…', async () => {
          await API.revokeAccess(btn.dataset.revoke);
          await afterUserChange('Доступ забран.');
        });
      };
    });

    app.querySelectorAll('[data-role]').forEach((btn) => {
      btn.onclick = () => {
        const select = app.querySelector(`[data-role-select="${btn.dataset.role}"]`);
        const role = select?.value;
        if (!role) return;
        runUserAction(btn, 'Меняем…', async () => {
          await API.updateUser(btn.dataset.role, { role });
          await afterUserChange(`Роль обновлена: ${roleLabel(role)}.`);
        });
      };
    });

    app.querySelectorAll('[data-block]').forEach((btn) => {
      btn.onclick = () => {
        const blocked = btn.dataset.blocked !== '1';
        if (blocked && !window.confirm('Закрыть этому человеку вход в приложение?')) return;
        runUserAction(btn, blocked ? 'Блокируем…' : 'Снимаем блок…', async () => {
          await API.updateUser(btn.dataset.block, { blocked });
          await afterUserChange(blocked ? 'Вход закрыт.' : 'Блок снят.');
        });
      };
    });

    app.querySelectorAll('[data-delete-user]').forEach((btn) => {
      btn.onclick = () => {
        const card = app.querySelector(`[data-user-card="${btn.dataset.deleteUser}"]`);
        const name = card?.querySelector('.user-card-meta strong')?.textContent || 'этот аккаунт';
        if (!window.confirm(`Удалить ${name}? Его сообщения в чатах тоже пропадут. Оплаты останутся в истории. Отменить нельзя.`)) return;
        runUserAction(btn, 'Удаляем…', async () => {
          await API.deleteUser(btn.dataset.deleteUser);
          await afterUserChange('Аккаунт удалён.');
        });
      };
    });
  }

  async function bindCleanup() {
    document.getElementById('cleanup-load')?.addEventListener('click', async () => {
      state.cleanup.loading = true;
      refreshUserTab();
      try {
        state.cleanup.data = await API.cleanupPreview();
        state.cleanup.picked = state.cleanup.data.users.filter((item) => item.suggested).map((item) => item.id);
      } catch (error) {
        state.status.user = error instanceof Error ? error.message : 'Не удалось собрать список';
      } finally {
        state.cleanup.loading = false;
        refreshUserTab();
      }
    });

    app.querySelectorAll('[data-cleanup-pick]').forEach((box) => {
      box.onchange = () => {
        const id = box.dataset.cleanupPick;
        const picked = new Set(state.cleanup.picked);
        if (box.checked) picked.add(id); else picked.delete(id);
        state.cleanup.picked = [...picked];
        const apply = document.getElementById('cleanup-apply');
        if (apply && !state.cleanup.busy) apply.textContent = cleanupApplyLabel();
      };
    });
    document.getElementById('cleanup-all')?.addEventListener('click', () => {
      state.cleanup.picked = state.cleanup.data.users.map((item) => item.id);
      refreshUserTab();
    });
    document.getElementById('cleanup-none')?.addEventListener('click', () => {
      state.cleanup.picked = [];
      refreshUserTab();
    });
    document.getElementById('cleanup-stale')?.addEventListener('change', (event) => {
      state.cleanup.cancelStale = event.target.checked;
      const apply = document.getElementById('cleanup-apply');
      if (apply && !state.cleanup.busy) apply.textContent = cleanupApplyLabel();
    });
    document.getElementById('cleanup-close')?.addEventListener('click', () => {
      state.cleanup.data = null;
      state.cleanup.picked = [];
      refreshUserTab();
    });
    document.getElementById('cleanup-apply')?.addEventListener('click', async () => {
      const cancelStale = state.cleanup.cancelStale && state.cleanup.data?.stalePayments;
      if (!state.cleanup.picked.length && !cancelStale) return;
      if (!window.confirm(`${cleanupApplyLabel()}? Отменить нельзя.`)) return;
      state.cleanup.busy = true;
      refreshUserTab();
      try {
        const result = await API.cleanup({
          userIds: state.cleanup.picked,
          cancelStalePayments: Boolean(cancelStale),
        });
        state.cleanup.data = null;
        state.cleanup.picked = [];
        state.cleanup.busy = false;
        const parts = [];
        if (result.deleted) parts.push(`удалено ${result.deleted}`);
        if (result.cancelled) parts.push(`закрыто попыток оплаты ${result.cancelled}`);
        await afterUserChange(parts.length ? `Готово: ${parts.join(', ')}.` : 'Готово.');
      } catch (error) {
        state.cleanup.busy = false;
        state.status.user = error instanceof Error ? error.message : 'Не удалось выполнить очистку';
        refreshUserTab();
      }
    });
  }

  function bindAnnounce() {
    document.getElementById('announce-body')?.addEventListener('input', (event) => {
      state.announce.body = event.target.value;
    });
    document.getElementById('announce-pin')?.addEventListener('change', (event) => {
      state.announce.pin = event.target.checked;
    });
    document.getElementById('announce-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      state.announce.body = document.getElementById('announce-body').value;
      state.announce.pin = document.getElementById('announce-pin').checked;
      try {
        await API.announce({
          body: state.announce.body.trim(),
          roomSlug: 'posts',
          pin: state.announce.pin,
        });
        state.announce.body = '';
        state.status.announce = 'Опубликовано в чате Анонсы';
        await reloadChats();
        render();
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        const text = {
          FORBIDDEN: 'Анонсы из админки публикует только админ.',
          CHAT_ROOM_NOT_FOUND: 'Чат Анонсы не найден.',
          ANNOUNCE_INVALID: 'Проверьте текст. Он не должен быть пустым.',
        }[code];
        state.status.announce = text || code || 'Не удалось опубликовать анонс';
        render();
      }
    });
  }

  function bindMovies() {
    document.getElementById('movie-back')?.addEventListener('click', () => {
      state.selectedMovieId = '';
      render();
    });
    app.querySelectorAll('[data-open-movie]').forEach((btn) => {
      btn.onclick = () => {
        state.selectedMovieId = btn.dataset.openMovie;
        render();
      };
    });
    document.getElementById('movie-edit-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await API.updateMovie(state.selectedMovieId, {
          title: document.getElementById('movie-title').value.trim(),
          year: document.getElementById('movie-year').value.trim(),
          theme: document.getElementById('movie-theme').value.trim(),
          description: document.getElementById('movie-description').value.trim(),
          prompt: document.getElementById('movie-prompt').value.trim(),
        });
        state.status.movie = 'Фильм сохранён';
        const payload = await API.movies();
        state.movies = payload.movies || [];
        render();
      } catch (error) {
        state.status.movie = error instanceof Error ? error.message : 'Не удалось сохранить';
        render();
      }
    });
  }

  async function reloadFeedPosts() {
    const payload = await API.feedPosts();
    state.feedPosts = payload.posts || [];
  }

  async function reloadUsers() {
    const payload = await API.users();
    state.users = payload.users || [];
  }

  function bindPosts() {
    const editForm = document.getElementById('post-edit-form');
    if (editForm) {
      document.getElementById('post-back')?.addEventListener('click', () => {
        state.selectedPostId = '';
        state.status.post = '';
        render();
      });

      editForm.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await API.updatePost(state.selectedPostId, {
            title: document.getElementById('edit-post-title').value.trim() || null,
            body: document.getElementById('edit-post-body').value.trim(),
            imageUrl: document.getElementById('edit-post-image').value.trim() || null,
            videoUrl: document.getElementById('edit-post-video')?.value.trim() || null,
          });
          state.status.post = 'Пост сохранён';
          await reloadFeedPosts();
          render();
        } catch (error) {
          state.status.post = error instanceof Error ? error.message : 'Не удалось сохранить';
          render();
        }
      };

      document.getElementById('edit-post-delete')?.addEventListener('click', async () => {
        if (!window.confirm('Удалить этот пост вместе с комментариями?')) return;
        try {
          await API.deletePost(state.selectedPostId);
          state.selectedPostId = '';
          state.status.post = 'Пост удалён';
          state.summary = await API.summary();
          await reloadFeedPosts();
          render();
        } catch (error) {
          state.status.post = error instanceof Error ? error.message : 'Не удалось удалить пост';
          render();
        }
      });

      const editPost = selectedFeedPost();
      const setEditImage = (url) => {
        if (editPost) {
          // Keep unsaved text edits across the re-render.
          editPost.title = document.getElementById('edit-post-title')?.value ?? editPost.title;
          editPost.body = document.getElementById('edit-post-body')?.value ?? editPost.body;
          editPost.videoUrl = document.getElementById('edit-post-video')?.value ?? editPost.videoUrl;
          editPost.imageUrl = url;
        }
        const field = document.getElementById('edit-post-image');
        if (field) field.value = url;
        render();
      };

      app.querySelectorAll('[data-stock-image]').forEach((btn) => {
        btn.onclick = () => setEditImage(btn.dataset.stockImage);
      });

      const editFile = document.getElementById('edit-post-file');
      const editPick = document.getElementById('edit-post-pick-image');
      if (editPick && editFile) {
        editPick.onclick = () => editFile.click();
        editFile.onchange = async () => {
          const file = editFile.files?.[0];
          if (!file) return;
          state.uploading = true;
          state.status.post = '';
          render();
          try {
            const uploaded = await API.uploadImage(file);
            state.status.post = 'Картинка загружена, нажмите «Сохранить»';
            state.uploading = false;
            setEditImage(uploaded.url);
          } catch (error) {
            state.uploading = false;
            state.status.post = error instanceof Error ? error.message : 'Не удалось загрузить картинку';
            render();
          }
        };
      }

      document.getElementById('edit-post-clear-image')?.addEventListener('click', () => setEditImage(''));

      app.querySelectorAll('[data-del-comment]').forEach((btn) => {
        btn.onclick = async () => {
          if (!window.confirm('Удалить комментарий?')) return;
          try {
            await API.deleteComment(btn.dataset.delComment);
            state.status.post = 'Комментарий удалён';
            await reloadFeedPosts();
            render();
          } catch (error) {
            state.status.post = error instanceof Error ? error.message : 'Не удалось удалить комментарий';
            render();
          }
        };
      });
      return;
    }

    const form = document.getElementById('post-form');
    if (!form) return;

    form.onsubmit = async (event) => {
      event.preventDefault();
      state.post.title = document.getElementById('post-title').value;
      state.post.body = document.getElementById('post-body').value;
      state.post.videoUrl = document.getElementById('post-video')?.value.trim() || '';
      state.post.imageUrl = document.getElementById('post-image-url')?.value.trim() || state.post.imageUrl;
      state.status.post = '';
      try {
        await API.createPost({
          title: state.post.title.trim() || undefined,
          body: state.post.body.trim(),
          imageUrl: state.post.imageUrl || undefined,
          videoUrl: state.post.videoUrl || undefined,
        });
        state.post = { title: '', body: '', imageUrl: '', videoUrl: '', preview: '', fileName: '' };
        state.status.post = 'Пост опубликован в ленте';
        state.summary = await API.summary();
        await reloadFeedPosts();
        render();
      } catch (error) {
        state.status.post = error instanceof Error ? error.message : 'Ошибка публикации';
        render();
      }
    };

    const fileInput = document.getElementById('post-file');
    const pickBtn = document.getElementById('post-pick-image');
    if (pickBtn && fileInput) {
      pickBtn.onclick = () => fileInput.click();
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        snapshotPostForm();
        state.uploading = true;
        state.post.preview = URL.createObjectURL(file);
        state.post.fileName = file.name;
        state.status.post = '';
        render();
        try {
          const uploaded = await API.uploadImage(file);
          state.post.imageUrl = uploaded.url;
          state.status.post = 'Картинка загружена';
        } catch (error) {
          state.post.preview = '';
          state.post.imageUrl = '';
          state.post.fileName = '';
          state.status.post = error instanceof Error ? error.message : 'Не удалось загрузить картинку';
        } finally {
          state.uploading = false;
          render();
        }
      };
    }

    document.getElementById('post-title')?.addEventListener('input', (event) => {
      state.post.title = event.target.value;
    });
    document.getElementById('post-body')?.addEventListener('input', (event) => {
      state.post.body = event.target.value;
    });

    document.getElementById('post-clear-image')?.addEventListener('click', () => {
      snapshotPostForm();
      state.post.imageUrl = '';
      state.post.preview = '';
      state.post.fileName = '';
      render();
    });

    document.getElementById('post-image-url')?.addEventListener('input', (event) => {
      state.post.imageUrl = event.target.value;
      if (event.target.value) state.post.preview = '';
    });

    app.querySelectorAll('[data-stock-image]').forEach((btn) => {
      btn.onclick = () => {
        snapshotPostForm();
        state.post.imageUrl = btn.dataset.stockImage;
        state.post.preview = btn.dataset.stockImage;
        state.post.fileName = 'Готовая картинка';
        render();
      };
    });

    app.querySelectorAll('[data-open-post]').forEach((btn) => {
      btn.onclick = () => {
        state.selectedPostId = btn.dataset.openPost;
        state.status.post = '';
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    app.querySelectorAll('[data-del-post]').forEach((btn) => {
      btn.onclick = async () => {
        if (!window.confirm('Удалить этот пост?')) return;
        try {
          await API.deletePost(btn.dataset.delPost);
          state.status.post = 'Пост удалён';
          state.summary = await API.summary();
          await reloadFeedPosts();
          render();
        } catch (error) {
          state.status.post = error instanceof Error ? error.message : 'Не удалось удалить пост';
          render();
        }
      };
    });
  }

  function bindChats() {
    app.querySelectorAll('[data-open-room]').forEach((btn) => {
      btn.onclick = () => {
        state.selectedRoomId = btn.dataset.openRoom;
        state.status.chat = '';
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    document.getElementById('chat-back')?.addEventListener('click', () => {
      state.selectedRoomId = '';
      state.status.chat = '';
      render();
    });

    const canPost = document.getElementById('room-can-post');
    const premium = document.getElementById('room-premium');
    const room = selectedRoom();

    async function saveRoomFlags() {
      if (!room || !canPost || !premium) return;
      try {
        await API.updateChatRoom(room.id, {
          canPost: canPost.checked,
          isPremium: premium.checked,
        });
        state.status.chat = 'Настройки чата сохранены';
        await reloadChats();
        render();
      } catch (error) {
        state.status.chat = error instanceof Error ? error.message : 'Не удалось сохранить';
        render();
      }
    }

    canPost?.addEventListener('change', saveRoomFlags);
    premium?.addEventListener('change', saveRoomFlags);

    app.querySelectorAll('[data-edit-message]').forEach((btn) => {
      btn.onclick = async () => {
        const messageId = btn.dataset.editMessage;
        let current = '';
        state.chatRooms.forEach((item) => {
          const found = (item.messages || []).find((message) => message.id === messageId);
          if (found) current = found.body;
        });
        const body = window.prompt('Текст сообщения', current);
        if (body === null || !body.trim()) return;
        try {
          await API.updateChatMessage(messageId, { body: body.trim() });
          state.status.chat = 'Сообщение обновлено';
          await reloadChats();
          render();
        } catch (error) {
          state.status.chat = error instanceof Error ? error.message : 'Не удалось изменить сообщение';
          render();
        }
      };
    });

    app.querySelectorAll('[data-pin-message]').forEach((btn) => {
      btn.onclick = async () => {
        try {
          await API.updateChatMessage(btn.dataset.pinMessage, {
            isPinned: btn.dataset.pinned !== '1',
          });
          await reloadChats();
          render();
        } catch (error) {
          state.status.chat = error instanceof Error ? error.message : 'Не удалось обновить сообщение';
          render();
        }
      };
    });

    app.querySelectorAll('[data-del-message]').forEach((btn) => {
      btn.onclick = async () => {
        if (!window.confirm('Удалить это сообщение?')) return;
        try {
          await API.deleteChatMessage(btn.dataset.delMessage);
          state.status.chat = 'Сообщение удалено';
          await reloadChats();
          render();
        } catch (error) {
          state.status.chat = error instanceof Error ? error.message : 'Не удалось удалить сообщение';
          render();
        }
      };
    });
  }

  async function reloadChats() {
    const payload = await API.chatRooms();
    state.chatRooms = payload.rooms || [];
  }

  async function loadDashboard() {
    const [summary, users, payments, chats, feed, movies, content] = await Promise.all([
      API.summary(),
      API.users(),
      API.payments().catch(() => ({ payments: [] })),
      API.chatRooms(),
      API.feedPosts().catch(() => ({ posts: [] })),
      API.movies().catch(() => ({ movies: [] })),
      API.content().catch(() => ({ sections: [], entries: [] })),
    ]);
    state.summary = summary;
    state.users = users.users || [];
    state.payments = payments.payments || [];
    state.chatRooms = chats.rooms || [];
    state.feedPosts = feed.posts || [];
    state.movies = movies.movies || [];
    state.librarySections = content.sections || [];
    state.library = content.entries || [];
    state.live.ok = true;
  }

  function render() {
    if (!state.user) {
      renderLogin();
      return;
    }
    renderDashboard();
  }

  async function init() {
    await pingLive();
    try {
      if (!API.getToken()) {
        renderLogin();
        return;
      }
      const me = await API.me();
      if (!me.user || !['OWNER', 'ADMIN'].includes(me.user.role)) {
        API.clearToken();
        renderLogin();
        return;
      }
      state.user = me.user;
      await loadDashboard();
      render();
    } catch {
      API.clearToken();
      renderLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  }
})();
