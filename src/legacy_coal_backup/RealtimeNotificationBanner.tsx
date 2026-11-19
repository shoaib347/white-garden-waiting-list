import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Users, 
  MapPin, 
  X, 
  ArrowRight, 
  Clock, 
  UserCheck, 
  Check, 
  CheckCheck 
} from 'lucide-react';
import { NewEntryPayload } from '../types';

interface BannerProps {
  entry: NewEntryPayload | null;
  onDismiss: (reservationId?: string) => void;
  onMarkAsRead?: (reservationId: string) => void;
  onMarkAsSeated: (reservationId: string) => void;
  onJumpToEntry?: (reservationId: string) => void;
  durationSeconds?: number;
}

export const RealtimeNotificationBanner: React.FC<BannerProps> = ({
  entry,
  onDismiss,
  onMarkAsRead,
  onMarkAsSeated,
  onJumpToEntry,
  durationSeconds = 14,
}) => {
  const [progress, setProgress] = useState(100);
  const [isSeatingLoading, setIsSeatingLoading] = useState(false);

  // Keep references to latest callbacks to avoid restarting timers on parent re-renders
  const onDismissRef = useRef(onDismiss);
  const onMarkAsReadRef = useRef(onMarkAsRead);
  const onMarkAsSeatedRef = useRef(onMarkAsSeated);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    onMarkAsReadRef.current = onMarkAsRead;
    onMarkAsSeatedRef.current = onMarkAsSeated;
  });

  useEffect(() => {
    if (!entry) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const startTime = Date.now();
    const durationMs = durationSeconds * 1000;
    const currentReservationId = entry.reservation_id;

    // Progress bar tick based on actual elapsed wall-clock time
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remainingPct);
    }, 100);

    // Dedicated asynchronous dismissal timeout - executed outside of render / state updater
    const timeout = setTimeout(() => {
      onDismissRef.current(currentReservationId);
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [entry?.reservation_id, durationSeconds]);

  const handleSeatClick = async () => {
    if (!entry) return;
    setIsSeatingLoading(true);
    try {
      await onMarkAsSeated(entry.reservation_id);
    } finally {
      setIsSeatingLoading(false);
    }
  };

  const handleMarkReadClick = () => {
    if (!entry) return;
    if (onMarkAsRead) {
      onMarkAsRead(entry.reservation_id);
    }
    onDismiss(entry.reservation_id);
  };

  const formattedTime = entry?.created_at
    ? new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Just now';

  return (
    <AnimatePresence>
      {entry && (
        <motion.div
          id="realtime-notification-banner"
          initial={{ opacity: 0, y: -50, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="relative z-50 w-full overflow-hidden border-b border-[#D32F2F]/60 bg-gradient-to-r from-[#1A0B0E] via-[#221014] to-[#141414] px-4 py-3 shadow-[0_12px_36px_rgba(211,47,47,0.3)]"
        >
          {/* Subtle gold accent line on top */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

          {/* Auto-dismiss duration countdown bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-neutral-800/80">
            <motion.div
              className="h-full bg-gradient-to-r from-[#D4AF37] via-[#D32F2F] to-emerald-500"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Pulsing Bell Icon with Crimson/Gold Glow */}
              <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#D32F2F]/60 bg-[#2A0E12] text-[#D4AF37] shadow-[0_0_15px_rgba(211,47,47,0.35)]">
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D32F2F] opacity-75"></span>
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#D32F2F] border-2 border-[#1A0B0E]"></span>
                </span>
                <Bell className="h-5 w-5 animate-bounce" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#D32F2F]/25 px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#FF7575] uppercase border border-[#D32F2F]/40">
                    Live Queue Alert
                  </span>
                  <span className="text-xs text-neutral-400 flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3 text-[#D4AF37]" /> Booked: {formattedTime}
                  </span>
                </div>
                <p className="text-sm font-medium text-white sm:text-base mt-0.5">
                  🔔 <span className="font-bold text-[#D4AF37]">New Party Registered:</span>{' '}
                  <span className="font-bold text-white underline decoration-[#D4AF37]/50 underline-offset-2">
                    {entry.customer_name}
                  </span>{' '}
                  —{' '}
                  <span className="text-neutral-200 font-semibold">{entry.party_size} People</span>{' '}
                  <span className="text-[#FF8A8A]">({entry.area_name})</span>
                </p>
              </div>
            </div>

            {/* Action buttons inside the banner */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-2 text-xs font-mono text-neutral-400 lg:flex">
                <span className="rounded-lg bg-neutral-900/90 px-2.5 py-1.5 border border-neutral-800 text-[#D4AF37] shadow-xs">
                  Ticket #{entry.queue_number} · <span className="text-neutral-400">{entry.reservation_id}</span>
                </span>
              </div>

              {/* Requirement: 'Mark as Seated' button inside the new reservation notification banner */}
              <button
                id="banner-btn-mark-seated"
                onClick={handleSeatClick}
                disabled={isSeatingLoading}
                title="Immediately mark this guest as seated and update live queue"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/70 bg-gradient-to-r from-emerald-950/80 to-emerald-900/70 px-3 py-1.5 text-xs font-bold text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:bg-emerald-800/80 hover:text-white hover:border-emerald-400 active:scale-95 transition disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>{isSeatingLoading ? 'Seating...' : 'Mark as Seated'}</span>
              </button>

              {/* Requirement: 'Mark as Read' button */}
              <button
                id="banner-btn-mark-read"
                onClick={handleMarkReadClick}
                title="Mark this notification as read and save viewed timestamp"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-2.5 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:border-[#D4AF37] active:scale-95 transition"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Mark Read</span>
              </button>

              {/* Jump to row in queue */}
              {onJumpToEntry && (
                <button
                  id="banner-btn-jump-entry"
                  onClick={() => onJumpToEntry(entry.reservation_id)}
                  title="Highlight party row in queue list"
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/80 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-700 transition"
                >
                  <span>View</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}

              {/* Requirement: 'Dismiss' button */}
              <button
                id="banner-btn-dismiss"
                onClick={() => onDismiss(entry.reservation_id)}
                title="Dismiss notification banner"
                aria-label="Dismiss notification"
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
