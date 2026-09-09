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
    userFilter: 'all',
    paymentQuery: '',
    library: [],
    librarySections: [],
    contentForm: { sectionSlug: 'podcasts', title: '', summary: '', mediaUrl: '', type: 'VIDEO', coverUrl: '' },
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
    status: { post: '', chat: '', user: '', movie: '', announce: '', content: '', error: '' },
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
            <img src="${esc(url)}" alt="" />
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
          <label>Email<input id="login-email" placeholder="email команды" autocomplete="username" /></label>
          <label>Пароль<input id="login-password" type="password" autocomplete="current-password" /></label>
          <p class="error" id="login-error" hidden></p>
          <button type="submit">Войти</button>
        </div>
      </form>
    </div>`;

    document.getElementById('login-form').onsubmit = async (event) => {
      event.preventDefault();
      const error = document.getElementById('login-error');
      error.hidden = true;
      try {
        const payload = await API.login(
          document.getElementById('login-email').value.trim(),
          document.getElementById('login-password').value,
        );
        if (payload.user?.role === 'CURATOR') {
          API.clearToken();
          error.hidden = false;
          error.textContent = 'Админка только для админов. Анонсы публикуйте в приложении, в чате «Анонсы».';
          return;
        }
        if (!['OWNER', 'ADMIN'].includes(payload.user?.role)) {
          API.clearToken();
          throw new Error('FORBIDDEN');
        }
        state.user = payload.user;
        await loadDashboard();
        render();
      } catch {
        error.hidden = false;
        error.textContent = 'Неверный логин или нет прав администратора';
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
        [s.users, 'Пользователи'],
        [s.paidUsers, 'С доступом'],
        [s.newUsersWeek, 'Новые за неделю'],
        [s.messagesWeek, 'Сообщений за неделю'],
      ],
      announce: [[s.rooms, 'Чаты'], [s.paidUsers, 'С доступом']],
      posts: [[s.posts, 'Посты'], [s.users, 'Пользователи']],
      users: [[s.users, 'Пользователи'], [s.paidUsers, 'С оплатой']],
      payments: [[s.paidUsers, 'С оплатой'], [s.pendingPayments, 'Ждут оплату']],
      chats: [[s.rooms, 'Чаты'], [s.messagesWeek, 'Сообщений / 7дн']],
      movies: [[s.movies, 'Фильмы'], [s.content, 'Материалы']],
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
          <strong>${ops.prodamusReady ? 'Продамус готов' : ops.yookassaReady ? 'ЮKassa готова' : 'Оплата: ' + (ops.paymentProvider || 'mock')}</strong>
          <span>${ops.prodamusReady || ops.yookassaReady ? 'Боевые платежи включены' : 'Касса ещё не подключена'}</span>
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

  function filteredUsers() {
    const q = state.userQuery.trim().toLowerCase();
    return state.users.filter((entry) => {
      if (state.userFilter === 'paid' && entry.payStatus !== 'active') return false;
      if (state.userFilter === 'none' && entry.payStatus === 'active') return false;
      if (state.userFilter === 'blocked' && !entry.blockedAt) return false;
      if (state.userFilter === 'team' && !['OWNER', 'ADMIN', 'CURATOR'].includes(entry.role)) return false;
      if (!q) return true;
      return `${entry.name} ${entry.email} ${entry.phone || ''}`.toLowerCase().includes(q);
    });
  }

  function renderUsers() {
    const cards = filteredUsers().map((entry) => {
      const avatar = entry.avatarUrl || '';
      const pay = payLabel(entry.payStatus);
      const now = Date.now();
      const activeSubs = (entry.subscriptions || (entry.subscription ? [entry.subscription] : []))
        .filter((item) => item.active && item.accessUntil && new Date(item.accessUntil).getTime() > now);
      const payDetail = activeSubs.length
        ? activeSubs.map((item) => `${item.planName || 'Подписка'} · до ${fmtDate(item.accessUntil)}`).join(' · ')
        : (entry.lastPayment
          ? `${entry.lastPayment.planName || entry.lastPayment.provider} · ${entry.lastPayment.amountRub || '—'} ₽`
          : 'Без оплаты');
      return `<article class="user-card">
        <div class="user-card-head">
          <div class="admin-user-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" />` : esc((entry.name || '?')[0].toUpperCase())}</div>
          <div class="user-card-meta">
            <strong>${esc(entry.name)}${entry.hasYandex ? '<span class="admin-badge">Яндекс</span>' : ''}${entry.blockedAt ? '<span class="admin-badge" style="background:#c53d61">блок</span>' : ''}</strong>
            <span>${esc(entry.email)}</span>
            <span>${entry.phone ? esc(entry.phone) : 'Нет номера'}</span>
          </div>
          <span class="pay-pill ${pay.cls}">${pay.text}</span>
        </div>
        <div class="user-card-foot">
          <span>${esc(roleLabel(entry.role))}</span>
          <span>${esc(payDetail)}</span>
          <span>${fmtDate(entry.createdAt)}</span>
        </div>
        <div class="user-actions">
          <select data-grant-plan="${esc(entry.id)}">
            <option value="library_30">Медиатека. Теория</option>
            <option value="club_30">Клуб 30 дней</option>
            <option value="club_90">Клуб 90 дней</option>
            <option value="club_plus_30">Клуб Плюс</option>
          </select>
          <button type="button" class="ok-btn" data-grant="${esc(entry.id)}">Выдать доступ</button>
          <button type="button" class="ghost-btn" data-revoke="${esc(entry.id)}">Забрать доступ</button>
          ${roleChoices(entry).length ? `
          <select data-role-select="${esc(entry.id)}">
            ${roleChoices(entry).map((role) => `<option value="${role}" ${entry.role === role ? 'selected' : ''}>${esc(roleLabel(role))}</option>`).join('')}
          </select>
          <button type="button" class="ok-btn" data-role="${esc(entry.id)}">Назначить роль</button>` : ''}
          <button type="button" class="${entry.blockedAt ? 'ok-btn' : 'danger-btn'}" data-block="${esc(entry.id)}" data-blocked="${entry.blockedAt ? '1' : '0'}">
            ${entry.blockedAt ? 'Разблокировать' : 'Заблокировать'}
          </button>
        </div>
      </article>`;
    }).join('');

    return `<section class="admin-card tab-panel">
      <h2>Участники</h2>
      <p class="muted">Ниже весь список. Счётчик «С доступом» — у кого сейчас открыт продукт. «Медиатека. Теория» даёт 30 дней. Чтобы забрать доступ, выберите продукт и нажмите «Забрать доступ». «Заблокировать» полностью закрывает вход в приложение. Если выдать доступ заблокированному, блок снимается.</p>
      <div class="toolbar">
        <input id="user-query" value="${esc(state.userQuery)}" placeholder="Имя, почта или телефон" />
        <select id="user-filter">
          <option value="all" ${state.userFilter === 'all' ? 'selected' : ''}>Все</option>
          <option value="paid" ${state.userFilter === 'paid' ? 'selected' : ''}>С доступом</option>
          <option value="none" ${state.userFilter === 'none' ? 'selected' : ''}>Без оплаты</option>
          <option value="blocked" ${state.userFilter === 'blocked' ? 'selected' : ''}>Заблокированы</option>
          <option value="team" ${state.userFilter === 'team' ? 'selected' : ''}>Команда</option>
        </select>
      </div>
      ${state.status.user ? `<p class="status">${esc(state.status.user)}</p>` : ''}
      <div class="user-card-list">${cards || '<p class="muted">Никого не нашли</p>'}</div>
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
            <button type="button" data-open-post="${esc(post.id)}">Открыть</button>
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
        <p class="muted">Это публичная лента PWA, не чат. Картинка грузится на Timeweb.</p>
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
        <label>URL картинки<input id="edit-post-image" value="${esc(post.imageUrl || '')}" placeholder="https://…" /></label>
        ${stockImagePicker(post.imageUrl || '')}
        ${post.imageUrl ? `<div class="admin-image-preview"><img alt="" src="${esc(post.imageUrl)}" /></div>` : ''}
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

  function renderContent() {
    const f = state.contentForm;
    const sections = state.librarySections.length
      ? state.librarySections
      : [
        { slug: 'podcasts', title: 'Подкасты' },
        { slug: 'webinars', title: 'Эфиры и вебинары' },
        { slug: 'questions', title: 'Вопросы и ответы' },
        { slug: 'home_reviews', title: 'Разбор домашнего' },
        { slug: 'club_reviews', title: 'Разборы участниц клуба' },
        { slug: 'movies', title: 'Киноклуб' },
      ];
    const list = state.library.map((entry) => `
      <article class="feed-admin-card">
        <div class="feed-admin-top">
          <div>
            <strong>${esc(entry.title)}</strong>
            <span class="muted">${esc(entry.section?.title || '')} · ${esc(entry.type || '')}${entry.mediaUrl ? ` · ${/kinescope/i.test(entry.mediaUrl) ? 'Кинескоп' : 'ссылка'}` : ''}</span>
          </div>
          <div class="feed-admin-actions">
            <button type="button" class="danger-btn" data-del-content="${esc(entry.id)}">Удалить</button>
          </div>
        </div>
        ${entry.coverUrl ? `<img class="feed-admin-thumb" src="${esc(entry.coverUrl)}" alt="" />` : ''}
        ${entry.mediaUrl ? `<p class="muted">${esc(entry.mediaUrl)}</p>` : ''}
      </article>`).join('');

    return `<section class="admin-card tab-panel">
      <h2>Добавить в медиатеку</h2>
      <p class="muted">Видео: сначала Кинескоп, сюда ссылка kinescope.io. Аудио: прямая ссылка на mp3, не Яндекс.Диск. Раздел «Киноклуб» тоже здесь. Чтобы удалить материал, нажмите «Удалить» в списке ниже.</p>
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
        <label>Короткое описание<textarea id="content-summary" rows="3" placeholder="О чём материал">${esc(f.summary)}</textarea></label>
        <label>Ссылка на видео или аудио<input id="content-media" value="${esc(f.mediaUrl)}" placeholder="https://kinescope.io/..." /></label>
        <div class="image-attach">
          ${stockImagePicker(f.coverUrl, 'Картинка карточки в клубе')}
        </div>
        ${state.status.content ? `<p class="status">${esc(state.status.content)}</p>` : ''}
        <button type="submit">Опубликовать в клуб</button>
      </form>
    </section>
    <section class="admin-card tab-panel">
      <h2>Последние материалы</h2>
      <div class="feed-admin-list">${list || '<p class="muted">Пока ничего не добавляли</p>'}</div>
    </section>`;
  }

  function renderTabContent() {
    if (state.tab === 'overview') return renderOverview();
    if (state.tab === 'announce') return renderAnnounce();
    if (state.tab === 'content') return renderContent();
    if (state.tab === 'users') return renderUsers();
    if (state.tab === 'payments') return renderPayments();
    if (state.tab === 'chats') return selectedRoom() ? renderChatThread(selectedRoom()) : renderChatRoomList();
    if (state.tab === 'movies') return renderMovies();
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
          <button type="button" class="ghost-btn" id="movies-btn">Кино</button>
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

    document.getElementById('movies-btn')?.addEventListener('click', () => {
      state.tab = 'movies';
      state.selectedMovieId = '';
      render();
    });

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

    if (state.tab === 'posts') bindPosts();
    if (state.tab === 'chats') bindChats();
    if (state.tab === 'users') bindUsers();
    if (state.tab === 'payments') bindPayments();
    if (state.tab === 'content') bindContent();
    if (state.tab === 'announce') bindAnnounce();
    if (state.tab === 'movies') bindMovies();
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
    const media = document.getElementById('content-media');
    if (section) state.contentForm.sectionSlug = section.value;
    if (type) state.contentForm.type = type.value;
    if (title) state.contentForm.title = title.value;
    if (summary) state.contentForm.summary = summary.value;
    if (media) state.contentForm.mediaUrl = media.value.trim();
  }

  function bindContent() {
    document.getElementById('content-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      snapshotContentForm();
      try {
        await API.createContent(state.contentForm);
        state.contentForm = { ...state.contentForm, title: '', summary: '', mediaUrl: '', coverUrl: '' };
        state.status.content = 'Материал появился в клубе';
        const data = await API.content();
        state.library = data.entries || [];
        state.librarySections = data.sections || [];
        render();
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        state.status.content = code === 'YANDEX_DISK_LINK'
          ? 'Ссылка с Яндекс.Диска не подойдёт. Нужен Кинескоп или прямая ссылка на mp3.'
          : (code || 'Не удалось сохранить');
        render();
      }
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

  function bindUsers() {
    const query = document.getElementById('user-query');
    const filter = document.getElementById('user-filter');
    query?.addEventListener('input', (event) => { state.userQuery = event.target.value; });
    query?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); render(); }
    });
    query?.addEventListener('blur', () => render());
    filter?.addEventListener('change', (event) => {
      state.userFilter = event.target.value;
      render();
    });

    app.querySelectorAll('[data-grant]').forEach((btn) => {
      btn.onclick = async () => {
        const select = app.querySelector(`[data-grant-plan="${btn.dataset.grant}"]`);
        try {
          await API.grantAccess(btn.dataset.grant, { planCode: select?.value || 'library_30' });
          state.status.user = 'Доступ выдан. Если человек был в блоке, вход снова открыт.';
          await reloadUsers();
          state.summary = await API.summary();
          render();
        } catch (error) {
          state.status.user = error instanceof Error ? error.message : 'Не удалось выдать доступ — нужен деплой backend';
          render();
        }
      };
    });

    app.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.onclick = async () => {
        const select = app.querySelector(`[data-grant-plan="${btn.dataset.revoke}"]`);
        if (!window.confirm('Забрать доступ к выбранному продукту?')) return;
        try {
          await API.revokeAccess(btn.dataset.revoke, { planCode: select?.value || 'library_30' });
          state.status.user = 'Доступ забран';
          await reloadUsers();
          state.summary = await API.summary();
          render();
        } catch (error) {
          state.status.user = error instanceof Error ? error.message : 'Не удалось забрать доступ';
          render();
        }
      };
    });

    app.querySelectorAll('[data-role]').forEach((btn) => {
      btn.onclick = async () => {
        const select = app.querySelector(`[data-role-select="${btn.dataset.role}"]`);
        const role = select?.value;
        if (!role) return;
        try {
          await API.updateUser(btn.dataset.role, { role });
          state.status.user = `Роль обновлена: ${roleLabel(role)}`;
          await reloadUsers();
          render();
        } catch (error) {
          state.status.user = error instanceof Error ? error.message : 'Не удалось сменить роль — нужен деплой backend';
          render();
        }
      };
    });

    app.querySelectorAll('[data-block]').forEach((btn) => {
      btn.onclick = async () => {
        const blocked = btn.dataset.blocked !== '1';
        if (blocked && !window.confirm('Заблокировать участника?')) return;
        try {
          await API.updateUser(btn.dataset.block, { blocked });
          state.status.user = blocked ? 'Участник заблокирован' : 'Блок снят';
          await reloadUsers();
          render();
        } catch (error) {
          state.status.user = error instanceof Error ? error.message : 'Не удалось обновить';
          render();
        }
      };
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

      app.querySelectorAll('[data-stock-image]').forEach((btn) => {
        btn.onclick = () => {
          const field = document.getElementById('edit-post-image');
          if (field) field.value = btn.dataset.stockImage;
          app.querySelectorAll('[data-stock-image]').forEach((item) => {
            item.classList.toggle('is-active', item === btn);
          });
        };
      });

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
