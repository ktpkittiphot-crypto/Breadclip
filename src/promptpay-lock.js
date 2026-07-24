const LOCKED_PROMPTPAY_ID = '1679900640970';

function saveLockedPromptPay() {
  try {
    const saved = localStorage.getItem('breadclip_settings');
    const settings = saved ? JSON.parse(saved) : {};
    localStorage.setItem('breadclip_settings', JSON.stringify({
      ...settings,
      promptpayId: LOCKED_PROMPTPAY_ID,
    }));
  } catch (error) {
    console.warn('Unable to lock Bread Clip PromptPay ID.', error);
  }
}

function lockPromptPayField() {
  document.querySelectorAll('.modal-card label').forEach((label) => {
    if (!label.textContent?.includes('เลขพร้อมเพย์')) return;

    const input = label.querySelector('input');
    if (!input) return;

    input.value = LOCKED_PROMPTPAY_ID;
    input.readOnly = true;
    input.disabled = true;
    input.setAttribute('aria-readonly', 'true');
    input.style.background = '#f4eee8';
    input.style.color = '#6f5a4f';
    input.style.cursor = 'not-allowed';

    if (!label.querySelector('[data-promptpay-locked]')) {
      const note = document.createElement('small');
      note.dataset.promptpayLocked = 'true';
      note.textContent = 'บันทึกไว้ในระบบแล้ว ไม่สามารถแก้ไขได้';
      note.style.display = 'block';
      note.style.marginTop = '7px';
      note.style.color = '#765';
      label.appendChild(note);
    }
  });
}

saveLockedPromptPay();

const observer = new MutationObserver(() => {
  saveLockedPromptPay();
  lockPromptPayField();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', lockPromptPayField);
window.addEventListener('storage', saveLockedPromptPay);
