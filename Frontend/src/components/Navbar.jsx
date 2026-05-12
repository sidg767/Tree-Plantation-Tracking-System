import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TreePine, LayoutDashboard, Route } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center text-white">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="bg-green-600 p-2 rounded-lg">
            <TreePine size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">EcoTracker</span>
        </Link>

        <div className="flex gap-4">
          <Link to="/" className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            isActive('/') ? 'bg-white/20 text-white shadow-inner' : 'hover:bg-white/10 text-green-100'
          }`}>
            <LayoutDashboard size={18} />
            <span className="font-medium">Dashboard</span>
          </Link>
          
          <Link to="/traversal" className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            isActive('/traversal') ? 'bg-white/20 text-white shadow-inner' : 'hover:bg-white/10 text-green-100'
          }`}>
            <Route size={18} />
            <span className="font-medium">Tree Traversal</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
