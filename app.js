const STORAGE_KEY_V3 = 'mybook_v3';
const STORAGE_KEY_V2 = 'mybook_v2';
const MEDIA_DB_NAME = 'mybook_media_v1';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE = 'media';
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_OUTPUT_QUALITY = 0.82;
const MAX_VIDEO_FILE_BYTES = 12 * 1024 * 1024;
const MAX_MEDIA_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_MEDIA_BYTES = 250 * 1024 * 1024;
const STORAGE_HEADROOM_BYTES = 8 * 1024 * 1024;
const PROTOCOL_VERSION = 1;
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const els = {
  profileName: document.getElementById('profileName'),
  profileBio: document.getElementById('profileBio'),
  avatarInitials: document.getElementById('avatarInitials'),
  profilePicInput: document.getElementById('profilePicInput'),
  postForm: document.getElementById('postForm'),
  postText: document.getElementById('postText'),
  postDate: document.getElementById('postDate'),
  postTags: document.getElementById('postTags'),
  postPeopleBtn: document.getElementById('postPeopleBtn'),
  postPeopleMenu: document.getElementById('postPeopleMenu'),
  postMedia: document.getElementById('postMedia'),
  mediaPreview: document.getElementById('mediaPreview'),
  openComposeBtn: document.getElementById('openComposeBtn'),
  composeModal: document.getElementById('composeModal'),
  composeModalCloseBtn: document.getElementById('composeModalCloseBtn'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  openFilterBtn: document.getElementById('openFilterBtn'),
  feedList: document.getElementById('feedList'),
  emptyState: document.getElementById('emptyState'),
  addPersonBtn: document.getElementById('addPersonBtn'),
  peopleList: document.getElementById('peopleList'),
  personModal: document.getElementById('personModal'),
  personModalCloseBtn: document.getElementById('personModalCloseBtn'),
  personNameInput: document.getElementById('personNameInput'),
  personRelationshipInput: document.getElementById('personRelationshipInput'),
  personPicInput: document.getElementById('personPicInput'),
  deletePersonBtn: document.getElementById('deletePersonBtn'),
  savePersonBtn: document.getElementById('savePersonBtn'),
  filterModal: document.getElementById('filterModal'),
  filterModalCloseBtn: document.getElementById('filterModalCloseBtn'),
  tagFilterInput: document.getElementById('tagFilterInput'),
  personFilterList: document.getElementById('personFilterList'),
  applyFilterBtn: document.getElementById('applyFilterBtn'),
  clearFilterBtn: document.getElementById('clearFilterBtn'),
  postTemplate: document.getElementById('postTemplate'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsPanel: document.querySelector('#settingsModal .settings-panel'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  themeSelect: document.getElementById('themeSelect'),
  settingsClearBtn: document.getElementById('settingsClearBtn'),
  updateAppBtn: document.getElementById('updateAppBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importMemoryFile: document.getElementById('importMemoryFile'),
  importFile: document.getElementById('importFile'),
  connectEnabled: document.getElementById('connectEnabled'),
  connectDisplayName: document.getElementById('connectDisplayName'),
  signalingEndpoint: document.getElementById('signalingEndpoint'),
  startInviteBtn: document.getElementById('startInviteBtn'),
  startJoinBtn: document.getElementById('startJoinBtn'),
  inviteCodeInput: document.getElementById('inviteCodeInput'),
  applyCodeBtn: document.getElementById('applyCodeBtn'),
  directNotesList: document.getElementById('directNotesList'),
  connectStatus: document.getElementById('connectStatus'),
  appLockEnabled: document.getElementById('appLockEnabled'),
  appLockPasswordBtn: document.getElementById('appLockPasswordBtn'),
  accountMenuBtn: document.getElementById('accountMenuBtn'),
  accountMenu: document.getElementById('accountMenu'),
  lockScreen: document.getElementById('lockScreen'),
  lockForm: document.getElementById('lockForm'),
  lockPasswordInput: document.getElementById('lockPasswordInput'),
  lockError: document.getElementById('lockError'),
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
  mediaDb: null,
  activeObjectUrls: new Set(),
  selectedPostPeople: [],
  activeFilters: { tags: [], peopleIds: [] },
  pendingPersonAvatarDataUrl: '',
  editingPersonId: '',
  connectionRuntime: {
    mode: '',
    signalingRole: '',
    sessionId: '',
    pc: null,
    dc: null,
    remotePeerId: '',
    pollTimer: null,
  },
};

function makeDefaultData() {
  return {
    version: 3,
    profile: { name: '', bio: '', avatarDataUrl: '' },
    people: [],
    postsById: {},
    postOrder: [],
    preferences: {
      theme: 'system',
      security: {
        lockEnabled: false,
        passwordHash: '',
      },
    },
    connections: {
      enabled: false,
      peerId: crypto.randomUUID(),
      displayName: '',
      signalingEndpoint: '',
      peersById: {},
      directNotesByPeerId: {},
    },
  };
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function openMediaDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('indexeddb-unavailable'));
  if (state.mediaDb) return Promise.resolve(state.mediaDb);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    request.onerror = () => reject(request.error || new Error('indexeddb-open-failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'mediaId' });
      }
    };
    request.onsuccess = () => {
      state.mediaDb = request.result;
      resolve(state.mediaDb);
    };
  });
}

function runMediaStore(mode, worker) {
  return openMediaDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, mode);
    const store = tx.objectStore(MEDIA_STORE);
    let settled = false;
    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const result = worker(store, tx);
    if (result && typeof result.then === 'function') {
      result.then(finishResolve).catch(finishReject);
    } else {
      tx.oncomplete = () => finishResolve(result);
    }
    tx.onerror = () => finishReject(tx.error || new Error('indexeddb-transaction-failed'));
    tx.onabort = () => finishReject(tx.error || new Error('indexeddb-transaction-aborted'));
  }));
}

async function getMediaUsageBytes() {
  return runMediaStore('readonly', (store) => new Promise((resolve, reject) => {
    let total = 0;
    const request = store.openCursor();
    request.onerror = () => reject(request.error || new Error('indexeddb-cursor-failed'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(total);
        return;
      }
      total += Number(cursor.value?.size || cursor.value?.blob?.size || 0);
      cursor.continue();
    };
  }));
}

async function warnIfStorageNearLimit(incomingBytes = 0) {
  if (!navigator.storage?.estimate) return;
  try {
    const estimate = await navigator.storage.estimate();
    const used = Number(estimate.usage || 0);
    const quota = Number(estimate.quota || 0);
    if (!quota) return;
    const projected = used + incomingBytes + STORAGE_HEADROOM_BYTES;
    if (projected >= quota) {
      toast('Storage is nearly full. Delete old memories or media before adding more.', 'warn');
    }
  } catch {
    // ignore estimate failures
  }
}

async function assertMediaWriteCapacity(incomingBytes = 0) {
  if (incomingBytes > MAX_MEDIA_FILE_BYTES) throw new Error('media-too-large');
  const usedMediaBytes = await getMediaUsageBytes();
  if (usedMediaBytes + incomingBytes > MAX_TOTAL_MEDIA_BYTES) throw new Error('media-budget-exceeded');
  await warnIfStorageNearLimit(incomingBytes);
}

async function putMediaBlob({ mediaId, blob, type, name }) {
  const resolvedBlob = blob instanceof Blob ? blob : null;
  if (!resolvedBlob) throw new Error('invalid-media-blob');
  await assertMediaWriteCapacity(resolvedBlob.size);
  const nextMediaId = typeof mediaId === 'string' && mediaId ? mediaId : crypto.randomUUID();
  const entry = {
    mediaId: nextMediaId,
    blob: resolvedBlob,
    type: type === 'video' ? 'video' : 'image',
    name: typeof name === 'string' && name ? name : (type === 'video' ? 'video' : 'image'),
    size: resolvedBlob.size,
    createdAt: new Date().toISOString(),
  };
  await runMediaStore('readwrite', (store) => {
    store.put(entry);
  });
  return {
    mediaId: entry.mediaId,
    type: entry.type,
    name: entry.name,
  };
}

async function getMediaBlob(mediaId) {
  if (typeof mediaId !== 'string' || !mediaId) return null;
  return runMediaStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.get(mediaId);
    request.onerror = () => reject(request.error || new Error('indexeddb-get-failed'));
    request.onsuccess = () => resolve(request.result || null);
  }));
}

function revokeAllObjectUrls() {
  state.activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.activeObjectUrls.clear();
}

async function persistPostMediaRefs(mediaItems = []) {
  const refs = [];
  for (const item of mediaItems) {
    if (!item || (item.type !== 'image' && item.type !== 'video')) continue;
    if (item.mediaId) {
      refs.push({
        mediaId: item.mediaId,
        type: item.type,
        name: item.name || (item.type === 'video' ? 'video' : 'image'),
      });
      continue;
    }
    if (typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(item.dataUrl);
      const ref = await putMediaBlob({
        blob,
        type: item.type,
        name: item.name,
      });
      refs.push(ref);
    }
  }
  return refs;
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

function getSecurityPrefs() {
  const security = state.data?.preferences?.security || {};
  return {
    lockEnabled: Boolean(security.lockEnabled),
    passwordHash: typeof security.passwordHash === 'string' ? security.passwordHash : '',
  };
}

function syncSecurityControls() {
  const { lockEnabled, passwordHash } = getSecurityPrefs();
  els.appLockEnabled.checked = lockEnabled && Boolean(passwordHash);
  els.appLockPasswordBtn.textContent = passwordHash ? 'Change password' : 'Set password';
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyLockPassword(input) {
  const { passwordHash } = getSecurityPrefs();
  if (!passwordHash) return false;
  const inputHash = await sha256Hex(input);
  return inputHash === passwordHash;
}

function lockUi() {
  document.body.classList.add('app-locked');
}

function unlockUi() {
  document.body.classList.remove('app-locked');
}

async function promptNewLockPassword() {
  const first = await showModalMessage({
    title: 'Set app password',
    message: 'Create a password for unlocking this app on this device.',
    confirmText: 'Next',
    cancelText: 'Cancel',
    showCancel: true,
    input: { placeholder: 'New password', defaultValue: '' },
  });
  if (!first) return '';

  const second = await showModalMessage({
    title: 'Confirm password',
    message: 'Enter the same password again.',
    confirmText: 'Save password',
    cancelText: 'Cancel',
    showCancel: true,
    input: { placeholder: 'Confirm password', defaultValue: '' },
  });

  if (!second) return '';
  if (first !== second) {
    toast('Passwords did not match.', 'warn');
    return '';
  }
  return first;
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
  const security = preferences.security && typeof preferences.security === 'object' ? preferences.security : {};

  return {
    ...makeDefaultData().preferences,
    ...(preferences && typeof preferences === 'object' ? preferences : {}),
    theme: normalizedTheme,
    security: {
      lockEnabled: Boolean(security.lockEnabled),
      passwordHash: typeof security.passwordHash === 'string' ? security.passwordHash : '',
    },
  };
}


function normalizeConnections(connections = {}) {
  const incomingPeers = connections.peersById && typeof connections.peersById === 'object' ? connections.peersById : {};
  const incomingDirectNotes = connections.directNotesByPeerId && typeof connections.directNotesByPeerId === 'object'
    ? connections.directNotesByPeerId
    : {};
  const peersById = {};
  const directNotesByPeerId = {};
  const identity = connections.identity && typeof connections.identity === 'object' ? connections.identity : {};

  Object.keys(incomingPeers).forEach((peerId) => {
    const peer = incomingPeers[peerId] || {};
    peersById[peerId] = {
      peerId,
      displayName: typeof peer.displayName === 'string' ? peer.displayName : '',
      trustState: ['pending', 'trusted', 'blocked'].includes(peer.trustState) ? peer.trustState : 'pending',
      lastSyncAt: typeof peer.lastSyncAt === 'string' ? peer.lastSyncAt : '',
      publicKeyJwk: peer.publicKeyJwk && typeof peer.publicKeyJwk === 'object' ? peer.publicKeyJwk : null,
    };
  });

  Object.keys(incomingDirectNotes).forEach((peerId) => {
    const thread = incomingDirectNotes[peerId] && typeof incomingDirectNotes[peerId] === 'object' ? incomingDirectNotes[peerId] : {};
    const incomingMessages = Array.isArray(thread.messages) ? thread.messages : [];
    directNotesByPeerId[peerId] = {
      threadId: typeof thread.threadId === 'string' && thread.threadId ? thread.threadId : `direct-${peerId}`,
      type: 'direct-notes',
      peerId,
      messages: incomingMessages.map((message) => ({
        id: typeof message.id === 'string' && message.id ? message.id : crypto.randomUUID(),
        text: typeof message.text === 'string' ? message.text : '',
        createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
        authorId: typeof message.authorId === 'string' ? message.authorId : '',
        authorName: typeof message.authorName === 'string' ? message.authorName : '',
        authorAvatar: typeof message.authorAvatar === 'string' ? message.authorAvatar : '',
      })).filter((message) => message.text.trim()),
    };
  });

  return {
    enabled: Boolean(connections.enabled),
    peerId: typeof connections.peerId === 'string' && connections.peerId ? connections.peerId : crypto.randomUUID(),
    displayName: typeof connections.displayName === 'string' ? connections.displayName : '',
    signalingEndpoint: typeof connections.signalingEndpoint === 'string' ? connections.signalingEndpoint : '',
    peersById,
    directNotesByPeerId,
    identity: {
      publicKeyJwk: identity.publicKeyJwk && typeof identity.publicKeyJwk === 'object' ? identity.publicKeyJwk : null,
      privateKeyJwk: identity.privateKeyJwk && typeof identity.privateKeyJwk === 'object' ? identity.privateKeyJwk : null,
      generatedAt: typeof identity.generatedAt === 'string' ? identity.generatedAt : '',
    },
  };
}

function normalizeComment(comment = {}) {
  return {
    id: typeof comment.id === 'string' ? comment.id : crypto.randomUUID(),
    text: typeof comment.text === 'string' ? comment.text : '',
    createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : new Date().toISOString(),
    updatedAt: typeof comment.updatedAt === 'string' ? comment.updatedAt : undefined,
    authorId: typeof comment.authorId === 'string' ? comment.authorId : '',
    authorName: typeof comment.authorName === 'string' ? comment.authorName : '',
    authorAvatar: typeof comment.authorAvatar === 'string' ? comment.authorAvatar : '',
  };
}

function normalizeReactions(reactions, liked) {
  const normalized = {};
  if (reactions && typeof reactions === 'object' && !Array.isArray(reactions)) {
    Object.keys(reactions).forEach((actorId) => {
      const reaction = reactions[actorId] && typeof reactions[actorId] === 'object' ? reactions[actorId] : {};
      if (!actorId) return;
      normalized[actorId] = {
        actorId,
        authorName: typeof reaction.authorName === 'string' ? reaction.authorName : '',
        authorAvatar: typeof reaction.authorAvatar === 'string' ? reaction.authorAvatar : '',
        createdAt: typeof reaction.createdAt === 'string' ? reaction.createdAt : new Date().toISOString(),
      };
    });
  } else if (liked) {
    normalized.self = {
      actorId: 'self',
      authorName: 'You',
      authorAvatar: '',
      createdAt: new Date().toISOString(),
    };
  }
  return normalized;
}

function normalizePost(post = {}) {
  const importedFrom = post.importedFrom && typeof post.importedFrom === 'object' ? post.importedFrom : null;
  const normalizedMedia = Array.isArray(post.media)
    ? post.media
      .map((m) => {
        if (!m || (m.type !== 'image' && m.type !== 'video')) return null;
        if (typeof m.mediaId === 'string' && m.mediaId) {
          return {
            mediaId: m.mediaId,
            type: m.type,
            name: typeof m.name === 'string' ? m.name : (m.type === 'video' ? 'video' : 'image'),
          };
        }
        if (typeof m.dataUrl === 'string' && m.dataUrl.startsWith('data:')) {
          return {
            mediaId: '',
            dataUrl: m.dataUrl,
            type: m.type,
            name: typeof m.name === 'string' ? m.name : (m.type === 'video' ? 'video' : 'image'),
          };
        }
        return null;
      })
      .filter(Boolean)
    : [];

  return {
    id: typeof post.id === 'string' ? post.id : crypto.randomUUID(),
    text: typeof post.text === 'string' ? post.text : '',
    date: typeof post.date === 'string' ? post.date : '',
    createdAt: typeof post.createdAt === 'string' ? post.createdAt : new Date().toISOString(),
    updatedAt: typeof post.updatedAt === 'string' ? post.updatedAt : undefined,
    tags: Array.isArray(post.tags) ? post.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean) : [],
    peopleIds: Array.isArray(post.peopleIds) ? post.peopleIds.filter((id) => typeof id === 'string') : [],
    media: normalizedMedia,
    reactions: normalizeReactions(post.reactions, post.liked),
    comments: Array.isArray(post.comments) ? post.comments.map(normalizeComment).filter((c) => c.text.trim()) : [],
    importedFrom: importedFrom
      ? {
        senderId: typeof importedFrom.senderId === 'string' ? importedFrom.senderId : '',
        displayName: typeof importedFrom.displayName === 'string' ? importedFrom.displayName : '',
        exportedAt: typeof importedFrom.exportedAt === 'string' ? importedFrom.exportedAt : '',
      }
      : null,
  };
}

function normalizeV3(raw = {}) {
  const normalized = makeDefaultData();
  normalized.profile = normalizeProfile(raw.profile || {});
  normalized.people = Array.isArray(raw.people) ? raw.people.map((person) => ({
    id: typeof person.id === 'string' ? person.id : crypto.randomUUID(),
    name: typeof person.name === 'string' ? person.name : '',
    relationship: typeof person.relationship === 'string' ? person.relationship : '',
    avatarDataUrl: typeof person.avatarDataUrl === 'string' ? person.avatarDataUrl : '',
  })).filter((person) => person.name.trim()) : [];
  normalized.preferences = normalizePreferences(raw.preferences || {});
  normalized.connections = normalizeConnections(raw.connections || {});

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
  els.connectEnabled.checked = Boolean(state.data.connections.enabled);
  els.connectDisplayName.value = state.data.connections.displayName || state.data.profile.name || '';
  els.signalingEndpoint.value = state.data.connections.signalingEndpoint || '';
  syncSecurityControls();
  renderDirectNotesList();
  renderConnectionStatus(state.data.connections.enabled ? 'Connection feature is enabled.' : 'Connection disabled.');
}

async function migrateLegacyMediaToIndexedDb() {
  const postIds = state.data.postOrder.filter((id) => state.data.postsById[id]);
  for (const postId of postIds) {
    const post = state.data.postsById[postId];
    const needsMigration = (post.media || []).some((item) => item && typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:'));
    if (!needsMigration) continue;

    try {
      const refs = await persistPostMediaRefs(post.media || []);
      updateState((draft) => {
        if (!draft.postsById[postId]) return;
        draft.postsById[postId].media = refs;
        draft.postsById[postId].updatedAt = new Date().toISOString();
      }, { render: false });
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (error) {
      if (error && (error.message === 'media-budget-exceeded' || error.message === 'media-too-large')) {
        toast('Some older media could not be migrated due to storage limits.', 'warn');
        return;
      }
      toast('Some older media could not be migrated on this device.', 'warn');
      return;
    }
  }
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0].toUpperCase())
    .join('') || 'M';
}

function getLocalActorMeta() {
  return {
    actorId: state.data.connections.peerId || 'self',
    authorName: state.data.connections.displayName || state.data.profile.name || 'Mybook User',
    authorAvatar: state.data.profile.avatarDataUrl || '',
  };
}

function resolveActorName(actorId, fallbackName = '') {
  if (!actorId || actorId === 'self') return state.data.connections.displayName || state.data.profile.name || 'Mybook User';
  if (actorId === state.data.connections.peerId) return state.data.connections.displayName || state.data.profile.name || 'Mybook User';
  const peer = state.data.connections.peersById[actorId];
  return fallbackName || peer?.displayName || actorId;
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
  const d = parsePostDate(dateStr) || new Date();
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function parsePostDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const localDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (localDateMatch) {
    const [, year, month, day] = localDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPostTimestamp(post) {
  const dateCandidate = parsePostDate(post.date);
  if (dateCandidate) return dateCandidate.getTime();
  return new Date(post.createdAt).getTime();
}

function processMediaFile(file) {
  if (file.type.startsWith('image/')) {
    return optimizeImageBlob(file);
  }

  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      return Promise.reject(new Error('video-too-large'));
    }
    return Promise.resolve({ blob: file, type: 'video', name: file.name });
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

function optimizeImageBlob(file) {
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
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('image-encode-failed'));
            return;
          }
          resolve({ blob, type: 'image', name: file.name });
        }, 'image/jpeg', IMAGE_OUTPUT_QUALITY);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file) {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('video-too-large'));
  return optimizeImageFile(file);
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
      const searchMatch = hay.includes(q);
      const tagFilterMatch = state.activeFilters.tags.length === 0
        || state.activeFilters.tags.some((tag) => (post.tags || []).map((t) => t.toLowerCase()).includes(tag));
      const peopleMatch = state.activeFilters.peopleIds.length === 0
        || state.activeFilters.peopleIds.some((id) => (post.peopleIds || []).includes(id));
      return searchMatch && tagFilterMatch && peopleMatch;
    });

  return posts.sort((a, b) => {
    const lhs = getPostTimestamp(a);
    const rhs = getPostTimestamp(b);
    return order === 'oldest' ? lhs - rhs : rhs - lhs;
  });
}

function renderPeopleList() {
  els.peopleList.innerHTML = '';
  if (!state.data.people.length) {
    els.peopleList.innerHTML = '<p class="people-empty">No people yet.</p>';
    return;
  }

  state.data.people.forEach((person) => {
    const row = document.createElement('div');
    row.className = 'person-row';
    row.tabIndex = 0;
    const avatar = document.createElement('div');
    avatar.className = 'person-avatar';
    if (person.avatarDataUrl) avatar.style.backgroundImage = `url("${person.avatarDataUrl}")`;
    else avatar.textContent = initials(person.name);
    const text = document.createElement('div');
    text.innerHTML = `<strong>${person.name}</strong><span>${person.relationship}</span>`;
    row.append(avatar, text);
    let longPressTimer = 0;
    let longPressHandled = false;
    const clearLongPressTimer = () => {
      if (longPressTimer) {
        window.clearTimeout(longPressTimer);
        longPressTimer = 0;
      }
    };
    const startLongPress = () => {
      clearLongPressTimer();
      longPressHandled = false;
      longPressTimer = window.setTimeout(() => {
        longPressHandled = true;
        openPersonModal(person);
      }, 500);
    };
    row.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      startLongPress();
    });
    row.addEventListener('pointerup', clearLongPressTimer);
    row.addEventListener('pointercancel', clearLongPressTimer);
    row.addEventListener('pointerleave', clearLongPressTimer);
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      clearLongPressTimer();
      openPersonModal(person);
    });
    row.addEventListener('click', (event) => {
      if (longPressHandled) {
        event.preventDefault();
        longPressHandled = false;
      }
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPersonModal(person);
      }
    });
    els.peopleList.append(row);
  });
}

function openPersonModal(person = null) {
  state.pendingPersonAvatarDataUrl = person?.avatarDataUrl || '';
  state.editingPersonId = person?.id || '';
  els.personNameInput.value = person?.name || '';
  els.personRelationshipInput.value = person?.relationship || '';
  els.personPicInput.value = '';
  const title = document.getElementById('personModalTitle');
  title.textContent = person ? 'Edit person' : 'Add person';
  els.savePersonBtn.textContent = person ? 'Save changes' : 'Save person';
  els.deletePersonBtn.classList.toggle('hidden', !person);
  openModalOverlay(els.personModal);
}

function renderPostPeopleMenu() {
  els.postPeopleMenu.innerHTML = '';
  if (!state.data.people.length) {
    els.postPeopleMenu.innerHTML = '<div class="people-empty">Add people in your profile first.</div>';
    return;
  }
  state.data.people.forEach((person) => {
    const label = document.createElement('label');
    label.className = 'people-check';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedPostPeople.includes(person.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedPostPeople.push(person.id);
      else state.selectedPostPeople = state.selectedPostPeople.filter((id) => id !== person.id);
      state.selectedPostPeople = [...new Set(state.selectedPostPeople)];
      els.postPeopleBtn.textContent = state.selectedPostPeople.length ? `Tagged (${state.selectedPostPeople.length})` : 'Tag people';
    });
    label.append(checkbox, document.createTextNode(`${person.name} (${person.relationship})`));
    els.postPeopleMenu.append(label);
  });
}

function renderFilterPeopleList() {
  els.personFilterList.innerHTML = '';
  state.data.people.forEach((person) => {
    const label = document.createElement('label');
    label.className = 'people-check';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.activeFilters.peopleIds.includes(person.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.activeFilters.peopleIds.push(person.id);
      else state.activeFilters.peopleIds = state.activeFilters.peopleIds.filter((id) => id !== person.id);
      state.activeFilters.peopleIds = [...new Set(state.activeFilters.peopleIds)];
    });
    label.append(checkbox, document.createTextNode(`${person.name} (${person.relationship})`));
    els.personFilterList.append(label);
  });
}

function openSettings() {
  closeAccountMenu();
  openModalOverlay(els.settingsModal);
}

function closeSettings() {
  closeModalOverlay(els.settingsModal);
}

function openComposeModal() {
  renderPeopleList();
  renderPostPeopleMenu();
  openModalOverlay(els.composeModal);
}

function closeComposeModal() {
  closeModalOverlay(els.composeModal);
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
  revokeAllObjectUrls();

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
    const authorEl = node.querySelector('.post-author');
    const senderMeta = post.importedFrom;
    authorEl.textContent = state.data.profile.name;
    if (senderMeta?.senderId) {
      const senderLine = document.createElement('div');
      senderLine.className = 'post-imported-from';
      const senderDate = senderMeta.exportedAt ? ` • ${formatDate(senderMeta.exportedAt)}` : '';
      senderLine.textContent = `Shared by ${senderMeta.displayName || 'Unknown'} (${senderMeta.senderId})${senderDate}`;
      authorEl.append(document.createElement('br'), senderLine);
    }
    node.querySelector('.post-date').textContent = formatDate(post.date || post.createdAt);
    node.querySelector('.post-text').textContent = post.text;

    const postText = node.querySelector('.post-text');
    const postEditor = node.querySelector('.post-edit-editor');
    const postEditInput = node.querySelector('.post-edit-input');
    const postEditDateInput = node.querySelector('.post-edit-date-input');

    const mediaHost = node.querySelector('.post-media');
    void renderPostMedia(post, mediaHost);

    const tagList = node.querySelector('.tag-list');
    (post.tags || []).forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${tag}`;
      tagList.append(span);
    });
    (post.peopleIds || []).forEach((personId) => {
      const person = state.data.people.find((p) => p.id === personId);
      if (!person) return;
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `@${person.name}`;
      tagList.append(span);
    });

    const likeBtn = node.querySelector('.like-btn');
    const actor = getLocalActorMeta();
    const reactions = post.reactions && typeof post.reactions === 'object' ? post.reactions : {};
    const reactedByMe = Boolean(reactions[actor.actorId] || reactions.self);
    likeBtn.classList.toggle('active', reactedByMe);
    const reactionActors = Object.values(reactions).map((reaction) => resolveActorName(reaction.actorId, reaction.authorName)).filter(Boolean);
    likeBtn.textContent = reactionActors.length ? `👍 ${reactionActors.join(', ')}` : '👍 Like';
    likeBtn.addEventListener('click', () => {
      updateState((draft) => {
        const draftPost = draft.postsById[post.id];
        const draftReactions = draftPost.reactions && typeof draftPost.reactions === 'object' ? draftPost.reactions : {};
        if (draftReactions[actor.actorId] || draftReactions.self) {
          delete draftReactions[actor.actorId];
          delete draftReactions.self;
        } else {
          draftReactions[actor.actorId] = {
            actorId: actor.actorId,
            authorName: actor.authorName,
            authorAvatar: actor.authorAvatar,
            createdAt: new Date().toISOString(),
          };
        }
        draftPost.reactions = draftReactions;
      });
    });

    node.querySelector('.comment-btn').addEventListener('click', () => {
      node.querySelector('.comment-input').focus();
    });

    node.querySelector('.share-btn').addEventListener('click', async () => {
      const choice = await showModalMessage({
        title: 'Share memory',
        message: 'Quick share includes text and uploaded media. Memory share exports JSON that another mybook can import.',
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

      await downloadMemoryShare(post);
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
      postEditDateInput.value = post.date || '';
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
      const nextDate = postEditDateInput.value;
      if (!nextText && (!Array.isArray(post.media) || post.media.length === 0)) return;

      const updated = updateState((draft) => {
        draft.postsById[post.id].text = nextText;
        draft.postsById[post.id].date = nextDate;
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
      author.textContent = `${resolveActorName(comment.authorId, comment.authorName)} • ${formatDate(comment.createdAt)}`;

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
        authorId: actor.actorId,
        authorName: actor.authorName,
        authorAvatar: actor.authorAvatar,
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

async function renderPostMedia(post, mediaHost) {
  const mediaItems = Array.isArray(post.media) ? post.media : [];
  for (const mediaRef of mediaItems) {
    const mediaEl = document.createElement(mediaRef.type === 'video' ? 'video' : 'img');
    if (mediaRef?.mediaId) {
      const stored = await getMediaBlob(mediaRef.mediaId);
      if (!stored?.blob) continue;
      const objectUrl = URL.createObjectURL(stored.blob);
      state.activeObjectUrls.add(objectUrl);
      mediaEl.src = objectUrl;
    } else if (mediaRef?.dataUrl) {
      mediaEl.src = mediaRef.dataUrl;
    } else {
      continue;
    }
    if (mediaRef.type === 'video') mediaEl.controls = true;
    mediaHost.append(mediaEl);
  }
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
    const processed = await Promise.all(files.map(processMediaFile));
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

els.postForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = els.postText.value.trim();
  if (!text && state.pendingMedia.length === 0) return;

  let mediaRefs = [];
  try {
    mediaRefs = await Promise.all(state.pendingMedia.map((item) => putMediaBlob(item)));
  } catch (error) {
    if (error && error.message === 'media-budget-exceeded') {
      toast('Media storage limit reached. Remove older memories with media first.', 'warn');
    } else if (error && error.message === 'media-too-large') {
      toast('One file is too large. Keep each media file under 12 MB.', 'warn');
    } else {
      toast('Could not store media on this device. Try smaller files.', 'error');
    }
    return;
  }

  const post = normalizePost({
    id: crypto.randomUUID(),
    text,
    date: els.postDate.value,
    createdAt: new Date().toISOString(),
    tags: els.postTags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
    peopleIds: state.selectedPostPeople,
    media: mediaRefs,
    reactions: {},
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
  state.selectedPostPeople = [];
  els.postPeopleBtn.textContent = 'Tag people';
  els.postPeopleMenu.classList.add('hidden');
  renderMediaPreview();
  closeComposeModal();
});

els.searchInput.addEventListener('input', renderPosts);
els.sortSelect.addEventListener('change', renderPosts);
els.postPeopleBtn.addEventListener('click', () => {
  const isHidden = els.postPeopleMenu.classList.contains('hidden');
  renderPostPeopleMenu();
  els.postPeopleMenu.classList.toggle('hidden', !isHidden);
  els.postPeopleBtn.setAttribute('aria-expanded', String(isHidden));
});

els.addPersonBtn.addEventListener('click', () => {
  openPersonModal();
});

els.openComposeBtn.addEventListener('click', openComposeModal);
els.composeModalCloseBtn.addEventListener('click', closeComposeModal);
els.composeModal.addEventListener('click', (event) => {
  if (event.target === els.composeModal) closeComposeModal();
});

els.personModalCloseBtn.addEventListener('click', () => closeModalOverlay(els.personModal));
els.personModal.addEventListener('click', (event) => {
  if (event.target === els.personModal) closeModalOverlay(els.personModal);
});

els.personPicInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const avatar = await fileToDataUrl(file);
    state.pendingPersonAvatarDataUrl = avatar.dataUrl;
  } catch {
    toast('Could not process that person photo.', 'error');
  }
});

els.savePersonBtn.addEventListener('click', () => {
  const name = els.personNameInput.value.trim();
  const relationship = els.personRelationshipInput.value.trim();
  if (!name || !relationship) {
    toast('Add both name and relationship.', 'warn');
    return;
  }
  updateState((draft) => {
    if (state.editingPersonId) {
      const person = draft.people.find((item) => item.id === state.editingPersonId);
      if (!person) return;
      person.name = name;
      person.relationship = relationship;
      person.avatarDataUrl = state.pendingPersonAvatarDataUrl;
      return;
    }
    draft.people.push({
      id: crypto.randomUUID(),
      name,
      relationship,
      avatarDataUrl: state.pendingPersonAvatarDataUrl,
    });
  }, { render: false });
  renderPeopleList();
  renderPostPeopleMenu();
  renderFilterPeopleList();
  state.editingPersonId = '';
  closeModalOverlay(els.personModal);
});

els.deletePersonBtn.addEventListener('click', async () => {
  if (!state.editingPersonId) return;
  const confirmed = await showModalMessage({
    title: 'Delete person',
    message: 'Remove this person from your People list and untag them from all memories?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    showCancel: true,
  });
  if (!confirmed) return;
  const personId = state.editingPersonId;
  updateState((draft) => {
    draft.people = draft.people.filter((person) => person.id !== personId);
    Object.values(draft.postsById).forEach((post) => {
      post.peopleIds = (post.peopleIds || []).filter((id) => id !== personId);
    });
  }, { render: false });
  state.selectedPostPeople = state.selectedPostPeople.filter((id) => id !== personId);
  state.activeFilters.peopleIds = state.activeFilters.peopleIds.filter((id) => id !== personId);
  state.editingPersonId = '';
  closeModalOverlay(els.personModal);
  renderPeopleList();
  renderPostPeopleMenu();
  renderFilterPeopleList();
  renderPosts();
});

els.openFilterBtn.addEventListener('click', () => {
  els.tagFilterInput.value = state.activeFilters.tags.join(', ');
  renderFilterPeopleList();
  openModalOverlay(els.filterModal);
});
els.filterModalCloseBtn.addEventListener('click', () => closeModalOverlay(els.filterModal));
els.filterModal.addEventListener('click', (event) => {
  if (event.target === els.filterModal) closeModalOverlay(els.filterModal);
});
els.applyFilterBtn.addEventListener('click', () => {
  state.activeFilters.tags = els.tagFilterInput.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  closeModalOverlay(els.filterModal);
  renderPosts();
});
els.clearFilterBtn.addEventListener('click', () => {
  state.activeFilters = { tags: [], peopleIds: [] };
  els.tagFilterInput.value = '';
  renderFilterPeopleList();
  renderPosts();
});

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
  if (!event.target.closest('.people-dropdown-wrap')) {
    els.postPeopleMenu.classList.add('hidden');
    els.postPeopleBtn.setAttribute('aria-expanded', 'false');
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
  if (event.key === 'Escape' && !els.composeModal.classList.contains('hidden')) {
    closeComposeModal();
  }
});


els.connectEnabled.addEventListener('change', () => {
  updateState((draft) => {
    draft.connections.enabled = els.connectEnabled.checked;
  }, { render: false });
  renderConnectionStatus(els.connectEnabled.checked ? 'Connection feature enabled.' : 'Connection disabled.');
});

els.connectDisplayName.addEventListener('input', () => {
  updateState((draft) => {
    draft.connections.displayName = els.connectDisplayName.value.trim();
  }, { render: false });
});

els.signalingEndpoint.addEventListener('input', () => {
  updateState((draft) => {
    draft.connections.signalingEndpoint = els.signalingEndpoint.value.trim();
  }, { render: false });
});

els.startInviteBtn.addEventListener('click', () => {
  void beginInviteFlow();
});

els.startJoinBtn.addEventListener('click', () => {
  void beginJoinFlow();
});

els.applyCodeBtn.addEventListener('click', () => {
  void applyPairingCode();
});

els.themeSelect.addEventListener('change', () => {
  updateState((draft) => {
    draft.preferences.theme = els.themeSelect.value;
  }, { render: false });
  applyTheme(state.data.preferences.theme);
});

els.appLockPasswordBtn.addEventListener('click', () => {
  void (async () => {
    const nextPassword = await promptNewLockPassword();
    if (!nextPassword) return;
    const hash = await sha256Hex(nextPassword);
    updateState((draft) => {
      draft.preferences.security.lockEnabled = true;
      draft.preferences.security.passwordHash = hash;
    }, { render: false });
    syncSecurityControls();
    toast('App lock password saved.');
  })();
});

els.appLockEnabled.addEventListener('change', () => {
  void (async () => {
    const wantsEnabled = els.appLockEnabled.checked;
    const security = getSecurityPrefs();

    if (wantsEnabled && !security.passwordHash) {
      const nextPassword = await promptNewLockPassword();
      if (!nextPassword) {
        syncSecurityControls();
        return;
      }
      const hash = await sha256Hex(nextPassword);
      updateState((draft) => {
        draft.preferences.security.lockEnabled = true;
        draft.preferences.security.passwordHash = hash;
      }, { render: false });
      syncSecurityControls();
      toast('App lock enabled.');
      return;
    }

    if (!wantsEnabled && security.lockEnabled) {
      const entered = await showModalMessage({
        title: 'Disable app lock',
        message: 'Enter your current password to disable app lock.',
        confirmText: 'Disable',
        cancelText: 'Cancel',
        showCancel: true,
        input: { placeholder: 'Current password', defaultValue: '' },
      });
      if (!entered) {
        syncSecurityControls();
        return;
      }
      const valid = await verifyLockPassword(entered);
      if (!valid) {
        toast('Incorrect password. App lock stays enabled.', 'error');
        syncSecurityControls();
        return;
      }
      updateState((draft) => {
        draft.preferences.security.lockEnabled = false;
      }, { render: false });
      syncSecurityControls();
      toast('App lock disabled.');
      return;
    }

    updateState((draft) => {
      draft.preferences.security.lockEnabled = wantsEnabled;
    }, { render: false });
    syncSecurityControls();
  })();
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
    revokeAllObjectUrls();
    localStorage.removeItem(STORAGE_KEY_V3);
    localStorage.removeItem(STORAGE_KEY_V2);
    if ('indexedDB' in window) indexedDB.deleteDatabase(MEDIA_DB_NAME);
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


function encodeSignalPayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeSignalPayload(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value.trim()))));
}

function renderConnectionStatus(message, isError = false) {
  if (!els.connectStatus) return;
  els.connectStatus.textContent = message;
  els.connectStatus.classList.toggle('is-error', isError);
}

function getDirectThread(peerId) {
  const existing = state.data.connections.directNotesByPeerId?.[peerId];
  if (existing) return existing;
  return {
    threadId: `direct-${peerId}`,
    type: 'direct-notes',
    peerId,
    messages: [],
  };
}

function renderDirectNotesList() {
  if (!els.directNotesList) return;
  els.directNotesList.innerHTML = '';
  const peers = Object.values(state.data.connections.peersById || {});
  if (!peers.length) {
    els.directNotesList.innerHTML = '<p class="direct-notes-empty">Pair with someone to start direct notes.</p>';
    return;
  }

  peers.forEach((peer) => {
    const row = document.createElement('div');
    row.className = 'direct-note-row';
    const thread = getDirectThread(peer.peerId);
    const latest = thread.messages[thread.messages.length - 1];
    const summary = latest ? `${resolveActorName(latest.authorId, latest.authorName)}: ${latest.text}` : 'No notes yet';
    row.innerHTML = `<div><strong>${peer.displayName || peer.peerId}</strong><div class="direct-note-summary">${summary}</div></div>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost';
    btn.textContent = 'Open';
    btn.addEventListener('click', () => {
      void openDirectNotesThread(peer.peerId);
    });
    row.append(btn);
    els.directNotesList.append(row);
  });
}

async function openDirectNotesThread(peerId) {
  const thread = getDirectThread(peerId);
  const history = thread.messages.slice(-8).map((msg) => (
    `${resolveActorName(msg.authorId, msg.authorName)}: ${msg.text}`
  ));
  const peerName = state.data.connections.peersById[peerId]?.displayName || peerId;
  const note = await showModalMessage({
    title: `Direct notes: ${peerName}`,
    message: `${history.length ? history.join('\n') : 'No notes yet.'}\n\nAdd a new note:`,
    confirmText: 'Save note',
    cancelText: 'Close',
    showCancel: true,
    input: { placeholder: 'Type a note…', defaultValue: '' },
  });
  if (!note) return;

  const actor = getLocalActorMeta();
  const message = {
    id: crypto.randomUUID(),
    text: note,
    createdAt: new Date().toISOString(),
    authorId: actor.actorId,
    authorName: actor.authorName,
    authorAvatar: actor.authorAvatar,
  };
  updateState((draft) => {
    const existing = draft.connections.directNotesByPeerId?.[peerId] || {
      threadId: `direct-${peerId}`,
      type: 'direct-notes',
      peerId,
      messages: [],
    };
    existing.messages = [...(existing.messages || []), message];
    if (!draft.connections.directNotesByPeerId) draft.connections.directNotesByPeerId = {};
    draft.connections.directNotesByPeerId[peerId] = existing;
  }, { render: false });
  renderDirectNotesList();
  sendProtocolMessage('direct-note', { toPeerId: peerId, threadType: 'direct-notes', message });
  toast('Direct note saved.');
}

function trackPeerConnection(peerId, displayName, trustState = 'trusted') {
  updateState((draft) => {
    const existing = draft.connections.peersById[peerId] || {};
    draft.connections.peersById[peerId] = {
      peerId,
      displayName: displayName || existing.displayName || '',
      trustState,
      lastSyncAt: new Date().toISOString(),
      publicKeyJwk: existing.publicKeyJwk || null,
    };
  }, { render: false });
  renderDirectNotesList();
}

async function applyIncomingMemoryShare(message) {
  const memoryShares = Array.isArray(message.payload?.posts) ? message.payload.posts : [];
  if (!memoryShares.length) return 0;

  let importedCount = 0;
  for (const share of memoryShares) {
    const merged = await importMemoryShare(share, { onConflict: 'generate' });
    if (merged) importedCount += 1;
  }
  return importedCount;
}

function sendProtocolMessage(type, payload = {}) {
  const dc = state.connectionRuntime.dc;
  if (!dc || dc.readyState !== 'open') return;
  dc.send(JSON.stringify({
    version: PROTOCOL_VERSION,
    type,
    fromPeerId: state.data.connections.peerId,
    fromDisplayName: state.data.connections.displayName || state.data.profile.name || 'Mybook User',
    sentAt: new Date().toISOString(),
    payload,
  }));
}

async function handleProtocolMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendProtocolMessage('error', { reason: 'invalid-json' });
    return;
  }

  if (msg.version !== PROTOCOL_VERSION || typeof msg.type !== 'string') {
    sendProtocolMessage('error', { reason: 'unsupported-protocol-version' });
    return;
  }

  if (msg.fromPeerId) {
    state.connectionRuntime.remotePeerId = msg.fromPeerId;
    trackPeerConnection(msg.fromPeerId, msg.fromDisplayName || '', 'trusted');
  }

  if (msg.type === 'hello') {
    sendProtocolMessage('ack', { receivedType: 'hello' });
    return;
  }

  if (msg.type === 'memory-share') {
    const importedCount = await applyIncomingMemoryShare(msg);
    sendProtocolMessage('ack', { receivedType: 'memory-share', importedCount });
    renderConnectionStatus(importedCount ? `Synced ${importedCount} memories.` : 'Connected. Nothing new to import.');
    return;
  }

  if (msg.type === 'direct-note') {
    const incoming = msg.payload?.message;
    if (incoming && typeof incoming.text === 'string' && incoming.text.trim()) {
      const peerId = msg.fromPeerId || msg.payload?.fromPeerId || '';
      if (peerId) {
        updateState((draft) => {
          if (!draft.connections.directNotesByPeerId) draft.connections.directNotesByPeerId = {};
          const existing = draft.connections.directNotesByPeerId[peerId] || {
            threadId: `direct-${peerId}`,
            type: 'direct-notes',
            peerId,
            messages: [],
          };
          existing.messages = [
            ...(existing.messages || []),
            {
              id: typeof incoming.id === 'string' && incoming.id ? incoming.id : crypto.randomUUID(),
              text: incoming.text,
              createdAt: typeof incoming.createdAt === 'string' ? incoming.createdAt : new Date().toISOString(),
              authorId: incoming.authorId || peerId,
              authorName: incoming.authorName || msg.fromDisplayName || '',
              authorAvatar: incoming.authorAvatar || '',
            },
          ];
          draft.connections.directNotesByPeerId[peerId] = existing;
        }, { render: false });
        renderDirectNotesList();
        renderConnectionStatus(`New direct note from ${msg.fromDisplayName || peerId}.`);
      }
    }
    sendProtocolMessage('ack', { receivedType: 'direct-note' });
    return;
  }

  if (msg.type === 'ack') {
    renderConnectionStatus('Connected and synchronized.');
  }
}

function setupDataChannel(dc) {
  state.connectionRuntime.dc = dc;
  dc.addEventListener('open', async () => {
    renderConnectionStatus('Secure channel open. Syncing...');
    sendProtocolMessage('hello', { app: 'mybook' });
    const posts = state.data.postOrder.slice(0, 50).map((id) => state.data.postsById[id]).filter(Boolean);
    const signedPosts = [];
    for (const post of posts) {
      signedPosts.push(await buildMemorySharePayload(post));
    }
    sendProtocolMessage('memory-share', { posts: signedPosts });
  });
  dc.addEventListener('message', (event) => {
    void handleProtocolMessage(event.data);
  });
  dc.addEventListener('close', () => {
    renderConnectionStatus('Connection closed.');
  });
  dc.addEventListener('error', () => {
    renderConnectionStatus('Connection error. Try pairing again.', true);
  });
}

function createPeerConnection() {
  const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
  state.connectionRuntime.pc = pc;
  pc.addEventListener('datachannel', (event) => setupDataChannel(event.channel));
  return pc;
}

async function pushSignal(endpoint, message) {
  if (!endpoint) return;
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  });
}

async function pollSignal(endpoint, sessionId, role) {
  if (!endpoint) return;
  const poll = async () => {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('sessionId', sessionId);
      url.searchParams.set('role', role);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const items = await res.json();
      const messages = Array.isArray(items) ? items : [];
      for (const item of messages) {
        if (item.type === 'answer' && state.connectionRuntime.pc && !state.connectionRuntime.pc.currentRemoteDescription) {
          await state.connectionRuntime.pc.setRemoteDescription(item.payload);
        }
      }
    } catch {
      // no-op fallback to manual code
    }
  };
  await poll();
  if (state.connectionRuntime.pollTimer) clearInterval(state.connectionRuntime.pollTimer);
  state.connectionRuntime.pollTimer = setInterval(poll, 2500);
}

async function beginInviteFlow() {
  if (!state.data.connections.enabled) {
    toast('Enable Connect with someone first.', 'warn');
    return;
  }

  const pc = createPeerConnection();
  const dc = pc.createDataChannel('mybook-sync');
  setupDataChannel(dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sessionId = crypto.randomUUID();
  state.connectionRuntime.mode = 'invite';
  state.connectionRuntime.signalingRole = 'offerer';
  state.connectionRuntime.sessionId = sessionId;

  const invite = {
    v: PROTOCOL_VERSION,
    role: 'invite',
    sessionId,
    offer: pc.localDescription,
    fromPeerId: state.data.connections.peerId,
    fromDisplayName: state.data.connections.displayName || state.data.profile.name || 'Mybook User',
  };

  els.inviteCodeInput.value = encodeSignalPayload(invite);
  await pushSignal(state.data.connections.signalingEndpoint, { sessionId, type: 'offer', payload: invite.offer });
  await pollSignal(state.data.connections.signalingEndpoint, sessionId, 'offerer');
  renderConnectionStatus('Invite code ready. Share it with the other person.');
}

async function beginJoinFlow() {
  if (!state.data.connections.enabled) {
    toast('Enable Connect with someone first.', 'warn');
    return;
  }
  renderConnectionStatus('Paste an invite code, then press Apply code.');
}

async function applyPairingCode() {
  if (!state.data.connections.enabled) {
    toast('Enable Connect with someone first.', 'warn');
    return;
  }

  let payload;
  try {
    payload = decodeSignalPayload(els.inviteCodeInput.value || '');
  } catch {
    toast('That code is not valid.', 'error');
    return;
  }

  if (payload.role === 'invite' && payload.offer) {
    const pc = createPeerConnection();
    state.connectionRuntime.mode = 'join';
    state.connectionRuntime.signalingRole = 'answerer';
    state.connectionRuntime.sessionId = payload.sessionId || crypto.randomUUID();
    await pc.setRemoteDescription(payload.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const answerPayload = {
      v: PROTOCOL_VERSION,
      role: 'answer',
      sessionId: state.connectionRuntime.sessionId,
      answer: pc.localDescription,
      fromPeerId: state.data.connections.peerId,
      fromDisplayName: state.data.connections.displayName || state.data.profile.name || 'Mybook User',
    };

    els.inviteCodeInput.value = encodeSignalPayload(answerPayload);
    await pushSignal(state.data.connections.signalingEndpoint, { sessionId: state.connectionRuntime.sessionId, type: 'answer', payload: answerPayload.answer });
    renderConnectionStatus('Answer code generated. Send it back to the inviter.');
    return;
  }

  if (payload.role === 'answer' && payload.answer && state.connectionRuntime.pc) {
    await state.connectionRuntime.pc.setRemoteDescription(payload.answer);
    renderConnectionStatus('Answer accepted. Waiting for channel...');
    return;
  }

  toast('Unsupported code payload.', 'error');
}

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


function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function postContentHash(post = {}) {
  return stableStringify({
    text: post.text || '',
    date: post.date || '',
    createdAt: post.createdAt || '',
    updatedAt: post.updatedAt || '',
    tags: Array.isArray(post.tags) ? post.tags : [],
    peopleIds: Array.isArray(post.peopleIds) ? post.peopleIds : [],
    media: Array.isArray(post.media) ? post.media.map((item) => ({
      mediaId: item.mediaId || '',
      type: item.type,
      name: item.name,
    })) : [],
    comments: Array.isArray(post.comments) ? post.comments.map((comment) => ({
      text: comment.text || '',
      createdAt: comment.createdAt || '',
      updatedAt: comment.updatedAt || '',
      authorId: comment.authorId || '',
      authorName: comment.authorName || '',
      authorAvatar: comment.authorAvatar || '',
    })) : [],
    reactions: post.reactions && typeof post.reactions === 'object'
      ? Object.keys(post.reactions).sort().map((actorId) => ({
        actorId,
        authorName: post.reactions[actorId]?.authorName || '',
        authorAvatar: post.reactions[actorId]?.authorAvatar || '',
        createdAt: post.reactions[actorId]?.createdAt || '',
      }))
      : [],
  });
}

function personContentHash(person = {}) {
  return stableStringify({
    name: person.name || '',
    relationship: person.relationship || '',
    avatarDataUrl: person.avatarDataUrl || '',
  });
}

function summarizeImportDiff(importedData, currentData) {
  const incomingPosts = importedData.postOrder
    .map((id) => importedData.postsById[id])
    .filter(Boolean);
  const existingPostHashes = new Set(Object.values(currentData.postsById).map((post) => postContentHash(post)));
  let postsToAdd = 0;
  let postsToUpdate = 0;

  incomingPosts.forEach((post) => {
    const currentPost = currentData.postsById[post.id];
    if (currentPost) {
      if (postContentHash(currentPost) !== postContentHash(post)) postsToUpdate += 1;
      return;
    }

    if (!existingPostHashes.has(postContentHash(post))) postsToAdd += 1;
  });

  const existingPeopleById = new Set(currentData.people.map((person) => person.id));
  const existingPeopleHashes = new Set(currentData.people.map((person) => personContentHash(person)));
  let peopleToAdd = 0;
  importedData.people.forEach((person) => {
    if (!existingPeopleById.has(person.id) && !existingPeopleHashes.has(personContentHash(person))) {
      peopleToAdd += 1;
    }
  });

  const profileConflicts = [];
  if ((importedData.profile.name || '').trim() && importedData.profile.name !== currentData.profile.name) profileConflicts.push('name');
  if ((importedData.profile.bio || '').trim() && importedData.profile.bio !== currentData.profile.bio) profileConflicts.push('bio');
  if (importedData.profile.avatarDataUrl && importedData.profile.avatarDataUrl !== currentData.profile.avatarDataUrl) profileConflicts.push('avatar');

  return {
    postsToAdd,
    postsToUpdate,
    peopleToAdd,
    profileConflicts,
  };
}

function mergePostsById(currentPostsById, importedPostsById) {
  const mergedPostsById = { ...currentPostsById };
  const existingHashToId = new Map();
  Object.values(mergedPostsById).forEach((post) => {
    existingHashToId.set(postContentHash(post), post.id);
  });

  const addedPostIds = [];
  Object.keys(importedPostsById).forEach((postId) => {
    const incomingPost = normalizePost(importedPostsById[postId]);
    const existingPost = mergedPostsById[incomingPost.id];
    if (existingPost) {
      if (postContentHash(existingPost) !== postContentHash(incomingPost)) mergedPostsById[incomingPost.id] = incomingPost;
      return;
    }

    const hash = postContentHash(incomingPost);
    if (existingHashToId.has(hash)) return;

    mergedPostsById[incomingPost.id] = incomingPost;
    existingHashToId.set(hash, incomingPost.id);
    addedPostIds.push(incomingPost.id);
  });

  return { mergedPostsById, addedPostIds };
}

function mergePostOrder(currentOrder, importedOrder, postsById, addedPostIds = []) {
  const seen = new Set();
  const mergedOrder = [];

  [...importedOrder.filter((id) => addedPostIds.includes(id)), ...currentOrder, ...importedOrder].forEach((id) => {
    if (typeof id !== 'string' || !postsById[id] || seen.has(id)) return;
    seen.add(id);
    mergedOrder.push(id);
  });

  Object.keys(postsById).forEach((id) => {
    if (!seen.has(id)) mergedOrder.push(id);
  });

  return mergedOrder;
}

function mergePeople(currentPeople, importedPeople) {
  const mergedPeople = currentPeople.map((person) => ({ ...person }));
  const existingById = new Set(mergedPeople.map((person) => person.id));
  const existingHashes = new Set(mergedPeople.map((person) => personContentHash(person)));

  importedPeople.forEach((incomingPerson) => {
    if (existingById.has(incomingPerson.id)) return;
    const hash = personContentHash(incomingPerson);
    if (existingHashes.has(hash)) return;
    mergedPeople.push({ ...incomingPerson });
    existingById.add(incomingPerson.id);
    existingHashes.add(hash);
  });

  return mergedPeople;
}

function applyImportedData(imported) {
  state.data = imported;
  updateState((draft) => {
    draft.version = 3;
  });

  els.profileName.value = state.data.profile.name;
  els.profileBio.value = state.data.profile.bio;
  els.themeSelect.value = state.data.preferences.theme;
  els.connectEnabled.checked = Boolean(state.data.connections.enabled);
  els.connectDisplayName.value = state.data.connections.displayName || state.data.profile.name || '';
  els.signalingEndpoint.value = state.data.connections.signalingEndpoint || '';
  applyTheme(state.data.preferences.theme);
  renderPeopleList();
  renderDirectNotesList();
  renderPostPeopleMenu();
  renderFilterPeopleList();
}

function mergeImportedData(imported) {
  const { mergedPostsById, addedPostIds } = mergePostsById(state.data.postsById, imported.postsById);
  const mergedPostOrder = mergePostOrder(state.data.postOrder, imported.postOrder, mergedPostsById, addedPostIds);
  const mergedPeople = mergePeople(state.data.people, imported.people);

  const mergedData = normalizeV3({
    ...state.data,
    postsById: mergedPostsById,
    postOrder: mergedPostOrder,
    people: mergedPeople,
    version: 3,
  });

  applyImportedData(mergedData);
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

function dataUrlToBlob(dataUrl) {
  const [meta, base64Payload = ''] = String(dataUrl || '').split(',');
  const match = /data:([^;]+);base64/.exec(meta || '');
  const mime = match ? match[1] : 'application/octet-stream';
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function resolveMediaFile(mediaItem, index) {
  const fallbackName = mediaItem.name || `memory-media-${index + 1}.${mediaItem.type === 'video' ? 'mp4' : 'jpg'}`;
  if (mediaItem.mediaId) {
    const stored = await getMediaBlob(mediaItem.mediaId);
    if (stored?.blob) return new File([stored.blob], fallbackName, { type: stored.blob.type || (mediaItem.type === 'video' ? 'video/mp4' : 'image/jpeg') });
  }
  if (mediaItem.dataUrl) {
    return new File([dataUrlToBlob(mediaItem.dataUrl)], fallbackName, { type: mediaItem.type === 'video' ? 'video/mp4' : 'image/jpeg' });
  }
  return null;
}

async function quickSharePost(post) {
  const shareText = buildPostShareText(post);
  const files = [];

  for (const [index, mediaItem] of (post.media || []).entries()) {
    const file = await resolveMediaFile(mediaItem, index);
    if (file) files.push(file);
  }

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

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function ensureProfileIdentity() {
  const existing = state.data.connections.identity || {};
  if (existing.privateKeyJwk && existing.publicKeyJwk) return existing;

  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const [privateKeyJwk, publicKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ]);
  const generatedAt = new Date().toISOString();
  updateState((draft) => {
    draft.connections.identity = { privateKeyJwk, publicKeyJwk, generatedAt };
  }, { render: false });
  return { privateKeyJwk, publicKeyJwk, generatedAt };
}

async function signMemoryShareContent(sender, post) {
  const identity = await ensureProfileIdentity();
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    identity.privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const payloadToSign = stableSerialize({
    sender,
    post,
  });
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadToSign));
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    hashBuffer,
  );
  return {
    hash: bytesToBase64(new Uint8Array(hashBuffer)),
    signature: bytesToBase64(new Uint8Array(signatureBuffer)),
    publicKeyJwk: identity.publicKeyJwk,
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('blob-read-failed'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function materializePostMediaForExport(post) {
  const media = [];
  for (const item of (post.media || [])) {
    if (item.dataUrl) {
      media.push({
        dataUrl: item.dataUrl,
        type: item.type,
        name: item.name,
      });
      continue;
    }
    if (!item.mediaId) continue;
    const stored = await getMediaBlob(item.mediaId);
    if (!stored?.blob) continue;
    const dataUrl = await blobToDataUrl(stored.blob);
    media.push({
      dataUrl,
      type: item.type,
      name: item.name,
    });
  }
  return media;
}

async function buildMemorySharePayload(post) {
  const normalizedPost = normalizePost(post);
  const postForExport = {
    ...normalizedPost,
    media: await materializePostMediaForExport(normalizedPost),
  };
  const sender = {
    senderId: state.data.connections.peerId,
    displayName: state.data.connections.displayName || state.data.profile.name || 'Mybook User',
    exportedAt: new Date().toISOString(),
  };
  const integrity = await signMemoryShareContent(sender, postForExport);
  return {
    kind: 'mybook-memory-share',
    version: 1,
    exportedAt: new Date().toISOString(),
    sender,
    hash: integrity.hash,
    signature: integrity.signature,
    signerPublicKey: integrity.publicKeyJwk,
    post: {
      ...postForExport,
      id: post.id,
    },
  };
}

async function downloadMemoryShare(post) {
  const payload = await buildMemorySharePayload(post);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mybook-memory-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function verifyMemoryShareSignature(raw, post, sender) {
  try {
    const payloadToVerify = stableSerialize({ sender, post });
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadToVerify));
    const computedHash = bytesToBase64(new Uint8Array(hashBuffer));
    if (computedHash !== raw.hash) return { valid: false, fingerprint: '' };

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      raw.signerPublicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      base64ToBytes(raw.signature),
      hashBuffer,
    );
    const fingerprint = computedHash.slice(0, 16);
    return { valid: Boolean(ok), fingerprint };
  } catch {
    return { valid: false, fingerprint: '' };
  }
}

async function confirmSenderTrust(sender, signerPublicKey, fingerprint) {
  const senderId = sender.senderId || `unknown-${fingerprint}`;
  const existing = state.data.connections.peersById[senderId];
  if (existing?.trustState === 'blocked') {
    toast('Import blocked: sender is blocked on this device.', 'warn');
    return 'blocked';
  }
  if (existing?.trustState === 'trusted') {
    const knownKey = existing.publicKeyJwk ? stableSerialize(existing.publicKeyJwk) : '';
    const incomingKey = signerPublicKey ? stableSerialize(signerPublicKey) : '';
    if (knownKey && incomingKey && knownKey !== incomingKey) {
      const proceed = await showModalMessage({
        title: 'Sender key changed',
        message: `Trusted sender ${existing.displayName || senderId} has a different signing key.\nFingerprint: ${fingerprint || 'n/a'}`,
        confirmText: 'Trust new key',
        cancelText: 'Block sender',
        showCancel: true,
      });
      if (!proceed) {
        updateState((draft) => {
          draft.connections.peersById[senderId] = {
            ...existing,
            trustState: 'blocked',
            lastSyncAt: new Date().toISOString(),
          };
        }, { render: false });
        return 'blocked';
      }
    } else {
      return 'trusted';
    }
  }

  const trustChoice = await showModalMessage({
    title: 'Trust this sender?',
    message: `${sender.displayName || 'Unknown sender'} (${senderId}) wants to share memory.\nFingerprint: ${fingerprint || 'n/a'}`,
    confirmText: 'Trust sender',
    cancelText: 'Block sender',
    showCancel: true,
  });

  const nextTrustState = trustChoice ? 'trusted' : 'blocked';
  updateState((draft) => {
    const prev = draft.connections.peersById[senderId] || {};
    draft.connections.peersById[senderId] = {
      peerId: senderId,
      displayName: sender.displayName || prev.displayName || '',
      trustState: nextTrustState,
      lastSyncAt: new Date().toISOString(),
      publicKeyJwk: signerPublicKey && typeof signerPublicKey === 'object' ? signerPublicKey : (prev.publicKeyJwk || null),
    };
  }, { render: false });
  return nextTrustState;
}

async function importMemoryShare(raw, options = {}) {
  const incomingPost = raw && raw.post ? normalizePost(raw.post) : null;
  if (!incomingPost || (!incomingPost.text && incomingPost.media.length === 0)) return false;
  const sender = raw && raw.sender && typeof raw.sender === 'object' ? raw.sender : null;
  if (!sender || typeof raw.signature !== 'string' || typeof raw.hash !== 'string' || !raw.signerPublicKey) return false;

  const signatureStatus = await verifyMemoryShareSignature(raw, incomingPost, sender);
  if (!signatureStatus.valid) {
    const proceed = await showModalMessage({
      title: 'Unverified memory share',
      message: 'Signature check failed for this memory share. Import anyway?',
      confirmText: 'Import anyway',
      cancelText: 'Reject',
      showCancel: true,
    });
    if (!proceed) return false;
  }

  const trustState = await confirmSenderTrust(sender, raw.signerPublicKey, signatureStatus.fingerprint);
  if (trustState === 'blocked') return false;

  const { onConflict = 'generate' } = options;
  if (state.data.postsById[incomingPost.id] && onConflict === 'skip') return false;
  let mediaRefs = [];
  try {
    mediaRefs = await persistPostMediaRefs(incomingPost.media || []);
  } catch {
    return false;
  }
  const incomingId = state.data.postsById[incomingPost.id] ? crypto.randomUUID() : incomingPost.id;
  const postToInsert = {
    ...incomingPost,
    id: incomingId,
    media: mediaRefs,
    importedFrom: {
      senderId: sender.senderId || '',
      displayName: sender.displayName || 'Unknown sender',
      exportedAt: sender.exportedAt || '',
    },
  };
  return updateState((draft) => {
    draft.postsById[postToInsert.id] = postToInsert;
    draft.postOrder.unshift(postToInsert.id);
  });
}

async function handleImportFile(event, mode = 'auto') {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const isMemoryShare = parsed && parsed.kind === 'mybook-memory-share';

    if (mode === 'memory' && !isMemoryShare) {
      toast('Import memory failed: this file is not a memory share export.', 'error');
      return;
    }

    if (isMemoryShare) {
      const merged = await importMemoryShare(parsed);
      if (!merged) {
        toast('Memory share import failed: invalid memory payload.', 'error');
      } else {
        toast('Memory imported into your feed.');
      }
      return;
    }

    const imported = normalizeImportPayload(parsed);
    const diff = summarizeImportDiff(imported, state.data);
    const summary = [
      `Posts to add: ${diff.postsToAdd}`,
      `Posts to update: ${diff.postsToUpdate}`,
      `People to add: ${diff.peopleToAdd}`,
      `Profile conflicts: ${diff.profileConflicts.length ? diff.profileConflicts.join(', ') : 'none'}`,
    ].join('\n');

    const mergeChoice = await showModalMessage({
      title: 'Import backup',
      message: `Review import changes before applying.\n\n${summary}`,
      confirmText: 'Merge into current data',
      cancelText: 'Replace all local data',
      showCancel: true,
    });

    if (mergeChoice === true) {
      mergeImportedData(imported);
      await migrateLegacyMediaToIndexedDb();
      toast('Backup merged into current data.');
      return;
    }

    const replaceConfirmed = await showModalMessage({
      title: 'Replace local data?',
      message: 'This will overwrite all current profile, people, and memories on this device. This cannot be undone without another backup file.',
      confirmText: 'Replace everything',
      cancelText: 'Cancel',
      showCancel: true,
    });

    if (!replaceConfirmed) {
      toast('Import canceled.', 'warn');
      return;
    }

    applyImportedData(imported);
    await migrateLegacyMediaToIndexedDb();
    toast('Backup imported by replacing local data.');
  } catch {
    toast('Import failed: invalid JSON file.', 'error');
  } finally {
    event.target.value = '';
    closeAccountMenu();
  }
}

els.importMemoryFile.addEventListener('change', (event) => {
  handleImportFile(event, 'memory');
});

els.importFile.addEventListener('change', (event) => {
  handleImportFile(event, 'auto');
});

async function requireAppUnlockIfNeeded() {
  const { lockEnabled, passwordHash } = getSecurityPrefs();
  if (!lockEnabled || !passwordHash) {
    unlockUi();
    return;
  }

  lockUi();
  els.lockError.classList.add('hidden');
  els.lockPasswordInput.value = '';
  els.lockScreen.classList.remove('hidden');
  els.lockPasswordInput.focus();

  await new Promise((resolve) => {
    const onSubmit = async (event) => {
      event.preventDefault();
      const candidate = els.lockPasswordInput.value || '';
      const isValid = await verifyLockPassword(candidate);
      if (!isValid) {
        els.lockError.classList.remove('hidden');
        els.lockPasswordInput.select();
        return;
      }
      els.lockForm.removeEventListener('submit', onSubmit);
      resolve();
    };
    els.lockForm.addEventListener('submit', onSubmit);
  });

  els.lockScreen.classList.add('hidden');
  unlockUi();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function init() {
  try {
    await openMediaDb();
  } catch {
    toast('IndexedDB is unavailable, so media features may be limited on this browser.', 'warn');
  }
  await load();
  await migrateLegacyMediaToIndexedDb();
  renderAvatar();
  renderPeopleList();
  renderDirectNotesList();
  renderPostPeopleMenu();
  renderPosts();
  await requireAppUnlockIfNeeded();
}

init();
