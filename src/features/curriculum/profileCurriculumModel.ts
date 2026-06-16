import { splitCsvLike } from '@/components/curriculum/CurriculumTagAutocomplete';

export type ProfileDoc = Record<string, unknown>;

export type CvExperienceEntry = {
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

export type CvEducationEntry = {
  entryId: string;
  institution: string;
  degreeLevel: string;
  course: string;
  description: string;
  startDate: string;
  endDate: string;
  inProgress: boolean;
};

export type CpcCurriculumViewModel = {
  fullName: string;
  professionalTitle: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  experiences: CvExperienceEntry[];
  educations: CvEducationEntry[];
  skills: string[];
  languages: string[];
};

export function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

export function hasExperienceContent(entry: CvExperienceEntry): boolean {
  return [entry.title, entry.organization, entry.location, entry.description].some((v) => v.trim().length > 0);
}

export function hasEducationContent(entry: CvEducationEntry): boolean {
  return [entry.course, entry.institution, entry.description].some((v) => v.trim().length > 0);
}

export function parseExperiences(profileDoc: ProfileDoc | null | undefined): CvExperienceEntry[] {
  const experienceEntriesRaw = profileDoc?.cvExperienceEntries;
  if (Array.isArray(experienceEntriesRaw)) {
    return experienceEntriesRaw
      .map(parseExperienceEntry)
      .filter((e): e is CvExperienceEntry => !!e)
      .filter(hasExperienceContent);
  }
  const legacy =
    asString(profileDoc?.cvExperience) || asString(profileDoc?.professionalExperience);
  if (legacy) {
    return [
      {
        entryId: 'legacy-exp',
        title: '',
        organization: '',
        location: '',
        description: legacy,
        startDate: '',
        endDate: '',
        currentRole: false,
        workMode: '',
      },
    ];
  }
  return [];
}

export function parseEducations(profileDoc: ProfileDoc | null | undefined): CvEducationEntry[] {
  const educationEntriesRaw = profileDoc?.cvEducationEntries;
  if (Array.isArray(educationEntriesRaw)) {
    return educationEntriesRaw
      .map(parseEducationEntry)
      .filter((e): e is CvEducationEntry => !!e)
      .filter(hasEducationContent);
  }
  const legacy = asString(profileDoc?.cvEducation);
  if (legacy) {
    return [
      {
        entryId: 'legacy-edu',
        institution: '',
        degreeLevel: '',
        course: legacy,
        description: '',
        startDate: '',
        endDate: '',
        inProgress: false,
      },
    ];
  }
  return [];
}

/** Indica se o migrante preencheu conteúdo no construtor de currículo CPC. */
export function hasCpcCurriculum(profileDoc: ProfileDoc | null | undefined): boolean {
  if (!profileDoc) return false;
  if (asString(profileDoc.cvSummary)) return true;
  if (parseExperiences(profileDoc).length > 0) return true;
  if (parseEducations(profileDoc).length > 0) return true;
  return false;
}

export function buildCpcCurriculumViewModel(
  profileDoc: ProfileDoc | null | undefined,
  fallbacks: {
    fullName: string;
    professionalTitle: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  }
): CpcCurriculumViewModel {
  return {
    fullName: asString(profileDoc?.name) || fallbacks.fullName,
    professionalTitle: asString(profileDoc?.professionalTitle) || fallbacks.professionalTitle,
    email: asString(profileDoc?.email) || fallbacks.email,
    phone: asString(profileDoc?.phone) || fallbacks.phone,
    location:
      asString(profileDoc?.currentLocation) ||
      asString(profileDoc?.address) ||
      fallbacks.location,
    summary: asString(profileDoc?.cvSummary) || fallbacks.summary,
    experiences: parseExperiences(profileDoc),
    educations: parseEducations(profileDoc),
    skills: splitCsvLike(asString(profileDoc?.skills)),
    languages: splitCsvLike(asString(profileDoc?.languagesList)),
  };
}

export function localeForLanguage(language: string): string {
  if (language === 'pt') return 'pt-PT';
  if (language === 'es') return 'es-ES';
  if (language === 'fr') return 'fr-FR';
  return 'en-US';
}

export function formatMonthYear(ym: string, locale: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return '';
  return new Date(y, mo, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}
