import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck, ArrowRight } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchMigrantPdi } from '@/lib/pdi/repository';

/**
 * Banner quando há PDI VALIDATED pendente de aceite.
 */
export function PdiPendingBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;

    void (async () => {
      try {
        const pdi = await fetchMigrantPdi(user.uid);
        if (!cancelled) setShow(pdi?.status === 'VALIDATED');
      } catch {
        if (!cancelled) setShow(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (!show) return null;

  return (
    <Link
      to="/dashboard/migrante/pdi"
      className="mb-6 flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-colors hover:bg-emerald-500/10"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
        <FileCheck className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.get('pdi.migrant.bannerTitle')}</p>
        <p className="text-sm text-muted-foreground">{t.get('pdi.migrant.bannerDescription')}</p>
      </div>
      <ArrowRight className="h-5 w-5 flex-shrink-0 text-emerald-700" />
    </Link>
  );
}
