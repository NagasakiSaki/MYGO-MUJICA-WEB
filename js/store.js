/**
 * MYGO-MUJICA-WEB data store
 * Layer 1: js/data.json (published, fetched from server)
 * Layer 2: localStorage (admin edits override layer 1)
 */
const Store = (() => {
  const KEY = 'mygo_admin_data';
  const USER_SESSION = 'mygo_session';

  // Published data (loaded async from data.json)
  let publishedData = null;
  let dataReady = false;
  const readyCallbacks = [];

  function onReady(cb) {
    if (dataReady) { cb(); return; }
    readyCallbacks.push(cb);
  }

  function setReady() {
    dataReady = true;
    readyCallbacks.forEach(cb => cb());
    readyCallbacks.length = 0;
  }

  // Load published data from data.json
  fetch('js/data.json')
    .then(r => r.json())
    .then(d => { publishedData = d; setReady(); })
    .catch(() => {
      // fallback: use built-in defaults (never happens in prod)
      publishedData = getBuiltinDefaults();
      setReady();
    });

  // ── Admin override (localStorage) ─────
  function getAdminOverrides() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveAdminOverrides(obj) {
    localStorage.setItem(KEY, JSON.stringify(obj));
  }

  // ── Data resolution ──────────────────
  // Returns: published data merged with admin overrides
  function getData() {
    const over = getAdminOverrides();
    if (!publishedData) return getBuiltinDefaults();
    // Deep merge: overrides win
    return {
      literature: over.literature || publishedData.literature,
      projects: over.projects || publishedData.projects,
      recommendations: over.recommendations ? {
        books: over.recommendations.books || publishedData.recommendations?.books || [],
        music: over.recommendations.music || publishedData.recommendations?.music || [],
        films: over.recommendations.films || publishedData.recommendations?.films || []
      } : (publishedData.recommendations || { books:[], music:[], films:[] }),
      comments: over.comments || publishedData.comments || {},
      users: over.users || publishedData.users || [],
      siteTitle: over.siteTitle || publishedData.siteTitle || 'MYGO-MUJICA-WEB',
      siteSubtitle: over.siteSubtitle || publishedData.siteSubtitle || '',
      adminPassword: over.adminPassword || ''
    };
  }

  function getBuiltinDefaults() {
    return {
      literature: [],
      projects: [],
      recommendations: { books:[], music:[], films:[] },
      comments: {},
      users: [],
      siteTitle: 'MYGO-MUJICA-WEB',
      siteSubtitle: ''
    };
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Password hash ─────────────────────
  function hashPw(pw) {
    let hash = 0;
    const salt = 'mygo_salt_2026';
    const str = pw + salt;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return hash.toString(36);
  }

  // ── Users ─────────────────────────────
  function getUsers() { return getData().users; }
  function setUsers(users) {
    const over = getAdminOverrides();
    over.users = users;
    saveAdminOverrides(over);
  }

  function register(username, password) {
    if (!username || !password) return { ok: false, msg: '用户名和密码不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 3) return { ok: false, msg: '密码至少3个字符' };
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, msg: '用户名已存在' };
    }
    users.push({ username, passwordHash: hashPw(password) });
    setUsers(users);
    return { ok: true };
  }

  function login(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { ok: false, msg: '用户不存在' };
    if (user.passwordHash !== hashPw(password)) return { ok: false, msg: '密码错误' };
    sessionStorage.setItem(USER_SESSION, user.username);
    return { ok: true, username: user.username };
  }

  function logout() { sessionStorage.removeItem(USER_SESSION); }
  function getCurrentUser() { return sessionStorage.getItem(USER_SESSION) || null; }
  function isLoggedIn() { return !!sessionStorage.getItem(USER_SESSION); }

  // ── Admin auth ────────────────────────
  function getAdminPassword() { return getData().adminPassword; }
  function setAdminPassword(pw) {
    const over = getAdminOverrides();
    over.adminPassword = pw;
    saveAdminOverrides(over);
  }
  function isAdminLoggedIn() { return sessionStorage.getItem('mygo_admin_auth') === '1'; }
  function adminLogin(pw) {
    const current = getAdminPassword();
    if (!pw || pw !== current) return false;
    sessionStorage.setItem('mygo_admin_auth', '1');
    return true;
  }
  function adminLogout() {
    sessionStorage.removeItem('mygo_admin_auth');
  }

  // ── Comments ──────────────────────────
  function commentKey(type, id) { return type + '-' + id; }

  function getComments(type, id) {
    return getData().comments[commentKey(type, id)] || [];
  }

  function addComment(type, id, content, rating) {
    const user = getCurrentUser();
    if (!user) return { ok: false, msg: '请先登录' };
    if (!content.trim()) return { ok: false, msg: '评论内容不能为空' };
    const r = parseFloat(rating);
    if (isNaN(r) || r < 0 || r > 10) return { ok: false, msg: '评分需在 0.0 — 10.0 之间' };

    const comment = {
      id: genId(),
      author: user,
      content: content.trim(),
      date: new Date().toISOString().slice(0, 10),
      rating: Math.round(r * 10) / 10
    };
    const key = commentKey(type, id);
    const over = getAdminOverrides();
    if (!over.comments) over.comments = {};
    if (!over.comments[key]) over.comments[key] = [];
    over.comments[key].push(comment);
    saveAdminOverrides(over);
    return { ok: true, comment };
  }

  function deleteComment(type, itemId, commentId) {
    const user = getCurrentUser();
    if (!user) return { ok: false, msg: '请先登录' };
    const key = commentKey(type, itemId);
    const over = getAdminOverrides();
    if (!over.comments || !over.comments[key]) return { ok: false, msg: '评论不存在' };
    const idx = over.comments[key].findIndex(c => c.id === commentId);
    if (idx === -1) return { ok: false, msg: '评论不存在' };
    if (over.comments[key][idx].author !== user) return { ok: false, msg: '只能删除自己的评论' };
    over.comments[key].splice(idx, 1);
    saveAdminOverrides(over);
    return { ok: true };
  }

  function avgRating(type, id) {
    const comments = getComments(type, id);
    if (!comments.length) return 0;
    const sum = comments.reduce((s, c) => s + (c.rating || 0), 0);
    return Math.round((sum / comments.length) * 10) / 10;
  }

  // ── Content getters ───────────────────
  function getLiterature() { return getData().literature; }
  function getProjects() { return getData().projects; }
  function getRecommendations() { return getData().recommendations; }
  function getSiteInfo() { const d = getData(); return { title: d.siteTitle, subtitle: d.siteSubtitle }; }

  function getLitById(id) { return getData().literature.find(i => i.id === id) || null; }
  function getProjById(id) { return getData().projects.find(i => i.id === id) || null; }
  function getRecById(id) {
    const all = getData().recommendations;
    for (const k of ['books', 'music', 'films']) {
      const found = all[k].find(i => i.id === id);
      if (found) return { cat: k, item: found };
    }
    return null;
  }

  // ── Content setters (admin only) ──────
  function setLiterature(items) {
    const over = getAdminOverrides();
    over.literature = items;
    saveAdminOverrides(over);
  }
  function setProjects(items) {
    const over = getAdminOverrides();
    over.projects = items;
    saveAdminOverrides(over);
  }
  function setRecommendations(recs) {
    const over = getAdminOverrides();
    over.recommendations = recs;
    saveAdminOverrides(over);
  }
  function setSiteInfo(info) {
    const over = getAdminOverrides();
    if (info.title !== undefined) over.siteTitle = info.title;
    if (info.subtitle !== undefined) over.siteSubtitle = info.subtitle;
    saveAdminOverrides(over);
  }

  // ── Publish: export full data for GitHub commit ──
  function getPublishData() {
    const d = getData();
    return {
      literature: d.literature,
      projects: d.projects,
      recommendations: d.recommendations,
      comments: d.comments,
      users: d.users,
      siteTitle: d.siteTitle,
      siteSubtitle: d.siteSubtitle
    };
  }

  return {
    genId, onReady,
    // Users & Auth
    register, login, logout, getCurrentUser, isLoggedIn,
    // Admin
    getAdminPassword, setAdminPassword, isAdminLoggedIn, adminLogin, adminLogout,
    // Comments
    getComments, addComment, deleteComment, avgRating,
    // Content
    getLiterature, getProjects, getRecommendations,
    getLitById, getProjById, getRecById,
    getSiteInfo, setSiteInfo,
    setLiterature, setProjects, setRecommendations,
    // Publish
    getPublishData
  };
})();
