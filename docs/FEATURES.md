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

## T-13 — Inventário completo de rotas (Bloco 5, 2026-06-15)

Listagem extraída de `src/App.tsx:115-186`. Build verde confirma que todos os 17
imports resolvem para componentes existentes.

### Rotas públicas (sem auth)

| Rota | Página | Notas |
|---|---|---|
| `/` | `Index` | Landing |
| `/sobre` | `About` | Institucional |
| `/como-funciona` | `HowItWorks` | Institucional |
| `/contacto` | `Contact` | Form público → `submitContactForm` callable |
| `/entrar` | `Auth` | Login |
| `/registar` | `Auth` | Registo (modo register) |
| `/recuperar-senha` | `ForgotPassword` | Reset password Firebase Auth |
| `/ajuda` | `HelpCenter` | FAQ acordeão |
| `/em-breve` | `ComingSoon` | Placeholder |
| `/privacidade` | `Privacy` | Política de privacidade (LGPD) |
| `/cookies` | `Cookies` | Política de cookies |
| `/termos` | `NotFound` | **Placeholder** — termos por escrever |
| `/trails` | `NotFound` | **Placeholder** — listagem pública de trilhas |
| `/precos` | `NotFound` | **Placeholder** — preços |

### Rota dev-only

| Rota | Página | Guard |
|---|---|---|
| `/dev/criar-usuarios` | `CreateTestUsersDev` | só em `import.meta.env.DEV` |

### Rotas protegidas

| Rota | Componente | Guards aplicados | Roles permitidos |
|---|---|---|---|
| `/triagem` | `Triage` | `ProtectedRoute` + `EmailVerificationGuard` | `migrant` |
| `/dashboard/migrante/*` | `MigrantDashboard` | `ProtectedRoute` + `EmailVerificationGuard` + `TriageGuard` | `migrant` |
| `/dashboard/cpc/*` | `CPCDashboard` | `ProtectedRoute` + `EmailVerificationGuard` | `mediator`, `lawyer`, `psychologist`, `manager`, `coordinator`, `admin`, `trainer` |
| `/dashboard/empresa/*` | `CompanyDashboard` | `ProtectedRoute` + `EmailVerificationGuard` | `company` |

### Catch-all

| Rota | Página |
|---|---|
| `*` | `NotFound` |

### Total
- **14 rotas públicas** (3 são placeholder → `NotFound`)
- **1 rota dev-only**
- **4 rotas protegidas** (1 triage + 3 dashboards)
- **1 catch-all**

### Análise de guards

`ProtectedRoute` (linhas 52–85) faz, por esta ordem:
1. Loading → `LoadingScreen`
2. Sem auth → `Navigate('/entrar')`
3. Com `allowedRoles` mas sem profile → ecrã de erro "Sem acesso aos dados"
4. Profile com role fora de `allowedRoles` → `Navigate` para dashboard do role correcto

`EmailVerificationGuard` (Bloco 4 T-01) → bloqueia até `user.emailVerified` (com
grandfather clause para contas pré-`2026-06-01`).

`TriageGuard` (linhas 95–110) → bloqueia `/dashboard/migrante/*` enquanto a
triagem não estiver completa, redireccionando para `/triagem`.

**Validação dos guards (✓ todos correctos):**

| Rota | Role exigido | Esperado | OK? |
|---|---|---|---|
| `/triagem` | `migrant` | `migrant` | ✓ |
| `/dashboard/migrante/*` | `migrant` | `migrant` | ✓ |
| `/dashboard/cpc/*` | 7 roles CPC | `mediator`,`lawyer`,`psychologist`,`manager`,`coordinator`,`admin`,`trainer` | ✓ |
| `/dashboard/empresa/*` | `company` | `company` | ✓ |

Cross-role redireccionamento funciona porque `ProtectedRoute` chama
`getDashboardPath(profile.role)` antes do `<Navigate>` quando o role não bate certo.

### Imports verificados

17 imports em `App.tsx` resolvidos pelo build:
`Index, About, HowItWorks, Contact, Auth, ForgotPassword, Triage,
MigrantDashboard, CPCDashboard, CompanyDashboard, NotFound,
EmailVerificationGuard, CreateTestUsersDev, Cookies, Privacy, HelpCenter, ComingSoon`.
Zero imports órfãos.

---

## T-12 — Service Areas (Bloco 5, validação)

**Arquivos:**
- `src/features/serviceAreas/serviceAreas.ts`
- `src/pages/dashboard/cpc/ServiceAreasAdminPage.tsx`
- `src/pages/dashboard/migrant/BookingSessionWizardDialog.tsx`
- `firestore.rules` linhas 628-631

### Auto-seed (verificado)
`ensureServiceAreasSeeded(updatedBy)` em `serviceAreas.ts:54-75`:
- Lê `loadServiceAreas()`; se vazio, cria 3 docs em `service_areas/{id}`:
  - `legal` (30 min)
  - `psychology` (60 min)
  - `mediation` (30 min)
- Cada seed gravado com `responsible_uids:[], responsible_names:[], is_active:true`.
- Ordem garantida por `SERVICE_AREA_ORDER` e `sortByOrder()`.

### Edição (verificado)
- `updateServiceArea(id, patch, updatedBy)` actualiza `responsible_uids`,
  `responsible_names`, `default_duration_minutes`, `is_active` + carimbo
  `updated_at/updated_by`.
- UI admin em `ServiceAreasAdminPage` consome estes helpers.

### Regras Firestore (verificadas em `firestore.rules:628-631`)
```
match /service_areas/{areaId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAccountEnabled() && hasRole('admin');
}
```
- Leitura: qualquer autenticado (necessário para o booking dialog do migrante).
- Escrita: só `admin`. **Conforme.**

### Integração com booking (verificado)
`BookingSessionWizardDialog.tsx`:
- `import { loadServiceAreas, isAreaBookable }` (linha 3).
- `selectedArea` filtrado por `isAreaBookable` (linha 387) — só áreas
  `is_active === true` E com `responsible_uids.length > 0`.
- `BookingSpecialistStep` (linha 653) consome `responsible_uids` reais; área
  sem responsáveis ou inactiva mostra mensagem `serviceAreas.areaUnavailable`.

### Estado
- Rota: `/dashboard/cpc/areas-servico`
- Perfil: `admin` (escrita) + qualquer CPC (leitura via dashboard)
- Comportamento: ✅ auto-seed funciona, ✅ edição funciona, ✅ toggle activo bloqueia booking, ✅ responsáveis usados no dialog
- Status: **funcional**.

---

## Decisões pendentes (CIBEA)

| ID | Pergunta | Origem |
|---|---|---|
| D-E5-1 | Edit a oferta `active` deve forçar re-moderação (`pending_review`) em mudanças "substanciais"? Hoje fica logo visível. | TASK-VAL E5 |
