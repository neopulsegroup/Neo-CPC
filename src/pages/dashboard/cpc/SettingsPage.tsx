import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getDocument, setDocument, serverTimestamp } from '@/integrations/firebase/firestore';
import { auditTimerStart, writeAuditLog } from '@/lib/auditLog';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/integrations/firebase/functionsClient';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import { Settings, ShieldCheck, Eye, EyeOff, Mail } from 'lucide-react';
import { canManageTeamMembers } from '@/lib/cpcRoles';
import { clearRecaptchaPublicSettingsCache } from '@/lib/recaptcha';
import {
  DEFAULT_RECAPTCHA_MIN_SCORE,
  RECAPTCHA_MIN_SCORE_OPTIONS,
  parseRecaptchaMinScore,
  validateRecaptchaSettingsDraft,
  type RecaptchaSettingsDraft,
} from '@/lib/recaptchaConfig';

import { COMMUNICATION_DEFAULTS } from '@/lib/communicationDefaults';
import { isValidEmail, normalizeEmail, parsePort, redactSettingsForAudit, sanitizeHost, sanitizeUsername, type CpcSystemSettings, type SmtpSecurity } from './settingsUtils';

type ContactSettingsDoc = { id: string; notificationEmail?: string | null };
type RecaptchaPublicSettingsDoc = {
  id: string;
  siteKey?: string | null;
  minScore?: number | null;
};
type RecaptchaSecretSettingsDoc = {
  id: string;
  secretKeySet?: boolean | null;
};
type SmtpSettingsDoc = {
  id: string;
  host?: string | null;
  port?: number | null;
  security?: SmtpSecurity | null;
  username?: string | null;
  password?: string | null;
  passwordSet?: boolean | null;
  fromEmail?: string | null;
};
type ResendSettingsDoc = {
  id: string;
  apiKey?: string | null;
  apiKeySet?: boolean | null;
  fromEmail?: string | null;
  enabled?: boolean | null;
};

type BrandingSection = 'left' | 'center' | 'right';
type BrandingContentType = 'image' | 'pagination' | 'title';
type BrandingZone = 'header' | 'footer';

type BrandingSlot = {
  mode: BrandingContentType;
  imageUrl: string;
  imagePath: string;
};

type BrandingSettings = {
  header: Record<BrandingSection, BrandingSlot>;
  footer: Record<BrandingSection, BrandingSlot>;
};

type BrandingSettingsDoc = {
  id: string;
  header?: Partial<Record<BrandingSection, Partial<BrandingSlot> | null>> | null;
  footer?: Partial<Record<BrandingSection, Partial<BrandingSlot> | null>> | null;
};

type Draft = {
  notificationEmail: string;
  notificationEmailConfirm: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecurity: SmtpSecurity;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromEmail: string;
};

const BRANDING_SECTIONS: BrandingSection[] = ['left', 'center', 'right'];

/** Logótipos incluídos na app (sem Storage) — servidos a partir de `/public/branding`. */
const BRANDING_BUILTIN_HEADER_CENTER_URL = '/branding/logo-SF.png';
const BRANDING_BUILTIN_FOOTER_CENTER_URL = '/branding/logos-cpc-sf.png';
const BRANDING_BUILTIN_HEADER_CENTER_PATH = 'built-in:logo-SF.png';
const BRANDING_BUILTIN_FOOTER_CENTER_PATH = 'built-in:logos-cpc-sf.png';

function defaultBranding(): BrandingSettings {
  const makeImageSlot = (): BrandingSlot => ({ mode: 'image', imageUrl: '', imagePath: '' });
  return {
    header: {
      left: makeImageSlot(),
      center: {
        mode: 'image',
        imageUrl: BRANDING_BUILTIN_HEADER_CENTER_URL,
        imagePath: BRANDING_BUILTIN_HEADER_CENTER_PATH,
      },
      right: makeImageSlot(),
    },
    footer: {
      left: { mode: 'title', imageUrl: '', imagePath: '' },
      center: {
        mode: 'image',
        imageUrl: BRANDING_BUILTIN_FOOTER_CENTER_URL,
        imagePath: BRANDING_BUILTIN_FOOTER_CENTER_PATH,
      },
      right: { mode: 'pagination', imageUrl: '', imagePath: '' },
    },
  };
}

function normalizeBranding(input: BrandingSettingsDoc | null | undefined): BrandingSettings {
  const base = defaultBranding();
  if (!input) return base;

  for (const section of BRANDING_SECTIONS) {
    const headerSlot = input.header?.[section];
    const url =
      headerSlot && typeof headerSlot.imageUrl === 'string' ? headerSlot.imageUrl.trim() : '';
    if (url) {
      base.header[section] = {
        mode: 'image',
        imageUrl: url,
        imagePath: typeof headerSlot?.imagePath === 'string' ? headerSlot.imagePath : '',
      };
    }
    // Sem URL no Firestore: mantém defaults (ex. logo central do cabeçalho).
  }

  for (const section of BRANDING_SECTIONS) {
    const footerSlot = input.footer?.[section];
    if (!footerSlot) continue;

    const defaultFooter = defaultBranding().footer[section];
    const mode =
      footerSlot.mode === 'pagination' || footerSlot.mode === 'title' || footerSlot.mode === 'image'
        ? footerSlot.mode
        : defaultFooter.mode;
    const url = typeof footerSlot.imageUrl === 'string' ? footerSlot.imageUrl.trim() : '';
    const path = typeof footerSlot.imagePath === 'string' ? footerSlot.imagePath : '';

    if (mode === 'image') {
      if (url) {
        base.footer[section] = { mode: 'image', imageUrl: url, imagePath: path };
      } else if (section === 'center') {
        base.footer[section] = {
          mode: 'image',
          imageUrl: BRANDING_BUILTIN_FOOTER_CENTER_URL,
          imagePath: BRANDING_BUILTIN_FOOTER_CENTER_PATH,
        };
      } else {
        base.footer[section] = { mode: 'image', imageUrl: '', imagePath: '' };
      }
    } else {
      base.footer[section] = { mode, imageUrl: '', imagePath: '' };
    }
  }

  return base;
}

function slotTitle(section: BrandingSection): string {
  if (section === 'left') return 'Secção esquerda';
  if (section === 'center') return 'Secção central';
  return 'Secção direita';
}

function brandingSnapshot(input: BrandingSettings): Record<string, unknown> {
  const pick = (slot: BrandingSlot) => ({
    mode: slot.mode,
    hasImage: Boolean(slot.imageUrl),
  });
  return {
    header: {
      left: pick(input.header.left),
      center: pick(input.header.center),
      right: pick(input.header.right),
    },
    footer: {
      left: pick(input.footer.left),
      center: pick(input.footer.center),
      right: pick(input.footer.right),
    },
  };
}

export default function CPCSettingsPage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const canManageSettings = canManageTeamMembers(profile?.role);

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>({
    notificationEmail: '',
    notificationEmailConfirm: '',
    smtpHost: '',
    smtpPort: '465',
    smtpSecurity: 'ssl',
    smtpUsername: '',
    smtpPassword: '',
    smtpFromEmail: '',
  });
  const [loaded, setLoaded] = useState<CpcSystemSettings | null>(null);

  const [saving, setSaving] = useState<{ open: boolean; progress: number; message: string } | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveSeqRef = useRef(0);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding());
  const [loadedBranding, setLoadedBranding] = useState<BrandingSettings>(defaultBranding());
  const [recaptchaDraft, setRecaptchaDraft] = useState<RecaptchaSettingsDraft>({
    siteKey: '',
    secretKey: '',
    minScore: DEFAULT_RECAPTCHA_MIN_SCORE,
  });
  const [loadedRecaptcha, setLoadedRecaptcha] = useState<RecaptchaSettingsDraft & { secretKeySet: boolean }>({
    siteKey: '',
    secretKey: '',
    minScore: DEFAULT_RECAPTCHA_MIN_SCORE,
    secretKeySet: false,
  });
  const [showRecaptchaSecret, setShowRecaptchaSecret] = useState(false);
  const [applyingRecaptcha, setApplyingRecaptcha] = useState(false);
  const [resendDraft, setResendDraft] = useState({ apiKey: '', fromEmail: '', enabled: false });
  const [loadedResend, setLoadedResend] = useState({ apiKeySet: false, fromEmail: '', enabled: false });
  const [showResendApiKey, setShowResendApiKey] = useState(false);
  const [applyingResend, setApplyingResend] = useState(false);
  const [applyingSmtp, setApplyingSmtp] = useState(false);

  const contactValidation = useMemo(() => {
    const errors: Record<string, string> = {};
    const email = draft.notificationEmail.trim();
    if (!email) errors.notificationEmail = 'O email de notificações é obrigatório.';
    else if (!isValidEmail(email)) errors.notificationEmail = 'Indique um email válido.';

    const emailConfirm = draft.notificationEmailConfirm.trim();
    if (!emailConfirm) errors.notificationEmailConfirm = 'Confirme o email.';
    else if (normalizeEmail(emailConfirm) !== normalizeEmail(email)) errors.notificationEmailConfirm = 'Os emails não coincidem.';

    return { ok: Object.keys(errors).length === 0, errors };
  }, [draft.notificationEmail, draft.notificationEmailConfirm]);

  const smtpValidation = useMemo(() => {
    const errors: Record<string, string> = {};
    const host = sanitizeHost(draft.smtpHost);
    if (!host) errors.smtpHost = 'O servidor SMTP é obrigatório.';

    const port = parsePort(draft.smtpPort);
    if (!port) errors.smtpPort = 'Indique uma porta válida (1–65535).';

    const username = sanitizeUsername(draft.smtpUsername);
    if (!username) errors.smtpUsername = 'O nome de utilizador SMTP é obrigatório.';

    const fromEmail = draft.smtpFromEmail.trim();
    if (!fromEmail) errors.smtpFromEmail = 'O email de remetente é obrigatório.';
    else if (!isValidEmail(fromEmail)) errors.smtpFromEmail = 'Indique um email de remetente válido.';

    return { ok: Object.keys(errors).length === 0, errors };
  }, [draft.smtpFromEmail, draft.smtpHost, draft.smtpPort, draft.smtpUsername]);

  const resendValidation = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!resendDraft.enabled) {
      return { ok: true, errors };
    }

    const fromEmail = resendDraft.fromEmail.trim();
    if (!fromEmail) errors.fromEmail = t.get('cpc.pages.settings.resend.fromEmailRequired');
    else if (!isValidEmail(fromEmail)) errors.fromEmail = t.get('cpc.pages.settings.resend.fromEmailInvalid');

    if (!loadedResend.apiKeySet && !resendDraft.apiKey.trim()) {
      errors.apiKey = t.get('cpc.pages.settings.resend.apiKeyRequired');
    }

    return { ok: Object.keys(errors).length === 0, errors };
  }, [loadedResend.apiKeySet, resendDraft.apiKey, resendDraft.enabled, resendDraft.fromEmail, t]);

  const recaptchaValidation = useMemo(
    () =>
      validateRecaptchaSettingsDraft(recaptchaDraft, {
        secretKeySet: loadedRecaptcha.secretKeySet,
        requireSecret: !loadedRecaptcha.secretKeySet,
      }),
    [loadedRecaptcha.secretKeySet, recaptchaDraft]
  );

  const smtpHasChanges = useMemo(() => {
    if (!loaded) return false;
    const port = parsePort(draft.smtpPort);
    const passwordChanged = draft.smtpPassword.trim().length > 0;
    return (
      sanitizeHost(draft.smtpHost) !== loaded.smtp.host ||
      port !== loaded.smtp.port ||
      draft.smtpSecurity !== loaded.smtp.security ||
      sanitizeUsername(draft.smtpUsername) !== loaded.smtp.username ||
      normalizeEmail(draft.smtpFromEmail) !== loaded.smtp.fromEmail ||
      passwordChanged
    );
  }, [draft.smtpFromEmail, draft.smtpHost, draft.smtpPassword, draft.smtpPort, draft.smtpSecurity, draft.smtpUsername, loaded]);

  const hasChanges = useMemo(() => {
    if (!loaded) return true;
    const contactChanged =
      normalizeEmail(draft.notificationEmail) !== normalizeEmail(loaded.contactNotificationEmail || '');
    const brandingChanged = JSON.stringify(loadedBranding) !== JSON.stringify(branding);
    return contactChanged || brandingChanged;
  }, [branding, draft.notificationEmail, loaded, loadedBranding]);

  const canAutosave = canManageSettings && !loading && contactValidation.ok && hasChanges && emailChangePending === null;

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [contactDoc, smtpDoc, resendDoc, brandingDoc, recaptchaPublicDoc, recaptchaSecretDoc] = await Promise.all([
          getDocument<ContactSettingsDoc>('system_settings', 'contact'),
          getDocument<SmtpSettingsDoc>('system_settings', 'smtp'),
          getDocument<ResendSettingsDoc>('system_settings', 'resend'),
          getDocument<BrandingSettingsDoc>('system_settings', 'document_branding'),
          getDocument<RecaptchaPublicSettingsDoc>('system_settings', 'recaptcha_public'),
          getDocument<RecaptchaSecretSettingsDoc>('system_settings', 'recaptcha'),
        ]);
        if (ignore) return;

        const notificationEmail =
          typeof contactDoc?.notificationEmail === 'string' && contactDoc.notificationEmail.trim()
            ? contactDoc.notificationEmail
            : COMMUNICATION_DEFAULTS.notificationEmail;
        const smtpHost =
          typeof smtpDoc?.host === 'string' && smtpDoc.host.trim()
            ? smtpDoc.host
            : COMMUNICATION_DEFAULTS.smtp.host;
        const smtpPort =
          typeof smtpDoc?.port === 'number' && smtpDoc.port > 0
            ? String(smtpDoc.port)
            : String(COMMUNICATION_DEFAULTS.smtp.port);
        const smtpSecurity: SmtpSecurity =
          smtpDoc?.security === 'ssl' || smtpDoc?.security === 'tls'
            ? smtpDoc.security
            : COMMUNICATION_DEFAULTS.smtp.security;
        const smtpUsername =
          typeof smtpDoc?.username === 'string' && smtpDoc.username.trim()
            ? smtpDoc.username
            : COMMUNICATION_DEFAULTS.smtp.username;
        const smtpFromEmail =
          typeof smtpDoc?.fromEmail === 'string' && smtpDoc.fromEmail.trim()
            ? smtpDoc.fromEmail
            : COMMUNICATION_DEFAULTS.smtp.fromEmail;
        const passwordSet = smtpDoc?.passwordSet === true || typeof smtpDoc?.password === 'string';
        const resendFromEmail =
          typeof resendDoc?.fromEmail === 'string' && resendDoc.fromEmail.trim()
            ? resendDoc.fromEmail
            : '';
        const resendApiKeySet = resendDoc?.apiKeySet === true || typeof resendDoc?.apiKey === 'string';
        const resendEnabled =
          typeof resendDoc?.enabled === 'boolean' ? resendDoc.enabled : resendApiKeySet;

        const merged: CpcSystemSettings = {
          contactNotificationEmail: notificationEmail || '',
          resend: {
            apiKeySet: resendApiKeySet,
            fromEmail: resendFromEmail,
            enabled: resendEnabled,
          },
          smtp: {
            host: smtpHost || '',
            port: parsePort(smtpPort) || 0,
            security: smtpSecurity,
            username: smtpUsername || '',
            passwordSet,
            fromEmail: smtpFromEmail || '',
          },
        };

        setLoaded(merged);
        setDraft({
          notificationEmail: merged.contactNotificationEmail || '',
          notificationEmailConfirm: merged.contactNotificationEmail || '',
          smtpHost: merged.smtp.host || '',
          smtpPort: merged.smtp.port ? String(merged.smtp.port) : String(COMMUNICATION_DEFAULTS.smtp.port),
          smtpSecurity: merged.smtp.security,
          smtpUsername: merged.smtp.username || '',
          smtpPassword: '',
          smtpFromEmail: merged.smtp.fromEmail || '',
        });
        const normalizedBranding = normalizeBranding(brandingDoc);
        setBranding(normalizedBranding);
        setLoadedBranding(normalizedBranding);

        const nextRecaptcha: RecaptchaSettingsDraft & { secretKeySet: boolean } = {
          siteKey:
            typeof recaptchaPublicDoc?.siteKey === 'string' && recaptchaPublicDoc.siteKey.trim()
              ? recaptchaPublicDoc.siteKey.trim()
              : '',
          secretKey: '',
          minScore: parseRecaptchaMinScore(recaptchaPublicDoc?.minScore ?? DEFAULT_RECAPTCHA_MIN_SCORE),
          secretKeySet: recaptchaSecretDoc?.secretKeySet === true,
        };
        setLoadedRecaptcha(nextRecaptcha);
        setRecaptchaDraft({
          siteKey: nextRecaptcha.siteKey,
          secretKey: '',
          minScore: nextRecaptcha.minScore,
        });
        setLoadedResend({ apiKeySet: resendApiKeySet, fromEmail: resendFromEmail, enabled: resendEnabled });
        setResendDraft({ apiKey: '', fromEmail: resendFromEmail, enabled: resendEnabled });
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!canAutosave) return;
    if (!loaded) return;

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveSettings();
    }, 900);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [branding, canAutosave, loaded]);

  function updateBrandingMode(section: BrandingSection, mode: BrandingContentType) {
    setBranding((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        [section]: {
          ...prev.footer[section],
          mode,
        },
      },
    }));
  }

  async function handleBrandingUpload(zone: BrandingZone, section: BrandingSection, file: File | null) {
    if (!file || !user || !canManageSettings) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Identidade Visual', description: 'Selecione um ficheiro de imagem válido.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Identidade Visual', description: 'A imagem deve ter no máximo 5MB.', variant: 'destructive' });
      return;
    }

    const slotKey = `${zone}-${section}`;
    setUploadingSlot(slotKey);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Caminho sob a pasta do utilizador (segmento == uid) para coincidir com regras de Storage típicas.
      const path = `profile_photos/${user.uid}/document_branding/${zone}_${section}_${Date.now()}_${safeName}`;
      const storageRef = makeStorageRef(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      setBranding((prev) => ({
        ...prev,
        [zone]: {
          ...prev[zone],
          [section]: {
            ...prev[zone][section],
            mode: zone === 'header' ? 'image' : prev[zone][section].mode,
            imageUrl: url,
            imagePath: path,
          },
        },
      }));
      toast({ title: 'Identidade Visual', description: `Imagem carregada (${slotTitle(section)}).` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar imagem.';
      toast({ title: 'Identidade Visual', description: message, variant: 'destructive' });
    } finally {
      setUploadingSlot(null);
    }
  }

  async function applyResendSettings(): Promise<boolean> {
    if (!user || !canManageSettings || !resendValidation.ok) return false;

    setApplyingResend(true);
    const startedAtMs = auditTimerStart();
    try {
      const apiKeyChanged = resendDraft.apiKey.trim().length > 0;
      const resendUpdate: Record<string, unknown> = {
        enabled: resendDraft.enabled,
        fromEmail: resendDraft.fromEmail.trim() ? normalizeEmail(resendDraft.fromEmail) : '',
        apiKeySet: loadedResend.apiKeySet || apiKeyChanged,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };
      if (apiKeyChanged) {
        resendUpdate.apiKey = resendDraft.apiKey.trim();
      }

      await setDocument('system_settings', 'resend', resendUpdate, true);

      const nextLoaded = {
        apiKeySet: resendUpdate.apiKeySet === true,
        fromEmail: resendDraft.fromEmail.trim() ? normalizeEmail(resendDraft.fromEmail) : '',
        enabled: resendDraft.enabled,
      };
      setLoadedResend(nextLoaded);
      setResendDraft((current) => ({ ...current, apiKey: '' }));

      await writeAuditLog({
        action: 'resend_settings_updated',
        actor_id: user.uid,
        context: 'cpc_settings',
        after: {
          fromEmail: nextLoaded.fromEmail,
          apiKeySet: nextLoaded.apiKeySet,
          enabled: nextLoaded.enabled,
        },
        startedAtMs,
      });

      toast({
        title: t.get('cpc.pages.settings.resend.toast.appliedTitle'),
        description: t.get('cpc.pages.settings.resend.toast.appliedDescription'),
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('cpc.pages.settings.resend.toast.applyError');
      toast({
        title: t.get('cpc.pages.settings.resend.toast.applyErrorTitle'),
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setApplyingResend(false);
    }
  }

  async function handleTestResend() {
    if (!user || !canManageSettings) return;
    if (!resendDraft.enabled) {
      toast({
        title: t.get('cpc.pages.settings.resend.testTitle'),
        description: t.get('cpc.pages.settings.resend.testDisabledError'),
        variant: 'destructive',
      });
      return;
    }
    if (!resendValidation.ok) {
      toast({
        title: t.get('cpc.pages.settings.resend.testTitle'),
        description: t.get('cpc.pages.settings.resend.testValidationError'),
        variant: 'destructive',
      });
      return;
    }

    setSaving({ open: true, progress: 10, message: t.get('cpc.pages.settings.resend.testing') });
    const startedAtMs = auditTimerStart();
    try {
      if (
        loadedResend.fromEmail !== normalizeEmail(resendDraft.fromEmail) ||
        resendDraft.apiKey.trim().length > 0 ||
        !loadedResend.apiKeySet ||
        loadedResend.enabled !== resendDraft.enabled
      ) {
        const saved = await applyResendSettings();
        if (!saved) {
          setSaving(null);
          return;
        }
      }

      const call = httpsCallable(functions, 'testResendConnection');
      const result = await call();
      const data = result.data as { ok?: boolean; message?: string } | null;
      const ok = data?.ok === true;
      if (ok) {
        await writeAuditLog({ action: 'resend_test_ok', actor_id: user.uid, context: 'cpc_settings', startedAtMs });
        setSaving({ open: true, progress: 100, message: t.get('cpc.pages.settings.resend.testOk') });
        window.setTimeout(() => setSaving(null), 500);
        toast({
          title: t.get('cpc.pages.settings.resend.testTitle'),
          description: t.get('cpc.pages.settings.resend.testOk'),
        });
      } else {
        await writeAuditLog({ action: 'resend_test_error', actor_id: user.uid, context: 'cpc_settings', startedAtMs });
        const message =
          typeof data?.message === 'string' && data.message
            ? data.message
            : t.get('cpc.pages.settings.resend.testError');
        setSaving(null);
        toast({ title: t.get('cpc.pages.settings.resend.testTitle'), description: message, variant: 'destructive' });
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error ?? '');
      const tips =
        raw.includes('Failed to fetch') || raw.includes('ERR_FAILED')
          ? ' Serviço de Funções indisponível. Verifique se as Cloud Functions foram deployadas e se a região está correta (VITE_FUNCTIONS_REGION). Em desenvolvimento, pode ativar o emulador com VITE_FUNCTIONS_EMULATOR=true.'
          : '';
      const message = (error instanceof Error ? error.message : t.get('cpc.pages.settings.resend.testError')) + tips;
      setSaving(null);
      toast({ title: t.get('cpc.pages.settings.resend.testTitle'), description: message, variant: 'destructive' });
    }
  }

  async function applyRecaptchaSettings() {
    if (!user || !canManageSettings) return;
    if (!recaptchaValidation.ok) return;

    setApplyingRecaptcha(true);
    const startedAtMs = auditTimerStart();
    try {
      const call = httpsCallable<
        { siteKey: string; secretKey?: string; minScore: number },
        { ok?: boolean; secretKeySet?: boolean; minScore?: number }
      >(functions, 'applyRecaptchaSettings');
      await call({
        siteKey: recaptchaDraft.siteKey.trim(),
        ...(recaptchaDraft.secretKey.trim() ? { secretKey: recaptchaDraft.secretKey.trim() } : {}),
        minScore: recaptchaDraft.minScore,
      });

      const nextLoaded = {
        siteKey: recaptchaDraft.siteKey.trim(),
        secretKey: '',
        minScore: recaptchaDraft.minScore,
        secretKeySet: true,
      };
      setLoadedRecaptcha(nextLoaded);
      setRecaptchaDraft((current) => ({ ...current, secretKey: '' }));
      clearRecaptchaPublicSettingsCache();

      await writeAuditLog({
        action: 'recaptcha_settings_updated',
        actor_id: user.uid,
        context: 'cpc_settings',
        after: {
          siteKeyConfigured: Boolean(nextLoaded.siteKey),
          minScore: nextLoaded.minScore,
          secretKeySet: true,
        },
        startedAtMs,
      });

      toast({ title: t.get('cpc.pages.settings.recaptcha.toast.appliedTitle'), description: t.get('cpc.pages.settings.recaptcha.toast.appliedDescription') });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('cpc.pages.settings.recaptcha.toast.applyError');
      toast({ title: t.get('cpc.pages.settings.recaptcha.toast.applyErrorTitle'), description: message, variant: 'destructive' });
    } finally {
      setApplyingRecaptcha(false);
    }
  }

  async function applySmtpSettings(): Promise<boolean> {
    if (!user || !canManageSettings || !smtpValidation.ok) return false;

    setApplyingSmtp(true);
    const startedAtMs = auditTimerStart();
    try {
      const nextPort = parsePort(draft.smtpPort);
      const smtpUpdate: Record<string, unknown> = {
        host: sanitizeHost(draft.smtpHost),
        port: nextPort,
        security: draft.smtpSecurity,
        username: sanitizeUsername(draft.smtpUsername),
        fromEmail: normalizeEmail(draft.smtpFromEmail),
        passwordSet: loaded?.smtp.passwordSet === true || draft.smtpPassword.trim().length > 0,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };
      if (draft.smtpPassword.trim().length > 0) {
        smtpUpdate.password = draft.smtpPassword;
      }

      await setDocument('system_settings', 'smtp', smtpUpdate, true);

      const nextSmtp = {
        host: smtpUpdate.host as string,
        port: smtpUpdate.port as number,
        security: smtpUpdate.security as SmtpSecurity,
        username: smtpUpdate.username as string,
        passwordSet: smtpUpdate.passwordSet as boolean,
        fromEmail: smtpUpdate.fromEmail as string,
      };

      setLoaded((current) =>
        current
          ? {
              ...current,
              smtp: nextSmtp,
            }
          : {
              contactNotificationEmail: normalizeEmail(draft.notificationEmail),
              smtp: nextSmtp,
            }
      );
      setDraft((current) => ({ ...current, smtpPassword: '' }));

      await writeAuditLog({
        action: 'smtp_settings_updated',
        actor_id: user.uid,
        context: 'cpc_settings',
        before: redactSettingsForAudit(loaded),
        after: redactSettingsForAudit({
          contactNotificationEmail: loaded?.contactNotificationEmail || normalizeEmail(draft.notificationEmail),
          smtp: nextSmtp,
        }),
        startedAtMs,
      });

      toast({
        title: t.get('cpc.pages.settings.smtp.toast.appliedTitle'),
        description: t.get('cpc.pages.settings.smtp.toast.appliedDescription'),
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('cpc.pages.settings.smtp.toast.applyError');
      toast({
        title: t.get('cpc.pages.settings.smtp.toast.applyErrorTitle'),
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setApplyingSmtp(false);
    }
  }

  async function saveSettings() {
    if (!user || !canManageSettings) return;
    if (!contactValidation.ok) return;

    const nextEmail = normalizeEmail(draft.notificationEmail);
    const prevEmail = normalizeEmail(loaded?.contactNotificationEmail || '');
    if (loaded && nextEmail !== prevEmail && emailChangePending === null) {
      setEmailChangePending(nextEmail);
      setConfirmEmailOpen(true);
      return;
    }

    const seq = (saveSeqRef.current += 1);
    const startedAtMs = auditTimerStart();
    setSaving({ open: true, progress: 10, message: 'A guardar configurações...' });
    try {
      const brandingUpdate = {
        header: branding.header,
        footer: branding.footer,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };

      await Promise.all([
        setDocument('system_settings', 'contact', { notificationEmail: nextEmail, updatedBy: user.uid, updatedAt: serverTimestamp() }, true),
        setDocument('system_settings', 'document_branding', brandingUpdate, true),
      ]);
      if (seq !== saveSeqRef.current) return;

      setSaving({ open: true, progress: 85, message: 'A registar auditoria...' });

      const before = redactSettingsForAudit(loaded);
      const after = redactSettingsForAudit({
        contactNotificationEmail: nextEmail,
        smtp: loaded?.smtp,
      });
      const beforeBranding = brandingSnapshot(loadedBranding);
      const afterBranding = brandingSnapshot(branding);

      await writeAuditLog({
        action: 'system_settings_updated',
        actor_id: user.uid,
        context: 'cpc_settings',
        before,
        after,
        beforeBranding,
        afterBranding,
        startedAtMs,
      });

      if (seq !== saveSeqRef.current) return;

      const nextLoaded: CpcSystemSettings = {
        contactNotificationEmail: nextEmail,
        smtp: loaded?.smtp ?? {
          host: '',
          port: 0,
          security: 'ssl',
          username: '',
          passwordSet: false,
          fromEmail: '',
        },
        resend: loaded?.resend,
      };

      setLoaded(nextLoaded);
      setLoadedBranding(branding);
      setEmailChangePending(null);
      setSaving({ open: true, progress: 100, message: 'Configurações guardadas.' });
      window.setTimeout(() => setSaving(null), 500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível guardar as configurações.';
      toast({ title: 'Configurações', description: message, variant: 'destructive' });
      setSaving(null);
    }
  }

  async function handleTestSmtp() {
    if (!user || !canManageSettings) return;
    if (!smtpValidation.ok) {
      toast({ title: t.get('cpc.pages.settings.smtp.testTitle'), description: t.get('cpc.pages.settings.smtp.testValidationError'), variant: 'destructive' });
      return;
    }
    setSaving({ open: true, progress: 10, message: t.get('cpc.pages.settings.smtp.testing') });
    const startedAtMs = auditTimerStart();
    try {
      if (smtpHasChanges) {
        const saved = await applySmtpSettings();
        if (!saved) {
          setSaving(null);
          return;
        }
      }

      const call = httpsCallable(functions, 'testSmtpConnection');
      const result = await call();
      const data = result.data as { ok?: boolean; message?: string } | null;
      const ok = data?.ok === true;
      if (ok) {
        await writeAuditLog({ action: 'smtp_test_ok', actor_id: user.uid, context: 'cpc_settings', startedAtMs });
        setSaving({ open: true, progress: 100, message: t.get('cpc.pages.settings.smtp.testOk') });
        window.setTimeout(() => setSaving(null), 500);
        toast({ title: t.get('cpc.pages.settings.smtp.testTitle'), description: t.get('cpc.pages.settings.smtp.testOk') });
      } else {
        await writeAuditLog({ action: 'smtp_test_error', actor_id: user.uid, context: 'cpc_settings', startedAtMs });
        const message = typeof data?.message === 'string' && data.message ? data.message : t.get('cpc.pages.settings.smtp.testError');
        setSaving(null);
        toast({ title: t.get('cpc.pages.settings.smtp.testTitle'), description: message, variant: 'destructive' });
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error ?? '');
      const tips =
        raw.includes('Failed to fetch') || raw.includes('ERR_FAILED')
          ? ' Serviço de Funções indisponível. Verifique se as Cloud Functions foram deployadas e se a região está correta (VITE_FUNCTIONS_REGION). Em desenvolvimento, pode ativar o emulador com VITE_FUNCTIONS_EMULATOR=true.'
          : '';
      const message = (error instanceof Error ? error.message : t.get('cpc.pages.settings.smtp.testError')) + tips;
      setSaving(null);
      toast({ title: t.get('cpc.pages.settings.smtp.testTitle'), description: message, variant: 'destructive' });
    }
  }

  useEffect(() => {
    if (!user || !profile) return;
    if (canManageTeamMembers(profile.role)) return;
    const startedAtMs = auditTimerStart();
    void writeAuditLog({
      action: 'unauthorized_attempt',
      actor_id: user.uid,
      context: 'cpc_settings',
      startedAtMs,
    });
  }, [profile, user]);

  if (!user || !profile) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Settings className="h-7 w-7 text-primary shrink-0" aria-hidden />
              {t.get('cpc.pages.settings.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t.get('cpc.pages.settings.loginRequired')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Settings className="h-7 w-7 text-primary shrink-0" aria-hidden />
              {t.get('cpc.pages.settings.title')}
            </h1>
            <p className="text-destructive mt-1">{t.get('cpc.pages.settings.noPermission')}</p>
          </div>
        </div>
      </div>
    );
  }

  const showPasswordHint = loaded?.smtp.passwordSet === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.settings.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.settings.subtitle')}</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Identidade Visual</h2>
          <p className="text-sm text-muted-foreground">
            Configure o padrão de cabeçalho e rodapé para os documentos exportados pelo sistema.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Cabeçalho</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BRANDING_SECTIONS.map((section) => {
              const slot = branding.header[section];
              const key = `header-${section}`;
              const isUploading = uploadingSlot === key;
              return (
                <div key={key} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-medium">{slotTitle(section)}</p>
                  <div className="h-24 rounded-lg border bg-background overflow-hidden flex items-center justify-center">
                    {slot.imageUrl ? (
                      <img src={slot.imageUrl} alt={`Cabeçalho ${slotTitle(section)}`} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem imagem</span>
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    disabled={loading || isUploading}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0] ?? null;
                      void handleBrandingUpload('header', section, file);
                      e.currentTarget.value = '';
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Pré-visualização do cabeçalho</p>
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="rounded-lg bg-background border px-4 py-3 grid grid-cols-3 gap-4 items-center">
              {BRANDING_SECTIONS.map((section) => (
                <div key={`preview-header-${section}`} className="h-14 rounded-md border bg-muted/20 flex items-center justify-center overflow-hidden">
                  {branding.header[section].imageUrl ? (
                    <img src={branding.header[section].imageUrl} alt={`Prévia cabeçalho ${slotTitle(section)}`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{slotTitle(section)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Rodapé</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BRANDING_SECTIONS.map((section) => {
              const slot = branding.footer[section];
              const key = `footer-${section}`;
              const isUploading = uploadingSlot === key;
              return (
                <div key={key} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-medium">{slotTitle(section)}</p>
                  <Select
                    value={slot.mode}
                    onValueChange={(v) => updateBrandingMode(section, v as BrandingContentType)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Upload de imagem</SelectItem>
                      <SelectItem value="pagination">Paginação</SelectItem>
                      <SelectItem value="title">Título do documento</SelectItem>
                    </SelectContent>
                  </Select>

                  {slot.mode === 'image' ? (
                    <>
                      <div className="h-20 rounded-lg border bg-background overflow-hidden flex items-center justify-center">
                        {slot.imageUrl ? (
                          <img src={slot.imageUrl} alt={`Rodapé ${slotTitle(section)}`} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem imagem</span>
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        disabled={loading || isUploading}
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0] ?? null;
                          void handleBrandingUpload('footer', section, file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </>
                  ) : (
                    <div className="h-20 rounded-lg border bg-background/70 flex items-center justify-center text-sm text-muted-foreground">
                      {slot.mode === 'pagination' ? 'Página 1 de 10' : 'Título do documento'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">Pré-visualização do rodapé</p>
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="rounded-lg bg-background border px-4 py-3 grid grid-cols-3 gap-4 items-center">
              {BRANDING_SECTIONS.map((section) => {
                const slot = branding.footer[section];
                return (
                  <div key={`preview-footer-${section}`} className="h-14 rounded-md border bg-muted/20 flex items-center justify-center overflow-hidden text-xs text-muted-foreground">
                    {slot.mode === 'image' ? (
                      slot.imageUrl ? (
                        <img src={slot.imageUrl} alt={`Prévia rodapé ${slotTitle(section)}`} className="h-full w-full object-contain" />
                      ) : (
                        <span>{slotTitle(section)}</span>
                      )
                    ) : slot.mode === 'pagination' ? (
                      <span>Página 1 de 10</span>
                    ) : (
                      <span>Título do documento</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Notificações do formulário de contacto</h2>
          <p className="text-sm text-muted-foreground">Define o email que recebe as mensagens enviadas em /contacto.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contact-notification-email">Email de notificações</Label>
            <Input
              id="contact-notification-email"
              type="email"
              value={draft.notificationEmail}
              onChange={(e) => setDraft((s) => ({ ...s, notificationEmail: e.target.value }))}
              placeholder="ex.: notificacoes@cpc.pt"
              disabled={loading}
            />
            {contactValidation.errors.notificationEmail ? <p className="text-sm font-medium text-destructive">{contactValidation.errors.notificationEmail}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-notification-email-confirm">Confirmar email</Label>
            <Input
              id="contact-notification-email-confirm"
              type="email"
              value={draft.notificationEmailConfirm}
              onChange={(e) => setDraft((s) => ({ ...s, notificationEmailConfirm: e.target.value }))}
              placeholder="repita o email"
              disabled={loading}
            />
            {contactValidation.errors.notificationEmailConfirm ? <p className="text-sm font-medium text-destructive">{contactValidation.errors.notificationEmailConfirm}</p> : null}
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t.get('cpc.pages.settings.resend.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t.get('cpc.pages.settings.resend.subtitle')}</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="resend-enabled">{t.get('cpc.pages.settings.resend.enabledLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t.get('cpc.pages.settings.resend.enabledHelp')}</p>
          </div>
          <Switch
            id="resend-enabled"
            checked={resendDraft.enabled}
            onCheckedChange={(checked) => setResendDraft((current) => ({ ...current, enabled: checked }))}
            disabled={loading || applyingResend}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="resend-api-key">{t.get('cpc.pages.settings.resend.apiKeyLabel')}</Label>
            <div className="relative">
              <Input
                id="resend-api-key"
                type={showResendApiKey ? 'text' : 'password'}
                value={resendDraft.apiKey}
                onChange={(e) => setResendDraft((current) => ({ ...current, apiKey: e.target.value }))}
                placeholder={
                  loadedResend.apiKeySet
                    ? t.get('cpc.pages.settings.resend.apiKeyConfiguredPlaceholder')
                    : t.get('cpc.pages.settings.resend.apiKeyPlaceholder')
                }
                disabled={loading || applyingResend || !resendDraft.enabled}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowResendApiKey((current) => !current)}
                aria-label={showResendApiKey ? t.get('cpc.pages.settings.resend.hideApiKey') : t.get('cpc.pages.settings.resend.showApiKey')}
              >
                {showResendApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {resendValidation.errors.apiKey ? (
              <p className="text-sm font-medium text-destructive">{resendValidation.errors.apiKey}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t.get('cpc.pages.settings.resend.apiKeyHelp')}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="resend-from-email">{t.get('cpc.pages.settings.resend.fromEmailLabel')}</Label>
            <Input
              id="resend-from-email"
              type="email"
              value={resendDraft.fromEmail}
              onChange={(e) => setResendDraft((current) => ({ ...current, fromEmail: e.target.value }))}
              placeholder={t.get('cpc.pages.settings.resend.fromEmailPlaceholder')}
              disabled={loading || applyingResend || !resendDraft.enabled}
            />
            {resendValidation.errors.fromEmail ? (
              <p className="text-sm font-medium text-destructive">{resendValidation.errors.fromEmail}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t.get('cpc.pages.settings.resend.fromEmailHelp')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleTestResend()}
            disabled={loading || applyingResend || !resendValidation.ok || !resendDraft.enabled}
          >
            {t.get('cpc.pages.settings.resend.test')}
          </Button>
          <Button
            type="button"
            onClick={() => void applyResendSettings()}
            disabled={loading || applyingResend || !resendValidation.ok}
          >
            {applyingResend ? t.get('cpc.pages.settings.resend.applying') : t.get('cpc.pages.settings.resend.apply')}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">{t.get('cpc.pages.settings.smtp.title')}</h2>
          <p className="text-sm text-muted-foreground">{t.get('cpc.pages.settings.smtp.subtitle')}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">{t.get('cpc.pages.settings.smtp.recommendedTitle')}</p>
          <p>{t.get('cpc.pages.settings.smtp.recommendedOutgoing')}</p>
          <p>{t.get('cpc.pages.settings.smtp.recommendedUsername')}</p>
          <p>{t.get('cpc.pages.settings.smtp.recommendedAuth')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">{t.get('cpc.pages.settings.smtp.hostLabel')}</Label>
            <Input
              id="smtp-host"
              value={draft.smtpHost}
              onChange={(e) => setDraft((s) => ({ ...s, smtpHost: e.target.value }))}
              placeholder={COMMUNICATION_DEFAULTS.smtp.host}
              disabled={loading}
            />
            {smtpValidation.errors.smtpHost ? <p className="text-sm font-medium text-destructive">{smtpValidation.errors.smtpHost}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-port">{t.get('cpc.pages.settings.smtp.portLabel')}</Label>
            <Input
              id="smtp-port"
              inputMode="numeric"
              value={draft.smtpPort}
              onChange={(e) => setDraft((s) => ({ ...s, smtpPort: e.target.value }))}
              placeholder={String(COMMUNICATION_DEFAULTS.smtp.port)}
              disabled={loading}
            />
            {smtpValidation.errors.smtpPort ? <p className="text-sm font-medium text-destructive">{smtpValidation.errors.smtpPort}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Segurança</Label>
            <Select value={draft.smtpSecurity} onValueChange={(v) => setDraft((s) => ({ ...s, smtpSecurity: v as SmtpSecurity }))} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="TLS/SSL" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-username">{t.get('cpc.pages.settings.smtp.usernameLabel')}</Label>
            <Input
              id="smtp-username"
              value={draft.smtpUsername}
              onChange={(e) => setDraft((s) => ({ ...s, smtpUsername: e.target.value }))}
              placeholder={COMMUNICATION_DEFAULTS.smtp.username}
              disabled={loading}
            />
            {smtpValidation.errors.smtpUsername ? <p className="text-sm font-medium text-destructive">{smtpValidation.errors.smtpUsername}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-password">Senha</Label>
            <Input
              id="smtp-password"
              type="password"
              value={draft.smtpPassword}
              onChange={(e) => setDraft((s) => ({ ...s, smtpPassword: e.target.value }))}
              placeholder={showPasswordHint ? '•••••••• (configurada)' : '••••••••'}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">A senha só é guardada se for alterada.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-from-email">{t.get('cpc.pages.settings.smtp.fromEmailLabel')}</Label>
            <Input
              id="smtp-from-email"
              type="email"
              value={draft.smtpFromEmail}
              onChange={(e) => setDraft((s) => ({ ...s, smtpFromEmail: e.target.value }))}
              placeholder={COMMUNICATION_DEFAULTS.smtp.fromEmail}
              disabled={loading}
            />
            {smtpValidation.errors.smtpFromEmail ? <p className="text-sm font-medium text-destructive">{smtpValidation.errors.smtpFromEmail}</p> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => void handleTestSmtp()}
            disabled={loading || applyingSmtp || !smtpValidation.ok}
          >
            {t.get('cpc.pages.settings.smtp.test')}
          </Button>
          <Button
            type="button"
            onClick={() => void applySmtpSettings()}
            disabled={loading || applyingSmtp || !smtpValidation.ok || !smtpHasChanges}
          >
            {applyingSmtp ? t.get('cpc.pages.settings.smtp.applying') : t.get('cpc.pages.settings.smtp.apply')}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t.get('cpc.pages.settings.recaptcha.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t.get('cpc.pages.settings.recaptcha.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="recaptcha-site-key">{t.get('cpc.pages.settings.recaptcha.siteKeyLabel')}</Label>
            <Input
              id="recaptcha-site-key"
              value={recaptchaDraft.siteKey}
              onChange={(e) => setRecaptchaDraft((current) => ({ ...current, siteKey: e.target.value }))}
              placeholder={t.get('cpc.pages.settings.recaptcha.siteKeyPlaceholder')}
              disabled={loading || applyingRecaptcha}
              autoComplete="off"
            />
            {recaptchaValidation.errors.siteKey ? (
              <p className="text-sm font-medium text-destructive">{recaptchaValidation.errors.siteKey}</p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="recaptcha-secret-key">{t.get('cpc.pages.settings.recaptcha.secretKeyLabel')}</Label>
            <div className="relative">
              <Input
                id="recaptcha-secret-key"
                type={showRecaptchaSecret ? 'text' : 'password'}
                value={recaptchaDraft.secretKey}
                onChange={(e) => setRecaptchaDraft((current) => ({ ...current, secretKey: e.target.value }))}
                placeholder={
                  loadedRecaptcha.secretKeySet
                    ? t.get('cpc.pages.settings.recaptcha.secretKeyConfiguredPlaceholder')
                    : t.get('cpc.pages.settings.recaptcha.secretKeyPlaceholder')
                }
                disabled={loading || applyingRecaptcha}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowRecaptchaSecret((current) => !current)}
                aria-label={showRecaptchaSecret ? t.get('cpc.pages.settings.recaptcha.hideSecret') : t.get('cpc.pages.settings.recaptcha.showSecret')}
              >
                {showRecaptchaSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {recaptchaValidation.errors.secretKey ? (
              <p className="text-sm font-medium text-destructive">{recaptchaValidation.errors.secretKey}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recaptcha-min-score">{t.get('cpc.pages.settings.recaptcha.minScoreLabel')}</Label>
            <Select
              value={String(recaptchaDraft.minScore)}
              onValueChange={(value) =>
                setRecaptchaDraft((current) => ({
                  ...current,
                  minScore: parseRecaptchaMinScore(Number(value)),
                }))
              }
              disabled={loading || applyingRecaptcha}
            >
              <SelectTrigger id="recaptcha-min-score">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECAPTCHA_MIN_SCORE_OPTIONS.map((score) => (
                  <SelectItem key={score} value={String(score)}>
                    {score === DEFAULT_RECAPTCHA_MIN_SCORE
                      ? t.get('cpc.pages.settings.recaptcha.minScoreDefault', { score: String(score) })
                      : String(score)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.get('cpc.pages.settings.recaptcha.minScoreHelp')}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void applyRecaptchaSettings()}
            disabled={loading || applyingRecaptcha || !recaptchaValidation.ok}
          >
            {applyingRecaptcha ? t.get('cpc.pages.settings.recaptcha.applying') : t.get('cpc.pages.settings.recaptcha.apply')}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-2">
        <h2 className="text-lg font-semibold">Outras configurações</h2>
        <p className="text-sm text-muted-foreground">Secção reservada para futuras configurações do sistema.</p>
      </Card>

      <Dialog open={saving?.open === true}>
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle>A guardar</DialogTitle>
            <DialogDescription>{saving?.message ?? ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Progress value={saving?.progress ?? 0} className="h-2" />
            <div className="text-xs text-muted-foreground">{saving ? `${saving.progress}%` : ''}</div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEmailOpen} onOpenChange={setConfirmEmailOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
            <AlertDialogDescription>
              Pretende alterar o email de notificações para <span className="font-semibold">{emailChangePending ?? ''}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setEmailChangePending(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEmailOpen(false);
                window.setTimeout(() => void saveSettings(), 0);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
