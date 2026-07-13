# İSG Panel İSG-KATİP Senkronizasyon Eklentisi

Bu eklenti Chrome Manifest V3 tabanlıdır. Açık İSG-KATİP oturumunda firma, sözleşme ve atama bilgilerini okur; İSG Panel ile güvenli şekilde eşleştirir.

## Kurulum

1. Chrome'da `chrome://extensions` sayfasını açın.
2. Sağ üstten `Geliştirici modu`nu açın.
3. `Paketlenmemiş öğe yükle` butonuna basın.
4. Paket klasörünü seçin: `isg-katip-eklenti-vX.X.X`.
5. İSG Panel'e giriş yapın.
6. Eklenti popup'ında `Panel Oturumunu Tanı` butonuna bir kez basın.
7. İSG-KATİP'te doğru hesapla giriş yapın ve `Süreç Yönetimi > İSG Hizmet Sözleşmeleri` sayfasını açık bırakın.

## Güncelleme

Yeni sürüm geldiğinde eski eklentiyi kaldırmadan şu adımları izleyin:

1. Yeni paket klasörünü bilgisayara çıkarın.
2. Chrome'da `chrome://extensions` sayfasını açın.
3. Eklenti kartındaki `Yenile` simgesine basın.
4. Eğer klasör yolu değiştiyse eski eklentiyi kaldırıp yeni klasörü `Paketlenmemiş öğe yükle` ile tekrar seçin.

## Paket Hazırlama

Ana proje klasöründeki `Eklenti_Paketle.bat` dosyasına çift tıklayın. Bu dosya `yayina-hazir` klasörü altında sürüme göre eklenti klasörü ve zip dosyası oluşturur.

Sürüm `manifest.json` içindeki `version` alanından gelir. Örneğin:

```json
"version": "0.5.1"
```

Sürümü değiştirdikten sonra paketleme dosyasını tekrar çalıştırın.

## Kullanım

Normal kullanımda eklenti popup'ını açmanız gerekmez. İSG-KATİP sekmesi açık ve oturum aktifken İSG Panel'den:

- `Senkronize Et`
- `Atama Sürecini Başlat`

butonları kullanılmalıdır.

Eklenti popup'ı sadece test, ilk bağlantı veya manuel kurtarma işlemleri içindir.
