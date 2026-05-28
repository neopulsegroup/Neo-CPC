# Decisões pendentes — CIBEA

> Registo de decisões de produto e implementação que precisam de validação
> do cliente. Cada item refere a task afetada. Quando confirmadas, anotar
> resposta e data.
>
> Última actualização: 2026-05-26.

---

## Pendentes

### D2 — Quizzes: nota mínima padrão 70%?
- **Origem:** TASK-03 (Sprint 2 — tipo de conteúdo Quiz nas trilhas).
- **Pergunta:** Aprovar com `quiz_passing_score = 70` como default ou
  outro valor (60/75/80)?
- **Status:** aberto.

---

### D7 — Lista oficial de Áreas de Atividade para registo de empresa
- **Origem:** TASK-05 (Sprint 1 — campo "Área de Atividade" obrigatório
  no registo).
- **Lista provisória implementada** (com `TODO(D7)` em código):
  1. Construção
  2. Hotelaria e Restauração
  3. Tecnologia
  4. Saúde
  5. Educação
  6. Comércio
  7. Indústria
  8. Agricultura
  9. Transportes e Logística
  10. Serviços
  11. Outro (input livre)
- **Pergunta:** CIBEA confirma estas 10 + "Outro"? Falta alguma área
  relevante para o público-alvo do Algarve (ex.: Pescas, Turismo separado
  de Hotelaria)?
- **Status:** aberto.

---

### D8 — Ano de Registo: ano mínimo (2021)?
- **Origem:** TASK-01 (Sprint 1 — campo `registrationYear` no perfil
  migrante).
- **Implementação actual** (com `TODO(D8)` em código): Select com 6 anos
  contados do ano corrente (2026 → 2021).
- **Pergunta:** CIBEA confirma 2021 como ano mais antigo aceito? Programa
  CIBEA começou antes (deveria recuar mais) ou foi posterior (recuar
  menos)?
- **Status:** aberto.

---

### D9 — E5: edits a ofertas `active` devem forçar re-moderação?
- **Origem:** TASK-VAL E5 (auditoria funcional de "Empresa editar
  ofertas"), Sprint 1.
- **Comportamento actual confirmado:** `CreateJobPage` preserva
  `existingStatus` literal ao guardar edits. Uma oferta `active` editada
  continua `active` e fica imediatamente visível ao público — **sem nova
  passagem pelo CPC**.
- **Risco:** uma empresa aprovada pode alterar substancialmente o título
  ou descrição (ex.: trocar "Programador Junior" por "Limpeza nocturna")
  sem o CPC reavaliar.
- **Pergunta:** Deve qualquer edit a oferta `active` forçar
  `status: 'pending_review'`, voltando à fila de moderação? Ou só edits
  "substanciais" (definir critério: mudança de título? sector? tipo de
  contrato?)?
- **Alternativa pragmática:** botão "Republicar" separado de "Editar
  rascunho", explícito para a empresa.
- **Status:** aberto.

---

### D11 · Variante crioulo cabo-verdiano (Kriolu) · ABERTO

Estado: ficheiro `src/locales/kea.json` ainda não foi criado.
i18next está configurado para suportar `kea` mas usa fallback para `pt`.

Decisão pendente:
- O cliente confirma a necessidade de tradução para Crioulo?
- Se sim, em que prazo? (depende de orçamento de tradução)
- Se não, manter como fallback PT e remover da lista de idiomas oferecida no seletor.

Acção sugerida: clarificar na próxima reunião com Oporto Forte.

---

### D12 — Logos EMPIS finais recebidos?
- **Origem:** TASK-09 (Sprint 4 — logos em exports restantes).
- **Pergunta:** Os PNG em `public/branding/` (`logo-SF.png`,
  `logos-cpc-sf.png`) são as versões finais aprovadas pelo EMPIS, ou há
  refresh pendente?
- **Status:** aberto.

---

## Confirmadas

_(nenhuma ainda — quando CIBEA responder, mover item para esta secção
com a resposta e data.)_
