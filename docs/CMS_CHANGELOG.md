## 2026-05-27 · Correções v1.1

### Bug 2 corrigido
- Tradução PT/EN/ES/FR/KEA agora funciona após edição no CMS
- Override em PT deixou de poluir os demais idiomas
- Adicionados testes de regressão em `src/features/cms/usePageContent.test.tsx`

### Bug 1 corrigido
- Estado "Guardando..." agora libera após confirmação do Firestore
- Timeout defensivo de 15s evita travamento infinito
- Logs de diagnóstico em `src/integrations/firebase/firestore.ts` e `src/features/cms/ContentEditorForm.tsx`
- `mountedRef` previne setState em componente desmontado
