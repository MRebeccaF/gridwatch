import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Clock,
  Layers,
  ChevronDown,
  Sparkles,
  Zap,
} from 'lucide-react';

export const SimControlBar = () => {
  const { state, playSim, pauseSim, setSimSpeed, advanceSim, resetSim, triggerScenario } = useApp();
  const [scenarioOpen, setScenarioOpen] = useState(false);

  const sim = state?.sim_state || { clock_minutes: 540, speed: 1.0, is_running: 0, mode: 'auto' };
  const isRunning = Boolean(sim.is_running);
  const currentClock = sim.clock_minutes || 540;

  // Format minutes into Day and HH:MM
  const day = Math.floor(currentClock / 1440) + 1;
  const minuteOfDay = currentClock % 1440;
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const scenariosList = [
    { id: 'guided-demo', label: 'Guided Walkthrough Demo', desc: 'Full automated end-to-end pipeline' },
    { id: 'malformed-id', label: 'Malformed Meter ID (DFA Fail)', desc: 'Rejection diagnostics with position & expected symbols' },
    { id: 'unknown-zone', label: 'Unknown Zone GRIDK123R', desc: 'Routes to virtual CENTRAL Correction Queue' },
    { id: 'conflicting-patterns', label: 'Conflicting Anomaly Patterns', desc: 'Tampering chosen by fixed precedence' },
    { id: 'no-anomaly', label: 'No Anomaly Report', desc: 'Stored in audit table, never dispatched' },
    { id: 'reading-decreased', label: 'Reading Decreased Error', desc: 'Rollover or typo guard check' },
    { id: 'fill-bsk-overflow', label: 'Fill BSK (6/6) & Overflow', desc: 'Dijkstra shortest-path overflow to JP' },
    { id: 'handler-unavailable', label: 'Handler Unavailable / Off-Duty', desc: 'Automatic backup reassignment' },
    { id: 'p1-override', label: 'P1 Priority Override', desc: 'Preempts not-started P4 case' },
    { id: 'batch-10', label: 'Batch of 10 Reports', desc: 'Simultaneous timestamp concurrency test' },
    { id: 'escalate-deescalate', label: 'Escalate & De-escalate', desc: 'Audit logging in priority_history' },
    { id: 'reset', label: 'Reset & Re-seed State', desc: 'Re-initializes 5 zones and 30 employees' },
  ];

  const handleScenarioClick = async (scId) => {
    setScenarioOpen(false);
    await triggerScenario(scId);
  };

  return (
    <div className="bg-[#0b1329] border-b border-slate-800 px-4 py-2 text-slate-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Simulation Clock Display */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900 border border-cyan-800/50 shadow-inner font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold tracking-wider">
              DAY {day} · {timeFormatted}
            </span>
            <span className="text-[10px] text-slate-400">({currentClock}m)</span>
          </div>

          {/* Running Status Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              isRunning
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950/80 text-amber-400 border border-amber-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            {isRunning ? 'RUNNING' : 'PAUSED'}
          </span>

          {/* Mode Badge */}
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            MODE: {sim.mode?.toUpperCase()}
          </span>
        </div>

        {/* Playback Controls & Speed */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={pauseSim}
              className="flex items-center gap-1 px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition shadow-sm"
              title="Pause Simulation"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={playSim}
              className="flex items-center gap-1 px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition shadow-sm"
              title="Run Simulation"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Play</span>
            </button>
          )}

          {/* Speed Presets */}
          <div className="flex items-center bg-slate-900 rounded border border-slate-800 p-0.5">
            {[1, 2, 5, 10, 20].map((s) => (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  sim.speed === s
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Advance Step Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => advanceSim(1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] border border-slate-700 transition"
              title="Step forward 1 simulated minute"
            >
              +1m
            </button>
            <button
              onClick={() => advanceSim(5)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] border border-slate-700 transition"
              title="Step forward 5 simulated minutes"
            >
              +5m
            </button>
            <button
              onClick={() => advanceSim(15)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] border border-slate-700 transition"
              title="Step forward 15 simulated minutes"
            >
              +15m
            </button>
          </div>
        </div>

        {/* Scenarios & Reset Menu */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setScenarioOpen(!scenarioOpen)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-500 hover:to-blue-500 text-white font-medium border border-purple-400/40 shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Scenarios</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {scenarioOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-[#0d162d] border border-slate-700 rounded-lg shadow-2xl z-50 py-1.5 max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Deterministic Examiner Scenarios
                </div>
                {scenariosList.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => handleScenarioClick(sc.id)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition flex flex-col gap-0.5 border-b border-slate-800/50 last:border-0"
                  >
                    <div className="font-semibold text-slate-200 text-xs flex items-center justify-between">
                      <span>{sc.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{sc.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={resetSim}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 transition text-xs"
            title="Reset simulation and reseed database"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
