const { ipcRenderer } = require('electron');

class ZeptoMailManager {
  constructor() {
    this.currentTab = 'accounts';
    this.accounts = [];
    this.templates = [];
    this.contacts = [];
    this.reports = [];
    this.settings = {};
    this.selectedContacts = new Set();
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadAllData();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Accounts
    document.getElementById('new-account').addEventListener('click', () => this.showAccountModal());

    // Templates
    document.getElementById('new-template').addEventListener('click', () => this.showTemplateModal());

    // Contacts
    document.getElementById('add-contact').addEventListener('click', () => this.showContactModal());
    document.getElementById('import-csv').addEventListener('click', () => this.importCSV());
    document.getElementById('select-all-contacts').addEventListener('change', (e) => this.toggleAllContacts(e.target.checked));

    // Send
    document.getElementById('quick-test').addEventListener('click', () => this.quickTest());
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
    } else if (tabName === 'send') {
      this.updateSelectedContactsInfo();
      this.updateTemplateSelect();
    }
  }

  async loadAllData() {
    await this.loadSettings();
    await this.loadAccounts();
    await this.loadTemplates();
    await this.loadContacts();
    this.updateActiveAccountDisplay();
  }

  async loadSettings() {
    try {
      const response = await fetch('http://localhost:3000/api/settings');
      this.settings = await response.json();
    } catch (error) {
      console.error('Settings yüklenemedi:', error);
    }
  }

  async loadAccounts() {
    try {
      const response = await fetch('http://localhost:3000/api/accounts');
      this.accounts = await response.json();
      this.renderAccounts();
    } catch (error) {
      console.error('Accounts yüklenemedi:', error);
    }
  }

  async loadTemplates() {
    try {
      const activeAccount = this.getActiveAccount();
      if (!activeAccount) {
        this.templates = [];
        this.renderTemplates();
        return;
      }
      
      const response = await fetch(`http://localhost:3000/api/templates?accountId=${activeAccount.id}`);
      this.templates = await response.json();
      this.renderTemplates();
    } catch (error) {
      console.error('Templates yüklenemedi:', error);
    }
  }

  async loadContacts() {
    try {
      const activeAccount = this.getActiveAccount();
      if (!activeAccount) {
        this.contacts = [];
        this.renderContacts();
        return;
      }
      
      const response = await fetch(`http://localhost:3000/api/contacts?accountId=${activeAccount.id}`);
      this.contacts = await response.json();
      this.renderContacts();
    } catch (error) {
      console.error('Contacts yüklenemedi:', error);
    }
  }

  async loadReports() {
    try {
      const activeAccount = this.getActiveAccount();
      if (!activeAccount) {
        this.reports = [];
        this.renderReports();
        return;
      }
      
      const response = await fetch(`http://localhost:3000/api/reports?accountId=${activeAccount.id}`);
      this.reports = await response.json();
      this.renderReports();
    } catch (error) {
      console.error('Reports yüklenemedi:', error);
    }
  }

  getActiveAccount() {
    return this.accounts.find(a => a.active);
  }

  updateActiveAccountDisplay() {
    const activeAccount = this.getActiveAccount();
    const displayElement = document.getElementById('active-account-name');
    
    if (activeAccount) {
      displayElement.textContent = `Aktif: ${activeAccount.name} (${activeAccount.senderEmail})`;
      displayElement.style.color = '#4caf50';
    } else {
      displayElement.textContent = 'Hesap seçilmedi';
      displayElement.style.color = '#999';
    }
  }

  // ==================== ACCOUNTS ====================

  renderAccounts() {
    const container = document.querySelector('.account-list');
    
    if (this.accounts.length === 0) {
      container.innerHTML = `
        <div class="template-item">
          <h3>Hesap bulunamadı</h3>
          <p>Yeni hesap eklemek için "Yeni Hesap" butonuna tıklayın.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.accounts.map(account => `
      <div class="template-item ${account.active ? 'active-account' : ''}">
        <h3>
          ${account.name}
          ${account.active ? '<span style="background: #4caf50; color: white; padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.75rem; margin-left: 0.5rem;">AKTİF</span>' : ''}
        </h3>
        <p><strong>Domain:</strong> ${account.domain}</p>
        <p><strong>Gönderen:</strong> ${account.senderEmail} (${account.senderName})</p>
        <p><strong>Mail Agent:</strong> ${account.mailAgent}</p>
        <div style="margin-top: 0.5rem;">
          ${!account.active ? `<button onclick="app.activateAccount('${account.id}')">✓ Aktif Et</button>` : ''}
          <button onclick="app.editAccount('${account.id}')">✏️ Düzenle</button>
          <button onclick="app.deleteAccount('${account.id}')">🗑️ Sil</button>
        </div>
      </div>
    `).join('');
  }

  showAccountModal(account = null) {
    const isEdit = !!account;
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Hesap Düzenle' : 'Yeni Hesap'}</h2>
      <form id="account-form">
        <div class="form-group">
          <label>Hesap Adı:</label>
          <input type="text" id="account-name" value="${account?.name || ''}" placeholder="Örn: Readers House - Dan Peters" required>
        </div>
        <div class="form-group">
          <label>Domain:</label>
          <input type="text" id="account-domain" value="${account?.domain || ''}" placeholder="readershouse.co.uk" required>
        </div>
        <div class="form-group">
          <label>Send Mail Token:</label>
          <input type="password" id="account-apikey" value="${account?.apiKey || ''}" placeholder="Zoho-enczapikey ..." required>
        </div>
        <div class="form-group">
          <label>Mail Agent Alias:</label>
          <input type="text" id="account-mailagent" value="${account?.mailAgent || ''}" placeholder="617b792618165d06" required>
        </div>
        <div class="form-group">
          <label>Gönderen E-posta:</label>
          <input type="email" id="account-sender-email" value="${account?.senderEmail || ''}" placeholder="dan.peters@readershouse.co.uk" required>
        </div>
        <div class="form-group">
          <label>Gönderen Adı:</label>
          <input type="text" id="account-sender-name" value="${account?.senderName || ''}" placeholder="Dan Peters" required>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" onclick="app.hideModal()">İptal</button>
          <button type="submit" class="primary">${isEdit ? 'Güncelle' : 'Ekle'}</button>
        </div>
      </form>
    `;

    document.getElementById('account-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveAccount(account?.id);
    });

    this.showModal();
  }

  async saveAccount(accountId = null) {
    const accountData = {
      name: document.getElementById('account-name').value.trim(),
      domain: document.getElementById('account-domain').value.trim(),
      apiKey: document.getElementById('account-apikey').value.trim(),
      mailAgent: document.getElementById('account-mailagent').value.trim(),
      senderEmail: document.getElementById('account-sender-email').value.trim(),
      senderName: document.getElementById('account-sender-name').value.trim(),
      host: 'api.zeptomail.com'
    };

    try {
      const url = accountId 
        ? `http://localhost:3000/api/accounts/${accountId}` 
        : 'http://localhost:3000/api/accounts';
      const method = accountId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
      });

      if (response.ok) {
        this.hideModal();
        await this.loadAccounts();
        this.showMessage('Hesap kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Hesap kaydedilemedi!', 'error');
    }
  }

  async activateAccount(accountId) {
    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${accountId}/activate`, {
        method: 'POST'
      });

      if (response.ok) {
        await this.loadAllData();
        this.showMessage('Hesap aktif edildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Hesap aktif edilemedi!', 'error');
    }
  }

  editAccount(id) {
    const account = this.accounts.find(a => a.id === id);
    this.showAccountModal(account);
  }

  async deleteAccount(id) {
    if (!confirm('Bu hesabı silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadAllData();
        this.showMessage('Hesap silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Hesap silinemedi!', 'error');
    }
  }

  // ==================== TEMPLATES ====================

  renderTemplates() {
    const container = document.querySelector('.template-list');
    const activeAccount = this.getActiveAccount();
    
    if (!activeAccount) {
      container.innerHTML = `
        <div class="template-item">
          <h3>Önce bir hesap seçin</h3>
          <p>Şablon eklemek için önce Hesaplar sekmesinden bir hesap aktif edin.</p>
        </div>
      `;
      return;
    }
    
    if (this.templates.length === 0) {
      container.innerHTML = `
        <div class="template-item">
          <h3>Şablon bulunamadı</h3>
          <p>Yeni şablon eklemek için "Yeni Şablon" butonuna tıklayın.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.templates.map(template => `
      <div class="template-item">
        <h3>${template.name}</h3>
        <p><strong>Template Key:</strong> <code>${template.templateKey}</code></p>
        <p><strong>Merge Field Mapping:</strong></p>
        <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
          ${Object.entries(template.mergeFieldMapping).map(([field, mapping]) => `
            <li><code>{${field}}</code> → ${mapping.type === 'column' ? `CSV: <strong>${mapping.value}</strong>` : `Sabit: "${mapping.value}"`}</li>
          `).join('')}
        </ul>
        <div style="margin-top: 0.5rem;">
          <button onclick="app.editTemplate('${template.id}')">✏️ Düzenle</button>
          <button onclick="app.deleteTemplate('${template.id}')">🗑️ Sil</button>
        </div>
      </div>
    `).join('');
  }

  showTemplateModal(template = null) {
    const isEdit = !!template;
    const activeAccount = this.getActiveAccount();
    
    if (!activeAccount) {
      this.showMessage('Önce bir hesap aktif edin!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    const existingMappings = template?.mergeFieldMapping || {};
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Şablon Düzenle' : 'Yeni Şablon'}</h2>
      <form id="template-form">
        <div class="form-group">
          <label>Şablon Adı:</label>
          <input type="text" id="template-name" value="${template?.name || ''}" placeholder="Mülakat Daveti" required>
        </div>
        <div class="form-group">
          <label>Template Key:</label>
          <input type="text" id="template-key" value="${template?.templateKey || ''}" placeholder="2d6f.2377b7024864bedf.k1.3ece50f..." required>
          <small>ZeptoMail → Mail Agent → Templates → Template seç → Template key kopyala</small>
        </div>
        
        <hr style="margin: 1.5rem 0;">
        
        <h3>Merge Field Mapping</h3>
        <p style="color: #666; font-size: 0.9rem;">ZeptoMail template'inizdeki merge field'ları tanımlayın:</p>
        
        <div id="merge-fields-container">
          ${Object.entries(existingMappings).map(([field, mapping], index) => `
            <div class="merge-field-row" data-index="${index}">
              <div class="form-group">
                <label>ZeptoMail Field Adı (örn: Person_name):</label>
                <input type="text" class="merge-field-name" value="${field}" placeholder="Person_name" required>
              </div>
              <div class="form-group">
                <label>Değer Tipi:</label>
                <select class="merge-field-type" onchange="app.updateMergeFieldValueInput(this)">
                  <option value="column" ${mapping.type === 'column' ? 'selected' : ''}>CSV Sütunu</option>
                  <option value="text" ${mapping.type === 'text' ? 'selected' : ''}>Sabit Yazı</option>
                </select>
              </div>
              <div class="form-group">
                <label class="merge-value-label">${mapping.type === 'column' ? 'CSV Sütunu:' : 'Sabit Yazı:'}</label>
                <select class="merge-field-value" style="display: ${mapping.type === 'column' ? 'block' : 'none'};">
                  <option value="name" ${mapping.value === 'name' ? 'selected' : ''}>name</option>
                  <option value="surname" ${mapping.value === 'surname' ? 'selected' : ''}>surname</option>
                  <option value="full_name" ${mapping.value === 'full_name' ? 'selected' : ''}>full_name</option>
                  <option value="email" ${mapping.value === 'email' ? 'selected' : ''}>email</option>
                </select>
                <input type="text" class="merge-field-value-text" value="${mapping.type === 'text' ? mapping.value : ''}" style="display: ${mapping.type === 'text' ? 'block' : 'none'};" placeholder="Sabit değer girin">
              </div>
              <button type="button" onclick="app.removeMergeField(${index})" style="background: #e74c3c;">🗑️ Kaldır</button>
            </div>
          `).join('')}
        </div>
        
        <button type="button" id="add-merge-field" style="margin: 1rem 0;">+ Merge Field Ekle</button>
        
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" onclick="app.hideModal()">İptal</button>
          <button type="submit" class="primary">${isEdit ? 'Güncelle' : 'Ekle'}</button>
        </div>
      </form>
    `;

    document.getElementById('add-merge-field').addEventListener('click', () => {
      this.addMergeFieldRow();
    });

    document.getElementById('template-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTemplate(template?.id);
    });

    this.showModal();
  }

  addMergeFieldRow() {
    const container = document.getElementById('merge-fields-container');
    const index = container.querySelectorAll('.merge-field-row').length;
    
    const row = document.createElement('div');
    row.className = 'merge-field-row';
    row.dataset.index = index;
    row.innerHTML = `
      <div class="form-group">
        <label>ZeptoMail Field Adı:</label>
        <input type="text" class="merge-field-name" placeholder="Person_name" required>
      </div>
      <div class="form-group">
        <label>Değer Tipi:</label>
        <select class="merge-field-type" onchange="app.updateMergeFieldValueInput(this)">
          <option value="column">CSV Sütunu</option>
          <option value="text">Sabit Yazı</option>
        </select>
      </div>
      <div class="form-group">
        <label class="merge-value-label">CSV Sütunu:</label>
        <select class="merge-field-value">
          <option value="name">name</option>
          <option value="surname">surname</option>
          <option value="full_name">full_name</option>
          <option value="email">email</option>
        </select>
        <input type="text" class="merge-field-value-text" style="display: none;" placeholder="Sabit değer girin">
      </div>
      <button type="button" onclick="app.removeMergeField(${index})" style="background: #e74c3c;">🗑️ Kaldır</button>
    `;
    
    container.appendChild(row);
  }

  removeMergeField(index) {
    const row = document.querySelector(`.merge-field-row[data-index="${index}"]`);
    if (row) row.remove();
  }

  updateMergeFieldValueInput(selectElement) {
    const row = selectElement.closest('.merge-field-row');
    const type = selectElement.value;
    const label = row.querySelector('.merge-value-label');
    const selectInput = row.querySelector('.merge-field-value');
    const textInput = row.querySelector('.merge-field-value-text');
    
    if (type === 'column') {
      label.textContent = 'CSV Sütunu:';
      selectInput.style.display = 'block';
      textInput.style.display = 'none';
    } else {
      label.textContent = 'Sabit Yazı:';
      selectInput.style.display = 'none';
      textInput.style.display = 'block';
    }
  }

  async saveTemplate(templateId = null) {
    const activeAccount = this.getActiveAccount();
    
    const name = document.getElementById('template-name').value.trim();
    const templateKey = document.getElementById('template-key').value.trim();
    
    // Build merge field mapping
    const mergeFieldMapping = {};
    const rows = document.querySelectorAll('.merge-field-row');
    
    rows.forEach(row => {
      const fieldName = row.querySelector('.merge-field-name').value.trim();
      const type = row.querySelector('.merge-field-type').value;
      
      if (fieldName) {
        if (type === 'column') {
          const value = row.querySelector('.merge-field-value').value;
          mergeFieldMapping[fieldName] = { type: 'column', value };
        } else {
          const value = row.querySelector('.merge-field-value-text').value;
          mergeFieldMapping[fieldName] = { type: 'text', value };
        }
      }
    });

    const templateData = {
      name,
      accountId: activeAccount.id,
      templateKey,
      mergeFieldMapping
    };

    try {
      const url = templateId 
        ? `http://localhost:3000/api/templates/${templateId}` 
        : 'http://localhost:3000/api/templates';
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

  editTemplate(id) {
    const template = this.templates.find(t => t.id === id);
    this.showTemplateModal(template);
  }

  async deleteTemplate(id) {
    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/templates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadTemplates();
        this.showMessage('Şablon silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Şablon silinemedi!', 'error');
    }
  }

  // ==================== CONTACTS ====================

  renderContacts() {
    const tbody = document.querySelector('#contacts-table tbody');
    const activeAccount = this.getActiveAccount();
    
    if (!activeAccount) {
      tbody.innerHTML = `<tr><td colspan="6">Önce bir hesap seçin</td></tr>`;
      return;
    }
    
    if (this.contacts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">Kişi bulunamadı</td></tr>`;
      return;
    }

    tbody.innerHTML = this.contacts.map(contact => `
      <tr>
        <td><input type="checkbox" class="contact-checkbox" data-id="${contact.id}" ${this.selectedContacts.has(contact.id) ? 'checked' : ''}></td>
        <td>${contact.name}</td>
        <td>${contact.surname}</td>
        <td>${contact.full_name}</td>
        <td>${contact.email}</td>
        <td>
          <button onclick="app.viewContact('${contact.id}')">👁️</button>
          <button onclick="app.deleteContact('${contact.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.contact-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          this.selectedContacts.add(id);
        } else {
          this.selectedContacts.delete(id);
        }
        this.updateSelectedContactsInfo();
      });
    });
  }

  toggleAllContacts(checked) {
    this.selectedContacts.clear();
    if (checked) {
      this.contacts.forEach(c => this.selectedContacts.add(c.id));
    }
    this.renderContacts();
    this.updateSelectedContactsInfo();
  }

  updateSelectedContactsInfo() {
    const info = document.getElementById('selected-contacts-info');
    if (info) {
      info.textContent = `${this.selectedContacts.size} kişi seçildi`;
    }
  }

  showContactModal() {
    const activeAccount = this.getActiveAccount();
    
    if (!activeAccount) {
      this.showMessage('Önce bir hesap aktif edin!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Yeni Kişi</h2>
      <form id="contact-form">
        <div class="form-group">
          <label>Ad: *</label>
          <input type="text" id="contact-name" required>
        </div>
        <div class="form-group">
          <label>Soyad: *</label>
          <input type="text" id="contact-surname" required>
        </div>
        <div class="form-group">
          <label>Tam Ad: *</label>
          <input type="text" id="contact-fullname" required>
        </div>
        <div class="form-group">
          <label>E-posta: *</label>
          <input type="email" id="contact-email" required>
        </div>
        <hr style="margin: 1rem 0;">
        <p style="color: #666; font-size: 0.9rem;">Opsiyonel alanlar (boş bırakılabilir):</p>
        <div class="form-group">
          <label>Link:</label>
          <input type="text" id="contact-link">
        </div>
        <div class="form-group">
          <label>AAWeb:</label>
          <input type="text" id="contact-aaweb">
        </div>
        <div class="form-group">
          <label>Web:</label>
          <input type="text" id="contact-web">
        </div>
        <div class="form-group">
          <label>Facebook Resolved:</label>
          <input type="text" id="contact-facebook">
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" onclick="app.hideModal()">İptal</button>
          <button type="submit" class="primary">Ekle</button>
        </div>
      </form>
    `;

    document.getElementById('contact-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveContact();
    });

    this.showModal();
  }

  async saveContact() {
    const activeAccount = this.getActiveAccount();
    
    const contactData = {
      accountId: activeAccount.id,
      name: document.getElementById('contact-name').value.trim(),
      surname: document.getElementById('contact-surname').value.trim(),
      full_name: document.getElementById('contact-fullname').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      link: document.getElementById('contact-link').value.trim(),
      aaweb: document.getElementById('contact-aaweb').value.trim(),
      web: document.getElementById('contact-web').value.trim(),
      facebook_resolved: document.getElementById('contact-facebook').value.trim()
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
        this.showMessage('Kişi eklendi!', 'success');
      }
    } catch (error) {
      this.showMessage('Kişi eklenemedi!', 'error');
    }
  }

  async importCSV() {
    const activeAccount = this.getActiveAccount();
    
    if (!activeAccount) {
      this.showMessage('Önce bir hesap aktif edin!', 'error');
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('accountId', activeAccount.id);

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

  viewContact(id) {
    const contact = this.contacts.find(c => c.id === id);
    
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Kişi Detayları</h2>
      <div style="line-height: 1.8;">
        <p><strong>Ad:</strong> ${contact.name}</p>
        <p><strong>Soyad:</strong> ${contact.surname}</p>
        <p><strong>Tam Ad:</strong> ${contact.full_name}</p>
        <p><strong>E-posta:</strong> ${contact.email}</p>
        ${contact.link ? `<p><strong>Link:</strong> ${contact.link}</p>` : ''}
        ${contact.aaweb ? `<p><strong>AAWeb:</strong> ${contact.aaweb}</p>` : ''}
        ${contact.web ? `<p><strong>Web:</strong> ${contact.web}</p>` : ''}
        ${contact.facebook_resolved ? `<p><strong>Facebook:</strong> ${contact.facebook_resolved}</p>` : ''}
      </div>
      <button onclick="app.hideModal()" class="primary">Kapat</button>
    `;

    this.showModal();
  }

  async deleteContact(id) {
    if (!confirm('Bu kişiyi silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/contacts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.selectedContacts.delete(id);
        await this.loadContacts();
        this.showMessage('Kişi silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Kişi silinemedi!', 'error');
    }
  }

  // ==================== SEND ====================

  updateTemplateSelect() {
    const select = document.getElementById('template-select');
    select.innerHTML = '<option value="">Şablon seçin...</option>' +
      this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  async quickTest() {
    const activeAccount = this.getActiveAccount();
    
    if (!activeAccount) {
      this.showMessage('Önce bir hesap aktif edin!', 'error');
      return;
    }

    const progressDiv = document.getElementById('send-progress');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    progressDiv.classList.remove('hidden');
    progressText.textContent = '🚀 Test maili gönderiliyor...';
    progressFill.style.width = '50%';

    try {
      const response = await fetch('http://localhost:3000/api/zeptomail/test-send', {
        method: 'POST'
      });

      const result = await response.json();
      
      progressFill.style.width = '100%';
      
      if (response.ok) {
        progressText.textContent = '✓ Test maili gönderildi!';
        setTimeout(() => {
          progressDiv.classList.add('hidden');
          progressFill.style.width = '0%';
          this.showMessage('✓ Test maili gönderildi!', 'success');
        }, 2000);
      } else {
        progressDiv.classList.add('hidden');
        progressFill.style.width = '0%';
        this.showMessage(`Hata: ${result.error}`, 'error');
      }
    } catch (error) {
      progressDiv.classList.add('hidden');
      progressFill.style.width = '0%';
      this.showMessage('Test maili gönderilemedi!', 'error');
    }
  }

  async sendEmails() {
    const activeAccount = this.getActiveAccount();
    const templateId = document.getElementById('template-select').value;
    
    if (!activeAccount) {
      this.showMessage('Önce bir hesap aktif edin!', 'error');
      return;
    }
    
    if (!templateId) {
      this.showMessage('Şablon seçin!', 'error');
      return;
    }
    
    if (this.selectedContacts.size === 0) {
      this.showMessage('En az bir kişi seçin!', 'error');
      return;
    }

    const progressDiv = document.getElementById('send-progress');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    progressDiv.classList.remove('hidden');
    progressText.textContent = 'E-postalar gönderiliyor...';

    try {
      const response = await fetch('http://localhost:3000/api/zeptomail/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccount.id,
          templateId: templateId,
          contactIds: Array.from(this.selectedContacts)
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
      } else {
        progressDiv.classList.add('hidden');
        this.showMessage(result.error || 'E-postalar gönderilemedi!', 'error');
      }
    } catch (error) {
      progressDiv.classList.add('hidden');
      this.showMessage('E-postalar gönderilemedi!', 'error');
    }
  }

  // ==================== REPORTS ====================

  renderReports() {
    const totalSent = this.reports.reduce((sum, r) => sum + r.recipientCount, 0);
    const successfulSent = this.reports.reduce((sum, r) => 
      sum + r.results.filter(res => res.status === 'sent').length, 0);
    const failedSent = totalSent - successfulSent;

    document.getElementById('total-sent').textContent = totalSent;
    document.getElementById('successful-sent').textContent = successfulSent;
    document.getElementById('failed-sent').textContent = failedSent;

    const tbody = document.querySelector('#reports-table tbody');
    
    if (this.reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Gönderim geçmişi bulunamadı</td></tr>';
      return;
    }

    tbody.innerHTML = this.reports.map(report => {
      const account = this.accounts.find(a => a.id === report.accountId);
      const template = this.templates.find(t => t.id === report.templateId);
      
      return `
        <tr>
          <td>${new Date(report.sentAt).toLocaleDateString('tr-TR')}</td>
          <td>${account?.name || 'Bilinmiyor'}</td>
          <td>${template?.name || 'Bilinmiyor'}</td>
          <td>${report.recipientCount}</td>
          <td>
            <span class="success">${report.results.filter(r => r.status === 'sent').length}</span> / 
            <span class="error">${report.results.filter(r => r.status === 'failed').length}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==================== UTILS ====================

  showModal() {
    document.getElementById('modal').classList.remove('hidden');
  }

  hideModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
      color: white;
      border-radius: 4px;
      z-index: 10000;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize app
const app = new ZeptoMailManager();

