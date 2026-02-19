/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           Claude Chat Exporter — Core Extractor                  ║
 * ║                                                                  ║
 * ║  TWO WAYS TO USE:                                                ║
 * ║                                                                  ║
 * ║  1. CONSOLE (no install needed)                                  ║
 * ║     Open any claude.ai/chat/... page                             ║
 * ║     Open DevTools (F12) → Console                                ║
 * ║     Paste this entire file → Enter                               ║
 * ║     → File downloads + copied to clipboard                       ║
 * ║                                                                  ║
 * ║  2. CHROME EXTENSION (via popup UI)                              ║
 * ║     This file is injected automatically as a content script.     ║
 * ║     The popup communicates via chrome.runtime.onMessage.         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── HTML → Markdown converter ─────────────────────────────────────────────────

function htmlToMarkdown(el) {
  if (!el) return '';

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    if (['button', 'svg', 'path', 'script', 'style'].includes(tag)) return '';

    const children = () => [...node.childNodes].map(processNode).join('');

    switch (tag) {
      case 'p':          return children() + '\n\n';
      case 'h1':         return '# '     + children() + '\n\n';
      case 'h2':         return '## '    + children() + '\n\n';
      case 'h3':         return '### '   + children() + '\n\n';
      case 'h4':         return '#### '  + children() + '\n\n';
      case 'h5':         return '##### ' + children() + '\n\n';
      case 'strong':
      case 'b':          return '**' + children() + '**';
      case 'em':
      case 'i':          return '*' + children() + '*';
      case 'del':
      case 's':          return '~~' + children() + '~~';
      case 'code':
        if (node.closest('pre')) return children();
        return '`' + children() + '`';
      case 'pre': {
        const lang = node.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || '';
        return '```' + lang + '\n' + node.innerText.trim() + '\n```\n\n';
      }
      case 'ul':  return children() + '\n';
      case 'ol':  return processOL(node) + '\n';
      case 'li':  return '- ' + children().trim() + '\n';
      case 'blockquote':
        return children().trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
      case 'hr':  return '\n---\n\n';
      case 'br':  return '\n';
      case 'a':   return '[' + children() + '](' + node.href + ')';
      case 'table': return processTable(node) + '\n';
      default:    return children();
    }
  }

  function processOL(ol) {
    return [...ol.children].map((li, i) =>
      (i + 1) + '. ' + [...li.childNodes].map(processNode).join('').trim()
    ).join('\n');
  }

  function processTable(table) {
    const rows = [...table.querySelectorAll('tr')];
    if (!rows.length) return '';
    return rows.map((row, rowIdx) => {
      const cells = [...row.querySelectorAll('th, td')]
        .map(c => [...c.childNodes].map(processNode).join('').trim().replace(/\|/g, '\\|'));
      const line = '| ' + cells.join(' | ') + ' |';
      if (rowIdx === 0 && row.querySelectorAll('th').length) {
        return line + '\n| ' + cells.map(() => '---').join(' | ') + ' |';
      }
      return line;
    }).join('\n');
  }

  return processNode(el).replace(/\n{3,}/g, '\n\n').trim();
}

// ── Message extraction ────────────────────────────────────────────────────────

function extractMessages(options) {
  const roleFilter = (options && options.roleFilter) || 'both';
  const turnLimit  = (options && options.turnLimit)  || 0;

  const container = document.querySelector(
    '.flex-1.flex.flex-col.px-4.max-w-3xl.mx-auto'
  );
  if (!container) return null;

  const turns = [...container.children].filter(function(el) {
    return el.innerText && el.innerText.trim();
  });
  const messages = [];

  turns.forEach(function(turn) {
    const isUser = !!turn.querySelector('[data-testid="user-message"]');

    if (roleFilter === 'human'     && !isUser) return;
    if (roleFilter === 'assistant' &&  isUser) return;

    var content = '';
    if (isUser) {
      const userDiv = turn.querySelector('[data-testid="user-message"]');
      content = userDiv ? userDiv.innerText.trim() : turn.innerText.trim();
      const files = [...turn.querySelectorAll('[data-testid="file-thumbnail"]')]
        .map(function(f) { return f.getAttribute('aria-label') || f.innerText.trim(); })
        .filter(Boolean);
      if (files.length) content += '\n\n[Attached files: ' + files.join(', ') + ']';
    } else {
      const claudeDiv = turn.querySelector('.font-claude-response');
      content = claudeDiv ? htmlToMarkdown(claudeDiv) : turn.innerText.trim();
    }

    if (content) messages.push({ role: isUser ? 'human' : 'assistant', content: content });
  });

  return turnLimit > 0 ? messages.slice(-turnLimit) : messages;
}

// ── Format builders ───────────────────────────────────────────────────────────

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function buildXmlMarkdown(messages, meta) {
  var out = '<conversation_history>\n';
  out += '  <meta>\n';
  out += '    <title>' + escapeXml(meta.title) + '</title>\n';
  out += '    <url>' + escapeXml(meta.url) + '</url>\n';
  out += '    <exported_at>' + meta.exportedAt + '</exported_at>\n';
  out += '    <turn_count>' + messages.length + '</turn_count>\n';
  out += '  </meta>\n\n';
  messages.forEach(function(m, i) {
    out += '  <turn index="' + (i + 1) + '" role="' + m.role + '">\n';
    out += '    <content>\n';
    out += m.content.split('\n').map(function(l) { return '      ' + l; }).join('\n');
    out += '\n    </content>\n  </turn>\n\n';
  });
  out += '</conversation_history>';
  return out;
}

function buildMarkdown(messages, meta) {
  var out = '# ' + meta.title + '\n\n';
  out += '> Exported from: ' + meta.url + '  \n';
  out += '> Date: ' + meta.exportedAt + '  \n';
  out += '> Turns: ' + messages.length + '\n\n---\n\n';
  messages.forEach(function(m) {
    var label = m.role === 'human' ? '👤 **Human**' : '🤖 **Claude**';
    out += label + '\n\n' + m.content + '\n\n---\n\n';
  });
  return out.trim();
}

function buildJson(messages, meta) {
  return JSON.stringify({
    meta: {
      title:      meta.title,
      url:        meta.url,
      exportedAt: meta.exportedAt,
      turnCount:  messages.length,
    },
    messages: messages.map(function(m, i) {
      return { index: i + 1, role: m.role, content: m.content };
    }),
  }, null, 2);
}

function downloadText(content, filename) {
  var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CONSOLE MODE — runs immediately when pasted into DevTools ─────────────────
// ── Skipped automatically when loaded as a Chrome extension content script ───
// ══════════════════════════════════════════════════════════════════════════════

(function consoleMode() {
  // If running as extension content script, skip console mode
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) return;

  // ── Edit these options before pasting ──────────────────────────────────────
  var OPTIONS = {
    format:     'xml',   // 'xml' | 'markdown' | 'json'
    roleFilter: 'both',  // 'both' | 'human' | 'assistant'
    turnLimit:  0,       // 0 = all turns, N = last N turns
  };
  // ──────────────────────────────────────────────────────────────────────────

  if (!window.location.href.startsWith('https://claude.ai/chat/')) {
    console.warn('⚠️  Claude Exporter: navigate to a claude.ai/chat/... page first.');
    return;
  }

  var messages = extractMessages(OPTIONS);

  if (!messages) {
    console.error('❌ Could not find conversation container. Make sure the page is fully loaded.');
    return;
  }
  if (!messages.length) {
    console.error('❌ No messages found. Try adjusting roleFilter or turnLimit.');
    return;
  }

  var meta = {
    title:      document.title.replace(' - Claude', '').trim(),
    url:        window.location.href,
    exportedAt: new Date().toISOString(),
  };

  var content, ext;
  switch (OPTIONS.format) {
    case 'xml':      content = buildXmlMarkdown(messages, meta); ext = 'txt';  break;
    case 'markdown': content = buildMarkdown(messages, meta);    ext = 'md';   break;
    case 'json':     content = buildJson(messages, meta);        ext = 'json'; break;
    default:         content = buildXmlMarkdown(messages, meta); ext = 'txt';
  }

  var safeTitle = meta.title.replace(/[^a-z0-9_\-\u4e00-\u9fff]/gi, '_').substring(0, 50);
  var filename  = 'claude_' + safeTitle + '_' + Date.now() + '.' + ext;

  downloadText(content, filename);

  navigator.clipboard.writeText(content)
    .then(function()  { console.log('📋 Also copied to clipboard!'); })
    .catch(function() { console.log('ℹ️  Clipboard copy skipped.'); });

  var humanCount = messages.filter(function(m) { return m.role === 'human'; }).length;
  var aiCount    = messages.filter(function(m) { return m.role === 'assistant'; }).length;

  console.log(
    '\n╔══════════════════════════════════════════════╗\n' +
    '║   ✅ Claude Conversation Exported             ║\n' +
    '╠══════════════════════════════════════════════╣\n' +
    '║  Format:  ' + OPTIONS.format.padEnd(34) + ' ║\n' +
    '║  Turns:   ' + String(messages.length).padEnd(4) + ' (' + humanCount + ' human · ' + aiCount + ' AI)          ║\n' +
    '║  File:    ' + filename.substring(0, 32).padEnd(32) + ' ║\n' +
    '╚══════════════════════════════════════════════╝\n\n' +
    'Tip: edit OPTIONS at the top of the script to change format/filter/limit.'
  );
})();

// ══════════════════════════════════════════════════════════════════════════════
// ── EXTENSION MODE — listen for messages from popup.js ────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  window.__claudeExporterReady = true;

  chrome.runtime.onMessage.addListener(function(request, _sender, sendResponse) {
    if (request.action !== 'extract') return;

    var opts = request.options || {};
    var messages = extractMessages(opts);

    if (!messages) {
      sendResponse({ error: 'Could not find conversation container.' });
      return true;
    }
    if (!messages.length) {
      sendResponse({ error: 'No messages found matching your filters.' });
      return true;
    }

    var meta = {
      title:      document.title.replace(' - Claude', '').trim(),
      url:        window.location.href,
      exportedAt: new Date().toISOString(),
    };

    var content, ext;
    switch (opts.format) {
      case 'xml':      content = buildXmlMarkdown(messages, meta); ext = 'txt';  break;
      case 'markdown': content = buildMarkdown(messages, meta);    ext = 'md';   break;
      case 'json':     content = buildJson(messages, meta);        ext = 'json'; break;
      default:         content = buildXmlMarkdown(messages, meta); ext = 'txt';
    }

    var safeTitle = meta.title.replace(/[^a-z0-9_\-\u4e00-\u9fff]/gi, '_').substring(0, 50);
    var filename  = 'claude_' + safeTitle + '_' + Date.now() + '.' + ext;

    sendResponse({
      content:  content,
      filename: filename,
      meta: {
        title:      meta.title,
        turnCount:  messages.length,
        humanCount: messages.filter(function(m) { return m.role === 'human'; }).length,
        aiCount:    messages.filter(function(m) { return m.role === 'assistant'; }).length,
      },
    });

    return true;
  });
}
