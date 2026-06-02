/**
 * Admin panel logic for MYGO-MUJICA-WEB
 */
let editingLitId = null;
let editingProjId = null;
let editingRecId = null;

// ── Login ────────────────────────────────────────────
function checkAuth() {
  const pw = Store.getAdminPassword();
  if (!pw) return true; // no password set, allow entry
  return sessionStorage.getItem('mygo_auth') === '1';
}

function doLogin() {
  const input = document.getElementById('loginPw').value.trim();
  const current = Store.getAdminPassword();
  if (!current) {
    Store.setAdminPassword(input);
    sessionStorage.setItem('mygo_auth', '1');
    showMain();
  } else if (input === current) {
    sessionStorage.setItem('mygo_auth', '1');
    showMain();
  } else {
    document.getElementById('loginHint').textContent = '密码错误，请重试';
    document.getElementById('loginHint').style.color = '#c62828';
  }
}

function doLogout() {
  sessionStorage.removeItem('mygo_auth');
  location.reload();
}

function showMain() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('mainSection').style.display = 'block';
  renderAll();
}

// ── Tabs ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) showMain();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(name).classList.add('active');
}

// ── Literature ──────────────────────────────────────
function saveLit() {
  const id = editingLitId || Store.genId();
  const item = {
    id,
    title: document.getElementById('litTitle').value.trim(),
    date: document.getElementById('litDate').value,
    excerpt: document.getElementById('litExcerpt').value.trim(),
    content: document.getElementById('litContent').value.trim()
  };
  if (!item.title || !item.date) return alert('请填写标题和日期');

  let items = Store.getLiterature();
  if (editingLitId) {
    items = items.map(i => i.id === editingLitId ? item : i);
  } else {
    items.unshift(item);
  }
  Store.setLiterature(items);
  cancelLit();
  renderLitList();
}

function editLit(id) {
  const item = Store.getLiterature().find(i => i.id === id);
  if (!item) return;
  editingLitId = id;
  document.getElementById('litFormTitle').textContent = '编辑文章';
  document.getElementById('litId').value = id;
  document.getElementById('litTitle').value = item.title;
  document.getElementById('litDate').value = item.date;
  document.getElementById('litExcerpt').value = item.excerpt;
  document.getElementById('litContent').value = item.content || '';
  window.scrollTo(0, 0);
}

function deleteLit(id) {
  if (!confirm('确认删除这篇文章？')) return;
  Store.setLiterature(Store.getLiterature().filter(i => i.id !== id));
  if (editingLitId === id) cancelLit();
  renderLitList();
}

function cancelLit() {
  editingLitId = null;
  document.getElementById('litFormTitle').textContent = '新建文章';
  document.getElementById('litId').value = '';
  document.getElementById('litTitle').value = '';
  document.getElementById('litDate').value = '';
  document.getElementById('litExcerpt').value = '';
  document.getElementById('litContent').value = '';
}

function renderLitList() {
  const container = document.getElementById('litList');
  const items = Store.getLiterature();
  container.innerHTML = items.length ? items.map(i => `
    <div class="item-row">
      <div class="info">
        <div class="title">${escHtml(i.title)}</div>
        <div class="meta">${i.date}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline btn-sm" onclick="editLit('${i.id}')">编辑</button>
        <button class="btn btn-danger btn-sm" onclick="deleteLit('${i.id}')">删除</button>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:0.9rem;">暂无文章</p>';
}

// ── Projects ────────────────────────────────────────
function saveProj() {
  const id = editingProjId || Store.genId();
  const item = {
    id,
    name: document.getElementById('projName').value.trim(),
    desc: document.getElementById('projDesc').value.trim(),
    detail: document.getElementById('projDetail').value.trim(),
    tags: document.getElementById('projTags').value.split(',').map(t => t.trim()).filter(Boolean),
    link: document.getElementById('projLink').value.trim()
  };
  if (!item.name) return alert('请填写项目名称');

  let items = Store.getProjects();
  if (editingProjId) {
    items = items.map(i => i.id === editingProjId ? item : i);
  } else {
    items.unshift(item);
  }
  Store.setProjects(items);
  cancelProj();
  renderProjList();
}

function editProj(id) {
  const item = Store.getProjects().find(i => i.id === id);
  if (!item) return;
  editingProjId = id;
  document.getElementById('projFormTitle').textContent = '编辑项目';
  document.getElementById('projId').value = id;
  document.getElementById('projName').value = item.name;
  document.getElementById('projDesc').value = item.desc || '';
  document.getElementById('projDetail').value = item.detail || '';
  document.getElementById('projTags').value = (item.tags || []).join(', ');
  document.getElementById('projLink').value = item.link || '';
  window.scrollTo(0, 0);
}

function deleteProj(id) {
  if (!confirm('确认删除这个项目？')) return;
  Store.setProjects(Store.getProjects().filter(i => i.id !== id));
  if (editingProjId === id) cancelProj();
  renderProjList();
}

function cancelProj() {
  editingProjId = null;
  document.getElementById('projFormTitle').textContent = '新建项目';
  document.getElementById('projId').value = '';
  document.getElementById('projName').value = '';
  document.getElementById('projDesc').value = '';
  document.getElementById('projDetail').value = '';
  document.getElementById('projTags').value = '';
  document.getElementById('projLink').value = '';
}

function renderProjList() {
  const container = document.getElementById('projList');
  const items = Store.getProjects();
  container.innerHTML = items.length ? items.map(i => `
    <div class="item-row">
      <div class="info">
        <div class="title">${escHtml(i.name)}</div>
        <div class="meta">${(i.tags||[]).join(', ')}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline btn-sm" onclick="editProj('${i.id}')">编辑</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProj('${i.id}')">删除</button>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:0.9rem;">暂无项目</p>';
}

// ── Recommendations ─────────────────────────────────
function onRecCatChange() {
  const cat = document.getElementById('recCat').value;
  const authorRow = document.getElementById('recAuthorRow');
  const authorLabel = authorRow.querySelector('label');
  if (cat === 'books') authorLabel.textContent = '作者';
  else if (cat === 'music') authorLabel.textContent = '艺术家';
  else authorLabel.textContent = '导演';
}

function saveRec() {
  const id = editingRecId || Store.genId();
  const cat = document.getElementById('recCat').value;
  const item = {
    id,
    cover: document.getElementById('recCover').value.trim(),
    excerpt: document.getElementById('recExcerpt').value.trim(),
    review: document.getElementById('recReview').value.trim(),
    year: document.getElementById('recYear').value.trim()
  };
  item.title = document.getElementById('recTitle').value.trim();
  if (cat === 'books') item.author = document.getElementById('recAuthor').value.trim();
  else if (cat === 'music') item.artist = document.getElementById('recAuthor').value.trim();
  else item.director = document.getElementById('recAuthor').value.trim();

  if (!item.title) return alert('请填写标题');

  let all = Store.getRecommendations();
  if (editingRecId) {
    for (const k of ['books', 'music', 'films']) {
      all[k] = all[k].filter(i => i.id !== editingRecId);
    }
    all[cat] = [item, ...all[cat]];
  } else {
    all[cat] = [item, ...all[cat]];
  }
  Store.setRecommendations(all);
  cancelRec();
  renderRecLists();
}

function editRec(id) {
  let item = null, cat = '';
  const all = Store.getRecommendations();
  for (const k of ['books', 'music', 'films']) {
    const found = all[k].find(i => i.id === id);
    if (found) { item = found; cat = k; break; }
  }
  if (!item) return;
  editingRecId = id;
  document.getElementById('recFormTitle').textContent = '编辑推荐';
  document.getElementById('recId').value = id;
  document.getElementById('recCat').value = cat;
  onRecCatChange();
  document.getElementById('recTitle').value = item.title || '';
  document.getElementById('recAuthor').value = item.author || item.artist || item.director || '';
  document.getElementById('recYear').value = item.year || '';
  document.getElementById('recCover').value = item.cover || '';
  document.getElementById('recExcerpt').value = item.excerpt || '';
  document.getElementById('recReview').value = item.review || '';
  window.scrollTo(0, 0);
}

function deleteRec(id) {
  if (!confirm('确认删除？')) return;
  let all = Store.getRecommendations();
  for (const k of ['books', 'music', 'films']) {
    all[k] = all[k].filter(i => i.id !== id);
  }
  Store.setRecommendations(all);
  if (editingRecId === id) cancelRec();
  renderRecLists();
}

function cancelRec() {
  editingRecId = null;
  document.getElementById('recFormTitle').textContent = '新建推荐';
  document.getElementById('recId').value = '';
  document.getElementById('recTitle').value = '';
  document.getElementById('recAuthor').value = '';
  document.getElementById('recYear').value = '';
  document.getElementById('recCover').value = '';
  document.getElementById('recExcerpt').value = '';
  document.getElementById('recReview').value = '';
}

function renderRecLists() {
  const all = Store.getRecommendations();
  function renderItems(items, cat) {
    return items.length ? items.map(i => `
      <div class="item-row">
        <div class="info">
          <div class="title">${escHtml(i.title)}</div>
          <div class="meta">${i.author || i.artist || i.director || ''} · ${i.year || ''}</div>
        </div>
        <div class="actions">
          <button class="btn btn-outline btn-sm" onclick="editRec('${i.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRec('${i.id}')">删除</button>
        </div>
      </div>
    `).join('') : '<p style="color:var(--text-muted);font-size:0.9rem;">暂无</p>';
  }
  document.getElementById('recBooksList').innerHTML = renderItems(all.books);
  document.getElementById('recMusicList').innerHTML = renderItems(all.music);
  document.getElementById('recFilmsList').innerHTML = renderItems(all.films);
}

// ── Site Settings ───────────────────────────────────
function loadSiteSettings() {
  const info = Store.getSiteInfo();
  document.getElementById('siteTitle').value = info.title;
  document.getElementById('siteSubtitle').value = info.subtitle;
}
function saveSite() {
  Store.setSiteInfo({
    title: document.getElementById('siteTitle').value.trim(),
    subtitle: document.getElementById('siteSubtitle').value.trim()
  });
  alert('网站设置已保存');
}
function changePassword() {
  const pw = document.getElementById('newPassword').value.trim();
  if (!pw) return;
  Store.setAdminPassword(pw);
  document.getElementById('newPassword').value = '';
  alert('密码已修改');
}

// ── Init ────────────────────────────────────────────
function renderAll() {
  renderLitList();
  renderProjList();
  renderRecLists();
  loadSiteSettings();
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
