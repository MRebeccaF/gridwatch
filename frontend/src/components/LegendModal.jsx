import React from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  ShieldAlert,
  ZapOff,
  Gauge,
  Wrench,
  Wifi,
  HardHat,
  Truck,
  Moon,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const LegendModal = () => {
  const { showLegend, setShowLegend } = useApp();
  if (!showLegend) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-100">Visual Channel & Symbol Legend</span>
          </div>
          <button
            onClick={() => setShowLegend(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Colours */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Report Workflow Status (Color Channel)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
              <div>
                <span className="font-bold text-red-300">Pending</span>
                <p className="text-[10px] text-slate-400">Waiting or Correction queue</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <div>
                <span className="font-bold text-amber-300">Assigned</span>
                <p className="text-[10px] text-slate-400">Employee en route / allocated</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
              <div>
                <span className="font-bold text-cyan-300">In Progress</span>
                <p className="text-[10px] text-slate-400">Active repairs on site</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <div>
                <span className="font-bold text-emerald-300">Resolved</span>
                <p className="text-[10px] text-slate-400">Work finished, meter updated</p>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Scale */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Priority Badges (Purple Scale)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-purple-950 border border-purple-600 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold text-[10px] animate-pulse">P1</span>
              <div>
                <span className="font-bold text-purple-200">Critical / Outage</span>
                <p className="text-[10px] text-slate-400">Can trigger preemption</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-700 text-purple-100 font-bold text-[10px]">P2</span>
              <div>
                <span className="font-bold text-purple-300">Tampering</span>
                <p className="text-[10px] text-slate-400">High urgency review</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-900 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-800/80 text-purple-200 font-bold text-[10px]">P3</span>
              <div>
                <span className="font-bold text-purple-400">Hardware / Comm</span>
                <p className="text-[10px] text-slate-400">Standard crew dispatch</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-purple-950 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-bold text-[10px] border border-purple-900">P4</span>
              <div>
                <span className="font-bold text-purple-400">Overconsumption</span>
                <p className="text-[10px] text-slate-400">Consumption &gt; 200 kWh</p>
              </div>
            </div>
          </div>
        </div>

        {/* Anomaly Categories */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            5 Anomaly Categories (Icon Channel)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Tampering (TM)</span>
                <span className="text-slate-400 text-[11px] block">Top tie-breaker precedence · Base P2</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
              <ZapOff className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Outage (OT)</span>
                <span className="text-slate-400 text-[11px] block">Second precedence · Base P1</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
              <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Hardware (HA)</span>
                <span className="text-slate-400 text-[11px] block">Third precedence · Base P3</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800">
              <Wifi className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Communication (CM)</span>
                <span className="text-slate-400 text-[11px] block">Fourth precedence · Base P3</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-900 border border-slate-800 sm:col-span-2">
              <Gauge className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Overconsumption</span>
                <span className="text-slate-400 text-[11px] block">Fifth precedence · Consumption &gt; 200.00 kWh · Base P4</span>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Crew States */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Crew States (Icon & Motion Channel)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
              <HardHat className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <span className="font-bold text-slate-200 block">IDLE</span>
              <span className="text-[10px] text-slate-400">At home & eligible</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
              <Truck className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <span className="font-bold text-slate-200 block">TRAVELLING</span>
              <span className="text-[10px] text-slate-400">En route to site</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
              <Wrench className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <span className="font-bold text-slate-200 block">WORKING</span>
              <span className="text-[10px] text-slate-400">Repairs in progress</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
              <Truck className="w-4 h-4 text-indigo-400 opacity-60 mx-auto mb-1" />
              <span className="font-bold text-slate-200 block">RETURNING</span>
              <span className="text-[10px] text-slate-400">Travelling home</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
              <Moon className="w-4 h-4 text-slate-500 mx-auto mb-1" />
              <span className="font-bold text-slate-400 block">OFF_DUTY</span>
              <span className="text-[10px] text-slate-500">Not available</span>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setShowLegend(false)}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};
