# Estratégia de Backup · Firestore

> **Estado:** infra-estrutura de código pronta (T-34 do Bloco 3).
> **Activação** (bucket + agendamento) é tarefa do Silva — ver §3.

---

## 1. Quando correr

- **Antes de migrações destrutivas** (rules que alargam delete, scripts de
  bulk update, migração de campos).
- **Antes de deploys grandes de functions** que toquem em estrutura de
  documentos (não para deploys triviais de templates).
- **Semanalmente** como cinto de segurança, idealmente automatizado.

---

## 2. Backup manual

```bash
bash scripts/backup-firestore.sh
```

Variáveis opcionais:

```bash
CPC_PROJECT_ID=cpc-projeto-staging \
CPC_BACKUP_BUCKET=gs://cpc-projeto-staging-backups \
  bash scripts/backup-firestore.sh
```

O script grava em `gs://<bucket>/<timestamp>/`. Estrutura:

```
gs://cpc-projeto-app-backups/
├── 20260615-093012/        # 2026-06-15 09:30:12 UTC
│   ├── 20260615-093012.overall_export_metadata
│   └── all_namespaces/all_kinds/output-0
└── ...
```

---

## 3. Pré-requisitos (Silva, uma vez)

### 3.1 Criar bucket GCS

```bash
gsutil mb -l europe-west1 -b on gs://cpc-projeto-app-backups
```

> Região `europe-west1` (Bélgica) ou `europe-west3` (Frankfurt) — mantém os
> dados na UE para compliance LGPD/RGPD. **Não criar em `us-central1`.**

### 3.2 Permissões

A service account do Firestore Export precisa do role `Storage Admin` (ou
mais restrito: `roles/storage.objectAdmin`) no bucket.

Encontrar a SA:
```bash
gcloud projects describe cpc-projeto-app \
  --format='value(projectNumber)'
# → resposta: NNNNN
# SA: NNNNN-compute@developer.gserviceaccount.com
```

Conceder:
```bash
gsutil iam ch \
  serviceAccount:NNNNN-compute@developer.gserviceaccount.com:roles/storage.admin \
  gs://cpc-projeto-app-backups
```

### 3.3 Lifecycle (retenção de 30 dias)

Criar `lifecycle.json` localmente:
```json
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "age": 30 } }
  ]
}
```

Aplicar:
```bash
gsutil lifecycle set lifecycle.json gs://cpc-projeto-app-backups
gsutil lifecycle get gs://cpc-projeto-app-backups   # confirmar
```

### 3.4 Confirmar com um backup manual

```bash
bash scripts/backup-firestore.sh
gsutil ls -lh gs://cpc-projeto-app-backups/
```

---

## 4. Backup agendado (recomendado depois do manual estar OK)

Duas opções, igualmente válidas:

### Opção A — Cloud Scheduler invocando uma Cloud Function

Estrutura limpa, fica versionada no repo. Custa um job de Cloud Scheduler
(temos 1/3 livres se contar com `scheduledReminders` + `retentionCleanup`).

Esboço:
```typescript
// functions/src/scheduledFirestoreBackup.ts
export const scheduledFirestoreBackup = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Europe/Lisbon' },  // 02:00 diário
  async () => {
    // gcloud firestore export via REST API
  }
);
```

Não implementado ainda — adicionar quando a operação estabilizar.

### Opção B — gcloud Scheduler job fora do código

Sem custo de quota Spark; vive fora do repo:

```bash
gcloud scheduler jobs create http firestore-daily-backup \
  --location=europe-west1 \
  --schedule='0 2 * * *' \
  --time-zone='Europe/Lisbon' \
  --uri="https://firestore.googleapis.com/v1/projects/cpc-projeto-app/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email=NNNNN-compute@developer.gserviceaccount.com \
  --message-body='{"outputUriPrefix":"gs://cpc-projeto-app-backups"}'
```

**Preferência atual:** opção B, até decidir que vale a pena ter no código.

---

## 5. Restauro

> **AVISO:** import **sobrescreve** entradas existentes. Testar em staging
> antes; em produção, considerar fazer um backup IMEDIATAMENTE antes.

Restauro completo:
```bash
gcloud firestore import gs://cpc-projeto-app-backups/20260615-093012 \
  --project=cpc-projeto-app
```

Restauro selectivo por collection (mais seguro):
```bash
gcloud firestore import gs://cpc-projeto-app-backups/20260615-093012 \
  --project=cpc-projeto-app \
  --collection-ids='users,profiles,triage'
```

---

## 6. Estado de execução

- [ ] Bucket `gs://cpc-projeto-app-backups` criado (Silva)
- [ ] IAM: SA com `roles/storage.admin` no bucket (Silva)
- [ ] Lifecycle 30 dias aplicado (Silva)
- [ ] Backup manual testado pelo menos uma vez (Silva)
- [ ] Agendamento ativo (Opção B do Cloud Scheduler) (Silva)
- [ ] Restauro testado em staging quando staging existir (Silva)

---

## 7. Custos esperados (ordem de grandeza)

- Firestore export: ~$0.18/GiB no `read` (cobre todos os docs lidos).
- Storage no bucket: ~$0.020/GiB/mês na região europeia (depende do tier).
- Em backups diários com retenção 30 dias, mantém-se ~30x o tamanho actual da DB.
- Para o tamanho actual da CPC (<1GB), custo mensal estimado: **abaixo de €1**.

---

## 8. Notas

- **Não confundir** com backup de **Authentication users**. Esse é separado:
  `firebase auth:export users.json --project cpc-projeto-app`. Considerar
  fazer também em momentos críticos.
- **Não confundir** com backup de **Storage**. Storage tem versioning
  próprio que se pode ligar no bucket — fora do scope desta doc.
- O export do Firestore é **consistente** (snapshot-in-time), mesmo em DBs
  sob carga; não precisa de janela de manutenção.
