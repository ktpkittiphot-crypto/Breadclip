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

1. เปิด Google Sheet ปลายทาง แล้วเลือก **Extensions > Apps Script**
2. เปิดไฟล์ `Code.gs` ใน repository นี้ แล้วคัดลอกทั้งหมดไปแทนโค้ดเดิม
3. เลือกฟังก์ชัน `setupBreadClip` แล้วกด **Run** หนึ่งครั้ง เพื่ออนุญาตสิทธิ์และตั้งค่า Sheet อัตโนมัติ
4. ไปที่ **Deploy > Manage deployments**
5. กดไอคอนดินสอ เลือก **New version** แล้วกด **Deploy**
6. ตั้ง **Execute as: Me** และ **Who has access: Anyone**
7. นำ Web App URL ไปใส่ในหน้า Settings ของเว็บ

Backend รุ่นนี้ตรวจหา Google Sheet ที่ผูกกับ Apps Script และตั้งค่า `SPREADSHEET_ID` ให้อัตโนมัติ จึงไม่ต้องเพิ่ม Script Properties เอง

หลังแก้ Apps Script ต้อง Deploy เป็นเวอร์ชันใหม่ทุกครั้ง

## Development

```bash
npm install
npm run dev
```

## GitHub Pages

Workflow ใน `.github/workflows/deploy-pages.yml` จะ build และ deploy เมื่อ push เข้า `main`
