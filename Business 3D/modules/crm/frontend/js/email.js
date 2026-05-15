/**
 * @file email.js
 * @description In-app email composer: opens a modal with subject/body fields
 * and posts to the server-side SMTP sender.
 */

/* ============================================================
   EMAIL COMPOSER
   ============================================================ */

/** Open the email composer modal pre-addressed to the given contact. */
window.openEmailComposer = function(contactId, contactName, contactEmail) {
  if (!contactEmail) { showToast('This contact has no email address', 'error'); return; }
  openModal(`Email to ${contactName}`, `
    <div class="form-group">
      <label class="form-label">To</label>
      <input class="form-control" value="${esc(contactEmail)}" readonly style="background:var(--bg);">
    </div>
    <div class="form-group">
      <label class="form-label">Subject *</label>
      <input id="email_subject" class="form-control" placeholder="Subject...">
    </div>
    <div class="form-group">
      <label class="form-label">Message *</label>
      <textarea id="email_body" class="form-control" rows="6" placeholder="Your message..."></textarea>
    </div>
    <div id="email-smtp-note" style="font-size:12px;color:var(--text-muted);margin-top:4px;"><i class="fas fa-info-circle"></i> Requires SMTP configuration on the server.</div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="sendEmail(${contactId})"><i class="fas fa-paper-plane"></i> Send</button>
    </div>
  `);
};

/** Send the composed email; on success logs it as an activity and closes the modal. */
window.sendEmail = async function(contactId) {
  const subject   = document.getElementById('email_subject')?.value?.trim();
  const body_text = document.getElementById('email_body')?.value?.trim();
  if (!subject || !body_text) { showToast('Subject and message are required', 'error'); return; }
  try {
    await api('/api/send-email', { method: 'POST', body: JSON.stringify({ contact_id: contactId, subject, body_text }) });
    showToast('Email sent and logged as activity');
    closeModal();
    delete State.contactCache[contactId];
  } catch(e) { showToast(e.message, 'error'); }
};
