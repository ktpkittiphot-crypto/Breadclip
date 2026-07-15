export function generatePayload(id, amount) {
  let target = id.replace(/[^0-9]/g, '');
  let isPhone = target.length >= 10 && target.length <= 12;
  
  let aid = 'A000000677010111';
  let accType = isPhone ? '01' : '02';
  
  if (isPhone) {
    target = '0066' + target.substring(1);
  }
  
  let accStr = accType + target.length.toString().padStart(2, '0') + target;
  let merchantInfo = '0016' + aid + accStr;
  
  let payload = [
    '000201', // Payload Format Indicator
    '010211', // Point of Initiation Method
    '29' + merchantInfo.length.toString().padStart(2, '0') + merchantInfo,
    '5802TH', // Country Code
    '5303764', // Currency (THB)
  ];
  
  if (amount !== undefined && amount > 0) {
    let amtStr = parseFloat(amount).toFixed(2);
    payload.push('54' + amtStr.length.toString().padStart(2, '0') + amtStr);
  }
  
  payload.push('6304');
  let dataToCrc = payload.join('');
  
  return dataToCrc + crc16(dataToCrc).toUpperCase();
}

function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).padStart(4, '0');
}
