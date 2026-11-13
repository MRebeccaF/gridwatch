import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Radio, ChevronUp, ChevronDown, ListFilter } from 'lucide-react';

export const EventTicker = () => {
  const { tickerMessages } = useApp();
  const [expanded, setExpanded] = useState(false);

  const latestMessage = tickerMessages[0] || 'System idle. Waiting for incoming telemetry.';

  return (
    <div className="bg-[#070b16] border-t border-slate-800 text-slate-300 text-xs z-40 fixed bottom-0 left-0 right-0">
      {expanded && (
        <div className="max-h-56 overflow-y-auto bg-[#0a1020] border-b border-slate-800 px-4 py-2 font-mono text-[11px] space-y-1">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-cyan-400" />
              Real-time Event Stream Audit ({tickerMessages.length} entries)
            </span>
          </div>
          {tickerMessages.map((msg, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-300 hover:text-white">
              <span className="text-slate-500 select-none">[{String(tickerMessages.length - idx).padStart(3, '0')}]</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1 text-cyan-400 font-bold tracking-wider shrink-0 font-mono text-[11px]">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>LIVE FEED:</span>
          </div>
          <span className="truncate text-slate-300 font-mono text-[11px]">
            {latestMessage}
          </span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition shrink-0 px-2 py-0.5 rounded hover:bg-slate-800"
        >
          <span>{expanded ? 'Collapse' : 'Audit Log'}</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
