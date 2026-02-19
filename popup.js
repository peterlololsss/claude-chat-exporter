// ── State ──────────────────────────────────────────────────────────────────
let selectedFormat = 'xml';
let lastExportedContent = null;

// ── DOM refs ────────────────────────────────────────────────────────────────
const exportBtn   = document.getElementById('exportBtn');
const statusEl    = document.getElementById('status');
const statsEl     = document.getElementById('stats');
const copyLastBtn = document.getElementById('copyLastBtn');

// ── Check if we're on a chat page ────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const isChatPage = tab?.url?.startsWith('https://claude.ai/chat/');
  if (!isChatPage) {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('notChatPage').style.display = 'block';
  }
});

// ── Format toggle ────────────────────────────────────────────────────────────
document.querySelectorAll('.format-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFormat = btn.dataset.format;
  });
});

// ── Export ───────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', async () => {
  const roleFilter = document.getElementById('roleFilter').value;
  const turnLimit  = parseInt(document.getElementById('turnLimit').value, 10);

  setStatus('loading', 'Extracting conversation…');
  exportBtn.disabled = true;
  statsEl.classList.remove('show');
  copyLastBtn.style.display = 'none';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Ensure content script is injected
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/extractor.js'],
    });
  } catch (_) {
    // Already injected — fine
  }

  chrome.tabs.sendMessage(
    tab.id,
    { action: 'extract', options: { format: selectedFormat, roleFilter, turnLimit } },
    (response) => {
      exportBtn.disabled = false;

      if (chrome.runtime.lastError) {
        setStatus('error', '❌ Could not reach page.\nRefresh the claude.ai tab and try again.');
        return;
      }

      if (response?.error) {
        setStatus('error', '❌ ' + response.error);
        return;
      }

      // Trigger download via data URL (MV3 compatible)
      const blob = new Blob([response.content], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = response.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Store for clipboard copy
      lastExportedContent = response.content;
      copyLastBtn.style.display = 'inline';

      // Show stats
      const m = response.meta;
      document.getElementById('statTotal').textContent = m.turnCount;
      document.getElementById('statHuman').textContent = m.humanCount;
      document.getElementById('statAI').textContent    = m.aiCount;
      statsEl.classList.add('show');

      setStatus('success',
        `✅ Saved: ${response.filename}\n` +
        `📋 ${m.turnCount} turns exported`
      );
    }
  );
});

// ── Clipboard copy ───────────────────────────────────────────────────────────
copyLastBtn.addEventListener('click', async () => {
  if (!lastExportedContent) return;
  try {
    await navigator.clipboard.writeText(lastExportedContent);
    const orig = copyLastBtn.textContent;
    copyLastBtn.textContent = 'Copied!';
    setTimeout(() => { copyLastBtn.textContent = orig; }, 1500);
  } catch (_) {
    copyLastBtn.textContent = 'Failed';
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function setStatus(type, message) {
  statusEl.className = 'status ' + type;
  if (type === 'loading') {
    statusEl.innerHTML = `<div class="spinner"></div><span>${message}</span>`;
  } else {
    statusEl.textContent = message;
  }
}
