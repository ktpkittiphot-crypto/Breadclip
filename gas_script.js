var FOLDER_ID = '1gS9bMZVdzWOfoHq_Kg5D1YOl8Cq5fmQv';

const CONFIG = {
  SHEET_NAME: 'Orders',
  SPREADSHEET_NAME: 'Bread Clip Orders',
  SLIP_FOLDER_NAME: 'Bread Clip Slips',
  TIME_ZONE: 'Asia/Bangkok',
};

const PRODUCT_PRICES = {
  original: 89,
  thaiTea: 89,
  strawberry: 35,
  blueberry: 35,
};

const COUPONS = {
  kittiphotlnwza67: { discount: 10, cooldownHours: 24 },
  kittiphotandfriend: { discount: 20, cooldownHours: 144 },
};

const ORDER_HEADERS = [
  'Order ID', 'Created At', 'Customer Name', 'Phone', 'Contact',
  'Tiramisu Original', 'Tiramisu Thai Tea', 'Cheese Pie Strawberry', 'Cheese Pie Blueberry',
  'Delivery', 'Other Delivery', 'Subtotal', 'Delivery Fee', 'Total',
  'Payment Status', 'Slip URL', 'Raw Payload', 'Coupon Code', 'Coupon Discount', 'Total Before Discount',
];

function doGet() {
  try {
    const spreadsheet = getSpreadsheet_();
    const folder = getSlipFolder_();
    return json_({ ok: true, service: 'Bread Clip order backend', spreadsheetUrl: spreadsheet.getUrl(), folderUrl: folder.getUrl() });
  } catch (error) {
    return json_({ ok: false, error: error.message || String(error) });
  }
}

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    const action = String(payload.action || 'submitOrder');
    if (action === 'validateCoupon') return json_(handleCouponValidation_(payload));
    if (action !== 'submitOrder') throw new Error('Unsupported action.');
    return json_(handleSubmitOrder_(payload));
  } catch (error) {
    console.error(error);
    return json_({ ok: false, status: 'error', error: error.message || String(error), message: error.message || String(error) });
  }
}

function handleCouponValidation_(payload) {
  const customer = extractCustomer_(payload);
  if (!customer.name || !customer.phone || !customer.contact) throw new Error('กรุณากรอกชื่อ เบอร์โทร และช่องทางติดต่อก่อนใช้คูปอง');
  const couponCode = normalizeCouponCode_(payload.couponCode);
  if (!couponCode) return { ok: true, status: 'success', eligible: true, couponCode: '', discount: 0 };
  const result = validateCoupon_(getOrderSheet_(), customer, couponCode, new Date());
  return Object.assign({ ok: true, status: 'success' }, result);
}

function handleSubmitOrder_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const customer = extractCustomer_(payload);
    if (!customer.name || !customer.phone || !customer.contact) throw new Error('Missing customer details.');

    const items = extractItems_(payload);
    const totalItems = Object.keys(items).reduce(function (sum, key) { return sum + Number(items[key] || 0); }, 0);
    if (totalItems < 1) throw new Error('No products selected.');

    const orderId = String(payload.orderId || createOrderId_());
    const sheet = getOrderSheet_();
    if (findOrderRow_(sheet, orderId) > 0) return { ok: true, status: 'success', duplicate: true, orderId: orderId };

    const subtotal = calculateSubtotal_(items);
    const deliveryMode = String(payload.deliveryMode || (payload.orderData && payload.orderData.deliveryMode) || '');
    const deliveryText = String(payload.delivery || payload.deliveryOption || (payload.orderData && payload.orderData.deliveryOption) || '');
    const isDelivery = deliveryMode === 'delivery' || deliveryText.indexOf('จัดส่ง') === 0;
    const deliveryFee = isDelivery && subtotal < 100 ? 5 : 0;

    const couponCode = normalizeCouponCode_(payload.couponCode || (payload.orderData && payload.orderData.couponCode));
    const couponResult = validateCoupon_(sheet, customer, couponCode, new Date());
    if (!couponResult.eligible) throw new Error(couponResult.message);

    const couponDiscount = Number(couponResult.discount || 0);
    const totalBeforeDiscount = subtotal + deliveryFee;
    const total = Math.max(0, totalBeforeDiscount - couponDiscount);
    const clientTotal = Number(payload.total != null ? payload.total : payload.totalCost);
    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - total) > 0.01) throw new Error('ยอดรวมไม่ตรงกับราคาที่ระบบคำนวณ กรุณากลับไปคำนวณใหม่');

    const slipUrl = saveSlip_(payload, orderId, customer.name);
    const otherDelivery = String(payload.otherDelivery || payload.customAddress || (payload.orderData && payload.orderData.customAddress) || '');
    const paymentStatus = String(payload.paymentStatus || 'รอตรวจสอบ');

    sheet.appendRow([
      orderId, new Date(), customer.name, customer.phone, customer.contact,
      Number(items.original || 0), Number(items.thaiTea || 0), Number(items.strawberry || 0), Number(items.blueberry || 0),
      deliveryText, otherDelivery, subtotal, deliveryFee, total, paymentStatus, slipUrl, JSON.stringify(payload),
      couponCode, couponDiscount, totalBeforeDiscount,
    ]);

    return { ok: true, status: 'success', orderId: orderId, slipUrl: slipUrl, couponCode: couponCode, couponDiscount: couponDiscount, subtotal: subtotal, deliveryFee: deliveryFee, total: total };
  } finally {
    lock.releaseLock();
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
    original: sanitizeQuantity_(items.original != null ? items.original : orderData.originalQty),
    thaiTea: sanitizeQuantity_(items.thaiTea != null ? items.thaiTea : orderData.thaiTeaQty),
    strawberry: sanitizeQuantity_(items.strawberry != null ? items.strawberry : orderData.strawberryQty),
    blueberry: sanitizeQuantity_(items.blueberry != null ? items.blueberry : orderData.blueberryQty),
  };
}

function sanitizeQuantity_(value) {
  const quantity = Math.floor(Number(value || 0));
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Invalid product quantity.');
  return quantity;
}

function calculateSubtotal_(items) {
  return Object.keys(PRODUCT_PRICES).reduce(function (sum, key) { return sum + Number(items[key] || 0) * PRODUCT_PRICES[key]; }, 0);
}

function normalizeCouponCode_(value) { return String(value || '').trim().toLowerCase(); }
function normalizeName_(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ''); }
function normalizePhone_(value) { return String(value || '').replace(/\D/g, ''); }
function normalizeContact_(value) { return String(value || '').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, ''); }

function validateCoupon_(sheet, customer, couponCode, now) {
  const code = normalizeCouponCode_(couponCode);
  if (!code) return { eligible: true, couponCode: '', discount: 0, cooldownHours: 0 };

  const rule = COUPONS[code];
  if (!rule) return { eligible: false, couponCode: code, discount: 0, message: 'ไม่พบคูปองนี้ หรือคูปองไม่ถูกต้อง' };
  if (sheet.getLastRow() < 2) return { eligible: true, couponCode: code, discount: rule.discount, cooldownHours: rule.cooldownHours, message: 'ใช้คูปองได้' };

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS.length).getValues();
  const normalizedCustomer = { name: normalizeName_(customer.name), phone: normalizePhone_(customer.phone), contact: normalizeContact_(customer.contact) };
  const cooldownMs = rule.cooldownHours * 60 * 60 * 1000;
  let latestMatchingUse = null;

  values.forEach(function (row) {
    if (normalizeCouponCode_(row[17]) !== code) return;
    const sameName = normalizedCustomer.name && normalizeName_(row[2]) === normalizedCustomer.name;
    const samePhone = normalizedCustomer.phone && normalizePhone_(row[3]) === normalizedCustomer.phone;
    const sameContact = normalizedCustomer.contact && normalizeContact_(row[4]) === normalizedCustomer.contact;
    if (!sameName && !samePhone && !sameContact) return;
    const usedAt = row[1] instanceof Date ? row[1] : new Date(row[1]);
    if (isNaN(usedAt.getTime())) return;
    if (!latestMatchingUse || usedAt.getTime() > latestMatchingUse.getTime()) latestMatchingUse = usedAt;
  });

  if (latestMatchingUse && now.getTime() - latestMatchingUse.getTime() < cooldownMs) {
    const retryAt = new Date(latestMatchingUse.getTime() + cooldownMs);
    const retryText = Utilities.formatDate(retryAt, CONFIG.TIME_ZONE, 'dd/MM/yyyy HH:mm');
    return { eligible: false, couponCode: code, discount: 0, cooldownHours: rule.cooldownHours, retryAt: retryAt.toISOString(), message: 'คูปองนี้ถูกใช้ด้วยชื่อ เบอร์โทร หรือช่องทางติดต่อนี้แล้ว ใช้ได้อีกครั้งหลัง ' + retryText + ' น.' };
  }

  return { eligible: true, couponCode: code, discount: rule.discount, cooldownHours: rule.cooldownHours, message: 'ใช้คูปองได้ ลด ' + rule.discount + ' บาท' };
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
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
  const file = getSlipFolder_().createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (sharingError) { console.warn(sharingError); }
  return file.getUrl();
}

function getSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) { saveSpreadsheetId_(properties, active.getId()); return active; }
  const storedId = properties.getProperty('SPREADSHEET_ID') || properties.getProperty('BREAD_CLIP_SPREADSHEET_ID');
  if (storedId) return SpreadsheetApp.openById(storedId);
  const created = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  saveSpreadsheetId_(properties, created.getId());
  return created;
}

function saveSpreadsheetId_(properties, spreadsheetId) {
  properties.setProperties({ SPREADSHEET_ID: spreadsheetId, BREAD_CLIP_SPREADSHEET_ID: spreadsheetId }, false);
}

function getOrderSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
  sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
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
  const stamp = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyyMMddHHmmss');
  return 'BC-' + stamp + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
