import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, GraduationCap, Languages, Briefcase, User, Save, Mail, Phone, MapPin, Plus, Trash2, FileDown } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { exportCurriculumPreviewToPdf, sanitizeCurriculumPdfFileName } from '@/features/curriculum/exportCurriculumPdf';
import { getCurriculumLanguageSuggestions, getCurriculumSkillSuggestions } from '@/features/curriculum/skillLanguageSuggestions';
import { getDocument, updateDocument } from '@/integrations/firebase/firestore';
import { CurriculumTagAutocomplete, splitCsvLike } from '@/components/curriculum/CurriculumTagAutocomplete';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const WORK_MODE_KEYS = ['onsite', 'remote', 'hybrid'] as const;

type CvExperienceEntry = {
  entryId: string;
  title: string;
  workMode: string;
  organization: string;
  startDate: string;
  currentRole: boolean;
  endDate: string;
  location: string;
  description: string;
};

function newExperienceEntry(): CvExperienceEntry {
  return {
    entryId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: '',
    workMode: '',
    organization: '',
    startDate: '',
    currentRole: false,
    endDate: '',
    location: '',
    description: '',
  };
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseFirestoreExperience(raw: unknown): CvExperienceEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const wm = safeString(o.workMode);
  const validMode = WORK_MODE_KEYS.includes(wm as (typeof WORK_MODE_KEYS)[number]) ? wm : '';
  return {
    entryId: safeString(o.entryId) || newExperienceEntry().entryId,
    title: safeString(o.title),
    workMode: validMode,
    organization: safeString(o.organization),
    startDate: safeString(o.startDate),
    currentRole: o.currentRole === true,
    endDate: safeString(o.endDate),
    location: safeString(o.location),
    description: safeString(o.description),
  };
}

function loadExperiencesFromProfile(profileDoc: Record<string, unknown> | null | undefined): CvExperienceEntry[] {
  const entries = profileDoc?.cvExperienceEntries;
  if (Array.isArray(entries) && entries.length > 0) {
    const parsed = entries.map(parseFirestoreExperience).filter((e): e is CvExperienceEntry => e !== null);
    if (parsed.length > 0) return parsed;
  }
  const legacy =
    (typeof profileDoc?.cvExperience === 'string' && profileDoc.cvExperience.trim()) ||
    (typeof profileDoc?.professionalExperience === 'string' && profileDoc.professionalExperience.trim()) ||
    '';
  if (legacy) {
    const e = newExperienceEntry();
    e.description = legacy;
    return [e];
  }
  return [newExperienceEntry()];
}

function experienceEntryHasContent(e: CvExperienceEntry): boolean {
  return [e.title, e.organization, e.location, e.description].some((x) => x.trim().length > 0);
}

function experiencesToPlainText(entries: CvExperienceEntry[]): string {
  return entries
    .filter(experienceEntryHasContent)
    .map((e) => {
      const head = [e.title, e.organization].filter((x) => x.trim()).join(' — ');
      const tail = e.description.trim();
      return [head, tail].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function localeTag(language: Language): string {
  if (language === 'pt') return 'pt-PT';
  if (language === 'es') return 'es';
  if (language === 'fr') return 'fr-FR';
  return 'en';
}

function formatMonthYear(ym: string, language: Language): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return ym;
  try {
    return new Date(y, mo, 1).toLocaleDateString(localeTag(language), { month: 'short', year: 'numeric' });
  } catch {
    return ym;
  }
}

const DEGREE_LEVEL_KEYS = ['secondary', 'professional', 'bachelor', 'master', 'doctorate', 'other'] as const;

type CvEducationEntry = {
  entryId: string;
  institution: string;
  degreeLevel: string;
  course: string;
  startDate: string;
  inProgress: boolean;
  endDate: string;
  description: string;
};

function newEducationEntry(): CvEducationEntry {
  return {
    entryId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `edu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    institution: '',
    degreeLevel: '',
    course: '',
    startDate: '',
    inProgress: false,
    endDate: '',
    description: '',
  };
}

function parseFirestoreEducation(raw: unknown): CvEducationEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const dl = safeString(o.degreeLevel);
  const validLevel = DEGREE_LEVEL_KEYS.includes(dl as (typeof DEGREE_LEVEL_KEYS)[number]) ? dl : '';
  return {
    entryId: safeString(o.entryId) || newEducationEntry().entryId,
    institution: safeString(o.institution),
    degreeLevel: validLevel,
    course: safeString(o.course),
    startDate: safeString(o.startDate),
    inProgress: o.inProgress === true,
    endDate: safeString(o.endDate),
    description: safeString(o.description),
  };
}

function loadEducationFromProfile(profileDoc: Record<string, unknown> | null | undefined): CvEducationEntry[] {
  const entries = profileDoc?.cvEducationEntries;
  if (Array.isArray(entries) && entries.length > 0) {
    const parsed = entries.map(parseFirestoreEducation).filter((e): e is CvEducationEntry => e !== null);
    if (parsed.length > 0) return parsed;
  }
  const legacy = typeof profileDoc?.cvEducation === 'string' && profileDoc.cvEducation.trim();
  if (legacy) {
    const e = newEducationEntry();
    e.description = legacy;
    return [e];
  }
  return [newEducationEntry()];
}

function educationEntryHasContent(e: CvEducationEntry): boolean {
  return [e.institution, e.course, e.description].some((x) => x.trim().length > 0);
}

function educationToPlainText(entries: CvEducationEntry[]): string {
  return entries
    .filter(educationEntryHasContent)
    .map((e) => {
      const head = [e.course, e.institution].filter((x) => x.trim()).join(' — ');
      const tail = e.description.trim();
      return [head, tail].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

type CurriculumFormState = {
  firstName: string;
  lastName: string;
  professionalTitle: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
};

const EMPTY_FORM: CurriculumFormState = {
  firstName: '',
  lastName: '',
  professionalTitle: '',
  email: '',
  phone: '',
  location: '',
  summary: '',
};

function splitName(value: string): { firstName: string; lastName: string } {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export default function CurriculumPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CurriculumFormState>(EMPTY_FORM);
  const [experiences, setExperiences] = useState<CvExperienceEntry[]>([newExperienceEntry()]);
  const [educations, setEducations] = useState<CvEducationEntry[]>([newEducationEntry()]);
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [languageTags, setLanguageTags] = useState<string[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const pdfExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCurriculum() {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const profileDoc = await getDocument<Record<string, unknown>>('profiles', user.uid);
        if (cancelled) return;

        const savedName = typeof profileDoc?.name === 'string' ? profileDoc.name : profile?.name || '';
        const nameParts = splitName(savedName);

        setForm({
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          professionalTitle: typeof profileDoc?.professionalTitle === 'string' ? profileDoc.professionalTitle : '',
          email: typeof profileDoc?.email === 'string' ? profileDoc.email : profile?.email || user.email || '',
          phone: typeof profileDoc?.phone === 'string' ? profileDoc.phone : '',
          location:
            (typeof profileDoc?.currentLocation === 'string' && profileDoc.currentLocation) ||
            (typeof profileDoc?.address === 'string' && profileDoc.address) ||
            '',
          summary: typeof profileDoc?.cvSummary === 'string' ? profileDoc.cvSummary : '',
        });
        setExperiences(loadExperiencesFromProfile(profileDoc));
        setEducations(loadEducationFromProfile(profileDoc));
        setSkillTags(splitCsvLike(typeof profileDoc?.skills === 'string' ? profileDoc.skills : ''));
        setLanguageTags(splitCsvLike(typeof profileDoc?.languagesList === 'string' ? profileDoc.languagesList : ''));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCurriculum();
    return () => {
      cancelled = true;
    };
  }, [profile?.email, profile?.name, user?.email, user?.uid]);

  const experienceProgressMarker = useMemo(
    () => (experiences.some(experienceEntryHasContent) ? '1' : ''),
    [experiences]
  );

  const educationProgressMarker = useMemo(
    () => (educations.some(educationEntryHasContent) ? '1' : ''),
    [educations]
  );

  const skillsProgressMarker = useMemo(() => (skillTags.length > 0 ? '1' : ''), [skillTags]);
  const languagesProgressMarker = useMemo(() => (languageTags.length > 0 ? '1' : ''), [languageTags]);

  const skillSuggestions = useMemo(() => getCurriculumSkillSuggestions(language), [language]);
  const languageSuggestions = useMemo(() => getCurriculumLanguageSuggestions(language), [language]);

  const requiredFields = useMemo(
    () => [
      form.firstName,
      form.lastName,
      form.professionalTitle,
      form.email,
      form.phone,
      form.location,
      form.summary,
      experienceProgressMarker,
      educationProgressMarker,
      skillsProgressMarker,
      languagesProgressMarker,
    ],
    [form, experienceProgressMarker, educationProgressMarker, skillsProgressMarker, languagesProgressMarker]
  );

  const completedFields = requiredFields.filter((field) => field.trim().length > 0).length;
  const progress = Math.round((completedFields / requiredFields.length) * 100);

  const sectionProgress = useMemo(
    () => [
      {
        id: 'personal',
        label: t.get('migrant.curriculum.sections.personal'),
        done:
          [form.firstName, form.lastName, form.professionalTitle, form.email, form.phone, form.location, form.summary].filter((v) =>
            v.trim()
          ).length >= 6,
      },
      {
        id: 'experience',
        label: t.get('migrant.curriculum.sections.experience'),
        done: experiences.some(experienceEntryHasContent),
      },
      {
        id: 'education',
        label: t.get('migrant.curriculum.sections.education'),
        done: educations.some(educationEntryHasContent),
      },
      {
        id: 'skills',
        label: t.get('migrant.curriculum.sections.skills'),
        done: skillTags.length > 0 && languageTags.length > 0,
      },
    ],
    [form, experiences, educations, skillTags, languageTags, t]
  );

  const previewFullName = `${form.firstName} ${form.lastName}`.trim();
  const previewSkills = skillTags.slice(0, 12);

  function updateExperience(entryId: string, patch: Partial<CvExperienceEntry>) {
    setExperiences((prev) => prev.map((e) => (e.entryId === entryId ? { ...e, ...patch } : e)));
  }

  function addExperience() {
    setExperiences((prev) => [...prev, newExperienceEntry()]);
  }

  function removeExperience(entryId: string) {
    setExperiences((prev) => {
      const next = prev.filter((e) => e.entryId !== entryId);
      return next.length > 0 ? next : [newExperienceEntry()];
    });
  }

  function updateEducation(entryId: string, patch: Partial<CvEducationEntry>) {
    setEducations((prev) => prev.map((e) => (e.entryId === entryId ? { ...e, ...patch } : e)));
  }

  function addEducation() {
    setEducations((prev) => [...prev, newEducationEntry()]);
  }

  function removeEducation(entryId: string) {
    setEducations((prev) => {
      const next = prev.filter((e) => e.entryId !== entryId);
      return next.length > 0 ? next : [newEducationEntry()];
    });
  }

  async function handleSave() {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const experiencePlain = experiencesToPlainText(experiences);
      const cvExperienceEntries = experiences.map((e) => ({
        entryId: e.entryId,
        title: e.title.trim(),
        workMode: e.workMode,
        organization: e.organization.trim(),
        startDate: e.startDate,
        currentRole: e.currentRole,
        endDate: e.currentRole ? '' : e.endDate,
        location: e.location.trim(),
        description: e.description.trim(),
      }));

      const educationPlain = educationToPlainText(educations);
      const cvEducationEntries = educations.map((e) => ({
        entryId: e.entryId,
        institution: e.institution.trim(),
        degreeLevel: e.degreeLevel,
        course: e.course.trim(),
        startDate: e.startDate,
        inProgress: e.inProgress,
        endDate: e.inProgress ? '' : e.endDate,
        description: e.description.trim(),
      }));

      await updateDocument('profiles', user.uid, {
        name: fullName || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        currentLocation: form.location.trim() || null,
        professionalTitle: form.professionalTitle.trim() || null,
        professionalExperience: experiencePlain || null,
        skills: skillTags.length ? skillTags.join(', ') : null,
        languagesList: languageTags.length ? languageTags.join(', ') : null,
        cvSummary: form.summary.trim() || null,
        cvExperience: experiencePlain || null,
        cvExperienceEntries,
        cvEducation: educationPlain || null,
        cvEducationEntries,
      });
      toast({
        title: t.get('migrant.curriculum.feedback.savedTitle'),
        description: t.get('migrant.curriculum.feedback.savedDescription'),
      });
    } catch {
      toast({
        title: t.get('migrant.curriculum.feedback.errorTitle'),
        description: t.get('migrant.curriculum.feedback.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPdf() {
    const root = pdfExportRef.current;
    if (!root) {
      toast({
        title: t.get('migrant.curriculum.feedback.exportPdfErrorTitle'),
        description: t.get('migrant.curriculum.feedback.exportPdfErrorDescription'),
        variant: 'destructive',
      });
      return;
    }
    setExportingPdf(true);
    try {
      const safe = sanitizeCurriculumPdfFileName(previewFullName || 'curriculo');
      await exportCurriculumPreviewToPdf(root, `${safe}.pdf`);
    } catch {
      toast({
        title: t.get('migrant.curriculum.feedback.exportPdfErrorTitle'),
        description: t.get('migrant.curriculum.feedback.exportPdfErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setExportingPdf(false);
    }
  }

  if (!user) {
    return <div className="py-12 text-center text-muted-foreground">Precisa de iniciar sessão.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const curriculumViewPath = `/dashboard/migrante/curriculo/ver/${user.uid}`;

  return (
    <div className="space-y-6">
      <header className="cpc-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.get('migrant.curriculum.menuTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t.get('migrant.curriculum.menuSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={exportingPdf || saving}
              onClick={() => navigate(curriculumViewPath)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t.get('migrant.curriculum.actions.view')}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExportPdf()} disabled={exportingPdf || saving}>
              <FileDown className="h-4 w-4 mr-2" />
              {exportingPdf ? t.get('migrant.curriculum.actions.exportingPdf') : t.get('migrant.curriculum.actions.exportPdf')}
            </Button>
            <Button onClick={handleSave} disabled={saving || exportingPdf}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t.get('migrant.curriculum.actions.saving') : t.get('migrant.curriculum.actions.save')}
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="xl:col-span-2 space-y-6">
          <div className="cpc-card p-6">
            <h2 className="text-lg font-semibold">{t.get('migrant.curriculum.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t.get('migrant.curriculum.subtitle')}</p>

            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t.get('migrant.curriculum.progressLabel')}
              </p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-medium">{progress}%</span>
                <span className="text-muted-foreground">
                  {t.get('migrant.curriculum.completedFields', {
                    completed: String(completedFields),
                    total: String(requiredFields.length),
                  })}
                </span>
              </div>
              <Progress value={progress} className="mt-2 h-2" />
            </div>

            <div className="mt-6 space-y-2">
              {sectionProgress.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                >
                  <span>{section.label}</span>
                  <span className={section.done ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>{section.done ? 'OK' : '...'}</span>
                </a>
              ))}
            </div>
          </div>

          <div id="personal" className="cpc-card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {t.get('migrant.curriculum.sections.personal')}
            </h2>
            <p className="text-sm text-muted-foreground">{t.get('migrant.curriculum.sections.personalHint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cv-first-name">{t.get('migrant.curriculum.fields.firstName')}</Label>
                <Input id="cv-first-name" value={form.firstName} onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cv-last-name">{t.get('migrant.curriculum.fields.lastName')}</Label>
                <Input id="cv-last-name" value={form.lastName} onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cv-title">{t.get('migrant.curriculum.fields.professionalTitle')}</Label>
                <Input
                  id="cv-title"
                  value={form.professionalTitle}
                  onChange={(e) => setForm((s) => ({ ...s, professionalTitle: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="cv-email">{t.get('migrant.curriculum.fields.email')}</Label>
                <Input id="cv-email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cv-phone">{t.get('migrant.curriculum.fields.phone')}</Label>
                <Input id="cv-phone" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cv-location">{t.get('migrant.curriculum.fields.location')}</Label>
                <Input id="cv-location" value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cv-summary">{t.get('migrant.curriculum.fields.summary')}</Label>
                <Textarea
                  id="cv-summary"
                  className="min-h-[120px]"
                  value={form.summary}
                  onChange={(e) => setForm((s) => ({ ...s, summary: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div id="experience" className="cpc-card p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                {t.get('migrant.curriculum.sections.experience')}
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={addExperience} className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                {t.get('migrant.curriculum.experience.add')}
              </Button>
            </div>

            <div className="space-y-6">
              {experiences.map((exp, index) => (
                <div key={exp.entryId} className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t.get('migrant.curriculum.experience.entryLabel', { n: String(index + 1) })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeExperience(exp.entryId)}
                      aria-label={t.get('migrant.curriculum.experience.remove')}
                    >
                      <Trash2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">{t.get('migrant.curriculum.experience.remove')}</span>
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor={`cv-exp-title-${exp.entryId}`}>{t.get('migrant.curriculum.fields.expTitle')}</Label>
                    <Input
                      id={`cv-exp-title-${exp.entryId}`}
                      value={exp.title}
                      onChange={(e) => updateExperience(exp.entryId, { title: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>{t.get('migrant.curriculum.fields.expWorkMode')}</Label>
                      <Select
                        value={exp.workMode || 'none'}
                        onValueChange={(v) => updateExperience(exp.entryId, { workMode: v === 'none' ? '' : v })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={t.get('migrant.curriculum.workMode.unspecified')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.get('migrant.curriculum.workMode.unspecified')}</SelectItem>
                          <SelectItem value="onsite">{t.get('migrant.curriculum.workMode.onsite')}</SelectItem>
                          <SelectItem value="remote">{t.get('migrant.curriculum.workMode.remote')}</SelectItem>
                          <SelectItem value="hybrid">{t.get('migrant.curriculum.workMode.hybrid')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`cv-exp-org-${exp.entryId}`}>{t.get('migrant.curriculum.fields.expOrganization')}</Label>
                      <Input
                        id={`cv-exp-org-${exp.entryId}`}
                        className="mt-1.5"
                        value={exp.organization}
                        onChange={(e) => updateExperience(exp.entryId, { organization: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`cv-exp-start-${exp.entryId}`}>{t.get('migrant.curriculum.fields.expStartDate')}</Label>
                    <Input
                      id={`cv-exp-start-${exp.entryId}`}
                      className="mt-1.5 max-w-[200px]"
                      type="month"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(exp.entryId, { startDate: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`cv-exp-current-${exp.entryId}`}
                      checked={exp.currentRole}
                      onCheckedChange={(checked) =>
                        updateExperience(exp.entryId, {
                          currentRole: checked === true,
                          ...(checked === true ? { endDate: '' } : {}),
                        })
                      }
                    />
                    <Label htmlFor={`cv-exp-current-${exp.entryId}`} className="text-sm font-normal cursor-pointer">
                      {t.get('migrant.curriculum.fields.expCurrent')}
                    </Label>
                  </div>

                  <div>
                    <Label htmlFor={`cv-exp-end-${exp.entryId}`}>{t.get('migrant.curriculum.fields.expEndDate')}</Label>
                    <Input
                      id={`cv-exp-end-${exp.entryId}`}
                      className="mt-1.5 max-w-[200px]"
                      type="month"
                      value={exp.endDate}
                      disabled={exp.currentRole}
                      onChange={(e) => updateExperience(exp.entryId, { endDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`cv-exp-loc-${exp.entryId}`}>{t.get('migrant.curriculum.fields.expJobLocation')}</Label>
                    <Input
                      id={`cv-exp-loc-${exp.entryId}`}
                      className="mt-1.5"
                      value={exp.location}
                      onChange={(e) => updateExperience(exp.entryId, { location: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`cv-exp-desc-${exp.entryId}`}>{t.get('migrant.curriculum.fields.expDescription')}</Label>
                    <Textarea
                      id={`cv-exp-desc-${exp.entryId}`}
                      className="mt-1.5 min-h-[100px]"
                      value={exp.description}
                      onChange={(e) => updateExperience(exp.entryId, { description: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="education" className="cpc-card p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                {t.get('migrant.curriculum.sections.education')}
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={addEducation} className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                {t.get('migrant.curriculum.education.add')}
              </Button>
            </div>

            <div className="space-y-6">
              {educations.map((edu, index) => (
                <div key={edu.entryId} className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t.get('migrant.curriculum.education.entryLabel', { n: String(index + 1) })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeEducation(edu.entryId)}
                      aria-label={t.get('migrant.curriculum.education.remove')}
                    >
                      <Trash2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">{t.get('migrant.curriculum.education.remove')}</span>
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor={`cv-edu-inst-${edu.entryId}`}>{t.get('migrant.curriculum.fields.eduInstitution')}</Label>
                    <Input
                      id={`cv-edu-inst-${edu.entryId}`}
                      className="mt-1.5"
                      value={edu.institution}
                      onChange={(e) => updateEducation(edu.entryId, { institution: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>{t.get('migrant.curriculum.fields.eduDegreeLevel')}</Label>
                    <Select
                      value={edu.degreeLevel || 'none'}
                      onValueChange={(v) => updateEducation(edu.entryId, { degreeLevel: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={t.get('migrant.curriculum.degreeLevel.unspecified')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t.get('migrant.curriculum.degreeLevel.unspecified')}</SelectItem>
                        <SelectItem value="secondary">{t.get('migrant.curriculum.degreeLevel.secondary')}</SelectItem>
                        <SelectItem value="professional">{t.get('migrant.curriculum.degreeLevel.professional')}</SelectItem>
                        <SelectItem value="bachelor">{t.get('migrant.curriculum.degreeLevel.bachelor')}</SelectItem>
                        <SelectItem value="master">{t.get('migrant.curriculum.degreeLevel.master')}</SelectItem>
                        <SelectItem value="doctorate">{t.get('migrant.curriculum.degreeLevel.doctorate')}</SelectItem>
                        <SelectItem value="other">{t.get('migrant.curriculum.degreeLevel.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`cv-edu-course-${edu.entryId}`}>{t.get('migrant.curriculum.fields.eduCourse')}</Label>
                    <Input
                      id={`cv-edu-course-${edu.entryId}`}
                      className="mt-1.5"
                      value={edu.course}
                      onChange={(e) => updateEducation(edu.entryId, { course: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`cv-edu-start-${edu.entryId}`}>{t.get('migrant.curriculum.fields.eduStartDate')}</Label>
                    <Input
                      id={`cv-edu-start-${edu.entryId}`}
                      className="mt-1.5 max-w-[200px]"
                      type="month"
                      value={edu.startDate}
                      onChange={(e) => updateEducation(edu.entryId, { startDate: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`cv-edu-progress-${edu.entryId}`}
                      checked={edu.inProgress}
                      onCheckedChange={(checked) =>
                        updateEducation(edu.entryId, {
                          inProgress: checked === true,
                          ...(checked === true ? { endDate: '' } : {}),
                        })
                      }
                    />
                    <Label htmlFor={`cv-edu-progress-${edu.entryId}`} className="text-sm font-normal cursor-pointer">
                      {t.get('migrant.curriculum.fields.eduInProgress')}
                    </Label>
                  </div>

                  <div>
                    <Label htmlFor={`cv-edu-end-${edu.entryId}`}>{t.get('migrant.curriculum.fields.eduEndDate')}</Label>
                    <Input
                      id={`cv-edu-end-${edu.entryId}`}
                      className="mt-1.5 max-w-[200px]"
                      type="month"
                      value={edu.endDate}
                      disabled={edu.inProgress}
                      onChange={(e) => updateEducation(edu.entryId, { endDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`cv-edu-desc-${edu.entryId}`}>{t.get('migrant.curriculum.fields.eduDescription')}</Label>
                    <Textarea
                      id={`cv-edu-desc-${edu.entryId}`}
                      className="mt-1.5 min-h-[100px]"
                      value={edu.description}
                      onChange={(e) => updateEducation(edu.entryId, { description: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="skills" className="cpc-card p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              {t.get('migrant.curriculum.sections.skills')}
            </h2>
            <div className="space-y-6">
              <CurriculumTagAutocomplete
                id="cv-skills"
                label={t.get('migrant.curriculum.fields.skills')}
                tags={skillTags}
                onTagsChange={setSkillTags}
                suggestions={skillSuggestions}
                placeholder={t.get('migrant.curriculum.fields.tagSearchSkills')}
                addCustomLabel={(v) => t.get('migrant.curriculum.fields.tagAddCustom', { value: v })}
                emptyHint={t.get('migrant.curriculum.fields.tagAlreadyAdded')}
                removeTagAriaLabel={(tag) => t.get('migrant.curriculum.fields.removeTagAria', { tag })}
              />
              <CurriculumTagAutocomplete
                id="cv-languages"
                label={t.get('migrant.curriculum.fields.languages')}
                tags={languageTags}
                onTagsChange={setLanguageTags}
                suggestions={languageSuggestions}
                placeholder={t.get('migrant.curriculum.fields.tagSearchLanguages')}
                addCustomLabel={(v) => t.get('migrant.curriculum.fields.tagAddCustom', { value: v })}
                emptyHint={t.get('migrant.curriculum.fields.tagAlreadyAdded')}
                removeTagAriaLabel={(tag) => t.get('migrant.curriculum.fields.removeTagAria', { tag })}
              />
            </div>
          </div>
        </section>

        <aside className="xl:col-span-3 cpc-card p-5 h-fit xl:sticky xl:top-24">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t.get('migrant.curriculum.preview.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t.get('migrant.curriculum.preview.subtitle')}</p>

          <div
            ref={pdfExportRef}
            id="curriculum-pdf-export-root"
            className="mt-4 rounded-xl border bg-white p-6 text-slate-800 shadow-sm"
          >
            <div className="cv-pdf-keep-together break-inside-avoid" style={{ breakInside: 'avoid' }}>
              <h3 className="text-2xl font-bold leading-tight">{previewFullName || 'NOME COMPLETO'}</h3>
              <p className="mt-1 text-base text-sky-700 font-medium">
                {form.professionalTitle || t.get('migrant.curriculum.preview.roleFallback')}
              </p>

              <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                <p className="flex items-start gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden />
                  <span>{form.email || 'email@exemplo.com'}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden />
                  <span>{form.phone || '+351 000 000 000'}</span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden />
                  <span>{form.location || 'Lisboa, Portugal'}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="cv-pdf-keep-together break-inside-avoid" style={{ breakInside: 'avoid' }}>
                <h4 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t.get('migrant.curriculum.preview.summaryTitle')}
                </h4>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  {form.summary || t.get('migrant.curriculum.preview.summaryFallback')}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <h4 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {t.get('migrant.curriculum.preview.experienceTitle')}
              </h4>
              {experiences.filter(experienceEntryHasContent).length === 0 ? (
                <div className="cv-pdf-keep-together break-inside-avoid mt-2" style={{ breakInside: 'avoid' }}>
                  <p className="text-sm text-slate-500">{t.get('migrant.curriculum.preview.experienceFallback')}</p>
                </div>
              ) : (
                <div className="mt-2 space-y-4">
                  {experiences.filter(experienceEntryHasContent).map((exp) => {
                    const start = formatMonthYear(exp.startDate, language);
                    const end = exp.currentRole
                      ? t.get('migrant.curriculum.preview.present')
                      : formatMonthYear(exp.endDate, language);
                    const range = [start, end].filter(Boolean).join(' — ');
                    const modeLabel = exp.workMode ? t.get(`migrant.curriculum.workMode.${exp.workMode}`) : '';
                    const meta = [exp.organization, exp.location, modeLabel].filter(Boolean).join(' · ');
                    return (
                      <div
                        key={exp.entryId}
                        className="cv-pdf-keep-together break-inside-avoid text-sm text-slate-700 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        style={{ breakInside: 'avoid' }}
                      >
                        <p className="font-semibold text-slate-900">{exp.title.trim() || '—'}</p>
                        {meta ? <p className="text-slate-600 mt-0.5">{meta}</p> : null}
                        {range ? <p className="text-slate-500 text-xs mt-1">{range}</p> : null}
                        {exp.description.trim() ? (
                          <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">{exp.description}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 border-t pt-4">
              <h4 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                {t.get('migrant.curriculum.preview.educationTitle')}
              </h4>
              {educations.filter(educationEntryHasContent).length === 0 ? (
                <div className="cv-pdf-keep-together break-inside-avoid mt-2" style={{ breakInside: 'avoid' }}>
                  <p className="text-sm text-slate-500">{t.get('migrant.curriculum.preview.educationFallback')}</p>
                </div>
              ) : (
                <div className="mt-2 space-y-4">
                  {educations.filter(educationEntryHasContent).map((edu) => {
                    const start = formatMonthYear(edu.startDate, language);
                    const end = edu.inProgress
                      ? t.get('migrant.curriculum.preview.inProgress')
                      : formatMonthYear(edu.endDate, language);
                    const range = [start, end].filter(Boolean).join(' — ');
                    const degreeLabel = edu.degreeLevel ? t.get(`migrant.curriculum.degreeLevel.${edu.degreeLevel}`) : '';
                    const headline =
                      edu.course.trim() || edu.institution.trim() || degreeLabel || '—';
                    const subLine = [edu.institution.trim(), degreeLabel]
                      .filter(Boolean)
                      .filter((s) => s !== headline)
                      .join(' · ');
                    return (
                      <div
                        key={edu.entryId}
                        className="cv-pdf-keep-together break-inside-avoid text-sm text-slate-700 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        style={{ breakInside: 'avoid' }}
                      >
                        <p className="font-semibold text-slate-900">{headline}</p>
                        {subLine ? <p className="text-slate-600 mt-0.5">{subLine}</p> : null}
                        {range ? <p className="text-slate-500 text-xs mt-1">{range}</p> : null}
                        {edu.description.trim() ? (
                          <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">{edu.description}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="cv-pdf-keep-together break-inside-avoid" style={{ breakInside: 'avoid' }}>
                <h4 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t.get('migrant.curriculum.preview.skillsTitle')}
                </h4>
                {previewSkills.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewSkills.map((skill) => (
                      <span key={skill} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.skillsFallback')}</p>
                )}
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="cv-pdf-keep-together break-inside-avoid" style={{ breakInside: 'avoid' }}>
                <h4 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t.get('migrant.curriculum.preview.languagesTitle')}
                </h4>
                {languageTags.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {languageTags.map((lang) => (
                      <span key={lang} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                        {lang}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.languagesFallback')}</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
