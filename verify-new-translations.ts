import { translations } from './src/lib/i18n';

console.log('Verifying translations for is_in_portugal_desc...');

const langs = ['pt', 'en', 'es'] as const;

langs.forEach(lang => {
  const desc = translations[lang].triage.options.is_in_portugal_desc;
  console.log(`[${lang.toUpperCase()}] Yes: ${desc?.yes}, No: ${desc?.no}`);
  if (!desc?.yes || !desc?.no) {
    console.error(`[${lang.toUpperCase()}] MISSING DESCRIPTIONS!`);
    process.exit(1);
  }
});

console.log('All descriptions present.');
