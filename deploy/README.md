# ISGPanel deploy kurulumu

Bu klasor, sifreyi Codex'e veya bir baskasina vermeden canli sunucuya yayin yapmak icin hazirlandi.

## 1. SSH anahtari olustur

Windows PowerShell'de:

```powershell
ssh-keygen -t ed25519 -C "isgpanel-deploy"
```

Varsayilan yolu kabul edebilirsin:

```text
C:\Users\DELL\.ssh\id_ed25519
```

Parola sorarsa bos birakabilirsin. Daha guvenli olsun dersen parola verilir ama her deployda sorabilir.

## 2. Public key'i sunucuya ekle

Public key'i goster:

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

Ekrandaki tek satiri kopyala.

Sonra mevcut yonteminle sunucuya gir:

```bash
ssh root@SUNUCU_IP
```

Sunucuda:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```

Kopyaladigin public key satirini dosyanin en altina yapistir, kaydet.

Yetkileri duzelt:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Artik Windows'tan sunucuya su komut sifresiz girebilmeli:

```powershell
ssh root@SUNUCU_IP
```

## 3. Config dosyasini olustur

`deploy_config.example.ps1` dosyasini `deploy_config.ps1` olarak kopyala ve icini doldur:

```powershell
Copy-Item .\deploy\deploy_config.example.ps1 .\deploy\deploy_config.ps1
```

Doldurulacak alanlar:

- `$DeployHost`: Sunucu IP veya domain
- `$DeployUser`: Genelde `root`
- `$RemoteProjectPath`: Sunucudaki proje klasoru
- `$RemoteDeployScript`: Sunucuda calisacak deploy scriptinin yolu

## 4. Sunucu deploy scriptini yerlestir

`deploy_server.sh` dosyasini sunucudaki proje klasorune koy:

```bash
nano /var/www/isgpanel/deploy_server.sh
chmod +x /var/www/isgpanel/deploy_server.sh
```

Klasor yolunu kendi sunucundaki proje yoluna gore degistir.

## 5. Tek komutla deploy

Windows PowerShell'de proje kokunden:

```powershell
.\deploy\deploy_from_windows.ps1
```

Bu komut sunucuya SSH ile baglanir ve `deploy_server.sh` dosyasini calistirir.

## GitHub kullanmadan deploy

Sunucudaki `/var/www` Git reposu degilse bu komutu kullan:

```powershell
.\deploy\deploy_upload_from_windows.ps1
```

Bu komut lokal kodu paketler, sunucuya gonderir, sunucuda paketi acar, build alir ve PM2 `server` process'ini restart eder.

Paket su dosyalari bilerek gondermez:

- `node_modules`
- `dist`
- `backend/node_modules`
- `backend/uploads`
- `backend/isgpanel.db`
- `.env`
- `backend/.env`
