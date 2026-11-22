import { Globe, Lock } from 'lucide-react';
import { COPY, type ActiveView, type Language } from '../data/whiteGardenData';
import type { BranchId, BranchInfo } from '../utils/waitlistLogic';

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  branches: BranchInfo[];
  selectedBranch: BranchId | 'all';
  onSelectBranch: (branchId: BranchId | 'all') => void;
  lockedBranchId?: BranchId | null;
}

export function BotanicalEmblem({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M16 4C11.5 9.5 9 14.5 9 19.5C9 23.6421 12.134 27 16 27C19.866 27 23 23.6421 23 19.5C23 14.5 20.5 9.5 16 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 8V27"
        stroke="#C5A059"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M16 15.5C13.5 14 11.8 12.2 11 10.5M16 19.5C18.5 18 20.2 16.2 21 14.5"
        stroke="#C5A059"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Header({
  lang,
  onToggleLang,
  activeView,
  onSelectView,
  branches,
  lockedBranchId = null,
}: HeaderProps) {
  const t = COPY[lang];

  return (
    <header className="sticky top-0 z-40 bg-[#FBFBFB]/90 backdrop-blur-md border-b border-[#1B4332]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Official White Garden Brand Logo */}
        <button
          type="button"
          onClick={() => {
            if (activeView !== 'hostess') {
              onSelectView('join');
            }
          }}
          aria-label="White Garden — وايت قاردن"
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] rounded-xl hover:opacity-90 transition-all shrink-0 py-1 cursor-pointer"
        >
          <img
            src="/white-garden-logo.svg"
            alt="White Garden — وايت قاردن"
            className="h-9 sm:h-11 w-auto rounded-lg shadow-sm object-contain"
          />
        </button>

        {/* Zone 2: Locked Branch Badge (staff only) + Language Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {lockedBranchId && (
            <div
              title={lang === 'ar' ? 'الفرع المقفل حسب تسجيل الدخول' : 'Locked to signed-in branch'}
              className="inline-flex items-center gap-1.5 bg-[#F2F5F0] border border-[#1B4332]/20 text-[#1B4332] text-xs sm:text-sm font-semibold rounded-lg px-3 py-2 min-h-[38px] max-w-[160px] sm:max-w-[210px] truncate"
            >
              <Lock className="w-3.5 h-3.5 text-[#C5A059] shrink-0" aria-hidden="true" />
              <span className="truncate">
                {(() => {
                  const b = branches.find((item) => item.id === lockedBranchId);
                  return b ? (lang === 'ar' ? b.nameAr : b.nameEn) : lockedBranchId;
                })()}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleLang}
            aria-label={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs sm:text-sm font-semibold text-[#1B4332] bg-white border border-[#1B4332]/15 hover:border-[#C5A059] hover:bg-[#F7F9F6] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
            <span>{t.switchLang}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
