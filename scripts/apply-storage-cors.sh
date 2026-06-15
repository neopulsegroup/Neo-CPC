#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUCKET="${FIREBASE_STORAGE_BUCKET:-gs://cpc-projeto-app.firebasestorage.app}"

if ! command -v gsutil >/dev/null 2>&1; then
  echo "Erro: gsutil não encontrado. Instale o Google Cloud SDK:"
  echo "  https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "A aplicar CORS em ${BUCKET} ..."
gsutil cors set "${ROOT_DIR}/storage-cors.json" "${BUCKET}"
echo "CORS aplicado com sucesso."
gsutil cors get "${BUCKET}"
