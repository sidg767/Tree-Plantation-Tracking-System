const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/tree-plantation');

const TreeSchema = new mongoose.Schema({
  treeId: String,
  species: String,
  location: { x: Number, y: Number },
  plantedBy: String,
  health: String,
  lastWatered: Date
});

const Tree = mongoose.model('Tree', TreeSchema);

// HashMap-like indexing using object
let treeIndex = {};

// Add Tree
app.post('/addTree', async (req, res) => {
  const tree = new Tree(req.body);
  await tree.save();

  treeIndex[tree.treeId] = tree;
  res.send(tree);
});

// Get Trees
app.get('/trees', async (req, res) => {
  const trees = await Tree.find();
  res.send(trees);
});

// Graph (Adjacency List for zones)
let campusGraph = {
  A: ['B', 'C'],
  B: ['A', 'D'],
  C: ['A'],
  D: ['B']
};

// BFS Traversal
app.get('/traverse', (req, res) => {
  let visited = new Set();
  let queue = ['A'];
  let result = [];

  while (queue.length) {
    let node = queue.shift();
    if (!visited.has(node)) {
      visited.add(node);
      result.push(node);
      queue.push(...campusGraph[node]);
    }
  }

  res.send(result);
});

app.listen(5000, () => console.log('Server running on port 5000'));
