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
  ['books','music','films'].forEach(cat => {
    recs[cat].forEach(i => {
      searchIndex.push({ type: '推荐 · ' + ({books:'书籍',music:'音乐',films:'影视'})[cat], id: i.id, url: 'detail.html?type=rec&id=' + i.id, title: i.title, text: (i.excerpt||'') + ' ' + (i.review||'') });
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
function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const user = Store.getCurrentUser();

  // Theme toggle
  const themeIcon = (document.documentElement.getAttribute('data-theme')==='dark') ? '☀️' : '🌙';

  const extras = `
    <button class="search-toggle" onclick="openSearch()" title="搜索">🔍</button>
    <button class="theme-toggle" onclick="toggleTheme();renderAuthArea();" title="切换主题">${themeIcon}</button>`;

  if (user) {
    area.innerHTML = extras + `
      <div class="user-menu" id="userMenu">
        <div class="avatar">${esc(user[0].toUpperCase())}</div>
        <span>${esc(user)}</span>
        <div class="user-dropdown" id="userDropdown">
          <button onclick="Store.logout();location.reload();">退出登录</button>
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
    area.innerHTML = extras + `<button class="auth-btn" onclick="showAuthModal('login')">登录</button>`;
  }
}

function renderAuthModal() {
  const box = document.getElementById('authModalBox');
  if (!box) return;
  box.innerHTML = `
    <div id="loginForm">
      <h2>登录</h2>
      <div class="msg" id="loginMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="loginUsername"></div>
      <div class="form-group"><label>密码</label><input type="password" id="loginPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doLogin()">登录</button>
      <p class="switch-text">没有账号？<a onclick="showAuthModal('register')">立即注册</a></p>
    </div>
    <div id="registerForm" style="display:none;">
      <h2>注册</h2>
      <div class="msg" id="registerMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="regUsername"></div>
      <div class="form-group"><label>密码</label><input type="password" id="regPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" onclick="doRegister()">注册</button>
      <p class="switch-text">已有账号？<a onclick="showAuthModal('login')">去登录</a></p>
    </div>`;
}

function showAuthModal(type) {
  document.getElementById('authModal').classList.add('show');
  document.getElementById('loginForm').style.display = type === 'login' ? '' : 'none';
  document.getElementById('registerForm').style.display = type === 'register' ? '' : 'none';
  const lm = document.getElementById('loginMsg'), rm = document.getElementById('registerMsg');
  if (lm) { lm.textContent = ''; lm.className = 'msg'; }
  if (rm) { rm.textContent = ''; rm.className = 'msg'; }
}
function hideAuthModal() { document.getElementById('authModal').classList.remove('show'); }
document.addEventListener('click', e => { if (e.target.id === 'authModal') hideAuthModal(); });

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
    document.getElementById('regPassword').value
  );
  if (result.ok) {
    msg.textContent = '注册成功，请登录'; msg.className = 'msg success';
    setTimeout(() => showAuthModal('login'), 800);
  } else {
    msg.textContent = result.msg; msg.className = 'msg error';
  }
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
function renderLiterature() {
  const list = document.getElementById('lit-list');
  if (!list) return;
  const items = Store.getLiterature();
  list.innerHTML = items.length ? items.map(i => {
    const avg = Store.avgRating('lit', i.id);
    const rt = readingTime(i.content || i.excerpt);
    return `
    <li class="article-item">
      <time>${esc(i.date)}</time>
      <h3><a href="detail.html?type=lit&id=${i.id}">${esc(i.title)}</a></h3>
      <p class="excerpt">${esc(i.excerpt)}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <span class="reading-time">阅读约 ${rt} 分钟</span>
        ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}</span>` : ''}
      </div>
    </li>`;
  }).join('') : '<p style="color:var(--text-muted);">暂无文章，去 <a href="admin.html">管理后台</a> 添加吧。</p>';
}

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
      ${avg > 0 ? `<div class="rating-badge" style="margin-top:0.5rem;font-size:0.82rem;"><span class="star-icon">★</span> ${avg}</div>` : ''}
    </div>`;
  }).join('') : '<p style="color:var(--text-muted);">暂无项目，去 <a href="admin.html">管理后台</a> 添加吧。</p>';
}

// ═══════════════════════════════════════════════════════
//  RECOMMENDATIONS LIST
// ═══════════════════════════════════════════════════════
function renderRecommendations() {
  const all = Store.getRecommendations();

  function recGrid(items, cat, authorKey) {
    if (!items.length) return '<p style="color:var(--text-muted);font-size:0.9rem;">暂无</p>';
    return '<div class="rec-grid">' + items.map(i => {
      const avg = Store.avgRating('rec', i.id);
      return `
      <div class="rec-item">
        <a href="detail.html?type=rec&id=${i.id}">
          ${i.cover ? `<img class="rec-cover" src="${esc(i.cover)}" alt="${esc(i.title)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <h4>${esc(i.title)}</h4>
          <p class="meta">${esc(i[authorKey] || '')}${i.year ? ' · ' + esc(i.year) : ''}</p>
          <p>${esc(i.excerpt || i.review || '').slice(0, 80)}${(i.excerpt || i.review || '').length > 80 ? '…' : ''}</p>
          ${avg > 0 ? `<div class="rating-badge" style="margin-top:0.3rem;"><span class="star-icon">★</span> ${avg}</div>` : ''}
        </a>
      </div>`;
    }).join('') + '</div>';
  }

  const booksEl = document.getElementById('rec-books');
  const musicEl = document.getElementById('rec-music');
  const filmsEl = document.getElementById('rec-films');
  if (booksEl) booksEl.innerHTML = recGrid(all.books, 'books', 'author');
  if (musicEl) musicEl.innerHTML = recGrid(all.music, 'music', 'artist');
  if (filmsEl) filmsEl.innerHTML = recGrid(all.films, 'films', 'director');
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
    const creator = item.author || item.artist || item.director || '';
    byline = creator + (item.year ? ' · ' + item.year : '');
    coverUrl = item.cover || '';
    bodyHtml = renderMd(item.review || item.excerpt || '');
  }

  const avg = Store.avgRating(type, id);
  const commentCount = Store.getComments(type, id).length;
  const rt = readingTime((item.content || item.excerpt || item.review || item.detail || item.desc || ''));

  container.innerHTML = `
    <a href="${backUrl}" class="detail-back">← 返回列表</a>
    <div class="detail-article">
      <h1>${esc(title)}</h1>
      <p class="byline">
        <span>${esc(byline)}</span>
        <span class="read-time">阅读约 ${rt} 分钟</span>
        ${avg > 0 ? `<span class="rating-badge"><span class="star-icon">★</span> ${avg}<span style="font-weight:400;font-size:0.8rem;color:var(--text-muted);margin-left:0.3rem;">(${commentCount}评)</span></span>` : ''}
      </p>
      ${coverUrl ? `<img class="cover-img" src="${esc(coverUrl)}" alt="${esc(title)}" onerror="this.style.display='none'">` : ''}
      <div class="body">${bodyHtml}</div>
    </div>`;

  renderComments(type, id);
  document.title = title + ' — ' + (Store.getSiteInfo().title || 'MYGO-MUJICA-WEB');
}

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

  const comments = Store.getComments(type, id);
  const currentUser = Store.getCurrentUser();

  listArea.innerHTML = comments.length ? comments.map(c => `
    <div class="comment-item">
      <div class="c-header">
        <span class="c-author">${esc(c.author)}</span>
        <span class="c-rating">★ ${c.rating}</span>
      </div>
      <div class="c-content">${esc(c.content)}</div>
      <div class="c-footer">
        <span>${c.date}</span>
        ${currentUser === c.author ? `<button class="c-delete" onclick="deleteComment('${type}','${id}','${c.id}')">删除</button>` : ''}
      </div>
    </div>
  `).join('') : '<p class="no-comments">暂无评论，成为第一个评价的人吧。</p>';
}

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
