import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../context/AppContext';
import {
  Network,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon,
  Trash2,
  Edit2,
  HardHat,
} from 'lucide-react';

const INITIAL_NODES = [
  {
    id: 'BSK',
    position: { x: 100, y: 180 },
    data: { label: 'Banashankari (BSK)', code: 'BSK', key: 'A', depot: 'BSK Depot', authority: 'Executive Engineer, BSK' },
    style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #0284c7', borderRadius: '10px', padding: '10px', minWidth: '150px' },
  },
  {
    id: 'JP',
    position: { x: 220, y: 320 },
    data: { label: 'JP Nagar (JP)', code: 'JP', key: 'B', depot: 'JP Depot', authority: 'Executive Engineer, JP' },
    style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #0284c7', borderRadius: '10px', padding: '10px', minWidth: '150px' },
  },
  {
    id: 'HSR',
    position: { x: 420, y: 280 },
    data: { label: 'HSR Layout (HSR)', code: 'HSR', key: 'C', depot: 'HSR Depot', authority: 'Executive Engineer, HSR' },
    style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #0284c7', borderRadius: '10px', padding: '10px', minWidth: '150px' },
  },
  {
    id: 'KOR',
    position: { x: 300, y: 80 },
    data: { label: 'Koramangala (KOR)', code: 'KOR', key: 'D', depot: 'KOR Depot', authority: 'Executive Engineer, KOR' },
    style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #0284c7', borderRadius: '10px', padding: '10px', minWidth: '150px' },
  },
  {
    id: 'WFD',
    position: { x: 560, y: 90 },
    data: { label: 'Whitefield (WFD)', code: 'WFD', key: 'E', depot: 'WFD Depot', authority: 'Executive Engineer, WFD' },
    style: { background: '#0f172a', color: '#38bdf8', border: '2px solid #0284c7', borderRadius: '10px', padding: '10px', minWidth: '150px' },
  },
];

const INITIAL_EDGES = [
  { id: 'e-BSK-JP', source: 'BSK', target: 'JP', label: '10 min', data: { weight: 10 }, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e-JP-HSR', source: 'JP', target: 'HSR', label: '20 min', data: { weight: 20 }, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e-HSR-KOR', source: 'HSR', target: 'KOR', label: '10 min', data: { weight: 10 }, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e-BSK-KOR', source: 'BSK', target: 'KOR', label: '25 min', data: { weight: 25 }, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e-KOR-WFD', source: 'KOR', target: 'WFD', label: '35 min', data: { weight: 35 }, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e-HSR-WFD', source: 'HSR', target: 'WFD', label: '40 min', data: { weight: 40 }, animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
];

export const MapBuilderStage = () => {
  const { state, unlockStage, addTickerMessage } = useApp();
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState(INITIAL_EDGES);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [edgeWeightInput, setEdgeWeightInput] = useState('10');
  const [routingTable, setRoutingTable] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // Fetch routing table on mount
  const fetchRoutingTable = async () => {
    try {
      const res = await fetch('/api/routing-table');
      if (res.ok) {
        const data = await res.json();
        setRoutingTable(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRoutingTable();
  }, []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: `e-${params.source}-${params.target}`,
        label: '15 min',
        data: { weight: 15 },
        animated: true,
        style: { stroke: '#06b6d4', strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    []
  );

  const handleEdgeClick = (_, edge) => {
    setSelectedEdge(edge);
    setEdgeWeightInput(String(edge.data?.weight || 10));
  };

  const handleUpdateEdgeWeight = () => {
    if (!selectedEdge) return;
    const w = parseInt(edgeWeightInput, 10) || 10;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdge.id
          ? { ...e, label: `${w} min`, data: { ...e.data, weight: w } }
          : e
      )
    );
    setSelectedEdge(null);
  };

  const handleDeleteEdge = () => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    setSelectedEdge(null);
  };

  const handleSaveGraph = async () => {
    const formattedEdges = edges.map((e) => ({
      from_station: e.source,
      to_station: e.target,
      weight: e.data?.weight || 10,
    }));

    try {
      const res = await fetch('/api/edges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedEdges),
      });
      if (res.ok) {
        setIsSaved(true);
        addTickerMessage('Network topology and weights saved to database.');
        await fetchRoutingTable();
        unlockStage('report');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetGraph = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedEdge(null);
  };

  const isConnected = routingTable?.is_connected ?? true;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-[#0b1329] border border-cyan-900/40 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              BCS502 COMPUTER NETWORKS
            </span>
            <span className="text-xs text-slate-400">· Section 4 Network Model</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            Network Topology Graph & Dijkstra Routing Engine
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Drag station nodes to arrange geography. Draw edges by dragging between substation handles.
            Click any edge to edit travel weight in minutes. Dijkstra recalculates all-pairs shortest paths live.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSaveGraph}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save & Recompute Routes</span>
          </button>
        </div>
      </div>

      {/* Disconnection Warning */}
      {!isConnected && (
        <div className="bg-amber-950/40 border border-amber-600/80 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Topology Disconnection Warning:</span>
            <p className="text-[11px] text-amber-300 mt-0.5">
              The network graph is disconnected! One or more substation nodes are isolated. Overflow dispatch and remote crew lending will fail until a path is re-established.
            </p>
          </div>
        </div>
      )}

      {/* Main Canvas & Routing Table Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* React Flow Editor (2 cols) */}
        <div className="lg:col-span-2 bg-[#080d1a] border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative h-[500px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={handleEdgeClick}
            fitView
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="bg-slate-900 border border-slate-700 text-white rounded-lg p-1" />
          </ReactFlow>

          {/* Edge Edit Overlay Modal */}
          {selectedEdge && (
            <div className="absolute top-4 left-4 bg-slate-900/95 border border-cyan-500/60 rounded-lg p-3 shadow-2xl z-20 w-64 space-y-2 backdrop-blur">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-300">
                  Edge: {selectedEdge.source} ↔ {selectedEdge.target}
                </span>
                <button
                  onClick={() => setSelectedEdge(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Travel Time (Minutes):</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={edgeWeightInput}
                  onChange={(e) => setEdgeWeightInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleDeleteEdge}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/40"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={handleUpdateEdgeWeight}
                  className="flex items-center gap-1 text-[11px] bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1 rounded"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Update</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Dijkstra Routing Table (1 col) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <TableIcon className="w-3.5 h-3.5 text-cyan-400" />
                Dijkstra Shortest Paths Table
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                5 BESCOM NODES
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Generated all-pairs shortest paths matrix showing lowest travel costs and next-hop forwarding decisions:
            </p>

            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-1.5 px-2">Src</th>
                    <th className="py-1.5 px-2">Dst</th>
                    <th className="py-1.5 px-2">Cost</th>
                    <th className="py-1.5 px-2">Next</th>
                    <th className="py-1.5 px-2">Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-[11px]">
                  {routingTable?.routing_table &&
                    Object.entries(routingTable.routing_table).flatMap(([src, dsts]) =>
                      Object.entries(dsts)
                        .filter(([dst]) => src !== dst)
                        .map(([dst, info]) => (
                          <tr key={`${src}-${dst}`} className="hover:bg-slate-900/60">
                            <td className="py-1 px-2 font-bold text-cyan-400">{src}</td>
                            <td className="py-1 px-2 font-bold text-slate-300">{dst}</td>
                            <td className="py-1 px-2 text-amber-300">
                              {info.reachable ? `${info.cost}m` : '∞'}
                            </td>
                            <td className="py-1 px-2 text-emerald-400">
                              {info.reachable ? info.next_hop : '-'}
                            </td>
                            <td className="py-1 px-2 text-slate-400 text-[10px] truncate max-w-[100px]">
                              {info.reachable ? info.path.join('→') : 'Unreachable'}
                            </td>
                          </tr>
                        ))
                    )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Tie-breaking: Cost &gt; Hops &gt; Alphabetical</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
