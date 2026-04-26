const STORAGE_KEY_V3 = 'mybook_v3';
const STORAGE_KEY_V2 = 'mybook_v2';
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_OUTPUT_QUALITY = 0.82;
const MAX_VIDEO_FILE_BYTES = 12 * 1024 * 1024;

const els = {
  profileName: document.getElementById('profileName'),
  profileBio: document.getElementById('profileBio'),
  avatarInitials: document.getElementById('avatarInitials'),
  profilePicInput: document.getElementById('profilePicInput'),
  postForm: document.getElementById('postForm'),
  postText: document.getElementById('postText'),
  postDate: document.getElementById('postDate'),
  postTags: document.getElementById('postTags'),
  postMedia: document.getElementById('postMedia'),
  mediaPreview: document.getElementById('mediaPreview'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  feedList: document.getElementById('feedList'),
  emptyState: document.getElementById('emptyState'),
  postTemplate: document.getElementById('postTemplate'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsPanel: document.querySelector('#settingsModal .settings-panel'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  themeSelect: document.getElementById('themeSelect'),
  settingsClearBtn: document.getElementById('settingsClearBtn'),
  updateAppBtn: document.getElementById('updateAppBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  accountMenuBtn: document.getElementById('accountMenuBtn'),
  accountMenu: document.getElementById('accountMenu'),
  messageModal: document.getElementById('messageModal'),
  messageModalTitle: document.getElementById('messageModalTitle'),
  messageModalText: document.getElementById('messageModalText'),
  messageModalInput: document.getElementById('messageModalInput'),
  messageModalCancel: document.getElementById('messageModalCancel'),
  messageModalConfirm: document.getElementById('messageModalConfirm'),
};

const state = {
  data: makeDefaultData(),
  pendingMedia: [],
};

function makeDefaultData() {
  return {
    version: 3,
    profile: { name: '', bio: '', avatarDataUrl: '' },
    postsById: {},
    postOrder: [],
    preferences: {
      theme: 'system',
    },
  };
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function openModalOverlay(modalEl) {
  modalEl.classList.remove('hidden');
  requestAnimationFrame(() => modalEl.classList.add('is-open'));
}

function closeModalOverlay(modalEl) {
  modalEl.classList.remove('is-open');
  window.setTimeout(() => {
    if (!modalEl.classList.contains('is-open')) modalEl.classList.add('hidden');
  }, 180);
}

function showModalMessage(options = {}) {
  const {
    title = 'mybook',
    message = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false,
    input = null,
  } = options;

  return new Promise((resolve) => {
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      closeModalOverlay(els.messageModal);
      els.messageModal.removeEventListener('click', onBackdropClick);
      document.removeEventListener('keydown', onEscape);
      els.messageModalCancel.removeEventListener('click', onCancel);
      els.messageModalConfirm.removeEventListener('click', onConfirm);
      resolve(result);
    };

    const onCancel = () => finish(null);
    const onConfirm = () => finish(els.messageModalInput.classList.contains('hidden') ? true : els.messageModalInput.value.trim());
    const onBackdropClick = (event) => {
      if (event.target === els.messageModal) onCancel();
    };
    const onEscape = (event) => {
      if (event.key === 'Escape' && !els.messageModal.classList.contains('hidden')) onCancel();
    };

    els.messageModalTitle.textContent = title;
    els.messageModalText.textContent = message;
    els.messageModalConfirm.textContent = confirmText;
    els.messageModalCancel.textContent = cancelText;
    els.messageModalCancel.classList.toggle('hidden', !showCancel);

    if (input) {
      els.messageModalInput.classList.remove('hidden');
      els.messageModalInput.value = input.defaultValue || '';
      els.messageModalInput.placeholder = input.placeholder || '';
    } else {
      els.messageModalInput.classList.add('hidden');
      els.messageModalInput.value = '';
      els.messageModalInput.placeholder = '';
    }

    els.messageModalCancel.addEventListener('click', onCancel);
    els.messageModalConfirm.addEventListener('click', onConfirm);
    els.messageModal.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onEscape);

    openModalOverlay(els.messageModal);
    if (input) els.messageModalInput.focus();
    else els.messageModalConfirm.focus();
  });
}

function toast(message, type = 'ok') {
  const titleByType = {
    error: 'Could not save',
    warn: 'Heads up',
    ok: 'mybook',
  };
  void showModalMessage({
    title: titleByType[type] || 'mybook',
    message,
    confirmText: 'Got it',
  });
}

function resolveTheme(mode) {
  if (mode === 'dark' || mode === 'light') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(themeMode) {
  const resolvedMode = resolveTheme(themeMode);
  document.documentElement.setAttribute('data-theme', resolvedMode);
}

async function clearAppCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('mybook-cache-')).map((key) => caches.delete(key)));
}

function save() {
  localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(state.data));
}

function updateState(mutator, options = {}) {
  const { render = true, persist = true } = options;
  const snapshot = deepCopy(state.data);
  mutator(state.data);

  try {
    if (persist) save();
  } catch {
    state.data = snapshot;
    toast('Could not save this change on your device.', 'error');
    return false;
  }

  if (render) {
    renderAvatar();
    renderPosts();
  }

  return true;
}

function normalizeProfile(profile = {}) {
  const avatarDataUrl =
    typeof profile.avatarDataUrl === 'string'
      ? profile.avatarDataUrl
      : (profile.avatarDataUrl && typeof profile.avatarDataUrl.dataUrl === 'string' ? profile.avatarDataUrl.dataUrl : '');

  return {
    ...makeDefaultData().profile,
    ...(profile && typeof profile === 'object' ? profile : {}),
    avatarDataUrl,
    name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : 'Mybook User',
    bio: typeof profile.bio === 'string' ? profile.bio : '',
  };
}

function normalizePreferences(preferences = {}) {
  const theme = typeof preferences.theme === 'string' ? preferences.theme : 'system';
  const normalizedTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';

  return {
    ...makeDefaultData().preferences,
    ...(preferences && typeof preferences === 'object' ? preferences : {}),
    theme: normalizedTheme,
  };
}

function normalizeComment(comment = {}) {
  return {
    id: typeof comment.id === 'string' ? comment.id : crypto.randomUUID(),
    text: typeof comment.text === 'string' ? comment.text : '',
    createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : new Date().toISOString(),
    updatedAt: typeof comment.updatedAt === 'string' ? comment.updatedAt : undefined,
  };
}

function normalizePost(post = {}) {
  return {
    id: typeof post.id === 'string' ? post.id : crypto.randomUUID(),
    text: typeof post.text === 'string' ? post.text : '',
    date: typeof post.date === 'string' ? post.date : '',
    createdAt: typeof post.createdAt === 'string' ? post.createdAt : new Date().toISOString(),
    updatedAt: typeof post.updatedAt === 'string' ? post.updatedAt : undefined,
    tags: Array.isArray(post.tags) ? post.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean) : [],
    media: Array.isArray(post.media)
      ? post.media.filter((m) => m && typeof m.dataUrl === 'string' && (m.type === 'image' || m.type === 'video')).map((m) => ({
        dataUrl: m.dataUrl,
        type: m.type,
        name: typeof m.name === 'string' ? m.name : (m.type === 'video' ? 'video' : 'image'),
      }))
      : [],
    liked: Boolean(post.liked),
    comments: Array.isArray(post.comments) ? post.comments.map(normalizeComment).filter((c) => c.text.trim()) : [],
  };
}

function normalizeV3(raw = {}) {
  const normalized = makeDefaultData();
  normalized.profile = normalizeProfile(raw.profile || {});
  normalized.preferences = normalizePreferences(raw.preferences || {});

  const incomingPostsById = raw.postsById && typeof raw.postsById === 'object' ? raw.postsById : {};
  const incomingOrder = Array.isArray(raw.postOrder) ? raw.postOrder : [];

  Object.keys(incomingPostsById).forEach((postId) => {
    const post = normalizePost(incomingPostsById[postId]);
    normalized.postsById[post.id] = post;
  });

  normalized.postOrder = incomingOrder
    .filter((id) => typeof id === 'string' && normalized.postsById[id])
    .concat(Object.keys(normalized.postsById).filter((id) => !incomingOrder.includes(id)));

  normalized.version = 3;
  return normalized;
}

function migrateV2ToV3(rawV2 = {}) {
  const migrated = makeDefaultData();
  migrated.profile = normalizeProfile(rawV2.profile || {});
  migrated.preferences = normalizePreferences(rawV2.preferences || {});

  const posts = Array.isArray(rawV2.posts) ? rawV2.posts : [];
  posts.forEach((oldPost) => {
    const post = normalizePost(oldPost);
    migrated.postsById[post.id] = post;
    migrated.postOrder.push(post.id);
  });

  return migrated;
}

async function load() {
  let loadedData = null;

  const savedV3 = localStorage.getItem(STORAGE_KEY_V3);
  if (savedV3) {
    try {
      loadedData = normalizeV3(JSON.parse(savedV3));
    } catch {
      loadedData = null;
    }
  }

  if (!loadedData) {
    const savedV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (savedV2) {
      try {
        loadedData = migrateV2ToV3(JSON.parse(savedV2));
      } catch {
        loadedData = null;
      }
    }
  }

  state.data = loadedData || makeDefaultData();

  if (!state.data.profile.name) {
    const enteredName = await showModalMessage({
      title: 'Welcome to mybook',
      message: 'What is your name?',
      confirmText: 'Save',
      cancelText: 'Skip',
      showCancel: true,
      input: { placeholder: 'My name', defaultValue: '' },
    });
    state.data.profile.name = enteredName || 'Mybook User';
  }

  updateState((draft) => {
    draft.version = 3;
  }, { render: false });

  els.profileName.value = state.data.profile.name;
  els.profileBio.value = state.data.profile.bio || '';
  els.themeSelect.value = state.data.preferences.theme;
  applyTheme(state.data.preferences.theme);
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0].toUpperCase())
    .join('') || 'M';
}

function renderAvatar() {
  if (state.data.profile.avatarDataUrl) {
    els.avatarInitials.textContent = '';
    els.avatarInitials.style.backgroundImage = `url("${state.data.profile.avatarDataUrl}")`;
  } else {
    els.avatarInitials.style.backgroundImage = '';
    els.avatarInitials.textContent = initials(state.data.profile.name);
  }
}

function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function fileToDataUrl(file) {
  if (file.type.startsWith('image/')) {
    return optimizeImageFile(file);
  }

  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      return Promise.reject(new Error('video-too-large'));
    }
    return readRawFileDataUrl(file, 'video');
  }

  return Promise.reject(new Error('unsupported-file-type'));
}

function readRawFileDataUrl(file, typeOverride = '') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, type: typeOverride || (file.type.startsWith('video/') ? 'video' : 'image'), name: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function optimizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('image-read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image-decode-failed'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas-unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_OUTPUT_QUALITY);
        resolve({ dataUrl, type: 'image', name: file.name });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderMediaPreview() {
  els.mediaPreview.innerHTML = '';
  state.pendingMedia.forEach((item) => {
    const chip = document.createElement('div');
    chip.className = 'media-chip';
    chip.textContent = `${item.type === 'video' ? '🎬' : '🖼️'} ${item.name}`;
    els.mediaPreview.append(chip);
  });
}

function getVisiblePosts() {
  const q = els.searchInput.value.trim().toLowerCase();
  const order = els.sortSelect.value;

  const posts = state.data.postOrder
    .map((id) => state.data.postsById[id])
    .filter(Boolean)
    .filter((post) => {
      const hay = `${post.text}\n${(post.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });

  return posts.sort((a, b) => {
    const lhs = new Date(a.date || a.createdAt).getTime();
    const rhs = new Date(b.date || b.createdAt).getTime();
    return order === 'oldest' ? lhs - rhs : rhs - lhs;
  });
}

function openSettings() {
  closeAccountMenu();
  openModalOverlay(els.settingsModal);
}

function closeSettings() {
  closeModalOverlay(els.settingsModal);
}

function openAccountMenu() {
  els.accountMenu.classList.remove('hidden');
  els.accountMenuBtn.setAttribute('aria-expanded', 'true');
}

function closeAccountMenu() {
  els.accountMenu.classList.add('hidden');
  els.accountMenuBtn.setAttribute('aria-expanded', 'false');
}

function renderPosts() {
  const filtered = getVisiblePosts();

  els.feedList.innerHTML = '';
  els.emptyState.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach((post) => {
    const node = els.postTemplate.content.firstElementChild.cloneNode(true);
    const miniAvatar = node.querySelector('.mini-avatar');
    if (state.data.profile.avatarDataUrl) {
      miniAvatar.textContent = '';
      miniAvatar.style.backgroundImage = `url("${state.data.profile.avatarDataUrl}")`;
      miniAvatar.style.backgroundSize = 'cover';
      miniAvatar.style.backgroundPosition = 'center';
    } else {
      miniAvatar.style.backgroundImage = '';
      miniAvatar.style.backgroundSize = '';
      miniAvatar.style.backgroundPosition = '';
      miniAvatar.textContent = initials(state.data.profile.name);
    }
    node.querySelector('.post-author').textContent = state.data.profile.name;
    node.querySelector('.post-date').textContent = formatDate(post.date || post.createdAt);
    node.querySelector('.post-text').textContent = post.text;

    const postText = node.querySelector('.post-text');
    const postEditor = node.querySelector('.post-edit-editor');
    const postEditInput = node.querySelector('.post-edit-input');

    const mediaHost = node.querySelector('.post-media');
    (post.media || []).forEach((m) => {
      const mediaEl = document.createElement(m.type === 'video' ? 'video' : 'img');
      mediaEl.src = m.dataUrl;
      if (m.type === 'video') mediaEl.controls = true;
      mediaHost.append(mediaEl);
    });

    const tagList = node.querySelector('.tag-list');
    (post.tags || []).forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${tag}`;
      tagList.append(span);
    });

    const likeBtn = node.querySelector('.like-btn');
    likeBtn.classList.toggle('active', !!post.liked);
    likeBtn.textContent = post.liked ? '👍 Liked' : '👍 Like';
    likeBtn.addEventListener('click', () => {
      updateState((draft) => {
        draft.postsById[post.id].liked = !draft.postsById[post.id].liked;
      });
    });

    node.querySelector('.comment-btn').addEventListener('click', () => {
      node.querySelector('.comment-input').focus();
    });

    node.querySelector('.share-btn').addEventListener('click', async () => {
      const choice = await showModalMessage({
        title: 'Share memory',
        message: 'Quick share includes text, app graphic, and uploaded media. Memory share exports JSON that another mybook can import.',
        confirmText: 'Quick share',
        cancelText: 'Memory share',
        showCancel: true,
      });

      if (choice) {
        try {
          await quickSharePost(post);
        } catch {
          toast('Quick share failed on this device.', 'warn');
        }
        return;
      }

      downloadMemoryShare(post);
      toast('Memory share JSON downloaded.');
    });

    const postMenuWrap = node.querySelector('.post-menu-wrap');
    const postMenuBtn = node.querySelector('.post-menu-btn');
    const postMenu = node.querySelector('.post-menu');
    postMenuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isHidden = postMenu.classList.contains('hidden');
      document.querySelectorAll('.post-menu').forEach((menu) => menu.classList.add('hidden'));
      postMenuBtn.setAttribute('aria-expanded', String(isHidden));
      postMenu.classList.toggle('hidden', !isHidden);
    });

    node.querySelector('.copy-post-link').addEventListener('click', async () => {
      const link = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
        toast('Post link copied.');
      } catch {
        toast('Copy link placeholder ready (clipboard unavailable).', 'warn');
      }
      postMenu.classList.add('hidden');
    });

    node.querySelector('.delete-post').addEventListener('click', () => {
      updateState((draft) => {
        delete draft.postsById[post.id];
        draft.postOrder = draft.postOrder.filter((id) => id !== post.id);
      });
      toast('Memory deleted.');
    });

    const postEditBtn = node.querySelector('.edit-post');
    const postEditCancelBtn = node.querySelector('.post-edit-cancel');
    const postEditSaveBtn = node.querySelector('.post-edit-save');

    postEditBtn.addEventListener('click', () => {
      postEditInput.value = post.text || '';
      postText.classList.add('hidden');
      postEditor.classList.remove('hidden');
      postEditInput.focus();
      postMenu.classList.add('hidden');
    });

    postEditCancelBtn.addEventListener('click', () => {
      postEditor.classList.add('hidden');
      postText.classList.remove('hidden');
    });

    postEditSaveBtn.addEventListener('click', () => {
      const nextText = postEditInput.value.trim();
      if (!nextText && (!Array.isArray(post.media) || post.media.length === 0)) return;

      const updated = updateState((draft) => {
        draft.postsById[post.id].text = nextText;
        draft.postsById[post.id].updatedAt = new Date().toISOString();
      });

      if (updated) toast('Memory saved.');
    });

    const commentList = node.querySelector('.comment-list');
    const commentTemplate = commentList.querySelector('.comment-template');
    const comments = Array.isArray(post.comments) ? post.comments : [];
    comments.forEach((comment) => {
      const item = commentTemplate.cloneNode(true);
      item.classList.remove('comment-template', 'hidden');

      const author = item.querySelector('.comment-author');
      author.textContent = state.data.profile.name;

      const text = item.querySelector('.comment-text');
      text.textContent = comment.text;

      const actionRow = item.querySelector('.comment-actions');
      const editBtn = item.querySelector('.comment-edit');
      const deleteBtn = item.querySelector('.comment-delete');

      const editor = item.querySelector('.comment-editor');
      const editorInput = item.querySelector('.comment-edit-input');
      const cancelBtn = item.querySelector('.comment-edit-cancel');
      const saveBtn = item.querySelector('.comment-edit-save');

      editBtn.addEventListener('click', () => {
        editorInput.value = comment.text || '';
        text.classList.add('hidden');
        actionRow.classList.add('hidden');
        editor.classList.remove('hidden');
        editorInput.focus();
      });

      cancelBtn.addEventListener('click', () => {
        editor.classList.add('hidden');
        text.classList.remove('hidden');
        actionRow.classList.remove('hidden');
      });

      saveBtn.addEventListener('click', () => {
        const nextText = editorInput.value.trim();
        if (!nextText) return;

        const updated = updateState((draft) => {
          const commentsDraft = draft.postsById[post.id].comments || [];
          draft.postsById[post.id].comments = commentsDraft.map((existingComment) => (
            existingComment.id === comment.id
              ? { ...existingComment, text: nextText, updatedAt: new Date().toISOString() }
              : existingComment
          ));
        });

        if (updated) toast('Comment saved.');
      });

      deleteBtn.addEventListener('click', () => {
        updateState((draft) => {
          const commentsDraft = draft.postsById[post.id].comments || [];
          draft.postsById[post.id].comments = commentsDraft.filter((existingComment) => existingComment.id !== comment.id);
        });
        toast('Comment deleted.');
      });

      commentList.append(item);
    });

    node.querySelector('.comment-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('.comment-input');
      const text = input.value.trim();
      if (!text) return;

      const newComment = {
        id: crypto.randomUUID(),
        text,
        createdAt: new Date().toISOString(),
      };

      updateState((draft) => {
        const commentsDraft = draft.postsById[post.id].comments || [];
        draft.postsById[post.id].comments = [...commentsDraft, newComment];
      });

      input.value = '';
    });

    els.feedList.append(node);
  });
}

els.profileName.addEventListener('input', () => {
  const entered = els.profileName.value.trim() || 'Mybook User';
  updateState((draft) => {
    draft.profile.name = entered;
  });
});

els.profileBio.addEventListener('input', () => {
  updateState((draft) => {
    draft.profile.bio = els.profileBio.value;
  }, { render: false });
});

els.profilePicInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const avatar = await fileToDataUrl(file);
    const updated = updateState((draft) => {
      draft.profile.avatarDataUrl = avatar.dataUrl;
    });

    if (!updated) {
      toast('Try a smaller image for your profile photo.', 'warn');
    }
  } catch (error) {
    const message = error && error.message === 'video-too-large'
      ? 'Videos are not supported for profile photos.'
      : 'Could not process that image. Try another file.';
    toast(message, 'error');
  } finally {
    event.target.value = '';
  }
});

els.postMedia.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []).slice(0, 8);
  try {
    const processed = await Promise.all(files.map(fileToDataUrl));
    state.pendingMedia = processed;
    renderMediaPreview();
  } catch (error) {
    state.pendingMedia = [];
    renderMediaPreview();
    if (error && error.message === 'video-too-large') {
      toast('One of your videos is too large. Keep each video under 12 MB.', 'error');
    } else {
      toast('Could not process one or more files. Try smaller photos/videos.', 'error');
    }
  } finally {
    event.target.value = '';
  }
});

els.postForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = els.postText.value.trim();
  if (!text && state.pendingMedia.length === 0) return;

  const post = normalizePost({
    id: crypto.randomUUID(),
    text,
    date: els.postDate.value,
    createdAt: new Date().toISOString(),
    tags: els.postTags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
    media: state.pendingMedia,
    liked: false,
    comments: [],
  });

  const updated = updateState((draft) => {
    draft.postsById[post.id] = post;
    draft.postOrder.unshift(post.id);
  });

  if (!updated) {
    toast('Try fewer or smaller files, then post again.', 'warn');
    return;
  }

  els.postText.value = '';
  els.postTags.value = '';
  els.postDate.value = '';
  els.postMedia.value = '';
  state.pendingMedia = [];
  renderMediaPreview();
});

els.searchInput.addEventListener('input', renderPosts);
els.sortSelect.addEventListener('change', renderPosts);

els.accountMenuBtn.addEventListener('click', () => {
  const isOpen = !els.accountMenu.classList.contains('hidden');
  if (isOpen) closeAccountMenu();
  else openAccountMenu();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.account-menu-wrap')) {
    closeAccountMenu();
  }
  if (!event.target.closest('.post-menu-wrap')) {
    document.querySelectorAll('.post-menu').forEach((menu) => menu.classList.add('hidden'));
  }
});

els.settingsBtn.addEventListener('click', () => {
  openSettings();
});
els.settingsCloseBtn.addEventListener('click', closeSettings);
els.settingsModal.addEventListener('click', (event) => {
  if (event.target === els.settingsModal) {
    closeSettings();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.settingsModal.classList.contains('hidden')) {
    closeSettings();
  }
});

els.themeSelect.addEventListener('change', () => {
  updateState((draft) => {
    draft.preferences.theme = els.themeSelect.value;
  }, { render: false });
  applyTheme(state.data.preferences.theme);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.data.preferences.theme === 'system') {
    applyTheme('system');
  }
});

els.settingsClearBtn.addEventListener('click', () => {
  void (async () => {
    const confirmed = await showModalMessage({
      title: 'Clear all memories',
      message: 'Delete all profile data and memories on this device?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
    });
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY_V3);
    localStorage.removeItem(STORAGE_KEY_V2);
    location.reload();
  })();
});

els.updateAppBtn.addEventListener('click', async () => {
  closeAccountMenu();
  const proceed = await showModalMessage({
    title: 'Update app',
    message: 'Download the latest app files now? Your saved memories will stay on this device.',
    confirmText: 'Update',
    cancelText: 'Cancel',
    showCancel: true,
  });
  if (!proceed) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if (registration.active) {
        registration.active.postMessage({ type: 'CLEAR_APP_CACHE' });
      }
    }
    await clearAppCaches();
  } catch {
    // ignore update/cache errors and continue to reload from network
  }

  const freshUrl = new URL(window.location.href);
  freshUrl.searchParams.set('update', Date.now().toString());
  window.location.replace(freshUrl.toString());
});

els.exportBtn.addEventListener('click', () => {
  closeAccountMenu();
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mybook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

function normalizeImportPayload(raw) {
  if (!raw || typeof raw !== 'object') return makeDefaultData();

  if (raw.version === 3 || raw.postsById || raw.postOrder) {
    return normalizeV3(raw);
  }

  if (Array.isArray(raw.posts)) {
    return migrateV2ToV3(raw);
  }

  return makeDefaultData();
}

function buildPostShareText(post) {
  const tags = (post.tags || []).map((tag) => `#${tag}`).join(' ');
  return [
    `${state.data.profile.name} shared a memory from mybook`,
    '',
    post.text || '(no text)',
    '',
    tags,
  ].filter(Boolean).join('\n');
}

function dataUrlToFile(dataUrl, fallbackName) {
  const [meta, base64Payload = ''] = String(dataUrl || '').split(',');
  const match = /data:([^;]+);base64/.exec(meta || '');
  const mime = match ? match[1] : 'application/octet-stream';
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fallbackName, { type: mime });
}

async function fetchAppGraphicFile() {
  const response = await fetch('icon-192.svg');
  const blob = await response.blob();
  return new File([blob], 'mybook-icon.svg', { type: blob.type || 'image/svg+xml' });
}

async function quickSharePost(post) {
  const shareText = buildPostShareText(post);
  const files = [];

  try {
    files.push(await fetchAppGraphicFile());
  } catch {
    // continue without app icon
  }

  (post.media || []).forEach((mediaItem, index) => {
    const fallbackName = mediaItem.name || `memory-media-${index + 1}.${mediaItem.type === 'video' ? 'mp4' : 'jpg'}`;
    files.push(dataUrlToFile(mediaItem.dataUrl, fallbackName));
  });

  const canShareFiles = files.length > 0 && navigator.canShare && navigator.canShare({ files });
  const payload = {
    title: 'mybook quick share',
    text: shareText,
    ...(canShareFiles ? { files } : {}),
  };

  if (navigator.share) {
    await navigator.share(payload);
    toast('Quick share opened.');
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareText);
    toast('Quick share copied as text (share sheet unavailable).', 'warn');
    return;
  }

  toast('Sharing is not available on this browser.', 'warn');
}

function buildMemorySharePayload(post) {
  return {
    kind: 'mybook-memory-share',
    version: 1,
    exportedAt: new Date().toISOString(),
    post: {
      ...normalizePost(post),
      id: post.id,
    },
  };
}

function downloadMemoryShare(post) {
  const payload = buildMemorySharePayload(post);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mybook-memory-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importMemoryShare(raw) {
  const incomingPost = raw && raw.post ? normalizePost(raw.post) : null;
  if (!incomingPost || (!incomingPost.text && incomingPost.media.length === 0)) return false;

  const incomingId = state.data.postsById[incomingPost.id] ? crypto.randomUUID() : incomingPost.id;
  const postToInsert = { ...incomingPost, id: incomingId };
  return updateState((draft) => {
    draft.postsById[postToInsert.id] = postToInsert;
    draft.postOrder.unshift(postToInsert.id);
  });
}

els.importFile.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (parsed && parsed.kind === 'mybook-memory-share') {
      const merged = importMemoryShare(parsed);
      if (!merged) {
        toast('Memory share import failed: invalid memory payload.', 'error');
      } else {
        toast('Memory imported into your feed.');
      }
      return;
    }

    const imported = normalizeImportPayload(parsed);

    state.data = imported;
    updateState((draft) => {
      draft.version = 3;
    });

    els.profileName.value = state.data.profile.name;
    els.profileBio.value = state.data.profile.bio;
    els.themeSelect.value = state.data.preferences.theme;
    applyTheme(state.data.preferences.theme);
    toast('Backup imported.');
  } catch {
    toast('Import failed: invalid JSON file.', 'error');
  } finally {
    event.target.value = '';
    closeAccountMenu();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function init() {
  await load();
  renderAvatar();
  renderPosts();
}

init();
