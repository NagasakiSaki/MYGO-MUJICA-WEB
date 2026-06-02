/**
 * MYGO-MUJICA-WEB — Online Admin Panel
 * Injected into the live site for admin content management + GitHub publish
 */
(() => {

let editingLitId = null, editingProjId = null, editingRecId = null;

// ── Admin entry ──────────────────────────────────────
// (Footer link removed; all login through top-right button)

window.openAdminLogin = function() {
  if (Store.isAdminLoggedIn()) {
    openAdminPanel();
    return;
  }
  if (typeof showAuthModal === 'function') {
    showAuthModal('staff');
  }
};

// ── Refresh header to show/hide editor button ─────────
function refreshEditorUI() {
  if (typeof renderAuthArea === 'function') renderAuthArea();
  if (typeof hideAuthModal === 'function') hideAuthModal();
}

// ── Admin panel overlay ──────────────────────────────
function openAdminPanel() {
  let panel = document.getElementById('adminOverlay');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'adminOverlay';
    panel.className = 'admin-overlay';
    panel.innerHTML = `
      <div class="admin-header-bar">
        <h2>管理后台</h2>
        <div class="admin-actions">
          <button class="admin-btn primary" onclick="window.adminPublish()">发布到线上</button>
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
  const panel = document.getElementById('adminOverlay');
  if (panel) panel.classList.remove('show');
  document.body.style.overflow = '';
};

// ── Render admin panel ───────────────────────────────
function renderAdminPanel() {
  const body = document.getElementById('adminBody');
  if (!body) return;
  const isMod = Store.isModerator();

  if (isMod) {
    renderModeratorPanel(body);
  } else {
    renderAdminOnlyPanel(body);
  }
}

function renderModeratorPanel(body) {
  body.innerHTML = `
    <div class="admin-publish-bar" id="adminPublishBar"></div>
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
    <div class="admin-tab-panel" id="acommunity"></div>`;

  renderPublishBar();
  renderLitTab();
  renderProjTab();
  renderRecTab();
  renderSiteTab();
  renderCommunityTab();

  body.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      body.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(btn.dataset.atab).classList.add('active');
    });
  });
}

function renderAdminOnlyPanel(body) {
  body.innerHTML = `
    <div style="text-align:center;color:var(--accent);padding:0.5rem;font-weight:600;font-family:var(--font-ui);">
      🛡️ 管理员面板 — 社区管理
    </div>
    <div class="admin-tab-panel active" id="acommunity"></div>`;
  renderCommunityTab();
}

// ── Publish bar ──────────────────────────────────────
function renderPublishBar() {
  const bar = document.getElementById('adminPublishBar');
  if (!bar) return;
  const token = localStorage.getItem('mygo_gh_token') || '';
  bar.innerHTML = `
    <div style="font-weight:600;margin-bottom:0.3rem;">发布到线上</div>
    <div class="hint">将当前编辑的内容推送到 GitHub，更新公开网站。</div>
    <div class="row">
      <input type="password" id="ghToken" placeholder="GitHub Personal Access Token" value="${escHtml(token)}" style="flex:1;">
      <button class="admin-btn primary" onclick="window.adminPublish()">发布</button>
    </div>
    <div class="admin-token-hint">
      需要 GitHub Token（<code>repo</code> 权限）。
      <a href="https://github.com/settings/tokens/new?description=MYGO-WEB-publish&scopes=repo" target="_blank" style="color:var(--accent);">点此创建 →</a>
      只需设置一次。
    </div>
    <div class="msg" id="publishMsg"></div>`;
}

// ── GitHub publish ───────────────────────────────────
window.adminPublish = async function() {
  const token = document.getElementById('ghToken').value.trim();
  if (!token) { showPublishMsg('请填写 GitHub Token', 'error'); return; }

  // Save token
  localStorage.setItem('mygo_gh_token', token);

  const msg = document.getElementById('publishMsg');
  msg.textContent = '正在发布...'; msg.className = 'msg';

  const publishData = Store.getPublishData();
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(publishData, null, 2))));

  const apiUrl = 'https://api.github.com/repos/NagasakiSaki/MYGO-MUJICA-WEB/contents/js/data.json';

  try {
    // Get current file SHA
    const getResp = await fetch(apiUrl, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!getResp.ok) {
      if (getResp.status === 401) { showPublishMsg('Token 无效，请检查', 'error'); return; }
      if (getResp.status === 404) { showPublishMsg('仓库或文件不存在', 'error'); return; }
      showPublishMsg('获取文件信息失败: ' + getResp.status, 'error'); return;
    }
    const fileInfo = await getResp.json();
    const sha = fileInfo.sha;

    // Commit the updated file
    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: 'Update data.json from admin panel',
        content: content,
        sha: sha
      })
    });

    if (putResp.ok) {
      showPublishMsg('发布成功！约30秒后线上生效。', 'success');
      // Clear admin overrides since content is now published
      localStorage.removeItem('mygo_admin_data');
      // Refresh page after a delay to show published content
      setTimeout(() => location.reload(), 2000);
    } else {
      const err = await putResp.json();
      showPublishMsg('发布失败: ' + (err.message || putResp.status), 'error');
    }
  } catch (e) {
    showPublishMsg('网络错误: ' + e.message, 'error');
  }
};

function showPublishMsg(text, type) {
  const msg = document.getElementById('publishMsg');
  if (msg) { msg.textContent = text; msg.className = 'msg ' + type; }
}

// ═══════════════════════════════════════════════════════
//  LITERATURE TAB
// ═══════════════════════════════════════════════════════
function renderLitTab() {
  const panel = document.getElementById('alit');
  if (!panel) return;
  panel.innerHTML = `
    <div class="admin-form">
      <h3 id="litFormTitle">新建文章</h3>
      <input type="hidden" id="litId">
      <div class="form-row"><label>标题</label><input type="text" id="litTitle"></div>
      <div class="form-row"><label>日期</label><input type="date" id="litDate"></div>
      <div class="form-row"><label>分类</label><input type="text" id="litCategory" placeholder="如：随笔、技术、诗歌..."></div>
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
  renderLitList();
}

window.saveLit = function() {
  if (!requireModerator()) return;
  const id = editingLitId || Store.genId();
  const item = {
    id, title: document.getElementById('litTitle').value.trim(),
    date: document.getElementById('litDate').value,
    category: document.getElementById('litCategory').value.trim(),
    tags: document.getElementById('litTags').value.split(',').map(t=>t.trim()).filter(Boolean),
    excerpt: document.getElementById('litExcerpt').value.trim(),
    content: document.getElementById('litContent').value.trim()
  };
  if (!item.title || !item.date) { showFormMsg('litFormMsg', '请填写标题和日期', 'error'); return; }
  let items = Store.getLiterature();
  if (editingLitId) items = items.map(i => i.id === editingLitId ? item : i);
  else items.unshift(item);
  Store.setLiterature(items);
  window.cancelLit();
  renderLitList();
};

window.editLit = function(id) {
  const item = Store.getLiterature().find(i => i.id === id);
  if (!item) return;
  editingLitId = id;
  document.getElementById('litFormTitle').textContent = '编辑文章';
  document.getElementById('litId').value = id;
  document.getElementById('litTitle').value = item.title;
  document.getElementById('litDate').value = item.date;
  document.getElementById('litCategory').value = item.category || '';
  document.getElementById('litTags').value = (item.tags || []).join(', ');
  document.getElementById('litExcerpt').value = item.excerpt || '';
  document.getElementById('litContent').value = item.content || '';
  document.getElementById('alit').scrollIntoView({behavior:'smooth'});
};

window.deleteLit = function(id) {
  if (!requireModerator()) return;
  if (!confirm('确认删除？')) return;
  Store.setLiterature(Store.getLiterature().filter(i => i.id !== id));
  if (editingLitId === id) window.cancelLit();
  renderLitList();
};

window.cancelLit = function() {
  editingLitId = null;
  document.getElementById('litFormTitle').textContent = '新建文章';
  document.getElementById('litId').value = '';
  document.getElementById('litTitle').value = '';
  document.getElementById('litDate').value = '';
  document.getElementById('litCategory').value = '';
  document.getElementById('litTags').value = '';
  document.getElementById('litExcerpt').value = '';
  document.getElementById('litContent').value = '';
  clearMsg('litFormMsg');
};

function renderLitList() {
  const container = document.getElementById('litList');
  if (!container) return;
  const items = Store.getLiterature();
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
function renderProjTab() {
  const panel = document.getElementById('aproj');
  if (!panel) return;
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
  renderProjList();
}

window.saveProj = function() {
  if (!requireModerator()) return;
  const id = editingProjId || Store.genId();
  const item = {
    id, name: document.getElementById('projName').value.trim(),
    desc: document.getElementById('projDesc').value.trim(),
    detail: document.getElementById('projDetail').value.trim(),
    tags: document.getElementById('projTags').value.split(',').map(t=>t.trim()).filter(Boolean),
    link: document.getElementById('projLink').value.trim()
  };
  if (!item.name) { showFormMsg('projFormMsg','请填写项目名称','error'); return; }
  let items = Store.getProjects();
  if (editingProjId) items = items.map(i => i.id === editingProjId ? item : i);
  else items.unshift(item);
  Store.setProjects(items);
  window.cancelProj();
  renderProjList();
};

window.editProj = function(id) {
  const item = Store.getProjects().find(i => i.id === id);
  if (!item) return;
  editingProjId = id;
  document.getElementById('projFormTitle').textContent = '编辑项目';
  document.getElementById('projId').value = id;
  document.getElementById('projName').value = item.name;
  document.getElementById('projDesc').value = item.desc || '';
  document.getElementById('projDetail').value = item.detail || '';
  document.getElementById('projTags').value = (item.tags||[]).join(', ');
  document.getElementById('projLink').value = item.link || '';
  document.getElementById('aproj').scrollIntoView({behavior:'smooth'});
};

window.deleteProj = function(id) {
  if (!requireModerator()) return;
  if (!confirm('确认删除？')) return;
  Store.setProjects(Store.getProjects().filter(i => i.id !== id));
  if (editingProjId === id) window.cancelProj();
  renderProjList();
};

window.cancelProj = function() {
  editingProjId = null;
  document.getElementById('projFormTitle').textContent = '新建项目';
  document.getElementById('projId').value = '';
  document.getElementById('projName').value = '';
  document.getElementById('projDesc').value = '';
  document.getElementById('projDetail').value = '';
  document.getElementById('projTags').value = '';
  document.getElementById('projLink').value = '';
  clearMsg('projFormMsg');
};

function renderProjList() {
  const container = document.getElementById('projList');
  if (!container) return;
  const items = Store.getProjects();
  container.innerHTML = items.length ? items.map(i => `
    <div class="admin-item-row">
      <div class="info"><div class="name">${escHtml(i.name)}</div><div class="meta">${(i.tags||[]).join(', ')}</div></div>
      <div class="actions">
        <button class="admin-btn outline sm" onclick="window.editProj('${i.id}')">编辑</button>
        <button class="admin-btn danger sm" onclick="window.deleteProj('${i.id}')">删除</button>
      </div>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">暂无项目</p>';
}

// ═══════════════════════════════════════════════════════
//  RECOMMENDATIONS TAB
// ═══════════════════════════════════════════════════════
function renderRecTab() {
  const panel = document.getElementById('arec');
  if (!panel) return;
  panel.innerHTML = `
    <div class="admin-form">
      <h3 id="recFormTitle">新建推荐帖</h3>
      <input type="hidden" id="recId">
      <div class="form-row"><label>分类</label><select id="recCat"><option value="literary">严肃文学</option><option value="popular">流行文学</option><option value="lightnovel">轻小说</option><option value="manga">漫画</option><option value="movie">电影</option><option value="drama">电视剧</option><option value="anime">动画</option><option value="music">音乐</option></select></div>
      <div class="form-row"><label>标题</label><input type="text" id="recTitle"></div>
      <div class="form-row"><label>创作者</label><input type="text" id="recAuthor"></div>
      <div class="form-row"><label>年份</label><input type="text" id="recYear"></div>
      <div class="form-row"><label>封面图 URL</label><input type="text" id="recCover" placeholder="https://..."></div>
      <div class="form-row"><label>摘要 / 导语</label><textarea id="recExcerpt"></textarea></div>
      <div class="form-row"><label>正文 (Markdown)</label><textarea id="recReview" class="tall" placeholder="完整的推荐帖正文..."></textarea></div>
      <div class="btn-row">
        <button class="admin-btn primary" onclick="window.saveRec()">保存</button>
        <button class="admin-btn outline" onclick="window.cancelRec()">取消</button>
      </div>
      <div class="msg" id="recFormMsg"></div>
    </div>
    ${[
      {k:'literary',icon:'📖',label:'严肃文学'},
      {k:'popular',icon:'📚',label:'流行文学'},
      {k:'lightnovel',icon:'📙',label:'轻小说'},
      {k:'manga',icon:'📘',label:'漫画'},
      {k:'movie',icon:'🎬',label:'电影'},
      {k:'drama',icon:'📺',label:'电视剧'},
      {k:'anime',icon:'🎞️',label:'动画'},
      {k:'music',icon:'🎵',label:'音乐'}
    ].map(c => `
    <div style="margin-top:1rem;">
      <h4 style="font-size:0.9rem;color:var(--accent);margin-bottom:0.4rem;">${c.icon} ${c.label}</h4>
      <div class="admin-item-list" id="rec-${c.k}-list"></div>
    </div>`).join('')}
    `;
  renderRecLists();
}

window.saveRec = function() {
  if (!requireModerator()) return;
  const id = editingRecId || Store.genId();
  const cat = document.getElementById('recCat').value;
  const item = {
    id, cover: document.getElementById('recCover').value.trim(),
    excerpt: document.getElementById('recExcerpt').value.trim(),
    review: document.getElementById('recReview').value.trim(),
    year: document.getElementById('recYear').value.trim(),
    title: document.getElementById('recTitle').value.trim(),
    creator: document.getElementById('recAuthor').value.trim()
  };

  if (!item.title) { showFormMsg('recFormMsg','请填写标题','error'); return; }
  const ALL_CATS = ['literary','popular','lightnovel','manga','movie','drama','anime','music'];
  let all = Store.getRecommendations();
  if (editingRecId) {
    for (const k of ALL_CATS) all[k] = all[k].filter(i => i.id !== editingRecId);
    all[cat] = [item, ...(all[cat] || [])];
  } else {
    all[cat] = [item, ...(all[cat] || [])];
  }
  Store.setRecommendations(all);
  window.cancelRec();
  renderRecLists();
};

window.editRec = function(id) {
  let item = null, cat = '';
  const ALL_CATS = ['literary','popular','lightnovel','manga','movie','drama','anime','music'];
  const all = Store.getRecommendations();
  for (const k of ALL_CATS) {
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
  document.getElementById('arec').scrollIntoView({behavior:'smooth'});
};

window.deleteRec = function(id) {
  if (!requireModerator()) return;
  if (!confirm('确认删除？')) return;
  const ALL_CATS = ['literary','popular','lightnovel','manga','movie','drama','anime','music'];
  let all = Store.getRecommendations();
  for (const k of ALL_CATS) all[k] = (all[k] || []).filter(i => i.id !== id);
  Store.setRecommendations(all);
  if (editingRecId === id) window.cancelRec();
  renderRecLists();
};

window.cancelRec = function() {
  editingRecId = null;
  document.getElementById('recFormTitle').textContent = '新建推荐帖';
  document.getElementById('recId').value = '';
  document.getElementById('recTitle').value = '';
  document.getElementById('recAuthor').value = '';
  document.getElementById('recYear').value = '';
  document.getElementById('recCover').value = '';
  document.getElementById('recExcerpt').value = '';
  document.getElementById('recReview').value = '';
  clearMsg('recFormMsg');
};

function renderRecLists() {
  const all = Store.getRecommendations();
  const renderItems = (items) => (items||[]).length ? items.map(i => `
    <div class="admin-item-row">
      <div class="info"><div class="name">${escHtml(i.title)}</div><div class="meta">${escHtml(i.creator||'')} ${i.year||''}</div></div>
      <div class="actions">
        <button class="admin-btn outline sm" onclick="window.editRec('${i.id}')">编辑</button>
        <button class="admin-btn danger sm" onclick="window.deleteRec('${i.id}')">删除</button>
      </div>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">暂无</p>';
  const cats = ['literary','popular','lightnovel','manga','movie','drama','anime','music'];
  cats.forEach(cat => {
    const el = document.getElementById('rec-' + cat + '-list');
    if (el) el.innerHTML = renderItems(all[cat] || []);
  });
}

// ═══════════════════════════════════════════════════════
//  SITE SETTINGS TAB
// ═══════════════════════════════════════════════════════
function renderSiteTab() {
  const panel = document.getElementById('asite');
  if (!panel) return;
  const info = Store.getSiteInfo();
  panel.innerHTML = `
    <div class="admin-form">
      <h3>网站信息</h3>
      <div class="form-row"><label>网站标题</label><input type="text" id="siteTitle" value="${escHtml(info.title)}"></div>
      <div class="form-row"><label>首页副标题</label><input type="text" id="siteSubtitle" value="${escHtml(info.subtitle)}"></div>
      <div class="btn-row"><button class="admin-btn primary" onclick="window.saveSite()">保存</button></div>
      <div class="msg" id="siteFormMsg"></div>
    </div>
    <div class="admin-form">
      <h3>修改密码</h3>
      <div class="form-row"><label>当前密码</label><input type="password" id="oldPassword"></div>
      <div class="form-row"><label>新密码（至少3位）</label><input type="password" id="newPassword"></div>
      <div class="form-row"><label>确认新密码</label><input type="password" id="newPassword2"></div>
      <div class="btn-row"><button class="admin-btn primary" onclick="window.changeAdminPw()">修改密码</button></div>
      <div class="msg" id="pwFormMsg"></div>
    </div>
    <div class="admin-form" id="adminMgmtSection"></div>`;
  renderAdminMgmt();
}

function renderAdminMgmt() {
  const section = document.getElementById('adminMgmtSection');
  if (!section) return;
  const admins = Store.getAdmins();
  section.innerHTML = `
    <h3>管理员列表 (${admins.length}人)</h3>
    <div class="admin-item-list" style="margin-bottom:0.8rem;">
      ${admins.map(a => `
        <div class="admin-item-row">
          <div class="info">
            <div class="name">${escHtml(a.nickname || a.username)} <span style="color:var(--text-muted);font-weight:400;">@${escHtml(a.username)}</span></div>
          </div>
          <div class="actions">
            <button class="admin-btn danger sm" onclick="window.removeAdmin('${escHtml(a.username)}')">移除</button>
          </div>
        </div>
      `).join('')}
      ${admins.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85rem;">暂无管理员（异常状态）</p>' : ''}
    </div>
    <h4 style="font-size:0.9rem;margin-bottom:0.5rem;">添加管理员</h4>
    <div class="form-row"><label>用户名</label><input type="text" id="newAdminUsername"></div>
    <div class="form-row"><label>密码</label><input type="password" id="newAdminPassword"></div>
    <div class="form-row"><label>昵称</label><input type="text" id="newAdminNickname"></div>
    <div class="btn-row"><button class="admin-btn primary" onclick="window.addNewAdmin()">添加</button></div>
    <div class="msg" id="adminMgmtMsg"></div>`;
}

window.addNewAdmin = function() {
  const result = Store.registerAdmin(
    document.getElementById('newAdminUsername').value.trim(),
    document.getElementById('newAdminPassword').value,
    { nickname: document.getElementById('newAdminNickname').value.trim() }
  );
  if (result.ok) {
    showFormMsg('adminMgmtMsg', '管理员已添加 · 发布后生效', 'success');
    document.getElementById('newAdminUsername').value = '';
    document.getElementById('newAdminPassword').value = '';
    document.getElementById('newAdminNickname').value = '';
    renderAdminMgmt();
  } else {
    showFormMsg('adminMgmtMsg', result.msg, 'error');
  }
};

window.removeAdmin = function(username) {
  const currentAdmin = Store.getCurrentUserInfo();
  if (currentAdmin && currentAdmin.username === username) {
    alert('不能移除自己');
    return;
  }
  if (!confirm('确认移除管理员 ' + username + '？')) return;
  const users = Store.getUsers();
  const idx = users.findIndex(u => u.username === username && u.isAdmin);
  if (idx !== -1) {
    users[idx].isAdmin = false;
    Store.setUsers(users);
    renderAdminMgmt();
  }
};

window.saveSite = function() {
  Store.setSiteInfo({
    title: document.getElementById('siteTitle').value.trim(),
    subtitle: document.getElementById('siteSubtitle').value.trim()
  });
  showFormMsg('siteFormMsg', '已保存', 'success');
};

window.changeAdminPw = function() {
  const oldPw = document.getElementById('oldPassword').value;
  const newPw = document.getElementById('newPassword').value;
  const newPw2 = document.getElementById('newPassword2').value;
  if (!newPw || newPw.length < 3) { showFormMsg('pwFormMsg','新密码至少3个字符','error'); return; }
  if (newPw !== newPw2) { showFormMsg('pwFormMsg','两次密码不一致','error'); return; }

  const info = Store.getCurrentUserInfo();
  if (!info) { showFormMsg('pwFormMsg','未登录','error'); return; }

  // Verify old password by attempting login
  const check = Store.adminLoginUser(info.username, oldPw);
  if (!check.ok) { showFormMsg('pwFormMsg','当前密码错误','error'); return; }

  // Update password
  const users = Store.getUsers();
  const user = users.find(u => u.username === info.username);
  if (user) {
    user.passwordHash = (() => {
      let hash = 0; const salt = 'mygo_salt_2026'; const str = newPw + salt;
      for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
      return hash.toString(36);
    })();
    Store.setUsers(users);
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPassword2').value = '';
    showFormMsg('pwFormMsg', '密码已修改 · 发布后生效', 'success');
  } else {
    showFormMsg('pwFormMsg','用户不存在','error');
  }
};

// ── Helpers ──────────────────────────────────────────
// ── Community Management (Admin & Moderator) ──────────
function renderCommunityTab() {
  const panel = document.getElementById('acommunity');
  if (!panel) return;

  const allUsers = Store.getUsers();
  const allComments = collectAllComments();

  panel.innerHTML = `
    <div class="admin-form">
      <h3>用户管理 (${allUsers.length}人)</h3>
      <div class="admin-item-list" style="max-height:400px;overflow-y:auto;">
        ${allUsers.map(u => {
          const isBanned = u.bannedUntil && new Date(u.bannedUntil) > new Date();
          const isMuted = u.mutedUntil && new Date(u.mutedUntil) > new Date();
          return `
          <div class="admin-item-row" style="${isBanned ? 'opacity:0.5;' : ''}">
            <div class="info">
              <div class="name">
                ${escHtml(u.nickname || u.username)}
                <span style="font-size:0.72rem;color:var(--text-muted);">@${escHtml(u.username)}</span>
                ${u.role === 'moderator' ? '<span style="font-size:0.72rem;color:#e6a817;">[版主]</span>' : ''}
                ${u.role === 'admin' ? '<span style="font-size:0.72rem;color:var(--accent);">[管理员]</span>' : ''}
                ${isBanned ? '<span style="font-size:0.72rem;color:var(--danger);">[已封禁]</span>' : ''}
                ${isMuted ? '<span style="font-size:0.72rem;color:#e6a817;">[已禁言]</span>' : ''}
              </div>
            </div>
            <div class="actions">
              ${u.role === 'moderator' ? '<span style="font-size:0.75rem;color:var(--text-muted);">受保护</span>' : ''}
              ${u.role === 'admin' ? `
                ${Store.isModerator() ? `<button class="admin-btn danger sm" onclick="window.demoteAdminDialog('${escHtml(u.username)}')">贬黜</button>` : ''}
                <button class="admin-btn outline sm" onclick="window.muteUserDialog('${escHtml(u.username)}')">${isMuted ? '解除禁言' : '禁言'}</button>
                <button class="admin-btn danger sm" onclick="window.banUserDialog('${escHtml(u.username)}')">${isBanned ? '解封' : '封禁'}</button>
              ` : ''}
              ${u.role === 'user' ? `
                ${Store.isModerator() ? `<button class="admin-btn primary sm" onclick="window.promoteAdminDialog('${escHtml(u.username)}')">提拔</button>` : ''}
                <button class="admin-btn outline sm" onclick="window.muteUserDialog('${escHtml(u.username)}')">${isMuted ? '解除禁言' : '禁言'}</button>
                <button class="admin-btn danger sm" onclick="window.banUserDialog('${escHtml(u.username)}')">${isBanned ? '解封' : '封禁'}</button>
              ` : ''}
            </div>
          </div>`;
        }).join('')}
        ${allUsers.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85rem;">暂无用户</p>' : ''}
      </div>
    </div>
    <div class="admin-form">
      <h3>评论管理 (${allComments.length}条)</h3>
      <div class="admin-item-list" style="max-height:400px;overflow-y:auto;">
        ${allComments.map(c => `
          <div class="admin-item-row">
            <div class="info">
              <div class="name">${escHtml(c.authorNickname || c.author)} ★${c.rating}</div>
              <div class="meta">${escHtml(c.content).slice(0,60)}... · ${c.date} · ${c.type}</div>
            </div>
            <div class="actions">
              <button class="admin-btn danger sm" onclick="window.adminDeleteComment('${c.type}','${c.itemId}','${c.id}')">删除</button>
            </div>
          </div>
        `).join('')}
        ${allComments.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85rem;">暂无评论</p>' : ''}
      </div>
    </div>`;
}

function collectAllComments() {
  const all = [];
  const comments = Store.getPublishData().comments || {};
  // Also check localStorage overrides
  const over = (() => { try { return JSON.parse(localStorage.getItem('mygo_admin_data')||'{}'); } catch(e) { return {}; } })();
  const merged = { ...comments, ...(over.comments||{}) };
  Object.keys(merged).forEach(key => {
    const [type, ...idParts] = key.split('-');
    const itemId = idParts.join('-');
    (merged[key] || []).forEach(c => {
      all.push({ ...c, type, itemId });
    });
  });
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all;
}

window.adminDeleteComment = function(type, itemId, commentId) {
  if (!confirm('确认删除这条评论？')) return;
  Store.deleteComment(type, itemId, commentId);
  renderCommunityTab();
};

window.muteUserDialog = function(username) {
  const users = Store.getUsers();
  const u = users.find(u => u.username === username);
  if (!u) return;
  const isMuted = u.mutedUntil && new Date(u.mutedUntil) > new Date();
  if (isMuted) {
    if (!confirm('解除对 ' + username + ' 的禁言？')) return;
    Store.unmuteUser(username);
    renderCommunityTab();
    return;
  }
  const duration = prompt('禁言时长（分钟），留空为永久禁言，输入数字如 60 表示60分钟：', '');
  if (duration === null) return; // cancelled
  const until = duration === '' ? '2999-12-31T23:59:59.999Z' : new Date(Date.now() + parseInt(duration) * 60000).toISOString();
  Store.muteUser(username, until);
  renderCommunityTab();
};

window.promoteAdminDialog = function(username) {
  if (!confirm('确认将 @' + username + ' 提拔为管理员？\n\n提拔后该用户将拥有禁言、封禁、删评等社区管理权限。')) return;
  const result = Store.promoteToAdmin(username);
  if (result.ok) {
    renderCommunityTab();
  } else {
    alert(result.msg);
  }
};

window.demoteAdminDialog = function(username) {
  if (!confirm('确认贬黜管理员 @' + username + '？\n\n该用户将失去所有管理权限，变回普通用户。')) return;
  const result = Store.demoteFromAdmin(username);
  if (result.ok) {
    renderCommunityTab();
  } else {
    alert(result.msg);
  }
};

window.banUserDialog = function(username) {
  const users = Store.getUsers();
  const u = users.find(u => u.username === username);
  if (!u) return;
  const isBanned = u.bannedUntil && new Date(u.bannedUntil) > new Date();
  if (isBanned) {
    if (!confirm('解封 ' + username + '？')) return;
    Store.unbanUser(username);
    renderCommunityTab();
    return;
  }
  const duration = prompt('封禁时长（分钟），留空为永久封禁，输入数字如 1440 表示一天：', '');
  if (duration === null) return;
  const until = duration === '' ? '2999-12-31T23:59:59.999Z' : new Date(Date.now() + parseInt(duration) * 60000).toISOString();
  Store.banUser(username, until);
  renderCommunityTab();
};

// ── Helpers ──────────────────────────────────────────
function requireModerator() {
  if (!Store.isModerator()) {
    alert('只有版主可以修改作品内容；管理员只能管理用户和评论');
    return false;
  }
  return true;
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
document.addEventListener('DOMContentLoaded', () => {
  Store.onReady(() => {
    // No footer link; all login through top-right auth button
  });
});

})();
