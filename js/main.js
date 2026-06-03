/**
 * MYGO-MUJICA-WEB — main rendering (Supabase backend)
 */
const SECRET_KEYS = ['togawa', 'sakiko', '200606'];
let authRole = 'user';
let litPage = 1;
let litFilterCat = 'all';
const PAGE_SIZE = 8;

// ── Helpers ──────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function readingTime(text) {
  if (!text) return 0;
  const cleaned = text.replace(/\s+/g, '');
  return Math.max(1, Math.ceil(cleaned.length / 400));
}

let mdReady = false;
const mdPromise = new Promise(resolve => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  script.onload = () => { mdReady = true; resolve(); };
  script.onerror = () => { mdReady = false; resolve(); };
  document.head.appendChild(script);
});

function renderMd(text) {
  if (!text) return '';
  if (mdReady && typeof marked !== 'undefined') return marked.parse(text);
  return '<p>' + esc(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initBackToTop();
  initProgressBar();
  await mdPromise;

  const info = await Store.getSiteInfo();
  document.querySelectorAll('.site-title').forEach(el => {
    if (info.title) el.textContent = info.title;
  });
  document.title = info.title || 'MYGO-MUJICA-WEB';

  await renderAuthArea();
  renderAuthModal();

  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(link => {
    if (link.getAttribute('href') === page) link.classList.add('active');
  });

  if (page === 'index.html' || page === '') renderHomepage(info);
  else if (page === 'literature.html') await renderLiterature();
  else if (page === 'projects.html') await renderProjects();
  else if (page === 'recommendations.html') await renderRecommendations();
  else if (page === 'detail.html') await renderDetail();
});

// ═══════════════════════════════════════════════════════
//  AUTH UI
// ═══════════════════════════════════════════════════════
function userAvatarHtml(profile) {
  if (!profile) return '';
  if (profile.avatar) {
    return `<img src="${esc(profile.avatar)}" class="avatar" style="object-fit:cover;" onerror="this.outerHTML='<span class=\\'avatar\\'>${esc((profile.nickname||profile.username||'?')[0].toUpperCase())}</span>'">`;
  }
  return `<span class="avatar">${esc((profile.nickname || profile.username || '?')[0].toUpperCase())}</span>`;
}

async function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const info = await Store.getCurrentUserInfo();
  const isMod = info?.role === 'moderator';
  const isAdm = !isMod && (info?.role === 'admin');

  const themeIcon = (document.documentElement.getAttribute('data-theme') === 'dark') ? '☀️' : '🌙';

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
    const count = await Store.unreadNotificationCount(info.username);
    notifBell = `<button class="theme-toggle" onclick="showNotifications()" title="${count}条新通知" style="position:relative;">🔔${count > 0 ? `<span style="position:absolute;top:-2px;right:-2px;background:var(--danger);color:#fff;font-size:0.6rem;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${count > 9 ? '9+' : count}</span>` : ''}</button>`;
  }

  if (info) {
    area.innerHTML = extras + notifBell + adminBtn + `
      <div class="user-menu" id="userMenu">
        ${userAvatarHtml(info)}
        <span>${esc(info.nickname || info.username)}</span>
        <div class="user-dropdown" id="userDropdown">
          <button onclick="showProfileModal()">编辑资料</button>
          <button onclick="doLogout()">退出登录</button>
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

async function doLogout() {
  await Store.logout();
  location.reload();
}

// ═══════════════════════════════════════════════════════
//  AUTH MODAL
// ═══════════════════════════════════════════════════════
function renderAuthModal() {
  const box = document.getElementById('authModalBox');
  if (!box) return;
  box.innerHTML = `
    <div id="roleSelect">
      <h2>选择登录身份</h2>
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin:1rem 0;">
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.65rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.95rem;width:100%;" onclick="selectAuthRole('user')">👤 普通用户</button>
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.65rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.95rem;width:100%;" onclick="selectAuthRole('admin')">🛡️ 管理员</button>
        <button class="btn btn-primary" style="background:#b392d9;color:#fff;border:none;padding:0.65rem;border-radius:var(--radius-sm);cursor:pointer;font-size:0.95rem;width:100%;" onclick="selectAuthRole('moderator')">✎ 版主</button>
      </div>
      <p class="switch-text">已有账号？<a onclick="selectAuthRole('user')">直接登录</a></p>
    </div>
    <div id="userLoginForm" style="display:none;">
      <h2>👤 普通用户登录</h2>
      <div class="msg" id="loginMsg"></div>
      <div class="form-group"><label>邮箱</label><input type="email" id="loginEmail"></div>
      <div class="form-group"><label>密码</label><input type="password" id="loginPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doLogin()">登录</button>
      <p class="switch-text">没有账号？<a onclick="showAuthSubForm('userRegister')">立即注册</a> &nbsp; <a onclick="showAuthSubForm('roleSelect')">返回选择</a></p>
    </div>
    <div id="userRegisterForm" style="display:none;">
      <h2>👤 普通用户注册</h2>
      <div class="msg" id="registerMsg"></div>
      <div class="form-group"><label>邮箱（用作登录账号）</label><input type="email" id="regEmail"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="regUsername"></div>
      <div class="form-group"><label>密码（至少6位）</label><input type="password" id="regPassword"></div>
      <div class="form-group"><label>昵称（可选）</label><input type="text" id="regNickname"></div>
      <div class="form-group"><label>头像URL（可选）</label><input type="text" id="regAvatar" placeholder="https://..."></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doRegister()">注册</button>
      <p class="switch-text">已有账号？<a onclick="showAuthSubForm('userLogin')">去登录</a></p>
    </div>
    <div id="staffKeyForm" style="display:none;">
      <h2>🔑 管理员/版主验证</h2>
      <div class="msg" id="staffKeyMsg"></div>
      <div class="form-group"><label>请输入密钥</label><input type="password" id="staffKeyInput" placeholder="输入密钥"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="verifyStaffKey()">验证</button>
      <p class="switch-text"><a onclick="showAuthSubForm('roleSelect')">返回选择</a></p>
    </div>
    <div id="staffLoginForm" style="display:none;">
      <h2 id="staffLoginTitle">工作人员登录</h2>
      <div class="msg" id="staffLoginMsg"></div>
      <div class="form-group"><label>邮箱</label><input type="email" id="staffLoginEmail"></div>
      <div class="form-group"><label>密码</label><input type="password" id="staffLoginPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doStaffLogin()">登录</button>
      <p class="switch-text" id="staffLoginLinks">
        <span id="staffRegLinkWrapper"><a onclick="showAuthSubForm('staffRegister')">注册</a> &nbsp;</span>
        <a onclick="showAuthSubForm('roleSelect')">返回选择</a>
      </p>
    </div>
    <div id="staffRegisterForm" style="display:none;">
      <h2>注册版主</h2>
      <div class="msg" id="staffRegMsg"></div>
      <div class="form-group"><label>邮箱（用作登录账号）</label><input type="email" id="staffRegEmail"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="staffRegUsername"></div>
      <div class="form-group"><label>密码（至少6位）</label><input type="password" id="staffRegPassword"></div>
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
  ['roleSelect', 'userLoginForm', 'userRegisterForm', 'staffKeyForm', 'staffLoginForm', 'staffRegisterForm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const el = document.getElementById(formId);
  if (el) el.style.display = '';
  document.querySelectorAll('#authModalBox .msg').forEach(m => { m.textContent = ''; m.className = 'msg'; });
}

function selectAuthRole(role) {
  authRole = role;
  if (role === 'user') {
    showAuthSubForm('userLogin');
  } else if (role === 'moderator') {
    document.getElementById('staffLoginTitle').textContent = '版主登录';
    document.getElementById('staffRegLinkWrapper').style.display = '';
    showAuthSubForm('staffKey');
  } else {
    document.getElementById('staffLoginTitle').textContent = '管理员登录';
    document.getElementById('staffRegLinkWrapper').style.display = 'none';
    showAuthSubForm('staffLogin');
  }
}

function hideAuthModal() { document.getElementById('authModal').classList.remove('show'); }
document.addEventListener('click', e => { if (e.target.id === 'authModal') hideAuthModal(); });

// ── Auth actions ──────────────────────────────────────
async function doLogin() {
  const msg = document.getElementById('loginMsg');
  const result = await Store.login(
    document.getElementById('loginEmail').value.trim(),
    document.getElementById('loginPassword').value
  );
  if (result.ok) { msg.textContent = '登录成功'; msg.className = 'msg success'; setTimeout(() => location.reload(), 500); }
  else { msg.textContent = result.msg; msg.className = 'msg error'; }
}

async function doRegister() {
  const msg = document.getElementById('registerMsg');
  const result = await Store.register(
    document.getElementById('regEmail').value.trim(),
    document.getElementById('regPassword').value,
    {
      username: document.getElementById('regUsername').value.trim(),
      nickname: document.getElementById('regNickname').value.trim(),
      avatar: document.getElementById('regAvatar').value.trim()
    }
  );
  if (result.ok) { msg.textContent = '注册成功！请查收邮箱验证邮件后登录。'; msg.className = 'msg success'; setTimeout(() => showAuthSubForm('userLogin'), 1500); }
  else { msg.textContent = result.msg; msg.className = 'msg error'; }
}

function verifyStaffKey() {
  const input = document.getElementById('staffKeyInput').value.trim().toLowerCase();
  const msg = document.getElementById('staffKeyMsg');
  if (SECRET_KEYS.includes(input)) { msg.textContent = '验证通过'; msg.className = 'msg success'; setTimeout(() => showAuthSubForm('staffLogin'), 500); }
  else { msg.textContent = '密钥错误'; msg.className = 'msg error'; }
}

async function doStaffLogin() {
  const email = document.getElementById('staffLoginEmail').value.trim();
  const password = document.getElementById('staffLoginPassword').value;
  const msg = document.getElementById('staffLoginMsg');
  let result;
  if (authRole === 'moderator') result = await Store.moderatorLogin(email, password);
  else result = await Store.adminLoginUser(email, password);
  if (result.ok) {
    msg.textContent = '登录成功'; msg.className = 'msg success';
    setTimeout(() => { hideAuthModal(); renderAuthArea(); if (typeof window.openAdminPanel === 'function') window.openAdminPanel(); }, 400);
  } else { msg.textContent = result.msg; msg.className = 'msg error'; }
}

async function doStaffRegister() {
  const msg = document.getElementById('staffRegMsg');
  // Only moderator registration via this form; admin is promoted from users
  const result = await Store.register(
    document.getElementById('staffRegEmail').value.trim(),
    document.getElementById('staffRegPassword').value,
    {
      username: document.getElementById('staffRegUsername').value.trim(),
      nickname: document.getElementById('staffRegNickname').value.trim(),
      avatar: document.getElementById('staffRegAvatar').value.trim()
    }
  );
  if (result.ok) {
    msg.innerHTML = '注册成功！如果这是<strong>第一个版主</strong>，请打开浏览器控制台(F12)执行：<br><code style="font-size:0.75rem;word-break:break-all;">becomeFirstModerator("你的用户名")</code><br>否则请联系已有版主提拔你。';
    msg.className = 'msg success';
  } else { msg.textContent = result.msg; msg.className = 'msg error'; }
}

// ═══════════════════════════════════════════════════════
//  THEME / SEARCH / UI
// ═══════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('mygo_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('mygo_theme', 'light'); }
  else { document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('mygo_theme', 'dark'); }
}

let searchIndex = [];
async function buildSearchIndex() {
  searchIndex = [];
  (await Store.getLiterature()).forEach(i => {
    searchIndex.push({ type: '文学创作', id: i.id, url: 'detail.html?type=lit&id=' + i.id, title: i.title, text: i.excerpt + ' ' + (i.content || '') });
  });
  (await Store.getProjects()).forEach(i => {
    searchIndex.push({ type: '代码项目', id: i.id, url: 'detail.html?type=proj&id=' + i.id, title: i.name, text: i.description + ' ' + (i.detail || '') + ' ' + (i.tags || []).join(' ') });
  });
  const recs = await Store.getRecommendations();
  const REC_LABELS = { literary: '严肃文学', popular: '流行文学', lightnovel: '轻小说', manga: '漫画', movie: '电影', drama: '电视剧', anime: '动画', music: '音乐' };
  Object.keys(REC_LABELS).forEach(cat => {
    (recs[cat] || []).forEach(i => {
      searchIndex.push({ type: '推荐 · ' + REC_LABELS[cat], id: i.id, url: 'detail.html?type=rec&id=' + i.id, title: i.title, text: (i.excerpt || '') + ' ' + (i.review || '') });
    });
  });
}

function doSearch(query) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  if (!query.trim()) { container.innerHTML = '<div class="search-hint">输入关键词搜索文章、项目、推荐...</div>'; return; }
  const q = query.toLowerCase();
  const results = searchIndex.filter(item => item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q)).slice(0, 12);
  if (!results.length) { container.innerHTML = '<div class="search-none">没有找到相关内容</div>'; return; }
  container.innerHTML = results.map(r => `
    <a href="${r.url}" class="search-result-item" onclick="closeSearch()">
      <div class="s-type">${esc(r.type)}</div>
      <div class="s-title">${esc(r.title)}</div>
      <div class="s-meta">${esc(r.text).slice(0, 80)}...</div>
    </a>`).join('');
}

async function openSearch() { await buildSearchIndex(); document.getElementById('searchOverlay').classList.add('show'); document.getElementById('searchInput').value = ''; document.getElementById('searchResults').innerHTML = '<div class="search-hint">输入关键词搜索...</div>'; setTimeout(() => document.getElementById('searchInput').focus(), 100); }
function closeSearch() { document.getElementById('searchOverlay').classList.remove('show'); }

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initProgressBar() {
  const bar = document.getElementById('progressBar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = docHeight > 0 ? (window.scrollY / docHeight * 100) + '%' : '0%';
  });
}

// ═══════════════════════════════════════════════════════
//  NOTIFICATIONS & PROFILE
// ═══════════════════════════════════════════════════════
async function showNotifications() {
  const info = await Store.getCurrentUserInfo();
  if (!info) return;
  const notifs = await Store.getNotifications(info.username);
  await Store.markNotificationsRead(info.username);

  let overlay = document.getElementById('notifModal');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'notifModal';
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-box" style="position:relative;max-width:420px;">
      <h2>通知</h2>
      <div style="max-height:60vh;overflow-y:auto;">
        ${notifs.length ? notifs.map(n => `
          <div style="padding:0.6rem 0;border-bottom:1px solid var(--border);font-size:0.88rem;font-family:var(--font-ui);">
            <div>${esc(n.message)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">${n.created_at?.slice(0,10)||''}</div>
          </div>`).join('') : '<p style="color:var(--text-muted);text-align:center;padding:1.5rem;">暂无通知</p>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); renderAuthArea(); } });
  renderAuthArea();
}

function showProfileModal() {
  // Profile editing is handled via supabase directly
  const info = Store.getCurrentUserInfo().then(info => {
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
        <div class="form-group"><label>头像URL</label><input type="text" id="profileAvatar" value="${esc(info.avatar||'')}" placeholder="https://..."></div>
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" id="profileSaveBtn">保存</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('profileSaveBtn').addEventListener('click', async () => {
      const result = await Store.updateProfile(info.username, {
        nickname: document.getElementById('profileNickname').value.trim(),
        avatar: document.getElementById('profileAvatar').value.trim()
      });
      const msg = document.getElementById('profileMsg');
      if (result.ok) { msg.textContent = '已保存'; msg.className = 'msg success'; setTimeout(() => { overlay.remove(); renderAuthArea(); }, 600); }
      else { msg.textContent = result.msg; msg.className = 'msg error'; }
    });
  });
}

// ── First moderator setup (console helper) ────────────
window.becomeFirstModerator = async function(username, serviceRoleKey) {
  if (!username) { console.log('用法: becomeFirstModerator("用户名", "service_role密钥")'); return; }
  if (!serviceRoleKey) {
    serviceRoleKey = prompt('请输入 Supabase 项目的 service_role 密钥（在 Settings > API 中可找到）：');
    if (!serviceRoleKey) return;
  }
  // Get user ID
  const resp = await fetch('https://xciemvihmjbfwtslhfwq.supabase.co/rest/v1/profiles?select=id,username&username=eq.' + encodeURIComponent(username), {
    headers: { 'apikey': serviceRoleKey, 'Authorization': 'Bearer ' + serviceRoleKey }
  });
  const profiles = await resp.json();
  if (!profiles.length) { console.log('用户 "' + username + '" 不存在'); return; }
  // Update role
  const updateResp = await fetch('https://xciemvihmjbfwtslhfwq.supabase.co/rest/v1/profiles?id=eq.' + profiles[0].id, {
    method: 'PATCH',
    headers: { 'apikey': serviceRoleKey, 'Authorization': 'Bearer ' + serviceRoleKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'moderator' })
  });
  if (updateResp.ok) {
    console.log('✅ ' + username + ' 已提升为版主！请重新登录。');
    alert(username + ' 已成功设为版主！请退出后重新登录。');
  } else {
    console.log('❌ 失败: ' + await updateResp.text());
  }
};

// ═══════════════════════════════════════════════════════
//  HOME PAGE
// ═══════════════════════════════════════════════════════
function renderHomepage(info) {
  const p = document.querySelector('.hero p');
  if (p && info.subtitle) p.textContent = info.subtitle;
}

// ═══════════════════════════════════════════════════════
//  LITERATURE LIST
// ═══════════════════════════════════════════════════════
async function renderLiterature() {
  const list = document.getElementById('lit-list');
  const filterArea = document.getElementById('lit-filter');
  const loadMoreArea = document.getElementById('lit-load-more');
  if (!list) return;

  const items = await Store.getLiterature();
  const cats = [...new Set(items.map(i => i.category || '未分类').filter(Boolean))];

  if (filterArea && cats.length > 0) {
    filterArea.innerHTML = `
      <button class="cat-chip ${litFilterCat === 'all' ? 'active' : ''}" onclick="filterLit('all')">全部</button>
      ${cats.map(c => `<button class="cat-chip ${litFilterCat === c ? 'active' : ''}" onclick="filterLit('${esc(c)}')">${esc(c)}</button>`).join('')}`;
  }

  let filtered = litFilterCat === 'all' ? items : items.filter(i => (i.category || '未分类') === litFilterCat);
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const total = filtered.length;
  const paged = filtered.slice(0, litPage * PAGE_SIZE);

  list.innerHTML = paged.length ? await Promise.all(paged.map(async i => {
    const avg = await Store.avgRating('lit', i.id);
    const rt = readingTime(i.content || i.excerpt);
    const likeCount = await Store.getLikeCount('lit', i.id);
    return `
    <li class="article-item">
      <time>${esc(i.date)}</time>
      ${i.category ? `<span class="tag-dot">#${esc(i.category)}</span>` : ''}
      ${(i.tags || []).map(t => `<span class="tag-dot">${esc(t)}</span>`).join('')}
      <h3><a href="detail.html?type=lit&id=${i.id}">${esc(i.title)}</a></h3>
      <p class="excerpt">${esc(i.excerpt)}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <span class="reading-time">阅读约 ${rt} 分钟</span>
        <span>
          ${likeCount > 0 ? `<span style="font-size:0.8rem;color:var(--danger);margin-right:0.5rem;">❤️ ${likeCount}</span>` : ''}
          <a href="detail.html?type=lit&id=${i.id}#comments" style="font-size:0.82rem;color:var(--accent);text-decoration:none;font-family:var(--font-ui);">
            ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}</span> &nbsp;` : ''}评价 →
          </a>
        </span>
      </div>
    </li>`;
  })).then(html => html.join('')) : '<p style="color:var(--text-muted);">该分类暂无文章。</p>';

  if (loadMoreArea) {
    loadMoreArea.innerHTML = total > litPage * PAGE_SIZE
      ? `<button class="load-more-btn" onclick="loadMoreLit()">加载更多 (${total - litPage * PAGE_SIZE} 篇)</button>`
      : '';
  }
}

window.filterLit = function(cat) { litFilterCat = cat; litPage = 1; renderLiterature(); };
window.loadMoreLit = function() { litPage++; renderLiterature(); };

// ═══════════════════════════════════════════════════════
//  PROJECTS LIST
// ═══════════════════════════════════════════════════════
async function renderProjects() {
  const list = document.getElementById('proj-list');
  if (!list) return;
  const items = await Store.getProjects();
  list.innerHTML = items.length ? await Promise.all(items.map(async i => {
    const avg = await Store.avgRating('proj', i.id);
    return `
    <div class="project-card">
      <h3><a href="detail.html?type=proj&id=${i.id}">${esc(i.name)}</a>${i.link ? ` <a href="${esc(i.link)}" target="_blank" style="font-size:0.75rem;color:var(--accent);">↗</a>` : ''}</h3>
      <p>${esc(i.description || i.desc)}</p>
      <div class="tech-tags">${(i.tags || []).map(t => `<span class="tech-tag">${esc(t)}</span>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.65rem;">
        <a href="detail.html?type=proj&id=${i.id}#comments" style="font-size:0.82rem;color:var(--accent);text-decoration:none;font-family:var(--font-ui);">
          ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}</span> &nbsp;` : ''}评价 →
        </a>
      </div>
    </div>`;
  })).then(html => html.join('')) : '<p style="color:var(--text-muted);">暂无项目。</p>';
}

// ═══════════════════════════════════════════════════════
//  RECOMMENDATIONS LIST
// ═══════════════════════════════════════════════════════
async function renderRecommendations() {
  const all = await Store.getRecommendations();
  const CATEGORIES = [
    { key: 'literary', label: '严肃文学', icon: '📖' }, { key: 'popular', label: '流行文学', icon: '📚' },
    { key: 'lightnovel', label: '轻小说', icon: '📙' }, { key: 'manga', label: '漫画', icon: '📘' },
    { key: 'movie', label: '电影', icon: '🎬' }, { key: 'drama', label: '电视剧', icon: '📺' },
    { key: 'anime', label: '动画', icon: '🎞️' }, { key: 'music', label: '音乐', icon: '🎵' }
  ];

  for (const cat of CATEGORIES) {
    const el = document.getElementById('rec-' + cat.key);
    if (!el) continue;
    const items = all[cat.key] || [];
    if (!items.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">暂无</p>'; continue; }
    el.innerHTML = '<div class="rec-grid">' + (await Promise.all(items.map(async i => {
      const avg = await Store.avgRating('rec', i.id);
      return `
      <div class="rec-item">
        <a href="detail.html?type=rec&id=${i.id}">
          ${i.cover ? `<img class="rec-cover" src="${esc(i.cover)}" alt="${esc(i.title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <h4>${esc(i.title)}</h4>
          <p class="meta">${esc(i.creator || '')}${i.year ? ' · ' + esc(i.year) : ''}</p>
          <p>${esc(i.excerpt || i.review || '').slice(0, 80)}${(i.excerpt || i.review || '').length > 80 ? '…' : ''}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.4rem;">
            <span style="font-size:0.8rem;color:var(--accent);font-family:var(--font-ui);">
              ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}</span> &nbsp;` : ''}评价 →
            </span>
          </div>
        </a>
      </div>`;
    }))).join('') + '</div>';
  }
}

// ═══════════════════════════════════════════════════════
//  DETAIL PAGE
// ═══════════════════════════════════════════════════════
async function renderDetail() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');
  const container = document.getElementById('detailContent');
  if (!container) return;
  if (!type || !id) { container.innerHTML = '<p>无效链接。</p>'; return; }

  let backUrl, title, byline, bodyHtml, item, coverUrl = '';

  if (type === 'lit') { item = await Store.getLitById(id); backUrl = 'literature.html'; }
  else if (type === 'proj') { item = await Store.getProjById(id); backUrl = 'projects.html'; }
  else if (type === 'rec') { const result = await Store.getRecById(id); item = result ? result.item : null; backUrl = 'recommendations.html'; }

  if (!item) { container.innerHTML = '<p>内容不存在或已被删除。</p>'; return; }

  if (type === 'lit') { title = item.title; byline = item.date; bodyHtml = renderMd(item.content || item.excerpt); }
  else if (type === 'proj') { title = item.name; byline = (item.tags || []).join(' · '); bodyHtml = renderMd(item.detail || item.description || item.desc); if (item.link) bodyHtml += `<p><a href="${esc(item.link)}" target="_blank">🔗 项目链接 →</a></p>`; }
  else if (type === 'rec') { title = item.title; byline = (item.creator || '') + (item.year ? ' · ' + item.year : ''); coverUrl = item.cover || ''; bodyHtml = renderMd(item.review || item.excerpt || ''); }

  const avg = await Store.avgRating(type, id);
  const allComments = await Store.getComments(type, id);
  const commentCount = allComments.length;
  const rt = readingTime((item.content || item.excerpt || item.review || item.detail || item.description || ''));
  const liked = await Store.hasLiked(type, id);
  const likeCount = await Store.getLikeCount(type, id);
  const tocHtml = buildTOC(item.content || item.review || item.detail || item.description || '');

  container.innerHTML = `
    <a href="${backUrl}" class="detail-back">← 返回列表</a>
    ${tocHtml}
    <div class="detail-article">
      <h1>${esc(title)}</h1>
      <p class="byline">
        <span>${esc(byline)}</span>
        <span class="read-time">阅读约 ${rt} 分钟</span>
        ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}<span style="font-weight:400;font-size:0.8rem;color:var(--text-muted);margin-left:0.3rem;">(${commentCount}评)</span></span>` : ''}
        <button class="like-btn ${liked ? 'liked' : ''}" id="likeBtn" onclick="toggleLikeBtn('${type}','${id}')">
          ${liked ? '❤️' : '🤍'} <span id="likeCount">${likeCount || ''}</span>
        </button>
      </p>
      ${coverUrl ? `<img class="cover-img" src="${esc(coverUrl)}" alt="${esc(title)}" onerror="this.style.display='none'">` : ''}
      <div class="body">${bodyHtml}</div>
    </div>`;

  loadHighlightJs();
  await renderComments(type, id);
  document.title = title + ' — ' + (await Store.getSiteInfo()).title;
}

function buildTOC(md) {
  const headings = [];
  const lines = md.split('\n');
  lines.forEach(line => {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  });
  if (headings.length < 2) return '';
  return '<details class="toc-container"><summary>📑 目录</summary><ul class="toc-list">' +
    headings.map((h, i) => `<li class="toc-h${h.level}"><a href="#toc-${i}">${esc(h.text)}</a></li>`).join('') +
    '</ul></details>';
}

function loadHighlightJs() {
  if (document.querySelector('link[href*="highlight"]')) return;
  ['https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css',
   'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css'].forEach(href => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
    if (href.includes('dark')) link.media = '(prefers-color-scheme: dark)';
    document.head.appendChild(link);
  });
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js';
  script.onload = () => {
    if (typeof hljs !== 'undefined') document.querySelectorAll('.body pre code').forEach(b => hljs.highlightElement(b));
    document.querySelectorAll('.body h1,.body h2,.body h3').forEach((h, i) => { if (!h.id) h.id = 'toc-' + i; });
  };
  document.head.appendChild(script);
}

window.toggleLikeBtn = async function(type, id) {
  const result = await Store.toggleLike(type, id);
  if (!result.ok) { alert(result.msg); return; }
  const btn = document.getElementById('likeBtn');
  if (btn) {
    btn.className = 'like-btn ' + (result.liked ? 'liked' : '');
    btn.innerHTML = (result.liked ? '❤️' : '🤍') + ' <span id="likeCount">' + (await Store.getLikeCount(type, id) || '') + '</span>';
  }
};

// ═══════════════════════════════════════════════════════
//  COMMENTS (with nesting)
// ═══════════════════════════════════════════════════════
async function renderComments(type, id) {
  const formArea = document.getElementById('commentFormArea');
  const listArea = document.getElementById('commentList');
  if (!formArea || !listArea) return;

  const loggedIn = await Store.isLoggedIn();
  if (loggedIn) {
    formArea.innerHTML = `
      <div class="comment-form">
        <div class="row">
          <textarea id="commentText" placeholder="写下你的评论..."></textarea>
          <div class="rating-input"><label>评分</label><input type="number" id="commentRating" value="7.0" min="0" max="10" step="0.1"></div>
          <button class="submit-btn" onclick="submitComment('${type}','${id}')">发表</button>
        </div>
        <div class="msg" id="commentMsg"></div>
      </div>`;
  } else {
    formArea.innerHTML = `<div class="comment-login-hint"><a onclick="showAuthModal('login')">登录</a> 后即可评论和打分</div>`;
  }

  const allComments = await Store.getComments(type, id);
  const topLevel = allComments.filter(c => !c.parentId);
  const info = await Store.getCurrentUserInfo();
  const currentUser = info?.username;
  const canDeleteAny = info?.role === 'admin' || info?.role === 'moderator';

  listArea.innerHTML = topLevel.length
    ? topLevel.map(c => renderCommentItem(c, allComments, type, id, currentUser, canDeleteAny)).join('')
    : '<p class="no-comments">暂无评论，成为第一个评价的人吧。</p>';
}

function renderCommentItem(c, allComments, type, id, currentUser, canDeleteAny, depth = 0) {
  const displayName = esc(c.authorNickname || c.author);
  const avatarHtml = c.authorAvatar
    ? `<img src="${esc(c.authorAvatar)}" class="c-avatar-img" onerror="this.outerHTML='<span class=\\'c-avatar\\'>${esc(displayName[0].toUpperCase())}</span>'">`
    : `<span class="c-avatar">${esc(displayName[0].toUpperCase())}</span>`;
  const replies = allComments.filter(r => r.parentId === c.id);

  let html = `
    <div class="comment-item" id="comment-${c.id}">
      <div class="c-header">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          ${avatarHtml}<span class="c-author">${displayName}</span>
          ${c.parentId ? `<span style="font-size:0.72rem;color:var(--text-muted);">回复</span>` : ''}
        </div>
        ${c.rating > 0 ? `<span class="c-rating">★ ${c.rating}</span>` : ''}
      </div>
      <div class="c-content">${esc(c.content)}</div>
      <div class="c-footer">
        <span>${c.date}</span>
        <span>
          ${Store.isLoggedIn() && depth < 2 ? `<button class="comment-reply-btn" onclick="toggleReplyForm('${c.id}')">回复</button>` : ''}
          ${(currentUser === c.author || canDeleteAny) ? `<button class="c-delete" onclick="deleteComment('${type}','${id}','${c.id}')">删除</button>` : ''}
        </span>
      </div>
      <div id="reply-form-${c.id}"></div>
    </div>`;

  if (replies.length) {
    html += '<div class="comment-replies">';
    replies.forEach(r => { html += renderCommentItem(r, allComments, type, id, currentUser, canDeleteAny, depth + 1); });
    html += '</div>';
  }
  return html;
}

window.toggleReplyForm = function(commentId) {
  const container = document.getElementById('reply-form-' + commentId);
  if (!container) return;
  if (container.innerHTML) { container.innerHTML = ''; return; }
  const params = new URLSearchParams(window.location.search);
  container.innerHTML = `
    <div class="reply-form">
      <textarea id="replyText-${commentId}" placeholder="写下回复..."></textarea>
      <button onclick="submitReply('${params.get('type')}','${params.get('id')}','${commentId}')">回复</button>
    </div>`;
};

window.submitReply = async function(type, id, parentId) {
  const content = document.getElementById('replyText-' + parentId).value;
  if (!content.trim()) return;
  const result = await Store.addComment(type, id, content, 0, parentId);
  if (result.ok) { await renderComments(type, id); await renderDetail(); }
  else { alert(result.msg); }
};

async function submitComment(type, id) {
  const content = document.getElementById('commentText').value;
  const rating = document.getElementById('commentRating').value;
  const msg = document.getElementById('commentMsg');
  const result = await Store.addComment(type, id, content, rating);
  if (result.ok) { msg.textContent = '评论已发表'; msg.className = 'msg success'; setTimeout(async () => { await renderComments(type, id); await renderDetail(); }, 300); }
  else { msg.textContent = result.msg; msg.className = 'msg error'; }
}

async function deleteComment(type, itemId, commentId) {
  if (!confirm('确认删除？')) return;
  await Store.deleteComment(type, itemId, commentId);
  await renderComments(type, itemId);
  await renderDetail();
}
