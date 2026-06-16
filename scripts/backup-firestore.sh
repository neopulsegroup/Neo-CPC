#!/usr/bin/env bash
#
# T-34 (LGPD/RGPD safety net) — backup manual do Firestore para um bucket GCS.
#
# Uso:
#   bash scripts/backup-firestore.sh
#
# Pré-requisitos (uma vez, executados pelo Silva):
#   - gcloud CLI autenticado (`gcloud auth login`)
#   - Bucket criado: `gsutil mb -l europe-west1 gs://cpc-projeto-app-backups`
#   - Service account do Firestore Export com permissão writer no bucket
#   - Lifecycle do bucket configurado para apagar objectos > 30 dias
#
# Ver docs/BACKUP.md para o passo a passo completo.
#
set -euo pipefail

PROJECT_ID="${CPC_PROJECT_ID:-cpc-projeto-app}"
BUCKET="${CPC_BACKUP_BUCKET:-gs://cpc-projeto-app-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DESTINATION="${BUCKET}/${TIMESTAMP}"

echo "→ Backup do Firestore"
echo "  projeto:  ${PROJECT_ID}"
echo "  destino:  ${DESTINATION}"
echo ""

# Confirmar que o bucket existe; falha cedo se não.
if ! gsutil ls -b "${BUCKET}" >/dev/null 2>&1; then
  echo "✗ Bucket ${BUCKET} não existe ou sem permissões."
  echo "  Criar com: gsutil mb -l europe-west1 ${BUCKET}"
  exit 1
fi

gcloud firestore export "${DESTINATION}" \
  --project="${PROJECT_ID}"

echo ""
echo "✓ Backup concluído em ${DESTINATION}"
echo "  Listar: gsutil ls -lh ${DESTINATION}"
