import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import Tesseract from 'tesseract.js';
import { CheckCircle, Settings, ShoppingBag, Upload, X } from 'lucide-react';
import { generatePayload } from './utils/promptpay';

const PRODUCTS = [
  { id: 'originalQty', label: 'Tiramisu Original Signature', price: 89 },
  { id: 'thaiTeaQty', label: 'Tiramisu Thai Tea', price: 89 },
  { id: 'strawberryQty', label: 'Cheese Pie Strawberry', price: 35 },
  { id: 'blueberryQty', label: 'Cheese Pie Blueberry', price: 35 },
];

const DEFAULT_BACKEND = 'https://script.google.com/macros/s/AKfycbyJSHTGFeJOQVoMGk5lxEblPyJ080L3dWKlJ5rhQN-2vprbSF_RWQ2gOKYMG_KiATSq/exec';

function BrandLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 120 120" aria-label="Bread Clip logo" role="img">
      <circle cx="60" cy="60" r="54" fill="#fff8f1" />
      <path d="M35 47c0-10 8-18 18-18h14c10 0 18 8 18 18v29c0 9-7 16-16 16H51c-9 0-16-7-16-16V47Z" fill="#fff0d8" stroke="#4c2f23" strokeWidth="5" strokeLinejoin="round" />
      <path d="M41 47c0-8 6-14 14-14h10c8 0 14 6 14 14" fill="none" stroke="#4c2f23" strokeWidth="5" strokeLinecap="round" />
      <path d="M78 41c-5-4-13-4-18 1L44 58c-5 5-5 12 0 17s12 5 17 0l18-18c4-4 4-10 0-14s-10-4-14 0L51 57" fill="none" stroke="#ef8d4d" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractAmounts(text) {
  const tokens = String(text || '')
    .replace(/[Oo]/g, '0')
    .match(/\d[\d,.]*\d|\d/g) || [];

  return tokens
    .map((token) => {
      let normalized = token;

      if (normalized.includes('.') && normalized.includes(',')) {
        normalized = normalized.replace(/,/g, '');
      } else if (!normalized.includes('.') && /,\d{1,2}$/.test(normalized)) {
        normalized = normalized.replace(/,/g, '.');
      } else {
        normalized = normalized.replace(/,/g, '');
      }

      const firstDot = normalized.indexOf('.');
      if (firstDot >= 0) {
        normalized = normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '');
      }

      const value = Number(normalized);
      return Number.isFinite(value) ? value : null;
    })
    .filter((value) => value !== null);
}

function hasMatchingAmount(text, expectedAmount) {
  const amounts = extractAmounts(text);
  return {
    matched: amounts.some((amount) => Math.abs(amount - expectedAmount) < 0.01),
    amounts: [...new Set(amounts)].slice(0, 12),
  };
}

export default function App() {
  const [stage, setStage] = useState('form');
  const [form, setForm] = useState({
    name: '', phone: '', social: '',
    originalQty: 0, thaiTeaQty: 0, strawberryQty: 0, blueberryQty: 0,
    deliveryOption: 'fine_arts', customAddress: '',
  });
  const [settings, setSettings] = useState({ promptpayId: '', backendUrl: DEFAULT_BACKEND });
  const [draftSettings, setDraftSettings] = useState(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slip, setSlip] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [status, setStatus] = useState('');
  const [slipCheck, setSlipCheck] = useState({ state: 'idle', message: '' });
  const [processStage, setProcessStage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('breadclip_settings');
    if (saved) {
      try { setSettings((current) => ({ ...current, ...JSON.parse(saved) })); } catch { /* ignore invalid local data */ }
    }
  }, []);

  const subtotal = useMemo(
    () => PRODUCTS.reduce((sum, product) => sum + form[product.id] * product.price, 0),
    [form],
  );
  const deliveryFee = ['delivery_12', 'delivery_19'].includes(form.deliveryOption) && subtotal < 100 ? 5 : 0;
  const total = subtotal + deliveryFee;
  const totalItems = PRODUCTS.reduce((sum, product) => sum + form[product.id], 0);

  let qrPayload = '';
  try {
    if (settings.promptpayId && total > 0) qrPayload = generatePayload(settings.promptpayId, total);
  } catch {
    qrPayload = '';
  }

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'phone' ? value.replace(/\D/g, '') : value }));
  };

  const updateQty = (id, delta) => {
    setForm((current) => ({ ...current, [id]: Math.max(0, current[id] + delta) }));
  };

  const openCheckout = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.social.trim()) return setStatus('กรุณากรอกข้อมูลผู้สั่งให้ครบ');
    if (totalItems < 1) return setStatus('กรุณาเลือกขนมอย่างน้อย 1 ชิ้น');
    if (form.deliveryOption === 'other' && !form.customAddress.trim()) return setStatus('กรุณาระบุสถานที่และเวลารับของ');
    if (!settings.promptpayId.trim()) {
      setDraftSettings(settings);
      setSettingsOpen(true);
      return setStatus('กรุณาตั้งค่าเลขพร้อมเพย์ก่อนชำระเงิน');
    }
    setStatus('');
    setSlipCheck({ state: 'idle', message: '' });
    setStage('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chooseSlip = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (slipPreview) URL.revokeObjectURL(slipPreview);
    setSlip(file);
    setSlipPreview(URL.createObjectURL(file));
    setStatus('');
    setSlipCheck({ state: 'idle', message: 'กดยืนยันเพื่อให้ระบบตรวจยอดเงินในสลิป' });
  };

  const submitOrder = async () => {
    if (!slip) return setStatus('กรุณาแนบสลิปโอนเงิน');
    if (!settings.backendUrl.trim()) return setStatus('กรุณาตั้งค่า Google Apps Script URL');

    setSubmitting(true);
    setProcessStage('checking');
    setStatus('');
    setSlipCheck({ state: 'checking', message: 'กำลังอ่านตัวเลขจากสลิป…' });

    try {
      const ocrResult = await Tesseract.recognize(slip, 'eng', {
        logger: (progress) => {
          if (progress.status === 'recognizing text') {
            const percent = Math.round((progress.progress || 0) * 100);
            setSlipCheck({ state: 'checking', message: `กำลังอ่านตัวเลขจากสลิป… ${percent}%` });
          }
        },
      });

      const amountCheck = hasMatchingAmount(ocrResult.data.text, total);
      if (!amountCheck.matched) {
        const detected = amountCheck.amounts.length
          ? ` ระบบอ่านพบ: ${amountCheck.amounts.join(', ')}`
          : ' ระบบอ่านไม่พบตัวเลขยอดเงิน';
        setSlipCheck({
          state: 'invalid',
          message: `ยอดในสลิปไม่ตรงกับยอดออเดอร์ ${total.toLocaleString('th-TH')} บาท.${detected}`,
        });
        return;
      }

      setSlipCheck({
        state: 'valid',
        message: `ตรวจพบยอด ${total.toLocaleString('th-TH')} บาท ตรงกับออเดอร์`,
      });
      setProcessStage('sending');
      setStatus('กำลังบันทึกออเดอร์…');

      const slipDataUrl = await fileToDataUrl(slip);
      const orderData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        social: form.social.trim(),
        contact: form.social.trim(),
        originalQty: form.originalQty,
        thaiTeaQty: form.thaiTeaQty,
        strawberryQty: form.strawberryQty,
        blueberryQty: form.blueberryQty,
        deliveryOption: form.deliveryOption,
        customAddress: form.customAddress.trim(),
      };
      const payload = {
        action: 'submitOrder',
        orderData,
        name: orderData.name,
        customerName: orderData.name,
        phone: orderData.phone,
        social: orderData.social,
        contact: orderData.social,
        customerDetails: { name: orderData.name, phone: orderData.phone, contact: orderData.social },
        items: {
          original: form.originalQty,
          thaiTea: form.thaiTeaQty,
          strawberry: form.strawberryQty,
          blueberry: form.blueberryQty,
        },
        delivery: form.deliveryOption,
        otherDelivery: form.customAddress.trim(),
        subtotal,
        deliveryFee,
        total,
        totalCost: total,
        paymentStatus: 'ตรวจยอดตรงกับออเดอร์',
        slipAmountVerified: true,
        slipName: slip.name,
        filename: `slip_${Date.now()}_${orderData.name}`,
        slipType: slip.type || 'image/jpeg',
        mimeType: slip.type || 'image/jpeg',
        slipData: slipDataUrl,
        slipBase64: slipDataUrl.split('base64,')[1],
      };

      const response = await fetch(settings.backendUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!(result.ok || result.status === 'success')) throw new Error(result.error || result.message || 'บันทึกออเดอร์ไม่สำเร็จ');
      setStatus('');
      setStage('success');
    } catch (error) {
      setSlipCheck((current) => current.state === 'valid' ? current : { state: 'invalid', message: 'ไม่สามารถอ่านยอดเงินจากสลิปนี้ได้ กรุณาใช้รูปที่คมชัดและเห็นยอดเงินครบ' });
      setStatus(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setProcessStage('');
      setSubmitting(false);
    }
  };

  const saveSettings = () => {
    const next = { promptpayId: draftSettings.promptpayId.trim(), backendUrl: draftSettings.backendUrl.trim() };
    setSettings(next);
    localStorage.setItem('breadclip_settings', JSON.stringify(next));
    setSettingsOpen(false);
    setStatus('บันทึกการตั้งค่าแล้ว');
  };

  const submitButtonText = processStage === 'checking'
    ? 'กำลังตรวจยอด…'
    : processStage === 'sending'
      ? 'กำลังส่งออเดอร์…'
      : 'ยืนยันการสั่งซื้อ';

  return (
    <div className="app-shell">
      <header className="hero">
        <button className="icon-button settings-button" onClick={() => { setDraftSettings(settings); setSettingsOpen(true); }} aria-label="ตั้งค่าร้าน"><Settings size={21} /></button>
        <span className="badge">PRE-ORDER • CHIANG MAI</span>
        <div className="logo-wrap"><BrandLogo /></div>
        <h1>Bread Clip</h1>
        <p className="hero-bio">โฮมเมดขนมพรีออเดอร์สำหรับชาว มช.</p>
        <span className="cmu-pill">Only at CMU</span>
        <p>เปิดพรีออเดอร์วันจันทร์–ศุกร์ รับขนมวันจันทร์</p>
        <small>เก็บในตู้เย็นได้ 5 วัน • แนะนำให้ทานภายใน 3 วัน</small>
      </header>

      <main>
        {stage === 'form' && (
          <form onSubmit={openCheckout}>
            <section className="card">
              <h2>ข้อมูลผู้สั่ง</h2>
              <label>ชื่อผู้สั่ง<input name="name" value={form.name} onChange={updateField} required /></label>
              <label>เบอร์โทรศัพท์<input name="phone" inputMode="tel" value={form.phone} onChange={updateField} required /></label>
              <label>IG / Line / ช่องทางติดต่ออื่น<input name="social" value={form.social} onChange={updateField} required /></label>
            </section>

            <section className="card">
              <h2>เลือกขนม</h2>
              {PRODUCTS.map((product) => (
                <div className="product" key={product.id}>
                  <div><strong>{product.label}</strong><small>{product.price} บาท</small></div>
                  <div className="stepper"><button type="button" onClick={() => updateQty(product.id, -1)}>−</button><span>{form[product.id]}</span><button type="button" onClick={() => updateQty(product.id, 1)}>+</button></div>
                </div>
              ))}
            </section>

            <section className="card">
              <h2>วิธีรับของ</h2>
              <label className="radio"><input type="radio" name="deliveryOption" value="fine_arts" checked={form.deliveryOption === 'fine_arts'} onChange={updateField} /> รับที่คณะวิจิตรศิลป์ <span>ฟรี • 12:00–13:00</span></label>
              <label className="radio"><input type="radio" name="deliveryOption" value="delivery_12" checked={form.deliveryOption === 'delivery_12'} onChange={updateField} /> จัดส่ง 12:00–13:00 <span>+5 บาท</span></label>
              <label className="radio"><input type="radio" name="deliveryOption" value="delivery_19" checked={form.deliveryOption === 'delivery_19'} onChange={updateField} /> จัดส่ง 19:00–20:00 <span>+5 บาท</span></label>
              <label className="radio"><input type="radio" name="deliveryOption" value="other" checked={form.deliveryOption === 'other'} onChange={updateField} /> อื่นๆ</label>
              {form.deliveryOption === 'other' && <textarea name="customAddress" value={form.customAddress} onChange={updateField} placeholder="กรอกสถานที่และเวลาที่สะดวก" required />}
              <p className="free-note">ยอดขนมตั้งแต่ 100 บาท ส่งฟรี</p>
            </section>

            <section className="card total-card"><span>ยอดรวม</span><strong>{total.toLocaleString('th-TH')} บาท</strong></section>
            {status && <p className="status error">{status}</p>}
            <button className="primary-button" type="submit"><ShoppingBag size={20} /> ดำเนินการชำระเงิน</button>
          </form>
        )}

        {stage === 'checkout' && (
          <section className="card checkout-card">
            <h2>ชำระเงิน</h2>
            <div className="total-row"><span>ยอดรวม</span><strong>{total.toLocaleString('th-TH')} บาท</strong></div>
            {qrPayload ? <div className="qr-wrap"><QRCode value={qrPayload} size={220} /></div> : <p className="status error">ไม่สามารถสร้าง QR ได้ กรุณาตรวจเลขพร้อมเพย์ในการตั้งค่า</p>}
            <p className="qr-caption">สแกน QR เพื่อชำระยอดตามออเดอร์</p>
            <label className="upload-box" htmlFor="slip"><Upload size={30} /><span>{slip ? 'เปลี่ยนรูปสลิป' : 'แนบสลิปโอนเงิน'}</span></label>
            <input id="slip" className="hidden-input" type="file" accept="image/*" onChange={chooseSlip} />
            {slipPreview && <img className="slip-preview" src={slipPreview} alt="ตัวอย่างสลิป" />}
            {slipCheck.message && <p className={`status ${slipCheck.state === 'valid' ? 'success' : slipCheck.state === 'checking' ? 'checking' : 'error'}`}>{slipCheck.message}</p>}
            {status && <p className="status error">{status}</p>}
            <div className="button-row"><button className="secondary-button" type="button" onClick={() => setStage('form')} disabled={submitting}>กลับไปแก้ไข</button><button className="primary-button" type="button" onClick={submitOrder} disabled={submitting}>{submitButtonText}</button></div>
          </section>
        )}

        {stage === 'success' && (
          <section className="card success-card"><CheckCircle size={68} /><h2>สั่งซื้อสำเร็จ!</h2><p>ตรวจพบยอดเงินตรงกับออเดอร์ และบันทึกข้อมูลพร้อมสลิปเรียบร้อยแล้ว</p><button className="primary-button" onClick={() => window.location.reload()}>กลับสู่หน้าหลัก</button></section>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button className="icon-button modal-close" onClick={() => setSettingsOpen(false)} aria-label="ปิด"><X /></button>
            <h2>ตั้งค่าร้าน</h2>
            <label>เลขพร้อมเพย์<input value={draftSettings.promptpayId} onChange={(e) => setDraftSettings({ ...draftSettings, promptpayId: e.target.value })} placeholder="เบอร์โทรหรือเลขบัตรประชาชน" /></label>
            <label>Google Apps Script Web App URL<input value={draftSettings.backendUrl} onChange={(e) => setDraftSettings({ ...draftSettings, backendUrl: e.target.value })} placeholder="https://script.google.com/macros/s/.../exec" /></label>
            <button className="primary-button" onClick={saveSettings}>บันทึกการตั้งค่า</button>
          </div>
        </div>
      )}
    </div>
  );
}
