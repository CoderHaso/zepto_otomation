const { ipcRenderer } = require('electron');

class ZeptoemailsDomainManager {
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
    this.localCache = this.loadLocalCache(); // Persistent local cache
    this.isLoading = false;
    
    this.init();
  }

  // Load cache from localStorage
  loadLocalCache() {
    try {
      const cached = localStorage.getItem('zeptomail_cache');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('Cache load error:', error);
      return {};
    }
  }

  // Save cache to localStorage
  saveLocalCache() {
    try {
      localStorage.setItem('zeptomail_cache', JSON.stringify(this.localCache));
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  // Update cache for domain
  updateDomainCache(domainId, data) {
    if (!this.localCache[domainId]) {
      this.localCache[domainId] = {};
    }
    Object.assign(this.localCache[domainId], data, { timestamp: Date.now() });
    this.saveLocalCache();
  }

  // Get cached data for domain
  getCachedData(domainId) {
    return this.localCache[domainId] || null;
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
    
    // Search
    document.getElementById('contacts-search').addEventListener('input', (e) => this.searchContacts(e.target.value));
    
    // Contacts tab
    document.getElementById('contacts-account-filter').addEventListener('change', (e) => this.filterContactsByAccount(e.target.value));
    document.querySelectorAll('.contacts-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchContactsTab(e.target.dataset.status));
    });

    // Send
    document.getElementById('send-now').addEventListener('click', () => this.sendNow());
    document.getElementById('schedule-send').addEventListener('click', () => this.scheduleSend());

    // Queue
    document.getElementById('refresh-queue').addEventListener('click', () => this.loadQueue());
    document.getElementById('clear-queue').addEventListener('click', () => this.clearCompletedQueue());

    // History
    document.getElementById('select-all-history-table').addEventListener('change', (e) => this.toggleAllHistory(e.target.checked));
    document.getElementById('delete-selected-history').addEventListener('click', () => this.deleteSelectedHistory());

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
    
    if (tabName === 'overview') {
      this.renderDomains();
      this.renderDomainDetails();
    } else if (tabName === 'queue') {
      this.renderQueue();
    } else if (tabName === 'history') {
      this.renderHistory();
    } else if (tabName === 'send') {
      this.updateSendForm();
    } else if (tabName === 'contacts') {
      this.updateContactsTab();
      this.renderContactsList();
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
      const domains = await response.json();
      
      // Preserve active domain if it exists
      const currentActiveDomainId = this.activeDomain?.id;
      this.domains = domains;
      
      // Find active domain from backend (has active=true flag)
      const backendActiveDomain = this.domains.find(d => d.active);
      
      // Update active domain reference
      if (currentActiveDomainId) {
        // Keep current active domain
        this.activeDomain = this.domains.find(d => d.id === currentActiveDomainId);
      } else if (backendActiveDomain) {
        // Use backend active domain on first load
        this.activeDomain = backendActiveDomain;
      }
      
      this.renderDomains();
      this.updateActiveDomainDisplay();
      
      // ALWAYS load domain data if there's an active domain
      if (this.activeDomain) {
        await this.loadDomainData(this.activeDomain.id);
      }
    } catch (error) {
      console.error('Domains load error:', error);
    }
  }

  async loadDomainData(domainId, skipContactsLoad = false) {
    try {
      // Get cached data first and use immediately
      const cached = this.getCachedData(domainId);
      if (cached) {
        this.accounts = cached.accounts || [];
        this.templates = cached.templates || [];
        this.contacts = cached.contacts || [];
        this.queue = cached.queue || [];
        this.history = cached.history || [];
        this.renderDomainDetails();
      }
      
      // Load fresh data in parallel
      const [accountsRes, templatesRes, queueRes, historyRes] = await Promise.all([
        fetch(`http://localhost:3000/api/accounts?domainId=${domainId}`),
        fetch(`http://localhost:3000/api/templates?domainId=${domainId}`),
        fetch(`http://localhost:3000/api/queue?domainId=${domainId}`),
        fetch(`http://localhost:3000/api/history?domainId=${domainId}`)
      ]);
      
      const newAccounts = await accountsRes.json();
      const newTemplates = await templatesRes.json();
      const newQueue = await queueRes.json();
      const newHistory = await historyRes.json();
      
      this.accounts = newAccounts;
      this.templates = newTemplates;
      this.queue = newQueue;
      this.history = newHistory;
      
      // Load contacts from Google Sheets (ALWAYS unless skipped)
      if (!skipContactsLoad) {
        await this.autoLoadContactsFromSheets();
      }
      
      // Update cache with ALL data
      this.updateDomainCache(domainId, {
        accounts: this.accounts,
        templates: this.templates,
        contacts: this.contacts,
        queue: this.queue,
        history: this.history
      });
      
      // Final render with fresh data
      this.renderDomainDetails();
      if (this.currentTab === 'contacts') {
        this.renderContactsList();
      }
    } catch (error) {
      console.error('Domain data load error:', error);
    }
  }

  async autoLoadContactsFromSheets() {
    try {
      const response = await fetch('http://localhost:3000/api/sheets/auto-load-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: this.activeDomain.id
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        this.contacts = Array.isArray(result.contacts) ? result.contacts : [];
        

        
        const accountsRes = await fetch(`http://localhost:3000/api/accounts?domainId=${this.activeDomain.id}`);
        this.accounts = await accountsRes.json();
        
        const domainsRes = await fetch('http://localhost:3000/api/domains');
        this.domains = await domainsRes.json();
        this.activeDomain = this.domains.find(d => d.id === this.activeDomain.id);
        
        console.log(`Loaded ${this.contacts.length} contacts from Google Sheets`);
      } else {
        const contactsRes = await fetch(`http://localhost:3000/api/contacts?domainId=${this.activeDomain.id}`);
        const data = await contactsRes.json();
        this.contacts = Array.isArray(data) ? data : [];
        console.log(`Loaded ${this.contacts.length} contacts from local`);
      }
    } catch (error) {
      console.error('Load error:', error);
      this.contacts = [];
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
      displayElement.textContent = `Active: ${this.activeDomain.name} (${this.activeDomain.domain}) | 📤 ${this.activeDomain.stats.totalSent} sent`;
      displayElement.style.color = '#4caf50';
    } else {
      displayElement.textContent = 'No domain selected';
      displayElement.style.color = '#999';
    }
  }

  // ==================== DOMAINS ====================

  renderDomains() {
    const container = document.getElementById('domains-container');
    
    if (this.domains.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No domains found</h3>
          <p>Add a new domain to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.domains.map(domain => `
      <div class="domain-card ${domain.active ? 'active' : ''}">
        <div class="domain-header">
          <h3>
            ${domain.name}
            ${domain.active ? '<span class="badge badge-success">ACTIVE</span>' : ''}
          </h3>
          <div class="domain-actions">
            ${!domain.active ? `<button onclick="app.activateDomain('${domain.id}')" class="btn-small">✓ Activate</button>` : ''}
            <button onclick="app.editDomain('${domain.id}')" class="btn-small">✏️</button>
            <button onclick="app.deleteDomain('${domain.id}')" class="btn-small btn-danger">🗑️</button>
          </div>
        </div>
        <p><strong>Domain:</strong> ${domain.domain}</p>
        <p><strong>emails Agent:</strong> ${domain.emailsAgent}</p>
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
      <h2>${isEdit ? 'Edit Domain' : 'New Domain'}</h2>
      <form id="domain-form">
        <div class="form-group">
          <label>Domain Name:</label>
          <input type="text" id="domain-name" value="${domain?.name || ''}" placeholder="Readers House" required>
        </div>
        <div class="form-group">
          <label>Domain:</label>
          <input type="text" id="domain-domain" value="${domain?.domain || ''}" placeholder="readershouse.co.uk" required>
        </div>
        <div class="form-group">
          <label>Send emails Token:</label>
          <textarea id="domain-apikey" rows="3" required>${domain?.apiKey || ''}</textarea>
          <small>Zoho-enczapikey ...</small>
        </div>
        <div class="form-group">
          <label>emails Agent Alias:</label>
          <input type="text" id="domain-emailsagent" value="${domain?.emailsAgent || ''}" placeholder="617b792618165d06" required>
        </div>
        <div class="form-group">
          <label>Host:</label>
          <input type="text" id="domain-host" value="${domain?.host || 'api.zeptoemails.com'}" required>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
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
      emailsAgent: document.getElementById('domain-emailsagent').value.trim(),
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
        this.showMessage('Domain saved!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to save domain!', 'error');
    }
  }

  async activateDomain(domainId) {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      this.showFullScreenLoading('Domain değiştiriliyor...');
      
      const response = await fetch(`http://localhost:3000/api/domains/${domainId}/activate`, {
        method: 'POST'
      });

      if (response.ok) {
        // Load domains
        const domainsRes = await fetch('http://localhost:3000/api/domains');
        this.domains = await domainsRes.json();
        this.activeDomain = this.domains.find(d => d.id === domainId);
        
        // Use cached data immediately
        const cached = this.getCachedData(domainId);
        if (cached) {
          this.accounts = cached.accounts || [];
          this.templates = cached.templates || [];
          this.contacts = cached.contacts || [];
          this.queue = cached.queue || [];
          this.history = cached.history || [];
          
          // Render immediately with cached data
          this.renderDomains();
          this.updateActiveDomainDisplay();
          this.renderDomainDetails();
        }
        
        // Load ALL fresh data (including contacts) BEFORE hiding loading
        await this.loadDomainData(domainId);
        
        this.hideFullScreenLoading();
        this.showMessage('Domain aktif edildi!', 'success');
      } else {
        this.hideFullScreenLoading();
        this.showMessage('Domain aktivasyonu başarısız!', 'error');
      }
    } catch (error) {
      this.hideFullScreenLoading();
      this.showMessage('Domain aktivasyonu başarısız!', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  editDomain(id) {
    const domain = this.domains.find(d => d.id === id);
    this.showDomainModal(domain);
  }

  async deleteDomain(id) {
    if (!confirm('Are you sure you want to delete this domain?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/domains/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadDomains();
        this.showMessage('Domain deleted!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to delete domain!', 'error');
    }
  }

  // ==================== DOMAIN DETAILS ====================

  renderDomainDetails() {
    if (!this.activeDomain) {
      const detailsEl = document.getElementById('domain-details');
      if (detailsEl) detailsEl.classList.add('hidden');
      return;
    }

    const detailsEl = document.getElementById('domain-details');
    if (detailsEl) detailsEl.classList.remove('hidden');
    
    this.renderAccounts();
    this.renderTemplates();
  }

  filterContactsByAccount(accountId) {
    this.filteredAccountId = accountId;
    this.renderContacts();
  }

  // ==================== ACCOUNTS ====================

  renderAccounts() {
    const container = document.getElementById('accounts-container');
    
    if (this.accounts.length === 0) {
      container.innerHTML = `<p class="hint">No accounts added yet.</p>`;
      return;
    }

    container.innerHTML = this.accounts.map(account => {
      const accountContacts = this.contacts.filter(c => c.accountId === account.id);
      const unsent = accountContacts.filter(c => (c.sendStatus || 'unsent') === 'unsent').length;
      
      return `
      <div class="account-card ${account.active ? 'active' : 'inactive'}">
        <div class="account-header">
          <div>
            <h4>${account.displayName}</h4>
            <p>${account.email}</p>
          </div>
          <div class="account-actions">
            <button onclick="app.testAccount('${account.id}')" class="btn-small" title="Send Test">🧪</button>
            <button onclick="app.toggleAccountActive('${account.id}')" class="btn-small" title="${account.active ? 'Deactivate' : 'Activate'}">
              ${account.active ? '✓' : '○'}
            </button>
            <button onclick="app.editAccount('${account.id}')" class="btn-small">✏️</button>
            <button onclick="app.deleteAccount('${account.id}')" class="btn-small btn-danger">🗑️</button>
          </div>
        </div>
        <div class="stats-mini">
          <span title="Total Sent">📤 ${account.stats.totalSent}</span>
          <span style="color: #2196F3;" title="Unsent">📬 ${unsent}</span>
          <span class="success" title="Successful">✓ ${account.stats.successful}</span>
          <span class="error" title="Failed">✗ ${account.stats.failed}</span>
        </div>
      </div>
    `}).join('');
  }

  showAccountModal(account = null) {
    const isEdit = !!account;
    if (!this.activeDomain) {
      this.showMessage('Please select a domain first!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Edit Account' : 'New Account'}</h2>
      <form id="account-form">
        <div class="form-group">
          <label>Name:</label>
          <input type="text" id="account-name" value="${account?.name || ''}" placeholder="Dan Peters" required>
        </div>
        <div class="form-group">
          <label>Email:</label>
          <input type="email" id="account-email" value="${account?.email || ''}" placeholder="dan.peters@readershouse.co.uk" required>
        </div>
        <div class="form-group">
          <label>Display Name (In email signature):</label>
          <input type="text" id="account-displayname" value="${account?.displayName || ''}" placeholder="Dan Peters" required>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
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
        
        // Reload current domain data
        await this.loadDomainData(this.activeDomain.id);
        
        // Update domain stats without changing active domain
        const domainsRes = await fetch('http://localhost:3000/api/domains');
        this.domains = await domainsRes.json();
        this.activeDomain = this.domains.find(d => d.id === this.activeDomain.id);
        this.renderDomains();
        this.updateActiveDomainDisplay();
        
        this.showMessage('Account saved!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to save account!', 'error');
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
      this.showMessage('Operation failed!', 'error');
    }
  }

  async testAccount(accountId) {
    try {
      this.showMessage('Sending test email...', 'info');
      
      const response = await fetch(`http://localhost:3000/api/accounts/${accountId}/test`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (response.ok) {
        this.showMessage('✓ Test email sent!', 'success');
      } else {
        console.error('Test error:', result);
        this.showMessage(`Error: ${result.error || JSON.stringify(result.details)}`, 'error');
      }
    } catch (error) {
      this.showMessage('Failed to send test email!', 'error');
    }
  }

  editAccount(id) {
    const account = this.accounts.find(a => a.id === id);
    this.showAccountModal(account);
  }

  async deleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/accounts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadDomainData(this.activeDomain.id);
        this.showMessage('Account deleted!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to delete account!', 'error');
    }
  }

  // ==================== TEMPLATES ====================

  renderTemplates() {
    const container = document.getElementById('templates-container');
    
    if (this.templates.length === 0) {
      container.innerHTML = `<p class="hint">No templates added yet.</p>`;
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
          <button onclick="app.editTemplate('${template.id}')" class="btn-small">✏️ Edit</button>
          <button onclick="app.deleteTemplate('${template.id}')" class="btn-small btn-danger">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
  }

  showTemplateModal(template = null) {
    const isEdit = !!template;
    if (!this.activeDomain) {
      this.showMessage('Please select a domain first!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    const existingMappings = template?.mergeFieldMapping || {};
    
    modalBody.innerHTML = `
      <h2>${isEdit ? 'Edit Template' : 'New Template'}</h2>
      <form id="template-form">
        <div class="form-group">
          <label>Template Key (optional for SMTP):</label>
          <input type="text" id="template-key" value="${template?.templateKey || ''}" placeholder="2d6f.2377b7024864bedf.k1...">
          <small>Copy template key from ZeptoMail dashboard (leave empty if using SMTP with manual HTML)</small>
        </div>
        <div class="form-group">
          <label>Template Name:</label>
          <input type="text" id="template-name" value="${template?.name || ''}" placeholder="Interview Invitation" required>
        </div>
        <div class="form-group">
          <label>Subject (for SMTP only):</label>
          <input type="text" id="template-subject" value="${(template?.subject || '').replace(/"/g, '&quot;')}" placeholder="Interview Invitation">
        </div>
        <div class="form-group">
          <label>HTML Body (for SMTP only):</label>
          <textarea id="template-html" rows="10" placeholder="<html>...</html>">${template?.htmlBody || ''}</textarea>
          <small>Copy template HTML from ZeptoMail if using SMTP</small>
        </div>
        
        <hr>
        
        <h3>Merge Field Mapping</h3>
        <div class="alert alert-info">
          <strong>💡 Important:</strong><br>
          • In ZeptoMail template, use <code>{{field_name}}</code> format (double curly braces)<br>
          • <code>{{account_name}}</code> is auto-added - it will be replaced with sender's name<br>
          • Map other fields below to Google Sheets columns or fixed text
        </div>
        
        <div id="merge-fields-container">
          ${Object.entries(existingMappings)
            .filter(([field]) => field !== 'account_name')
            .map(([field, mapping], index) => this.getMergeFieldRow(field, mapping, index))
            .join('')}
        </div>
        
        <button type="button" id="add-merge-field" class="btn-secondary">+ Add Merge Field</button>
        
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
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

  async fetchTemplateFromZepto() {
    const templateKey = document.getElementById('template-key').value.trim();
    
    if (!templateKey) {
      this.showMessage('Enter template key!', 'error');
      return;
    }

    try {
      this.showMessage('Template bilgileri çekiliyor...', 'info');
      
      const response = await fetch('http://localhost:3000/api/templates/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: this.activeDomain.id,
          templateKey: templateKey
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        document.getElementById('template-name').value = result.name;
        document.getElementById('template-subject').value = result.subject;
        document.getElementById('template-html').value = result.htmlBody;
        
        const container = document.getElementById('merge-fields-container');
        container.innerHTML = '';
        
        let index = 0;
        for (const [field, mapping] of Object.entries(result.mergeFields)) {
          if (field !== 'account_name') {
            const row = document.createElement('div');
            row.innerHTML = this.getMergeFieldRow(field, mapping, index);
            container.appendChild(row.firstElementChild);
            index++;
          }
        }
        
        this.showMessage('✓ Template bilgileri Uploadndi!', 'success');
      } else {
        this.showMessage(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showMessage('Failed to fetch template!', 'error');
    }
  }

  getMergeFieldRow(field = '', mapping = { type: 'column', value: 'full_name' }, index = 0) {
    return `
      <div class="merge-field-row" data-index="${index}">
        <div class="form-group">
          <label>Field Name:</label>
          <input type="text" class="merge-field-name" value="${field}" placeholder="Person_name" required>
        </div>
        <div class="form-group">
          <label>Type:</label>
          <select class="merge-field-type" onchange="app.updateMergeFieldValueInput(this)">
            <option value="column" ${mapping.type === 'column' ? 'selected' : ''}>Google Sheet Column</option>
            <option value="account_info" ${mapping.type === 'account_info' ? 'selected' : ''}>Account Info</option>
            <option value="text" ${mapping.type === 'text' ? 'selected' : ''}>Fixed Text</option>
          </select>
        </div>
        <div class="form-group">
          <label class="merge-value-label">${mapping.type === 'column' ? 'Column:' : mapping.type === 'account_info' ? 'Account Field:' : 'Text:'}</label>
          <select class="merge-field-value" style="display: ${mapping.type === 'column' ? 'block' : 'none'};">
            <option value="full_name" ${mapping.value === 'full_name' ? 'selected' : ''}>full_name</option>
            <option value="email" ${mapping.value === 'email' ? 'selected' : ''}>email</option>
            <option value="situation" ${mapping.value === 'situation' ? 'selected' : ''}>situation</option>
            <option value="pack" ${mapping.value === 'pack' ? 'selected' : ''}>pack</option>
          </select>
          <select class="merge-field-account-info" style="display: ${mapping.type === 'account_info' ? 'block' : 'none'};">
            <option value="first_name" ${mapping.value === 'first_name' ? 'selected' : ''}>First Name</option>
            <option value="last_name" ${mapping.value === 'last_name' ? 'selected' : ''}>Last Name</option>
            <option value="full_name" ${mapping.value === 'full_name' ? 'selected' : ''}>Full Name</option>
            <option value="email" ${mapping.value === 'email' ? 'selected' : ''}>Email</option>
          </select>
          <input type="text" class="merge-field-value-text" value="${mapping.type === 'text' ? mapping.value : ''}" style="display: ${mapping.type === 'text' ? 'block' : 'none'};" placeholder="Fixed value">
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
    const accountInfoInput = row.querySelector('.merge-field-account-info');
    const textInput = row.querySelector('.merge-field-value-text');
    
    if (type === 'column') {
      label.textContent = 'Column:';
      selectInput.style.display = 'block';
      accountInfoInput.style.display = 'none';
      textInput.style.display = 'none';
    } else if (type === 'account_info') {
      label.textContent = 'Account Field:';
      selectInput.style.display = 'none';
      accountInfoInput.style.display = 'block';
      textInput.style.display = 'none';
    } else {
      label.textContent = 'Text:';
      selectInput.style.display = 'none';
      accountInfoInput.style.display = 'none';
      textInput.style.display = 'block';
    }
  }

  async saveTemplate(templateId = null) {
    const name = document.getElementById('template-name').value.trim();
    const templateKey = document.getElementById('template-key').value.trim();
    const subject = document.getElementById('template-subject').value.trim();
    const htmlBody = document.getElementById('template-html').value.trim();
    
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
        } else if (type === 'account_info') {
          const value = row.querySelector('.merge-field-account-info').value;
          mergeFieldMapping[fieldName] = { type: 'account_info', value };
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
      subject,
      htmlBody,
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
        this.showMessage('Template saved!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to save template!', 'error');
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
        this.showMessage('Template deleted!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to delete template!', 'error');
    }
  }

  // ==================== CONTACTS ====================

  renderContacts() {
    const tbody = document.querySelector('#contacts-table tbody');
    
    let filteredContacts = this.contacts;
    if (this.filteredAccountId && this.filteredAccountId !== 'all') {
      filteredContacts = this.contacts.filter(c => c.accountId === this.filteredAccountId);
    }
    
    if (filteredContacts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">Henüz kişi Addnmemiş</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredContacts.map(contact => {
      const account = this.accounts.find(a => a.id === contact.accountId);
      return `
      <tr>
        <td><input type="checkbox" class="contact-checkbox" data-id="${contact.id}" ${this.selectedContacts.has(contact.id) ? 'checked' : ''}></td>
        <td>${contact.full_name}</td>
        <td>${contact.email}</td>
        <td>${account ? account.displayName : '-'}</td>
        <td>
          <button onclick="app.viewContact('${contact.id}')" class="btn-small">👁️</button>
          <button onclick="app.deleteContact('${contact.id}')" class="btn-small btn-danger">🗑️</button>
        </td>
      </tr>
    `}).join('');
    
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
      this.showMessage('Please select a domain first!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Add New Contact</h2>
      <form id="contact-form">
        <div class="form-group">
          <label>Select Account: *</label>
          <select id="contact-account" required>
            <option value="">Select account...</option>
            ${this.accounts.map(a => `<option value="${a.id}">${a.displayName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Name (Author's Name): *</label>
          <input type="text" id="contact-name" placeholder="John Doe" required>
        </div>
        <div class="form-group">
          <label>Email (Author's Email): *</label>
          <input type="email" id="contact-email" placeholder="john@example.com" required>
        </div>
        <hr>
        <p class="hint">Optional fields:</p>
        <div class="form-group">
          <label>Status (Is Situation):</label>
          <select id="contact-situation">
            <option value="">Select...</option>
            <option value="Request">Request</option>
            <option value="Details">Details</option>
            <option value="Questions">Questions</option>
            <option value="Received">Received</option>
            <option value="Published">Published</option>
            <option value="Already Have">Already Have</option>
            <option value="Failed Sent">Failed Sent</option>
            <option value="Declined">Declined</option>
          </select>
        </div>
        <div class="form-group">
          <label>Package (Pack):</label>
          <select id="contact-pack">
            <option value="">Select...</option>
            <option value="Pack 1">Pack 1</option>
            <option value="Pack 2">Pack 2</option>
            <option value="Pack 3">Pack 3</option>
            <option value="Offer">Offer</option>
            <option value="Declined">Declined</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Add</button>
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
    const form = document.getElementById('contact-form');
    const btn = form.querySelector('button[type="submit"]');
    
    if (btn.disabled) return; // Prevent double submission
    btn.disabled = true;
    btn.textContent = '⏳ Adding...';
    
    const contactData = {
      domainId: this.activeDomain.id,
      accountId: document.getElementById('contact-account').value,
      name: document.getElementById('contact-name').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      situation: document.getElementById('contact-situation').value,
      pack: document.getElementById('contact-pack').value
    };

    try {
      const response = await fetch('http://localhost:3000/api/sheets/add-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      });

      if (response.ok) {
        const result = await response.json();
        this.hideModal();
        
        // Add to local contacts
        this.contacts.push(result.contact);
        
        // Update cache
        if (this.domainCache[this.activeDomain.id]) {
          this.domainCache[this.activeDomain.id].contacts = this.contacts;
        }
        
        // Render
        if (this.currentTab === 'contacts') {
          this.renderContactsList();
        }
        
        this.showMessage('Contact added!', 'success');
      } else {
        const error = await response.json();
        this.showMessage(`Error: ${error.error}`, 'error');
        btn.disabled = false;
        btn.textContent = 'Add';
      }
    } catch (error) {
      console.error('Save error:', error);
      this.showMessage('Failed to add contact!', 'error');
      btn.disabled = false;
      btn.textContent = 'Add';
    }
  }

  async importCSV() {
    if (!this.activeDomain) {
      this.showMessage('Please select a domain first!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Import Contacts</h2>
      <div class="alert alert-info">
        <strong>📊 Format:</strong><br>
        <code>name</code> (required) | <code>email</code> (required) | <code>situation</code> (optional) | <code>pack</code> (optional)
      </div>
      <form id="csv-form">
        <div class="form-group">
          <label>Select Account: *</label>
          <select id="csv-account" required>
            <option value="">Select account...</option>
            ${this.accounts.map(a => `<option value="${a.id}">${a.displayName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>File (CSV or Excel): *</label>
          <input type="file" id="csv-file" accept=".csv,.xlsx,.xls" required>
          <small>
            <a href="#" onclick="app.downloadTemplate('csv'); return false;">📄 Download CSV Template</a> | 
            <a href="#" onclick="app.downloadTemplate('xlsx'); return false;">📄 Download Excel Template</a>
          </small>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">Cancel</button>
          <button type="submit" id="upload-btn" class="btn-primary">Upload</button>
        </div>
      </form>
    `;

    document.getElementById('csv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const accountId = document.getElementById('csv-account').value;
      const fileInput = document.getElementById('csv-file');
      const file = fileInput.files[0];
      const uploadBtn = document.getElementById('upload-btn');
      
      if (!file) return;

      // Disable button and show loading
      uploadBtn.disabled = true;
      uploadBtn.textContent = '⏳ Uploading...';
      this.showMessage('Uploading file...', 'info');

      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('domainId', this.activeDomain.id);
      formData.append('accountId', accountId);

      try {
        const response = await fetch('http://localhost:3000/api/sheets/import-bulk', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          this.hideModal();
          this.showMessage('Processing contacts...', 'info');
          await this.loadDomainData(this.activeDomain.id);
          this.showMessage(`${result.imported} contacts added and Google Sheets updated!`, 'success');
        } else {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Upload error:', error);
          this.showMessage(`Upload failed: ${error.error || 'Unknown error'}`, 'error');
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload';
        }
      } catch (error) {
        console.error('Upload exception:', error);
        this.showMessage(`Upload failed: ${error.message}`, 'error');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
      }
    });

    this.showModal();
  }

  downloadTemplate(format) {
    const data = [
      ['name', 'email', 'situation', 'pack'],
      ['John Doe', 'john@example.com', 'Request', 'Pack 1'],
      ['Jane Smith', 'jane@example.com', '', '']
    ];

    if (format === 'csv') {
      const csv = data.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Excel format - use backend to generate proper Excel file
      fetch('http://localhost:3000/api/templates/download-excel')
        .then(response => response.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'contacts_template.xlsx';
          a.click();
          URL.revokeObjectURL(url);
        })
        .catch(err => {
          console.error('Download error:', err);
          this.showMessage('Excel download failed!', 'error');
        });
      return;
    }
    
    this.showMessage('Template downloaded!', 'success');
  }

  viewContact(id) {
    const contact = this.contacts.find(c => c.id === id);
    
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Kişi Detailsları</h2>
      <div class="contact-details">
        <p><strong>Name:</strong> ${contact.name}</p>
        <p><strong>Surname:</strong> ${contact.surname}</p>
        <p><strong>Full Name:</strong> ${contact.full_name}</p>
        <p><strong>Email:</strong> ${contact.email}</p>
        ${contact.link ? `<p><strong>Link:</strong> ${contact.link}</p>` : ''}
        ${contact.aaweb ? `<p><strong>AAWeb:</strong> ${contact.aaweb}</p>` : ''}
        ${contact.web ? `<p><strong>Web:</strong> ${contact.web}</p>` : ''}
        ${contact.facebook_resolved ? `<p><strong>Facebook:</strong> ${contact.facebook_resolved}</p>` : ''}
      </div>
      <button onclick="app.hideModal()" class="btn-primary">Close</button>
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
      this.showMessage('Failed to delete contact!', 'error');
    }
  }

  // ==================== SEND ====================

  updateSendForm() {
    if (!this.selectedSendContacts) {
      this.selectedSendContacts = new Set();
    }
    
    const accountSelect = document.getElementById('send-account-select');
    const templateSelect = document.getElementById('send-template-select');
    
    accountSelect.innerHTML = '<option value="">Bir account seçin...</option>' +
      this.accounts.filter(a => a.active).map(a => `<option value="${a.id}">${a.displayName}</option>`).join('');
    
    templateSelect.innerHTML = '<option value="">Bir template seçin...</option>' +
      this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    accountSelect.addEventListener('change', () => {
      this.selectedSendContacts = new Set();
      this.updateSendContactsList();
    });
  }

  async updateSendContactsList() {
    const accountId = document.getElementById('send-account-select').value;
    const container = document.getElementById('send-contacts-list');
    
    if (!accountId) {
      container.innerHTML = '<p class="hint">Yukarıdan bir account seçin</p>';
      return;
    }

    // Filter unsent contacts for this account
    const unsentContacts = this.contacts.filter(c => 
      c.accountId === accountId && (c.sendStatus || 'unsent') === 'unsent'
    );

    if (unsentContacts.length === 0) {
      container.innerHTML = '<p class="hint">No unsent contacts for this account</p>';
      return;
    }

    this.renderSendContactsList(unsentContacts);
  }

  renderSendContactsList(contacts) {
    const container = document.getElementById('send-contacts-list');
    
    if (!this.selectedSendContacts) {
      this.selectedSendContacts = new Set();
    }
    
    container.innerHTML = `
      <div class="contacts-selection">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <label>
              <input type="checkbox" id="select-all-send-contacts" onchange="app.toggleAllSendContacts(this.checked)">
              <strong>Tümünü Seç (${contacts.length} kişi)</strong>
            </label>
            <span id="selected-send-count" style="margin-left: 1rem; color: #4caf50; font-weight: bold;">Seçilen: ${this.selectedSendContacts.size}</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button onclick="app.selectFirst(10)" class="btn-small">İlk 10</button>
            <button onclick="app.selectFirst(15)" class="btn-small">İlk 15</button>
            <button onclick="app.selectFirst(20)" class="btn-small">İlk 20</button>
            <button onclick="app.selectFirst(50)" class="btn-small">İlk 50</button>
          </div>
        </div>
        <div class="contacts-list">
          ${contacts.map(c => `
            <label>
              <input type="checkbox" class="send-contact-cb" value="${c.id}" ${this.selectedSendContacts && this.selectedSendContacts.has(c.id) ? 'checked' : ''}>
              ${c.full_name} (${c.email})
            </label>
          `).join('')}
        </div>
      </div>
    `;

    document.querySelectorAll('.send-contact-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (!this.selectedSendContacts) {
          this.selectedSendContacts = new Set();
        }
        if (e.target.checked) {
          this.selectedSendContacts.add(e.target.value);
        } else {
          this.selectedSendContacts.delete(e.target.value);
        }
        this.updateSelectedSendCount();
      });
    });
  }

  toggleAllSendContacts(checked) {
    const accountId = document.getElementById('send-account-select').value;
    const unsentContacts = this.contacts.filter(c => 
      c.accountId === accountId && (c.sendStatus || 'unsent') === 'unsent'
    );

    if (!this.selectedSendContacts) {
      this.selectedSendContacts = new Set();
    }
    
    this.selectedSendContacts.clear();
    if (checked) {
      unsentContacts.forEach(c => this.selectedSendContacts.add(c.id));
    }

    document.querySelectorAll('.send-contact-cb').forEach(cb => {
      cb.checked = checked;
    });
    
    this.updateSelectedSendCount();
  }

  selectFirst(count) {
    const accountId = document.getElementById('send-account-select').value;
    const unsentContacts = this.contacts.filter(c => 
      c.accountId === accountId && (c.sendStatus || 'unsent') === 'unsent'
    );

    if (!this.selectedSendContacts) {
      this.selectedSendContacts = new Set();
    }
    
    this.selectedSendContacts.clear();
    unsentContacts.slice(0, count).forEach(c => this.selectedSendContacts.add(c.id));

    document.querySelectorAll('.send-contact-cb').forEach(cb => {
      cb.checked = this.selectedSendContacts.has(cb.value);
    });
    
    this.updateSelectedSendCount();
  }

  updateSelectedSendCount() {
    const countEl = document.getElementById('selected-send-count');
    if (countEl) {
      countEl.textContent = `Seçilen: ${this.selectedSendContacts.size}`;
    }
  }

  async sendNow() {
    const accountId = document.getElementById('send-account-select').value;
    const templateId = document.getElementById('send-template-select').value;
    
    if (!accountId) {
      this.showMessage('Bir account seçin!', 'error');
      return;
    }
    
    if (!templateId) {
      this.showMessage('Bir template seçin!', 'error');
      return;
    }
    
    if (!this.selectedSendContacts || this.selectedSendContacts.size === 0) {
      this.showMessage('En az bir kişi seçin!', 'error');
      return;
    }

    const contactIds = Array.from(this.selectedSendContacts);
    const selectedContacts = this.contacts.filter(c => contactIds.includes(c.id));
    const totalCount = selectedContacts.length;
    
    console.log('Send Now - Account:', accountId, 'Template:', templateId);
    console.log('Selected contacts:', selectedContacts.map(c => c.email));

    const assignments = [{
      accountId,
      contacts: selectedContacts
    }];

    try {
      // Show full screen loading with progress
      this.showFullScreenLoading(`Sending Emails...<br><span id="send-progress-count" style="font-size: 36px; margin-top: 20px;">0 / ${totalCount}</span>`);
      
      // Simulate progress (750ms per email)
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress++;
        if (currentProgress <= totalCount) {
          const progressEl = document.getElementById('send-progress-count');
          if (progressEl) {
            progressEl.textContent = `${currentProgress} / ${totalCount}`;
          }
        }
      }, 750);
      
      const response = await fetch('http://localhost:3000/api/send/immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId: this.activeDomain.id,
          templateId: templateId,
          assignments: assignments
        })
      });

      clearInterval(progressInterval);
      
      // Show final count
      const progressEl = document.getElementById('send-progress-count');
      if (progressEl) {
        progressEl.textContent = `${totalCount} / ${totalCount}`;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = await response.json();
      
      console.log('Send result:', result);
      
      this.hideFullScreenLoading();
      
      if (response.ok && result.results) {
        const successful = result.results.filter(r => r.status === 'sent').length;
        const failed = result.results.filter(r => r.status === 'failed').length;
        
        console.log('Results:', { successful, failed, total: result.results.length });
        
        const firstError = result.results.find(r => r.status === 'failed');
        if (firstError && failed > 0) {
          console.error('İlk hata:', firstError.error);
        }
        
        this.showMessage(`✓ Gönderim tamamlandı! ${successful} başarılı, ${failed} başarısız${firstError ? ' - Hata: ' + firstError.error : ''}`, failed > 0 ? 'error' : 'success');
        
        // Reload data
        await this.loadDomains();
        await this.loadDomainData(this.activeDomain.id);
        
        // Reset send form
        this.selectedSendContacts = new Set();
        document.getElementById('send-account-select').value = '';
        document.getElementById('send-template-select').value = '';
        document.getElementById('send-contacts-list').innerHTML = '<p class="hint">Yukarıdan bir account seçin</p>';
      } else {
        console.error('Send failed:', result);
        this.showMessage(result.error || 'Gönderim başarısız!', 'error');
      }
    } catch (error) {
      this.hideFullScreenLoading();
      console.error('Gönderim hatası:', error);
      this.showMessage('Gönderim başarısız!', 'error');
    }
  }

  async scheduleSend() {
    const accountId = document.getElementById('send-account-select').value;
    const templateId = document.getElementById('send-template-select').value;
    
    if (!accountId || !templateId || this.selectedSendContacts.size === 0) {
      this.showMessage('Account, template ve kişi seçin!', 'error');
      return;
    }

    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>⏰ Schedule</h2>
      <form id="schedule-form">
        <div class="form-group">
          <label>Gönderim Tarihi ve Saati:</label>
          <input type="datetime-local" id="scheduled-datetime" required>
        </div>
        <div class="modal-actions">
          <button type="button" onclick="app.hideModal()" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Schedule</button>
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
    const accountId = document.getElementById('send-account-select').value;
    const templateId = document.getElementById('send-template-select').value;
    
    if (!accountId || !templateId || this.selectedSendContacts.size === 0) {
      this.showMessage('Account, template ve kişi seçin!', 'error');
      return;
    }

    const assignments = [{
      accountId,
      contactIds: Array.from(this.selectedSendContacts)
    }];

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
        await this.loadQueue();
        this.switchTab('queue');
      }
    } catch (error) {
      this.showMessage('Kuyruğa ekleme başarısız!', 'error');
    }
  }

  // ==================== QUEUE ====================

  renderQueue() {
    const tbody = document.querySelector('#queue-table tbody');
    
    if (this.queue.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">No tasks in queue</td></tr>`;
      return;
    }

    tbody.innerHTML = this.queue.map(item => {
      const template = this.templates.find(t => t.id === item.templateId);
      const totalContacts = item.assignments.reduce((sum, a) => sum + a.contactIds.length, 0);
      
      return `
        <tr>
          <td>#${item.id.slice(-4)}</td>
          <td>${template?.name || 'Unknown'}</td>
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
            ${item.status === 'pending' ? `<button onclick="app.cancelQueue('${item.id}')" class="btn-small btn-danger">Cancel</button>` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  async cancelQueue(id) {
    if (!confirm('Bu görevi Cancel etmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/queue/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadQueue();
        this.showMessage('Task cancelled!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to cancel!', 'error');
    }
  }

  async clearCompletedQueue() {
    if (!confirm('Tamamlanan ve Cancel edilen görevleri temizlemek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch('http://localhost:3000/api/queue/clear-completed', {
        method: 'POST'
      });

      if (response.ok) {
        await this.loadQueue();
        this.showMessage('Completed tasks cleared!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to clear!', 'error');
    }
  }

  // ==================== HISTORY ====================

  async renderHistory() {
    const tbody = document.querySelector('#history-table tbody');
    
    if (this.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">No sending history</td></tr>`;
      return;
    }

    // Load tracking data
    try {
      const trackingRes = await fetch('http://localhost:3000/api/tracking');
      this.trackingData = await trackingRes.json();
    } catch (error) {
      this.trackingData = [];
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
      
      // Count tracking events
      const messageIds = item.results.map(r => r.messageId).filter(Boolean);
      const opened = this.trackingData.filter(t => 
        messageIds.includes(t.messageId) && t.eventType === 'opened'
      ).length;
      const clicked = this.trackingData.filter(t => 
        messageIds.includes(t.messageId) && t.eventType === 'clicked'
      ).length;
      
      return `
        <tr>
          <td><input type="checkbox" class="history-checkbox" data-id="${item.id}"></td>
          <td>${new Date(item.sentAt).toLocaleString('tr-TR')}</td>
          <td>${template?.name || 'Unknown'}</td>
          <td>${item.results.length}</td>
          <td class="success">${successful}</td>
          <td class="error">${failed}</td>
          <td>
            ${opened > 0 ? `<span class="badge badge-info">👁️ ${opened}</span>` : ''}
            ${clicked > 0 ? `<span class="badge badge-success">👆 ${clicked}</span>` : ''}
            <button onclick="app.viewHistoryDetails('${item.id}')" class="btn-small">👁️ Details</button>
            <button onclick="app.deleteHistory('${item.id}')" class="btn-small btn-danger">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
    
    this.selectedHistory = new Set();
    document.querySelectorAll('.history-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedHistory.add(e.target.dataset.id);
        } else {
          this.selectedHistory.delete(e.target.dataset.id);
        }
      });
    });
  }

  toggleAllHistory(checked) {
    this.selectedHistory = new Set();
    if (checked) {
      this.history.forEach(h => this.selectedHistory.add(h.id));
    }
    document.querySelectorAll('.history-checkbox').forEach(cb => {
      cb.checked = checked;
    });
  }

  async deleteHistory(id) {
    if (!confirm('Bu gönderim kaydını silmek istediğinizden emin misiniz? (Liste etkilenmez, sadece geçmiş temizlenir)')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/history/${id}?keepContacts=true`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.loadHistory();
        this.showMessage('History record deleted!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to delete!', 'error');
    }
  }

  async deleteSelectedHistory() {
    if (this.selectedHistory.size === 0) {
      this.showMessage('Select at least one record!', 'error');
      return;
    }

    if (!confirm(`${this.selectedHistory.size} gönderim kaydını silmek istediğinizden emin misiniz? (Liste etkilenmez)`)) return;

    try {
      const response = await fetch('http://localhost:3000/api/history/bulk-delete?keepContacts=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(this.selectedHistory) })
      });

      if (response.ok) {
        await this.loadHistory();
        this.showMessage('History records deleted!', 'success');
      }
    } catch (error) {
      this.showMessage('Failed to delete!', 'error');
    }
  }

  viewHistoryDetails(id) {
    const item = this.history.find(h => h.id === id);
    const modalBody = document.getElementById('modal-body');
    
    const messageIds = item.results.map(r => r.messageId).filter(Boolean);
    const tracking = this.trackingData?.filter(t => messageIds.includes(t.messageId)) || [];
    
    modalBody.innerHTML = `
      <h2>Gönderim Detailsları</h2>
      <p><strong>Date:</strong> ${new Date(item.sentAt).toLocaleString('tr-TR')}</p>
      <p><strong>Total:</strong> ${item.results.length} emails</p>
      <p><strong>successful:</strong> <span class="success">${item.results.filter(r => r.status === 'sent').length}</span></p>
      <p><strong>failed:</strong> <span class="error">${item.results.filter(r => r.status === 'failed').length}</span></p>
      <p><strong>Açılan:</strong> <span class="badge badge-info">👁️ ${tracking.filter(t => t.eventType === 'opened').length}</span></p>
      <p><strong>Tıklanan:</strong> <span class="badge badge-success">👆 ${tracking.filter(t => t.eventType === 'clicked').length}</span></p>
      
      <h3>Detailslı Sonuçlar:</h3>
      <table class="results-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Tracking</th>
          </tr>
        </thead>
        <tbody>
          ${item.results.map(result => {
            const account = this.accounts.find(a => a.id === result.accountId);
            const contact = result.contact || this.contacts.find(c => c.id === result.contactId);
            const msgTracking = tracking.filter(t => t.messageId === result.messageId);
            const opened = msgTracking.some(t => t.eventType === 'opened');
            const clicked = msgTracking.some(t => t.eventType === 'clicked');
            
            return `
              <tr>
                <td>${account?.email || 'Unknown'}</td>
                <td>${contact?.email || 'Unknown'}</td>
                <td>
                  <span class="badge badge-${result.status === 'sent' ? 'success' : 'danger'}">
                    ${result.status === 'sent' ? '✓ Gönderildi' : '✗ failed'}
                  </span>
                  ${result.error ? `<br><small>${result.error}</small>` : ''}
                </td>
                <td>
                  ${opened ? '<span class="badge badge-info">👁️ Açıldı</span>' : ''}
                  ${clicked ? '<span class="badge badge-success">👆 Tıklandı</span>' : ''}
                  ${!opened && !clicked && result.status === 'sent' ? '<span class="hint" title="Webhook ayarlanmamış olabilir">Tracking bilgisi yok</span>' : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <button onclick="app.hideModal()" class="btn-primary">Close</button>
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

  showFullScreenLoading(message = 'Loading...') {
    let loader = document.getElementById('fullscreen-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'fullscreen-loader';
      loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;color:white;font-size:24px;flex-direction:column;';
      document.body.appendChild(loader);
    }
    loader.innerHTML = `<div style="font-size:48px;margin-bottom:20px;">⏳</div><div>${message}</div>`;
    loader.style.display = 'flex';
  }

  hideFullScreenLoading() {
    const loader = document.getElementById('fullscreen-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }

  // ==================== CONTACTS TAB ====================

  updateContactsTab() {
    const select = document.getElementById('contacts-account-filter');
    if (!select) return;
    
    select.innerHTML = '<option value="all">All Accounts</option>' +
      this.accounts.map(a => `<option value="${a.id}">${a.displayName}</option>`).join('');
    
    if (!this.currentContactsStatus) this.currentContactsStatus = 'all';
    if (!this.selectedAccountForContacts) this.selectedAccountForContacts = 'all';
    if (!this.searchQuery) this.searchQuery = '';
  }

  switchContactsTab(status) {
    document.querySelectorAll('.contacts-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-status="${status}"]`).classList.add('active');
    this.currentContactsStatus = status;
    this.contactsPage = 1;
    this.renderContactsList();
  }

  searchContacts(query) {
    this.searchQuery = query.toLowerCase();
    this.contactsPage = 1;
    this.renderContactsList();
  }

  filterContactsByAccount(accountId) {
    this.selectedAccountForContacts = accountId || null;
    this.contactsPage = 1;
    this.renderContactsList();
  }



  renderContactsList(append = false) {
    const tbody = document.querySelector('#contacts-list-table tbody');
    
    // Ensure contacts is array
    if (!Array.isArray(this.contacts)) {
      this.contacts = [];
    }
    
    // Filter by account
    let filtered = this.selectedAccountForContacts === 'all' 
      ? this.contacts 
      : this.contacts.filter(c => c.accountId === this.selectedAccountForContacts);
    
    // Filter by status
    if (this.currentContactsStatus !== 'all') {
      filtered = filtered.filter(c => (c.sendStatus || 'unsent') === this.currentContactsStatus);
    }
    
    // Filter by search
    if (this.searchQuery) {
      filtered = filtered.filter(c => 
        (c.full_name || '').toLowerCase().includes(this.searchQuery) ||
        (c.email || '').toLowerCase().includes(this.searchQuery)
      );
    }

    // Store filtered for pagination
    this.filteredContacts = filtered;
    if (!this.contactsPage || !append) this.contactsPage = 1;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No contacts found</td></tr>';
      this.updateContactsCounts();
      return;
    }

    // Pagination
    const pageSize = 100;
    let displayContacts;
    
    if (append) {
      // Sadece yeni sayfayı Upload
      const start = (this.contactsPage - 1) * pageSize;
      const end = this.contactsPage * pageSize;
      displayContacts = filtered.slice(start, end);
    } else {
      // İlk Uploadme - baştan başla
      displayContacts = filtered.slice(0, pageSize);
    }

    const rows = displayContacts.map(contact => {
      const account = this.accounts.find(a => a.id === contact.accountId);
      return `
      <tr>
        <td>${contact.full_name}</td>
        <td>${contact.email}</td>
        <td>${account ? account.displayName : '-'}</td>
        <td>
          <span class="badge badge-${
            contact.sendStatus === 'sent' ? 'success' :
            contact.sendStatus === 'failed' ? 'danger' : 'info'
          }">
            ${contact.sendStatus === 'sent' ? '✅ successful' :
              contact.sendStatus === 'failed' ? '⚠️ failed' : '📤 Gönderilmemiş'}
          </span>
        </td>
        <td>
          <button onclick="app.viewContact('${contact.id}')" class="btn-small">👁️</button>
        </td>
      </tr>
    `}).join('');
    
    if (append) {
      // Remove load more button if exists
      const loadMoreRow = tbody.querySelector('.load-more-row');
      if (loadMoreRow) loadMoreRow.remove();
      tbody.innerHTML += rows;
    } else {
      tbody.innerHTML = rows;
    }
    
    const currentlyShowing = append ? this.contactsPage * pageSize : pageSize;
    
    if (filtered.length > currentlyShowing) {
      tbody.innerHTML += `
        <tr class="load-more-row">
          <td colspan="5" style="text-align: center; padding: 1rem;">
            <button onclick="app.loadMoreContacts()" class="btn-primary">
              🔽 Daha Fazla Upload (${currentlyShowing} / ${filtered.length})
            </button>
          </td>
        </tr>
      `;
    }

    this.updateContactsCounts();
  }

  loadMoreContacts() {
    this.contactsPage++;
    this.renderContactsList(true);
  }

  updateContactsCounts() {
    const accountContacts = this.selectedAccountForContacts === 'all'
      ? this.contacts
      : this.contacts.filter(c => c.accountId === this.selectedAccountForContacts);
    
    const unsent = accountContacts.filter(c => (c.sendStatus || 'unsent') === 'unsent').length;
    const sent = accountContacts.filter(c => c.sendStatus === 'sent').length;
    const failed = accountContacts.filter(c => c.sendStatus === 'failed').length;
    const all = accountContacts.length;

    document.getElementById('all-count').textContent = all;
    document.getElementById('unsent-count').textContent = unsent;
    document.getElementById('sent-count').textContent = sent;
    document.getElementById('failed-count').textContent = failed;
  }

  showContactsLoading() {
    const tbody = document.querySelector('#contacts-list-table tbody');
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
          <h3>Google Sheets'ten veriler Uploadniyor...</h3>
          <p style="color: #666;">Please wait...</p>
        </td>
      </tr>
    `;
  }

  hideContactsLoading() {
    // Loading mesajı renderContactsList tarafından temizlenecek
  }
}

// Initialize app
const app = new ZeptoemailsDomainManager();




