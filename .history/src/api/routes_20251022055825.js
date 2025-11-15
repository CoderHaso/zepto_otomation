const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const csv = require('csv-parser');

const upload = multer({ dest: 'uploads/' });

// Helper functions
const readJSON = (filename) => {
  const filepath = path.join(__dirname, '../../data', filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return [];
};

const writeJSON = (filename, data) => {
  const filepath = path.join(__dirname, '../../data', filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
};

module.exports = (app) => {
  
  // ==================== ACCOUNTS ====================
  
  app.get('/api/accounts', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/accounts', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      
      const newAccount = {
        id: Date.now().toString(),
        name: req.body.name,
        domain: req.body.domain,
        apiKey: req.body.apiKey,
        mailAgent: req.body.mailAgent,
        senderEmail: req.body.senderEmail,
        senderName: req.body.senderName,
        host: req.body.host || 'api.zeptomail.com',
        active: false,
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

  app.post('/api/accounts/:id/activate', (req, res) => {
    try {
      const accounts = readJSON('accounts.json');
      
      // Deactivate all
      accounts.forEach(a => a.active = false);
      
      // Activate selected
      const account = accounts.find(a => a.id === req.params.id);
      if (account) {
        account.active = true;
        writeJSON('accounts.json', accounts);
        
        // Update settings
        const settings = readJSON('settings.json');
        settings.activeAccountId = req.params.id;
        writeJSON('settings.json', settings);
        
        res.json(account);
      } else {
        res.status(404).json({ error: 'Account not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== TEMPLATES ====================
  
  app.get('/api/templates', (req, res) => {
    try {
      const templates = readJSON('templates.json');
      const accountId = req.query.accountId;
      
      if (accountId) {
        const filtered = templates.filter(t => t.accountId === accountId);
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
        name: req.body.name,
        accountId: req.body.accountId,
        templateKey: req.body.templateKey,
        mergeFieldMapping: req.body.mergeFieldMapping || {},
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
      const accountId = req.query.accountId;
      
      if (accountId) {
        const filtered = contacts.filter(c => c.accountId === accountId);
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
        accountId: req.body.accountId,
        name: req.body.name,
        surname: req.body.surname,
        full_name: req.body.full_name,
        email: req.body.email,
        link: req.body.link || '',
        aaweb: req.body.aaweb || '',
        web: req.body.web || '',
        facebook_resolved: req.body.facebook_resolved || '',
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
    const results = [];
    const accountId = req.body.accountId || req.query.accountId;
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          const contacts = readJSON('contacts.json');
          
          const newContacts = results.map(row => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            accountId: accountId,
            name: row.name || '',
            surname: row.surname || '',
            full_name: row.full_name || `${row.name || ''} ${row.surname || ''}`.trim(),
            email: row.email || '',
            link: row.link || '',
            aaweb: row.aaweb || '',
            web: row.web || '',
            facebook_resolved: row.facebook_resolved || '',
            createdAt: new Date().toISOString()
          }));
          
          contacts.push(...newContacts);
          writeJSON('contacts.json', contacts);
          
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);
          
          res.json({ imported: newContacts.length, contacts: newContacts });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
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

  // ==================== SEND EMAIL ====================
  
  app.post('/api/zeptomail/send-template', async (req, res) => {
    try {
      const { accountId, templateId, contactIds } = req.body;
      
      console.log('=== Send Email ===');
      console.log('Account:', accountId);
      console.log('Template:', templateId);
      console.log('Contacts:', contactIds.length);
      
      // Load data
      const accounts = readJSON('accounts.json');
      const templates = readJSON('templates.json');
      const contacts = readJSON('contacts.json');
      
      const account = accounts.find(a => a.id === accountId);
      const template = templates.find(t => t.id === templateId);
      const selectedContacts = contacts.filter(c => contactIds.includes(c.id));
      
      if (!account) {
        return res.status(400).json({ error: 'Account not found' });
      }
      
      if (!template) {
        return res.status(400).json({ error: 'Template not found' });
      }
      
      const apiUrl = `https://${account.host}/v1.1/email/template`;
      const results = [];
      
      for (const contact of selectedContacts) {
        try {
          // Build merge info based on mapping
          const mergeInfo = {};
          
          for (const [fieldName, mapping] of Object.entries(template.mergeFieldMapping)) {
            if (mapping.type === 'column') {
              // Get value from contact column
              mergeInfo[fieldName] = contact[mapping.value] || '';
            } else if (mapping.type === 'text') {
              // Use fixed text
              mergeInfo[fieldName] = mapping.value;
            }
          }
          
          console.log(`Sending to: ${contact.email}`, mergeInfo);
          
          const response = await axios.post(apiUrl, {
            template_key: template.templateKey,
            from: {
              address: account.senderEmail,
              name: account.senderName
            },
            to: [{
              email_address: {
                address: contact.email,
                name: contact.full_name
              }
            }],
            merge_info: mergeInfo
          }, {
            headers: {
              'Authorization': account.apiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          console.log('✓ Success:', contact.email);
          
          results.push({ 
            contact: contact.email, 
            status: 'sent',
            messageId: response.data?.data?.[0]?.message_id || 'sent'
          });
          
        } catch (error) {
          console.error(`✗ Failed: ${contact.email}:`, error.response?.data || error.message);
          results.push({ 
            contact: contact.email, 
            status: 'failed', 
            error: error.response?.data?.message || error.message
          });
        }
      }
      
      // Save history
      const history = readJSON('send-history.json');
      history.push({
        id: Date.now().toString(),
        accountId: accountId,
        templateId: templateId,
        recipientCount: selectedContacts.length,
        results: results,
        sentAt: new Date().toISOString()
      });
      writeJSON('send-history.json', history);
      
      console.log('=== Send Complete ===');
      console.log('Success:', results.filter(r => r.status === 'sent').length);
      console.log('Failed:', results.filter(r => r.status === 'failed').length);
      
      res.json({ results });
    } catch (error) {
      console.error('=== Send Error ===', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test Send
  app.post('/api/zeptomail/test-send', async (req, res) => {
    try {
      console.log('=== Test Send ===');
      
      const settings = readJSON('settings.json');
      const accounts = readJSON('accounts.json');
      const templates = readJSON('templates.json');
      const contacts = readJSON('contacts.json');
      
      const account = accounts.find(a => a.id === settings.activeAccountId);
      if (!account) {
        return res.status(400).json({ error: 'Active account not found' });
      }
      
      const accountTemplates = templates.filter(t => t.accountId === account.id);
      if (accountTemplates.length === 0) {
        return res.status(400).json({ error: 'No templates found for active account' });
      }
      
      const accountContacts = contacts.filter(c => c.accountId === account.id);
      if (accountContacts.length === 0) {
        return res.status(400).json({ error: 'No contacts found for active account' });
      }
      
      const template = accountTemplates[0];
      const contact = accountContacts[0];
      
      console.log('Account:', account.name);
      console.log('Template:', template.name);
      console.log('Contact:', contact.email);
      
      // Build merge info
      const mergeInfo = {};
      for (const [fieldName, mapping] of Object.entries(template.mergeFieldMapping)) {
        if (mapping.type === 'column') {
          mergeInfo[fieldName] = contact[mapping.value] || '';
        } else {
          mergeInfo[fieldName] = mapping.value;
        }
      }
      
      console.log('Merge Info:', mergeInfo);
      
      const apiUrl = `https://${account.host}/v1.1/email/template`;
      
      const response = await axios.post(apiUrl, {
        template_key: template.templateKey,
        from: {
          address: account.senderEmail,
          name: account.senderName
        },
        to: [{
          email_address: {
            address: contact.email,
            name: contact.full_name
          }
        }],
        merge_info: mergeInfo
      }, {
        headers: {
          'Authorization': account.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✓ Test mail sent!');
      
      res.json({ 
        success: true, 
        message: `Test mail sent to ${contact.email}!`,
        data: response.data
      });
      
    } catch (error) {
      console.error('✗ Test send error:', error.response?.data || error.message);
      res.status(500).json({ 
        error: error.response?.data?.message || error.message,
        details: error.response?.data 
      });
    }
  });

  // ==================== REPORTS ====================
  
  app.get('/api/reports', (req, res) => {
    try {
      const history = readJSON('send-history.json');
      const accountId = req.query.accountId;
      
      if (accountId) {
        const filtered = history.filter(h => h.accountId === accountId);
        res.json(filtered);
      } else {
        res.json(history);
      }
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
};
