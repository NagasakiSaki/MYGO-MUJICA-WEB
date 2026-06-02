/**
 * localStorage-based data store for MYGO-MUJICA-WEB
 */
const Store = (() => {
  const KEY = 'mygo_data';
  const USER_SESSION = 'mygo_session';

  const defaults = {
    literature: [
      { id: '1', title: '示例文章标题', date: '2026-06-01', excerpt: '在这里写下你的文字创作，替换为实际内容后即可发布。', content: '这是文章的正文内容。点击文章标题可以进入详情页查看完整内容和评论。' },
      { id: '2', title: '另一篇创作', date: '2026-05-20', excerpt: '每一篇文章都是一个独立的世界，等待被书写。', content: '用文字记录下每一个转瞬即逝的灵感。' }
    ],
    projects: [
      { id: '1', name: '项目名称', desc: '这是一个示例项目的简短描述。', detail: '项目的详细介绍，说明技术选型、架构设计等。', tags: ['HTML', 'CSS', 'JavaScript'], link: '' },
      { id: '2', name: '另一个项目', desc: '用代码构建有趣的东西。', detail: '更详细的项目说明。', tags: ['Python', 'Flask'], link: '' }
    ],
    recommendations: {
      books: [
        { id: '1', title: '书名', author: '作者', year: '2024', cover: '', review: '这是一篇完整的推荐帖正文。这里写下对这本书的深入评价、读后感、以及推荐理由。', excerpt: '在这里写下你对这本书的推荐理由。' }
      ],
      music: [
        { id: '1', title: '歌曲 / 专辑', artist: '艺术家', year: '2024', cover: '', review: '详细乐评正文，谈谈这张专辑为什么会打动你。', excerpt: '音乐带来的感动值得被记录和分享。' }
      ],
      films: [
        { id: '1', title: '作品名', director: '导演', year: '2023', cover: '', review: '完整的影评正文，分析镜头语言、叙事结构、主题表达。', excerpt: '银幕上那些难忘的故事。' }
      ]
    },
    comments: {},   // { "lit-<id>": [{id,author,content,date,rating}], "proj-<id>": [...], "rec-<id>": [...] }
    users: [],      // [{username, passwordHash}]
    siteTitle: 'MYGO-MUJICA-WEB',
    siteSubtitle: '记录个人的文学创作、代码项目，以及那些值得被记住的作品。',
    adminPassword: ''
  };

  let data = null;

  function load() {
    if (data) return data;
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        data = deepMerge(defaults, parsed);
      } catch (e) {
        data = JSON.parse(JSON.stringify(defaults));
      }
    } else {
      data = JSON.parse(JSON.stringify(defaults));
    }
    return data;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function deepMerge(base, over) {
    const result = { ...base };
    for (const key of Object.keys(over)) {
      if (over[key] && typeof over[key] === 'object' && !Array.isArray(over[key]) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        result[key] = deepMerge(base[key], over[key]);
      } else {
        result[key] = over[key];
      }
    }
    return result;
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Simple password hash ──
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

  // ── Users ──────────────────────────────
  function getUsers() { return load().users; }

  function register(username, password) {
    if (!username || !password) return { ok: false, msg: '用户名和密码不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 3) return { ok: false, msg: '密码至少3个字符' };
    const users = load().users;
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, msg: '用户名已存在' };
    }
    users.push({ username, passwordHash: hashPw(password) });
    save();
    return { ok: true };
  }

  function login(username, password) {
    const users = load().users;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { ok: false, msg: '用户不存在' };
    if (user.passwordHash !== hashPw(password)) return { ok: false, msg: '密码错误' };
    sessionStorage.setItem(USER_SESSION, user.username);
    return { ok: true, username: user.username };
  }

  function logout() {
    sessionStorage.removeItem(USER_SESSION);
  }

  function getCurrentUser() {
    return sessionStorage.getItem(USER_SESSION) || null;
  }

  function isLoggedIn() {
    return !!sessionStorage.getItem(USER_SESSION);
  }

  // ── Comments ───────────────────────────
  function commentKey(type, id) { return type + '-' + id; }

  function getComments(type, id) {
    const all = load().comments;
    return all[commentKey(type, id)] || [];
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
    const all = load().comments;
    if (!all[key]) all[key] = [];
    all[key].push(comment);
    save();
    return { ok: true, comment };
  }

  function deleteComment(type, itemId, commentId) {
    const user = getCurrentUser();
    if (!user) return { ok: false, msg: '请先登录' };
    const key = commentKey(type, itemId);
    const all = load().comments;
    if (!all[key]) return { ok: false, msg: '评论不存在' };
    const idx = all[key].findIndex(c => c.id === commentId);
    if (idx === -1) return { ok: false, msg: '评论不存在' };
    if (all[key][idx].author !== user) return { ok: false, msg: '只能删除自己的评论' };
    all[key].splice(idx, 1);
    save();
    return { ok: true };
  }

  function avgRating(type, id) {
    const comments = getComments(type, id);
    if (!comments.length) return 0;
    const sum = comments.reduce((s, c) => s + (c.rating || 0), 0);
    return Math.round((sum / comments.length) * 10) / 10;
  }

  // ── Getters ────────────────────────────
  function getLiterature() { return load().literature; }
  function getProjects() { return load().projects; }
  function getRecommendations() { return load().recommendations; }
  function getSiteInfo() { const d = load(); return { title: d.siteTitle, subtitle: d.siteSubtitle }; }
  function getAdminPassword() { return load().adminPassword; }

  function getLitById(id) { return load().literature.find(i => i.id === id) || null; }
  function getProjById(id) { return load().projects.find(i => i.id === id) || null; }
  function getRecById(id) {
    const all = load().recommendations;
    for (const k of ['books', 'music', 'films']) {
      const found = all[k].find(i => i.id === id);
      if (found) return { cat: k, item: found };
    }
    return null;
  }

  // ── Setters ────────────────────────────
  function setLiterature(items) { load().literature = items; save(); }
  function setProjects(items) { load().projects = items; save(); }
  function setRecommendations(recs) { load().recommendations = recs; save(); }
  function setSiteInfo(info) {
    const d = load();
    if (info.title !== undefined) d.siteTitle = info.title;
    if (info.subtitle !== undefined) d.siteSubtitle = info.subtitle;
    save();
  }
  function setAdminPassword(pw) { load().adminPassword = pw; save(); }

  return {
    genId,
    // Users & Auth
    register, login, logout, getCurrentUser, isLoggedIn, getUsers,
    // Comments
    getComments, addComment, deleteComment, avgRating,
    // Content getters
    getLiterature, getProjects, getRecommendations,
    getLitById, getProjById, getRecById,
    getSiteInfo, setSiteInfo,
    getAdminPassword, setAdminPassword,
    // Content setters (for admin)
    setLiterature, setProjects, setRecommendations
  };
})();
