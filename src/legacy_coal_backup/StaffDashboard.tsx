import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Bell, 
  Filter, 
  Search, 
  RefreshCw,
  UserCheck,
  Flame,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  History,
  UserPlus,
  ShoppingBag,
} from 'lucide-react';
import { Reservation, QueueStats, NotificationHistoryItem, ReservationStatus } from '../types';
import { NotificationHistorySection } from './NotificationHistorySection';
import { GuestHistoryModal } from './GuestHistoryModal';
import { WalkInModal } from './WalkInModal';

interface StaffDashboardProps {
  queue: Reservation[];
  stats: QueueStats;
  branchId: string;
  onStatusChange: (reservationId: string, newStatus: 'waiting' | 'ready' | 'seated' | 'served' | 'cancelled', reason?: string) => Promise<void>;
  onCreateWalkIn: (data: { customer_name: string; mobile: string; party_size: number; area_name: string; notes: string }) => Promise<void>;
  onRefreshQueue: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestChime: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onSelectReservationForTracker?: (reservationId: string) => void;
  history: NotificationHistoryItem[];
  onDismissNotification: (idOrResId: string) => Promise<void>;
  onMarkReadNotification: (idOrResId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onRefreshHistory?: () => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  queue,
  stats,
  branchId,
  onStatusChange,
  onCreateWalkIn,
  onRefreshQueue,
  soundEnabled,
  onToggleSound,
  onTestChime,
  unreadCount,
  onOpenNotifications,
  onSelectReservationForTracker,
  history,
  onDismissNotification,
  onMarkReadNotification,
  onMarkAllRead,
  onRefreshHistory,
}) => {
  const [filterArea, setFilterArea] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'seated' | 'cancelled' | 'no_show'>('active');
  const [historyModalState, setHistoryModalState] = useState<{isOpen: boolean, mobile: string, name: string}>({isOpen: false, mobile: '', name: ''});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  // Filtered reservations
  const filteredQueue = queue.filter((res) => {
    // Area filter
    if (filterArea !== 'ALL' && !res.area_name.toLowerCase().includes(filterArea.toLowerCase())) {
      return false;
    }
    // Status filter
    if (filterStatus === 'active') {
      if (res.status !== 'waiting' && res.status !== 'ready') return false;
    } else if (filterStatus === 'seated') {
      if (res.status !== 'seated' && res.status !== 'served') return false;
    } else if (filterStatus !== 'all') {
      if (res.status !== filterStatus) return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = res.customer_name.toLowerCase().includes(q);
      const matchPhone = res.mobile.includes(q);
      const matchId = res.reservation_id.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId) return false;
    }
    return true;
  });

  const handleAction = async (reservationId: string, status: 'waiting' | 'ready' | 'seated' | 'served' | 'cancelled', optionalReason?: string) => {
    let actionReason = optionalReason;
    if (status === 'cancelled' && !actionReason) {
      const reason = window.prompt("Please enter a mandatory reason for cancelling this reservation (e.g., No show, Guest requested):");
      if (!reason || !reason.trim()) {
        alert("Cancellation aborted: Reason is mandatory.");
        return;
      }
      actionReason = reason.trim();
    }
    
    try {
      setActionLoadingId(reservationId);
      await onStatusChange(reservationId, status, actionReason);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Compute wait duration from created_at
  const getWaitDuration = (isoString: string) => {
    const diffMins = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / (60 * 1000)));
    if (diffMins < 1) return 'Just joined';
    if (diffMins === 1) return '1 min ago';
    return `${diffMins} mins ago`;
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {/* Metric 1: Waiting */}
        <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#161616] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Waiting in Queue</span>
            <Users className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white font-serif">{stats.waiting_count}</span>
            <span className="text-xs text-neutral-400">parties</span>
          </div>
          <div className="mt-1 flex items-center text-[11px] text-neutral-500">
            <span>{stats.outdoor_count} Outdoor · {stats.indoor_count} Indoor</span>
          </div>
        </div>

        {/* Metric 2: Calling / Ready */}
        <div className="relative overflow-hidden rounded-xl border border-[#D32F2F]/40 bg-gradient-to-br from-[#1E1113] to-[#161616] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FF8A8A]">Called / Ready</span>
            <Bell className="h-4 w-4 text-[#D32F2F] animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#D4AF37] font-serif">{stats.calling_count}</span>
            <span className="text-xs text-[#FF8A8A]">at host stand</span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Awaiting seating
          </div>
        </div>

        {/* Metric 3: Avg Wait Time */}
        <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#161616] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Avg Wait Time</span>
            <Clock className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white font-serif">~{stats.avg_wait_mins}</span>
            <span className="text-xs text-neutral-400">minutes</span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Based on current table turns
          </div>
        </div>

        {/* Metric 4: Seated Tonight */}
        <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#161616] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Seated Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white font-serif">{stats.served_count}</span>
            <span className="text-xs text-neutral-400">parties seated</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-500/80">
            Capacity optimal
          </div>
        </div>
      </div>

      {/* Action Bar: Audio Settings, Test Walk-in, Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-[#171717] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Audio Chime Button */}
          <button
            id="btn-toggle-sound"
            onClick={onToggleSound}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              soundEnabled
                ? 'border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-950/60'
                : 'border border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-neutral-400" />}
            <span>Chime Alerts: {soundEnabled ? 'Active' : 'Muted'}</span>
          </button>



          {/* Unread Notifications Button */}
          <button
            id="btn-notifications-drawer"
            onClick={onOpenNotifications}
            className="relative inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[#D32F2F] px-1.5 py-0.2 text-[10px] font-bold text-white shadow-xs animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Add Walk-In Button */}
          <button
            onClick={() => setIsWalkInModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D32F2F]/50 bg-[#D32F2F]/10 px-3 py-1.5 text-xs font-medium text-[#D32F2F] hover:bg-[#D32F2F]/20 transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Walk-In</span>
          </button>
        </div>

        <div className="flex items-center gap-2">


          <button
            id="btn-refresh-queue"
            onClick={onRefreshQueue}
            title="Re-sync queue from server"
            className="rounded-lg border border-neutral-700 p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Queue Management Section */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#151515] shadow-xl">
        {/* Table Filters Header */}
        <div className="flex flex-col gap-3 border-b border-neutral-800/90 p-4 sm:flex-row sm:items-center sm:justify-between bg-[#1A1A1A]/70">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">View:</span>
            {[
              { id: 'active', label: 'Active Queue' },
              { id: 'waiting', label: 'Waiting Only' },
              { id: 'ready', label: 'Called / Ready' },
              { id: 'served', label: 'Seated' },
              { id: 'all', label: 'All Entries' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterStatus === tab.id
                    ? 'bg-[#D32F2F] text-white font-semibold shadow-xs'
                    : 'bg-neutral-800/60 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Area Filter */}
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800/90 px-2.5 py-1.5 text-xs text-neutral-200 focus:border-[#D4AF37] focus:outline-hidden"
            >
              <option value="ALL">All Areas</option>
              <option value="Main Dining">Main Dining</option>
              <option value="Outdoor Terrace">Outdoor Terrace</option>
              <option value="Coal Hearth Bar">Coal Hearth Bar</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search guest or ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 rounded-lg border border-neutral-700 bg-neutral-800/90 pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="border-b border-neutral-800 bg-[#121212]/90 text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3">Queue #</th>
                <th className="px-4 py-3">Guest & Contact</th>
                <th className="px-4 py-3">Party Size</th>
                <th className="px-4 py-3">Area Request</th>
                <th className="px-4 py-3">Wait Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Host Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                    <Flame className="mx-auto h-8 w-8 text-neutral-600 mb-2 opacity-60" />
                    <p className="text-sm font-medium text-neutral-400">No parties match the filter criteria</p>

                  </td>
                </tr>
              ) : (
                filteredQueue.map((item, idx) => {
                  const isNewest = idx === 0 && (Date.now() - new Date(item.created_at).getTime() < 60000);
                  const isReady = item.status === 'ready';
                  const isServed = item.status === 'served';
                  const isWalkIn = item.notes?.includes('[WALK-IN]');
                  const cleanNotes = item.notes?.replace('[WALK-IN]', '').trim();

                  return (
                    <motion.tr
                      key={item.reservation_id}
                      initial={isNewest ? { backgroundColor: 'rgba(211, 47, 47, 0.25)' } : false}
                      animate={{ backgroundColor: isReady ? 'rgba(212, 175, 55, 0.08)' : 'rgba(22, 22, 22, 0.6)' }}
                      transition={{ duration: 1.2 }}
                      className={`group transition hover:bg-neutral-800/40 ${
                        isReady ? 'border-l-4 border-l-[#D4AF37]' : isNewest ? 'border-l-4 border-l-[#D32F2F]' : ''
                      }`}
                    >
                      {/* Queue # and ID */}
                      <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-800 text-xs font-bold text-[#D4AF37] border border-neutral-700">
                            #{item.queue_number}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400">
                            {item.reservation_id}
                          </span>
                        </div>
                      </td>

                      {/* Guest name & mobile */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white group-hover:text-[#D4AF37] transition flex items-center gap-1.5 flex-wrap">
                          {item.past_visits_count && item.past_visits_count > 0 ? (
                            <button 
                              onClick={() => setHistoryModalState({isOpen: true, mobile: item.mobile, name: item.customer_name})}
                              className="flex items-center gap-1.5 hover:underline"
                              title={`${item.past_visits_count} past visits. Click to view history.`}
                            >
                              {item.customer_name}
                              <span className="rounded-full bg-[#D4AF37]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                                🌟 Returning ({item.past_visits_count})
                              </span>
                            </button>
                          ) : (
                            item.customer_name
                          )}
                          
                          {isWalkIn && (
                            <span className="rounded bg-neutral-700/80 px-1.5 py-0.2 text-[9px] font-bold text-neutral-200 border border-neutral-600 uppercase tracking-wider">
                              Walk-In
                            </span>
                          )}

                          {isNewest && (
                            <span className="rounded bg-[#D32F2F] px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono mt-0.5">
                          <Phone className="h-3 w-3 text-neutral-500" />
                          {item.mobile}
                        </div>
                        {cleanNotes && (
                          <div className="mt-1 text-[11px] italic text-neutral-400 line-clamp-1 max-w-xs">
                            "{cleanNotes}"
                          </div>
                        )}
                      </td>

                      {/* Party size */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-800/80 px-2 py-1 text-xs font-medium text-neutral-200 border border-neutral-700/80">
                          <Users className="h-3.5 w-3.5 text-[#D4AF37]" />
                          {item.party_size} {item.party_size === 1 ? 'Guest' : 'Guests'}
                        </span>
                      </td>

                      {/* Area request */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-300">
                          <MapPin className="h-3.5 w-3.5 text-[#D32F2F]" />
                          {item.area_name}
                        </span>
                      </td>

                      {/* Wait Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-neutral-300">
                          <Clock className="h-3.5 w-3.5 text-neutral-500" />
                          <span>{getWaitDuration(item.created_at)}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          Est: ~{item.estimated_wait_mins}m total
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {item.status === 'waiting' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Waiting in line
                          </span>
                        )}
                        {item.status === 'ready' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/20 px-2.5 py-0.5 text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/40 shadow-xs animate-pulse">
                            <Bell className="h-3 w-3" />
                            Table Ready / Called
                          </span>
                        )}
                        {(item.status === 'seated' || item.status === 'served') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Seated
                          </span>
                        )}
                        {item.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-500 border border-neutral-700">
                            Cancelled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">

                          {/* "Call Customer" (waiting -> ready) */}
                          {item.status === 'waiting' && !isWalkIn && (
                            <button
                              id={`btn-call-${item.reservation_id}`}
                              disabled={actionLoadingId === item.reservation_id}
                              onClick={() => handleAction(item.reservation_id, 'ready')}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2.5 py-1 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/25 hover:border-[#D4AF37] active:scale-95 transition disabled:opacity-50"
                            >
                              <Bell className="h-3 w-3" />
                              <span>Call Customer</span>
                            </button>
                          )}

                          {/* "Seat Customer" (ready -> seated, or direct for Walk-ins) */}
                          {(item.status === 'ready' || (item.status === 'waiting' && isWalkIn)) && (
                            <button
                              id={`btn-seat-${item.reservation_id}`}
                              disabled={actionLoadingId === item.reservation_id}
                              onClick={() => handleAction(item.reservation_id, 'seated')}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/50 hover:border-emerald-400 active:scale-95 transition disabled:opacity-50"
                            >
                              <UserCheck className="h-3 w-3" />
                              <span>Seat Customer</span>
                            </button>
                          )}

                          {/* "Takeaway" (active -> served, or direct for Walk-ins) */}
                          {(item.status === 'ready' || (item.status === 'waiting' && isWalkIn)) && (
                            <button
                              disabled={actionLoadingId === item.reservation_id}
                              onClick={() => handleAction(item.reservation_id, 'served', 'Takeaway')}
                              title="Mark as Takeaway"
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/50 bg-sky-950/40 px-2 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-900/50 hover:border-sky-400 active:scale-95 transition disabled:opacity-50"
                            >
                              <ShoppingBag className="h-3 w-3" />
                              <span>Takeaway</span>
                            </button>
                          )}

                          {/* Cancel / Remove if still active */}
                          {item.status !== 'seated' && item.status !== 'served' && item.status !== 'cancelled' && (
                            <button
                              id={`btn-cancel-${item.reservation_id}`}
                              disabled={actionLoadingId === item.reservation_id}
                              onClick={() => handleAction(item.reservation_id, 'cancelled')}
                              title="Cancel / No-show"
                              className="rounded-lg border border-neutral-800 p-1 text-neutral-500 hover:bg-neutral-800 hover:text-[#D32F2F] transition disabled:opacity-50"
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="border-t border-neutral-800/80 bg-[#121212] px-4 py-3 flex flex-wrap items-center justify-between text-[11px] text-neutral-500">

          <div>
            Showing {filteredQueue.length} of {queue.length} total waitlist entries
          </div>
        </div>
      </div>

      {/* DEDICATED NOTIFICATION HISTORY & AUDIT LOG SECTION */}
      <NotificationHistorySection
        history={history}
        onDismissNotification={onDismissNotification}
        onMarkReadNotification={onMarkReadNotification}
        onMarkAllRead={onMarkAllRead}
        onStatusChange={onStatusChange}
        onSelectReservationForTracker={onSelectReservationForTracker}
        onRefreshHistory={onRefreshHistory}
        onViewGuestHistory={(mobile, name) => setHistoryModalState({isOpen: true, mobile, name})}
      />

      <GuestHistoryModal 
        isOpen={historyModalState.isOpen} 
        onClose={() => setHistoryModalState({isOpen: false, mobile: '', name: ''})} 
        mobile={historyModalState.mobile} 
        customerName={historyModalState.name} 
      />

      <WalkInModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onSubmit={async (data) => {
          await onCreateWalkIn(data);
          setIsWalkInModalOpen(false);
        }}
      />
    </div>
  );
};
