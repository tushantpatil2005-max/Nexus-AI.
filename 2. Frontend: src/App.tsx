import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CheckSquare, MessageSquare, Settings, Plus, Search, 
  Bell, MoreVertical, Calendar, Send, Sparkles, Loader2, ChevronRight, Filter 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---
const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    )}
  >
    <Icon size={20} className={cn(active ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const StatCard = ({ label, value, trend, color }: { label: string, value: string | number, trend?: string, color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
    <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
    <div className="flex items-end gap-3">
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {trend && <span className={cn("text-xs font-bold mb-1", color)}>{trend}</span>}
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'chat'>('dashboard');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/projects').then(res => res.json()).then(data => {
      setProjects(data);
      if (data.length > 0) setSelectedProject(data[0]);
    });
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetch(`/api/projects/${selectedProject.id}/tasks`).then(res => res.json()).then(setTasks);
    }
  }, [selectedProject]);

  // WebSocket for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'task_updated' && selectedProject) {
        fetch(`/api/projects/${selectedProject.id}/tasks`).then(res => res.json()).then(setTasks);
      }
    };
    return () => socket.close();
  }, [selectedProject]);

  const handleAiGenerateTasks = async () => {
    if (!selectedProject) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDescription: selectedProject.description })
      });
      const generatedTasks = await res.json();
      for (const task of generatedTasks) {
        await fetch(`/api/projects/${selectedProject.id}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...task, status: 'todo', priority: 'medium' })
        });
      }
      const tasksRes = await fetch(`/api/projects/${selectedProject.id}/tasks`);
      setTasks(await tasksRes.json());
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: number, status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const COLORS = ['#6366f1', '#f59e0b', '#10b981'];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar and Main Layout logic here (as shown in the preview) */}
      {/* ... (Refer to the full App.tsx implementation in the project) */}
    </div>
  );
}