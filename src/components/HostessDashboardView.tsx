import { useEffect, useState, type FormEvent } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  LogOut,
  Minus,
  Phone,
  Plus,
  QrCode,
  Search,
  Sparkles,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import {
  COPY,
  SEATING_AREAS,
  SPECIAL_REQUEST_OPTIONS,
  type Language,
} from '../data/whiteGardenData';
import {
  computeDashboardStats,
  formatDurationCompact,
  formatReservationTime,
  type BranchId,
  type BranchInfo,
  type SeatingAreaId,
  type TicketAction,
  type WaitlistEntry,
} from '../utils/waitlistLogic';
import type { StaffAuthSession } from './StaffLoginView';
import { GuestHistoryModal } from './GuestHistoryModal';
import { BranchQrModal } from './BranchQrModal';

interface HostessDashboardViewProps {
  lang: Language;
  branches: BranchInfo[];
  selectedBranch: BranchId | 'all';
  onToggleBranchOpen: (branchId: BranchId) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  entries: WaitlistEntry[];
  onTicketAction: (ticketId: string, action: TicketAction, tableNumber?: string) => void;
  onAddWalkin: (input: {
    branchId: BranchId;
    guestName: string;
    phone: string;
    partySize: number;
    seatingArea: SeatingAreaId;
  }) => void;
  staffUser?: StaffAuthSession | null;
  onLogout?: () => void;
  onSelectBranch?: (branchId: BranchId | 'all') => void;
}

type QueueTab = 'waiting' | 'calling' | 'completed';

export function HostessDashboardView({
  lang,
  branches,
  selectedBranch,
  onToggleBranchOpen,
  audioEnabled,
  onToggleAudio,
  entries,
  onTicketAction,
  onAddWalkin,
  staffUser,
  onLogout,
  onSelectBranch,
}: HostessDashboardViewProps) {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<QueueTab>('waiting');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableDrafts, setTableDrafts] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [historyGuest, setHistoryGuest] = useState<WaitlistEntry | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // Walk-in modal form state
  const defaultWalkinBranch: BranchId =
    selectedBranch === 'all' ? branches[1].id : selectedBranch;
  const [walkinBranch, setWalkinBranch] = useState<BranchId>(defaultWalkinBranch);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinParty, setWalkinParty] = useState(2);
  const [walkinArea, setWalkinArea] = useState<SeatingAreaId>('terrace');
  const [walkinErr, setWalkinErr] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedBranch !== 'all') {
      setWalkinBranch(selectedBranch);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (!walkinOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWalkinOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [walkinOpen]);

  const stats = computeDashboardStats(entries, branches, selectedBranch);
  const scopedBranchObj =
    selectedBranch === 'all' ? branches[1] : branches.find((b) => b.id === selectedBranch) ?? branches[1];

  const branchScopedEntries =
    selectedBranch === 'all'
      ? entries
      : entries.filter((entry) => entry.branchId === selectedBranch);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = (entry: WaitlistEntry) => {
    if (!normalizedQuery) return true;
    return (
      entry.guestName.toLowerCase().includes(normalizedQuery) ||
      entry.ticketCode.toLowerCase().includes(normalizedQuery) ||
      entry.phone.toLowerCase().includes(normalizedQuery)
    );
  };

  const waitingList = branchScopedEntries
    .filter((e) => e.status === 'waiting' && matchesQuery(e))
    .sort((a, b) => a.createdAt - b.createdAt);

  const callingList = branchScopedEntries
    .filter((e) => e.status === 'called' && matchesQuery(e))
    .sort((a, b) => (a.calledAt ?? 0) - (b.calledAt ?? 0));

  const completedList = branchScopedEntries
    .filter(
      (e) =>
        (e.status === 'seated' || e.status === 'cancelled' || e.status === 'no_show') &&
        matchesQuery(e),
    )
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));

  const visibleList =
    activeTab === 'waiting'
      ? waitingList
      : activeTab === 'calling'
        ? callingList
        : completedList;

  const conciergeUpdates = branchScopedEntries
    .filter((e) => (e.status === 'waiting' || e.status === 'called') && matchesQuery(e))
    .flatMap((entry) =>
      entry.events.map((evt) => ({
        ...evt,
        entryId: entry.id,
        ticketCode: entry.ticketCode,
        guestName: entry.guestName,
        phone: entry.phone,
        branchId: entry.branchId,
      })),
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30);

  const formatClockTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const normalizePhoneDigits = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : digits;
  };

  const getGuestVisitCount = (entry: WaitlistEntry): number => {
    const targetDigits = normalizePhoneDigits(entry.phone);
    let localCount = 1;
    if (targetDigits.length >= 7) {
      localCount = entries.filter((e) => normalizePhoneDigits(e.phone) === targetDigits).length;
    }
    return Math.max(entry.visitCount ?? 1, localCount);
  };

  const branchName = (branchId: BranchId) => {
    const b = branches.find((item) => item.id === branchId);
    return b ? (lang === 'ar' ? b.nameAr : b.nameEn) : branchId;
  };

  const areaName = (areaId: SeatingAreaId) => {
    const a = SEATING_AREAS.find((item) => item.id === areaId);
    return a ? (lang === 'ar' ? a.labelAr : a.labelEn) : areaId;
  };

  const handleExportCSV = () => {
    const exportList = branchScopedEntries
      .filter((e) => matchesQuery(e))
      .sort((a, b) => b.createdAt - a.createdAt);

    if (exportList.length === 0) {
      window.alert(lang === 'ar' ? 'لا توجد بيانات للتصدير حالياً.' : 'No waitlist records to export yet.');
      return;
    }

    const csvEscape = (val: string | number | undefined | null) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = [
      'Ticket Code',
      'Branch',
      'Guest Name',
      'Mobile',
      'Party Size',
      'Seating Area',
      'Reservation Time',
      'Source',
      'Status',
      'Table',
      'Date',
      'Joined Time',
      'Called Time',
      'Seated Time',
      'Extra Grace (min)',
      'Notes',
    ];

    const rows = exportList.map((entry) => {
      const joinedDate = new Date(entry.createdAt);
      const calledStr = entry.calledAt ? new Date(entry.calledAt).toLocaleTimeString() : '';
      const seatedStr = entry.seatedAt ? new Date(entry.seatedAt).toLocaleTimeString() : '';
      return [
        csvEscape(entry.ticketCode),
        csvEscape(branchName(entry.branchId)),
        csvEscape(entry.guestName),
        csvEscape(entry.phone),
        entry.partySize,
        csvEscape(areaName(entry.seatingArea)),
        csvEscape(entry.reservationTime ? formatReservationTime(entry.reservationTime, 'en') : 'Now'),
        csvEscape(entry.source === 'walkin' ? 'Walk-in' : 'Online'),
        csvEscape(entry.status),
        csvEscape(entry.tableNumber || ''),
        csvEscape(joinedDate.toLocaleDateString()),
        csvEscape(joinedDate.toLocaleTimeString()),
        csvEscape(calledStr),
        csvEscape(seatedStr),
        entry.extraGraceMinutes ?? 0,
        csvEscape(entry.notes || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    // UTF-8 BOM so Microsoft Excel properly renders Arabic characters
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    const branchSlug = selectedBranch === 'all' ? 'all_branches' : selectedBranch;
    link.setAttribute('href', url);
    link.setAttribute('download', `white_garden_${branchSlug}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleWalkinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = walkinName.trim();
    if (!trimmed) {
      setWalkinErr(t.errNameRequired);
      return;
    }
    onAddWalkin({
      branchId: walkinBranch,
      guestName: trimmed,
      phone: walkinPhone.trim() || (lang === 'ar' ? 'تسجيل مباشر' : 'Walk-in Guest'),
      partySize: walkinParty,
      seatingArea: walkinArea,
    });
    setWalkinName('');
    setWalkinPhone('');
    setWalkinParty(2);
    setWalkinErr('');
    setWalkinOpen(false);
    setActiveTab('waiting');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Operational Toolbar */}
      <div className="flex flex-col gap-4 pb-5 border-b border-[#1B4332]/10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#2D6A4F] font-medium">
            <span>
              {selectedBranch === 'all'
                ? t.allBranches
                : lang === 'ar'
                  ? scopedBranchObj.nameAr
                  : scopedBranchObj.nameEn}
            </span>
            <span aria-hidden="true" className="text-[#C5A059]">
              ·
            </span>
            <span>{t.brandName}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#081C15]">
            {t.hostessTitle}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {staffUser?.role === 'admin' && onSelectBranch && (
            <select
              aria-label={t.selectBranchHeading}
              value={selectedBranch}
              onChange={(e) => onSelectBranch(e.target.value as BranchId | 'all')}
              className="h-7 px-2 py-0.5 rounded-lg border border-[#1B4332]/20 bg-white text-[#081C15] text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] cursor-pointer"
            >
              <option value="all">{t.allBranches}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {lang === 'ar' ? branch.nameAr : branch.nameEn}
                </option>
              ))}
            </select>
          )}

          {/* Waitlist Open/Closed Toggle for active branch */}
          <button
            type="button"
            onClick={() => onToggleBranchOpen(scopedBranchObj.id)}
            aria-pressed={scopedBranchObj.isOpen}
            className={`h-7 px-2 py-0.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
              scopedBranchObj.isOpen
                ? 'bg-[#D8F3DC]/60 border-[#1B4332]/30 text-[#081C15]'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            {scopedBranchObj.isOpen ? (
              <CheckCircle2 className="w-3 h-3 text-[#1B4332]" aria-hidden="true" />
            ) : (
              <XCircle className="w-3 h-3 text-amber-700" aria-hidden="true" />
            )}
            <span>
              {selectedBranch === 'all'
                ? `${lang === 'ar' ? scopedBranchObj.nameAr : scopedBranchObj.nameEn}: `
                : ''}
              {scopedBranchObj.isOpen ? t.waitlistToggleOpen : t.waitlistToggleClosed}
            </span>
          </button>

          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            aria-pressed={audioEnabled}
            className={`h-7 px-2 py-0.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
              audioEnabled
                ? 'bg-white border-[#1B4332]/20 text-[#1B4332]'
                : 'bg-neutral-100 border-neutral-300 text-neutral-600'
            }`}
          >
            {audioEnabled ? (
              <Volume2 className="w-3 h-3 text-[#C5A059]" aria-hidden="true" />
            ) : (
              <VolumeX className="w-3 h-3" aria-hidden="true" />
            )}
            <span>{audioEnabled ? t.audioChimeOn : t.audioChimeOff}</span>
          </button>

          {/* Walk-in QR Code Standee Button */}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            title={lang === 'ar' ? 'عرض وطباعة رمز QR للفرع' : 'View & print branch walk-in QR code'}
            className="h-7 px-2 py-0.5 rounded-lg border border-[#1B4332]/20 bg-white hover:bg-[#F7F9F6] text-[#1B4332] text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          >
            <QrCode className="w-3 h-3 text-[#C5A059]" aria-hidden="true" />
            <span>{lang === 'ar' ? 'رمز QR' : 'Branch QR'}</span>
          </button>

          {/* Export CSV / Excel Download */}
          <button
            type="button"
            onClick={handleExportCSV}
            title={lang === 'ar' ? 'تصدير السجل إلى Excel / CSV' : 'Export Waitlist History to Excel / CSV'}
            className="h-7 px-2 py-0.5 rounded-lg border border-[#1B4332]/20 bg-white hover:bg-[#F7F9F6] text-[#1B4332] text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          >
            <Download className="w-3 h-3 text-[#C5A059]" aria-hidden="true" />
            <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>

          {/* + Quick Walk-in CTA */}
          <button
            type="button"
            onClick={() => setWalkinOpen(true)}
            className="h-7 px-2.5 py-0.5 rounded-lg bg-[#1B4332] hover:bg-[#081C15] text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          >
            <UserPlus className="w-3 h-3 text-[#C5A059]" aria-hidden="true" />
            <span>{t.quickWalkinBtn}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={staffUser ? `Signed in as ${staffUser.branchName}` : 'Sign Out'}
              className="sm:ms-auto h-7 px-2 py-0.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <LogOut className="w-3 h-3" aria-hidden="true" />
              <span>{lang === 'ar' ? 'خروج' : 'Sign Out'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Column Compact Live Statistics Strip */}
      <section aria-label="Queue metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white border border-[#1B4332]/12 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#081C15]/65">{t.statWaiting}</p>
          <p className="text-lg font-semibold text-[#081C15] tabular-nums leading-none">
            {stats.totalWaiting}
          </p>
        </div>

        <div className="bg-white border border-[#1B4332]/12 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#081C15]/65">{t.statCalling}</p>
          <p className="text-lg font-semibold text-[#C5A059] tabular-nums leading-none">
            {stats.nowCalling}
          </p>
        </div>

        <div className="bg-white border border-[#1B4332]/12 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#081C15]/65">{t.statSeated}</p>
          <p className="text-lg font-semibold text-[#1B4332] tabular-nums leading-none">
            {stats.seatedToday}
          </p>
        </div>

        <div className="bg-white border border-[#1B4332]/12 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#081C15]/65">{t.statAvgWait}</p>
          <p className="text-lg font-semibold text-[#081C15] tabular-nums leading-none">
            {stats.avgWaitMinutes}{' '}
            <span className="text-[11px] font-medium text-[#081C15]/60">{t.minsUnit}</span>
          </p>
        </div>
      </section>

      {/* Compact Queue Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div
          role="tablist"
          aria-label="Queue stages"
          className="inline-flex flex-wrap items-center gap-0.5 p-0.5 bg-[#EEF2EC] rounded-lg border border-[#1B4332]/10"
        >
          {(
            [
              { id: 'waiting', label: t.tabWaiting, count: waitingList.length },
              { id: 'calling', label: t.tabCalling, count: callingList.length },
              { id: 'completed', label: t.tabCompleted, count: completedList.length },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`h-7 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap tabular-nums inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                  active
                    ? 'bg-white text-[#081C15] shadow-xs font-semibold'
                    : 'text-[#081C15]/70 hover:text-[#081C15]'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[11px] text-[#2D6A4F] font-semibold">({tab.count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search
            className="w-3.5 h-3.5 text-[#081C15]/45 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="w-full h-7 ps-8 pe-3 py-1 rounded-lg bg-white border border-[#1B4332]/15 text-[11px] text-[#081C15] placeholder:text-[#081C15]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          />
        </div>
      </div>

      {/* Queue Board Cards */}
      {visibleList.length === 0 ? (
        <div className="bg-white border border-[#1B4332]/12 rounded-2xl p-12 text-center space-y-2">
          <Clock className="w-8 h-8 text-[#1B4332]/40 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-2xl text-[#081C15]">{t.emptyQueueTitle}</h2>
          <p className="text-sm text-[#081C15]/60 max-w-md mx-auto">{t.emptyQueueDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleList.map((entry) => {
            const elapsedMs = Math.max(0, nowMs - entry.createdAt);
            const holdLeftMs =
              entry.status === 'called' && entry.holdExpiresAt
                ? Math.max(0, entry.holdExpiresAt - nowMs)
                : 0;
            const tableVal = tableDrafts[entry.id] ?? '';

            const requestLabels = entry.specialRequests
              .map((id) => SPECIAL_REQUEST_OPTIONS.find((o) => o.id === id))
              .filter(Boolean)
              .map((o) => (lang === 'ar' ? o!.labelAr : o!.labelEn));

            return (
              <article
                key={entry.id}
                className="bg-white border border-[#1B4332]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-colors hover:border-[#1B4332]/30"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs sm:text-sm font-semibold text-[#1B4332] tabular-nums">
                      {entry.ticketCode}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-[#081C15] flex flex-wrap items-center gap-2">
                      {getGuestVisitCount(entry) >= 2 && (
                        <span
                          title={
                            lang === 'ar'
                              ? `ضيف عائد (الزيارة رقم ${getGuestVisitCount(entry)}) — اضغط على الاسم لعرض السجل`
                              : `Returning guest (Visit #${getGuestVisitCount(entry)}) — Click name for history`
                          }
                          aria-label={
                            lang === 'ar'
                              ? `ضيف عائد، الزيارة رقم ${getGuestVisitCount(entry)}`
                              : `Returning guest, visit ${getGuestVisitCount(entry)}`
                          }
                          className="w-2.5 h-2.5 rounded-full bg-[#1B4332] ring-2 ring-[#D8F3DC] inline-block shrink-0"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setHistoryGuest(entry)}
                        title={lang === 'ar' ? 'عرض سجل زيارات الضيف' : 'View guest visit history'}
                        className="text-start hover:text-[#1B4332] hover:underline decoration-[#C5A059] underline-offset-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] rounded"
                      >
                        {entry.guestName}
                      </button>
                      {entry.source === 'walkin' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {lang === 'ar' ? 'حضور مباشر' : 'Walk-in'}
                        </span>
                      )}
                      {entry.reservationTime && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F2F5F0] text-[#1B4332] border border-[#1B4332]/25">
                          <Clock className="w-3 h-3 text-[#C5A059]" aria-hidden="true" />
                          {formatReservationTime(entry.reservationTime, lang)}
                        </span>
                      )}
                      {(entry.extraGraceMinutes ?? 0) > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300">
                          {lang === 'ar'
                            ? `+${entry.extraGraceMinutes} دقائق إضافية`
                            : `+${entry.extraGraceMinutes} min requested`}
                        </span>
                      )}
                    </h3>
                    {selectedBranch === 'all' && (
                      <>
                        <span aria-hidden="true" className="text-[#C5A059]">
                          ·
                        </span>
                        <span className="text-xs sm:text-sm text-[#2D6A4F] font-medium">
                          {branchName(entry.branchId)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#081C15]/70 tabular-nums">
                    <span className="inline-flex items-center gap-1 font-medium text-[#081C15]">
                      <Users className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                      {t.guestsLabel(entry.partySize)}
                    </span>
                    <span aria-hidden="true" className="text-[#C5A059]">
                      ·
                    </span>
                    <span>{areaName(entry.seatingArea)}</span>
                    <span aria-hidden="true" className="text-[#C5A059]">
                      ·
                    </span>
                    <span dir="ltr">{entry.phone}</span>

                    {requestLabels.length > 0 && (
                      <>
                        <span aria-hidden="true" className="text-[#C5A059]">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#1B4332] font-medium">
                          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                          {requestLabels.join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  {entry.notes && (
                    <p className="text-xs text-[#081C15]/60 italic">{entry.notes}</p>
                  )}
                </div>

                {/* Right side: Timers & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {entry.status === 'waiting' && (
                    <span className="text-xs font-mono font-medium text-[#081C15]/75 tabular-nums me-2">
                      {t.waitElapsed}: {formatDurationCompact(elapsedMs, lang)}
                    </span>
                  )}

                  {entry.status === 'called' && (
                    <span className="text-xs font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg tabular-nums me-1">
                      {t.holdCountdown}: {formatDurationCompact(holdLeftMs, lang)}
                    </span>
                  )}

                  {entry.status === 'waiting' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onTicketAction(entry.id, 'call')}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                        <span>{t.actionCallGuest}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onTicketAction(entry.id, 'seat', tableVal.trim() || undefined)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F2F6F3] hover:bg-[#D8F3DC] border border-[#1B4332]/20 text-[#1B4332] text-xs sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer"
                      >
                        {t.actionSeatParty}
                      </button>

                      <button
                        type="button"
                        onClick={() => onTicketAction(entry.id, 'no_show')}
                        className="min-h-[40px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#081C15]/60 hover:text-red-700 hover:bg-red-50 whitespace-nowrap transition-colors cursor-pointer"
                      >
                        {t.actionNoShow}
                      </button>
                    </>
                  )}

                  {entry.status === 'called' && (
                    <>
                      <input
                        type="text"
                        value={tableVal}
                        onChange={(e) =>
                          setTableDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))
                        }
                        placeholder={t.tableAssignPlaceholder}
                        aria-label={`${t.tableAssignPlaceholder} for ${entry.guestName}`}
                        className="w-28 px-2.5 py-2 min-h-[40px] rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-xs text-[#081C15]"
                      />

                      <button
                        type="button"
                        onClick={() => onTicketAction(entry.id, 'seat', tableVal.trim() || undefined)}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#95D5B2]" aria-hidden="true" />
                        <span>{t.actionSeatParty}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onTicketAction(entry.id, 'call')}
                        className="min-h-[40px] px-3 py-2 rounded-xl border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#F7F9F6] text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer"
                      >
                        {t.actionReNotify}
                      </button>

                      <button
                        type="button"
                        onClick={() => onTicketAction(entry.id, 'no_show')}
                        className="min-h-[40px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#081C15]/60 hover:text-red-700 hover:bg-red-50 whitespace-nowrap cursor-pointer"
                      >
                        {t.actionNoShow}
                      </button>
                    </>
                  )}

                  {(entry.status === 'seated' ||
                    entry.status === 'cancelled' ||
                    entry.status === 'no_show') && (
                    <span className="text-xs sm:text-sm font-medium text-[#1B4332] tabular-nums">
                      {entry.status === 'seated'
                        ? (entry.tableNumber ? `${t.seatedAtTable}: ${entry.tableNumber}` : (lang === 'ar' ? 'تم الإجلاس' : 'Seated'))
                        : entry.status === 'cancelled'
                          ? t.statusCancelled
                          : t.statusNoShow}
                    </span>
                  )}
                </div>
                </div>

                {/* Per-Guest Concierge Activity Log shown ONLY inside Completed / Seated History rows */}
                {activeTab === 'completed' && entry.events.length > 0 && (
                  <div className="pt-3 border-t border-[#1B4332]/10">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2D6A4F] mb-2">
                      {t.ticketTimelineTitle}
                    </p>
                    <ul className="space-y-1.5">
                      {entry.events.map((evt) => {
                        const isExtraTime = evt.messageEn.toLowerCase().includes('additional minutes');
                        return (
                          <li
                            key={evt.id}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span
                              className={
                                isExtraTime
                                  ? 'text-amber-800 font-medium'
                                  : 'text-[#081C15]/75'
                              }
                            >
                              {lang === 'ar' ? evt.messageAr : evt.messageEn}
                            </span>
                            <span className="font-mono text-[11px] text-[#081C15]/50 tabular-nums shrink-0">
                              {formatClockTime(evt.timestamp)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Live Concierge Updates (active waiting & calling guests only) */}
      {activeTab !== 'completed' && (
      <section className="bg-white border border-[#1B4332]/15 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-[#081C15]">
            {t.ticketTimelineTitle}
          </h2>
          <span className="text-xs font-medium text-[#2D6A4F] bg-[#F2F5F0] px-2.5 py-1 rounded-lg tabular-nums">
            {conciergeUpdates.length}
          </span>
        </div>

        {conciergeUpdates.length === 0 ? (
          <p className="text-sm text-[#081C15]/55 py-2">
            {lang === 'ar'
              ? 'لا توجد تحديثات مباشرة بعد.'
              : 'No live updates yet. Guest joins, +5 min requests, calls, and seatings will appear here.'}
          </p>
        ) : (
          <ul className="divide-y divide-[#1B4332]/10">
            {conciergeUpdates.map((item) => {
              const isExtraTime = item.messageEn.toLowerCase().includes('additional minutes');
              return (
                <li
                  key={`${item.entryId}-${item.id}`}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
                      <span className="font-semibold text-[#081C15]">{item.guestName}</span>
                      <span className="font-mono text-xs font-semibold text-[#1B4332]">
                        {item.ticketCode}
                      </span>
                      {item.phone && (
                        <span
                          dir="ltr"
                          className="inline-flex items-center gap-1 text-xs text-[#081C15]/70 font-medium tabular-nums"
                        >
                          <Phone className="w-3 h-3 text-[#C5A059]" aria-hidden="true" />
                          {item.phone}
                        </span>
                      )}
                      {selectedBranch === 'all' && (
                        <span className="text-xs text-[#2D6A4F] font-medium">
                          · {branchName(item.branchId)}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs sm:text-sm ${
                        isExtraTime ? 'text-amber-800 font-medium' : 'text-[#081C15]/75'
                      }`}
                    >
                      {lang === 'ar' ? item.messageAr : item.messageEn}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#081C15]/50 tabular-nums shrink-0">
                    {formatClockTime(item.timestamp)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {/* Quick Walk-in Modal */}
      {walkinOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#081C15]/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWalkinOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkin-modal-title"
            className="bg-white border border-[#1B4332]/20 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#1B4332]/10">
              <div>
                <h2
                  id="walkin-modal-title"
                  className="font-display text-2xl font-semibold text-[#081C15]"
                >
                  {t.walkinModalTitle}
                </h2>
                <p className="text-xs text-[#081C15]/65 mt-0.5">{t.walkinModalSub}</p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setWalkinOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#081C15]/60 hover:text-[#081C15] hover:bg-[#F2F6F3]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleWalkinSubmit} className="space-y-4">
              {selectedBranch === 'all' && (
                <div className="space-y-1">
                  <label
                    htmlFor="walkin-branch"
                    className="block text-xs font-medium text-[#081C15]"
                  >
                    {t.selectBranchHeading}
                  </label>
                  <select
                    id="walkin-branch"
                    value={walkinBranch}
                    onChange={(e) => setWalkinBranch(e.target.value as BranchId)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-sm text-[#081C15]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {lang === 'ar' ? b.nameAr : b.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="walkin-name"
                  className="block text-xs font-medium text-[#081C15]"
                >
                  {t.fullNameLabel}
                </label>
                <input
                  id="walkin-name"
                  type="text"
                  autoFocus
                  value={walkinName}
                  onChange={(e) => {
                    setWalkinName(e.target.value);
                    if (walkinErr) setWalkinErr('');
                  }}
                  placeholder={t.fullNamePlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-sm text-[#081C15]"
                />
                {walkinErr && <p className="text-xs text-red-700 font-medium">{walkinErr}</p>}
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#081C15]">
                  {t.partySizeLabel}
                </span>
                <div className="flex items-center justify-between p-1.5 rounded-xl bg-[#F7F9F6] border border-[#1B4332]/15">
                  <button
                    type="button"
                    aria-label="Decrease walk-in party size"
                    onClick={() => setWalkinParty((p) => Math.max(1, p - 1))}
                    className="w-10 h-10 rounded-lg bg-white border border-[#1B4332]/15 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="font-semibold text-sm tabular-nums">
                    {t.guestsLabel(walkinParty)}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase walk-in party size"
                    onClick={() => setWalkinParty((p) => Math.min(10, p + 1))}
                    className="w-10 h-10 rounded-lg bg-white border border-[#1B4332]/15 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#081C15]">
                  {t.seatingAreaLabel}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SEATING_AREAS.map((area) => {
                    const active = walkinArea === area.id;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setWalkinArea(area.id)}
                        className={`p-2 rounded-xl border text-xs font-medium text-center transition-colors ${
                          active
                            ? 'bg-[#1B4332] text-white border-[#1B4332]'
                            : 'bg-[#FBFBFB] text-[#081C15] border-[#1B4332]/15'
                        }`}
                      >
                        {lang === 'ar' ? area.labelAr : area.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="walkin-phone"
                  className="block text-xs font-medium text-[#081C15]"
                >
                  {t.walkinPhoneOptional}
                </label>
                <input
                  id="walkin-phone"
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="+966 55 123 4567"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-sm text-[#081C15]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWalkinOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#1B4332]/20 text-sm font-medium text-[#081C15]"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-sm font-semibold"
                >
                  {t.walkinSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Branch Walk-in QR Code Modal */}
      {qrOpen && (
        <BranchQrModal
          lang={lang}
          branches={branches}
          initialBranchId={selectedBranch === 'all' ? 'roshn' : selectedBranch}
          allowBranchSwitch={staffUser?.role === 'admin' || selectedBranch === 'all'}
          onClose={() => setQrOpen(false)}
        />
      )}

      {/* Guest Visit History Modal */}
      {historyGuest && (
        <GuestHistoryModal
          lang={lang}
          guest={historyGuest}
          branches={branches}
          allEntries={entries}
          onClose={() => setHistoryGuest(null)}
        />
      )}
    </div>
  );
}