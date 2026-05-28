import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { addDocument, getDocument, queryDocuments, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import {
  JOB_MIN_QUALIFICATION_VALUES,
  JOB_STUDY_AREA_VALUES,
  jobQualificationRequiresStudyArea,
  normalizeJobMinQualification,
  normalizeJobStudyArea,
  type JobMinQualification,
  type JobStudyArea,
} from '@/features/jobs/jobOfferQualifications';

function normalizeRoleValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function looksLikeEmployerRole(value: unknown): boolean {
  const normalized = normalizeRoleValue(value);
  return normalized !== null && ['company', 'empresa', 'employer', 'business', 'empresario', 'empresário'].includes(normalized);
}

function accountLooksEnabledForFirestore(userDoc: Record<string, unknown> | null): boolean {
  if (!userDoc) return false;
  if (userDoc.blocked === true) return false;
  if (userDoc.active === false) return false;
  return true;
}

/** Converte texto separado por vírgulas numa lista de competências única (case-insensitive) e sem vazios. */
function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 && arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
}

export default function CreateJobPage() {
  const { user, profile, profileData } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    sector: '',
    contract_type: 'full_time',
    work_mode: 'on_site' as 'on_site' | 'hybrid' | 'remote',
    minimum_qualification: 'none' as JobMinQualification,
    study_area: '' as JobStudyArea | '',
    study_area_other: '',
    salary_range: '',
    requirements: '',
    skills: '',
  });

  useEffect(() => {
    setEditJobId(searchParams.get('edit'));
    void fetchCompany();
  }, [user, searchParams, profile?.role]);

  useEffect(() => {
    if (!companyId || !editJobId) return;
    void fetchOfferForEdit({ companyId, jobId: editJobId });
  }, [companyId, editJobId]);

  async function fetchCompany() {
    if (!user) return;

    const uid = user.uid;

    try {
      // Doc canónico: sempre companies/{auth.uid} — alinha com as regras Firestore (company_id == uid).
      const direct = await getDocument<{
        id: string;
        user_id?: string;
        userId?: string;
        company_name?: string;
        verified?: boolean;
      }>('companies', uid);

      if (direct) {
        if (direct.user_id !== uid && direct.userId !== uid) {
          await setDocument('companies', uid, { user_id: uid }, true);
        }
        setCompanyId(uid);
        return;
      }

      const legacy = await queryDocuments<{
        id: string;
        company_name?: string;
        verified?: boolean;
      }>('companies', [{ field: 'user_id', operator: '==', value: uid }], undefined, 1);

      if (legacy[0]) {
        const baseName =
          (typeof legacy[0].company_name === 'string' && legacy[0].company_name.trim()
            ? legacy[0].company_name.trim()
            : null) ??
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';

        await setDocument(
          'companies',
          uid,
          {
            user_id: uid,
            company_name: baseName,
            verified: typeof legacy[0].verified === 'boolean' ? legacy[0].verified : false,
            createdAt: new Date().toISOString(),
          },
          true
        );
        setCompanyId(uid);
        return;
      }

      if (profile?.role === 'company') {
        const baseName =
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';

        await setDocument(
          'companies',
          uid,
          { user_id: uid, company_name: baseName, verified: false, createdAt: new Date().toISOString() },
          true
        );
        setCompanyId(uid);
      }
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  }

  async function fetchOfferForEdit(args: { companyId: string; jobId: string }) {
    const uid = user?.uid;
    if (!uid) return;

    try {
      const offer = await getDocument<{
        id: string;
        company_id?: string;
        title?: string;
        description?: string | null;
        location?: string | null;
        sector?: string | null;
        contract_type?: string | null;
        work_mode?: string | null;
        minimum_qualification?: string | null;
        study_area?: string | null;
        study_area_other?: string | null;
        salary_range?: string | null;
        requirements?: string | null;
        required_skills?: string[] | null;
        status?: string;
      }>('job_offers', args.jobId);

      if (!offer?.company_id) {
        toast({
          title: t.get('company.createJob.errors.loadFailedTitle'),
          description: t.get('company.createJob.errors.loadFailedDesc'),
          variant: 'destructive',
        });
        navigate('/dashboard/empresa/ofertas');
        return;
      }

      const ownsByCanonical = offer.company_id === uid;
      const co = await getDocument<{ user_id?: string; userId?: string }>('companies', offer.company_id);
      const ownerUid = co?.user_id ?? co?.userId;
      const ownsByCompanyDoc = ownerUid === uid;

      if (!ownsByCanonical && !ownsByCompanyDoc) {
        toast({
          title: t.get('company.createJob.errors.loadFailedTitle'),
          description: t.get('company.createJob.errors.loadFailedDesc'),
          variant: 'destructive',
        });
        navigate('/dashboard/empresa/ofertas');
        return;
      }

      setExistingStatus(offer.status ?? null);
      const wm = offer.work_mode;
      const workMode: 'on_site' | 'hybrid' | 'remote' =
        wm === 'hybrid' || wm === 'remote' || wm === 'on_site' ? wm : 'on_site';
      const minQual = normalizeJobMinQualification(offer.minimum_qualification);
      const studyArea = normalizeJobStudyArea(offer.study_area);
      setForm({
        title: offer.title ?? '',
        description: offer.description ?? '',
        location: offer.location ?? '',
        sector: offer.sector ?? '',
        contract_type: offer.contract_type ?? 'full_time',
        work_mode: workMode,
        minimum_qualification: minQual,
        study_area: jobQualificationRequiresStudyArea(minQual) ? studyArea : '',
        study_area_other:
          jobQualificationRequiresStudyArea(minQual) && studyArea === 'other'
            ? (typeof offer.study_area_other === 'string' ? offer.study_area_other : '')
            : '',
        salary_range: offer.salary_range ?? '',
        requirements: offer.requirements ?? '',
        skills: Array.isArray(offer.required_skills) ? offer.required_skills.join(', ') : '',
      });
    } catch (error) {
      console.error('Error loading offer for edit:', error);
      toast({
        title: t.get('company.createJob.errors.loadFailedTitle'),
        description: t.get('company.createJob.errors.loadFailedDesc'),
        variant: 'destructive',
      });
      navigate('/dashboard/empresa/ofertas');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!companyId) {
      toast({
        title: t.get('company.createJob.errors.companyNotFoundTitle'),
        description: t.get('company.createJob.errors.companyNotFoundDesc'),
        variant: 'destructive',
      });
      return;
    }

    if (!user?.uid) {
      toast({
        title: t.get('company.createJob.errors.createFailedTitle'),
        description: t.get('company.createJob.errors.createFailedDesc'),
        variant: 'destructive',
      });
      return;
    }

    const needsStudyArea = jobQualificationRequiresStudyArea(form.minimum_qualification);
    if (needsStudyArea && !form.study_area) {
      toast({
        title: t.get('company.createJob.errors.createFailedTitle'),
        description: t.get('company.createJob.errors.studyAreaRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (needsStudyArea && form.study_area === 'other' && !form.study_area_other.trim()) {
      toast({
        title: t.get('company.createJob.errors.createFailedTitle'),
        description: t.get('company.createJob.errors.studyAreaOtherRequired'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const publisherId = user.uid;
      const [userDoc, profileDoc] = await Promise.all([
        getDocument<Record<string, unknown>>('users', publisherId),
        getDocument<Record<string, unknown>>('profiles', publisherId),
      ]);
      const employerOnUser =
        looksLikeEmployerRole(userDoc?.role) ||
        looksLikeEmployerRole(userDoc?.profile) ||
        looksLikeEmployerRole(userDoc?.perfil) ||
        looksLikeEmployerRole(userDoc?.type);
      const employerOnProfile =
        looksLikeEmployerRole(profileDoc?.role) ||
        looksLikeEmployerRole(profileDoc?.profile) ||
        looksLikeEmployerRole(profileDoc?.perfil) ||
        looksLikeEmployerRole(profileDoc?.type);

      const hasEmployerRole = employerOnUser || employerOnProfile;

      if (!hasEmployerRole) {
        toast({
          title: t.get('company.createJob.errors.createFailedTitle'),
          description: 'Seu perfil não está identificado como empresa para publicar vagas. Atualize o campo role para "company" em users e/ou profiles.',
          variant: 'destructive',
        });
        return;
      }

      if (userDoc && !accountLooksEnabledForFirestore(userDoc)) {
        toast({
          title: t.get('company.createJob.errors.createFailedTitle'),
          description:
            'A conta está inativa ou bloqueada no Firestore (users: active=false ou blocked=true). Corrija em users/{seu uid} ou contacte o suporte.',
          variant: 'destructive',
        });
        return;
      }

      // Doc canónico no ID do utilizador (regras aceitam company_id == auth.uid quando o doc existe).
      await setDocument('companies', publisherId, { user_id: publisherId }, true);

      const qualificationPayload = {
        minimum_qualification: form.minimum_qualification === 'none' ? null : form.minimum_qualification,
        study_area: needsStudyArea && form.study_area ? form.study_area : null,
        study_area_other:
          needsStudyArea && form.study_area === 'other' ? form.study_area_other.trim() || null : null,
      };

      if (editJobId) {
        await updateDocument('job_offers', editJobId, {
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          sector: form.sector || null,
          contract_type: form.contract_type || null,
          work_mode: form.work_mode,
          ...qualificationPayload,
          salary_range: form.salary_range || null,
          requirements: form.requirements || null,
          required_skills: parseSkills(form.skills),
          status: existingStatus ?? 'pending_review',
        });

        toast({
          title: t.get('company.createJob.toast.updatedTitle'),
          description: t.get('company.createJob.toast.updatedDesc'),
        });
      } else {
        await addDocument('job_offers', {
          company_id: publisherId,
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          sector: form.sector || null,
          contract_type: form.contract_type || null,
          work_mode: form.work_mode,
          ...qualificationPayload,
          salary_range: form.salary_range || null,
          requirements: form.requirements || null,
          required_skills: parseSkills(form.skills),
          status: 'pending_review',
          created_at: new Date().toISOString(),
        });

        toast({
          title: t.get('company.createJob.toast.createdTitle'),
          description: t.get('company.createJob.toast.createdDesc'),
        });
      }
      navigate('/dashboard/empresa/ofertas');
    } catch (error) {
      const err = error as { code?: unknown; message?: unknown };
      const code = typeof err.code === 'string' ? err.code : null;
      const message = typeof err.message === 'string' ? err.message : '';
      if (code === 'permission-denied' || message.toLowerCase().includes('permission')) {
        console.error(
          'Permission denied while creating/updating job_offers. Confirm: (1) firebase deploy --only firestore:rules com o ficheiro deste repo, (2) users/{uid} com active true e blocked false, (3) App Check no Firebase Console não a bloquear escritas.',
          { uid: user?.uid ?? null, companyId, code, message }
        );
      }
      console.error('Error saving job:', error);
      toast({
        title: t.get('company.createJob.errors.createFailedTitle'),
        description: t.get('company.createJob.errors.createFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link
        to="/dashboard/empresa"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t.get('company.createJob.backToDashboard')}
      </Link>

      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {editJobId ? t.get('company.createJob.editTitle') : t.get('company.createJob.title')}
        </h1>
        <p className="text-muted-foreground mb-8">
          {editJobId ? t.get('company.createJob.editSubtitle') : t.get('company.createJob.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="cpc-card p-6 space-y-4">
            <h2 className="font-semibold">{t.get('company.createJob.form.sectionTitle')}</h2>

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.title')}</label>
              <Input
                placeholder={t.get('company.createJob.form.placeholders.title')}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.description')}</label>
              <Textarea
                placeholder={t.get('company.createJob.form.placeholders.description')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.location')}</label>
                <Input
                  placeholder={t.get('company.createJob.form.placeholders.location')}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.sector')}</label>
                <Input
                  placeholder={t.get('company.createJob.form.placeholders.sector')}
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.contractType')}</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="full_time">{t.get('company.createJob.form.contractTypes.full_time')}</option>
                  <option value="part_time">{t.get('company.createJob.form.contractTypes.part_time')}</option>
                  <option value="temporary">{t.get('company.createJob.form.contractTypes.temporary')}</option>
                  <option value="internship">{t.get('company.createJob.form.contractTypes.internship')}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.salaryRange')}</label>
                <Input
                  placeholder={t.get('company.createJob.form.placeholders.salaryRange')}
                  value={form.salary_range}
                  onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.workMode')}</label>
                <select
                  value={form.work_mode}
                  onChange={(e) =>
                    setForm({ ...form, work_mode: e.target.value as 'on_site' | 'hybrid' | 'remote' })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="on_site">{t.get('company.createJob.form.workModes.on_site')}</option>
                  <option value="hybrid">{t.get('company.createJob.form.workModes.hybrid')}</option>
                  <option value="remote">{t.get('company.createJob.form.workModes.remote')}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t.get('company.createJob.form.labels.minimumQualification')}
                </label>
                <select
                  value={form.minimum_qualification}
                  onChange={(e) => {
                    const minimum_qualification = e.target.value as JobMinQualification;
                    const keepStudy = jobQualificationRequiresStudyArea(minimum_qualification);
                    setForm({
                      ...form,
                      minimum_qualification,
                      study_area: keepStudy ? form.study_area : '',
                      study_area_other: keepStudy ? form.study_area_other : '',
                    });
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  {JOB_MIN_QUALIFICATION_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t.get(`company.createJob.form.qualificationLevels.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {jobQualificationRequiresStudyArea(form.minimum_qualification) ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.studyArea')}</label>
                  <select
                    value={form.study_area}
                    onChange={(e) => {
                      const study_area = e.target.value as JobStudyArea | '';
                      setForm({
                        ...form,
                        study_area,
                        study_area_other: study_area === 'other' ? form.study_area_other : '',
                      });
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                    required
                  >
                    <option value="">{t.get('company.createJob.form.placeholders.studyArea')}</option>
                    {JOB_STUDY_AREA_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t.get(`company.createJob.form.studyAreas.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {form.study_area === 'other' ? (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t.get('company.createJob.form.labels.studyAreaOther')}
                    </label>
                    <Input
                      placeholder={t.get('company.createJob.form.placeholders.studyAreaOther')}
                      value={form.study_area_other}
                      onChange={(e) => setForm({ ...form, study_area_other: e.target.value })}
                      required
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.requirements')}</label>
              <Textarea
                placeholder={t.get('company.createJob.form.placeholders.requirements')}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t.get('company.createJob.form.labels.skills')}</label>
              <Input
                placeholder={t.get('company.createJob.form.placeholders.skills')}
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
              {parseSkills(form.skills).length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {parseSkills(form.skills).map((skill) => (
                    <span key={skill} className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/empresa')}
            >
              {t.get('company.createJob.actions.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !form.title}>
              {loading ? (
                t.get('company.createJob.actions.saving')
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editJobId ? t.get('company.createJob.actions.save') : t.get('company.createJob.actions.publish')}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
