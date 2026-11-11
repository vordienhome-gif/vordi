#!/usr/bin/env bash
# МойСклад'daki her şeyi sunucudaki veritabanına aktarır ve mutabakat raporu üretir.
#   bash import-moysklad.sh                (token sorulur, ekranda görünmez)
#   bash import-moysklad.sh --no-documents (yalnızca kartlar)
# Tekrar çalıştırmak güvenlidir: kopya oluşmaz.
set -euo pipefail
cd "$(dirname "$0")"
read -rsp "МойСклад token (yalnızca okuma yetkili kullanıcı): " TOKEN; echo
mkdir -p reports
REPORT="mutabakat-$(date +%F-%H%M).json"
docker compose run --rm --user root -e MOYSKLAD_TOKEN="$TOKEN" -v "$PWD/reports:/reports" api \
  node --import tsx src/cli/moysklad-import.ts --report="/reports/$REPORT" "$@"
echo "Mutabakat raporu: $(pwd)/reports/$REPORT"
