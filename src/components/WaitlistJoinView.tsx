import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
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
  getBranchLiveSummary,
  validateSaudiPhone,
  type BranchId,
  type BranchInfo,
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
  const getTodayYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getDefaultSlot = () => {
    const d = new Date();
    const nextMin = d.getMinutes() < 30 ? 30 : 0;
    const nextHour = d.getMinutes() < 30 ? d.getHours() : (d.getHours() + 1) % 24;
    return `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
  };
  const [timeMode, setTimeMode] = useState<'now' | 'scheduled'>('now');
  const [reservationDate, setReservationDate] = useState<string>(() => getTodayYmd());
  const [reservationSlot, setReservationSlot] = useState<string>(() => getDefaultSlot());

  // 30-minute time slots covering all White Garden branch operating hours (08:00 AM – 01:30 AM)
  const timeSlots: { value: string; labelEn: string; labelAr: string }[] = (() => {
    const slots: { value: string; labelEn: string; labelAr: string }[] = [];
    const hoursOrder = [
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1,
    ];
    for (const h of hoursOrder) {
      for (const m of [0, 30]) {
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const isPm = h >= 12;
        const h12 = h % 12 === 0 ? 12 : h % 12;
        const mStr = String(m).padStart(2, '0');
        slots.push({
          value: val,
          labelEn: `${h12}:${mStr} ${isPm ? 'PM' : 'AM'}`,
          labelAr: `${h12}:${mStr} ${isPm ? 'م' : 'ص'}`,
        });
      }
    }
    return slots;
  })();
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
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Step 1: Select Destination & Confirm */}
      {step === 'branch' && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#081C15]">
                {t.selectBranchHeading}
              </h1>
              <p className="text-sm text-[#081C15]/65">{t.selectBranchSub}</p>
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

          <div className="space-y-3" role="radiogroup" aria-label={t.selectBranchHeading}>
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
                  className={`w-full text-start p-4 sm:p-5 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                    isSelected
                      ? 'bg-white border-[#1B4332] shadow-sm'
                      : 'bg-white/75 border-[#1B4332]/12 hover:bg-white hover:border-[#1B4332]/30'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {showThumb ? (
                      <img
                        src={branch.imageUrl}
                        alt={lang === 'ar' ? branch.nameAr : branch.nameEn}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBranchImgFailed((prev) => ({ ...prev, [branch.id]: true }))
                        }
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#1B4332]/10"
                      />
                    ) : (
                      <div
                        className={`w-16 h-16 rounded-xl shrink-0 flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[#1B4332] text-[#D8F3DC] border-[#1B4332]'
                            : 'bg-[#F2F6F3] text-[#2D6A4F] border-[#1B4332]/10'
                        }`}
                      >
                        <MapPin className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl font-semibold text-[#081C15] truncate">
                          {lang === 'ar' ? branch.nameAr : branch.nameEn}
                        </span>
                        {isSelected && (
                          <CheckCircle2
                            className="w-4 h-4 text-[#1B4332] shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-[#081C15]/65 truncate">
                        {lang === 'ar' ? branch.districtAr : branch.districtEn}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
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
            className="w-full min-h-[50px] px-6 py-3.5 rounded-xl bg-[#1B4332] hover:bg-[#081C15] disabled:bg-neutral-300 disabled:text-neutral-600 text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
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
        <section className="space-y-4">
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

          <div className="bg-white/90 backdrop-blur-md border border-[#1B4332]/15 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="pb-5 mb-6 border-b border-[#1B4332]/10 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#081C15]">
                  {t.joinFormHeading}
                </h2>
                <p className="text-sm text-[#081C15]/65">{t.joinFormSub}</p>
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

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="guest-full-name"
                  className="block text-sm font-medium text-[#081C15]"
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
                  className={`w-full px-4 py-3 rounded-xl bg-[#FBFBFB] border text-sm text-[#081C15] placeholder:text-[#081C15]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
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
              <div className="space-y-1.5">
                <label
                  htmlFor="guest-phone"
                  className="block text-sm font-medium text-[#081C15]"
                >
                  {t.phoneLabel}
                </label>
                <div className="flex items-stretch" dir="ltr">
                  <span className="inline-flex items-center gap-1.5 px-3.5 rounded-s-xl bg-[#F2F6F3] border border-e-0 border-[#1B4332]/20 text-sm font-semibold text-[#1B4332] tabular-nums select-none">
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
                    className={`w-full px-4 py-3 rounded-e-xl bg-[#FBFBFB] border text-sm text-[#081C15] tabular-nums placeholder:text-[#081C15]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
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
                  <p className="text-xs text-[#081C15]/55">{t.phoneHint}</p>
                )}
              </div>

              {/* Party Size Stepper */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-[#081C15]">
                  {t.partySizeLabel}
                </span>
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#F7F9F6] border border-[#1B4332]/15">
                  <button
                    type="button"
                    aria-label="Decrease party size"
                    onClick={() => setPartySize((prev) => Math.max(1, prev - 1))}
                    disabled={partySize <= 1}
                    className="w-11 h-11 rounded-lg bg-white border border-[#1B4332]/15 flex items-center justify-center text-[#1B4332] hover:bg-[#D8F3DC]/40 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <div className="flex items-center gap-2.5 text-[#081C15] font-semibold tabular-nums">
                    <Users className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
                    <span className="text-base">{t.guestsLabel(partySize)}</span>
                  </div>

                  <button
                    type="button"
                    aria-label="Increase party size"
                    onClick={() => setPartySize((prev) => Math.min(10, prev + 1))}
                    disabled={partySize >= 10}
                    className="w-11 h-11 rounded-lg bg-white border border-[#1B4332]/15 flex items-center justify-center text-[#1B4332] hover:bg-[#D8F3DC]/40 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Reservation Time Selector */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-[#081C15]">
                  {lang === 'ar' ? 'وقت الحجز' : 'Reservation Time'}
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    aria-pressed={timeMode === 'now'}
                    onClick={() => setTimeMode('now')}
                    className={`px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                      timeMode === 'now'
                        ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                        : 'bg-[#FBFBFB] text-[#081C15] border-[#1B4332]/15 hover:border-[#1B4332]/40'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold">
                      {lang === 'ar' ? 'الآن (دخول فوري)' : 'Now (Join Queue)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={timeMode === 'scheduled'}
                    onClick={() => setTimeMode('scheduled')}
                    className={`px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                      timeMode === 'scheduled'
                        ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                        : 'bg-[#FBFBFB] text-[#081C15] border-[#1B4332]/15 hover:border-[#1B4332]/40'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-semibold">
                      {lang === 'ar' ? 'تحديد الوقت' : 'Select Time'}
                    </span>
                  </button>
                </div>

                {timeMode === 'scheduled' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="relative">
                      <Calendar
                        className="w-4 h-4 text-[#C5A059] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        type="date"
                        aria-label={lang === 'ar' ? 'تاريخ الحجز' : 'Reservation Date'}
                        min={getTodayYmd()}
                        value={reservationDate}
                        onChange={(e) => setReservationDate(e.target.value)}
                        dir="ltr"
                        className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-xs sm:text-sm text-[#081C15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                      />
                    </div>
                    <div className="relative">
                      <Clock
                        className="w-4 h-4 text-[#C5A059] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                        aria-hidden="true"
                      />
                      <select
                        aria-label={lang === 'ar' ? 'وقت الحجز' : 'Reservation Time Slot'}
                        value={reservationSlot}
                        onChange={(e) => setReservationSlot(e.target.value)}
                        className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-xs sm:text-sm text-[#081C15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] cursor-pointer"
                      >
                        {timeSlots.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {lang === 'ar' ? slot.labelAr : slot.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Seating Area */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-[#081C15]">
                  {t.seatingAreaLabel}
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {SEATING_AREAS.map((area) => {
                    const active = seatingArea === area.id;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSeatingArea(area.id)}
                        className={`px-3.5 py-2.5 rounded-xl border text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                          active
                            ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                            : 'bg-[#FBFBFB] text-[#081C15] border-[#1B4332]/15 hover:border-[#1B4332]/40'
                        }`}
                      >
                        <p className="text-xs sm:text-sm font-semibold leading-snug">
                          {lang === 'ar' ? area.labelAr : area.labelEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Celebrations & Special Requests */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-[#081C15]">
                  {t.specialRequestsLabel}
                </span>
                <div className="flex flex-wrap gap-2">
                  {SPECIAL_REQUEST_OPTIONS.map((req) => {
                    const selected = specialRequests.includes(req.id);
                    return (
                      <button
                        key={req.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleSpecialRequest(req.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
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
              <div className="space-y-1.5">
                <label
                  htmlFor="guest-notes"
                  className="block text-sm font-medium text-[#081C15]"
                >
                  {t.notesLabel}
                </label>
                <input
                  id="guest-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FBFBFB] border border-[#1B4332]/20 text-sm text-[#081C15] placeholder:text-[#081C15]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                />
              </div>

              {/* Primary Submit CTA */}
              <button
                type="submit"
                disabled={!activeBranch.isOpen || isSubmitting}
                className="w-full py-3.5 px-6 min-h-[48px] rounded-xl bg-[#1B4332] hover:bg-[#081C15] disabled:bg-[#1B4332]/40 text-white font-semibold text-sm sm:text-base transition-all duration-150 flex items-center justify-center gap-2.5 shadow-sm hover:shadow cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
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
