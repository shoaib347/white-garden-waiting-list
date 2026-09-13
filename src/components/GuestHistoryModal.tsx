import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, MapPin, Users, History, AlertCircle } from 'lucide-react';
import { Reservation } from '../types';

interface GuestHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mobile: string;
  customerName: string;
}

export const GuestHistoryModal: React.FC<GuestHistoryModalProps> = ({
  isOpen,
  onClose,
  mobile,
  customerName,
}) => {
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && mobile) {
      setLoading(true);
      fetch(\/api/v1/customers/\/history\)
        .then(res => res.json())
        .then(data => {
          setHistory(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error('Error fetching history:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, mobile]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-[#151515] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-[#1A1A1A] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-white leading-tight">
                  {customerName}
                </h3>
                <p className="text-xs font-semibold text-neutral-400">
                  {mobile}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-neutral-500 hover:bg-neutral-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent"></div>
                <p className="mt-3 text-xs text-neutral-500 font-semibold uppercase tracking-wider">Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-neutral-600 mb-3" />
                <p className="text-sm font-semibold text-neutral-300">No past visits found.</p>
                <p className="text-xs text-neutral-500 mt-1">This might be their first visit.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((visit, index) => {
                  const visitDate = new Date(visit.created_at);
                  const isSeated = visit.status === 'seated' || visit.status === 'served';
                  const isCancelled = visit.status === 'cancelled';
                  
                  return (
                    <div key={visit.reservation_id} className="rounded-xl border border-neutral-800/50 bg-[#1A1A1A]/50 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                          <span className="text-sm font-bold text-neutral-200">
                            {visitDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <span className={\ounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider \\}>
                          {visit.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="flex items-center gap-2 text-xs text-neutral-400 font-semibold">
                          <Clock className="h-3.5 w-3.5 text-neutral-500" />
                          {visitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 font-semibold">
                          <Users className="h-3.5 w-3.5 text-neutral-500" />
                          {visit.party_size} People
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 font-semibold col-span-2">
                          <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                          {visit.area_name}
                        </div>
                      </div>

                      {visit.notes && (
                        <div className="rounded-lg bg-neutral-900 p-2.5 mt-2 border border-neutral-800 text-xs italic text-neutral-400">
                          <span className="font-semibold text-neutral-300 not-italic mr-1">Notes:</span>
                          {visit.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
