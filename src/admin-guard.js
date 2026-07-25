const SETTINGS_PIN = window.atob('MTY3OTkw');
const FORM_MODE_KEY = 'breadclip_admin_form_mode';
const VALID_FORM_MODES = ['auto', 'open', 'closed'];
const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyJSHTGFeJOQVoMGk5lxEblPyJ080L3dWKlJ5rhQN-2vprbSF_RWQ2gOKYMG_KiATSq/exec';

function getBackendUrl() {
  try {
    const saved = localStorage.getItem('breadclip_settings');
    const settings = saved ? JSON.parse(saved) : {};
    return String(settings.backendUrl || DEFAULT_BACKEND_URL).trim();
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

function getFormMode() {
  const saved = localStorage.getItem(FORM_MODE_KEY);
  return VALID_FORM_MODES.includes(saved) ? saved : 'auto';
}

function saveFormMode(mode) {
  const nextMode = VALID_FORM_MODES.includes(mode) ? mode : 'auto';
  localStorage.setItem(FORM_MODE_KEY, nextMode);
  return nextMode;
}

async function setGlobalFormMode(mode) {
  const backendUrl = getBackendUrl();
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'setFormMode',
      adminPin: SETTINGS_PIN,
      formMode: mode,
    }),
  });

  const result = await response.json();
  if (!result.ok || !VALID_FORM_MODES.includes(result.formMode)) {
    throw new Error(result.error || result.message || 'บันทึกสถานะรับออเดอร์ไม่สำเร็จ');
  }
  return result;
}

// Keep the real date formatter, but let the preorder weekday check follow Admin mode.
// The mode is read each time, so a value loaded before React starts works immediately.
const NativeDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function BreadClipDateTimeFormat(locales, options = {}) {
  const formatter = new NativeDateTimeFormat(locales, options);
  const isPreorderWeekdayCheck = options?.weekday === 'short' && options?.timeZone === 'Asia/Bangkok';
  if (!isPreorderWeekdayCheck) return formatter;

  return new Proxy(formatter, {
    get(target, property) {
      if (property === 'format') {
        return (...args) => {
          const mode = getFormMode();
          if (mode === 'open') return 'Mon';
          if (mode === 'closed') return 'Sat';
          return target.format(...args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};
Intl.DateTimeFormat.prototype = NativeDateTimeFormat.prototype;
Intl.DateTimeFormat.supportedLocalesOf = NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);

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

function removeCouponDisclosure() {
  const targetText = 'ระบบตรวจการใช้ซ้ำจากชื่อ เบอร์โทร หรือช่องทางติดต่อ โดยตรวจจากประวัติออเดอร์ใน Google Sheet';
  document.querySelectorAll('small').forEach((element) => {
    if (element.textContent.trim() === targetText) element.remove();
  });
}

function injectAdminFormMode() {
  const modal = document.querySelector('.modal-card');
  if (!modal || modal.querySelector('#breadclip-admin-form-mode')) return;

  const saveButton = [...modal.querySelectorAll('button')]
    .find((button) => button.textContent.includes('บันทึกการตั้งค่า'));
  if (!saveButton) return;

  const currentMode = getFormMode();
  const panel = document.createElement('section');
  panel.id = 'breadclip-admin-form-mode';
  panel.style.cssText = 'margin:18px 0;padding:14px;border:1px solid #eadaca;border-radius:14px;background:#fff9f2;text-align:left';
  panel.innerHTML = `
    <h3 style="margin:0 0 6px;color:#4c2f23">เปิด–ปิดรับออเดอร์</h3>
    <p style="margin:0 0 12px;color:#765;font-size:13px;line-height:1.6">เลือกสถานะที่ต้องการ แล้วกดบันทึก สถานะจะมีผลกับลูกค้าทุกเครื่อง</p>
    <label class="radio" style="display:block;margin:10px 0">
      <input type="radio" name="breadclipFormMode" value="open" ${currentMode === 'open' ? 'checked' : ''}>
      เปิดรับออเดอร์
      <span>เปิดฟอร์มทันที ไม่จำกัดวัน</span>
    </label>
    <label class="radio" style="display:block;margin:10px 0">
      <input type="radio" name="breadclipFormMode" value="closed" ${currentMode === 'closed' ? 'checked' : ''}>
      ปิดรับออเดอร์
      <span>ปิดฟอร์มทันทีจนกว่า Admin จะเปิดใหม่</span>
    </label>
    <label class="radio" style="display:block;margin:10px 0">
      <input type="radio" name="breadclipFormMode" value="auto" ${currentMode === 'auto' ? 'checked' : ''}>
      เปิด–ปิดอัตโนมัติ
      <span>เปิดจันทร์–ศุกร์ และปิดเสาร์–อาทิตย์</span>
    </label>
    <p data-form-mode-status style="display:none;font-weight:600;margin:10px 0 0;line-height:1.5"></p>
  `;

  saveButton.before(panel);
  saveButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const selected = panel.querySelector('input[name="breadclipFormMode"]:checked')?.value || 'auto';
    const status = panel.querySelector('[data-form-mode-status]');
    const originalText = saveButton.textContent;

    status.style.display = 'block';
    status.style.color = '#765';
    status.textContent = 'กำลังบันทึกสถานะรับออเดอร์…';
    saveButton.disabled = true;
    saveButton.textContent = 'กำลังบันทึก…';

    try {
      const result = await setGlobalFormMode(selected);
      saveFormMode(result.formMode);
      status.style.color = '#327a5d';
      status.textContent = result.isOpen ? 'เปิดรับออเดอร์แล้ว' : 'ปิดรับออเดอร์แล้ว';
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      status.style.color = '#8a321e';
      status.textContent = `${error.message} — กรุณา Deploy Google Apps Script เวอร์ชันล่าสุด`;
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }, true);
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
    position: 'fixed', inset: '0', zIndex: '9999', padding: '20px',
    background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center',
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

const observer = new MutationObserver(() => {
  correctProductLabels();
  removeCouponDisclosure();
  injectAdminFormMode();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('DOMContentLoaded', () => {
  correctProductLabels();
  removeCouponDisclosure();
  injectAdminFormMode();
});
