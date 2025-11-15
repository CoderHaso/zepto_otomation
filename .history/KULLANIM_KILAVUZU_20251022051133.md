# 📧 Yazar İletişim Paneli - Kullanım Kılavuzu

## 🚀 Hızlı Başlangıç

### 1. ZeptoMail API Bilgilerini Alma

ZeptoMail paneline giriş yapın ve aşağıdaki bilgileri toplayın:

#### A) Send Mail Token (Zorunlu - Mail Göndermek için)
1. ZeptoMail → **Mail Agents** seçin
2. Kullanmak istediğiniz Mail Agent'a tıklayın
3. **SMTP / API** sekmesine gidin
4. **Send Mail Token 1** kısmındaki token'ı kopyalayın
   - Format: `Zoho-enczapikey wSsVR60gr...`

#### B) Mail Agent Alias (Zorunlu)
1. Aynı sayfada **Mail Agent Alias** değerini kopyalayın
   - Örnek: `617b792618165d06`

#### C) Doğrulanmış E-posta Adresi
1. **Domain / Sender Address** kısmındaki doğrulanmış e-posta adresinizi not edin
   - Örnek: `sender@readershouse.co.uk`

---

## ⚙️ Uygulama Ayarları

### Ayarlar Sekmesi
Uygulamayı başlattıktan sonra **Ayarlar** sekmesine gidin ve aşağıdaki bilgileri girin:

#### 🔑 API Ayarları

**Send Mail Token:**
- ZeptoMail'den kopyaladığınız `Zoho-enczapikey` ile başlayan token'ı girin
- Bu token mail göndermek için kullanılır

**OAuth Token (Opsiyonel):**
- Template senkronizasyonu için gereklidir
- Nasıl alınır aşağıda açıklanmıştır

**Mail Agent Alias:**
- ZeptoMail'den kopyaladığınız alias'ı girin
- "Test Et" butonuna tıklayarak bağlantıyı doğrulayın

#### 📧 Gönderici Bilgileri

**Gönderen E-posta:**
- ZeptoMail'de doğrulanmış domain adresinizi girin

**Gönderen Adı:**
- E-postalarda görünecek gönderici adını girin

#### 📁 Yerel Ayarlar

**Şablon Klasörü:**
- Yerel şablonların kaydedileceği klasörü seçin

---

## 📝 Template (Şablon) Yönetimi

### Seçenek 1: ZeptoMail Template'leri Kullanma (Tavsiye Edilen)

Bu yöntemde ZeptoMail panelinde zaten oluşturduğunuz template'leri kullanabilirsiniz.

**Adımlar:**

1. **ZeptoMail'de Template Oluşturun:**
   - ZeptoMail → Mail Agent → **Templates** sekmesi
   - Template oluşturun ve merge field'ları ekleyin:
     - `{Person_name}` - Kişi adı
     - `{email}` - E-posta adresi
     - `{Interview_date}` - Görüşme tarihi
     - İstediğiniz özel field'lar

2. **Template'i Senkronize Edin:**
   - Uygulamada **Şablonlar** sekmesine gidin
   - **🔄 ZeptoMail'den Senkronize Et** butonuna tıklayın
   - OAuth Token gerekliyse aşağıdaki "OAuth Token Alma" bölümüne bakın

3. **Template'leri Görüntüleyin:**
   - Senkronize edilen template'ler **yeşil "ZeptoMail" badge** ile gösterilir
   - Template Key de görüntülenir

### Seçenek 2: Yerel Template Oluşturma

OAuth Token alamıyorsanız veya basit şablonlar için:

1. **Yeni Şablon** butonuna tıklayın
2. Şablon adı, konu ve HTML içeriği girin
3. Merge field'ları kullanın: `{Person_name}`, `{Interview_date}`, vb.
4. Kaydedin

**Not:** Yerel template'ler gri "Yerel" badge ile gösterilir ve düzenlenebilir.

---

## 📋 Kişi Yönetimi

### Manuel Kişi Ekleme
1. **Kişiler** sekmesine gidin
2. **+ Kişi Ekle** butonuna tıklayın
3. Ad Soyad, E-posta ve Mülakat Tarihi bilgilerini girin
4. Kaydedin

### CSV ile Toplu Kişi Ekleme
1. **📁 CSV Yükle** butonuna tıklayın
2. CSV dosyanızı seçin

**CSV Format Örneği:**
```csv
name,email,Interview_date
Ahmet Yılmaz,ahmet@example.com,2025-10-25
Ayşe Demir,ayse@example.com,2025-10-26
```

**Önemli:**
- CSV'nin ilk satırı başlık olmalı (name, email, vb.)
- Başlık isimleri template'lerde merge field olarak kullanılabilir
- Örnek: CSV'de `Interview_date` varsa template'de `{Interview_date}` kullanabilirsiniz

---

## 📤 Toplu Mail Gönderimi

1. **Gönderim** sekmesine gidin
2. **Şablon Seç:** Kullanmak istediğiniz template'i seçin
3. **Kişi Listesi:** "Tüm Kişiler" seçili
4. **📤 Gönder** butonuna tıklayın

### Template Türlerine Göre Gönderim

**ZeptoMail Template:**
- Yeşil badge'li template seçerseniz
- ZeptoMail API'nin template endpoint'i kullanılır
- Merge field'lar otomatik olarak doldurulur

**Yerel Template:**
- Gri badge'li template seçerseniz
- HTML içerik yerel olarak işlenir
- Merge field'lar regex ile değiştirilir

---

## 🔐 OAuth Token Alma (Template Senkronizasyonu için)

OAuth Token, ZeptoMail'deki template'leri listelemek ve senkronize etmek için gereklidir.

### Adımlar:

1. **Zoho Developer Console'a Gidin:**
   - [https://api-console.zoho.com/](https://api-console.zoho.com/)

2. **Self Client Oluşturun:**
   - "Add Client" → "Self Client" seçin
   - Client Name: "ZeptoMail App" (veya istediğiniz isim)
   - Scope: `ZeptoMail.MailTemplates.ALL`
   - Time Duration: 3 minutes (veya daha uzun)
   - Description: Template yönetimi için

3. **Token'ı Kopyalayın:**
   - "Create" dedikten sonra size bir token verilecek
   - Bu token'ı kopyalayın

4. **Uygulamaya Ekleyin:**
   - Ayarlar → OAuth Token alanına yapıştırın
   - Kaydedin

5. **Template'leri Senkronize Edin:**
   - Şablonlar → 🔄 ZeptoMail'den Senkronize Et

**Not:** OAuth token'ların süresi dolar. Süre dolduysa yeni token oluşturmanız gerekir.

---

## 📊 Raporlar

**Raporlar** sekmesinde:
- Toplam gönderim sayısı
- Başarılı gönderimler
- Başarısız gönderimler
- Gönderim geçmişi (tarih, şablon, alıcı sayısı)

---

## ❓ Sık Sorulan Sorular

### "Invalid Authorization token found" hatası alıyorum

**Çözüm:**
- Send Mail Token'ı doğru kopyaladığınızdan emin olun
- Token `Zoho-enczapikey` ile başlamalı
- Mail Agent Alias doğru olmalı
- "Test Et" butonuyla kontrol edin

### Template senkronizasyonu çalışmıyor

**Çözüm:**
- OAuth Token gereklidir (Send Token ile çalışmaz)
- OAuth Token'ı Zoho Developer Console'dan alın
- Token'ın süresi dolmuş olabilir, yenisini oluşturun

### Mail gönderimi başarısız oluyor

**Kontrol Edin:**
1. Send Mail Token doğru mu?
2. Mail Agent Alias doğru mu?
3. Gönderici e-posta adresi doğrulanmış mı?
4. Kişi listesinde geçerli e-postalar var mı?
5. Template merge field'ları doğru mu?

### ZeptoMail ve Yerel Template farkı nedir?

**ZeptoMail Template:**
- ✅ ZeptoMail panelinde oluşturulur
- ✅ ZeptoMail'in template API'si kullanılır
- ✅ Merge field'lar ZeptoMail tarafından işlenir
- ✅ Daha güvenilir
- ❌ OAuth Token gerektirir (senkronizasyon için)

**Yerel Template:**
- ✅ Uygulama içinde oluşturulur
- ✅ OAuth Token gerekmez
- ✅ Hızlı oluşturma
- ❌ Manuel merge field işleme

---

## 🛠️ Teknik Detaylar

### API Endpoint'leri

**Mail Gönderme (Template-based):**
```
POST https://api.zeptomail.com/v1.1/email/template
```

**Mail Gönderme (Regular):**
```
POST https://api.zeptomail.com/v1.1/email
```

**Template Listeleme:**
```
GET https://api.zeptomail.com/v1.1/mailagents/{mailAgent}/templates
```

### Merge Field'lar

Template'lerinizde kullanabileceğiniz merge field'lar:

- `{Person_name}` - Kişi adı (contacts'tan)
- `{email}` - E-posta adresi
- `{Interview_date}` - Mülakat tarihi
- CSV'deki tüm sütunlar merge field olarak kullanılabilir

Örnek:
```html
<p>Merhaba {Person_name},</p>
<p>Mülakatınız {Interview_date} tarihinde olacaktır.</p>
```

---

## 📞 Destek

Sorun yaşıyorsanız:
1. Console'u açın (Developer Tools - F12)
2. Hataları kontrol edin
3. ZeptoMail dokümantasyonuna bakın: [https://www.zoho.com/zeptomail/help/](https://www.zoho.com/zeptomail/help/)

---

**İyi Kullanımlar! 🎉**

