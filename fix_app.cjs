const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Hide the bell button from customers
content = content.replace(
  '<button\n              id="header-notifications-bell"',
  '{(currentView === \\'staff\\' || currentView === \\'split\\') && (<button\n              id="header-notifications-bell"'
);
content = content.replace(
  '</span>\n              )}\n            </button>',
  '</span>\n              )}\n            </button>)}'
);

// Hide the drawer from customers
content = content.replace(
  '{/* Slide-out Notifications Drawer */}\n      <NotificationDrawer',
  '{/* Slide-out Notifications Drawer */}\n      {(currentView === \\'staff\\' || currentView === \\'split\\') && (\n        <NotificationDrawer'
);
content = content.replace(
  'onTestChime={handleTestChime}\n      />',
  'onTestChime={handleTestChime}\n      />\n      )}'
);

fs.writeFileSync('src/App.tsx', content);
