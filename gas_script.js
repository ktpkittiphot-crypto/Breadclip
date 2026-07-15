// Google Apps Script สำหรับ Bread Clip Pre-order Web App
// วิธีการนำไปใช้:
// 1. ไปที่ Google Sheets สร้างเอกสารใหม่
// 2. เปลี่ยนชื่อ Sheet แรกเป็น "Orders" และเพิ่มหัวตารางในแถวที่ 1 (เช่น วันที่, ชื่อ, เบอร์โทร, IG/Line, Original, ThaiTea, วิธีรับ, ยอดรวม, ลิงก์สลิป)
// 3. ไปที่ ส่วนขยาย (Extensions) > Apps Script
// 4. ลบโค้ดเดิมออกให้หมด แล้ววางโค้ดทั้งหมดนี้ลงไป
// 5. แก้ไขค่า FOLDER_ID ด้านล่างให้เป็น ID โฟลเดอร์ใน Google Drive ของคุณ (ถ้าปล่อยว่างไว้ ไฟล์สลิปจะไปอยู่ที่หน้าแรกของ Drive)
// 6. กดบันทึก (Save)
// 7. กด การทำให้ใช้งานได้ (Deploy) > การทำให้ใช้งานได้รายการใหม่ (New deployment)
// 8. เลือกประเภท: เว็บแอป (Web app)
// 9. ตั้งค่า "การเข้าถึง: ทุกคน (Anyone)"
// 10. กด Deploy (จะมีการขอสิทธิ์เข้าถึง ให้กดยอมรับ)
// 11. คัดลอก "URL ของเว็บแอป" ไปใส่ใน App.jsx (บรรทัดที่ 113)

var FOLDER_ID = ""; // ใส่ ID ของโฟลเดอร์ Google Drive ที่ต้องการเก็บสลิป (เช่น "1A2B3C4D...")

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
    if (!sheet) {
      // สร้าง Sheet อัตโนมัติถ้าไม่มี
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Orders");
      sheet.appendRow(["วันที่", "ชื่อผู้สั่ง", "เบอร์โทร", "ช่องทางติดต่อ", "Original", "Thai Tea", "วิธีรับ", "ที่อยู่", "ยอดรวม", "ลิงก์สลิป"]);
    }

    var payload = JSON.parse(e.postData.contents);
    var order = payload.orderData;
    var slipUrl = "";

    // บันทึกรูปสลิปลง Drive
    if (payload.slipBase64) {
      var byteCharacters = Utilities.base64Decode(payload.slipBase64);
      var blob = Utilities.newBlob(byteCharacters, payload.mimeType || "image/jpeg", payload.filename || "slip.jpg");
      
      var file;
      if (FOLDER_ID !== "") {
        var folder = DriveApp.getFolderById(FOLDER_ID);
        file = folder.createFile(blob);
      } else {
        file = DriveApp.createFile(blob);
      }
      
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      slipUrl = file.getUrl();
    }

    // บันทึกข้อมูลลง Sheet
    var timestamp = new Date();
    sheet.appendRow([
      timestamp,
      order.name,
      order.phone,
      order.social,
      order.originalQty,
      order.thaiTeaQty,
      order.deliveryOption,
      order.customAddress,
      payload.totalCost,
      slipUrl
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Order saved" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ป้องกันปัญหา CORS ตอนยิงคำสั่ง OPTIONS ก่อนส่ง POST
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers);
}
