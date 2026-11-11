#!/usr/bin/env bash
# Vordi — temiz Ubuntu 24.04 sunucuya kurulum. root olarak çalıştırın:
#   bash install.sh
# Yaptıkları: sistem güncellemesi, otomatik güvenlik güncellemeleri, güvenlik duvarı (yalnızca 22/80/443),
# SSH kaba kuvvet koruması (fail2ban), Docker, rastgele şifrelerle .env, uygulamanın başlatılması.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "root olarak çalıştırın (sudo bash install.sh)"; exit 1; fi
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

echo "==> Sistem paketleri"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl git ufw fail2ban unattended-upgrades openssl
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Güvenlik duvarı"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
systemctl enable --now fail2ban

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if [ ! -f .env ]; then
  echo "==> Ayarlar"
  read -rp "Yönetim paneli alan adı [panel.vordien.ru]: " PANEL; PANEL=${PANEL:-panel.vordien.ru}
  read -rp "Depo uygulaması alan adı [depo.vordien.ru]: " DEPO; DEPO=${DEPO:-depo.vordien.ru}
  read -rp "Sertifika bildirimleri için e-posta: " EMAIL
  PG_PASS=$(openssl rand -hex 24)
  ADMIN_PASS=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
  umask 077
  cat > .env <<EOF
PANEL_DOMAIN=$PANEL
DEPO_DOMAIN=$DEPO
ACME_EMAIL=$EMAIL
POSTGRES_PASSWORD=$PG_PASS
INITIAL_ADMIN_PASSWORD=$ADMIN_PASS
EOF
  echo
  echo "******************************************************************"
  echo "  Yönetici girişi:  admin / $ADMIN_PASS"
  echo "  Bu şifreyi şimdi güvenli bir yere kaydedin ve ilk girişte değiştirin."
  echo "******************************************************************"
  echo
fi

mkdir -p backups
echo "==> Uygulama derleniyor ve başlatılıyor (birkaç dakika sürebilir)"
docker compose up -d --build
docker compose ps
echo
echo "Kurulum tamam. Alan adlarının DNS kayıtları bu sunucunun IP adresini göstermelidir;"
echo "HTTPS sertifikası ilk açılışta otomatik alınır."
