import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Route, Search, TreePine, MapPin, Info, Play, RotateCcw } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildGraph(trees, k = 3) {
  const graph = {};
  trees.forEach(t => {
    const neighbors = trees
      .filter(o => o.treeId !== t.treeId)
      .map(o => ({
        id: o.treeId,
        dist: Math.hypot(t.location.x - o.location.x, t.location.y - o.location.y),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k)
      .map(d => d.id);
    graph[t.treeId] = neighbors;
  });
  return graph;
}

function bfsPath(graph, start, end) {
  const queue = [[start]];
  const visited = new Set([start]);
  while (queue.length) {
    const current = queue.shift();
    const node = current[current.length - 1];
    if (node === end) return current;
    for (const nb of graph[node] || []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push([...current, nb]);
      }
    }
  }
  return [];
}

// Map tree (x, y) coords → SVG viewport
function projectNodes(trees, W, H, padding = 48) {
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
  const W = 680, H = 420;
  const pos = projectNodes(trees, W, H);

  const pathSet = new Set();
  const pathEdges = new Set();
  path.forEach((id, i) => {
    pathSet.add(id);
    if (i < path.length - 1) pathEdges.add(`${id}-${path[i + 1]}`);
  });

  const healthColor = { Excellent: '#16a34a', Good: '#65a30d', Average: '#ca8a04', Poor: '#dc2626' };

  // Collect unique edges
  const edges = [];
  const seen = new Set();
  Object.entries(graph).forEach(([from, neighbors]) => {
    neighbors.forEach(to => {
      const key = [from, to].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ from, to, key });
      }
    });
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-2xl border border-white/20 bg-gradient-to-br from-green-950/80 to-slate-900/80 backdrop-blur-md shadow-2xl"
      style={{ minHeight: 280 }}
    >
      {/* Grid dots */}
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 14 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={c * 52 + 20} cy={r * 54 + 20} r={1} fill="rgba(255,255,255,0.06)" />
        ))
      )}

      {/* All edges */}
      {edges.map(({ from, to, key }) => {
        const isPath = pathEdges.has(`${from}-${to}`) || pathEdges.has(`${to}-${from}`);
        const p1 = pos[from], p2 = pos[to];
        if (!p1 || !p2) return null;
        return (
          <line
            key={key}
            x1={p1.x} y1={p1.y}
            x2={p2.x} y2={p2.y}
            stroke={isPath ? '#4ade80' : 'rgba(255,255,255,0.12)'}
            strokeWidth={isPath ? 3 : 1.5}
            strokeDasharray={isPath ? '0' : '4 4'}
            style={isPath ? { filter: 'drop-shadow(0 0 4px #4ade80)' } : {}}
          />
        );
      })}

      {/* Nodes */}
      {trees.map(t => {
        const p = pos[t.treeId];
        if (!p) return null;
        const isStart = t.treeId === startId;
        const isEnd   = t.treeId === endId;
        const inPath  = pathSet.has(t.treeId);
        const ring    = isStart ? '#22d3ee' : isEnd ? '#f472b6' : inPath ? '#4ade80' : 'rgba(255,255,255,0.2)';
        const fill    = isStart ? '#0e7490' : isEnd ? '#9d174d' : inPath ? '#166534' : '#1e3a2f';
        const glow    = isStart || isEnd || inPath;

        return (
          <g key={t.treeId} style={glow ? { filter: `drop-shadow(0 0 6px ${ring})` } : {}}>
            <circle cx={p.x} cy={p.y} r={18} fill={fill} stroke={ring} strokeWidth={2.5} />
            {/* health dot */}
            <circle
              cx={p.x + 11} cy={p.y - 11} r={5}
              fill={healthColor[t.health] || '#888'}
              stroke="#0f172a" strokeWidth={1.5}
            />
            <text
              x={p.x} y={p.y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fontWeight="700" fill="white" letterSpacing={0}
            >
              {t.treeId}
            </text>
            {/* label below */}
            <text
              x={p.x} y={p.y + 30}
              textAnchor="middle"
              fontSize={7.5} fill="rgba(255,255,255,0.55)"
            >
              {t.species.length > 10 ? t.species.slice(0, 9) + '…' : t.species}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {[
        { color: '#22d3ee', label: 'Start' },
        { color: '#f472b6', label: 'End' },
        { color: '#4ade80', label: 'Path' },
        { color: 'rgba(255,255,255,0.3)', label: 'Other' },
      ].map(({ color, label }, i) => (
        <g key={label} transform={`translate(${16 + i * 78}, ${H - 18})`}>
          <circle r={5} fill={color} />
          <text x={9} y={1} dominantBaseline="middle" fontSize={9} fill="rgba(255,255,255,0.6)">{label}</text>
        </g>
      ))}

      {/* Health legend */}
      {[
        { color: '#16a34a', label: 'Excellent' },
        { color: '#65a30d', label: 'Good' },
        { color: '#ca8a04', label: 'Average' },
        { color: '#dc2626', label: 'Poor' },
      ].map(({ color, label }, i) => (
        <g key={label} transform={`translate(${W - 250 + i * 62}, ${H - 18})`}>
          <circle r={4} fill={color} />
          <text x={7} y={1} dominantBaseline="middle" fontSize={8} fill="rgba(255,255,255,0.5)">{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TraversalPage() {
  const [trees,   setTrees]   = useState([]);
  const [startId, setStartId] = useState('');
  const [endId,   setEndId]   = useState('');
  const [path,    setPath]    = useState([]);
  const [graph,   setGraph]   = useState({});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/trees')
      .then(res => {
        setTrees(res.data);
        setGraph(buildGraph(res.data, 3));
      })
      .catch(() => setError('Failed to fetch trees. Is the backend running?'));
  }, []);

  const findPath = () => {
    if (!startId || !endId) { setError('Please select both start and end trees.'); return; }
    if (startId === endId)  { setError('Start and end must be different trees.');   return; }
    setLoading(true);
    setError('');
    setTimeout(() => {           // tiny delay so UI can re-render spinner
      const result = bfsPath(graph, startId, endId);
      if (result.length) setPath(result);
      else { setError('No path found between these trees.'); setPath([]); }
      setLoading(false);
    }, 120);
  };

  const reset = () => { setPath([]); setStartId(''); setEndId(''); setError(''); };

  const healthBadge = { Excellent: 'bg-green-100 text-green-700', Good: 'bg-lime-100 text-lime-700', Average: 'bg-yellow-100 text-yellow-700', Poor: 'bg-red-100 text-red-700' };

  return (
    <div className="p-6 max-w-6xl mx-auto backdrop-blur-sm min-h-screen pb-24">

      {/* Header */}
      <header className="flex items-center gap-3 mb-8 text-white">
        <div className="bg-green-600 p-3 rounded-full shadow-lg">
          <Route size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Tree Traversal</h1>
          <p className="text-green-200 text-sm">Interactive BFS graph visualisation &amp; pathfinding</p>
        </div>
      </header>

      {/* Controls row */}
      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 lg:col-span-1">
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Search size={16} className="text-green-600" /> Find Path
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Start Tree</label>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white text-sm"
                value={startId} onChange={e => { setStartId(e.target.value); setPath([]); }}
              >
                <option value="">Select Start</option>
                {trees.map(t => <option key={t.treeId} value={t.treeId}>{t.species} ({t.treeId})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">End Tree</label>
              <select
                className="w-full border-2 border-gray-100 p-2.5 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white text-sm"
                value={endId} onChange={e => { setEndId(e.target.value); setPath([]); }}
              >
                <option value="">Select End</option>
                {trees.map(t => <option key={t.treeId} value={t.treeId}>{t.species} ({t.treeId})</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={findPath} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm"
              >
                <Play size={14} /> {loading ? 'Running…' : 'Run BFS'}
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

        {/* Info cards */}
        <div className="lg:col-span-3 grid sm:grid-cols-3 gap-4">
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">{trees.length}</p>
            <p className="text-green-200 text-sm font-medium">Total Nodes</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">
              {Object.values(graph).reduce((s, nb) => s + nb.length, 0) / 2 | 0}
            </p>
            <p className="text-green-200 text-sm font-medium">Graph Edges</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 text-white flex flex-col justify-center">
            <p className="text-3xl font-extrabold">{path.length ? path.length - 1 : '—'}</p>
            <p className="text-green-200 text-sm font-medium">Path Hops</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-3 mb-4 text-sm">
          <span className="font-medium">⚠ {error}</span>
        </div>
      )}

      {/* Graph visualisation */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
          <Info size={13} /> Graph — each node connects to its 3 nearest neighbours · health dot indicates tree condition
        </div>
        {trees.length > 0
          ? <GraphCanvas trees={trees} graph={graph} path={path} startId={startId} endId={endId} />
          : <div className="h-64 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 text-sm">Loading graph…</div>
        }
      </div>

      {/* BFS Path result */}
      {path.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            BFS Shortest Path &nbsp;
            <span className="text-sm font-normal text-gray-400">({path.length} nodes, {path.length - 1} hops)</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {path.map((nodeId, index) => {
              const tree = trees.find(t => t.treeId === nodeId);
              const isStart = index === 0;
              const isEnd   = index === path.length - 1;
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
                  {index < path.length - 1 && (
                    <span className="text-green-400 font-bold text-lg">→</span>
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
          <p className="text-sm">Select start &amp; end trees, then press <strong>Run BFS</strong> to highlight the path on the graph above.</p>
        </div>
      )}
    </div>
  );
}
