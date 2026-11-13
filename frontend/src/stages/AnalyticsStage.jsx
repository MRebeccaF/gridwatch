import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Download,
  PieChart as PieIcon,
  TrendingUp,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';

const COLORS = ['#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#a855f7', '#3b82f6'];

export const AnalyticsStage = () => {
  const { unlockStage } = useApp();
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    if (unlockStage) unlockStage('tests');
  }, [unlockStage]);

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data))
      .catch((err) => console.error(err));
  }, []);

  const handleExportCsv = () => {
    window.location.href = '/api/logs?format=csv';
  };

  const catData = analyticsData?.by_category?.map((c) => ({
    name: c.category,
    value: c.total,
  })) || [];

  const prioData = analyticsData?.by_priority?.map((p) => ({
    name: p.priority,
    value: p.total,
  })) || [];

  const zoneData = analyticsData?.by_zone?.map((z) => ({
    name: z.source_grid || `Zone ${z.zone_letter}`,
    total: z.total,
  })) || [];

  const decisionData = analyticsData?.decisions?.map((d) => ({
    name: d.decision,
    total: d.total,
  })) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              EXECUTIVE ANALYTICS & AUDIT TELEMETRY
            </span>
            <span className="text-xs text-slate-400">· Grid Monitoring</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            Anomaly Trends, Capacity & Dispatch Analytics
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Automated visual distribution charts summarizing category frequencies, priority allocations,
            substation grid loads, and routing table forwarding metrics.
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-600/20 transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Routing Logs (CSV)</span>
        </button>
      </div>

      {/* Grid of 4 Recharts Dashboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown (Pie) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-cyan-400" />
              Category Breakdown (5 Categories)
            </span>
          </div>

          <div className="h-64 w-full">
            {catData.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-24">No category data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {catData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Priority Distribution (Bar) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Priority Distribution (P1 - P4)
            </span>
          </div>

          <div className="h-64 w-full">
            {prioData.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-24">No priority data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prioData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Substation Grid Loads (Bar) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Substation Incidents Volume
            </span>
          </div>

          <div className="h-64 w-full">
            {zoneData.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-24">No substation data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Dispatch Decisions Breakdown (Bar) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Routing Engine Decision Breakdown
            </span>
          </div>

          <div className="h-64 w-full">
            {decisionData.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-24">No decisions recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decisionData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
