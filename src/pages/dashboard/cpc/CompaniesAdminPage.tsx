import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Building2, Search } from 'lucide-react';
import {
  getCompanyRegistrationStatus,
  parseUnknownDate,
  type CompanyRegistrationStatus,
} from '@/lib/companyVerification';

type CompanyRow = {
  id: string;
  company_name: string;
  email: string;
  activity_area: string | null;
  nif: string | null;
  created_at: string;
  status: CompanyRegistrationStatus;
};

export default function CompaniesAdminPage() {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | CompanyRegistrationStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<CompanyRow[]>([]);

  useEffect(() => {
    void fetchAll();
  }, []);

  async function fetchAll() {
    setLoadingList(true);
    try {
      const data = await queryDocuments<Record<string, unknown> & { id: string }>('companies', [], undefined, 500);

      const userIds = (data || []).map((row) => row.id).filter((id): id is string => Boolean(id));
      const userDocs = await Promise.all(
        userIds.map(async (id) => {
          const [userDoc, profileDoc] = await Promise.all([
            getDocument<{ email?: string }>('users', id),
            getDocument<{ email?: string }>('profiles', id),
          ]);
          const email =
            (typeof userDoc?.email === 'string' && userDoc.email.trim()) ||
            (typeof profileDoc?.email === 'string' && profileDoc.email.trim()) ||
            '—';
          return { id, email };
        })
      );
      const emailMap = new Map(userDocs.map((row) => [row.id, row.email]));

      const mapped: CompanyRow[] = (data || []).map((row) => {
        const created = parseUnknownDate(row.createdAt ?? row.created_at);
        const companyName =
          (typeof row.company_name === 'string' && row.company_name.trim()) ||
          (typeof row.legal_name === 'string' && row.legal_name.trim()) ||
          '—';
        const nif =
          (typeof row.nif === 'string' && row.nif.trim()) ||
          (typeof row.tax_id === 'string' && row.tax_id.trim()) ||
          null;
        return {
          id: row.id,
          company_name: companyName,
          email: emailMap.get(row.id) || '—',
          activity_area:
            (typeof row.activity_area === 'string' && row.activity_area.trim()) ||
            (typeof row.business_area === 'string' && row.business_area.trim()) ||
            null,
          nif,
          created_at: created ? created.toISOString() : '',
          status: getCompanyRegistrationStatus(row),
        };
      });

      mapped.sort((a, b) => {
        const ad = parseUnknownDate(a.created_at)?.getTime() || 0;
        const bd = parseUnknownDate(b.created_at)?.getTime() || 0;
        return bd - ad;
      });

      setRows(mapped);
    } catch (error) {
      console.error('Error fetching CPC companies list:', error);
    } finally {
      setLoadingList(false);
    }
  }

  const filteredRows = useMemo(() => {
    let out = [...rows];
    if (statusFilter !== 'all') {
      out = out.filter((r) => r.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const name = r.company_name.toLowerCase();
        const email = r.email.toLowerCase();
        const area = (r.activity_area || '').toLowerCase();
        const nif = (r.nif || '').toLowerCase();
        return name.includes(q) || email.includes(q) || area.includes(q) || nif.includes(q);
      });
    }
    return out;
  }, [rows, searchQuery, statusFilter]);

  function statusBadge(status: CompanyRegistrationStatus) {
    if (status === 'approved') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
          {t.get('cpc.pages.companies.status_approved')}
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">
          {t.get('cpc.pages.companies.status_rejected')}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
        {t.get('cpc.pages.companies.status_pending')}
      </span>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> {t.get('cpc.pages.companies.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.companies.subtitle')}</p>
        </div>
        <Link
          to="/dashboard/cpc"
          className="text-sm text-primary hover:underline shrink-0 self-start md:self-auto"
        >
          {t.get('cpc.actions.back')}
        </Link>
      </div>

      <div className="cpc-card p-6 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'pending', label: t.get('cpc.pages.companies.filters.pending') },
            { key: 'approved', label: t.get('cpc.pages.companies.filters.approved') },
            { key: 'rejected', label: t.get('cpc.pages.companies.filters.rejected') },
            { key: 'all', label: t.get('cpc.pages.companies.filters.all') },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key as 'all' | CompanyRegistrationStatus)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.get('cpc.pages.companies.search_placeholder')}
            className="pl-9"
            aria-label={t.get('cpc.pages.companies.search_placeholder')}
          />
        </div>
      </div>

      {loadingList ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((r) => (
            <Link
              key={r.id}
              to={`/dashboard/cpc/empresas/${r.id}`}
              className="cpc-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{r.company_name}</p>
                <p className="text-sm text-muted-foreground truncate">{r.email}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {r.activity_area || '—'}
                  {r.nif ? ` • NIF ${r.nif}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString(locale) : '—'}
                </p>
                <p className="text-xs text-primary mt-2">{t.get('cpc.pages.companies.viewDetails')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">{statusBadge(r.status)}</div>
            </Link>
          ))}
          {filteredRows.length === 0 && (
            <div className="cpc-card p-12 text-center text-muted-foreground">{t.get('cpc.pages.companies.empty')}</div>
          )}
        </div>
      )}
    </div>
  );
}
