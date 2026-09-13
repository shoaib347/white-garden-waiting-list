import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  Search, 
  Filter, 
  UserCheck, 
  Check, 
  Flame, 
  Eye, 
  Users, 
  MapPin, 
  ExternalLink,
  RefreshCw,
  Download
} from 'lucide-react';
import { NotificationHistoryItem, ReservationStatus } from '../types';

interface NotificationHistorySectionProps {
  history: NotificationHistoryItem[];
  onDismissNotification: (idOrResId: string) => Promise<void>;
  onMarkReadNotification: (idOrResId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onStatusChange: (reservationId: string, newStatus: 'waiting' | 'ready' | 'seated' | 'served' | 'cancelled') => Promise<void>;
  onSelectReservationForTracker?: (reservationId: string) => void;
  onRefreshHistory?: () => void;
  onViewGuestHistory?: (mobile: string, name: string) => void;
}

export const NotificationHistorySection: React.FC<NotificationHistorySectionProps> = ({
  history,
  onDismissNotification,
  onMarkReadNotification,
  onMarkAllRead,
  onStatusChange,
  onSelectReservationForTracker,
  onRefreshHistory,
  onViewGuestHistory
}) => {
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'dismissed' | 'seated' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [filterPartySize, setFilterPartySize] = useState('');
  const [filterArea, setFilterArea] = useState('All');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredHistory = history.filter((item) => {
    if (filterType === 'unread' && item.read) return false;
    if (filterType === 'dismissed' && !item.dismissed_at) return false;
    if (filterType === 'seated' && item.status !== 'seated' && item.status !== 'served') return false;
    if (filterType === 'cancelled' && item.status !== 'cancelled') return false;

    if (filterDateStart) {
      const itemDate = new Date(item.reservation_created_at).toISOString().split('T')[0];
      if (itemDate < filterDateStart) return false;
    }

    if (filterDateEnd) {
      const itemDate = new Date(item.reservation_created_at).toISOString().split('T')[0];
      if (itemDate > filterDateEnd) return false;
    }

    if (filterTime) {
      const itemTime = new Date(item.reservation_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      if (!itemTime.startsWith(filterTime)) return false;
    }

    if (filterPartySize && parseInt(filterPartySize) !== item.party_size) return false;
    if (filterArea !== 'All' && item.area_name !== filterArea) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.customer_name.toLowerCase().includes(q);
      const matchId = item.reservation_id.toLowerCase().includes(q);
      const matchArea = item.area_name.toLowerCase().includes(q);
      const matchPhone = item.mobile.includes(q);
      if (!matchName && !matchId && !matchArea && !matchPhone) return false;
    }
    return true;
  });

  const handleDismiss = async (id: string, reservationId: string) => {
    try {
      setLoadingId(id);
      await onDismissNotification(id || reservationId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleMarkRead = async (id: string, reservationId: string) => {
    try {
      setLoadingId(id);
      await onMarkReadNotification(id || reservationId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleSeat = async (reservationId: string) => {
    try {
      setLoadingId(reservationId);
      await onStatusChange(reservationId, 'seated');
    } finally {
      setLoadingId(null);
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Reservation ID",
      "Customer Name",
      "Mobile",
      "Party Size",
      "Area",
      "Created At",
      "Status",
      "Notes"
    ];

    const rows = filteredHistory.map(item => {
      const notes = (item as any).reservation?.notes || '';
      return [
        item.reservation_id,
        `"${item.customer_name.replace(/"/g, '""')}"`,
        `"${item.mobile.replace(/"/g, '""')}"`,
        item.party_size,
        `"${item.area_name}"`,
        `"${new Date(item.reservation_created_at).toLocaleString()}"`,
        item.status,
        `"${notes.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    // Add UTF-8 BOM so Excel properly renders Arabic characters
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `waitlist_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const unreadCount = history.filter((h) => !h.read).length;

  return (
    <div id="section-notification-history" className="rounded-xl border border-neutral-800 bg-[#151515] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-800 bg-[#1A1A1A]/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#251E14] text-[#D4AF37]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-bold text-white tracking-wide">
                Historical Notifications & Audit Log
              </h3>
              <span className="rounded-full bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37]/30">
                {history.length} Logged
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#D32F2F] px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                  {unreadCount} Unread
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            title="Export to Excel / CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {onRefreshHistory && (
            <button
              onClick={onRefreshHistory}
              title="Refresh notification history log"
              className="rounded-lg border border-neutral-700 bg-neutral-800/80 p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/20 transition"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Sub-bar */}
      <div className="flex flex-col gap-3 border-b border-neutral-800/80 bg-[#121212] px-4 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Status buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Status:
            </span>
            {[
              { id: 'all', label: 'All Alerts' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'seated', label: 'Seated' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  filterType === f.id
                    ? 'bg-[#D4AF37] text-black shadow-sm'
                    : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name, ID, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 rounded-md border border-neutral-700 bg-neutral-800/50 py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-neutral-800/50 mt-1 pb-1">
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Date Range:</span>
             <input type="date" title="From Date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
             <span className="text-[11px] text-neutral-500">-</span>
             <input type="date" title="To Date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Time:</span>
             <input type="time" value={filterTime} onChange={e => setFilterTime(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">People:</span>
             <input type="number" min="1" placeholder="Any" value={filterPartySize} onChange={e => setFilterPartySize(e.target.value)} className="w-16 rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Area:</span>
             <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]">
               <option value="All">All</option>
               <option value="Main Dining Room">Main Dining Room</option>
               <option value="Outdoor Terrace">Outdoor Terrace</option>
               <option value="Coal Hearth Bar">Coal Hearth Bar</option>
             </select>
           </div>
           {(filterDateStart || filterDateEnd || filterTime || filterPartySize || filterArea !== 'All') && (
             <button onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterTime(''); setFilterPartySize(''); setFilterArea('All'); }} className="text-[11px] text-[#D32F2F] hover:underline font-semibold tracking-wide ml-2">
               Clear Filters
             </button>
           )}
        </div>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-300">
          <thead className="border-b border-neutral-800 bg-[#121212]/90 text-[11px] uppercase tracking-wider text-neutral-400 font-mono">
            <tr>
              <th className="px-4 py-3">Reservation / Guest</th>
              <th className="px-4 py-3">Party & Area</th>
              <th className="px-4 py-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-[#D4AF37]" />
                  Reservation Made At
                </span>
              </th>
              <th className="px-4 py-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-emerald-400" />
                  Last Viewed / Dismissed
                </span>
              </th>
              <th className="px-4 py-3">Current Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                  <History className="mx-auto h-7 w-7 text-neutral-600 mb-2 opacity-60" />
                  <p className="text-sm font-medium text-neutral-400">No notifications found in history</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    When reservations are booked or simulated, notifications will persist here with complete timestamps.
                  </p>
                </td>
              </tr>
            ) : (
              filteredHistory.map((item) => {
                const resTime = formatTimestamp(item.reservation_created_at);
                const viewTime = formatTimestamp(item.viewed_at);
                const dismissTime = formatTimestamp(item.dismissed_at);
                const isSeated = item.status === 'seated' || item.status === 'served';

                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-neutral-800/40 ${
                      !item.read ? 'bg-[#D32F2F]/10 border-l-2 border-l-[#D32F2F]' : ''
                    }`}
                  >
                    {/* Guest & Reservation ID */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#D4AF37] bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                          {item.reservation_id}
                        </span>
                        {!item.read && (
                          <span className="rounded bg-[#D32F2F] px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                            New
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-white mt-1">
                        {onViewGuestHistory ? (
                          <button 
                            onClick={() => onViewGuestHistory(item.mobile, item.customer_name)}
                            className="hover:text-[#D4AF37] hover:underline text-left transition"
                            title="Click to view guest history"
                          >
                            {item.customer_name}
                          </button>
                        ) : (
                          item.customer_name
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {item.mobile}
                      </div>
                    </td>

                    {/* Party & Area */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-neutral-200">
                        <Users className="h-3.5 w-3.5 text-[#D4AF37]" />
                        <span>{item.party_size} People</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                        <MapPin className="h-3 w-3 text-[#D32F2F]" />
                        <span>{item.area_name}</span>
                      </div>
                    </td>

                    {/* Timestamp: Reservation Made At */}
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                      {resTime ? (
                        <div>
                          <div className="text-white font-medium flex items-center gap-1">
                            <span>{resTime.time}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {resTime.date}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>

                    {/* Timestamp: Notification Last Viewed / Dismissed At */}
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                      {dismissTime ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-neutral-800/90 px-2 py-0.5 text-[11px] text-neutral-300 border border-neutral-700">
                            <XCircle className="h-3 w-3 text-neutral-400" />
                            Dismissed: {dismissTime.time}
                          </span>
                          <div className="text-[10px] text-neutral-500 mt-0.5 pl-1">
                            {dismissTime.date}
                          </div>
                        </div>
                      ) : viewTime ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-neutral-800/90 px-2 py-0.5 text-[11px] text-emerald-400 border border-neutral-700">
                            <Eye className="h-3 w-3 text-emerald-400" />
                            Viewed: {viewTime.time}
                          </span>
                          <div className="text-[10px] text-neutral-500 mt-0.5 pl-1">
                            {viewTime.date}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Unviewed (Active)
                        </span>
                      )}
                    </td>

                    {/* Current Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {item.status === 'waiting' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                          Waiting
                        </span>
                      )}
                      {item.status === 'ready' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/20 px-2.5 py-0.5 text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/40">
                          <Bell className="h-3 w-3" />
                          Ready
                        </span>
                      )}
                      {isSeated && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Seated
                        </span>
                      )}
                      {item.status === 'cancelled' && (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-500 border border-neutral-700">
                            Cancelled
                          </span>
                          {(item as any).reservation?.notes && (item as any).reservation?.notes.includes('Cancel Reason:') && (
                            <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 max-w-[150px] truncate" title={(item as any).reservation?.notes}>
                              {(item as any).reservation?.notes.split('Cancel Reason:').pop().trim()}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Mark as Seated button if not yet seated */}
                        {!isSeated && item.status !== 'cancelled' && (
                          <button
                            id={`history-btn-seat-${item.reservation_id}`}
                            disabled={loadingId === item.reservation_id}
                            onClick={() => handleSeat(item.reservation_id)}
                            title="Mark customer as seated and update database"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400 transition disabled:opacity-50"
                          >
                            <UserCheck className="h-3 w-3 text-emerald-400" />
                            <span>Seat</span>
                          </button>
                        )}

                        {/* Mark as read */}
                        {!item.read && (
                          <button
                            id={`history-btn-read-${item.id}`}
                            disabled={loadingId === item.id}
                            onClick={() => handleMarkRead(item.id, item.reservation_id)}
                            title="Mark notification as read"
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-300 hover:text-white hover:border-neutral-500 transition disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />
                            <span>Read</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
    </div>
  );
};
