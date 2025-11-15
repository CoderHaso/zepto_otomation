const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');

const upload = multer({ dest: 'uploads/' });

// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysYWruxByEjMjk8t3kBJKvsk1VAwAyb_s7J39RkPSJnmn15mIAPJNpSEkm96pIUCxxFA/exec';

const getDataPath = () => {
  return global.dataPath || path.join(__dirname, '../../data');
};

const readJSON = (filename) => {
  const filepath = path.join(getDataPath(), filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return filename.endsWith('.json') ? [] : {};
};

const writeJSON = (filename, data) => {
  const filepath = path.join(getDataPath(), filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
};

// Cache için
let sheetsCache = {};
let cacheTimestamps = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

const callGoogleScript = async (action, params = {}) => {
  try {
    const response = await axios.post(GOOGLE_SCRIPT_URL, {
      action,
      ...params
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
};

const normalizeEmail = (email) => email.toLowerCase().trim();

const normalizeSituation = (situation) => {
  if (!situation) return '';
  const s = situation.toLowerCase().trim();
  const map = {
    'request': 'Request',
    'details': 'Details',
    'questions': 'Questions',
    'received': 'Received',
    'published': 'Published',
    'already have': 'Already Have',
    'failed sent': 'Failed Sent',
    'declined': 'Declined'
  };
  return map[s] || situation;
};

module.exports = (app) => {
  
  // Sheet'leri listele
  app.get('/api/sheets/list', async (req, res) => {
    try {
      const result = await callGoogleScript('listSheets');
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Main List'i getir (cache ile)
  app.get('/api/sheets/main-list', async (req, res) => {
    try {
      const now = Date.now();
      if (sheetsCache['Main List'] && (now - cacheTimestamps['Main List']) < CACHE_DURATION) {
        return res.json({ success: true, data: sheetsCache['Main List'], cached: true });
      }

      const result = await callGoogleScript('getSheetData', { sheetName: 'Main List' });
      if (result.success) {
        sheetsCache['Main List'] = result.data;
        cacheTimestamps['Main List'] = now;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Account sheet'ini getir (cache ile)
  app.get('/api/sheets/account/:email', async (req, res) => {
    try {
      const email = normalizeEmail(req.params.email);
      const now = Date.now();
      
      if (sheetsCache[email] && (now - cacheTimestamps[email]) < CACHE_DURATION) {
        return res.json({ success: true, data: sheetsCache[email], cached: true });
      }

      const result = await callGoogleScript('getSheetData', { sheetName: email });
      if (result.success) {
        sheetsCache[email] = result.data;
        cacheTimestamps[email] = now;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Kişileri Google Sheets'ten yükle
  app.post('/api/sheets/load-contacts', async (req, res) => {
    try {
      const { accountId } = req.body;
      const accounts = readJSON('accounts.json');
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const email = normalizeEmail(account.email);
      
      // Account sheet'ini getir
      const accountResult = await callGoogleScript('getSheetData', { sheetName: email });
      
      if (!accountResult.success) {
        return res.status(400).json({ error: 'Account sheet not found in Google Sheets' });
      }

      const contacts = readJSON('contacts.json');
      let addedCount = 0;

      accountResult.data.forEach(row => {
        if (!row.email) return;
        
        const existingContact = contacts.find(c => 
          normalizeEmail(c.email) === normalizeEmail(row.email) && 
          c.accountId === accountId
        );

        if (!existingContact) {
          contacts.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            domainId: account.domainId,
            accountId: accountId,
            name: row.name || '',
            surname: '',
            full_name: row.name || '',
            email: row.email,
            situation: normalizeSituation(row.situation),
            pack: row.pack || '',
            sendStatus: row.situation && row.situation.toLowerCase() === 'failed sent' ? 'failed' : 
                       row.situation ? 'sent' : 'unsent',
            lastModified: row.lastModified || '',
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      });

      writeJSON('contacts.json', contacts);
      
      // Cache'i güncelle
      sheetsCache[email] = accountResult.data;
      cacheTimestamps[email] = Date.now();

      res.json({ success: true, added: addedCount, total: accountResult.data.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Yeni kişi ekle (hem local hem Google Sheets)
  app.post('/api/sheets/add-contact', async (req, res) => {
    try {
      const { accountId, name, email, situation, pack } = req.body;
      const accounts = readJSON('accounts.json');
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const accountEmail = normalizeEmail(account.email);
      
      const newRow = {
        name: name,
        email: email,
        situation: situation || '',
        pack: pack || '',
        lastModified: new Date().toISOString()
      };

      // Only add to account sheet (skip Main List for speed)
      const accountResult = await callGoogleScript('getSheetData', { sheetName: accountEmail });
      let accountData = accountResult.success ? accountResult.data : [];
      
      const existingInAccount = accountData.find(row => 
        normalizeEmail(row.email) === normalizeEmail(email)
      );

      // Account sheet'e ekle (yoksa)
      if (!existingInAccount) {
        await callGoogleScript('setSheetData', {
          sheetName: accountEmail,
          data: [newRow],
          mode: 'append'
        });
      }

      // Local contacts'a ekle
      const contacts = readJSON('contacts.json');
      const newContact = {
        id: Date.now().toString(),
        domainId: account.domainId,
        accountId: accountId,
        name: name,
        surname: '',
        full_name: name,
        email: email,
        situation: situation || '',
        pack: pack || '',
        sendStatus: situation && situation.toLowerCase() === 'failed sent' ? 'failed' : 
                   situation ? 'sent' : 'unsent',
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      contacts.push(newContact);
      writeJSON('contacts.json', contacts);

      // Cache'i temizle
      delete sheetsCache['Main List'];
      delete sheetsCache[accountEmail];

      res.json({ success: true, contact: newContact });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toplu kişi yükleme
  app.post('/api/sheets/import-bulk', upload.single('csvFile'), async (req, res) => {
    try {
      console.log('Import bulk started:', req.body);
      const accountId = req.body.accountId;
      const domainId = req.body.domainId;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const filePath = req.file.path;
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      console.log('File received:', req.file.originalname, fileExt);
      
      const accounts = readJSON('accounts.json');
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const accountEmail = normalizeEmail(account.email);
      
      // Dosyayı oku
      let data = [];
      console.log('Reading file...');
      if (fileExt === '.xlsx' || fileExt === '.xls') {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        console.log('Excel file read:', data.length, 'rows');
      } else {
        // CSV
        data = await new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', reject);
        });
        console.log('CSV file read:', data.length, 'rows');
      }

      // Main List ve Account sheet'i yükle
      console.log('Loading Main List from Google Sheets...');
      const mainListResult = await callGoogleScript('getSheetData', { sheetName: 'Main List' });
      let mainListData = mainListResult.success ? mainListResult.data : [];
      console.log('Main List loaded:', mainListData.length, 'rows');
      
      console.log('Loading account sheet:', accountEmail);
      const accountResult = await callGoogleScript('getSheetData', { sheetName: accountEmail });
      let accountData = accountResult.success ? accountResult.data : [];
      console.log('Account sheet loaded:', accountData.length, 'rows');

      const contacts = readJSON('contacts.json');
      let addedCount = 0;

      const newMainRows = [];
      const newAccountRows = [];

      data.forEach(row => {
        if (!row.name || !row.email) return;
        
        const email = normalizeEmail(row.email);
        const newRow = {
          name: row.name,
          email: row.email,
          situation: row.situation || '',
          pack: row.pack || '',
          lastModified: new Date().toISOString()
        };

        // Main List'e ekle
        if (!mainListData.find(r => normalizeEmail(r.email) === email)) {
          newMainRows.push(newRow);
        }

        // Account sheet'e ekle
        if (!accountData.find(r => normalizeEmail(r.email) === email)) {
          newAccountRows.push(newRow);
        }

        // Local'e ekle
        if (!contacts.find(c => normalizeEmail(c.email) === email && c.accountId === accountId)) {
          contacts.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            domainId: domainId,
            accountId: accountId,
            name: row.name,
            surname: '',
            full_name: row.name,
            email: row.email,
            situation: row.situation || '',
            pack: row.pack || '',
            sendStatus: row.situation && row.situation.toLowerCase() === 'failed sent' ? 'failed' : 
                       row.situation ? 'sent' : 'unsent',
            lastModified: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      });

      // Google Sheets'e BATCH olarak APPEND ET (100'er satır)
      const BATCH_SIZE = 100;
      
      if (newMainRows.length > 0) {
        console.log('Appending to Main List:', newMainRows.length, 'rows in batches of', BATCH_SIZE);
        for (let i = 0; i < newMainRows.length; i += BATCH_SIZE) {
          const batch = newMainRows.slice(i, i + BATCH_SIZE);
          await callGoogleScript('setSheetData', {
            sheetName: 'Main List',
            data: batch,
            mode: 'append'
          });
          console.log(`Main List batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(newMainRows.length/BATCH_SIZE)} done`);
        }
        console.log('Main List updated');
      }

      if (newAccountRows.length > 0) {
        console.log('Appending to account sheet:', newAccountRows.length, 'rows in batches of', BATCH_SIZE);
        for (let i = 0; i < newAccountRows.length; i += BATCH_SIZE) {
          const batch = newAccountRows.slice(i, i + BATCH_SIZE);
          await callGoogleScript('setSheetData', {
            sheetName: accountEmail,
            data: batch,
            mode: 'append'
          });
          console.log(`Account sheet batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(newAccountRows.length/BATCH_SIZE)} done`);
        }
        console.log('Account sheet updated');
      }

      writeJSON('contacts.json', contacts);

      // Dosyayı sil
      fs.unlinkSync(filePath);

      // Cache'i temizle
      delete sheetsCache['Main List'];
      delete sheetsCache[accountEmail];

      console.log('Import completed:', addedCount, 'contacts added');
      res.json({ success: true, imported: addedCount });
    } catch (error) {
      console.error('Import bulk error:', error);
      // Clean up file if exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Gönderim sonrası güncelle
  app.post('/api/sheets/update-after-send', async (req, res) => {
    // Hemen cevap dön, arka planda işle
    res.json({ success: true, message: 'Update started in background' });
    
    try {
      const { results } = req.body;
      const accounts = readJSON('accounts.json');

      // Her account için güncelleme yap
      const accountUpdates = {};
      
      results.forEach(result => {
        const account = accounts.find(a => a.id === result.accountId);
        if (!account || !result.contact) return;

        const accountEmail = normalizeEmail(account.email);
        if (!accountUpdates[accountEmail]) {
          accountUpdates[accountEmail] = [];
        }

        const now = new Date().toISOString();
        accountUpdates[accountEmail].push({
          email: result.contact.email,
          situation: result.status === 'sent' ? 'Request' : 'Failed Sent',
          lastModified: now
        });
      });

      // Her account sheet'ini güncelle
      for (const [accountEmail, updates] of Object.entries(accountUpdates)) {
        const result = await callGoogleScript('getSheetData', { sheetName: accountEmail });
        if (!result.success) continue;

        let data = result.data;
        updates.forEach(update => {
          const row = data.find(r => normalizeEmail(r.email) === normalizeEmail(update.email));
          if (row) {
            row.situation = update.situation;
            row.lastModified = update.lastModified;
          }
        });

        await callGoogleScript('setSheetData', {
          sheetName: accountEmail,
          data: data,
          mode: 'replace'
        });

        // Cache'i temizle
        delete sheetsCache[accountEmail];
      }
      
      console.log('Google Sheets update completed');
    } catch (error) {
      console.error('Google Sheets update error:', error);
    }
  });

  // Cache'i temizle
  app.post('/api/sheets/clear-cache', (req, res) => {
    sheetsCache = {};
    cacheTimestamps = {};
    res.json({ success: true, message: 'Cache cleared' });
  });

  // Otomatik tüm hesapları yükle
  app.post('/api/sheets/auto-load-all', async (req, res) => {
    try {
      const { domainId } = req.body;
      const allContacts = [];
      const accountsData = readJSON('accounts.json');
      const domainsData = readJSON('domains.json');
      const domainAccounts = accountsData.filter(a => a.domainId === domainId);

      for (const account of domainAccounts) {
        const email = normalizeEmail(account.email);
        let totalSent = 0;
        let successful = 0;
        let failed = 0;
        
        try {
          const result = await callGoogleScript('getSheetData', { sheetName: email });
          
          if (result.success && result.data) {
            result.data.forEach(row => {
              if (!row.email) return;
              
              if (row.situation) {
                totalSent++;
                if (row.situation.toLowerCase() === 'failed sent') {
                  failed++;
                } else {
                  successful++;
                }
              }
              
              allContacts.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                domainId: domainId,
                accountId: account.id,
                name: row.name || '',
                surname: '',
                full_name: row.name || '',
                email: row.email,
                situation: normalizeSituation(row.situation),
                pack: row.pack || '',
                sendStatus: row.situation && row.situation.toLowerCase() === 'failed sent' ? 'failed' : 
                           row.situation ? 'sent' : 'unsent',
                lastModified: row.lastModified || '',
                createdAt: new Date().toISOString()
              });
            });
          }
          
          account.stats = { totalSent, successful, failed };
        } catch (err) {
          account.stats = { totalSent: 0, successful: 0, failed: 0 };
        }
      }
      
      const domain = domainsData.find(d => d.id === domainId);
      if (domain) {
        domain.stats = {
          totalSent: domainAccounts.reduce((sum, a) => sum + (a.stats?.totalSent || 0), 0),
          successful: domainAccounts.reduce((sum, a) => sum + (a.stats?.successful || 0), 0),
          failed: domainAccounts.reduce((sum, a) => sum + (a.stats?.failed || 0), 0)
        };
      }
      
      writeJSON('accounts.json', accountsData);
      writeJSON('domains.json', domainsData);

      res.json({ success: true, contacts: allContacts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Hesap için güncel durumu yenile
  app.post('/api/sheets/refresh-account', async (req, res) => {
    try {
      const { accountId } = req.body;
      const accounts = readJSON('accounts.json');
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const email = normalizeEmail(account.email);
      const result = await callGoogleScript('getSheetData', { sheetName: email });
      
      if (!result.success) {
        return res.status(400).json({ error: 'Sheet not found' });
      }

      const contacts = result.data.map(row => ({
        email: row.email,
        sendStatus: row.situation && row.situation.toLowerCase() === 'failed sent' ? 'failed' : 
                   row.situation ? 'sent' : 'unsent',
        situation: normalizeSituation(row.situation)
      }));

      res.json({ success: true, contacts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Account sheet oluştur
  app.post('/api/sheets/create-account-sheet', async (req, res) => {
    try {
      const { accountId } = req.body;
      const accounts = readJSON('accounts.json');
      const account = accounts.find(a => a.id === accountId);
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const email = normalizeEmail(account.email);
      const result = await callGoogleScript('createSheet', { sheetName: email });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
