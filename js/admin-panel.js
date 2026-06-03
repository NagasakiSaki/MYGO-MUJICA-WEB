/**
 * MYGO-MUJICA-WEB — Admin Panel (Supabase backend)
 */
(() => {

let editingLitId = null, editingProjId = null, editingRecId = null;

// ── Entry point ──────────────────────────────────────
window.openAdminLogin = function() {
  if (typeof Store.isAdminLoggedIn === 'function') {
    Store.isAdminLoggedIn().then(isAdmin => {
      if (isAdmin) { openAdminPanel(); return; }
      if (typeof showAuthModal === 'function') showAuthModal();
    });
  }
};

// ═══════════════════════════════════════════════════════
//  PANEL
// ═══════════════════════════════════════════════════════
function openAdminPanel() {
  let panel = document.getElementById('adminOverlay');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'adminOverlay';
    panel.className = 'admin-overlay';
    panel.innerHTML = `
      <div class="admin-header-bar">
        <h2>管理后台 <span style="font-size:0.8rem;color:var(--accent);">(数据实时生效)</span></h2>
        <div class="admin-actions">
          <button class="admin-btn outline" onclick="window.closeAdminPanel()">关闭</button>
        </div>
      </div>
      <div class="admin-body" id="adminBody"></div>`;
    document.body.appendChild(panel);
  }
  panel.classList.add('show');
  document.body.style.overflow = 'hidden';
  renderAdminPanel();
}

window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = function() {
  document.getElementById('adminOverlay').classList.remove('show');
  document.body.style.overflow = '';
};

function refreshEditorUI() {
  if (typeof renderAuthArea === 'function') renderAuthArea();
  if (typeof hideAuthModal === 'function') hideAuthModal();
}

// ── Render ────────────────────────────────────────────
async function renderAdminPanel() {
  const body = document.getElementById('adminBody');
  if (!body) return;
  const isMod = await Store.isModerator();

  body.innerHTML = isMod ? `
    <div class="admin-tabs">
      <button class="admin-tab-btn active" data-atab="alit">文学创作</button>
      <button class="admin-tab-btn" data-atab="aproj">代码项目</button>
      <button class="admin-tab-btn" data-atab="arec">推荐帖</button>
      <button class="admin-tab-btn" data-atab="asite">网站设置</button>
      <button class="admin-tab-btn" data-atab="acommunity">社区管理</button>
    </div>
    <div class="admin-tab-panel active" id="alit"></div>
    <div class="admin-tab-panel" id="aproj"></div>
    <div class="admin-tab-panel" id="arec"></div>
    <div class="admin-tab-panel" id="asite"></div>
    <div class="admin-tab-panel" id="acommunity"></div>`
    : `
    <div style="text-align:center;color:var(--accent);padding:0.5rem;font-weight:600;">🛡️ 管理员面板 — 社区管理</div>
    <div class="admin-tab-panel active" id="acommunity"></div>`;

  if (isMod) {
    await renderLitTab(); await renderProjTab(); await renderRecTab(); renderSiteTab(); await renderCommunityTab();
    body.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        body.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(btn.dataset.atab).classList.add('active');
      });
    });
  } else {
    await renderCommunityTab();
  }
}

// ═══════════════════════════════════════════════════════
//  LITERATURE TAB
// ═══════════════════════════════════════════════════════
async function renderLitTab() {
  const panel = document.getElementById('alit'); if (!panel) return;
  panel.innerHTML = `
    <div class="admin-form">
      <h3 id="litFormTitle">新建文章</h3>
      <input type="hidden" id="litId">
      <div class="form-row"><label>标题</label><input type="text" id="litTitle"></div>
      <div class="form-row"><label>日期</label><input type="date" id="litDate"></div>
      <div class="form-row"><label>分类</label><input type="text" id="litCategory" placeholder="如：随笔、技术..."></div>
      <div class="form-row"><label>标签（逗号分隔）</label><input type="text" id="litTags" placeholder="标签1, 标签2"></div>
      <div class="form-row"><label>摘要</label><textarea id="litExcerpt"></textarea></div>
      <div class="form-row"><label>正文 (Markdown)</label><textarea id="litContent" class="tall"></textarea></div>
      <div class="btn-row">
        <button class="admin-btn primary" onclick="window.saveLit()">保存</button>
        <button class="admin-btn outline" onclick="window.cancelLit()">取消</button>
      </div>
      <div class="msg" id="litFormMsg"></div>
    </div>
    <div class="admin-item-list" id="litList"></div>`;
  await renderLitList();
}

window.saveLit = async function() {
  if (!(await requireModerator())) return;
  const item = {
    title: document.getElementById('litTitle').value.trim(),
    date: document.getElementById('litDate').value,
    category: document.getElementById('litCategory').value.trim(),
    tags: document.getElementById('litTags').value.split(',').map(t => t.trim()).filter(Boolean),
    excerpt: document.getElementById('litExcerpt').value.trim(),
    content: document.getElementById('litContent').value.trim()
  };
  if (!item.title || !item.date) { showFormMsg('litFormMsg', '请填写标题和日期', 'error'); return; }

  let result;
  if (editingLitId) result = await Store.updateLiterature(editingLitId, item);
  else result = await Store.insertLiterature(item);

  if (result.ok) { window.cancelLit(); await renderLitList(); }
  else { showFormMsg('litFormMsg', result.msg, 'error'); }
};

window.editLit = async function(id) {
  const items = await Store.getLiterature();
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingLitId = id;
  document.getElementById('litFormTitle').textContent = '编辑文章';
  document.getElementById('litId').value = id;
  document.getElementById('litTitle').value = item.title || '';
  document.getElementById('litDate').value = item.date || '';
  document.getElementById('litCategory').value = item.category || '';
  document.getElementById('litTags').value = (item.tags || []).join(', ');
  document.getElementById('litExcerpt').value = item.excerpt || '';
  document.getElementById('litContent').value = item.content || '';
  document.getElementById('alit').scrollIntoView({ behavior: 'smooth' });
};

window.deleteLit = async function(id) {
  if (!(await requireModerator())) return;
  if (!confirm('确认删除？')) return;
  await Store.deleteLiterature(id);
  if (editingLitId === id) window.cancelLit();
  await renderLitList();
};

window.cancelLit = function() {
  editingLitId = null;
  document.getElementById('litFormTitle').textContent = '新建文章';
  ['litId', 'litTitle', 'litDate', 'litCategory', 'litTags', 'litExcerpt', 'litContent'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  clearMsg('litFormMsg');
};

async function renderLitList() {
  const container = document.getElementById('litList'); if (!container) return;
  const items = await Store.getLiterature();
  container.innerHTML = items.length ? items.map(i => `
    <div class="admin-item-row">
      <div class="info"><div class="name">${escHtml(i.title)}</div><div class="meta">${escHtml(i.date)}</div></div>
      <div class="actions">
        <button class="admin-btn outline sm" onclick="window.editLit('${i.id}')">编辑</button>
        <button class="admin-btn danger sm" onclick="window.deleteLit('${i.id}')">删除</button>
      </div>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">暂无文章</p>';
}

// ═══════════════════════════════════════════════════════
//  PROJECTS TAB
// ═══════════════════════════════════════════════════════
async function renderProjTab() {
  const panel = document.getElementById('aproj'); if (!panel) return;
  panel.innerHTML = `
    <div class="admin-form">
      <h3 id="projFormTitle">新建项目</h3>
      <input type="hidden" id="projId">
      <div class="form-row"><label>项目名称</label><input type="text" id="projName"></div>
      <div class="form-row"><label>简介</label><textarea id="projDesc"></textarea></div>
      <div class="form-row"><label>详细介绍 (Markdown)</label><textarea id="projDetail" class="tall"></textarea></div>
      <div class="form-row"><label>技术标签 (逗号分隔)</label><input type="text" id="projTags" placeholder="HTML, CSS, JS"></div>
      <div class="form-row"><label>项目链接</label><input type="text" id="projLink" placeholder="https://github.com/..."></div>
      <div class="btn-row">
        <button class="admin-btn primary" onclick="window.saveProj()">保存</button>
        <button class="admin-btn outline" onclick="window.cancelProj()">取消</button>
      </div>
      <div class="msg" id="projFormMsg"></div>
    </div>
    <div class="admin-item-list" id="projList"></div>`;
  await renderProjList();
}

window.saveProj = async function() {
  if (!(await requireModerator())) return;
  const item = {
    name: document.getElementById('projName').value.trim(),
    description: document.getElementById('projDesc').value.trim(),
    detail: document.getElementById('projDetail').value.trim(),
    tags: document.getElementById('projTags').value.split(',').map(t => t.trim()).filter(Boolean),
    link: document.getElementById('projLink').value.trim()
  };
  if (!item.name) { showFormMsg('projFormMsg', '请填写项目名称', 'error'); return; }

  let result;
  if (editingProjId) result = await Store.updateProject(editingProjId, item);
  else result = await Store.insertProject(item);

  if (result.ok) { window.cancelProj(); await renderProjList(); }
  else { showFormMsg('projFormMsg', result.msg, 'error'); }
};

window.editProj = async function(id) {
  const items = await Store.getProjects();
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingProjId = id;
  document.getElementById('projFormTitle').textContent = '编辑项目';
  document.getElementById('projId').value = id;
  document.getElementById('projName').value = item.name || '';
  document.getElementById('projDesc').value = item.description || item.desc || '';
  document.getElementById('projDetail').value = item.detail || '';
  document.getElementById('projTags').value = (item.tags || []).join(', ');
  document.getElementById('projLink').value = item.link || '';
  document.getElementById('aproj').scrollIntoView({ behavior: 'smooth' });
};

window.deleteProj = async function(id) {
  if (!(await requireModerator())) return;
  if (!confirm('确认删除？')) return;
  await Store.deleteProject(id);
  if (editingProjId === id) window.cancelProj();
  await renderProjList();
};

window.cancelProj = function() {
  editingProjId = null;
  document.getElementById('projFormTitle').textContent = '新建项目';
  ['projId', 'projName', 'projDesc', 'projDetail', 'projTags', 'projLink'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  clearMsg('projFormMsg');
};

async function renderProjList() {
  const container = document.getElementById('projList'); if (!container) return;
  const items = await Store.getProjects();
  container.innerHTML = items.length ? items.map(i => `
    <div class="admin-item-row">
      <div class="info"><div class="name">${escHtml(i.name)}</div><div class="meta">${(i.tags || []).join(', ')}</div></div>
      <div class="actions">
        <button class="admin-btn outline sm" onclick="window.editProj('${i.id}')">编辑</button>
        <button class="admin-btn danger sm" onclick="window.deleteProj('${i.id}')">删除</button>
      </div>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">暂无项目</p>';
}

// ═══════════════════════════════════════════════════════
//  RECOMMENDATIONS TAB
// ═══════════════════════════════════════════════════════
async function renderRecTab() {
  const panel = document.getElementById('arec'); if (!panel) return;
  panel.innerHTML = `
    <div class="admin-form">
      <h3 id="recFormTitle">新建推荐帖</h3>
      <input type="hidden" id="recId">
      <div class="form-row"><label>分类</label><select id="recCat">
        <option value="literary">严肃文学</option><option value="popular">流行文学</option>
        <option value="lightnovel">轻小说</option><option value="manga">漫画</option>
        <option value="movie">电影</option><option value="drama">电视剧</option>
        <option value="anime">动画</option><option value="music">音乐</option>
      </select></div>
      <div class="form-row"><label>标题</label><input type="text" id="recTitle"></div>
      <div class="form-row"><label>创作者</label><input type="text" id="recAuthor"></div>
      <div class="form-row"><label>年份</label><input type="text" id="recYear"></div>
      <div class="form-row"><label>封面图 URL</label><input type="text" id="recCover" placeholder="https://..."></div>
      <div class="form-row"><label>摘要</label><textarea id="recExcerpt"></textarea></div>
      <div class="form-row"><label>正文 (Markdown)</label><textarea id="recReview" class="tall"></textarea></div>
      <div class="btn-row">
        <button class="admin-btn primary" onclick="window.saveRec()">保存</button>
        <button class="admin-btn outline" onclick="window.cancelRec()">取消</button>
      </div>
      <div class="msg" id="recFormMsg"></div>
    </div>
    ${[
      {k:'literary',icon:'📖',label:'严肃文学'},{k:'popular',icon:'📚',label:'流行文学'},
      {k:'lightnovel',icon:'📙',label:'轻小说'},{k:'manga',icon:'📘',label:'漫画'},
      {k:'movie',icon:'🎬',label:'电影'},{k:'drama',icon:'📺',label:'电视剧'},
      {k:'anime',icon:'🎞️',label:'动画'},{k:'music',icon:'🎵',label:'音乐'}
    ].map(c => `
    <div style="margin-top:1rem;">
      <h4 style="font-size:0.9rem;color:var(--accent);margin-bottom:0.4rem;">${c.icon} ${c.label}</h4>
      <div class="admin-item-list" id="rec-${c.k}-list"></div>
    </div>`).join('')}`;
  await renderRecLists();
}

window.saveRec = async function() {
  if (!(await requireModerator())) return;
  const item = {
    title: document.getElementById('recTitle').value.trim(),
    category: document.getElementById('recCat').value,
    creator: document.getElementById('recAuthor').value.trim(),
    year: document.getElementById('recYear').value.trim(),
    cover: document.getElementById('recCover').value.trim(),
    excerpt: document.getElementById('recExcerpt').value.trim(),
    review: document.getElementById('recReview').value.trim()
  };
  if (!item.title) { showFormMsg('recFormMsg', '请填写标题', 'error'); return; }

  let result;
  if (editingRecId) result = await Store.updateRecommendation(editingRecId, item);
  else result = await Store.insertRecommendation(item);

  if (result.ok) { window.cancelRec(); await renderRecLists(); }
  else { showFormMsg('recFormMsg', result.msg, 'error'); }
};

window.editRec = async function(id) {
  const all = await Store.getRecommendations();
  let item = null, cat = '';
  for (const k of ['literary','popular','lightnovel','manga','movie','drama','anime','music']) {
    const found = (all[k] || []).find(i => i.id === id);
    if (found) { item = found; cat = k; break; }
  }
  if (!item) return;
  editingRecId = id;
  document.getElementById('recFormTitle').textContent = '编辑推荐帖';
  document.getElementById('recId').value = id;
  document.getElementById('recCat').value = cat;
  document.getElementById('recTitle').value = item.title || '';
  document.getElementById('recAuthor').value = item.creator || '';
  document.getElementById('recYear').value = item.year || '';
  document.getElementById('recCover').value = item.cover || '';
  document.getElementById('recExcerpt').value = item.excerpt || '';
  document.getElementById('recReview').value = item.review || '';
  document.getElementById('arec').scrollIntoView({ behavior: 'smooth' });
};

window.deleteRec = async function(id) {
  if (!(await requireModerator())) return;
  if (!confirm('确认删除？')) return;
  await Store.deleteRecommendation(id);
  if (editingRecId === id) window.cancelRec();
  await renderRecLists();
};

window.cancelRec = function() {
  editingRecId = null;
  document.getElementById('recFormTitle').textContent = '新建推荐帖';
  ['recId','recTitle','recAuthor','recYear','recCover','recExcerpt','recReview'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  clearMsg('recFormMsg');
};

async function renderRecLists() {
  const all = await Store.getRecommendations();
  const renderItems = (items) => (items || []).length ? items.map(i => `
    <div class="admin-item-row">
      <div class="info"><div class="name">${escHtml(i.title)}</div><div class="meta">${escHtml(i.creator||'')} ${i.year||''}</div></div>
      <div class="actions">
        <button class="admin-btn outline sm" onclick="window.editRec('${i.id}')">编辑</button>
        <button class="admin-btn danger sm" onclick="window.deleteRec('${i.id}')">删除</button>
      </div>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">暂无</p>';
  ['literary','popular','lightnovel','manga','movie','drama','anime','music'].forEach(cat => {
    const el = document.getElementById('rec-' + cat + '-list');
    if (el) el.innerHTML = renderItems(all[cat] || []);
  });
}

// ═══════════════════════════════════════════════════════
//  SITE SETTINGS
// ═══════════════════════════════════════════════════════
async function renderSiteTab() {
  const panel = document.getElementById('asite'); if (!panel) return;
  const info = await Store.getSiteInfo();
  panel.innerHTML = `
    <div class="admin-form">
      <h3>网站信息</h3>
      <div class="form-row"><label>网站标题</label><input type="text" id="siteTitle" value="${escHtml(info.title)}"></div>
      <div class="form-row"><label>首页副标题</label><input type="text" id="siteSubtitle" value="${escHtml(info.subtitle)}"></div>
      <div class="btn-row"><button class="admin-btn primary" onclick="window.saveSiteSettings()">保存</button></div>
      <div class="msg" id="siteFormMsg"></div>
    </div>
    <div class="admin-form" id="adminMgmtSection"></div>`;
  renderAdminMgmt();
}

window.saveSiteSettings = async function() {
  const result = await Store.setSiteInfo({
    title: document.getElementById('siteTitle').value.trim(),
    subtitle: document.getElementById('siteSubtitle').value.trim()
  });
  if (result.ok) {
    showFormMsg('siteFormMsg', '已保存（存储在浏览器本地）', 'success');
    // Also update the live site title
    document.querySelectorAll('.site-title').forEach(el => { el.textContent = document.getElementById('siteTitle').value.trim(); });
    document.title = document.getElementById('siteTitle').value.trim();
  }
};

async function renderAdminMgmt() {
  const section = document.getElementById('adminMgmtSection'); if (!section) return;
  const admins = await Store.getAdmins();
  const users = await Store.getUsers();
  section.innerHTML = `
    <h3>管理员列表 (${admins.length}人)</h3>
    <div class="admin-item-list" style="margin-bottom:0.8rem;">
      ${admins.map(a => `
        <div class="admin-item-row">
          <div class="info">
            <div class="name">${escHtml(a.nickname||a.username)} <span style="color:var(--text-muted);font-weight:400;">@${escHtml(a.username)}</span>
              <span style="font-size:0.72rem;color:${a.role==='moderator'?'#e6a817':'var(--accent)'};">[${a.role==='moderator'?'版主':'管理员'}]</span>
            </div>
          </div>
          <div class="actions">
            ${a.role !== 'moderator' ? `<button class="admin-btn danger sm" onclick="window.demoteAdminDialog2('${escHtml(a.username)}')">贬黜</button>` : '<span style="font-size:0.75rem;color:var(--text-muted);">受保护</span>'}
          </div>
        </div>`).join('')}
    </div>
    <h4 style="font-size:0.9rem;margin-bottom:0.5rem;">提拔管理员</h4>
    <div class="form-row"><label>选择普通用户</label><select id="promoteUserSelect">${users.filter(u => u.role === 'user').map(u => `<option value="${escHtml(u.username)}">${escHtml(u.nickname||u.username)} (@${escHtml(u.username)})</option>`).join('')}</select></div>
    <div class="btn-row"><button class="admin-btn primary" onclick="window.promoteAdminFromSelect()">提拔</button></div>
    <div class="msg" id="adminMgmtMsg"></div>`;
}

window.promoteAdminFromSelect = async function() {
  const username = document.getElementById('promoteUserSelect').value;
  const result = await Store.promoteToAdmin(username);
  if (result.ok) { showFormMsg('adminMgmtMsg', '已提拔', 'success'); await renderAdminMgmt(); }
  else { showFormMsg('adminMgmtMsg', result.msg, 'error'); }
};

window.demoteAdminDialog2 = async function(username) {
  if (!confirm('确认贬黜管理员 @' + username + '？')) return;
  const result = await Store.demoteFromAdmin(username);
  if (result.ok) { await renderAdminMgmt(); } else { alert(result.msg); }
};

// ═══════════════════════════════════════════════════════
//  COMMUNITY MANAGEMENT
// ═══════════════════════════════════════════════════════
async function renderCommunityTab() {
  const panel = document.getElementById('acommunity'); if (!panel) return;
  const allUsers = await Store.getUsers();

  // Collect all comments
  const allComments = [];
  const types = ['lit', 'proj', 'rec'];
  for (const type of types) {
    const items = type === 'lit' ? await Store.getLiterature() : type === 'proj' ? await Store.getProjects() : [];
    if (type === 'rec') {
      const recs = await Store.getRecommendations();
      for (const cat of ['literary','popular','lightnovel','manga','movie','drama','anime','music']) {
        for (const r of (recs[cat] || [])) {
          const comments = await Store.getComments('rec', r.id);
          comments.forEach(c => allComments.push({ ...c, type: 'rec', itemId: r.id }));
        }
      }
    } else {
      for (const item of items) {
        const comments = await Store.getComments(type, item.id);
        comments.forEach(c => allComments.push({ ...c, type, itemId: item.id }));
      }
    }
  }
  allComments.sort((a, b) => b.date.localeCompare(a.date));

  panel.innerHTML = `
    <div class="admin-form">
      <h3>用户管理 (${allUsers.length}人)</h3>
      <div class="admin-item-list" style="max-height:400px;overflow-y:auto;">
        ${allUsers.map(u => {
          const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
          const isMuted = u.muted_until && new Date(u.muted_until) > new Date();
          return `
          <div class="admin-item-row" style="${isBanned ? 'opacity:0.5;' : ''}">
            <div class="info">
              <div class="name">${escHtml(u.nickname||u.username)} <span style="font-size:0.72rem;color:var(--text-muted);">@${escHtml(u.username)}</span>
                ${u.role==='moderator'?'<span style="font-size:0.72rem;color:#e6a817;">[版主]</span>':''}
                ${u.role==='admin'?'<span style="font-size:0.72rem;color:var(--accent);">[管理员]</span>':''}
                ${isBanned?'<span style="font-size:0.72rem;color:var(--danger);">[已封禁]</span>':''}
                ${isMuted?'<span style="font-size:0.72rem;color:#e6a817;">[已禁言]</span>':''}
              </div>
            </div>
            <div class="actions">${u.role!=='moderator' ? `
              <button class="admin-btn outline sm" onclick="window.muteUserDialog('${escHtml(u.username)}')">${isMuted?'解禁':'禁言'}</button>
              <button class="admin-btn danger sm" onclick="window.banUserDialog('${escHtml(u.username)}')">${isBanned?'解封':'封禁'}</button>
            ` : '<span style="font-size:0.75rem;color:var(--text-muted);">受保护</span>'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="admin-form">
      <h3>评论管理 (${allComments.length}条)</h3>
      <div class="admin-item-list" style="max-height:400px;overflow-y:auto;">
        ${allComments.map(c => `
          <div class="admin-item-row">
            <div class="info">
              <div class="name">${escHtml(c.authorNickname||c.author)} ★${c.rating} <span style="font-size:0.72rem;color:var(--text-muted);">${c.type}</span></div>
              <div class="meta">${escHtml(c.content).slice(0,60)}... · ${c.date}</div>
            </div>
            <div class="actions">
              <button class="admin-btn danger sm" onclick="window.adminDeleteComment2('${c.type}','${c.itemId}','${c.id}')">删除</button>
            </div>
          </div>`).join('')}
        ${allComments.length===0?'<p style="color:var(--text-muted);font-size:0.85rem;">暂无评论</p>':''}
      </div>
    </div>`;
}

window.adminDeleteComment2 = async function(type, itemId, commentId) {
  if (!confirm('确认删除？')) return;
  await Store.deleteComment(type, itemId, commentId);
  await renderCommunityTab();
};

window.muteUserDialog = async function(username) {
  const users = await Store.getUsers();
  const u = users.find(u => u.username === username);
  if (!u) return;
  const isMuted = u.muted_until && new Date(u.muted_until) > new Date();
  if (isMuted) { await Store.unmuteUser(username); await renderCommunityTab(); return; }
  const duration = prompt('禁言时长（分钟），留空永久：', '');
  if (duration === null) return;
  const until = duration === '' ? '2999-12-31T23:59:59.999Z' : new Date(Date.now() + parseInt(duration) * 60000).toISOString();
  await Store.muteUser(username, until);
  await renderCommunityTab();
};

window.banUserDialog = async function(username) {
  const users = await Store.getUsers();
  const u = users.find(u => u.username === username);
  if (!u) return;
  const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
  if (isBanned) { await Store.unbanUser(username); await renderCommunityTab(); return; }
  const duration = prompt('封禁时长（分钟），留空永久：', '');
  if (duration === null) return;
  const until = duration === '' ? '2999-12-31T23:59:59.999Z' : new Date(Date.now() + parseInt(duration) * 60000).toISOString();
  await Store.banUser(username, until);
  await renderCommunityTab();
};

// ── Helpers ──────────────────────────────────────────
async function requireModerator() {
  const isMod = await Store.isModerator();
  if (!isMod) alert('只有版主可以修改内容。Supabase RLS 也会阻止非版主写入。');
  return isMod;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function showFormMsg(id, text, type) {
  const el = document.getElementById(id);
  if (el) { el.textContent = text; el.className = 'msg ' + type; }
}

function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.className = 'msg'; }
}

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const isAdmin = await Store.isAdminLoggedIn();
  if (isAdmin) openAdminPanel();
});

})();
