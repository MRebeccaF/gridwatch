import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Radio,
  Truck,
  HardHat,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  Wrench,
  Clock,
  CheckCircle2,
  ListOrdered,
  RotateCcw,
} from 'lucide-react';

export const DispatchFloorStage = () => {
  const { state, fetchState, addTickerMessage, unlockStage } = useApp();

  // Progressively unlock Crew Desk once the operator reaches Dispatch Floor
  React.useEffect(() => {
    unlockStage('crew');
  }, []);

  const [selectedReportForEscalation, setSelectedReportForEscalation] = useState(null);
  const [newPriority, setNewPriority] = useState('P1');
  const [escalationReason, setEscalationReason] = useState('Critical smoke observed on site');

  const [selectedReportForFixZone, setSelectedReportForFixZone] = useState(null);
  const [mappedZoneKey, setMappedZoneKey] = useState('B');

  const reports = state?.reports || [];
  const employees = state?.employees || [];
  const zones = state?.zones || [];
  const activeAssignments = state?.active_assignments || [];
  const recentLogs = state?.recent_logs || [];
  const metrics = state?.metrics || {};

  // Split reports into waiting and correction queues
  const waitingQueue = reports.filter(
    (r) => r.status === 'Pending' && r.queue_type === 'WAITING'
  );
  const correctionQueue = reports.filter(
    (r) => r.status === 'Pending' && r.queue_type === 'CORRECTION'
  );
  const activeDispatched = reports.filter(
    (r) => r.status === 'Assigned' || r.status === 'In Progress'
  );

  // Station loads & capacity calculation
  const getStationMetrics = (stCode) => {
    const zoneObj = zones.find((z) => z.station_code === stCode);
    const capacity = zoneObj?.capacity || 6;
    const assignedCount = activeAssignments.filter((a) => a.source_grid === stCode).length;
    const employeesAtHome = employees.filter((e) => e.home_grid === stCode);
    const idleCount = employeesAtHome.filter((e) => e.state === 'IDLE' && e.available_flag === 1).length;
    const isFull = assignedCount >= capacity;
    return { capacity, assignedCount, idleCount, isFull };
  };

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReportForEscalation) return;

    try {
      const res = await fetch(`/api/reports/${selectedReportForEscalation.id}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority, reason: escalationReason }),
      });
      if (res.ok) {
        addTickerMessage(`[Priority Modified] ${selectedReportForEscalation.id} changed to ${newPriority}: ${escalationReason}`);
        setSelectedReportForEscalation(null);
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFixZoneSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReportForFixZone) return;

    try {
      const res = await fetch(`/api/reports/${selectedReportForFixZone.id}/fix-zone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_key: mappedZoneKey, reason: 'Operator mapped peripheral zone to nearest depot' }),
      });
      if (res.ok) {
        addTickerMessage(`[Zone Fixed] Report ${selectedReportForFixZone.id} mapped to Zone ${mappedZoneKey} and re-dispatched.`);
        setSelectedReportForFixZone(null);
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              CENTRAL GRID DISPATCH FLOOR
            </span>
            <span className="text-xs text-slate-400">· Section 4.4 Dispatch Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            God's-Eye Substation Grid & Queue Floor
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Real-time multi-depot crew routing. Monitors station load rings (0/6 to 6/6), shortest-path overflow lending,
            P1 priority overrides, and automated queue draining.
          </p>
        </div>

        {/* Global Summary Pills */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Active Dispatched: <strong className="text-cyan-400">{activeDispatched.length}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Waiting Queue: <strong className="text-amber-400">{waitingQueue.length}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Correction Queue: <strong className="text-red-400">{correctionQueue.length}</strong>
          </div>
        </div>
      </div>

      {/* 5 Substation Grid Load Rings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {zones.map((z) => {
          const { capacity, assignedCount, idleCount, isFull } = getStationMetrics(z.station_code);
          const pct = Math.min(100, Math.round((assignedCount / (capacity || 1)) * 100));

          return (
            <div
              key={z.station_code}
              className={`p-4 rounded-xl border transition-all ${
                isFull
                  ? 'bg-red-950/40 border-red-700 shadow-lg shadow-red-900/30'
                  : 'bg-[#0b1329] border-slate-800 shadow-md'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div>
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1 font-mono">
                    <span className="text-cyan-400">[{z.key}]</span> {z.station_code}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate block max-w-[120px]">{z.name}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isFull ? 'bg-red-900 text-red-200 animate-pulse' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {assignedCount}/{capacity}
                </span>
              </div>

              {/* Progress Load Ring / Bar */}
              <div className="mt-3 space-y-1.5">
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isFull
                        ? 'bg-red-500'
                        : pct > 60
                        ? 'bg-amber-400'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Available Idle:</span>
                  <span className="text-emerald-400 font-bold font-mono">{idleCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Floor Split: Active Dispatches vs Conveyor Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Dispatches Table (2 cols) */}
        <div className="lg:col-span-2 bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-cyan-400" />
              Active Field Assignments & Remote Lending
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeDispatched.length} Active Cases
            </span>
          </div>

          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase sticky top-0">
                <tr>
                  <th className="py-2 px-3">Report ID</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Priority</th>
                  <th className="py-2 px-3">Substation</th>
                  <th className="py-2 px-3">Allocated Crew</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Escalate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-[11px]">
                {activeDispatched.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                      No active assignments. Submit a report or advance simulation clock.
                    </td>
                  </tr>
                ) : (
                  activeDispatched.map((r) => {
                    const assign = activeAssignments.find((a) => a.report_id === r.id);
                    const isRemote = assign && assign.home_grid !== assign.source_grid;

                    return (
                      <tr key={r.id} className="hover:bg-slate-900/60 transition">
                        <td className="py-2 px-3 font-bold text-cyan-400">{r.id}</td>
                        <td className="py-2 px-3">{r.category}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.priority === 'P1'
                                ? 'bg-purple-900 text-purple-200 border border-purple-600 animate-pulse'
                                : 'bg-purple-950 text-purple-300 border border-purple-900'
                            }`}
                          >
                            {r.priority}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-200">{r.source_grid}</td>
                        <td className="py-2 px-3">
                          <span className="flex items-center gap-1 text-slate-200">
                            {assign?.employee_code || '-'}
                            {isRemote && (
                              <span
                                className="px-1 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-800"
                                title={`Lent from ${assign.home_grid}`}
                              >
                                LENT ({assign.home_grid})
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              r.status === 'In Progress'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => setSelectedReportForEscalation(r)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700"
                          >
                            Modify
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Queues Conveyor (1 col) */}
        <div className="space-y-4">
          {/* Waiting Queue */}
          <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
                Waiting Queue ({waitingQueue.length})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">P1 &gt; Sub Time &gt; Seq</span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {waitingQueue.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-3">Waiting queue is empty.</p>
              ) : (
                waitingQueue.map((wq) => (
                  <div
                    key={wq.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-cyan-400 font-mono">{wq.id}</span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                          {wq.priority}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {wq.category} · Zone {wq.source_grid || wq.zone_letter}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedReportForEscalation(wq)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700"
                    >
                      Escalate
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Virtual CENTRAL Correction Queue */}
          <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                CENTRAL Correction Queue ({correctionQueue.length})
              </span>
              <span className="text-[10px] text-red-400 font-mono">UNKNOWN ZONES</span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {correctionQueue.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-3">No reports in correction queue.</p>
              ) : (
                correctionQueue.map((cq) => (
                  <div
                    key={cq.id}
                    className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-red-300 font-mono">{cq.id}</span>
                        <span className="text-[10px] text-slate-400">Letter: {cq.zone_letter}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{cq.meter_id}</span>
                    </div>
                    <button
                      onClick={() => setSelectedReportForFixZone(cq)}
                      className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] shadow"
                    >
                      Fix Zone
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Escalate Priority Modal */}
      {selectedReportForEscalation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleEscalateSubmit}
            className="bg-[#0f172a] border border-purple-500/50 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-100 text-sm">
                Escalate / De-escalate Priority: {selectedReportForEscalation.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedReportForEscalation(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-300">
                <span>Current Priority:</span>
                <span className="font-bold font-mono text-purple-300">
                  {selectedReportForEscalation.priority}
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">New Target Priority:</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                >
                  <option value="P1">P1 - Critical Outage (Preemption Eligible)</option>
                  <option value="P2">P2 - Elevated Tampering</option>
                  <option value="P3">P3 - Hardware / Communication</option>
                  <option value="P4">P4 - Routine Overconsumption</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Operational Reason:</label>
                <textarea
                  rows={2}
                  required
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400 text-xs resize-none"
                  placeholder="Justification for priority adjustment..."
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedReportForEscalation(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold shadow"
              >
                Apply Priority Change
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fix Zone Modal */}
      {selectedReportForFixZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleFixZoneSubmit}
            className="bg-[#0f172a] border border-cyan-500/50 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-100 text-sm">
                Map Unknown Zone Letter: {selectedReportForFixZone.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedReportForFixZone(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 text-[11px]">
                Meter <strong className="text-white">{selectedReportForFixZone.meter_id}</strong> contains zone
                letter <strong className="text-amber-300">'{selectedReportForFixZone.zone_letter}'</strong> which
                is outside the primary stations A-E. Map this meter to an active BESCOM depot for immediate dispatch:
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Target Station Depot:</label>
                <select
                  value={mappedZoneKey}
                  onChange={(e) => setMappedZoneKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                >
                  <option value="A">Zone A - Banashankari (BSK Depot)</option>
                  <option value="B">Zone B - JP Nagar (JP Depot)</option>
                  <option value="C">Zone C - HSR Layout (HSR Depot)</option>
                  <option value="D">Zone D - Koramangala (KOR Depot)</option>
                  <option value="E">Zone E - Whitefield (WFD Depot)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedReportForFixZone(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow"
              >
                Confirm & Re-Dispatch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
