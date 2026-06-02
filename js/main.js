/**
 * MYGO-MUJICA-WEB — main entry
 * Dark mode / Search / Markdown / Reading time / Progress bar / Comments
 */

// ── Markdown loader ──────────────────────────────────
let mdReady = false;
const mdPromise = new Promise(resolve => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  script.onload = () => { mdReady = true; resolve(); };
  script.onerror = () => { mdReady = false; resolve(); }; // degrade gracefully
  document.head.appendChild(script);
});

function renderMd(text) {
  if (!text) return '';
  if (mdReady && typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  // fallback: plain text with paragraph breaks
  return '<p>' + esc(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function readingTime(text) {
  if (!text) return 0;
  // Chinese: ~400 chars/min; English: ~200 words/min
  const cleaned = text.replace(/\s+/g, '');
  return Math.max(1, Math.ceil(cleaned.length / 400));
}

// ── Toast ────────────────────────────────────────────
function toast(msg, type) {
  let bar = document.getElementById('msgBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'msgBar';
    bar.className = 'msg-bar';
    document.body.appendChild(bar);
  }
  bar.textContent = msg;
  bar.className = 'msg-bar ' + (type || 'success') + ' show';
  clearTimeout(bar._t);
  bar._t = setTimeout(() => bar.classList.remove('show'), 2500);
}

// ── Dark mode ────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('mygo_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('mygo_theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('mygo_theme', 'dark');
  }
}

// ── Search ───────────────────────────────────────────
let searchIndex = [];

function buildSearchIndex() {
  searchIndex = [];
  Store.getLiterature().forEach(i => {
    searchIndex.push({ type: '文学创作', id: i.id, url: 'detail.html?type=lit&id=' + i.id, title: i.title, text: i.excerpt + ' ' + (i.content||'') });
  });
  Store.getProjects().forEach(i => {
    searchIndex.push({ type: '代码项目', id: i.id, url: 'detail.html?type=proj&id=' + i.id, title: i.name, text: i.desc + ' ' + (i.detail||'') + ' ' + (i.tags||[]).join(' ') });
  });
  const recs = Store.getRecommendations();
  const REC_LABELS = {literary:'严肃文学',popular:'流行文学',lightnovel:'轻小说',manga:'漫画',movie:'电影',drama:'电视剧',anime:'动画',music:'音乐'};
  Object.keys(REC_LABELS).forEach(cat => {
    (recs[cat] || []).forEach(i => {
      searchIndex.push({ type: '推荐 · ' + REC_LABELS[cat], id: i.id, url: 'detail.html?type=rec&id=' + i.id, title: i.title, text: (i.excerpt||'') + ' ' + (i.review||'') });
    });
  });
}

function doSearch(query) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  if (!query.trim()) {
    container.innerHTML = '<div class="search-hint">输入关键词搜索文章、项目、推荐...</div>';
    return;
  }
  const q = query.toLowerCase();
  const results = searchIndex.filter(item =>
    item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q)
  ).slice(0, 12);

  if (!results.length) {
    container.innerHTML = '<div class="search-none">没有找到相关内容</div>';
    return;
  }
  container.innerHTML = results.map(r => `
    <a href="${r.url}" class="search-result-item" onclick="closeSearch()">
      <div class="s-type">${esc(r.type)}</div>
      <div class="s-title">${esc(r.title)}</div>
      <div class="s-meta">${esc(r.text).slice(0, 80)}...</div>
    </a>
  `).join('');
}

function openSearch() {
  buildSearchIndex();
  document.getElementById('searchOverlay').classList.add('show');
  const inp = document.getElementById('searchInput');
  inp.value = '';
  document.getElementById('searchResults').innerHTML = '<div class="search-hint">输入关键词搜索文章、项目、推荐...</div>';
  setTimeout(() => inp.focus(), 100);
}

function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('show');
}

// ── Back to top ──────────────────────────────────────
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });
  btn.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));
}

// ── Reading progress ─────────────────────────────────
function initProgressBar() {
  const bar = document.getElementById('progressBar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + '%' : '0%';
  });
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initBackToTop();
  initProgressBar();

  const page = window.location.pathname.split('/').pop() || 'index.html';

  // Site info
  const info = Store.getSiteInfo();
  document.querySelectorAll('.site-title').forEach(el => {
    if (info.title) el.textContent = info.title;
  });
  document.title = info.title || 'MYGO-MUJICA-WEB';

  // Auth header
  renderAuthArea();
  renderAuthModal();

  // Nav highlight
  document.querySelectorAll('.site-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === 'detail.html' && href.includes('detail'))) {
      link.classList.add('active');
    }
  });

  // Wait for markdown parser
  await mdPromise;

  // Route
  if (page === 'index.html' || page === '') renderHomepage(info);
  else if (page === 'literature.html') renderLiterature();
  else if (page === 'projects.html') renderProjects();
  else if (page === 'recommendations.html') renderRecommendations();
  else if (page === 'detail.html') renderDetail();
});

// ═══════════════════════════════════════════════════════
//  AUTH UI
// ═══════════════════════════════════════════════════════
function userAvatarHtml(info) {
  if (!info) return '';
  if (info.avatar) {
    return `<img src="${esc(info.avatar)}" class="avatar" style="object-fit:cover;" onerror="this.outerHTML='<span class=\\'avatar\\'>${esc((info.nickname||info.username||'?')[0].toUpperCase())}</span>'">`;
  }
  return `<span class="avatar">${esc((info.nickname || info.username || '?')[0].toUpperCase())}</span>`;
}

function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const info = Store.getCurrentUserInfo();
  const isMod = Store.isModerator();
  const isAdm = !isMod && Store.isAdmin();

  const themeIcon = (document.documentElement.getAttribute('data-theme')==='dark') ? '☀️' : '🌙';

  const extras = `
    <button class="search-toggle" onclick="openSearch()" title="搜索">🔍</button>
    <button class="theme-toggle" onclick="toggleTheme();renderAuthArea();" title="切换主题">${themeIcon}</button>`;

  let adminBtn = '';
  if (isMod) {
    adminBtn = `<button class="auth-btn" onclick="window.openAdminPanel()" style="border-color:#e6a817;color:#e6a817;" title="编辑器">✎ 版主</button>`;
  } else if (isAdm) {
    adminBtn = `<button class="auth-btn" onclick="window.openAdminPanel()" style="border-color:var(--accent);color:var(--accent);" title="社区管理">🛡️ 管理</button>`;
  }

  let notifBell = '';
  if (info) {
    const count = Store.unreadNotificationCount(info.username);
    if (count > 0) {
      notifBell = `<button class="theme-toggle" onclick="showNotifications()" title="${count}条新通知" style="position:relative;">🔔<span style="position:absolute;top:-2px;right:-2px;background:var(--danger);color:#fff;font-size:0.6rem;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${count>9?'9+':count}</span></button>`;
    }
  }

  if (info) {
    area.innerHTML = extras + notifBell + adminBtn + `
      <div class="user-menu" id="userMenu">
        ${userAvatarHtml(info)}
        <span>${esc(info.nickname || info.username)}</span>
        <div class="user-dropdown" id="userDropdown">
          <button onclick="showProfileModal()">编辑资料</button>
          <button onclick="Store.adminLogout();Store.logout();location.reload();">退出所有登录</button>
          <button onclick="Store.logout();location.reload();">退出用户</button>
        </div>
      </div>`;
    document.getElementById('userMenu').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('userDropdown').classList.toggle('show');
    });
    document.addEventListener('click', () => {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.classList.remove('show');
    });
  } else {
    area.innerHTML = extras + adminBtn + `<button class="auth-btn" onclick="showAuthModal('login')">登录</button>`;
  }
}

const SECRET_KEYS = ['togawa', 'sakiko', '200606'];
let authRole = 'user'; // 'user' | 'admin' | 'moderator'

function renderAuthModal() {
  const box = document.getElementById('authModalBox');
  if (!box) return;

  // All-in-one: role selector + all forms
  box.innerHTML = `
    <!-- Step 0: Role Selector -->
    <div id="roleSelect">
      <h2>选择登录身份</h2>
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin:1rem 0;">
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.65rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.95rem;width:100%;" onclick="selectAuthRole('user')">👤 普通用户</button>
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.65rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.95rem;width:100%;" onclick="selectAuthRole('admin')">🛡️ 管理员</button>
        <button class="btn btn-primary" style="background:#b392d9;color:#fff;border:none;padding:0.65rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.95rem;width:100%;" onclick="selectAuthRole('moderator')">✎ 版主</button>
      </div>
      <p class="switch-text">已有账号？<a onclick="selectAuthRole('user')">直接登录</a></p>
    </div>

    <!-- Step 1a: User Login -->
    <div id="userLoginForm" style="display:none;">
      <h2>👤 普通用户登录</h2>
      <div class="msg" id="loginMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="loginUsername"></div>
      <div class="form-group"><label>密码</label><input type="password" id="loginPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doLogin()">登录</button>
      <p class="switch-text">没有账号？<a onclick="showAuthSubForm('userRegister')">立即注册</a> &nbsp; <a onclick="showAuthSubForm('roleSelect')">返回选择</a></p>
    </div>

    <!-- Step 1b: User Register -->
    <div id="userRegisterForm" style="display:none;">
      <h2>👤 普通用户注册</h2>
      <div class="msg" id="registerMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="regUsername"></div>
      <div class="form-group"><label>密码（至少3位）</label><input type="password" id="regPassword"></div>
      <div class="form-group"><label>昵称（可选）</label><input type="text" id="regNickname"></div>
      <div class="form-group"><label>头像URL（可选）</label><input type="text" id="regAvatar" placeholder="https://..."></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doRegister()">注册</button>
      <p class="switch-text">已有账号？<a onclick="showAuthSubForm('userLogin')">去登录</a></p>
    </div>

    <!-- Step 2a: Staff Key Gate -->
    <div id="staffKeyForm" style="display:none;">
      <h2>🔑 管理员/版主验证</h2>
      <div class="msg" id="staffKeyMsg"></div>
      <div class="form-group"><label>请输入密钥</label><input type="password" id="staffKeyInput" placeholder="输入密钥"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="verifyStaffKey()">验证</button>
      <p class="switch-text"><a onclick="showAuthSubForm('roleSelect')">返回选择</a></p>
    </div>

    <!-- Step 2b: Staff Login -->
    <div id="staffLoginForm" style="display:none;">
      <h2 id="staffLoginTitle">工作人员登录</h2>
      <div class="msg" id="staffLoginMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="staffLoginUsername"></div>
      <div class="form-group"><label>密码</label><input type="password" id="staffLoginPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doStaffLogin()">登录</button>
      <p class="switch-text" id="staffLoginLinks">
        <span id="staffRegLinkWrapper"><a onclick="showAuthSubForm('staffRegister')">注册</a> &nbsp;</span>
        <a onclick="showAuthSubForm('roleSelect')">返回选择</a>
      </p>
    </div>

    <!-- Step 2c: Staff Register (moderator only) -->
    <div id="staffRegisterForm" style="display:none;">
      <h2>注册版主</h2>
      <div class="msg" id="staffRegMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="staffRegUsername"></div>
      <div class="form-group"><label>密码（至少3位）</label><input type="password" id="staffRegPassword"></div>
      <div class="form-group"><label>昵称（可选）</label><input type="text" id="staffRegNickname"></div>
      <div class="form-group"><label>头像URL（可选）</label><input type="text" id="staffRegAvatar" placeholder="https://..."></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doStaffRegister()">注册</button>
      <p class="switch-text"><a onclick="showAuthSubForm('staffLogin')">返回登录</a></p>
    </div>`;
}

function showAuthModal(type) {
  authRole = 'user';
  document.getElementById('authModal').classList.add('show');
  showAuthSubForm('roleSelect');
}

function showAuthSubForm(formId) {
  ['roleSelect','userLoginForm','userRegisterForm','staffKeyForm','staffLoginForm','staffRegisterForm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const el = document.getElementById(formId);
  if (el) el.style.display = '';
  // Clear messages
  document.querySelectorAll('#authModalBox .msg').forEach(m => { m.textContent = ''; m.className = 'msg'; });
}

function selectAuthRole(role) {
  authRole = role;
  if (role === 'user') {
    showAuthSubForm('userLogin');
  } else if (role === 'moderator') {
    document.getElementById('staffLoginTitle').textContent = '版主登录';
    document.getElementById('staffRegLinkWrapper').style.display = '';
    showAuthSubForm('staffKey'); // only moderator needs key
  } else {
    // admin: no key needed, go directly to login, no self-registration
    document.getElementById('staffLoginTitle').textContent = '管理员登录';
    document.getElementById('staffRegLinkWrapper').style.display = 'none';
    showAuthSubForm('staffLogin');
  }
}

function hideAuthModal() { document.getElementById('authModal').classList.remove('show'); }
document.addEventListener('click', e => { if (e.target.id === 'authModal') hideAuthModal(); });

// ── User login/register ───────────────────────────────
function doLogin() {
  const msg = document.getElementById('loginMsg');
  const result = Store.login(
    document.getElementById('loginUsername').value.trim(),
    document.getElementById('loginPassword').value
  );
  if (result.ok) {
    msg.textContent = '登录成功'; msg.className = 'msg success';
    setTimeout(() => location.reload(), 500);
  } else {
    msg.textContent = result.msg; msg.className = 'msg error';
  }
}

function doRegister() {
  const msg = document.getElementById('registerMsg');
  const result = Store.register(
    document.getElementById('regUsername').value.trim(),
    document.getElementById('regPassword').value,
    {
      nickname: document.getElementById('regNickname').value.trim(),
      avatar: document.getElementById('regAvatar').value.trim()
    }
  );
  if (result.ok) {
    msg.textContent = '注册成功，请登录'; msg.className = 'msg success';
    setTimeout(() => showAuthModal('login'), 800);
  } else {
    msg.textContent = result.msg; msg.className = 'msg error';
  }
}

// ── Staff key / login / register ──────────────────────
function verifyStaffKey() {
  const input = document.getElementById('staffKeyInput').value.trim().toLowerCase();
  const msg = document.getElementById('staffKeyMsg');
  if (SECRET_KEYS.includes(input)) {
    msg.textContent = '验证通过'; msg.className = 'msg success';
    setTimeout(() => showAuthSubForm('staffLogin'), 500);
  } else {
    msg.textContent = '密钥错误'; msg.className = 'msg error';
  }
}

function doStaffLogin() {
  const username = document.getElementById('staffLoginUsername').value.trim();
  const password = document.getElementById('staffLoginPassword').value;
  const msg = document.getElementById('staffLoginMsg');

  let result;
  if (authRole === 'moderator') {
    result = Store.moderatorLogin(username, password);
  } else {
    result = Store.adminLoginUser(username, password);
  }

  if (result.ok) {
    msg.textContent = '登录成功'; msg.className = 'msg success';
    setTimeout(() => {
      hideAuthModal();
      renderAuthArea();
      if (authRole === 'moderator' && typeof openAdminPanel === 'function') {
        window.openAdminPanel();
      } else if (authRole === 'admin' && typeof openAdminPanel === 'function') {
        window.openAdminPanel();
      }
    }, 400);
  } else {
    msg.textContent = result.msg; msg.className = 'msg error';
  }
}

function doStaffRegister() {
  const username = document.getElementById('staffRegUsername').value.trim();
  const password = document.getElementById('staffRegPassword').value;
  const msg = document.getElementById('staffRegMsg');
  const opts = {
    nickname: document.getElementById('staffRegNickname').value.trim(),
    avatar: document.getElementById('staffRegAvatar').value.trim()
  };

  let result;
  if (authRole === 'moderator') {
    result = Store.registerModerator(username, password, opts);
  } else {
    result = Store.registerAdmin(username, password, opts);
  }

  if (result.ok) {
    msg.textContent = '注册成功，请登录'; msg.className = 'msg success';
    setTimeout(() => showAuthSubForm('staffLogin'), 800);
  } else {
    msg.textContent = result.msg; msg.className = 'msg error';
  }
}

// ── Notifications ────────────────────────────────────
function showNotifications() {
  const info = Store.getCurrentUserInfo();
  if (!info) return;
  const notifs = Store.getNotifications(info.username);
  Store.markNotificationsRead(info.username);

  let overlay = document.getElementById('notifModal');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'notifModal';
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-box" style="position:relative;max-width:420px;">
      <h2>通知</h2>
      <div style="max-height:60vh;overflow-y:auto;">
        ${notifs.length ? notifs.reverse().map(n => `
          <div style="padding:0.6rem 0;border-bottom:1px solid var(--border);font-size:0.88rem;font-family:var(--font-ui);">
            <div>${esc(n.message)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">${n.date}</div>
          </div>
        `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:1.5rem;">暂无通知</p>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); renderAuthArea(); }
  });
  renderAuthArea();
}

// ── Profile modal ────────────────────────────────────
function showProfileModal() {
  const info = Store.getCurrentUserInfo();
  if (!info) return;
  let overlay = document.getElementById('profileModal');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'profileModal';
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-box" style="position:relative;">
      <h2>编辑资料</h2>
      <div class="msg" id="profileMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" value="${esc(info.username)}" disabled style="opacity:0.6;"></div>
      <div class="form-group"><label>昵称</label><input type="text" id="profileNickname" value="${esc(info.nickname||info.username)}"></div>
      <div class="form-group"><label>头像URL</label><input type="text" id="profileAvatar" value="${esc(info.avatar||'')}" placeholder="https://... 留空使用字母头像"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" id="profileSaveBtn">保存</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById('profileSaveBtn').addEventListener('click', () => {
    const result = Store.updateProfile(info.username, {
      nickname: document.getElementById('profileNickname').value.trim(),
      avatar: document.getElementById('profileAvatar').value.trim()
    });
    const msg = document.getElementById('profileMsg');
    if (result.ok) {
      msg.textContent = '已保存'; msg.className = 'msg success';
      setTimeout(() => { overlay.remove(); renderAuthArea(); }, 600);
    } else {
      msg.textContent = result.msg; msg.className = 'msg error';
    }
  });
}

// ═══════════════════════════════════════════════════════
//  HOME
// ═══════════════════════════════════════════════════════
function renderHomepage(info) {
  const p = document.querySelector('.hero p');
  if (p && info.subtitle) p.textContent = info.subtitle;
}

// ═══════════════════════════════════════════════════════
//  LITERATURE LIST
// ═══════════════════════════════════════════════════════
let litPage = 1;
let litFilterCat = 'all';
const PAGE_SIZE = 8;

function renderLiterature() {
  const list = document.getElementById('lit-list');
  const filterArea = document.getElementById('lit-filter');
  const loadMoreArea = document.getElementById('lit-load-more');
  if (!list) return;

  const items = Store.getLiterature();

  // Collect categories
  const cats = [...new Set(items.map(i => i.category || '未分类').filter(Boolean))];

  // Render filter chips
  if (filterArea && cats.length > 0) {
    filterArea.innerHTML = `
      <button class="cat-chip ${litFilterCat==='all'?'active':''}" onclick="filterLit('all')">全部</button>
      ${cats.map(c => `<button class="cat-chip ${litFilterCat===c?'active':''}" onclick="filterLit('${esc(c)}')">${esc(c)}</button>`).join('')}`;
  }

  // Filter
  let filtered = items;
  if (litFilterCat !== 'all') {
    filtered = items.filter(i => (i.category || '未分类') === litFilterCat);
  }
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  // Paginate
  const total = filtered.length;
  const paged = filtered.slice(0, litPage * PAGE_SIZE);

  list.innerHTML = paged.length ? paged.map(i => {
    const avg = Store.avgRating('lit', i.id);
    const rt = readingTime(i.content || i.excerpt);
    const likeCount = Store.getLikeCount('lit', i.id);
    return `
    <li class="article-item">
      <time>${esc(i.date)}</time>
      ${i.category ? `<span class="tag-dot">#${esc(i.category)}</span>` : ''}
      ${(i.tags||[]).map(t => `<span class="tag-dot">${esc(t)}</span>`).join('')}
      <h3><a href="detail.html?type=lit&id=${i.id}">${esc(i.title)}</a></h3>
      <p class="excerpt">${esc(i.excerpt)}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <span class="reading-time">阅读约 ${rt} 分钟</span>
        <span>
          ${likeCount > 0 ? `<span style="font-size:0.8rem;color:var(--danger);margin-right:0.5rem;">❤️ ${likeCount}</span>` : ''}
          <a href="detail.html?type=lit&id=${i.id}#comments" style="font-size:0.82rem;color:var(--accent);text-decoration:none;font-family:var(--font-ui);">
            ${avg > 0 ? `<span class="rating-badge" style="margin-right:0.2rem;"><span class="star-icon">★</span> ${avg}</span>` : ''}评价 →
          </a>
        </span>
      </div>
    </li>`;
  }).join('') : '<p style="color:var(--text-muted);">该分类暂无文章。</p>';

  // Load more button
  if (loadMoreArea) {
    if (total > litPage * PAGE_SIZE) {
      loadMoreArea.innerHTML = `<button class="load-more-btn" onclick="loadMoreLit()">加载更多 (${total - litPage * PAGE_SIZE} 篇)</button>`;
    } else {
      loadMoreArea.innerHTML = '';
    }
  }
}

window.filterLit = function(cat) {
  litFilterCat = cat;
  litPage = 1;
  renderLiterature();
};

window.loadMoreLit = function() {
  litPage++;
  renderLiterature();
};

// ═══════════════════════════════════════════════════════
//  PROJECTS LIST
// ═══════════════════════════════════════════════════════
function renderProjects() {
  const list = document.getElementById('proj-list');
  if (!list) return;
  const items = Store.getProjects();
  list.innerHTML = items.length ? items.map(i => {
    const avg = Store.avgRating('proj', i.id);
    return `
    <div class="project-card">
      <h3><a href="detail.html?type=proj&id=${i.id}">${esc(i.name)}</a>${i.link ? ` <a href="${esc(i.link)}" target="_blank" style="font-size:0.75rem;color:var(--accent);">↗</a>` : ''}</h3>
      <p>${esc(i.desc)}</p>
      <div class="tech-tags">${(i.tags || []).map(t => `<span class="tech-tag">${esc(t)}</span>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.65rem;">
        <a href="detail.html?type=proj&id=${i.id}#comments" style="font-size:0.82rem;color:var(--accent);text-decoration:none;font-family:var(--font-ui);">
          ${avg > 0 ? `<span class="rating-badge" style="margin-right:0.2rem;"><span class="star-icon">★</span> ${avg}</span>` : ''}评价 →
        </a>
      </div>
    </div>`;
  }).join('') : '<p style="color:var(--text-muted);">暂无项目，去 <a href="admin.html">管理后台</a> 添加吧。</p>';
}

// ═══════════════════════════════════════════════════════
//  RECOMMENDATIONS LIST
// ═══════════════════════════════════════════════════════
function renderRecommendations() {
  const all = Store.getRecommendations();

  const CATEGORIES = [
    { key: 'literary',  label: '严肃文学', icon: '📖' },
    { key: 'popular',   label: '流行文学', icon: '📚' },
    { key: 'lightnovel',label: '轻小说',   icon: '📙' },
    { key: 'manga',     label: '漫画',     icon: '📘' },
    { key: 'movie',     label: '电影',     icon: '🎬' },
    { key: 'drama',     label: '电视剧',   icon: '📺' },
    { key: 'anime',     label: '动画',     icon: '🎞️' },
    { key: 'music',     label: '音乐',     icon: '🎵' }
  ];

  function recGrid(items) {
    if (!items.length) return '<p style="color:var(--text-muted);font-size:0.9rem;">暂无</p>';
    return '<div class="rec-grid">' + items.map(i => {
      const avg = Store.avgRating('rec', i.id);
      return `
      <div class="rec-item">
        <a href="detail.html?type=rec&id=${i.id}">
          ${i.cover ? `<img class="rec-cover" src="${esc(i.cover)}" alt="${esc(i.title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <h4>${esc(i.title)}</h4>
          <p class="meta">${esc(i.creator || '')}${i.year ? ' · ' + esc(i.year) : ''}</p>
          <p>${esc(i.excerpt || i.review || '').slice(0, 80)}${(i.excerpt || i.review || '').length > 80 ? '…' : ''}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.4rem;">
            <span style="font-size:0.8rem;color:var(--accent);font-family:var(--font-ui);">
              ${avg > 0 ? `<span class="rating-badge" style="margin-right:0.2rem;"><span class="star-icon">★</span> ${avg}</span>` : ''}评价 →
            </span>
          </div>
        </a>
      </div>`;
    }).join('') + '</div>';
  }

  CATEGORIES.forEach(cat => {
    const el = document.getElementById('rec-' + cat.key);
    if (el) el.innerHTML = recGrid(all[cat.key] || []);
  });
}

// ═══════════════════════════════════════════════════════
//  DETAIL PAGE
// ═══════════════════════════════════════════════════════
function renderDetail() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');
  const container = document.getElementById('detailContent');
  if (!container) return;

  if (!type || !id) { container.innerHTML = '<p>无效链接。</p>'; return; }

  let backUrl, title, byline, bodyHtml, item, coverUrl = '';

  if (type === 'lit') {
    item = Store.getLitById(id);
    backUrl = 'literature.html';
  } else if (type === 'proj') {
    item = Store.getProjById(id);
    backUrl = 'projects.html';
  } else if (type === 'rec') {
    const result = Store.getRecById(id);
    item = result ? result.item : null;
    backUrl = 'recommendations.html';
  }

  if (!item) { container.innerHTML = '<p>内容不存在或已被删除。</p>'; return; }

  if (type === 'lit') {
    title = item.title;
    byline = item.date;
    bodyHtml = renderMd(item.content || item.excerpt);
  } else if (type === 'proj') {
    title = item.name;
    byline = (item.tags || []).join(' · ');
    bodyHtml = renderMd(item.detail || item.desc);
    if (item.link) {
      bodyHtml += `<p style="margin-top:1rem;"><a href="${esc(item.link)}" target="_blank" style="color:var(--accent);">🔗 项目链接 →</a></p>`;
    }
  } else if (type === 'rec') {
    title = item.title;
    byline = (item.creator || '') + (item.year ? ' · ' + item.year : '');
    coverUrl = item.cover || '';
    bodyHtml = renderMd(item.review || item.excerpt || '');
  }

  const avg = Store.avgRating(type, id);
  const allComments = Store.getComments(type, id);
  const commentCount = allComments.length;
  const rt = readingTime((item.content || item.excerpt || item.review || item.detail || item.desc || ''));
  const liked = Store.hasLiked(type, id);
  const likeCount = Store.getLikeCount(type, id);

  // Generate TOC from Markdown content
  const rawText = (item.content || item.review || item.detail || item.desc || '');
  const tocHtml = buildTOC(rawText);

  container.innerHTML = `
    <a href="${backUrl}" class="detail-back">← 返回列表</a>
    ${tocHtml}
    <div class="detail-article">
      <h1>${esc(title)}</h1>
      <p class="byline">
        <span>${esc(byline)}</span>
        <span class="read-time">阅读约 ${rt} 分钟</span>
        ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}<span style="font-weight:400;font-size:0.8rem;color:var(--text-muted);margin-left:0.3rem;">(${commentCount}评)</span></span>` : ''}
        <button class="like-btn ${liked?'liked':''}" id="likeBtn" onclick="toggleLikeBtn('${type}','${id}')">
          ${liked ? '❤️' : '🤍'} <span id="likeCount">${likeCount || ''}</span>
        </button>
      </p>
      ${coverUrl ? `<img class="cover-img" src="${esc(coverUrl)}" alt="${esc(title)}" onerror="this.style.display='none'">` : ''}
      <div class="body">${bodyHtml}</div>
    </div>`;

  // Load highlight.js for code blocks
  loadHighlightJs();

  renderComments(type, id);
  document.title = title + ' — ' + (Store.getSiteInfo().title || 'MYGO-MUJICA-WEB');
}

// ── TOC Builder ──────────────────────────────────────
function buildTOC(md) {
  const headings = [];
  const lines = md.split('\n');
  lines.forEach(line => {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  });
  if (headings.length < 2) return '';

  let html = '<details class="toc-container"><summary>📑 目录</summary><ul class="toc-list">';
  headings.forEach((h, i) => {
    const id = 'toc-' + i;
    html += `<li class="toc-h${h.level}"><a href="#${id}">${esc(h.text)}</a></li>`;
  });
  html += '</ul></details>';
  return html;
}

// Ensure headings have IDs for TOC linking
// Called after markdown is rendered
function anchorHeadings() {
  const body = document.querySelector('.detail-article .body');
  if (!body) return;
  const headings = body.querySelectorAll('h1, h2, h3');
  headings.forEach((h, i) => { if (!h.id) h.id = 'toc-' + i; });
}

// ── Highlight.js loader ──────────────────────────────
function loadHighlightJs() {
  if (document.querySelector('link[href*="highlight"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css';
  document.head.appendChild(link);

  const darkLink = document.createElement('link');
  darkLink.rel = 'stylesheet';
  darkLink.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css';
  darkLink.media = '(prefers-color-scheme: dark)';
  document.head.appendChild(darkLink);

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js';
  script.onload = () => {
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('.body pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
    anchorHeadings();
  };
  script.onerror = () => { anchorHeadings(); };
  document.head.appendChild(script);

  // Fallback: anchor headings even if highlight fails
  setTimeout(() => anchorHeadings(), 1500);
}

// ── Like button ──────────────────────────────────────
window.toggleLikeBtn = function(type, id) {
  const result = Store.toggleLike(type, id);
  if (!result.ok) { alert(result.msg); return; }
  const btn = document.getElementById('likeBtn');
  const countEl = document.getElementById('likeCount');
  if (btn) {
    btn.className = 'like-btn ' + (result.liked ? 'liked' : '');
    btn.innerHTML = (result.liked ? '❤️' : '🤍') + ' <span id="likeCount">' + (Store.getLikeCount(type, id) || '') + '</span>';
  }
};

// ═══════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════
function renderComments(type, id) {
  const formArea = document.getElementById('commentFormArea');
  const listArea = document.getElementById('commentList');
  if (!formArea || !listArea) return;

  const loggedIn = Store.isLoggedIn();

  if (loggedIn) {
    formArea.innerHTML = `
      <div class="comment-form">
        <div class="row">
          <textarea id="commentText" placeholder="写下你的评论..."></textarea>
          <div class="rating-input">
            <label>评分</label>
            <input type="number" id="commentRating" value="7.0" min="0" max="10" step="0.1" placeholder="0.0-10.0">
          </div>
          <button class="submit-btn" onclick="submitComment('${type}','${id}')">发表</button>
        </div>
        <div class="msg" id="commentMsg"></div>
      </div>`;
  } else {
    formArea.innerHTML = `
      <div class="comment-login-hint">
        <a onclick="showAuthModal('login')">登录</a> 后即可评论和打分
      </div>`;
  }

  const allComments = Store.getComments(type, id);
  const topLevel = allComments.filter(c => !c.parentId);
  const currentUser = Store.getCurrentUser();
  const canDeleteAny = Store.isAdmin();

  listArea.innerHTML = topLevel.length ? topLevel.map(c =>
    renderCommentItem(c, allComments, type, id, currentUser, canDeleteAny)
  ).join('') : '<p class="no-comments">暂无评论，成为第一个评价的人吧。</p>';
}

function renderCommentItem(c, allComments, type, id, currentUser, canDeleteAny, depth = 0) {
  const displayName = esc(c.authorNickname || c.author);
  const avatarHtml = c.authorAvatar
    ? `<img src="${esc(c.authorAvatar)}" class="c-avatar-img" onerror="this.outerHTML='<span class=\\'c-avatar\\'>${esc(displayName[0].toUpperCase())}</span>'">`
    : `<span class="c-avatar">${esc(displayName[0].toUpperCase())}</span>`;

  const replies = allComments.filter(r => r.parentId === c.id);
  const showReplyForm = Store.isLoggedIn() && depth < 2;

  let html = `
    <div class="comment-item" id="comment-${c.id}">
      <div class="c-header">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          ${avatarHtml}
          <span class="c-author">${displayName}</span>
          ${c.parentId ? `<span style="font-size:0.72rem;color:var(--text-muted);">回复</span>` : ''}
        </div>
        ${c.rating > 0 ? `<span class="c-rating">★ ${c.rating}</span>` : ''}
      </div>
      <div class="c-content">${esc(c.content)}</div>
      <div class="c-footer">
        <span>${c.date}</span>
        <span>
          ${showReplyForm ? `<button class="comment-reply-btn" onclick="toggleReplyForm('${c.id}')">回复</button>` : ''}
          ${(currentUser === c.author || canDeleteAny) ? `<button class="c-delete" onclick="deleteComment('${type}','${id}','${c.id}')">删除</button>` : ''}
        </span>
      </div>
      <div id="reply-form-${c.id}"></div>
    </div>`;

  // Render child replies
  if (replies.length) {
    html += '<div class="comment-replies">';
    replies.forEach(r => {
      html += renderCommentItem(r, allComments, type, id, currentUser, canDeleteAny, depth + 1);
    });
    html += '</div>';
  }

  return html;
}

window.toggleReplyForm = function(commentId) {
  const container = document.getElementById('reply-form-' + commentId);
  if (!container) return;
  if (container.innerHTML) { container.innerHTML = ''; return; }

  // Find the type and id from the page URL
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');

  container.innerHTML = `
    <div class="reply-form">
      <textarea id="replyText-${commentId}" placeholder="写下回复..."></textarea>
      <button onclick="submitReply('${type}','${id}','${commentId}')">回复</button>
    </div>`;
};

window.submitReply = function(type, id, parentId) {
  const content = document.getElementById('replyText-' + parentId).value;
  if (!content.trim()) return;
  const result = Store.addComment(type, id, content, 0, parentId);
  if (result.ok) {
    renderComments(type, id);
    renderDetail();
  } else {
    alert(result.msg);
  }
};

function submitComment(type, id) {
  const content = document.getElementById('commentText').value;
  const rating = document.getElementById('commentRating').value;
  const msg = document.getElementById('commentMsg');
  const result = Store.addComment(type, id, content, rating);
  if (result.ok) {
    msg.textContent = '评论已发表'; msg.className = 'msg success';
    setTimeout(() => {
      renderComments(type, id);
      renderDetail();
    }, 300);
  } else {
    msg.textContent = result.msg; msg.className = 'msg error';
  }
}

function deleteComment(type, itemId, commentId) {
  if (!confirm('确认删除这条评论？')) return;
  Store.deleteComment(type, itemId, commentId);
  renderComments(type, itemId);
  renderDetail();
}
