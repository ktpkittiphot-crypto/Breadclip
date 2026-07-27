var FOLDER_ID = '1gS9bMZVdzWOfoHq_Kg5D1YOl8Cq5fmQv';

const CONFIG = {
  SHEET_NAME: 'Orders',
  SPREADSHEET_NAME: 'Bread Clip Orders',
  SLIP_FOLDER_NAME: 'Bread Clip Slips',
  TIME_ZONE: 'Asia/Bangkok',
};

const ADMIN_PIN = '167990';
const FORM_MODE_PROPERTY = 'BREAD_CLIP_FORM_MODE';
const VALID_FORM_MODES = ['auto', 'open', 'closed'];

const PRODUCT_PRICES = {
  original: 89,
  thaiTea: 89,
  strawberry: 35,
  blueberry: 35,
};

const COUPONS = {
  kittiphotlnwza67: { discount: 10, minSubtotal: 0 },
  kittiphotandfriend: { discount: 20, minSubtotal: 100 },
};

const ORDER_HEADERS = [
  'Order ID',
  'Created At',
  'Customer Name',
  'Phone',
  'Contact',
  'Tiramisu Original',
  'Tiramisu Thai Tea',
  'Cheese Pie Strawberry',
  'Cheese Pie Blueberry',
  'Delivery',
  'Other Delivery',
  'Subtotal',
  'Delivery Fee',
  'Total',
  'Payment Status',
  'Slip URL',
  'Raw Payload',
  'Coupon Code',
  'Coupon Discount',
  'Total Before Discount',
];

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || '');
    if (action === 'getFormStatus') return json_(getFormStatus_());

    const spreadsheet = getSpreadsheet_();
    const folder = getSlipFolder_();
    const formStatus = getFormStatus_();

    return json_({
      ok: true,
      service: 'Bread Clip order backend',
      spreadsheetUrl: spreadsheet.getUrl(),
      folderUrl: folder.getUrl(),
      formMode: formStatus.formMode,
      isOpen: formStatus.isOpen,
    });
  } catch (error) {
    return json_({ ok: false, error: error.message || String(error) });
  }
}

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    const action = String(payload.action || 'submitOrder');

    if (action === 'setFormMode') return json_(handleSetFormMode_(payload));
    if (action === 'validateCoupon') return json_(handleCouponValidation_(payload));
    if (action !== 'submitOrder') throw new Error('Unsupported action.');

    return json_(handleSubmitOrder_(payload));
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      status: 'error',
      error: error.message || String(error),
      message: error.message || String(error),
    });
  }
}

function handleSetFormMode_(payload) {
  if (String(payload.adminPin || '') !== ADMIN_PIN) {
    throw new Error('รหัสเจ้าของร้านไม่ถูกต้อง');
  }

  const mode = String(payload.formMode || '').trim().toLowerCase();
  if (VALID_FORM_MODES.indexOf(mode) === -1) {
    throw new Error('สถานะฟอร์มไม่ถูกต้อง');
  }

  PropertiesService.getScriptProperties().setProperty(FORM_MODE_PROPERTY, mode);
  return getFormStatus_();
}

function getFormMode_() {
  const saved = String(
    PropertiesService.getScriptProperties().getProperty(FORM_MODE_PROPERTY) || 'auto'
  ).toLowerCase();
  return VALID_FORM_MODES.indexOf(saved) >= 0 ? saved : 'auto';
}

function getFormStatus_() {
  const formMode = getFormMode_();
  const weekday = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'EEE');
  const weekdayOpen = weekday !== 'Sat' && weekday !== 'Sun';
  const isOpen = formMode === 'open' || (formMode === 'auto' && weekdayOpen);

  return {
    ok: true,
    status: 'success',
    formMode: formMode,
    isOpen: isOpen,
    weekday: weekday,
    timeZone: CONFIG.TIME_ZONE,
  };
}

function handleCouponValidation_(payload) {
  const subtotal = Number(payload.subtotal || 0);
  const result = validateCoupon_(payload.couponCode, subtotal);
  return Object.assign({ ok: true, status: 'success' }, result);
}

function handleSubmitOrder_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!getFormStatus_().isOpen) {
      throw new Error('ขณะนี้ปิดรับพรีออเดอร์ กรุณารอรอบถัดไป');
    }

    const customer = extractCustomer_(payload);
    if (!customer.name || !customer.phone || !customer.contact) {
      throw new Error('Missing customer details.');
    }

    const items = extractItems_(payload);
    const totalItems = Object.keys(items).reduce(function (sum, key) {
      return sum + Number(items[key] || 0);
    }, 0);
    if (totalItems < 1) throw new Error('No products selected.');

    const orderId = String(payload.orderId || createOrderId_());
    const sheet = getOrderSheet_();
    const existingRow = findOrderRow_(sheet, orderId);
    if (existingRow > 0) {
      return { ok: true, status: 'success', duplicate: true, orderId: orderId };
    }

    const subtotal = calculateSubtotal_(items);
    const deliveryMode = String(
      payload.deliveryMode ||
      (payload.orderData && payload.orderData.deliveryMode) ||
      ''
    );
    const deliveryText = String(
      payload.delivery ||
      payload.deliveryOption ||
      (payload.orderData && payload.orderData.deliveryOption) ||
      ''
    );
    const isDelivery = deliveryMode === 'delivery' || deliveryText.indexOf('จัดส่ง') === 0;
    const deliveryFee = isDelivery && subtotal < 100 ? 5 : 0;

    const couponCode = normalizeCouponCode_(
      payload.couponCode ||
      (payload.orderData && payload.orderData.couponCode)
    );
    const couponResult = validateCoupon_(couponCode, subtotal);
    if (!couponResult.eligible) throw new Error(couponResult.message);

    const couponDiscount = Number(couponResult.discount || 0);
    const totalBeforeDiscount = subtotal + deliveryFee;
    const total = Math.max(0, totalBeforeDiscount - couponDiscount);
    const clientTotal = Number(payload.total != null ? payload.total : payload.totalCost);

    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - total) > 0.01) {
      throw new Error('ยอดรวมไม่ตรงกับราคาที่ระบบคำนวณ กรุณากลับไปคำนวณใหม่');
    }

    const slipUrl = saveSlip_(payload, orderId, customer.name);
    const otherDelivery = String(
      payload.otherDelivery ||
      payload.customAddress ||
      (payload.orderData && payload.orderData.customAddress) ||
      ''
    );
    const paymentStatus = String(payload.paymentStatus || 'รอตรวจสอบ');

    sheet.appendRow([
      orderId,
      new Date(),
      customer.name,
      customer.phone,
      customer.contact,
      Number(items.original || 0),
      Number(items.thaiTea || 0),
      Number(items.strawberry || 0),
      Number(items.blueberry || 0),
      deliveryText,
      otherDelivery,
      subtotal,
      deliveryFee,
      total,
      paymentStatus,
      slipUrl,
      JSON.stringify(payload),
      couponCode,
      couponDiscount,
      totalBeforeDiscount,
    ]);

    return {
      ok: true,
      status: 'success',
      orderId: orderId,
      slipUrl: slipUrl,
      couponCode: couponCode,
      couponDiscount: couponDiscount,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total,
    };
  } finally {
    lock.releaseLock();
  }
}

function setupBreadClip() {
  const spreadsheet = getSpreadsheet_();
  const sheet = getOrderSheet_();
  const folder = getSlipFolder_();

  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName(),
    folderUrl: folder.getUrl(),
    formStatus: getFormStatus_(),
  };
}

function parsePayload_(event) {
  if (!event) return {};

  const raw = event.postData && event.postData.contents;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error('Invalid JSON payload.');
    }
  }

  if (event.parameter && event.parameter.payload) {
    return JSON.parse(event.parameter.payload);
  }

  return event.parameter || {};
}

function extractCustomer_(payload) {
  const orderData = payload.orderData || {};
  const customerDetails = payload.customerDetails || {};

  return {
    name: String(
      payload.name ||
      payload.customerName ||
      customerDetails.name ||
      orderData.name ||
      ''
    ).trim(),
    phone: String(
      payload.phone ||
      payload.customerPhone ||
      customerDetails.phone ||
      orderData.phone ||
      ''
    ).trim(),
    contact: String(
      payload.contact ||
      payload.social ||
      payload.customerContact ||
      customerDetails.contact ||
      orderData.contact ||
      orderData.social ||
      ''
    ).trim(),
  };
}

function extractItems_(payload) {
  const items = payload.items || {};
  const orderData = payload.orderData || {};

  return {
    original: sanitizeQuantity_(
      items.original != null ? items.original : orderData.originalQty
    ),
    thaiTea: sanitizeQuantity_(
      items.thaiTea != null ? items.thaiTea : orderData.thaiTeaQty
    ),
    strawberry: sanitizeQuantity_(
      items.strawberry != null ? items.strawberry : orderData.strawberryQty
    ),
    blueberry: sanitizeQuantity_(
      items.blueberry != null ? items.blueberry : orderData.blueberryQty
    ),
  };
}

function sanitizeQuantity_(value) {
  const quantity = Math.floor(Number(value || 0));
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Invalid product quantity.');
  }
  return quantity;
}

function calculateSubtotal_(items) {
  return Object.keys(PRODUCT_PRICES).reduce(function (sum, key) {
    return sum + Number(items[key] || 0) * PRODUCT_PRICES[key];
  }, 0);
}

function normalizeCouponCode_(value) {
  return String(value || '').trim().toLowerCase();
}

function validateCoupon_(couponCode, subtotal) {
  const code = normalizeCouponCode_(couponCode);
  const safeSubtotal = Number(subtotal || 0);

  if (!code) {
    return {
      eligible: true,
      couponCode: '',
      discount: 0,
      minSubtotal: 0,
      message: '',
    };
  }

  const rule = COUPONS[code];
  if (!rule) {
    return {
      eligible: false,
      couponCode: code,
      discount: 0,
      minSubtotal: 0,
      message: 'ไม่พบคูปองนี้ หรือคูปองไม่ถูกต้อง',
    };
  }

  if (safeSubtotal < Number(rule.minSubtotal || 0)) {
    return {
      eligible: false,
      couponCode: code,
      discount: 0,
      minSubtotal: Number(rule.minSubtotal || 0),
      message: 'คูปอง ' + code + ' ใช้ได้เมื่อยอดขนมครบ ' + rule.minSubtotal + ' บาทขึ้นไป',
    };
  }

  return {
    eligible: true,
    couponCode: code,
    discount: Number(rule.discount || 0),
    minSubtotal: Number(rule.minSubtotal || 0),
    message: 'ใช้คูปองได้ ลด ' + rule.discount + ' บาท',
  };
}

function saveSlip_(payload, orderId, customerName) {
  const dataUrl = String(payload.slipData || '');
  const base64 = String(
    payload.slipBase64 ||
    (dataUrl.indexOf('base64,') >= 0 ? dataUrl.split('base64,')[1] : '')
  );
  if (!base64) throw new Error('Missing slip image.');

  const mimeType = String(payload.slipType || payload.mimeType || 'image/jpeg');
  const originalName = String(payload.slipName || payload.filename || 'slip.jpg');
  const extension = originalName.indexOf('.') >= 0
    ? originalName.split('.').pop()
    : mimeType.split('/').pop();
  const safeName = String(customerName || 'customer').replace(/[\\/:*?"<>|]/g, '_');
  const filename = orderId + '_' + safeName + '.' + extension;
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const file = getSlipFolder_().createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingError) {
    console.warn(sharingError);
  }

  return file.getUrl();
}

function getSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const active = SpreadsheetApp.getActiveSpreadsheet();

  if (active) {
    saveSpreadsheetId_(properties, active.getId());
    return active;
  }

  const storedId =
    properties.getProperty('SPREADSHEET_ID') ||
    properties.getProperty('BREAD_CLIP_SPREADSHEET_ID');

  if (storedId) return SpreadsheetApp.openById(storedId);

  const created = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  saveSpreadsheetId_(properties, created.getId());
  return created;
}

function saveSpreadsheetId_(properties, spreadsheetId) {
  properties.setProperties({
    SPREADSHEET_ID: spreadsheetId,
    BREAD_CLIP_SPREADSHEET_ID: spreadsheetId,
  }, false);
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

  const match = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(orderId)
    .matchEntireCell(true)
    .findNext();

  return match ? match.getRow() : -1;
}

function createOrderId_() {
  const stamp = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyyMMddHHmmss');
  return 'BC-' + stamp + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
