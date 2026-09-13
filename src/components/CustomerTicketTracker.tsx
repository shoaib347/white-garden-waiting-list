import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Users, 
  Clock, 
  MapPin, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  ArrowLeft,
  Share2,
  Check
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { t, Language } from '../i18n';
import { Reservation, StatusChangedPayload } from '../types';
import { playNotificationChime } from '../audioUtils';

interface TicketTrackerProps {
  reservationId: string;
  socket: Socket | null;
  onBackToBooking: () => void;
  onSelectAnother?: () => void;
  language: Language;
}

export const CustomerTicketTracker: React.FC<TicketTrackerProps> = ({
  reservationId,
  socket,
  onBackToBooking,
  onSelectAnother,
  language,
}) => {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [peopleAhead, setPeopleAhead] = useState<number>(0);
  const [estimatedWait, setEstimatedWait] = useState<number>(15);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Fetch initial ticket state
  const fetchTicket = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/reservation/${reservationId}`);
      if (!res.ok) throw new Error('Ticket not found');
      const data = await res.json();
      setReservation(data.reservation);
      setPeopleAhead(data.people_ahead);
      setEstimatedWait(data.estimated_wait_mins);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reservationId) {
      fetchTicket();
    }
  }, [reservationId]);

  // WebSocket Live Listeners for customer ticket
  useEffect(() => {
    if (!socket || !reservationId) return;

    // Join room for this specific reservation
    socket.emit('join:customer', { reservation_id: reservationId });

    // 1. Listen for queue position changes
    const handlePositionUpdated = (data: {
      reservation_id: string;
      people_ahead: number;
      estimated_wait_mins: number;
      status: string;
    }) => {
      if (data.reservation_id === reservationId) {
        setPeopleAhead(data.people_ahead);
        setEstimatedWait(data.estimated_wait_mins);
        setReservation((prev) => (prev ? { ...prev, status: data.status as any } : prev));
      }
    };

    // 2. Listen for status changes (e.g. staff calls "ready" or "served")
    const handleStatusChanged = (data: StatusChangedPayload) => {
      if (data.reservation_id === reservationId) {
        setReservation((prev) => (prev ? { ...prev, status: data.status } : prev));

        if (data.status === 'ready') {
          setLastNotification(`🔔 ${t('tracker.readyHeading', language)}!`);
          if ('Notification' in window && Notification.permission === 'granted') { new Notification('Your Table is Ready!', { body: 'Please head to the host stand now.' }); }
          if (soundEnabled) playNotificationChime({ volume: 0.85, type: 'status_call' });
        } else if (data.status === 'seated') {
          setLastNotification(`✅ ${t('tracker.seatedHeading', language)}!`);
          if (soundEnabled) playNotificationChime({ volume: 0.85, type: 'status_call' });
        } else if (data.status === 'cancelled') {
          setLastNotification(`❌ ${t('tracker.cancelledHeading', language)}.`);
          if (soundEnabled) playNotificationChime({ volume: 0.85, type: 'status_call' });
        }
      }
    };

    socket.on('queue:position_updated', handlePositionUpdated);
    socket.on('queue:status_changed', handleStatusChanged);

    return () => {
      socket.emit('leave:customer', { reservation_id: reservationId });
      socket.off('queue:position_updated', handlePositionUpdated);
      socket.off('queue:status_changed', handleStatusChanged);
    };
  }, [socket, reservationId, soundEnabled]);

  // Auto-redirect back to booking form when party is seated or served or cancelled
  useEffect(() => {
    if (reservation && ['seated', 'served', 'cancelled', 'no_show'].includes(reservation.status)) {
      const timer = setTimeout(() => {
        onBackToBooking();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [reservation?.status, onBackToBooking]);

  const handleShare = () => {
    const url = `${window.location.origin}/#ticket=${reservationId}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <RefreshCw className="h-8 w-8 animate-spin text-[#D4AF37] mb-3" />
        <p className="text-sm font-medium">Syncing with Coal waitlist engine...</p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-800 bg-[#161616] p-8 text-center text-white">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
        <h3 className="text-lg font-bold">Ticket Not Found</h3>
        <p className="mt-1 text-xs text-neutral-400">
          The reservation ID "{reservationId}" does not exist in the active queue.
        </p>
        <button
          onClick={onBackToBooking}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Waitlist Registration
        </button>
      </div>
    );
  }

  const isReady = reservation.status === 'ready';
  const isServed = reservation.status === 'served';
  const isCancelled = reservation.status === 'cancelled';

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* Table Ready Alert Popup / Banner */}
      <AnimatePresence>
        {isReady && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="overflow-hidden rounded-2xl border-2 border-[#D4AF37] bg-gradient-to-br from-[#2F2108] via-[#21180A] to-[#121212] p-5 text-center shadow-[0_0_40px_rgba(212,175,55,0.4)]"
          >
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4AF37] text-neutral-950 animate-bounce">
              <Bell className="h-7 w-7" />
            </div>
            <span className="rounded-full bg-[#D4AF37]/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              Host Call Alert
            </span>
            <h2 className="mt-2 text-2xl font-black text-white font-serif tracking-tight">
              {t('tracker.readyHeading', language)}
            </h2>
            <p className="mt-1 text-xs text-neutral-200">
              Please present your ticket #{reservation.queue_number} to the Coal Host Stand at the entrance.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Luxury Ticket Card */}
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#161616] shadow-2xl">
        {/* Ticket Header */}
        <div className="relative border-b border-neutral-800/80 bg-gradient-to-r from-[#1E1113] via-[#1A1416] to-[#141414] p-6 text-center">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-4">
            <button
              onClick={onBackToBooking}
              className="inline-flex items-center gap-1 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('tracker.back', language)}</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Chime sound enabled' : 'Chime sound muted'}
                className="rounded-lg border border-neutral-700/80 p-1 text-neutral-400 hover:text-white transition"
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={handleShare}
                title="Copy {t('tracker.share', language)} link"
                className="rounded-lg border border-neutral-700/80 p-1 text-neutral-400 hover:text-white transition"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#D32F2F]/40 bg-[#260C10] text-[#D32F2F]">
            <Flame className="h-6 w-6" />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]">
            {t('tracker.restaurant', language)}
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white font-serif">
            {reservation.customer_name}
          </h1>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 font-mono text-xs text-neutral-300">
            <span>Ticket: #{reservation.queue_number}</span>
            <span className="text-neutral-600">|</span>
            <span className="text-[#D4AF37]">{reservation.reservation_id}</span>
          </div>
        </div>

        {/* Live Status and Position Body */}
        <div className="p-6 space-y-6">
          {/* People Ahead Large Visual Counter */}
          <div className="rounded-xl border border-neutral-800 bg-[#121212] p-5 text-center">
            {isServed ? (
              <div className="py-2">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
                <h4 className="text-lg font-bold text-white">Party Seated</h4>
                <p className="text-xs text-neutral-400 mt-1">Thank you for dining at Coal Restaurant.</p>
              </div>
            ) : isReady ? (
              <div className="py-2">
                <div className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37] animate-pulse">
                  Now Being Called
                </div>
                <div className="text-3xl font-black text-white font-serif mt-1">
                  Table Available
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  Proceed to host podium with party of {reservation.party_size}
                </div>
              </div>
            ) : isCancelled ? (
              <div className="py-2">
                <AlertTriangle className="mx-auto h-10 w-10 text-neutral-500 mb-2" />
                <h4 className="text-base font-bold text-neutral-300">{t('tracker.cancelledHeading', language)}</h4>
              </div>
            ) : (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                  Parties Ahead in Line
                </div>
                <div className="mt-1 text-5xl font-black tracking-tight text-white font-serif">
                  {peopleAhead}
                </div>
                <p className="mt-2 text-xs text-neutral-400 flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Estimated wait: <strong className="text-white">~{estimatedWait} mins</strong>
                </p>
              </div>
            )}
          </div>

          {/* Reservation Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-neutral-800 bg-[#141414] p-3">
              <div className="text-[10px] uppercase text-neutral-500 flex items-center gap-1">
                <Users className="h-3 w-3 text-[#D4AF37]" /> Party Size
              </div>
              <div className="mt-1 font-semibold text-white">
                {reservation.party_size} {reservation.party_size === 1 ? 'Guest' : 'Guests'}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-[#141414] p-3">
              <div className="text-[10px] uppercase text-neutral-500 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[#D32F2F]" /> Seating Area
              </div>
              <div className="mt-1 font-semibold text-white truncate">
                {reservation.area_name}
              </div>
            </div>
          </div>


          {/* Instructions */}
          <div className="text-[11px] text-neutral-400 text-center leading-relaxed">
            Please remain nearby the restaurant perimeter. You will receive an instant audio and screen chime when your table is prepared.
          </div>
        </div>
      </div>
    </div>
  );
};






