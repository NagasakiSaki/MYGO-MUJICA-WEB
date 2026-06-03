/**
 * MYGO-MUJICA 论坛 — 主逻辑
 */
const S = supabase; // shorthand

// ── 工具 ──────────────────────────────────────────────
function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }
function fmtDate(d) { return (d||'').slice(0,10); }
function $(id) { return document.getElementById(id); }
function show(id) { const e=$(id); if(e)e.style.display=''; }
function hide(id) { const e=$(id); if(e)e.style.display='none'; }

// ── 加载 marked ────────────────────────────────────────
let mdReady=false;
const mdP = new Promise(r=>{
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  s.onload=()=>{mdReady=true;r();};
  s.onerror=()=>{mdReady=false;r();};
  document.head.appendChild(s);
});
function md(s) {
  if(!s)return'';
  if(mdReady&&typeof marked!=='undefined')return marked.parse(s);
  return'<p>'+esc(s).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')+'</p>';
}

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════
async function currentUser() {
  try { const{data:{user}}=await S.auth.getUser();if(!user)return null;
    const{data:p}=await S.from('profiles').select('*').eq('id',user.id).single();
    return p||null; } catch(e) { return null; }
}
async function isMod() { const u=await currentUser(); return u&&u.role==='moderator'; }
async function isAdm() { const u=await currentUser(); return u&&(u.role==='admin'||u.role==='moderator'); }

// ── 渲染 header 右侧 ──────────────────────────────────
async function renderHeader() {
  const area=$('authArea'); if(!area)return;
  const u=await currentUser();
  const themeBtn=`<button class="ico-btn" onclick="toggleTheme()" title="主题">${(document.documentElement.getAttribute('data-theme')==='dark')?'☀️':'🌙'}</button>`;
  const searchBtn=`<button class="ico-btn" onclick="openSearch()" title="搜索">🔍</button>`;

  if(!u) { area.innerHTML=themeBtn+searchBtn+`<button class="auth-btn" onclick="showLogin()">登录</button>`; return; }

  const av=u.avatar?`<img src="${esc(u.avatar)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`:`<span style="width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">${esc((u.nickname||u.username)[0].toUpperCase())}</span>`;
  let modBtn='';
  if(u.role==='moderator') modBtn=`<button class="auth-btn" onclick="openAdmin()" style="border-color:#e6a817;color:#e6a817;">✎ 版主</button>`;
  else if(u.role==='admin') modBtn=`<button class="auth-btn" onclick="openAdmin()" style="border-color:var(--accent);">🛡️</button>`;

  // Notifications
  const{count:n}=await S.from('notifications').select('*',{count:'exact',head:true}).eq('user_id',u.id).eq('read',false);
  const bell=n>0?`<button class="ico-btn" onclick="showNotifs()" style="position:relative;">🔔<span style="position:absolute;top:-2px;right:-2px;background:var(--danger);color:#fff;font-size:0.55rem;width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${n>9?'9+':n}</span></button>`:`<button class="ico-btn" onclick="showNotifs()">🔔</button>`;

  area.innerHTML=themeBtn+searchBtn+bell+modBtn+`
    <div class="user-menu" id="userMenu">${av}<span>${esc(u.nickname||u.username)}</span>
      <div class="user-dropdown" id="userDropdown">
        <button onclick="editProfile()">编辑资料</button>
        <button onclick="doLogout()">退出登录</button>
      </div></div>`;
  $('userMenu').addEventListener('click',e=>{e.stopPropagation();$('userDropdown').classList.toggle('show');});
  document.addEventListener('click',()=>{const d=$('userDropdown');if(d)d.classList.remove('show');});
}

async function doLogout() { await S.auth.signOut(); location.reload(); }

// ── 登录/注册弹窗 ─────────────────────────────────────
function showLogin() {
  const box=$('modalBox'); if(!box)return;
  box.innerHTML=`
    <h2>登录</h2><div class="msg" id="modalMsg"></div>
    <div class="form-group"><label>邮箱</label><input type="email" id="loginEmail"></div>
    <div class="form-group"><label>密码</label><input type="password" id="loginPw"></div>
    <button class="btn primary" onclick="doLogin()">登录</button>
    <p style="text-align:center;margin-top:0.6rem;font-size:0.82rem;"><a onclick="showRegister()">没有账号？注册</a></p>
    <p style="text-align:center;margin-top:0.2rem;"><a onclick="showStaffLogin()" style="font-size:0.75rem;color:var(--text-muted);">版主/管理入口</a></p>`;
  $('modalOverlay').classList.add('show');
}
function showRegister() {
  const box=$('modalBox');
  box.innerHTML=`
    <h2>注册</h2><div class="msg" id="modalMsg"></div>
    <div class="form-group"><label>邮箱</label><input type="email" id="regEmail"></div>
    <div class="form-group"><label>用户名</label><input type="text" id="regUser"></div>
    <div class="form-group"><label>密码</label><input type="password" id="regPw"></div>
    <div class="form-group"><label>昵称（可选）</label><input type="text" id="regNick"></div>
    <button class="btn primary" onclick="doRegister()">注册</button>
    <p style="text-align:center;margin-top:0.6rem;font-size:0.82rem;"><a onclick="showLogin()">已有账号？登录</a></p>`;
}
function showStaffLogin() {
  const box=$('modalBox');
  box.innerHTML=`
    <h2>版主/管理员登录</h2><div class="msg" id="modalMsg"></div>
    <div class="form-group"><label>密钥</label><input type="password" id="staffKey" placeholder="输入密钥"></div>
    <button class="btn primary" onclick="verifyKey()">验证</button>
    <p style="text-align:center;margin-top:0.6rem;font-size:0.82rem;"><a onclick="showLogin()">返回</a></p>`;
}

async function doLogin() {
  const msg=$('modalMsg'), email=$('loginEmail').value.trim(), pw=$('loginPw').value;
  const{data,error}=await S.auth.signInWithPassword({email,password:pw});
  if(error) {
    msg.textContent=error.message.includes('not confirmed')?'邮箱未验证，请检查收件箱（含垃圾邮件）':error.message;
    msg.className='msg error'; return;
  }
  // Check ban
  const{data:profile}=await S.from('profiles').select('banned_until').eq('id',data.user.id).single();
  if(profile?.banned_until&&new Date(profile.banned_until)>new Date()) { await S.auth.signOut(); msg.textContent='账号已被封禁'; msg.className='msg error'; return; }
  msg.textContent='登录成功'; msg.className='msg success';
  setTimeout(()=>location.reload(),500);
}

async function doRegister() {
  const msg=$('modalMsg'),
    email=$('regEmail').value.trim(), user=$('regUser').value.trim(),
    pw=$('regPw').value, nick=$('regNick').value.trim();
  if(!email||!user||!pw) { msg.textContent='请填写所有必填项'; msg.className='msg error'; return; }
  if(pw.length<6) { msg.textContent='密码至少6位'; msg.className='msg error'; return; }

  const{data,error}=await S.auth.signUp({email,password:pw,options:{data:{username:user,nickname:nick}}});
  if(error) { msg.textContent=error.message; msg.className='msg error'; return; }

  if(data.user) {
    await S.from('profiles').upsert({id:data.user.id,username:user,nickname:nick||user,avatar:'',role:'user'},{onConflict:'id'});
  }

  if(data.user&&!data.user.email_confirmed_at) {
    msg.innerHTML='注册成功！已发送验证邮件到 <b>'+esc(email)+'</b>，请点击邮件中的链接完成验证。<br><br><a onclick="resendEmail(\''+esc(email)+'\')" style="color:var(--accent);cursor:pointer;">未收到？重发</a>';
    msg.className='msg success';
  } else {
    msg.textContent='注册成功！请登录。'; msg.className='msg success';
    setTimeout(()=>showLogin(),1000);
  }
}

window.resendEmail=async function(email) {
  await S.auth.resend({type:'signup',email});
  const msg=$('modalMsg');
  msg.textContent='验证邮件已重新发送。'; msg.className='msg success';
};

const STAFF_KEYS=['togawa','sakiko','200606'];
function verifyKey() {
  const k=$('staffKey').value.trim().toLowerCase(), msg=$('modalMsg');
  if(STAFF_KEYS.includes(k)) {
    msg.textContent='验证通过'; msg.className='msg success';
    setTimeout(()=>{
      const box=$('modalBox');
      box.innerHTML=`
        <h2>工作人员登录</h2><div class="msg" id="modalMsg"></div>
        <div class="form-group"><label>邮箱</label><input type="email" id="staffEmail"></div>
        <div class="form-group"><label>密码</label><input type="password" id="staffPw"></div>
        <button class="btn primary" onclick="doStaffLogin()">登录</button>
        <p style="text-align:center;margin-top:0.6rem;font-size:0.82rem;"><a onclick="showLogin()">返回</a></p>`;
    },500);
  } else { msg.textContent='密钥错误'; msg.className='msg error'; }
}

async function doStaffLogin() {
  const msg=$('modalMsg'), email=$('staffEmail').value.trim(), pw=$('staffPw').value;
  const result=await doLoginInternal(email,pw);
  if(!result.ok) { msg.textContent=result.msg; msg.className='msg error'; return; }
  if(result.role!=='admin'&&result.role!=='moderator') { await S.auth.signOut(); msg.textContent='你不是管理员或版主'; msg.className='msg error'; return; }
  msg.textContent='登录成功'; msg.className='msg success';
  setTimeout(()=>location.reload(),500);
}

async function doLoginInternal(email,pw) {
  const{data,error}=await S.auth.signInWithPassword({email,password:pw});
  if(error) return{ok:false,msg:error.message};
  const{data:profile}=await S.from('profiles').select('*').eq('id',data.user.id).single();
  if(profile?.banned_until&&new Date(profile.banned_until)>new Date()) { await S.auth.signOut(); return{ok:false,msg:'账号已被封禁'}; }
  return{ok:true,role:profile?.role||'user'};
}

function hideModal() { $('modalOverlay').classList.remove('show'); }
document.addEventListener('click',e=>{if(e.target.id==='modalOverlay')hideModal();});

// ── 通知 ──────────────────────────────────────────────
async function showNotifs() {
  const u=await currentUser(); if(!u)return;
  const{data}=await S.from('notifications').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(50);
  await S.from('notifications').update({read:true}).eq('user_id',u.id).eq('read',false);
  let overlay=$('notifOverlay'); if(!overlay) {
    overlay=document.createElement('div'); overlay.id='notifOverlay'; overlay.className='modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML=`<div class="modal-box" style="max-width:420px;"><h2>通知</h2><div style="max-height:60vh;overflow-y:auto;">${(data||[]).length?data.map(n=>`<div style="padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;">${esc(n.message)}<div style="font-size:0.72rem;color:var(--text-muted);">${fmtDate(n.created_at)}</div></div>`).join(''):'<p style="padding:1.5rem;text-align:center;color:var(--text-muted);">暂无通知</p>'}</div></div>`;
  overlay.classList.add('show');
  overlay.addEventListener('click',e=>{if(e.target===overlay){overlay.classList.remove('show');renderHeader();}});
  renderHeader();
}

// ── 个人资料 ──────────────────────────────────────────
async function editProfile() {
  const u=await currentUser(); if(!u)return;
  let overlay=$('profileOverlay');
  if(!overlay){overlay=document.createElement('div');overlay.id='profileOverlay';overlay.className='modal-overlay';document.body.appendChild(overlay);}
  overlay.innerHTML=`<div class="modal-box"><h2>编辑资料</h2><div class="msg" id="profileMsg"></div><div class="form-group"><label>昵称</label><input type="text" id="profNick" value="${esc(u.nickname||'')}"></div><div class="form-group"><label>头像URL</label><input type="text" id="profAv" value="${esc(u.avatar||'')}"></div><button class="btn primary" id="profSave">保存</button></div>`;
  overlay.classList.add('show');
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});
  $('profSave').addEventListener('click',async()=>{
    const{error}=await S.from('profiles').update({nickname:$('profNick').value.trim(),avatar:$('profAv').value.trim()}).eq('id',u.id);
    if(error){$('profileMsg').textContent=error.message;$('profileMsg').className='msg error';}
    else{$('profileMsg').textContent='已保存';$('profileMsg').className='msg success';setTimeout(()=>{overlay.classList.remove('show');renderHeader();},500);}
  });
}

// ── 搜索 ──────────────────────────────────────────────
async function openSearch() {
  $('searchOverlay').classList.add('show'); $('searchInput').value='';
  $('searchResults').innerHTML='<div style="color:var(--text-muted);text-align:center;padding:1rem;">输入关键词搜索...</div>';
  setTimeout(()=>$('searchInput').focus(),100);
}
function closeSearch() { $('searchOverlay').classList.remove('show'); }

let searchCache=[];
async function doSearch(q) {
  const area=$('searchResults'); if(!area)return;
  if(!q.trim()){area.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:1rem;">输入关键词搜索...</div>';return;}
  if(!searchCache.length) {
    const[{data:lit},{data:proj},{data:rec}]=await Promise.all([
      S.from('literature').select('id,title,excerpt'),
      S.from('projects').select('id,name,description'),
      S.from('recommendations').select('id,title,excerpt,category')
    ]);
    searchCache=[...(lit||[]).map(i=>({...i,type:'文学',url:'thread.html?t=lit&id='+i.id,text:i.title+' '+i.excerpt})),
      ...(proj||[]).map(i=>({...i,type:'项目',url:'thread.html?t=proj&id='+i.id,text:i.name+' '+i.description})),
      ...(rec||[]).map(i=>({...i,type:'推荐',url:'thread.html?t=rec&id='+i.id,text:i.title+' '+i.excerpt}))];
  }
  const kw=q.toLowerCase(); const r=searchCache.filter(i=>i.text.toLowerCase().includes(kw)).slice(0,15);
  area.innerHTML=r.length?r.map(i=>`<a href="${i.url}" class="search-result-item" onclick="closeSearch()"><div class="s-type">${esc(i.type)}</div><div class="s-title">${esc(i.title||i.name)}</div></a>`).join(''):'<div class="search-none">没有找到</div>';
}

// ═══════════════════════════════════════════════════════
//  首页 — 论坛主页
// ═══════════════════════════════════════════════════════
async function renderHome() {
  const info=await (async()=>{try{return JSON.parse(localStorage.getItem('mygo_site_info'));}catch(e){return null;}})();
  const title=info?.title||'MYGO-MUJICA 论坛';
  const sub=info?.subtitle||'一个小众社区';
  $('heroTitle').textContent=title; document.title=title;
  $('heroSub').textContent=sub;

  // 板块卡片
  const sections=[{id:'lit',name:'文学创作',desc:'随笔、诗歌、短篇',icon:'✍️'},
    {id:'proj',name:'代码项目',desc:'开源、工具、技术',icon:'💻'},
    {id:'rec',name:'推荐作品',desc:'书籍、动画、音乐',icon:'📌'}];
  $('sections').innerHTML=sections.map(s=>`<a href="threads.html?s=${s.id}" class="section-card"><div class="s-icon">${s.icon}</div><h2>${s.name}</h2><p>${s.desc}</p></a>`).join('');

  // 最近帖子
  const[{data:lit},{data:proj},{data:rec}]=await Promise.all([
    S.from('literature').select('id,title,date,category').order('date',{ascending:false}).limit(5),
    S.from('projects').select('id,name,created_at').order('created_at',{ascending:false}).limit(5),
    S.from('recommendations').select('id,title,created_at,category').order('created_at',{ascending:false}).limit(5)
  ]);
  const recent=[...(lit||[]).map(i=>({...i,section:'lit',label:i.title,date:i.date})),
    ...(proj||[]).map(i=>({...i,section:'proj',label:i.name,date:i.created_at?.slice(0,10)})),
    ...(rec||[]).map(i=>({...i,section:'rec',label:i.title,date:i.created_at?.slice(0,10)}))];
  recent.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const top8=recent.slice(0,8);

  const secNames={lit:'文学',proj:'项目',rec:'推荐'};
  $('recentList').innerHTML=top8.length?top8.map(r=>`
    <li class="recent-item"><span class="s-badge">${secNames[r.section]||''}</span>
    <a href="thread.html?t=${r.section}&id=${r.id}">${esc(r.label)}</a>
    <span class="r-date">${fmtDate(r.date)}</span></li>`).join(''):'<li style="color:var(--text-muted);">暂无帖子</li>';
}

// ═══════════════════════════════════════════════════════
//  帖子列表页
// ═══════════════════════════════════════════════════════
let threadPage=1, threadSection='lit', threadFilter='all';
const PP=10;

async function renderThreads() {
  const s=new URLSearchParams(location.search).get('s')||'lit';
  threadSection=s; threadPage=1; threadFilter='all';

  const secNames={lit:'文学创作',proj:'代码项目',rec:'推荐作品'};
  $('sectionTitle').textContent=secNames[s]||'帖子列表';

  if(s==='rec') await renderRecThreads();
  else await renderLitProjThreads(s);
}

async function renderLitProjThreads(s) {
  const table=s==='lit'?'literature':'projects';
  const titleCol=s==='lit'?'title':'name';
  const dateCol=s==='lit'?'date':'created_at';
  const{data:items}=await S.from(table).select('*').order(dateCol,{ascending:false});
  const list=items||[];

  // Filter chips for lit
  if(s==='lit') {
    const cats=[...new Set(list.map(i=>i.category||'未分类').filter(Boolean))];
    $('filterBar').innerHTML=`<button class="cat-chip ${threadFilter==='all'?'active':''}" onclick="setFilter('all')">全部</button>${cats.map(c=>`<button class="cat-chip ${threadFilter===c?'active':''}" onclick="setFilter('${esc(c)}')">${esc(c)}</button>`).join('')}`;
  } else { $('filterBar').innerHTML=''; }

  let filtered=threadFilter==='all'?list:list.filter(i=>(i.category||'未分类')===threadFilter);
  const paged=filtered.slice(0,threadPage*PP), total=filtered.length;

  $('threadList').innerHTML=paged.length?paged.map(i=>`
    <div class="thread-row">
      <div class="t-info"><a href="thread.html?t=${s}&id=${i.id}" class="t-title">${esc(i[titleCol])}</a>
      <div class="t-meta">${s==='lit'?esc(i.category||''):(i.tags||[]).join(' · ')} · ${fmtDate(i[dateCol])}</div></div>
    </div>`).join(''):'<p style="color:var(--text-muted);">暂无帖子</p>';

  $('loadMore').innerHTML=total>threadPage*PP?`<button class="load-more-btn" onclick="loadMore()">加载更多 (${total-threadPage*PP})</button>`:'';
}

async function renderRecThreads() {
  const{data:items}=await S.from('recommendations').select('*').order('created_at',{ascending:false});
  const list=items||[];
  const cats=[{k:'literary',icon:'📖',label:'严肃文学'},{k:'popular',icon:'📚',label:'流行文学'},{k:'lightnovel',icon:'📙',label:'轻小说'},{k:'manga',icon:'📘',label:'漫画'},{k:'movie',icon:'🎬',label:'电影'},{k:'drama',icon:'📺',label:'电视剧'},{k:'anime',icon:'🎞️',label:'动画'},{k:'music',icon:'🎵',label:'音乐'}];

  let html='';
  for(const c of cats) {
    const items=list.filter(i=>i.category===c.k);
    html+=`<div class="rec-group"><h3>${c.icon} ${c.label}</h3>`;
    html+=items.length?items.map(i=>`<div class="thread-row"><div class="t-info"><a href="thread.html?t=rec&id=${i.id}" class="t-title">${esc(i.title)}</a><div class="t-meta">${esc(i.creator||'')} · ${i.year||''}</div></div></div>`).join(''):'<p style="color:var(--text-muted);font-size:0.85rem;">暂无</p>';
    html+='</div>';
  }
  $('threadList').innerHTML=html;
  $('filterBar').innerHTML='';
  $('loadMore').innerHTML='';
}

window.setFilter=function(cat){threadFilter=cat;threadPage=1;renderThreads();};
window.loadMore=function(){threadPage++;renderThreads();};

// ═══════════════════════════════════════════════════════
//  帖子详情页
// ═══════════════════════════════════════════════════════
async function renderThread() {
  const p=new URLSearchParams(location.search);
  const t=p.get('t'), id=p.get('id');
  if(!t||!id) { $('threadContent').innerHTML='<p>无效链接</p>'; return; }

  let item, backUrl='threads.html?s='+t;
  if(t==='lit') { const{data}=await S.from('literature').select('*').eq('id',id).single(); item=data; }
  else if(t==='proj') { const{data}=await S.from('projects').select('*').eq('id',id).single(); item=data; }
  else if(t==='rec') { const{data}=await S.from('recommendations').select('*').eq('id',id).single(); item=data; }

  if(!item) { $('threadContent').innerHTML='<p>帖子不存在</p>'; return; }

  const title=t==='proj'?item.name:item.title;
  const byline=t==='proj'?(item.tags||[]).join(' · '):t==='rec'?(item.creator||'')+(item.year?' · '+item.year:''):item.date;
  const body=t==='proj'?md(item.detail||item.description||''):t==='rec'?md(item.review||item.excerpt||''):md(item.content||item.excerpt||'');
  if(t==='proj'&&item.link) body+=`<p><a href="${esc(item.link)}" target="_blank">🔗 项目链接 →</a></p>`;

  // Like
  const u=await currentUser();
  let liked=false, likeCount=0;
  if(u) {
    const{data:l}=await S.from('likes').select('id').eq('content_type',t).eq('content_id',id).eq('user_id',u.id);
    liked=!!l?.length;
  }
  const{count}=await S.from('likes').select('*',{count:'exact',head:true}).eq('content_type',t).eq('content_id',id);
  likeCount=count||0;

  // Comments
  const{data:comments}=await S.from('comments').select('*,profiles(username,nickname,avatar)').eq('content_type',t).eq('content_id',id).order('created_at',{ascending:true});
  const cmts=(comments||[]).map(c=>({id:c.id,parentId:c.parent_id,author:c.profiles?.username,authorNick:c.profiles?.nickname||c.profiles?.username,authorAv:c.profiles?.avatar,body:c.body,date:c.created_at?.slice(0,10),rating:Number(c.rating)||0}));

  const toplevel=cmts.filter(c=>!c.parentId);
  const avgRat=toplevel.reduce((s,c)=>s+c.rating,0)/(toplevel.filter(c=>c.rating>0).length||1);

  // TOC
  const toc=buildTOC(item.content||item.review||item.detail||'');

  $('threadContent').innerHTML=`
    <a href="${backUrl}" class="detail-back">← 返回列表</a>
    ${toc}
    <h1>${esc(title)}</h1>
    <p class="byline">${esc(byline||'')}
      ${avgRat>0?`<span class="rating-badge"> ★ ${Math.round(avgRat*10)/10} (${toplevel.length}评)</span>`:''}
      ${u?`<button class="like-btn ${liked?'liked':''}" id="likeBtn" onclick="doLike('${t}','${id}')">${liked?'❤️':'🤍'} <span id="likeCnt">${likeCount||''}</span></button>`:''}
    </p>
    ${t==='rec'&&item.cover?`<img src="${esc(item.cover)}" style="max-width:100%;max-height:360px;border-radius:var(--radius);margin-bottom:1rem;" onerror="this.style.display='none'">`:''}
    <div class="thread-body">${body}</div>`;

  // Highlight.js
  loadHljs();

  // Comments
  $('replyArea').innerHTML=u?`
    <div class="reply-form-top">
      <textarea id="replyText" placeholder="写下回复..."></textarea>
      <div class="reply-actions"><input type="number" id="replyRating" value="7" min="0" max="10" step="0.1" style="width:65px;">
      <button class="submit-btn" onclick="postReply('${t}','${id}')">回复</button></div>
      <div class="msg" id="replyMsg"></div></div>`:'<p style="text-align:center;color:var(--text-muted);padding:1rem;"><a onclick="showLogin()" style="color:var(--accent);cursor:pointer;">登录</a> 后回复</p>';
  renderReplies(t,id,cmts);
}

function buildTOC(md) {
  const hs=[], lines=(md||'').split('\n');
  lines.forEach(l=>{const m=l.match(/^(#{1,3})\s+(.+)/);if(m)hs.push({level:m[1].length,text:m[2].trim()});});
  if(hs.length<2)return'';
  return'<details class="toc-container"><summary>📑 目录</summary><ul class="toc-list">'+hs.map((h,i)=>`<li class="toc-h${h.level}"><a href="#toc-${i}">${esc(h.text)}</a></li>`).join('')+'</ul></details>';
}

function loadHljs() {
  if(document.querySelector('link[href*="highlight"]'))return;
  ['github.min.css','github-dark.min.css'].forEach(f=>{const l=document.createElement('link');l.rel='stylesheet';l.href=`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/${f}`;if(f.includes('dark'))l.media='(prefers-color-scheme:dark)';document.head.appendChild(l);});
  const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js';
  s.onload=()=>{if(typeof hljs!=='undefined')document.querySelectorAll('.thread-body pre code').forEach(b=>hljs.highlightElement(b));document.querySelectorAll('.thread-body h1,.thread-body h2,.thread-body h3').forEach((h,i)=>{if(!h.id)h.id='toc-'+i;});};
  document.head.appendChild(s);
}

window.doLike=async function(t,id) {
  const u=await currentUser(); if(!u) { showLogin(); return; }
  const{data:existing}=await S.from('likes').select('id').eq('content_type',t).eq('content_id',id).eq('user_id',u.id);
  if(existing?.length) { await S.from('likes').delete().eq('id',existing[0].id); }
  else { await S.from('likes').insert({content_type:t,content_id:id,user_id:u.id}); }
  const{count}=await S.from('likes').select('*',{count:'exact',head:true}).eq('content_type',t).eq('content_id',id);
  const{data:l}=await S.from('likes').select('id').eq('content_type',t).eq('content_id',id).eq('user_id',u.id);
  const btn=$('likeBtn'); if(btn) { btn.className='like-btn '+(l?.length?'liked':''); btn.innerHTML=(l?.length?'❤️':'🤍')+' <span id="likeCnt">'+(count||'')+'</span>'; }
};

// ── 回复（评论）渲染 ──────────────────────────────────
function renderReplies(t,id,comments) {
  const area=$('replyList'); if(!area)return;
  const top=comments.filter(c=>!c.parentId);
  area.innerHTML=top.length?top.map(c=>renderReply(c,comments,t,id)).join(''):'<p style="color:var(--text-muted);text-align:center;padding:1rem;">暂无回复</p>';
}

function renderReply(c,all,t,id,depth=0) {
  const dn=esc(c.authorNick||c.author); const av=c.authorAv?`<img src="${esc(c.authorAv)}" class="c-avatar-img">`:`<span class="c-avatar">${esc(dn[0]?.toUpperCase())}</span>`;
  const children=all.filter(r=>r.parentId===c.id);
  let html=`<div class="comment-item" id="c-${c.id}"><div class="c-header"><div style="display:flex;align-items:center;gap:0.5rem;">${av}<span class="c-author">${dn}</span>${c.parentId?'<span style="font-size:0.7rem;color:var(--text-muted);">回复</span>':''}</div>${c.rating>0?`<span class="c-rating">★ ${c.rating}</span>`:''}</div><div class="c-content">${esc(c.body)}</div><div class="c-footer"><span>${c.date}</span><span>${depth<2?`<button class="comment-reply-btn" onclick="showReplyBox('${c.id}')">回复</button>`:''}<button class="c-delete" onclick="delReply('${t}','${id}','${c.id}')">删除</button></span></div><div id="rb-${c.id}"></div></div>`;
  if(children.length){html+='<div class="comment-replies">';children.forEach(r=>{html+=renderReply(r,all,t,id,depth+1);});html+='</div>';}
  return html;
}

window.showReplyBox=function(cid) {
  const area=$('rb-'+cid); if(!area)return;
  if(area.innerHTML){area.innerHTML='';return;}
  const p=new URLSearchParams(location.search);
  area.innerHTML=`<div class="reply-form"><textarea id="rt-${cid}" placeholder="回复..."></textarea><button onclick="postNestedReply('${p.get('t')}','${p.get('id')}','${cid}')">发送</button></div>`;
};

window.postNestedReply=async function(t,id,parentId) {
  const content=$('rt-'+parentId).value; if(!content.trim())return;
  const u=await currentUser(); if(!u)return;
  await S.from('comments').insert({content_type:t,content_id:id,parent_id:parentId,author_id:u.id,body:content.trim(),rating:0});
  location.reload();
};

window.postReply=async function(t,id) {
  const body=$('replyText').value; if(!body.trim())return;
  const rating=parseFloat($('replyRating').value)||0;
  const u=await currentUser(); if(!u)return;
  // Check mute
  const{data:profile}=await S.from('profiles').select('muted_until').eq('id',u.id).single();
  if(profile?.muted_until&&new Date(profile.muted_until)>new Date()){const msg=$('replyMsg');msg.textContent='你已被禁言';msg.className='msg error';return;}

  const{error}=await S.from('comments').insert({content_type:t,content_id:id,author_id:u.id,body:body.trim(),rating});
  if(error){const msg=$('replyMsg');msg.textContent=error.message;msg.className='msg error';return;}
  location.reload();
};

window.delReply=async function(t,id,cid) {
  if(!confirm('删除这条回复？'))return;
  await S.from('comments').delete().eq('id',cid);
  location.reload();
};

// ═══════════════════════════════════════════════════════
//  主题 / 搜索 UI
// ═══════════════════════════════════════════════════════
function initTheme() {
  const s=localStorage.getItem('mygo_theme');
  if(s==='dark')document.documentElement.setAttribute('data-theme','dark');
  else if(!s&&window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.setAttribute('data-theme','dark');
}
function toggleTheme() {
  const is=document.documentElement.getAttribute('data-theme')==='dark';
  is?document.documentElement.removeAttribute('data-theme'):document.documentElement.setAttribute('data-theme','dark');
  localStorage.setItem('mygo_theme',is?'light':'dark'); renderHeader();
}

// ═══════════════════════════════════════════════════════
//  管理面板（版主/管理员）
// ═══════════════════════════════════════════════════════
async function openAdmin() {
  const isMod=await isMod();
  let panel=$('adminPanel');
  if(!panel) {
    panel=document.createElement('div'); panel.id='adminPanel'; panel.className='admin-overlay';
    document.body.appendChild(panel);
  }
  panel.innerHTML=`
    <div class="admin-header-bar"><h2>管理后台</h2><div class="admin-actions"><button class="admin-btn outline" onclick="$('adminPanel').classList.remove('show');document.body.style.overflow='';">关闭</button></div></div>
    <div class="admin-body"><div id="adminContent"></div></div>`;
  panel.classList.add('show'); document.body.style.overflow='hidden';
  await renderAdminContent(isMod);
}

async function renderAdminContent(isMod) {
  const area=$('adminContent');
  if(isMod) {
    area.innerHTML=`
      <div class="admin-tabs"><button class="admin-tab-btn active" data-at="posts">发帖</button><button class="admin-tab-btn" data-at="users">用户</button><button class="admin-tab-btn" data-at="settings">设置</button></div>
      <div class="admin-tab-panel active" id="at-posts"></div><div class="admin-tab-panel" id="at-users"></div><div class="admin-tab-panel" id="at-settings"></div>`;
    await renderPostEditor(); await renderUserMgmt(); renderSettings();
    area.querySelectorAll('.admin-tab-btn').forEach(b=>b.addEventListener('click',()=>{
      area.querySelectorAll('.admin-tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
      area.querySelectorAll('.admin-tab-panel').forEach(x=>x.classList.remove('active'));$('at-'+b.dataset.at).classList.add('active');
    }));
  } else {
    area.innerHTML=`<h3>用户管理</h3><div id="at-users"></div>`;
    await renderUserMgmt();
  }
}

async function renderPostEditor() {
  const area=$('at-posts');
  area.innerHTML=`
    <div class="admin-form"><h3>新建帖子</h3>
      <div class="form-row"><label>板块</label><select id="peSection"><option value="lit">文学创作</option><option value="proj">代码项目</option><option value="rec">推荐作品</option></select></div>
      <div class="form-row"><label>标题</label><input type="text" id="peTitle"></div>
      <div class="form-row"><label>分类 / 标签</label><input type="text" id="peCat" placeholder="可选"></div>
      <div class="form-row" id="peRecCatRow" style="display:none;"><label>推荐分类</label><select id="peRecCat"><option value="anime">动画</option><option value="manga">漫画</option><option value="literary">严肃文学</option><option value="popular">流行文学</option><option value="lightnovel">轻小说</option><option value="movie">电影</option><option value="drama">电视剧</option><option value="music">音乐</option></select></div>
      <div class="form-row"><label>正文 (Markdown)</label><textarea id="peBody" class="tall"></textarea></div>
      <button class="admin-btn primary" onclick="submitPost()">发布</button>
      <div class="msg" id="peMsg"></div></div>
    <div class="admin-item-list" id="postList"></div>`;

  $('peSection').addEventListener('change',function(){
    $('peRecCatRow').style.display=this.value==='rec'?'':'none';
  });
  await refreshPostList();
}

async function refreshPostList() {
  const[{data:lit},{data:proj},{data:rec}]=await Promise.all([
    S.from('literature').select('id,title,date').order('date',{ascending:false}),
    S.from('projects').select('id,name,created_at').order('created_at',{ascending:false}),
    S.from('recommendations').select('id,title,created_at').order('created_at',{ascending:false})
  ]);
  const all=[...(lit||[]).map(i=>({...i,section:'lit',label:i.title,date:i.date})),
    ...(proj||[]).map(i=>({...i,section:'proj',label:i.name,date:i.created_at?.slice(0,10)})),
    ...(rec||[]).map(i=>({...i,section:'rec',label:i.title,date:i.created_at?.slice(0,10)}))];
  $('postList').innerHTML=all.length?all.map(i=>`<div class="admin-item-row"><div class="info"><div class="name">${esc(i.label)}</div><div class="meta">${i.section} · ${fmtDate(i.date)}</div></div><div class="actions"><button class="admin-btn danger sm" onclick="deletePost('${i.section}','${i.id}')">删除</button></div></div>`).join(''):'<p style="color:var(--text-muted);">暂无</p>';
}

window.submitPost=async function() {
  const section=$('peSection').value, title=$('peTitle').value.trim(), cat=$('peCat').value.trim(), body=$('peBody').value.trim();
  if(!title||!body){$('peMsg').textContent='标题和正文不能为空';$('peMsg').className='msg error';return;}
  const u=await currentUser();
  if(section==='lit') {
    await S.from('literature').insert({title,date:new Date().toISOString().slice(0,10),category:cat,tags:cat?cat.split(',').map(t=>t.trim()).filter(Boolean):[],content:body,excerpt:body.slice(0,100)});
  } else if(section==='proj') {
    await S.from('projects').insert({name:title,description:body.slice(0,100),detail:body,tags:cat?cat.split(',').map(t=>t.trim()).filter(Boolean):[]});
  } else {
    await S.from('recommendations').insert({title,category:$('peRecCat').value,creator:cat,review:body,excerpt:body.slice(0,100)});
  }
  $('peMsg').textContent='已发布';$('peMsg').className='msg success';
  $('peTitle').value='';$('peBody').value='';$('peCat').value='';
  setTimeout(refreshPostList,500);
};

window.deletePost=async function(section,id) {
  if(!confirm('确认删除？'))return;
  const table=section==='lit'?'literature':section==='proj'?'projects':'recommendations';
  await S.from(table).delete().eq('id',id);
  refreshPostList();
};

// ── 用户管理 ──────────────────────────────────────────
async function renderUserMgmt() {
  const area=$('at-users'); if(!area)return;
  const{data:users}=await S.from('profiles').select('*').order('created_at');
  const isModRole=await isMod();
  area.innerHTML=`
    <div class="admin-item-list">${(users||[]).map(u=>`<div class="admin-item-row"><div class="info"><div class="name">${esc(u.nickname||u.username)} <span style="font-size:0.7rem;color:var(--text-muted);">${esc(u.username)}</span> ${u.role==='moderator'?'<span style="color:#e6a817;">[版主]</span>':u.role==='admin'?'<span style="color:var(--accent);">[管理]</span>':''} ${u.muted_until&&new Date(u.muted_until)>new Date()?'<span style="color:#e6a817;">[禁言]</span>':''} ${u.banned_until&&new Date(u.banned_until)>new Date()?'<span style="color:var(--danger);">[封禁]</span>':''}</div></div><div class="actions">${u.role==='user'&&isModRole?`<button class="admin-btn primary sm" onclick="promoteUser('${esc(u.username)}')">提拔</button>`:''}${u.role==='admin'&&isModRole?`<button class="admin-btn danger sm" onclick="demoteUser('${esc(u.username)}')">贬黜</button>`:''}${u.role!=='moderator'?`<button class="admin-btn outline sm" onclick="muteUser('${esc(u.username)}')">禁言</button><button class="admin-btn danger sm" onclick="banUser('${esc(u.username)}')">封禁</button>`:''}</div></div>`).join('')}</div>`;
}

window.promoteUser=async function(uname) {
  if(!confirm('提拔 '+uname+' 为管理员？'))return;
  await S.from('profiles').update({role:'admin'}).eq('username',uname);
  await S.from('notifications').insert({user_id:(await S.from('profiles').select('id').eq('username',uname).single()).data.id,message:'你被提拔为管理员！'});
  renderUserMgmt();
};
window.demoteUser=async function(uname) {
  if(!confirm('贬黜 '+uname+'？'))return;
  await S.from('profiles').update({role:'user'}).eq('username',uname);
  await S.from('notifications').insert({user_id:(await S.from('profiles').select('id').eq('username',uname).single()).data.id,message:'你被取消了管理员身份。'});
  renderUserMgmt();
};
window.muteUser=async function(uname) {
  const{data:p}=await S.from('profiles').select('muted_until').eq('username',uname).single();
  const isMuted=p?.muted_until&&new Date(p.muted_until)>new Date();
  if(isMuted) { await S.from('profiles').update({muted_until:null}).eq('username',uname); }
  else { const d=prompt('禁言时长（分钟），留空永久：',''); if(d===null)return; const until=d?new Date(Date.now()+parseInt(d)*60000).toISOString():'2999-12-31T23:59:59Z'; await S.from('profiles').update({muted_until:until}).eq('username',uname); }
  renderUserMgmt();
};
window.banUser=async function(uname) {
  const{data:p}=await S.from('profiles').select('banned_until').eq('username',uname).single();
  const isBanned=p?.banned_until&&new Date(p.banned_until)>new Date();
  if(isBanned) { await S.from('profiles').update({banned_until:null}).eq('username',uname); }
  else { const d=prompt('封禁时长（分钟），留空永久：',''); if(d===null)return; const until=d?new Date(Date.now()+parseInt(d)*60000).toISOString():'2999-12-31T23:59:59Z'; await S.from('profiles').update({banned_until:until}).eq('username',uname); }
  renderUserMgmt();
};

// ── 设置 ──────────────────────────────────────────────
function renderSettings() {
  const info=(()=>{try{return JSON.parse(localStorage.getItem('mygo_site_info'));}catch(e){return{};}})();
  $('at-settings').innerHTML=`
    <div class="admin-form"><h3>站点设置</h3>
      <div class="form-row"><label>站点标题</label><input type="text" id="stTitle" value="${esc(info.title||'MYGO-MUJICA 论坛')}"></div>
      <div class="form-row"><label>副标题</label><input type="text" id="stSub" value="${esc(info.subtitle||'')}"></div>
      <button class="admin-btn primary" onclick="saveSettings()">保存</button>
      <div class="msg" id="stMsg"></div></div>`;
}
window.saveSettings=function() {
  localStorage.setItem('mygo_site_info',JSON.stringify({title:$('stTitle').value.trim(),subtitle:$('stSub').value.trim()}));
  $('stMsg').textContent='已保存';$('stMsg').className='msg success';
};

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await renderHeader();
  await mdP;

  const page=location.pathname.split('/').pop()||'index.html';
  if(page==='index.html'||page==='') renderHome();
  else if(page==='threads.html') renderThreads();
  else if(page==='thread.html') renderThread();
});
