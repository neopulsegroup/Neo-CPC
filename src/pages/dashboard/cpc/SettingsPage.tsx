import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { addDocument, getDocument, setDocument, serverTimestamp } from '@/integrations/firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/integrations/firebase/functionsClient';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import { Settings } from 'lucide-react';

import { COMMUNICATION_DEFAULTS } from '@/lib/communicationDefaults';
import { isValidEmail, normalizeEmail, parsePort, redactSettingsForAudit, sanitizeHost, sanitizeUsername, type CpcSystemSettings, type SmtpSecurity } from './settingsUtils';

type ContactSettingsDoc = { id: string; notificationEmail?: string | null };
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

  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>({
    notificationEmail: '',
    notificationEmailConfirm: '',
    smtpHost: '',
    smtpPort: '587',
    smtpSecurity: 'tls',
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

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    const email = draft.notificationEmail.trim();
    if (!email) errors.notificationEmail = 'O email de notificações é obrigatório.';
    else if (!isValidEmail(email)) errors.notificationEmail = 'Indique um email válido.';

    const emailConfirm = draft.notificationEmailConfirm.trim();
    if (!emailConfirm) errors.notificationEmailConfirm = 'Confirme o email.';
    else if (normalizeEmail(emailConfirm) !== normalizeEmail(email)) errors.notificationEmailConfirm = 'Os emails não coincidem.';

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
  }, [draft.notificationEmail, draft.notificationEmailConfirm, draft.smtpFromEmail, draft.smtpHost, draft.smtpPort, draft.smtpUsername]);

  const desiredSettings = useMemo<CpcSystemSettings>(() => {
    const port = parsePort(draft.smtpPort);
    return {
      contactNotificationEmail: normalizeEmail(draft.notificationEmail),
      smtp: {
        host: sanitizeHost(draft.smtpHost),
        port: port || 0,
        security: draft.smtpSecurity,
        username: sanitizeUsername(draft.smtpUsername),
        passwordSet: loaded?.smtp.passwordSet === true || draft.smtpPassword.trim().length > 0,
        fromEmail: normalizeEmail(draft.smtpFromEmail),
      },
    };
  }, [draft.notificationEmail, draft.smtpFromEmail, draft.smtpHost, draft.smtpPassword, draft.smtpPort, draft.smtpSecurity, draft.smtpUsername, loaded?.smtp.passwordSet]);

  const hasChanges = useMemo(() => {
    if (!loaded) return true;
    const base = JSON.stringify({ ...loaded, updatedAt: undefined, updatedBy: undefined });
    const next = JSON.stringify({ ...desiredSettings, updatedAt: undefined, updatedBy: undefined });
    const brandingChanged = JSON.stringify(loadedBranding) !== JSON.stringify(branding);
    const passwordChanged = draft.smtpPassword.trim().length > 0;
    return base !== next || passwordChanged || brandingChanged;
  }, [branding, desiredSettings, draft.smtpPassword, loaded, loadedBranding]);

  const canAutosave = isAdmin && !loading && validation.ok && hasChanges && emailChangePending === null;

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [contactDoc, smtpDoc, brandingDoc] = await Promise.all([
          getDocument<ContactSettingsDoc>('system_settings', 'contact'),
          getDocument<SmtpSettingsDoc>('system_settings', 'smtp'),
          getDocument<BrandingSettingsDoc>('system_settings', 'document_branding'),
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

        const merged: CpcSystemSettings = {
          contactNotificationEmail: notificationEmail || '',
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
          smtpPort: merged.smtp.port ? String(merged.smtp.port) : '587',
          smtpSecurity: merged.smtp.security,
          smtpUsername: merged.smtp.username || '',
          smtpPassword: '',
          smtpFromEmail: merged.smtp.fromEmail || '',
        });
        const normalizedBranding = normalizeBranding(brandingDoc);
        setBranding(normalizedBranding);
        setLoadedBranding(normalizedBranding);
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
  }, [branding, canAutosave, desiredSettings, draft.smtpPassword, loaded]);

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
    if (!file || !user || !isAdmin) return;
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

  async function saveSettings() {
    if (!user || !isAdmin) return;
    if (!validation.ok) return;

    const nextEmail = normalizeEmail(draft.notificationEmail);
    const prevEmail = normalizeEmail(loaded?.contactNotificationEmail || '');
    if (loaded && nextEmail !== prevEmail && emailChangePending === null) {
      setEmailChangePending(nextEmail);
      setConfirmEmailOpen(true);
      return;
    }

    const seq = (saveSeqRef.current += 1);
    setSaving({ open: true, progress: 10, message: 'A guardar configurações...' });
    try {
      const nextPort = parsePort(draft.smtpPort);
      const smtpUpdate: Record<string, unknown> = {
        host: sanitizeHost(draft.smtpHost),
        port: nextPort,
        security: draft.smtpSecurity,
        username: sanitizeUsername(draft.smtpUsername),
        fromEmail: normalizeEmail(draft.smtpFromEmail),
        passwordSet: (loaded?.smtp.passwordSet === true || draft.smtpPassword.trim().length > 0) ? true : false,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };
      if (draft.smtpPassword.trim().length > 0) {
        smtpUpdate.password = draft.smtpPassword;
      }

      const brandingUpdate = {
        header: branding.header,
        footer: branding.footer,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };

      await Promise.all([
        setDocument('system_settings', 'contact', { notificationEmail: nextEmail, updatedBy: user.uid, updatedAt: serverTimestamp() }, true),
        setDocument('system_settings', 'smtp', smtpUpdate, true),
        setDocument('system_settings', 'document_branding', brandingUpdate, true),
      ]);
      if (seq !== saveSeqRef.current) return;

      setSaving({ open: true, progress: 85, message: 'A registar auditoria...' });

      const before = redactSettingsForAudit(loaded);
      const after = redactSettingsForAudit({
        contactNotificationEmail: nextEmail,
        smtp: {
          host: smtpUpdate.host as string,
          port: smtpUpdate.port as number,
          security: smtpUpdate.security as SmtpSecurity,
          username: smtpUpdate.username as string,
          passwordSet: smtpUpdate.passwordSet as boolean,
          fromEmail: smtpUpdate.fromEmail as string,
        },
      });
      const beforeBranding = brandingSnapshot(loadedBranding);
      const afterBranding = brandingSnapshot(branding);

      await addDocument('audit_logs', {
        action: 'system_settings_updated',
        actor_id: user.uid,
        context: 'cpc_settings',
        createdAt: serverTimestamp(),
        before,
        after,
        beforeBranding,
        afterBranding,
      });

      if (seq !== saveSeqRef.current) return;

      const nextLoaded: CpcSystemSettings = {
        contactNotificationEmail: nextEmail,
        smtp: {
          host: smtpUpdate.host as string,
          port: smtpUpdate.port as number,
          security: smtpUpdate.security as SmtpSecurity,
          username: smtpUpdate.username as string,
          passwordSet: smtpUpdate.passwordSet as boolean,
          fromEmail: smtpUpdate.fromEmail as string,
        },
      };

      setLoaded(nextLoaded);
      setLoadedBranding(branding);
      setDraft((s) => ({ ...s, smtpPassword: '' }));
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
    if (!user || !isAdmin) return;
    if (!validation.ok) {
      toast({ title: 'Teste SMTP', description: 'Corrija os campos obrigatórios antes de testar.', variant: 'destructive' });
      return;
    }
    setSaving({ open: true, progress: 10, message: 'A testar ligação SMTP...' });
    try {
      const call = httpsCallable(functions, 'testSmtpConnection');
      const result = await call();
      const data = result.data as { ok?: boolean; message?: string } | null;
      const ok = data?.ok === true;
      if (ok) {
        await addDocument('audit_logs', { action: 'smtp_test_ok', actor_id: user.uid, context: 'cpc_settings', createdAt: serverTimestamp() });
        setSaving({ open: true, progress: 100, message: 'Ligação SMTP OK.' });
        window.setTimeout(() => setSaving(null), 500);
        toast({ title: 'Teste SMTP', description: 'Ligação SMTP estabelecida com sucesso.' });
      } else {
        await addDocument('audit_logs', { action: 'smtp_test_error', actor_id: user.uid, context: 'cpc_settings', createdAt: serverTimestamp() });
        const message = typeof data?.message === 'string' && data.message ? data.message : 'Falha na ligação SMTP.';
        setSaving(null);
        toast({ title: 'Teste SMTP', description: message, variant: 'destructive' });
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error ?? '');
      const tips =
        raw.includes('Failed to fetch') || raw.includes('ERR_FAILED')
          ? ' Serviço de Funções indisponível. Verifique se as Cloud Functions foram deployadas e se a região está correta (VITE_FUNCTIONS_REGION). Em desenvolvimento, pode ativar o emulador com VITE_FUNCTIONS_EMULATOR=true.'
          : '';
      const message = (error instanceof Error ? error.message : 'Não foi possível testar o SMTP.') + tips;
      setSaving(null);
      toast({ title: 'Teste SMTP', description: message, variant: 'destructive' });
    }
  }

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.role === 'admin') return;
    void addDocument('audit_logs', {
      action: 'unauthorized_attempt',
      actor_id: user.uid,
      context: 'cpc_settings',
      createdAt: serverTimestamp(),
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

  if (!isAdmin) {
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
            {validation.errors.notificationEmail ? <p className="text-sm font-medium text-destructive">{validation.errors.notificationEmail}</p> : null}
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
            {validation.errors.notificationEmailConfirm ? <p className="text-sm font-medium text-destructive">{validation.errors.notificationEmailConfirm}</p> : null}
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Configuração SMTP</h2>
          <p className="text-sm text-muted-foreground">Parâmetros completos para envio de emails do sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">Servidor SMTP</Label>
            <Input
              id="smtp-host"
              value={draft.smtpHost}
              onChange={(e) => setDraft((s) => ({ ...s, smtpHost: e.target.value }))}
              placeholder="smtp.exemplo.com"
              disabled={loading}
            />
            {validation.errors.smtpHost ? <p className="text-sm font-medium text-destructive">{validation.errors.smtpHost}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-port">Porta</Label>
            <Input
              id="smtp-port"
              inputMode="numeric"
              value={draft.smtpPort}
              onChange={(e) => setDraft((s) => ({ ...s, smtpPort: e.target.value }))}
              placeholder="587"
              disabled={loading}
            />
            {validation.errors.smtpPort ? <p className="text-sm font-medium text-destructive">{validation.errors.smtpPort}</p> : null}
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
            <Label htmlFor="smtp-username">Utilizador</Label>
            <Input
              id="smtp-username"
              value={draft.smtpUsername}
              onChange={(e) => setDraft((s) => ({ ...s, smtpUsername: e.target.value }))}
              placeholder="utilizador@smtp"
              disabled={loading}
            />
            {validation.errors.smtpUsername ? <p className="text-sm font-medium text-destructive">{validation.errors.smtpUsername}</p> : null}
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
            <Label htmlFor="smtp-from-email">Email de remetente</Label>
            <Input
              id="smtp-from-email"
              type="email"
              value={draft.smtpFromEmail}
              onChange={(e) => setDraft((s) => ({ ...s, smtpFromEmail: e.target.value }))}
              placeholder="no-reply@cpc.pt"
              disabled={loading}
            />
            {validation.errors.smtpFromEmail ? <p className="text-sm font-medium text-destructive">{validation.errors.smtpFromEmail}</p> : null}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleTestSmtp} disabled={loading || !validation.ok}>
            Testar SMTP
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
