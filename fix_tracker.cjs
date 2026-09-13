const fs = require('fs');
let content = fs.readFileSync('src/components/CustomerTicketTracker.tsx', 'utf8');

// Also need formatNumber!
if (!content.includes('formatNumber')) {
  content = content.replace("import { t, Language } from '../i18n';", "import { t, Language, formatNumber } from '../i18n';");
}

content = content.replace("Ticket: #{reservation.queue_number}", "{t('tracker.ticket', language)}: #{formatNumber(reservation.queue_number, language)}");
content = content.replace("Parties Ahead in Line", "{t('tracker.partiesAhead', language)}");
content = content.replace(">{peopleAhead}<", ">{formatNumber(peopleAhead, language)}<");
content = content.replace("Estimated wait: <strong className=\"text-white\">~{estimatedWait} mins</strong>", "{t('tracker.estimatedWait', language)}: <strong className=\"text-white\">~{formatNumber(estimatedWait, language)} {t('tracker.mins', language)}</strong>");
content = content.replace("Seating Area", "{t('tracker.seatingArea', language)}");
content = content.replace("Party Size", "{t('tracker.partySize', language)}");
content = content.replace("Please remain nearby the restaurant perimeter. You will receive an instant audio and screen chime when your table is prepared.", "{t('tracker.perimeter', language)}");

fs.writeFileSync('src/components/CustomerTicketTracker.tsx', content);

let i18n = fs.readFileSync('src/i18n.ts', 'utf8');
const enInject = 
    'tracker.ticket': 'Ticket',
    'tracker.partiesAhead': 'PARTIES AHEAD IN LINE',
    'tracker.estimatedWait': 'Estimated wait',
    'tracker.mins': 'mins',
    'tracker.seatingArea': 'SEATING AREA',
    'tracker.partySize': 'PARTY SIZE',
    'tracker.perimeter': 'Please remain nearby the restaurant perimeter. You will receive an instant audio and screen chime when your table is prepared.',
;
const arInject = 
    'tracker.ticket': '?????',
    'tracker.partiesAhead': '??? ????????? ???? ?????',
    'tracker.estimatedWait': '??? ???????? ???????',
    'tracker.mins': '?????',
    'tracker.seatingArea': '????? ??????',
    'tracker.partySize': '??? ????????',
    'tracker.perimeter': '???? ?????? ?????? ?? ??????. ?????? ??????? ?????? ??????? ??? ????? ??????.',
;

i18n = i18n.replace("'tracker.share': 'Share',", "'tracker.share': 'Share'," + enInject);
i18n = i18n.replace("'tracker.share': '??????',", "'tracker.share': '??????'," + arInject);
fs.writeFileSync('src/i18n.ts', i18n);
