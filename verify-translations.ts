
import { translations } from './src/lib/i18n';

const lang = 'en';
const t = translations[lang];

console.log('--- Verifying EN Translations ---');
console.log('Auth exists:', !!t.auth);
if (t.auth) {
  console.log('NIF:', t.auth.nif);
  console.log('Placeholder NIF:', t.auth.placeholderNif);
}
  
  console.log('Questions exists:', !!t.triage.questions);
  if (t.triage.questions) {
    console.log('birth_date:', t.triage.questions.birth_date);
    console.log('phone:', t.triage.questions.phone);
  }
console.log('-------------------------------');
