# 📧 ZeptoMail Çoklu Hesap Yönetimi - Kullanım Rehberi

## 🎯 Sistem Özeti

Bu uygulama **birden fazla domain ve hesap için** ZeptoMail üzerinden toplu mail gönderimi yapmanızı sağlar.

### Temel Özellikler:
- ✅ **Çoklu Hesap Yönetimi** - Farklı domain'ler için farklı hesaplar
- ✅ **Template Key ile Şablon Yönetimi** - Manuel merge field mapping
- ✅ **8 Sütunlu Kişi Sistemi** - 4 zorunlu + 4 opsiyonel
- ✅ **Akıllı Mail Gönderimi** - Seçili kişilere toplu gönderim
- ✅ **OAuth Gerektirmez** - Sadece Send Token yeterli

---

## 🚀 Hızlı Başlangıç

### 1️⃣ Hesap Ekle

**Hesaplar** sekmesinde **"+ Yeni Hesap"** butonuna tıklayın ve doldurun:

```
Hesap Adı: Readers House - Dan Peters
Domain: readershouse.co.uk
Send Mail Token: Zoho-enczapikey wSsVR60gr...
Mail Agent Alias: 617b792618165d06
Gönderen E-posta: dan.peters@readershouse.co.uk
Gönderen Adı: Dan Peters
```

Kaydedin ve **"✓ Aktif Et"** butonuna tıklayın.

### 2️⃣ Şablon Ekle (Template Key)

**Şablonlar** sekmesinde **"+ Yeni Şablon"** butonuna tıklayın:

```
Şablon Adı: Mülakat Daveti
Template Key: 2d6f.2377b7024864bedf.k1.3ece50f0-ae84-11f0-98e8-86f7e6aa0425.19a0704cb7f
```

**Merge Field Mapping:**

| ZeptoMail Field | Tür | Değer |
|----------------|-----|-------|
| Person_name | CSV Sütunu | full_name |
| email | CSV Sütunu | email |
| Interview_date | Sabit Yazı | 2025-10-25 |

**"+ Merge Field Ekle"** ile yeni field ekleyebilirsiniz.

### 3️⃣ Kişi Ekle

**İki yöntem:**

#### A) Excel/CSV Yükle

**Kişiler** sekmesinde **"📁 Excel/CSV Yükle"** butonuna tıklayın.

**Excel/CSV Format:**
```csv
name,surname,full_name,email,link,aaweb,web,facebook_resolved
Dan,Peters,Dan Peters,dan.peters@readershouse.co.uk,https://linkedin.com/dan,,https://dan.com,dan.peters.123
```

**Zorunlu Sütunlar:** `name`, `surname`, `full_name`, `email`  
**Opsiyonel Sütunlar:** `link`, `aaweb`, `web`, `facebook_resolved`

#### B) Manuel Ekle

**"+ Kişi Ekle"** butonuna tıklayıp formu doldurun.

### 4️⃣ Mail Gönder

**Gönderim** sekmesinde:

1. **Hızlı Test:** Aktif hesap, ilk şablon ve ilk kişi ile test maili gönderin
2. **Toplu Gönderim:** 
   - Kişiler sekmesinden kişileri seçin (checkbox)
   - Şablon seçin
   - "📤 Toplu Gönder" butonuna tıklayın

---

## 📊 Detaylı Kullanım

### Hesap Yönetimi

#### Çoklu Hesap Sistemi

Aynı domain'de farklı hesaplar:
```
✅ Readers House - Dan Peters (dan.peters@readershouse.co.uk)
   Readers House - Ben Alan (ben.alan@readershouse.co.uk)
```

**Aktif hesap:** Yeşil renkle işaretlenir, tüm işlemler bu hesap üzerinden yapılır.

**Hesap Değiştirme:** Başka bir hesabın **"✓ Aktif Et"** butonuna tıklayın.

#### Bir ZeptoMail API ile Birden Fazla Hesap

ZeptoMail, tek bir API key ile birden fazla sender email'e izin verir. Her hesap için ayrı:
- Send Mail Token
- Mail Agent Alias  
- Sender Email

gerekir.

### Şablon (Template) Yönetimi

#### Template Key Nereden Bulunur?

1. ZeptoMail → Mail Agent seçin
2. **Templates** sekmesi
3. Template'inizi seçin
4. Sayfanın üstünde **"Template Key"** göreceksiniz
5. Kopyalayın: `2d6f.2377b7024864bedf.k1.3ece50f0-ae84-11f0-98e8-86f7e6aa0425.19a0704cb7f`

#### Merge Field Mapping

ZeptoMail template'inizde `{Person_name}`, `{Interview_date}` gibi field'lar varsa bunları tanımlamalısınız.

**İki tür mapping:**

1. **CSV Sütunu:** Excel/CSV'deki bir sütundan değer al
   ```
   {Person_name} → full_name (CSV sütunu)
   ```

2. **Sabit Yazı:** Her gönderimde aynı değer
   ```
   {Interview_date} → 2025-10-25
   ```

**Örnek ZeptoMail Template:**
```html
<p>Merhaba {Person_name},</p>
<p>Mülakatınız {Interview_date} tarihinde olacaktır.</p>
<p>Pozisyon: {Position}</p>
```

**Mapping:**
- `{Person_name}` → CSV: `full_name`
- `{Interview_date}` → Sabit: `2025-10-25`
- `{Position}` → CSV: `name` (veya başka bir sütun)

### Kişi Yönetimi

#### 8 Sütun Sistemi

**Zorunlu (Mail gönderimi için):**
- `name` - Ad
- `surname` - Soyad  
- `full_name` - Tam ad (mail gönderiminde kullanılır)
- `email` - E-posta adresi

**Opsiyonel (Sadece görüntüleme için):**
- `link` - LinkedIn veya profil linki
- `aaweb` - AAWeb linki
- `web` - Kişisel web sitesi
- `facebook_resolved` - Facebook kullanıcı adı

**Önemli:** Eğer Excel'de opsiyonel sütunlar yoksa, kişi detaylarında görünmez!

#### Excel/CSV Format

**Minimum (Sadece zorunlu):**
```csv
name,surname,full_name,email
Dan,Peters,Dan Peters,dan.peters@readershouse.co.uk
Ben,Alan,Ben Alan,ben.alan@readershouse.co.uk
```

**Tam (Tüm sütunlar):**
```csv
name,surname,full_name,email,link,aaweb,web,facebook_resolved
Dan,Peters,Dan Peters,dan@example.com,https://linkedin.com/dan,https://aa.com/dan,https://dan.com,dan.123
```

#### Kişi Seçimi

**Toplu seçim:** Tablo başlığındaki checkbox ile tümünü seçin.

**Tekli seçim:** Her satırın checkbox'ını işaretleyin.

**Seçili kişi sayısı:** Gönderim sekmesinde görüntülenir.

### Mail Gönderimi

#### Nasıl Çalışır?

1. Aktif hesabın Send Token'ı kullanılır
2. Seçilen template'in merge field mapping'i uygulanır
3. Seçilen her kişi için:
   - CSV sütunlarından değerler alınır
   - Sabit değerler eklenir
   - ZeptoMail API'sine gönderilir

**API İsteği Örneği:**
```json
{
  "template_key": "2d6f.2377b...",
  "from": {
    "address": "dan.peters@readershouse.co.uk",
    "name": "Dan Peters"
  },
  "to": [{
    "email_address": {
      "address": "contact@example.com",
      "name": "Contact Name"
    }
  }],
  "merge_info": {
    "Person_name": "Contact Name",
    "email": "contact@example.com",
    "Interview_date": "2025-10-25"
  }
}
```

#### Test vs Toplu Gönderim

**🚀 Test Gönder:**
- Aktif hesabın ilk template'i
- Aktif hesabın ilk kişisi
- Tek mail gönderir
- Hızlı test için idealdir

**📤 Toplu Gönder:**
- Seçilen template
- Seçilen kişiler (checkbox ile)
- Çoklu mail gönderir
- Gerçek gönderim için kullanılır

### Raporlar

#### İstatistikler

- **Toplam Gönderim:** Kaç mail gönderildi
- **Başarılı:** Kaç tanesi başarılı
- **Başarısız:** Kaç tanesi başarısız

#### Gönderim Geçmişi

Her gönderim için:
- Tarih
- Hangi hesap
- Hangi şablon
- Kaç alıcı
- Başarı/başarısızlık durumu

---

## 🔧 Teknik Detaylar

### Veri Yapısı

**accounts.json:**
```json
{
  "id": "1",
  "name": "Readers House - Dan Peters",
  "domain": "readershouse.co.uk",
  "apiKey": "Zoho-enczapikey ...",
  "mailAgent": "617b792618165d06",
  "senderEmail": "dan.peters@readershouse.co.uk",
  "senderName": "Dan Peters",
  "active": true
}
```

**templates.json:**
```json
{
  "id": "1",
  "name": "Mülakat Daveti",
  "accountId": "1",
  "templateKey": "2d6f.2377b...",
  "mergeFieldMapping": {
    "Person_name": { "type": "column", "value": "full_name" },
    "Interview_date": { "type": "text", "value": "2025-10-25" }
  }
}
```

**contacts.json:**
```json
{
  "id": "1",
  "accountId": "1",
  "name": "Dan",
  "surname": "Peters",
  "full_name": "Dan Peters",
  "email": "dan@example.com",
  "link": "https://...",
  "aaweb": "",
  "web": "",
  "facebook_resolved": ""
}
```

### API Endpoints

**Accounts:**
- `GET /api/accounts` - Tüm hesapları listele
- `POST /api/accounts` - Yeni hesap ekle
- `PUT /api/accounts/:id` - Hesap güncelle
- `DELETE /api/accounts/:id` - Hesap sil
- `POST /api/accounts/:id/activate` - Hesabı aktif et

**Templates:**
- `GET /api/templates?accountId=X` - Hesabın template'lerini listele
- `POST /api/templates` - Yeni template ekle
- `PUT /api/templates/:id` - Template güncelle
- `DELETE /api/templates/:id` - Template sil

**Contacts:**
- `GET /api/contacts?accountId=X` - Hesabın kişilerini listele
- `POST /api/contacts` - Yeni kişi ekle
- `POST /api/contacts/import-csv` - CSV yükle
- `DELETE /api/contacts/:id` - Kişi sil

**Send:**
- `POST /api/zeptomail/test-send` - Test mail gönder
- `POST /api/zeptomail/send-template` - Toplu mail gönder

**Reports:**
- `GET /api/reports?accountId=X` - Hesabın raporlarını listele

---

## ❓ Sık Sorulan Sorular

### Template key nereden bulunur?

ZeptoMail → Mail Agent → Templates → Template seç → Sayfanın üstünde "Template Key"

### OAuth token gerekli mi?

**Hayır!** Bu sistem sadece Send Token ile çalışır. Template'leri ZeptoMail panelinde oluşturursunuz, uygulamaya sadece template key'i girersiniz.

### Bir API ile birden fazla hesap kullanabilir miyim?

**Evet!** Aynı ZeptoMail hesabında birden fazla sender email varsa, her biri için ayrı hesap oluşturabilirsiniz.

### Merge field'ları nasıl öğrenirim?

ZeptoMail panelinde template'inizi açın ve HTML'e bakın. `{...}` içindeki tüm field'lar merge field'dır.

### CSV'de opsiyonel sütunlar olmasa olur mu?

**Evet!** Sadece 4 zorunlu sütun (name, surname, full_name, email) yeterli. Diğerleri boş olabilir veya CSV'de hiç bulunmayabilir.

### Farklı domain'ler için nasıl kullanırım?

Her domain için ayrı hesap ekleyin:
- `Domain A - Account 1`
- `Domain A - Account 2`
- `Domain B - Account 1`

Her hesabın kendi template'leri ve kişileri vardır.

---

## 🎉 İyi Kullanımlar!

Sorularınız için: GitHub Issues veya e-posta ile ulaşın.

