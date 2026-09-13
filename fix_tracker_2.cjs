const fs = require('fs');
let content = fs.readFileSync('src/components/CustomerTicketTracker.tsx', 'utf8');

if (!content.includes('formatNumber')) {
  content = content.replace("import { t, Language } from '../i18n';", "import { t, Language, formatNumber } from '../i18n';");
}

content = content.replace("<span>Ticket: #{reservation.queue_number}</span>", "<span>{t('tracker.ticket', language)}: #{formatNumber(reservation.queue_number, language)}</span>");
content = content.replace("Parties Ahead in Line", "{t('tracker.partiesAhead', language)}");
content = content.replace(">{peopleAhead}<", ">{formatNumber(peopleAhead, language)}<");
content = content.replace("Estimated wait: <strong className=\"text-white\">~{estimatedWait} mins</strong>", "{t('tracker.estimatedWait', language)}: <strong className=\"text-white\">~{formatNumber(estimatedWait, language)} {t('tracker.mins', language)}</strong>");
content = content.replace("Seating Area", "{t('tracker.seatingArea', language)}");
content = content.replace("Party Size", "{t('tracker.partySize', language)}");
content = content.replace("Please remain nearby the restaurant perimeter. You will receive an instant audio and screen chime when your table is prepared.", "{t('tracker.perimeter', language)}");
content = content.replace("Guests {reservation.party_size}", "{t('tracker.guests', language, reservation.party_size)}");
content = content.replace("Guest {reservation.party_size}", "{t('tracker.guests', language, reservation.party_size)}");
content = content.replace("People {reservation.party_size}", "{t('tracker.guests', language, reservation.party_size)}");
content = content.replace("Guests {reservation.party_size}", "{t('tracker.guests', language, reservation.party_size)}");
content = content.replace("return <div className=\"text-xs font-bold text-white mt-1\">{reservation.area_name}</div>;", "return <div className=\"text-xs font-bold text-white mt-1\">{t(rea. as any, language) || reservation.area_name}</div>;");


fs.writeFileSync('src/components/CustomerTicketTracker.tsx', content);
