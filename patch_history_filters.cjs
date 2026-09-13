const fs = require('fs');

let content = fs.readFileSync('src/components/NotificationHistorySection.tsx', 'utf8');

const stateBlock = 
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'dismissed' | 'seated' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [filterPartySize, setFilterPartySize] = useState('');
  const [filterArea, setFilterArea] = useState('All');
  const [loadingId, setLoadingId] = useState<string | null>(null);
;
content = content.replace(
  "const [filterType, setFilterType] = useState<'all' | 'unread' | 'dismissed' | 'seated'>('all');\n  const [searchQuery, setSearchQuery] = useState('');\n  const [loadingId, setLoadingId] = useState<string | null>(null);",
  stateBlock
);

const filterLogic = 
  const filteredHistory = history.filter((item) => {
    if (filterType === 'unread' && item.read) return false;
    if (filterType === 'dismissed' && !item.dismissed_at) return false;
    if (filterType === 'seated' && item.status !== 'seated' && item.status !== 'served') return false;
    if (filterType === 'cancelled' && item.status !== 'cancelled') return false;

    if (filterDate) {
      const itemDate = new Date(item.reservation_created_at).toISOString().split('T')[0];
      if (itemDate !== filterDate) return false;
    }

    if (filterTime) {
      // Basic time matching (e.g., "14:" matches 2 PM hour, or exact match)
      const itemTime = new Date(item.reservation_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      if (!itemTime.startsWith(filterTime)) return false;
    }

    if (filterPartySize && parseInt(filterPartySize) !== item.party_size) return false;
    if (filterArea !== 'All' && item.area_name !== filterArea) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.customer_name.toLowerCase().includes(q);
      const matchId = item.reservation_id.toLowerCase().includes(q);
      const matchArea = item.area_name.toLowerCase().includes(q);
      const matchPhone = item.mobile.includes(q);
      if (!matchName && !matchId && !matchArea && !matchPhone) return false;
    }
    return true;
  });
;

content = content.replace(
  /const filteredHistory = history\.filter\(\(item\) => \{[\s\S]*?return true;\n  \}\);/,
  filterLogic.trim()
);

const uiBlock = 
      {/* Filter and Search Sub-bar */}
      <div className="flex flex-col gap-3 border-b border-neutral-800/80 bg-[#121212] px-4 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Status buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Status:
            </span>
            {[
              { id: 'all', label: 'All Alerts' },
              { id: 'unread', label: \Unread (\)\ },
              { id: 'seated', label: 'Seated' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={\ounded-md px-2.5 py-1 text-[11px] font-semibold transition \\}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name, ID, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 rounded-md border border-neutral-700 bg-neutral-800/50 py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-neutral-800/50">
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Date:</span>
             <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Time:</span>
             <input type="time" value={filterTime} onChange={e => setFilterTime(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">People:</span>
             <input type="number" min="1" placeholder="Any" value={filterPartySize} onChange={e => setFilterPartySize(e.target.value)} className="w-16 rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]" />
           </div>
           <div className="flex items-center gap-2">
             <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Area:</span>
             <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-800/50 py-1 px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]">
               <option value="All">All</option>
               <option value="Main Dining Room">Main Dining Room</option>
               <option value="Outdoor Terrace">Outdoor Terrace</option>
               <option value="Coal Hearth Bar">Coal Hearth Bar</option>
             </select>
           </div>
           {(filterDate || filterTime || filterPartySize || filterArea !== 'All') && (
             <button onClick={() => { setFilterDate(''); setFilterTime(''); setFilterPartySize(''); setFilterArea('All'); }} className="text-[11px] text-[#D32F2F] hover:underline">
               Clear Filters
             </button>
           )}
        </div>
      </div>
;

content = content.replace(
  /\{\/\* Filter and Search Sub-bar \*\/\}[\s\S]*?\{\/\* Search box \*\/\}[\s\S]*?<\/div>\n      <\/div>/,
  uiBlock.trim()
);

fs.writeFileSync('src/components/NotificationHistorySection.tsx', content);
