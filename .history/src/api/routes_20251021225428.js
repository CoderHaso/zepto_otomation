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
      
      // Trim whitespace
      const cleanApiKey = apiKey?.trim();
      const cleanMailAgent = mailAgent?.trim();
      
      if (!cleanApiKey || !cleanApiKey.startsWith('Zoho-enczapikey')) {
        return res.status(400).json({ 
          error: 'Send Mail Token formatı yanlış. "Zoho-enczapikey" ile başlamalı. Token\'ı kopyalarken boşluk bırakmayın.' 
        });
      }
      
      if (!cleanMailAgent) {
        return res.status(400).json({ error: 'Mail Agent Alias gerekli' });
      }
      
      // Validate token length (ZeptoMail tokens are typically long)
      if (cleanApiKey.length < 50) {
        return res.status(400).json({ 
          error: 'Send Mail Token çok kısa görünüyor. Token\'ın tamamını kopyaladığınızdan emin olun.' 
        });
      }
      
      // Note: Send Mail Token is only for sending emails, not for API operations
      // We cannot actually test it without sending an email
      // So we just validate the format and trust it
      
      console.log('Send Token validation:');
      console.log('- Token starts with "Zoho-enczapikey": ✓');
      console.log('- Token length:', cleanApiKey.length, 'chars');
      console.log('- Mail Agent Alias:', cleanMailAgent);
      
      res.json({ 
        success: true, 
        message: '✓ Token formatı doğru! Mail göndermeyi deneyebilirsiniz. (Not: Send Token gerçek test için mail göndermeniz gerekir)'
      });
      
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/zeptomail/sync-templates', async (req, res) => {
    try {
      const { oauthToken, mailAgent } = req.body;
      
      console.log('=== Template Sync Request ===');
      console.log('OAuth Token:', oauthToken ? `${oauthToken.substring(0, 20)}...` : 'EMPTY');
      console.log('Mail Agent:', mailAgent);
      
      if (!oauthToken) {
        return res.status(400).json({ error: 'OAuth Token gerekli. Zoho Developer Console\'dan Self Client oluşturun.' });
      }
      
      if (!mailAgent) {
        return res.status(400).json({ error: 'Mail Agent Alias gerekli' });
      }
      
      // ZeptoMail API'sine istek at
      const apiUrl = `https://api.zeptomail.com/v1.1/mailagents/${mailAgent}/templates?offset=0&limit=100`;
      console.log('API URL:', apiUrl);
      
      // OAuth token formatını düzenle
      const authHeader = oauthToken.startsWith('Zoho-oauthtoken ') 
        ? oauthToken 
        : `Zoho-oauthtoken ${oauthToken}`;
      
      console.log('Auth Header:', authHeader.substring(0, 30) + '...');
      
      const response = await axios.get(apiUrl, {
        headers: { 
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('API Response Status:', response.status);
      console.log('Templates Found:', response.data.data?.length || 0);
      
      const zeptoTemplates = response.data.data || [];
      const templatesPath = path.join(__dirname, '../../data/templates.json');
      let localTemplates = [];
      
      if (fs.existsSync(templatesPath)) {
        localTemplates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      }
      
      let newCount = 0;
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
          newCount++;
        }
      });
      
      fs.writeFileSync(templatesPath, JSON.stringify(localTemplates, null, 2));
      
      console.log('New templates added:', newCount);
      console.log('Total templates:', localTemplates.length);
      
      res.json({ success: true, count: newCount });
    } catch (error) {
      console.error('=== Sync Templates Error ===');
      console.error('Error message:', error.message);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Full error:', error);
      
      const errorMessage = error.response?.data?.error?.message 
        || error.response?.data?.message 
        || error.message 
        || 'Bilinmeyen hata';
      
      res.status(500).json({ 
        error: `Template senkronizasyonu başarısız: ${errorMessage}`,
        details: error.response?.data 
      });
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