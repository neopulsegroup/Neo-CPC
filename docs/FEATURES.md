# CPC — Features validadas funcionalmente

> Registo do comportamento **real observado** em features que constam
> do escopo original e foram auditadas via inspeção de código + smoke
> test no dev server.
>
> Método: leitura completa dos caminhos de código + verificação de que
> o build sobe sem erros runtime. **Não foram executados testes E2E com
> backend real** porque não há credenciais de teste configuradas no
> ambiente local (`.env` vazio; `firebase.json` aponta para `cpc-projeto-app`
> em produção, sem conta de teste).
>
> Última actualização: 2026-05-26 — TASK-VAL Sprint 1.

---

## E5 — Empresa: editar ofertas (`status=done`)

**Arquivos:**
- `src/pages/dashboard/company/CreateJobPage.tsx`
- `src/pages/dashboard/company/MyJobsPage.tsx` (entrada para o edit)

**Fluxo confirmado por código:**

1. Em `MyJobsPage` (linha 604), cada oferta tem um link
   `to={`/dashboard/empresa/nova-oferta?edit=${job.id}`}` com `aria-label`
   `'company.offers.actions.edit'`.
2. `CreateJobPage` deteta o modo edit em dois `useEffect` (linhas 51–59):
   primeiro lê `searchParams.get('edit')` para setar `editJobId`; depois,
   quando `companyId && editJobId`, chama `fetchOfferForEdit`.
3. `fetchOfferForEdit` (linhas 137–204):
   - `getDocument('job_offers', jobId)` para puxar a oferta.
   - **Validação de ownership dupla**: aceita oferta se `offer.company_id === uid`
     **ou** se `companies/{company_id}.user_id === uid`. Cobre ofertas legadas
     onde o `company_id` referenciava um doc separado.
   - Sem ownership ⇒ toast de erro + `navigate('/dashboard/empresa/ofertas')`.
   - Armazena `existingStatus` (linha 181) e preenche o form com todos os
     campos da oferta. `work_mode` cai em `'on_site'` se vier valor inválido.

**Comportamento do status ao editar (linhas 270–281):**

```typescript
await updateDocument('job_offers', editJobId, {
  ...formFields,
  status: existingStatus ?? 'pending_review',
});
```

| Status da oferta antes do edit | Status depois do save | Re-moderação? |
|---|---|---|
| `pending_review` | `pending_review` (preservado) | n/a — continua na fila |
| `active` | `active` (preservado) | **NÃO** — edits ficam visíveis ao público sem nova aprovação |
| `rejected` | `rejected` (preservado) | NÃO — empresa pode editar mas a oferta continua oculta |

**⚠️ Decisão de produto a confirmar com CIBEA:**
> Edits substanciais a ofertas `active` **não disparam re-moderação**. Se uma
> empresa aprovada muda o título "Programador Junior" para "Limpeza nocturna",
> a alteração fica visível ao migrante imediatamente, sem o CPC reavaliar.
> A versão actual privilegia agilidade; alternativa seria forçar
> `status: 'pending_review'` em qualquer edit. Marcar D-flag se decisão
> contratual exigir mudança.

**Conclusão E5:** ✅ Funciona conforme escopo original. Pré-preenchimento OK.
Persistência via `updateDocument('job_offers', ...)`. Status preservado.
Validação de ownership presente. **Sem bugs.** Decisão de produto (re-moderação
em edits) precisa de confirmação.

---

## E9 — CPC: aprovar / rejeitar / moderar ofertas (`status=done`)

**Arquivos:**
- `src/pages/dashboard/CPCDashboard.tsx` (linhas 820–906)

**Fluxo confirmado por código:**

1. Carrega todas as ofertas via `queryDocuments('job_offers', ...)`,
   enriquece com `company_name` resolvido a partir de `companies/{id}`,
   ordena por `created_at` desc (linhas 820–849).
2. `statusFilter` permite filtrar `pending_review`, `active`, `rejected`
   ou `'all'` (linhas 891–906). Filtro adicional por busca de texto
   (título, localização, empresa).
3. `handleSetStatus(row, nextStatus)` (linhas 861–875):

```typescript
async function handleSetStatus(row: OfferRow, nextStatus: 'active' | 'rejected') {
  await updateDocument('job_offers', row.id, {
    status: nextStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user?.uid || null,
  });
  setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: nextStatus } : r));
}
```

| Acção | Efeito no Firestore | Campos auditoria |
|---|---|---|
| Aprovar | `status = 'active'` | `reviewed_at`, `reviewed_by` |
| Rejeitar | `status = 'rejected'` | `reviewed_at`, `reviewed_by` |
| Eliminar | `deleteDocument('job_offers', id)` | n/a |

**Auditoria built-in:** cada moderação grava `reviewed_at` (ISO timestamp)
e `reviewed_by` (uid do admin). Suficiente para rasto auditável (sem precisar
de `audit_logs` separado, embora o `CPCDashboard` use audit_logs para outras
acções como bloquear utilizadores).

**Visibilidade pós-moderação no migrante (`JobsPage`):**

`src/pages/dashboard/migrant/JobsPage.tsx` carrega ofertas via
`loadActiveJobOfferRows()` em `src/features/jobs/loadActiveJobOffers.ts`:

```typescript
const ACTIVE_STATUS_FILTER = [{ field: 'status', operator: '==' as const, value: 'active' }];
```

Filtro `status == 'active'` **exclusivo** — `pending_review` e `rejected`
nunca aparecem ao migrante. Ordenação por `created_at` desc.

**Conclusão E9:** ✅ Funciona conforme escopo original. Aprovar/rejeitar
escrevem status + auditoria. Filtro `pending_review` no painel CPC OK.
Ofertas `active` aparecem na lista do migrante; `rejected` não aparecem.
**Sem bugs.**

---

## Smoke test no dev server

- `npm run dev` (porta 8090, vite + HMR) sobe sem erros.
- Landing page (`/`) e Auth (`/entrar`, `/registar`) renderizam.
  Screenshots em `docs/screenshots/val-home.png` e `docs/screenshots/val-entrar.png`.
- Console limpo (só warnings de React Router v7 future flags — pré-existentes
  e não bloqueantes).
- **Não foi possível login E2E** sem credenciais de teste. Para validação
  com dados reais, seria necessário:
  - `.env` com `VITE_FUNCTIONS_EMULATOR=true` + emulators a correr; **ou**
  - Conta de teste no projecto `cpc-projeto-app` com role `company` e role
    `admin`/`manager`/`coordinator`.

---

## Decisões pendentes (CIBEA)

| ID | Pergunta | Origem |
|---|---|---|
| D-E5-1 | Edit a oferta `active` deve forçar re-moderação (`pending_review`) em mudanças "substanciais"? Hoje fica logo visível. | TASK-VAL E5 |
