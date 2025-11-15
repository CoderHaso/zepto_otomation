const fs = require('fs');
const path = require('path');
const { SendMailClient } = require('zeptomail');
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
        content: req.body.content || '',
        zeptomailTemplateKey: req.body.zeptomailTemplateKey || null,
        zeptomailTemplateAlias: req.body.zeptomailTemplateAlias || '',
        tags: req.body.tags || [],
        createdAt: new Date().toISOString()
      };
      
      templates.push(newTemplate);
      fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
      
      res.json(newTemplate);
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

  // ZeptoMail - Template-Based Email Send (Basit ve Çalışır)
  app.post('/api/zeptomail/send-template', async (req, res) => {
    try {
      const { templateKey, contacts, senderEmail, senderName, apiKey, host } = req.body;
      
      console.log('=== ZeptoMail Template Send ===');
      console.log('Template Key:', templateKey);
      console.log('Recipients:', contacts.length);
      console.log('From:', senderEmail);
      
      if (!templateKey) {
        return res.status(400).json({ error: 'Template key gerekli' });
      }
      
      if (!contacts || contacts.length === 0) {
        return res.status(400).json({ error: 'En az bir alıcı gerekli' });
      }
      
      // ZeptoMail Client oluştur
      const url = host || 'api.zeptomail.com/';
      const token = apiKey;
      
      const client = new SendMailClient({ url, token });
      
      const results = [];
      
      for (const contact of contacts) {
        try {
          // Merge data hazırla
          const mergeInfo = {
            Person_name: contact.name,
            email: contact.email,
            ...contact.customFields
          };
          
          console.log(`Sending to: ${contact.email}`, mergeInfo);
          
          // Template ile mail gönder
          const response = await client.sendMailWithTemplate({
            template_key: templateKey,
            from: {
              address: senderEmail,
              name: senderName
            },
            to: [{
              email_address: {
                address: contact.email,
                name: contact.name
              }
            }],
            merge_info: mergeInfo
          });
          
          console.log('Success:', contact.email, response);
          
          results.push({ 
            contact: contact.email, 
            status: 'sent',
            messageId: response?.data?.[0]?.message_id || 'unknown'
          });
          
        } catch (error) {
          console.error(`Failed to send to ${contact.email}:`, error.message);
          results.push({ 
            contact: contact.email, 
            status: 'failed', 
            error: error.message
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
      
      console.log('=== Send Complete ===');
      console.log('Successful:', results.filter(r => r.status === 'sent').length);
      console.log('Failed:', results.filter(r => r.status === 'failed').length);
      
      res.json({ results });
    } catch (error) {
      console.error('=== Send Error ===');
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint - Tek bir mail gönder
  app.post('/api/zeptomail/test-send', async (req, res) => {
    try {
      console.log('=== Test Send ===');
      
      const settingsPath = path.join(__dirname, '../../data/settings.json');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      
      const templatesPath = path.join(__dirname, '../../data/templates.json');
      const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
      
      const contactsPath = path.join(__dirname, '../../data/contacts.json');
      const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
      
      if (templates.length === 0) {
        return res.status(400).json({ error: 'Template bulunamadı' });
      }
      
      if (contacts.length === 0) {
        return res.status(400).json({ error: 'Kişi bulunamadı' });
      }
      
      const template = templates[0];
      const contact = contacts[0];
      
      console.log('Template:', template.name);
      console.log('Template Key:', template.zeptomailTemplateKey);
      console.log('Contact:', contact.email);
      console.log('API Key:', settings.apiKey.substring(0, 30) + '...');
      
      const url = settings.host || 'api.zeptomail.com/';
      const client = new SendMailClient({ url, token: settings.apiKey });
      
      const mergeInfo = {
        Person_name: contact.name,
        email: contact.email,
        ...contact.customFields
      };
      
      const response = await client.sendMailWithTemplate({
        template_key: template.zeptomailTemplateKey,
        from: {
          address: settings.senderEmail,
          name: settings.senderName
        },
        to: [{
          email_address: {
            address: contact.email,
            name: contact.name
          }
        }],
        merge_info: mergeInfo
      });
      
      console.log('✓ Mail gönderildi!', response);
      
      res.json({ 
        success: true, 
        message: `Test mail ${contact.email} adresine gönderildi!`,
        response: response
      });
      
    } catch (error) {
      console.error('✗ Hata:', error);
      res.status(500).json({ error: error.message, details: error.response?.data });
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
