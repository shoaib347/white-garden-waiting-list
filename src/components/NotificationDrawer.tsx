import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Volume2, VolumeX, CheckCheck, Trash2, Clock, Users, MapPin } from 'lucide-react';
import { NotificationItem } from '../types';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onClearAll: () => void;
  onMarkAllRead: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestChime: () => void;
}

export const NotificationDrawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onClearAll,
  onMarkAllRead,
  soundEnabled,
  onToggleSound,
  onTestChime,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-800 bg-[#161616] text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D32F2F]/20 text-[#D32F2F]">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white tracking-wide">Queue Notifications</h3>
                  <p className="text-xs text-neutral-400">
                    {notifications.filter((n) => !n.read).length} unread alerts
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Audio Controls Box */}
            <div className="border-b border-neutral-800/80 bg-[#1E1E1E]/50 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-300">Audio Chime</span>
                  <span className={`inline-block h-2 w-2 rounded-full ${soundEnabled ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-neutral-600'}`} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onTestChime}
                    className="rounded-md border border-neutral-700 bg-neutral-800/80 px-2.5 py-1 text-xs text-[#D4AF37] hover:border-[#D4AF37] hover:bg-neutral-800 transition"
                  >
                    🔊 Test Chime
                  </button>
                  <button
                    onClick={onToggleSound}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      soundEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    {soundEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between border-b border-neutral-800/60 px-5 py-2.5 text-xs">
              <button
                onClick={onMarkAllRead}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-1 text-neutral-400 hover:text-[#D4AF37] disabled:opacity-40 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
              <button
                onClick={onClearAll}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-1 text-neutral-400 hover:text-[#D32F2F] disabled:opacity-40 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear history
              </button>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500">
                  <Bell className="h-10 w-10 stroke-1 text-neutral-600 mb-2 opacity-60" />
                  <p className="text-sm font-medium text-neutral-400">No recent notifications</p>
                  <p className="text-xs text-neutral-600 max-w-[200px] mt-1">
                    Incoming queue entries from walk-ins or online guests will chime here live.
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const entryData = item.data as any;
                  return (
                    <div
                      key={item.id}
                      className={`relative rounded-xl border p-3.5 transition ${
                        item.read
                          ? 'border-neutral-800/80 bg-[#1A1A1A]/60 opacity-80'
                          : 'border-[#D32F2F]/40 bg-gradient-to-r from-[#211114] to-[#1C1A1A] shadow-md'
                      }`}
                    >
                      {!item.read && (
                        <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-[#D32F2F]" />
                      )}
                      <div className="flex items-start justify-between pr-4">
                        <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="mt-1 text-sm font-medium text-white">{item.message}</p>

                      {entryData?.party_size && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                          <span className="inline-flex items-center gap-1 rounded bg-neutral-900 px-2 py-0.5 border border-neutral-800">
                            <Users className="h-3 w-3 text-[#D4AF37]" /> {entryData.party_size} Guests
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-neutral-900 px-2 py-0.5 border border-neutral-800">
                            <MapPin className="h-3 w-3 text-[#D32F2F]" /> {entryData.area_name}
                          </span>
                          {entryData.queue_number && (
                            <span className="text-[11px] text-neutral-500">
                              Ticket #{entryData.queue_number}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
