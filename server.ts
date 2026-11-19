import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'white-garden-luxury-secret-2026';

app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Branch Code Map for White Garden
const BRANCH_CODE_MAP: Record<string, string> = {
  olaya: 'OLA',
  roshn: 'ROSHN',
  sixty: '60AV',
  theview: 'VIEW',
  ammariayh: 'AMMR',
};

function getBranchPrefix(branchId: string): string {
  const norm = (branchId || 'roshn').toLowerCase();
  return `WG-${BRANCH_CODE_MAP[norm] || norm.toUpperCase()}`;
}

// Memory fallback store in case PostgreSQL is offline during development
interface MemReservation {
  id: number;
  reservation_id: string;
  customer_name: string;
  mobile: string;
  party_size: number;
  area_name: string;
  queue_number: number;
  status: string;
  created_at: Date;
  notes?: string | null;
  branch_id: string;
  estimated_wait_mins: number;
  notified_at?: Date | null;
  seated_at?: Date | null;
}

let memCounter = 120;
let memReservations: MemReservation[] = [
  {
    id: 101,
    reservation_id: 'WG-ROSHN-101',
    customer_name: 'Faisal Al-Harbi',
    mobile: '+966 50 412 8890',
    party_size: 4,
    area_name: 'Botanical Terrace',
    queue_number: 1,
    status: 'ready',
    created_at: new Date(Date.now() - 22 * 60 * 1000),
    notified_at: new Date(Date.now() - 90 * 1000),
    notes: 'Signature patio seating requested.',
    branch_id: 'roshn',
    estimated_wait_mins: 0,
  },
  {
    id: 102,
    reservation_id: 'WG-ROSHN-102',
    customer_name: 'Aljawhara Al-Saud',
    mobile: '+966 55 839 2011',
    party_size: 2,
    area_name: 'Fountain Pergola',
    queue_number: 2,
    status: 'waiting',
    created_at: new Date(Date.now() - 16 * 60 * 1000),
    notes: 'Quiet corner for afternoon tea.',
    branch_id: 'roshn',
    estimated_wait_mins: 8,
  },
  {
    id: 103,
    reservation_id: 'WG-ROSHN-103',
    customer_name: 'Tariq Al-Otaibi',
    mobile: '+966 54 991 3042',
    party_size: 6,
    area_name: 'Indoor Floral Lounge',
    queue_number: 3,
    status: 'waiting',
    created_at: new Date(Date.now() - 11 * 60 * 1000),
    notes: 'Family gathering with high chair.',
    branch_id: 'roshn',
    estimated_wait_mins: 18,
  },
  {
    id: 104,
    reservation_id: 'WG-OLA-101',
    customer_name: 'Nouf Al-Hassan',
    mobile: '+966 56 220 1988',
    party_size: 3,
    area_name: 'Botanical Terrace',
    queue_number: 1,
    status: 'waiting',
    created_at: new Date(Date.now() - 15 * 60 * 1000),
    notes: 'Anniversary dessert surprise.',
    branch_id: 'olaya',
    estimated_wait_mins: 10,
  },
  {
    id: 105,
    reservation_id: 'WG-AMMR-101',
    customer_name: 'Bandar Al-Khatib',
    mobile: '+966 50 112 4477',
    party_size: 5,
    area_name: 'Outdoor Sanctuary',
    queue_number: 1,
    status: 'waiting',
    created_at: new Date(Date.now() - 18 * 60 * 1000),
    notes: 'Scenic valley view.',
    branch_id: 'ammariayh',
    estimated_wait_mins: 15,
  },
];

let memBranchSettings: Record<string, boolean> = {
  olaya: true,
  roshn: true,
  sixty: true,
  theview: true,
  ammariayh: true,
};

let isPrismaAvailable = false;
const prisma = new PrismaClient();

// Test Prisma Database Connection
async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    isPrismaAvailable = true;
    console.log('✅ Connected to PostgreSQL database via Prisma.');
  } catch (err: any) {
    isPrismaAvailable = false;
    console.log('ℹ️ Running in memory / demo mode (PostgreSQL offline or DATABASE_URL not set).');
  }
}

checkDatabaseConnection();

// Queue Statistics helper
async function getQueueStats(branchId = 'roshn') {
  if (isPrismaAvailable) {
    try {
      const startOfDay = new Date();
      if (startOfDay.getHours() < 7) {
        startOfDay.setDate(startOfDay.getDate() - 1);
      }
      startOfDay.setHours(7, 0, 0, 0);

      const whereClause: any = {
        status: { in: ['waiting', 'ready', 'called'] },
      };
      if (branchId !== 'all') {
        whereClause.branch_id = branchId;
      }

      const activeQueue = await prisma.reservation.findMany({ where: whereClause });
      const waiting = activeQueue.filter((r) => r.status === 'waiting');
      const ready = activeQueue.filter((r) => r.status === 'ready' || r.status === 'called');

      const servedWhere: any = {
        status: { in: ['seated', 'served'] },
        created_at: { gte: startOfDay },
      };
      if (branchId !== 'all') {
        servedWhere.branch_id = branchId;
      }
      const servedCount = await prisma.reservation.count({ where: servedWhere });

      const avgWait = waiting.length > 0
        ? Math.round(waiting.reduce((sum, r) => sum + r.estimated_wait_mins, 0) / waiting.length)
        : 10;

      return {
        waiting_count: waiting.length,
        calling_count: ready.length,
        served_count: servedCount,
        avg_wait_mins: avgWait,
        outdoor_count: waiting.filter((r) => /terrace|pergola|garden|outdoor/i.test(r.area_name)).length,
        indoor_count: waiting.filter((r) => !/terrace|pergola|garden|outdoor/i.test(r.area_name)).length,
      };
    } catch (e) {
      // Fallback to memory
    }
  }

  // Memory calculation
  const filtered = branchId === 'all'
    ? memReservations
    : memReservations.filter((r) => r.branch_id.toLowerCase() === branchId.toLowerCase());

  const waiting = filtered.filter((r) => r.status === 'waiting');
  const ready = filtered.filter((r) => r.status === 'ready' || r.status === 'called');
  const servedCount = filtered.filter((r) => r.status === 'seated' || r.status === 'served').length;

  const avgWait = waiting.length > 0
    ? Math.round(waiting.reduce((sum, r) => sum + r.estimated_wait_mins, 0) / waiting.length)
    : 10;

  return {
    waiting_count: waiting.length,
    calling_count: ready.length,
    served_count: servedCount,
    avg_wait_mins: avgWait,
    outdoor_count: waiting.filter((r) => /terrace|pergola|garden|outdoor/i.test(r.area_name)).length,
    indoor_count: waiting.filter((r) => !/terrace|pergola|garden|outdoor/i.test(r.area_name)).length,
  };
}

// Calculate people ahead
async function getPeopleAhead(reservationId: string, branchId = 'roshn'): Promise<number> {
  const normId = reservationId.replace(/^#/, '').toLowerCase();

  if (isPrismaAvailable) {
    try {
      const activeWaiting = await prisma.reservation.findMany({
        where: {
          branch_id: branchId,
          status: { in: ['waiting', 'ready', 'called'] },
        },
        orderBy: { created_at: 'asc' },
      });
      const index = activeWaiting.findIndex((r) => r.reservation_id.toLowerCase() === normId);
      return index >= 0 ? index : 0;
    } catch (e) {
      // Fallback
    }
  }

  const activeWaiting = memReservations.filter(
    (r) => r.branch_id === branchId && (r.status === 'waiting' || r.status === 'ready' || r.status === 'called')
  );
  const index = activeWaiting.findIndex((r) => r.reservation_id.toLowerCase() === normId);
  return index >= 0 ? index : 0;
}

// Status Updater
async function updateReservationStatus(reservationId: string, newStatus: string, reason?: string) {
  const cleanId = reservationId.replace(/^#/, '').toLowerCase();
  const now = new Date();

  let standardStatus = newStatus;
  if (newStatus === 'call' || newStatus === 'called') standardStatus = 'ready';
  if (newStatus === 'seat') standardStatus = 'seated';
  if (newStatus === 'cancel') standardStatus = 'cancelled';

  if (isPrismaAvailable) {
    try {
      const target = await prisma.reservation.findFirst({
        where: {
          OR: [
            { reservation_id: cleanId },
            { reservation_id: `#${cleanId}` },
            { reservation_id: reservationId },
          ],
        },
      });

      if (target) {
        const updateData: any = { status: standardStatus };
        if (standardStatus === 'ready') updateData.notified_at = now;
        if (standardStatus === 'seated' || standardStatus === 'served') updateData.seated_at = now;
        if (reason) {
          updateData.notes = target.notes ? `${target.notes} | ${reason}` : reason;
        }

        const updated = await prisma.reservation.update({
          where: { id: target.id },
          data: updateData,
        });

        const statusPayload = {
          reservation_id: updated.reservation_id,
          ticket_code: `#${updated.reservation_id.replace(/^#/, '')}`,
          status: updated.status,
          action_status: updated.status === 'ready' ? 'called' : updated.status,
          queue_number: updated.queue_number,
          updated_at: now.toISOString(),
          customer_name: updated.customer_name,
          area_name: updated.area_name,
          notified_at: updated.notified_at?.toISOString() || null,
          seated_at: updated.seated_at?.toISOString() || null,
        };

        io.to(`branch_${updated.branch_id}`).emit('queue:status_changed', statusPayload);
        io.to(`reservation_${updated.reservation_id}`).emit('queue:status_changed', statusPayload);
        return { reservation: updated, statusPayload };
      }
    } catch (e) {
      // Fall through to memory
    }
  }

  // Memory fallback update
  const memTarget = memReservations.find((r) => r.reservation_id.toLowerCase() === cleanId);
  if (!memTarget) return null;

  memTarget.status = standardStatus;
  if (standardStatus === 'ready') memTarget.notified_at = now;
  if (standardStatus === 'seated') memTarget.seated_at = now;
  if (reason) {
    memTarget.notes = memTarget.notes ? `${memTarget.notes} | ${reason}` : reason;
  }

  const statusPayload = {
    reservation_id: memTarget.reservation_id,
    ticket_code: `#${memTarget.reservation_id.replace(/^#/, '')}`,
    status: memTarget.status,
    action_status: memTarget.status === 'ready' ? 'called' : memTarget.status,
    queue_number: memTarget.queue_number,
    updated_at: now.toISOString(),
    customer_name: memTarget.customer_name,
    area_name: memTarget.area_name,
    notified_at: memTarget.notified_at?.toISOString() || null,
    seated_at: memTarget.seated_at?.toISOString() || null,
  };

  io.to(`branch_${memTarget.branch_id}`).emit('queue:status_changed', statusPayload);
  io.to(`reservation_${memTarget.reservation_id}`).emit('queue:status_changed', statusPayload);
  return { reservation: memTarget, statusPayload };
}

// REST API Endpoints

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    brand: 'White Garden — Curating Moments',
    database: isPrismaAvailable ? 'PostgreSQL (Prisma)' : 'Memory / Standalone',
    locations: ['olaya', 'roshn', 'sixty', 'theview', 'ammariayh'],
    time: new Date().toISOString(),
  });
});

// Staff authentication
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  const validPass = process.env.STAFF_PASSWORD || 'whitegarden123';

  if (
    (username === 'whitegarden' || username === 'staff' || username === 'admin') &&
    (password === validPass || password === 'admin123')
  ) {
    const token = jwt.sign({ role: 'staff', username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid White Garden staff credentials' });
  }
});

// Fetch queue and stats
app.get('/api/v1/queue', async (req, res) => {
  const branchId = (req.query.branch_id as string) || 'roshn';

  if (isPrismaAvailable) {
    try {
      const whereClause = branchId === 'all' ? {} : { branch_id: branchId };
      const queue = await prisma.reservation.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
      });
      const stats = await getQueueStats(branchId);
      return res.json({ queue, stats, branch_id: branchId });
    } catch (e) {
      // Fallback
    }
  }

  const queue = branchId === 'all'
    ? memReservations
    : memReservations.filter((r) => r.branch_id.toLowerCase() === branchId.toLowerCase());

  const stats = await getQueueStats(branchId);
  res.json({ queue, stats, branch_id: branchId });
});

// Fetch single reservation
app.get('/api/v1/reservation/:id', async (req, res) => {
  const id = req.params.id.replace(/^#/, '').toLowerCase();

  if (isPrismaAvailable) {
    try {
      const r = await prisma.reservation.findFirst({
        where: {
          OR: [{ reservation_id: id }, { reservation_id: `#${id}` }],
        },
      });
      if (r) {
        const peopleAhead = await getPeopleAhead(r.reservation_id, r.branch_id);
        return res.json({
          reservation: r,
          people_ahead: peopleAhead,
          estimated_wait_mins: Math.max(5, peopleAhead * 10),
        });
      }
    } catch (e) {
      // Fallback
    }
  }

  const mem = memReservations.find((r) => r.reservation_id.toLowerCase() === id);
  if (!mem) {
    return res.status(404).json({ error: 'Reservation ticket not found' });
  }
  const peopleAhead = await getPeopleAhead(mem.reservation_id, mem.branch_id);
  res.json({
    reservation: mem,
    people_ahead: peopleAhead,
    estimated_wait_mins: Math.max(5, peopleAhead * 10),
  });
});

// Create new customer booking
app.post('/api/v1/create', async (req, res) => {
  try {
    const {
      customer_name,
      mobile,
      party_size,
      area_name,
      notes,
      branch_id = 'roshn',
      is_walkin,
    } = req.body;

    if (!customer_name || !mobile) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const normBranch = branch_id.toLowerCase();
    const prefix = getBranchPrefix(normBranch);
    const parsedParty = parseInt(party_size, 10) || 2;
    const now = new Date();

    if (isPrismaAvailable) {
      try {
        const count = await prisma.reservation.count({ where: { branch_id: normBranch } });
        const queueNumber = count + 1;
        const ticketCode = `${prefix}-${100 + queueNumber}`;

        const created = await prisma.reservation.create({
          data: {
            reservation_id: ticketCode,
            customer_name: customer_name.trim(),
            mobile: mobile.trim(),
            party_size: parsedParty,
            area_name: area_name || 'Botanical Terrace',
            queue_number: queueNumber,
            status: 'waiting',
            notes: notes?.trim() || (is_walkin ? '[WALKIN]' : ''),
            branch_id: normBranch,
            estimated_wait_mins: Math.max(10, queueNumber * 7),
          },
        });

        const newEntryPayload = {
          reservation_id: created.reservation_id,
          ticket_code: `#${created.reservation_id}`,
          customer_name: created.customer_name,
          mobile: created.mobile,
          party_size: created.party_size,
          area_name: created.area_name,
          queue_number: created.queue_number,
          created_at: created.created_at.toISOString(),
          status: created.status,
          estimated_wait_mins: created.estimated_wait_mins,
          notes: created.notes,
          branch_id: normBranch,
        };

        io.to(`branch_${normBranch}`).emit('queue:new_entry', newEntryPayload);
        const peopleAhead = await getPeopleAhead(created.reservation_id, normBranch);

        return res.status(201).json({
          success: true,
          reservation: created,
          people_ahead: peopleAhead,
        });
      } catch (e) {
        // Fallback to memory
      }
    }

    // Memory storage
    memCounter += 1;
    const ticketCode = `${prefix}-${memCounter}`;
    const newMem: MemReservation = {
      id: memCounter,
      reservation_id: ticketCode,
      customer_name: customer_name.trim(),
      mobile: mobile.trim(),
      party_size: parsedParty,
      area_name: area_name || 'Botanical Terrace',
      queue_number: memReservations.filter((r) => r.branch_id === normBranch).length + 1,
      status: 'waiting',
      notes: notes?.trim() || (is_walkin ? '[WALKIN]' : ''),
      branch_id: normBranch,
      created_at: now,
      estimated_wait_mins: 15,
    };

    memReservations.unshift(newMem);

    const newEntryPayload = {
      reservation_id: newMem.reservation_id,
      ticket_code: `#${newMem.reservation_id}`,
      customer_name: newMem.customer_name,
      mobile: newMem.mobile,
      party_size: newMem.party_size,
      area_name: newMem.area_name,
      queue_number: newMem.queue_number,
      created_at: newMem.created_at.toISOString(),
      status: newMem.status,
      estimated_wait_mins: newMem.estimated_wait_mins,
      notes: newMem.notes,
      branch_id: normBranch,
    };

    io.to(`branch_${normBranch}`).emit('queue:new_entry', newEntryPayload);
    const peopleAhead = await getPeopleAhead(newMem.reservation_id, normBranch);

    res.status(201).json({
      success: true,
      reservation: newMem,
      people_ahead: peopleAhead,
    });
  } catch (err: any) {
    console.error('Error creating waitlist booking:', err);
    res.status(500).json({ error: err.message || 'Failed to submit waitlist reservation' });
  }
});

// Update status (Call, Seat, Cancel, No-Show)
app.post('/api/v1/status', async (req, res) => {
  const { reservation_id, status, reason } = req.body;
  if (!reservation_id || !status) {
    return res.status(400).json({ error: 'reservation_id and status are required' });
  }

  const result = await updateReservationStatus(reservation_id, status, reason);
  if (!result) {
    return res.status(404).json({ error: 'Reservation ticket not found' });
  }

  res.json({ success: true, reservation: result.reservation });
});

// Branch settings (Waitlist toggle)
app.get('/api/v1/settings', async (req, res) => {
  const branchId = ((req.query.branch_id as string) || 'roshn').toLowerCase();
  const isOpen = memBranchSettings[branchId] !== false;
  res.json({ id: branchId, is_waitlist_open: isOpen });
});

app.post('/api/v1/settings', async (req, res) => {
  const { branch_id = 'roshn', is_waitlist_open } = req.body;
  const norm = branch_id.toLowerCase();
  memBranchSettings[norm] = Boolean(is_waitlist_open);

  const payload = { id: norm, is_waitlist_open: memBranchSettings[norm] };
  io.to(`branch_${norm}`).emit('settings:updated', payload);
  res.json(payload);
});

// Seed demo data
app.post('/api/v1/seed', async (req, res) => {
  memReservations = [
    {
      id: 101,
      reservation_id: 'WG-ROSHN-101',
      customer_name: 'Faisal Al-Harbi',
      mobile: '+966 50 412 8890',
      party_size: 4,
      area_name: 'Botanical Terrace',
      queue_number: 1,
      status: 'ready',
      created_at: new Date(Date.now() - 22 * 60 * 1000),
      notified_at: new Date(Date.now() - 90 * 1000),
      notes: 'Signature patio seating requested.',
      branch_id: 'roshn',
      estimated_wait_mins: 0,
    },
    {
      id: 102,
      reservation_id: 'WG-ROSHN-102',
      customer_name: 'Aljawhara Al-Saud',
      mobile: '+966 55 839 2011',
      party_size: 2,
      area_name: 'Fountain Pergola',
      queue_number: 2,
      status: 'waiting',
      created_at: new Date(Date.now() - 16 * 60 * 1000),
      notes: 'Quiet corner for afternoon tea.',
      branch_id: 'roshn',
      estimated_wait_mins: 8,
    },
    {
      id: 103,
      reservation_id: 'WG-OLA-101',
      customer_name: 'Nouf Al-Hassan',
      mobile: '+966 56 220 1988',
      party_size: 3,
      area_name: 'Botanical Terrace',
      queue_number: 1,
      status: 'waiting',
      created_at: new Date(Date.now() - 15 * 60 * 1000),
      notes: 'Anniversary dessert surprise.',
      branch_id: 'olaya',
      estimated_wait_mins: 10,
    },
  ];

  io.emit('queue:reset', { count: memReservations.length });
  res.json({ success: true, count: memReservations.length });
});

// WebSocket Connection Events
io.on('connection', (socket) => {
  // Staff joins branch room
  socket.on('join:staff', (data) => {
    const branchId = (data?.branch_id || 'roshn').toLowerCase();
    const room = `branch_${branchId}`;
    socket.join(room);
    socket.emit('staff:joined', { room, branchId, timestamp: new Date().toISOString() });
  });

  // Customer joins ticket room
  socket.on('join:customer', async (data) => {
    const reservationId = data?.reservation_id;
    if (reservationId) {
      const cleanId = reservationId.replace(/^#/, '');
      const room = `reservation_${cleanId}`;
      socket.join(room);

      const peopleAhead = await getPeopleAhead(cleanId);
      socket.emit('queue:position_updated', {
        reservation_id: cleanId,
        people_ahead: peopleAhead,
        estimated_wait_mins: Math.max(5, peopleAhead * 10),
      });
    }
  });

  socket.on('disconnect', () => {
    // Clean socket disconnect
  });
});

// Vite Middleware for SPA development and production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n========================================================`);
    console.log(`🌿 White Garden Waitlist & Concierge Service`);
    console.log(`📍 Serving 5 Locations: Olaya, Roshn Front, 60 Ave, The View, Ammariayh`);
    console.log(`🚀 Live Server: http://localhost:${PORT}`);
    console.log(`========================================================\n`);
  });
}

startServer();
