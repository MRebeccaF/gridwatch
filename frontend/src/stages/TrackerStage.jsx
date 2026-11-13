import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Activity,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  HardHat,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ListFilter,
  FileText,
} from 'lucide-react';

export const TrackerStage = () => {
  const { state, unlockStage } = useApp();

  React.useEffect(() => {
    if (unlockStage) unlockStage('analytics');
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);

  const reports = state?.reports || [];
  const metrics = state?.metrics || {};
  const statusCounts = metrics.status_counts || {};

  const totalReports = reports.length;
  const pendingCount = statusCounts.Pending || 0;
  const assignedCount = statusCounts.Assigned || 0;
  const inProgressCount = statusCounts['In Progress'] || 0;
  const resolvedCount = statusCounts.Resolved || 0;

  // Filter reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.meter_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.category && r.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'REJECTED' && r.validation_status === 'REJECTED') ||
      r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSelectReport = async (reportId) => {
    setSelectedReportId(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setReportDetail(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStepStatus = (stepName, currentStatus) => {
    const order = ['Pending', 'Assigned', 'In Progress', 'Resolved'];
    const currIdx = order.indexOf(currentStatus);
    const stepIdx = order.indexOf(stepName);

    if (currentStatus === stepName) return 'current';
    if (currIdx > stepIdx) return 'completed';
    return 'upcoming';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              CENTRAL USER & AUDIT TRACKER
            </span>
            <span className="text-xs text-slate-400">· Section 4.5 Status Lifecycle</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            Work Order Tracking & Audit Lifecycle
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Inspect individual work orders, trace route progression, verify transition history,
            and inspect chronological status timelines.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Work Code or Meter ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>
      </div>

      {/* 5 Count Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0b1329] border border-slate-800 shadow-md">
          <span className="text-slate-400 text-[11px] block font-semibold uppercase">Total Reports</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">{totalReports}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/60 shadow-md">
          <span className="text-red-400 text-[11px] block font-semibold uppercase">Pending</span>
          <span className="text-2xl font-bold text-red-300 font-mono mt-1 block">{pendingCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/60 shadow-md">
          <span className="text-amber-400 text-[11px] block font-semibold uppercase">Assigned</span>
          <span className="text-2xl font-bold text-amber-300 font-mono mt-1 block">{assignedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-900/60 shadow-md">
          <span className="text-cyan-400 text-[11px] block font-semibold uppercase">In Progress</span>
          <span className="text-2xl font-bold text-cyan-300 font-mono mt-1 block">{inProgressCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/60 shadow-md col-span-2 sm:col-span-1">
          <span className="text-emerald-400 text-[11px] block font-semibold uppercase">Resolved</span>
          <span className="text-2xl font-bold text-emerald-300 font-mono mt-1 block">{resolvedCount}</span>
        </div>
      </div>

      {/* Main Split: Detailed Report Inspector vs Recent Reports List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List (1 col) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-cyan-400" />
              Work Orders ({filteredReports.length})
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {['ALL', 'Pending', 'Assigned', 'In Progress', 'Resolved', 'REJECTED'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  statusFilter === f
                    ? 'bg-cyan-600 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Reports Items */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredReports.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No matching reports found.</p>
            ) : (
              filteredReports.map((r) => {
                const isSelected = selectedReportId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectReport(r.id)}
                    className={`w-full text-left p-3 rounded-lg border transition space-y-1 ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-xs text-cyan-300">{r.id}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase font-mono ${
                          r.validation_status === 'REJECTED'
                            ? 'bg-red-950 text-red-400 border border-red-900'
                            : r.status === 'Resolved'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : r.status === 'In Progress'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : r.status === 'Assigned'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}
                      >
                        {r.validation_status === 'REJECTED' ? 'REJECTED' : r.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{r.meter_id}</span>
                      <span className="text-purple-300 font-semibold">{r.priority || 'N/A'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detailed Inspector & Stepper (2 cols) */}
        <div className="lg:col-span-2 bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
          {reportDetail ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-mono text-cyan-300">
                      {reportDetail.report.id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-800 font-mono font-bold">
                      {reportDetail.report.priority}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Meter ID: <strong className="text-slate-200">{reportDetail.report.meter_id}</strong> · Category:{' '}
                    <strong className="text-slate-200">{reportDetail.report.category || 'Rejected'}</strong>
                  </span>
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400 block">Submitted Sim Time:</span>
                  <span className="font-mono text-slate-200 font-bold">
                    Minute {reportDetail.report.submitted_time}
                  </span>
                </div>
              </div>

              {/* 4-Step Lifecycle Status Stepper */}
              {reportDetail.report.validation_status === 'VALID' ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Lifecycle State Machine (Section 4.5)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {['Pending', 'Assigned', 'In Progress', 'Resolved'].map((stName, idx) => {
                      const stepState = getStepStatus(stName, reportDetail.report.status);
                      return (
                        <div
                          key={stName}
                          className={`p-3 rounded-lg border text-center transition ${
                            stepState === 'completed'
                              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                              : stepState === 'current'
                              ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-lg shadow-cyan-500/25 scale-102'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 text-[11px] font-mono font-bold mb-1">
                            <span>0{idx + 1}</span>
                          </div>
                          <span className="text-xs block font-semibold">{stName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-xs text-red-200">
                  <strong className="block text-red-300 font-bold mb-0.5">
                    REJECTED: {reportDetail.report.rejection_code}
                  </strong>
                  <span>{reportDetail.report.rejection_message}</span>
                </div>
              )}

              {/* Assignment & Dispatch Route Info */}
              {reportDetail.current_assignment && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
                  <span className="font-bold text-slate-200 uppercase tracking-wider block text-xs">
                    Crew Assignment & Routing
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Crew Member:</span>
                      <span className="font-bold text-cyan-300 font-mono">
                        {reportDetail.current_assignment.employee_code}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Home Substation:</span>
                      <span className="font-bold text-slate-200 font-mono">
                        {reportDetail.current_assignment.home_grid}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Incident Grid:</span>
                      <span className="font-bold text-slate-200 font-mono">
                        {reportDetail.current_assignment.source_grid}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Transit Cost:</span>
                      <span className="font-bold text-amber-300 font-mono">
                        {reportDetail.current_assignment.route_cost} min
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status History Audit Timeline */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Status Transition Audit History
                </span>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-[160px] overflow-y-auto space-y-2 text-xs font-mono">
                  {reportDetail.status_history?.length === 0 ? (
                    <p className="text-slate-500 text-[11px]">No status transitions recorded yet.</p>
                  ) : (
                    reportDetail.status_history.map((sh, idx) => (
                      <div key={idx} className="flex items-start justify-between py-1 border-b border-slate-800/60 last:border-0">
                        <div className="space-y-0.5">
                          <span className="text-cyan-300 font-bold">
                            {sh.old_status ? `${sh.old_status} → ` : ''}{sh.new_status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans block">{sh.reason}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Min {sh.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-24 text-center text-slate-500 space-y-2">
              <FileText className="w-10 h-10 text-slate-600" />
              <span className="text-sm">Select a work order from the left list to view lifecycle telemetry</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
