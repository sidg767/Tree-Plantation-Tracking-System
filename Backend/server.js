const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tree-plantation';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err.message));

mongoose.connection.on('error', err => {
  console.error('Mongoose connection error:', err);
});

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
  try {
    const tree = new Tree(req.body);
    await tree.save();

    treeIndex[tree.treeId] = tree;
    res.status(201).send(tree);
  } catch (error) {
    console.error('Error adding tree:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).send({ error: 'Validation Error', details: error.message });
    }
    res.status(500).send({ error: 'Database error', details: error.message });
  }
});

// Get Trees
app.get('/trees', async (req, res) => {
  try {
    const trees = await Tree.find();
    res.send(trees);
  } catch (error) {
    console.error('Error fetching trees:', error);
    res.status(500).send({ error: 'Database error', details: error.message });
  }
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
