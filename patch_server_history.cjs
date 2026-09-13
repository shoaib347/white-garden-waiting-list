const fs = require('fs');
let serverTs = fs.readFileSync('server.ts', 'utf8');

const queueReplacement = 
// 1. GET /api/v1/queue: Fetch active queue and statistics for staff dashboard
app.get('/api/v1/queue', async (req, res) => {
  const branchId = (req.query.branch_id as string) || 'branch_1';
  const branchQueue = await prisma.reservation.findMany({ 
    where: { branch_id: branchId },
    orderBy: { created_at: 'desc' }
  });

  // Attach past_visits_count for each reservation
  const activeMobiles = [...new Set(branchQueue.map(r => r.mobile))];
  const pastVisitsGroups = await prisma.reservation.groupBy({
    by: ['mobile'],
    where: {
      mobile: { in: activeMobiles },
      status: { in: ['seated', 'served'] }
    },
    _count: {
      mobile: true
    }
  });
  
  const visitsMap = Object.fromEntries(pastVisitsGroups.map(g => [g.mobile, g._count.mobile]));
  const queueWithVisits = branchQueue.map(r => ({
    ...r,
    past_visits_count: visitsMap[r.mobile] || 0
  }));

  const stats = await getQueueStats(branchId);
  res.json({
    queue: queueWithVisits,
    stats,
    branch_id: branchId,
  });
});

// GET /api/v1/customers/:mobile/history: Fetch past history for a specific customer
app.get('/api/v1/customers/:mobile/history', async (req, res) => {
  const { mobile } = req.params;
  const history = await prisma.reservation.findMany({
    where: { 
      mobile, 
      status: { in: ['seated', 'served', 'cancelled'] } 
    },
    orderBy: { created_at: 'desc' }
  });
  res.json(history);
});
;

serverTs = serverTs.replace(
  /\/\/ 1\. GET \/api\/v1\/queue[\s\S]*?res\.json\(\{\n    queue: branchQueue,\n    stats,\n    branch_id: branchId,\n  \}\);\n\}\);/,
  queueReplacement.trim()
);

fs.writeFileSync('server.ts', serverTs);
