import { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Phone, Users, X } from 'lucide-react';
import { SEATING_AREAS, type Language } from '../data/whiteGardenData';
import type { BranchInfo, WaitlistEntry } from '../utils/waitlistLogic';

interface GuestHistoryVisit {
  reservation_id: string;
  branch_id: string;
  customer_name: string;
  mobile: string;
  party_size: number;
  area_name: string;
  status: string;
  notes?: string | null;
  created_at: string;
  notified_at?: string | null;
  seated_at?: string | null;
}

interface GuestHistoryModalProps {
  lang: Language;
  guest: WaitlistEntry;
  branches: BranchInfo[];
  allEntries: WaitlistEntry[];
  onClose: () => void;
}

function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

export function GuestHistoryModal({
  lang,
  guest,
  branches,
  allEntries,
  onClose,
}: GuestHistoryModalProps) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<GuestHistoryVisit[]>([]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const buildLocalFallback = (): GuestHistoryVisit[] => {
      const targetPhone = normalizePhoneDigits(guest.phone);
      const targetName = guest.guestName.trim().toLowerCase();
      return allEntries
        .filter((e) => {
          const ePhone = normalizePhoneDigits(e.phone);
          if (targetPhone.length >= 7 && ePhone.length >= 7) {
            return ePhone === targetPhone;
          }
          return e.guestName.trim().toLowerCase() === targetName;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((e) => ({
          reservation_id: e.ticketCode,
          branch_id: e.branchId,
          customer_name: e.guestName,
          mobile: e.phone,
          party_size: e.partySize,
          area_name: e.seatingArea,
          status: e.status,
          notes: e.notes || null,
          created_at: new Date(e.createdAt).toISOString(),
          notified_at: e.calledAt ? new Date(e.calledAt).toISOString() : null,
          seated_at: e.seatedAt ? new Date(e.seatedAt).toISOString() : null,
        }));
    };

    const loadHistory = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (guest.phone) params.set('mobile', guest.phone);
        if (guest.guestName) params.set('name', guest.guestName);
        const res = await fetch(`/api/v1/guest-history?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.visits) && data.visits.length > 0) {
            setVisits(data.visits);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to local entries
      }
      if (!cancelled) {
        setVisits(buildLocalFallback());
        setLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [guest, allEntries]);

  const branchLabel = (branchId: string) => {
    const b = branches.find((item) => item.id === branchId);
    return b ? (isAr ? b.nameAr : b.nameEn) : branchId;
  };

  const areaLabel = (areaId: string) => {
    const a = SEATING_AREAS.find((item) => item.id === areaId);
    return a ? (isAr ? a.labelAr : a.labelEn) : areaId;
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'seated' || s === 'served') {
      return {
        label: isAr ? 'تم الإجلاس' : 'Seated',
        cls: 'bg-[#D8F3DC] text-[#1B4332] border-[#1B4332]/25',
      };
    }
    if (s === 'ready' || s === 'called') {
      return {
        label: isAr ? 'جاري النداء' : 'Calling',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    if (s === 'no_show') {
      return {
        label: isAr ? 'لم يحضر' : 'No-Show',
        cls: 'bg-red-50 text-red-700 border-red-200',
      };
    }
    if (s === 'cancelled') {
      return {
        label: isAr ? 'ملغي' : 'Cancelled',
        cls: 'bg-neutral-100 text-neutral-600 border-neutral-200',
      };
    }
    return {
      label: isAr ? 'في الانتظار' : 'Waiting',
      cls: 'bg-[#F2F5F0] text-[#1B4332] border-[#1B4332]/15',
    };
  };

  const totalVisits = visits.length;
  const seatedVisits = visits.filter((v) => v.status === 'seated' || v.status === 'served').length;
  const missedVisits = visits.filter((v) => v.status === 'no_show' || v.status === 'cancelled').length;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081C15]/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-history-title"
        className="bg-white border border-[#1B4332]/20 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#081C15] text-white px-6 py-5 border-b border-[#C5A059]/40 flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {totalVisits >= 2 && (
                <span
                  className="w-2.5 h-2.5 rounded-full bg-[#95D5B2] ring-2 ring-[#95D5B2]/35 shrink-0"
                  aria-hidden="true"
                />
              )}
              <h2
                id="guest-history-title"
                className="font-display text-2xl font-semibold truncate"
              >
                {guest.guestName}
              </h2>
              {totalVisits >= 2 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1B4332] text-[#D8F3DC] border border-[#95D5B2]/40">
                  {isAr ? `ضيف عائد · ${totalVisits} زيارات` : `Returning Guest · ${totalVisits} Visits`}
                </span>
              )}
            </div>
            {guest.phone && (
              <p
                dir="ltr"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#95D5B2]/90 tabular-nums"
              >
                <Phone className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                <span>{guest.phone}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="Close guest history"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-[#F7F9F6] border-b border-[#1B4332]/10">
          <div className="bg-white rounded-xl border border-[#1B4332]/12 p-3 text-center">
            <p className="text-[11px] font-medium text-[#081C15]/60">
              {isAr ? 'إجمالي الزيارات' : 'Total Visits'}
            </p>
            <p className="text-xl font-semibold text-[#081C15] tabular-nums mt-0.5">
              {totalVisits}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#1B4332]/12 p-3 text-center">
            <p className="text-[11px] font-medium text-[#081C15]/60">
              {isAr ? 'تم إجلاسه' : 'Seated'}
            </p>
            <p className="text-xl font-semibold text-[#1B4332] tabular-nums mt-0.5">
              {seatedVisits}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#1B4332]/12 p-3 text-center">
            <p className="text-[11px] font-medium text-[#081C15]/60">
              {isAr ? 'ملغي / لم يحضر' : 'No-Show / Cancel'}
            </p>
            <p className="text-xl font-semibold text-amber-700 tabular-nums mt-0.5">
              {missedVisits}
            </p>
          </div>
        </div>

        {/* Visit History List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <p className="text-sm text-[#081C15]/60 text-center py-8">
              {isAr ? 'جاري تحميل سجل الضيف...' : 'Loading guest visit history...'}
            </p>
          ) : visits.length === 0 ? (
            <p className="text-sm text-[#081C15]/60 text-center py-8">
              {isAr ? 'لا توجد زيارات سابقة مسجلة.' : 'No visit history found.'}
            </p>
          ) : (
            visits.map((visit, idx) => {
              const badge = statusBadge(visit.status);
              const dt = new Date(visit.created_at);
              const rawNotes = visit.notes || '';
              const graceCount = (rawNotes.match(/\[\+5m\]/g) || []).length * 5;
              const cleanNote = rawNotes
                .replace(/\[\+5m\]/g, '')
                .replace(/\[WALKIN\]/g, '')
                .replace(/\s*\|?\s*Table\s+G-\d+/gi, '')
                .trim();
              const ticketDisplay = visit.reservation_id.startsWith('#')
                ? visit.reservation_id
                : `#${visit.reservation_id}`;

              return (
                <div
                  key={`${visit.reservation_id}-${idx}`}
                  className="rounded-xl border border-[#1B4332]/12 bg-[#FBFBFB] p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#1B4332]">
                        {ticketDisplay}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#081C15]">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                        {branchLabel(visit.branch_id)}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#081C15]/70 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                      {dt.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                      {dt.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                      {visit.party_size} {isAr ? 'ضيوف' : visit.party_size === 1 ? 'Guest' : 'Guests'}
                    </span>
                    <span>· {areaLabel(visit.area_name)}</span>
                  </div>

                  {(graceCount > 0 || cleanNote) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {graceCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          {isAr ? `+${graceCount} دقائق إضافية` : `+${graceCount} min requested`}
                        </span>
                      )}
                      {cleanNote && (
                        <span className="text-xs text-[#081C15]/65 italic">{cleanNote}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
