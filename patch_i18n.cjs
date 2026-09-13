const fs = require('fs');
let content = fs.readFileSync('src/i18n.ts', 'utf8');

const formatNumberCode = 
export function formatNumber(num: number | string, lang: Language): string {
  if (lang === 'ar') {
    return Number(num).toLocaleString('ar-EG');
  }
  return String(num);
}
;

content = content + formatNumberCode;
fs.writeFileSync('src/i18n.ts', content);
