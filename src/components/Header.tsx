import { ChevronDown, Globe } from 'lucide-react';
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
  selectedBranch,
  onSelectBranch,
}: HeaderProps) {
  const t = COPY[lang];

  const tabs: { id: ActiveView; label: string }[] = [
    { id: 'join', label: t.navJoin },
    { id: 'ticket', label: t.navTicket },
    { id: 'hostess', label: t.navHostess },
  ];

  const branchValue =
    activeView !== 'hostess' && selectedBranch === 'all' ? branches[1].id : selectedBranch;

  return (
    <header className="sticky top-0 z-40 bg-[#FBFBFB]/90 backdrop-blur-md border-b border-[#1B4332]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line luxury brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('join')}
          aria-label="White Garden — وايت قاردن"
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] rounded-xl hover:opacity-90 transition-all shrink-0 py-1"
        >
          <img
            src="/white-garden-logo.svg"
            alt="White Garden — وايت قاردن"
            className="h-9 sm:h-11 w-auto rounded-lg shadow-sm object-contain"
          />
        </button>

        {/* Zone 2: Desktop Mode Switcher Tabs */}
        <nav
          aria-label="Primary sections"
          role="tablist"
          className="hidden md:flex items-center gap-1 bg-[#F2F5F0] p-1 rounded-xl border border-[#1B4332]/10"
        >
          {tabs.map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectView(tab.id)}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                  isActive
                    ? 'bg-[#1B4332] text-white shadow-sm'
                    : 'text-[#1B4332]/80 hover:text-[#081C15] hover:bg-white/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Branch Selector + Language Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative">
            <label htmlFor="header-branch-select" className="sr-only">
              {t.selectBranchHeading}
            </label>
            <select
              id="header-branch-select"
              value={branchValue}
              onChange={(e) => onSelectBranch(e.target.value as BranchId | 'all')}
              className="appearance-none bg-white border border-[#1B4332]/15 hover:border-[#1B4332]/35 text-[#081C15] text-xs sm:text-sm font-medium rounded-lg ps-3 pe-8 py-2 min-h-[38px] max-w-[140px] sm:max-w-[200px] truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] cursor-pointer"
            >
              {activeView === 'hostess' && (
                <option value="all">{t.allBranches}</option>
              )}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {lang === 'ar' ? branch.nameAr : branch.nameEn}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-[#1B4332]/70 pointer-events-none absolute top-1/2 -translate-y-1/2 end-2.5"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={onToggleLang}
            aria-label={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs sm:text-sm font-semibold text-[#1B4332] bg-white border border-[#1B4332]/15 hover:border-[#C5A059] hover:bg-[#F7F9F6] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
          >
            <Globe className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
            <span>{t.switchLang}</span>
          </button>
        </div>
      </div>

      {/* Mobile compact tab strip (<= 44px height so total sticky header stays well below 15% of mobile viewport) */}
      <nav
        aria-label="Mobile sections"
        role="tablist"
        className="md:hidden grid grid-cols-4 border-t border-[#1B4332]/10 bg-[#FBFBFB]"
      >
        {tabs.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectView(tab.id)}
              className={`py-2.5 px-1.5 text-[11px] font-medium text-center transition-colors whitespace-nowrap truncate border-b-2 ${
                isActive
                  ? 'border-[#1B4332] text-[#1B4332] bg-[#D8F3DC]/25 font-semibold'
                  : 'border-transparent text-[#081C15]/65 hover:text-[#081C15]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
