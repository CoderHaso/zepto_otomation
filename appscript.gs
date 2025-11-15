// ============================================
// GOOGLE APPS SCRIPT - COMPLETE VERSION
// Zoho Mail Manager - Google Sheets Integration
// ============================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

/**
 * doGet - GET isteklerini handle et (health check için)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Zoho Mail Manager Google Sheets API',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * doPost - POST isteklerini handle et
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    
    Logger.log(`Action received: ${action}`);
    
    let response;
    
    switch(action) {
      case 'listSheets':
        response = listSheets();
        break;
      case 'createSheet':
        response = createSheet(request.sheetName);
        break;
      case 'deleteSheet':
        response = deleteSheet(request.sheetName);
        break;
      case 'getSheetData':
        response = getSheetData(request.sheetName);
        break;
      case 'setSheetData':
        response = setSheetData(request.sheetName, request.data, request.mode);
        break;
      case 'getMainList':
        response = getSheetData('Main List');
        break;
      case 'setMainList':
        response = setSheetData('Main List', request.data, request.mode);
        break;
      case 'importData':
        response = importData(request.sheetName, request.data);
        break;
      case 'syncAll':
        response = syncAll();
        break;
      case 'initMainList':
        response = initMainList();
        break;
      default:
        response = { success: false, error: 'Unknown action: ' + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Tüm sheet'leri listele
 */
function listSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  const sheetList = sheets.map(sheet => ({
    name: sheet.getName(),
    rowCount: sheet.getLastRow(),
    columnCount: sheet.getLastColumn()
  }));
  
  return {
    success: true,
    sheets: sheetList  // Frontend'de result.sheets kullanılıyor
  };
}

/**
 * Yeni sheet oluştur
 */
function createSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet zaten var mı kontrol et
  if (ss.getSheetByName(sheetName)) {
    return {
      success: false,
      error: 'Sheet already exists: ' + sheetName
    };
  }
  
  // Yeni sheet oluştur ve başlıkları ekle
  const newSheet = ss.insertSheet(sheetName);
  const headers = ['name', 'email', 'situation', 'pack', 'lastModified'];
  newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Başlık satırını formatla
  newSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');
  
  return {
    success: true,
    message: 'Sheet created: ' + sheetName
  };
}

/**
 * Sheet sil
 */
function deleteSheet(sheetName) {
  // Main List silinemez
  if (sheetName === 'Main List') {
    return {
      success: false,
      error: 'Cannot delete Main List'
    };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return {
      success: false,
      error: 'Sheet not found: ' + sheetName
    };
  }
  
  ss.deleteSheet(sheet);
  
  return {
    success: true,
    message: 'Sheet deleted: ' + sheetName
  };
}

/**
 * Sheet'ten veri al
 * UPDATED: Eski ve yeni header formatlarını destekler + lastModified
 */
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return {
      success: false,
      error: 'Sheet not found: ' + sheetName
    };
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      success: true,
      data: []
    };
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const values = dataRange.getValues();
  
  // Header isimlerini normalize et
  const propertyMap = {
    'Authors Name': 'name',
    'Authors Email': 'email',
    'Is Situation': 'situation',
    'Pack': 'pack',
    'lastModified': 'lastModified',
    'Last Modified': 'lastModified',
    'name': 'name',
    'email': 'email',
    'situation': 'situation',
    'pack': 'pack'
  };
  
  const data = values.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      const propName = propertyMap[header] || header.toLowerCase();
      obj[propName] = row[index] || '';
    });
    return obj;
  }).filter(row => row.email && row.email.trim() !== '');
  
  return {
    success: true,
    data: data
  };
}

/**
 * Sheet'e veri yaz
 * UPDATED: lastModified desteği + otomatik migration
 */
function setSheetData(sheetName, data, mode = 'replace') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  // Sheet yoksa oluştur
  if (!sheet) {
    const createResult = createSheet(sheetName);
    if (!createResult.success) {
      return createResult;
    }
    sheet = ss.getSheetByName(sheetName);
  }
  
  // Migration: lastModified sütunu yoksa ekle
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!currentHeaders.includes('lastModified') && !currentHeaders.includes('Last Modified')) {
    const newColIndex = currentHeaders.length + 1;
    sheet.getRange(1, newColIndex).setValue('lastModified')
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    Logger.log('Migration: Added lastModified column to ' + sheetName);
  }
  
  // Veri yoksa
  if (!data || data.length === 0) {
    return {
      success: true,
      message: 'No data to write',
      rowCount: 0
    };
  }
  
  const headers = ['name', 'email', 'situation', 'pack', 'lastModified'];
  
  // Replace mode: Tüm veriyi değiştir
  if (mode === 'replace') {
    // Eski verileri temizle (başlık hariç)
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    // Yeni verileri ekle - mevcut tarihleri koru
    const rows = data.map(item => [
      item.name || '',
      item.email || '',
      item.situation || '',
      item.pack || '',
      item.lastModified || '' // Boş bırak, sadece değişenlerde tarih olacak
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  }
  // Append mode: Verileri ekle
  else if (mode === 'append') {
    const rows = data.map(item => [
      item.name || '',
      item.email || '',
      item.situation || '',
      item.pack || '',
      item.lastModified || new Date().toISOString()
    ]);
    
    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    }
  }
  
  return {
    success: true,
    message: `${data.length} rows written to ${sheetName}`,
    rowCount: data.length
  };
}

/**
 * Excel'den import edilen veriyi işle (sadece name ve email al)
 */
function importData(sheetName, importedData) {
  if (!importedData || importedData.length === 0) {
    return {
      success: false,
      error: 'No data to import'
    };
  }
  
  // Sadece name ve email kolonlarını al
  const filteredData = importedData.map(row => ({
    name: row.full_name || row.name || '',
    email: row.email || '',
    situation: '',
    pack: '',
    lastModified: new Date().toISOString()
  }));
  
  // Append mode ile ekle
  return setSheetData(sheetName, filteredData, 'append');
}

/**
 * Tüm sheet'leri senkronize et
 */
function syncAll() {
  const sheets = listSheets();
  return {
    success: true,
    message: 'All sheets synchronized',
    sheets: sheets.sheets
  };
}

/**
 * Main List'i başlat (ilk kurulum için)
 */
function initMainList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let mainSheet = ss.getSheetByName('Main List');
  
  if (!mainSheet) {
    createSheet('Main List');
  }
  
  return {
    success: true,
    message: 'Main List initialized'
  };
}
