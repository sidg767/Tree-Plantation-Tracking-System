import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Route, Search, TreePine, Info, Play, RotateCcw, Weight } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Euclidean distance between two tree nodes */
function dist(a, b) {
  return Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y);
}

/**
 * Build a WEIGHTED adjacency list: graph[id] = [{ id, weight }, ...]
 * Each node connects to its k nearest neighbours.
 * Weight = Euclidean distance (scaled ×100 and rounded for display).
 */
function buildWeightedGraph(trees, k = 3) {
  const graph = {};
  trees.forEach(t => {
    graph[t.treeId] = trees
      .filter(o => o.treeId !== t.treeId)
      .map(o => ({ id: o.treeId, weight: dist(t, o) }))
      .sort((a, b) => a.weight - b.weight)
      .slice(0, k);
  });
  return graph;
}

/**
 * Dijkstra's algorithm on a weighted adjacency list.
 * Returns { path: string[], totalCost: number } or { path: [], totalCost: 0 }.
 *
 * Uses a simple min-priority queue (sorted array).
 */
function dijkstra(graph, start, end) {
  const INF = Infinity;
  const dist  = {};  // best known cost to each node
  const prev  = {};  // predecessor map for path reconstruction
  const pq    = []; // [cost, nodeId]

  // Initialise
  Object.keys(graph).forEach(id => { dist[id] = INF; prev[id] = null; });
  dist[start] = 0;
  pq.push([0, start]);

  while (pq.length) {
    // Pop minimum-cost entry
    pq.sort((a, b) => a[0] - b[0]);
    const [cost, u] = pq.shift();

    if (u === end) break;
    if (cost > dist[u]) continue; // stale entry

    for (const { id: v, weight } of graph[u] || []) {
      const newCost = dist[u] + weight;
      if (newCost < dist[v]) {
        dist[v] = newCost;
        prev[v] = u;
        pq.push([newCost, v]);
      }
    }
  }

  if (dist[end] === INF) return { path: [], totalCost: 0 };

  // Reconstruct path
  const path = [];
  for (let cur = end; cur !== null; cur = prev[cur]) path.unshift(cur);
  return { path, totalCost: dist[end] };
}

// ── coordinate projection ─────────────────────────────────────────────────────

function projectNodes(trees, W, H, padding = 52) {
  if (!trees.length) return {};
  const xs = trees.map(t => t.location.x);
  const ys = trees.map(t => t.location.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const map = {};
  trees.forEach(t => {
    map[t.treeId] = {
      x: padding + ((t.location.x - minX) / rangeX) * (W - padding * 2),
      y: padding + ((t.location.y - minY) / rangeY) * (H - padding * 2),
    };
  });
  return map;
}

// ── GraphCanvas ───────────────────────────────────────────────────────────────

function GraphCanvas({ trees, graph, path, startId, endId }) {
  const W = 700, H = 440;
  const pos = projectNodes(trees, W, H);

  // Sets for fast lookup
  const pathSet   = new Set(path);
  const pathEdges = new Set();
  path.forEach((id, i) => {
    if (i < path.length - 1) {
      pathEdges.add(`${id}|${path[i + 1]}`);
      pathEdges.add(`${path[i + 1]}|${id}`); // undirected
    }
  });

  const healthColor = {
    Excellent: '#16a34a',
    Good:      '#65a30d',
    Average:   '#ca8a04',
    Poor:      '#dc2626',
  };

  // Deduplicate edges
  const edges = [];
  const seen  = new Set();
  Object.entries(graph).forEach(([from, neighbors]) => {
    neighbors.forEach(({ id: to, weight }) => {
      const key = [from, to].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ from, to, weight, key });
      }
    });
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-2xl border border-white/20 bg-gradient-to-br from-green-950/80 to-slate-900/80 backdrop-blur-md shadow-2xl"
      style={{ minHeight: 300 }}
    >
      {/* Subtle grid */}
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 14 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * 52 + 20} cy={r * 56 + 20} r={1} fill="rgba(255,255,255,0.05)" />
        ))
      )}

      {/* ── Edges ── */}
      {edges.map(({ from, to, weight, key }) => {
        const isPath = pathEdges.has(`${from}|${to}`);
        const p1 = pos[from], p2 = pos[to];
        if (!p1 || !p2) return null;

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const label = (weight * 100).toFixed(1); // scale for readability

        return (
          <g key={key}>
            <line
              x1={p1.x} y1={p1.y}
              x2={p2.x} y2={p2.y}
              stroke={isPath ? '#4ade80' : 'rgba(255,255,255,0.13)'}
              strokeWidth={isPath ? 3 : 1.5}
              strokeDasharray={isPath ? '0' : '5 4'}
              style={isPath ? { filter: 'drop-shadow(0 0 5px #4ade80)' } : {}}
            />

            {/* Weight label bubble */}
            <rect
              x={mx - 13} y={my - 8}
              width={26} height={14}
              rx={4}
              fill={isPath ? 'rgba(74,222,128,0.18)' : 'rgba(0,0,0,0.45)'}
              stroke={isPath ? '#4ade80' : 'rgba(255,255,255,0.1)'}
              strokeWidth={0.8}
            />
            <text
              x={mx} y={my + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={7} fontWeight={isPath ? '700' : '500'}
              fill={isPath ? '#4ade80' : 'rgba(255,255,255,0.45)'}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* ── Nodes ── */}
      {trees.map(t => {
        const p = pos[t.treeId];
        if (!p) return null;
        const isStart = t.treeId === startId;
        const isEnd   = t.treeId === endId;
        const inPath  = pathSet.has(t.treeId);
        const ring  = isStart ? '#22d3ee' : isEnd ? '#f472b6' : inPath ? '#4ade80' : 'rgba(255,255,255,0.2)';
        const fill  = isStart ? '#0e7490' : isEnd ? '#9d174d' : inPath ? '#166534' : '#1e3a2f';
        const glow  = isStart || isEnd || inPath;

        return (
          <g key={t.treeId} style={glow ? { filter: `drop-shadow(0 0 7px ${ring})` } : {}}>
            {/* Outer pulse ring for start/end */}
            {(isStart || isEnd) && (
              <circle cx={p.x} cy={p.y} r={24} fill="none" stroke={ring} strokeWidth={1} opacity={0.4} />
            )}
            <circle cx={p.x} cy={p.y} r={18} fill={fill} stroke={ring} strokeWidth={2.5} />

            {/* Health dot */}
            <circle
              cx={p.x + 12} cy={p.y - 12} r={5}
              fill={healthColor[t.health] || '#888'}
              stroke="#0f172a" strokeWidth={1.5}
            />

            {/* Node ID */}
            <text
              x={p.x} y={p.y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fontWeight="800" fill="white"
            >
              {t.treeId}
            </text>

            {/* Species label */}
            <text x={p.x} y={p.y + 31} textAnchor="middle" fontSize={7.5} fill="rgba(255,255,255,0.55)">
              {t.species.length > 10 ? t.species.slice(0, 9) + '…' : t.species}
            </text>
          </g>
        );
      })}

      {/* ── Node legend ── */}
      {[
        { color: '#22d3ee', label: 'Start' },
        { color: '#f472b6', label: 'End' },
        { color: '#4ade80', label: 'Path' },
        { color: 'rgba(255,255,255,0.25)', label: 'Other' },
      ].map(({ color, label }, i) => (
        <g key={label} transform={`translate(${14 + i * 76}, ${H - 18})`}>
          <circle r={5} fill={color} />
          <text x={9} y={1} dominantBaseline="middle" fontSize={9} fill="rgba(255,255,255,0.6)">{label}</text>
        </g>
      ))}

      {/* ── Health legend ── */}
      {[
        { color: '#16a34a', label: 'Excellent' },
        { color: '#65a30d', label: 'Good' },
        { color: '#ca8a04', label: 'Average' },
        { color: '#dc2626', label: 'Poor' },
      ].map(({ color, label }, i) => (
        <g key={label} transform={`translate(${W - 252 + i * 64}, ${H - 18})`}>
          <circle r={4} fill={color} />
          <text x={7} y={1} dominantBaseline="middle" fontSize={8} fill="rgba(255,255,255,0.5)">{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TraversalPage() {
  const [trees,     setTrees]     = useState([]);
  const [startId,   setStartId]   = useState('');
  const [endId,     setEndId]     = useState('');
  const [path,      setPath]      = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [graph,     setGraph]     = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/trees')
      .then(res => {
        setTrees(res.data);
        setGraph(buildWeightedGraph(res.data, 3));
      })
      .catch(() => setError('Failed to fetch trees. Is the backend running?'));
  }, []);

  const runDijkstra = () => {
    if (!startId || !endId) { setError('Please select both start and end trees.'); return; }
    if (startId === endId)  { setError('Start and end must be different trees.');   return; }
    setLoading(true);
    setError('');
    setTimeout(() => {
      const { path: result, totalCost: cost } = dijkstra(graph, startId, endId);
      if (result.length) {
        setPath(result);
        setTotalCost(cost);
      } else {
        setError('No path found between these trees.');
        setPath([]);
        setTotalCost(0);
      }
      setLoading(false);
    }, 120);
  };

  const reset = () => { setPath([]); setStartId(''); setEndId(''); setError(''); setTotalCost(0); };

  // Count unique edges
  const edgeCount = (() => {
    const seen = new Set();
    Object.entries(graph).forEach(([from, nbs]) =>
      nbs.forEach(({ id: to }) => seen.add([from, to].sort().join('|')))
    );
    return seen.size;
  })();

  const healthBadge = {
    Excellent: 'bg-green-100 text-green-700',
    Good:      'bg-lime-100 text-lime-700',
    Average:   'bg-yellow-100 text-yellow-700',
    Poor:      'bg-red-100 text-red-700',
  };

  // Get edge weight between two consecutive path nodes for display
  const edgeWeight = (fromId, toId) => {
    const nb = (graph[fromId] || []).find(n => n.id === toId);
    return nb ? (nb.weight * 100).toFixed(2) : '—';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto backdrop-blur-sm min-h-screen pb-24">

      {/* Header */}
      <header className="flex items-center gap-3 mb-8 text-white">
        <div className="bg-green-600 p-3 rounded-full shadow-lg">
          <Route size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Tree Traversal</h1>
          <p className="text-green-200 text-sm">
            Weighted graph · Dijkstra's shortest path algorithm
          </p>
        </div>
      </header>

      {/* Controls + Stats */}
      <div className="grid lg:grid-cols-4 gap-4 mb-6">

        {/* Control panel */}
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 lg:col-span-1">
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Search size={16} className="text-green-600" /> Find Shortest Path
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Start Tree</label>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white text-sm"
                value={startId} onChange={e => { setStartId(e.target.value); setPath([]); setTotalCost(0); }}
              >
                <option value="">Select Start</option>
                {trees.map(t => <option key={t.treeId} value={t.treeId}>{t.species} ({t.treeId})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">End Tree</label>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white text-sm"
                value={endId} onChange={e => { setEndId(e.target.value); setPath([]); setTotalCost(0); }}
              >
                <option value="">Select End</option>
                {trees.map(t => <option key={t.treeId} value={t.treeId}>{t.species} ({t.treeId})</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={runDijkstra} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                <Play size={14} /> {loading ? 'Running…' : 'Run Dijkstra'}
              </button>
              <button
                onClick={reset}
                className="p-2.5 rounded-xl border-2 border-gray-100 hover:border-red-300 text-gray-400 hover:text-red-400 transition-all"
                title="Reset"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="lg:col-span-3 grid sm:grid-cols-4 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">{trees.length}</p>
            <p className="text-green-200 text-sm font-medium">Nodes</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">{edgeCount}</p>
            <p className="text-green-200 text-sm font-medium">Weighted Edges</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">{path.length ? path.length - 1 : '—'}</p>
            <p className="text-green-200 text-sm font-medium">Hops</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">
              {totalCost ? (totalCost * 100).toFixed(2) : '—'}
            </p>
            <p className="text-green-200 text-sm font-medium">Total Distance</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-3 mb-4 text-sm">
          <span className="font-medium">⚠ {error}</span>
        </div>
      )}

      {/* Graph */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
          <Info size={13} />
          Weighted graph · each edge label = distance × 100 · k=3 nearest neighbours
        </div>
        {trees.length > 0
          ? <GraphCanvas trees={trees} graph={graph} path={path} startId={startId} endId={endId} />
          : <div className="h-64 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 text-sm">Loading graph…</div>
        }
      </div>

      {/* Dijkstra Path result */}
      {path.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Weight size={18} className="text-green-600" />
              Dijkstra's Shortest Path
              <span className="text-sm font-normal text-gray-400">
                ({path.length} nodes · {path.length - 1} hops)
              </span>
            </h2>
            <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full">
              Total cost: {(totalCost * 100).toFixed(2)} units
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {path.map((nodeId, index) => {
              const tree     = trees.find(t => t.treeId === nodeId);
              const isStart  = index === 0;
              const isEnd    = index === path.length - 1;
              const nextId   = path[index + 1];
              const segCost  = nextId ? edgeWeight(nodeId, nextId) : null;

              return (
                <React.Fragment key={nodeId}>
                  <div className={`flex flex-col items-center rounded-2xl px-4 py-3 shadow text-sm font-semibold ${
                    isStart ? 'bg-cyan-600 text-white' :
                    isEnd   ? 'bg-pink-600 text-white' :
                              'bg-green-50 text-green-800 border border-green-200'
                  }`}>
                    <span className="text-xs font-bold opacity-70">{nodeId}</span>
                    <span>{tree?.species}</span>
                    <span className={`text-[10px] mt-1 px-2 py-0.5 rounded-full ${healthBadge[tree?.health] || 'bg-gray-100 text-gray-500'}`}>
                      {tree?.health}
                    </span>
                  </div>

                  {segCost && (
                    <div className="flex flex-col items-center text-green-500">
                      <span className="text-[10px] font-bold bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded-md mb-0.5">
                        {segCost}
                      </span>
                      <span className="font-bold text-lg leading-none">→</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {path.length === 0 && !error && (
        <div className="bg-white/10 backdrop-blur border-2 border-dashed border-white/20 rounded-2xl h-36 flex flex-col items-center justify-center text-white/50 text-center">
          <TreePine size={36} className="mb-2 opacity-40" />
          <p className="text-sm">
            Select start &amp; end trees, then press <strong>Run Dijkstra</strong> to find the minimum-cost path.
          </p>
        </div>
      )}
    </div>
  );
}
