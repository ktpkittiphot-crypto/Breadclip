import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import Tesseract from 'tesseract.js';
import { CheckCircle, Download, Settings, ShoppingBag, Tag, Upload, X } from 'lucide-react';
import { generatePayload } from './utils/promptpay';

const PRODUCTS = [
  { id: 'originalQty', label: 'Tiramisu Original Signature', price: 89 },
  { id: 'thaiTeaQty', label: 'Tiramisu Thai Tea', price: 89 },
  { id: 'strawberryQty', label: 'Strawberry Cheese Pie', price: 35 },
  { id: 'blueberryQty', label: 'Blueberry Cheese Pie', price: 35 },
];

const DELIVERY_AREAS = {
  back_gate: 'หลังมอ',
  front_gate: 'หน้ามอ',
  suan_dok: 'สวนดอก',
  other_faculty: 'คณะต่าง ๆ',
};

const DELIVERY_AREA_PLACEHOLDERS = {
  back_gate: 'ระบุหอพัก ร้าน หรือจุดนัดรับบริเวณหลังมอ',
  front_gate: 'ระบุหอพัก ร้าน หรือจุดนัดรับบริเวณหน้ามอ',
  suan_dok: 'ระบุอาคาร โรงพยาบาล หรือจุดนัดรับสวนดอก',
  other_faculty: 'ระบุชื่อคณะ อาคาร หรือจุดนัดรับ',
};

const DEFAULT_BACKEND = 'https://script.google.com/macros/s/AKfycbyJSHTGFeJOQVoMGk5lxEblPyJ080L3dWKlJ5rhQN-2vprbSF_RWQ2gOKYMG_KiATSq/exec';
const LOCKED_PROMPTPAY_ID = '1679900640970';

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

function isPreorderOpenNow() {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function formatBangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function normalizeCouponCode(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => replacements[character]);
}

function downloadReceipt(receipt) {
  if (!receipt) return;

  const itemRows = PRODUCTS
    .filter((product) => Number(receipt.items[product.id] || 0) > 0)
    .map((product) => {
      const quantity = Number(receipt.items[product.id] || 0);
      const lineTotal = quantity * product.price;
      return `
        <tr>
          <td>${escapeHtml(product.label)}</td>
          <td class="number">${quantity}</td>
          <td class="number">${lineTotal.toLocaleString('th-TH')} บาท</td>
        </tr>`;
    })
    .join('');

  const couponRow = receipt.couponDiscount > 0
    ? `<div><span>คูปอง ${escapeHtml(receipt.couponCode)}</span><span>−${receipt.couponDiscount.toLocaleString('th-TH')} บาท</span></div>`
    : '';

  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ใบเสร็จ Bread Clip ${escapeHtml(receipt.orderId)}</title>
  <style>
    body{font-family:Arial,'Noto Sans Thai',sans-serif;color:#2b1b14;margin:0;padding:24px;background:#f7f3ee}
    .receipt{max-width:620px;margin:auto;background:#fff;border:1px solid #ddd;padding:28px}
    h1{margin:0 0 4px;font-size:28px}h2{margin:0 0 24px;font-size:18px;font-weight:normal}
    .meta{line-height:1.7;margin-bottom:20px}.note{padding:14px;background:#fff3dc;border:1px solid #ead1aa;margin:20px 0;font-weight:bold}
    table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:10px 6px;border-bottom:1px solid #ddd;text-align:left}.number{text-align:right}
    .totals{margin-left:auto;width:min(100%,350px)}.totals div{display:flex;justify-content:space-between;gap:18px;padding:5px 0}.grand{font-size:20px;font-weight:bold;border-top:2px solid #2b1b14;margin-top:5px;padding-top:10px!important}
    .footer{margin-top:28px;text-align:center;color:#666;font-size:13px}@media print{body{background:#fff;padding:0}.receipt{border:0}}
  </style>
</head>
<body>
  <main class="receipt">
    <h1>Bread Clip</h1>
    <h2>ใบเสร็จรับเงิน / Order Receipt</h2>
    <div class="meta">
      <div><strong>เลขออเดอร์:</strong> ${escapeHtml(receipt.orderId)}</div>
      <div><strong>วันที่:</strong> ${escapeHtml(receipt.createdAt)}</div>
      <div><strong>ลูกค้า:</strong> ${escapeHtml(receipt.name)}</div>
      <div><strong>เบอร์โทร:</strong> ${escapeHtml(receipt.phone)}</div>
      <div><strong>ช่องทางติดต่อ:</strong> ${escapeHtml(receipt.contact)}</div>
      <div><strong>วิธีรับของ:</strong> ${escapeHtml(receipt.deliverySummary)}</div>
    </div>
    <table>
      <thead><tr><th>สินค้า</th><th class="number">จำนวน</th><th class="number">ราคา</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      <div><span>ยอดสินค้า</span><span>${receipt.subtotal.toLocaleString('th-TH')} บาท</span></div>
      <div><span>ค่าจัดส่ง</span><span>${receipt.deliveryFee === 0 ? 'ฟรี' : `${receipt.deliveryFee.toLocaleString('th-TH')} บาท`}</span></div>
      ${couponRow}
      <div class="grand"><span>ยอดชำระ</span><span>${receipt.total.toLocaleString('th-TH')} บาท</span></div>
    </div>
    <div class="note">ชำระเงินแล้ว — รอรับขนมวันจันทร์</div>
    <div class="footer">ขอบคุณที่อุดหนุน Bread Clip • Only at CMU</div>
  </main>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `BreadClip-Receipt-${receipt.orderId || 'order'}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [stage, setStage] = useState('form');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    social: '',
    originalQty: 0,
    thaiTeaQty: 0,
    strawberryQty: 0,
    blueberryQty: 0,
    deliveryOption: 'fine_arts',
    deliveryArea: 'back_gate',
    areaDetails: '',
  });
  const [settings, setSettings] = useState({ promptpayId: LOCKED_PROMPTPAY_ID, backendUrl: DEFAULT_BACKEND });
  const [draftSettings, setDraftSettings] = useState({ promptpayId: LOCKED_PROMPTPAY_ID, backendUrl: DEFAULT_BACKEND });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slip, setSlip] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [status, setStatus] = useState('');
  const [slipCheck, setSlipCheck] = useState({ state: 'idle', message: '' });
  const [processStage, setProcessStage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [isPreorderOpen, setIsPreorderOpen] = useState(() => isPreorderOpenNow());
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState({ state: 'idle', code: '', discount: 0, message: '' });
  const [couponApplying, setCouponApplying] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('breadclip_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const next = {
          ...parsed,
          promptpayId: LOCKED_PROMPTPAY_ID,
          backendUrl: parsed.backendUrl || DEFAULT_BACKEND,
        };
        setSettings(next);
        setDraftSettings(next);
        localStorage.setItem('breadclip_settings', JSON.stringify(next));
      } catch {
        // Ignore invalid local data.
      }
    }

    const updateOpenStatus = () => setIsPreorderOpen(isPreorderOpenNow());
    const timer = window.setInterval(updateOpenStatus, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const subtotal = useMemo(
    () => PRODUCTS.reduce((sum, product) => sum + form[product.id] * product.price, 0),
    [form],
  );

  const deliveryFee = form.deliveryOption === 'delivery' && subtotal < 100 ? 5 : 0;
  const couponDiscount = coupon.state === 'valid' ? coupon.discount : 0;
  const totalBeforeDiscount = subtotal + deliveryFee;
  const total = Math.max(0, totalBeforeDiscount - couponDiscount);
  const totalItems = PRODUCTS.reduce((sum, product) => sum + form[product.id], 0);

  const deliveryAreaLabel = form.deliveryOption === 'delivery'
    ? `${DELIVERY_AREAS[form.deliveryArea]}: ${form.areaDetails.trim()}`
    : '';
  const deliveryTimeLabel = form.deliveryArea === 'other_faculty' ? '12:00–13:00' : '20:00–21:00';
  const deliveryFeeLabel = deliveryFee === 0 ? 'ส่งฟรี' : '+5 บาท';
  const deliverySummary = form.deliveryOption === 'fine_arts'
    ? 'รับที่คณะวิจิตรศิลป์ • 12:00–13:00'
    : `จัดส่ง ${deliveryAreaLabel} • ${deliveryTimeLabel} (${deliveryFeeLabel})`;

  let qrPayload = '';
  try {
    if (total > 0) qrPayload = generatePayload(LOCKED_PROMPTPAY_ID, total);
  } catch {
    qrPayload = '';
  }

  const invalidateCoupon = (message = '') => {
    setCoupon((current) => ({
      state: 'idle',
      code: '',
      discount: 0,
      message: current.state === 'valid' ? message : '',
    }));
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'phone' ? value.replace(/\D/g, '') : value,
      ...(name === 'deliveryArea' ? { areaDetails: '' } : {}),
    }));

    if (['name', 'phone', 'social'].includes(name) && coupon.state === 'valid') {
      invalidateCoupon('ข้อมูลผู้สั่งเปลี่ยน กรุณากดใช้คูปองอีกครั้ง');
    }
  };

  const updateQty = (id, delta) => {
    setForm((current) => ({ ...current, [id]: Math.max(0, current[id] + delta) }));
  };

  const applyCoupon = async () => {
    const code = normalizeCouponCode(couponInput);
    if (!code) {
      setCoupon({ state: 'idle', code: '', discount: 0, message: 'กรุณากรอกรหัสคูปอง' });
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.social.trim()) {
      setCoupon({ state: 'invalid', code: '', discount: 0, message: 'กรุณากรอกชื่อ เบอร์โทร และช่องทางติดต่อก่อนใช้คูปอง' });
      return;
    }
    if (!settings.backendUrl.trim()) {
      setCoupon({ state: 'invalid', code: '', discount: 0, message: 'ไม่พบ Backend URL กรุณาตรวจการตั้งค่า' });
      return;
    }

    setCouponApplying(true);
    setCoupon({ state: 'checking', code, discount: 0, message: 'กำลังตรวจสอบสิทธิ์คูปอง…' });

    try {
      const response = await fetch(settings.backendUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'validateCoupon',
          couponCode: code,
          name: form.name.trim(),
          phone: form.phone.trim(),
          contact: form.social.trim(),
        }),
      });
      const result = await response.json();
      if (!result.ok || !result.eligible) {
        setCoupon({
          state: 'invalid',
          code: '',
          discount: 0,
          message: result.message || result.error || 'ไม่สามารถใช้คูปองนี้ได้',
        });
        return;
      }

      setCouponInput(code);
      setCoupon({
        state: 'valid',
        code,
        discount: Number(result.discount || 0),
        message: result.message || `ใช้คูปองสำเร็จ ลด ${Number(result.discount || 0)} บาท`,
      });
    } catch (error) {
      setCoupon({ state: 'invalid', code: '', discount: 0, message: `ตรวจคูปองไม่สำเร็จ: ${error.message}` });
    } finally {
      setCouponApplying(false);
    }
  };

  const openCheckout = (event) => {
    event.preventDefault();
    if (!isPreorderOpen) {
      return setStatus('ขออภัยรอรอบถัดไปนะครับ <3 รอบถัดไปเปิดพรีออเดอร์ จันทร์ ถึง ศุกร์');
    }
    if (!form.name.trim() || !form.phone.trim() || !form.social.trim()) {
      return setStatus('กรุณากรอกข้อมูลผู้สั่งให้ครบ');
    }
    if (totalItems < 1) return setStatus('กรุณาเลือกขนมอย่างน้อย 1 ชิ้น');
    if (form.deliveryOption === 'delivery' && !form.areaDetails.trim()) {
      return setStatus(`กรุณาระบุรายละเอียดจุดรับสำหรับ${DELIVERY_AREAS[form.deliveryArea]}`);
    }
    if (normalizeCouponCode(couponInput) && (coupon.state !== 'valid' || coupon.code !== normalizeCouponCode(couponInput))) {
      return setStatus('กรุณากดใช้คูปองและรอระบบยืนยันสิทธิ์ก่อนชำระเงิน');
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
    if (!isPreorderOpen) {
      setStage('form');
      return setStatus('ขออภัยรอรอบถัดไปนะครับ <3 รอบถัดไปเปิดพรีออเดอร์ จันทร์ ถึง ศุกร์');
    }
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

      setSlipCheck({ state: 'valid', message: `ตรวจพบยอด ${total.toLocaleString('th-TH')} บาท ตรงกับออเดอร์` });
      setProcessStage('sending');
      setStatus('กำลังบันทึกออเดอร์…');

      const slipDataUrl = await fileToDataUrl(slip);
      const deliveryDetails = form.deliveryOption === 'delivery'
        ? `สถานที่: ${deliveryAreaLabel} | เวลา: ${deliveryTimeLabel}`
        : '';
      const orderData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        social: form.social.trim(),
        contact: form.social.trim(),
        originalQty: form.originalQty,
        thaiTeaQty: form.thaiTeaQty,
        strawberryQty: form.strawberryQty,
        blueberryQty: form.blueberryQty,
        deliveryMode: form.deliveryOption,
        deliveryOption: deliverySummary,
        deliveryArea: deliveryAreaLabel,
        deliveryTime: deliveryTimeLabel,
        customAddress: deliveryDetails,
        couponCode: coupon.code,
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
        deliveryMode: form.deliveryOption,
        delivery: deliverySummary,
        deliveryArea: deliveryAreaLabel,
        deliveryTime: deliveryTimeLabel,
        otherDelivery: deliveryDetails,
        subtotal,
        deliveryFee,
        couponCode: coupon.code,
        couponDiscount,
        totalBeforeDiscount,
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
      if (!(result.ok || result.status === 'success')) {
        throw new Error(result.error || result.message || 'บันทึกออเดอร์ไม่สำเร็จ');
      }

      setReceipt({
        orderId: result.orderId || `BC-${Date.now()}`,
        createdAt: formatBangkokDate(),
        name: orderData.name,
        phone: orderData.phone,
        contact: orderData.contact,
        items: {
          originalQty: form.originalQty,
          thaiTeaQty: form.thaiTeaQty,
          strawberryQty: form.strawberryQty,
          blueberryQty: form.blueberryQty,
        },
        subtotal: Number(result.subtotal ?? subtotal),
        deliveryFee: Number(result.deliveryFee ?? deliveryFee),
        couponCode: result.couponCode || coupon.code,
        couponDiscount: Number(result.couponDiscount ?? couponDiscount),
        total: Number(result.total ?? total),
        deliverySummary,
      });
      setStatus('');
      setStage('success');
    } catch (error) {
      setSlipCheck((current) => current.state === 'valid'
        ? current
        : { state: 'invalid', message: 'ไม่สามารถอ่านยอดเงินจากสลิปนี้ได้ กรุณาใช้รูปที่คมชัดและเห็นยอดเงินครบ' });
      setStatus(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setProcessStage('');
      setSubmitting(false);
    }
  };

  const saveSettings = () => {
    const next = {
      promptpayId: LOCKED_PROMPTPAY_ID,
      backendUrl: draftSettings.backendUrl.trim() || DEFAULT_BACKEND,
    };
    setSettings(next);
    setDraftSettings(next);
    localStorage.setItem('breadclip_settings', JSON.stringify(next));
    setSettingsOpen(false);
    setStatus('บันทึกการตั้งค่าแล้ว');
  };

  const submitButtonText = processStage === 'checking'
    ? 'กำลังตรวจยอด…'
    : processStage === 'sending'
      ? 'กำลังส่งออเดอร์…'
      : 'ยืนยันการสั่งซื้อ';

  const detailsStyle = {
    margin: '10px 0 14px',
    padding: '14px',
    border: '1px solid #eadaca',
    borderRadius: '14px',
    background: '#fff9f2',
    textAlign: 'left',
  };

  const priceSummary = (
    <div style={{ display: 'grid', gap: '7px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}><span>ยอดสินค้า</span><span>{subtotal.toLocaleString('th-TH')} บาท</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}><span>ค่าจัดส่ง</span><span>{deliveryFee === 0 ? 'ฟรี' : `${deliveryFee} บาท`}</span></div>
      {couponDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#327a5d' }}><span>ส่วนลดคูปอง</span><span>−{couponDiscount.toLocaleString('th-TH')} บาท</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', paddingTop: '10px', borderTop: '1px solid #eadaca', fontWeight: 700 }}><span>ยอดรวม</span><strong style={{ fontSize: '27px' }}>{total.toLocaleString('th-TH')} บาท</strong></div>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="hero">
        <button className="icon-button settings-button" onClick={() => { setDraftSettings(settings); setSettingsOpen(true); }} aria-label="ตั้งค่าร้าน"><Settings size={21} /></button>
        <span className="badge">PRE-ORDER • CHIANG MAI</span>
        <div className="logo-wrap"><BrandLogo /></div>
        <h1>Bread Clip</h1>
        <span className="cmu-pill">Only at CMU</span>
        <p>เปิดพรีออเดอร์วันจันทร์–ศุกร์ รับขนมวันจันทร์</p>
        <small>เก็บในตู้เย็นได้ 5 วัน • แนะนำให้ทานภายใน 3 วัน</small>
      </header>

      <main>
        {stage === 'form' && !isPreorderOpen && (
          <section className="card" style={{ textAlign: 'center', padding: '36px 22px' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>🍰</div>
            <h2>ปิดรับพรีออเดอร์ชั่วคราว</h2>
            <p style={{ fontSize: '18px', lineHeight: 1.8, marginBottom: 0 }}>
              ขออภัยรอรอบถัดไปนะครับ &lt;3<br />
              รอบถัดไปเปิดพรีออเดอร์ จันทร์ ถึง ศุกร์
            </p>
          </section>
        )}

        {stage === 'form' && isPreorderOpen && (
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
              <h2><Tag size={20} style={{ verticalAlign: 'middle', marginRight: '7px' }} />คูปองส่วนลด</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '9px', alignItems: 'end' }}>
                <label style={{ margin: 0 }}>รหัสคูปอง
                  <input
                    value={couponInput}
                    onChange={(event) => {
                      setCouponInput(event.target.value);
                      setCoupon({ state: 'idle', code: '', discount: 0, message: '' });
                    }}
                    placeholder="กรอกรหัสคูปอง"
                    autoCapitalize="none"
                  />
                </label>
                <button className="primary-button" type="button" onClick={applyCoupon} disabled={couponApplying} style={{ width: 'auto', minWidth: '92px' }}>
                  {couponApplying ? 'กำลังตรวจ…' : 'ใช้คูปอง'}
                </button>
              </div>
              {coupon.message && <p className={`status ${coupon.state === 'valid' ? 'success' : coupon.state === 'checking' ? 'checking' : 'error'}`} style={{ marginBottom: 0 }}>{coupon.message}</p>}
              <small style={{ display: 'block', marginTop: '10px', color: '#765', lineHeight: 1.6 }}>ระบบตรวจการใช้ซ้ำจากชื่อ เบอร์โทร หรือช่องทางติดต่อ โดยตรวจจากประวัติออเดอร์ใน Google Sheet</small>
            </section>

            <section className="card">
              <h2>วิธีรับของ</h2>
              <label className="radio">
                <input type="radio" name="deliveryOption" value="fine_arts" checked={form.deliveryOption === 'fine_arts'} onChange={updateField} />
                รับที่คณะวิจิตรศิลป์
                <span>ฟรี • 12:00–13:00</span>
              </label>
              <label className="radio">
                <input type="radio" name="deliveryOption" value="delivery" checked={form.deliveryOption === 'delivery'} onChange={updateField} />
                จัดส่งในพื้นที่ มช.
                <span><strong>{subtotal >= 100 ? 'ส่งฟรี' : '+5 บาท'}</strong> • ยอดขนมตั้งแต่ 100 บาทส่งฟรี</span>
              </label>

              {form.deliveryOption === 'delivery' && (
                <div style={detailsStyle}>
                  <h3 style={{ margin: '0 0 8px' }}>สถานที่จัดส่ง</h3>
                  {Object.entries(DELIVERY_AREAS).map(([value, label]) => (
                    <label className="radio" key={value}>
                      <input type="radio" name="deliveryArea" value={value} checked={form.deliveryArea === value} onChange={updateField} />
                      {label}
                    </label>
                  ))}
                  <input name="areaDetails" value={form.areaDetails} onChange={updateField} placeholder={DELIVERY_AREA_PLACEHOLDERS[form.deliveryArea]} required />
                  <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: '#fff3dc', lineHeight: 1.6 }}>
                    <strong>เวลาจัดส่ง: {deliveryTimeLabel}</strong><br />
                    <small>{form.deliveryArea === 'other_faculty' ? 'คณะต่าง ๆ จัดส่งช่วง 12:00–13:00' : 'หลังมอ หน้ามอ และสวนดอก จัดส่งช่วง 20:00–21:00 เท่านั้น'}</small>
                  </div>
                </div>
              )}
            </section>

            <section className="card">{priceSummary}</section>
            {status && <p className="status error">{status}</p>}
            <button className="primary-button" type="submit"><ShoppingBag size={20} /> ดำเนินการชำระเงิน</button>
          </form>
        )}

        {stage === 'checkout' && (
          <section className="card checkout-card">
            <h2>ชำระเงิน</h2>
            <div style={{ textAlign: 'left' }}>{priceSummary}</div>
            <p style={{ margin: '12px 0 8px', color: '#765' }}>{deliverySummary}</p>
            {couponDiscount > 0 && <p className="status success" style={{ margin: '8px 0' }}>ใช้คูปอง {coupon.code} ลด {couponDiscount} บาท</p>}
            {qrPayload ? <div className="qr-wrap"><QRCode value={qrPayload} size={220} /></div> : <p className="status error">ไม่สามารถสร้าง QR ได้</p>}
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
          <section className="card success-card">
            <CheckCircle size={68} />
            <h2>สั่งซื้อสำเร็จ!</h2>
            <p>ตรวจพบยอดเงินตรงกับออเดอร์ และบันทึกข้อมูลพร้อมสลิปเรียบร้อยแล้ว</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#4c2f23' }}>รอรับขนมวันจันทร์นะครับ 🍰</p>
            {receipt?.orderId && <p style={{ color: '#765' }}>เลขออเดอร์: <strong>{receipt.orderId}</strong></p>}
            <div style={{ display: 'grid', gap: '10px', width: '100%', marginTop: '18px' }}>
              <button className="primary-button" type="button" onClick={() => downloadReceipt(receipt)}><Download size={20} /> ดาวน์โหลดใบเสร็จ</button>
              <button className="secondary-button" type="button" onClick={() => window.location.reload()}>กลับสู่หน้าหลัก</button>
            </div>
          </section>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button className="icon-button modal-close" onClick={() => setSettingsOpen(false)} aria-label="ปิด"><X /></button>
            <h2>ตั้งค่าร้าน</h2>
            <label>เลขพร้อมเพย์<input value={LOCKED_PROMPTPAY_ID} readOnly disabled /></label>
            <label>Google Apps Script Web App URL<input value={draftSettings.backendUrl} onChange={(event) => setDraftSettings({ ...draftSettings, backendUrl: event.target.value, promptpayId: LOCKED_PROMPTPAY_ID })} placeholder="https://script.google.com/macros/s/.../exec" /></label>
            <button className="primary-button" onClick={saveSettings}>บันทึกการตั้งค่า</button>
          </div>
        </div>
      )}
    </div>
  );
}
