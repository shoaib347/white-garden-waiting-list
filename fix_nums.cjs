const fs = require('fs');
let content = fs.readFileSync('src/components/CustomerBookingForm.tsx', 'utf8');

content = content.replace("import { t, Language } from '../i18n';", "import { t, Language, formatNumber } from '../i18n';");
content = content.replace("{size}{size === 10 ? '+' : ''}", "{formatNumber(size, language)}{size === 10 ? '+' : ''}");
content = content.replace("~{estimatedWait}", "~{formatNumber(estimatedWait, language)}");
content = content.replace("{peopleAhead}", "{formatNumber(peopleAhead, language)}");
content = content.replace("Based on current table turns", "{t('form.basedOn', language) || 'Based on current table turns'}");

fs.writeFileSync('src/components/CustomerBookingForm.tsx', content);

let i18n = fs.readFileSync('src/i18n.ts', 'utf8');
i18n = i18n.replace("'form.submit': 'Join Waitlist',", "'form.submit': 'Join Waitlist',\n    'form.basedOn': 'Based on current table turns',");
i18n = i18n.replace("'form.submit': '???????? ?????? ????????',", "'form.submit': '???????? ?????? ????????',\n    'form.basedOn': '????? ??? ??????? ???????? ???????',");
fs.writeFileSync('src/i18n.ts', i18n);

