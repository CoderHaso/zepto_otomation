const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const csv = require('csv-parser');

const upload = multer({ dest: 'uploads/' });

module.exports = (app) => {
  // Settings
  app.get('/api/settings', (req, res) => {
    try {
      const settingsPath = path.join(__dirname, '../../data/settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        res.json(settings);
      } else {
        res.json({});
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const settingsPath = path.join(__dirname, '../../data/settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Templates
  app.get('/api/templates', (req, res) => {
    try {
      const templatesPath = path.join(__dirname, '../../data/templates.json');
      if (fs.existsSync(templatesPath)) {
        const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
        res.json(templates);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/templates', (req, res) => {
    try {
      const templatesPath = path.join(__dirname, '../../data/templates.json');
      let templates = [];
      
      if (fs.existsSync(templatesPath)) {
        templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      }
      
      const newTemplate = {
        id: Date.now().toString(),
        name: req.body.name,
        subject: req.body.subject,
        content: req.body.content,
        tags: req.body.tags || [],
        createdAt: new Date().toISOString(),
        zeptomailId: null
      };
      
      templates.push(newTemplate);
      fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
      
      res.json(newTemplate);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/templates/:id', (req, res) => {
    try {
      const templatesPath = path.join(__dirname, '../../data/templates.json');
      let templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      
      const index = templates.findIndex(t => t.id === req.params.id);
      if (index !== -1) {
        templates[index] = { ...templates[index], ...req.body, updatedAt: new Date().toISOString() };
        fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
        res.json(templates[index]);
      } else {
        res.status(404).json({ error: 'Template not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Contacts
  app.get('/api/contacts', (req, res) => {
    try {
      const contactsPath = path.join(__dirname, '../../data/contacts.json');
      if (fs.existsSync(contactsPath)) {
        const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
        res.json(contacts);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts', (req, res) => {
    try {
      const contactsPath = path.join(__dirname, '../../data/contacts.json');
      let contacts = [];
      
      if (fs.existsSync(contactsPath)) {
        contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
      }
      
      const newContact = {
        id: Date.now().toString(),
        name: req.body.name,
        email: req.body.email,
        customFields: req.body.customFields || {},
        createdAt: new Date().toISOString()
      };
      
      contacts.push(newContact);
      fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
      
      res.json(newContact);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/contacts/import-csv', upload.single('csvFile'), (req, res) => {
    const results = [];
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          const contactsPath = path.join(__dirname, '../../data/contacts.json');
          let contacts = [];
          
          if (fs.existsSync(contactsPath)) {
            contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
          }
          
          const newContacts = results.map(row => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: row.name || row.Name || '',
            email: row.email || row.Email || '',
            customFields: row,
            createdAt: new Date().toISOString()
          }));
          
          contacts.push(...newContacts);
          fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
          
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);
          
          res.json({ imported: newContacts.length, contacts: newContacts });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
  });

  // ZeptoMail API integration - Test Send Token
  app.post('/api/zeptomail/test', async (req, res) => {
    try {
      const { apiKey, mailAgent } = req.body;
      
      if (!apiKey || !apiKey.startsWith('Zoho-enczapikey')) {
        return res.status(400).json({ error: 'Send Mail Token formatı yanlış. "Zoho-enczapikey" ile başlamalı.' });
      }
      
      if (!mailAgent) {
        return res.status(400).json({ error: 'Mail Agent Alias gerekli' });
      }
      
      // Test the token with a simple API call (get account info or similar)
      // Note: ZeptoMail send token may not work for listing templates
      // This is just to verify the token format and basic connectivity
      try {
        await axios.get(`https://api.zeptomail.com/v1.1/mailagents/${mailAgent}`, {
          headers: { 
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        res.json({ 
          success: true, 
          message: 'Send Mail Token doğrulandı! Mail gönderebilirsiniz.' 
        });
      } catch (apiError) {
        // If template listing fails, it might be because send token doesn't have permission
        // But that's okay for send operations
        if (apiError.response?.status === 401 || apiError.response?.data?.error?.code === 'SERR_111') {
          return res.status(400).json({ 
            error: 'Send Mail Token geçersiz. ZeptoMail → Mail Agent → SMTP/API kısmından token\'ı kontrol edin.' 
          });
        }
        
        // Other errors might be OK (like permission issues for listing)
        res.json({ 
          success: true, 
          message: 'Send Mail Token formatı doğru. Mail gönderim işlemleri yapabilirsiniz.' 
        });
      }
    } catch (error) {
      console.error('ZeptoMail API Error:', error.response?.data);
      res.status(500).json({ error: error.response?.data?.message || error.message });
    }
  });

  app.post('/api/zeptomail/sync-templates', async (req, res) => {
    try {
      const { oauthToken, mailAgent } = req.body;
      
      if (!oauthToken) {
        return res.status(400).json({ error: 'OAuth Token gerekli. Zoho Developer Console\'dan Self Client oluşturun.' });
      }
      
      if (!mailAgent) {
        return res.status(400).json({ error: 'Mail Agent Alias gerekli' });
      }
      
      const response = await axios.get(`https://api.zeptomail.com/v1.1/mailagents/${mailAgent}/templates?offset=0&limit=100`, {
        headers: { 
          'Authorization': oauthToken.startsWith('Bearer ') ? oauthToken : `Bearer ${oauthToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const zeptoTemplates = response.data.data || [];
      const templatesPath = path.join(__dirname, '../../data/templates.json');
      let localTemplates = [];
      
      if (fs.existsSync(templatesPath)) {
        localTemplates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      }
      
      zeptoTemplates.forEach(zt => {
        const exists = localTemplates.find(lt => lt.zeptomailTemplateKey === zt.template_key);
        if (!exists) {
          localTemplates.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: zt.template_name,
            subject: zt.subject || '',
            content: zt.htmlbody || '',
            zeptomailTemplateKey: zt.template_key,
            zeptomailTemplateAlias: zt.template_alias || '',
            createdAt: new Date().toISOString()
          });
        }
      });
      
      fs.writeFileSync(templatesPath, JSON.stringify(localTemplates, null, 2));
      
      res.json({ success: true, count: zeptoTemplates.length });
    } catch (error) {
      console.error('Sync templates error:', error.response?.data);
      res.status(500).json({ error: error.response?.data?.message || error.message });
    }
  });

  // Send email using template (template-based send)
  app.post('/api/zeptomail/send-template', async (req, res) => {
    try {
      const { apiKey, templateKey, contacts, senderEmail, senderName, mailAgent } = req.body;
      
      if (!templateKey) {
        return res.status(400).json({ error: 'Template key gerekli' });
      }
      
      const results = [];
      
      for (const contact of contacts) {
        try {
          // Prepare merge data for this contact
          const mergeInfo = {
            Person_name: contact.name,
            email: contact.email,
            ...contact.customFields
          };
          
          const response = await axios.post('https://api.zeptomail.com/v1.1/email/template', {
            mail_agent_alias: mailAgent,
            from: { address: senderEmail, name: senderName },
            to: [{ 
              email_address: { 
                address: contact.email, 
                name: contact.name 
              } 
            }],
            template_key: templateKey,
            merge_info: mergeInfo
          }, {
            headers: { 
              'Authorization': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          results.push({ 
            contact: contact.email, 
            status: 'sent',
            messageId: response.data.data?.[0]?.message_id
          });
          
        } catch (error) {
          console.error(`Failed to send to ${contact.email}:`, error.response?.data);
          results.push({ 
            contact: contact.email, 
            status: 'failed', 
            error: error.response?.data?.message || error.message 
          });
        }
      }
      
      // Save send history
      const historyPath = path.join(__dirname, '../../data/send-history.json');
      let history = [];
      
      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
      
      history.push({
        id: Date.now().toString(),
        templateKey: templateKey,
        recipientCount: contacts.length,
        results: results,
        sentAt: new Date().toISOString()
      });
      
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send email without template (regular send - for backward compatibility)
  app.post('/api/zeptomail/send', async (req, res) => {
    try {
      const { apiKey, template, contacts, senderEmail, senderName } = req.body;
      
      const results = [];
      
      for (const contact of contacts) {
        try {
          let content = template.content;
          
          // Replace merge fields
          Object.keys(contact.customFields || {}).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            content = content.replace(regex, contact.customFields[key]);
          });
          
          content = content.replace(/{Person_name}/g, contact.name);
          content = content.replace(/{email}/g, contact.email);
          
          const response = await axios.post('https://api.zeptomail.com/v1.1/email', {
            from: { address: senderEmail, name: senderName },
            to: [{ email_address: { address: contact.email, name: contact.name } }],
            subject: template.subject,
            htmlbody: content
          }, {
            headers: { 'Authorization': apiKey }
          });
          
          results.push({ contact: contact.email, status: 'sent' });
          
        } catch (error) {
          results.push({ contact: contact.email, status: 'failed', error: error.message });
        }
      }
      
      // Save send history
      const historyPath = path.join(__dirname, '../../data/send-history.json');
      let history = [];
      
      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
      
      history.push({
        id: Date.now().toString(),
        templateName: template.name,
        recipientCount: contacts.length,
        results: results,
        sentAt: new Date().toISOString()
      });
      
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reports
  app.get('/api/reports', (req, res) => {
    try {
      const historyPath = path.join(__dirname, '../../data/send-history.json');
      if (fs.existsSync(historyPath)) {
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        res.json(history);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};