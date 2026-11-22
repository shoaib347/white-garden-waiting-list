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

let memCounter = 100;
let memReservations: MemReservation[] = [];

let memBranchSettings: Record<string, boolean> = {
  olaya: true,
  roshn: true,
  sixty: true,
  theview: true,
  ammariayh: true,
};

let isPrismaAvailable = false;
let lastDbError: string | null = null;
const prisma = new PrismaClient();

// Test & retry Prisma Database Connection (handles Neon Serverless cold-wake)
async function checkDatabaseConnection(maxAttempts = 4): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    lastDbError = 'DATABASE_URL environment variable is not set';
    isPrismaAvailable = false;
    console.error('❌ DATABASE_URL is not set; running in memory fallback.');
    return false;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isPrismaAvailable = true;
      lastDbError = null;
      console.log(`✅ Connected to Neon PostgreSQL database via Prisma (attempt ${attempt}).`);
      return true;
    } catch (err: any) {
      lastDbError = err?.message || String(err);
      isPrismaAvailable = false;
      console.error(`⚠️ Prisma DB connection attempt ${attempt}/${maxAttempts} failed:`, lastDbError);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }
  return false;
}

async function ensureDbConnected(): Promise<boolean> {
  if (isPrismaAvailable) return true;
  if (!process.env.DATABASE_URL) return false;
  return checkDatabaseConnection(2);
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

// Helper: count [+5m] grace extensions stored in notes
function parseExtraGraceMinutes(notes?: string | null): number {
  if (!notes) return 0;
  const matches = notes.match(/\[\+5m\]/g);
  return matches ? matches.length * 5 : 0;
}

// Status Updater
async function updateReservationStatus(reservationId: string, newStatus: string, reason?: string) {
  const cleanId = reservationId.replace(/^#/, '').toLowerCase();
  const now = new Date();
  const isExtend = newStatus === 'extend_5m';

  let standardStatus = newStatus;
  if (newStatus === 'call' || newStatus === 'called') standardStatus = 'ready';
  if (newStatus === 'seat') standardStatus = 'seated';
  if (newStatus === 'cancel') standardStatus = 'cancelled';

  const ALLOWED_STATUSES = new Set(['waiting', 'ready', 'seated', 'served', 'cancelled', 'no_show']);

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
        const updateData: any = {};

        if (isExtend) {
          // Keep current valid status (repair if previously corrupted)
          const safeStatus = ALLOWED_STATUSES.has(target.status) ? target.status : 'waiting';
          updateData.status = safeStatus;
          updateData.notes = target.notes ? `${target.notes} [+5m]` : '[+5m]';
          updateData.estimated_wait_mins = (target.estimated_wait_mins || 10) + 5;
        } else {
          if (!ALLOWED_STATUSES.has(standardStatus)) {
            return null;
          }
          updateData.status = standardStatus;
          if (standardStatus === 'ready') updateData.notified_at = now;
          if (standardStatus === 'seated' || standardStatus === 'served') updateData.seated_at = now;
          if (reason) {
            updateData.notes = target.notes ? `${target.notes} | ${reason}` : reason;
          }
        }

        const updated = await prisma.reservation.update({
          where: { id: target.id },
          data: updateData,
        });

        const extraGraceMins = parseExtraGraceMinutes(updated.notes);

        const statusPayload = {
          reservation_id: updated.reservation_id,
          ticket_code: `#${updated.reservation_id.replace(/^#/, '')}`,
          status: updated.status,
          action_status: updated.status === 'ready' ? 'called' : updated.status,
          action: isExtend ? 'extend_5m' : undefined,
          extra_grace_minutes: extraGraceMins,
          notes: updated.notes || null,
          queue_number: updated.queue_number,
          updated_at: now.toISOString(),
          customer_name: updated.customer_name,
          area_name: updated.area_name,
          notified_at: updated.notified_at?.toISOString() || null,
          seated_at: updated.seated_at?.toISOString() || null,
        };

        io.to(`branch_${updated.branch_id}`).emit('queue:status_changed', statusPayload);
        io.to('branch_all').emit('queue:status_changed', statusPayload);
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

  if (isExtend) {
    const safeStatus = ALLOWED_STATUSES.has(memTarget.status) ? memTarget.status : 'waiting';
    memTarget.status = safeStatus;
    memTarget.notes = memTarget.notes ? `${memTarget.notes} [+5m]` : '[+5m]';
    memTarget.estimated_wait_mins = (memTarget.estimated_wait_mins || 10) + 5;
  } else {
    if (!ALLOWED_STATUSES.has(standardStatus)) return null;
    memTarget.status = standardStatus;
    if (standardStatus === 'ready') memTarget.notified_at = now;
    if (standardStatus === 'seated') memTarget.seated_at = now;
    if (reason) {
      memTarget.notes = memTarget.notes ? `${memTarget.notes} | ${reason}` : reason;
    }
  }

  const extraGraceMins = parseExtraGraceMinutes(memTarget.notes);

  const statusPayload = {
    reservation_id: memTarget.reservation_id,
    ticket_code: `#${memTarget.reservation_id.replace(/^#/, '')}`,
    status: memTarget.status,
    action_status: memTarget.status === 'ready' ? 'called' : memTarget.status,
    action: isExtend ? 'extend_5m' : undefined,
    extra_grace_minutes: extraGraceMins,
    notes: memTarget.notes || null,
    queue_number: memTarget.queue_number,
    updated_at: now.toISOString(),
    customer_name: memTarget.customer_name,
    area_name: memTarget.area_name,
    notified_at: memTarget.notified_at?.toISOString() || null,
    seated_at: memTarget.seated_at?.toISOString() || null,
  };

  io.to(`branch_${memTarget.branch_id}`).emit('queue:status_changed', statusPayload);
  io.to('branch_all').emit('queue:status_changed', statusPayload);
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
    has_database_url: Boolean(process.env.DATABASE_URL),
    db_error: isPrismaAvailable ? null : lastDbError,
    locations: ['olaya', 'roshn', 'sixty', 'theview', 'ammariayh'],
    time: new Date().toISOString(),
  });
});

// Branch-specific staff login mapping (case-insensitive)
const BRANCH_LOGIN_ACCOUNTS: Record<
  string,
  { branchId: string; branchName: string; role: 'branch_staff' | 'admin' }
> = {
  // Olaya
  olaya: { branchId: 'olaya', branchName: 'Olaya', role: 'branch_staff' },
  'al olaya': { branchId: 'olaya', branchName: 'Olaya', role: 'branch_staff' },
  // Riyadh Roshn
  roshn: { branchId: 'roshn', branchName: 'Riyadh Roshn', role: 'branch_staff' },
  'riyadh roshn': { branchId: 'roshn', branchName: 'Riyadh Roshn', role: 'branch_staff' },
  riyadhroshn: { branchId: 'roshn', branchName: 'Riyadh Roshn', role: 'branch_staff' },
  'riyadh-roshn': { branchId: 'roshn', branchName: 'Roshn Front', role: 'branch_staff' },
  'roshn front': { branchId: 'roshn', branchName: 'Roshn Front', role: 'branch_staff' },
  roshnfront: { branchId: 'roshn', branchName: 'Roshn Front', role: 'branch_staff' },
  // 60 Avenue
  '60 avenue': { branchId: 'sixty', branchName: '60 Avenue', role: 'branch_staff' },
  '60avenue': { branchId: 'sixty', branchName: '60 Avenue', role: 'branch_staff' },
  '60-avenue': { branchId: 'sixty', branchName: '60 Avenue', role: 'branch_staff' },
  sixty: { branchId: 'sixty', branchName: '60 Avenue', role: 'branch_staff' },
  '60ave': { branchId: 'sixty', branchName: '60 Avenue', role: 'branch_staff' },
  // The View
  'the view': { branchId: 'theview', branchName: 'The View', role: 'branch_staff' },
  theview: { branchId: 'theview', branchName: 'The View', role: 'branch_staff' },
  'the-view': { branchId: 'theview', branchName: 'The View', role: 'branch_staff' },
  view: { branchId: 'theview', branchName: 'The View', role: 'branch_staff' },
  // Ammariayh
  ammariayh: { branchId: 'ammariayh', branchName: 'Ammariayh', role: 'branch_staff' },
  ammariyah: { branchId: 'ammariayh', branchName: 'Al Ammariyah', role: 'branch_staff' },
  'al ammariyah': { branchId: 'ammariayh', branchName: 'Al Ammariyah', role: 'branch_staff' },
  'the farm': { branchId: 'ammariayh', branchName: 'Al Ammariyah', role: 'branch_staff' },
  // Management / All Branches
  admin: { branchId: 'all', branchName: 'All Branches', role: 'admin' },
  whitegarden: { branchId: 'all', branchName: 'All Branches', role: 'admin' },
};

// Staff authentication
app.post('/api/v1/auth/login', (req, res) => {
  const rawUsername = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const normalizedUsername = rawUsername.trim().toLowerCase().replace(/\s+/g, ' ');
  const validPass = process.env.STAFF_PASSWORD || 'Mateen@123';

  const account = BRANCH_LOGIN_ACCOUNTS[normalizedUsername];

  if (account && password === validPass) {
    const payload = {
      role: account.role,
      username: normalizedUsername,
      branchId: account.branchId,
      branchName: account.branchName,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: payload });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid branch login ID or password',
    });
  }
});

// Verify staff session token
app.get('/api/v1/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ valid: false });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

// Normalize mobile number to last 9 digits so +9665..., 9665..., 05... match identically
function normalizePhoneKey(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

// Compute visit count per normalized phone across all branches
async function buildPhoneVisitCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (isPrismaAvailable) {
    try {
      const allMobiles = await prisma.reservation.findMany({
        select: { mobile: true },
      });
      for (const row of allMobiles) {
        const key = normalizePhoneKey(row.mobile);
        if (key.length >= 7) {
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
      return counts;
    } catch {
      // Fall through to memory
    }
  }
  for (const row of memReservations) {
    const key = normalizePhoneKey(row.mobile);
    if (key.length >= 7) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

// Fetch queue and stats (enriched with cross-branch visit_count for returning guest detection)
app.get('/api/v1/queue', async (req, res) => {
  await ensureDbConnected();
  const branchId = (req.query.branch_id as string) || 'roshn';
  const visitCounts = await buildPhoneVisitCounts();

  const attachVisitCount = <T extends { mobile: string }>(items: T[]) =>
    items.map((item) => {
      const key = normalizePhoneKey(item.mobile);
      return {
        ...item,
        visit_count: key.length >= 7 ? (visitCounts.get(key) || 1) : 1,
      };
    });

  if (isPrismaAvailable) {
    try {
      const whereClause = branchId === 'all' ? {} : { branch_id: branchId };
      const rawQueue = await prisma.reservation.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
      });
      const queue = attachVisitCount(rawQueue);
      const stats = await getQueueStats(branchId);
      return res.json({ queue, stats, branch_id: branchId });
    } catch (e) {
      // Fallback
    }
  }

  const rawQueue = branchId === 'all'
    ? memReservations
    : memReservations.filter((r) => r.branch_id.toLowerCase() === branchId.toLowerCase());

  const queue = attachVisitCount(rawQueue);
  const stats = await getQueueStats(branchId);
  res.json({ queue, stats, branch_id: branchId });
});

// Fetch complete visit history for a specific customer across all branches
app.get('/api/v1/guest-history', async (req, res) => {
  const mobileQuery = typeof req.query.mobile === 'string' ? req.query.mobile : '';
  const nameQuery = typeof req.query.name === 'string' ? req.query.name.trim().toLowerCase() : '';
  const phoneKey = normalizePhoneKey(mobileQuery);

  let allRows: any[] = [];
  if (isPrismaAvailable) {
    try {
      allRows = await prisma.reservation.findMany({
        orderBy: { created_at: 'desc' },
      });
    } catch {
      allRows = memReservations;
    }
  } else {
    allRows = memReservations;
  }

  const visits = allRows.filter((row) => {
    const rowPhoneKey = normalizePhoneKey(row.mobile);
    if (phoneKey.length >= 7 && rowPhoneKey.length >= 7) {
      return rowPhoneKey === phoneKey;
    }
    if (nameQuery) {
      return (row.customer_name || '').trim().toLowerCase() === nameQuery;
    }
    return false;
  });

  const seatedVisits = visits.filter((v) => v.status === 'seated' || v.status === 'served').length;
  const noShowCount = visits.filter((v) => v.status === 'no_show').length;
  const cancelledCount = visits.filter((v) => v.status === 'cancelled').length;

  res.json({
    total_visits: visits.length,
    seated_visits: seatedVisits,
    no_show_count: noShowCount,
    cancelled_count: cancelledCount,
    visits,
  });
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

    await ensureDbConnected();
    if (isPrismaAvailable) {
      try {
        const latest = await prisma.reservation.findFirst({
          where: { branch_id: normBranch },
          orderBy: { queue_number: 'desc' },
          select: { queue_number: true },
        });
        const queueNumber = (latest?.queue_number || 0) + 1;
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

        const visitCounts = await buildPhoneVisitCounts();
        const phoneKey = normalizePhoneKey(created.mobile);
        const visitCount = phoneKey.length >= 7 ? (visitCounts.get(phoneKey) || 1) : 1;

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
          visit_count: visitCount,
        };

        io.to(`branch_${normBranch}`).emit('queue:new_entry', newEntryPayload);
        io.to('branch_all').emit('queue:new_entry', newEntryPayload);
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

// Clear / Reset Queue
app.post('/api/v1/queue/clear', async (req, res) => {
  memReservations = [];
  if (isPrismaAvailable) {
    try {
      await prisma.notificationHistory.deleteMany();
      await prisma.reservation.deleteMany();
    } catch (e) {}
  }
  io.emit('queue:reset', { count: 0 });
  res.json({ success: true, count: 0 });
});

app.post('/api/v1/seed', async (req, res) => {
  memReservations = [];
  if (isPrismaAvailable) {
    try {
      await prisma.notificationHistory.deleteMany();
      await prisma.reservation.deleteMany();
    } catch (e) {}
  }
  io.emit('queue:reset', { count: 0 });
  res.json({ success: true, count: 0 });
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
