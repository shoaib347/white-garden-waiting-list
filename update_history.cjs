const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(
  "const history = await prisma.notificationHistory.findMany({ \\n    where: { branch_id: branchId },\\n    orderBy: { notification_created_at: 'desc' }\\n  });",
  "const history = await prisma.notificationHistory.findMany({ \\n    where: { branch_id: branchId },\\n    orderBy: { notification_created_at: 'desc' },\\n    include: { reservation: { select: { notes: true } } }\\n  });"
);
fs.writeFileSync('server.ts', server);

let types = fs.readFileSync('src/types/index.ts', 'utf8');
types = types.replace(
  "branch_id: string;",
  "branch_id: string;\\n  reservation?: { notes: string | null };"
);
fs.writeFileSync('src/types/index.ts', types);
