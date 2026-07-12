# İSG Panel İSG-KATİP Senkronizasyon Eklentisi

Bu klasör Chrome Manifest V3 tabanlı ilk İSG-KATİP senkronizasyon eklentisidir.

## Amaç

- Kullanıcı İSG-KATİP'e kendi tarayıcısında normal şekilde giriş yapar.
- Eklenti açık İSG-KATİP sayfasındaki firma ve atama metinlerini okur.
- SGK sicil numarasına göre kayıtları İSG Panel API'ye gönderir.
- Şifre, e-Devlet bilgisi veya çerez saklanmaz.

## Okunan İlk Alanlar

- SGK sicil numarası
- Firma adı
- Görev türü: uzman, hekim, DSP
- İSG-KATİP durumu
- Personel TC kimlik numarası
- Çalışan sayısı
- Tehlike sınıfı
- Çalışma/hizmet süresi
- Sözleşme/atama numarası

## Kurulum

1. Chrome'da `chrome://extensions` sayfasını açın.
2. Sağ üstten `Geliştirici modu`nu açın.
3. `Paketlenmemiş öğe yükle` butonuna basın.
4. Bu klasörü seçin: `extensions/isg-katip-sync`.
5. İSG-KATİP sayfasında oturum açın.
6. Eklenti ikonuna basıp `Açık Sayfayı Senkronize Et` butonunu kullanın.

## Not

Bu sürüm senkronizasyon temelidir. İSG-KATİP ekranlarının gerçek HTML yapısı görüldükçe
`content.js` içindeki okuma kuralları daha hassas hale getirilecektir.
