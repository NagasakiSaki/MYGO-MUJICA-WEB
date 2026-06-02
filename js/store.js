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
      recommendations: over.recommendations ? mergeRecs(over.recommendations, publishedData.recommendations) : (publishedData.recommendations || getEmptyRecs()),

function mergeRecs(over, pub) {
  const cats = ['literary','popular','lightnovel','manga','movie','drama','anime','music'];
  const result = {};
  cats.forEach(c => { result[c] = over[c] || (pub && pub[c]) || []; });
  return result;
}
function getEmptyRecs() {
  const cats = ['literary','popular','lightnovel','manga','movie','drama','anime','music'];
  const result = {};
  cats.forEach(c => { result[c] = []; });
  return result;
}
      comments: over.comments || publishedData.comments || {},
      users: over.users || publishedData.users || [],
      notifications: over.notifications || publishedData.notifications || {},
      likes: over.likes || publishedData.likes || {},
      siteTitle: over.siteTitle || publishedData.siteTitle || 'MYGO-MUJICA-WEB',
      siteSubtitle: over.siteSubtitle || publishedData.siteSubtitle || '',
      adminPassword: over.adminPassword || ''
    };
  }

  function getBuiltinDefaults() {
    return {
      literature: [],
      projects: [],
      recommendations: getEmptyRecs(),
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

  // ── Users & Roles ──────────────────────
  // role: 'user' | 'admin' | 'moderator'
  function getUsers() { return getData().users; }
  function setUsers(users) {
    const over = getAdminOverrides();
    over.users = users;
    saveAdminOverrides(over);
  }

  function register(username, password, opts = {}) {
    if (!username || !password) return { ok: false, msg: '用户名和密码不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 3) return { ok: false, msg: '密码至少3个字符' };
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, msg: '用户名已存在' };
    }
    const user = {
      username,
      passwordHash: hashPw(password),
      nickname: (opts.nickname || username).trim(),
      avatar: (opts.avatar || '').trim(),
      role: opts.role || 'user',
      bannedUntil: null,
      mutedUntil: null
    };
    users.push(user);
    setUsers(users);
    return { ok: true };
  }

  function login(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { ok: false, msg: '用户不存在' };
    if (user.passwordHash !== hashPw(password)) return { ok: false, msg: '密码错误' };
    // Check ban
    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      return { ok: false, msg: '账号已被封禁至 ' + new Date(user.bannedUntil).toLocaleDateString() };
    }
    const session = {
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: user.avatar || '',
      role: user.role || 'user'
    };
    sessionStorage.setItem(USER_SESSION, JSON.stringify(session));
    return { ok: true, username: session.username, nickname: session.nickname, avatar: session.avatar, role: session.role };
  }

  function logout() { sessionStorage.removeItem(USER_SESSION); }

  function getCurrentUser() {
    const raw = sessionStorage.getItem(USER_SESSION);
    return raw ? JSON.parse(raw).username : null;
  }

  function getCurrentUserInfo() {
    const raw = sessionStorage.getItem(USER_SESSION);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  }

  function isLoggedIn() { return !!sessionStorage.getItem(USER_SESSION); }

  // Role checks
  function isModerator() {
    const info = getCurrentUserInfo();
    return info ? info.role === 'moderator' : false;
  }
  function isAdmin() {
    const info = getCurrentUserInfo();
    return info ? (info.role === 'admin' || info.role === 'moderator') : false;
  }
  function isAdminLoggedIn() { return isAdmin(); }

  function updateProfile(username, data) {
    const users = getUsers();
    const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (idx === -1) return { ok: false, msg: '用户不存在' };
    if (data.nickname !== undefined) users[idx].nickname = data.nickname.trim();
    if (data.avatar !== undefined) users[idx].avatar = data.avatar.trim();
    setUsers(users);
    const raw = sessionStorage.getItem(USER_SESSION);
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess.username === username) {
        if (data.nickname !== undefined) sess.nickname = data.nickname.trim();
        if (data.avatar !== undefined) sess.avatar = data.avatar.trim();
        sessionStorage.setItem(USER_SESSION, JSON.stringify(sess));
      }
    }
    return { ok: true };
  }

  // ── Ban / Mute ─────────────────────────
  function banUser(username, until) {
    const users = getUsers();
    const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!u) return { ok: false, msg: '用户不存在' };
    if (u.role === 'moderator') return { ok: false, msg: '不能封禁版主' };
    if (u.role === 'admin' && !isModerator()) return { ok: false, msg: '只有版主可以封禁管理员' };
    u.bannedUntil = until || null;
    setUsers(users);
    return { ok: true };
  }
  function unbanUser(username) {
    return banUser(username, null);
  }
  function muteUser(username, until) {
    const users = getUsers();
    const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!u) return { ok: false, msg: '用户不存在' };
    if (u.role === 'moderator') return { ok: false, msg: '不能禁言版主' };
    if (u.role === 'admin' && !isModerator()) return { ok: false, msg: '只有版主可以禁言管理员' };
    u.mutedUntil = until || null;
    setUsers(users);
    return { ok: true };
  }
  function unmuteUser(username) {
    return muteUser(username, null);
  }
  function isUserMuted(username) {
    const users = getUsers();
    const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!u || !u.mutedUntil) return false;
    return new Date(u.mutedUntil) > new Date();
  }
  function isUserBanned(username) {
    const users = getUsers();
    const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!u || !u.bannedUntil) return false;
    return new Date(u.bannedUntil) > new Date();
  }

  // Moderator auth
  function moderatorLogin(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { ok: false, msg: '用户不存在' };
    if (user.role !== 'moderator') return { ok: false, msg: '该用户不是版主' };
    if (user.passwordHash !== hashPw(password)) return { ok: false, msg: '密码错误' };
    const session = {
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: user.avatar || '',
      role: 'moderator'
    };
    sessionStorage.setItem(USER_SESSION, JSON.stringify(session));
    return { ok: true, username: session.username, nickname: session.nickname, avatar: session.avatar };
  }
  function registerModerator(username, password, opts = {}) {
    if (!isModerator()) {
      const existingMods = getUsers().filter(u => u.role === 'moderator');
      if (existingMods.length > 0) return { ok: false, msg: '只有版主可以添加版主' };
    }
    return register(username, password, { ...opts, role: 'moderator' });
  }

  // Admin auth
  function adminLoginUser(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { ok: false, msg: '用户不存在' };
    if (user.role !== 'admin' && user.role !== 'moderator') return { ok: false, msg: '该用户不是管理员或版主' };
    if (user.passwordHash !== hashPw(password)) return { ok: false, msg: '密码错误' };
    const session = {
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: user.avatar || '',
      role: user.role
    };
    sessionStorage.setItem(USER_SESSION, JSON.stringify(session));
    return { ok: true, username: session.username, nickname: session.nickname, avatar: session.avatar, role: session.role };
  }
  function registerAdmin(username, password, opts = {}) {
    // Only moderator can create admin accounts
    if (!isModerator()) {
      const existing = getUsers().filter(u => u.role === 'admin' || u.role === 'moderator');
      if (existing.length > 0) return { ok: false, msg: '只有版主可以创建管理员账号。管理员需从普通用户中提拔。' };
    }
    return register(username, password, { ...opts, role: 'admin' });
  }

  // ── Promote / Demote ────────────────────
  function promoteToAdmin(username) {
    if (!isModerator()) return { ok: false, msg: '只有版主可以提拔管理员' };
    const users = getUsers();
    const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!u) return { ok: false, msg: '用户不存在' };
    if (u.role !== 'user') return { ok: false, msg: '只能提拔普通用户为管理员' };
    u.role = 'admin';
    setUsers(users);
    addNotification(username, '你已被版主提拔为管理员！现在可以管理用户评论、禁言和封禁了。');
    return { ok: true };
  }

  function demoteFromAdmin(username) {
    if (!isModerator()) return { ok: false, msg: '只有版主可以贬黜管理员' };
    const users = getUsers();
    const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!u) return { ok: false, msg: '用户不存在' };
    if (u.role !== 'admin') return { ok: false, msg: '该用户不是管理员' };
    u.role = 'user';
    setUsers(users);
    addNotification(username, '你已被版主取消管理员身份。');
    return { ok: true };
  }

  // ── Notifications ───────────────────────
  function getNotifications(username) {
    const all = getData().notifications || {};
    return all[username] || [];
  }

  function addNotification(username, message) {
    const over = getAdminOverrides();
    if (!over.notifications) over.notifications = {};
    if (!over.notifications[username]) over.notifications[username] = [];
    over.notifications[username].push({
      id: genId(),
      message,
      date: new Date().toISOString().slice(0, 10),
      read: false
    });
    saveAdminOverrides(over);
  }

  function markNotificationsRead(username) {
    const over = getAdminOverrides();
    if (!over.notifications) return;
    const notifs = over.notifications[username] || [];
    notifs.forEach(n => n.read = true);
    saveAdminOverrides(over);
  }

  function unreadNotificationCount(username) {
    return getNotifications(username).filter(n => !n.read).length;
  }

  // Also send notifications on mute/unmute/ban/unban
  const _origMuteUser = muteUser;
  muteUser = function(username, until) {
    const result = _origMuteUser(username, until);
    if (result.ok) {
      if (until) addNotification(username, '你已被禁言' + (until.includes('2999') ? '（永久）' : '至 ' + new Date(until).toLocaleDateString()) + '。');
      else addNotification(username, '你的禁言已被解除。');
    }
    return result;
  };

  const _origBanUser = banUser;
  banUser = function(username, until) {
    const result = _origBanUser(username, until);
    if (result.ok) {
      if (until) addNotification(username, '你已被封禁' + (until.includes('2999') ? '（永久）' : '至 ' + new Date(until).toLocaleDateString()) + '。');
      else addNotification(username, '你的封禁已被解除。');
    }
    return result;
  };

  // Legacy admin password (backward compat)
  function getAdminPassword() { return getData().adminPassword; }
  function setAdminPassword(pw) {
    const over = getAdminOverrides();
    over.adminPassword = pw;
    saveAdminOverrides(over);
  }
  function adminLogin(pw) {
    const current = getAdminPassword();
    if (!pw || pw !== current) return false;
    sessionStorage.setItem(USER_SESSION, JSON.stringify({
      username: '_admin_', nickname: '管理员', avatar: '', role: 'admin'
    }));
    return true;
  }
  function adminLogout() {}

  // Getters for lists
  function getModerators() {
    return getUsers().filter(u => u.role === 'moderator');
  }
  function getAdmins() {
    return getUsers().filter(u => u.role === 'admin' || u.role === 'moderator');
  }

  // ── Admin auth ────────────────────────
  function getAdminPassword() { return getData().adminPassword; }
  function setAdminPassword(pw) {
    const over = getAdminOverrides();
    over.adminPassword = pw;
    saveAdminOverrides(over);
  }
  // New: admin check based on user session isAdmin flag
  function isAdminLoggedIn() {
    const info = getCurrentUserInfo();
    return info ? info.isAdmin : false;
  }
  // Legacy password login (kept for backward compat)
  function adminLogin(pw) {
    const current = getAdminPassword();
    if (!pw || pw !== current) return false;
    // If using legacy password, we need to create a session with isAdmin
    sessionStorage.setItem(USER_SESSION, JSON.stringify({
      username: '_admin_',
      nickname: '管理员',
      avatar: '',
      isAdmin: true
    }));
    return true;
  }
  // New: admin login via username/password (user must have isAdmin flag)
  function adminLoginUser(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { ok: false, msg: '用户不存在' };
    if (!user.isAdmin) return { ok: false, msg: '该用户不是管理员' };
    if (user.passwordHash !== hashPw(password)) return { ok: false, msg: '密码错误' };
    sessionStorage.setItem(USER_SESSION, JSON.stringify({
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: user.avatar || '',
      isAdmin: true
    }));
    return { ok: true, username: user.username, nickname: user.nickname, avatar: user.avatar };
  }
  // Register a new admin (requires existing admin to be logged in, or first setup)
  function registerAdmin(username, password, opts = {}) {
    // Allow registration if no admins exist yet (first setup after key verification)
    const existingAdmins = getUsers().filter(u => u.isAdmin);
    if (existingAdmins.length > 0 && !isAdminLoggedIn()) {
      return { ok: false, msg: '只有管理员可以添加新管理员' };
    }
    return register(username, password, { ...opts, isAdmin: true });
  }
  function adminLogout() {
    // Just logout for admin - handled by regular logout
  }

  // ── Comments ──────────────────────────
  function commentKey(type, id) { return type + '-' + id; }

  function getComments(type, id) {
    return getData().comments[commentKey(type, id)] || [];
  }

  function addComment(type, id, content, rating, parentId = null) {
    const info = getCurrentUserInfo();
    if (!info) return { ok: false, msg: '请先登录' };
    if (isUserMuted(info.username)) return { ok: false, msg: '你已被禁言，无法评论' };
    if (!content.trim()) return { ok: false, msg: '评论内容不能为空' };
    if (!parentId) {
      const r = parseFloat(rating);
      if (isNaN(r) || r < 0 || r > 10) return { ok: false, msg: '评分需在 0.0 — 10.0 之间' };
    }

    const comment = {
      id: genId(),
      parentId: parentId || null,
      author: info.username,
      authorNickname: info.nickname || info.username,
      authorAvatar: info.avatar || '',
      content: content.trim(),
      date: new Date().toISOString().slice(0, 10),
      rating: parentId ? 0 : (Math.round((parseFloat(rating) || 0) * 10) / 10)
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
    const info = getCurrentUserInfo();
    if (!info) return { ok: false, msg: '请先登录' };
    const key = commentKey(type, itemId);
    const over = getAdminOverrides();
    if (!over.comments || !over.comments[key]) return { ok: false, msg: '评论不存在' };
    const idx = over.comments[key].findIndex(c => c.id === commentId);
    if (idx === -1) return { ok: false, msg: '评论不存在' };
    // Author can delete own, admin/moderator can delete any
    const isAuthor = over.comments[key][idx].author === info.username;
    const isPowerUser = info.role === 'admin' || info.role === 'moderator';
    if (!isAuthor && !isPowerUser) return { ok: false, msg: '只能删除自己的评论' };
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

  // ── Likes ─────────────────────────────
  function toggleLike(type, id) {
    const info = getCurrentUserInfo();
    if (!info) return { ok: false, msg: '请先登录' };
    const key = type + '-' + id;
    const over = getAdminOverrides();
    if (!over.likes) over.likes = {};
    if (!over.likes[key]) over.likes[key] = [];
    const idx = over.likes[key].indexOf(info.username);
    if (idx === -1) {
      over.likes[key].push(info.username);
      saveAdminOverrides(over);
      return { ok: true, liked: true };
    } else {
      over.likes[key].splice(idx, 1);
      saveAdminOverrides(over);
      return { ok: true, liked: false };
    }
  }

  function hasLiked(type, id) {
    const info = getCurrentUserInfo();
    if (!info) return false;
    const key = type + '-' + id;
    const likes = getData().likes || {};
    return (likes[key] || []).includes(info.username);
  }

  function getLikeCount(type, id) {
    const key = type + '-' + id;
    const likes = getData().likes || {};
    return (likes[key] || []).length;
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
    for (const k of ['literary','popular','lightnovel','manga','movie','drama','anime','music']) {
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
      notifications: d.notifications,
      likes: d.likes,
      siteTitle: d.siteTitle,
      siteSubtitle: d.siteSubtitle
    };
  }

  return {
    genId, onReady,
    // Users & Auth
    register, login, logout, getCurrentUser, getCurrentUserInfo, isLoggedIn,
    updateProfile, getUsers, getAdmins, getModerators, setUsers,
    isModerator, isAdmin, isAdminLoggedIn,
    // Ban / Mute
    banUser, unbanUser, muteUser, unmuteUser, isUserMuted, isUserBanned,
    promoteToAdmin, demoteFromAdmin,
    // Admin & Moderator auth
    getAdminPassword, setAdminPassword, adminLogin, adminLoginUser, adminLogout,
    registerAdmin, moderatorLogin, registerModerator,
    // Comments
    getComments, addComment, deleteComment, avgRating,
    // Likes
    toggleLike, hasLiked, getLikeCount,
    // Notifications
    getNotifications, addNotification, markNotificationsRead, unreadNotificationCount,
    // Content
    getLiterature, getProjects, getRecommendations,
    getLitById, getProjById, getRecById,
    getSiteInfo, setSiteInfo,
    setLiterature, setProjects, setRecommendations,
    // Publish
    getPublishData
  };
})();
