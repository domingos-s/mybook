const STORAGE_KEY = 'mybook_v2';

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
  clearBtn: document.getElementById('clearBtn'),
  updateAppBtn: document.getElementById('updateAppBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
};

const state = {
  profile: { name: '', bio: '', avatarDataUrl: '' },
  posts: [],
  pendingMedia: [],
};

async function clearAppCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('mybook-cache-')).map((key) => caches.delete(key)));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.profile = normalizeProfile(parsed.profile || {});
      state.posts = Array.isArray(parsed.posts) ? parsed.posts : [];
    } catch {
      // ignore malformed local data
    }
  }

  if (!state.profile.name) {
    const enteredName = prompt('Welcome to mybook. What is your name?')?.trim();
    state.profile.name = enteredName || 'Mybook User';
    save();
  }

  els.profileName.value = state.profile.name;
  els.profileBio.value = state.profile.bio || '';
  renderAvatar();
}

function normalizeProfile(profile = {}) {
  const avatarDataUrl =
    typeof profile.avatarDataUrl === 'string'
      ? profile.avatarDataUrl
      : (profile.avatarDataUrl && typeof profile.avatarDataUrl.dataUrl === 'string' ? profile.avatarDataUrl.dataUrl : '');

  return {
    ...state.profile,
    ...profile,
    avatarDataUrl,
  };
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
  if (state.profile.avatarDataUrl) {
    els.avatarInitials.textContent = '';
    els.avatarInitials.style.backgroundImage = `url("${state.profile.avatarDataUrl}")`;
  } else {
    els.avatarInitials.style.backgroundImage = '';
    els.avatarInitials.textContent = initials(state.profile.name);
  }
}

function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, type: file.type.startsWith('video/') ? 'video' : 'image', name: file.name });
    reader.onerror = reject;
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

function updatePost(postId, updater) {
  state.posts = state.posts.map((post) => (post.id === postId ? updater(post) : post));
  save();
  renderPosts();
}

function updateComment(postId, commentId, updater) {
  updatePost(postId, (post) => ({
    ...post,
    comments: (Array.isArray(post.comments) ? post.comments : []).map((comment) => (
      comment.id === commentId ? updater(comment) : comment
    )),
  }));
}

function deleteComment(postId, commentId) {
  updatePost(postId, (post) => ({
    ...post,
    comments: (Array.isArray(post.comments) ? post.comments : []).filter((comment) => comment.id !== commentId),
  }));
}

function renderPosts() {
  const q = els.searchInput.value.trim().toLowerCase();
  const order = els.sortSelect.value;

  let filtered = state.posts.filter((post) => {
    const hay = `${post.text}\n${(post.tags || []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });

  filtered = filtered.sort((a, b) => {
    const lhs = new Date(a.date || a.createdAt).getTime();
    const rhs = new Date(b.date || b.createdAt).getTime();
    return order === 'oldest' ? lhs - rhs : rhs - lhs;
  });

  els.feedList.innerHTML = '';
  els.emptyState.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach((post) => {
    const node = els.postTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.mini-avatar').textContent = initials(state.profile.name);
    node.querySelector('.post-author').textContent = state.profile.name;
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
      updatePost(post.id, (existing) => ({ ...existing, liked: !existing.liked }));
    });

    node.querySelector('.delete-post').addEventListener('click', () => {
      state.posts = state.posts.filter((p) => p.id !== post.id);
      save();
      renderPosts();
    });

    const postEditBtn = node.querySelector('.edit-post');
    const postEditCancelBtn = node.querySelector('.post-edit-cancel');
    const postEditSaveBtn = node.querySelector('.post-edit-save');

    postEditBtn.addEventListener('click', () => {
      postEditInput.value = post.text || '';
      postText.classList.add('hidden');
      postEditor.classList.remove('hidden');
      postEditInput.focus();
    });

    postEditCancelBtn.addEventListener('click', () => {
      postEditor.classList.add('hidden');
      postText.classList.remove('hidden');
    });

    postEditSaveBtn.addEventListener('click', () => {
      const nextText = postEditInput.value.trim();
      if (!nextText && (!Array.isArray(post.media) || post.media.length === 0)) return;

      updatePost(post.id, (existing) => ({
        ...existing,
        text: nextText,
        updatedAt: new Date().toISOString(),
      }));
    });

    const commentList = node.querySelector('.comment-list');
    const commentTemplate = commentList.querySelector('.comment-template');
    const comments = Array.isArray(post.comments) ? post.comments : [];
    comments.forEach((comment) => {
      const item = commentTemplate.cloneNode(true);
      item.classList.remove('comment-template', 'hidden');

      const author = item.querySelector('.comment-author');
      author.textContent = state.profile.name;

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

        updateComment(post.id, comment.id, (existingComment) => ({
          ...existingComment,
          text: nextText,
          updatedAt: new Date().toISOString(),
        }));
      });

      deleteBtn.addEventListener('click', () => {
        deleteComment(post.id, comment.id);
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

      updatePost(post.id, (existing) => ({
        ...existing,
        comments: [...(Array.isArray(existing.comments) ? existing.comments : []), newComment],
      }));

      input.value = '';
    });

    els.feedList.append(node);
  });
}

els.profileName.addEventListener('input', () => {
  state.profile.name = els.profileName.value.trim() || 'Mybook User';
  renderAvatar();
  save();
  renderPosts();
});

els.profileBio.addEventListener('input', () => {
  state.profile.bio = els.profileBio.value;
  save();
});

els.profilePicInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const avatar = await fileToDataUrl(file);
  state.profile.avatarDataUrl = avatar.dataUrl;
  save();
  renderAvatar();
});

els.postMedia.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []).slice(0, 8);
  state.pendingMedia = await Promise.all(files.map(fileToDataUrl));
  renderMediaPreview();
});

els.postForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = els.postText.value.trim();
  if (!text && state.pendingMedia.length === 0) return;

  state.posts.push({
    id: crypto.randomUUID(),
    text,
    date: els.postDate.value,
    createdAt: new Date().toISOString(),
    tags: els.postTags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
    media: state.pendingMedia,
    liked: false,
    comments: [],
  });

  els.postText.value = '';
  els.postTags.value = '';
  els.postDate.value = '';
  els.postMedia.value = '';
  state.pendingMedia = [];
  renderMediaPreview();
  save();
  renderPosts();
});

els.searchInput.addEventListener('input', renderPosts);
els.sortSelect.addEventListener('change', renderPosts);

els.clearBtn.addEventListener('click', () => {
  if (!confirm('Delete all profile data and memories on this device?')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});


els.updateAppBtn.addEventListener('click', async () => {
  const proceed = confirm('Download the latest app files now? Your saved memories will stay on this device.');
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
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mybook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importFile.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const imported = JSON.parse(text);
  if (!imported || typeof imported !== 'object') return;
  state.profile = normalizeProfile(imported.profile || {});
  state.posts = Array.isArray(imported.posts) ? imported.posts : [];
  save();
  load();
  renderPosts();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
renderPosts();
