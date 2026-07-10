$DeployHost = "46.224.122.18"
$DeployUser = "root"

# Bu yol Windows'taki lokal klasor degil, SSH ile girdikten sonra sunucudaki proje klasoru olmali.
# Sunucuda proje klasorundeyken `pwd` komutu ile bulunur.
$RemoteProjectPath = "/var/www"

$RemoteDeployScript = "$RemoteProjectPath/deploy/deploy_server.sh"
