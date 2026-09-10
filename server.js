import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database for Coal Restaurant Queue Management
let queueCounter = 104;
let reservations = [
  {
    reservation_id: 'COAL-101',
    customer_name: 'Marcus Vance',
    mobile: '+1 (555) 234-8901',
    party_size: 2,
    area_name: 'Coal Hearth Bar',
    queue_number: 1,
    status: 'waiting',
    created_at: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    notes: 'Anniversary couple; prefers bar view of the open wood fire hearth.',
    branch_id: 'branch_1',
    estimated_wait_mins: 5,
    notified_at: null,
    seated_at: null,
  },
  {
    reservation_id: 'COAL-102',
    customer_name: 'Elena Rostova',
    mobile: '+1 (555) 890-1234',
    party_size: 4,
    area_name: 'Main Dining Room',
    queue_number: 2,
    status: 'waiting',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    notes: 'Booth seating preferred; celebrating promotion.',
    branch_id: 'branch_1',
    estimated_wait_mins: 15,
    notified_at: null,
    seated_at: null,
  },
  {
    reservation_id: 'COAL-103',
    customer_name: 'Alexander Sterling',
    mobile: '+1 (555) 456-7890',
    party_size: 6,
    area_name: 'Outdoor Terrace',
    queue_number: 3,
    status: 'waiting',
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    notes: 'High chair requested for toddler; outdoor heat lamp section.',
    branch_id: 'branch_1',
    estimated_wait_mins: 25,
    notified_at: null,
    seated_at: null,
  },
];

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

function getQueueStats(branchId = 'branch_1') {
  const branchQueue = reservations.filter((r) => r.branch_id === branchId);
  const waiting = branchQueue.filter((r) => r.status === 'waiting');
  const ready = branchQueue.filter((r) => r.status === 'ready');
  const served = branchQueue.filter((r) => r.status === 'served');

  const avgWait = waiting.length > 0 
    ? Math.round(waiting.reduce((sum, r) => sum + r.estimated_wait_mins, 0) / waiting.length)
    : 15;

  return {
    waiting_count: waiting.length,
    calling_count: ready.length,
    served_count: served.length,
    avg_wait_mins: avgWait,
    outdoor_count: waiting.filter((r) => r.area_name.includes('Outdoor')).length,
    indoor_count: waiting.filter((r) => !r.area_name.includes('Outdoor')).length,
  };
}

function getPeopleAhead(reservationId, branchId = 'branch_1') {
  const activeWaiting = reservations
    .filter((r) => r.branch_id === branchId && (r.status === 'waiting' || r.status === 'ready'))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const index = activeWaiting.findIndex((r) => r.reservation_id === reservationId);
  return index >= 0 ? index : 0;
}

function syncAllCustomerTrackers(branchId = 'branch_1') {
  const activeWaiting = reservations.filter(
    (r) => r.branch_id === branchId && (r.status === 'waiting' || r.status === 'ready')
  );

  activeWaiting.forEach((res) => {
    const peopleAhead = getPeopleAhead(res.reservation_id, branchId);
    io.to(`reservation_${res.reservation_id}`).emit('queue:position_updated', {
      reservation_id: res.reservation_id,
      people_ahead: peopleAhead,
      estimated_wait_mins: Math.max(5, peopleAhead * 10),
      status: res.status,
    });
  });
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET /api/v1/queue
app.get('/api/v1/queue', (req, res) => {
  const branchId = req.query.branch_id || 'branch_1';
  const branchQueue = reservations.filter((r) => r.branch_id === branchId);
  const stats = getQueueStats(branchId);
  res.json({
    queue: branchQueue,
    stats,
    branch_id: branchId,
  });
});

// GET /api/v1/reservation/:id
app.get('/api/v1/reservation/:id', (req, res) => {
  const reservation = reservations.find((r) => r.reservation_id === req.params.id);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  const peopleAhead = getPeopleAhead(reservation.reservation_id, reservation.branch_id);
  res.json({
    reservation,
    people_ahead: peopleAhead,
    estimated_wait_mins: Math.max(5, peopleAhead * 10),
  });
});

// POST /api/v1/create
app.post('/api/v1/create', (req, res) => {
  const { customer_name, mobile, party_size, area_name, notes, branch_id = 'branch_1' } = req.body;

  if (!customer_name || !mobile) {
    return res.status(400).json({ error: 'Customer name and mobile number are required.' });
  }

  const parsedParty = parseInt(party_size, 10) || 2;
  const branchReservations = reservations.filter((r) => r.branch_id === branch_id);
  const currentWaiting = branchReservations.filter((r) => r.status === 'waiting' || r.status === 'ready');
  const queueNumber = branchReservations.length + 1;
  const newReservationId = `COAL-${++queueCounter}`;
  const estimatedWait = Math.max(10, currentWaiting.length * 10 + (parsedParty > 4 ? 10 : 5));

  const newReservation = {
    reservation_id: newReservationId,
    customer_name: customer_name.trim(),
    mobile: mobile.trim(),
    party_size: parsedParty,
    area_name: area_name || 'Main Dining Room',
    queue_number: queueNumber,
    status: 'waiting',
    created_at: new Date().toISOString(),
    notes: notes ? notes.trim() : '',
    branch_id,
    estimated_wait_mins: estimatedWait,
    notified_at: null,
    seated_at: null,
  };

  // 1. Save record to database
  reservations.unshift(newReservation);

  // 2. Emit WebSocket event `queue:new_entry` to staff rooms (branch_{branch_id})
  // 3. Payload: { reservation_id, customer_name, mobile, party_size, area_name, queue_number, created_at }
  const newEntryPayload = {
    reservation_id: newReservation.reservation_id,
    customer_name: newReservation.customer_name,
    mobile: newReservation.mobile,
    party_size: newReservation.party_size,
    area_name: newReservation.area_name,
    queue_number: newReservation.queue_number,
    created_at: newReservation.created_at,
    status: newReservation.status,
    estimated_wait_mins: newReservation.estimated_wait_mins,
  };

  io.to(`branch_${branch_id}`).emit('queue:new_entry', newEntryPayload);
  syncAllCustomerTrackers(branch_id);

  const peopleAhead = getPeopleAhead(newReservation.reservation_id, branch_id);

  res.status(201).json({
    success: true,
    reservation: newReservation,
    people_ahead: peopleAhead,
  });
});

// POST /api/v1/status
app.post('/api/v1/status', (req, res) => {
  const { reservation_id, status } = req.body;

  if (!reservation_id || !status) {
    return res.status(400).json({ error: 'reservation_id and status are required' });
  }

  const reservation = reservations.find((r) => r.reservation_id === reservation_id);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  reservation.status = status;
  if (status === 'ready') {
    reservation.notified_at = new Date().toISOString();
  } else if (status === 'served') {
    reservation.seated_at = new Date().toISOString();
  }

  const statusPayload = {
    reservation_id: reservation.reservation_id,
    status: reservation.status,
    queue_number: reservation.queue_number,
    updated_at: new Date().toISOString(),
    customer_name: reservation.customer_name,
    area_name: reservation.area_name,
    notified_at: reservation.notified_at,
  };

  io.to(`branch_${reservation.branch_id}`).emit('queue:status_changed', statusPayload);
  io.to(`reservation_${reservation.reservation_id}`).emit('queue:status_changed', statusPayload);
  syncAllCustomerTrackers(reservation.branch_id);

  res.json({
    success: true,
    reservation,
  });
});

// POST /api/v1/seed
app.post('/api/v1/seed', (req, res) => {
  const branchId = req.body.branch_id || 'branch_1';
  reservations = [
    {
      reservation_id: 'COAL-101',
      customer_name: 'Marcus Vance',
      mobile: '+1 (555) 234-8901',
      party_size: 2,
      area_name: 'Coal Hearth Bar',
      queue_number: 1,
      status: 'waiting',
      created_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      notes: 'Anniversary couple; prefers open hearth view.',
      branch_id: branchId,
      estimated_wait_mins: 5,
      notified_at: null,
      seated_at: null,
    },
    {
      reservation_id: 'COAL-102',
      customer_name: 'Elena Rostova',
      mobile: '+1 (555) 890-1234',
      party_size: 4,
      area_name: 'Main Dining Room',
      queue_number: 2,
      status: 'waiting',
      created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      notes: 'Booth seating preferred; celebrating promotion.',
      branch_id: branchId,
      estimated_wait_mins: 15,
      notified_at: null,
      seated_at: null,
    },
    {
      reservation_id: 'COAL-103',
      customer_name: 'Alexander Sterling',
      mobile: '+1 (555) 456-7890',
      party_size: 6,
      area_name: 'Outdoor Terrace',
      queue_number: 3,
      status: 'waiting',
      created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      notes: 'High chair requested; outdoor heat lamp section.',
      branch_id: branchId,
      estimated_wait_mins: 25,
      notified_at: null,
      seated_at: null,
    },
  ];

  io.to(`branch_${branchId}`).emit('queue:reset', { queue: reservations });
  res.json({ success: true, count: reservations.length });
});

// WebSocket Handling
io.on('connection', (socket) => {
  socket.on('join:staff', (data) => {
    const branchId = data?.branch_id || 'branch_1';
    socket.join(`branch_${branchId}`);
  });

  socket.on('join:customer', (data) => {
    const reservationId = data?.reservation_id;
    if (reservationId) {
      socket.join(`reservation_${reservationId}`);
      const res = reservations.find((r) => r.reservation_id === reservationId);
      if (res) {
        const peopleAhead = getPeopleAhead(res.reservation_id, res.branch_id);
        socket.emit('queue:position_updated', {
          reservation_id: res.reservation_id,
          people_ahead: peopleAhead,
          estimated_wait_mins: Math.max(5, peopleAhead * 10),
          status: res.status,
        });
      }
    }
  });

  socket.on('leave:customer', (data) => {
    if (data?.reservation_id) {
      socket.leave(`reservation_${data.reservation_id}`);
    }
  });
});

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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Coal Restaurant] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
