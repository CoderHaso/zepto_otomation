# 🚀 Build Instructions

## Ön Gereksinimler

1. **Node.js** yüklü olmalı (v16 veya üzeri)
2. **npm** yüklü olmalı

## 📦 Kurulum

```bash
# Bağımlılıkları yükle
npm install
```

## 🔨 Build Komutları

### Windows için Build

```bash
npm run build:win
```

Bu komut şunları oluşturur:
- `dist/ZeptoMail Domain Manager Setup.exe` - Installer
- `dist/ZeptoMail Domain Manager.exe` - Portable versiyon

### Mac için Build

```bash
npm run build:mac
```

Bu komut şunları oluşturur:
- `dist/ZeptoMail Domain Manager.dmg` - DMG installer
- `dist/ZeptoMail Domain Manager-mac.zip` - ZIP arşivi

### Her İki Platform için Build

```bash
npm run build
```

## 📁 Build Çıktıları

Tüm build dosyaları `dist/` klasöründe oluşturulur:

```
dist/
├── ZeptoMail Domain Manager Setup.exe    (Windows Installer)
├── ZeptoMail Domain Manager.exe          (Windows Portable)
├── ZeptoMail Domain Manager.dmg          (Mac DMG)
└── ZeptoMail Domain Manager-mac.zip      (Mac ZIP)
```

## 🎯 Dağıtım

### Windows Kullanıcıları İçin

**Seçenek 1: Installer (Önerilen)**
1. `ZeptoMail Domain Manager Setup.exe` dosyasını paylaş
2. Kullanıcı çift tıklayarak kurulum yapacak
3. Masaüstü ve Başlat Menüsü kısayolu otomatik oluşturulur

**Seçenek 2: Portable**
1. `ZeptoMail Domain Manager.exe` dosyasını paylaş
2. Kullanıcı doğrudan çalıştırabilir (kurulum gerektirmez)

### Mac Kullanıcıları İçin

**Seçenek 1: DMG (Önerilen)**
1. `ZeptoMail Domain Manager.dmg` dosyasını paylaş
2. Kullanıcı DMG'yi açıp uygulamayı Applications klasörüne sürükleyecek

**Seçenek 2: ZIP**
1. `ZeptoMail Domain Manager-mac.zip` dosyasını paylaş
2. Kullanıcı ZIP'i açıp uygulamayı çalıştırabilir

## 📝 Notlar

### İlk Çalıştırma

Uygulama ilk çalıştırıldığında:
1. `data/` klasörü otomatik oluşturulur
2. Boş JSON dosyaları oluşturulur
3. Kullanıcı domain ekleyerek başlayabilir

### Veri Yedekleme

Kullanıcıların verilerini yedeklemeleri için:
- Windows: `%APPDATA%/zepto_otomation/data/`
- Mac: `~/Library/Application Support/zepto_otomation/data/`

### Google Sheets Entegrasyonu

Her kullanıcının kendi Google Apps Script URL'sini ayarlaması gerekir:
1. `src/api/googleSheets.js` dosyasındaki `GOOGLE_SCRIPT_URL` değişkenini güncelleyin
2. Veya uygulama içinde ayarlar bölümünden yapılandırın

## 🐛 Sorun Giderme

### Build Hatası: "electron-builder not found"

```bash
npm install --save-dev electron-builder
```

### Build Hatası: "Icon not found"

Icon dosyası opsiyoneldir. Yoksa otomatik varsayılan icon kullanılır.

### Mac'te "App is damaged" Hatası

```bash
xattr -cr "/Applications/ZeptoMail Domain Manager.app"
```

### Windows'ta Antivirus Uyarısı

Bazı antivirüsler yeni uygulamaları engelleyebilir. Güvenli olduğunu onaylayın.

## 📊 Build Boyutları

- Windows Installer: ~150-200 MB
- Windows Portable: ~150-200 MB
- Mac DMG: ~150-200 MB
- Mac ZIP: ~150-200 MB

## 🔄 Güncelleme

Yeni versiyon build etmek için:

1. `package.json` içinde version'ı artır:
   ```json
   "version": "1.1.0"
   ```

2. Build komutunu çalıştır:
   ```bash
   npm run build:win
   # veya
   npm run build:mac
   ```

## 📧 Destek

Build ile ilgili sorunlar için:
- GitHub Issues açın
- Veya ekip liderinize ulaşın

---

**İyi kullanımlar!** 🚀
