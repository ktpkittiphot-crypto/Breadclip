const SETTINGS_PIN = window.atob('MTY3OTkw');

let allowNextSettingsClick = false;
let pendingSettingsButton = null;

function correctProductLabels() {
  const replacements = {
    'Cheese Pie Strawberry': 'Strawberry Cheese Pie',
    'Cheese Pie Blueberry': 'Blueberry Cheese Pie',
  };

  document.querySelectorAll('.product strong').forEach((element) => {
    const replacement = replacements[element.textContent.trim()];
    if (replacement) element.textContent = replacement;
  });
}

function closePinDialog() {
  document.getElementById('breadclip-settings-pin')?.remove();
  pendingSettingsButton = null;
}

function openPinDialog(settingsButton) {
  pendingSettingsButton = settingsButton;
  if (document.getElementById('breadclip-settings-pin')) return;

  const overlay = document.createElement('div');
  overlay.id = 'breadclip-settings-pin';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <form style="width:min(92%,420px);background:#fff;padding:24px;border-radius:22px;box-shadow:0 24px 70px #0004;position:relative;color:#4c2f23;font-family:Prompt,system-ui,sans-serif">
      <button type="button" data-close aria-label="ปิด" style="position:absolute;right:14px;top:10px;border:0;background:transparent;font-size:28px;cursor:pointer;color:#4c2f23">×</button>
      <div style="font-size:32px;margin-bottom:8px">🔒</div>
      <h2 style="margin:0 0 8px">รหัสเจ้าของร้าน</h2>
      <p style="margin:0 0 16px;color:#765">กรอกรหัสก่อนเปลี่ยนแปลงการตั้งค่าเว็บ</p>
      <label style="display:block;font-weight:600;text-align:left">รหัสตั้งค่า
        <input data-pin type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="รหัส 6 หลัก" style="display:block;width:100%;margin-top:7px;padding:13px;border:1px solid #eadaca;border-radius:12px;font:inherit;box-sizing:border-box">
      </label>
      <p data-error style="display:none;color:#8a321e;font-weight:600;text-align:center;margin:12px 0"></p>
      <button type="submit" style="width:100%;margin-top:14px;padding:15px;border:0;border-radius:15px;background:#4c2f23;color:#fff;font:inherit;font-weight:700;cursor:pointer">เข้าสู่การตั้งค่า</button>
    </form>
  `;

  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    padding: '20px',
    background: 'rgba(0,0,0,.55)',
    display: 'grid',
    placeItems: 'center',
  });

  const form = overlay.querySelector('form');
  const input = overlay.querySelector('[data-pin]');
  const error = overlay.querySelector('[data-error]');

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
    error.style.display = 'none';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value !== SETTINGS_PIN) {
      error.textContent = 'รหัสไม่ถูกต้อง';
      error.style.display = 'block';
      input.select();
      return;
    }

    const button = pendingSettingsButton;
    closePinDialog();
    if (button) {
      allowNextSettingsClick = true;
      button.click();
    }
  });

  overlay.querySelector('[data-close]').addEventListener('click', closePinDialog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePinDialog();
  });

  document.body.appendChild(overlay);
  window.setTimeout(() => input.focus(), 0);
}

document.addEventListener('click', (event) => {
  const settingsButton = event.target.closest?.('.settings-button');
  if (!settingsButton) return;

  if (allowNextSettingsClick) {
    allowNextSettingsClick = false;
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPinDialog(settingsButton);
}, true);

const observer = new MutationObserver(correctProductLabels);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', correctProductLabels);
