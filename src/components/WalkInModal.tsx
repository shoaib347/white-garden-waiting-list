import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Phone, MapPin, User, FileText, X } from 'lucide-react';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { customer_name: string; mobile: string; party_size: number; area_name: string; notes: string }) => void;
}

export const WalkInModal: React.FC<WalkInModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [area, setArea] = useState('Main Dining Room');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) return;
    
    onSubmit({
      customer_name: name.trim(),
      mobile: mobile.trim(),
      party_size: partySize,
      area_name: area,
      notes: notes.trim(),
    });
    
    // Reset and close
    setName('');
    setMobile('');
    setPartySize(2);
    setArea('Main Dining Room');
    setNotes('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-[#161616] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
            <h3 className="text-lg font-bold text-white font-serif">Add Walk-in Customer</h3>
            <button onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-white focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F] transition"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input
                    required
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-white focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F] transition text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Party Size</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <input
                      required
                      type="number"
                      min="1"
                      max="20"
                      value={partySize}
                      onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-white focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Area</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-neutral-700 bg-neutral-900/50 py-2.5 pl-10 pr-8 text-white focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F] transition"
                    >
                      <option value="Main Dining Room">Main Dining Room</option>
                      <option value="Outdoor Terrace">Outdoor Terrace</option>
                      <option value="Coal Hearth Bar">Coal Hearth Bar</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Notes (Optional)</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-white focus:border-[#D32F2F] focus:outline-none focus:ring-1 focus:ring-[#D32F2F] transition resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-bold text-white hover:bg-neutral-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#D32F2F] py-3 text-sm font-bold text-white hover:bg-[#B71C1C] transition shadow-lg shadow-[#D32F2F]/20"
              >
                Add Walk-In
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
