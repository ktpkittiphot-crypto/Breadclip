# Bread Clip Pre-order

เว็บแอปพรีออเดอร์ขนมสำหรับนักศึกษาเชียงใหม่ สร้างด้วย React + Vite

## ฟังก์ชัน

- เลือก Tiramisu และ Cheese Pie พร้อมคำนวณยอดแบบเรียลไทม์
- ส่งฟรีเมื่อยอดสินค้า 100 บาทขึ้นไป
- สร้าง PromptPay QR ตามยอดอัตโนมัติ
- แนบสลิปและส่งออเดอร์ไป Google Apps Script
- บันทึกข้อมูลลง Google Sheet และสลิปลง Google Drive
- ตั้งค่าเลขพร้อมเพย์และ Backend URL ผ่านไอคอนเฟือง

## เปิดใช้งาน Google Apps Script

1. เปิด Google Sheet > Extensions > Apps Script
2. คัดลอก `gas_script.js` ไปวางแทนโค้ดเดิม
3. Deploy > New deployment > Web app
4. Execute as: Me และ Who has access: Anyone
5. นำ Web App URL ไปใส่ในหน้า Settings ของเว็บ

หลังแก้ Apps Script ต้อง Deploy เป็นเวอร์ชันใหม่ทุกครั้ง

## Development

```bash
npm install
npm run dev
```

## GitHub Pages

Workflow ใน `.github/workflows/deploy-pages.yml` จะ build และ deploy เมื่อ push เข้า `main`
