import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Bell, 
  Users, 
  Ticket, 
  Columns, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { useSocket } from './hooks/useSocket';
import { StaffDashboard } from './components/StaffDashboard';
import { CustomerBookingForm } from './components/CustomerBookingForm';
import { CustomerTicketTracker } from './components/CustomerTicketTracker';
import { RealtimeNotificationBanner } from './components/RealtimeNotificationBanner';
import { NotificationDrawer } from './components/NotificationDrawer';
import { Reservation, QueueStats, NewEntryPayload, StatusChangedPayload, NotificationItem, NotificationHistoryItem } from './types';
import { playNotificationChime, getAudioContext } from './audioUtils';

import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';

type ActiveView = 'staff' | 'booking' | 'ticket' | 'split';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = decodeURIComponent(location.pathname.substring(1));
  let currentView: ActiveView = 'staff';
  if (currentPath === 'Guest Waitlist Form') currentView = 'booking';
  else if (currentPath === 'Guest Live Tracker') currentView = 'ticket';
  else if (currentPath === 'Split Dual Test') currentView = 'split';
  else if (currentPath === 'Staff Dashboard') currentView = 'staff';

  const setCurrentView = (view: ActiveView) => {
    if (view === 'staff') navigate('/Staff Dashboard');
    if (view === 'booking') navigate('/Guest Waitlist Form');
    if (view === 'ticket') navigate('/Guest Live Tracker');
    if (view === 'split') navigate('/Split Dual Test');
  };
  const [branchId, setBranchId] = useState('branch_1');
  const [queue, setQueue] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    waiting_count: 0,
    calling_count: 0,
    served_count: 0,
    avg_wait_mins: 15,
    outdoor_count: 0,
    indoor_count: 0,
  });

  // Track active customer reservation for ticket view
  const [activeReservationId, setActiveReservationId] = useState<string>('COAL-101');

  // Real-time notification banner & drawer state
  const [latestBannerEntry, setLatestBannerEntry] = useState<NewEntryPayload | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);

  // Derive notifications for the drawer from persistent notification history
  const notifications: NotificationItem[] = notificationHistory.map(item => ({
    id: item.id,
    type: item.status === 'waiting' ? 'new_reservation' : 'status_ready',
    title: item.status === 'waiting' ? 'New Party Registered' : `Status Update: ${item.status}`,
    message: `${item.customer_name} — ${item.party_size} People (${item.area_name})`,
    timestamp: item.notification_created_at,
    read: item.read,
    data: {
      reservation_id: item.reservation_id,
      customer_name: item.customer_name,
      mobile: item.mobile,
      party_size: item.party_size,
      area_name: item.area_name,
      queue_number: item.queue_number,
      created_at: item.reservation_created_at,
      status: item.status,
    }
  }));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(true);

  // WebSocket Connection
  const { socket, isConnected } = useSocket();

  // Load initial settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/settings?branch_id=${branchId}`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setIsWaitlistOpen(data.is_waitlist_open);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, [branchId]);

  // Load initial queue data
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/queue?branch_id=${branchId}`);
      if (!res.ok) throw new Error('Failed to fetch queue');
      const data = await res.json();
      setQueue(data.queue || []);
      setStats(data.stats || {
        waiting_count: 0,
        calling_count: 0,
        served_count: 0,
        avg_wait_mins: 15,
        outdoor_count: 0,
        indoor_count: 0,
      });
    } catch (err) {
      console.error('Error fetching queue:', err);
    }
  }, [branchId]);

  // Load persistent notification history
  const fetchNotificationHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/notifications/history?branch_id=${branchId}`);
      if (!res.ok) throw new Error('Failed to fetch notification history');
      const data = await res.json();
      setNotificationHistory(data.history || []);
    } catch (err) {
      console.error('Error fetching notification history:', err);
    }
  }, [branchId]);

  useEffect(() => {
    if (currentView === 'staff' || currentView === 'split') {
      fetchSettings();
      fetchQueue();
      fetchNotificationHistory();
    }
  }, [currentView, fetchSettings, fetchQueue, fetchNotificationHistory]);

  // Handle URL hash routing (e.g. #ticket=COAL-101)
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#ticket=')) {
        const id = hash.replace('#ticket=', '');
        if (id) {
          setActiveReservationId(id);
          setCurrentView('ticket');
        }
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // WebSocket real-time subscription for staff room
  useEffect(() => {
    if (!socket) return;

    // Join staff branch room on connect/reconnect
    const onConnect = () => {
      socket.emit('join:staff', { branch_id: branchId });
    };
    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);

    // 1. WEBSOCKET REAL-TIME ENGINE: Live Listener for `queue:new_entry`
    const handleNewEntry = (payload: NewEntryPayload) => {
      // Audio Alert: Play chime sound using Web Audio API
      if (soundEnabled) {
        playNotificationChime({ volume: 0.75, type: 'new_entry' });
      }

      // Visual Flash / Banner: Display animated banner at top
      setLatestBannerEntry(payload);

      // Toast Counter & Notification Drawer: Increase unread badge


      // Dynamic Queue Update: Prepend new customer without page refresh (idempotent check)
      setQueue((prevQueue) => {
        const exists = prevQueue.some((r) => r.reservation_id === payload.reservation_id);
        if (exists) return prevQueue;

        const newReservation: Reservation = {
          reservation_id: payload.reservation_id,
          customer_name: payload.customer_name,
          mobile: payload.mobile,
          party_size: payload.party_size,
          area_name: payload.area_name,
          queue_number: payload.queue_number,
          status: payload.status || 'waiting',
          created_at: payload.created_at || new Date().toISOString(),
          branch_id: branchId,
          estimated_wait_mins: payload.estimated_wait_mins || 15,
          notified_at: null,
          seated_at: null,
        };

        return [newReservation, ...prevQueue];
      });

      // Update statistics
      setStats((prev) => ({
        ...prev,
        waiting_count: prev.waiting_count + 1,
        outdoor_count: payload.area_name.includes('Outdoor') ? prev.outdoor_count + 1 : prev.outdoor_count,
        indoor_count: !payload.area_name.includes('Outdoor') ? prev.indoor_count + 1 : prev.indoor_count,
      }));
    };

    // 2. Listener for `queue:status_changed`
    const handleStatusChanged = (payload: StatusChangedPayload) => {
      setQueue((prevQueue) =>
        prevQueue.map((item) => {
          if (item.reservation_id === payload.reservation_id) {
            return {
              ...item,
              status: payload.status,
              notified_at: payload.status === 'ready' ? payload.updated_at : item.notified_at,
              seated_at: payload.status === 'seated' || payload.status === 'served' ? payload.updated_at : item.seated_at,
            };
          }
          return item;
        })
      );

      setNotificationHistory((prev) =>
        prev.map((item) => {
          if (item.reservation_id === payload.reservation_id) {
            return {
              ...item,
              status: payload.status,
            };
          }
          return item;
        })
      );

      // Re-calculate stats from fresh queue data
      fetchQueue();
    };

    // 3. Listener for notification events
    const handleNotificationNew = (record: NotificationHistoryItem) => {
      setNotificationHistory((prev) => {
        const exists = prev.some((n) => n.id === record.id || n.reservation_id === record.reservation_id);
        if (exists) {
          return prev.map((n) => (n.id === record.id || n.reservation_id === record.reservation_id ? record : n));
        }
        return [record, ...prev];
      });
    };

    const handleNotificationUpdated = (updatedRecord: NotificationHistoryItem) => {
      setNotificationHistory((prev) =>
        prev.map((n) => (n.id === updatedRecord.id || n.reservation_id === updatedRecord.reservation_id ? updatedRecord : n))
      );
    };

    const handleNotificationHistorySynced = (data: { history: NotificationHistoryItem[] }) => {
      if (data?.history) {
        setNotificationHistory(data.history);
      }
    };

    const handleQueueReset = () => {
      fetchQueue();
      fetchNotificationHistory();
    };

    const handleSettingsUpdated = (data: { is_waitlist_open: boolean }) => {
      setIsWaitlistOpen(data.is_waitlist_open);
    };

    socket.on('queue:new_entry', handleNewEntry);
    socket.on('queue:status_changed', handleStatusChanged);
    socket.on('notification:new', handleNotificationNew);
    socket.on('notification:updated', handleNotificationUpdated);
    socket.on('notification:history_synced', handleNotificationHistorySynced);
    socket.on('queue:reset', handleQueueReset);
    socket.on('settings:updated', handleSettingsUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('queue:new_entry', handleNewEntry);
      socket.off('queue:status_changed', handleStatusChanged);
      socket.off('notification:new', handleNotificationNew);
      socket.off('notification:updated', handleNotificationUpdated);
      socket.off('notification:history_synced', handleNotificationHistorySynced);
      socket.off('queue:reset', handleQueueReset);
      socket.off('settings:updated', handleSettingsUpdated);
    };
  }, [socket, branchId, soundEnabled, fetchQueue, fetchNotificationHistory]);

  // Handle staff action (call / seat / cancel)
  const handleStatusChange = useCallback(async (
    reservationId: string,
    newStatus: 'waiting' | 'ready' | 'seated' | 'served' | 'cancelled',
    reason?: string
  ) => {
    try {
      const res = await fetch('/api/v1/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservationId,
          status: newStatus,
          reason,
        }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      // Optimistic update
      setQueue((prev) =>
        prev.map((r) => (r.reservation_id === reservationId ? { ...r, status: newStatus } : r))
      );
      setNotificationHistory((prev) =>
        prev.map((n) => (n.reservation_id === reservationId ? { ...n, status: newStatus } : n))
      );
    } catch (err) {
      console.error('Status change error:', err);
    }
  }, []);

  // 'Mark as Seated' action from the notification banner:
  // Triggers Socket.IO event queue:status_changed with reservation ID and status 'seated'
  // Updates customer status to 'seated' in the database and updates the live queue display
  const handleMarkAsSeated = useCallback(async (reservationId: string) => {
    // 1. Trigger Socket.IO event queue:status_changed
    if (socket) {
      socket.emit('queue:status_changed', {
        reservation_id: reservationId,
        status: 'seated',
      });
    }

    // 2. Persist to database via API
    await handleStatusChange(reservationId, 'seated');

    // 3. Mark notification as read / viewed in history
    const now = new Date().toISOString();
    setNotificationHistory((prev) =>
      prev.map((n) =>
        n.reservation_id === reservationId
          ? { ...n, status: 'seated', read: true, viewed_at: n.viewed_at || now }
          : n
      )
    );

    // 4. Dismiss banner
    setLatestBannerEntry(null);
  }, [socket, handleStatusChange]);

  // 'Dismiss' action: sets dismissed_at timestamp and hides banner / marks item in history
  const handleDismissNotification = useCallback(async (idOrResId?: string) => {
    if (!idOrResId) {
      setLatestBannerEntry(null);
      return;
    }

    const now = new Date().toISOString();
    setNotificationHistory((prev) =>
      prev.map((n) => {
        if (n.id === idOrResId || n.reservation_id === idOrResId) {
          return { ...n, dismissed_at: now, read: true, viewed_at: n.viewed_at || now };
        }
        return n;
      })
    );

    setLatestBannerEntry((current) =>
      current?.reservation_id === idOrResId ? null : current
    );

    if (socket) {
      socket.emit('notification:dismiss', { reservation_id: idOrResId, id: idOrResId });
    }

    try {
      await fetch('/api/v1/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: idOrResId, id: idOrResId }),
      });
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  }, [socket]);

  // 'Mark as Read' action: sets viewed_at timestamp and marks item in history
  const handleMarkReadNotification = useCallback(async (idOrResId: string) => {
    const now = new Date().toISOString();
    setNotificationHistory((prev) =>
      prev.map((n) => {
        if (n.id === idOrResId || n.reservation_id === idOrResId) {
          return { ...n, viewed_at: now, read: true };
        }
        return n;
      })
    );



    if (socket) {
      socket.emit('notification:mark_read', { reservation_id: idOrResId, id: idOrResId });
    }

    try {
      await fetch('/api/v1/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: idOrResId, id: idOrResId }),
      });
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  }, [socket]);

  const handleMarkAllHistoryRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotificationHistory((prev) =>
      prev.map((n) => ({ ...n, read: true, viewed_at: n.viewed_at || now }))
    );


    try {
      await fetch('/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId }),
      });
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  }, [branchId]);

  // One-click demo walk-in simulation: "Shoaib - 6 People (Outdoor)"
  const handleSimulateWalkIn = async () => {
    getAudioContext(); // Ensure AudioContext unlocked by user gesture
    try {
      await fetch('/api/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Shoaib',
          mobile: '+1 (555) 389-4210',
          party_size: 6,
          area_name: 'Outdoor Terrace',
          notes: 'Heated outdoor table requested. Anniversary celebration.',
          branch_id: branchId,
        }),
      });
    } catch (err) {
      console.error('Simulate walk-in error:', err);
    }
  };

  // Test Chime Function
  const handleTestChime = () => {
    getAudioContext();
    playNotificationChime({ volume: 0.8, type: 'new_entry' });
  };

  const handleToggleSound = () => {
    getAudioContext();
    setSoundEnabled((prev) => !prev);
  };

  // Unread badge count
  const unreadCount = notificationHistory.filter((n) => !n.read).length;

  const handleSelectReservationForTracker = (id: string) => {
    setActiveReservationId(id);
    setCurrentView('ticket');
  };

  if (location.pathname === '/' || location.pathname === '') {
    return <Navigate to="/Staff Dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col selection:bg-[#D32F2F] selection:text-white font-sans">
      {/* Visual Flash / Banner at top of dashboard */}
      {(currentView === 'staff' || currentView === 'split') && (
        <RealtimeNotificationBanner
          entry={latestBannerEntry}
          onDismiss={handleDismissNotification}
          onMarkAsRead={handleMarkReadNotification}
          onMarkAsSeated={handleMarkAsSeated}
          onJumpToEntry={(resId) => {
            setCurrentView('staff');
          }}
        />
      )}

      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <img src="https://coal-sa.com/wp-content/uploads/2024/02/header_logo.png" alt="Coal Logo" className="h-12 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <img 
                  src="/coal-text-logo-dark.png" 
                  alt="COAL" 
                  style={{ width: '76.375px', height: '32px' }}
                  className="object-contain" 
                />
                <span className="rounded-sm bg-[#c02126] px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-widest">
                  Live
                </span>
              </div>
            </div>
          </div>

          {/* Navigation View Switcher Tabs */}
          <nav className="flex items-center rounded-xl border border-neutral-800 bg-[#181818] p-1 text-xs">
            <button
              id="tab-staff-dashboard"
              onClick={() => setCurrentView('staff')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                currentView === 'staff'
                  ? 'bg-gradient-to-r from-[#D32F2F] to-[#B71C1C] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Staff Dashboard</span>
            </button>

            <button
              id="tab-customer-booking"
              onClick={() => setCurrentView('booking')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                currentView === 'booking'
                  ? 'bg-gradient-to-r from-[#D32F2F] to-[#B71C1C] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Guest Waitlist Form</span>
            </button>

            <button
              id="tab-customer-ticket"
              onClick={() => setCurrentView('ticket')}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                currentView === 'ticket'
                  ? 'bg-gradient-to-r from-[#D32F2F] to-[#B71C1C] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Ticket className="h-3.5 w-3.5" />
              <span>Guest Live Tracker</span>
            </button>

            <button
              id="tab-split-mode"
              onClick={() => setCurrentView('split')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                currentView === 'split'
                  ? 'bg-[#D4AF37] text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-[#D4AF37]'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Split Dual Test</span>
            </button>
          </nav>

          {/* Right Status Badges & Controls */}
          <div className="flex items-center gap-2">
            {/* Waitlist Open/Close Toggle (Staff Only) */}
            {(currentView === 'staff' || currentView === 'split') && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/v1/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ branch_id: branchId, is_waitlist_open: !isWaitlistOpen })
                    });
                    if (res.ok) {
                      setIsWaitlistOpen(!isWaitlistOpen);
                    }
                  } catch (err) {
                    console.error('Failed to toggle waitlist status', err);
                  }
                }}
                title={isWaitlistOpen ? 'Waitlist is Open - Click to Close' : 'Waitlist is Closed - Click to Open'}
                className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono font-bold transition cursor-pointer ${
                  isWaitlistOpen 
                    ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60' 
                    : 'border-red-800 bg-red-950/40 text-red-400 hover:bg-red-900/60'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isWaitlistOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span>{isWaitlistOpen ? 'WAITLIST OPEN' : 'WAITLIST CLOSED'}</span>
              </button>
            )}

            {/* WebSocket Connection Pill */}
            <div
              title={isConnected ? 'Connected to WebSocket Server' : 'Connecting to WebSocket...'}
              className="hidden md:flex items-center gap-1.5 rounded-full border border-neutral-800 bg-[#161616] px-2.5 py-1 text-[11px] text-neutral-400 font-mono"
            >
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="text-emerald-400">Live WS</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  <span className="text-amber-400">Reconnecting</span>
                </>
              )}
            </div>

            {/* Audio Toggle button */}
            <button
              id="header-sound-toggle"
              onClick={handleToggleSound}
              title={soundEnabled ? 'Audio chime alerts enabled' : 'Audio chime alerts muted'}
              className={`rounded-lg border p-2 transition ${
                soundEnabled
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Notification Bell Badge */}
            <button
              id="header-notifications-bell"
              onClick={() => setIsDrawerOpen(true)}
              className="relative rounded-lg border border-neutral-700 bg-neutral-800/80 p-2 text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D32F2F] px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* VIEW 1: STAFF DASHBOARD */}
        {currentView === 'staff' && (
          <StaffDashboard
            queue={queue}
            stats={stats}
            branchId={branchId}
            onStatusChange={handleStatusChange}
            onSimulateWalkIn={handleSimulateWalkIn}
            onRefreshQueue={fetchQueue}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            onTestChime={handleTestChime}
            unreadCount={unreadCount}
            onOpenNotifications={() => setIsDrawerOpen(true)}
            onSelectReservationForTracker={handleSelectReservationForTracker}
            history={notificationHistory}
            onDismissNotification={handleDismissNotification}
            onMarkReadNotification={handleMarkReadNotification}
            onMarkAllRead={handleMarkAllHistoryRead}
            onRefreshHistory={fetchNotificationHistory}
          />
        )}

        {/* VIEW 2: CUSTOMER BOOKING FORM */}
        {currentView === 'booking' && (
          <div className="py-4">
            <CustomerBookingForm
              branchId={branchId}
              stats={stats}
              isWaitlistOpen={isWaitlistOpen}
              onSuccess={(resId) => {
                setActiveReservationId(resId);
                setCurrentView('ticket');
              }}
            />
          </div>
        )}

        {/* VIEW 3: CUSTOMER LIVE TICKET TRACKER */}
        {currentView === 'ticket' && (
          <div className="py-4">
            <CustomerTicketTracker
              reservationId={activeReservationId}
              socket={socket}
              onBackToBooking={() => setCurrentView('booking')}
              onSelectAnother={() => setCurrentView('staff')}
            />
          </div>
        )}

        {/* VIEW 4: SPLIT DUAL TEST MODE (Simulate real-time live interaction) */}
        {currentView === 'split' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#D4AF37]/30 bg-[#1E1911] p-3 text-center text-xs text-[#D4AF37] flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4AF37]" />
              <span>
                <strong>Dual Live Verification Mode:</strong> Submit a booking on the left, and watch the Staff Dashboard on the right receive the real-time notification, chime, and prepend the queue instantly!
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Pane: Customer Registration / Live Tracker */}
              <div className="lg:col-span-5 rounded-2xl border border-neutral-800 bg-[#141414] p-4">
                <div className="border-b border-neutral-800 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#D32F2F]/20 text-xs font-bold text-[#D32F2F]">
                      1
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Customer Experience
                    </span>
                  </div>
                  <div className="flex gap-1 text-[11px]">
                    <button
                      onClick={() => setActiveReservationId('')}
                      className="rounded px-2 py-0.5 bg-neutral-800 text-neutral-300 hover:text-white"
                    >
                      New Form
                    </button>
                    {activeReservationId && (
                      <button
                        onClick={() => setActiveReservationId(activeReservationId)}
                        className="rounded px-2 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37]"
                      >
                        Active Ticket
                      </button>
                    )}
                  </div>
                </div>

                {activeReservationId ? (
                  <CustomerTicketTracker
                    reservationId={activeReservationId}
                    socket={socket}
                    onBackToBooking={() => setActiveReservationId('')}
                  />
                ) : (
                  <CustomerBookingForm
                    branchId={branchId}
                    stats={stats}
                    onSuccess={(resId) => {
                      setActiveReservationId(resId);
                    }}
                  />
                )}
              </div>

              {/* Right Pane: Staff Dashboard Live */}
              <div className="lg:col-span-7 rounded-2xl border border-neutral-800 bg-[#141414] p-4">
                <div className="border-b border-neutral-800 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#D4AF37]/20 text-xs font-bold text-[#D4AF37]">
                      2
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Live Staff Host Stand
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                    Listening for queue:new_entry
                  </span>
                </div>

                <StaffDashboard
                  queue={queue}
                  stats={stats}
                  branchId={branchId}
                  onStatusChange={handleStatusChange}
                  onSimulateWalkIn={handleSimulateWalkIn}
                  onRefreshQueue={fetchQueue}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                  onTestChime={handleTestChime}
                  unreadCount={unreadCount}
                  onOpenNotifications={() => setIsDrawerOpen(true)}
                  onSelectReservationForTracker={handleSelectReservationForTracker}
                  history={notificationHistory}
                  onDismissNotification={handleDismissNotification}
                  onMarkReadNotification={handleMarkReadNotification}
                  onMarkAllRead={handleMarkAllHistoryRead}
                  onRefreshHistory={fetchNotificationHistory}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-out Notifications Drawer */}
      <NotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        notifications={notifications}
        onClearAll={() => setNotificationHistory([])}
        onMarkAllRead={handleMarkAllHistoryRead}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onTestChime={handleTestChime}
      />


    </div>
  );
}
