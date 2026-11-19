export type ReservationStatus = 'waiting' | 'ready' | 'seated' | 'served' | 'cancelled' | 'no_show';

export type DiningArea = 'Main Dining Room' | 'Outdoor Terrace' | 'Coal Hearth Bar';

export interface Reservation {
  reservation_id: string; // e.g., "COAL-101"
  customer_name: string;
  mobile: string;
  party_size: number;
  area_name: DiningArea | string;
  queue_number: number;
  status: ReservationStatus;
  created_at: string;
  notes?: string;
  branch_id: string;
  reservation?: { notes: string | null };
  estimated_wait_mins: number;
  notified_at?: string | null;
  seated_at?: string | null;
  past_visits_count?: number;
}

export interface NewEntryPayload {
  reservation_id: string;
  customer_name: string;
  mobile: string;
  party_size: number;
  area_name: string;
  queue_number: number;
  created_at: string;
  notification_id?: string;
  status?: ReservationStatus;
  estimated_wait_mins?: number;
  notes?: string;
}

export interface StatusChangedPayload {
  reservation_id: string;
  status: ReservationStatus;
  queue_number: number;
  updated_at: string;
  customer_name?: string;
  area_name?: string;
  people_ahead?: number;
  seated_at?: string | null;
  notified_at?: string | null;
}

export interface NotificationHistoryItem {
  id: string;
  reservation_id: string;
  customer_name: string;
  mobile: string;
  party_size: number;
  area_name: string;
  queue_number: number;
  reservation_created_at: string; // timestamp for when the reservation was made
  notification_created_at: string;
  viewed_at: string | null; // timestamp when notification was last viewed or marked read
  dismissed_at: string | null; // timestamp when notification was last dismissed
  read: boolean;
  status: ReservationStatus;
  branch_id: string;
  past_visits_count?: number;
}

export interface QueueStats {
  waiting_count: number;
  calling_count: number;
  served_count: number;
  avg_wait_mins: number;
  outdoor_count: number;
  indoor_count: number;
}

export interface WaitTimeDayData {
  date: string;
  dayLabel: string;
  shortDay: string;
  avgWaitMins: number;
  peakWaitMins: number;
  partiesSeated: number;
  mainDiningAvg: number;
  outdoorTerraceAvg: number;
  barAvg: number;
}

export interface WaitTimeAnalytics {
  sevenDayAverage: number;
  peakWaitDay: {
    dayLabel: string;
    avgWaitMins: number;
    peakWaitMins: number;
  };
  fastestWaitDay: {
    dayLabel: string;
    avgWaitMins: number;
  };
  totalPartiesLast7Days: number;
  trendPercentage: number; // vs previous week
  days: WaitTimeDayData[];
}

export interface NotificationItem {
  id: string;
  type: 'new_reservation' | 'status_ready' | 'status_served' | 'cancelled';
  title: string;
  message: string;
  timestamp: string;
  data: NewEntryPayload | StatusChangedPayload;
  read: boolean;
}
