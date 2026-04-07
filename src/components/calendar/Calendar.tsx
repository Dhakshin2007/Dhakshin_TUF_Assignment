'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, isWithinInterval, isBefore, parseISO 
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Plus, Trash2, X, ExternalLink, Menu, 
  LayoutGrid, CalendarDays, Moon, Sun, CheckCircle2, Info, AlertCircle, Edit3, Clock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface Task {
  id: string;
  date?: string; 
  text: string;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  completed: boolean;
  createdAt: number;
}

type SelectionRange = {
  start: Date | null;
  end: Date | null;
};

interface SidebarContentProps {
  currentDate: Date;
  selectionMode: 'single' | 'range';
  setSelectionMode: (mode: 'single' | 'range') => void;
  setRange: (range: SelectionRange) => void;
  range: SelectionRange;
  activeTab: 'general' | 'selected';
  setActiveTab: (tab: 'general' | 'selected') => void;
  filteredTasks: Task[];
  toggleTaskCompletion: (id: string) => void;
  generateGoogleCalendarUrl: (task: Task) => string;
  deleteTask: (id: string) => void;
  startEditing: (task: Task) => void;
  isTaskInputOpen: boolean;
  setIsTaskInputOpen: (open: boolean) => void;
  newTaskText: string;
  setNewTaskText: (text: string) => void;
  startTime: string;
  setStartTime: (time: string) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  saveTask: () => void;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
  theme: 'light' | 'dark';
  closeSidebar?: () => void;
}

// --- Main Component ---

export default function Calendar() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [range, setRange] = useState<SelectionRange>({ start: null, end: null });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [newTaskText, setNewTaskText] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  const [isTaskInputOpen, setIsTaskInputOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'selected'>('general');
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('single');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Local Storage & Theme Init ---
  useEffect(() => {
    setMounted(true);
    const savedTasks = localStorage.getItem('calendar-tasks-v3');
    const savedTheme = localStorage.getItem('aura-theme') as 'light' | 'dark';
    
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Failed to parse tasks', e);
      }
    }
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('calendar-tasks-v3', JSON.stringify(tasks));
    }
  }, [tasks, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('aura-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme, mounted]);

  // --- Helpers ---

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleDateClick = (day: Date) => {
    if (selectionMode === 'single') {
      setRange({ start: day, end: null });
    } else {
      if (!range.start || (range.start && range.end)) {
        setRange({ start: day, end: null });
      } else {
        if (isSameDay(day, range.start)) return;
        if (isBefore(day, range.start)) {
          setRange({ start: day, end: range.start });
        } else {
          setRange({ ...range, end: day });
        }
      }
    }
  };

  const saveTask = () => {
    if (!newTaskText.trim()) return;

    if (editingTaskId) {
      setTasks(tasks.map(t => t.id === editingTaskId ? {
        ...t,
        text: newTaskText,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        date: range.start ? format(range.start, 'yyyy-MM-dd') : t.date
      } : t));
      showToast('Event updated successfully');
    } else {
      const task: Task = {
        id: Math.random().toString(36).substr(2, 9),
        text: newTaskText,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        completed: false,
        createdAt: Date.now(),
        date: range.start ? format(range.start, 'yyyy-MM-dd') : undefined,
      };
      setTasks([task, ...tasks]);
      showToast('Event created successfully');
    }

    resetInput();
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskText(task.text);
    setStartTime(task.startTime || '');
    setEndTime(task.endTime || '');
    if (task.date) {
      setRange({ start: parseISO(task.date), end: null });
    }
    setIsTaskInputOpen(true);
    setIsSidebarOpen(true);
  };

  const resetInput = () => {
    setNewTaskText('');
    setStartTime('');
    setEndTime('');
    setEditingTaskId(null);
    setIsTaskInputOpen(false);
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
    showToast('Event deleted', 'info');
  };

  const toggleTaskCompletion = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const generateGoogleCalendarUrl = (task: Task) => {
    if (!task.date) return '#';
    const dateStr = task.date.replace(/-/g, '');
    const title = encodeURIComponent(task.text);
    const sTime = task.startTime ? task.startTime.replace(':', '') + '00' : '090000';
    const eTime = task.endTime ? task.endTime.replace(':', '') + '00' : '100000';
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}T${sTime}Z/${dateStr}T${eTime}Z&ctz=Asia/Kolkata`;
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayStatus = (day: Date) => {
    if (!range.start) return 'none';
    if (isSameDay(day, range.start)) return 'start';
    if (range.end && isSameDay(day, range.end)) return 'end';
    if (range.start && range.end && isWithinInterval(day, { start: range.start, end: range.end })) return 'between';
    return 'none';
  };

  const filteredTasks = tasks.filter((task) => {
    if (activeTab === 'general') {
      if (!task.date) return false;
      const taskDate = parseISO(task.date);
      return isSameMonth(taskDate, currentDate);
    }
    
    if (range.start) {
      if (!task.date) return false;
      const taskDate = parseISO(task.date);
      const startStr = format(range.start, 'yyyy-MM-dd');
      if (!range.end) return task.date === startStr;
      return isWithinInterval(taskDate, { start: range.start, end: range.end });
    }
    return false;
  });

  if (!mounted) return null;

  const monthImages = [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070',
    'https://images.unsplash.com/photo-1472396961693-142e6e269027?q=80&w=2070',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2070',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2070',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2070',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070',
    'https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=2070',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=2070',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070',
    'https://images.unsplash.com/photo-1445262102387-5febb59a56d9?q=80&w=2070',
    'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?q=80&w=2070',
  ];

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans overflow-x-hidden",
      theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* --- Toast System --- */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl min-w-[280px]",
                toast.type === 'success' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
                toast.type === 'info' && "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
                toast.type === 'error' && "bg-rose-500/10 border-rose-500/20 text-rose-500"
              )}
            >
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              <span className="text-sm font-bold tracking-tight">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- Mobile Header --- */}
      <div className={cn(
        "w-full lg:hidden border-b p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md",
        theme === 'dark' ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200"
      )}>
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-indigo-500" size={24} />
          <h1 className="font-black text-xl tracking-tighter uppercase italic text-indigo-600 dark:text-indigo-400">Planner</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 hover:bg-slate-800/10 rounded-lg">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-800/10 rounded-lg">
            <Menu size={24} />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto lg:p-10 min-h-screen">
        
        {/* Sidebar Drawer */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden"
              />
              <motion.div 
                initial={{ x: -400 }} animate={{ x: 0 }} exit={{ x: -400 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={cn(
                  "fixed inset-y-0 left-0 z-[60] w-[85%] sm:w-[400px] p-8 flex flex-col border-r lg:hidden",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <SidebarContent 
                  {...{ currentDate, selectionMode, setSelectionMode, setRange, range, activeTab, setActiveTab, filteredTasks, toggleTaskCompletion, generateGoogleCalendarUrl, deleteTask, startEditing, isTaskInputOpen, setIsTaskInputOpen, newTaskText, setNewTaskText, startTime, setStartTime, endTime, setEndTime, saveTask, editingTaskId, setEditingTaskId, theme }}
                  closeSidebar={() => setIsSidebarOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <div className={cn(
          "hidden lg:flex w-[450px] p-10 flex-col border rounded-[3rem] shadow-2xl mr-10 transition-all duration-500",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <SidebarContent 
            {...{ currentDate, selectionMode, setSelectionMode, setRange, range, activeTab, setActiveTab, filteredTasks, toggleTaskCompletion, generateGoogleCalendarUrl, deleteTask, startEditing, isTaskInputOpen, setIsTaskInputOpen, newTaskText, setNewTaskText, startTime, setStartTime, endTime, setEndTime, saveTask, editingTaskId, setEditingTaskId, theme }}
          />
        </div>

        {/* Main Content Area */}
        <div className={cn(
          "flex-1 flex flex-col border shadow-2xl lg:rounded-[3rem] overflow-hidden transition-all duration-500",
          theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
        )}>
          <div className="relative h-[300px] lg:h-[400px] overflow-hidden group shrink-0">
            <AnimatePresence mode='wait'>
              <motion.img 
                key={currentDate.getMonth()}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 1 }}
                src={monthImages[currentDate.getMonth()]} 
                alt="Hero"
                className="w-full h-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/20 transition-all hidden lg:flex"
            >
              {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
            </button>

            <div className="absolute bottom-8 right-8 flex gap-4">
              <button onClick={handlePrevMonth} className="w-14 h-14 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-indigo-600 transition-all active:scale-90">
                <ChevronLeft size={28} />
              </button>
              <button onClick={handleNextMonth} className="w-14 h-14 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-indigo-600 transition-all active:scale-90">
                <ChevronRight size={28} />
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 lg:p-16 flex flex-col overflow-y-auto">
            <div className="grid grid-cols-7 mb-8">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                <div key={day} className="text-center text-[11px] font-black tracking-[0.4em] text-slate-500 py-2 uppercase">
                  {day}
                </div>
              ))}
            </div>

            <AnimatePresence mode='wait'>
              <motion.div 
                key={currentDate.getMonth()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-7 gap-y-2 lg:gap-y-6 flex-1"
              >
                {days.map((day) => {
                  const status = getDayStatus(day);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div 
                      key={day.toString()} 
                      className="relative py-4 lg:py-8 group cursor-pointer select-none"
                      onClick={() => handleDateClick(day)}
                    >
                      {(status === 'start' || status === 'between' || status === 'end') && (
                        <div className={cn(
                          "absolute inset-y-2 z-0 transition-all duration-300",
                          status === 'start' && "left-1/2 right-0 bg-indigo-500/10 rounded-l-none",
                          status === 'end' && "left-0 right-1/2 bg-indigo-500/10 rounded-r-none",
                          status === 'between' && "left-0 right-0 bg-indigo-500/5",
                          (status === 'start' && !range.end) && "hidden"
                        )} />
                      )}

                      <div className={cn(
                        "relative z-10 w-12 h-12 lg:w-20 lg:h-20 mx-auto flex flex-col items-center justify-center rounded-2xl lg:rounded-[2rem] transition-all duration-500",
                        !isCurrentMonth && "text-slate-500 opacity-20",
                        isCurrentMonth && (theme === 'dark' ? "text-slate-300" : "text-slate-700"),
                        isToday && !status.includes('start') && !status.includes('end') && "text-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20",
                        status === 'start' && "bg-indigo-600 text-white scale-110 lg:scale-125 shadow-2xl shadow-indigo-600/40 z-20",
                        status === 'end' && "bg-indigo-600 text-white scale-110 lg:scale-125 shadow-2xl shadow-indigo-600/40 z-20",
                        status === 'between' && "text-indigo-500 font-black",
                        isCurrentMonth && status === 'none' && (theme === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100")
                      )}>
                        <span className="text-sm lg:text-2xl font-black tracking-tighter">{format(day, 'd')}</span>
                        {tasks.some(t => t.date === format(day, 'yyyy-MM-dd')) && (
                          <div className={cn("absolute bottom-2 lg:bottom-4 w-1.5 h-1.5 rounded-full", status === 'start' || status === 'end' ? "bg-white" : "bg-indigo-500")} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ 
  currentDate, selectionMode, setSelectionMode, setRange, range, 
  activeTab, setActiveTab, filteredTasks, toggleTaskCompletion, 
  generateGoogleCalendarUrl, deleteTask, startEditing, isTaskInputOpen, 
  setIsTaskInputOpen, newTaskText, setNewTaskText, startTime, 
  setStartTime, endTime, setEndTime, saveTask, editingTaskId, 
  setEditingTaskId, closeSidebar, theme 
}: SidebarContentProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-12 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <CalendarDays size={24} className="text-white" />
          </div>
          <div>
            <h2 className={cn("text-2xl font-black tracking-tighter uppercase italic leading-none", theme === 'dark' ? "text-white" : "text-slate-900")}>Visual</h2>
            <p className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Interactive Suite</p>
          </div>
        </div>
        {closeSidebar && (
          <button onClick={closeSidebar} className="p-2 hover:bg-slate-800/10 rounded-full lg:hidden">
            <X size={24} />
          </button>
        )}
      </div>

      <div className="mb-10 shrink-0">
        <h3 className="text-6xl font-black tracking-tighter uppercase italic leading-none mb-2">
          {format(currentDate, 'MMMM')}
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-light tracking-[0.2em] text-slate-500">{format(currentDate, 'yyyy')}</span>
          <div className={cn("h-px flex-1", theme === 'dark' ? "bg-slate-800" : "bg-slate-200")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">IST</span>
        </div>
      </div>

      <div className={cn("p-1.5 rounded-[1.5rem] flex gap-1 mb-8 border shrink-0", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200")}>
        <button 
          onClick={() => { setSelectionMode('single'); setRange({ start: range.start, end: null }); }}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all",
            selectionMode === 'single' ? (theme === 'dark' ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-lg") : "text-slate-500"
          )}
        >
          Single
        </button>
        <button 
          onClick={() => setSelectionMode('range')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all",
            selectionMode === 'range' ? (theme === 'dark' ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-lg") : "text-slate-500"
          )}
        >
          Range
        </button>
      </div>

      <div className={cn("flex gap-8 mb-8 border-b shrink-0", theme === 'dark' ? "border-slate-800" : "border-slate-200")}>
        {(['general', 'selected'] as const).map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
              activeTab === tab ? (theme === 'dark' ? "text-white" : "text-slate-900") : "text-slate-500"
            )}
          >
            {tab === 'general' ? 'Monthly' : 'Agenda'}
            {activeTab === tab && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-full" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar min-h-0">
        <AnimatePresence mode='popLayout'>
          {filteredTasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-center opacity-20 py-12">
              <LayoutGrid size={48} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">No Entries Planned</p>
            </motion.div>
          ) : (
            filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "p-5 rounded-[2rem] border transition-all flex flex-col gap-3 group",
                  theme === 'dark' ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="flex justify-between items-start">
                  <button 
                    onClick={() => toggleTaskCompletion(task.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all",
                      task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600 text-slate-500"
                    )}
                  >
                    {task.completed ? 'Finished' : 'Action'}
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEditing(task)} className="p-2 hover:bg-indigo-500/10 text-indigo-500 rounded-xl transition-all">
                      <Edit3 size={14} />
                    </button>
                    {task.date && (
                      <a href={generateGoogleCalendarUrl(task)} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-indigo-500/10 text-indigo-500 rounded-xl transition-all">
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button onClick={() => deleteTask(task.id)} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-xl transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <p className={cn("text-sm font-medium leading-relaxed", task.completed && "line-through opacity-40")}>{task.text}</p>
                
                {(task.startTime || task.endTime) && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <Clock size={12} />
                    {task.startTime || '--:--'} - {task.endTime || '--:--'}
                  </div>
                )}

                {task.date && (
                  <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                    {format(parseISO(task.date), 'MMMM d, yyyy')}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 shrink-0">
        {isTaskInputOpen ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <textarea
              autoFocus
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Record your activity..."
              className={cn(
                "w-full border rounded-[2rem] p-6 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 resize-none h-32 shadow-inner",
                theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
              )}
            />
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Start Time</label>
                <input 
                  type="time" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border text-xs focus:outline-none",
                    theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200"
                  )}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">End Time</label>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border text-xs focus:outline-none",
                    theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200"
                  )}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={saveTask} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest py-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95">
                {editingTaskId ? 'Update Entry' : 'Confirm Entry'}
              </button>
              <button onClick={() => { setIsTaskInputOpen(false); setEditingTaskId(null); }} className={cn("px-6 rounded-[1.5rem] border transition-all", theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-100 border-slate-200")}>
                <X size={18} />
              </button>
            </div>
          </motion.div>
        ) : (
          <button 
            onClick={() => setIsTaskInputOpen(true)}
            className={cn(
              "w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 group",
              theme === 'dark' ? "bg-white text-slate-950 hover:bg-indigo-500 hover:text-white" : "bg-slate-900 text-white hover:bg-indigo-600"
            )}
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            Create New Entry
          </button>
        )}
      </div>
    </>
  );
}
