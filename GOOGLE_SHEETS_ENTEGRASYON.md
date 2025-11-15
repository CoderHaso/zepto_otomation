# 📊 Google Sheets Entegrasyonu

## 🎯 Özellikler

### ✅ Otomatik Liste Yönetimi
- **Main List**: Tüm kişilerin merkezi listesi
- **Account Özel Listeler**: Her hesap için ayrı sayfa (email@domain.com)
- **Otomatik Senkronizasyon**: Gönderim sonrası durum güncellemesi
- **Cache Sistemi**: 5 dakika cache ile hızlı yükleme

### ✅ Akıllı Durum Takibi
- **Failed Sent** → Başarısız (Hard Bounce vb.)
- **Diğer durumlar** → Başarılı (Request, Details, Received, vb.)
- **Boş** → Gönderilmemiş
- **lastModified**: Otomatik tarih güncelleme

### ✅ Çift Yönlü Senkronizasyon
- Google Sheets → Program (Kişi yükleme)
- Program → Google Sheets (Durum güncelleme)
- Main List ve Account listesi otomatik senkron

---

## 🚀 Kurulum

### 1. Google Sheets Hazırlama

**Sheet Adı:** `Zoho Mail Manager Lists`

**Main List Sayfası:**
```
Sütunlar: Authors Name | Authors Email | Is Situation | Pack | lastModified
```

**Account Sayfaları (her hesap için):**
```
Sayfa Adı: mailadi@domain.com (küçük harf)
Sütunlar: name | email | situation | pack | lastModified
```

**Örnek:**
- `dan.peters@readershouse.co.uk`
- `ben.alan@readershouse.co.uk`
- `hazel.ivy@mosaicdigest.com`
- `carly.preston@novelistpost.com`

### 2. Google Apps Script Kurulumu

1. Google Sheets'te **Uzantılar → Apps Script**
2. `appscript.gs` dosyasının içeriğini kopyala
3. **Dağıt → Yeni dağıtım**
4. Tür: **Web uygulaması**
5. Erişim: **Herkes**
6. URL'yi kopyala

### 3. Backend Yapılandırması

`src/api/googleSheets.js` dosyasında:

```javascript
const GOOGLE_SCRIPT_URL = 'BURAYA_KOPYALADIGINIZ_URL';
```

---

## 📖 Kullanım

### Kişileri Google Sheets'ten Yükleme

1. **Kişiler** sekmesine git
2. **Account seç** (örn: Dan Peters - RH)
3. **📊 Google Sheets'ten Yükle** butonuna tıkla
4. Sistem otomatik olarak:
   - Main List'i kontrol eder
   - Account sayfasından kişileri çeker
   - Mevcut olmayanları ekler
   - Durum bilgilerini aktarır

**Sonuç:**
```
✓ 15 yeni kişi eklendi (Toplam: 150)
```

### Gönderim Sonrası Otomatik Güncelleme

Gönderim yapıldığında sistem otomatik olarak:

1. **Account sayfasını** günceller:
   - Başarılı → `situation: Received`
   - Başarısız → `situation: Failed Sent`
   - `lastModified`: Güncel tarih

2. **Main List'i** günceller (opsiyonel)

### Cache Temizleme

Eğer Google Sheets'te manuel değişiklik yaptıysanız:

1. **🔄 Cache Temizle** butonuna tıkla
2. Bir sonraki yüklemede güncel veri gelir

---

## 🔧 Teknik Detaylar

### API Endpoints

**Kişi Yükleme:**
```javascript
POST /api/sheets/load-contacts
Body: { accountId: "123" }
Response: { success: true, added: 15, total: 150 }
```

**Gönderim Sonrası Güncelleme:**
```javascript
POST /api/sheets/update-after-send
Body: { results: [...] }
Response: { success: true }
```

**Cache Temizleme:**
```javascript
POST /api/sheets/clear-cache
Response: { success: true }
```

### Veri Akışı

```
┌─────────────────┐
│  Google Sheets  │
│   Main List     │
│  (Tüm kişiler)  │
└────────┬────────┘
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Account Sheet 1 │          │ Account Sheet 2 │
│ dan@rh.co.uk    │          │ ben@rh.co.uk    │
└────────┬────────┘          └────────┬────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   Program Cache  │
              │   (5 dakika)     │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Local Contacts  │
              │   (contacts.json)│
              └──────────────────┘
```

### Durum Mapping

| Google Sheets | Program | Açıklama |
|--------------|---------|----------|
| Failed Sent | failed | Hard bounce, invalid email |
| Request | sent | İstek gönderildi |
| Details | sent | Detaylar alındı |
| Questions | sent | Sorular soruldu |
| Received | sent | Alındı |
| Published | sent | Yayınlandı |
| Already Have | sent | Zaten var |
| Declined | sent | Reddedildi |
| (boş) | unsent | Henüz gönderilmedi |

### Cache Stratejisi

```javascript
// 5 dakika cache
const CACHE_DURATION = 5 * 60 * 1000;

// Her sheet için ayrı cache
sheetsCache = {
  'Main List': [...],
  'dan.peters@readershouse.co.uk': [...],
  'ben.alan@readershouse.co.uk': [...]
}

// Timestamp ile kontrol
cacheTimestamps = {
  'Main List': 1699123456789,
  'dan.peters@readershouse.co.uk': 1699123456789
}
```

---

## 🎨 UI Özellikleri

### Account Gösterimi

Tüm account listelerinde domain kısaltması:

```
Dan Peters - RH
Ben Alan - RH
Hazel Ivy - MD
Carly Preston - NP
```

**Domain Mapping:**
- `readershouse.co.uk` → **RH**
- `mosaicdigest.com` → **MD**
- `novelistpost.com` → **NP**
- Diğer → İlk 2 harf (büyük)

### Butonlar

**📊 Google Sheets'ten Yükle:**
- Yeşil buton
- Account seçili olmalı
- Yeni kişileri ekler

**🔄 Cache Temizle:**
- Gri buton
- Cache'i sıfırlar
- Sonraki yüklemede güncel veri

---

## ⚠️ Önemli Notlar

### Yeni Kişi Ekleme

Program üzerinden yeni kişi eklendiğinde:

1. **Main List kontrolü** yapılır
   - Varsa → Bilgileri alınır
   - Yoksa → Main List'e eklenir

2. **Account sheet kontrolü** yapılır
   - Varsa → Zaten var
   - Yoksa → Account sheet'e eklenir

3. **Local contacts** güncellenir

**Kritik:** Ekleme işlemi **EN ALTA** yapılır, üste yazma olmaz!

### Gönderim Sonrası

Her gönderim sonrası:

1. **Sadece ilgili satırlar** güncellenir
2. **lastModified** tarihi güncellenir
3. **Diğer satırlar** dokunulmaz
4. **Cache otomatik** temizlenir

### Performans

- **10,000+ satır** desteklenir
- **Cache** ile hızlı yükleme
- **Batch update** ile optimize
- **Sadece değişenler** güncellenir

---

## 🐛 Sorun Giderme

### "Sheet not found" Hatası

**Çözüm:**
1. Sheet adının doğru olduğundan emin olun
2. Email küçük harf olmalı: `dan@rh.co.uk`
3. Google Sheets'te sayfa oluşturun

### "No data to import" Hatası

**Çözüm:**
1. Account sheet'inde veri var mı kontrol edin
2. Email sütunu dolu mu kontrol edin
3. Header satırı doğru mu kontrol edin

### Cache Güncellenmiyor

**Çözüm:**
1. **🔄 Cache Temizle** butonuna tıklayın
2. Sayfayı yenileyin
3. Tekrar yükleme yapın

### Yavaş Yükleme

**Çözüm:**
1. Cache süresi dolmuş olabilir (5 dk)
2. İlk yükleme her zaman yavaştır
3. Sonraki yüklemeler cache'ten gelir

---

## 📊 Örnek Senaryo

### Senaryo: 200 Kişilik Liste Yönetimi

**Başlangıç:**
- Google Sheets'te 200 kişi var
- 3 account: Dan, Ben, Hazel
- Her account için ayrı sayfa

**Adım 1: İlk Yükleme**
```
1. Kişiler → Account seç: Dan Peters - RH
2. 📊 Google Sheets'ten Yükle
3. ✓ 200 yeni kişi eklendi
```

**Adım 2: Gönderim**
```
1. Gönderim → Dan Peters - RH seç
2. 50 kişi seç
3. 🚀 Hemen Gönder
4. ✓ 48 başarılı, 2 başarısız
```

**Adım 3: Otomatik Güncelleme**
```
Google Sheets'te:
- 48 kişi → situation: Received
- 2 kişi → situation: Failed Sent
- Tümü → lastModified: 2024-01-15 10:30:00
```

**Adım 4: Yeni Kişi Ekleme**
```
1. Kişiler → + Kişi Ekle
2. Account: Dan Peters - RH
3. Ad: John Doe
4. Email: john@example.com
5. Ekle

Sonuç:
- Main List'e eklendi (en alta)
- dan.peters@readershouse.co.uk sayfasına eklendi (en alta)
- Local contacts'a eklendi
```

---

## 🎉 Avantajlar

✅ **Merkezi Yönetim**: Tüm kişiler Google Sheets'te
✅ **Otomatik Senkron**: Gönderim sonrası durum güncelleme
✅ **Hızlı Erişim**: Cache ile 5 dakika hızlı yükleme
✅ **Çoklu Account**: Her account için ayrı liste
✅ **Durum Takibi**: Başarılı/başarısız/gönderilmemiş
✅ **Tarih Takibi**: lastModified ile değişiklik takibi
✅ **Performans**: 10,000+ satır desteklenir
✅ **Güvenli**: Sadece değişenler güncellenir

---

## 📞 Destek

Sorularınız için GitHub Issues veya e-posta ile ulaşın.

**İyi kullanımlar!** 🚀
