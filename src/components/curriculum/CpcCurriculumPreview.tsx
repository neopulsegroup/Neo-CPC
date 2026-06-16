import { Mail, MapPin, Phone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  type CpcCurriculumViewModel,
  formatMonthYear,
  localeForLanguage,
} from '@/features/curriculum/profileCurriculumModel';

type CpcCurriculumPreviewProps = {
  model: CpcCurriculumViewModel;
  className?: string;
};

export function CpcCurriculumPreview({ model, className }: CpcCurriculumPreviewProps) {
  const { t, language } = useLanguage();
  const locale = localeForLanguage(language);

  return (
    <div className={className ?? 'rounded-xl border bg-white p-6 text-slate-800 shadow-sm'}>
      <section>
        <h3 className="text-2xl font-bold leading-tight">{model.fullName}</h3>
        <p className="mt-1 text-base font-medium text-sky-700">{model.professionalTitle}</p>
        <div className="mt-3 space-y-1.5 text-sm text-slate-600">
          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{model.email}</span>
          </p>
          <p className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{model.phone}</span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{model.location}</span>
          </p>
        </div>
      </section>

      <section className="mt-6 border-t pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t.get('migrant.curriculum.preview.summaryTitle')}
        </h4>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{model.summary}</p>
      </section>

      <section className="mt-6 border-t pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t.get('migrant.curriculum.preview.experienceTitle')}
        </h4>
        {model.experiences.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.experienceFallback')}</p>
        ) : (
          <div className="mt-2 space-y-4">
            {model.experiences.map((exp) => {
              const start = formatMonthYear(exp.startDate, locale);
              const end = exp.currentRole
                ? t.get('migrant.curriculum.preview.present')
                : formatMonthYear(exp.endDate, locale);
              const range = [start, end].filter(Boolean).join(' — ');
              const modeLabel = exp.workMode ? t.get(`migrant.curriculum.workMode.${exp.workMode}`) : '';
              const meta = [exp.organization, exp.location, modeLabel].filter(Boolean).join(' · ');
              return (
                <div
                  key={exp.entryId}
                  className="border-b border-slate-100 pb-3 text-sm text-slate-700 last:border-0 last:pb-0"
                >
                  <p className="font-semibold text-slate-900">{exp.title || '—'}</p>
                  {meta ? <p className="mt-0.5 text-slate-600">{meta}</p> : null}
                  {range ? <p className="mt-1 text-xs text-slate-500">{range}</p> : null}
                  {exp.description ? (
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{exp.description}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 border-t pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t.get('migrant.curriculum.preview.educationTitle')}
        </h4>
        {model.educations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.educationFallback')}</p>
        ) : (
          <div className="mt-2 space-y-4">
            {model.educations.map((edu) => {
              const start = formatMonthYear(edu.startDate, locale);
              const end = edu.inProgress
                ? t.get('migrant.curriculum.preview.inProgress')
                : formatMonthYear(edu.endDate, locale);
              const range = [start, end].filter(Boolean).join(' — ');
              const degreeLabel = edu.degreeLevel ? t.get(`migrant.curriculum.degreeLevel.${edu.degreeLevel}`) : '';
              const headline = edu.course || edu.institution || degreeLabel || '—';
              const subline = [edu.institution, degreeLabel].filter(Boolean).filter((x) => x !== headline).join(' · ');
              return (
                <div
                  key={edu.entryId}
                  className="border-b border-slate-100 pb-3 text-sm text-slate-700 last:border-0 last:pb-0"
                >
                  <p className="font-semibold text-slate-900">{headline}</p>
                  {subline ? <p className="mt-0.5 text-slate-600">{subline}</p> : null}
                  {range ? <p className="mt-1 text-xs text-slate-500">{range}</p> : null}
                  {edu.description ? (
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{edu.description}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 border-t pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t.get('migrant.curriculum.preview.skillsTitle')}
        </h4>
        {model.skills.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {model.skills.map((skill) => (
              <span key={skill} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.skillsFallback')}</p>
        )}
      </section>

      <section className="mt-6 border-t pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t.get('migrant.curriculum.preview.languagesTitle')}
        </h4>
        {model.languages.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {model.languages.map((lang) => (
              <span key={lang} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {lang}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t.get('migrant.curriculum.preview.languagesFallback')}</p>
        )}
      </section>
    </div>
  );
}
