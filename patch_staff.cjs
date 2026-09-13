const fs = require('fs');

let content = fs.readFileSync('src/components/StaffDashboard.tsx', 'utf8');

// Import GuestHistoryModal
content = content.replace(
  "import { NotificationHistorySection } from './NotificationHistorySection';",
  "import { NotificationHistorySection } from './NotificationHistorySection';\nimport { GuestHistoryModal } from './GuestHistoryModal';"
);

// Add state for modal
content = content.replace(
  "const [filterArea, setFilterArea] = useState('ALL');",
  "const [filterArea, setFilterArea] = useState('ALL');\n  const [historyModalState, setHistoryModalState] = useState<{isOpen: boolean, mobile: string, name: string}>({isOpen: false, mobile: '', name: ''});"
);

// Add the UI logic for name and modal
const nameUI = 
                          <div className="font-semibold text-white group-hover:text-[#D4AF37] transition flex items-center gap-1.5">
                            {item.past_visits_count && item.past_visits_count > 0 ? (
                              <button 
                                onClick={() => setHistoryModalState({isOpen: true, mobile: item.mobile, name: item.customer_name})}
                                className="flex items-center gap-1.5 hover:underline"
                                title={\\ past visits. Click to view history.\}
                              >
                                {item.customer_name}
                                <span className="rounded-full bg-[#D4AF37]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                                  ?? Returning ({item.past_visits_count})
                                </span>
                              </button>
                            ) : (
                              item.customer_name
                            )}
                            {isNewest && (
;

content = content.replace(
  /                          <div className="font-semibold text-white group-hover:text-\[#D4AF37\] transition flex items-center gap-1\.5">\n                            \{item\.customer_name\}\n                            \{isNewest && \(/,
  nameUI.trim() + " ("
);

// Mount the modal at the bottom of the component
content = content.replace(
  "    </div>\n  );\n};\n",
  "      <GuestHistoryModal \n        isOpen={historyModalState.isOpen} \n        onClose={() => setHistoryModalState({isOpen: false, mobile: '', name: ''})} \n        mobile={historyModalState.mobile} \n        customerName={historyModalState.name} \n      />\n    </div>\n  );\n};\n"
);

fs.writeFileSync('src/components/StaffDashboard.tsx', content);
