const fs = require('fs');

let content = fs.readFileSync('src/components/NotificationHistorySection.tsx', 'utf8');

const exportFunc = 
  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Reservation ID",
      "Customer Name",
      "Mobile",
      "Party Size",
      "Area",
      "Created At",
      "Status",
      "Notes"
    ];

    const rows = filteredHistory.map(item => {
      const notes = (item as any).reservation?.notes || '';
      return [
        item.reservation_id,
        \"\"\,
        \"\"\,
        item.party_size,
        \"\"\,
        \"\"\,
        item.status,
        \"\"\
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", \waitlist_history_\.csv\);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const unreadCount = history.filter((h) => !h.read).length;
;

content = content.replace(
  "  const unreadCount = history.filter((h) => !h.read).length;",
  exportFunc.trim()
);

const exportButton = 
        {/* Global actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            title="Export to Excel / CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {onRefreshHistory && (
;

content = content.replace(
  "        {/* Global actions */}\n        <div className=\"flex items-center gap-2\">\n          {onRefreshHistory && (",
  exportButton.trim()
);

fs.writeFileSync('src/components/NotificationHistorySection.tsx', content);
