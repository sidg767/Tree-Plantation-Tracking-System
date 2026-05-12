# 🌲 Tree Plantation Tracking System

A robust system for monitoring and managing tree plantation efforts across different zones, utilizing advanced Data Structures and Algorithms for efficiency.

## 🚀 Tech Stack
- **Frontend**: React + Tailwind CSS + Lucide Icons
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose)

---

## 🚀 Features

### 1. Plantation Dashboard
- **Management**: Register new trees with detailed metadata (ID, Species, Coordinates, Health).
- **Monitoring**: Real-time list of all planted trees with status badges.
- **Robustness**: Integrated error handling for database connection issues and input validation.

### 2. Tree Traversal (Pathfinding)
- **Interactive Routing**: Select any two trees in the plantation to find the optimal path between them.
- **Graph Construction**: The system dynamically builds an **Adjacency List** where each tree is connected to its **3 nearest neighbors** based on Euclidean distance.
- **BFS Algorithm**: Implements a **Breadth-First Search** to find the shortest path through the tree network, visualized as a step-by-step traversal trail.

---

## 🛠️ API Endpoints

### 1. `POST /addTree`
- **Purpose**: Registers a new tree in the system.
- **Payload**: `{ treeId, species, location: {x, y}, plantedBy, health, lastWatered }`
- **DSA in Action**: 
    - **Hash Map**: Trees are indexed in a `treeIndex` object using `treeId` for **O(1)** lookups.

### 2. `GET /trees`
- **Purpose**: Retrieves all planted trees from the database.
- **DSA in Action**:
    - **Segment Tree**: Data can be fed into a Segment Tree for fast range-based health queries (**O(log N)**).

### 3. `GET /traverse`
- **Purpose**: Calculates a traversal path through plantation zones.
- **DSA in Action**:
    - **Adjacency List & BFS**: Navigates the zone graph to find the most efficient sector-to-sector route.

---

## 🧠 DSA Concepts Used

| Concept | Implementation | Real-world Use Case |
| :--- | :--- | :--- |
| **Graph (Adjacency List)** | `graph` in `TraversalPage.jsx` | Connecting trees to their nearest neighbors to form a navigable network. |
| **BFS Algorithm** | `findPath` logic | Finding the shortest path between any two trees in the plantation. |
| **Hash Map** | `treeIndex` Object | Instant tree lookup by unique ID without scanning the entire database. |
| **K-D Tree** | `buildKDTree()` | Spatial indexing for high-performance nearest-neighbor searches. |
| **Priority Queue** | `PriorityQueue` class | Optimizing maintenance schedules where critical trees (poor health) are prioritized. |
| **Segment Tree** | `SegmentTree` class | Rapidly calculating health statistics over specific data ranges. |

---

## 🏁 How to Run

### Prerequisites
- Node.js installed
- A MongoDB Atlas account (or local MongoDB)

### 1. Backend Setup
1. Create a `.env` file in the `Backend` directory.
2. Add your connection string: `MONGODB_URI=your_mongodb_connection_string`
3. Run the following:
```bash
cd Backend
npm install
npm start
```

### 2. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```
Visit `http://localhost:5173` to manage your plantation.
