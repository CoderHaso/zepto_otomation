# 📧 ZeptoMail Domain Manager - Kullanım Kılavuzu

## 🎯 Sistem Özeti

**Domain bazlı çoklu hesap yönetimi** sistemi. Tek bir ZeptoMail API'si ile birden fazla sender account'u yönetin, aynı template ile farklı imzalarla mail gönderin.

### Temel Konsept

```
Domain (readershouse.co.uk)
  ├── API Token (tek)
  ├── Accounts (Dan, Ben, Sarah...)
  ├── Templates (ortak - {account_name} otomatik)
  └── Contacts (ortak)
```

### Öne Çıkan Özellikler

✅ **Domain Bazlı Yapı** - Her domain için tek API, birden fazla sender  
✅ **Otomatik {account_name}** - Mail imzası otomatik değişir  
✅ **Kuyruk Sistemi** - Zamanlanmış gönderimler  
✅ **Her Account Test Edebilir** - 🧪 Test butonu  
✅ **Detaylı İstatistikler** - Domain ve account bazlı  
✅ **OAuth Gerektirmez** - Sadece Send Token  

---

## 🚀 Hızlı Başlangıç

### 1️⃣ Domain Ekle

**Ana Sayfa → + Domain Ekle**

```
Domain Adı: Readers House
Domain: readershouse.co.uk
Send Mail Token: Zoho-enczapikey wSsVR60gr...
Mail Agent Alias: 617b792618165d06
Host: api.zeptomail.com
```

**✓ Aktif Et** butonuna tıklayın.

### 2️⃣ Account Ekle (Gönderici Hesaplar)

Domain aktif olduktan sonra, aynı sayfada **+ Account Ekle**:

```
İsim: Dan Peters
E-posta: dan.peters@readershouse.co.uk
Görünen Ad: Dan Peters
```

Birden fazla account ekleyin:
- Dan Peters
- Ben Alan
- Sarah Smith

Her biri **kendi e-postasından** gönderim yapabilir!

### 3️⃣ Template Ekle

**+ Template Ekle**

```
Template Adı: Mülakat Daveti
Template Key: 2d6f.2377b7024864bedf.k1.3ece50f...
```

**Merge Field Mapping:**

| Field | Tür | Değer |
|-------|-----|-------|
| Person_name | CSV Sütunu | full_name |
| email | CSV Sütunu | email |

**💡 {account_name} otomatik eklenir!** Mail şablonunda:

```html
<p>Best Regards,</p>
<p>{account_name}</p>
```

Dan gönderirse → "Best Regards, Dan Peters"  
Ben gönderirse → "Best Regards, Ben Alan"

### 4️⃣ Kişi Ekle

**+ Kişi Ekle** veya **📁 CSV Yükle**

CSV Format:
```csv
name,surname,full_name,email
Test,User,Test User,test@example.com
```

### 5️⃣ Mail Gönder!

**Gönderim** sekmesine git:

1. Template seç
2. Ana sayfadan kişileri seç (checkbox)
3. Hangi account'lardan gönderileceğini işaretle
4. Seç:
   - **🚀 Hemen Gönder** - Anında
   - **⏰ Zamanla** - Belirli tarihte
   - **➕ Kuyruğa Ekle** - Kuyrukta beklet

---

## 📖 Detaylı Kullanım

### Domain Yönetimi

#### Tek API, Çoklu Sender

ZeptoMail'de **bir Mail Agent**'ın altında birden fazla verified sender email olabilir. Bu sistem bunu kullanır:

```
API Key: Tek (domain için)
Mail Agent: Tek (domain için)

Sender Emails:
  ✓ dan.peters@readershouse.co.uk
  ✓ ben.alan@readershouse.co.uk
  ✓ sarah.smith@readershouse.co.uk
```

#### Domain Değiştirme

Farklı domain'ler için:

1. Her domain için ayrı **Domain** ekleyin
2. İstediğiniz domain'i **✓ Aktif Et**
3. O domain'in accounts/templates/contacts gösterilir

### Account (Sender) Yönetimi

#### Her Account İçin Test

Her account'un yanında **🧪 Test** butonu var:

- İlk template ile
- İlk contact'a
- O account'tan test maili gönderir

#### Account Aktif/Pasif

**✓** / **○** butonuyla account'ları aktif/pasif yapın.

**Sadece aktif account'lar** gönderim sekmesinde görünür!

#### İstatistikler

Her account için:
- 📤 Toplam gönderim
- ✓ Başarılı
- ✗ Başarısız

### Template Yönetimi

#### {account_name} Tag'i

**Otomatik eklenir!** Template'inizde kullanın:

```html
<p>Dear {Person_name},</p>
<p>We would like to invite you...</p>

<p>Best Regards,</p>
<p><strong>{account_name}</strong></p>
<p>Readers House</p>
```

Sistem otomatik olarak gönderen account'un `displayName`'ini kullanır.

#### Merge Field Mapping

**Üç tür:**

1. **CSV Sütunu** - Contact'tan değer al
   ```
   {Person_name} → full_name (CSV)
   ```

2. **Sabit Yazı** - Her mailde aynı
   ```
   {Company} → "Readers House"
   ```

3. **AUTO** - Sistem tarafından
   ```
   {account_name} → (otomatik - gönderen adı)
   ```

### Kişi Yönetimi

#### 8 Sütun Sistemi

**Zorunlu:**
- name, surname, full_name, email

**Opsiyonel:**
- link, aaweb, web, facebook_resolved

#### Toplu Seçim

Ana sayfada tablo başlığındaki checkbox ile **tümünü seç**.

Veya tek tek checkbox'ları işaretle.

### Gönderim Stratejileri

#### 1. Hemen Gönder (🚀)

- Anında gönderir
- Seçili kişiler, seçili account'lara **otomatik dağıtılır**

Örnek:
- 100 kişi seçildi
- 2 account seçildi (Dan, Ben)
- Sistem: 50 kişiye Dan'dan, 50 kişiye Ben'den gönderir

#### 2. Zamanla (⏰)

- Tarih ve saat seç
- Kuyruğa eklenir
- Belirtilen zamanda **otomatik gönderilir**

#### 3. Kuyruğa Ekle (➕)

- Hemen kuyruğa ekler
- Manuel olarak kuyruktan işleyebilirsiniz

### Kuyruk Sistemi

#### Otomatik İşleme

**Her dakika** kontrol edilir:

- Zamanı gelen görevler **otomatik işlenir**
- Sonuç history'ye kaydedilir

#### Kuyruk Durumları

- **PENDING** - Bekliyor
- **PROCESSING** - İşleniyor
- **COMPLETED** - Tamamlandı
- **FAILED** - Başarısız
- **CANCELLED** - İptal edildi

#### İptal Etme

Sadece **PENDING** görevler iptal edilebilir.

### Geçmiş & Raporlar

#### Domain İstatistikleri

Ana sayfada domain kartında:
- Toplam gönderim
- Başarılı/başarısız

#### Geçmiş Sekmesi

Her gönderim için:
- Tarih
- Template
- Alıcı sayısı
- Başarı/başarısız dağılımı

**👁️ Detay** ile:
- Hangi account
- Hangi kişiye
- Durum (gönderildi/başarısız)
- Hata mesajı (varsa)

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Hızlı Test

1. Domain ve account'lar hazır
2. Account kartında **🧪 Test** butonuna tık
3. O account'tan test maili gönderildi! ✅

### Senaryo 2: Toplu Mail (Çoklu Sender)

1. 200 kişi CSV yükle
2. Template ekle (içinde {account_name} var)
3. Tüm kişileri seç
4. 4 account seç (Dan, Ben, Sarah, Mike)
5. **🚀 Hemen Gönder**
6. Sistem otomatik dağıtır: Her account 50 kişiye gönderir
7. Her mail farklı imzayla gider!

### Senaryo 3: Zamanlanmış Kampanya

1. Pazartesi için kampanya hazırla
2. Kişileri seç, template seç
3. **⏰ Zamanla** → Pazartesi 09:00
4. Kuyruğa eklendi
5. Pazartesi 09:00'da **otomatik gönderilir**!

### Senaryo 4: Farklı Domain'ler

```
Domain 1: readershouse.co.uk
  ├── Dan Peters
  ├── Ben Alan
  └── Template: Interview Invite

Domain 2: anothercompany.com
  ├── John Doe
  ├── Jane Smith
  └── Template: Product Launch
```

Her domain bağımsız yönetilir!

---

## 🔧 Teknik Detaylar

### Veri Yapısı

**domains.json:**
```json
{
  "id": "1",
  "name": "Readers House",
  "domain": "readershouse.co.uk",
  "apiKey": "Zoho-enczapikey ...",
  "mailAgent": "617b792618165d06",
  "active": true,
  "stats": {
    "totalSent": 1250,
    "successful": 1240,
    "failed": 10
  }
}
```

**accounts.json:**
```json
{
  "id": "1",
  "domainId": "1",
  "name": "Dan Peters",
  "email": "dan.peters@readershouse.co.uk",
  "displayName": "Dan Peters",
  "active": true,
  "stats": { ... }
}
```

**templates.json:**
```json
{
  "id": "1",
  "domainId": "1",
  "name": "Interview Invite",
  "templateKey": "2d6f...",
  "mergeFieldMapping": {
    "account_name": {
      "type": "auto",
      "value": "account_name"
    },
    "Person_name": {
      "type": "column",
      "value": "full_name"
    }
  }
}
```

### API Endpoints

**Domains:**
- `GET /api/domains` - Tüm domain'leri listele
- `POST /api/domains` - Yeni domain
- `PUT /api/domains/:id` - Güncelle
- `DELETE /api/domains/:id` - Sil
- `POST /api/domains/:id/activate` - Aktif et

**Accounts:**
- `GET /api/accounts?domainId=X` - Domain'in account'larını listele
- `POST /api/accounts` - Yeni account
- `POST /api/accounts/:id/toggle` - Aktif/pasif
- `POST /api/accounts/:id/test` - Test mail gönder

**Send & Queue:**
- `POST /api/send/immediate` - Hemen gönder
- `POST /api/queue/add` - Kuyruğa ekle
- `GET /api/queue` - Kuyruğu listele
- `DELETE /api/queue/:id` - İptal et

**History:**
- `GET /api/history?domainId=X` - Geçmişi listele

### Queue Processor

Backend'de **her dakika** otomatik çalışır:

```javascript
setInterval(async () => {
  // Zamanı gelen görevleri bul
  // İşle
  // History'ye kaydet
  // Stats'ı güncelle
}, 60000);
```

---

## ❓ Sık Sorulan Sorular

### Tek API ile birden fazla sender nasıl olur?

ZeptoMail'de **Mail Agent** altında birden fazla verified email olabilir. API key mail agent'a aittir, hangi sender'dan gönderileceği `from.address` ile belirlenir.

### {account_name} otomatik nasıl çalışır?

Backend, gönderim sırasında:
```javascript
if (mapping.type === 'auto' && mapping.value === 'account_name') {
  mergeInfo[fieldName] = account.displayName;
}
```

### Kuyruk otomatik işlenir mi?

**Evet!** Settings'te `autoProcessQueue: true` ise, backend her dakika kontrol eder ve zamanı gelen görevleri işler.

### Account'lar nasıl dağıtılır?

**Eşit dağıtım:**
```javascript
const contactsPerAccount = Math.ceil(totalContacts / accountCount);
```

Örnek: 100 kişi, 3 account → 34, 33, 33

### OAuth gerekli mi?

**Hayır!** Sistem sadece **Send Token** kullanır. Template'leri ZeptoMail panelinde oluşturun, template key'i buraya girin.

### Farklı domain'lerde farklı template'ler?

**Evet!** Her domain'in kendi templates, accounts, contacts'ı var. Domain değiştirince tamamen farklı set görürsünüz.

---

## 🎉 Gelişmiş İpuçları

### 1. A/B Testing

Aynı template, farklı account imzaları ile gönder, hangisi daha iyi sonuç verir gör!

### 2. Load Balancing

Çok sayıda mail mi? Birden fazla account seçerek yükü dağıt!

### 3. Zamanlanmış Kampanyalar

Haftalık newsletter? Pazartesi 09:00 için zamanla, otomatik gitsin!

### 4. Test-Test-Test

Her account için 🧪 Test butonu var - canlıya geçmeden hepsini test et!

### 5. İstatistik Takibi

Geçmiş sekmesinden hangi account'un başarı oranı daha yüksek gör!

---

## 🚨 Önemli Notlar

1. **Domain aktif et** - İlk yapılacak şey
2. **Account'ları verify et** - ZeptoMail'de verified olmalı
3. **Template key doğru** - Yanlış key = hata
4. **Merge field isimleri** - ZeptoMail'deki ile birebir aynı olmalı
5. **CSV encoding** - UTF-8 kullanın

---

## 📞 Destek

Sorularınız için GitHub Issues veya e-posta ile ulaşın.

**İyi kullanımlar!** 🚀

