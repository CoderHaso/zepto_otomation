const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');

const upload = multer({ dest: 'uploads/' });

// Helper functions
const getDataPath = () => {
  return global.dataPath || path.join(__dirname, '../../data');
};

const readJSON = (filename) => {
  const filepath = path.join(getDataPath(), filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return filename.endsWith('.json') && filename !== 'settings.json' ? [] : {};
};

const writeJSON = (filename, data) => {
  const filepath = path.join(getDataPath(), filename);
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
};

// Queue processor
let queueProcessor = null;

const startQueueProcessor = () => {
  if (queueProcessor) return;
  
  queueProcessor = setInterval(async () => {
    const settings = readJSON('settings.json');
    if (!settings.autoProcessQueue) return;
    
    const queue = readJSON('queue.json');
    const now = new Date();
    
    const readyItems = queue.filter(item => 
      item.status === 'pending' && 
      new Date(item.scheduledAt) <= now
    );
    
    for (const item of readyItems) {
      await processQueueItem(item);
    }
  }, 60000); // Check every minute
};

const processQueueItem = async (item) => {
  const queue = readJSON('queue.json');
  const itemIndex = queue.findIndex(q => q.id === item.id);
  
  if (itemIndex === -1) return;
  
  // Update status to processing
  queue[itemIndex].status = 'processing';
  queue[itemIndex].startedAt = new Date().toISOString();
  writeJSON('queue.json', queue);
  
  try {
    const domains = readJSON('domains.json');
    const accounts = readJSON('accounts.json');
    const templates = readJSON('templates.json');
    const contacts = readJSON('contacts.json');
    
    const domain = domains.find(d => d.id === item.domainId);
    const template = templates.find(t => t.id === item.templateId);
    
    const results = [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    for (const assignment of item.assignments) {
      const account = accounts.find(a => a.id === assignment.accountId);
      const accountContacts = contacts.filter(c => assignment.contactIds.includes(c.id));
      
      for (const contact of accountContacts) {
        try {
          if (domain.useSMTP) {
            const messageId = await sendViaSMTP(domain, account, contact, template);
            results.push({ accountId: account.id, contactId: contact.id, status: 'sent', messageId });
          } else {
            const mergeInfo = buildMergeInfo(template, contact, account);
            
            let response;
            if (template.templateKey && template.templateKey.trim()) {
              response = await axios.post(
                `https://${domain.host}/v1.1/email/template`,
                {
                  from: { address: account.email, name: account.displayName },
                  to: [{ email_address: { address: contact.email, name: contact.full_name } }],
                  template_key: template.templateKey,
                  merge_info: mergeInfo,
                  track_clicks: true,
                  track_opens: true
                },
                { headers: { 'Authorization': domain.apiKey, 'Content-Type': 'application/json' } }
              );
            } else {
              let htmlBody = template.htmlBody || '';
              let subject = template.subject || 'No Subject';
              
              for (const [key, value] of Object.entries(mergeInfo)) {
                htmlBody = htmlBody.replace(new RegExp(`{${key}}`, 'gi'), value);
                subject = subject.replace(new RegExp(`{${key}}`, 'gi'), value);
              }
              
              response = await axios.post(
                `https://${domain.host}/v1.1/email`,
                {
                  from: { address: account.email, name: account.displayName },
                  to: [{ email_address: { address: contact.email, name: contact.full_name } }],
                  subject: subject,
                  htmlbody: htmlBody,
                  track_clicks: true,
                  track_opens: true
                },
                { headers: { 'Authorization': domain.apiKey, 'Content-Type': 'application/json' } }
              );
            }
            results.push({ accountId: account.id, contactId: contact.id, status: 'sent', messageId: response.data?.data?.[0]?.message_id });
          }
          await delay(500);
          
        } catch (error) {
          console.error('Send error:', error.response?.data || error.message);
          results.push({
            accountId: account.id,
            contactId: contact.id,
            status: 'failed',
            error: JSON.stringify(error.response?.data) || error.message
          });
        }
      }
    }
    
    // Update queue item as completed
    queue[itemIndex].status = 'completed';
    queue[itemIndex].completedAt = new Date().toISOString();
    queue[itemIndex].results = results;
    writeJSON('queue.json', queue);
    
    // Save to history
    const history = readJSON('send-history.json');
    history.push({
      id: Date.now().toString(),
      domainId: item.domainId,
      templateId: item.templateId,
      queueId: item.id,
      results: results,
      sentAt: new Date().toISOString()
    });
    writeJSON('send-history.json', history);
    
    // Update stats
    updateStats(item.domainId, results);
    
    // Google Sheets güncelle
    try {
      await axios.post('http://localhost:3000/api/sheets/update-after-send', { results });
    } catch (err) {
      console.error('Google Sheets update error:', err.message);
    }
    
  } catch (error) {
    console.error('Queue processing error:', error);
    queue[itemIndex].status = 'failed';
    queue[itemIndex].error = error.message;
    writeJSON('queue.json', queue);
  }
};

const buildMergeInfo = (template, contact, account) => {
  const mergeInfo = {};
  
  for (const [fieldName, mapping] of Object.entries(template.mergeFieldMapping)) {
    if (mapping.type === 'column') {
      const columnValue = contact[mapping.value] || contact[mapping.value.toLowerCase()] || contact[mapping.value.toUpperCase()] || '';
      mergeInfo[fieldName] = columnValue;
    } else if (mapping.type === 'text') {
      mergeInfo[fieldName] = mapping.value;
    } else if (mapping.type === 'auto' && mapping.value === 'account_name') {
      mergeInfo[fieldName] = account.displayName;
    } else if (mapping.type === 'account_info') {
      const nameParts = (account.name || account.displayName || '').split(' ');
      if (mapping.value === 'first_name') {
        mergeInfo[fieldName] = nameParts[0] || '';
      } else if (mapping.value === 'last_name') {
        mergeInfo[fieldName] = nameParts.slice(1).join(' ') || '';
      } else if (mapping.value === 'full_name') {
        mergeInfo[fieldName] = account.displayName || account.name || '';
      } else if (mapping.value === 'email') {
        mergeInfo[fieldName] = account.email || '';
      }
    }
  }
  return mergeInfo;
};

const sendViaSMTP = async (domain, account, contact, template) => {
  const transporter = nodemailer.createTransport({
    host: domain.smtpHost,
    port: domain.smtpPort,
    secure: false,
    auth: { user: domain.smtpUser, pass: domain.smtpPass }
  });

  let html = template.htmlBody || '';
  let subject = template.subject || 'No Subject';
  const mergeInfo = buildMergeInfo(template, contact, account);
  
  for (const [key, value] of Object.entries(mergeInfo)) {
    html = html.replace(new RegExp(`{${key}}`, 'gi'), value);
    subject = subject.replace(new RegExp(`{${key}}`, 'gi'), value);
  }

  const info = await transporter.sendMail({
    from: `"${account.displayName}" <${account.email}>`,
    to: `"${contact.full_name}" <${contact.email}>`,
    subject: subject,
    html: html
  });

  return info.messageId;
};

const updateStats = (domainId, results) => {
  const domains = readJSON('domains.json');
  const accounts = readJSON('accounts.json');
  const contacts = readJSON('contacts.json');
  
  const domain = domains.find(d => d.id === domainId);
  if (domain) {
    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    domain.stats.totalSent += results.length;
    domain.stats.successful += successful;
    domain.stats.failed += failed;
  }
  
  // Update account stats and contact sendStatus
  results.forEach(result => {
    const account = accounts.find(a => a.id === result.accountId);
    if (account) {
      account.stats.totalSent += 1;
      if (result.status === 'sent') {
        account.stats.successful += 1;
      } else {
        account.stats.failed += 1;
      }
    }

    const contact = contacts.find(c => c.id === result.contactId);
    if (contact) {
      contact.sendStatus = result.status === 'sent' ? 'sent' : 'failed';
    }
  });
  
  writeJSON('domains.json', domains);
  writeJSON('accounts.json', accounts);
  writeJSON('contacts.json', contacts);
};

module.exports = (app) => {
  
  // Start queue processor
  startQueueProcessor();
  
  // Google Sheets integration
  require('./googleSheets')(app);
  
  // ==================== DOMAINS ====================
  
  app.get('/api/domains', (req, res) => {
    try {
      const domains = readJSON('domains.json');
      res.json(domains);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/domains', (req, res) => {
    try {
      const domains = readJSON('domains.json');
      
      const newDomain = {
        id: Date.now().toString(),
        name: req.body.name,
        domain: req.body.domain,
        apiKey: req.body.apiKey,
        mailAgent: req.body.mailAgent,
        host: req.body.host || 'api.zeptomail.com',
        active: false,
        stats: {
          totalSent: 0,
          successful: 0,
          failed: 0
        },
        createdAt: new Date().toISOString()
      };
      
      domains.push(newDomain);
      writeJSON('domains.json', domains);
      
      res.json(newDomain);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/domains/:id', (req, res) => {
    try {
      const domains = readJSON('domains.json');
      const index = domains.findIndex(d => d.id === req.params.id);
      
      if (index !== -1) {
        domains[index] = { ...domains[index], ...req.body, updatedAt: new Date().toISOString() };
        writeJSON('domains.json', domains);
        res.json(domains[index]);
      } else {
        res.status(404).json({ error: 'Domain not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/domains/:id', (req, res) => {
    try {
      const domains = readJSON('domains.json');
      const filtered = domains.filter(d => d.id !== req.params.id);
      writeJSON('domains.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/domains/:id/activate', (req, res) => {
    try {
      const domains = readJSON('domains.json');
      
      // Deactivate all
      domains.forEach(d => d.active = false);
      
      // Activate selected
      const domain = domains.find(d => d.id === req.params.id);
      if (domain) {
        domain.active = true;
        writeJSON('domains.json', domains);
        
        // Update settings
        const settings = readJSON('settings.json');
        settings.activeDomainId = req.params.id;
        writeJSON('settings.json', settings);
        
        res.json(domain);
      } else {
        res.status(404).json({ error: 'Domain not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ACCOUNTS ====================
  
  app.get('/api/accounts', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      const domainId = req.query.domainId;
      
      if (domainId) {
        const filtered = accounts.filter(a => a.domainId === domainId);
        res.json(filtered);
      } else {
        res.json(accounts);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/accounts', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      
      const newAccount = {
        id: Date.now().toString(),
        domainId: req.body.domainId,
        name: req.body.name,
        email: req.body.email,
        displayName: req.body.displayName,
        active: true,
        stats: {
          totalSent: 0,
          successful: 0,
          failed: 0
        },
        createdAt: new Date().toISOString()
      };
      
      accounts.push(newAccount);
      writeJSON('accounts.json', accounts);
      
      res.json(newAccount);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/accounts/:id', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      const index = accounts.findIndex(a => a.id === req.params.id);
      
      if (index !== -1) {
        accounts[index] = { ...accounts[index], ...req.body, updatedAt: new Date().toISOString() };
        writeJSON('accounts.json', accounts);
        res.json(accounts[index]);
      } else {
        res.status(404).json({ error: 'Account not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/accounts/:id', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      const filtered = accounts.filter(a => a.id !== req.params.id);
      writeJSON('accounts.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/accounts/:id/toggle', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      const account = accounts.find(a => a.id === req.params.id);
      
      if (account) {
        account.active = !account.active;
        writeJSON('accounts.json', accounts);
        res.json(account);
      } else {
        res.status(404).json({ error: 'Account not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test account
  app.post('/api/accounts/:id/test', async (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      const domains = readJSON('domains.json');
      const templates = readJSON('templates.json');
      const contacts = readJSON('contacts.json');
      
      const account = accounts.find(a => a.id === req.params.id);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      const domain = domains.find(d => d.id === account.domainId);
      if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      
      const domainTemplates = templates.filter(t => t.domainId === domain.id);
      if (domainTemplates.length === 0) {
        return res.status(400).json({ error: 'No templates found for this domain' });
      }
      
      const domainContacts = contacts.filter(c => c.domainId === domain.id);
      if (domainContacts.length === 0) {
        return res.status(400).json({ error: 'No contacts found for this domain' });
      }
      
      const template = domainTemplates[0];
      const contact = domainContacts[0];
      
      if (domain.useSMTP) {
        const messageId = await sendViaSMTP(domain, account, contact, template);
        res.json({ success: true, message: `Test email sent from ${account.email} to ${contact.email}`, messageId });
      } else {
        const mergeInfo = buildMergeInfo(template, contact, account);
        
        let response;
        if (template.templateKey && template.templateKey.trim()) {
          response = await axios.post(
            `https://${domain.host}/v1.1/email/template`,
            {
              from: { address: account.email, name: account.displayName },
              to: [{ email_address: { address: contact.email, name: contact.full_name } }],
              template_key: template.templateKey,
              merge_info: mergeInfo,
              track_clicks: true,
              track_opens: true
            },
            { headers: { 'Authorization': domain.apiKey, 'Content-Type': 'application/json' } }
          );
        } else {
          let htmlBody = template.htmlBody || '';
          let subject = template.subject || 'No Subject';
          
          for (const [key, value] of Object.entries(mergeInfo)) {
            htmlBody = htmlBody.replace(new RegExp(`{${key}}`, 'gi'), value);
            subject = subject.replace(new RegExp(`{${key}}`, 'gi'), value);
          }
          
          response = await axios.post(
            `https://${domain.host}/v1.1/email`,
            {
              from: { address: account.email, name: account.displayName },
              to: [{ email_address: { address: contact.email, name: contact.full_name } }],
              subject: subject,
              htmlbody: htmlBody,
              track_clicks: true,
              track_opens: true
            },
            { headers: { 'Authorization': domain.apiKey, 'Content-Type': 'application/json' } }
          );
        }
        res.json({ success: true, message: `Test email sent from ${account.email} to ${contact.email}`, data: response.data });
      }
      
    } catch (error) {
      res.status(500).json({ 
        error: error.response?.data?.message || error.message,
        details: error.response?.data 
      });
    }
  });

  // ==================== TEMPLATES ====================
  
  app.post('/api/templates/fetch', async (req, res) => {
    try {
      const { domainId, templateKey } = req.body;
      const domains = readJSON('domains.json');
      const domain = domains.find(d => d.id === domainId);
      
      if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      
      const response = await axios.get(
        `https://${domain.host}/v1.1/email/template/${templateKey}`,
        { headers: { 'Authorization': domain.apiKey } }
      );
      
      const templateData = response.data.data;
      const mergeFields = {};
      
      const fieldRegex = /\{([^}]+)\}/g;
      const htmlContent = templateData.htmlbody || '';
      const matches = htmlContent.matchAll(fieldRegex);
      
      for (const match of matches) {
        const fieldName = match[1];
        if (fieldName !== 'account_name') {
          mergeFields[fieldName] = { type: 'column', value: '' };
        }
      }
      
      mergeFields['account_name'] = {
        type: 'auto',
        value: 'account_name',
        description: 'Otomatik - Gönderen hesabın adı'
      };
      
      res.json({
        name: templateData.template_name || 'Unnamed Template',
        subject: templateData.subject || '',
        htmlBody: templateData.htmlbody || '',
        mergeFields: mergeFields
      });
    } catch (error) {
      res.status(500).json({ 
        error: error.response?.data?.message || error.message,
        details: error.response?.data
      });
    }
  });
  
  app.get('/api/templates', (req, res) => {
    try {
      const templates = readJSON('templates.json');
      const domainId = req.query.domainId;
      
      if (domainId) {
        const filtered = templates.filter(t => t.domainId === domainId);
        res.json(filtered);
      } else {
        res.json(templates);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/templates', (req, res) => {
    try {
      const templates = readJSON('templates.json');
      
      const newTemplate = {
        id: Date.now().toString(),
        domainId: req.body.domainId,
        name: req.body.name,
        templateKey: req.body.templateKey || '',
        subject: req.body.subject || '',
        htmlBody: req.body.htmlBody || '',
        mergeFieldMapping: req.body.mergeFieldMapping || {},
        usageCount: 0,
        createdAt: new Date().toISOString()
      };
      
      templates.push(newTemplate);
      writeJSON('templates.json', templates);
      
      res.json(newTemplate);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/templates/:id', (req, res) => {
    try {
      const templates = readJSON('templates.json');
      const index = templates.findIndex(t => t.id === req.params.id);
      
      if (index !== -1) {
        templates[index] = { ...templates[index], ...req.body, updatedAt: new Date().toISOString() };
        writeJSON('templates.json', templates);
        res.json(templates[index]);
      } else {
        res.status(404).json({ error: 'Template not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/templates/:id', (req, res) => {
    try {
      const templates = readJSON('templates.json');
      const filtered = templates.filter(t => t.id !== req.params.id);
      writeJSON('templates.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CONTACTS ====================
  
  app.get('/api/contacts', (req, res) => {
    try {
      const contacts = readJSON('contacts.json');
      const domainId = req.query.domainId;
      
      if (domainId) {
        const filtered = contacts.filter(c => c.domainId === domainId);
        res.json(filtered);
      } else {
        res.json(contacts);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts', (req, res) => {
    try {
      const contacts = readJSON('contacts.json');
      
      const newContact = {
        id: Date.now().toString(),
        domainId: req.body.domainId,
        accountId: req.body.accountId,
        name: req.body.name,
        surname: req.body.surname,
        full_name: req.body.full_name,
        email: req.body.email,
        link: req.body.link || '',
        aaweb: req.body.aaweb || '',
        web: req.body.web || '',
        facebook_resolved: req.body.facebook_resolved || '',
        sendStatus: 'unsent',
        createdAt: new Date().toISOString()
      };
      
      contacts.push(newContact);
      writeJSON('contacts.json', contacts);
      
      res.json(newContact);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/import-csv', upload.single('csvFile'), (req, res) => {
    const domainId = req.body.domainId || req.query.domainId;
    const accountId = req.body.accountId || req.query.accountId;
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    const processContacts = (data) => {
      try {
        const contacts = readJSON('contacts.json');
        
        const newContacts = data.map(row => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          domainId: domainId,
          accountId: accountId,
          name: row.name || '',
          surname: row.surname || '',
          full_name: row.full_name || `${row.name || ''} ${row.surname || ''}`.trim(),
          email: row.email || '',
          link: row.link || '',
          aaweb: row.aaweb || '',
          web: row.web || '',
          facebook_resolved: row.facebook_resolved || '',
          sendStatus: 'unsent',
          createdAt: new Date().toISOString()
        }));
        
        contacts.push(...newContacts);
        writeJSON('contacts.json', contacts);
        
        // Clean up
        fs.unlinkSync(filePath);
        
        res.json({ imported: newContacts.length, contacts: newContacts });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };
    
    try {
      if (fileExt === '.xlsx' || fileExt === '.xls') {
        // Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const results = XLSX.utils.sheet_to_json(worksheet);
        processContacts(results);
      } else {
        // CSV file
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => processContacts(results));
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/contacts/:id', (req, res) => {
    try {
      const contacts = readJSON('contacts.json');
      const filtered = contacts.filter(c => c.id !== req.params.id);
      writeJSON('contacts.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/bulk-write', (req, res) => {
    try {
      const { contacts: newContacts, domainId } = req.body;
      const contacts = readJSON('contacts.json');
      
      const filtered = contacts.filter(c => c.domainId !== domainId);
      filtered.push(...newContacts);
      
      writeJSON('contacts.json', filtered);
      console.log('Bulk write:', newContacts.length, 'contacts for domain', domainId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SEND & QUEUE ====================
  
  // Send immediately
  app.post('/api/send/immediate', async (req, res) => {
    try {
      const { domainId, templateId, assignments } = req.body;
      
      console.log('Send request:', { domainId, templateId, assignments });
      
      const domains = readJSON('domains.json');
      const accounts = readJSON('accounts.json');
      const templates = readJSON('templates.json');
      const contacts = readJSON('contacts.json');
      
      console.log('Total contacts:', contacts.length);
      
      const domain = domains.find(d => d.id === domainId);
      const template = templates.find(t => t.id === templateId);
      
      if (!domain || !template) {
        return res.status(400).json({ error: 'Domain or template not found' });
      }
      
      const results = [];
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      
      for (const assignment of assignments) {
        const account = accounts.find(a => a.id === assignment.accountId);
        const accountContacts = assignment.contacts || [];
        console.log('Account:', account?.email, 'Contacts:', accountContacts.length);
        
        for (const contact of accountContacts) {
          try {
            if (domain.useSMTP) {
              const messageId = await sendViaSMTP(domain, account, contact, template);
              results.push({ accountId: account.id, contactId: contact.id, status: 'sent', messageId });
            } else {
              const mergeInfo = buildMergeInfo(template, contact, account);
              
              let response;
              if (template.templateKey && template.templateKey.trim()) {
                response = await axios.post(
                  `https://${domain.host}/v1.1/email/template`,
                  {
                    from: { address: account.email, name: account.displayName },
                    to: [{ email_address: { address: contact.email, name: contact.full_name } }],
                    template_key: template.templateKey,
                    merge_info: mergeInfo,
                    track_clicks: true,
                    track_opens: true
                  },
                  { headers: { 'Authorization': domain.apiKey, 'Content-Type': 'application/json' } }
                );
              } else {
                let htmlBody = template.htmlBody || '';
                let subject = template.subject || 'No Subject';
                
                for (const [key, value] of Object.entries(mergeInfo)) {
                  htmlBody = htmlBody.replace(new RegExp(`{${key}}`, 'gi'), value);
                  subject = subject.replace(new RegExp(`{${key}}`, 'gi'), value);
                }
                
                response = await axios.post(
                  `https://${domain.host}/v1.1/email`,
                  {
                    from: { address: account.email, name: account.displayName },
                    to: [{ email_address: { address: contact.email, name: contact.full_name } }],
                    subject: subject,
                    htmlbody: htmlBody,
                    track_clicks: true,
                    track_opens: true
                  },
                  { headers: { 'Authorization': domain.apiKey, 'Content-Type': 'application/json' } }
                );
              }
              results.push({ accountId: account.id, contactId: contact.id, contact: contact, status: 'sent', messageId: response.data?.data?.[0]?.message_id });
            }
            await delay(500);
            
          } catch (error) {
            console.error('Send error:', error.response?.data || error.message);
            results.push({
              accountId: account.id,
              contactId: contact.id,
              contact: contact,
              status: 'failed',
              error: JSON.stringify(error.response?.data) || error.message
            });
          }
        }
      }
      
      // Save to history
      const history = readJSON('send-history.json');
      history.push({
        id: Date.now().toString(),
        domainId: domainId,
        templateId: templateId,
        results: results,
        sentAt: new Date().toISOString()
      });
      writeJSON('send-history.json', history);
      
      // Update stats
      updateStats(domainId, results);
      
      // Google Sheets güncelle
      try {
        await axios.post('http://localhost:3000/api/sheets/update-after-send', { results });
      } catch (err) {
        console.error('Google Sheets update error:', err.message);
      }
      
      console.log('Total results:', results.length);
      res.json({ results });
    } catch (error) {
      console.error('Send error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add to queue
  app.post('/api/queue/add', (req, res) => {
    try {
      const queue = readJSON('queue.json');
      
      const newItem = {
        id: Date.now().toString(),
        domainId: req.body.domainId,
        templateId: req.body.templateId,
        assignments: req.body.assignments,
        scheduledAt: req.body.scheduledAt || new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      queue.push(newItem);
      writeJSON('queue.json', queue);
      
      res.json(newItem);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get queue
  app.get('/api/queue', (req, res) => {
    try {
      const queue = readJSON('queue.json');
      const domainId = req.query.domainId;
      
      if (domainId) {
        const filtered = queue.filter(q => q.domainId === domainId);
        res.json(filtered);
      } else {
        res.json(queue);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel queue item
  app.delete('/api/queue/:id', (req, res) => {
    try {
      const queue = readJSON('queue.json');
      const item = queue.find(q => q.id === req.params.id);
      
      if (item && item.status === 'pending') {
        item.status = 'cancelled';
        writeJSON('queue.json', queue);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Cannot cancel this item' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== HISTORY & REPORTS ====================
  
  app.get('/api/history', (req, res) => {
    try {
      const history = readJSON('send-history.json');
      const domainId = req.query.domainId;
      
      if (domainId) {
        const filtered = history.filter(h => h.domainId === domainId);
        res.json(filtered);
      } else {
        res.json(history);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/history/:id', (req, res) => {
    try {
      const history = readJSON('send-history.json');
      const keepContacts = req.query.keepContacts === 'true';
      
      if (!keepContacts) {
        const contacts = readJSON('contacts.json');
        const item = history.find(h => h.id === req.params.id);
        if (item) {
          const contactIds = item.results.map(r => r.contactId);
          contactIds.forEach(cid => {
            const contact = contacts.find(c => c.id === cid);
            if (contact) contact.sendStatus = 'unsent';
          });
          writeJSON('contacts.json', contacts);
        }
      }
      
      const filtered = history.filter(h => h.id !== req.params.id);
      writeJSON('send-history.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/history/bulk-delete', (req, res) => {
    try {
      const { ids } = req.body;
      const history = readJSON('send-history.json');
      const keepContacts = req.query.keepContacts === 'true';
      
      if (!keepContacts) {
        const contacts = readJSON('contacts.json');
        const itemsToDelete = history.filter(h => ids.includes(h.id));
        const allContactIds = new Set();
        
        itemsToDelete.forEach(item => {
          item.results.forEach(r => allContactIds.add(r.contactId));
        });
        
        allContactIds.forEach(cid => {
          const contact = contacts.find(c => c.id === cid);
          if (contact) contact.sendStatus = 'unsent';
        });
        
        writeJSON('contacts.json', contacts);
      }
      
      const filtered = history.filter(h => !ids.includes(h.id));
      writeJSON('send-history.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== SETTINGS ====================
  
  app.get('/api/settings', (req, res) => {
    try {
      const settings = readJSON('settings.json');
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      writeJSON('settings.json', req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== WEBHOOK ====================
  
  app.post('/api/webhook/zeptomail', (req, res) => {
    try {
      const event = req.body;
      console.log('ZeptoMail Webhook:', JSON.stringify(event, null, 2));
      
      const tracking = readJSON('email-tracking.json');
      
      const trackingEvent = {
        id: Date.now().toString(),
        eventType: event.event_type,
        messageId: event.message_id,
        recipient: event.recipient,
        timestamp: event.timestamp || new Date().toISOString(),
        data: event
      };
      
      tracking.push(trackingEvent);
      writeJSON('email-tracking.json', tracking);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tracking', (req, res) => {
    try {
      const tracking = readJSON('email-tracking.json');
      const messageId = req.query.messageId;
      
      if (messageId) {
        const filtered = tracking.filter(t => t.messageId === messageId);
        res.json(filtered);
      } else {
        res.json(tracking);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear completed queue
  app.post('/api/queue/clear-completed', (req, res) => {
    try {
      const queue = readJSON('queue.json');
      const filtered = queue.filter(q => q.status !== 'completed' && q.status !== 'cancelled');
      writeJSON('queue.json', filtered);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download Excel template
  app.get('/api/templates/download-excel', (req, res) => {
    try {
      const workbook = XLSX.utils.book_new();
      const data = [
        ['name', 'email', 'situation', 'pack'],
        ['John Doe', 'john@example.com', 'Request', 'Pack 1'],
        ['Jane Smith', 'jane@example.com', '', '']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      
      // Add data validation for situation column (C)
      if (!worksheet['!dataValidation']) worksheet['!dataValidation'] = [];
      worksheet['!dataValidation'].push({
        sqref: 'C2:C1000',
        type: 'list',
        formula1: '"Request,Details,Questions,Received,Published,Already Have,Failed Sent,Declined"',
        showDropDown: true
      });
      
      // Add data validation for pack column (D)
      worksheet['!dataValidation'].push({
        sqref: 'D2:D1000',
        type: 'list',
        formula1: '"Pack 1,Pack 2,Pack 3,Offer,Declined"',
        showDropDown: true
      });
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts_template.xlsx');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

