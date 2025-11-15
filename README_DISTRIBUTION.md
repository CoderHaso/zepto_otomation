# 📧 ZeptoMail Domain Manager - Kullanım Kılavuzu

## 🎯 Kurulum

### Windows

1. **Installer ile (Önerilen)**
   - `ZeptoMail Domain Manager Setup.exe` dosyasını çalıştırın
   - Kurulum sihirbazını takip edin
   - Masaüstü kısayolu otomatik oluşturulur

2. **Portable Versiyon**
   - `ZeptoMail Domain Manager.exe` dosyasını istediğiniz klasöre kopyalayın
   - Çift tıklayarak çalıştırın

### Mac

1. **DMG ile (Önerilen)**
   - `ZeptoMail Domain Manager.dmg` dosyasını açın
   - Uygulamayı Applications klasörüne sürükleyin
   - Applications'dan çalıştırın

2. **ZIP ile**
   - `ZeptoMail Domain Manager-mac.zip` dosyasını açın
   - Uygulamayı istediğiniz yere kopyalayın
   - Çift tıklayarak çalıştırın

## 🚀 İlk Kullanım

### 1. Domain Ekleme

1. Uygulamayı açın
2. **Overview** sekmesinde **+ Domain Ekle** butonuna tıklayın
3. Bilgileri doldurun:
   - **Domain Name**: Şirket adı (örn: "Readers House")
   - **Domain**: Domain adı (örn: "readershouse.co.uk")
   - **Send Mail Token**: ZeptoMail API token'ınız
   - **Mail Agent Alias**: ZeptoMail mail agent ID'niz
4. **Add** butonuna tıklayın
5. **✓ Activate** butonuna tıklayarak aktif edin

### 2. Account Ekleme

1. Domain aktif olduktan sonra **+ Account Ekle** butonuna tıklayın
2. Bilgileri doldurun:
   - **Name**: Kişi adı (örn: "Dan Peters")
   - **Email**: Email adresi (örn: "dan.peters@readershouse.co.uk")
   - **Display Name**: Görünecek ad (örn: "Dan Peters")
3. **Add** butonuna tıklayın

### 3. Template Ekleme

1. **+ Template Ekle** butonuna tıklayın
2. ZeptoMail'den template key'inizi kopyalayın
3. Bilgileri doldurun:
   - **Template Key**: ZeptoMail template key
   - **Template Name**: Template adı
   - **Merge Fields**: Alanları eşleştirin
4. **Add** butonuna tıklayın

### 4. Kişi Ekleme

**Manuel Ekleme:**
1. **Contacts** sekmesine gidin
2. **+ Add Contact** butonuna tıklayın
3. Bilgileri doldurun ve kaydedin

**Toplu Ekleme (CSV/Excel):**
1. **Import CSV** butonuna tıklayın
2. Account seçin
3. CSV veya Excel dosyanızı seçin
4. **Upload** butonuna tıklayın

### 5. Email Gönderme

1. **Send** sekmesine gidin
2. **Account** seçin
3. **Template** seçin
4. Gönderilecek kişileri seçin:
   - Tümünü seç
   - İlk 10/15/20/50 seç
   - Manuel seç
5. **🚀 Send Now** butonuna tıklayın

## 📊 Özellikler

### ✅ Domain Yönetimi
- Çoklu domain desteği
- Domain bazlı istatistikler
- Kolay domain değiştirme

### ✅ Account Yönetimi
- Her domain için birden fazla sender account
- Account bazlı istatistikler
- Test email gönderme

### ✅ Template Yönetimi
- ZeptoMail template entegrasyonu
- Otomatik `{account_name}` tag
- Merge field mapping

### ✅ Kişi Yönetimi
- Manuel ve toplu ekleme
- Google Sheets entegrasyonu
- Filtreleme ve arama

### ✅ Gönderim
- Hemen gönder
- Zamanlanmış gönderim
- Kuyruk yönetimi

### ✅ Raporlama
- Gönderim geçmişi
- Detaylı sonuçlar
- İstatistikler

## 🔧 Google Sheets Entegrasyonu

### Kurulum

1. Google Sheets'te yeni bir spreadsheet oluşturun
2. **Extensions** → **Apps Script** menüsüne gidin
3. Aşağıdaki kodu yapıştırın:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === 'listSheets') {
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName())
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Diğer fonksiyonlar...
}
```

4. **Deploy** → **New deployment** → **Web app** seçin
5. **Execute as**: Me
6. **Who has access**: Anyone
7. **Deploy** butonuna tıklayın
8. URL'yi kopyalayın

### Uygulamada Ayarlama

1. `src/api/googleSheets.js` dosyasını açın
2. `GOOGLE_SCRIPT_URL` değişkenini güncelleyin:
   ```javascript
   const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL';
   ```

## 📝 Veri Yedekleme

Verileriniz şurada saklanır:

**Windows:**
```
C:\Users\[KULLANICI]\AppData\Roaming\zepto_otomation\data\
```

**Mac:**
```
~/Library/Application Support/zepto_otomation/data/
```

Bu klasörü düzenli olarak yedekleyin!

## 🐛 Sorun Giderme

### Uygulama Açılmıyor

**Windows:**
- Antivirüs yazılımınızı kontrol edin
- Uygulamayı yönetici olarak çalıştırın

**Mac:**
- Sistem Tercihleri → Güvenlik → "Yine de Aç" seçeneğini kullanın
- Terminal'de: `xattr -cr "/Applications/ZeptoMail Domain Manager.app"`

### Veriler Görünmüyor

1. Doğru domain'in aktif olduğundan emin olun
2. Google Sheets entegrasyonunu kontrol edin
3. İnternet bağlantınızı kontrol edin

### Email Gönderilmiyor

1. ZeptoMail API token'ınızı kontrol edin
2. Mail Agent Alias'ınızı kontrol edin
3. Sender email adresinin ZeptoMail'de verified olduğundan emin olun

### Tracking Bilgisi Yok

ZeptoMail webhook'unu ayarlamanız gerekir:
1. ZeptoMail Dashboard → Settings → Webhooks
2. Webhook URL: `http://YOUR_SERVER:3000/api/webhook/zeptomail`
3. Events: Email Opened, Link Clicked

## 📞 Destek

Sorunlarınız için:
- Ekip liderinize ulaşın
- GitHub Issues açın
- Dokümantasyonu kontrol edin

## 🔄 Güncelleme

Yeni versiyon çıktığında:
1. Eski versiyonu kapatın
2. Yeni installer'ı çalıştırın
3. Verileriniz korunur

---

**İyi kullanımlar!** 🚀
