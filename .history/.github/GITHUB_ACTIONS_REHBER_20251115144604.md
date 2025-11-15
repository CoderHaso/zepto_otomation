# 🤖 GitHub Actions Otomatik Build Rehberi

Bu proje GitHub Actions ile otomatik build sistemi kullanıyor. Her commit'te Mac, Windows ve Linux için otomatik build alınır.

---

## 📋 Nasıl Çalışır?

### Otomatik Build Tetikleyicileri:

1. **Main/Master branch'e push:**
   ```bash
   git push origin main
   ```
   → Otomatik build başlar ama release oluşturmaz

2. **Tag ile push (Release için):**
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
   → Otomatik build + GitHub Release oluşturur

3. **Manuel tetikleme:**
   - GitHub → Actions → Build & Release → Run workflow

---

## 🚀 Release Nasıl Oluşturulur?

### Adım 1: Version Güncelle

`package.json` dosyasında version'ı güncelle:

```json
{
  "name": "yazar-iletisim-paneli",
  "version": "1.0.1",  ← Burası
  ...
}
```

### Adım 2: Değişiklikleri Commit Et

```bash
git add .
git commit -m "Release v1.0.1: Yeni özellikler ve düzeltmeler"
git push origin main
```

### Adım 3: Tag Oluştur ve Push Et

```bash
# Tag oluştur
git tag v1.0.1

# Tag'i GitHub'a gönder (otomatik build başlar!)
git push origin v1.0.1
```

### Adım 4: Bekle ve İndir

1. GitHub → Actions sekmesine git
2. Build tamamlanmasını bekle (~10-15 dakika)
3. Releases sekmesine git
4. v1.0.1 release'ini aç
5. Dosyaları indir:
   - ✅ **macOS-intel.zip** (Intel Mac)
   - ✅ **macOS-arm.zip** (M1/M2/M3 Mac)
   - ✅ **windows-setup.exe** (Windows Installer)
   - ✅ **windows-portable.exe** (Windows Portable)
   - ✅ **linux.AppImage** (Linux AppImage)
   - ✅ **linux.deb** (Debian/Ubuntu)

---

## 📦 Build Çıktıları

### macOS:
```
ZeptoMail Domain Manager-1.0.1-mac-x64.zip      (Intel Mac)
ZeptoMail Domain Manager-1.0.1-mac-arm64.zip    (Apple Silicon)
```

### Windows:
```
ZeptoMail Domain Manager Setup 1.0.1.exe        (Installer)
ZeptoMail Domain Manager 1.0.1.exe              (Portable)
```

### Linux:
```
ZeptoMail Domain Manager-1.0.1.AppImage         (Tüm distro'lar)
zeptomail-domain-manager_1.0.1_amd64.deb        (Debian/Ubuntu)
```

---

## 🔍 Build Durumunu Kontrol Etme

### GitHub'da:

1. **Actions sekmesi:** Build sürecini canlı izle
2. **Releases sekmesi:** Tamamlanan release'leri gör

### Badge Ekle (Opsiyonel):

README.md'ye ekle:

```markdown
![Build Status](https://github.com/KULLANICI_ADI/REPO_ADI/actions/workflows/build.yml/badge.svg)
```

---

## ⚠️ Sorun Giderme

### Build Başlamıyor:
- Actions sekmesinde "workflow dispatch" ile manuel tetikle
- GitHub hesabında Actions'ın aktif olduğundan emin ol

### Release Oluşmuyor:
- Tag'in `v` ile başladığından emin ol: `v1.0.1` ✅, `1.0.1` ❌
- Tag'i push ettiğinden emin ol: `git push origin v1.0.1`

### Mac Build Hatası:
- Normal! Code signing gerektirmez (CSC_IDENTITY_AUTO_DISCOVERY=false)
- Eğer imzalı build istersen, Apple Developer hesabı gerekli

---

## 💡 İpuçları

### 1. Pre-release Yap
```bash
git tag v1.0.1-beta
git push origin v1.0.1-beta
```
→ Beta release oluşturur

### 2. Draft Release
Workflow dosyasında `draft: true` yap, önce kontrol et sonra yayınla

### 3. Otomatik Changelog
`generate_release_notes: true` ile otomatik changelog oluşur

---

## 🎯 Hızlı Komutlar

```bash
# Yeni release için:
npm version patch       # 1.0.0 → 1.0.1
git push origin main
git push origin --tags

# Veya manuel:
git tag v1.0.1
git push origin v1.0.1

# Tag silme (hatalı tag için):
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1
```

---

## 📊 GitHub Actions Maliyeti

✅ **ÜCRETSİZ** GitHub Free plan için:
- Public repo: Sınırsız
- Private repo: 2000 dakika/ay

Build süresi: ~10-15 dakika
→ Ayda ~130-200 build yapabilirsin!

---

## 🔐 Güvenlik

GitHub Actions otomatik olarak şunları yapar:
- ✅ Bağımlılıkları cache'ler (hızlı build)
- ✅ node_modules güvenli şekilde yüklenir
- ✅ API keyleri asla build'e dahil edilmez (runtime'da kullanıcı girer)
- ✅ Artifacts 90 gün saklanır

---

**Hazır! 🎉**

Artık her tag'de otomatik olarak Mac, Windows, Linux build'leri GitHub Releases'te hazır!

