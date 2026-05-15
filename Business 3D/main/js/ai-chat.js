(function () {
  'use strict';

  const AI_URL = 'http://localhost:8000';
  const SESSION_KEY = 'ai_chat_session';
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  let open = false;
  let busy = false;

  // ── Build DOM ──────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'ai-chat-widget';
  widget.innerHTML = `
    <button id="ai-chat-toggle" title="AI Assistant">
      <i class="fas fa-robot"></i>
    </button>
    <div id="ai-chat-panel">
      <div id="ai-chat-header">
        <span class="ai-title">
          <i class="fas fa-robot"></i> AI Assistant
          <span class="ai-status" id="ai-status">● offline</span>
        </span>
        <button id="ai-chat-close" title="Close">✕</button>
      </div>
      <div id="ai-chat-messages"></div>
      <div id="ai-chat-input-area">
        <input id="ai-chat-input" type="text" placeholder="Ask anything…" maxlength="500" autocomplete="off">
        <button id="ai-chat-send"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>`;
  document.body.appendChild(widget);

  const toggleBtn  = document.getElementById('ai-chat-toggle');
  const panel      = document.getElementById('ai-chat-panel');
  const closeBtn   = document.getElementById('ai-chat-close');
  const msgsEl     = document.getElementById('ai-chat-messages');
  const inputEl    = document.getElementById('ai-chat-input');
  const sendBtn    = document.getElementById('ai-chat-send');
  const statusEl   = document.getElementById('ai-status');

  // ── Status check ───────────────────────────────────────────
  async function checkStatus() {
    try {
      const r = await fetch(`${AI_URL}/api/v1/agent/ollama`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      if (d.available) {
        statusEl.textContent = '● online';
        statusEl.style.color = '#4ade80';
      } else {
        statusEl.textContent = '● no model';
        statusEl.style.color = '#f59e0b';
      }
    } catch {
      statusEl.textContent = '● offline';
      statusEl.style.color = '#f87171';
    }
  }

  // ── Message helpers ────────────────────────────────────────
  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = `ai-msg ai-msg-${role}`;
    el.innerHTML = `<div class="ai-bubble">${escape(text)}</div>`;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function addThinking() {
    const el = document.createElement('div');
    el.className = 'ai-msg ai-msg-assistant';
    el.id = 'ai-thinking';
    el.innerHTML = '<div class="ai-bubble ai-thinking"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  // ── Send ───────────────────────────────────────────────────
  async function send() {
    const text = inputEl.value.trim();
    if (!text || busy) return;
    busy = true;
    inputEl.value = '';
    sendBtn.disabled = true;

    addMsg('user', text);
    const thinking = addThinking();

    try {
      const res = await fetch(`${AI_URL}/api/v1/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text, session_id: sessionId, use_ai: true }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      thinking.remove();
      addMsg('assistant', data.message || JSON.stringify(data));
    } catch (err) {
      thinking.remove();
      addMsg('assistant', err.name === 'TimeoutError'
        ? 'Request timed out. The AI may be loading a model — try again.'
        : 'Cannot reach AI service (localhost:8000). Is the ERP-AI server running?');
    }

    busy = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  // ── Toggle ─────────────────────────────────────────────────
  function toggle() {
    open = !open;
    panel.classList.toggle('open', open);
    if (open) {
      if (!msgsEl.children.length) {
        addMsg('assistant', 'Hi! I\'m your AI assistant. Ask me anything about your business data.');
      }
      checkStatus();
      inputEl.focus();
    }
  }

  // ── Events ─────────────────────────────────────────────────
  toggleBtn.addEventListener('click', toggle);
  closeBtn.addEventListener('click', () => { open = false; panel.classList.remove('open'); });
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  // Check status every 30s while panel is open
  setInterval(() => { if (open) checkStatus(); }, 30000);
})();
