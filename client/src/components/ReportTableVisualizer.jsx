import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Clock,
  BarChart3,
  Activity,
  Download,
  Search,
  X,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Maximize2,
  Minimize2
} from 'lucide-react';

const VALID_TIMETABLE_SLOTS = [
  '08:10 - 09:00',
  '09:00 - 09:50',
  '09:50 - 10:40',
  '10:40 - 11:30',
  '11:30 - 12:20',
  '12:20 - 13:10',
  '13:10 - 14:10',
  '14:10 - 15:00',
  '15:00 - 15:50',
  '15:50 - 16:40',
  '16:40 - 17:30',
  '17:30 - 18:20',
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to render beautiful status badges based on cell value and column name
function renderCellValue(header, val) {
  if (!val || val === '-') {
    return <span className="text-slate-400 font-normal">-</span>;
  }

  const str = String(val).trim();

  // Status & Classification Badges
  if (header.includes('Status') || header.includes('Allocation Type') || header === 'Booking Status') {
    if (str.includes('TIMETABLE') || str === 'SCHEDULED' || str.includes('Regular Academic Class')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          📚 Timetable Class
        </span>
      );
    }
    if (str.includes('AD_HOC') || str.includes('Free Slot') || str === 'AUTHORIZED_FREE_SLOT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ⚡ Free Slot Booking
        </span>
      );
    }
    if (str.includes('Out of Timetable') || str.includes('Lunch') || str.includes('After-Hours')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          ⚠️ Out-of-Schedule
        </span>
      );
    }
    if (str.toLowerCase() === 'completed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          ✓ Completed
        </span>
      );
    }
    if (str.toLowerCase() === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
          ● Active
        </span>
      );
    }
    if (str.toLowerCase() === 'cancelled') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          ✕ Cancelled
        </span>
      );
    }
  }

  // Department Badges
  if (header.includes('Department') || header.includes('Branch')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
        {str}
      </span>
    );
  }

  // Room Name
  if (header.includes('Room')) {
    return (
      <span className="font-bold text-slate-800 flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        {str}
      </span>
    );
  }

  // Faculty / Teacher
  if (header.includes('Faculty') && !header.includes('Email') && !header.includes('Count')) {
    return (
      <span className="font-semibold text-slate-700 flex items-center gap-1">
        <User className="w-3 h-3 text-slate-400 shrink-0" />
        {str}
      </span>
    );
  }

  // Numeric utilization hours
  if (header.includes('Hours') || header.includes('Minutes')) {
    return <span className="font-mono font-bold text-slate-700">{str}</span>;
  }

  return <span className="text-slate-700">{str}</span>;
}

export default function ReportTableVisualizer({
  reportData,
  onClose,
  onDownload,
  isExpanded = false,
  onToggleExpand,
}) {
  if (!reportData) return null;

  const { title, type, headers = [], rows = [], filename, filterSummary = [] } = reportData;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'MATRIX'
  const [selectedMatrixRoom, setSelectedMatrixRoom] = useState('ALL');

  // Determine if this report can be visualized as a Weekly Timetable Matrix
  const canShowMatrix = useMemo(() => {
    if (type !== 'BLUEPRINT' && type !== 'AUDIT') return false;
    const hasDay = headers.some((h) => h.toLowerCase().includes('day'));
    const hasTime = headers.some(
      (h) => h.toLowerCase().includes('time') || h.toLowerCase().includes('slot')
    );
    return hasDay && hasTime;
  }, [type, headers]);

  // Extract unique room names from rows for Matrix view room switcher
  const matrixRooms = useMemo(() => {
    if (!canShowMatrix) return [];
    const roomCol = headers.find((h) => h.toLowerCase().includes('room'));
    if (!roomCol) return [];
    const set = new Set();
    rows.forEach((r) => {
      if (r[roomCol] && r[roomCol] !== '-') set.add(r[roomCol]);
    });
    return Array.from(set).sort();
  }, [canShowMatrix, headers, rows]);

  // Set initial matrix room selection
  React.useEffect(() => {
    if (matrixRooms.length > 0 && selectedMatrixRoom === 'ALL') {
      setSelectedMatrixRoom(matrixRooms[0]);
    }
  }, [matrixRooms]);

  // Handle live search & sorting
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    // Live search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((row) =>
        headers.some((header) => {
          const val = row[header];
          return val && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        const valA = a[sortColumn] || '';
        const valB = b[sortColumn] || '';
        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        const comp = String(valA).localeCompare(String(valB));
        return sortDirection === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [rows, headers, searchQuery, sortColumn, sortDirection]);

  // Pagination slice
  const paginatedRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredAndSortedRows;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredAndSortedRows.slice(start, start + size);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(filteredAndSortedRows.length / Number(pageSize)) || 1;

  const handleSort = (header) => {
    if (sortColumn === header) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(header);
      setSortDirection('asc');
    }
  };

  // Matrix View Data Aggregator
  const matrixData = useMemo(() => {
    if (!canShowMatrix) return {};
    const roomCol = headers.find((h) => h.toLowerCase().includes('room'));
    const dayCol = headers.find((h) => h.toLowerCase().includes('day'));
    const timeCol = headers.find((h) => h.toLowerCase().includes('time') || h.toLowerCase().includes('slot'));
    const subjectCol = headers.find((h) => h.toLowerCase().includes('subject') || h.toLowerCase().includes('purpose'));
    const facultyCol = headers.find((h) => h.toLowerCase().includes('faculty') && !h.toLowerCase().includes('email'));
    const semCol = headers.find((h) => h.toLowerCase().includes('sem'));
    const secCol = headers.find((h) => h.toLowerCase().includes('sec'));
    const typeCol = headers.find((h) => h.toLowerCase().includes('allocation') || h.toLowerCase().includes('status'));

    const grid = {}; // [Day][Slot] -> Array of entries

    DAYS_OF_WEEK.forEach((d) => {
      grid[d] = {};
      VALID_TIMETABLE_SLOTS.forEach((slot) => {
        grid[d][slot] = [];
      });
    });

    rows.forEach((row) => {
      const roomVal = roomCol ? row[roomCol] : '';
      if (selectedMatrixRoom !== 'ALL' && roomVal !== selectedMatrixRoom) {
        return;
      }

      const dayVal = dayCol ? row[dayCol] : '';
      let timeVal = timeCol ? row[timeCol] : '';

      // Match time slot or span
      const matchedSlot = VALID_TIMETABLE_SLOTS.find((s) => {
        if (timeVal === s) return true;
        if (timeVal.includes('-')) {
          const [start, end] = timeVal.split('-').map((t) => t.trim());
          const [sStart, sEnd] = s.split('-').map((t) => t.trim());
          return start === sStart || (start <= sStart && end >= sEnd);
        }
        return false;
      });

      if (grid[dayVal] && matchedSlot) {
        grid[dayVal][matchedSlot].push({
          subject: subjectCol ? row[subjectCol] : 'Class',
          faculty: facultyCol ? row[facultyCol] : '-',
          semester: semCol ? row[semCol] : '',
          section: secCol ? row[secCol] : '',
          room: roomVal,
          allocationType: typeCol ? row[typeCol] : 'Timetable Class',
        });
      }
    });

    return grid;
  }, [canShowMatrix, rows, headers, selectedMatrixRoom]);

  // Report Icon picker
  const renderReportIcon = () => {
    switch (type) {
      case 'AUDIT':
        return <Clock className="w-5 h-5 text-indigo-600" />;
      case 'BLUEPRINT':
        return <FileSpreadsheet className="w-5 h-5 text-indigo-600" />;
      case 'UTILIZATION':
        return <BarChart3 className="w-5 h-5 text-blue-600" />;
      case 'USAGE':
        return <Activity className="w-5 h-5 text-emerald-600" />;
      default:
        return <FileSpreadsheet className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div
      id="report-visualizer-table"
      className="bg-white border-2 border-indigo-200/90 rounded-2xl shadow-xl overflow-hidden transition-all animate-fadeIn"
    >
      {/* ── Top Header Toolbar ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20 shadow-inner">
              {renderReportIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">{title}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {filteredAndSortedRows.length} Records
                </span>
              </div>
              <p className="text-[11px] text-indigo-200/80 mt-0.5">
                Real-time interactive table preview. Search, sort, or export to CSV.
              </p>
            </div>
          </div>

          {/* Filter summary badges */}
          {filterSummary && filterSummary.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-white/10">
              <span className="text-[10px] font-semibold text-indigo-200 flex items-center gap-1">
                <Filter className="w-2.5 h-2.5 text-indigo-400" /> Filters:
              </span>
              {filterSummary.map((f, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 border border-white/15 text-white"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            type="button"
            onClick={onDownload}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            title="Download full report CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>CSV</span>
          </button>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
              title={isExpanded ? 'Restore side-by-side view' : 'Expand full width'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Visualized Table"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Sub-Toolbar: Search, View Switcher & Pagination Controls ── */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search report records (professor, subject, room, date)..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Controls: Matrix toggle + rows per page */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {canShowMatrix && (
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'MATRIX' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Timetable Grid</span>
              </button>
            </div>
          )}

          {viewMode === 'TABLE' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 outline-none"
              >
                <option value="15">15 rows</option>
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
                <option value="ALL">All ({filteredAndSortedRows.length})</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── VIEW 1: DATA TABLE VIEW ── */}
      {viewMode === 'TABLE' && (
        <>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredAndSortedRows.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">No records found matching your filters.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try clearing the search query or adjusting your report dates and filters.
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Clear Search Query
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] w-12 text-center">
                      #
                    </th>
                    {headers.map((header) => (
                      <th
                        key={header}
                        onClick={() => handleSort(header)}
                        className="py-2.5 px-3.5 font-bold text-slate-700 uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{header}</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          {sortColumn === header && (
                            <span className="text-indigo-600 font-bold">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRows.map((row, idx) => {
                    const rowNum = pageSize === 'ALL' ? idx + 1 : (currentPage - 1) * Number(pageSize) + idx + 1;
                    return (
                      <tr
                        key={row._rowId || idx}
                        className="hover:bg-indigo-50/40 transition-colors even:bg-slate-50/50"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {rowNum}
                        </td>
                        {headers.map((header) => (
                          <td key={header} className="py-2.5 px-3.5 whitespace-nowrap">
                            {renderCellValue(header, row[header])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer with Pagination */}
          {filteredAndSortedRows.length > 0 && pageSize !== 'ALL' && (
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-600">
              <div>
                Showing <span className="font-bold text-slate-800">{(currentPage - 1) * Number(pageSize) + 1}</span> to{' '}
                <span className="font-bold text-slate-800">
                  {Math.min(currentPage * Number(pageSize), filteredAndSortedRows.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800">{filteredAndSortedRows.length}</span> records
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── VIEW 2: WEEKLY TIMETABLE MATRIX VIEW ── */}
      {viewMode === 'MATRIX' && canShowMatrix && (
        <div className="p-5 space-y-4">
          {/* Room Selector for Matrix */}
          {matrixRooms.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Select Classroom Grid:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {matrixRooms.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedMatrixRoom(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedMatrixRoom === r
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timetable Grid Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 table-fixed">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center border-r border-slate-200 bg-slate-200/70 w-[90px]">
                    Day / Slot
                  </th>
                  {VALID_TIMETABLE_SLOTS.map((slot) => (
                    <th
                      key={slot}
                      className="px-2 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider text-center border-r border-slate-200 last:border-r-0 min-w-[130px]"
                    >
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {DAYS_OF_WEEK.map((day) => (
                  <tr key={day} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 text-xs font-bold text-slate-800 bg-slate-50 border-r border-slate-200 text-center">
                      {day}
                    </td>
                    {VALID_TIMETABLE_SLOTS.map((slot) => {
                      const entries = matrixData[day]?.[slot] || [];
                      const isLunch = slot.includes('13:10');

                      if (isLunch && entries.length === 0) {
                        return (
                          <td
                            key={slot}
                            className="px-2 py-2 bg-slate-100/60 border-r border-slate-200 text-center text-[10px] text-slate-400 font-semibold italic"
                          >
                            Lunch Break
                          </td>
                        );
                      }

                      if (entries.length === 0) {
                        return (
                          <td
                            key={slot}
                            className="px-2 py-2 border-r border-slate-200 text-center text-[10px] text-slate-300 font-normal"
                          >
                            Vacant
                          </td>
                        );
                      }

                      return (
                        <td
                          key={slot}
                          className="px-2 py-2 border-r border-slate-200 bg-indigo-50/30 align-top"
                        >
                          <div className="space-y-1.5">
                            {entries.map((item, i) => (
                              <div
                                key={i}
                                className="p-2 rounded-lg bg-white border border-indigo-200/80 shadow-sm text-left hover:border-indigo-400 transition"
                              >
                                <div className="font-bold text-indigo-900 text-xs leading-tight">
                                  {item.subject}
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                                  <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{item.faculty}</span>
                                </div>
                                {(item.semester || item.section) && (
                                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    {item.semester ? `${item.semester} Sem` : ''} {item.section ? `Sec ${item.section}` : ''}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
