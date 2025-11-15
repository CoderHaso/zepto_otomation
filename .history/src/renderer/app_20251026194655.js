const { ipcRenderer } = require('electron');

class ZeptoMailDomainManager {
  constructor() {
    this.currentTab = 'overview';
    this.domains = [];
    this.accounts = [];
    this.templates = [];
    this.contacts = [];
    this.queue = [];
    this.history = [];
    this.settings = {};
    this.selectedContacts = new Set();
    this.activeDomain = null;
    
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

    // Domain management
    document.getElementById('add-domain').addEventListener('click', () => this.showDomainModal());

    // Account management
    document.getElementById('add-account').addEventListener('click', () => this.showAccountModal());

    // Template management
    document.getElementById('add-template').addEventListener('click', () => this.showTemplateModal());

    // Contact management
    document.getElementById('add-contact').addEventListener('click', () => this.showContactModal());
    document.getElementById('import-csv').addEventListener('click', () => this.importCSV());
    document.getElementById('select-all-contacts').addEventListener('change', (e) => this.toggleAllContacts(e.target.checked));

    // Send
    document.getElementById('send-now').addEventListener('click', () => this.sendNow());
    document.getElementById('schedule-send').addEventListener('click', () => this.scheduleSend());
    document.getElementById('add-to-queue').addEventListener('click', () => this.addToQueue());

    // Queue
    document.getElementById('refresh-queue').addEventListener('click', () => this.loadQueue());

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
    
    if (tabName === 'queue') {
      this.loadQueue();
    } else if (tabName === 'history') {
      this.loadHistory();
    } else if (tabName === 'send') {
      this.updateSendForm();
    }
  }

  async loadAllData() {
    await this.loadSettings();
    await this.loadDomains();
    this.updateActiveDomainDisplay();
  }

  async loadSettings() {
    try {
      const response = await fetch('http://localhost:3000/api/settings');
      this.settings = await response.json();
    } catch (error) {
      console.error('Settings load error:', error);
    }
  }

  async loadDomains() {
    try {
      const response = await fetch('http://localhost:3000/api/domains');
      this.domains = await response.json();
      this.renderDomains();
      
      // Auto-load active domain
      this.activeDomain = this.domains.find(d => d.active);
      if (this.activeDomain) {
        await this.loadDomainData(this.activeDomain.id);
      }
    } catch (error) {
      console.error('Domains load error:', error);
    }
  }

  async loadDomainData(domainId) {
    try {
      // Load accounts
      const accountsRes = await fetch(`http://localhost:3000/api/accounts?domainId=${domainId}`);
      this.accounts = await accountsRes.json();
      
      // Load templates
      const templatesRes = await fetch(`http://localhost:3000/api/templates?domainId=${domainId}`);
      this.templates = await templatesRes.json();
      
      // Load contacts
      const contactsRes = await fetch(`http://localhost:3000/api/contacts?domainId=${domainId}`);
      this.contacts = await contactsRes.json();
      
      this.renderDomainDetails();
    } catch (error) {
      console.error('Domain data load error:', error);
    }
  }

  async loadQueue() {
    try {
      if (!this.activeDomain) return;
      
      const response = await fetch(`http://localhost:3000/api/queue?domainId=${this.activeDomain.id}`);
      this.queue = await response.json();
      this.renderQueue();
    } catch (error) {
      console.error('Queue load error:', error);
    }
  }

  async loadHistory() {
    try {
      if (!this.activeDomain) return;
      
      const response = await fetch(`http://localhost:3000/api/history?domainId=${this.activeDomain.id}`);
      this.history = await response.json();
      this.renderHistory();
    } catch (error) {
      console.error('History load error:', error);
    }
  }

  updateActiveDomainDisplay() {
    const displayElement = document.getElementById('active-domain-name');
    
    if (this.activeDomain) {
      displayElement.textContent = `Aktif: ${this.activeDomain.name} (${this.activeDomain.domain}) | 📤 ${this.activeDomain.stats.totalSent} gönderildi`;
      displayElement.style.color = '#4caf50';
    } else {
      displayElement.textContent = 'Domain seçilmedi';
      displayElement.style.color = '#999';
    }
  }

  // ==================== DOMAINS ====================

  renderDomains() {
    const container = document.getElementById('domains-container');
    
    if (this.domains.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Domain bulunamadı</h3>
          <p>Başlamak için yeni bir domain ekleyin.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.domains.map(domain => `
      <div class="domain-card ${domain.active ? 'active' : ''}">
        <div class="domain-header">
          <h3>
            ${domain.name}
            ${domain.active ? '<span class="badge badge-success">AKTİF</span>' : ''}
          </h3>
          <div class="domain-actions">
            ${!domain.active ? `<button onclick="app.activateDomain('${domain.id}')" class="btn-small">✓ Aktif Et</button>` : ''}
            <button onclick="app.editDomain('${domain.id}')" class="btn-small">✏️</button>
            <button onclick="app.deleteDomain('${domain.id}')" class="btn-small btn-danger">🗑️</button>
          </div>
        </div>
        <p><strong>Domain:</strong> ${domain.domain}</p>
        <p><strong>Mail Agent:</strong> ${domain.mailAgent}</p>
        <div class="stats-mini">
          <span>📤 ${domain.stats.totalSent}</span>
          <span class="success">✓ ${domain.stats.successful}</span>
          <span class="error">✗ ${domain.stats.failed}</span>
        </div>
      </div>
    `).join('');
  }

  showDomainModal(domain = null) {
    const isEdit = !!domain;
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Domain Düzenle' : 'Yeni Domain'}</h2>
      <form id="domain-form">
        <div class="form-group">
          <label>Domain Adı:</label>
          <input type="text" id="domain-name" value="${domain?.name || ''}" placeholder="Readers House" required>
        </div>
        <div class="form-group">
          <label>Domain:</label>
          <input type="text" id="domain-domain" value="${domain?.domain || ''}" placeholder="readershouse.co.uk" required>
        </div>
        <div class="form-group">
          <label>Send Mail Token:</label>
          <textarea id="domain-apikey" rows="3" required>${domain?.apiKey || ''}</textarea>
          <small>Zoho-enczapikey ...</small>
        </div>
        <div class="form-group">
          <label>Mail Agent Alias:</label>
          <input type="text" id="domain-mailagent" value="${domain?.mailAgent || ''}" placeholder="617b792618165d06" required>
        </div>
        <div class="form-group">
          <label>Host:</label>
          <input type="text" id="domain-host" value="${domain?.host || 'api.zeptomail.com'}" required>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Güncelle' : 'Ekle'}</button>
        </div>
      </form>
    `;

    document.getElementById('domain-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveDomain(domain?.id);
    });

    this.showModal();
  }

  async saveDomain(domainId = null) {
    const domainData = {
      name: document.getElementById('domain-name').value.trim(),
      domain: document.getElementById('domain-domain').value.trim(),
      apiKey: document.getElementById('domain-apikey').value.trim(),
      mailAgent: document.getElementById('domain-mailagent').value.trim(),
      host: document.getElementById('domain-host').value.trim()
    };

    try {
      const url = domainId 
        ? `http://localhost:3000/api/domains/${domainId}` 
        : 'http://localhost:3000/api/domains';
      const method = domainId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainData)
      });

      if (response.ok) {
        this.hideModal();
        await this.loadDomains();
        this.showMessage('Domain kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Domain kaydedilemedi!', 'error');
    }
  }

  async activateDomain(domainId) {
    try {
      const response = await fetch(`http://localhost:3000/api/domains/${domainId}/activate`, {
        method: 'POST'
      });

      if (response.ok) {
        await this.loadAllData();
        this.showMessage('Domain aktif edildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Domain aktif edilemedi!', 'error');
    }
  }

  editDomain(id) {
    const domain = this.domains.find(d => d.id === id);
    this.showDomainModal(domain);
  }

  async deleteDomain(id) {
    if (!confirm('Bu domain\'i silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/domains/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadDomains();
        this.showMessage('Domain silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Domain silinemedi!', 'error');
    }
  }

  // ==================== DOMAIN DETAILS ====================

  renderDomainDetails() {
    if (!this.activeDomain) {
      document.getElementById('domain-details').classList.add('hidden');
      return;
    }

    document.getElementById('domain-details').classList.remove('hidden');
    
    this.renderAccounts();
    this.renderTemplates();
    this.renderContacts();
  }

  // ==================== ACCOUNTS ====================

  renderAccounts() {
    const container = document.getElementById('accounts-container');
    
    if (this.accounts.length === 0) {
      container.innerHTML = `<p class="hint">Henüz account eklenmemiş.</p>`;
      return;
    }

    container.innerHTML = this.accounts.map(account => `
      <div class="account-card ${account.active ? 'active' : 'inactive'}">
        <div class="account-header">
          <div>
            <h4>${account.displayName}</h4>
            <p>${account.email}</p>
          </div>
          <div class="account-actions">
            <button onclick="app.testAccount('${account.id}')" class="btn-small" title="Test Gönder">🧪</button>
            <button onclick="app.toggleAccountActive('${account.id}')" class="btn-small" title="${account.active ? 'Devre Dışı' : 'Aktif Et'}">
              ${account.active ? '✓' : '○'}
            </button>
            <button onclick="app.editAccount('${account.id}')" class="btn-small">✏️</button>
            <button onclick="app.deleteAccount('${account.id}')" class="btn-small btn-danger">🗑️</button>
          </div>
        </div>
        <div class="stats-mini">
          <span>📤 ${account.stats.totalSent}</span>
          <span class="success">✓ ${account.stats.successful}</span>
          <span class="error">✗ ${account.stats.failed}</span>
        </div>
      </div>
    `).join('');
  }

  showAccountModal(account = null) {
    const isEdit = !!account;
    if (!this.activeDomain) {
      this.showMessage('Önce bir domain seçin!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Account Düzenle' : 'Yeni Account'}</h2>
      <form id="account-form">
        <div class="form-group">
          <label>İsim:</label>
          <input type="text" id="account-name" value="${account?.name || ''}" placeholder="Dan Peters" required>
        </div>
        <div class="form-group">
          <label>E-posta:</label>
          <input type="email" id="account-email" value="${account?.email || ''}" placeholder="dan.peters@readershouse.co.uk" required>
        </div>
        <div class="form-group">
          <label>Görünen Ad (Mail imzasında):</label>
          <input type="text" id="account-displayname" value="${account?.displayName || ''}" placeholder="Dan Peters" required>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Güncelle' : 'Ekle'}</button>
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
      domainId: this.activeDomain.id,
      name: document.getElementById('account-name').value.trim(),
      email: document.getElementById('account-email').value.trim(),
      displayName: document.getElementById('account-displayname').value.trim()
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
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Account kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Account kaydedilemedi!', 'error');
    }
  }

  async toggleAccountActive(accountId) {
    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${accountId}/toggle`, {
        method: 'POST'
      });

      if (response.ok) {
        await this.loadDomainData(this.activeDomain.id);
      }
    } catch (error) {
      this.showMessage('İşlem başarısız!', 'error');
    }
  }

  async testAccount(accountId) {
    try {
      this.showMessage('Test maili gönderiliyor...', 'info');
      
      const response = await fetch(`http://localhost:3000/api/accounts/${accountId}/test`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (response.ok) {
        this.showMessage('✓ Test maili gönderildi!', 'success');
      } else {
        this.showMessage(`Hata: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showMessage('Test maili gönderilemedi!', 'error');
    }
  }

  editAccount(id) {
    const account = this.accounts.find(a => a.id === id);
    this.showAccountModal(account);
  }

  async deleteAccount(id) {
    if (!confirm('Bu account\'u silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Account silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Account silinemedi!', 'error');
    }
  }

  // ==================== TEMPLATES ====================

  renderTemplates() {
    const container = document.getElementById('templates-container');
    
    if (this.templates.length === 0) {
      container.innerHTML = `<p class="hint">Henüz template eklenmemiş.</p>`;
      return;
    }

    container.innerHTML = this.templates.map(template => `
      <div class="template-card">
        <h4>${template.name}</h4>
        <p><code>${template.templateKey}</code></p>
        <p><strong>Merge Fields:</strong></p>
        <ul>
          ${Object.entries(template.mergeFieldMapping).map(([field, mapping]) => `
            <li><code>{${field}}</code> → ${
              mapping.type === 'auto' ? '<span class="badge badge-info">AUTO</span>' :
              mapping.type === 'column' ? `CSV: <strong>${mapping.value}</strong>` :
              `"${mapping.value}"`
            }</li>
          `).join('')}
        </ul>
        <div class="template-actions">
          <button onclick="app.editTemplate('${template.id}')" class="btn-small">✏️ Düzenle</button>
          <button onclick="app.deleteTemplate('${template.id}')" class="btn-small btn-danger">🗑️ Sil</button>
        </div>
      </div>
    `).join('');
  }

  showTemplateModal(template = null) {
    const isEdit = !!template;
    if (!this.activeDomain) {
      this.showMessage('Önce bir domain seçin!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    const existingMappings = template?.mergeFieldMapping || {};
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Template Düzenle' : 'Yeni Template'}</h2>
      <form id="template-form">
        <div class="form-group">
          <label>Template Adı:</label>
          <input type="text" id="template-name" value="${template?.name || ''}" placeholder="Mülakat Daveti" required>
        </div>
        <div class="form-group">
          <label>Template Key:</label>
          <input type="text" id="template-key" value="${template?.templateKey || ''}" placeholder="2d6f.2377b..." required>
          <small>ZeptoMail → Templates → Template Key kopyala</small>
        </div>
        
        <hr>
        
        <h3>Merge Field Mapping</h3>
        <div class="alert alert-info">
          <strong>💡 {account_name} otomatik eklendi!</strong><br>
          Bu field otomatik olarak gönderen account'un adını kullanır.
        </div>
        
        <div id="merge-fields-container">
          ${Object.entries(existingMappings)
            .filter(([field]) => field !== 'account_name')
            .map(([field, mapping], index) => this.getMergeFieldRow(field, mapping, index))
            .join('')}
        </div>
        
        <button type="button" id="add-merge-field" class="btn-secondary">+ Merge Field Ekle</button>
        
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Güncelle' : 'Ekle'}</button>
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

  getMergeFieldRow(field = '', mapping = { type: 'column', value: 'full_name' }, index = 0) {
    return `
      <div class="merge-field-row" data-index="${index}">
        <div class="form-group">
          <label>Field Adı:</label>
          <input type="text" class="merge-field-name" value="${field}" placeholder="Person_name" required>
        </div>
        <div class="form-group">
          <label>Tür:</label>
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
          <input type="text" class="merge-field-value-text" value="${mapping.type === 'text' ? mapping.value : ''}" style="display: ${mapping.type === 'text' ? 'block' : 'none'};" placeholder="Sabit değer">
        </div>
        <button type="button" onclick="app.removeMergeField(${index})" class="btn-danger">🗑️</button>
      </div>
    `;
  }

  addMergeFieldRow() {
    const container = document.getElementById('merge-fields-container');
    const index = container.querySelectorAll('.merge-field-row').length;
    
    const row = document.createElement('div');
    row.innerHTML = this.getMergeFieldRow('', { type: 'column', value: 'full_name' }, index);
    container.appendChild(row.firstElementChild);
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
    const name = document.getElementById('template-name').value.trim();
    const templateKey = document.getElementById('template-key').value.trim();
    
    // Build merge field mapping
    const mergeFieldMapping = {
      account_name: {
        type: 'auto',
        value: 'account_name',
        description: 'Otomatik - Gönderen hesabın adı'
      }
    };
    
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
      domainId: this.activeDomain.id,
      name,
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
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Template kaydedildi!', 'success');
      }
    } catch (error) {
      this.showMessage('Template kaydedilemedi!', 'error');
    }
  }

  editTemplate(id) {
    const template = this.templates.find(t => t.id === id);
    this.showTemplateModal(template);
  }

  async deleteTemplate(id) {
    if (!confirm('Bu template\'i silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/templates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Template silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Template silinemedi!', 'error');
    }
  }

  // ==================== CONTACTS ====================

  renderContacts() {
    const tbody = document.querySelector('#contacts-table tbody');
    
    if (this.contacts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">Henüz kişi eklenmemiş</td></tr>`;
      return;
    }

    tbody.innerHTML = this.contacts.map(contact => `
      <tr>
        <td><input type="checkbox" class="contact-checkbox" data-id="${contact.id}" ${this.selectedContacts.has(contact.id) ? 'checked' : ''}></td>
        <td>${contact.full_name}</td>
        <td>${contact.email}</td>
        <td>
          <button onclick="app.viewContact('${contact.id}')" class="btn-small">👁️</button>
          <button onclick="app.deleteContact('${contact.id}')" class="btn-small btn-danger">🗑️</button>
        </td>
      </tr>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.contact-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          this.selectedContacts.add(id);
        } else {
          this.selectedContacts.delete(id);
        }
        this.updateSelectedContactsCount();
      });
    });
  }

  toggleAllContacts(checked) {
    this.selectedContacts.clear();
    if (checked) {
      this.contacts.forEach(c => this.selectedContacts.add(c.id));
    }
    this.renderContacts();
    this.updateSelectedContactsCount();
  }

  updateSelectedContactsCount() {
    const countEl = document.getElementById('selected-contacts-count');
    if (countEl) {
      countEl.textContent = this.selectedContacts.size;
    }
  }

  showContactModal() {
    if (!this.activeDomain) {
      this.showMessage('Önce bir domain seçin!', 'error');
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
        <hr>
        <p class="hint">Opsiyonel alanlar:</p>
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
          <label>Facebook:</label>
          <input type="text" id="contact-facebook">
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Ekle</button>
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
    const contactData = {
      domainId: this.activeDomain.id,
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
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Kişi eklendi!', 'success');
      }
    } catch (error) {
      this.showMessage('Kişi eklenemedi!', 'error');
    }
  }

  async importCSV() {
    if (!this.activeDomain) {
      this.showMessage('Önce bir domain seçin!', 'error');
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
      formData.append('domainId', this.activeDomain.id);

      try {
        const response = await fetch('http://localhost:3000/api/contacts/import-csv', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          await this.loadDomainData(this.activeDomain.id);
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
      <div class="contact-details">
        <p><strong>Ad:</strong> ${contact.name}</p>
        <p><strong>Soyad:</strong> ${contact.surname}</p>
        <p><strong>Tam Ad:</strong> ${contact.full_name}</p>
        <p><strong>E-posta:</strong> ${contact.email}</p>
        ${contact.link ? `<p><strong>Link:</strong> ${contact.link}</p>` : ''}
        ${contact.aaweb ? `<p><strong>AAWeb:</strong> ${contact.aaweb}</p>` : ''}
        ${contact.web ? `<p><strong>Web:</strong> ${contact.web}</p>` : ''}
        ${contact.facebook_resolved ? `<p><strong>Facebook:</strong> ${contact.facebook_resolved}</p>` : ''}
      </div>
      <button onclick="app.hideModal()" class="btn-primary">Kapat</button>
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
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Kişi silindi!', 'success');
      }
    } catch (error) {
      this.showMessage('Kişi silinemedi!', 'error');
    }
  }

  // ==================== SEND ====================

  updateSendForm() {
    // Update template select
    const select = document.getElementById('send-template-select');
    select.innerHTML = '<option value="">Template seçin...</option>' +
      this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    select.addEventListener('change', () => this.updateAccountAssignments());
    
    this.updateSelectedContactsCount();
    this.updateAccountAssignments();
  }

  updateAccountAssignments() {
    const templateId = document.getElementById('send-template-select').value;
    const container = document.getElementById('account-assignments');
    
    if (!templateId || this.selectedContacts.size === 0) {
      container.innerHTML = '';
      return;
    }

    const activeAccounts = this.accounts.filter(a => a.active);
    
    if (activeAccounts.length === 0) {
      container.innerHTML = '<p class="hint error">Hiç aktif account yok! Ana sayfadan account aktif edin.</p>';
      return;
    }

    container.innerHTML = `
      <div class="form-group">
        <label>Hangi account'lardan gönd erilsin? (${this.selectedContacts.size} kişi)</label>
        ${activeAccounts.map(account => `
          <div class="account-assignment">
            <input type="checkbox" id="assign-${account.id}" value="${account.id}" checked>
            <label for="assign-${account.id}">${account.displayName} (${account.email})</label>
          </div>
        `).join('')}
      </div>
    `;
  }

  async sendNow() {
    const templateId = document.getElementById('send-template-select').value;
    
    if (!templateId) {
      this.showMessage('Template seçin!', 'error');
      return;
    }
    
    if (this.selectedContacts.size === 0) {
      this.showMessage('En az bir kişi seçin!', 'error');
      return;
    }

    const selectedAccountIds = Array.from(
      document.querySelectorAll('#account-assignments input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    if (selectedAccountIds.length === 0) {
      this.showMessage('En az bir account seçin!', 'error');
      return;
    }

    // Her account, TÜM seçili kişilere göndersin
    const contactIds = Array.from(this.selectedContacts);
    
    const assignments = selectedAccountIds.map(accountId => ({
      accountId,
      contactIds: contactIds // Tüm kişiler her account'a
    }));

    try {
      this.showProgress('Mailler gönderiliyor...');
      
      const response = await fetch('http://localhost:3000/api/send/immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: this.activeDomain.id,
          templateId: templateId,
          assignments: assignments
        })
      });

      const result = await response.json();
      
      this.hideProgress();
      
      if (response.ok) {
        const successful = result.results.filter(r => r.status === 'sent').length;
        const failed = result.results.filter(r => r.status === 'failed').length;
        
        this.showMessage(`✓ Gönderim tamamlandı! ${successful} başarılı, ${failed} başarısız`, 'success');
        
        // Reload data
        await this.loadDomains();
      } else {
        this.showMessage(result.error || 'Gönderim başarısız!', 'error');
      }
    } catch (error) {
      this.hideProgress();
      this.showMessage('Gönderim başarısız!', 'error');
    }
  }

  async scheduleSend() {
    const templateId = document.getElementById('send-template-select').value;
    
    if (!templateId || this.selectedContacts.size === 0) {
      this.showMessage('Template ve kişi seçin!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>⏰ Zamanla</h2>
      <form id="schedule-form">
        <div class="form-group">
          <label>Gönderim Tarihi ve Saati:</label>
          <input type="datetime-local" id="scheduled-datetime" required>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Zamanla</button>
        </div>
      </form>
    `;

    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const scheduledAt = new Date(document.getElementById('scheduled-datetime').value).toISOString();
      await this.addToQueue(scheduledAt);
    });

    this.showModal();
  }

  async addToQueue(scheduledAt = null) {
    const templateId = document.getElementById('send-template-select').value;
    
    if (!templateId || this.selectedContacts.size === 0) {
      this.showMessage('Template ve kişi seçin!', 'error');
      return;
    }

    const selectedAccountIds = Array.from(
      document.querySelectorAll('#account-assignments input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    if (selectedAccountIds.length === 0) {
      this.showMessage('En az bir account seçin!', 'error');
      return;
    }

    const contactsPerAccount = Math.ceil(this.selectedContacts.size / selectedAccountIds.length);
    const contactIds = Array.from(this.selectedContacts);
    
    const assignments = selectedAccountIds.map((accountId, index) => ({
      accountId,
      contactIds: contactIds.slice(index * contactsPerAccount, (index + 1) * contactsPerAccount)
    })).filter(a => a.contactIds.length > 0);

    try {
      const response = await fetch('http://localhost:3000/api/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: this.activeDomain.id,
          templateId: templateId,
          assignments: assignments,
          scheduledAt: scheduledAt || new Date().toISOString()
        })
      });

      if (response.ok) {
        this.hideModal();
        this.showMessage('✓ Kuyruğa eklendi!', 'success');
        this.switchTab('queue');
      }
    } catch (error) {
      this.showMessage('Kuyruğa eklenemedi!', 'error');
    }
  }

  // ==================== QUEUE ====================

  renderQueue() {
    const tbody = document.querySelector('#queue-table tbody');
    
    if (this.queue.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">Kuyrukta görev yok</td></tr>`;
      return;
    }

    tbody.innerHTML = this.queue.map(item => {
      const template = this.templates.find(t => t.id === item.templateId);
      const totalContacts = item.assignments.reduce((sum, a) => sum + a.contactIds.length, 0);
      
      return `
        <tr>
          <td>#${item.id.slice(-4)}</td>
          <td>${template?.name || 'Bilinmiyor'}</td>
          <td>${totalContacts}</td>
          <td>${new Date(item.scheduledAt).toLocaleString('tr-TR')}</td>
          <td>
            <span class="badge badge-${
              item.status === 'completed' ? 'success' :
              item.status === 'processing' ? 'warning' :
              item.status === 'failed' ? 'danger' :
              item.status === 'cancelled' ? 'secondary' :
              'info'
            }">${item.status.toUpperCase()}</span>
          </td>
          <td>
            ${item.status === 'pending' ? `<button onclick="app.cancelQueue('${item.id}')" class="btn-small btn-danger">İptal</button>` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  async cancelQueue(id) {
    if (!confirm('Bu görevi iptal etmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/queue/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadQueue();
        this.showMessage('Görev iptal edildi!', 'success');
      }
    } catch (error) {
      this.showMessage('İptal edilemedi!', 'error');
    }
  }

  // ==================== HISTORY ====================

  renderHistory() {
    const tbody = document.querySelector('#history-table tbody');
    
    if (this.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">Gönderim geçmişi yok</td></tr>`;
      return;
    }

    // Update stats
    const totalSent = this.history.reduce((sum, h) => sum + h.results.length, 0);
    const successful = this.history.reduce((sum, h) => 
      sum + h.results.filter(r => r.status === 'sent').length, 0);
    const failed = totalSent - successful;

    document.getElementById('total-sent').textContent = totalSent;
    document.getElementById('successful-sent').textContent = successful;
    document.getElementById('failed-sent').textContent = failed;

    tbody.innerHTML = this.history.reverse().map(item => {
      const template = this.templates.find(t => t.id === item.templateId);
      const successful = item.results.filter(r => r.status === 'sent').length;
      const failed = item.results.filter(r => r.status === 'failed').length;
      
      return `
        <tr>
          <td>${new Date(item.sentAt).toLocaleString('tr-TR')}</td>
          <td>${template?.name || 'Bilinmiyor'}</td>
          <td>${item.results.length}</td>
          <td class="success">${successful}</td>
          <td class="error">${failed}</td>
          <td>
            <button onclick="app.viewHistoryDetails('${item.id}')" class="btn-small">👁️ Detay</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  viewHistoryDetails(id) {
    const item = this.history.find(h => h.id === id);
    
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Gönderim Detayları</h2>
      <p><strong>Tarih:</strong> ${new Date(item.sentAt).toLocaleString('tr-TR')}</p>
      <p><strong>Toplam:</strong> ${item.results.length} mail</p>
      <p><strong>Başarılı:</strong> <span class="success">${item.results.filter(r => r.status === 'sent').length}</span></p>
      <p><strong>Başarısız:</strong> <span class="error">${item.results.filter(r => r.status === 'failed').length}</span></p>
      
      <h3>Detaylı Sonuçlar:</h3>
      <table class="results-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Contact</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          ${item.results.map(result => {
            const account = this.accounts.find(a => a.id === result.accountId);
            const contact = this.contacts.find(c => c.id === result.contactId);
            
            return `
              <tr>
                <td>${account?.email || 'Bilinmiyor'}</td>
                <td>${contact?.email || 'Bilinmiyor'}</td>
                <td>
                  <span class="badge badge-${result.status === 'sent' ? 'success' : 'danger'}">
                    ${result.status === 'sent' ? '✓ Gönderildi' : '✗ Başarısız'}
                  </span>
                  ${result.error ? `<br><small>${result.error}</small>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <button onclick="app.hideModal()" class="btn-primary">Kapat</button>
    `;

    this.showModal();
  }

  // ==================== UTILS ====================

  showModal() {
    document.getElementById('modal').classList.remove('hidden');
  }

  hideModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  showProgress(text) {
    const progressDiv = document.getElementById('send-progress');
    const progressText = document.querySelector('.progress-text');
    const progressFill = document.querySelector('.progress-fill');
    
    progressDiv.classList.remove('hidden');
    progressText.textContent = text;
    progressFill.style.width = '50%';
  }

  hideProgress() {
    const progressDiv = document.getElementById('send-progress');
    const progressFill = document.querySelector('.progress-fill');
    
    progressFill.style.width = '100%';
    
    setTimeout(() => {
      progressDiv.classList.add('hidden');
      progressFill.style.width = '0%';
    }, 1000);
  }

  showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app
const app = new ZeptoMailDomainManager();
