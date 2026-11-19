export type BranchId = 'olaya' | 'roshn' | 'sixty' | 'theview' | 'ammariayh';

export type SeatingAreaId = 'terrace' | 'floral_lounge' | 'pergola';

export type SpecialRequestId = 'birthday' | 'anniversary' | 'high_chair' | 'quiet_corner';

export type TicketStatus = 'waiting' | 'called' | 'seated' | 'no_show' | 'cancelled';

export interface BranchInfo {
  id: BranchId;
  code: string;
  nameEn: string;
  nameAr: string;
  districtEn: string;
  districtAr: string;
  addressEn: string;
  addressAr: string;
  lat: number;
  lng: number;
  taglineEn: string;
  taglineAr: string;
  hoursEn: string;
  hoursAr: string;
  avgTurnoverMinutes: number;
  imageUrl?: string;
  isOpen: boolean;
}

export function getBranchesBounds(
  branches: Pick<BranchInfo, 'lat' | 'lng'>[],
): [[number, number], [number, number]] {
  if (branches.length === 0) {
    return [
      [24.65, 46.45],
      [24.86, 46.78],
    ];
  }
  let minLat = branches[0].lat;
  let maxLat = branches[0].lat;
  let minLng = branches[0].lng;
  let maxLng = branches[0].lng;
  for (const b of branches) {
    if (b.lat < minLat) minLat = b.lat;
    if (b.lat > maxLat) maxLat = b.lat;
    if (b.lng < minLng) minLng = b.lng;
    if (b.lng > maxLng) maxLng = b.lng;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export interface TicketEvent {
  id: string;
  timestamp: number;
  messageEn: string;
  messageAr: string;
}

export interface WaitlistEntry {
  id: string;
  ticketCode: string;
  branchId: BranchId;
  guestName: string;
  phone: string;
  partySize: number;
  seatingArea: SeatingAreaId;
  specialRequests: SpecialRequestId[];
  notes?: string;
  status: TicketStatus;
  source: 'guest' | 'walkin';
  createdAt: number;
  calledAt?: number;
  holdExpiresAt?: number;
  seatedAt?: number;
  completedAt?: number;
  tableNumber?: string;
  extraGraceMinutes?: number;
  hostessNotifiedAt?: number;
  events: TicketEvent[];
}

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  display: string;
  localDigits: string;
  errorKey?: 'empty' | 'invalid';
}

const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (char) => ARABIC_INDIC_MAP[char] ?? char);
}

export function validateSaudiPhone(raw: string): PhoneValidationResult {
  const ascii = toAsciiDigits(raw).trim();
  if (!ascii) {
    return {
      valid: false,
      normalized: '',
      display: '',
      localDigits: '',
      errorKey: 'empty',
    };
  }

  const digitsOnly = ascii.replace(/[\s\-().+]/g, '');
  let localDigits = digitsOnly;

  if (localDigits.startsWith('00966')) {
    localDigits = localDigits.slice(5);
  } else if (localDigits.startsWith('966')) {
    localDigits = localDigits.slice(3);
  }

  if (localDigits.startsWith('0') && localDigits.length === 10) {
    localDigits = localDigits.slice(1);
  }

  if (!/^5\d{8}$/.test(localDigits)) {
    return {
      valid: false,
      normalized: '',
      display: '',
      localDigits,
      errorKey: 'invalid',
    };
  }

  const display = `+966 ${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5)}`;
  return {
    valid: true,
    normalized: `+966${localDigits}`,
    display,
    localDigits,
  };
}

export function generateTicketCode(branchCode: string, sequence: number): string {
  const cleanCode = branchCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const padded = String(Math.max(101, sequence));
  return `#WG-${cleanCode}-${padded}`;
}

export function getWaitingQueueForBranch(
  entries: WaitlistEntry[],
  branchId: BranchId,
): WaitlistEntry[] {
  return entries
    .filter((entry) => entry.branchId === branchId && entry.status === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getQueuePosition(entries: WaitlistEntry[], ticketId: string): number {
  const target = entries.find((e) => e.id === ticketId);
  if (!target || target.status !== 'waiting') {
    return 0;
  }
  const waiting = getWaitingQueueForBranch(entries, target.branchId);
  const idx = waiting.findIndex((e) => e.id === ticketId);
  return idx >= 0 ? idx + 1 : 0;
}

export function estimateWaitMinutes(
  position: number,
  partySize: number,
  avgTurnoverMinutes: number,
  extraGraceMinutes = 0,
): number {
  if (position <= 0) {
    return 0;
  }
  const perPartyPace = Math.max(4, Math.round(avgTurnoverMinutes * 0.38));
  const partyFactor = partySize >= 6 ? 7 : partySize >= 4 ? 3 : 0;
  return position * perPartyPace + partyFactor + extraGraceMinutes;
}

export interface BranchLiveSummary {
  waitingCount: number;
  callingCount: number;
  seatedTodayCount: number;
  nextWaitMinutes: number;
}

export function getBranchLiveSummary(
  entries: WaitlistEntry[],
  branch: BranchInfo,
): BranchLiveSummary {
  const branchEntries = entries.filter((e) => e.branchId === branch.id);
  const waitingCount = branchEntries.filter((e) => e.status === 'waiting').length;
  const callingCount = branchEntries.filter((e) => e.status === 'called').length;
  const seatedTodayCount = branchEntries.filter((e) => e.status === 'seated').length;
  const nextWaitMinutes = branch.isOpen
    ? Math.max(5, estimateWaitMinutes(waitingCount + 1, 2, branch.avgTurnoverMinutes))
    : 0;

  return {
    waitingCount,
    callingCount,
    seatedTodayCount,
    nextWaitMinutes,
  };
}

export interface DashboardStats {
  totalWaiting: number;
  nowCalling: number;
  seatedToday: number;
  avgWaitMinutes: number;
}

export function computeDashboardStats(
  entries: WaitlistEntry[],
  branches: BranchInfo[],
  selectedBranch: BranchId | 'all',
): DashboardStats {
  const scoped =
    selectedBranch === 'all'
      ? entries
      : entries.filter((entry) => entry.branchId === selectedBranch);

  const waiting = scoped.filter((e) => e.status === 'waiting');
  const called = scoped.filter((e) => e.status === 'called');
  const seated = scoped.filter((e) => e.status === 'seated');

  let avgWaitMinutes = 0;
  if (waiting.length > 0) {
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const totalEst = waiting.reduce((sum, entry) => {
      const pos = getQueuePosition(entries, entry.id);
      const turnover = branchMap.get(entry.branchId)?.avgTurnoverMinutes ?? 15;
      return sum + estimateWaitMinutes(pos, entry.partySize, turnover);
    }, 0);
    avgWaitMinutes = Math.round(totalEst / waiting.length);
  }

  return {
    totalWaiting: waiting.length,
    nowCalling: called.length,
    seatedToday: seated.length,
    avgWaitMinutes,
  };
}

export type TicketAction =
  | 'call'
  | 'seat'
  | 'no_show'
  | 'cancel'
  | 'extend_5m'
  | 'notify_hostess';

export function transitionTicket(
  entries: WaitlistEntry[],
  ticketId: string,
  action: TicketAction,
  options: { nowMs?: number; tableNumber?: string } = {},
): WaitlistEntry[] {
  const now = options.nowMs ?? Date.now();
  return entries.map((entry) => {
    if (entry.id !== ticketId) {
      return entry;
    }

    if (action === 'call') {
      const holdMs = 5 * 60 * 1000;
      return {
        ...entry,
        status: 'called',
        calledAt: now,
        holdExpiresAt: now + holdMs,
        events: [
          {
            id: `evt-${now}-call`,
            timestamp: now,
            messageEn: 'Table ready notification sent via SMS & WhatsApp.',
            messageAr: 'تم إرسال إشعار جاهزية الطاولة عبر الرسائل والواتساب.',
          },
          ...entry.events,
        ],
      };
    }

    if (action === 'seat') {
      const assignedTable = options.tableNumber?.trim() || entry.tableNumber || 'G-12';
      return {
        ...entry,
        status: 'seated',
        seatedAt: now,
        completedAt: now,
        tableNumber: assignedTable,
        events: [
          {
            id: `evt-${now}-seat`,
            timestamp: now,
            messageEn: `Party seated at table ${assignedTable}.`,
            messageAr: `تم إجلاس الضيوف على طاولة ${assignedTable}.`,
          },
          ...entry.events,
        ],
      };
    }

    if (action === 'no_show') {
      return {
        ...entry,
        status: 'no_show',
        completedAt: now,
        events: [
          {
            id: `evt-${now}-noshow`,
            timestamp: now,
            messageEn: 'Marked as no-show by reception desk.',
            messageAr: 'تم تسجيل عدم الحضور من مكتب الاستقبال.',
          },
          ...entry.events,
        ],
      };
    }

    if (action === 'cancel') {
      return {
        ...entry,
        status: 'cancelled',
        completedAt: now,
        events: [
          {
            id: `evt-${now}-cancel`,
            timestamp: now,
            messageEn: 'Queue reservation cancelled.',
            messageAr: 'تم إلغاء الحجز في قائمة الانتظار.',
          },
          ...entry.events,
        ],
      };
    }

    if (action === 'extend_5m') {
      const fiveMinutesMs = 5 * 60 * 1000;
      const baseExpiry = entry.holdExpiresAt && entry.holdExpiresAt > now ? entry.holdExpiresAt : now;
      return {
        ...entry,
        holdExpiresAt: entry.status === 'called' ? baseExpiry + fiveMinutesMs : entry.holdExpiresAt,
        extraGraceMinutes: (entry.extraGraceMinutes ?? 0) + 5,
        events: [
          {
            id: `evt-${now}-ext`,
            timestamp: now,
            messageEn: 'Guest requested 5 additional minutes.',
            messageAr: 'طلب الضيف مهلة إضافية لمدة ٥ دقائق.',
          },
          ...entry.events,
        ],
      };
    }

    if (action === 'notify_hostess') {
      return {
        ...entry,
        hostessNotifiedAt: now,
        events: [
          {
            id: `evt-${now}-notify`,
            timestamp: now,
            messageEn: 'Hostess alerted: guest is approaching the entrance.',
            messageAr: 'تم تنبيه الاستقبال: الضيف في طريقه إلى المدخل.',
          },
          ...entry.events,
        ],
      };
    }

    return entry;
  });
}

export function formatDurationCompact(ms: number, lang: 'en' | 'ar'): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return lang === 'ar' ? `${hrs} س ${remMins} د` : `${hrs}h ${remMins}m`;
  }
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function normalizeTicketSlug(codeOrId: string): string {
  return codeOrId.replace(/^#/, '').trim().toUpperCase();
}
