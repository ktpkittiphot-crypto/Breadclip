// Google Apps Script สำหรับ Bread Clip Pre-order Web App
//
// วิธีติดตั้ง:
// 1. เปิด Google Sheet ปลายทาง แล้วไปที่ Extensions > Apps Script
// 2. วางโค้ดทั้งไฟล์นี้แทนโค้ดเดิม
// 3. FOLDER_ID เป็นทางเลือก: ใส่ ID โฟลเดอร์ Google Drive สำหรับเก็บสลิป
//    หากปล่อยว่าง สลิปจะถูกเก็บไว้ที่ My Drive ของบัญชีเจ้าของสคริปต์
// 4. กด Save แล้ว Deploy > New deployment > Web app
// 5. ตั้ง Execute as: Me และ Who has access: Anyone
// 6. หากแก้โค้ดหลัง deploy แล้ว ให้ Deploy เวอร์ชันใหม่ทุกครั้ง
//
// URL ของ Web app ถูกตั้งไว้ใน src/App.jsx แล้ว

var FOLDER_ID = "1gS9bMZVdzWOfoHq_Kg5D1YOl8Cq5fmQv"; // Google Drive folder for payment slips

var HEADERS = [
  "วันที่",
  "ชื่อผู้สั่ง",
  "เบอร์โทร",
  "ช่องทางติดต่อ",
  "Original",
  "Thai Tea",
  "วิธีรับ",
  "ที่อยู่",
  "ยอดรวม",
  "ลิงก์สลิป"
];

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validatePayload_(payload);

    var sheet = getOrdersSheet_();
    var order = payload.orderData;
    var slipUrl = saveSlip_(payload, order.name);

    sheet.appendRow([
      new Date(),
      safeText_(order.name),
      safeText_(order.phone),
      safeText_(order.social),
      Number(order.originalQty) || 0,
      Number(order.thaiTeaQty) || 0,
      safeText_(order.deliveryOption),
      safeText_(order.customAddress),
      Number(payload.totalCost),
      slipUrl
    ]);

    return json_({ status: "success", message: "Order saved" });
  } catch (error) {
    console.error(error);
    return json_({ status: "error", message: String(error) });
  }
}

function getOrdersSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName("Orders");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("Orders");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("ไม่พบข้อมูลคำสั่งซื้อ");
  }
  return JSON.parse(e.postData.contents);
}

function validatePayload_(payload) {
  var order = payload && payload.orderData;
  if (!order || !order.name || !order.phone || !order.social) {
    throw new Error("ข้อมูลผู้สั่งซื้อไม่ครบ");
  }

  var totalBoxes = (Number(order.originalQty) || 0) + (Number(order.thaiTeaQty) || 0);
  if (totalBoxes < 1) {
    throw new Error("กรุณาเลือกสินค้าอย่างน้อย 1 กล่อง");
  }

  if (!Number.isFinite(Number(payload.totalCost)) || Number(payload.totalCost) <= 0) {
    throw new Error("ยอดชำระไม่ถูกต้อง");
  }
}

function saveSlip_(payload, customerName) {
  if (!payload.slipBase64) {
    return "";
  }

  var mimeType = payload.mimeType || "image/jpeg";
  var extension = mimeType.split("/")[1] || "jpg";
  var filename = "slip_" + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd_HHmmss"
  ) + "_" + cleanFilename_(customerName) + "." + extension;

  var bytes = Utilities.base64Decode(payload.slipBase64);
  var blob = Utilities.newBlob(bytes, mimeType, filename);
  var file;

  if (FOLDER_ID) {
    file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
  } else {
    file = DriveApp.createFile(blob);
  }

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function safeText_(value) {
  var text = String(value || "").trim();
  // Prevent customer input from being evaluated as a Google Sheets formula.
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function cleanFilename_(value) {
  return String(value || "customer")
    .replace(/[\\/:*?\"<>|]/g, "_")
    .slice(0, 80);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
