import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import Tesseract from 'tesseract.js';
import { ShoppingBag, Upload, CheckCircle, AlertCircle, Info, Settings, Loader2 } from 'lucide-react';
import { generatePayload } from './utils/promptpay';

function App() {
  const [orderState, setOrderState] = useState('form'); // form, checkout, success
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    social: '',
    originalQty: 0,
    thaiTeaQty: 0,
    deliveryOption: 'fine_arts',
    customAddress: ''
  });
  const [slipImage, setSlipImage] = useState(null);
  const [slipFile, setSlipFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  
  // App settings
  const [settings, setSettings] = useState({
    promptpayId: '0812345678', // Default dummy, should fetch from GAS or localStorage
    pricePerBox: 89,
    deliveryFee12: 5,
    deliveryFee19: 5,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [tempPromptpay, setTempPromptpay] = useState(settings.promptpayId);

  useEffect(() => {
    // Load from local storage for now
    const saved = localStorage.getItem('breadclip_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const saveSettings = () => {
    const newSettings = { ...settings, promptpayId: tempPromptpay };
    setSettings(newSettings);
    localStorage.setItem('breadclip_settings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // Allow only numbers
      const onlyNums = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: onlyNums }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const updateQty = (type, delta) => {
    setFormData(prev => {
      const current = prev[type];
      const next = current + delta;
      if (next < 0) return prev;
      return { ...prev, [type]: next };
    });
  };

  const calculateTotal = () => {
    let totalQty = formData.originalQty + formData.thaiTeaQty;
    let cost = totalQty * settings.pricePerBox;
    if (formData.deliveryOption === 'delivery_12') cost += settings.deliveryFee12;
    if (formData.deliveryOption === 'delivery_19') cost += settings.deliveryFee19;
    return cost;
  };

  const totalCost = calculateTotal();
  const totalQty = formData.originalQty + formData.thaiTeaQty;
  const qrPayload = generatePayload(settings.promptpayId, totalCost);

  const handleToCheckout = (e) => {
    e.preventDefault();
    if (totalQty === 0) {
      alert("กรุณาเลือกขนมอย่างน้อย 1 กล่อง");
      return;
    }
    setOrderState('checkout');
  };

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const verifySlipAndSubmit = async () => {
    if (!slipImage) {
      alert("กรุณาอัปโหลดสลิปโอนเงิน");
      return;
    }
    
    setIsUploading(true);
    setOcrStatus('กำลังตรวจสอบสลิป...');

    try {
      // Run OCR using Tesseract.js (eng for numbers)
      const { data: { text } } = await Tesseract.recognize(slipImage, 'eng', {
        logger: m => console.log(m)
      });
      
      console.log("OCR Result:", text);
      
      // Basic verification logic: check if the total amount string exists in the OCR text
      // Note: In real world, OCR on slips can be tricky due to fonts. We'll do a simple check.
      const amountStr = totalCost.toFixed(2);
      const amountStrNoDecimal = totalCost.toString();
      
      // Checking for amount
      if (text.includes(amountStr) || text.includes(amountStrNoDecimal)) {
        setOcrStatus('สลิปถูกต้อง กำลังส่งข้อมูล...');
      } else {
        // We will just warn but still allow submission for the demo, 
        // or we could block it. Let's ask user to confirm if not matching.
        const confirmSubmit = window.confirm("ระบบตรวจไม่พบยอดเงินที่ตรงกันในสลิป (อาจเป็นเพราะฟอนต์สลิป) คุณต้องการยืนยันส่งข้อมูลหรือไม่?");
        if (!confirmSubmit) {
          setIsUploading(false);
          setOcrStatus('');
          return;
        }
        setOcrStatus('กำลังส่งข้อมูล...');
      }

      // Submit to Google Apps Script
      const GAS_URL = "https://script.google.com/macros/s/AKfycbz8iTV055Xx7Mn2wOsPK1ZHJ1Tlcke-40qnrlxk7uV7RGshFIpBKTMDLTfL4ptznlFA/exec"; 
      
      if (GAS_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        // Simulate API call
        await new Promise(r => setTimeout(r, 1500));
        setOrderState('success');
      } else {
        // Real API call
        const payload = {
          orderData: formData,
          totalCost: totalCost,
          slipBase64: slipImage.split('base64,')[1],
          mimeType: slipFile.type,
          filename: `slip_${Date.now()}_${formData.name}`
        };
        
        await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setOrderState('success');
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองอีกครั้ง");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Settings Icon */}
      <button 
        onClick={() => {
          setTempPromptpay(settings.promptpayId);
          setShowSettings(true);
        }}
        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
      >
        <Settings size={24} />
      </button>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
        <h1 style={{ marginBottom: '8px' }}>Bread Clip</h1>
        <p style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '18px' }}>Tiramisu พรีออเดอร์ (เชียงใหม่)</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div className="glass-panel">
          <div className="flex items-center" style={{ gap: '8px', marginBottom: '12px', color: 'var(--accent)' }}>
            <Info size={20} />
            <span style={{ fontWeight: 600 }}>รอบพรีออเดอร์</span>
          </div>
          <p style={{ fontSize: '14px', marginBottom: '8px' }}>เปิดรับ: จันทร์ - ศุกร์</p>
          <p style={{ fontSize: '14px', marginBottom: '8px' }}>รับขนม: วันจันทร์ถัดไป</p>
          <div style={{ background: 'rgba(226, 125, 96, 0.1)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginTop: '16px' }}>
            <strong>คำแนะนำ:</strong> ทิรามิสุเก็บในตู้เย็นได้ 5 วัน แต่ควรบริโภคภายใน 3 วันเพื่อรสชาติที่ดีที่สุด
          </div>
        </div>

        {orderState === 'form' && (
          <form onSubmit={handleToCheckout} className="glass-panel">
            <h2>ข้อมูลส่วนตัว</h2>
            <div className="form-group">
              <label>ชื่อผู้สั่ง *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>เบอร์โทรศัพท์ติดต่อ *</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>ช่องทางติดต่ออื่น (IG, Line) *</label>
              <input type="text" name="social" value={formData.social} onChange={handleInputChange} required placeholder="เช่น IG: @myig หรือ Line ID: myline" />
            </div>

            <h2 className="mt-4">เลือกสินค้า (89.- / กล่อง)</h2>
            <div className="product-card">
              <div className="product-info">
                <h3>Original Signature</h3>
              </div>
              <div className="counter">
                <button type="button" onClick={() => updateQty('originalQty', -1)}>-</button>
                <input type="number" value={formData.originalQty} readOnly />
                <button type="button" onClick={() => updateQty('originalQty', 1)}>+</button>
              </div>
            </div>
            <div className="product-card">
              <div className="product-info">
                <h3>Thai Tea</h3>
              </div>
              <div className="counter">
                <button type="button" onClick={() => updateQty('thaiTeaQty', -1)}>-</button>
                <input type="number" value={formData.thaiTeaQty} readOnly />
                <button type="button" onClick={() => updateQty('thaiTeaQty', 1)}>+</button>
              </div>
            </div>

            <h2 className="mt-4">วิธีรับของ</h2>
            <div className="form-group">
              <select name="deliveryOption" value={formData.deliveryOption} onChange={handleInputChange}>
                <option value="fine_arts">รับที่คณะวิจิตรศิลป์ (ฟรี 12:00-13:00)</option>
                <option value="delivery_12">จัดส่ง 12:00-13:00 (+{settings.deliveryFee12} บาท)</option>
                <option value="delivery_19">จัดส่ง 19:00-20:00 (+{settings.deliveryFee19} บาท)</option>
                <option value="other">อื่นๆ (โปรดระบุ)</option>
              </select>
            </div>
            {formData.deliveryOption === 'other' && (
              <div className="form-group">
                <label>สถานที่รับและเวลาที่ต้องการ</label>
                <input type="text" name="customAddress" value={formData.customAddress} onChange={handleInputChange} required placeholder="ระบุสถานที่และเวลา" />
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
                <span>ยอดรวม</span>
                <span style={{ color: 'var(--primary)' }}>{totalCost} ฿</span>
              </div>
              <button type="submit" className="btn btn-primary">
                <ShoppingBag size={20} /> ดำเนินการชำระเงิน
              </button>
            </div>
          </form>
        )}

        {orderState === 'checkout' && (
          <div className="glass-panel">
            <h2>ชำระเงิน (สแกน QR)</h2>
            <div className="text-center">
              <p>ยอดที่ต้องชำระ: <strong>{totalCost} บาท</strong></p>
              <div className="qr-container">
                <QRCode value={qrPayload} size={200} />
              </div>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
                PromptPay: {settings.promptpayId}
              </p>
            </div>

            <div className="form-group">
              <label>แนบสลิปโอนเงิน *</label>
              <input type="file" accept="image/*" id="slip" style={{ display: 'none' }} onChange={handleSlipChange} />
              <label htmlFor="slip" className="slip-upload-area">
                <Upload size={32} color="var(--primary-light)" style={{ marginBottom: '8px' }} />
                <br />
                <span style={{ color: 'var(--primary)' }}>คลิกเพื่ออัปโหลดสลิป</span>
              </label>
              {slipImage && <img src={slipImage} alt="Slip preview" className="slip-preview" />}
            </div>

            {ocrStatus && <p style={{ textAlign: 'center', margin: '12px 0', color: 'var(--accent)', fontSize: '14px' }}>{ocrStatus}</p>}

            <div className="flex" style={{ gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn" style={{ background: 'white', color: 'var(--text-dark)', flex: 1 }} onClick={() => setOrderState('form')} disabled={isUploading}>
                กลับไปแก้ไข
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={verifySlipAndSubmit} disabled={isUploading}>
                {isUploading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />} ยืนยันการสั่งซื้อ
              </button>
            </div>
          </div>
        )}

        {orderState === 'success' && (
          <div className="glass-panel text-center" style={{ padding: '40px 20px' }}>
            <CheckCircle size={64} color="#4CAF50" style={{ margin: '0 auto 16px' }} />
            <h2>สั่งซื้อสำเร็จ!</h2>
            <p style={{ marginBottom: '24px' }}>ขอบคุณที่อุดหนุน Bread Clip ค่ะ<br />เราได้รับข้อมูลเรียบร้อยแล้ว</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              กลับสู่หน้าหลัก
            </button>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '400px' }}>
              <h3>ตั้งค่าร้านค้า</h3>
              <div className="form-group">
                <label>เบอร์ PromptPay หรือ เลขบัตร ปชช.</label>
                <input type="text" value={tempPromptpay} onChange={e => setTempPromptpay(e.target.value)} />
              </div>
              <div className="flex justify-between" style={{ marginTop: '24px', gap: '12px' }}>
                <button className="btn" style={{ background: '#f0f0f0', flex: 1 }} onClick={() => setShowSettings(false)}>ยกเลิก</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveSettings}>บันทึก</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
