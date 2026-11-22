import { useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock,
  Leaf,
  MapPin,
  Sparkles,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AMMARIAYH_IMAGE_URL,
  COPY,
  SEATING_AREAS,
  SPECIAL_REQUEST_OPTIONS,
  type Language,
} from '../data/whiteGardenData';
import {
  estimateWaitMinutes,
  formatDurationCompact,
  getQueuePosition,
  type BranchInfo,
  type TicketAction,
  type WaitlistEntry,
} from '../utils/waitlistLogic';

interface TicketTrackerViewProps {
  lang: Language;
  branches: BranchInfo[];
  entries: WaitlistEntry[];
  activeTicketId: string;
  onSelectTicket: (ticketId: string) => void;
  onTicketAction: (ticketId: string, action: TicketAction) => void;
  onJoinAnother: () => void;
}

export function TicketTrackerView({
  lang,
  branches,
  entries,
  activeTicketId,
  onSelectTicket,
  onTicketAction,
  onJoinAnother,
}: TicketTrackerViewProps) {
  const t = COPY[lang];
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setConfirmCancel(false);
  }, [activeTicketId]);

  const ticket =
    entries.find((e) => e.id === activeTicketId) ??
    entries.find((e) => e.status === 'waiting' || e.status === 'called') ??
    entries[0];

  if (!ticket) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Leaf className="w-10 h-10 text-[#1B4332] mx-auto" aria-hidden="true" />
        <h2 className="font-display text-3xl text-[#081C15]">{t.emptyQueueTitle}</h2>
        <button
          type="button"
          onClick={onJoinAnother}
          className="px-6 py-3 rounded-xl bg-[#1B4332] text-white text-sm font-semibold"
        >
          {t.btnRejoinWaitlist}
        </button>
      </div>
    );
  }

  const branch = branches.find((b) => b.id === ticket.branchId) ?? branches[1];
  const position = getQueuePosition(entries, ticket.id);
  const waitingTotal = entries.filter(
    (e) => e.branchId === branch.id && e.status === 'waiting',
  ).length;

  const baseEstMinutes = estimateWaitMinutes(
    position,
    ticket.partySize,
    branch.avgTurnoverMinutes,
    ticket.extraGraceMinutes ?? 0,
  );
  const elapsedSinceJoinMins = Math.floor(Math.max(0, nowMs - ticket.createdAt) / 60000);
  const remainingMinutes =
    ticket.status === 'waiting'
      ? Math.max(2, baseEstMinutes - Math.min(elapsedSinceJoinMins, Math.max(0, baseEstMinutes - 2)))
      : 0;

  const holdRemainingMs =
    ticket.status === 'called' && ticket.holdExpiresAt
      ? Math.max(0, ticket.holdExpiresAt - nowMs)
      : 0;

  // Ring progress calculation (SVG circumference = 2 * PI * r = 2 * PI * 64 ≈ 402.12)
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0.25;
  if (ticket.status === 'seated' || ticket.status === 'called') {
    progressRatio = 1;
  } else if (ticket.status === 'cancelled' || ticket.status === 'no_show') {
    progressRatio = 0;
  } else if (position > 0) {
    const denom = Math.max(waitingTotal + 1, position + 1);
    progressRatio = Math.min(0.92, Math.max(0.2, (denom - position + 1) / denom));
  }
  const strokeOffset = circumference * (1 - progressRatio);

  const areaObj = SEATING_AREAS.find((a) => a.id === ticket.seatingArea);
  const areaLabel = areaObj ? (lang === 'ar' ? areaObj.labelAr : areaObj.labelEn) : '';

  const requestLabels = ticket.specialRequests
    .map((id) => SPECIAL_REQUEST_OPTIONS.find((opt) => opt.id === id))
    .filter(Boolean)
    .map((opt) => (lang === 'ar' ? opt!.labelAr : opt!.labelEn));

  const statusConfigMap = {
    waiting: {
      icon: Clock,
      label: t.statusWaiting,
      boxClass: 'bg-[#F2F6F3] border-[#1B4332]/20 text-[#1B4332]',
    },
    called: {
      icon: BellRing,
      label: t.statusCalled,
      boxClass: 'bg-[#D8F3DC] border-[#1B4332] text-[#081C15]',
    },
    seated: {
      icon: CheckCircle2,
      label: t.statusSeated,
      boxClass: 'bg-[#1B4332] border-[#1B4332] text-white',
    },
    cancelled: {
      icon: XCircle,
      label: t.statusCancelled,
      boxClass: 'bg-neutral-100 border-neutral-300 text-neutral-700',
    },
    no_show: {
      icon: XCircle,
      label: t.statusNoShow,
      boxClass: 'bg-amber-50 border-amber-300 text-amber-900',
    },
  };
  const statusConfig = statusConfigMap[ticket.status] ?? statusConfigMap.waiting;

  const StatusIcon = statusConfig.icon;
  const branchPhoto = branch.imageUrl || AMMARIAYH_IMAGE_URL;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Top Pass Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1B4332]/10">
        <div>
          <p className="text-xs text-[#2D6A4F] font-medium">{t.ticketSwitchLabel}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#081C15]">
            {ticket.ticketCode}
          </h1>
        </div>

        <div className="relative">
          <label htmlFor="ticket-switcher" className="sr-only">
            {t.ticketSwitchLabel}
          </label>
          <select
            id="ticket-switcher"
            value={ticket.id}
            onChange={(e) => onSelectTicket(e.target.value)}
            className="appearance-none bg-white border border-[#1B4332]/15 rounded-xl ps-3.5 pe-9 py-2 text-xs sm:text-sm font-medium text-[#081C15] min-h-[40px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          >
            {entries.slice(0, 15).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.ticketCode} · {entry.guestName}
              </option>
            ))}
          </select>
          <ChevronDown
            className="w-4 h-4 text-[#1B4332]/70 pointer-events-none absolute top-1/2 -translate-y-1/2 end-3"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Balanced 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Mobile-First Digital Ticket Pass */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-[#1B4332]/15 rounded-3xl overflow-hidden shadow-sm">
            {/* Pass Header Band */}
            <div className="bg-[#081C15] text-white px-6 py-5 border-b border-[#C5A059]/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs text-[#95D5B2] font-medium">
                  {lang === 'ar' ? branch.districtAr : branch.districtEn}
                </p>
                <p className="font-display text-2xl font-semibold truncate">
                  {lang === 'ar' ? branch.nameAr : branch.nameEn}
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-[11px] text-white/65">{t.brandName}</p>
                <p className="font-mono text-sm sm:text-base font-semibold text-[#C5A059] tabular-nums">
                  {ticket.ticketCode}
                </p>
              </div>
            </div>

            {/* Pass Body */}
            <div className="p-6 sm:p-7 space-y-6">
              {/* Live Status State Banner */}
              <div
                role="status"
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm font-medium ${statusConfig.boxClass}`}
              >
                <StatusIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{statusConfig.label}</span>
              </div>

              {/* Animated Visual Queue Ring */}
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg
                    viewBox="0 0 160 160"
                    className="w-44 h-44 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke="#E9EFEA"
                      strokeWidth="9"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke={ticket.status === 'called' ? '#C5A059' : '#1B4332'}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
                    {ticket.status === 'waiting' && (
                      <>
                        <span className="font-display text-5xl font-semibold text-[#081C15] tabular-nums leading-none">
                          #{position}
                        </span>
                        <span className="text-xs text-[#2D6A4F] font-semibold tabular-nums mt-1.5">
                          ~{remainingMinutes} {t.minsUnit}
                        </span>
                      </>
                    )}
                    {ticket.status === 'called' && (
                      <>
                        <span className="font-mono text-2xl font-bold text-[#1B4332] tabular-nums">
                          {formatDurationCompact(holdRemainingMs, lang)}
                        </span>
                        <span className="text-[11px] text-[#081C15]/70 mt-1 leading-tight">
                          {t.ticketHoldRemaining}
                        </span>
                      </>
                    )}
                    {ticket.status === 'seated' && (
                      <>
                        <span className="font-display text-3xl font-semibold text-[#1B4332]">
                          {ticket.tableNumber || 'G-12'}
                        </span>
                        <span className="text-xs text-[#081C15]/70 mt-0.5">
                          {t.seatedAtTable}
                        </span>
                      </>
                    )}
                    {(ticket.status === 'cancelled' || ticket.status === 'no_show') && (
                      <XCircle className="w-10 h-10 text-neutral-400" aria-hidden="true" />
                    )}
                  </div>
                </div>

                {ticket.status === 'waiting' && (
                  <div className="mt-3 space-y-0.5">
                    <p className="font-display text-2xl font-semibold text-[#081C15]">
                      {t.ticketPositionTitle(position)}
                    </p>
                    <p className="text-sm text-[#2D6A4F] font-medium tabular-nums">
                      {t.ticketEstimated(remainingMinutes)}
                    </p>
                  </div>
                )}

                {(ticket.extraGraceMinutes || ticket.hostessNotifiedAt) && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#2D6A4F] font-medium">
                    {ticket.extraGraceMinutes ? (
                      <span>{t.ticketExtendedBadge}</span>
                    ) : null}
                    {ticket.extraGraceMinutes && ticket.hostessNotifiedAt ? (
                      <span aria-hidden="true" className="text-[#C5A059]">
                        ·
                      </span>
                    ) : null}
                    {ticket.hostessNotifiedAt ? <span>{t.ticketHostessAlerted}</span> : null}
                  </div>
                )}
              </div>

              {/* Guest Details Metadata Grid */}
              <div className="pt-5 border-t border-dashed border-[#1B4332]/20 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#081C15]/60">{t.fullNameLabel}</span>
                  <span className="font-semibold text-[#081C15]">{ticket.guestName}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#081C15]/60">{t.partySizeLabel}</span>
                  <span className="font-semibold text-[#081C15] tabular-nums inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                    {t.guestsLabel(ticket.partySize)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#081C15]/60">{t.seatingAreaLabel}</span>
                  <span className="font-medium text-[#081C15] text-end">{areaLabel}</span>
                </div>
                {requestLabels.length > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[#081C15]/60">{t.specialRequestsLabel}</span>
                    <span className="font-medium text-[#1B4332] inline-flex items-center gap-1 text-end">
                      <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                      {requestLabels.join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              {(ticket.status === 'waiting' || ticket.status === 'called') && (
                <div className="pt-4 border-t border-[#1B4332]/10 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => onTicketAction(ticket.id, 'extend_5m')}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F7F9F6] hover:bg-[#D8F3DC]/50 border border-[#1B4332]/20 text-[#1B4332] text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  >
                    <Timer className="w-4 h-4 text-[#C5A059] shrink-0" aria-hidden="true" />
                    <span>{t.btnNeed5Min}</span>
                  </button>

                  {!confirmCancel ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="w-full min-h-[42px] px-4 py-2 rounded-xl text-sm font-medium text-[#081C15]/65 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      {t.btnCancelQueue}
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onTicketAction(ticket.id, 'cancel');
                          setConfirmCancel(false);
                        }}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm font-semibold transition-colors"
                      >
                        {t.btnConfirmCancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-white border border-neutral-300 text-[#081C15] text-xs sm:text-sm font-medium transition-colors"
                      >
                        {t.btnKeepPlace}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(ticket.status === 'cancelled' ||
                ticket.status === 'no_show' ||
                ticket.status === 'seated') && (
                <button
                  type="button"
                  onClick={onJoinAnother}
                  className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-sm font-semibold transition-colors"
                >
                  {t.btnRejoinWaitlist}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Branch Context & Live Timeline */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-[#1B4332]/15 rounded-2xl overflow-hidden">
            <div className="relative h-48 bg-[#1B4332]">
              {!imgFailed ? (
                <img
                  src={branchPhoto}
                  alt={lang === 'ar' ? branch.nameAr : branch.nameEn}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1B4332] to-[#081C15] flex items-center justify-center">
                  <Leaf className="w-8 h-8 text-[#C5A059]" aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#081C15]/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 inset-x-5 text-white">
                <p className="font-display text-2xl font-semibold">
                  {lang === 'ar' ? branch.nameAr : branch.nameEn}
                </p>
                <p className="text-xs text-white/85">
                  {lang === 'ar' ? branch.taglineAr : branch.taglineEn}
                </p>
              </div>
            </div>

            <div className="p-5 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-[#081C15]/75">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
                {lang === 'ar' ? branch.districtAr : branch.districtEn}
              </span>
              <span className="tabular-nums">
                {t.ticketBranchHours}: {lang === 'ar' ? branch.hoursAr : branch.hoursEn}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
