import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Route, Search, TreePine, MapPin, ArrowRight, AlertCircle, Info } from 'lucide-react';

export default function TraversalPage() {
  const [trees, setTrees] = useState([]);
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTrees();
  }, []);

  const fetchTrees = async () => {
    try {
      const res = await axios.get('http://localhost:5000/trees');
      setTrees(res.data);
    } catch (err) {
      setError('Failed to fetch trees. Is the backend running?');
    }
  };

  // Build a graph where trees are connected if they are within a certain distance
  const findPath = () => {
    if (!startId || !endId) {
      setError('Please select both start and end trees.');
      return;
    }

    setLoading(true);
    setError('');
    
    // 1. Build Adjacency List (Graph)
    // For simplicity, we connect each tree to its 3 nearest neighbors
    const graph = {};
    trees.forEach(t => {
      const distances = trees
        .filter(other => other.treeId !== t.treeId)
        .map(other => ({
          id: other.treeId,
          dist: Math.sqrt(Math.pow(t.location.x - other.location.x, 2) + Math.pow(t.location.y - other.location.y, 2))
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3); // Connect to 3 nearest
      
      graph[t.treeId] = distances.map(d => d.id);
    });

    // 2. BFS Pathfinding
    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const currentPath = queue.shift();
      const node = currentPath[currentPath.length - 1];

      if (node === endId) {
        setPath(currentPath);
        setLoading(false);
        return;
      }

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...currentPath, neighbor]);
        }
      }
    }

    setError('No path found between these trees using the current connectivity logic.');
    setPath([]);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto backdrop-blur-sm min-h-screen pb-20">
      <header className="flex items-center gap-3 mb-10 text-white">
        <div className="bg-green-600 p-3 rounded-full shadow-lg">
          <Route size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Tree Traversal</h1>
          <p className="text-green-200 text-sm">Pathfinding between trees using BFS</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Selection Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Search size={20} className="text-green-600" />
              Find Path
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Start Tree</label>
                <select className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white"
                  value={startId} onChange={e => setStartId(e.target.value)}>
                  <option value="">Select Start</option>
                  {trees.map(t => <option key={t.treeId} value={t.treeId}>{t.species} ({t.treeId})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">End Tree</label>
                <select className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white"
                  value={endId} onChange={e => setEndId(e.target.value)}>
                  <option value="">Select End</option>
                  {trees.map(t => <option key={t.treeId} value={t.treeId}>{t.species} ({t.treeId})</option>)}
                </select>
              </div>

              <button onClick={findPath} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 mt-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {loading ? 'Calculating...' : 'Find Traversal'}
              </button>
            </div>
          </div>

          <div className="bg-blue-50/90 backdrop-blur-md p-4 rounded-xl border border-blue-100 text-blue-700 text-sm">
            <div className="flex gap-2 items-start">
              <Info size={18} className="shrink-0 mt-0.5" />
              <p>
                <strong>Logic:</strong> We treat the plantation as a graph where each tree is connected to its <strong>3 nearest neighbors</strong>. BFS is then used to find the shortest path.
              </p>
            </div>
          </div>
        </div>

        {/* Results Card */}
        <div className="lg:col-span-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3 mb-6">
              <AlertCircle size={20} />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {path.length > 0 ? (
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Traversal Path</h2>
              
              <div className="space-y-6 relative">
                {/* Vertical Line Connector */}
                <div className="absolute left-6 top-8 bottom-8 w-1 bg-green-100 -z-0"></div>

                {path.map((nodeId, index) => {
                  const tree = trees.find(t => t.treeId === nodeId);
                  return (
                    <div key={nodeId} className="flex items-center gap-6 relative z-10">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shadow-md ${
                        index === 0 ? 'bg-green-600 text-white' : 
                        index === path.length - 1 ? 'bg-blue-600 text-white' : 
                        'bg-white text-green-700 border-2 border-green-500'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="bg-white border-2 border-gray-50 p-4 rounded-2xl flex-grow shadow-sm hover:border-green-200 transition-all">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-gray-800">{tree?.species}</h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ID: {nodeId}</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin size={12} />
                              <span>{tree?.location.x}, {tree?.location.y}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {index < path.length - 1 && (
                        <div className="hidden lg:block">
                          <ArrowRight className="text-gray-200" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white/40 backdrop-blur-md border-2 border-dashed border-white/40 rounded-2xl h-[400px] flex flex-col items-center justify-center text-white text-center p-10">
              <TreePine size={64} className="mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">Select trees to see path</h3>
              <p className="opacity-70 max-w-xs">Choose a starting tree and a destination to calculate the optimal path through the plantation.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
