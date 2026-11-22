import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Minus,
  Phone,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  COPY,
  SEATING_AREAS,
  SPECIAL_REQUEST_OPTIONS,
  type Language,
} from '../data/whiteGardenData';
import {
  formatMinutesOfDay,
  getBranchLiveSummary,
  getBranchReservationSlots,
  toLocalYmd,
  validateSaudiPhone,
  type BranchId,
  type BranchInfo,
  type MealPeriod,
  type SeatingAreaId,
  type SpecialRequestId,
  type WaitlistEntry,
} from '../utils/waitlistLogic';

interface WaitlistJoinViewProps {
  lang: Language;
  branches: BranchInfo[];
  selectedBranchId: BranchId;
  onSelectBranch: (id: BranchId) => void;
  entries: WaitlistEntry[];
  onJoinWaitlist: (input: {
    branchId: BranchId;
    guestName: string;
    phone: string;
    partySize: number;
    seatingArea: SeatingAreaId;
    specialRequests: SpecialRequestId[];
    notes: string;
    reservationTime?: string;
  }) => void;
  onOpenMap?: () => void;
}

export function WaitlistJoinView({
  lang,
  branches,
  selectedBranchId,
  onSelectBranch,
  entries,
  onJoinWaitlist,
  onOpenMap,
}: WaitlistJoinViewProps) {
  const t = COPY[lang];
  const [guestName, setGuestName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [timeMode, setTimeMode] = useState<'now' | 'scheduled'>('now');
  const [reservationDate, setReservationDate] = useState<string>(() => toLocalYmd(new Date()));
  const [activePeriod, setActivePeriod] = useState<MealPeriod>('evening');
  const [reservationSlot, setReservationSlot] = useState<string>('');
  const [timeError, setTimeError] = useState<string | undefined>(undefined);
  const [seatingArea, setSeatingArea] = useState<SeatingAreaId>('terrace');
  const [specialRequests, setSpecialRequests] = useState<SpecialRequestId[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'branch' | 'form'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const b = (params.get('branch') || '').trim().toLowerCase();
      if (['olaya', 'roshn', 'sixty', 'theview', 'ammariayh'].includes(b)) {
        return 'form';
      }
    }
    return 'branch';
  });
  const [branchImgFailed, setBranchImgFailed] = useState<Record<string, boolean>>({});

  const activeBranch = branches.find((b) => b.id === selectedBranchId) ?? branches[1];
  const activeSummary = getBranchLiveSummary(entries, activeBranch);

  const upcomingDays = useMemo(() => {
    const enWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const arWeekdays = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const now = new Date();
    return Array.from({ length: 7 }, (_, offset) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const ymd = toLocalYmd(d);
      const { slots } = getBranchReservationSlots(activeBranch, ymd, now);
      return {
        ymd,
        dayNum: d.getDate(),
        dayLabelEn: offset === 0 ? 'Today' : enWeekdays[d.getDay()],
        dayLabelAr: offset === 0 ? 'اليوم' : arWeekdays[d.getDay()],
        monthEn: enMonths[d.getMonth()],
        monthAr: arMonths[d.getMonth()],
        hasSlots: slots.length > 0,
      };
    });
  }, [activeBranch]);

  const daySchedule = useMemo(
    () => getBranchReservationSlots(activeBranch, reservationDate),
    [activeBranch, reservationDate],
  );

  const availablePeriods = useMemo(() => {
    const order: MealPeriod[] = ['morning', 'afternoon', 'evening'];
    return order.filter((p) => daySchedule.slots.some((s) => s.period === p));
  }, [daySchedule.slots]);

  const visibleSlots = useMemo(
    () => daySchedule.slots.filter((s) => s.period === activePeriod),
    [daySchedule.slots, activePeriod],
  );

  // Auto-advance from Today to Tomorrow if Today has no slots remaining when opening Select Time
  useEffect(() => {
    if (
      timeMode === 'scheduled' &&
      reservationDate === upcomingDays[0]?.ymd &&
      !upcomingDays[0]?.hasSlots &&
      upcomingDays[1]?.hasSlots
    ) {
      setReservationDate(upcomingDays[1].ymd);
    }
  }, [timeMode, reservationDate, upcomingDays]);

  // Keep activePeriod and reservationSlot valid whenever branch or date changes
  useEffect(() => {
    if (daySchedule.slots.length === 0) {
      setReservationSlot('');
      return;
    }
    const existing = daySchedule.slots.find((s) => s.value === reservationSlot);
    if (existing) {
      if (existing.period !== activePeriod) {
        setActivePeriod(existing.period);
      }
      setTimeError(undefined);
      return;
    }
    const nextPeriod = availablePeriods.includes(activePeriod)
      ? activePeriod
      : availablePeriods[0];
    if (nextPeriod && nextPeriod !== activePeriod) {
      setActivePeriod(nextPeriod);
    }
    const firstInPeriod =
      daySchedule.slots.find((s) => s.period === nextPeriod) ?? daySchedule.slots[0];
    if (firstInPeriod) {
      setReservationSlot(firstInPeriod.value);
      setTimeError(undefined);
    }
  }, [daySchedule.slots, availablePeriods, activePeriod, reservationSlot]);

  const toggleSpecialRequest = (id: SpecialRequestId) => {
    setSpecialRequests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!activeBranch.isOpen || isSubmitting) return;

    const nextErrors: { name?: string; phone?: string } = {};
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      nextErrors.name = t.errNameRequired;
    }

    const phoneResult = validateSaudiPhone(phoneInput);
    if (!phoneResult.valid) {
      nextErrors.phone =
        phoneResult.errorKey === 'empty' ? t.errPhoneEmpty : t.errPhoneInvalid;
    }

    if (timeMode === 'scheduled' && !reservationSlot) {
      setTimeError(
        lang === 'ar'
          ? 'يرجى اختيار وقت حجز متاح.'
          : 'Please select an available reservation time.',
      );
      if (nextErrors.name || nextErrors.phone) {
        setErrors(nextErrors);
      }
      return;
    }
    setTimeError(undefined);

    if (nextErrors.name || nextErrors.phone) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    window.setTimeout(() => {
      onJoinWaitlist({
        branchId: activeBranch.id,
        guestName: trimmedName,
        phone: phoneResult.display,
        partySize,
        seatingArea,
        specialRequests,
        notes: notes.trim(),
        reservationTime: timeMode === 'scheduled' ? `${reservationDate} ${reservationSlot}` : undefined,
      });
      setIsSubmitting(false);
    }, 420);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 sm:py-6">
      {/* Step 1: Select Destination & Confirm */}
      {step === 'branch' && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#081C15]">
                {t.selectBranchHeading}
              </h1>
              {t.selectBranchSub && <p className="text-sm text-[#081C15]/65">{t.selectBranchSub}</p>}
            </div>
            {onOpenMap && (
              <button
                type="button"
                onClick={onOpenMap}
                className="text-xs sm:text-sm font-semibold text-[#1B4332] hover:text-[#081C15] underline decoration-[#C5A059] underline-offset-4 whitespace-nowrap shrink-0 pb-1 cursor-pointer"
              >
                {t.mapViewDetails}
              </button>
            )}
          </div>

          <div className="space-y-1" role="radiogroup" aria-label={t.selectBranchHeading}>
            {branches.map((branch) => {
              const summary = getBranchLiveSummary(entries, branch);
              const isSelected = branch.id === activeBranch.id;
              const showThumb = branch.imageUrl && !branchImgFailed[branch.id];

              return (
                <button
                  key={branch.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectBranch(branch.id)}
                  className={`w-full text-start p-2.5 sm:p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                    isSelected
                      ? 'bg-white border-[#1B4332] shadow-sm'
                      : 'bg-white/75 border-[#1B4332]/12 hover:bg-white hover:border-[#1B4332]/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {showThumb ? (
                      <img
                        src={branch.imageUrl}
                        alt={lang === 'ar' ? branch.nameAr : branch.nameEn}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBranchImgFailed((prev) => ({ ...prev, [branch.id]: true }))
                        }
                        className="w-11 h-11 rounded-lg object-cover shrink-0 border border-[#1B4332]/10"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-lg shrink-0 flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[#1B4332] text-[#D8F3DC] border-[#1B4332]'
                            : 'bg-[#F2F6F3] text-[#2D6A4F] border-[#1B4332]/10'
                        }`}
                      >
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base sm:text-lg font-semibold text-[#081C15] truncate leading-tight">
                          {lang === 'ar' ? branch.nameAr : branch.nameEn}
                        </span>
                        {isSelected && (
                          <CheckCircle2
                            className="w-4 h-4 text-[#1B4332] shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <p className="text-[11px] sm:text-xs text-[#081C15]/65 truncate">
                        {lang === 'ar' ? branch.districtAr : branch.districtEn}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums">
                        {branch.isOpen ? (
                          <>
                            <span className="font-semibold text-[#1B4332]">
                              {t.waitMins(summary.nextWaitMinutes)}
                            </span>
                            <span aria-hidden="true" className="text-[#C5A059]">
                              ·
                            </span>
                            <span className="text-[#081C15]/70">
                              {t.partiesAhead(summary.waitingCount)}
                            </span>
                            <span aria-hidden="true" className="text-[#C5A059]">
                              ·
                            </span>
                            <span className="text-[#2D6A4F] font-medium">{t.openStatus}</span>
                          </>
                        ) : (
                          <span className="text-amber-800 font-medium">{t.closedStatus}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {!activeBranch.isOpen && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm"
            >
              {t.waitlistClosedNotice}
            </div>
          )}

          <button
            type="button"
            disabled={!activeBranch.isOpen}
            onClick={() => {
              setStep('form');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full min-h-[42px] px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#081C15] disabled:bg-neutral-300 disabled:text-neutral-600 text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          >
            <span>
              {lang === 'ar'
                ? `تأكيد فرع ${activeBranch.nameAr} والمتابعة`
                : `Confirm ${activeBranch.nameEn} & Continue`}
            </span>
            {lang === 'ar' ? (
              <ArrowLeft className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            ) : (
              <ArrowRight className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            )}
          </button>
        </section>
      )}

      {/* Step 2: Guest Waitlist Form (shown after confirming location) */}
      {step === 'form' && (
        <section className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              setStep('branch');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#1B4332] hover:text-[#081C15] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] rounded-md px-1 py-0.5"
          >
            {lang === 'ar' ? (
              <ArrowRight className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            ) : (
              <ArrowLeft className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            )}
            <span>{lang === 'ar' ? 'تغيير الفرع' : 'Change Branch'}</span>
          </button>

          <div className="bg-white/90 backdrop-blur-md border border-[#1B4332]/15 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="pb-3 mb-4 border-b border-[#1B4332]/10 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#081C15]">
                  {t.joinFormHeading}
                </h2>
                {t.joinFormSub && <p className="text-sm text-[#081C15]/65">{t.joinFormSub}</p>}
              </div>
              <div className="text-end shrink-0">
                <p className="text-xs text-[#081C15]/60">
                  {lang === 'ar' ? activeBranch.nameAr : activeBranch.nameEn}
                </p>
                <p className="text-sm font-semibold text-[#1B4332] tabular-nums">
                  {activeBranch.isOpen
                    ? t.waitMins(activeSummary.nextWaitMinutes)
                    : t.closedStatus}
                </p>
              </div>
            </div>

            {!activeBranch.isOpen && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm"
              >
                {t.waitlistClosedNotice}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label
                  htmlFor="guest-full-name"
                  className="block text-xs font-medium text-[#081C15]"
                >
                  {t.fullNameLabel}
                </label>
                <input
                  id="guest-full-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder={t.fullNamePlaceholder}
                  aria-invalid={Boolean(errors.name)}
                  className={`w-full px-3 py-2 rounded-lg bg-[#FBFBFB] border text-xs text-[#081C15] placeholder:text-[#081C15]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                    errors.name ? 'border-red-600' : 'border-[#1B4332]/20 hover:border-[#1B4332]/40'
                  }`}
                />
                {errors.name && (
                  <p role="alert" className="text-xs text-red-700 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Saudi Mobile Number */}
              <div className="space-y-1">
                <label
                  htmlFor="guest-phone"
                  className="block text-xs font-medium text-[#081C15]"
                >
                  {t.phoneLabel}
                </label>
                <div className="flex items-stretch" dir="ltr">
                  <span className="inline-flex items-center gap-1 px-2.5 rounded-s-lg bg-[#F2F6F3] border border-e-0 border-[#1B4332]/20 text-xs font-semibold text-[#1B4332] tabular-nums select-none">
                    <Phone className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                    +966
                  </span>
                  <input
                    id="guest-phone"
                    type="tel"
                    inputMode="tel"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder={t.phonePlaceholder}
                    aria-invalid={Boolean(errors.phone)}
                    className={`w-full px-3 py-2 rounded-e-lg bg-[#FBFBFB] border text-xs text-[#081C15] tabular-nums placeholder:text-[#081C15]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                      errors.phone
                        ? 'border-red-600'
                        : 'border-[#1B4332]/20 hover:border-[#1B4332]/40'
                    }`}
                  />
                </div>
                {errors.phone ? (
                  <p role="alert" className="text-xs text-red-700 font-medium">
                    {errors.phone}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#081C15]/55">{t.phoneHint}</p>
                )}
              </div>

              {/* Party Size Stepper */}
              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#081C15]">
                  {t.partySizeLabel}
                </span>
                <div className="flex items-center justify-between p-1 rounded-lg bg-[#F7F9F6] border border-[#1B4332]/15">
                  <button
                    type="button"
                    aria-label="Decrease party size"
                    onClick={() => setPartySize((prev) => Math.max(1, prev - 1))}
                    disabled={partySize <= 1}
                    className="w-8 h-8 rounded-md bg-white border border-[#1B4332]/15 flex items-center justify-center text-[#1B4332] hover:bg-[#D8F3DC]/40 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>

                  <div className="flex items-center gap-2.5 text-[#081C15] font-semibold tabular-nums">
                    <Users className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                    <span className="text-xs sm:text-sm">{t.guestsLabel(partySize)}</span>
                  </div>

                  <button
                    type="button"
                    aria-label="Increase party size"
                    onClick={() => setPartySize((prev) => Math.min(10, prev + 1))}
                    disabled={partySize >= 10}
                    className="w-8 h-8 rounded-md bg-white border border-[#1B4332]/15 flex items-center justify-center text-[#1B4332] hover:bg-[#D8F3DC]/40 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Reservation Time Selector — Option 1: Date Strip & Time Pills */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-[#081C15]">
                  {lang === 'ar' ? 'وقت الحجز' : 'Reservation Time'}
                </span>
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-full bg-[#FBFBFB] border border-[#1B4332]/15">
                  <button
                    type="button"
                    aria-pressed={timeMode === 'now'}
                    onClick={() => {
                      setTimeMode('now');
                      setTimeError(undefined);
                    }}
                    className={`px-2.5 py-1.5 rounded-full text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                      timeMode === 'now'
                        ? 'bg-[#1B4332] text-white shadow-xs'
                        : 'text-[#081C15] hover:bg-[#F2F6F3]'
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      {lang === 'ar' ? 'الآن (دخول فوري)' : 'Now (Join Queue)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={timeMode === 'scheduled'}
                    onClick={() => setTimeMode('scheduled')}
                    className={`px-2.5 py-1.5 rounded-full text-center transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                      timeMode === 'scheduled'
                        ? 'bg-[#1B4332] text-white shadow-xs'
                        : 'text-[#081C15] hover:bg-[#F2F6F3]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                    <span className="text-xs font-semibold">
                      {lang === 'ar' ? 'تحديد الوقت' : 'Select Time'}
                    </span>
                  </button>
                </div>

                {timeMode === 'scheduled' && (
                  <div className="p-2.5 rounded-2xl bg-[#F7F9F6] border border-[#1B4332]/12 space-y-2.5">
                    {/* 7-Day Horizontal Date Strip */}
                    <div
                      className="flex gap-1 overflow-x-auto pb-0.5"
                      role="radiogroup"
                      aria-label={lang === 'ar' ? 'تاريخ الحجز' : 'Reservation Date'}
                    >
                      {upcomingDays.map((day) => {
                        const selected = day.ymd === reservationDate;
                        return (
                          <button
                            key={day.ymd}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={!day.hasSlots}
                            onClick={() => {
                              setReservationDate(day.ymd);
                              setTimeError(undefined);
                            }}
                            className={`flex-1 min-w-[46px] py-1.5 px-1 rounded-xl border text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                              selected
                                ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs cursor-pointer'
                                : day.hasSlots
                                  ? 'bg-white text-[#081C15] border-[#1B4332]/12 hover:border-[#1B4332]/35 cursor-pointer'
                                  : 'bg-white/60 text-[#081C15]/35 border-[#1B4332]/10 cursor-not-allowed'
                            }`}
                          >
                            <span
                              className={`block text-[9px] font-semibold uppercase tracking-wide leading-tight ${
                                selected
                                  ? 'text-[#C5A059]'
                                  : day.hasSlots
                                    ? 'text-[#081C15]/55'
                                    : 'text-[#081C15]/30'
                              }`}
                            >
                              {lang === 'ar' ? day.dayLabelAr : day.dayLabelEn}
                            </span>
                            <span className="block text-sm font-bold leading-snug tabular-nums">
                              {day.dayNum}
                            </span>
                            <span
                              className={`block text-[9px] leading-tight ${
                                selected
                                  ? 'text-white/75'
                                  : day.hasSlots
                                    ? 'text-[#081C15]/45'
                                    : 'text-[#081C15]/25'
                              }`}
                            >
                              {lang === 'ar' ? day.monthAr : day.monthEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Meal-Period Segmented Pill Bar */}
                    {availablePeriods.length > 0 ? (
                      <>
                        <div
                          className="flex items-center gap-0.5 p-0.5 rounded-full bg-white border border-[#1B4332]/12"
                          role="tablist"
                          aria-label={lang === 'ar' ? 'الفترة' : 'Time of Day'}
                        >
                          {availablePeriods.map((period) => {
                            const isActive = period === activePeriod;
                            const label =
                              period === 'morning'
                                ? lang === 'ar'
                                  ? 'الصباح'
                                  : 'Morning'
                                : period === 'afternoon'
                                  ? lang === 'ar'
                                    ? 'الظهيرة'
                                    : 'Afternoon'
                                  : lang === 'ar'
                                    ? 'المساء'
                                    : 'Evening';
                            return (
                              <button
                                key={period}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => {
                                  setActivePeriod(period);
                                  const firstSlot = daySchedule.slots.find(
                                    (s) => s.period === period,
                                  );
                                  if (firstSlot) {
                                    setReservationSlot(firstSlot.value);
                                    setTimeError(undefined);
                                  }
                                }}
                                className={`flex-1 py-1 px-2 rounded-full text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                                  isActive
                                    ? 'bg-[#D8F3DC] text-[#1B4332] font-semibold'
                                    : 'text-[#081C15]/60 hover:text-[#081C15] font-medium'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Time Slot Pill Grid */}
                        <div
                          className="grid grid-cols-3 sm:grid-cols-4 gap-1.5"
                          role="radiogroup"
                          aria-label={lang === 'ar' ? 'وقت الحجز' : 'Reservation Time Slot'}
                        >
                          {visibleSlots.map((slot) => {
                            const isSelected = slot.value === reservationSlot;
                            return (
                              <button
                                key={slot.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => {
                                  setReservationSlot(slot.value);
                                  setTimeError(undefined);
                                }}
                                className={`py-1.5 px-1 rounded-full border text-[11px] font-semibold tabular-nums whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                                  isSelected
                                    ? 'bg-[#1B4332] text-white border-[#C5A059] ring-1 ring-[#C5A059]/60 shadow-xs'
                                    : 'bg-white text-[#081C15] border-[#1B4332]/15 hover:border-[#1B4332]/40 hover:bg-[#F2F6F3]/60'
                                }`}
                              >
                                {lang === 'ar' ? slot.labelAr : slot.labelEn}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-center text-[#081C15]/65 py-2">
                        {lang === 'ar'
                          ? 'انتهت أوقات الحجز المتاحة لليوم — يرجى اختيار يوم آخر.'
                          : 'No reservation slots remaining for today — please choose another day.'}
                      </p>
                    )}

                    {/* Branch Daily Hours & Last Reservation Cutoff */}
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pt-1.5 border-t border-[#1B4332]/10 text-[10px] text-[#081C15]/60 tabular-nums">
                      <span>
                        {lang === 'ar'
                          ? `أوقات العمل: ${formatMinutesOfDay(daySchedule.openMin, 'ar')} – ${formatMinutesOfDay(daySchedule.closeMin, 'ar')}`
                          : `Hours: ${formatMinutesOfDay(daySchedule.openMin, 'en')} – ${formatMinutesOfDay(daySchedule.closeMin, 'en')}`}
                      </span>
                      <span className="font-medium text-[#1B4332]">
                        {lang === 'ar'
                          ? `آخر حجز: ${formatMinutesOfDay(daySchedule.lastReservationMin, 'ar')}`
                          : `Last reservation: ${formatMinutesOfDay(daySchedule.lastReservationMin, 'en')}`}
                      </span>
                    </div>
                  </div>
                )}

                {timeError && (
                  <p role="alert" className="text-xs text-red-700 font-medium">
                    {timeError}
                  </p>
                )}
              </div>

              {/* Seating Area */}
              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#081C15]">
                  {t.seatingAreaLabel}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SEATING_AREAS.map((area) => {
                    const active = seatingArea === area.id;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSeatingArea(area.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                          active
                            ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                            : 'bg-[#FBFBFB] text-[#081C15] border-[#1B4332]/15 hover:border-[#1B4332]/40'
                        }`}
                      >
                        <p className="text-xs font-semibold leading-snug">
                          {lang === 'ar' ? area.labelAr : area.labelEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Celebrations & Special Requests */}
              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#081C15]">
                  {t.specialRequestsLabel}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIAL_REQUEST_OPTIONS.map((req) => {
                    const selected = specialRequests.includes(req.id);
                    return (
                      <button
                        key={req.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleSpecialRequest(req.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 min-h-[28px] rounded-lg border text-xs font-medium cursor-pointer transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                          selected
                            ? 'bg-[#D8F3DC]/70 border-[#1B4332] text-[#081C15]'
                            : 'bg-[#FBFBFB] border-[#1B4332]/15 text-[#081C15]/80 hover:border-[#1B4332]/35'
                        }`}
                      >
                        <Sparkles
                          className={`w-3.5 h-3.5 ${
                            selected ? 'text-[#1B4332]' : 'text-[#C5A059]'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{lang === 'ar' ? req.labelAr : req.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1">
                <label
                  htmlFor="guest-notes"
                  className="block text-xs font-medium text-[#081C15]"
                >
                  {t.notesLabel}
                </label>
                <input
                  id="guest-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-[#FBFBFB] border border-[#1B4332]/20 text-xs text-[#081C15] placeholder:text-[#081C15]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                />
              </div>

              {/* Primary Submit CTA */}
              <button
                type="submit"
                disabled={!activeBranch.isOpen || isSubmitting}
                className="w-full py-2.5 px-4 min-h-[38px] rounded-lg bg-[#1B4332] hover:bg-[#081C15] disabled:bg-[#1B4332]/40 text-white font-semibold text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2.5 shadow-sm hover:shadow cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>{t.joiningButton}</span>
                  </>
                ) : (
                  <span>{t.joinButton}</span>
                )}
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
