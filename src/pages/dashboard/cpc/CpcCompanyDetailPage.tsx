import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteDocument, getDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPhoneValueForDisplay } from '@/components/ui/phone-input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getCompanyRegistrationStatus,
  parseUnknownDate,
  type CompanyRegistrationStatus,
} from '@/lib/companyVerification';
import { ArrowLeft, Ban, Building2, CheckCircle, Mail, MapPin, Phone, Trash2 } from 'lucide-react';

type CompanyDetail = {
  id: string;
  company_name: string;
  email: string;
  activity_area: string | null;
  nif: string | null;
  fiscal_address: string | null;
  phone: string | null;
  notes: string | null;
  user_display_name: string | null;
  created_at: string;
  status: CompanyRegistrationStatus;
};

export default function CpcCompanyDetailPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'pt-PT';
  const { toast } = useToast();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (companyId) void fetchCompany();
  }, [companyId]);

  async function fetchCompany() {
    if (!companyId) return;
    setLoading(true);
    try {
      const row = await getDocument<Record<string, unknown> & { id: string }>('companies', companyId);
      if (!row) {
        setCompany(null);
        return;
      }

      const [userDoc, profileDoc] = await Promise.all([
        getDocument<{ email?: string }>('users', companyId),
        getDocument<{ email?: string }>('profiles', companyId),
      ]);
      const email =
        (typeof userDoc?.email === 'string' && userDoc.email.trim()) ||
        (typeof profileDoc?.email === 'string' && profileDoc.email.trim()) ||
        '—';

      const created = parseUnknownDate(row.createdAt ?? row.created_at);
      const phoneRaw = typeof row.phone === 'string' ? row.phone.trim() : '';
      setCompany({
        id: row.id,
        company_name:
          (typeof row.company_name === 'string' && row.company_name.trim()) ||
          (typeof row.legal_name === 'string' && row.legal_name.trim()) ||
          '—',
        email,
        activity_area:
          (typeof row.activity_area === 'string' && row.activity_area.trim()) ||
          (typeof row.business_area === 'string' && row.business_area.trim()) ||
          null,
        nif:
          (typeof row.nif === 'string' && row.nif.trim()) ||
          (typeof row.tax_id === 'string' && row.tax_id.trim()) ||
          null,
        fiscal_address:
          (typeof row.fiscal_address === 'string' && row.fiscal_address.trim()) ||
          (typeof row.address === 'string' && row.address.trim()) ||
          null,
        phone: phoneRaw ? formatPhoneValueForDisplay(phoneRaw) : null,
        notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
        user_display_name:
          typeof row.user_display_name === 'string' && row.user_display_name.trim()
            ? row.user_display_name.trim()
            : null,
        created_at: created ? created.toISOString() : '',
        status: getCompanyRegistrationStatus(row),
      });
    } catch (error) {
      console.error('Error fetching CPC company detail:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.companies.detail.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!company) return;
    setProcessing(true);
    try {
      await updateDocument('companies', company.id, {
        verified: true,
        rejected: false,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.uid || null,
      });
      setCompany((prev) => (prev ? { ...prev, status: 'approved' } : prev));
      toast({ title: t.get('cpc.pages.companies.detail.approvedToast') });
    } catch (error) {
      console.error('Error approving company:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.companies.detail.moderationError'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!company) return;
    setProcessing(true);
    try {
      await updateDocument('companies', company.id, {
        verified: false,
        rejected: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.uid || null,
      });
      setCompany((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
      toast({ title: t.get('cpc.pages.companies.detail.rejectedToast') });
    } catch (error) {
      console.error('Error rejecting company:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.companies.detail.moderationError'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!company) return;
    const ok = window.confirm(t.get('cpc.pages.companies.confirm_delete', { name: company.company_name }));
    if (!ok) return;
    setProcessing(true);
    try {
      await deleteDocument('companies', company.id);
      toast({ title: t.get('cpc.pages.companies.detail.deletedToast') });
      navigate('/dashboard/cpc/empresas');
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({
        title: t.get('common.error'),
        description: t.get('cpc.pages.companies.detail.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t.get('cpc.pages.companies.detail.notFound')}</p>
        <Link to="/dashboard/cpc/empresas" className="text-primary hover:underline mt-2 inline-block">
          {t.get('cpc.pages.companies.detail.back')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/dashboard/cpc/empresas"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.get('cpc.pages.companies.detail.back')}
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="cpc-card p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
                  <Building2 className="h-7 w-7 text-primary shrink-0" />
                  {company.company_name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4 shrink-0" />
                    {company.email}
                  </span>
                  {company.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4 shrink-0" />
                      {company.phone}
                    </span>
                  )}
                  {company.fiscal_address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {company.fiscal_address}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">{statusBadge(company.status)}</div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t.get('cpc.pages.companies.detail.activityArea')}</dt>
                <dd className="font-medium mt-1">{company.activity_area || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.get('cpc.pages.companies.detail.nif')}</dt>
                <dd className="font-medium mt-1">{company.nif || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.get('cpc.pages.companies.detail.contactName')}</dt>
                <dd className="font-medium mt-1">{company.user_display_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.get('cpc.pages.companies.detail.registeredAt')}</dt>
                <dd className="font-medium mt-1">
                  {company.created_at ? new Date(company.created_at).toLocaleDateString(locale) : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {company.notes && (
            <div className="cpc-card p-6 md:p-8">
              <h2 className="font-semibold text-lg mb-4">{t.get('cpc.pages.companies.detail.notes')}</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">{company.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="cpc-card p-6 space-y-4 sticky top-4">
            <h2 className="font-semibold text-lg">{t.get('cpc.pages.companies.detail.moderation')}</h2>
            <p className="text-sm text-muted-foreground">{t.get('cpc.pages.companies.detail.moderationHint')}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => handleApprove()} disabled={processing || company.status === 'approved'}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t.get('cpc.pages.companies.actions.approve')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReject()}
                disabled={processing || company.status === 'rejected'}
              >
                <Ban className="h-4 w-4 mr-2" />
                {t.get('cpc.pages.companies.actions.reject')}
              </Button>
              <Button variant="destructive" onClick={() => handleDelete()} disabled={processing}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t.get('cpc.pages.companies.actions.delete')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
