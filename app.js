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
      post.liked = !post.liked;
      save();
      renderPosts();
    });

    node.querySelector('.delete-post').addEventListener('click', () => {
      state.posts = state.posts.filter((p) => p.id !== post.id);
      save();
      renderPosts();
    });

    const commentList = node.querySelector('.comment-list');
    const comments = Array.isArray(post.comments) ? post.comments : [];
    comments.forEach((comment) => {
      const item = document.createElement('div');
      item.className = 'comment-item';

      const author = document.createElement('div');
      author.className = 'comment-author';
      author.textContent = state.profile.name;

      const text = document.createElement('div');
      text.className = 'comment-text';
      text.textContent = comment.text;

      item.append(author, text);
      commentList.append(item);
    });

    node.querySelector('.comment-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('.comment-input');
      const text = input.value.trim();
      if (!text) return;

      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push({
        id: crypto.randomUUID(),
        text,
        createdAt: new Date().toISOString(),
      });

      input.value = '';
      save();
      renderPosts();
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
