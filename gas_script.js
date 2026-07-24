var FOLDER_ID = '1gS9bMZVdzWOfoHq_Kg5D1YOl8Cq5fmQv';

const CONFIG = {
  SHEET_NAME: 'Orders',
  SPREADSHEET_NAME: 'Bread Clip Orders',
  SLIP_FOLDER_NAME: 'Bread Clip Slips',
};

function doGet() {
  const spreadsheet = getSpreadsheet_();
  const folder = getSlipFolder_();
  return json_({
    ok: true,
    service: 'Bread Clip order backend',
    spreadsheetUrl: spreadsheet.getUrl(),
    folderUrl: folder.getUrl(),
  });
}

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    if (payload.action && payload.action !== 'submitOrder') throw new Error('Unsupported action.');

    const customer = extractCustomer_(payload);
    if (!customer.name || !customer.phone || !customer.contact) throw new Error('Missing customer details.');

    const items = extractItems_(payload);
    const totalItems = Object.keys(items).reduce(function (sum, key) { return sum + Number(items[key] || 0); }, 0);
    if (totalItems < 1) throw new Error('No products selected.');

    const orderId = String(payload.orderId || createOrderId_());
    const sheet = getOrderSheet_();
    const existingRow = findOrderRow_(sheet, orderId);
    if (existingRow > 0) return json_({ ok: true, status: 'success', duplicate: true, orderId: orderId });

    const slipUrl = saveSlip_(payload, orderId, customer.name);
    const delivery = String(payload.delivery || payload.deliveryOption || (payload.orderData && payload.orderData.deliveryOption) || '');
    const otherDelivery = String(payload.otherDelivery || payload.customAddress || (payload.orderData && payload.orderData.customAddress) || '');
    const subtotal = Number(payload.subtotal || 0);
    const deliveryFee = Number(payload.deliveryFee || 0);
    const total = Number(payload.total || payload.totalCost || 0);
    const paymentStatus = String(payload.paymentStatus || 'รอตรวจสอบ');

    sheet.appendRow([
      orderId, new Date(), customer.name, customer.phone, customer.contact,
      Number(items.original || 0), Number(items.thaiTea || 0),
      Number(items.strawberry || 0), Number(items.blueberry || 0),
      delivery, otherDelivery, subtotal, deliveryFee, total,
      paymentStatus, slipUrl, JSON.stringify(payload),
    ]);

    return json_({ ok: true, status: 'success', orderId: orderId, slipUrl: slipUrl });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, status: 'error', error: error.message || String(error), message: error.message || String(error) });
  }
}

function setupBreadClip() {
  const spreadsheet = getSpreadsheet_();
  const sheet = getOrderSheet_();
  const folder = getSlipFolder_();
  return { spreadsheetUrl: spreadsheet.getUrl(), sheetName: sheet.getName(), folderUrl: folder.getUrl() };
}

function parsePayload_(event) {
  if (!event) return {};
  const raw = event.postData && event.postData.contents;
  if (raw) {
    try { return JSON.parse(raw); } catch (error) { throw new Error('Invalid JSON payload.'); }
  }
  if (event.parameter && event.parameter.payload) return JSON.parse(event.parameter.payload);
  return event.parameter || {};
}

function extractCustomer_(payload) {
  const orderData = payload.orderData || {};
  const customerDetails = payload.customerDetails || {};
  return {
    name: String(payload.name || payload.customerName || customerDetails.name || orderData.name || '').trim(),
    phone: String(payload.phone || payload.customerPhone || customerDetails.phone || orderData.phone || '').trim(),
    contact: String(payload.contact || payload.social || payload.customerContact || customerDetails.contact || orderData.contact || orderData.social || '').trim(),
  };
}

function extractItems_(payload) {
  const items = payload.items || {};
  const orderData = payload.orderData || {};
  return {
    original: Number(items.original != null ? items.original : orderData.originalQty || 0),
    thaiTea: Number(items.thaiTea != null ? items.thaiTea : orderData.thaiTeaQty || 0),
    strawberry: Number(items.strawberry != null ? items.strawberry : orderData.strawberryQty || 0),
    blueberry: Number(items.blueberry != null ? items.blueberry : orderData.blueberryQty || 0),
  };
}

function saveSlip_(payload, orderId, customerName) {
  const dataUrl = String(payload.slipData || '');
  const base64 = String(payload.slipBase64 || (dataUrl.indexOf('base64,') >= 0 ? dataUrl.split('base64,')[1] : ''));
  if (!base64) throw new Error('Missing slip image.');

  const mimeType = String(payload.slipType || payload.mimeType || 'image/jpeg');
  const originalName = String(payload.slipName || payload.filename || 'slip.jpg');
  const extension = originalName.indexOf('.') >= 0 ? originalName.split('.').pop() : mimeType.split('/').pop();
  const safeName = String(customerName || 'customer').replace(/[\\/:*?"<>|]/g, '_');
  const filename = orderId + '_' + safeName + '.' + extension;
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const file = getSlipFolder_().createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (sharingError) { console.warn(sharingError); }
  return file.getUrl();
}

function getSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty('BREAD_CLIP_SPREADSHEET_ID');
  if (storedId) return SpreadsheetApp.openById(storedId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    properties.setProperty('BREAD_CLIP_SPREADSHEET_ID', active.getId());
    return active;
  }
  const created = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  properties.setProperty('BREAD_CLIP_SPREADSHEET_ID', created.getId());
  return created;
}

function getOrderSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  const headers = ['Order ID','Created At','Customer Name','Phone','Contact','Tiramisu Original','Tiramisu Thai Tea','Cheese Pie Strawberry','Cheese Pie Blueberry','Delivery','Other Delivery','Subtotal','Delivery Fee','Total','Payment Status','Slip URL','Raw Payload'];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSlipFolder_() {
  const properties = PropertiesService.getScriptProperties();
  if (FOLDER_ID) return DriveApp.getFolderById(FOLDER_ID);
  const storedId = properties.getProperty('BREAD_CLIP_SLIP_FOLDER_ID');
  if (storedId) return DriveApp.getFolderById(storedId);
  const folder = DriveApp.createFolder(CONFIG.SLIP_FOLDER_NAME);
  properties.setProperty('BREAD_CLIP_SLIP_FOLDER_ID', folder.getId());
  return folder;
}

function findOrderRow_(sheet, orderId) {
  if (sheet.getLastRow() < 2) return -1;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(orderId).matchEntireCell(true).findNext();
  return match ? match.getRow() : -1;
}

function createOrderId_() {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyyMMddHHmmss');
  return 'BC-' + stamp + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
