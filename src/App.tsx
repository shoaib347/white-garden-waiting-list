/**
 * White Garden — Curating Moments (وايت قاردن)
 * Real-time Multi-Branch Waiting List & Concierge Platform
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { HostessDashboardView } from './components/HostessDashboardView';
import { StaffLoginView, type StaffAuthSession } from './components/StaffLoginView';
import { LocationsMapView } from './components/LocationsMapView';
import { TicketTrackerView } from './components/TicketTrackerView';
import { WaitlistJoinView } from './components/WaitlistJoinView';
import {
  COPY,
  INITIAL_BRANCHES,
  createInitialWaitlistEntries,
  type ActiveView,
  type Language,
} from './data/whiteGardenData';
import { playHospitalityChime } from './utils/soundChime';
import {
  extractReservationTimeTag,
  generateTicketCode,
  normalizeTicketSlug,
  transitionTicket,
  type BranchId,
  type BranchInfo,
  type SeatingAreaId,
  type SpecialRequestId,
  type TicketAction,
  type WaitlistEntry,
} from './utils/waitlistLogic';
import { useSocket } from './hooks/useSocket';

interface ToastNotification {
  id: string;
  message: string;
  kind: 'info' | 'chime';
}

function parseRouteFromPath(entries: WaitlistEntry[]): {
  view: ActiveView;
  ticketId?: string;
} {
  if (typeof window === 'undefined') {
    return { view: 'join' };
  }
  const path = decodeURIComponent(window.location.pathname).toLowerCase();
  if (
    path.startsWith('/hostess') ||
    path.startsWith('/desk') ||
    path.includes('staff dashboard') ||
    path.includes('staff')
  ) {
    return { view: 'hostess' };
  }
  if (path.startsWith('/map') || path.startsWith('/locations')) {
    return { view: 'map' };
  }
  if (path.startsWith('/ticket/') || path.includes('live tracker')) {
    const rawSlug = path.includes('/ticket/')
      ? path.slice(path.indexOf('/ticket/') + '/ticket/'.length)
      : path.split('/').pop() || '';
    const slug = normalizeTicketSlug(rawSlug);
    const matched = entries.find(
      (e) => normalizeTicketSlug(e.ticketCode) === slug || e.id.toLowerCase() === slug,
    );
    return { view: 'ticket', ticketId: matched?.id };
  }
  if (path === '/ticket' || path.includes('live tracker')) {
    return { view: 'ticket' };
  }
  if (
    path.startsWith('/join') ||
    path.includes('waitlist form') ||
    path.includes('booking')
  ) {
    return { view: 'join' };
  }
  return { view: 'join' };
}

// Convert backend API reservation to WaitlistEntry
function mapBackendReservationToEntry(r: any): WaitlistEntry {
  const code = r.reservation_id.startsWith('#') ? r.reservation_id : `#${r.reservation_id}`;
  const now = Date.now();
  const createdMs = r.created_at ? new Date(r.created_at).getTime() : now;
  const calledMs = r.notified_at ? new Date(r.notified_at).getTime() : undefined;
  const seatedMs = r.seated_at ? new Date(r.seated_at).getTime() : undefined;

  const rawNotes: string = r.notes || '';
  const graceMatches = rawNotes.match(/\[\+5m\]/g);
  const extraGraceMinutes = graceMatches ? graceMatches.length * 5 : 0;
  const { reservationTime, cleanNotes: notesNoTime } = extractReservationTimeTag(rawNotes);
  const cleanNotes = notesNoTime
    .replace(/\[\+5m\]/g, '')
    .replace(/\[WALKIN\]/g, '')
    .replace(/\s*\|?\s*Table\s+G-\d+/gi, '')
    .trim();

  let uiStatus: WaitlistEntry['status'] = 'waiting';
  if (r.status === 'ready' || r.status === 'called') uiStatus = 'called';
  else if (r.status === 'seated' || r.status === 'served') uiStatus = 'seated';
  else if (r.status === 'cancelled') uiStatus = 'cancelled';
  else if (r.status === 'no_show') uiStatus = 'no_show';

  return {
    id: r.reservation_id,
    ticketCode: code,
    branchId: (r.branch_id || 'roshn') as BranchId,
    guestName: r.customer_name || 'Valued Guest',
    phone: r.mobile || '',
    partySize: r.party_size || 2,
    seatingArea: (r.area_name || 'terrace') as SeatingAreaId,
    specialRequests: [],
    notes: cleanNotes || undefined,
    status: uiStatus,
    source: rawNotes.includes('[WALKIN]') ? 'walkin' : 'guest',
    createdAt: createdMs,
    calledAt: calledMs,
    seatedAt: seatedMs,
    extraGraceMinutes: extraGraceMinutes || undefined,
    reservationTime,
    visitCount: typeof r.visit_count === 'number' ? r.visit_count : undefined,
    holdExpiresAt: calledMs ? calledMs + (10 + extraGraceMinutes) * 60 * 1000 : undefined,
    events: (() => {
      const evts: WaitlistEntry['events'] = [
        {
          id: `evt-${r.reservation_id}-join`,
          timestamp: createdMs,
          messageEn: `Joined waitlist (${code}).`,
          messageAr: `انضم لقائمة الانتظار (${code}).`,
        },
      ];
      if (extraGraceMinutes > 0) {
        const count = Math.round(extraGraceMinutes / 5);
        for (let i = 0; i < count; i++) {
          evts.unshift({
            id: `evt-${r.reservation_id}-ext-${i}`,
            timestamp: (calledMs ?? createdMs) + (i + 1) * 1000,
            messageEn: 'Guest requested 5 additional minutes.',
            messageAr: 'طلب الضيف ٥ دقائق إضافية.',
          });
        }
      }
      if (calledMs) {
        evts.unshift({
          id: `evt-${r.reservation_id}-call`,
          timestamp: calledMs,
          messageEn: 'Table ready alert sent to live ticket tracker.',
          messageAr: 'تم إرسال إشعار جاهزية الطاولة لشاشة التذكرة المباشرة.',
        });
      }
      if (seatedMs) {
        evts.unshift({
          id: `evt-${r.reservation_id}-seat`,
          timestamp: seatedMs,
          messageEn: 'Guest seated.',
          messageAr: 'تم إجلاس الضيف.',
        });
      }
      if (uiStatus === 'cancelled') {
        evts.unshift({
          id: `evt-${r.reservation_id}-cancel`,
          timestamp: createdMs + 500,
          messageEn: 'Reservation cancelled.',
          messageAr: 'تم إلغاء التذكرة.',
        });
      } else if (uiStatus === 'no_show') {
        evts.unshift({
          id: `evt-${r.reservation_id}-noshow`,
          timestamp: (calledMs ?? createdMs) + 500,
          messageEn: 'Marked as no-show.',
          messageAr: 'تم التسجيل كعدم حضور.',
        });
      }
      return evts.sort((a, b) => b.timestamp - a.timestamp);
    })(),
  };
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const urlL = p.get('lang');
      if (urlL === 'ar' || urlL === 'en') return urlL;
    }
    return 'en';
  });

  const [branches, setBranches] = useState<BranchInfo[]>(INITIAL_BRANCHES);
  const [entries, setEntries] = useState<WaitlistEntry[]>(() => createInitialWaitlistEntries());
  const [selectedBranch, setSelectedBranch] = useState<BranchId | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const b = (p.get('branch') || '').trim().toLowerCase();
      const validIds: BranchId[] = ['olaya', 'roshn', 'sixty', 'theview', 'ammariayh'];
      if (validIds.includes(b as BranchId)) {
        return b as BranchId;
      }
    }
    return 'roshn';
  });
  const [activeTicketId, setActiveTicketId] = useState<string>('wg-roshn-104');
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const initialEntries = createInitialWaitlistEntries();
    return parseRouteFromPath(initialEntries).view;
  });
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sequenceCounter, setSequenceCounter] = useState(108);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [staffAuth, setStaffAuth] = useState<StaffAuthSession | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem('wg_staff_auth');
      return saved ? (JSON.parse(saved) as StaffAuthSession) : null;
    } catch {
      return null;
    }
  });

  // Verify saved staff token on mount
  useEffect(() => {
    if (!staffAuth?.token) return;
    fetch('/api/v1/auth/verify', {
      headers: { Authorization: `Bearer ${staffAuth.token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          setStaffAuth(null);
          window.localStorage.removeItem('wg_staff_auth');
        }
      })
      .catch(() => {
        // Keep session in offline mode
      });
  }, []);

  // Lock branch selection when branch staff is viewing Hostess Desk
  useEffect(() => {
    if (activeView === 'hostess' && staffAuth && staffAuth.branchId !== 'all') {
      setSelectedBranch(staffAuth.branchId);
    }
  }, [activeView, staffAuth]);

  const handleStaffLogin = (session: StaffAuthSession) => {
    setStaffAuth(session);
    try {
      window.localStorage.setItem('wg_staff_auth', JSON.stringify(session));
    } catch {
      // Ignore storage quota issues
    }
    if (session.branchId !== 'all') {
      setSelectedBranch(session.branchId);
    }
    showToast(
      lang === 'ar'
        ? `تم تسجيل الدخول بنجاح — فرع ${session.branchName}`
        : `Signed in to ${session.branchName} Hostess Desk`,
      'info',
    );
  };

  const handleStaffLogout = () => {
    setStaffAuth(null);
    try {
      window.localStorage.removeItem('wg_staff_auth');
    } catch {
      // Ignore
    }
    showToast(
      lang === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Signed out of Hostess Desk',
      'info',
    );
  };

  const { socket, isConnected } = useSocket();
  const t = COPY[lang];

  // Dynamic RTL / LTR sync
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Toast notification helper
  const showToast = useCallback((message: string, kind: 'info' | 'chime' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToast({ id, message, kind });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  }, []);

  // Sync browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromPath(entries);
      setActiveView(parsed.view);
      if (parsed.ticketId) {
        setActiveTicketId(parsed.ticketId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [entries]);

  // Fetch real queue from backend
  const fetchQueueFromBackend = useCallback(async (branch: BranchId | 'all') => {
    try {
      const res = await fetch(`/api/v1/queue?branch_id=${branch}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.queue) && data.queue.length > 0) {
        const backendEntries = data.queue.map(mapBackendReservationToEntry);
        setEntries((prev) => {
          // Merge backend entries, keeping any fresh local events
          const map = new Map<string, WaitlistEntry>();
          prev.forEach((e) => map.set(e.ticketCode.toLowerCase(), e));
          backendEntries.forEach((b: WaitlistEntry) => map.set(b.ticketCode.toLowerCase(), b));
          return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        });
      }
    } catch (err) {
      // Offline fallback: keep in-memory mock data
    }
  }, []);

  // On mount and branch switch: join socket room & sync queue
  useEffect(() => {
    fetchQueueFromBackend(selectedBranch);

    if (socket && isConnected) {
      socket.emit('join:staff', { branch_id: selectedBranch });
    }
  }, [selectedBranch, socket, isConnected, fetchQueueFromBackend]);

  // Listen to real-time Socket.IO events
  useEffect(() => {
    if (!socket) return;

    // New party joined
    const handleNewEntry = (payload: any) => {
      const newEntry = mapBackendReservationToEntry({
        reservation_id: payload.reservation_id,
        customer_name: payload.customer_name,
        mobile: payload.mobile,
        party_size: payload.party_size,
        area_name: payload.area_name,
        created_at: payload.created_at,
        notes: payload.notes,
        branch_id: payload.branch_id || selectedBranch,
        status: payload.status,
        visit_count: payload.visit_count,
      });

      setEntries((prev) => {
        if (prev.some((e) => e.ticketCode.toLowerCase() === newEntry.ticketCode.toLowerCase())) {
          return prev;
        }
        // Reconcile with local pending optimistic entry if matching same customer and branch within 30s
        const optimisticIdx = prev.findIndex(
          (e) =>
            e.guestName.toLowerCase() === newEntry.guestName.toLowerCase() &&
            e.branchId === newEntry.branchId &&
            Math.abs(Date.now() - e.createdAt) < 30000,
        );
        if (optimisticIdx !== -1) {
          const updated = [...prev];
          updated[optimisticIdx] = {
            ...updated[optimisticIdx],
            id: newEntry.id,
            ticketCode: newEntry.ticketCode,
            visitCount: newEntry.visitCount ?? updated[optimisticIdx].visitCount,
          };
          return updated;
        }
        return [newEntry, ...prev];
      });

      if (audioEnabled) {
        playHospitalityChime();
      }

      showToast(
        lang === 'ar'
          ? `ضيف جديد في الانتظار: ${newEntry.guestName} (${newEntry.ticketCode})`
          : `New waiting guest: ${newEntry.guestName} (${newEntry.ticketCode})`,
        'chime',
      );
    };

    // Status changed (Called / Seated / Cancelled / +5m Extension)
    const handleStatusChanged = (payload: any) => {
      const code = payload.ticket_code || (payload.reservation_id?.startsWith('#') ? payload.reservation_id : `#${payload.reservation_id}`);
      const rawStatus = payload.action_status || (payload.status === 'ready' ? 'called' : payload.status);
      const validStatuses = new Set(['waiting', 'called', 'seated', 'cancelled', 'no_show']);
      const isExtend = payload.action === 'extend_5m';

      setEntries((prev) =>
        prev.map((e) => {
          if (
            e.ticketCode.toLowerCase() === code.toLowerCase() ||
            e.id === payload.reservation_id
          ) {
            const safeNextStatus = validStatuses.has(rawStatus) ? rawStatus : e.status;
            const nextGrace =
              typeof payload.extra_grace_minutes === 'number'
                ? payload.extra_grace_minutes
                : isExtend
                  ? (e.extraGraceMinutes ?? 0) + 5
                  : e.extraGraceMinutes;

            const calledAtMs = payload.notified_at ? new Date(payload.notified_at).getTime() : e.calledAt;
            let nextHoldExpires = e.holdExpiresAt;
            if (isExtend && (safeNextStatus === 'called' || e.status === 'called')) {
              const base = calledAtMs ? calledAtMs + (10 + (nextGrace ?? 5)) * 60 * 1000 : (e.holdExpiresAt ?? Date.now()) + 5 * 60 * 1000;
              nextHoldExpires = base;
            } else if (payload.notified_at) {
              nextHoldExpires = new Date(payload.notified_at).getTime() + (10 + (nextGrace ?? 0)) * 60 * 1000;
            }

            const nowTs = Date.now();
            let liveEvt: WaitlistEntry['events'][number] | null = null;
            if (isExtend) {
              liveEvt = {
                id: `evt-sock-ext-${nowTs}`,
                timestamp: nowTs,
                messageEn: 'Guest requested 5 additional minutes.',
                messageAr: 'طلب الضيف ٥ دقائق إضافية.',
              };
            } else if (safeNextStatus === 'called' && e.status !== 'called') {
              liveEvt = {
                id: `evt-sock-call-${nowTs}`,
                timestamp: nowTs,
                messageEn: 'Table ready alert sent to live ticket tracker.',
                messageAr: 'تم إرسال إشعار جاهزية الطاولة لشاشة التذكرة المباشرة.',
              };
            } else if (safeNextStatus === 'seated' && e.status !== 'seated') {
              liveEvt = {
                id: `evt-sock-seat-${nowTs}`,
                timestamp: nowTs,
                messageEn: 'Guest seated.',
                messageAr: 'تم إجلاس الضيف.',
              };
            } else if (safeNextStatus === 'cancelled' && e.status !== 'cancelled') {
              liveEvt = {
                id: `evt-sock-cancel-${nowTs}`,
                timestamp: nowTs,
                messageEn: 'Reservation cancelled.',
                messageAr: 'تم إلغاء التذكرة.',
              };
            } else if (safeNextStatus === 'no_show' && e.status !== 'no_show') {
              liveEvt = {
                id: `evt-sock-noshow-${nowTs}`,
                timestamp: nowTs,
                messageEn: 'Marked as no-show.',
                messageAr: 'تم التسجيل كعدم حضور.',
              };
            }

            // Avoid duplicating an identical event created within the last 3 seconds locally
            const alreadyLogged =
              liveEvt &&
              e.events.some(
                (existing) =>
                  existing.messageEn === liveEvt!.messageEn &&
                  Math.abs(existing.timestamp - liveEvt!.timestamp) < 3000,
              );

            return {
              ...e,
              status: isExtend ? e.status : safeNextStatus,
              calledAt: calledAtMs,
              seatedAt: payload.seated_at ? new Date(payload.seated_at).getTime() : e.seatedAt,
              extraGraceMinutes: nextGrace || undefined,
              holdExpiresAt: nextHoldExpires,
              events: liveEvt && !alreadyLogged ? [liveEvt, ...e.events] : e.events,
            };
          }
          return e;
        })
      );

      if (isExtend) {
        if (audioEnabled) playHospitalityChime();
        showToast(
          lang === 'ar'
            ? `طلب الضيف ${payload.customer_name || ''} (${code}) تمديد ٥ دقائق إضافية`
            : `${payload.customer_name || 'Guest'} (${code}) requested +5 extra minutes`,
          'chime',
        );
      } else if (rawStatus === 'called' && audioEnabled) {
        playHospitalityChime();
      }
    };

    socket.on('queue:new_entry', handleNewEntry);
    socket.on('queue:status_changed', handleStatusChanged);

    return () => {
      socket.off('queue:new_entry', handleNewEntry);
      socket.off('queue:status_changed', handleStatusChanged);
    };
  }, [socket, audioEnabled, lang, selectedBranch, showToast]);

  const navigateToView = (
    view: ActiveView,
    ticketIdOverride?: string,
    ticketCodeOverride?: string,
  ) => {
    setActiveView(view);
    if (view !== 'hostess' && selectedBranch === 'all') {
      setSelectedBranch('roshn');
    }

    const targetId = ticketIdOverride ?? activeTicketId;
    if (ticketIdOverride) {
      setActiveTicketId(ticketIdOverride);
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      let nextPath = '/join';
      if (view === 'hostess') {
        nextPath = '/hostess';
      } else if (view === 'map') {
        nextPath = '/map';
      } else if (view === 'ticket') {
        const ticket = entries.find((e) => e.id === targetId || e.ticketCode === targetId);
        const rawCode = ticketCodeOverride ?? ticket?.ticketCode ?? 'WG-ROSHN-104';
        const slug = normalizeTicketSlug(rawCode);
        nextPath = `/ticket/${slug}`;
      }
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
    }
  };

  // Submit new customer waitlist booking
  const handleJoinWaitlist = async (input: {
    branchId: BranchId;
    guestName: string;
    phone: string;
    partySize: number;
    seatingArea: SeatingAreaId;
    specialRequests: SpecialRequestId[];
    notes: string;
    reservationTime?: string;
  }) => {
    const branch = branches.find((b) => b.id === input.branchId) ?? branches[1];
    const nextSeq = sequenceCounter;
    setSequenceCounter((prev) => prev + 1);

    const ticketCode = generateTicketCode(branch.code, nextSeq);
    const now = Date.now();
    const newId = `${branch.id}-${nextSeq}-${now}`;

    // Optimistic UI update
    const newEntry: WaitlistEntry = {
      id: newId,
      ticketCode,
      branchId: input.branchId,
      guestName: input.guestName,
      phone: input.phone,
      partySize: input.partySize,
      seatingArea: input.seatingArea,
      specialRequests: input.specialRequests,
      notes: input.notes || undefined,
      reservationTime: input.reservationTime,
      status: 'waiting',
      source: 'guest',
      createdAt: now,
      events: [
        {
          id: `evt-${now}-join`,
          timestamp: now,
          messageEn: `Joined ${branch.nameEn} waitlist (${ticketCode}).`,
          messageAr: `تم الانضمام لقائمة الانتظار في ${branch.nameAr} (${ticketCode}).`,
        },
      ],
    };

    setEntries((prev) => [newEntry, ...prev]);
    setSelectedBranch(input.branchId);
    setActiveTicketId(newId);
    navigateToView('ticket', newId, ticketCode);

    showToast(
      lang === 'ar'
        ? `تم تأكيد تذكرتك ${ticketCode} في ${branch.nameAr}`
        : `Pass ${ticketCode} confirmed for ${branch.nameEn}`,
      'info',
    );

    // Persist to PostgreSQL backend
    try {
      const res = await fetch('/api/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: input.guestName,
          mobile: input.phone,
          party_size: input.partySize,
          area_name: input.seatingArea,
          notes: [input.reservationTime ? `[TIME:${input.reservationTime}]` : '', input.notes, input.specialRequests.length ? `Requests: ${input.specialRequests.join(', ')}` : ''].filter(Boolean).join(' | '),
          branch_id: input.branchId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reservation?.reservation_id) {
          const confirmedCode = data.reservation.reservation_id.startsWith('#')
            ? data.reservation.reservation_id
            : `#${data.reservation.reservation_id}`;

          setEntries((prev) => {
            const hasConfirmed = prev.find(
              (e) => e.ticketCode.toLowerCase() === confirmedCode.toLowerCase(),
            );
            if (hasConfirmed) {
              return prev.filter((e) => e.id === hasConfirmed.id || e.id !== newId);
            }
            return prev.map((e) => (e.id === newId ? { ...e, ticketCode: confirmedCode } : e));
          });
          window.history.replaceState(null, '', `/ticket/${encodeURIComponent(confirmedCode.replace(/^#/, ''))}`);
        }
      }
    } catch (e) {
      // Handled gracefully in offline mode
    }
  };

  // Hostess adds quick walk-in guest
  const handleAddWalkin = async (input: {
    branchId: BranchId;
    guestName: string;
    phone: string;
    partySize: number;
    seatingArea: SeatingAreaId;
  }) => {
    const branch = branches.find((b) => b.id === input.branchId) ?? branches[1];
    const nextSeq = sequenceCounter;
    setSequenceCounter((prev) => prev + 1);

    const ticketCode = generateTicketCode(branch.code, nextSeq);
    const now = Date.now();
    const newId = `${branch.id}-${nextSeq}-${now}`;

    const newEntry: WaitlistEntry = {
      id: newId,
      ticketCode,
      branchId: input.branchId,
      guestName: input.guestName,
      phone: input.phone,
      partySize: input.partySize,
      seatingArea: input.seatingArea,
      specialRequests: [],
      status: 'waiting',
      source: 'walkin',
      createdAt: now,
      events: [
        {
          id: `evt-${now}-walkin`,
          timestamp: now,
          messageEn: `Added as walk-in party at ${branch.nameEn}.`,
          messageAr: `تمت إضافة الزائر المباشر في ${branch.nameAr}.`,
        },
      ],
    };

    setEntries((prev) => [newEntry, ...prev]);

    showToast(
      lang === 'ar'
        ? `تمت إضافة ${input.guestName} (${ticketCode}) إلى قائمة الانتظار`
        : `${input.guestName} (${ticketCode}) added to waiting queue`,
      'info',
    );

    // Persist walk-in to backend
    try {
      const res = await fetch('/api/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: input.guestName,
          mobile: input.phone,
          party_size: input.partySize,
          area_name: input.seatingArea,
          notes: '[WALKIN]',
          branch_id: input.branchId,
          is_walkin: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reservation?.reservation_id) {
          const confirmedCode = data.reservation.reservation_id.startsWith('#')
            ? data.reservation.reservation_id
            : `#${data.reservation.reservation_id}`;
          setEntries((prev) => {
            const hasConfirmed = prev.find(
              (e) => e.ticketCode.toLowerCase() === confirmedCode.toLowerCase(),
            );
            if (hasConfirmed) {
              return prev.filter((e) => e.id === hasConfirmed.id || e.id !== newId);
            }
            return prev.map((e) => (e.id === newId ? { ...e, ticketCode: confirmedCode } : e));
          });
        }
      }
    } catch (e) {
      // Handled gracefully
    }
  };

  // Hostess actions: Call, Seat, Delay, Cancel
  const handleTicketAction = async (
    ticketId: string,
    action: TicketAction,
    tableNumber?: string,
  ) => {
    const target = entries.find((e) => e.id === ticketId || e.ticketCode === ticketId);
    setEntries((prev) => transitionTicket(prev, ticketId, action, { tableNumber }));

    if (!target) return;

    if (action === 'call') {
      if (audioEnabled) playHospitalityChime();
      showToast(
        lang === 'ar'
          ? `تم نداء ${target.guestName} (${target.ticketCode}) — تم إرسال تنبيه جاهزية الطاولة للتذكرة`
          : `Calling ${target.guestName} (${target.ticketCode}) — Table ready alert sent to live ticket`,
        'chime',
      );
    } else if (action === 'seat') {
      showToast(
        lang === 'ar'
          ? (tableNumber ? `تم إجلاس ${target.guestName} على طاولة ${tableNumber}` : `تم إجلاس ${target.guestName}`)
          : (tableNumber ? `${target.guestName} seated at table ${tableNumber}` : `${target.guestName} seated`),
        'info',
      );
    } else if (action === 'extend_5m') {
      showToast(
        lang === 'ar'
          ? 'تم تمديد المهلة ٥ دقائق إضافية وإبلاغ الاستقبال'
          : 'Added 5 additional minutes to your hold window',
        'info',
      );
    } else if (action === 'notify_hostess') {
      if (audioEnabled) playHospitalityChime();
      showToast(
        lang === 'ar'
          ? 'تم تنبيه مكتب الاستقبال بأنك في الطريق للمدخل'
          : 'Front desk notified that you are approaching the entrance',
        'chime',
      );
    } else if (action === 'cancel') {
      showToast(
        lang === 'ar'
          ? `تم إلغاء التذكرة ${target.ticketCode}`
          : `Reservation ${target.ticketCode} cancelled`,
        'info',
      );
    }

    // Broadcast status change to backend and other devices
    try {
      const serverStatus = action === 'call' ? 'ready' : (action === 'seat' ? 'seated' : action);
      await fetch('/api/v1/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: target.ticketCode.replace(/^#/, ''),
          status: serverStatus,
          reason: action === 'seat' && tableNumber ? `Table ${tableNumber}` : undefined,
        }),
      });
    } catch (e) {
      // Offline fallback
    }
  };

  const handleToggleBranchOpen = async (branchId: BranchId) => {
    const targetBranch = branches.find((b) => b.id === branchId);
    const newIsOpen = !targetBranch?.isOpen;

    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, isOpen: newIsOpen } : b)),
    );

    try {
      await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          is_waitlist_open: newIsOpen,
        }),
      });
    } catch (e) {
      // Handled
    }
  };

  const joinBranchId: BranchId =
    selectedBranch === 'all' ? 'roshn' : selectedBranch;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F6] text-[#081C15]">
      {activeView === 'hostess' && (
        <Header
          lang={lang}
          onToggleLang={() => setLang((prev) => (prev === 'en' ? 'ar' : 'en'))}
          activeView={activeView}
          onSelectView={(view) => navigateToView(view)}
          branches={branches}
          selectedBranch={selectedBranch}
          onSelectBranch={(id) => setSelectedBranch(id)}
          lockedBranchId={staffAuth && staffAuth.branchId !== 'all' ? staffAuth.branchId : null}
        />
      )}

      <main className="flex-1">
        {activeView === 'join' && (
          <WaitlistJoinView
            lang={lang}
            branches={branches}
            selectedBranchId={joinBranchId}
            onSelectBranch={(id) => setSelectedBranch(id)}
            entries={entries}
            onJoinWaitlist={handleJoinWaitlist}
          />
        )}

        {activeView === 'map' && (
          <LocationsMapView
            lang={lang}
            branches={branches}
            selectedBranchId={joinBranchId}
            onSelectBranch={(id) => setSelectedBranch(id)}
            entries={entries}
            onJoinBranchWaitlist={(id) => {
              setSelectedBranch(id);
              navigateToView('join');
            }}
          />
        )}

        {activeView === 'ticket' && (
          <TicketTrackerView
            lang={lang}
            branches={branches}
            entries={entries}
            activeTicketId={activeTicketId}
            onSelectTicket={(id) => navigateToView('ticket', id)}
            onTicketAction={(id, action) => handleTicketAction(id, action)}
            onJoinAnother={() => navigateToView('join')}
          />
        )}

        {activeView === 'hostess' && (
          staffAuth ? (
            <HostessDashboardView
              lang={lang}
              branches={branches}
              selectedBranch={staffAuth.branchId !== 'all' ? staffAuth.branchId : selectedBranch}
              onToggleBranchOpen={handleToggleBranchOpen}
              audioEnabled={audioEnabled}
              onToggleAudio={() => setAudioEnabled((prev) => !prev)}
              entries={entries}
              onTicketAction={handleTicketAction}
              onAddWalkin={handleAddWalkin}
              staffUser={staffAuth}
              onLogout={handleStaffLogout}
              onSelectBranch={(id) => setSelectedBranch(id)}
            />
          ) : (
            <StaffLoginView lang={lang} onLoginSuccess={handleStaffLogin} />
          )
        )}
      </main>

      <footer className="border-t border-[#1B4332]/10 bg-[#FBFBFB] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#081C15]/60">
          <span>{t.footerCopy}</span>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
            <span>{isConnected ? (lang === 'ar' ? 'متصل بالشبكة الحية' : 'Live Cloud Sync') : (lang === 'ar' ? 'وضع غير متصل' : 'Offline / Standalone')}</span>
            <span className="mx-1">•</span>
            <span>{t.brandTagline}</span>
          </div>
        </div>
      </footer>

      {/* Live Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-4 py-3 shadow-xl backdrop-blur-md text-sm border flex items-center gap-3 transition-all animate-bounce bg-[#081C15]/95 text-[#FBFBFB] border-[#C5A059]/40"
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
