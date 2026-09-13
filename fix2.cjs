const fs = require('fs');
let content = fs.readFileSync('src/components/CustomerBookingForm.tsx', 'utf8');

content = content.replace("{partySize} {partySize === 1 ? 'Person' : 'People'}", "{t('form.people', language, partySize)}");
content = content.replace("Seating Area Preference", "{t('form.area', language)}");
content = content.replace("Special Requests / Notes (Optional)", "{t('form.notes', language)}");
content = content.replace(/t\("area\.\\$\{area\.name\}" as any, language\)/g, 't(rea. as any, language) || area.name');
content = content.replace(/t\("area_desc\.\\$\{area\.name\}" as any, language\)/g, 't(rea_desc. as any, language) || area.desc');
content = content.replace(/t\("area\.\$\\\{area\.name\\\}" as any, language\)/g, 't(rea. as any, language) || area.name');
content = content.replace(/t\("area_desc\.\$\\\{area\.name\\\}" as any, language\)/g, 't(rea_desc. as any, language) || area.desc');
content = content.replace('t("area." as any, language)', 't(rea. as any, language) || area.name');
content = content.replace('t("area_desc." as any, language)', 't(rea_desc. as any, language) || area.desc');

fs.writeFileSync('src/components/CustomerBookingForm.tsx', content);
