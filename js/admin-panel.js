/**
 * MYGO-MUJICA-WEB — Online Admin Panel
 * Injected into the live site for admin content management + GitHub publish
 */
(() => {

let editingLitId = null, editingProjId = null, editingRecId = null;

// ── Admin entry ──────────────────────────────────────
function initAdminEntry() {
  document.querySelectorAll('.site-footer').forEach(footer => {
    if (!footer.querySelector('.admin-entry')) {
      const span = document.createElement('span');
      span.className = 'admin-entry';
      span.innerHTML = ' &middot; <a href="#" onclick="event.preventDefault();window.openAdminLogin()" style="color:var(--text-muted);font-size:0.78rem;">管理</a>';
      footer.appendChild(span);
    }
  });
}

// Expose to window
window.openAdminLogin = function() {
  if (Store.isAdminLoggedIn()) {
    openAdminPanel();
    return;
  }
  showSecretKeyGate();
};

// ── Step 1: Secret Key Gate ───────────────────────────
const SECRET_KEYS = ['togawa', 'sakiko', '200606'];

function showSecretKeyGate() {
  let overlay = document.getElementById('adminLoginModal');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'adminLoginModal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="position:relative;">
      <h2>管理员验证</h2>
      <div class="msg" id="adminKeyMsg"></div>
      <div class="form-group"><label>请输入管理员密钥</label><input type="password" id="adminKeyInput" placeholder="输入密钥"></div>
      <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" id="adminKeyBtn">验证</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('show');
  });

  document.getElementById('adminKeyBtn').addEventListener('click', verifySecretKey);
  document.getElementById('adminKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') verifySecretKey();
  });

  overlay.classList.add('show');
  setTimeout(() => document.getElementById('adminKeyInput').focus(), 150);
}

function verifySecretKey() {
  const input = document.getElementById('adminKeyInput').value.trim().toLowerCase();
  const msg = document.getElementById('adminKeyMsg');
  if (SECRET_KEYS.includes(input)) {
    msg.textContent = '验证通过'; msg.className = 'msg success';
    setTimeout(() => {
      document.getElementById('adminLoginModal').remove();
      showAdminLoginModal();
    }, 500);
  } else {
    msg.textContent = '密钥错误'; msg.className = 'msg error';
  }
}

// ── Step 2: Admin Password Login ──────────────────────
function showAdminLoginModal() {
  const hasPw = Store.getAdminPassword();

  let overlay = document.getElementById('adminLoginModal');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'adminLoginModal';
  overlay.className = 'modal-overlay';

  if (!hasPw) {
    // First time: setup password
    overlay.innerHTML = `
      <div class="modal-box" style="position:relative;">
        <h2>设置管理密码</h2>
        <div class="msg" id="adminSetupMsg"></div>
        <div class="form-group"><label>密码（至少4位）</label><input type="password" id="adminSetupPw"></div>
        <div class="form-group"><label>确认密码</label><input type="password" id="adminSetupPw2"></div>
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" id="adminSetupBtn">设置并登录</button>
        <p style="text-align:center;margin-top:0.6rem;font-size:0.8rem;"><a href="#" id="adminBackToKey" style="color:var(--accent);">返回上一步</a></p>
      </div>`;
  } else {
    // Normal login
    overlay.innerHTML = `
      <div class="modal-box" style="position:relative;">
        <h2>管理员登录</h2>
        <div class="msg" id="adminLoginMsg"></div>
        <div class="form-group"><label>管理密码</label><input type="password" id="adminLoginPw" placeholder="输入管理密码"></div>
        <button class="btn btn-primary" style="background:var(--accent);color:#fff;border:none;padding:0.55rem;border-radius:var(--radius-sm);cursor:pointer;width:100%;font-size:0.95rem;" id="adminLoginBtn">进入管理</button>
        <p style="text-align:center;margin-top:0.6rem;font-size:0.8rem;color:var(--text-muted);">
          <a href="#" id="adminForgotPwLink" style="color:var(--danger);">忘记密码？</a>
          &nbsp;&nbsp;
          <a href="#" id="adminBackToKey2" style="color:var(--text-muted);">返回上一步</a>
        </p>
      </div>`;
  }

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('show');
  });

  if (!hasPw) {
    document.getElementById('adminSetupBtn').addEventListener('click', doAdminSetup);
    document.getElementById('adminBackToKey').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('adminLoginModal').remove();
      showSecretKeyGate();
    });
  } else {
    document.getElementById('adminLoginBtn').addEventListener('click', doAdminLogin);
    document.getElementById('adminLoginPw').addEventListener('keydown', e => { if (e.key==='Enter') doAdminLogin(); });
    document.getElementById('adminForgotPwLink').addEventListener('click', e => {
      e.preventDefault();
      showAdminForgotPw();
    });
    document.getElementById('adminBackToKey2').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('adminLoginModal').remove();
      showSecretKeyGate();
    });
  }

  overlay.classList.add('show');
  setTimeout(() => {
    const inp = document.getElementById(!hasPw ? 'adminSetupPw' : 'adminLoginPw');
    if (inp) inp.focus();
  }, 150);
}

function showAdminForgotPw() {
  if (!confirm('确认要重置管理密码吗？\n\n文章、项目、推荐等数据不会被删除。')) return;
  Store.setAdminPassword('');
  document.getElementById('adminLoginModal').remove();
  showAdminLoginModal();
}

function doAdminSetup() {
  const pw = document.getElementById('adminSetupPw').value;
  const pw2 = document.getElementById('adminSetupPw2').value;
  const msg = document.getElementById('adminSetupMsg');
  if (!pw || pw.length < 4) { msg.textContent='密码至少需要4个字符'; msg.className='msg error'; return; }
  if (pw !== pw2) { msg.textContent='两次输入的密码不一致'; msg.className='msg error'; return; }
  Store.setAdminPassword(pw);
  Store.adminLogin(pw);
  msg.textContent = '设置成功'; msg.className = 'msg success';
  setTimeout(() => {
    document.getElementById('adminLoginModal').classList.remove('show');
    openAdminPanel();
    refreshEditorUI();
  }, 400);
}

function doAdminLogin() {
  const pw = document.getElementById('adminLoginPw').value;
  const msg = document.getElementById('adminLoginMsg');
  if (Store.adminLogin(pw)) {
    msg.textContent = '登录成功'; msg.className = 'msg success';
    setTimeout(() => {
      document.getElementById('adminLoginModal').classList.remove('show');
      openAdminPanel();
      refreshEditorUI();
    }, 400);
  } else {
    msg.textContent = '密码错误'; msg.className = 'msg error';
  }
}

// ── Refresh header to show/hide editor button ─────────
function refreshEditorUI() {
  // Re-render the auth area in the header
  if (typeof renderAuthArea === 'function') renderAuthArea();
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
  body.innerHTML = `
    <div class="admin-publish-bar" id="adminPublishBar"></div>
    <div class="admin-tabs">
      <button class="admin-tab-btn active" data-atab="alit">文学创作</button>
      <button class="admin-tab-btn" data-atab="aproj">代码项目</button>
      <button class="admin-tab-btn" data-atab="arec">推荐帖</button>
      <button class="admin-tab-btn" data-atab="asite">网站设置</button>
    </div>
    <div class="admin-tab-panel active" id="alit"></div>
    <div class="admin-tab-panel" id="aproj"></div>
    <div class="admin-tab-panel" id="arec"></div>
    <div class="admin-tab-panel" id="asite"></div>`;

  renderPublishBar();
  renderLitTab();
  renderProjTab();
  renderRecTab();
  renderSiteTab();

  // Tab switching
  body.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      body.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(btn.dataset.atab).classList.add('active');
    });
  });
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
  const id = editingLitId || Store.genId();
  const item = {
    id, title: document.getElementById('litTitle').value.trim(),
    date: document.getElementById('litDate').value,
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
  document.getElementById('litExcerpt').value = item.excerpt || '';
  document.getElementById('litContent').value = item.content || '';
  document.getElementById('alit').scrollIntoView({behavior:'smooth'});
};

window.deleteLit = function(id) {
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
      <h3>修改管理密码</h3>
      <div class="form-row"><label>当前密码</label><input type="password" id="oldPassword"></div>
      <div class="form-row"><label>新密码（至少4位）</label><input type="password" id="newPassword"></div>
      <div class="form-row"><label>确认新密码</label><input type="password" id="newPassword2"></div>
      <div class="btn-row"><button class="admin-btn primary" onclick="window.changeAdminPw()">修改密码</button></div>
      <div class="msg" id="pwFormMsg"></div>
    </div>`;
}

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
  if (oldPw !== Store.getAdminPassword()) { showFormMsg('pwFormMsg','当前密码错误','error'); return; }
  if (!newPw || newPw.length < 4) { showFormMsg('pwFormMsg','新密码至少4个字符','error'); return; }
  if (newPw !== newPw2) { showFormMsg('pwFormMsg','两次密码不一致','error'); return; }
  Store.setAdminPassword(newPw);
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newPassword2').value = '';
  showFormMsg('pwFormMsg', '密码已修改', 'success');
};

// ── Helpers ──────────────────────────────────────────
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

// ── Init: inject admin entry when DOM ready ──────────
document.addEventListener('DOMContentLoaded', () => {
  // Wait for store to be ready
  Store.onReady(() => {
    initAdminEntry();
  });
});

})();
