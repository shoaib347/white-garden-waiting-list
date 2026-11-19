import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  ArrowRight,
  Clock,
  Compass,
  ExternalLink,
  Leaf,
  MapPin,
  Maximize2,
} from 'lucide-react';
import { AMMARIAYH_IMAGE_URL, COPY, type Language } from '../data/whiteGardenData';
import {
  getBranchLiveSummary,
  getBranchesBounds,
  type BranchId,
  type BranchInfo,
  type WaitlistEntry,
} from '../utils/waitlistLogic';

interface LocationsMapViewProps {
  lang: Language;
  branches: BranchInfo[];
  selectedBranchId: BranchId;
  onSelectBranch: (id: BranchId) => void;
  entries: WaitlistEntry[];
  onJoinBranchWaitlist: (id: BranchId) => void;
}

function createBotanicalPinIcon(label: string, isSelected: boolean): L.DivIcon {
  const safeLabel = label.replace(/[<>&"']/g, '');
  const bg = isSelected ? '#081C15' : '#1B4332';
  const border = isSelected ? '#C5A059' : '#FFFFFF';
  const scale = isSelected ? 'transform: scale(1.08);' : '';

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;${scale}transition:transform 150ms ease;">
      <div style="
        width:38px;height:38px;border-radius:9999px;
        background:${bg};border:2.5px solid ${border};
        box-shadow:0 6px 16px rgba(8,28,21,0.28);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M16 4C11.5 9.5 9 14.5 9 19.5C9 23.64 12.13 27 16 27C19.87 27 23 23.64 23 19.5C23 14.5 20.5 9.5 16 4Z" stroke="#FBFBFB" stroke-width="2" stroke-linejoin="round"/>
          <path d="M16 9V26" stroke="#C5A059" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <span style="
        margin-top:4px;
        padding:2px 8px;
        border-radius:8px;
        background:rgba(251,251,251,0.95);
        color:#081C15;
        border:1px solid ${isSelected ? '#C5A059' : 'rgba(27,67,50,0.22)'};
        font-size:11px;
        font-weight:600;
        white-space:nowrap;
        box-shadow:0 2px 6px rgba(8,28,21,0.12);
      ">${safeLabel}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'wg-marker-icon',
    iconSize: [120, 62],
    iconAnchor: [60, 38],
    popupAnchor: [0, -34],
  });
}

function MapViewportController({
  branches,
  selectedBranch,
  focusTrigger,
  fitAllTrigger,
}: {
  branches: BranchInfo[];
  selectedBranch: BranchInfo;
  focusTrigger: number;
  fitAllTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusTrigger === 0) return;
    map.flyTo([selectedBranch.lat, selectedBranch.lng], 13, {
      duration: 0.75,
    });
  }, [map, selectedBranch.lat, selectedBranch.lng, focusTrigger]);

  useEffect(() => {
    const bounds = getBranchesBounds(branches);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
  }, [map, branches, fitAllTrigger]);

  return null;
}

export function LocationsMapView({
  lang,
  branches,
  selectedBranchId,
  onSelectBranch,
  entries,
  onJoinBranchWaitlist,
}: LocationsMapViewProps) {
  const t = COPY[lang];
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [fitAllTrigger, setFitAllTrigger] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const activeBranch = branches.find((b) => b.id === selectedBranchId) ?? branches[1];
  const activeSummary = getBranchLiveSummary(entries, activeBranch);
  const initialBounds = useMemo(() => getBranchesBounds(branches), [branches]);

  const handleSelectAndFocus = (branchId: BranchId) => {
    onSelectBranch(branchId);
    setFocusTrigger((n) => n + 1);
    const marker = markerRefs.current[branchId];
    if (marker) {
      marker.openPopup();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#1B4332]/10">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs sm:text-sm font-medium text-[#2D6A4F] inline-flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            <span>{t.heroKicker}</span>
            <span aria-hidden="true">·</span>
            <span>Riyadh, KSA</span>
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#081C15] text-balance">
            {t.mapTitle}
          </h1>
          <p className="text-sm sm:text-base text-[#081C15]/70">{t.mapSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setFitAllTrigger((n) => n + 1)}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-white border border-[#1B4332]/20 hover:border-[#C5A059] text-[#1B4332] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 self-start md:self-auto transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
          <span>{t.mapResetBounds}</span>
        </button>
      </div>

      {/* 2-Column Interactive Directory + Botanical Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Directory List */}
        <div className="lg:col-span-5 space-y-3">
          {branches.map((branch) => {
            const summary = getBranchLiveSummary(entries, branch);
            const isSelected = branch.id === activeBranch.id;

            return (
              <div
                key={branch.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                  isSelected
                    ? 'bg-white border-[#1B4332] shadow-sm'
                    : 'bg-white/80 border-[#1B4332]/12 hover:bg-white hover:border-[#1B4332]/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectAndFocus(branch.id)}
                  aria-pressed={isSelected}
                  className="w-full text-start space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] rounded-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#081C15] truncate">
                        {lang === 'ar' ? branch.nameAr : branch.nameEn}
                      </h2>
                      <p className="text-xs text-[#2D6A4F] font-medium">
                        {lang === 'ar' ? branch.districtAr : branch.districtEn}
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-[#1B4332] tabular-nums whitespace-nowrap shrink-0 pt-1">
                      {branch.isOpen ? t.waitMins(summary.nextWaitMinutes) : t.closedStatus}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#081C15]/70 leading-relaxed flex items-start gap-2">
                    <MapPin
                      className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{lang === 'ar' ? branch.addressAr : branch.addressEn}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#081C15]/60 tabular-nums pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                      {lang === 'ar' ? branch.hoursAr : branch.hoursEn}
                    </span>
                    <span aria-hidden="true" className="text-[#C5A059]">
                      ·
                    </span>
                    <span>{t.partiesAhead(summary.waitingCount)}</span>
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-4 pt-3.5 border-t border-[#1B4332]/10 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onJoinBranchWaitlist(branch.id)}
                      className="flex-1 min-h-[40px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>{t.mapJoinWaitlistCta}</span>
                      <ArrowRight
                        className="w-3.5 h-3.5 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </button>

                    <a
                      href={`https://www.openstreetmap.org/?mlat=${branch.lat}&mlon=${branch.lng}#map=16/${branch.lat}/${branch.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#1B4332]/20 hover:border-[#C5A059] text-[#1B4332] text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <span>{t.mapDirections}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Interactive Botanical Map + Selected Sanctuary Card */}
        <div className="lg:col-span-7 space-y-5">
          <div
            data-testid="white-garden-map"
            className="relative h-[440px] sm:h-[520px] rounded-3xl overflow-hidden border border-[#1B4332]/20 shadow-sm bg-[#EEF3EC]"
          >
            <MapContainer
              bounds={initialBounds}
              boundsOptions={{ padding: [48, 48] }}
              scrollWheelZoom={true}
              className="w-full h-full wg-leaflet-container z-10"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapViewportController
                branches={branches}
                selectedBranch={activeBranch}
                focusTrigger={focusTrigger}
                fitAllTrigger={fitAllTrigger}
              />

              {branches.map((branch) => {
                const summary = getBranchLiveSummary(entries, branch);
                const isSelected = branch.id === activeBranch.id;
                const label = lang === 'ar' ? branch.nameAr : branch.nameEn;

                return (
                  <Marker
                    key={branch.id}
                    position={[branch.lat, branch.lng]}
                    icon={createBotanicalPinIcon(label, isSelected)}
                    zIndexOffset={isSelected ? 500 : 0}
                    ref={(el) => {
                      markerRefs.current[branch.id] = el;
                    }}
                    eventHandlers={{
                      click: () => {
                        onSelectBranch(branch.id);
                      },
                    }}
                  >
                    <Popup minWidth={230} maxWidth={270}>
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="p-1 space-y-2.5 text-[#081C15]"
                      >
                        <div>
                          <p className="text-[11px] font-medium text-[#2D6A4F]">
                            {lang === 'ar' ? branch.districtAr : branch.districtEn}
                          </p>
                          <p className="font-display text-lg font-semibold text-[#081C15] leading-tight">
                            {label}
                          </p>
                        </div>

                        <p className="text-xs text-[#081C15]/75 leading-relaxed">
                          {lang === 'ar' ? branch.addressAr : branch.addressEn}
                        </p>

                        <div className="flex items-center gap-2 text-xs tabular-nums font-medium text-[#1B4332]">
                          <span>
                            {branch.isOpen
                              ? t.waitMins(summary.nextWaitMinutes)
                              : t.closedStatus}
                          </span>
                          <span aria-hidden="true" className="text-[#C5A059]">
                            ·
                          </span>
                          <span>{t.partiesAhead(summary.waitingCount)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onJoinBranchWaitlist(branch.id)}
                          className="w-full py-2 px-3 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          {t.mapJoinWaitlistCta}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Selected Destination Spotlight Strip below map */}
          <div className="bg-white border border-[#1B4332]/15 rounded-2xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#1B4332] border border-[#1B4332]/10">
                {!imgFailed ? (
                  <img
                    src={activeBranch.imageUrl || AMMARIAYH_IMAGE_URL}
                    alt={lang === 'ar' ? activeBranch.nameAr : activeBranch.nameEn}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#C5A059]">
                    <Leaf className="w-6 h-6" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <p className="font-display text-2xl font-semibold text-[#081C15] truncate">
                  {lang === 'ar' ? activeBranch.nameAr : activeBranch.nameEn}
                </p>
                <p className="text-xs sm:text-sm text-[#081C15]/70">
                  {lang === 'ar' ? activeBranch.addressAr : activeBranch.addressEn}
                </p>
                <p className="text-xs text-[#2D6A4F] font-medium tabular-nums">
                  {activeBranch.isOpen
                    ? `${t.waitMins(activeSummary.nextWaitMinutes)} · ${t.partiesAhead(activeSummary.waitingCount)}`
                    : t.closedStatus}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onJoinBranchWaitlist(activeBranch.id)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <span>{t.mapJoinWaitlistCta}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
