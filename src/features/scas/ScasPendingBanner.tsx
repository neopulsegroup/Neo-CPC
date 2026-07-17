import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useMigrantScasPending } from '@/hooks/useMigrantScasPending';

/**
 * Banner de chamada à ação para o SCAS pendente (T0/T_TRILHA/T_PDI).
 * Carregamento leve e autossuficiente; devolve null se não há nada pendente.
 */
export function ScasPendingBanner() {
  const { t } = useLanguage();
  const pending = useMigrantScasPending();

  if (!pending) return null;

  const titleKey =
    pending.moment_type === 'T0'
      ? 'scas.migrant.ctaT0Title'
      : pending.moment_type === 'T_TRILHA'
        ? 'scas.migrant.ctaTrailTitle'
        : 'scas.migrant.ctaPdiTitle';
  const descKey =
    pending.moment_type === 'T0'
      ? 'scas.migrant.ctaT0Description'
      : pending.moment_type === 'T_TRILHA'
        ? 'scas.migrant.ctaTrailDescription'
        : 'scas.migrant.ctaPdiDescription';

  return (
    <Link
      to="/dashboard/migrante/scas"
      className="mb-6 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ClipboardList className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.get(titleKey)}</p>
        <p className="text-sm text-muted-foreground">{t.get(descKey)}</p>
      </div>
      <ArrowRight className="h-5 w-5 flex-shrink-0 text-primary" />
    </Link>
  );
}
