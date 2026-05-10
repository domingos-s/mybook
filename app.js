const BOOK_URL = 'chapters/The_Good_Life_Manuscript.md';
const PROGRESS_KEY = 'good_life_reader_progress_v1';

const readerContent = document.getElementById('readerContent');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const progressLabel = document.getElementById('progressLabel');

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMd(trimmed.slice(2))}</li>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<blockquote>${inlineMd(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(`<p>${inlineMd(trimmed)}</p>`);
  }

  if (inList) html.push('</ul>');
  return html.join('\n');
}

function inlineMd(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getProgress() {
  const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  return Math.min(Math.max(window.scrollY / max, 0), 1);
}

function setProgressLabel(progress) {
  progressLabel.textContent = `${Math.round(progress * 100)}%`;
}

function saveBookmark() {
  const progress = getProgress();
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ progress, savedAt: Date.now() }));
  setProgressLabel(progress);
  bookmarkBtn.classList.remove('bookmark-saved');
  void bookmarkBtn.offsetWidth;
  bookmarkBtn.classList.add('bookmark-saved');
}

function restoreBookmark() {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return;
  try {
    const { progress } = JSON.parse(raw);
    if (typeof progress !== 'number') return;

    requestAnimationFrame(() => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      window.scrollTo({ top: max * progress, behavior: 'auto' });
      setProgressLabel(progress);
    });
  } catch {
    localStorage.removeItem(PROGRESS_KEY);
  }
}

async function initReader() {
  const response = await fetch(BOOK_URL);
  if (!response.ok) {
    readerContent.innerHTML = `<p>Could not load manuscript (${response.status}).</p>`;
    return;
  }

  const markdown = await response.text();
  readerContent.innerHTML = markdownToHtml(markdown);
  restoreBookmark();
  setProgressLabel(getProgress());
}

window.addEventListener('scroll', () => setProgressLabel(getProgress()), { passive: true });
bookmarkBtn.addEventListener('click', saveBookmark);

initReader();
