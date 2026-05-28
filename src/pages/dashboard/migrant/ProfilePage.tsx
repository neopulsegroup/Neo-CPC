import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Calendar, BookOpen, CheckCircle2, Clock, User, Camera, Download, Loader2, ClipboardList } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput, formatPhoneValueForDisplay } from '@/components/ui/phone-input';
import { fetchMigrantProfile, type MigrantProfileDoc, type MigrantProfileResponse } from '@/api/migrantProfile';
import { inferNeedsProfile } from '@/features/needs/inferNeedsProfile';
import { NeedsProfileCard } from '@/features/needs/NeedsProfileCard';
import { updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import { defaultBranding, fetchDocumentBranding } from '@/lib/documentBranding';
import {
  PDF_BRANDING_FOOTER_HEIGHT_PT,
  PDF_BRANDING_HEADER_HEIGHT_PT,
  applyBrandingToAllPdfLibPages,
  embedBrandingImagesForPdfLib,
} from '@/lib/pdfLibDocumentBranding';
import { APP_TIME_ZONE, todayIsoAppCalendar } from '@/lib/appCalendar';
import { cepDigitsPortugal, formatPortugalCepDigits, lookupAddressFromPortugalCep } from '@/lib/portugalCepLookup';
import { formatActivityDurationShort, formatActivityStatusListLabel } from '@/features/activities/model';
import { loadParticipantActivitiesForUser } from '@/features/activities/participantActivityList';

function readProfileExtrasFromStorage(userKey: string): Partial<MigrantProfileDoc> | null {
  const extrasRaw =
    localStorage.getItem(`profileExtras:${userKey}`) ||
    localStorage.getItem(`profileExtras:${String(userKey)}`);
  if (!extrasRaw) return null;
  try {
    return JSON.parse(extrasRaw) as Partial<MigrantProfileDoc>;
  } catch {
    return null;
  }
}

function mergeProfileWithExtrasForUser(p: MigrantProfileDoc, userKey: string): MigrantProfileDoc {
  const extras = readProfileExtrasFromStorage(userKey);
  return {
    ...p,
    phone: p.phone || extras?.phone || null,
    birthDate: p.birthDate || extras?.birthDate || null,
    nationality: p.nationality || extras?.nationality || null,
    address: p.address || extras?.address || null,
    addressNumber: p.addressNumber || extras?.addressNumber || null,
    cep: p.cep || extras?.cep || null,
    identificationNumber: p.identificationNumber || extras?.identificationNumber || null,
    region: p.region || extras?.region || null,
    regionOther: p.regionOther || extras?.regionOther || null,
    resumeUrl: p.resumeUrl || extras?.resumeUrl || null,
    professionalTitle: p.professionalTitle || extras?.professionalTitle || null,
    professionalExperience: p.professionalExperience || extras?.professionalExperience || null,
    skills: p.skills || extras?.skills || null,
    languagesList: p.languagesList || extras?.languagesList || null,
    contactPreference: p.contactPreference || extras?.contactPreference || null,
    registrationYear:
      typeof p.registrationYear === 'number' && Number.isFinite(p.registrationYear)
        ? p.registrationYear
        : (typeof extras?.registrationYear === 'number' && Number.isFinite(extras.registrationYear)
            ? extras.registrationYear
            : null),
  };
}

/**
 * Anos disponíveis no Select de "Ano de Registo".
 * Janela de 6 anos a contar de `anoAtual` (mais antigo = anoAtual - 5).
 * TODO(D8): confirmar com CIBEA o ano mínimo a aceitar.
 */
function buildRegistrationYearOptions(now = new Date()): number[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let i = 0; i < 6; i += 1) years.push(current - i);
  return years;
}

function extractYearFromRegisteredAt(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getFullYear();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
  }
  if (typeof value === 'object') {
    const obj = value as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === 'function') {
      const d = obj.toDate();
      return Number.isNaN(d.getTime()) ? null : d.getFullYear();
    }
    if (typeof obj.seconds === 'number') {
      const d = new Date(obj.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d.getFullYear();
    }
  }
  return null;
}

type ProfileEditFormState = {
  name: string;
  phone: string;
  birthDate: string;
  nationality: string;
  resumeUrl: string;
  professionalTitle: string;
  professionalExperience: string;
  skills: string;
  languagesList: string;
  contactPreference: 'email' | 'phone';
  address: string;
  addressNumber: string;
  cep: string;
  region: '' | 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra';
  regionOther: string;
  /** String vazia quando não definido; convertido para number no save. */
  registrationYear: string;
};

function buildEditStateFromMergedProfile(res: MigrantProfileResponse, merged: MigrantProfileDoc | null): ProfileEditFormState {
  const triageAns =
    res.triage?.answers && typeof res.triage.answers === 'object'
      ? (res.triage.answers as Record<string, unknown>)
      : {};
  const triagePhone = typeof triageAns.phone === 'string' ? triageAns.phone : '';
  const triageBirthDate = typeof triageAns.birth_date === 'string' ? triageAns.birth_date : '';
  const triageNationality = typeof triageAns.nationality === 'string' ? triageAns.nationality : '';

  type R = ProfileEditFormState['region'];
  return {
    name: merged?.name || res.userProfile?.name || '',
    phone: merged?.phone || triagePhone || '',
    birthDate: merged?.birthDate || triageBirthDate || '',
    nationality: merged?.nationality || triageNationality || '',
    resumeUrl: merged?.resumeUrl || '',
    professionalTitle: merged?.professionalTitle || '',
    professionalExperience: merged?.professionalExperience || '',
    skills: merged?.skills || '',
    languagesList: merged?.languagesList || '',
    contactPreference: (merged?.contactPreference as 'email' | 'phone') || 'email',
    address: merged?.address || '',
    addressNumber: merged?.addressNumber || '',
    cep:
      (typeof merged?.cep === 'string' && merged.cep.trim()) ||
      (typeof merged?.identificationNumber === 'string' && merged.identificationNumber.trim()) ||
      '',
    region: (merged?.region as R) || '',
    regionOther: merged?.regionOther || '',
    registrationYear: (() => {
      if (typeof merged?.registrationYear === 'number' && Number.isFinite(merged.registrationYear)) {
        return String(merged.registrationYear);
      }
      const fromRegisteredAt = extractYearFromRegisteredAt(merged?.registeredAt ?? res.userProfile?.createdAt);
      return fromRegisteredAt ? String(fromRegisteredAt) : '';
    })(),
  };
}

export default function ProfilePage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { migrantId } = useParams<{ migrantId?: string }>();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MigrantProfileResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileSaveFeedback, setProfileSaveFeedback] = useState<'saved' | 'error' | null>(null);
  const [exportingFicha, setExportingFicha] = useState(false);
  const [exportingTriagem, setExportingTriagem] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [availableForWork, setAvailableForWork] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_ALLOWED_MIME = useMemo(() => new Set(['image/jpeg', 'image/png', 'image/gif']), []);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activities, setActivities] = useState<
    Array<{
      id: string;
      title: string;
      date: string;
      status?: string | null;
      durationMinutes?: number | null;
      startTime?: string;
      endTime?: string;
    }>
  >([]);

  const [edit, setEdit] = useState<{
    name: string;
    phone: string;
    birthDate: string;
    nationality: string;
    resumeUrl: string;
    professionalTitle: string;
    professionalExperience: string;
    skills: string;
    languagesList: string;
    contactPreference: 'email' | 'phone';
    address: string;
    addressNumber: string;
    cep: string;
    region: '' | 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra';
    regionOther: string;
    registrationYear: string;
  }>({
    name: '',
    phone: '',
    birthDate: '',
    nationality: '',
    resumeUrl: '',
    professionalTitle: '',
    professionalExperience: '',
    skills: '',
    languagesList: '',
    contactPreference: 'email',
    address: '',
    addressNumber: '',
    cep: '',
    region: '',
    regionOther: '',
    registrationYear: '',
  });

  const [personalInfoErrors, setPersonalInfoErrors] = useState<
    Partial<Record<'phone' | 'birthDate' | 'nationality' | 'address' | 'addressNumber' | 'cep' | 'region' | 'regionOther', string>>
  >({});

  const cepWhenEditOpenedRef = useRef<string | null>(null);
  const locationFieldsManualRef = useRef(false);
  const cepLookupSeq = useRef(0);
  const [cepLookupStatus, setCepLookupStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [cepLookupMessage, setCepLookupMessage] = useState<string | null>(null);

  const targetUserId = migrantId || user?.uid || null;
  const isViewingOtherUser = !!(migrantId && user?.uid && migrantId !== user.uid);
  const sessionsUrl = isViewingOtherUser ? '/dashboard/cpc/agenda' : '/dashboard/migrante/sessoes';
  const triageUrl = isViewingOtherUser ? '/dashboard/cpc/migrantes' : '/triagem';
  const trailsUrl = isViewingOtherUser ? '/dashboard/cpc/trilhas' : '/dashboard/migrante/trilhas';
  const canExportCpcData = useMemo(() => {
    const role = authProfile?.role;
    return (
      isViewingOtherUser &&
      typeof role === 'string' &&
      ['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer'].includes(role)
    );
  }, [authProfile?.role, isViewingOtherUser]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!targetUserId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMigrantProfile(targetUserId);
        if (cancelled) return;
        const userKey = targetUserId;

        setData(res);
        const p = res.profile;
        const extras = readProfileExtrasFromStorage(userKey);
        const merged: MigrantProfileDoc | null = p ? mergeProfileWithExtrasForUser(p, userKey) : null;

        if (p && extras) {
          const shouldMigrate =
            (!p.phone && extras.phone) ||
            (!p.birthDate && extras.birthDate) ||
            (!p.nationality && extras.nationality) ||
            (!p.address && extras.address) ||
            (!p.addressNumber && extras.addressNumber) ||
            (!p.cep && extras.cep) ||
            (!p.identificationNumber && extras.identificationNumber) ||
            (!p.region && extras.region) ||
            (!p.regionOther && extras.regionOther) ||
            (!p.resumeUrl && extras.resumeUrl) ||
            (!p.professionalTitle && extras.professionalTitle) ||
            (!p.professionalExperience && extras.professionalExperience) ||
            (!p.skills && extras.skills) ||
            (!p.languagesList && extras.languagesList) ||
            (!p.contactPreference && extras.contactPreference);

          if (shouldMigrate) {
            void updateDocument('profiles', targetUserId, {
              phone: merged?.phone || null,
              birthDate: merged?.birthDate || null,
              nationality: merged?.nationality || null,
              address: merged?.address || null,
              addressNumber: merged?.addressNumber || null,
              cep: merged?.cep || null,
              identificationNumber: merged?.identificationNumber || null,
              region: merged?.region || null,
              regionOther: merged?.regionOther || null,
              resumeUrl: merged?.resumeUrl || null,
              professionalTitle: merged?.professionalTitle || null,
              professionalExperience: merged?.professionalExperience || null,
              skills: merged?.skills || null,
              languagesList: merged?.languagesList || null,
              contactPreference: merged?.contactPreference || null,
            });
          }
        }

        setEdit(buildEditStateFromMergedProfile(res, merged));
        setEditMode(false);
        setPersonalInfoErrors({});
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'PERMISSION_DENIED') {
          setError('Sem permissões para carregar o perfil. Termine a sessão e volte a iniciar.');
          return;
        }
        if (msg === 'PROFILE_READ_FAILED') {
          setError('Não foi possível carregar os dados do perfil.');
          return;
        }
        setError('Não foi possível carregar os dados do perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivities() {
      if (!targetUserId) return;
      if (!isViewingOtherUser) {
        setActivities([]);
        return;
      }
      setActivitiesLoading(true);
      try {
        const migrantEmail =
          (typeof data?.profile?.email === 'string' && data.profile.email.trim()) ||
          (typeof data?.userProfile?.email === 'string' && data.userProfile.email.trim()) ||
          null;
        const sorted = await loadParticipantActivitiesForUser(targetUserId, {
          firestoreLimit: 200,
          participantEmail: migrantEmail,
        });
        if (cancelled) return;
        setActivities(
          sorted.slice(0, 40).map((r) => ({
            id: r.id,
            title: r.title || 'Atividade',
            date: r.date || '',
            status: r.status ?? null,
            durationMinutes: r.durationMinutes ?? null,
            startTime: r.startTime,
            endTime: r.endTime,
          }))
        );
      } catch (e) {
        console.error('ProfilePage: falha ao carregar atividades do migrante', e);
        if (cancelled) return;
        setActivities([]);
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    }
    void loadActivities();
    return () => {
      cancelled = true;
    };
  }, [isViewingOtherUser, targetUserId, data?.profile?.email, data?.userProfile?.email]);

  const sessionsSorted = useMemo(() => {
    return (data?.sessions || []).slice().sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  }, [data?.sessions]);

  const progressSorted = useMemo(() => {
    return (data?.progress || []).slice().sort((a, b) => (b.progress_percent || 0) - (a.progress_percent || 0));
  }, [data?.progress]);

  const profileDoc: MigrantProfileDoc | null = data?.profile || null;
  const triage = data?.triage || null;
  const needsProfile = useMemo(() => inferNeedsProfile(triage), [triage]);
  const triageAnswers = useMemo(() => {
    const a = triage?.answers;
    return a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
  }, [triage?.answers]);

  const profileReadOnlyFields = useMemo(() => {
    const triagePhone = typeof triageAnswers.phone === 'string' ? triageAnswers.phone : null;
    const triageBirthDate = typeof triageAnswers.birth_date === 'string' ? triageAnswers.birth_date : null;
    const triageNationality = typeof triageAnswers.nationality === 'string' ? triageAnswers.nationality : null;

    const rawPhone = profileDoc?.phone || triagePhone || '';
    const phone = rawPhone ? formatPhoneValueForDisplay(rawPhone) : '';

    const rawBirth = profileDoc?.birthDate || triageBirthDate || '';
    const birth = (() => {
      if (!rawBirth) return '';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawBirth);
      if (!m) return rawBirth;
      return `${m[3]}/${m[2]}/${m[1]}`;
    })();

    const nationality = profileDoc?.nationality || triageNationality || '';

    return { phone, birth, nationality };
  }, [profileDoc?.birthDate, profileDoc?.nationality, profileDoc?.phone, triageAnswers]);

  const translateOption = useCallback((questionId: string, value: string) => {
    const key = `triage.options.${questionId}.${value}`;
    const label = t.get(key);
    return label === key ? value : label;
  }, [t]);

  const legalStatusLabel = useMemo(() => {
    const raw = triage?.legal_status || (typeof triageAnswers.legal_status === 'string' ? triageAnswers.legal_status : null);
    if (!raw) return null;
    return translateOption('legal_status', raw);
  }, [triage?.legal_status, triageAnswers.legal_status, translateOption]);

  const arrivedSinceLabel = useMemo(() => {
    const raw =
      (typeof triageAnswers.arrival_date_pt === 'string' ? triageAnswers.arrival_date_pt : null) ||
      (typeof triageAnswers.arrival_date === 'string' ? triageAnswers.arrival_date : null) ||
      null;
    if (!raw) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)?.[0] || null;
    if (!iso) return raw;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return raw;
    const label = d.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
    return label ? label.replace(/\.$/, '') : raw;
  }, [triageAnswers]);

  const integrationScales = useMemo(() => {
    const scale = (id: string) => {
      const v = triageAnswers[id];
      const str = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
      const n = str ? Number(str) : NaN;
      const normalized = Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
      const percent = normalized ? normalized * 20 : 0;
      const label = normalized ? translateOption(id, String(normalized)) : '—';
      return { value: normalized, percent, label };
    };
    return {
      dailyAutonomy: scale('daily_autonomy'),
      communicationComfort: scale('communication_comfort'),
      socialNorms: scale('social_norms'),
    };
  }, [triageAnswers, translateOption]);

  const identifiedNeeds = useMemo(() => {
    const raw = (triage?.urgencies || []) as unknown;
    const values = Array.isArray(raw) ? (raw.filter((v) => typeof v === 'string' && v.trim().length > 0) as string[]) : [];
    return values.map((v) => ({ value: v, label: translateOption('identified_needs', v) }));
  }, [triage?.urgencies, translateOption]);

  const educationLabel = useMemo(() => {
    const raw = triageAnswers.education_level;
    if (typeof raw !== 'string' || !raw) return '—';
    return translateOption('education_level', raw);
  }, [triageAnswers.education_level, translateOption]);

  const interestAreaLabel = useMemo(() => {
    const raw = triageAnswers.professional_interests;
    const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    const first = (arr.find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined) || null;
    if (!first) return null;
    return translateOption('professional_interests', first);
  }, [triageAnswers.professional_interests, translateOption]);

  const skillsTokens = useMemo(() => {
    const tokens = (edit.skills || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens)).slice(0, 6);
  }, [edit.skills]);

  const interfaceLanguageLabel = useMemo(() => {
    if (language === 'pt') return 'Português';
    if (language === 'en') return 'English';
    return language;
  }, [language]);

  const contactPreferenceLabel = useMemo(() => {
    return edit.contactPreference === 'phone' ? 'Telefone' : 'E-mail';
  }, [edit.contactPreference]);

  const upcomingSessions = useMemo(() => {
    const now = todayIsoAppCalendar();
    return sessionsSorted.filter((s) => s.scheduled_date >= now).slice(0, 3);
  }, [sessionsSorted]);

  const featuredTrail = useMemo(() => {
    return progressSorted.length ? progressSorted[0] : null;
  }, [progressSorted]);

  const REGIONS = useMemo(() => ['Lisboa', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Outra'] as const, []);

  useEffect(() => {
    const next = profileDoc?.availableForWork === true;
    setAvailableForWork(next);
  }, [profileDoc?.availableForWork]);

  const normalizeCepInput = useCallback((raw: string) => {
    return raw.replace(/[^\d-]/g, '').slice(0, 14);
  }, []);

  const validateCep = useCallback((value: string, required: boolean): string | null => {
    const v = value.trim();
    if (!v) return required ? 'O CEP é obrigatório.' : null;
    if (!/^[\d-]+$/.test(v)) return 'Use apenas números e hífen.';
    const digits = v.replace(/\D/g, '');
    if (digits.length < 4 || digits.length > 9) return 'Indique um CEP válido (ex.: 1000-001).';
    return null;
  }, []);

  useEffect(() => {
    if (!editMode) {
      cepLookupSeq.current += 1;
      cepWhenEditOpenedRef.current = null;
      locationFieldsManualRef.current = false;
      setCepLookupStatus('idle');
      setCepLookupMessage(null);
      return;
    }
    cepWhenEditOpenedRef.current = edit.cep;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot do CEP só ao entrar em modo edição, não a cada tecla
  }, [editMode]);

  useEffect(() => {
    if (!editMode) return;

    const d7 = cepDigitsPortugal(edit.cep);
    const openedDigits = (cepWhenEditOpenedRef.current || '').replace(/\D/g, '');
    const cepUnchangedSinceOpen = !!(d7 && openedDigits.length === 7 && d7 === openedDigits);

    if (!d7 || cepUnchangedSinceOpen || locationFieldsManualRef.current) {
      setCepLookupStatus('idle');
      setCepLookupMessage(null);
      return;
    }

    const seq = ++cepLookupSeq.current;
    setCepLookupStatus('loading');
    setCepLookupMessage(null);

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await lookupAddressFromPortugalCep(edit.cep);
          if (seq !== cepLookupSeq.current) return;
          if (!result) {
            setCepLookupStatus('error');
            setCepLookupMessage('Não foi possível sugerir morada para este CEP.');
            return;
          }
          let applied = false;
          setEdit((s) => {
            if (locationFieldsManualRef.current || seq !== cepLookupSeq.current) return s;
            applied = true;
            return {
              ...s,
              cep: formatPortugalCepDigits(d7),
              address: result.addressLine,
              region: result.region,
              regionOther: result.region === 'Outra' ? result.regionOther : '',
            };
          });
          queueMicrotask(() => {
            if (seq !== cepLookupSeq.current) return;
            if (!applied) return;
            if (locationFieldsManualRef.current) {
              setCepLookupStatus('idle');
              setCepLookupMessage(null);
              return;
            }
            setCepLookupStatus('ok');
            setCepLookupMessage('Morada e região sugeridas a partir do CEP. Pode ajustar se necessário.');
          });
        } catch {
          if (seq !== cepLookupSeq.current) return;
          setCepLookupStatus('error');
          setCepLookupMessage('Não foi possível consultar o CEP.');
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(t);
    };
  }, [editMode, edit.cep]);

  async function save() {
    if (!user || !targetUserId) return;
    const nextErrors: Partial<Record<'phone' | 'birthDate' | 'nationality' | 'address' | 'addressNumber' | 'cep' | 'region' | 'regionOther', string>> = {};
    const addressTrim = edit.address.trim();
    const addressNumberTrim = edit.addressNumber.trim();
    const cepTrim = edit.cep.trim();
    const regionTrim = edit.region;
    const regionOtherTrim = edit.regionOther.trim();
    const phoneTrim = edit.phone.trim();
    const birthDateTrim = edit.birthDate.trim();
    const nationalityTrim = edit.nationality.trim();

    if (isViewingOtherUser) {
      if (!addressTrim) nextErrors.address = 'A Morada é obrigatória.';
      else if (addressTrim.length < 10) nextErrors.address = 'A Morada deve ter pelo menos 10 caracteres.';

      if (!addressNumberTrim) nextErrors.addressNumber = 'O Número é obrigatório.';
      else if (addressNumberTrim.length > 20) nextErrors.addressNumber = 'O Número deve ter no máximo 20 caracteres.';

      const cepErr = validateCep(cepTrim, true);
      if (cepErr) nextErrors.cep = cepErr;

      if (!regionTrim) nextErrors.region = 'A Região é obrigatória.';
      else if (!(REGIONS as readonly string[]).includes(regionTrim)) nextErrors.region = 'A Região selecionada é inválida.';

      if (regionTrim === 'Outra') {
        if (!regionOtherTrim) nextErrors.regionOther = 'Indique a Região.';
        else if (regionOtherTrim.length < 2) nextErrors.regionOther = 'Indique uma Região válida.';
      }
    } else {
      if (addressTrim && addressTrim.length < 10) nextErrors.address = 'A Morada deve ter pelo menos 10 caracteres.';

      if (addressNumberTrim && addressNumberTrim.length > 20) nextErrors.addressNumber = 'O Número deve ter no máximo 20 caracteres.';

      if (cepTrim) {
        const cepErr = validateCep(cepTrim, false);
        if (cepErr) nextErrors.cep = cepErr;
      }

      if (regionTrim && !(REGIONS as readonly string[]).includes(regionTrim)) nextErrors.region = 'A Região selecionada é inválida.';

      if (regionTrim === 'Outra') {
        if (!regionOtherTrim) nextErrors.regionOther = 'Indique a Região.';
        else if (regionOtherTrim.length < 2) nextErrors.regionOther = 'Indique uma Região válida.';
      }
    }

    if (phoneTrim) {
      const digits = phoneTrim.replace(/\D+/g, '');
      if (digits.length < 9) nextErrors.phone = 'Indique um telefone válido.';
    }
    if (birthDateTrim && !/^(\d{4})-(\d{2})-(\d{2})$/.test(birthDateTrim)) nextErrors.birthDate = 'Indique uma data válida.';
    if (nationalityTrim && nationalityTrim.length < 2) nextErrors.nationality = 'Indique uma nacionalidade válida.';

    setPersonalInfoErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setPersonalInfoErrors({});
    setSaving(true);
    try {

      const payload: Record<string, unknown> = {
        name: edit.name,
        resumeUrl: edit.resumeUrl || null,
        professionalTitle: edit.professionalTitle || null,
        professionalExperience: edit.professionalExperience || null,
        skills: edit.skills || null,
        languagesList: edit.languagesList || null,
        contactPreference: edit.contactPreference || null,
      };

      if (phoneTrim) payload.phone = phoneTrim;
      if (birthDateTrim) payload.birthDate = birthDateTrim;
      if (nationalityTrim) payload.nationality = nationalityTrim;

      // Ano de Registo: '' = não definido (mantém null); número válido = persiste.
      const yearStr = edit.registrationYear.trim();
      if (yearStr) {
        const yearNum = Number.parseInt(yearStr, 10);
        if (Number.isFinite(yearNum) && yearNum >= 1900 && yearNum <= 2200) {
          payload.registrationYear = yearNum;
        }
      } else {
        payload.registrationYear = null;
      }

      if (isViewingOtherUser) {
        payload.address = addressTrim;
        payload.addressNumber = addressNumberTrim;
        payload.cep = cepTrim;
        payload.region = regionTrim;
        payload.regionOther = regionTrim === 'Outra' ? regionOtherTrim : null;
      } else {
        if (addressTrim) payload.address = addressTrim;
        if (addressNumberTrim) payload.addressNumber = addressNumberTrim;
        if (cepTrim) payload.cep = cepTrim;
        if (regionTrim) {
          payload.region = regionTrim;
          payload.regionOther = regionTrim === 'Outra' ? regionOtherTrim || null : null;
        }
      }

      await updateDocument('profiles', targetUserId, payload);

      const res = await fetchMigrantProfile(targetUserId);
      setData(res);
      const p = res.profile;
      const merged = p ? mergeProfileWithExtrasForUser(p, targetUserId) : null;
      setEdit(buildEditStateFromMergedProfile(res, merged));
      setEditMode(false);
      setPersonalInfoErrors({});
      setProfileSaveFeedback('saved');
      toast({ title: 'Perfil guardado', description: 'As alterações foram guardadas com sucesso.' });
      if (targetUserId === user.uid) void refreshProfile();
    } catch {
      setProfileSaveFeedback('error');
      toast({
        title: 'Não foi possível guardar',
        description: 'Verifique a ligação e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAvailability(nextChecked: boolean) {
    if (!targetUserId || isViewingOtherUser || updatingAvailability) return;
    const previous = availableForWork;
    setAvailableForWork(nextChecked);
    setUpdatingAvailability(true);
    try {
      await updateDocument('profiles', targetUserId, { availableForWork: nextChecked });
      setData((prev) => {
        if (!prev?.profile) return prev;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            availableForWork: nextChecked,
          },
        };
      });
      toast({
        title: nextChecked ? 'Disponível para trabalho' : 'Indisponível para trabalho',
        description: nextChecked
          ? 'Agora o seu perfil pode aparecer na listagem de candidatos para empresas.'
          : 'O seu perfil deixou de aparecer na listagem de candidatos para empresas.',
      });
    } catch {
      setAvailableForWork(previous);
      toast({
        title: 'Não foi possível atualizar',
        description: 'Tente novamente em alguns segundos.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingAvailability(false);
    }
  }

  async function handleExportFicha() {
    if (!targetUserId || exportingFicha) return;
    const profile = data?.profile || null;
    if (!profile || (!profile.name && !profile.email)) {
      toast({ title: 'Dados insuficientes', description: 'Não existem dados suficientes para gerar a ficha.', variant: 'destructive' });
      return;
    }

    // Prossiga mesmo sem dados de progresso; as secções serão apresentadas vazias.

    setExportingFicha(true);
    try {
      const [{ PDFDocument, StandardFonts, rgb }, activities] = await Promise.all([
        import('pdf-lib'),
        loadParticipantActivitiesForUser(targetUserId, {
          firestoreLimit: 200,
          participantEmail:
            (typeof data?.profile?.email === 'string' && data.profile.email.trim()) ||
            (typeof data?.userProfile?.email === 'string' && data.userProfile.email.trim()) ||
            null,
        }).catch(() => []),
      ]);

      const fileDate = todayIsoAppCalendar();
      const safeName = (profile.name || profile.email || 'Migrante')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'Migrante';
      const fileName = `Ficha_Migrante_${safeName}_${fileDate}.pdf`;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const branding = await fetchDocumentBranding().catch(() => defaultBranding());
      const embeddedBranding = await embedBrandingImagesForPdfLib(pdfDoc, branding);

      const pageSize: [number, number] = [595.28, 841.89];
      const marginX = 48;
      const marginTop = marginX + PDF_BRANDING_HEADER_HEIGHT_PT;
      const marginBottom = marginX + PDF_BRANDING_FOOTER_HEIGHT_PT;
      const lineGap = 4;

      const newPage = () => pdfDoc.addPage(pageSize);

      const wrapText = (text: string, maxWidth: number, size: number, useBold: boolean) => {
        const f = useBold ? fontBold : font;
        const words = String(text || '').split(/\s+/g).filter(Boolean);
        if (words.length === 0) return ['—'];
        const lines: string[] = [];
        let current = '';
        words.forEach((w) => {
          const next = current ? `${current} ${w}` : w;
          const width = f.widthOfTextAtSize(next, size);
          if (width <= maxWidth) {
            current = next;
            return;
          }
          if (current) lines.push(current);
          current = w;
        });
        if (current) lines.push(current);
        return lines.length ? lines : ['—'];
      };

      let page = newPage();
      let cursorY = page.getSize().height - marginTop;
      const maxTextWidth = page.getSize().width - marginX * 2;

      const ensureSpace = (neededHeight: number) => {
        if (cursorY - neededHeight >= marginBottom) return;
        page = newPage();
        cursorY = page.getSize().height - marginTop;
      };

      const drawTitle = (text: string) => {
        const size = 12;
        ensureSpace(size + 10);
        page.drawText(text, { x: marginX, y: cursorY, size, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        cursorY -= size + 10;
      };

      const drawKeyValue = (label: string, value: string) => {
        const labelSize = 10;
        const valueSize = 10;
        const labelWidth = 170;
        const valueX = marginX + labelWidth;
        const lines = wrapText(value || '—', maxTextWidth - labelWidth, valueSize, false);
        const blockHeight = lines.length * (valueSize + lineGap) + 2;
        ensureSpace(blockHeight + 6);
        page.drawText(label, { x: marginX, y: cursorY, size: labelSize, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        lines.forEach((line, idx) => {
          page.drawText(line, { x: valueX, y: cursorY - idx * (valueSize + lineGap), size: valueSize, font, color: rgb(0.1, 0.1, 0.1) });
        });
        cursorY -= blockHeight + 6;
      };

      const drawBullets = (items: Array<{ title: string; meta?: string | null }>, emptyLabel: string = 'Sem registos') => {
        const size = 10;
        const bullet = '•';
        if (items.length === 0) {
          ensureSpace(size + 8);
          page.drawText(emptyLabel, { x: marginX, y: cursorY, size, font, color: rgb(0.35, 0.35, 0.35) });
          cursorY -= size + 8;
          return;
        }
        items.forEach((it) => {
          const text = it.meta ? `${it.title} (${it.meta})` : it.title;
          const lines = wrapText(text, maxTextWidth - 14, size, false);
          const blockHeight = lines.length * (size + lineGap) + 6;
          ensureSpace(blockHeight);
          page.drawText(bullet, { x: marginX, y: cursorY, size, font, color: rgb(0.1, 0.1, 0.1) });
          lines.forEach((line, idx) => {
            page.drawText(line, { x: marginX + 14, y: cursorY - idx * (size + lineGap), size, font, color: rgb(0.1, 0.1, 0.1) });
          });
          cursorY -= blockHeight;
        });
      };

      const birthDate = profileReadOnlyFields.birth || '—';
      const nationality = profileReadOnlyFields.nationality || '—';
      const phone = profileReadOnlyFields.phone || '—';
      const addressValue = (profile.address || '').trim() || '—';
      const addressNumberValue = (typeof profile.addressNumber === 'string' && profile.addressNumber.trim()) || '—';
      const cepValue =
        (typeof profile.cep === 'string' && profile.cep.trim()) ||
        (typeof profile.identificationNumber === 'string' && profile.identificationNumber.trim()) ||
        '—';
      const regionValue = (() => {
        const r = typeof profile.region === 'string' ? profile.region : '';
        if (!r) return '—';
        if (r === 'Outra') return (profile.regionOther || '—');
        return r;
      })();

      drawTitle('Ficha de Inscrição');
      drawKeyValue('Nome completo', profile.name || '—');
      drawKeyValue('Morada', addressValue);
      drawKeyValue('Número', addressNumberValue);
      drawKeyValue('CEP', cepValue);
      drawKeyValue('Região', regionValue);
      drawKeyValue('Telefone', phone);
      drawKeyValue('E-mail', profile.email || '—');
      drawKeyValue('Data de nascimento', birthDate);
      drawKeyValue('Nacionalidade', nationality);

      const progress = (data?.progress || []).map((p) => ({
        ...p,
        progress_percent: typeof p.progress_percent === 'number' ? p.progress_percent : 0,
      }));
      const pdiPercent = progress.length ? Math.round(progress.reduce((acc, p) => acc + (p.progress_percent || 0), 0) / progress.length) : 0;
      const trails = data?.trails || {};

      const completedTrails = progress
        .filter((p) => (p.progress_percent || 0) >= 100 || !!p.completed_at)
        .map((p) => {
          const trail = trails[p.trail_id] || null;
          const title = trail?.title || p.trail_id || 'Trilha';
          const date = p.completed_at ? new Date(p.completed_at).toLocaleDateString('pt-PT') : null;
          return { title, meta: [date, 'Avaliação: —'].filter(Boolean).join(' · ') };
        });

      const inProgressTrails = progress
        .filter((p) => (p.progress_percent || 0) > 0 && (p.progress_percent || 0) < 100 && !p.completed_at)
        .map((p) => {
          const trail = trails[p.trail_id] || null;
          const title = trail?.title || p.trail_id || 'Trilha';
          const pct = `${Math.round(p.progress_percent || 0)}%`;
          const modules = (() => {
            const done = typeof p.modules_completed === 'number' ? p.modules_completed : null;
            const total = typeof trail?.modules_count === 'number' ? trail.modules_count : null;
            if (done === null || total === null) return null;
            return `${done}/${total} módulos`;
          })();
          return { title, meta: [pct, modules].filter(Boolean).join(' · ') };
        });

      const sessionsDone = (data?.sessions || []).filter((s) => (s.status || '').toLowerCase() === 'completed' || (s.status || '').toLowerCase() === 'concluida');
      const sessionsMissed = (data?.sessions || []).filter((s) => (s.status || '').toLowerCase() === 'missed' || (s.status || '').toLowerCase() === 'faltou');

      const sessionsItems = sessionsDone.map((s) => {
        const date = s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString('pt-PT') : '—';
        const meta = [`${date} ${s.scheduled_time || ''}`.trim(), 'Observações: —'].filter(Boolean).join(' · ');
        const title = s.session_type ? `Sessão (${s.session_type})` : 'Sessão';
        return { title, meta };
      });

      const activityItems = activities.map((a) => {
        const dateStr = a.date ? new Date(a.date).toLocaleDateString('pt-PT') : '';
        const dur = formatActivityDurationShort(a);
        const primary = [dateStr || null, dur].filter(Boolean).join(' • ');
        const meta = [primary || null, a.status ? `Estado: ${formatActivityStatusListLabel(a.status)}` : null].filter(Boolean).join(' · ');
        return { title: a.title || 'Atividade', meta: meta || undefined };
      });

      drawTitle('Relatório de Progresso');
      drawKeyValue('Conclusão do Plano de Desenvolvimento Individual', `${pdiPercent}%`);

      drawTitle('Trilhas formativas concluídas');
      drawBullets(completedTrails);

      drawTitle('Trilhas em curso');
      drawBullets(inProgressTrails);

      drawTitle('Sessões individuais realizadas');
      drawBullets(sessionsItems);

      drawTitle('Atividades participadas');
      drawBullets(activityItems);

      drawTitle('Histórico de presenças e faltas');
      drawKeyValue('Presenças (sessões concluídas)', String(sessionsDone.length));
      drawKeyValue('Faltas (sessões marcadas como falta)', String(sessionsMissed.length));

      drawTitle('Observações gerais');
      drawKeyValue('Desempenho', (profile.mainNeeds || '').trim() || '—');

      applyBrandingToAllPdfLibPages(pdfDoc, font, embeddedBranding, branding, 'Ficha do Migrante');

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        void 0;
      }

      toast({ title: 'Ficha exportada', description: 'O PDF foi gerado e o download foi iniciado.' });
    } catch (err) {
      console.error('Erro ao exportar ficha:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF da ficha do migrante.', variant: 'destructive' });
    } finally {
      setExportingFicha(false);
    }
  }

  async function handleExportTriagem() {
    if (!targetUserId || exportingTriagem) return;
    if (!canExportCpcData) {
      toast({ title: 'Sem permissão', description: 'A sua conta não tem permissões para exportar a Situação Inicial deste perfil.', variant: 'destructive' });
      return;
    }

    const profile = data?.profile || null;
    const triageDoc = data?.triage || null;
    const answersRaw = triageDoc?.answers && typeof triageDoc.answers === 'object' ? (triageDoc.answers as Record<string, unknown>) : null;
    const hasAnyAnswer = !!answersRaw && Object.values(answersRaw).some((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'number') return true;
      if (typeof v === 'boolean') return true;
      if (Array.isArray(v)) return v.some((x) => typeof x === 'string' ? x.trim().length > 0 : x !== null && x !== undefined);
      return true;
    });

    if (!profile || (!profile.name && !profile.email)) {
      toast({ title: 'Dados insuficientes', description: 'Não existem dados suficientes do perfil para exportar a Situação Inicial.', variant: 'destructive' });
      return;
    }

    if (!triageDoc || !hasAnyAnswer) {
      toast({ title: 'Sem dados de Situação Inicial', description: 'Não existem respostas de Situação Inicial associadas a este perfil.', variant: 'destructive' });
      return;
    }

    setExportingTriagem(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

      const fileDate = todayIsoAppCalendar();
      const safeName = (profile.name || profile.email || 'Migrante')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'Migrante';
      const fileName = `Situacao_Inicial_Migrante_${safeName}_${fileDate}.pdf`;

      const completedAt = typeof triageDoc.completedAt === 'string' ? triageDoc.completedAt : null;
      const completedAtLabel = (() => {
        if (!completedAt) return null;
        const d = new Date(completedAt);
        if (Number.isNaN(d.getTime())) return completedAt;
        return d.toLocaleString('pt-PT');
      })();

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const branding = await fetchDocumentBranding().catch(() => defaultBranding());
      const embeddedBranding = await embedBrandingImagesForPdfLib(pdfDoc, branding);

      const pageSize: [number, number] = [595.28, 841.89];
      const marginX = 48;
      const marginTop = marginX + PDF_BRANDING_HEADER_HEIGHT_PT;
      const marginBottom = marginX + PDF_BRANDING_FOOTER_HEIGHT_PT;
      const lineGap = 4;

      const newPage = () => pdfDoc.addPage(pageSize);

      const wrapText = (text: string, maxWidth: number, size: number, useBold: boolean) => {
        const f = useBold ? fontBold : font;
        const words = String(text || '').split(/\s+/g).filter(Boolean);
        if (words.length === 0) return ['—'];
        const lines: string[] = [];
        let current = '';
        words.forEach((w) => {
          const next = current ? `${current} ${w}` : w;
          const width = f.widthOfTextAtSize(next, size);
          if (width <= maxWidth) {
            current = next;
            return;
          }
          if (current) lines.push(current);
          current = w;
        });
        if (current) lines.push(current);
        return lines.length ? lines : ['—'];
      };

      let page = newPage();
      let cursorY = page.getSize().height - marginTop;
      const maxTextWidth = page.getSize().width - marginX * 2;

      const ensureSpace = (neededHeight: number) => {
        if (cursorY - neededHeight >= marginBottom) return;
        page = newPage();
        cursorY = page.getSize().height - marginTop;
      };

      const drawTitle = (text: string) => {
        const size = 12;
        ensureSpace(size + 10);
        page.drawText(text, { x: marginX, y: cursorY, size, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        cursorY -= size + 10;
      };

      const drawKeyValue = (label: string, value: string) => {
        const labelSize = 10;
        const valueSize = 10;
        const labelWidth = 170;
        const valueX = marginX + labelWidth;
        const lines = wrapText(value || '—', maxTextWidth - labelWidth, valueSize, false);
        const blockHeight = lines.length * (valueSize + lineGap) + 2;
        ensureSpace(blockHeight + 6);
        page.drawText(label, { x: marginX, y: cursorY, size: labelSize, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        lines.forEach((line, idx) => {
          page.drawText(line, { x: valueX, y: cursorY - idx * (valueSize + lineGap), size: valueSize, font, color: rgb(0.1, 0.1, 0.1) });
        });
        cursorY -= blockHeight + 6;
      };

      const drawQuestionAnswer = (question: string, answer: string, meta?: string | null) => {
        const qSize = 10;
        const aSize = 10;
        const metaSize = 9;
        const qLines = wrapText(question || '—', maxTextWidth, qSize, true);
        const aLines = wrapText(answer || '—', maxTextWidth, aSize, false);
        const metaLines = meta ? wrapText(meta, maxTextWidth, metaSize, false) : [];
        const blockHeight =
          qLines.length * (qSize + lineGap) +
          2 +
          aLines.length * (aSize + lineGap) +
          2 +
          (metaLines.length ? metaLines.length * (metaSize + lineGap) + 4 : 0) +
          8;
        ensureSpace(blockHeight);

        qLines.forEach((line, idx) => {
          page.drawText(line, { x: marginX, y: cursorY - idx * (qSize + lineGap), size: qSize, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
        });
        cursorY -= qLines.length * (qSize + lineGap) + 2;

        aLines.forEach((line, idx) => {
          page.drawText(line, { x: marginX, y: cursorY - idx * (aSize + lineGap), size: aSize, font, color: rgb(0.08, 0.08, 0.08) });
        });
        cursorY -= aLines.length * (aSize + lineGap) + 2;

        if (metaLines.length) {
          metaLines.forEach((line, idx) => {
            page.drawText(line, { x: marginX, y: cursorY - idx * (metaSize + lineGap), size: metaSize, font, color: rgb(0.4, 0.4, 0.4) });
          });
          cursorY -= metaLines.length * (metaSize + lineGap) + 2;
        }

        cursorY -= 6;
      };

      const makeQuestionLabel = (id: string) => {
        const key = `triage.questions.${id}`;
        const label = t.get(key);
        return label === key ? id : label;
      };

      const translateOptionForQuestion = (questionId: string, value: string) => {
        const key = `triage.options.${questionId}.${value}`;
        const label = t.get(key);
        return label === key ? value : label;
      };

      const formatAnswer = (questionId: string, value: unknown) => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
          const v = value.trim();
          if (!v) return '—';
          return translateOptionForQuestion(questionId, v);
        }
        if (Array.isArray(value)) {
          const items = value
            .map((v) => typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : '')
            .filter((v) => v.length > 0)
            .map((v) => translateOptionForQuestion(questionId, v));
          return items.length ? items.join(', ') : '—';
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      };

      drawTitle('Identificação');
      drawKeyValue('Nome completo', profile.name || '—');
      drawKeyValue('E-mail', profile.email || '—');
      drawKeyValue('ID do perfil', targetUserId);
      drawKeyValue('Estado da Situação Inicial', triageDoc.completed ? 'Concluída' : 'Em curso');
      if (completedAtLabel) drawKeyValue('Data/hora de submissão', completedAtLabel);

      drawTitle('Respostas');
      const meta = completedAtLabel ? `Respondido em ${completedAtLabel}` : null;
      const entries = Object.entries(answersRaw)
        .map(([id, v]) => ({ id, question: makeQuestionLabel(id), value: v }))
        .sort((a, b) => a.question.localeCompare(b.question, 'pt'));

      entries.forEach((it) => {
        drawQuestionAnswer(it.question, formatAnswer(it.id, it.value), meta);
      });

      applyBrandingToAllPdfLibPages(pdfDoc, font, embeddedBranding, branding, 'Situação Inicial do Migrante');

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        void 0;
      }

      toast({ title: 'Situação Inicial exportada', description: 'O PDF foi gerado e o download foi iniciado.' });
    } catch (err) {
      console.error('Erro ao exportar Situação Inicial:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF da Situação Inicial do migrante.', variant: 'destructive' });
    } finally {
      setExportingTriagem(false);
    }
  }

  async function uploadProfilePhoto(file: File) {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isAllowedByExt = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt);
    const isAllowedByMime = file.type ? PHOTO_ALLOWED_MIME.has(file.type) : false;

    if (!user || !targetUserId) {
      toast({ title: 'Sessão expirada', description: 'Inicie sessão novamente e tente outra vez.', variant: 'destructive' });
      return;
    }

    if (!isAllowedByMime && !isAllowedByExt) {
      toast({
        title: 'Formato não suportado',
        description: 'Envie uma imagem JPG, PNG ou GIF (máx. 5MB).',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > PHOTO_MAX_BYTES) {
      toast({ title: 'Imagem muito grande', description: 'O limite é 5MB.', variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    let stage: 'upload' | 'url' | 'db' = 'upload';
    try {
      const safeName = file.name.replace(/[^\w.+-]+/g, '-').slice(0, 80) || 'foto';
      const path = `profile_photos/${targetUserId}/${Date.now()}-${safeName}`;
      const ref = makeStorageRef(storage, path);

      stage = 'upload';
      await uploadBytes(ref, file, { contentType: file.type || undefined });

      stage = 'url';
      const url = await getDownloadURL(ref);

      stage = 'db';
      await updateDocument('profiles', targetUserId, { photoUrl: url });

      setData((prev) => {
        if (!prev) return prev;
        if (!prev.profile) return prev;
        return { ...prev, profile: { ...prev.profile, photoUrl: url } };
      });
      if (targetUserId === user.uid) await refreshProfile();
      toast({ title: 'Foto atualizada', description: 'A sua foto de perfil foi atualizada com sucesso.' });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';

      if (stage === 'upload') {
        if (code === 'storage/unauthorized') {
          toast({ title: 'Sem permissão', description: 'Não tem permissão para enviar imagens. Verifique as permissões da conta.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/canceled') {
          toast({ title: 'Upload cancelado', description: 'O envio foi cancelado.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/retry-limit-exceeded' || code === 'storage/network-request-failed') {
          toast({ title: 'Falha de conexão', description: 'Não foi possível enviar a imagem. Verifique a sua ligação e tente novamente.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/quota-exceeded') {
          toast({ title: 'Limite excedido', description: 'O serviço de armazenamento atingiu o limite. Tente novamente mais tarde.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Erro no upload', description: 'Não foi possível enviar a imagem. Tente novamente.', variant: 'destructive' });
        return;
      }

      if (stage === 'url') {
        if (code === 'storage/unauthorized') {
          toast({ title: 'Sem permissão', description: 'Não tem permissão para aceder ao ficheiro enviado.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/retry-limit-exceeded' || code === 'storage/network-request-failed') {
          toast({ title: 'Falha de conexão', description: 'Não foi possível obter a URL da imagem. Tente novamente.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Erro ao obter URL', description: 'A imagem foi enviada, mas não foi possível obter o link para exibição.', variant: 'destructive' });
        return;
      }

      if (stage === 'db') {
        if (code === 'permission-denied') {
          toast({ title: 'Sem permissão', description: 'Não foi possível atualizar o perfil com a nova foto. Verifique permissões.', variant: 'destructive' });
          return;
        }
        if (code === 'unavailable' || code === 'deadline-exceeded') {
          toast({ title: 'Servidor indisponível', description: 'Não foi possível guardar o link da imagem no perfil. Tente novamente.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Erro ao guardar', description: 'A imagem foi enviada, mas não foi possível associá-la ao perfil.', variant: 'destructive' });
        return;
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removeProfilePhoto() {
    if (!user || !targetUserId) return;
    setUploadingPhoto(true);
    try {
      await updateDocument('profiles', targetUserId, { photoUrl: null });
      setData((prev) => {
        if (!prev) return prev;
        if (!prev.profile) return prev;
        return { ...prev, profile: { ...prev.profile, photoUrl: null } };
      });
      if (targetUserId === user.uid) await refreshProfile();
      toast({ title: 'Foto removida' });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      if (code === 'permission-denied') {
        toast({ title: 'Sem permissão', description: 'Não foi possível remover a foto do perfil. Verifique permissões.', variant: 'destructive' });
        return;
      }
      if (code === 'unavailable' || code === 'deadline-exceeded') {
        toast({ title: 'Falha de conexão', description: 'Não foi possível remover a foto. Verifique a ligação e tente novamente.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Erro', description: 'Não foi possível remover a foto. Tente novamente.', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <div className="py-12 text-center text-muted-foreground">Precisa de iniciar sessão.</div>;
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!profileDoc) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Perfil não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isViewingOtherUser && needsProfile.items.length > 0 ? (
        <NeedsProfileCard profile={needsProfile} />
      ) : null}
      <div className="cpc-card p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 rounded-2xl">
                <AvatarImage src={profileDoc.photoUrl || undefined} alt={edit.name || profileDoc.email || 'Foto de perfil'} />
                <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground text-2xl font-semibold">
                  {(edit.name || profileDoc.email || 'U').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (file) void uploadProfilePhoto(file);
                }}
                disabled={uploadingPhoto}
              />

              {uploadingPhoto ? (
                <div className="absolute inset-0 rounded-2xl bg-background/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
                  <span className="text-xs font-medium text-muted-foreground">A enviar…</span>
                </div>
              ) : null}

              <button
                type="button"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border bg-background shadow-sm flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                aria-label="Alterar foto"
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {editMode ? (
                  <div className="w-full max-w-sm">
                    <Label htmlFor="profile-name" className="sr-only">
                      Nome
                    </Label>
                    <Input
                      id="profile-name"
                      value={edit.name}
                      onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                      className="h-10 text-base md:text-lg font-semibold"
                    />
                  </div>
                ) : (
                  <h1 className="text-xl md:text-2xl font-bold truncate">{edit.name || '—'}</h1>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{profileDoc.email || '—'}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {legalStatusLabel ? (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">
                    Situação: {legalStatusLabel}
                  </span>
                ) : null}
                {arrivedSinceLabel ? (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                    Portugal desde: {arrivedSinceLabel}
                  </span>
                ) : null}
                {!editMode && profileSaveFeedback === 'saved' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Alterações guardadas
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 md:items-end">
            {editMode && profileSaveFeedback === 'error' ? (
              <p role="alert" className="text-sm text-destructive flex items-center gap-1.5 md:justify-end">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                Não foi possível guardar as alterações.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {editMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    setPersonalInfoErrors({});
                    setProfileSaveFeedback(null);
                    setEdit({
                      name: profileDoc.name || data?.userProfile?.name || '',
                      phone: profileDoc.phone || (typeof triageAnswers.phone === 'string' ? triageAnswers.phone : '') || '',
                      birthDate: profileDoc.birthDate || (typeof triageAnswers.birth_date === 'string' ? triageAnswers.birth_date : '') || '',
                      nationality: profileDoc.nationality || (typeof triageAnswers.nationality === 'string' ? triageAnswers.nationality : '') || '',
                      resumeUrl: profileDoc.resumeUrl || '',
                      professionalTitle: profileDoc.professionalTitle || '',
                      professionalExperience: profileDoc.professionalExperience || '',
                      skills: profileDoc.skills || '',
                      languagesList: profileDoc.languagesList || '',
                      contactPreference: (profileDoc.contactPreference as 'email' | 'phone') || 'email',
                      address: profileDoc.address || '',
                      addressNumber: profileDoc.addressNumber || '',
                      cep:
                        (typeof profileDoc.cep === 'string' && profileDoc.cep.trim()) ||
                        (typeof profileDoc.identificationNumber === 'string' && profileDoc.identificationNumber.trim()) ||
                        '',
                      region: (profileDoc.region as typeof edit.region) || '',
                      regionOther: profileDoc.regionOther || '',
                      registrationYear:
                        typeof profileDoc.registrationYear === 'number' && Number.isFinite(profileDoc.registrationYear)
                          ? String(profileDoc.registrationYear)
                          : (() => {
                              const y = extractYearFromRegisteredAt(
                                profileDoc.registeredAt ?? data?.userProfile?.createdAt
                              );
                              return y ? String(y) : '';
                            })(),
                    });
                  }}
                  disabled={saving || uploadingPhoto}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={save} disabled={saving || uploadingPhoto}>
                  {saving ? 'A guardar…' : 'Guardar alterações'}
                </Button>
              </>
            ) : (
              <>
                {!isViewingOtherUser ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Label htmlFor="available-for-work-switch" className="text-sm font-medium cursor-pointer">
                      Disponível para Trabalho
                    </Label>
                    <Switch
                      id="available-for-work-switch"
                      checked={availableForWork}
                      disabled={updatingAvailability || uploadingPhoto}
                      onCheckedChange={(checked) => {
                        void handleToggleAvailability(checked === true);
                      }}
                      aria-label="Disponível para Trabalho"
                    />
                  </div>
                ) : null}
                {isViewingOtherUser ? (
                  <>
                    <Button type="button" variant="outline" onClick={handleExportFicha} disabled={uploadingPhoto || exportingFicha}>
                      {exportingFicha ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      {exportingFicha ? 'A gerar…' : 'Exportar Ficha'}
                    </Button>
                    {canExportCpcData ? (
                      <Button type="button" variant="outline" onClick={handleExportTriagem} disabled={uploadingPhoto || exportingTriagem}>
                        {exportingTriagem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                        {exportingTriagem ? 'A gerar…' : 'Exportar Situação Inicial'}
                      </Button>
                    ) : null}
                  </>
                ) : null}
                <Button
                  type="button"
                  onClick={() => {
                    setPersonalInfoErrors({});
                    setProfileSaveFeedback(null);
                    setEditMode(true);
                  }}
                  disabled={uploadingPhoto}
                >
                  Editar Perfil
                </Button>
                {!isViewingOtherUser ? (
                  <Button type="button" variant="outline" onClick={() => window.print()} disabled={uploadingPhoto}>
                    Exportar PDF
                  </Button>
                ) : null}
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Informação Pessoal</h2>
            <User className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Telefone</p>
              {editMode ? (
                <>
                  <Label htmlFor="profile-phone" className="sr-only">Telefone</Label>
                  <PhoneInput
                    id="profile-phone"
                    value={edit.phone}
                    onChange={(v) => {
                      setEdit((s) => ({ ...s, phone: v }));
                      if (personalInfoErrors.phone) setPersonalInfoErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    className="mt-2"
                  />
                  {personalInfoErrors.phone ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.phone}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">{profileReadOnlyFields.phone || '—'}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Nacionalidade</p>
              {editMode ? (
                <>
                  <Label htmlFor="profile-nationality" className="sr-only">Nacionalidade</Label>
                  <Input
                    id="profile-nationality"
                    aria-label="Nacionalidade"
                    value={edit.nationality}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEdit((s) => ({ ...s, nationality: v }));
                      if (personalInfoErrors.nationality) setPersonalInfoErrors((prev) => ({ ...prev, nationality: undefined }));
                    }}
                    className="mt-2"
                    placeholder="Ex.: Brasil"
                  />
                  {personalInfoErrors.nationality ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.nationality}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">{profileReadOnlyFields.nationality || '—'}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Data de nascimento</p>
              {editMode ? (
                <>
                  <Label htmlFor="profile-birth-date" className="sr-only">Data de nascimento</Label>
                  <Input
                    id="profile-birth-date"
                    aria-label="Data de nascimento"
                    type="date"
                    value={edit.birthDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEdit((s) => ({ ...s, birthDate: v }));
                      if (personalInfoErrors.birthDate) setPersonalInfoErrors((prev) => ({ ...prev, birthDate: undefined }));
                    }}
                    className="mt-2"
                  />
                  {personalInfoErrors.birthDate ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.birthDate}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">{profileReadOnlyFields.birth || '—'}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Ano de Registo</p>
              {editMode ? (
                <>
                  <Label htmlFor="profile-registration-year" className="sr-only">Ano de Registo</Label>
                  <Select
                    value={edit.registrationYear || '__unset__'}
                    onValueChange={(v) =>
                      setEdit((s) => ({ ...s, registrationYear: v === '__unset__' ? '' : v }))
                    }
                  >
                    <SelectTrigger id="profile-registration-year" aria-label="Ano de Registo" className="mt-2">
                      <SelectValue placeholder="Selecionar ano…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">Não definido</SelectItem>
                      {buildRegistrationYearOptions().map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ano em que entrou no programa CIBEA. Usado para fins estatísticos.
                  </p>
                </>
              ) : (
                <p className="mt-1 font-medium">
                  {typeof profileDoc.registrationYear === 'number' && Number.isFinite(profileDoc.registrationYear)
                    ? profileDoc.registrationYear
                    : '—'}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
                <div>
                  <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Morada</p>
                  {editMode ? (
                    <>
                      <Label htmlFor="profile-address" className="sr-only">Morada</Label>
                      <Input
                        id="profile-address"
                        aria-label="Morada"
                        value={edit.address}
                        onChange={(e) => {
                          cepLookupSeq.current += 1;
                          locationFieldsManualRef.current = true;
                          setCepLookupStatus('idle');
                          setCepLookupMessage(null);
                          const v = e.target.value;
                          setEdit((s) => ({ ...s, address: v }));
                          if (personalInfoErrors.address) setPersonalInfoErrors((prev) => ({ ...prev, address: undefined }));
                        }}
                        className="mt-2"
                        placeholder="Rua, avenida, etc."
                      />
                      {personalInfoErrors.address ? (
                        <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.address}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 font-medium">{profileDoc.address || profileDoc.currentLocation || '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Número</p>
                  {editMode ? (
                    <>
                      <Label htmlFor="profile-address-number" className="sr-only">Número</Label>
                      <Input
                        id="profile-address-number"
                        aria-label="Número"
                        value={edit.addressNumber}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, 20);
                          setEdit((s) => ({ ...s, addressNumber: v }));
                          if (personalInfoErrors.addressNumber) setPersonalInfoErrors((prev) => ({ ...prev, addressNumber: undefined }));
                        }}
                        className="mt-2"
                        placeholder="Ex.: 12"
                        maxLength={20}
                      />
                      {personalInfoErrors.addressNumber ? (
                        <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.addressNumber}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 font-medium">{(profileDoc.addressNumber || '').trim() || '—'}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">CEP</p>
              {editMode ? (
                <>
                  <Label htmlFor="profile-cep" className="sr-only">CEP</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="profile-cep"
                      aria-label="CEP"
                      value={edit.cep}
                      onChange={(e) => {
                        locationFieldsManualRef.current = false;
                        const v = normalizeCepInput(e.target.value);
                        setEdit((s) => ({ ...s, cep: v }));
                        if (personalInfoErrors.cep) setPersonalInfoErrors((prev) => ({ ...prev, cep: undefined }));
                      }}
                      className="flex-1"
                      placeholder="Ex.: 1000-001"
                      inputMode="numeric"
                      maxLength={14}
                      aria-busy={cepLookupStatus === 'loading'}
                    />
                    {cepLookupStatus === 'loading' ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                    ) : null}
                  </div>
                  {cepLookupMessage ? (
                    <p
                      className={
                        cepLookupStatus === 'error'
                          ? 'text-xs text-destructive mt-1'
                          : 'text-xs text-muted-foreground mt-1'
                      }
                    >
                      {cepLookupMessage}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-1">
                    Com o código postal completo (7 dígitos), ao alterar o CEP a morada e a região podem ser sugeridas automaticamente.
                  </p>
                  {personalInfoErrors.cep ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.cep}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">
                  {(typeof profileDoc.cep === 'string' && profileDoc.cep.trim()) ||
                    (typeof profileDoc.identificationNumber === 'string' && profileDoc.identificationNumber.trim()) ||
                    '—'}
                </p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Região</p>
              {editMode ? (
                <>
                  <Select
                    value={edit.region}
                    onValueChange={(v) => {
                      cepLookupSeq.current += 1;
                      locationFieldsManualRef.current = true;
                      setCepLookupStatus('idle');
                      setCepLookupMessage(null);
                      setEdit((s) => ({ ...s, region: v as typeof edit.region, regionOther: v === 'Outra' ? s.regionOther : '' }));
                      setPersonalInfoErrors((prev) => ({ ...prev, region: undefined }));
                    }}
                  >
                    <SelectTrigger className="mt-2" aria-label="Região">
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lisboa">Lisboa</SelectItem>
                      <SelectItem value="Norte">Norte</SelectItem>
                      <SelectItem value="Centro">Centro</SelectItem>
                      <SelectItem value="Alentejo">Alentejo</SelectItem>
                      <SelectItem value="Algarve">Algarve</SelectItem>
                      <SelectItem value="Outra">Outra</SelectItem>
                    </SelectContent>
                  </Select>
                  {personalInfoErrors.region ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.region}</p>
                  ) : null}
                  {edit.region === 'Outra' ? (
                    <>
                      <Label htmlFor="profile-region-other" className="sr-only">Outra Região</Label>
                      <Input
                        id="profile-region-other"
                        aria-label="Outra Região"
                        value={edit.regionOther}
                        onChange={(e) => {
                          cepLookupSeq.current += 1;
                          locationFieldsManualRef.current = true;
                          setCepLookupStatus('idle');
                          setCepLookupMessage(null);
                          const v = e.target.value;
                          setEdit((s) => ({ ...s, regionOther: v }));
                          if (personalInfoErrors.regionOther) setPersonalInfoErrors((prev) => ({ ...prev, regionOther: undefined }));
                        }}
                        className="mt-3"
                        placeholder="Indique a região"
                      />
                      {personalInfoErrors.regionOther ? (
                        <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.regionOther}</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">
                  {profileDoc.region === 'Outra' ? profileDoc.regionOther || '—' : profileDoc.region || '—'}
                </p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Idioma de contacto</p>
              {editMode ? (
                <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">{t.get('common.languages.pt')}</SelectItem>
                    <SelectItem value="en">{t.get('common.languages.en')}</SelectItem>
                    <SelectItem value="es">{t.get('common.languages.es')}</SelectItem>
                    <SelectItem value="fr">{t.get('common.languages.fr')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">{interfaceLanguageLabel}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Preferência de contacto</p>
              {editMode ? (
                <Select value={edit.contactPreference} onValueChange={(v) => setEdit((s) => ({ ...s, contactPreference: v as 'email' | 'phone' }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">{contactPreferenceLabel}</p>
              )}
            </div>

            {profileDoc.photoUrl ? (
              <div className="sm:col-span-2 pt-1">
                <Button type="button" variant="ghost" size="sm" className="px-0" disabled={uploadingPhoto} onClick={removeProfilePhoto}>
                  Remover foto
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Marcações</h2>
            </div>
            <Link to={sessionsUrl} className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="mt-5 rounded-xl border bg-muted/30 p-6 min-h-[160px] flex items-center justify-center">
            {upcomingSessions.length ? (
              <div className="w-full space-y-3">
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-background/70 border px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{s.session_type}</p>
                      <p className="text-xs text-muted-foreground">Status: {s.status || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{new Date(s.scheduled_date).toLocaleDateString('pt-PT')}</p>
                      <p className="text-xs text-muted-foreground">{s.scheduled_time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-background border flex items-center justify-center text-muted-foreground">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Sem marcações agendadas no momento.</p>
              </div>
            )}
          </div>
        </div>

        {isViewingOtherUser ? (
          <div className="cpc-card p-6 lg:col-span-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Atividades</h2>
              </div>
              <Link to="/dashboard/cpc/atividades" className="text-sm text-primary hover:underline">
                Ver todas
              </Link>
            </div>

            <div className="mt-5 rounded-xl border bg-muted/30 p-6 min-h-[160px]">
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : activities.length ? (
                <div className="space-y-3 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                  {activities.map((a) => (
                    <Link
                      key={a.id}
                      to={`/dashboard/cpc/atividades/${a.id}`}
                      className="flex items-center justify-between rounded-lg bg-background/70 border px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(() => {
                            const datePart =
                              a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
                                ? new Intl.DateTimeFormat('pt-PT', {
                                    timeZone: APP_TIME_ZONE,
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  }).format(new Date(`${a.date}T12:00:00Z`))
                                : null;
                            const dur = formatActivityDurationShort(a);
                            if (datePart && dur) return `${datePart} • ${dur}`;
                            if (datePart) return datePart;
                            if (dur) return dur;
                            return '—';
                          })()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          {formatActivityStatusListLabel(a.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center flex flex-col items-center justify-center min-h-[120px]">
                  <div className="mx-auto h-12 w-12 rounded-full bg-background border flex items-center justify-center text-muted-foreground">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">O migrante ainda não participou em nenhuma atividade.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="cpc-card p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Status Migratório &amp; Integração</h2>
            <Link to={triageUrl} className="text-sm text-primary hover:underline">
              Atualizar
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Autonomia diária</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={integrationScales.dailyAutonomy.percent} className="h-2 flex-1" />
                <span className="text-xs font-medium">{integrationScales.dailyAutonomy.label}</span>
              </div>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Conforto na comunicação</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={integrationScales.communicationComfort.percent} className="h-2 flex-1" />
                <span className="text-xs font-medium">{integrationScales.communicationComfort.label}</span>
              </div>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Normas sociais</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={integrationScales.socialNorms.percent} className="h-2 flex-1" />
                <span className="text-xs font-medium">{integrationScales.socialNorms.label}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="font-semibold">Necessidades Identificadas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {identifiedNeeds.length ? (
                identifiedNeeds.map((n) => {
                  const tone =
                    n.value === 'psychological'
                      ? 'bg-indigo-100 text-indigo-700'
                      : n.value === 'employment'
                        ? 'bg-green-100 text-green-700'
                        : n.value === 'housing'
                          ? 'bg-orange-100 text-orange-700'
                          : n.value === 'health'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-muted text-muted-foreground';
                  return (
                    <span key={n.value} className={`text-xs font-medium px-3 py-1 rounded-full ${tone}`}>
                      {n.label}
                    </span>
                  );
                })
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trilhas de Sucesso</h2>
            </div>
            <Link to={trailsUrl} className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {featuredTrail ? (
              <Link
                to={isViewingOtherUser ? trailsUrl : `/dashboard/migrante/trilhas/${featuredTrail.trail_id}`}
                className="block rounded-xl border bg-muted/20 px-4 py-4 hover:bg-muted/30 transition-colors"
              >
                <p className="text-[11px] tracking-wider text-primary uppercase font-semibold">Em curso</p>
                <p className="mt-1 font-semibold text-sm">
                  {data?.trails?.[featuredTrail.trail_id]?.title || featuredTrail.trail_id}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={featuredTrail.progress_percent || 0} className="h-2 flex-1" />
                  <span className="text-xs font-semibold text-muted-foreground">{featuredTrail.progress_percent || 0}%</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Ainda não iniciou nenhuma trilha.
              </div>
            )}

            <Link
              to={trailsUrl}
              className="block rounded-xl border border-dashed px-4 py-3 text-center text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              + Iniciar nova trilha
            </Link>
          </div>
        </div>
      </div>

      <div className="cpc-card p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Perfil Profissional</h2>
          {edit.resumeUrl ? (
            <a href={edit.resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              Ver currículo completo
            </a>
          ) : (
            <span className="text-sm text-muted-foreground"> </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-3">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Currículo (URL)</p>
            {editMode ? (
              <Input
                value={edit.resumeUrl}
                onChange={(e) => setEdit((s) => ({ ...s, resumeUrl: e.target.value }))}
                className="mt-2"
                placeholder="https://..."
              />
            ) : (
              <div className="mt-1 space-y-2">
                {!isViewingOtherUser && user?.uid ? (
                  <Link
                    to={`/dashboard/migrante/curriculo/ver/${user.uid}`}
                    className="inline-flex text-sm text-primary hover:underline"
                  >
                    {t.get('migrant.profile.documents.viewCvLink')}
                  </Link>
                ) : null}
                {edit.resumeUrl ? (
                  <a
                    href={edit.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    Visualizar documento anexado
                  </a>
                ) : null}
                {(isViewingOtherUser && !edit.resumeUrl) || (!user?.uid && !edit.resumeUrl) ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Escolaridade</p>
            <p className="mt-2 font-medium">{educationLabel}</p>
          </div>

          <div>
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Área de interesse</p>
            {interestAreaLabel ? (
              <span className="mt-2 inline-flex text-xs font-semibold px-3 py-1 rounded-full bg-muted">
                {interestAreaLabel.toUpperCase()}
              </span>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            )}
          </div>

          <div className="md:col-span-3">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Experiência profissional</p>
            {editMode ? (
              <Textarea
                value={edit.professionalExperience}
                onChange={(e) => setEdit((s) => ({ ...s, professionalExperience: e.target.value }))}
                className="mt-2"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {edit.professionalExperience?.trim() ? edit.professionalExperience : '—'}
              </p>
            )}
          </div>

          <div className="md:col-span-3">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Competências</p>
            {editMode ? (
              <Textarea value={edit.skills} onChange={(e) => setEdit((s) => ({ ...s, skills: e.target.value }))} className="mt-2" />
            ) : skillsTokens.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {skillsTokens.map((s) => (
                  <span key={s} className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            )}
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Título profissional</p>
              {editMode ? (
                <Input value={edit.professionalTitle} onChange={(e) => setEdit((s) => ({ ...s, professionalTitle: e.target.value }))} className="mt-2" />
              ) : (
                <p className="mt-2 font-medium">{edit.professionalTitle?.trim() ? edit.professionalTitle : '—'}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Idiomas</p>
              {editMode ? (
                (() => {
                  const options = ['portuguese', 'english', 'french', 'spanish', 'other'] as const;
                  const labelMap = new Map(options.map((k) => [t.get(`triage.options.languages.${k}`).toLowerCase(), k]));
                  const currentTokens = edit.languagesList
                    .split(/[,\n;]/g)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const selected = new Set(
                    currentTokens
                      .map((tok) => labelMap.get(tok.toLowerCase()))
                      .filter((v): v is (typeof options)[number] => !!v)
                  );

                  return (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {options.map((opt) => {
                        const label = t.get(`triage.options.languages.${opt}`);
                        const isSelected = selected.has(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const nextSelected = new Set(selected);
                              if (isSelected) nextSelected.delete(opt);
                              else nextSelected.add(opt);
                              const nextLabels = Array.from(nextSelected).map((k) => t.get(`triage.options.languages.${k}`));
                              setEdit((s) => ({ ...s, languagesList: nextLabels.join(', ') }));
                            }}
                            className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                              isSelected ? 'bg-primary/10 text-primary border-primary/50' : 'bg-background hover:bg-muted'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <p className="mt-2 font-medium">{edit.languagesList?.trim() ? edit.languagesList : '—'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
