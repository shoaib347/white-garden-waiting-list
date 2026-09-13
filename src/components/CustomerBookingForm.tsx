import React, { useState } from 'react';
import { motion } from 'motion/react';
import { t, Language } from '../i18n';
import { Flame, Users, Phone, MapPin, MessageSquare, CheckCircle, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { DiningArea, QueueStats } from '../types';

interface BookingFormProps {
  onSuccess: (reservationId: string) => void;
  branchId: string;
  stats: QueueStats;
  isWaitlistOpen?: boolean;
  language: Language;
}

export const CustomerBookingForm: React.FC<BookingFormProps> = ({ onSuccess, branchId, stats, isWaitlistOpen = true, language }) => {
    
  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [partySize, setPartySize] = useState<number>(2);
  const [areaName, setAreaName] = useState<DiningArea>('Main Dining Room');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const areas: { id: DiningArea; name: string; desc: string }[] = [
    { id: 'Main Dining Room', name: 'Main Dining Room', desc: 'Warm dim lighting, view of live grill' },
    { id: 'Outdoor Terrace', name: 'Outdoor Terrace', desc: 'Alfresco dining with heated lamps' },
    { id: 'Coal Hearth Bar', name: 'Coal Hearth Bar', desc: 'Craft cocktails & charcuterie seating' },
  ];

  const handleQuickPreset = (name: string, size: number, area: DiningArea) => {
    setCustomerName(name);
    setMobile('+1 (555) 789-0144');
    setPartySize(size);
    setAreaName(area);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('Please enter guest name');
      return;
    }
    if (!mobile.trim()) {
      setErrorMsg('Please enter mobile phone number');
      return;
    }
    if (mobile.length !== 10) {
      setErrorMsg('Mobile number must be exactly 10 digits');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const response = await fetch('/api/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          mobile,
          party_size: partySize,
          area_name: areaName,
          notes,
          branch_id: branchId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit reservation');
      }

      onSuccess(data.reservation.reservation_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error submitting waitlist entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isWaitlistOpen) {
    return (
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-[#161616] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-400">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="mt-3 text-2xl font-bold text-white font-serif tracking-tight">{t('form.title', language)}</h2>
        <p className="mt-2 text-sm text-neutral-400 mb-6">
          Coal Restaurant is not accepting waitlist entries at this moment. Please check back during our {t('Operating Hours')}.
        </p>

        <div className="rounded-xl border border-neutral-800 bg-[#121212] p-5 text-left text-sm">
          <h3 className="font-semibold text-[#D4AF37] mb-3 uppercase tracking-wider text-xs">{t('Operating Hours')}</h3>
          <ul className="space-y-2 text-neutral-300">
            <li className="flex justify-between"><span>{t('Sunday')}</span> <span>12 PM–1:30 AM</span></li>
            <li className="flex justify-between"><span>{t('Monday')}</span> <span>12 PM–1:30 AM</span></li>
            <li className="flex justify-between"><span>{t('Tuesday')}</span> <span>12 PM–1:30 AM</span></li>
            <li className="flex justify-between"><span>{t('Wednesday')}</span> <span>12 PM–1:30 AM</span></li>
            <li className="flex justify-between"><span>{t('Thursday')}</span> <span>12 PM–1:30 AM</span></li>
            <li className="flex justify-between"><span>{t('Friday')}</span> <span>1 PM–1:30 AM</span></li>
            <li className="flex justify-between"><span>{t('Saturday')}</span> <span>12 PM–1:30 AM</span></li>
          </ul>
        </div>
      </div>
    );
  }  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#161616] p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 border-b border-neutral-800/80 pb-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#D32F2F]/40 bg-[#250F12] text-[#D32F2F]">
            <Flame className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-serif sm:text-2xl">
            {t('form.title', language)}
          </h2>
        </div>

        {/* Real-time Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          {/* Metric 1: Waiting */}
          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#161616] p-4 shadow-sm text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t('stats.waiting', language)}</span>
              <Users className="h-4 w-4 text-[#D4AF37]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-white font-serif">{stats.waiting_count}</span>
              <span className="text-xs text-neutral-400">{t('stats.parties', language)}</span>
            </div>
            <div className="mt-1 flex items-center text-[11px] text-neutral-500">
              <span>{stats.outdoor_count} Outdoor · {stats.indoor_count} {t('area.Main Dining Room', language)}</span>
            </div>
          </div>

          {/* Metric 2: {t('stats.avgWait', language)} */}
          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-[#161616] p-4 shadow-sm text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t('stats.avgWait', language)}</span>
              <Clock className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-white font-serif">~{stats.avg_wait_mins}</span>
              <span className="text-xs text-neutral-400">{t('stats.minutes', language)}</span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              Based on current table turns
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 rounded-lg border border-red-500/50 bg-red-950/40 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Guest Name */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5 ${language === "ar" ? "text-right" : "text-left"}`}>
              {t('form.name', language)}
            </label>
            <input
              id="input-customer-name"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-[#121212] px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-hidden"
            />
          </div>

          {/* Mobile Phone */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5 ${language === "ar" ? "text-right" : "text-left"}`}>
              {t('form.mobile', language)}
            </label>
            <div className="relative">
              <Phone className="absolute top-3 left-3 h-4 w-4 text-neutral-500" />
              <input
                id="input-customer-mobile"
                type="tel"
                required
                value={mobile}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 10) {
                    setMobile(val);
                  }
                }}
                pattern="[0-9]{10}"
                title="Must be exactly 10 digits"
                className="w-full rounded-xl border border-neutral-700 bg-[#121212] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* {t('form.partySize', language)} */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                {t('form.partySize', language)}
              </label>
              <span className="text-xs font-bold text-[#D4AF37]">
                {t('form.people', language, partySize)}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPartySize(size)}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    partySize === size
                      ? 'border border-[#D32F2F] bg-[#D32F2F] text-white shadow-md'
                      : 'border border-neutral-800 bg-[#121212] text-neutral-400 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  {size}{size === 10 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Seating Area Preference */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5 ${language === "ar" ? "text-right" : "text-left"}`}>
              {t('form.area', language)}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setAreaName(area.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    areaName === area.id
                      ? 'border-[#D4AF37] bg-gradient-to-r from-[#2A2312] to-[#1C180E] text-white shadow-md'
                      : 'border-neutral-800 bg-[#121212] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{t(`area.${area.name}` as any, language) || area.name}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{t(`area_desc.${area.name}` as any, language) || area.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes / Special Requests */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5 ${language === "ar" ? "text-right" : "text-left"}`}>
              {t('form.notes', language)}
            </label>
            <div className="relative">
              <MessageSquare className="absolute top-3 left-3 h-4 w-4 text-neutral-500" />
              <textarea
                rows={2}
                placeholder={t('form.notesPlaceholder', language)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full rounded-xl border border-neutral-700 bg-[#121212] py-2.5 text-xs text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-hidden ${language === 'ar' ? 'pr-10 pl-3.5 text-right' : 'pl-10 pr-3.5 text-left'}`}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-submit-reservation"
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-[#D32F2F] bg-gradient-to-r from-[#B71C1C] via-[#D32F2F] to-[#B71C1C] py-3 text-sm font-bold tracking-wide text-white shadow-[0_0_25px_rgba(211,47,47,0.35)] transition hover:brightness-110 active:scale-98 disabled:opacity-50"
          >
            {isSubmitting ? t('form.submitting', language) : t('form.submit', language)}
          </button>


        </form>
      </div>
    </div>
  );
};





