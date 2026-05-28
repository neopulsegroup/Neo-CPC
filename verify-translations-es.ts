
import { translations } from './src/lib/i18n';

const lang = 'es';
const t = translations[lang];

console.log('--- Verifying ES Translations ---');
console.log('Triage exists:', !!t.triage);
if (t.triage) {
  console.log('Steps exists:', !!t.triage.steps);
  if (t.triage.steps) {
    console.log('personal_data:', t.triage.steps.personal_data);
    console.log('contacts:', t.triage.steps.contacts);
  }
}
console.log('-------------------------------');
