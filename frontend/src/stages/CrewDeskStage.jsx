import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  HardHat,
  Truck,
  Wrench,
  Moon,
  Play,
  CheckCircle2,
  Sliders,
  AlertCircle,
  Building2,
  ShieldCheck,
} from 'lucide-react';

export const CrewDeskStage = () => {
  const { state, fetchState, addTickerMessage, unlockStage } = useApp();

  React.useEffect(() => {
    unlockStage('tracker');
  }, []);

  const [selectedStationCode, setSelectedStationCode] = useState('BSK');

  const zones = state?.zones || [];
  const employees = state?.employees || [];
  const reports = state?.reports || [];
  const activeAssignments = state?.active_assignments || [];

  const currentZone = zones.find((z) => z.station_code === selectedStationCode) || zones[0] || {};
  const currentEmployees = employees.filter((e) => e.home_grid === selectedStationCode);
  const currentCapacity = currentZone.capacity ?? 6;

  // Assigned reports where source_grid is this station or handled by this station's employee
  const stationReports = reports.filter(
    (r) =>
      r.source_grid === selectedStationCode &&
      (r.status === 'Assigned' || r.status === 'In Progress' || r.status === 'Resolved')
  );

  const handleToggleEmployeeDuty = async (empCode, currentAvailable) => {
    try {
      const res = await fetch(`/api/employees/${empCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_flag: currentAvailable === 1 ? 0 : 1 }),
      });
      if (res.ok) {
        addTickerMessage(`[Crew Duty] Employee ${empCode} toggled to ${currentAvailable === 1 ? 'OFF_DUTY' : 'IDLE'}.`);
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCapacityChange = async (newCap) => {
    try {
      const res = await fetch(`/api/grids/${currentZone.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: newCap }),
      });
      if (res.ok) {
        addTickerMessage(`[Capacity] Station ${selectedStationCode} capacity set to ${newCap}/6.`);
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartWork = async (reportId) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/start`, { method: 'POST' });
      if (res.ok) {
        addTickerMessage(`[Work Started] Report ${reportId} work started on site.`);
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveWork = async (reportId) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/resolve`, { method: 'POST' });
      if (res.ok) {
        addTickerMessage(`[Work Resolved] Report ${reportId} resolved! Meter reading updated.`);
        unlockStage('tracker');
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getEmployeeIcon = (stateStr) => {
    switch (stateStr) {
      case 'IDLE':
        return <HardHat className="w-5 h-5 text-emerald-400" />;
      case 'TRAVELLING':
        return <Truck className="w-5 h-5 text-cyan-400 animate-pulse" />;
      case 'WORKING':
        return <Wrench className="w-5 h-5 text-amber-400" />;
      case 'RETURNING':
        return <Truck className="w-5 h-5 text-indigo-400 opacity-60" />;
      case 'OFF_DUTY':
      default:
        return <Moon className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Station Switcher */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              SUBSTATION HANDLER DASHBOARD
            </span>
            <span className="text-xs text-slate-400">· Section 4.3 Employee & Crew Management</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            Station Crew Desk: {currentZone.name} ({currentZone.station_code})
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Depot: <span className="text-cyan-300 font-semibold">{currentZone.depot}</span> · Authority:{' '}
            <span className="text-slate-200">{currentZone.authority}</span>
          </p>
        </div>

        {/* Substation Dropdown Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-300">Switch Grid Station:</label>
          <select
            value={selectedStationCode}
            onChange={(e) => setSelectedStationCode(e.target.value)}
            className="bg-slate-950 border border-cyan-600 rounded-lg px-3 py-2 text-cyan-300 font-mono font-bold text-xs focus:outline-none shadow-lg shadow-cyan-950"
          >
            {zones.map((z) => (
              <option key={z.station_code} value={z.station_code}>
                [{z.key}] {z.station_code} - {z.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Capacity Setting Slider */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="font-bold text-slate-200 text-xs">
              Grid Crew Capacity Limit (Statement Maximum: 6 Open Cases)
            </span>
            <p className="text-[11px] text-slate-400">
              Caps how many active cases may be committed simultaneously to {selectedStationCode} crews before overflowing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((cap) => (
            <button
              key={cap}
              onClick={() => handleCapacityChange(cap)}
              className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition ${
                currentCapacity === cap
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/50 scale-105'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {cap}
            </button>
          ))}
          <span className="text-xs text-slate-400 font-mono ml-1">/ 6 max</span>
        </div>
      </div>

      {/* 6 Employee Cards for This Station */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          Station Crew Members ({currentEmployees.length} Technicians)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {currentEmployees.map((emp) => {
            const isAvail = emp.available_flag === 1 && emp.state !== 'OFF_DUTY';
            const hasTask = Boolean(emp.current_report_id);

            return (
              <div
                key={emp.code}
                className="bg-[#0b1329] border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                    {getEmployeeIcon(emp.state)}
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono uppercase ${
                      emp.state === 'IDLE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : emp.state === 'OFF_DUTY'
                        ? 'bg-slate-900 text-slate-500 border border-slate-800'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    }`}
                  >
                    {emp.state}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-slate-100 font-mono text-sm block">
                    {emp.code}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Loc: {emp.location}
                  </span>
                  {hasTask && (
                    <span className="text-[10px] text-cyan-400 font-mono block truncate mt-0.5">
                      Case: {emp.current_report_id}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleToggleEmployeeDuty(emp.code, emp.available_flag)}
                  className={`w-full py-1 rounded text-[10px] font-semibold transition border ${
                    emp.available_flag === 1
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                  }`}
                >
                  {emp.available_flag === 1 ? 'Set Off Duty' : 'Set Available'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Station Assigned Cases Table with Manual Start & Resolve Controls */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-cyan-400" />
            Station Active Jobs & Manual Dispatch Controls
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {stationReports.length} Cases in {selectedStationCode}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Work Code</th>
                <th className="py-2.5 px-3">Meter ID</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Assigned Crew</th>
                <th className="py-2.5 px-3">Workflow Status</th>
                <th className="py-2.5 px-3 text-right">Actions (Manual Mode)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-[11px]">
              {stationReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No active or historical reports recorded for station {selectedStationCode}.
                  </td>
                </tr>
              ) : (
                stationReports.map((r) => {
                  const assign = activeAssignments.find((a) => a.report_id === r.id);
                  const isAssigned = r.status === 'Assigned';
                  const isInProgress = r.status === 'In Progress';
                  const isResolved = r.status === 'Resolved';

                  return (
                    <tr key={r.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-2 px-3 font-bold text-cyan-400">{r.id}</td>
                      <td className="py-2 px-3 text-slate-300">{r.meter_id}</td>
                      <td className="py-2 px-3 text-slate-200">{r.category}</td>
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
                      <td className="py-2 px-3 text-slate-300">
                        {assign?.employee_code || '-'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isResolved
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : isInProgress
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAssigned && (
                            <button
                              onClick={() => handleStartWork(r.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] shadow"
                            >
                              <Play className="w-3 h-3" />
                              <span>Start Work</span>
                            </button>
                          )}
                          {isInProgress && (
                            <button
                              onClick={() => handleResolveWork(r.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] shadow"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Resolve</span>
                            </button>
                          )}
                          {isResolved && (
                            <span className="text-[10px] text-emerald-400 font-bold font-sans">
                              Completed ✓
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
