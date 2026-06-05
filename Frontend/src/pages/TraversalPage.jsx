import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Route, Search, TreePine, Info, Play, RotateCcw, Weight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function euclidean(a, b) {
  return Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y);
}

function buildWeightedGraph(trees, k = 3) {
  const graph = {};
  trees.forEach(t => {
    graph[t.treeId] = trees
      .filter(o => o.treeId !== t.treeId)
      .map(o => ({ id: o.treeId, weight: euclidean(t, o) }))
      .sort((a, b) => a.weight - b.weight)
      .slice(0, k);
  });
  return graph;
}

function dijkstra(graph, start, end) {
  const INF = Infinity;
  const d = {}, prev = {}, pq = [];
  const visitOrder = [];      // nodes in the order Dijkstra settles them
  const scannedEdges = [];    // edges explored: { from, to }
  Object.keys(graph).forEach(id => { d[id] = INF; prev[id] = null; });
  d[start] = 0;
  pq.push([0, start]);
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [cost, u] = pq.shift();
    if (cost > d[u]) continue;
    visitOrder.push(u);
    if (u === end) break;
    for (const { id: v, weight } of graph[u] || []) {
      scannedEdges.push({ from: u, to: v });
      const nc = d[u] + weight;
      if (nc < d[v]) { d[v] = nc; prev[v] = u; pq.push([nc, v]); }
    }
  }
  if (d[end] === INF) return { path: [], totalCost: 0, visitOrder, scannedEdges };
  const path = [];
  for (let c = end; c !== null; c = prev[c]) path.unshift(c);
  return { path, totalCost: d[end], visitOrder, scannedEdges };
}

function projectNodes(trees, W, H, padding = 60) {
  if (!trees.length) return {};
  const xs = trees.map(t => t.location.x);
  const ys = trees.map(t => t.location.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rX = maxX - minX || 1, rY = maxY - minY || 1;
  const m = {};
  trees.forEach(t => {
    m[t.treeId] = {
      x: padding + ((t.location.x - minX) / rX) * (W - padding * 2),
      y: padding + ((t.location.y - minY) / rY) * (H - padding * 2),
    };
  });
  return m;
}

// ── GraphCanvas with zoom & pan ──────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 500;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

function GraphCanvas({ trees, graph, path, startId, endId, scanNodes, scanEdges, revealedPathEdges, animPhase, scanNodeDelay, scanEdgeDelay, pathEdgeDelay }) {
  const svgRef = useRef(null);

  // viewBox state for zoom/pan
  const [vb, setVb] = useState({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });

  const zoomLevel = CANVAS_W / vb.w; // >1 is zoomed in

  const pos = projectNodes(trees, CANVAS_W, CANVAS_H);

  // Build sets for final path display (only after animation done)
  const pathSet = animPhase === 'done' ? new Set(path) : new Set();
  const pathEdges = new Set();
  if (animPhase === 'done') {
    path.forEach((id, i) => {
      if (i < path.length - 1) {
        pathEdges.add(`${id}|${path[i + 1]}`);
        pathEdges.add(`${path[i + 1]}|${id}`);
      }
    });
  }

  // Animation sets
  const scanNodeSet = new Set(scanNodes || []);
  const scanEdgeSet = new Set((scanEdges || []).map(e => [e.from, e.to].sort().join('|')));
  const revealSet   = new Set((revealedPathEdges || []).map(e => `${e[0]}|${e[1]}`));

  const healthColor = { Excellent: '#16a34a', Good: '#65a30d', Average: '#ca8a04', Poor: '#dc2626' };

  // Deduplicate edges
  const edges = [];
  const seen = new Set();
  Object.entries(graph).forEach(([from, nbs]) => {
    nbs.forEach(({ id: to, weight }) => {
      const key = [from, to].sort().join('|');
      if (!seen.has(key)) { seen.add(key); edges.push({ from, to, weight, key }); }
    });
  });

  // ── Zoom ──
  const applyZoom = useCallback((delta, cx, cy) => {
    setVb(prev => {
      const factor = delta > 0 ? 1.15 : 1 / 1.15;
      const nw = Math.max(CANVAS_W / MAX_ZOOM, Math.min(CANVAS_W / MIN_ZOOM, prev.w * factor));
      const nh = Math.max(CANVAS_H / MAX_ZOOM, Math.min(CANVAS_H / MIN_ZOOM, prev.h * factor));
      // Zoom towards cursor
      const rx = (cx - prev.x) / prev.w;
      const ry = (cy - prev.y) / prev.h;
      return {
        w: nw, h: nh,
        x: cx - rx * nw,
        y: cy - ry * nh,
      };
    });
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Convert mouse position to SVG coords
    const mx = ((e.clientX - rect.left) / rect.width) * vb.w + vb.x;
    const my = ((e.clientY - rect.top) / rect.height) * vb.h + vb.y;
    applyZoom(e.deltaY, mx, my);
  }, [vb, applyZoom]);

  // Attach wheel listener with { passive: false }
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Pan ──
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, vx: vb.x, vy: vb.y };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.mx) / rect.width) * vb.w;
    const dy = ((e.clientY - dragStart.current.my) / rect.height) * vb.h;
    setVb(prev => ({ ...prev, x: dragStart.current.vx - dx, y: dragStart.current.vy - dy }));
  };
  const onMouseUp = () => setDragging(false);

  // ── Zoom controls ──
  const zoomIn  = () => applyZoom(1, vb.x + vb.w / 2, vb.y + vb.h / 2);
  const zoomOut = () => applyZoom(-1, vb.x + vb.w / 2, vb.y + vb.h / 2);
  const resetView = () => setVb({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
      {/* Zoom toolbar */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur transition-all"
          title="Zoom In"
        ><ZoomIn size={15} /></button>
        <button onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur transition-all"
          title="Zoom Out"
        ><ZoomOut size={15} /></button>
        <button onClick={resetView}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur transition-all"
          title="Reset View"
        ><Maximize2 size={14} /></button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-3 left-3 z-10 text-[10px] font-bold text-white/50 bg-black/30 backdrop-blur px-2 py-1 rounded-md">
        {Math.round(zoomLevel * 100)}%
      </div>

      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full bg-gradient-to-br from-green-950/90 to-slate-900/90"
        style={{ minHeight: 380, cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* ── Edges ── */}
        {edges.map(({ from, to, weight, key }) => {
          const sortedKey = [from, to].sort().join('|');
          const isPath    = pathEdges.has(`${from}|${to}`);
          const isScanned = scanEdgeSet.has(sortedKey);
          const fwdKey    = `${from}|${to}`, revKey = `${to}|${from}`;
          const isRevealed = revealSet.has(fwdKey) || revealSet.has(revKey);
          const highlighted = isPath || isRevealed;
          const p1 = pos[from], p2 = pos[to];
          if (!p1 || !p2) return null;
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;

          // CSS animation for smooth staggered appearance
          const scanDelay = (scanEdgeDelay || {})[sortedKey];
          const pathDelay = (pathEdgeDelay || {})[fwdKey] ?? (pathEdgeDelay || {})[revKey];
          const animStyle = (isScanned && scanDelay != null)
            ? { animation: `fadeGlowAmber 400ms ease-out ${scanDelay}ms both` }
            : (isRevealed && pathDelay != null)
            ? { animation: `fadeGlowGreen 500ms ease-out ${pathDelay}ms both` }
            : {};

          let stroke = 'rgba(255,255,255,0.08)', sw = 1, dash = '6 5';
          if (highlighted || isPath) { stroke = '#4ade80'; sw = 2.5; dash = '0'; }
          else if (isScanned)        { stroke = '#fbbf24'; sw = 1.5; dash = '0'; }

          return (
            <g key={key} style={animStyle}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
              />
              {highlighted && (
                <>
                  <rect x={mx - 14} y={my - 8} width={28} height={15} rx={5}
                    fill="rgba(0,0,0,0.55)" stroke="#4ade80" strokeWidth={0.7} />
                  <text x={mx} y={my + 0.5} textAnchor="middle" dominantBaseline="middle"
                    fontSize={7.5} fontWeight="700" fill="#4ade80">{(weight * 100).toFixed(1)}</text>
                </>
              )}
            </g>
          );
        })}

        {/* ── Nodes ── */}
        {trees.map(t => {
          const p = pos[t.treeId];
          if (!p) return null;
          const isStart  = t.treeId === startId;
          const isEnd    = t.treeId === endId;
          const inPath   = pathSet.has(t.treeId);
          const scanned  = scanNodeSet.has(t.treeId);
          const active   = isStart || isEnd || inPath;

          let ring = 'rgba(255,255,255,0.15)', fill = '#1a2e25';
          if (isStart)       { ring = '#22d3ee'; fill = '#0e7490'; }
          else if (isEnd)    { ring = '#f472b6'; fill = '#9d174d'; }
          else if (inPath)   { ring = '#4ade80'; fill = '#166534'; }
          else if (scanned)  { ring = '#fbbf24'; fill = '#78350f'; }

          const glowing = active || scanned;
          const nodeDelay = (scanNodeDelay || {})[t.treeId];
          const nodeAnimStyle = (scanned && !active && nodeDelay != null)
            ? { animation: `fadeGlowAmber 400ms ease-out ${nodeDelay}ms both` }
            : {};

          return (
            <g key={t.treeId}
               style={{ ...nodeAnimStyle, ...(glowing ? { filter: `drop-shadow(0 0 6px ${ring})` } : {}) }}>
              {(isStart || isEnd) && (
                <circle cx={p.x} cy={p.y} r={24} fill="none" stroke={ring} strokeWidth={1} opacity={0.35}>
                  <animate attributeName="r" values="22;26;22" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.35;0.12;0.35" dur="2.5s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={17} fill={fill} stroke={ring} strokeWidth={2} />
              <circle cx={p.x + 11} cy={p.y - 11} r={4}
                fill={healthColor[t.health] || '#888'} stroke="#0f172a" strokeWidth={1.2} />
              <text x={p.x} y={p.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                fontSize={7.5} fontWeight="800" fill="white">{t.treeId}</text>
              <text x={p.x} y={p.y + 28} textAnchor="middle" fontSize={7}
                fill={glowing ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'}>
                {t.species.length > 10 ? t.species.slice(0, 9) + '…' : t.species}
              </text>
            </g>
          );
        })}

        {/* ── Legend (fixed in viewBox bottom-left) ── */}
        <g transform={`translate(${vb.x + 12}, ${vb.y + vb.h - 16})`}>
          {[
            { color: '#22d3ee', label: 'Start' },
            { color: '#f472b6', label: 'End' },
            { color: '#4ade80', label: 'Path' },
            { color: 'rgba(255,255,255,0.25)', label: 'Other' },
          ].map(({ color, label }, i) => (
            <g key={label} transform={`translate(${i * 60}, 0)`}>
              <circle r={4} fill={color} />
              <text x={7} y={1} dominantBaseline="middle" fontSize={7} fill="rgba(255,255,255,0.55)">{label}</text>
            </g>
          ))}
          {[
            { color: '#16a34a', label: 'Excellent' },
            { color: '#65a30d', label: 'Good' },
            { color: '#ca8a04', label: 'Average' },
            { color: '#dc2626', label: 'Poor' },
          ].map(({ color, label }, i) => (
            <g key={label} transform={`translate(${280 + i * 58}, 0)`}>
              <circle r={3.5} fill={color} />
              <text x={6} y={1} dominantBaseline="middle" fontSize={6.5} fill="rgba(255,255,255,0.45)">{label}</text>
            </g>
          ))}
        </g>
      </svg>

      {/* Hint */}
      <div className="absolute bottom-3 right-3 z-10 text-[10px] text-white/30 font-medium">
        Scroll to zoom · Drag to pan
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SCAN_STEP_MS  = 150;  // ms between each scan node appearing
const PATH_STEP_MS  = 400;  // ms between each path edge appearing
const SCAN_FADE_MS  = 400;  // CSS fade-in duration for scan nodes
const PATH_FADE_MS  = 500;  // CSS fade-in duration for path edges

export default function TraversalPage() {
  const [trees,     setTrees]     = useState([]);
  const [startId,   setStartId]   = useState('');
  const [endId,     setEndId]     = useState('');
  const [path,      setPath]      = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [graph,     setGraph]     = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Animation: all data set in ONE render, CSS delays handle staggering
  const [animPhase,         setAnimPhase]         = useState('idle');
  const [scanNodes,         setScanNodes]         = useState([]);   // full array set at once
  const [scanEdges,         setScanEdges]         = useState([]);
  const [scanNodeDelay,     setScanNodeDelay]     = useState({});   // nodeId -> delay ms
  const [scanEdgeDelay,     setScanEdgeDelay]     = useState({});   // edgeKey -> delay ms
  const [revealedPathEdges, setRevealedPathEdges] = useState([]);
  const [pathEdgeDelay,     setPathEdgeDelay]     = useState({});   // edgeKey -> delay ms
  const phaseTimer = useRef(null);

  useEffect(() => {
    axios.get('http://localhost:5000/trees')
      .then(res => {
        setTrees(res.data);
        setGraph(buildWeightedGraph(res.data, 3));
      })
      .catch(() => setError('Failed to fetch trees. Is the backend running?'));
  }, []);

  useEffect(() => () => { if (phaseTimer.current) clearTimeout(phaseTimer.current); }, []);

  const runDijkstra = () => {
    if (!startId || !endId) { setError('Please select both start and end trees.'); return; }
    if (startId === endId)  { setError('Start and end must be different trees.');   return; }
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    setLoading(true); setError(''); setPath([]); setTotalCost(0);

    const { path: result, totalCost: cost, visitOrder, scannedEdges } = dijkstra(graph, startId, endId);
    if (!result.length) {
      setError('No path found between these trees.'); setLoading(false); setAnimPhase('idle');
      return;
    }

    // ── Phase 1: Set ALL scan data at once, with CSS delay map ──
    const nodeDelays = {};
    visitOrder.forEach((id, i) => { nodeDelays[id] = i * SCAN_STEP_MS; });
    const edgeDelays = {};
    scannedEdges.forEach((e, i) => {
      const k = [e.from, e.to].sort().join('|');
      if (!(k in edgeDelays)) edgeDelays[k] = i * (SCAN_STEP_MS * 0.6);
    });

    setScanNodes(visitOrder);
    setScanEdges(scannedEdges);
    setScanNodeDelay(nodeDelays);
    setScanEdgeDelay(edgeDelays);
    setRevealedPathEdges([]);
    setPathEdgeDelay({});
    setAnimPhase('scanning');

    const scanDuration = visitOrder.length * SCAN_STEP_MS + SCAN_FADE_MS + 300;

    // ── Phase 2: After scan finishes, reveal path ──
    phaseTimer.current = setTimeout(() => {
      setScanNodes([]); setScanEdges([]);
      const pathPairs = [];
      const pDelays = {};
      for (let i = 0; i < result.length - 1; i++) {
        const pair = [result[i], result[i + 1]];
        pathPairs.push(pair);
        const k = `${pair[0]}|${pair[1]}`;
        pDelays[k] = i * PATH_STEP_MS;
      }
      setRevealedPathEdges(pathPairs);
      setPathEdgeDelay(pDelays);
      setAnimPhase('revealing');

      const revealDuration = (result.length - 1) * PATH_STEP_MS + PATH_FADE_MS + 200;
      phaseTimer.current = setTimeout(() => {
        setPath(result); setTotalCost(cost);
        setAnimPhase('done'); setLoading(false);
      }, revealDuration);
    }, scanDuration);
  };

  const reset = () => {
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    setPath([]); setStartId(''); setEndId(''); setError(''); setTotalCost(0);
    setScanNodes([]); setScanEdges([]); setRevealedPathEdges([]);
    setScanNodeDelay({}); setScanEdgeDelay({}); setPathEdgeDelay({});
    setAnimPhase('idle'); setLoading(false);
  };

  const edgeCount = (() => {
    const s = new Set();
    Object.entries(graph).forEach(([f, nbs]) => nbs.forEach(({ id: t }) => s.add([f, t].sort().join('|'))));
    return s.size;
  })();

  const healthBadge = {
    Excellent: 'bg-green-100 text-green-700',
    Good:      'bg-lime-100 text-lime-700',
    Average:   'bg-yellow-100 text-yellow-700',
    Poor:      'bg-red-100 text-red-700',
  };

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
          <p className="text-green-200 text-sm">Weighted graph · Dijkstra's shortest path algorithm</p>
        </div>
      </header>

      {/* Controls + Stats */}
      <div className="grid lg:grid-cols-4 gap-4 mb-6">
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
                <Play size={14} /> {animPhase === 'scanning' ? 'Scanning…' : animPhase === 'revealing' ? 'Revealing…' : loading ? 'Running…' : 'Run Dijkstra'}
              </button>
              <button onClick={reset}
                className="p-2.5 rounded-xl border-2 border-gray-100 hover:border-red-300 text-gray-400 hover:text-red-400 transition-all"
                title="Reset"
              ><RotateCcw size={16} /></button>
            </div>
          </div>
        </div>

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
            <p className="text-3xl font-extrabold">{totalCost ? (totalCost * 100).toFixed(2) : '—'}</p>
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
          <Info size={13} /> Weighted graph · k=3 nearest neighbours · edge weights shown on path
        </div>
        {trees.length > 0
          ? <GraphCanvas trees={trees} graph={graph} path={path} startId={startId} endId={endId}
              scanNodes={scanNodes} scanEdges={scanEdges} revealedPathEdges={revealedPathEdges}
              animPhase={animPhase} scanNodeDelay={scanNodeDelay} scanEdgeDelay={scanEdgeDelay} pathEdgeDelay={pathEdgeDelay} />
          : <div className="h-64 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 text-sm">Loading graph…</div>
        }
      </div>

      {/* Animation status */}
      {animPhase === 'scanning' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl flex items-center gap-3 mb-4 text-sm animate-pulse">
          <span className="font-medium">🔍 Scanning graph — exploring {scanNodes.length} nodes…</span>
        </div>
      )}
      {animPhase === 'revealing' && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl flex items-center gap-3 mb-4 text-sm animate-pulse">
          <span className="font-medium">✨ Revealing optimal path — {revealedPathEdges.length} edges shown…</span>
        </div>
      )}

      {/* Dijkstra Path result */}
      {path.length > 0 && animPhase === 'done' && (
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
              const tree    = trees.find(t => t.treeId === nodeId);
              const isStart = index === 0;
              const isEnd   = index === path.length - 1;
              const nextId  = path[index + 1];
              const segCost = nextId ? edgeWeight(nodeId, nextId) : null;
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
