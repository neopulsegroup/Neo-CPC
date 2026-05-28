import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PhoneInput,
  companyPhoneForPayload,
  formatPhoneValueForDisplay,
  isValidInternationalPhone,
} from '@/components/ui/phone-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateUserProfile } from '@/integrations/firebase/auth';
import { getDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import { Building2, Camera, Loader2, Save, UserCog } from 'lucide-react';

type ProfileDoc = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
};

function formatLoadedPhone(raw: string | null | undefined): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  return formatPhoneValueForDisplay(s);
}

export default function CPCProfilePage() {
  const { user, profile, profileData, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_ALLOWED_MIME = useMemo(() => new Set(['image/jpeg', 'image/png', 'image/gif']), []);

  const [doc, setDoc] = useState<ProfileDoc | null>(null);
  const [edit, setEdit] = useState<{ name: string; phone: string }>({ name: '', phone: '' });

  const displayEmail = profile?.email || user?.email || '';
  const displayRole = profile?.role ? String(profile.role).toUpperCase() : '—';

  const avatarFallback = useMemo(() => {
    const name = edit.name || profile?.name || '';
    const parts = name.trim().split(/\s+/g).filter(Boolean);
    const letters = parts.slice(0, 2).map((p) => p.slice(0, 1).toUpperCase()).join('');
    return letters || 'U';
  }, [edit.name, profile?.name]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getDocument<ProfileDoc>('profiles', user.uid);
        if (cancelled) return;
        const merged = res ?? ({ id: user.uid } as ProfileDoc);
        setDoc(merged);
        setEdit({
          name: profile?.name || merged.name || '',
          phone: formatLoadedPhone(merged.phone || profileData?.phone),
        });
        setEditMode(false);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'permission-denied' || msg === 'PERMISSION_DENIED') {
          setError(t.cpc.profile.errors.loadNoPermission);
        } else {
          setError(t.cpc.profile.errors.loadGeneric);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile?.name, profileData?.phone, t.cpc.profile.errors.loadGeneric, t.cpc.profile.errors.loadNoPermission, user?.uid]);

  async function handlePhotoPick(file: File) {
    if (!user?.uid) return;
    if (!PHOTO_ALLOWED_MIME.has(file.type)) {
      toast({ title: t.cpc.profile.photo.invalidFormatTitle, description: t.cpc.profile.photo.invalidFormatDesc, variant: 'destructive' });
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      toast({ title: t.cpc.profile.photo.tooLargeTitle, description: t.cpc.profile.photo.tooLargeDesc, variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    try {
      const path = `profile_photos/${user.uid}`;
      const ref = makeStorageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      await updateDocument('profiles', user.uid, { photoUrl: url });
      await refreshProfile();
      setDoc((prev) => (prev ? { ...prev, photoUrl: url } : ({ id: user.uid, photoUrl: url } as ProfileDoc)));
      toast({ title: t.cpc.profile.photo.updatedTitle, description: t.cpc.profile.photo.updatedDesc });
    } catch (err: unknown) {
      toast({ title: t.common.errorTitle, description: t.cpc.profile.photo.updateError, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save() {
    if (!user?.uid) return;
    const name = edit.name.trim();
    const phonePayload = companyPhoneForPayload(edit.phone);

    if (!name) {
      toast({ title: t.common.validationTitle, description: t.cpc.profile.validation.nameRequired, variant: 'destructive' });
      return;
    }
    if (!isValidInternationalPhone(edit.phone)) {
      toast({ title: t.common.validationTitle, description: t.cpc.profile.validation.phoneInvalid, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, { name });
      await updateDocument('profiles', user.uid, { name, phone: phonePayload });
      await refreshProfile();
      setEditMode(false);
      toast({ title: t.cpc.profile.toast.updatedTitle, description: t.cpc.profile.toast.updatedDesc });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'permission-denied' || msg === 'PERMISSION_DENIED') {
        toast({ title: t.cpc.profile.errors.saveNoPermissionTitle, description: t.cpc.profile.errors.saveNoPermissionDesc, variant: 'destructive' });
        return;
      }
      toast({ title: t.common.errorTitle, description: t.cpc.profile.errors.saveGeneric, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEdit({
      name: profile?.name || doc?.name || '',
      phone: formatLoadedPhone(doc?.phone || profileData?.phone),
    });
    setEditMode(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cpc-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.cpc.profile.title}
          </h1>
          <p className="text-muted-foreground mt-1">{t.cpc.profile.subtitle}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2 self-start md:self-auto">
          {editMode ? (
            <>
              <Button variant="outline" onClick={cancel} disabled={saving || uploadingPhoto}>
                {t.common.cancel}
              </Button>
              <Button onClick={save} disabled={saving || uploadingPhoto}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {t.common.save}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)}>
              <UserCog className="h-4 w-4 mr-2" />
              {t.cpc.profile.actions.edit}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="cpc-card p-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.cpc.profile.sections.photo}</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={doc?.photoUrl || profileData?.photoUrl || undefined} alt={edit.name || t.cpc.menu.user_fallback} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoPick(f);
                  e.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-95 disabled:opacity-60"
                aria-label={t.cpc.profile.photo.changeAriaLabel}
              >
                {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{profile?.name || edit.name || t.cpc.menu.user_fallback}</p>
              <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground mt-2">{displayRole}</p>
            </div>
          </div>
        </div>

        <div className="cpc-card p-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.cpc.profile.sections.info}</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cpc-profile-name">{t.cpc.profile.labels.name}</Label>
              <Input
                id="cpc-profile-name"
                value={edit.name}
                onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                disabled={!editMode}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpc-profile-email">{t.cpc.profile.labels.email}</Label>
              <Input id="cpc-profile-email" value={displayEmail} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpc-profile-role">{t.cpc.profile.labels.role}</Label>
              <Input id="cpc-profile-role" value={displayRole} disabled />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cpc-profile-phone">{t.cpc.profile.labels.phone}</Label>
              <PhoneInput
                id="cpc-profile-phone"
                value={edit.phone}
                onChange={(phone) => setEdit((p) => ({ ...p, phone }))}
                disabled={!editMode}
                placeholder={t.cpc.profile.placeholders.phone}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
