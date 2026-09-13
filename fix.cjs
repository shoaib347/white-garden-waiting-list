const fs = require('fs');
let content = fs.readFileSync('src/components/CustomerTicketTracker.tsx', 'utf8');
content = content.replace(/'? \{t\(''tracker\.cancelledHeading'', language\)\}\.'/g, '? .');
content = content.replace(/'? \{t\(''tracker\.seatedHeading'', language\)\}\!'/g, '? !');
content = content.replace(/'?? \{t\(''tracker\.readyHeading'', language\)\}\!'/g, '?? !');
fs.writeFileSync('src/components/CustomerTicketTracker.tsx', content);
