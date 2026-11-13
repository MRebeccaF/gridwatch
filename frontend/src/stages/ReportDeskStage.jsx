import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Send,
  Sparkles,
  ShieldAlert,
  ZapOff,
  Wrench,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Gauge,
  ArrowRight,
  Flame,
} from 'lucide-react';

export const ReportDeskStage = () => {
  const { unlockStage, addTickerMessage } = useApp();

  const [formData, setFormData] = useState({
    reporter_name: 'Inspector Rajesh Kumar',
    reporter_contact: '+91-9876543210',
    meter_id: 'GRIDB042R',
    previous_reading: '00432.57kWh',
    current_reading: '00750.00kWh',
    event_code: 'TM',
    description: 'Enclosure seal broken and high power draw detected',
    urgency: 'Elevated',
  });

  const [validationResult, setValidationResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionOutcome, setSubmissionOutcome] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0); // 0: Idle, 1: Validate, 2: Classify, 3: Route, 4: Assign

  // Debounced live validation preview
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        setValidationResult(data);
      } catch (e) {
        console.error(e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [formData]);

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handlePreset = (preset) => {
    setSubmissionOutcome(null);
    setPipelineStep(0);
    setFormData(preset);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionOutcome(null);

    // Run pipeline animation
    setPipelineStep(1); // Validate
    await new Promise((r) => setTimeout(r, 250));
    setPipelineStep(2); // Classify
    await new Promise((r) => setTimeout(r, 250));
    setPipelineStep(3); // Route
    await new Promise((r) => setTimeout(r, 250));
    setPipelineStep(4); // Assign

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setSubmissionOutcome(data);

      if (data.validation_status === 'VALID') {
        addTickerMessage(`[Intake] Report ${data.id} accepted and dispatched via ${data.dispatch?.decision}.`);
        unlockStage('dispatch');
      } else {
        addTickerMessage(`[Intake Rejected] Report rejected: ${data.rejection_code} - ${data.rejection_message}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              FIELD INSPECTOR INTAKE PORTAL
            </span>
            <span className="text-xs text-slate-400">· Section 3.3 Report Intake</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            Smart Meter Anomaly Ingestion Desk
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Submit meter anomaly reports with live DFA syntax verification, automatic hundredths consumption
            calculation, category classification, and urgency priority assignment.
          </p>
        </div>

        {/* Quick Presets for Demo */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() =>
              handlePreset({
                reporter_name: 'Inspector Anand',
                reporter_contact: '+91-9844001122',
                meter_id: 'GRIDB042R',
                previous_reading: '00432.57kWh',
                current_reading: '00432.57kWh',
                event_code: 'OT',
                description: 'Feeder breaker tripped',
                urgency: 'Critical',
              })
            }
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            Critical Outage (P1)
          </button>
          <button
            onClick={() =>
              handlePreset({
                reporter_name: 'Inspector Anand',
                reporter_contact: '+91-9844001122',
                meter_id: 'GRIDB042R',
                previous_reading: '00100.00kWh',
                current_reading: '00400.00kWh',
                event_code: 'NONE',
                description: 'Unusual spike in power',
                urgency: 'Routine',
              })
            }
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            Overconsumption (300 kWh)
          </button>
          <button
            onClick={() =>
              handlePreset({
                reporter_name: 'Inspector Rao',
                reporter_contact: '+91-9844001122',
                meter_id: 'GRIDK123R',
                previous_reading: '00100.00kWh',
                current_reading: '00120.00kWh',
                event_code: 'HA',
                description: 'New industrial feeder',
                urgency: 'Routine',
              })
            }
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
          >
            Unknown Zone (GRIDK)
          </button>
          <button
            onClick={() =>
              handlePreset({
                reporter_name: 'Inspector Rao',
                reporter_contact: '+91-9844001122',
                meter_id: 'GRIDB042R',
                previous_reading: '00300.00kWh',
                current_reading: '00250.00kWh',
                event_code: 'TM',
                description: 'Reversed wiring test',
                urgency: 'Routine',
              })
            }
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-red-300 border border-slate-700"
          >
            Decreased Reading Err
          </button>
        </div>
      </div>

      {/* Main Intake Form & Live Telemetry Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form (2 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-[#0b1329] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" />
              Inspection Submission Form
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ALL FIELDS REQUIRED</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Reporter Name */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Reporter Name:</label>
              <input
                type="text"
                required
                value={formData.reporter_name}
                onChange={(e) => handleChange('reporter_name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                placeholder="Full Name"
              />
            </div>

            {/* Reporter Contact */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Reporter Contact (Phone / ID):</label>
              <input
                type="text"
                required
                value={formData.reporter_contact}
                onChange={(e) => handleChange('reporter_contact', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400 font-mono"
                placeholder="+91-XXXXXXXXXX"
              />
            </div>

            {/* Meter ID */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center justify-between">
                <span>Meter Identifier (9 Chars):</span>
                <span className="text-[10px] text-cyan-400 font-mono">GRID[A-Z][0-9]3[RYB]</span>
              </label>
              <input
                type="text"
                required
                value={formData.meter_id}
                onChange={(e) => handleChange('meter_id', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 focus:outline-none focus:border-cyan-400 font-mono text-sm tracking-wider"
                placeholder="e.g. GRIDB042R"
              />
            </div>

            {/* Event Code */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Anomaly Event Code:</label>
              <select
                value={formData.event_code}
                onChange={(e) => handleChange('event_code', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              >
                <option value="TM">TM - Tampering Detected (Shield Lock)</option>
                <option value="OT">OT - Outage / Supply Interruption (Plug Off)</option>
                <option value="HA">HA - Hardware / Terminal Defect (Wrench)</option>
                <option value="CM">CM - Communication Failure (Antenna)</option>
                <option value="NONE">NONE - Routine Check / Normal Reading</option>
              </select>
            </div>

            {/* Previous Reading */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center justify-between">
                <span>Previous Reading:</span>
                <span className="text-[10px] text-slate-400 font-mono">XXXXX.XXkWh</span>
              </label>
              <input
                type="text"
                required
                value={formData.previous_reading}
                onChange={(e) => handleChange('previous_reading', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                placeholder="00432.57kWh"
              />
            </div>

            {/* Current Reading */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center justify-between">
                <span>Current Reading:</span>
                <span className="text-[10px] text-slate-400 font-mono">XXXXX.XXkWh</span>
              </label>
              <input
                type="text"
                required
                value={formData.current_reading}
                onChange={(e) => handleChange('current_reading', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                placeholder="00750.00kWh"
              />
            </div>

            {/* Urgency */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Urgency Level:</label>
              <select
                value={formData.urgency}
                onChange={(e) => handleChange('urgency', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                <option value="Routine">Routine (No Priority Bump)</option>
                <option value="Elevated">Elevated (+1 Level Priority Boost)</option>
                <option value="Critical">Critical (Immediate P1 Forced)</option>
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-slate-300">Field Notes / Anomaly Description:</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 resize-none text-xs"
                placeholder="Enter observations, tamper indicators, physical defects..."
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono">
              Deterministic Ingestion Token Active
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Validating & Routing...' : 'Submit Report to Grid'}</span>
            </button>
          </div>
        </form>

        {/* Live Telemetry Preview & Packet Animation (1 col) */}
        <div className="space-y-4">
          {/* Packet Pipeline Animation Bar */}
          <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              Packet Routing Pipeline
            </span>
            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
              {[
                { step: 1, label: 'VALIDATE' },
                { step: 2, label: 'CLASSIFY' },
                { step: 3, label: 'ROUTE' },
                { step: 4, label: 'ASSIGN' },
              ].map((p) => {
                const isActive = pipelineStep === p.step;
                const isPassed = pipelineStep > p.step;
                return (
                  <div
                    key={p.step}
                    className={`p-1.5 rounded transition ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/50 scale-105'
                        : isPassed
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-900 text-slate-600 border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Classification & Priority Preview */}
          <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                Telemetry Preview
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                LIVE
              </span>
            </div>

            {validationResult?.is_valid ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Detected Category:</span>
                  <span className="font-bold text-cyan-300 font-mono flex items-center gap-1">
                    {validationResult.category}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Consumption Increment:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {validationResult.consumption_kwh.toFixed(2)} kWh
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Base Priority:</span>
                  <span className="font-mono text-purple-300 font-bold">
                    {validationResult.base_priority}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Final Priority (Adjusted):</span>
                  <span className="px-2 py-0.5 rounded bg-purple-900 text-purple-200 font-bold font-mono text-[11px] border border-purple-700">
                    {validationResult.priority}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Extracted Zone Letter:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    Zone {validationResult.zone_letter}
                  </span>
                </div>

                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                  <strong className="text-slate-300">Rule applied:</strong> {validationResult.decision_rule}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-red-950/30 border border-red-900 text-xs text-red-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validationResult?.rejection_code || 'VALIDATION ERROR'}</span>
                </div>
                <p className="text-[11px] text-red-200">{validationResult?.rejection_message}</p>
              </div>
            )}
          </div>

          {/* Submission Result Outcome Card */}
          {submissionOutcome && (
            <div
              className={`p-4 rounded-xl border shadow-xl text-xs space-y-2 animate-in fade-in duration-200 ${
                submissionOutcome.validation_status === 'VALID'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                  : 'bg-red-950/40 border-red-800 text-red-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="text-sm font-mono tracking-wider">
                  {submissionOutcome.id || 'REJECTED'}
                </span>
                <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-900">
                  {submissionOutcome.validation_status}
                </span>
              </div>
              {submissionOutcome.validation_status === 'VALID' ? (
                <div className="space-y-1 text-[11px]">
                  <p>
                    <strong>Dispatch Decision:</strong> {submissionOutcome.dispatch?.decision}
                  </p>
                  <p>
                    <strong>Assigned Crew:</strong> {submissionOutcome.dispatch?.employee || 'Queued'}
                  </p>
                  <p>
                    <strong>Destination Substation:</strong> {submissionOutcome.dispatch?.station || submissionOutcome.dispatch?.to || 'Correction Queue'}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-red-300">{submissionOutcome.rejection_message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
