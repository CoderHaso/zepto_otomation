// Google Apps Script - Deploy as Web App
function doGet(e) {
  const sheet = e.parameter.sheet || 'Main List';
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (sheet === '__ALL_SHEETS__') {
    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(s => s.getName());
    return ContentService.createTextOutput(JSON.stringify({sheets: sheetNames}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const targetSheet = spreadsheet.getSheetByName(sheet);
  if (!targetSheet) {
    return ContentService.createTextOutput(JSON.stringify({error: 'Sheet not found'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = targetSheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({data: data}))
    .setMimeType(ContentService.MimeType.JSON);
}
