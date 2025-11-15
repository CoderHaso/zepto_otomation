const { ipcRenderer } = require('electron');

class YazarIletisimPaneli {
  constructor() {
    this.currentTab = 'templates';
    this.settings = {};
    this.templates = [];
    this.contacts = [];
    this.reports = [];
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    await this.loadData();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Settings
    document.getElementById('test-api').addEventListener('click', () => this.testAPI());
    document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('select-folder').addEventListener('click', () => this.selectFolder());

    // Templates
    document.getElementById('new-template').addEventListener('click', () => this.showTemplateModal());
    document.getElementById('sync-templates').addEventListener('click', () => this.syncTemplates());

    // Contacts
    document.getElementById('add-contact').addEventListener('click', () => this.showContactModal());
    document.getElementById('import-csv').addEventListener('click', () => this.importCSV());
    document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());

    // Send
    document.getElementById('preview-email').addEventListener('click', () => this.previewEmail());
    document.getElementById('send-emails').addEventListener('click', () => this.sendEmails());

    // Modal
    document.querySelector('.close').addEventListener('click', () => this.hideModal());
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.hideModal();
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    this.currentTab = tabName;
    
    if (tabName === 'reports') {
      this.loadReports();
    }
  }

  async loadSettings() {
    try {
      const response = await fetch('http://localhost:3000/api/settings');
      this.settings = await response.json();
      
      document.getElementById('api-key').value = this.settings.apiKey || '';
      document.getElementById('mail-agent').value = this.settings.mailAgent || '';
      document.getElementById('template-folder').value = this.settings.templateFolder || '';
      document.getElementById('sender-email').value = this.settings.senderEmail || '';
      document.getElementById('sender-name').value = this.settings.senderName || '';
    } catch (error) {
      console.error('Settings yüklenemedi:', error);
    }
  }

  async saveSettings() {
    const settings = {
      apiKey: document.getElementById('api-key').value,
      mailAgent: document.getElementById('mail-agent').value,
      templateFolder: document.getElementById('template-folder').value,
      senderEmail: document.getElementById('sender-email').value,
      senderName: document.getElementById('sender-name').value
    };

    try {
      const response = await fetch('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        this.settings = settings;
        this.showMessage('Ayarlar kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Ayarlar kaydedilemedi!', 'error');
    }
  }

  async testAPI() {
    const apiKey = document.getElementById('api-key').value;
    const mailAgent = document.getElementById('mail-agent').value;
    
    if (!apiKey || !mailAgent) {
      this.showMessage('API anahtarı ve Mail Agent Alias gerekli!', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/zeptomail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, mailAgent })
      });

      const result = await response.json();
      
      if (response.ok) {
        this.showMessage('API bağlantısı başarılı!', 'success');
      } else {
        this.showMessage(result.error || 'API bağlantısı başarısız!', 'error');
      }
    } catch (error) {
      this.showMessage('API test edilemedi!', 'error');
    }
  }

  async selectFolder() {
    const folderPath = await ipcRenderer.invoke('select-folder');
    if (folderPath) {
      document.getElementById('template-folder').value = folderPath;
    }
  }

  async loadData() {
    await this.loadTemplates();
    await this.loadContacts();
  }

  async loadTemplates() {
    try {
      const response = await fetch('http://localhost:3000/api/templates');
      this.templates = await response.json();
      this.renderTemplates();
      this.updateTemplateSelect();
    } catch (error) {
      console.error('Şablonlar yüklenemedi:', error);
    }
  }

  renderTemplates() {
    const container = document.querySelector('.template-list');
    
    if (this.templates.length === 0) {
      container.innerHTML = `
        <div class="template-item">
          <h3>Şablon bulunamadı</h3>
          <p>Yeni şablon oluşturmak için "Yeni Şablon" butonuna tıklayın.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.templates.map(template => `
      <div class="template-item">
        <h3>${template.name}</h3>
        <p><strong>Konu:</strong> ${template.subject}</p>
        <p><strong>Oluşturulma:</strong> ${new Date(template.createdAt).toLocaleDateString('tr-TR')}</p>
        <div style="margin-top: 0.5rem;">
          <button onclick="app.editTemplate('${template.id}')">✏️ Düzenle</button>
          <button onclick="app.deleteTemplate('${template.id}')">🗑️ Sil</button>
        </div>
      </div>
    `).join('');
  }

  updateTemplateSelect() {
    const select = document.getElementById('template-select');
    select.innerHTML = '<option value="">Şablon seçin...</option>' +
      this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  showTemplateModal(template = null) {
    const isEdit = !!template;
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Şablon Düzenle' : 'Yeni Şablon'}</h2>
      <form id="template-form">
        <div class="form-group">
          <label>Şablon Adı:</label>
          <input type="text" id="template-name" value="${template?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>E-posta Konusu:</label>
          <input type="text" id="template-subject" value="${template?.subject || ''}" required>
        </div>
        <div class="form-group">
          <label>HTML İçerik:</label>
          <textarea id="template-content" placeholder="HTML içeriğinizi buraya yazın. {Person_name}, {Interview_date} gibi tag'ler kullanabilirsiniz.">${template?.content || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Kullanılabilir Tag'ler:</label>
          <p style="font-size: 0.9rem; color: #666;">
            {Person_name}, {email}, {Interview_date} - CSV'deki sütun adlarını da tag olarak kullanabilirsiniz.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" onclick="app.hideModal()">İptal</button>
          <button type="submit" class="primary">${isEdit ? 'Güncelle' : 'Oluştur'}</button>
        </div>
      </form>
    `;

    document.getElementById('template-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTemplate(template?.id);
    });

    this.showModal();
  }

  async syncTemplates() {
    if (!this.settings.apiKey || !this.settings.mailAgent) {
      this.showMessage('Önce API anahtarı ve Mail Agent Alias’ı ayarlarda tanımlayın!', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/zeptomail/sync-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: this.settings.apiKey, mailAgent: this.settings.mailAgent })
      });

      const result = await response.json();
      
      if (response.ok) {
        await this.loadTemplates();
        this.showMessage(`${result.count} şablon senkronize edildi!`, 'success');
      } else {
        this.showMessage(result.error || 'Senkronizasyon başarısız!', 'error');
      }
    } catch (error) {
      this.showMessage('Senkronizasyon başarısız!', 'error');
    }
  }

  async saveTemplate(templateId = null) {
    const name = document.getElementById('template-name').value;
    const subject = document.getElementById('template-subject').value;
    const content = document.getElementById('template-content').value;

    const templateData = { name, subject, content };

    try {
      const url = templateId ? `http://localhost:3000/api/templates/${templateId}` : 'http://localhost:3000/api/templates';
      const method = templateId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      if (response.ok) {
        this.hideModal();
        await this.loadTemplates();
        this.showMessage('Şablon kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Şablon kaydedilemedi!', 'error');
    }
  }

  async loadContacts() {
    try {
      const response = await fetch('http://localhost:3000/api/contacts');
      this.contacts = await response.json();
      this.renderContacts();
    } catch (error) {
      console.error('Kişiler yüklenemedi:', error);
    }
  }

  renderContacts() {
    const tbody = document.querySelector('#contacts-table tbody');
    
    tbody.innerHTML = this.contacts.map(contact => `
      <tr>
        <td>${contact.name}</td>
        <td>${contact.email}</td>
        <td>${new Date(contact.createdAt).toLocaleDateString('tr-TR')}</td>
        <td>
          <button onclick="app.editContact('${contact.id}')">✏️</button>
          <button onclick="app.deleteContact('${contact.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  showContactModal(contact = null) {
    const isEdit = !!contact;
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Kişi Düzenle' : 'Yeni Kişi'}</h2>
      <form id="contact-form">
        <div class="form-group">
          <label>Ad Soyad:</label>
          <input type="text" id="contact-name" value="${contact?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>E-posta:</label>
          <input type="email" id="contact-email" value="${contact?.email || ''}" required>
        </div>
        <div class="form-group">
          <label>Mülakat Tarihi:</label>
          <input type="date" id="contact-interview-date" value="${contact?.customFields?.Interview_date || ''}">
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" onclick="app.hideModal()">İptal</button>
          <button type="submit" class="primary">${isEdit ? 'Güncelle' : 'Ekle'}</button>
        </div>
      </form>
    `;

    document.getElementById('contact-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveContact(contact?.id);
    });

    this.showModal();
  }

  async saveContact(contactId = null) {
    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const interviewDate = document.getElementById('contact-interview-date').value;

    const contactData = {
      name,
      email,
      customFields: {
        Interview_date: interviewDate
      }
    };

    try {
      const response = await fetch('http://localhost:3000/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      });

      if (response.ok) {
        this.hideModal();
        await this.loadContacts();
        this.showMessage('Kişi kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Kişi kaydedilemedi!', 'error');
    }
  }

  async importCSV() {
    const csvPath = await ipcRenderer.invoke('select-csv');
    if (!csvPath) return;

    const formData = new FormData();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('csvFile', file);

      try {
        const response = await fetch('http://localhost:3000/api/contacts/import-csv', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          await this.loadContacts();
          this.showMessage(`${result.imported} kişi içe aktarıldı!`, 'success');
        }
      } catch (error) {
        this.showMessage('CSV içe aktarılamadı!', 'error');
      }
    };

    fileInput.click();
  }

  async sendEmails() {
    const templateId = document.getElementById('template-select').value;
    const template = this.templates.find(t => t.id === templateId);
    
    if (!template) {
      this.showMessage('Şablon seçin!', 'error');
      return;
    }

    if (this.contacts.length === 0) {
      this.showMessage('Kişi listesi boş!', 'error');
      return;
    }

    if (!this.settings.apiKey) {
      this.showMessage('API anahtarı ayarlarda tanımlanmalı!', 'error');
      return;
    }

    const progressDiv = document.getElementById('send-progress');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    progressDiv.classList.remove('hidden');
    progressText.textContent = 'E-postalar gönderiliyor...';

    try {
      const response = await fetch('http://localhost:3000/api/zeptomail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.settings.apiKey,
          template,
          contacts: this.contacts,
          senderEmail: this.settings.senderEmail,
          senderName: this.settings.senderName
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        const successful = result.results.filter(r => r.status === 'sent').length;
        const failed = result.results.filter(r => r.status === 'failed').length;
        
        progressFill.style.width = '100%';
        progressText.textContent = `Tamamlandı! ${successful} başarılı, ${failed} başarısız`;
        
        setTimeout(() => {
          progressDiv.classList.add('hidden');
          progressFill.style.width = '0%';
        }, 3000);
      }
    } catch (error) {
      progressDiv.classList.add('hidden');
      this.showMessage('E-postalar gönderilemedi!', 'error');
    }
  }

  async loadReports() {
    try {
      const response = await fetch('http://localhost:3000/api/reports');
      this.reports = await response.json();
      this.renderReports();
    } catch (error) {
      console.error('Raporlar yüklenemedi:', error);
    }
  }

  renderReports() {
    const totalSent = this.reports.reduce((sum, report) => sum + report.recipientCount, 0);
    const successfulSent = this.reports.reduce((sum, report) => 
      sum + report.results.filter(r => r.status === 'sent').length, 0);
    const failedSent = totalSent - successfulSent;

    document.getElementById('total-sent').textContent = totalSent;
    document.getElementById('successful-sent').textContent = successfulSent;
    document.getElementById('failed-sent').textContent = failedSent;

    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = this.reports.map(report => `
      <tr>
        <td>${new Date(report.sentAt).toLocaleDateString('tr-TR')}</td>
        <td>${report.templateName}</td>
        <td>${report.recipientCount}</td>
        <td>
          <span class="success">${report.results.filter(r => r.status === 'sent').length}</span> / 
          <span class="error">${report.results.filter(r => r.status === 'failed').length}</span>
        </td>
      </tr>
    `).join('');
  }

  showModal() {
    document.getElementById('modal').classList.remove('hidden');
  }

  hideModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  showMessage(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem;
      background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
      color: white;
      border-radius: 4px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Template actions
  editTemplate(id) {
    const template = this.templates.find(t => t.id === id);
    this.showTemplateModal(template);
  }

  async deleteTemplate(id) {
    if (confirm('Bu şablonu silmek istediğinizden emin misiniz?')) {
      // Implementation for delete
      await this.loadTemplates();
    }
  }

  // Contact actions
  editContact(id) {
    const contact = this.contacts.find(c => c.id === id);
    this.showContactModal(contact);
  }

  async deleteContact(id) {
    if (confirm('Bu kişiyi silmek istediğinizden emin misiniz?')) {
      // Implementation for delete
      await this.loadContacts();
    }
  }
}

// Initialize app
const app = new YazarIletisimPaneli();