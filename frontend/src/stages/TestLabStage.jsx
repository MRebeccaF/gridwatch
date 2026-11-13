import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Terminal,
  RotateCcw,
} from 'lucide-react';

export const TestLabStage = () => {
  const { addTickerMessage } = useApp();

  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = async () => {
    setIsRunning(true);
    addTickerMessage('[Test Lab] Commenced execution of 27-test automated verification suite...');

    try {
      const res = await fetch('/api/tests/run');
      const data = await res.json();
      setTestResults(data);
      addTickerMessage(`[Test Lab Finished] Ran ${data.total} tests: ${data.passed} passed, ${data.failed} failed in ${data.duration_ms}ms.`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              BCS503 & BCS502 VERIFICATION TEST HARNESS
            </span>
            <span className="text-xs text-slate-400">· Section 9 Test Suite</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            Automated Examiner Test Lab (T01 - T27)
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Executes all 27 automated tests live inside the Python backend. Validates DFA state chains, 10,000 mutation twin
            comparisons, 5-category precedence, priority overrides, Dijkstra routing, and concurrency.
          </p>
        </div>

        {/* Run Button */}
        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>Running 27 Tests...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run Complete Suite (T01 - T27)</span>
            </>
          )}
        </button>
      </div>

      {/* Summary Scoreboard */}
      {testResults && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 shadow-md">
            <span className="text-slate-400 text-[11px] block font-semibold uppercase">Total Executed</span>
            <span className="text-2xl font-bold text-white font-mono mt-1 block">
              {testResults.total} Tests
            </span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800 shadow-md">
            <span className="text-emerald-400 text-[11px] block font-semibold uppercase">Tests Passed</span>
            <span className="text-2xl font-bold text-emerald-300 font-mono mt-1 block flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              {testResults.passed} / {testResults.total}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/60 shadow-md">
            <span className="text-red-400 text-[11px] block font-semibold uppercase">Tests Failed</span>
            <span className="text-2xl font-bold text-red-300 font-mono mt-1 block flex items-center gap-2">
              {testResults.failed > 0 ? (
                <XCircle className="w-6 h-6 text-red-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              )}
              {testResults.failed}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800 shadow-md">
            <span className="text-cyan-400 text-[11px] block font-semibold uppercase">Execution Time</span>
            <span className="text-2xl font-bold text-cyan-300 font-mono mt-1 block flex items-center gap-1.5">
              <Clock className="w-5 h-5 text-cyan-400" />
              {testResults.duration_ms} ms
            </span>
          </div>
        </div>
      )}

      {/* Table of Tests */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Pytest Test Manifest & Verification Verdicts
          </span>
          <span className="text-[10px] text-slate-400 font-mono">27 TEST CASES DEFINED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Test ID</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Assignment Syllabus Rubric</th>
                <th className="py-2.5 px-3">Verdict</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-[11px]">
              {testResults ? (
                testResults.results.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">{t.id}</td>
                    <td className="py-2.5 px-3 font-sans text-xs text-slate-200">{t.description}</td>
                    <td className="py-2.5 px-3 text-amber-300">{t.rubric}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                          t.status === 'PASS'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-red-950 text-red-300 border border-red-800'
                        }`}
                      >
                        {t.status === 'PASS' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{t.duration_ms} ms</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    Click "Run Complete Suite" above to execute all 27 verification tests against the Python backend.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
