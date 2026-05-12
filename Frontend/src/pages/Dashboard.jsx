import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TreePine, PlusCircle, MapPin, User, Activity, AlertCircle, CheckCircle2, ListFilter } from 'lucide-react';

export default function Dashboard() {
  const [trees, setTrees] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    treeId: '',
    species: '',
    x: '',
    y: '',
    plantedBy: '',
    health: ''
  });

  useEffect(() => {
    fetchTrees();
  }, []);

  const fetchTrees = async () => {
    try {
      const res = await axios.get('http://localhost:5000/trees');
      setTrees(res.data);
      setError('');
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Could not connect to backend. Is the server running?');
    }
  };

  const addTree = async () => {
    try {
      const x = parseFloat(form.x);
      const y = parseFloat(form.y);
      if (isNaN(x) || isNaN(y)) {
        setError('X and Y must be numbers');
        return;
      }

      await axios.post('http://localhost:5000/addTree', {
        ...form,
        location: { x, y },
        lastWatered: new Date()
      });
      
      setSuccess('Tree added successfully!');
      setError('');
      setForm({ treeId: '', species: '', x: '', y: '', plantedBy: '', health: '' });
      fetchTrees();
    } catch (err) {
      console.error('Add error:', err);
      setError(err.response?.data?.details || 'Failed to add tree. Is MongoDB running?');
      setSuccess('');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto backdrop-blur-sm pb-20">
      
      {/* Page Title */}
      <div className="mb-10 text-white">
        <h2 className="text-3xl font-bold tracking-tight">Plantation Dashboard</h2>
        <p className="text-green-200">Manage and monitor all your registered trees.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Form Section */}
        <section className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="text-green-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-800">Register New Tree</h2>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6">
              <AlertCircle size={20} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl mb-6">
              <CheckCircle2 size={20} />
              <span className="text-sm font-medium">{success}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Tree ID</label>
                <input className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 focus:outline-none transition-all" 
                  placeholder="T-001" value={form.treeId} onChange={e => setForm({...form, treeId: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Species</label>
                <input className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 focus:outline-none transition-all" 
                  placeholder="Oak" value={form.species} onChange={e => setForm({...form, species: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">X Coord</label>
                <input className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 focus:outline-none transition-all" 
                  placeholder="12.5" value={form.x} onChange={e => setForm({...form, x: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Y Coord</label>
                <input className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 focus:outline-none transition-all" 
                  placeholder="45.2" value={form.y} onChange={e => setForm({...form, y: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Planted By</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="w-full border-2 border-gray-100 p-3 pl-10 rounded-xl focus:border-green-500 focus:outline-none transition-all" 
                  placeholder="John Doe" value={form.plantedBy} onChange={e => setForm({...form, plantedBy: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Health Status</label>
              <div className="relative">
                <Activity size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select className="w-full border-2 border-gray-100 p-3 pl-10 rounded-xl focus:border-green-500 focus:outline-none transition-all appearance-none bg-white" 
                  value={form.health} onChange={e => setForm({...form, health: e.target.value})}>
                  <option value="">Select Status</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={addTree} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 mt-8 rounded-xl shadow-lg shadow-green-900/20 transform active:scale-95 transition-all">
            Register Tree
          </button>
        </section>

        {/* List Section */}
        <section className="flex flex-col h-fit">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-t-2xl border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ListFilter className="text-green-600" size={24} />
              <h2 className="text-2xl font-bold text-gray-800">Planted Trees</h2>
            </div>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">{trees.length} Total</span>
          </div>
          
          <div className="bg-white/80 backdrop-blur-md rounded-b-2xl shadow-2xl flex-grow overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-green-600">
              {trees.length === 0 ? (
                <div className="text-center py-20">
                  <TreePine size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 italic font-medium">No trees registered yet.</p>
                </div>
              ) : (
                trees.map(tree => (
                  <div key={tree.treeId} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-green-200 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 group-hover:text-green-700 transition-colors">{tree.species}</h3>
                        <p className="text-xs font-bold text-gray-400 tracking-wider">ID: {tree.treeId}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        tree.health === 'Excellent' ? 'bg-green-100 text-green-700' : 
                        tree.health === 'Good' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tree.health}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={14} className="text-green-500" />
                        <span>Coordinates: <span className="font-medium text-gray-900">{tree.location.x}, {tree.location.y}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User size={14} className="text-green-500" />
                        <span>Planted by: <span className="font-medium text-gray-900">{tree.plantedBy}</span></span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
class KDNode {
  constructor(point, left = null, right = null) {
    this.point = point;
    this.left = left;
    this.right = right;
  }
}

function buildKDTree(points, depth = 0) {
  if (!points.length) return null;
  let axis = depth % 2;

  points.sort((a, b) => axis === 0 ? a.x - b.x : a.y - b.y);
  let median = Math.floor(points.length / 2);

  return new KDNode(
    points[median],
    buildKDTree(points.slice(0, median), depth + 1),
    buildKDTree(points.slice(median + 1), depth + 1)
  );
}

// 2. Priority Queue (watering schedule)
class PriorityQueue {
  constructor() {
    this.data = [];
  }

  enqueue(item, priority) {
    this.data.push({ item, priority });
    this.data.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.data.shift();
  }
}

// Example usage
let pq = new PriorityQueue();
pq.enqueue('Tree1', 2);
pq.enqueue('Tree2', 1);

// 3. Segment Tree (range queries on health scores)
class SegmentTree {
  constructor(arr) {
    this.n = arr.length;
    this.tree = new Array(4 * this.n);
    this.build(arr, 0, 0, this.n - 1);
  }

  build(arr, node, start, end) {
    if (start === end) {
      this.tree[node] = arr[start];
    } else {
      let mid = Math.floor((start + end) / 2);
      this.build(arr, 2*node+1, start, mid);
      this.build(arr, 2*node+2, mid+1, end);
      this.tree[node] = this.tree[2*node+1] + this.tree[2*node+2];
    }
  }
}
