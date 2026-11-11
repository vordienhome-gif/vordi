#!/usr/bin/env bash
# Yeni sürümü çeker, önce yedek alır, sonra uygulamayı yeniden derleyip başlatır.
set -euo pipefail
cd "$(dirname "$0")"
echo "==> Güncelleme öncesi yedek"
docker compose exec -T postgres pg_dump -U vordi -Fc vordi > "backups/vordi-pre-update-$(date +%F-%H%M).dump"
echo "==> Kod"
git pull --ff-only
echo "==> Derleme ve yeniden başlatma"
docker compose up -d --build
docker compose ps
