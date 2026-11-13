import React from 'react';
import { useApp, STAGES } from '../context/AppContext';
import {
  Zap,
  Sun,
  Moon,
  Unlock,
  Lock,
  HelpCircle,
  Eye,
  EyeOff,
  BookOpen,
  Network,
  FileText,
  Radio,
  Users,
  Activity,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

const ICON_MAP = {
  BookOpen,
  Network,
  FileText,
  Radio,
  Users,
  Activity,
  BarChart3,
  ShieldCheck,
};

export const Header = () => {
  const {
    activeStage,
    setActiveStage,
    unlockedStages,
    freeRoam,
    setFreeRoam,
    theme,
    setTheme,
    reduceMotion,
    setReduceMotion,
    setShowLegend,
  } = useApp();

  return (
    <header className="bg-slate-900/90 dark:bg-[#0c1322]/95 border-b border-slate-800 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider text-slate-100 font-mono">
                GRID<span className="text-cyan-400">WATCH</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
                P9 SIMULATOR
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              BCS503 Automata & BCS502 Network Dispatch
            </p>
          </div>
        </div>

        {/* Stage Stepper */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          {STAGES.map((s, idx) => {
            const Icon = ICON_MAP[s.icon] || Zap;
            const isUnlocked = freeRoam || unlockedStages.has(s.id);
            const isActive = activeStage === s.id;

            return (
              <button
                key={s.id}
                disabled={!isUnlocked}
                onClick={() => setActiveStage(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/25'
                    : isUnlocked
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    : 'text-slate-600 cursor-not-allowed opacity-50'
                }`}
                title={!isUnlocked ? 'Complete previous stage or toggle Free Roam' : ''}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
                {!isUnlocked && !freeRoam && (
                  <Lock className="w-3 h-3 text-slate-600 ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          {/* Free Roam presentation switch */}
          <button
            onClick={() => setFreeRoam(!freeRoam)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              freeRoam
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Free Roam to unlock all tabs for presentation Q&A"
          >
            {freeRoam ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Free Roam</span>
          </button>

          {/* Legend Popover */}
          <button
            onClick={() => setShowLegend(true)}
            className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
            title="Visual Legend & Color Keys"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Reduce Motion toggle */}
          <button
            onClick={() => setReduceMotion(!reduceMotion)}
            className={`p-1.5 rounded border transition-colors ${
              reduceMotion
                ? 'bg-cyan-950 text-cyan-400 border-cyan-800'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={reduceMotion ? 'Reduced motion ON' : 'Enable reduced motion'}
          >
            {reduceMotion ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
