import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function App() {
  const [trees, setTrees] = useState([]);
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
    const res = await axios.get('http://localhost:5000/trees');
    setTrees(res.data);
  };

  const addTree = async () => {
    await axios.post('http://localhost:5000/addTree', {
      ...form,
      location: { x: form.x, y: form.y },
      lastWatered: new Date()
    });
    fetchTrees();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Tree Plantation Tracker</h1>

      <div className="grid grid-cols-2 gap-4">
        <input placeholder="Tree ID" onChange={e => setForm({...form, treeId: e.target.value})} />
        <input placeholder="Species" onChange={e => setForm({...form, species: e.target.value})} />
        <input placeholder="X" onChange={e => setForm({...form, x: e.target.value})} />
        <input placeholder="Y" onChange={e => setForm({...form, y: e.target.value})} />
        <input placeholder="Planted By" onChange={e => setForm({...form, plantedBy: e.target.value})} />
        <input placeholder="Health" onChange={e => setForm({...form, health: e.target.value})} />
      </div>

      <button onClick={addTree} className="bg-green-500 text-white px-4 py-2 mt-4">Add Tree</button>

      <h2 className="text-xl mt-6">All Trees</h2>
      <ul>
        {trees.map(tree => (
          <li key={tree.treeId}>
            {tree.species} - ({tree.location.x}, {tree.location.y}) - {tree.health}
          </li>
        ))}
      </ul>
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
