/**
 * MYGO-MUJICA-WEB data store — Supabase backend
 */
const Store = (() => {
  // ═══════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════

  function getCurrentUser() {
    return supabase.auth.getSession().then(({ data }) => {
      return data?.session?.user || null;
    });
  }

  async function getCurrentUserInfo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return profile ? {
      username: profile.username,
      nickname: profile.nickname || profile.username,
      avatar: profile.avatar || '',
      role: profile.role || 'user',
      id: profile.id
    } : null;
  }

  async function isLoggedIn() {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  }

  async function register(email, password, opts = {}) {
    // Supabase uses email-based auth. We store the email as both email and username
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: opts.username || email,
          nickname: opts.nickname || ''
        }
      }
    });
    if (error) return { ok: false, msg: error.message };

    // Update profile with additional info
    if (data.user) {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        username: opts.username || email,
        nickname: opts.nickname || '',
        avatar: opts.avatar || '',
        role: 'user'
      });
      if (profileErr) return { ok: false, msg: profileErr.message };
    }
    return { ok: true };
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, msg: error.message };

    // Check ban
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
      await supabase.auth.signOut();
      return { ok: false, msg: '账号已被封禁至 ' + new Date(profile.banned_until).toLocaleDateString() };
    }

    return {
      ok: true,
      username: profile?.username || data.user.email,
      nickname: profile?.nickname || '',
      avatar: profile?.avatar || '',
      role: profile?.role || 'user'
    };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // ═══════════════════════════════════════
  //  ROLE CHECKS
  // ═══════════════════════════════════════

  async function isModerator() {
    const info = await getCurrentUserInfo();
    return info?.role === 'moderator';
  }

  async function isAdmin() {
    const info = await getCurrentUserInfo();
    return info && (info.role === 'admin' || info.role === 'moderator');
  }

  async function isAdminLoggedIn() {
    return await isAdmin();
  }

  // ═══════════════════════════════════════
  //  MODERATOR AUTH (with key gate)
  // ═══════════════════════════════════════

  async function moderatorLogin(email, password) {
    const result = await login(email, password);
    if (!result.ok) return result;
    if (result.role !== 'moderator') {
      await logout();
      return { ok: false, msg: '该用户不是版主' };
    }
    return result;
  }

  async function adminLoginUser(email, password) {
    const result = await login(email, password);
    if (!result.ok) return result;
    if (result.role !== 'admin' && result.role !== 'moderator') {
      await logout();
      return { ok: false, msg: '该用户不是管理员或版主' };
    }
    return result;
  }

  // ═══════════════════════════════════════
  //  BAN / MUTE (admin & mod)
  // ═══════════════════════════════════════

  async function banUser(username, until) {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('username', username);
    if (!profiles.length) return { ok: false, msg: '用户不存在' };
    if (profiles[0].role === 'moderator') return { ok: false, msg: '不能封禁版主' };
    const { error } = await supabase.from('profiles').update({ banned_until: until }).eq('username', username);
    if (error) return { ok: false, msg: error.message };
    if (until) {
      await addNotification(username, '你已被封禁' + (until.includes('2999') ? '（永久）。' : '。'));
    } else {
      await addNotification(username, '封禁已被解除。');
    }
    return { ok: true };
  }

  async function unbanUser(username) { return banUser(username, null); }

  async function muteUser(username, until) {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('username', username);
    if (!profiles.length) return { ok: false, msg: '用户不存在' };
    if (profiles[0].role === 'moderator') return { ok: false, msg: '不能禁言版主' };
    const { error } = await supabase.from('profiles').update({ muted_until: until }).eq('username', username);
    if (error) return { ok: false, msg: error.message };
    if (until) {
      await addNotification(username, '你已被禁言' + (until.includes('2999') ? '（永久）。' : '。'));
    } else {
      await addNotification(username, '禁言已被解除。');
    }
    return { ok: true };
  }

  async function unmuteUser(username) { return muteUser(username, null); }

  async function isUserMuted(username) {
    const { data } = await supabase.from('profiles').select('muted_until').eq('username', username).single();
    if (!data?.muted_until) return false;
    return new Date(data.muted_until) > new Date();
  }

  // ═══════════════════════════════════════
  //  PROMOTE / DEMOTE
  // ═══════════════════════════════════════

  async function promoteToAdmin(username) {
    const info = await getCurrentUserInfo();
    if (!info || info.role !== 'moderator') return { ok: false, msg: '只有版主可以提拔管理员' };
    const { data: profiles } = await supabase.from('profiles').select('*').eq('username', username);
    if (!profiles.length) return { ok: false, msg: '用户不存在' };
    if (profiles[0].role !== 'user') return { ok: false, msg: '只能提拔普通用户' };
    const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('username', username);
    if (error) return { ok: false, msg: error.message };
    await addNotification(username, '你已被版主提拔为管理员！');
    return { ok: true };
  }

  async function demoteFromAdmin(username) {
    const info = await getCurrentUserInfo();
    if (!info || info.role !== 'moderator') return { ok: false, msg: '只有版主可以贬黜管理员' };
    const { data: profiles } = await supabase.from('profiles').select('*').eq('username', username);
    if (!profiles.length) return { ok: false, msg: '用户不存在' };
    if (profiles[0].role !== 'admin') return { ok: false, msg: '该用户不是管理员' };
    const { error } = await supabase.from('profiles').update({ role: 'user' }).eq('username', username);
    if (error) return { ok: false, msg: error.message };
    await addNotification(username, '你已被版主取消管理员身份。');
    return { ok: true };
  }

  // ═══════════════════════════════════════
  //  NOTIFICATIONS
  // ═══════════════════════════════════════

  async function getNotifications(username) {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', (await getUserId(username))).order('created_at', { ascending: false });
    return data || [];
  }

  async function addNotification(username, message) {
    const uid = await getUserId(username);
    if (!uid) return;
    await supabase.from('notifications').insert({ user_id: uid, message });
  }

  async function markNotificationsRead(username) {
    const uid = await getUserId(username);
    if (!uid) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
  }

  async function unreadNotificationCount(username) {
    const uid = await getUserId(username);
    if (!uid) return 0;
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('read', false);
    return count || 0;
  }

  async function getUserId(username) {
    const { data } = await supabase.from('profiles').select('id').eq('username', username).single();
    return data?.id;
  }

  // ═══════════════════════════════════════
  //  COMMENTS
  // ═══════════════════════════════════════

  async function getComments(type, itemId) {
    const { data } = await supabase.from('comments')
      .select('*, profiles(username, nickname, avatar)')
      .eq('content_type', type).eq('content_id', itemId)
      .order('created_at', { ascending: true });
    return (data || []).map(c => ({
      id: c.id,
      parentId: c.parent_id,
      author: c.profiles?.username || '',
      authorNickname: c.profiles?.nickname || c.profiles?.username || '',
      authorAvatar: c.profiles?.avatar || '',
      content: c.body,
      date: c.created_at?.slice(0, 10) || '',
      rating: Number(c.rating) || 0
    }));
  }

  async function addComment(type, itemId, body, rating, parentId = null) {
    const info = await getCurrentUserInfo();
    if (!info) return { ok: false, msg: '请先登录' };

    // Check mute
    const { data: profile } = await supabase.from('profiles').select('muted_until').eq('id', info.id).single();
    if (profile?.muted_until && new Date(profile.muted_until) > new Date()) {
      return { ok: false, msg: '你已被禁言，无法评论' };
    }
    if (!body.trim()) return { ok: false, msg: '评论内容不能为空' };

    const { error } = await supabase.from('comments').insert({
      content_type: type, content_id: itemId, parent_id: parentId,
      author_id: info.id, body: body.trim(),
      rating: parentId ? 0 : (Math.round((parseFloat(rating) || 0) * 10) / 10)
    });
    if (error) return { ok: false, msg: error.message };
    return { ok: true };
  }

  async function deleteComment(type, itemId, commentId) {
    const info = await getCurrentUserInfo();
    if (!info) return { ok: false, msg: '请先登录' };

    const { data: comment } = await supabase.from('comments').select('*, profiles(username)').eq('id', commentId).single();
    if (!comment) return { ok: false, msg: '评论不存在' };

    const isAuthor = comment.author_id === info.id;
    const isPowerUser = info.role === 'admin' || info.role === 'moderator';
    if (!isAuthor && !isPowerUser) return { ok: false, msg: '只能删除自己的评论' };

    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) return { ok: false, msg: error.message };
    return { ok: true };
  }

  async function avgRating(type, itemId) {
    const { data } = await supabase.from('comments')
      .select('rating').eq('content_type', type).eq('content_id', itemId).gt('rating', 0);
    if (!data?.length) return 0;
    const sum = data.reduce((s, c) => s + Number(c.rating), 0);
    return Math.round((sum / data.length) * 10) / 10;
  }

  // ═══════════════════════════════════════
  //  LIKES
  // ═══════════════════════════════════════

  async function toggleLike(type, itemId) {
    const info = await getCurrentUserInfo();
    if (!info) return { ok: false, msg: '请先登录' };

    const { data: existing } = await supabase.from('likes').select('id')
      .eq('content_type', type).eq('content_id', itemId).eq('user_id', info.id);

    if (existing?.length) {
      await supabase.from('likes').delete().eq('id', existing[0].id);
      return { ok: true, liked: false };
    } else {
      await supabase.from('likes').insert({ content_type: type, content_id: itemId, user_id: info.id });
      return { ok: true, liked: true };
    }
  }

  async function hasLiked(type, itemId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('likes').select('id')
      .eq('content_type', type).eq('content_id', itemId).eq('user_id', user.id);
    return !!(data?.length);
  }

  async function getLikeCount(type, itemId) {
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true })
      .eq('content_type', type).eq('content_id', itemId);
    return count || 0;
  }

  // ═══════════════════════════════════════
  //  CONTENT GETTERS
  // ═══════════════════════════════════════

  async function getLiterature() {
    const { data } = await supabase.from('literature').select('*').order('date', { ascending: false });
    return data || [];
  }

  async function getProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  async function getRecommendations() {
    const { data } = await supabase.from('recommendations').select('*').order('created_at', { ascending: false });
    const cats = { literary: [], popular: [], lightnovel: [], manga: [], movie: [], drama: [], anime: [], music: [] };
    (data || []).forEach(r => {
      if (cats[r.category]) cats[r.category].push(r);
    });
    return cats;
  }

  async function getSiteInfo() {
    return { title: 'MYGO-MUJICA-WEB', subtitle: '记录个人的文学创作、代码项目，以及那些值得被记住的作品。' };
  }

  async function getLitById(id) {
    const { data } = await supabase.from('literature').select('*').eq('id', id).single();
    return data;
  }

  async function getProjById(id) {
    const { data } = await supabase.from('projects').select('*').eq('id', id).single();
    return data;
  }

  async function getRecById(id) {
    const { data } = await supabase.from('recommendations').select('*').eq('id', id).single();
    return data ? { cat: data.category, item: data } : null;
  }

  async function getUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    return data || [];
  }

  async function getAdmins() {
    const { data } = await supabase.from('profiles').select('*').in('role', ['admin', 'moderator']);
    return data || [];
  }

  async function getModerators() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'moderator');
    return data || [];
  }

  // ═══════════════════════════════════════
  //  CONTENT SETTERS (mod only)
  // ═══════════════════════════════════════

  async function setLiterature(items) { /* Not needed - individual CRUD via Supabase */ }

  async function setProjects(items) { /* Not needed */ }

  async function setRecommendations(recs) { /* Not needed */ }

  async function setSiteInfo(info) { /* Hardcoded for now, could use a settings table */ }

  async function insertLiterature(item) {
    const { error } = await supabase.from('literature').insert(item);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function updateLiterature(id, item) {
    const { error } = await supabase.from('literature').update(item).eq('id', id);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function deleteLiterature(id) {
    const { error } = await supabase.from('literature').delete().eq('id', id);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function insertProject(item) {
    const { error } = await supabase.from('projects').insert(item);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function updateProject(id, item) {
    const { error } = await supabase.from('projects').update(item).eq('id', id);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function insertRecommendation(item) {
    const { error } = await supabase.from('recommendations').insert(item);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function updateRecommendation(id, item) {
    const { error } = await supabase.from('recommendations').update(item).eq('id', id);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function deleteRecommendation(id) {
    const { error } = await supabase.from('recommendations').delete().eq('id', id);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  async function updateProfile(username, data) {
    const { error } = await supabase.from('profiles').update(data).eq('username', username);
    return error ? { ok: false, msg: error.message } : { ok: true };
  }

  // ═══════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════

  return {
    // Auth
    getCurrentUser, getCurrentUserInfo, isLoggedIn, register, login, logout,
    // Roles
    isModerator, isAdmin, isAdminLoggedIn,
    moderatorLogin, adminLoginUser,
    // Ban/Mute
    banUser, unbanUser, muteUser, unmuteUser, isUserMuted,
    promoteToAdmin, demoteFromAdmin,
    // Notifications
    getNotifications, markNotificationsRead, unreadNotificationCount,
    // Comments
    getComments, addComment, deleteComment, avgRating,
    // Likes
    toggleLike, hasLiked, getLikeCount,
    // Content
    getLiterature, getProjects, getRecommendations, getSiteInfo,
    getLitById, getProjById, getRecById,
    getUsers, getAdmins, getModerators,
    setLiterature, setProjects, setRecommendations, setSiteInfo,
    insertLiterature, updateLiterature, deleteLiterature,
    insertProject, updateProject, deleteProject,
    insertRecommendation, updateRecommendation, deleteRecommendation,
    updateProfile
  };
})();
