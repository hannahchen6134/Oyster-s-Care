const CONFIG = {
  catName: '蚵仔',
  sheetName: '紀錄',
  imageSheetName: '每日圖片',
  headers: [
    'id',
    'date',
    'time',
    'waterG',
    'foodType',
    'brand',
    'foodAmountG',
    'medMorning',
    'medNight',
    'stoolDetail',
    'vomitDetail',
    'note',
    'createdAt'
  ]
};

function doGet() {
  ensureSetup_();
  return HtmlService.createHtmlOutputFromFile('Index.html')
    .setTitle(CONFIG.catName + '照護紀錄');
}

function getInitialData(dateString) {
  ensureSetup_();
  var selectedDate = normalizeDate_(dateString) || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var entries = listEntries_(selectedDate);

  return {
    catName: CONFIG.catName,
    selectedDate: selectedDate,
    entries: entries,
    summary: buildSummary_(entries),
    brands: listBrands_(),
    dailyImage: getDailyImage_(selectedDate)
  };
}

function saveEntry(payload) {
  ensureSetup_();
  var entry = normalizePayload_(payload || {});
  validateEntry_(entry);

  getLogSheet_().appendRow([
    entry.id,
    entry.date,
    entry.time,
    entry.waterG,
    entry.foodType,
    entry.brand,
    entry.foodAmountG,
    entry.medMorning,
    entry.medNight,
    entry.stoolDetail,
    entry.vomitDetail,
    entry.note,
    entry.createdAt
  ]);

  return getInitialData(entry.date);
}

function deleteEntry(entryId) {
  ensureSetup_();
  if (!entryId) throw new Error('缺少要刪除的紀錄 ID。');

  var sheet = getLogSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('目前沒有可以刪除的紀錄。');

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) === String(entryId)) {
      var dateValue = String(sheet.getRange(i + 2, 2).getDisplayValue());
      sheet.deleteRow(i + 2);
      return getInitialData(dateValue);
    }
  }

  throw new Error('找不到這筆紀錄，可能已經被刪除。');
}

function saveDailyImage(payload) {
  ensureSetup_();
  var date = normalizeDate_(payload && payload.date);
  var base64Data = cleanText_(payload && payload.base64Data);
  var mimeType = cleanText_(payload && payload.mimeType) || 'image/jpeg';
  var fileName = cleanText_(payload && payload.fileName) || 'daily-photo.jpg';

  if (!date) throw new Error('請先選擇日期再上傳照片。');
  if (!base64Data) throw new Error('沒有收到圖片資料。');

  upsertDailyImageRow_(date, {
    fileId: '',
    fileUrl: 'data:' + mimeType + ';base64,' + base64Data,
    fileName: fileName,
    updatedAt: Utilities.formatDate(new Date(), 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ss")
  });

  return getInitialData(date);
}

function ensureSetup_() {
  var sheet = getLogSheet_();
  var headerRange = sheet.getRange(1, 1, 1, CONFIG.headers.length);
  var currentHeaders = headerRange.getDisplayValues()[0];
  var hasHeaders = currentHeaders.some(function(value) {
    return String(value).trim() !== '';
  });

  if (!hasHeaders) {
    headerRange.setValues([CONFIG.headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CONFIG.headers.length).setFontWeight('bold').setBackground('#dfeee9');
    sheet.autoResizeColumns(1, CONFIG.headers.length);
  }

  var imageSheet = getImageSheet_();
  var imageHeaderRange = imageSheet.getRange(1, 1, 1, 5);
  var imageHeaders = imageHeaderRange.getDisplayValues()[0];
  var hasImageHeaders = imageHeaders.some(function(value) {
    return String(value).trim() !== '';
  });

  if (!hasImageHeaders) {
    imageHeaderRange.setValues([['date', 'fileId', 'fileUrl', 'fileName', 'updatedAt']]);
    imageSheet.setFrozenRows(1);
    imageSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f0e7d7');
    imageSheet.autoResizeColumns(1, 5);
  }
}

function getLogSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.sheetName);
  return sheet;
}

function getImageSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(CONFIG.imageSheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.imageSheetName);
  return sheet;
}

function listEntries_(dateString) {
  var sheet = getLogSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, CONFIG.headers.length)
    .getDisplayValues()
    .map(mapRowToEntry_)
    .filter(function(entry) {
      return entry.date === dateString;
    })
    .sort(compareEntries_);
}

function listBrands_() {
  var sheet = getLogSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var brandColumn = CONFIG.headers.indexOf('brand') + 1;
  var values = sheet.getRange(2, brandColumn, lastRow - 1, 1).getDisplayValues();
  var seen = {};

  return values
    .map(function(row) {
      return String(row[0] || '').trim();
    })
    .filter(function(value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    })
    .sort();
}

function getDailyImage_(dateString) {
  var sheet = getImageSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(dateString)) {
      return {
        date: String(values[i][0] || ''),
        fileId: String(values[i][1] || ''),
        fileUrl: String(values[i][2] || ''),
        fileName: String(values[i][3] || ''),
        updatedAt: String(values[i][4] || '')
      };
    }
  }
  return null;
}

function upsertDailyImageRow_(dateString, imageData) {
  var sheet = getImageSheet_();
  var lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][0]) === String(dateString)) {
        sheet.getRange(i + 2, 1, 1, 5).setValues([[
          dateString,
          imageData.fileId,
          imageData.fileUrl,
          imageData.fileName,
          imageData.updatedAt
        ]]);
        return;
      }
    }
  }

  sheet.appendRow([
    dateString,
    imageData.fileId,
    imageData.fileUrl,
    imageData.fileName,
    imageData.updatedAt
  ]);
}

function mapRowToEntry_(row) {
  return {
    id: String(row[0] || ''),
    date: String(row[1] || ''),
    time: String(row[2] || ''),
    waterG: toNumber_(row[3]),
    foodType: String(row[4] || ''),
    brand: String(row[5] || ''),
    foodAmountG: toNumber_(row[6]),
    medMorning: String(row[7] || ''),
    medNight: String(row[8] || ''),
    stoolDetail: String(row[9] || ''),
    vomitDetail: String(row[10] || ''),
    note: String(row[11] || ''),
    createdAt: String(row[12] || '')
  };
}

function buildSummary_(entries) {
  var hasMorningMedication = false;
  var hasNightMedication = false;
  var stoolDetails = [];
  var vomitDetails = [];

  var summary = entries.reduce(function(acc, entry) {
    acc.waterTotal += entry.waterG || 0;

    if (entry.foodType === '乾糧') acc.dryFoodTotal += entry.foodAmountG || 0;
    if (entry.foodType === '罐罐') acc.wetFoodTotal += entry.foodAmountG || 0;
    if (entry.foodType && entry.foodType !== '乾糧' && entry.foodType !== '罐罐') {
      acc.otherFoodTotal += entry.foodAmountG || 0;
    }

    if (entry.medMorning === '有') hasMorningMedication = true;
    if (entry.medNight === '有') hasNightMedication = true;

    if (entry.stoolDetail) {
      acc.stoolCount += 1;
      stoolDetails.push((entry.time || '未記時間') + ' ' + entry.stoolDetail);
    }

    if (entry.vomitDetail) {
      acc.vomitCount += 1;
      vomitDetails.push((entry.time || '未記時間') + ' ' + entry.vomitDetail);
    }

    return acc;
  }, {
    waterTotal: 0,
    dryFoodTotal: 0,
    wetFoodTotal: 0,
    otherFoodTotal: 0,
    vomitCount: 0,
    stoolCount: 0
  });

  summary.medMorning = hasMorningMedication ? '有餵' : '未勾選';
  summary.medNight = hasNightMedication ? '有餵' : '未勾選';
  summary.stoolDetails = stoolDetails;
  summary.vomitDetails = vomitDetails;
  summary.entryCount = entries.length;
  return summary;
}

function normalizePayload_(payload) {
  var taipeiNow = Utilities.formatDate(new Date(), 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ss");

  return {
    id: payload.id || Utilities.getUuid(),
    date: normalizeDate_(payload.date),
    time: normalizeTime_(payload.time),
    waterG: toNumber_(payload.waterG),
    foodType: cleanText_(payload.foodType),
    brand: cleanText_(payload.brand),
    foodAmountG: toNumber_(payload.foodAmountG),
    medMorning: payload.medMorning === '有' ? '有' : '',
    medNight: payload.medNight === '有' ? '有' : '',
    stoolDetail: cleanText_(payload.stoolDetail),
    vomitDetail: cleanText_(payload.vomitDetail),
    note: cleanText_(payload.note),
    createdAt: cleanText_(payload.createdAt) || taipeiNow
  };
}

function validateEntry_(entry) {
  if (!entry.date) throw new Error('請先選擇日期。');

  var hasContent = Boolean(
    entry.waterG ||
    entry.foodType ||
    entry.foodAmountG ||
    entry.medMorning ||
    entry.medNight ||
    entry.stoolDetail ||
    entry.vomitDetail ||
    entry.note
  );

  if (!hasContent) throw new Error('請至少填一項內容再儲存。');
}

function compareEntries_(a, b) {
  var aTime = a.time || '99:99';
  var bTime = b.time || '99:99';
  var timeCompare = String(aTime).localeCompare(String(bTime));
  if (timeCompare !== 0) return timeCompare;
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

function normalizeDate_(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  var date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd');
}

function normalizeTime_(value) {
  if (!value) return '';
  var raw = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  var match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return '';

  return ('0' + match[1]).slice(-2) + ':' + ('0' + match[2]).slice(-2);
}

function cleanText_(value) {
  return String(value || '').trim();
}

function toNumber_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  var number = Number(value);
  return isNaN(number) ? 0 : number;
}
