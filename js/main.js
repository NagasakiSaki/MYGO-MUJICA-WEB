/**
 * Dynamic rendering + Auth + Comments for MYGO-MUJICA-WEB
 */
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  // ── Auth header ──
  renderAuthArea();
  renderAuthModal();

  // ── Site title ──
  const info = Store.getSiteInfo();
  document.querySelectorAll('.site-title').forEach(el => {
    if (info.title) el.textContent = info.title;
  });
  document.title = info.title || 'MYGO-MUJICA-WEB';

  // Nav highlight
  document.querySelectorAll('.site-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === 'detail.html' && href.includes('detail'))) {
      link.classList.add('active');
    }
  });

  // ── Page routing ──
  if (page === 'index.html' || page === '') renderHomepage(info);
  else if (page === 'literature.html') renderLiterature();
  else if (page === 'projects.html') renderProjects();
  else if (page === 'recommendations.html') renderRecommendations();
  else if (page === 'detail.html') renderDetail();
});

// ── helper ──
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// ═══════════════════════════════════════
//  AUTH UI
// ═══════════════════════════════════════
function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const user = Store.getCurrentUser();

  if (user) {
    area.innerHTML = `
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
    area.innerHTML = `<button class="auth-btn" onclick="showAuthModal('login')">登录</button>`;
  }
}

function renderAuthModal() {
  const box = document.getElementById('authModalBox');
  if (!box) return;
  // Pre-render both forms, toggled by CSS
  box.innerHTML = `
    <div id="loginForm">
      <h2>登录</h2>
      <div class="msg" id="loginMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="loginUsername"></div>
      <div class="form-group"><label>密码</label><input type="password" id="loginPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;" onclick="doLogin()">登录</button>
      <p class="switch-text">没有账号？<a onclick="showAuthModal('register')">立即注册</a></p>
    </div>
    <div id="registerForm" style="display:none;">
      <h2>注册</h2>
      <div class="msg" id="registerMsg"></div>
      <div class="form-group"><label>用户名</label><input type="text" id="regUsername"></div>
      <div class="form-group"><label>密码</label><input type="password" id="regPassword"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;" onclick="doRegister()">注册</button>
      <p class="switch-text">已有账号？<a onclick="showAuthModal('login')">去登录</a></p>
    </div>`;
}

function showAuthModal(type) {
  document.getElementById('authModal').classList.add('show');
  document.getElementById('loginForm').style.display = type === 'login' ? '' : 'none';
  document.getElementById('registerForm').style.display = type === 'register' ? '' : 'none';
  // Clear
  const lm = document.getElementById('loginMsg'), rm = document.getElementById('registerMsg');
  if (lm) { lm.textContent = ''; lm.className = 'msg'; }
  if (rm) { rm.textContent = ''; rm.className = 'msg'; }
}

function hideAuthModal() {
  document.getElementById('authModal').classList.remove('show');
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.id === 'authModal') hideAuthModal();
});

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

// ═══════════════════════════════════════
//  HOME PAGE
// ═══════════════════════════════════════
function renderHomepage(info) {
  const p = document.querySelector('.hero p');
  if (p && info.subtitle) p.textContent = info.subtitle;
}

// ═══════════════════════════════════════
//  LITERATURE LIST
// ═══════════════════════════════════════
function renderLiterature() {
  const list = document.getElementById('lit-list');
  if (!list) return;
  const items = Store.getLiterature();
  list.innerHTML = items.length ? items.map(i => {
    const avg = Store.avgRating('lit', i.id);
    return `
    <li class="article-item">
      <time>${esc(i.date)}</time>
      <h3><a href="detail.html?type=lit&id=${i.id}">${esc(i.title)}</a></h3>
      <p class="excerpt">${esc(i.excerpt)}</p>
      ${avg > 0 ? `<div class="rating-badge" style="margin-top:0.4rem;font-size:0.82rem;">★ ${avg}</div>` : ''}
    </li>`;
  }).join('') : '<p style="color:var(--text-muted);">暂无文章，去 <a href="admin.html">管理后台</a> 添加吧。</p>';
}

// ═══════════════════════════════════════
//  PROJECTS LIST
// ═══════════════════════════════════════
function renderProjects() {
  const list = document.getElementById('proj-list');
  if (!list) return;
  const items = Store.getProjects();
  list.innerHTML = items.length ? items.map(i => {
    const avg = Store.avgRating('proj', i.id);
    return `
    <div class="project-card">
      <h3><a href="detail.html?type=proj&id=${i.id}">${esc(i.name)}</a>${i.link ? ` <a href="${esc(i.link)}" target="_blank" style="font-size:0.78rem;color:var(--accent);">↗</a>` : ''}</h3>
      <p>${esc(i.desc)}</p>
      <div class="tech-tags">${(i.tags || []).map(t => `<span class="tech-tag">${esc(t)}</span>`).join('')}</div>
      ${avg > 0 ? `<div class="rating-badge" style="margin-top:0.5rem;font-size:0.82rem;">★ ${avg}</div>` : ''}
    </div>`;
  }).join('') : '<p style="color:var(--text-muted);">暂无项目，去 <a href="admin.html">管理后台</a> 添加吧。</p>';
}

// ═══════════════════════════════════════
//  RECOMMENDATIONS LIST
// ═══════════════════════════════════════
function renderRecommendations() {
  const all = Store.getRecommendations();

  function recGrid(items, cat, authorKey) {
    if (!items.length) return '<p style="color:var(--text-muted);font-size:0.9rem;">暂无</p>';
    return '<div class="rec-grid">' + items.map(i => {
      const avg = Store.avgRating('rec', i.id);
      return `
      <div class="rec-item">
        <a href="detail.html?type=rec&id=${i.id}">
          <h4>${esc(i.title)}</h4>
          <p class="meta">${esc(i[authorKey] || '')}${i.year ? ' · ' + esc(i.year) : ''}</p>
          <p>${esc(i.excerpt || i.review || '').slice(0, 80)}${(i.excerpt || i.review || '').length > 80 ? '…' : ''}</p>
          ${avg > 0 ? `<div class="rating-badge" style="margin-top:0.3rem;">★ ${avg}</div>` : ''}
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

// ═══════════════════════════════════════
//  DETAIL PAGE (lit / proj / rec)
// ═══════════════════════════════════════
function renderDetail() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');
  const container = document.getElementById('detailContent');
  if (!container) return;

  if (!type || !id) {
    container.innerHTML = '<p>无效链接。</p>';
    return;
  }

  let backUrl, title, byline, body, item;

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

  if (!item) {
    container.innerHTML = '<p>内容不存在或已被删除。</p>';
    return;
  }

  // Build detail view
  if (type === 'lit') {
    title = item.title;
    byline = item.date;
    body = item.content || item.excerpt;
  } else if (type === 'proj') {
    title = item.name;
    byline = (item.tags || []).join(' · ');
    body = item.detail || item.desc;
    if (item.link) {
      body += '\n\n项目链接：' + item.link;
    }
  } else if (type === 'rec') {
    title = item.title;
    const creator = item.author || item.artist || item.director || '';
    byline = creator + (item.year ? ' · ' + item.year : '');
    body = item.review || item.excerpt || '';
  }

  const avg = Store.avgRating(type, id);

  container.innerHTML = `
    <a href="${backUrl}" class="detail-back">← 返回列表</a>
    <div class="detail-article">
      <h1>${esc(title)}</h1>
      <p class="byline">${esc(byline)}</p>
      ${avg > 0 ? `<div class="rating-badge" style="margin-bottom:1rem;">★ ${avg} <span style="font-weight:400;font-size:0.82rem;color:var(--text-muted);">(${Store.getComments(type, id).length} 条评价)</span></div>` : ''}
      <div class="body">${esc(body)}</div>
    </div>`;

  // Render comments
  renderComments(type, id);

  // Update page title
  document.title = title + ' — ' + (Store.getSiteInfo().title || 'MYGO-MUJICA-WEB');
}

// ═══════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════
function renderComments(type, id) {
  const formArea = document.getElementById('commentFormArea');
  const listArea = document.getElementById('commentList');

  if (!formArea || !listArea) return;

  const loggedIn = Store.isLoggedIn();

  // Comment form
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

  // Render existing comments
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
      renderDetail(); // refresh avg rating
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
