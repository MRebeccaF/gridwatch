import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AppContext = createContext(null);

export const STAGES = [
  { id: 'briefing', label: 'Briefing & DFA', icon: 'BookOpen' },
  { id: 'map', label: 'Map Builder', icon: 'Network' },
  { id: 'report', label: 'Report Desk', icon: 'FileText' },
  { id: 'dispatch', label: 'Dispatch Floor', icon: 'Radio' },
  { id: 'crew', label: 'Crew Desk', icon: 'Users' },
  { id: 'tracker', label: 'Tracker', icon: 'Activity' },
  { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
  { id: 'tests', label: 'Test Lab', icon: 'ShieldCheck' },
];

export const AppProvider = ({ children }) => {
  const [activeStage, setActiveStage] = useState('briefing');
  // Unlock all stages by default so there are zero navigation restrictions
  const [unlockedStages, setUnlockedStages] = useState(new Set(STAGES.map((s) => s.id)));
  const [freeRoam, setFreeRoam] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [state, setState] = useState(null);
  const [tickerMessages, setTickerMessages] = useState([
    'GridWatch God\'s-eye supervisory system initialized.',
    'DFA & Regex Twin Validation engine active.',
    'Dijkstra shortest-path topology ready on 5 BESCOM substation grids.',
  ]);

  const eventSourceRef = useRef(null);

  const addTickerMessage = (msg) => {
    if (!msg) return;
    setTickerMessages((prev) => [msg, ...prev.slice(0, 49)]);
  };

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error('Failed to fetch state snapshot:', err);
    }
  };

  // Setup SSE stream with fallback polling every 1 second
  useEffect(() => {
    fetchState();

    const connectSSE = () => {
      try {
        const es = new EventSource('/api/stream');
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setState(data);
          } catch (e) {
            console.error('Error parsing SSE payload:', e);
          }
        };

        es.onerror = () => {
          console.warn('SSE connection failed or closed. Falling back to polling.');
          es.close();
        };
      } catch (e) {
        console.warn('SSE initialization failed. Using polling fallback.');
      }
    };

    connectSSE();

    // Polling fallback
    const interval = setInterval(fetchState, 1000);

    // Heartbeat to keep backend alive while tab is open
    const sendHeartbeat = () => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    };
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 2000);

    // When tab/window closes, send shutdown beacon
    const handleUnload = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/shutdown');
      }
    };
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(interval);
      clearInterval(heartbeatInterval);
      window.removeEventListener('pagehide', handleUnload);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Sync theme class to html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Stage unlocking
  const unlockStage = (id) => {
    setUnlockedStages((prev) => new Set([...prev, id]));
  };

  // Simulation controls
  const playSim = async () => {
    try {
      await fetch('/api/sim/play', { method: 'POST' });
      addTickerMessage('Simulation clock running (auto progress enabled).');
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const pauseSim = async () => {
    try {
      await fetch('/api/sim/pause', { method: 'POST' });
      addTickerMessage('Simulation clock paused.');
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const setSimSpeed = async (speed) => {
    try {
      await fetch('/api/sim/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed }),
      });
      addTickerMessage(`Simulation speed set to ${speed}x.`);
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const advanceSim = async (minutes) => {
    try {
      const res = await fetch('/api/sim/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      const data = await res.json();
      addTickerMessage(`Advanced simulation by ${minutes} min (clock now: ${data.current_clock}m).`);
      if (data.events && data.events.length > 0) {
        data.events.forEach((ev) => addTickerMessage(`[Sim Event] ${ev}`));
      }
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const resetSim = async () => {
    try {
      await fetch('/api/sim/reset', { method: 'POST' });
      addTickerMessage('System reset to initial state with clean seed data.');
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const triggerScenario = async (name) => {
    try {
      const res = await fetch(`/api/scenarios/${name}`, { method: 'POST' });
      const data = await res.json();
      addTickerMessage(`[Scenario] ${data.message || `Loaded scenario ${name}`}`);
      fetchState();
      return data;
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        state,
        activeStage,
        setActiveStage,
        unlockedStages,
        unlockStage,
        freeRoam,
        setFreeRoam,
        theme,
        setTheme,
        reduceMotion,
        setReduceMotion,
        showLegend,
        setShowLegend,
        tickerMessages,
        addTickerMessage,
        fetchState,
        playSim,
        pauseSim,
        setSimSpeed,
        advanceSim,
        resetSim,
        triggerScenario,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
