# Claude Chat Exporter 🧩

Export your [Claude.ai](https://claude.ai) conversation history as XML+Markdown, pure Markdown, or JSON — optimized for re-ingesting back into Claude.

![Version](https://img.shields.io/badge/version-1.0.0-e8845a?style=flat-square)
![Manifest](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Two ways to use

### Option A — Console script (no install needed) ⚡

1. Open any `claude.ai/chat/...` page with messages loaded
2. Open DevTools → **Console** (`F12`)
3. Paste the contents of [`src/extractor.js`](src/extractor.js) → Enter
4. File downloads automatically + copied to clipboard

**Want to customize before pasting? Edit the `OPTIONS` block at the top of the script:**

```js
var OPTIONS = {
  format:     'xml',   // 'xml' | 'markdown' | 'json'
  roleFilter: 'both',  // 'both' | 'human' | 'assistant'
  turnLimit:  0,       // 0 = all turns, N = last N turns
};
```

---

### Option B — Chrome Extension (popup UI) 🖱️

1. Clone this repo:
   ```bash
   git clone https://github.com/peterlololsss/claude-chat-exporter.git
   ```
2. Go to `chrome://extensions/` → enable **Developer mode** (top-right)
3. Click **Load unpacked** → select the `claude-chat-exporter/` folder
4. Open a `claude.ai/chat/...` page, click the toolbar icon
5. Choose format, role filter, turn limit → **Export**

---

## Export formats

| Format | Extension | Best for |
|--------|-----------|----------|
| **XML + Markdown** | `.txt` | Re-ingesting into Claude (default) |
| **Markdown** | `.md` | Human reading, Obsidian, Notion |
| **JSON** | `.json` | Programmatic processing, APIs |

### XML + Markdown (recommended for Claude)

```xml
<conversation_history>
  <meta>
    <title>My Conversation</title>
    <url>https://claude.ai/chat/...</url>
    <exported_at>2025-02-19T10:00:00.000Z</exported_at>
    <turn_count>42</turn_count>
  </meta>

  <turn index="1" role="human">
    <content>
      Hello Claude...
    </content>
  </turn>

  <turn index="2" role="assistant">
    <content>
      ## Response

      Here's what I think about **this topic**:

      - Point one
      - Point two
    </content>
  </turn>
</conversation_history>
```

Claude's rendered HTML responses are converted to **clean Markdown** — headings, bold, code blocks, lists, blockquotes, and tables all preserved.

---

## Re-ingesting into Claude

Paste the exported file into a new Claude chat:

```
Here is my conversation history for context:

[paste exported content]

Now let's continue from where we left off...
```

---

## Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `format` | `xml` \| `markdown` \| `json` | `xml` | Output format |
| `roleFilter` | `both` \| `human` \| `assistant` | `both` | Which roles to include |
| `turnLimit` | `0` or any number | `0` | `0` = all turns; `N` = last N turns |

---

## How it works

Claude.ai renders each conversation turn as a `div` inside a max-width container. The extractor identifies:

- **Human turns** — `div` containing `[data-testid="user-message"]`
- **Claude turns** — `div` containing `.font-claude-response` (rendered HTML)

Claude's HTML is converted to Markdown via a recursive HTML→MD parser. The dual-mode design (`consoleMode` IIFE + `chrome.runtime.onMessage` listener) lets the same file work both as a paste-in console script and as a Chrome extension content script.

---

## Project structure

```
claude-chat-exporter/
├── manifest.json        # Chrome Extension Manifest V3
├── popup.html           # Extension popup UI
├── popup.js             # Popup interaction & download logic
├── src/
│   └── extractor.js     # ← Core logic (works as console script OR content script)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Contributing

PRs welcome! Ideas:
- [ ] Firefox / Edge support
- [ ] Export to PDF
- [ ] Batch export multiple conversations
- [ ] Auto-upload to GitHub Gist

---

## License

MIT © 2025
