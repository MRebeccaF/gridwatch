import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileCode,
  AlertTriangle,
  HelpCircle,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

export const BriefingStage = () => {
  const { unlockStage } = useApp();

  const [automataData, setAutomataData] = useState(null);
  const [selectedAutomaton, setSelectedAutomaton] = useState('meter_id');
  const [testInput, setTestInput] = useState('GRIDB042R');
  const [dfaTrace, setDfaTrace] = useState(null);
  const [regexVerdict, setRegexVerdict] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [triedValid, setTriedValid] = useState(false);
  const [triedInvalid, setTriedInvalid] = useState(false);

  // Fetch DFA definitions from backend
  useEffect(() => {
    fetch('/api/automata')
      .then((res) => res.json())
      .then((data) => {
        setAutomataData(data);
      })
      .catch((err) => console.error(err));
  }, []);

  // Run simulation on input change
  const runEvaluation = (inputStr, autoKey = selectedAutomaton) => {
    if (!automataData || !automataData[autoKey]) return;

    const meta = automataData[autoKey];
    // Immediate local step calculation for fast UI response
    simulateDfaClient(inputStr, meta.dfa);

    // Call authoritative backend Python DFA simulator & regex twin
    fetch('/api/automata/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: autoKey, input: inputStr }),
    })
      .then((res) => res.json())
      .then((data) => {
        setRegexVerdict(data.regex_accepted);

        if (data.regex_accepted) {
          setTriedValid(true);
        } else {
          setTriedInvalid(true);
        }

        // Sync with authoritative backend DFA result
        setDfaTrace((prev) => ({
          ...prev,
          accepted: data.dfa_accepted,
          failIdx: data.failure_index,
          expected: data.expected_symbols || prev?.expected || [],
          errorMessage: data.error_message,
        }));
      })
      .catch((err) => console.error(err));
  };

  // Client-side stepping simulator for smooth animation
  const simulateDfaClient = (str, dfa) => {
    let curr = dfa.start_state;
    const trace = [];
    let failIdx = null;
    let expected = [];

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      let next = dfa.dead_state;
      let matchedLabel = 'invalid';

      // Find matching transition
      for (const t of dfa.transitions) {
        if (t.from_state === curr) {
          let ok = false;
          const quoted = t.label.match(/'([^']+)'/);
          if (quoted && quoted[1] === ch) {
            ok = true;
          } else if (t.label.includes('[0-9]') && /[0-9]/.test(ch)) {
            ok = true;
          } else if (t.label.includes('[A-Z]') && /[A-Z]/.test(ch)) {
            ok = true;
          } else if (t.label.includes('[R, Y, B]') && ['R', 'Y', 'B'].includes(ch)) {
            ok = true;
          } else if (t.label === ch) {
            ok = true;
          }

          if (ok) {
            next = t.to_state;
            matchedLabel = t.label;
            break;
          }
        }
      }

      trace.push({ step: i, char: ch, from: curr, to: next, label: matchedLabel });
      if (next === dfa.dead_state) {
        failIdx = i;
        expected = dfa.transitions.filter((t) => t.from_state === curr).map((t) => t.label);
        break;
      }
      curr = next;
    }

    const accepted = dfa.accept_states.includes(curr);
    if (!accepted && failIdx === null) {
      failIdx = str.length;
      expected = dfa.transitions.filter((t) => t.from_state === curr).map((t) => t.label);
    }

    setDfaTrace({
      accepted,
      finalState: curr,
      trace,
      failIdx,
      expected,
    });
    setCurrentStepIndex(trace.length - 1);
  };

  useEffect(() => {
    if (automataData) {
      runEvaluation(testInput, selectedAutomaton);
    }
  }, [automataData, selectedAutomaton]);

  // Stage clearing rule: Tried one valid and one invalid string
  useEffect(() => {
    if (triedValid && triedInvalid) {
      unlockStage('map');
    }
  }, [triedValid, triedInvalid]);

  const currAutomaton = automataData?.[selectedAutomaton];
  const dfaDef = currAutomaton?.dfa;

  const gapsAndDecisions = [
    {
      title: 'MERN Stack vs Flask + SQLite',
      statement: 'Problem states MERN in Q8, but Flask and SQLite in Q10.',
      gap: 'Direct conflict between Node/Express/Mongo vs Python/Flask/SQLite architectures.',
      decision: 'Resolved strictly in favor of React + Flask + SQLite (Q10 is specific and BCS503 automata theory is authored in Python).',
    },
    {
      title: 'Unspecified Letter Range & Phase',
      statement: 'Section 4 defines grid keys A to E. What about letters F to Z?',
      gap: 'The grammar allows [A-Z], but only 5 BESCOM stations exist in Bangalore.',
      decision: 'Format is valid for A to Z. Letters F to Z route to virtual CENTRAL Correction Queue with UNKNOWN_ZONE log.',
    },
    {
      title: 'Reading Format vs Classification Source',
      statement: 'Readings format has 5 integer digits, dot, 2 decimals, and literal kWh.',
      gap: 'Floating point rounding can corrupt billing increments and comparisons.',
      decision: 'Handled strictly as integer hundredths of kWh throughout database and comparison logic, never floats.',
    },
    {
      title: 'Missing Classification Criteria & Priority',
      statement: 'Q5 asks for 5 categories and deterministic tie-breaking.',
      gap: 'Multiple event patterns can trigger simultaneously on a single report.',
      decision: 'Fixed precedence order: Tampering > Outage > Hardware > Communication > Overconsumption. Most urgent base priority assigned.',
    },
    {
      title: 'Underconsumption Exclusion',
      statement: 'Examiners asked for exactly five categories.',
      gap: 'Underconsumption is mentioned in utility telemetry but omitted from the 5 mandatory categories.',
      decision: 'Underconsumption excluded from categories. Current < Previous is rejected as READING_DECREASED (rollover/typo).',
    },
    {
      title: 'Missing Override Rule Definition',
      statement: 'Preemption required for emergency P1 reports.',
      gap: 'Preempting active in-progress field work causes crew hazard.',
      decision: 'P1 override preempts lowest-priority (P4 first) NOT-STARTED assigned cases only. In-progress work is NEVER preempted.',
    },
    {
      title: 'Undefined Nearest Section',
      statement: 'Lend from nearest section on local overflow.',
      gap: 'Physical geographic distance vs network road transit time.',
      decision: 'Dijkstra all-pairs shortest paths computed dynamically over the weighted edge topology graph.',
    },
    {
      title: 'Crew vs Employee Capacity Interpretation',
      statement: 'Maximum of 6 open cases per crew.',
      gap: 'Station capacity vs individual employee concurrency.',
      decision: 'Each of the 5 stations has 6 named employees (e.g. BSK1..BSK6, total 30). Grid capacity defaults to 6 with 1 case per employee.',
    },
    {
      title: 'GRID Prefix as a Literal',
      statement: 'Meter ID format starts with GRID.',
      gap: 'Case sensitivity and trailing non-ASCII character matching.',
      decision: 'GRID treated as literal 4-character prefix; strict case sensitivity and ASCII fullmatch anchors enforced.',
    },
    {
      title: 'Deployment & No-Anomaly Outcome',
      statement: 'Inspectors report routine meters without faults.',
      gap: 'Reports with NONE and normal consumption must be handled cleanly.',
      decision: 'Stored with status REJECTED (NO_ANOMALY) for audit history; never dispatched into crew routing queues.',
    },
  ];

  const rubricMap = [
    { q: 'Q1', desc: 'DFA formal definition, 5-tuple, state diagram & transitions', tab: 'Briefing (DFA Lab)', test: 'T01, T02, T03, T05' },
    { q: 'Q2', desc: 'Equivalent regular expressions & comparison engine', tab: 'Briefing (DFA Lab)', test: 'T01, T04' },
    { q: 'Q3', desc: 'Failure diagnostics: exact character position & expected symbol set', tab: 'Briefing (DFA Lab)', test: 'T05' },
    { q: 'Q4', desc: 'Database schema, SQLite persistence & atomic transactions', tab: 'Crew Desk & Tracker', test: 'T11, T21, T26' },
    { q: 'Q5', desc: 'Five categories classification & fixed priority tie-breaking rule', tab: 'Report Desk & Briefing', test: 'T06, T07, T10' },
    { q: 'Q6', desc: 'Base priority mapping (P1-P4) & Urgency level adjustment', tab: 'Report Desk & Crew Desk', test: 'T06, T11, T22' },
    { q: 'Q7', desc: 'Network topology graph, station nodes & weighted transit edges', tab: 'Map Builder & Dispatch Floor', test: 'T15, T24, T25' },
    { q: 'Q8', desc: 'Dijkstra all-pairs shortest path calculation & explicit routing table', tab: 'Map Builder & Dispatch Floor', test: 'T15, T25' },
    { q: 'Q9', desc: 'Dispatch algorithm: Local crew allocation & capacity limits', tab: 'Dispatch Floor & Crew Desk', test: 'T14, T15' },
    { q: 'Q10', desc: 'Overflow lending rule with reserve constraint & P1 waiver', tab: 'Dispatch Floor', test: 'T15, T16' },
    { q: 'Q11', desc: 'Priority override: Preemption of low-priority not-started jobs', tab: 'Dispatch Floor', test: 'T18, T19' },
    { q: 'Q12', desc: '4-status lifecycle state machine (Pending, Assigned, In Progress, Resolved)', tab: 'Tracker & Crew Desk', test: 'T23, T27' },
    { q: 'Q13', desc: 'Simulation clock, automated travel/work durations & scenario suite', tab: 'Persistent Sim Bar & Test Lab', test: 'T21, T24, T27' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Stage Unlock Progress */}
      <div className="bg-gradient-to-r from-slate-900 to-[#0e1830] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              BCS503 AUTOMATA THEORY & FORMAL LANGUAGES
            </span>
            <span className="text-xs text-slate-400">· Assignment P9</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Interactive DFA Lab & System Blueprint
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Test the Deterministic Finite Automaton (DFA) state machines side-by-side with their
            equivalent regular expressions. Enter sample strings to step through the state transitions in real time.
          </p>
        </div>

        {/* Unlock tracker */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs flex items-center gap-4">
          <div>
            <span className="text-slate-400 text-[11px] block font-medium">STAGE COMPLETION:</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`flex items-center gap-1 ${triedValid ? 'text-emerald-400' : 'text-slate-500'}`}>
                {triedValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                1 Valid String
              </span>
              <span className={`flex items-center gap-1 ${triedInvalid ? 'text-emerald-400' : 'text-slate-500'}`}>
                {triedInvalid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                1 Invalid String
              </span>
            </div>
          </div>
          {triedValid && triedInvalid && (
            <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
              Map Builder Unlocked!
            </span>
          )}
        </div>
      </div>

      {/* (A) DFA LAB */}
      <section className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-base">Part A: Interactive DFA & Regex Twin Simulator</h3>
          </div>

          {/* Automaton Selector Tabs */}
          <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
            {[
              { id: 'meter_id', label: 'Meter ID (9 Steps)' },
              { id: 'reading', label: 'Reading (11 Steps)' },
              { id: 'event_code', label: 'Event Code' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedAutomaton(tab.id);
                  const def = automataData?.[tab.id];
                  if (def) setTestInput(def.example_valid);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  selectedAutomaton === tab.id
                    ? 'bg-cyan-600 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Preset Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Input String for {currAutomaton?.dfa?.name || 'DFA'}</span>
              <span className="text-[11px] font-mono text-cyan-400">Length: {testInput.length} chars</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => {
                  setTestInput(e.target.value);
                  runEvaluation(e.target.value);
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-cyan-300 focus:outline-none focus:border-cyan-500 shadow-inner"
                placeholder="Type string..."
              />
              <button
                onClick={() => runEvaluation(testInput)}
                className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate</span>
              </button>
            </div>

            {/* Quick Test Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-400">Presets:</span>
              {selectedAutomaton === 'meter_id' && (
                <>
                  <button
                    onClick={() => { setTestInput('GRIDB042R'); runEvaluation('GRIDB042R'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                  >
                    GRIDB042R (Valid)
                  </button>
                  <button
                    onClick={() => { setTestInput('GRIDB042X'); runEvaluation('GRIDB042X'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 font-mono"
                  >
                    GRIDB042X (Bad Phase)
                  </button>
                  <button
                    onClick={() => { setTestInput('gridB042R'); runEvaluation('gridB042R'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 font-mono"
                  >
                    gridB042R (Lowercase)
                  </button>
                  <button
                    onClick={() => { setTestInput('GRIDK123R'); runEvaluation('GRIDK123R'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono"
                  >
                    GRIDK123R (Zone K)
                  </button>
                </>
              )}
              {selectedAutomaton === 'reading' && (
                <>
                  <button
                    onClick={() => { setTestInput('00432.57kWh'); runEvaluation('00432.57kWh'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                  >
                    00432.57kWh (Valid)
                  </button>
                  <button
                    onClick={() => { setTestInput('00432.5kWh'); runEvaluation('00432.5kWh'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 font-mono"
                  >
                    00432.5kWh (1 Decimal)
                  </button>
                  <button
                    onClick={() => { setTestInput('00432,57kWh'); runEvaluation('00432,57kWh'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 font-mono"
                  >
                    00432,57kWh (Comma)
                  </button>
                  <button
                    onClick={() => { setTestInput('00432.57kwh'); runEvaluation('00432.57kwh'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 font-mono"
                  >
                    00432.57kwh (Bad Unit)
                  </button>
                </>
              )}
              {selectedAutomaton === 'event_code' && (
                <>
                  <button
                    onClick={() => { setTestInput('TM'); runEvaluation('TM'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                  >
                    TM (Tamper)
                  </button>
                  <button
                    onClick={() => { setTestInput('OT'); runEvaluation('OT'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                  >
                    OT (Outage)
                  </button>
                  <button
                    onClick={() => { setTestInput('NONE'); runEvaluation('NONE'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                  >
                    NONE
                  </button>
                  <button
                    onClick={() => { setTestInput('UNKNOWN'); runEvaluation('UNKNOWN'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 font-mono"
                  >
                    UNKNOWN
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Regex Twin Comparison Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Regex Twin & Twin Agreement
            </span>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-amber-300 truncate">
              {currAutomaton?.regex || '^...$'}
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">DFA Verdict:</span>
              <span className={`font-bold ${dfaTrace?.accepted ? 'text-emerald-400' : 'text-red-400'}`}>
                {dfaTrace?.accepted ? 'ACCEPTED' : 'REJECTED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Regex Verdict:</span>
              <span className={`font-bold ${regexVerdict ? 'text-emerald-400' : 'text-red-400'}`}>
                {regexVerdict ? 'ACCEPTED' : 'REJECTED'}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Twin Consensus:</span>
              {dfaTrace?.accepted === regexVerdict ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  AGREE (100%)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  DISAGREEMENT
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Informative Failure Diagnostic Banner */}
        {dfaTrace && !dfaTrace.accepted && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-lg p-3 text-xs text-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Automaton Syntax Rejection at Position {dfaTrace.failIdx}:</span>
              <p className="text-[11px] text-red-300 mt-0.5">
                {dfaTrace.expected && dfaTrace.expected.length > 0
                  ? `Expected symbol class: [${dfaTrace.expected.join(' or ')}], but received '${testInput[dfaTrace.failIdx] || 'EOF'}'.`
                  : 'String terminated unexpectedly or transitioned into the explicit DEAD trap state.'}
              </p>
            </div>
          </div>
        )}

        {/* Animated DFA State Chain Visualizer */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            State Machine Trace & Transition Walk
          </span>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center gap-1 min-w-max p-3 bg-slate-950 rounded-lg border border-slate-800">
              {dfaDef?.states.map((st, idx) => {
                const isStart = st === dfaDef.start_state;
                const isAccept = dfaDef.accept_states.includes(st);
                const isDead = st === dfaDef.dead_state;
                const isCurrent = dfaTrace?.finalState === st;
                const wasVisited = dfaTrace?.trace?.some((step) => step.from === st || step.to === st);

                return (
                  <React.Fragment key={st}>
                    <div
                      className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full font-mono text-xs font-bold transition-all ${
                        isCurrent
                          ? isAccept
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300 scale-105'
                            : isDead
                            ? 'bg-red-600 text-white shadow-lg shadow-red-500/50 ring-2 ring-red-300 animate-bounce'
                            : 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/50 ring-2 ring-cyan-200 scale-105'
                          : wasVisited
                          ? 'bg-slate-800 text-cyan-300 border border-cyan-800'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                    >
                      <span>{st}</span>
                      {isAccept && (
                        <div className="absolute -bottom-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
                      )}
                    </div>
                    {idx < dfaDef.states.length - 1 && (
                      <div className="flex flex-col items-center px-1 text-[10px] font-mono text-slate-500">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* (B) CLASSIFICATION RULES & PRIORITY MAP */}
      <section className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldCheck className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-slate-100 text-base">Part B: Five Categories & Priority Tie-Breaking Rule</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <span className="font-bold text-slate-200 text-xs uppercase tracking-wider block">
              1. Category Precedence Order
            </span>
            <p className="text-slate-400 text-[11px]">
              If multiple patterns match simultaneously (e.g. Outage event code and Overconsumption threshold breach),
              the winning category is decided strictly by this documented fixed hierarchy:
            </p>
            <ol className="space-y-1.5 font-mono text-[11px] list-decimal list-inside text-slate-300">
              <li className="text-amber-300 font-bold">Tampering (TM)</li>
              <li className="text-red-300 font-bold">Outage (OT)</li>
              <li className="text-cyan-300 font-bold">Hardware (HA)</li>
              <li className="text-blue-300 font-bold">Communication (CM)</li>
              <li className="text-purple-300 font-bold">Overconsumption (&gt; 200.00 kWh)</li>
            </ol>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <span className="font-bold text-slate-200 text-xs uppercase tracking-wider block">
              2. Base Priority & Urgency Adjustment
            </span>
            <p className="text-slate-400 text-[11px]">
              The base priority is the most urgent priority among ALL matched patterns, then elevated by urgency level:
            </p>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Outage Base:</span>
                <span className="text-purple-400 font-bold">P1 (Critical)</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Tampering Base:</span>
                <span className="text-purple-300 font-bold">P2 (Elevated)</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Hardware & Comm Base:</span>
                <span className="text-purple-200 font-bold">P3 (Routine)</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Overconsumption Base:</span>
                <span className="text-slate-400 font-bold">P4 (Low)</span>
              </div>
            </div>
            <div className="p-2 rounded bg-purple-950/40 border border-purple-800 text-[11px] text-purple-200">
              Urgency boost: <span className="font-semibold text-white">Critical sets P1</span>, <span className="font-semibold text-white">Elevated raises +1 level</span>, Routine maintains base.
            </div>
          </div>
        </div>
      </section>

      {/* (C) GAPS AND DECISIONS */}
      <section className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <HelpCircle className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-slate-100 text-base">Architectural Gaps & Documented Engineering Decisions</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gapsAndDecisions.map((g, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 space-y-2 text-xs">
              <span className="font-bold text-cyan-300 block text-xs">
                {idx + 1}. {g.title}
              </span>
              <div className="space-y-1 text-[11px]">
                <p className="text-slate-400"><strong className="text-slate-300">Prompt text:</strong> {g.statement}</p>
                <p className="text-amber-400/90"><strong className="text-amber-300">The Gap:</strong> {g.gap}</p>
                <p className="text-slate-200"><strong className="text-emerald-400">Our Decision:</strong> {g.decision}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* (D) RUBRIC MAP */}
      <section className="bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <FileCode className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-slate-100 text-base">College Assignment Rubric Mapping (Q1 to Q13)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Question</th>
                <th className="py-2.5 px-3">Rubric Requirement</th>
                <th className="py-2.5 px-3">Demonstrated In</th>
                <th className="py-2.5 px-3">Automated Tests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {rubricMap.map((r) => (
                <tr key={r.q} className="hover:bg-slate-900/50 transition">
                  <td className="py-2 px-3 font-bold text-cyan-400">{r.q}</td>
                  <td className="py-2 px-3 font-sans text-xs text-slate-200">{r.desc}</td>
                  <td className="py-2 px-3 text-amber-300">{r.tab}</td>
                  <td className="py-2 px-3 text-emerald-400">{r.test}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
