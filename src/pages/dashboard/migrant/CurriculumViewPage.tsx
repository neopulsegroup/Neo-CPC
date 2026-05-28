import { useEffect, useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { getDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { splitCsvLike } from '@/components/curriculum/CurriculumTagAutocomplete';

type ProfileDoc = Record<string, unknown>;

type CvExperienceEntry = {
  entryId: string;
  title: string;
  organization: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
  currentRole: boolean;
  workMode: string;
};

type CvEducationEntry = {
  entryId: string;
  institution: string;
  degreeLevel: string;
  course: string;
  description: string;
  startDate: string;
  endDate: string;
  inProgress: boolean;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function parseExperienceEntry(raw: unknown): CvExperienceEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const entryId = asString(o.entryId);
  return {
    entryId: entryId || `exp-${Math.random().toString(36).slice(2, 10)}`,
    title: asString(o.title),
    organization: asString(o.organization),
    location: asString(o.location),
    description: asString(o.description),
    startDate: asString(o.startDate),
    endDate: asString(o.endDate),
    currentRole: o.currentRole === true,
    workMode: asString(o.workMode),
  };
}

function parseEducationEntry(raw: unknown): CvEducationEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const entryId = asString(o.entryId);
  return {
    entryId: entryId || `edu-${Math.random().toString(36).slice(2, 10)}`,
    institution: asString(o.institution),
    degreeLevel: asString(o.degreeLevel),
    course: asString(o.course),
    description: asString(o.description),
    startDate: asString(o.startDate),
    endDate: asString(o.endDate),
    inProgress: o.inProgress === true,
  };
}

function hasExperienceContent(entry: CvExperienceEntry): boolean {
  return [entry.title, entry.organization, entry.location, entry.description].some((v) => v.trim().length > 0);
}

function hasEducationContent(entry: CvEducationEntry): boolean {
  return [entry.course, entry.institution, entry.description].some((v) => v.trim().length > 0);
}

function formatMonthYear(ym: string, locale: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return '';
  return new Date(y, mo, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

function localeForLanguage(language: string): string {
  if (language === 'pt') return 'pt-PT';
  if (language === 'es') return 'es-ES';
  if (language === 'fr') return 'fr-FR';
  return 'en-US';
}

export default function CurriculumViewPage() {
  const { migrantId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [profileDoc, setProfileDoc] = useState<ProfileDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!migrantId) return;
      setLoading(true);
      try {
        const profile = await getDocument<ProfileDoc>('profiles', migrantId);
        if (!cancelled) setProfileDoc(profile || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [migrantId]);

  if (!user) {
    return <div className="py-12 text-center text-muted-foreground">Precisa de iniciar sessão.</div>;
  }

  if (!migrantId) return <Navigate to="/dashboard/migrante/curriculo" replace />;
  if (migrantId !== user.uid) return <Navigate to={`/dashboard/migrante/curriculo/ver/${user.uid}`} replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const fullName = asString(profileDoc?.name) || 'NOME COMPLETO';
  const nameParts = splitName(fullName);
  const professionalTitle = asString(profileDoc?.professionalTitle) || t.get('migrant.curriculum.preview.roleFallback');
  const email = asString(profileDoc?.email) || 'email@exemplo.com';
  const phone = asString(profileDoc?.phone) || '+351 000 000 000';
  const location = asString(profileDoc?.currentLocation) || asString(profileDoc?.address) || 'Lisboa, Portugal';
  const summary = asString(profileDoc?.cvSummary) || t.get('migrant.curriculum.preview.summaryFallback');

  const locale = localeForLanguage(language);

  const experienceEntriesRaw = profileDoc?.cvExperienceEntries;
  const experiences = Array.isArray(experienceEntriesRaw)
    ? experienceEntriesRaw.map(parseExperienceEntry).filter((e): e is CvExperienceEntry => !!e).filter(hasExperienceContent)
    : [];

  const educationEntriesRaw = profileDoc?.cvEducationEntries;
  const educations = Array.isArray(educationEntriesRaw)
    ? educationEntriesRaw.map(parseEducationEntry).filter((e): e is CvEducationEntry => !!e).filter(hasEducationContent)
    : [];

  const skills = splitCsvLike(asString(profileDoc?.skills));
  const languages = splitCsvLike(asString(profileDoc?.languagesList));

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-2xl font-bold">{t.get('migrant.curriculum.view.title')}</h1>
        <p className="text-sm text-muted-foreground">{t.get('migrant.curriculum.view.subtitle')}</p>
      </div>

      <div className="rounded-xl border bg-white p-8 text-slate-800 shadow-sm">
        <section>
          <h2 className="text-3xl font-bold leading-tight">{fullName}</h2>
          <p className="mt-1 text-base text-sky-700 font-medium">{professionalTitle}</p>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden />
              <span>{email}</span>
            </p>
            <p className="flex items-start gap-2">
              <Phone className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden />
              <span>{phone}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" aria-hidden />
              <span>{location}</span>
            </p>
          </div>
        </section>

        <section className="mt-6 border-t pt-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            {t.get('migrant.curriculum.preview.summaryTitle')}
          </h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{summary}</p>
        </section>

        <section className="mt-6 border-t pt-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            {t.get('migrant.curriculum.preview.experienceTitle')}
          </h3>
          {experiences.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.experienceFallback')}</p>
          ) : (
            <div className="mt-2 space-y-4">
              {experiences.map((exp) => {
                const start = formatMonthYear(exp.startDate, locale);
                const end = exp.currentRole ? t.get('migrant.curriculum.preview.present') : formatMonthYear(exp.endDate, locale);
                const range = [start, end].filter(Boolean).join(' — ');
                const modeLabel = exp.workMode ? t.get(`migrant.curriculum.workMode.${exp.workMode}`) : '';
                const meta = [exp.organization, exp.location, modeLabel].filter(Boolean).join(' · ');
                return (
                  <div key={exp.entryId} className="text-sm text-slate-700 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <p className="font-semibold text-slate-900">{exp.title || '—'}</p>
                    {meta ? <p className="text-slate-600 mt-0.5">{meta}</p> : null}
                    {range ? <p className="text-slate-500 text-xs mt-1">{range}</p> : null}
                    {exp.description ? <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">{exp.description}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 border-t pt-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            {t.get('migrant.curriculum.preview.educationTitle')}
          </h3>
          {educations.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.educationFallback')}</p>
          ) : (
            <div className="mt-2 space-y-4">
              {educations.map((edu) => {
                const start = formatMonthYear(edu.startDate, locale);
                const end = edu.inProgress ? t.get('migrant.curriculum.preview.inProgress') : formatMonthYear(edu.endDate, locale);
                const range = [start, end].filter(Boolean).join(' — ');
                const degreeLabel = edu.degreeLevel ? t.get(`migrant.curriculum.degreeLevel.${edu.degreeLevel}`) : '';
                const headline = edu.course || edu.institution || degreeLabel || '—';
                const subline = [edu.institution, degreeLabel].filter(Boolean).filter((x) => x !== headline).join(' · ');
                return (
                  <div key={edu.entryId} className="text-sm text-slate-700 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <p className="font-semibold text-slate-900">{headline}</p>
                    {subline ? <p className="text-slate-600 mt-0.5">{subline}</p> : null}
                    {range ? <p className="text-slate-500 text-xs mt-1">{range}</p> : null}
                    {edu.description ? <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-line">{edu.description}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 border-t pt-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            {t.get('migrant.curriculum.preview.skillsTitle')}
          </h3>
          {skills.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.skillsFallback')}</p>
          )}
        </section>

        <section className="mt-6 border-t pt-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            {t.get('migrant.curriculum.preview.languagesTitle')}
          </h3>
          {languages.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {languages.map((lang) => (
                <span key={lang} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {lang}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.languagesFallback')}</p>
          )}
        </section>

        <section className="mt-6 border-t pt-4">
          <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-500">
            <p>
              <strong>{t.get('migrant.curriculum.fields.firstName')}:</strong> {nameParts.firstName || '—'}
            </p>
            <p>
              <strong>{t.get('migrant.curriculum.fields.lastName')}:</strong> {nameParts.lastName || '—'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
