# İSG Panel İSG-KATİP Senkronizasyon Eklentisi

Bu klasör ilk Chrome eklentisi iskeletidir.

## Amaç

- Kullanıcı İSG-KATİP'e kendi tarayıcısında normal şekilde giriş yapar.
- Eklenti açık İSG-KATİP sayfasındaki tablo satırlarını okur.
- SGK sicil numarasına göre kayıtları İSG Panel API'ye gönderir.
- Şifre, e-Devlet bilgisi veya çerez saklanmaz.

## Kurulum

1. Chrome'da `chrome://extensions` sayfasını açın.
2. Sağ üstten `Geliştirici modu`nu açın.
3. `Paketlenmemiş öğe yükle` butonuna basın.
4. Bu klasörü seçin: `extensions/isg-katip-sync`.

## Not

Bu ilk sürüm tablo okuma iskeletidir. İSG-KATİP ekranındaki gerçek kolon yapısı görüldükten sonra `content.js` içindeki satır okuma kuralları netleştirilecektir.
