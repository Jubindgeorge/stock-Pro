/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Factory, 
  FileText, 
  Users, 
  History, 
  LogOut, 
  Menu, 
  X, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Eye, 
  Download, 
  Printer, 
  ChevronDown, 
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Truck,
  Database,
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  ref, 
  onValue, 
  set, 
  push, 
  remove, 
  update, 
  query, 
  orderByChild, 
  equalTo, 
  limitToLast 
} from 'firebase/database';
import { Toaster, toast } from 'react-hot-toast';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import { db, CLOUD_ROOT } from './firebase';
import { 
  User, 
  Role, 
  RMProduct, 
  FGProduct, 
  Movement, 
  Bill, 
  Production, 
  DeliveryNote, 
  Supplier, 
  AuditLog 
} from './types';
import { genId, todayISO, fmtDate, fmtDateTime, normalizeGroup } from './utils';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- RBAC ---
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ["*"],
  power: [
    "dashboard:view",
    "rm:view","rm:add","rm:edit","rm:delete","rm:stockin","rm:stockout","rm:history:view","rm:report:print",
    "fg:view","fg:add","fg:edit","fg:delete","fg:stockin","fg:stockout","fg:report:print",
    "boe:view","boe:create","boe:edit","boe:delete","boe:print",
    "dn:view","dn:create","dn:edit","dn:delete","dn:print",
    "prod:view","prod:create","prod:print",
    "suppliers:view","suppliers:add","suppliers:edit","suppliers:delete",
    "audit:view"
  ],
  manager: [
    "dashboard:view",
    "rm:view","rm:add","rm:edit","rm:stockin","rm:stockout","rm:history:view",
    "fg:view","fg:add","fg:edit","fg:stockin","fg:stockout",
    "boe:view","boe:create","boe:edit","boe:print",
    "dn:view","dn:create","dn:print",
    "prod:view","prod:create",
    "suppliers:view","suppliers:add","suppliers:edit",
    "audit:view"
  ],
  store: [
    "dashboard:view",
    "rm:view","rm:stockin","rm:stockout","rm:history:view",
    "boe:view","boe:create","boe:print",
    "dn:view","dn:create","dn:print",
    "suppliers:view",
    "audit:view"
  ],
  production: [
    "dashboard:view",
    "rm:view","rm:history:view",
    "fg:view",
    "prod:view","prod:create",
    "audit:view"
  ],
  viewer: [
    "dashboard:view",
    "rm:view","rm:history:view",
    "fg:view",
    "boe:view",
    "dn:view",
    "prod:view",
    "suppliers:view",
    "audit:view"
  ],
  operator: [
    "dashboard:view",
    "rm:view","rm:stockin","rm:stockout",
    "fg:view","fg:stockin","fg:stockout",
    "prod:view","prod:create"
  ]
};

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  collapsed,
  submenu = []
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  onClick?: () => void, 
  collapsed?: boolean,
  submenu?: { label: string, active: boolean, onClick: () => void }[]
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => {
          if (submenu.length > 0) setIsOpen(!isOpen);
          if (onClick) onClick();
        }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
          active && !submenu.length ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-100",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className={cn("w-5 h-5", active && !submenu.length ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left font-medium text-sm">{label}</span>
            {submenu.length > 0 && (
              <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            )}
          </>
        )}
      </button>
      {!collapsed && submenu.length > 0 && isOpen && (
        <div className="mt-1 ml-9 flex flex-col gap-1 border-l-2 border-slate-100 pl-2">
          {submenu.map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className={cn(
                "text-left py-2 px-3 rounded-lg text-sm transition-colors",
                item.active ? "text-indigo-600 font-semibold bg-indigo-50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Card = ({ children, className, title, subtitle, action }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string, action?: React.ReactNode }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-bold text-slate-800">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, trend, color = "indigo" }: { label: string, value: string | number, icon: any, trend?: string, color?: string }) => {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-50 text-slate-600"
  };

  return (
    <Card className="p-0">
      <div className="p-6 flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <h4 className="text-3xl font-black text-slate-900">{value}</h4>
          {trend && (
            <p className={cn(
              "text-xs font-bold",
              trend.startsWith('+') ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend} <span className="text-slate-400 font-normal">vs last month</span>
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-2xl", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Data State
  const [rmProducts, setRmProducts] = useState<RMProduct[]>([]);
  const [fgProducts, setFgProducts] = useState<FGProduct[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Auth State
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isSignup, setIsSignup] = useState(false);

  // Search State
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('sms_currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    // Always fetch users so login works
    const usersRef = ref(db, `${CLOUD_ROOT}/users`);
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUsers(Object.values(data) as User[]);
      } else {
        setUsers([]);
      }
    });

    return () => unsubscribeUsers();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const bundleRef = ref(db, CLOUD_ROOT);
    const unsubscribe = onValue(bundleRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRmProducts(Object.values(data.products || {}) as RMProduct[]);
        setMovements(Object.values(data.stockMovements || {}) as Movement[]);
        setFgProducts(Object.values(data.fgProducts || {}) as FGProduct[]);
        
        // Merge FG movements if they exist in a separate node
        if (data.fgMovements) {
          const fgMoves = Object.values(data.fgMovements) as Movement[];
          setMovements(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMoves = fgMoves.filter(m => !existingIds.has(m.id));
            return [...prev, ...newMoves];
          });
        }
        
        setBills(Object.values(data.bills || {}) as Bill[]);
        setProductions(Object.values(data.productions || {}) as Production[]);
        setDeliveryNotes(Object.values(data.deliveryNotes || {}) as DeliveryNote[]);
        setSuppliers(Object.values(data.suppliers || {}) as Supplier[]);
        setAuditLogs(Object.values(data.auditLogs || {}) as AuditLog[]);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const can = (perm: string) => {
    if (!currentUser) return false;
    const perms = ROLE_PERMISSIONS[currentUser.role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(perm);
  };

  const logAction = async (action: string, entityId: string, details: any) => {
    const logId = genId();
    const log: AuditLog = {
      id: logId,
      at: new Date().toISOString(),
      by: currentUser?.username || 'unknown',
      action,
      entityId,
      details
    };
    await set(ref(db, `${CLOUD_ROOT}/auditLogs/${logId}`), log);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Fallback for first-time setup
    if (loginForm.username === 'admin' && loginForm.password === 'admin' && users.length === 0) {
      const adminUser: User = {
        id: 'admin-init',
        username: 'admin',
        password: 'admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      setCurrentUser(adminUser);
      localStorage.setItem('sms_currentUser', JSON.stringify(adminUser));
      toast.success("Initial Admin Login Successful");
      return;
    }

    const user = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('sms_currentUser', JSON.stringify(user));
      toast.success(`Welcome back, ${user.username}!`);
    } else {
      toast.error("Invalid username or password");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sms_currentUser');
    toast.success("Logged out successfully");
  };

  const computeBalance = (productId: string, isFG = false) => {
    return movements.reduce((sum, m) => {
      const id = isFG ? m.fgId : m.productId;
      if (id === productId) {
        return sum + (m.type === 'IN' ? (m.quantity || m.qty || 0) : -(m.quantity || m.qty || 0));
      }
      return sum;
    }, 0);
  };

  // --- Render Functions ---

  const renderDashboard = () => {
    const lowStockRM = rmProducts.filter(p => computeBalance(p.id) <= p.threshold);
    const lowStockFG = fgProducts.filter(p => computeBalance(p.id, true) <= p.threshold);
    
    const today = todayISO();
    const docsToday = [
      ...bills.filter(b => b.date === today),
      ...deliveryNotes.filter(d => d.date === today),
      ...productions.filter(p => p.date === today)
    ].length;

    // Chart Data
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().split('T')[0];
    });

    const chartData = last14Days.map(date => {
      const dayMoves = movements.filter(m => m.date === date);
      const d = new Date(date);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
        in: dayMoves.filter(m => m.type === 'IN').reduce((s, m) => s + (m.quantity || m.qty || 0), 0),
        out: dayMoves.filter(m => m.type === 'OUT').reduce((s, m) => s + (m.quantity || m.qty || 0), 0),
      };
    });

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="RM Items" value={rmProducts.length} icon={Package} trend="+2" color="indigo" />
          <StatCard label="FG Items" value={fgProducts.length} icon={Factory} trend="+1" color="emerald" />
          <StatCard label="Low Stock" value={lowStockRM.length + lowStockFG.length} icon={AlertTriangle} color="amber" />
          <StatCard label="Docs Today" value={docsToday} icon={FileText} color="rose" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2" title="Stock Movement" subtitle="Last 14 days activity">
            <div className="h-[350px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Line type="monotone" dataKey="in" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Stock IN" />
                  <Line type="monotone" dataKey="out" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Stock OUT" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Low Stock Alerts" subtitle="Items requiring attention">
            <div className="space-y-4 mt-4">
              {[...lowStockRM, ...lowStockFG].slice(0, 6).map((item: any, idx) => {
                const isFG = 'productcode' in item;
                const bal = computeBalance(item.id, isFG);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">{isFG ? 'Finished Good' : 'Raw Material'}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-black", bal <= 0 ? "text-rose-600" : "text-amber-600")}>
                        {bal}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Balance</p>
                    </div>
                  </div>
                );
              })}
              {lowStockRM.length === 0 && lowStockFG.length === 0 && (
                <div className="text-center py-8 opacity-40">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm">All stock levels are healthy</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card title="Recent Activity" subtitle="Latest inventory movements">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 font-semibold">Time</th>
                  <th className="pb-4 font-semibold">User</th>
                  <th className="pb-4 font-semibold">Action</th>
                  <th className="pb-4 font-semibold">Entity</th>
                  <th className="pb-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {auditLogs.slice(0, 10).map((log, idx) => (
                  <tr key={idx} className="text-sm group hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-slate-500">{fmtDateTime(log.at)}</td>
                    <td className="py-4 font-medium text-slate-700">{log.by}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                        log.action.includes("CREATE") || log.action.includes("IN") ? "bg-emerald-50 text-emerald-600" : 
                        log.action.includes("DELETE") || log.action.includes("OUT") ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 font-mono text-xs">{log.entityId}</td>
                    <td className="py-4 text-slate-600 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderRMList = () => {
    const filtered = rmProducts.filter(p => 
      p.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
      p.code.toLowerCase().includes(globalSearch.toLowerCase())
    );

    return (
      <Card 
        title="Raw Material Inventory" 
        subtitle="Manage your raw material stock levels"
        action={
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage('rmAdd')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                <th className="pb-4 font-semibold">Code</th>
                <th className="pb-4 font-semibold">Product Name</th>
                <th className="pb-4 font-semibold">Category</th>
                <th className="pb-4 font-semibold text-right">Balance</th>
                <th className="pb-4 font-semibold text-right">Threshold</th>
                <th className="pb-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p, idx) => {
                const bal = computeBalance(p.id);
                return (
                  <tr key={idx} className="text-sm group hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-mono text-slate-500">{p.code}</td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[10px] text-slate-400">{p.barcode}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-600">{p.category}</td>
                    <td className={cn("py-4 text-right font-black", bal <= p.threshold ? "text-rose-600" : "text-slate-900")}>
                      {bal}
                    </td>
                    <td className="py-4 text-right text-slate-400">{p.threshold}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderRMAdd = () => {
    const [form, setForm] = useState<Partial<RMProduct>>({
      code: '',
      name: '',
      category: '',
      threshold: 5,
      barcode: '',
      groups: [],
      exclusive: false,
      qtyPerFG: 1
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const id = genId();
      const product = { ...form, id } as RMProduct;
      await set(ref(db, `${CLOUD_ROOT}/products/${id}`), product);
      logAction("RM_ADD", id, product);
      toast.success("Product added successfully");
      setCurrentPage('rmList');
    };

    return (
      <Card title="Add Raw Material" subtitle="Create a new RM product entry">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Product Code</label>
              <input 
                type="text" 
                required
                value={form.code}
                onChange={e => setForm({...form, code: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. RM-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Product Name</label>
              <input 
                type="text" 
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Raw Material A"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Category</label>
              <input 
                type="text" 
                value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Chemicals"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Low Stock Threshold</label>
              <input 
                type="number" 
                value={form.threshold}
                onChange={e => setForm({...form, threshold: parseInt(e.target.value)})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Barcode</label>
              <input 
                type="text" 
                value={form.barcode}
                onChange={e => setForm({...form, barcode: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Qty per FG (BOM)</label>
              <input 
                type="number" 
                step="0.0001"
                value={form.qtyPerFG}
                onChange={e => setForm({...form, qtyPerFG: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setCurrentPage('rmList')}
              className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              Save Product
            </button>
          </div>
        </form>
      </Card>
    );
  };

  const renderRMIn = () => {
    const [selectedProduct, setSelectedProduct] = useState<RMProduct | null>(null);
    const [qty, setQty] = useState(0);
    const [remark, setRemark] = useState('');

    const handleStockIn = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProduct || qty <= 0) return;

      const moveId = genId();
      const move: Movement = {
        id: moveId,
        productId: selectedProduct.id,
        type: 'IN',
        quantity: qty,
        date: todayISO(),
        remark,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      };

      await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), move);
      logAction("RM_STOCK_IN", selectedProduct.id, { qty, remark });
      toast.success(`Stock IN successful for ${selectedProduct.name}`);
      setSelectedProduct(null);
      setQty(0);
      setRemark('');
    };

    return (
      <div className="space-y-6">
        <Card title="RM Stock In" subtitle="Add stock to raw material items">
          <form onSubmit={handleStockIn} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Select Product</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  onChange={e => setSelectedProduct(rmProducts.find(p => p.id === e.target.value) || null)}
                  value={selectedProduct?.id || ''}
                  required
                >
                  <option value="">-- Select RM --</option>
                  {rmProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Quantity</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={qty}
                  onChange={e => setQty(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Remark</label>
                <input 
                  type="text" 
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Optional note"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              Submit Stock IN
            </button>
          </form>
        </Card>

        <Card title="Recent RM Inbound Movements">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 font-semibold">Date</th>
                  <th className="pb-4 font-semibold">Product</th>
                  <th className="pb-4 font-semibold text-right">Qty</th>
                  <th className="pb-4 font-semibold">Remark</th>
                  <th className="pb-4 font-semibold">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movements
                  .filter(m => m.type === 'IN' && m.productId)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 10)
                  .map((m, idx) => {
                    const p = rmProducts.find(x => x.id === m.productId);
                    return (
                      <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                        <td className="py-4 text-slate-500">{fmtDate(m.date)}</td>
                        <td className="py-4 font-bold text-slate-800">{p?.name || 'Unknown'}</td>
                        <td className="py-4 text-right font-black text-emerald-600">+{m.quantity || m.qty}</td>
                        <td className="py-4 text-slate-500">{m.remark}</td>
                        <td className="py-4 text-slate-400">{m.createdBy}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderRMOut = () => {
    const [selectedProduct, setSelectedProduct] = useState<RMProduct | null>(null);
    const [qty, setQty] = useState(0);
    const [remark, setRemark] = useState('');

    const handleStockOut = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProduct || qty <= 0) return;
      
      const bal = computeBalance(selectedProduct.id);
      if (qty > bal) {
        toast.error("Insufficient stock balance");
        return;
      }

      const moveId = genId();
      const move: Movement = {
        id: moveId,
        productId: selectedProduct.id,
        type: 'OUT',
        quantity: qty,
        date: todayISO(),
        remark,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      };

      await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), move);
      logAction("RM_STOCK_OUT", selectedProduct.id, { qty, remark });
      toast.success(`Stock OUT successful for ${selectedProduct.name}`);
      setSelectedProduct(null);
      setQty(0);
      setRemark('');
    };

    return (
      <div className="space-y-6">
        <Card title="RM Stock Out" subtitle="Issue stock from raw material items">
          <form onSubmit={handleStockOut} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Select Product</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  onChange={e => setSelectedProduct(rmProducts.find(p => p.id === e.target.value) || null)}
                  value={selectedProduct?.id || ''}
                  required
                >
                  <option value="">-- Select RM --</option>
                  {rmProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code}) - Bal: {computeBalance(p.id)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Quantity</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={qty}
                  onChange={e => setQty(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Remark</label>
                <input 
                  type="text" 
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Optional note"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="px-8 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
            >
              Submit Stock OUT
            </button>
          </form>
        </Card>

        <Card title="Recent RM Outbound Movements">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 font-semibold">Date</th>
                  <th className="pb-4 font-semibold">Product</th>
                  <th className="pb-4 font-semibold text-right">Qty</th>
                  <th className="pb-4 font-semibold">Remark</th>
                  <th className="pb-4 font-semibold">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movements
                  .filter(m => m.type === 'OUT' && m.productId)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 10)
                  .map((m, idx) => {
                    const p = rmProducts.find(x => x.id === m.productId);
                    return (
                      <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                        <td className="py-4 text-slate-500">{fmtDate(m.date)}</td>
                        <td className="py-4 font-bold text-slate-800">{p?.name || 'Unknown'}</td>
                        <td className="py-4 text-right font-black text-rose-600">-{m.quantity || m.qty}</td>
                        <td className="py-4 text-slate-500">{m.remark}</td>
                        <td className="py-4 text-slate-400">{m.createdBy}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderFGList = () => {
    const filtered = fgProducts.filter(p => 
      p.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
      p.productcode.toLowerCase().includes(globalSearch.toLowerCase())
    );

    return (
      <Card 
        title="Finished Goods Inventory" 
        subtitle="Manage your finished products"
        action={
          <button 
            onClick={() => setCurrentPage('fgAdd')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add FG Product
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                <th className="pb-4 font-semibold">Code</th>
                <th className="pb-4 font-semibold">Product Name</th>
                <th className="pb-4 font-semibold">Volume</th>
                <th className="pb-4 font-semibold text-right">Balance</th>
                <th className="pb-4 font-semibold text-right">Threshold</th>
                <th className="pb-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p, idx) => {
                const bal = computeBalance(p.id, true);
                return (
                  <tr key={idx} className="text-sm group hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-mono text-slate-500">{p.productcode}</td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[10px] text-slate-400">{p.barcode}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-600">{p.volume}</td>
                    <td className={cn("py-4 text-right font-black", bal <= p.threshold ? "text-rose-600" : "text-emerald-600")}>
                      {bal}
                    </td>
                    <td className="py-4 text-right text-slate-400">{p.threshold}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderFGAdd = () => {
    const [form, setForm] = useState<Partial<FGProduct>>({
      productcode: '',
      barcode: '',
      name: '',
      volume: '',
      group: '',
      batch: '',
      expiry: '',
      threshold: 5
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const id = genId();
      const product = { ...form, id } as FGProduct;
      await set(ref(db, `${CLOUD_ROOT}/fgProducts/${id}`), product);
      logAction("FG_ADD", id, product);
      toast.success("FG Product added successfully");
      setCurrentPage('fgList');
    };

    return (
      <Card title="Add Finished Good" subtitle="Create a new FG product entry">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Product Code</label>
              <input 
                type="text" 
                required
                value={form.productcode}
                onChange={e => setForm({...form, productcode: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. FG-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Product Name</label>
              <input 
                type="text" 
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Finished Product A"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Volume / Size</label>
              <input 
                type="text" 
                value={form.volume}
                onChange={e => setForm({...form, volume: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. 500ml"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Group Prefix</label>
              <input 
                type="text" 
                value={form.group}
                onChange={e => setForm({...form, group: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. ALKHOR"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Low Stock Threshold</label>
              <input 
                type="number" 
                value={form.threshold}
                onChange={e => setForm({...form, threshold: parseInt(e.target.value)})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Barcode</label>
              <input 
                type="text" 
                value={form.barcode}
                onChange={e => setForm({...form, barcode: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setCurrentPage('fgList')}
              className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
            >
              Save FG Product
            </button>
          </div>
        </form>
      </Card>
    );
  };

  const renderSuppliers = () => {
    const [form, setForm] = useState<Partial<Supplier>>({ name: '', contact: '', phone: '', email: '' });
    const [isEditing, setIsEditing] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isEditing) {
        await update(ref(db, `${CLOUD_ROOT}/suppliers/${isEditing}`), { ...form, updatedAt: new Date().toISOString(), updatedBy: currentUser?.username });
        logAction("SUPPLIER_EDIT", isEditing, form);
        toast.success("Supplier updated");
      } else {
        const id = genId();
        await set(ref(db, `${CLOUD_ROOT}/suppliers/${id}`), { ...form, id, createdAt: new Date().toISOString(), createdBy: currentUser?.username });
        logAction("SUPPLIER_ADD", id, form);
        toast.success("Supplier added");
      }
      setForm({ name: '', contact: '', phone: '', email: '' });
      setIsEditing(null);
    };

    return (
      <div className="space-y-8">
        <Card title={isEditing ? "Edit Supplier" : "Add New Supplier"}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
              <input 
                type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Contact/Address</label>
              <input 
                type="text" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
              <input 
                type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
                {isEditing ? "Update" : "Add Supplier"}
              </button>
              {isEditing && (
                <button type="button" onClick={() => { setIsEditing(null); setForm({ name: '', contact: '', phone: '', email: '' }); }} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Card>

        <Card title="Supplier List">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 font-semibold">Name</th>
                  <th className="pb-4 font-semibold">Address</th>
                  <th className="pb-4 font-semibold">Phone</th>
                  <th className="pb-4 font-semibold">Email</th>
                  <th className="pb-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map((s, idx) => (
                  <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-800">{s.name}</td>
                    <td className="py-4 text-slate-600">{s.contact}</td>
                    <td className="py-4 text-slate-600">{s.phone}</td>
                    <td className="py-4 text-slate-600">{s.email}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setIsEditing(s.id); setForm(s); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={async () => { if(confirm("Delete supplier?")) { await remove(ref(db, `${CLOUD_ROOT}/suppliers/${s.id}`)); logAction("SUPPLIER_DELETE", s.id, s); toast.success("Supplier deleted"); } }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderProductionAdd = () => {
    const [selectedFG, setSelectedFG] = useState<FGProduct | null>(null);
    const [qty, setQty] = useState(0);
    const [batch, setBatch] = useState('');
    const [expiry, setExpiry] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedFG || qty <= 0) return;

      const id = genId();
      const prod: Production = {
        id,
        fgId: selectedFG.id,
        quantity: qty,
        batch,
        expiry,
        date: todayISO(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      };

      await set(ref(db, `${CLOUD_ROOT}/productions/${id}`), prod);
      
      // Also create a stock movement for FG
      const moveId = genId();
      await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), {
        id: moveId,
        fgId: selectedFG.id,
        type: 'IN',
        quantity: qty,
        date: todayISO(),
        remark: `Production: ${batch}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      });

      logAction("PRODUCTION_ADD", id, prod);
      toast.success("Production record saved");
      setCurrentPage('prodList');
    };

    return (
      <Card title="New Production Entry" subtitle="Record a new production batch">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select Finished Good</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                onChange={e => setSelectedFG(fgProducts.find(p => p.id === e.target.value) || null)}
                value={selectedFG?.id || ''}
                required
              >
                <option value="">-- Select FG --</option>
                {fgProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.productcode})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Quantity Produced</label>
              <input 
                type="number" required min="1" value={qty} onChange={e => setQty(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Batch Number</label>
              <input 
                type="text" required value={batch} onChange={e => setBatch(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. BATCH-2026-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Expiry Date</label>
              <input 
                type="date" required value={expiry} onChange={e => setExpiry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setCurrentPage('prodList')} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
              Save Production
            </button>
          </div>
        </form>
      </Card>
    );
  };

  const renderProductionList = () => {
    return (
      <Card title="Production Records" subtitle="History of all production batches">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                <th className="pb-4 font-semibold">Date</th>
                <th className="pb-4 font-semibold">Product</th>
                <th className="pb-4 font-semibold">Batch</th>
                <th className="pb-4 font-semibold text-right">Qty</th>
                <th className="pb-4 font-semibold">Expiry</th>
                <th className="pb-4 font-semibold">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productions.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((p, idx) => {
                const fg = fgProducts.find(x => x.id === p.fgId);
                return (
                  <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-slate-500">{fmtDate(p.date)}</td>
                    <td className="py-4 font-bold text-slate-800">{fg?.name || 'Unknown'}</td>
                    <td className="py-4 font-mono text-indigo-600">{p.batch}</td>
                    <td className="py-4 text-right font-black text-slate-700">{p.quantity}</td>
                    <td className="py-4 text-slate-500">{fmtDate(p.expiry)}</td>
                    <td className="py-4 text-slate-400">{p.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderAuditTrail = () => {
    return (
      <Card title="System Audit Trail" subtitle="Complete history of all user actions">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                <th className="pb-4 font-semibold">Timestamp</th>
                <th className="pb-4 font-semibold">User</th>
                <th className="pb-4 font-semibold">Action</th>
                <th className="pb-4 font-semibold">Target</th>
                <th className="pb-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {auditLogs.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map((log, idx) => (
                <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-slate-500 font-mono text-[10px]">{fmtDateTime(log.timestamp)}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600">{log.username}</span>
                  </td>
                  <td className="py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase",
                      log.action.includes("ADD") ? "bg-emerald-50 text-emerald-600" :
                      log.action.includes("DELETE") ? "bg-rose-50 text-rose-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-4 text-slate-400 font-mono text-[10px]">{log.targetId}</td>
                  <td className="py-4 text-slate-500 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderUserManagement = () => {
    const [form, setForm] = useState<Partial<User>>({ username: '', password: '', role: 'operator' });
    const [isEditing, setIsEditing] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isEditing) {
        await update(ref(db, `${CLOUD_ROOT}/users/${isEditing}`), { ...form });
        logAction("USER_EDIT", isEditing, { username: form.username, role: form.role });
        toast.success("User updated");
      } else {
        const id = genId();
        await set(ref(db, `${CLOUD_ROOT}/users/${id}`), { ...form, id });
        logAction("USER_ADD", id, { username: form.username, role: form.role });
        toast.success("User created");
      }
      setForm({ username: '', password: '', role: 'operator' });
      setIsEditing(null);
    };

    return (
      <div className="space-y-8">
        <Card title={isEditing ? "Edit User" : "Create New User"}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
              <input 
                type="text" required value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
              <input 
                type="password" required={!isEditing} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={isEditing ? "Leave blank to keep same" : ""}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
              <select 
                value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
                {isEditing ? "Update" : "Create User"}
              </button>
              {isEditing && (
                <button type="button" onClick={() => { setIsEditing(null); setForm({ username: '', password: '', role: 'operator' }); }} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Card>

        <Card title="System Users">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 font-semibold">Username</th>
                  <th className="pb-4 font-semibold">Role</th>
                  <th className="pb-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u, idx) => (
                  <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-800">{u.username}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        u.role === 'admin' ? "bg-indigo-50 text-indigo-600" :
                        u.role === 'manager' ? "bg-emerald-50 text-emerald-600" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setIsEditing(u.id); setForm({ username: u.username, role: u.role }); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          disabled={u.username === 'admin'}
                          onClick={async () => { if(confirm("Delete user?")) { await remove(ref(db, `${CLOUD_ROOT}/users/${u.id}`)); logAction("USER_DELETE", u.id, { username: u.username }); toast.success("User deleted"); } }} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderRMHistory = () => {
    const [selectedProduct, setSelectedProduct] = useState<string>('all');
    
    const filtered = movements.filter(m => 
      (selectedProduct === 'all' || m.productId === selectedProduct) &&
      rmProducts.some(p => p.id === m.productId)
    );

    return (
      <Card title="RM Movement History" subtitle="Track all stock changes for raw materials">
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Filter by Product</label>
          <select 
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Products</option>
            {rmProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-50">
                <th className="pb-4 font-semibold">Timestamp</th>
                <th className="pb-4 font-semibold">Product</th>
                <th className="pb-4 font-semibold">Type</th>
                <th className="pb-4 font-semibold text-right">Qty</th>
                <th className="pb-4 font-semibold">Remark</th>
                <th className="pb-4 font-semibold">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((m, idx) => {
                const p = rmProducts.find(x => x.id === m.productId);
                return (
                  <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-slate-500 font-mono text-[10px]">{fmtDateTime(m.createdAt)}</td>
                    <td className="py-4 font-bold text-slate-800">{p?.name || 'Unknown'}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        m.type === 'IN' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {m.type}
                      </span>
                    </td>
                    <td className={cn("py-4 text-right font-black", m.type === 'IN' ? "text-emerald-600" : "text-rose-600")}>
                      {m.type === 'IN' ? '+' : '-'}{m.quantity || m.qty}
                    </td>
                    <td className="py-4 text-slate-500">{m.remark}</td>
                    <td className="py-4 text-slate-400">{m.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderFGIn = () => {
    const [selectedProduct, setSelectedProduct] = useState<FGProduct | null>(null);
    const [qty, setQty] = useState(0);
    const [remark, setRemark] = useState('');

    const handleStockIn = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProduct || qty <= 0) return;

      const moveId = genId();
      await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), {
        id: moveId,
        fgId: selectedProduct.id,
        type: 'IN',
        quantity: qty,
        date: todayISO(),
        remark,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      });

      logAction("FG_STOCK_IN", selectedProduct.id, { qty, remark });
      toast.success(`Stock IN successful for ${selectedProduct.name}`);
      setSelectedProduct(null);
      setQty(0);
      setRemark('');
    };

    return (
      <Card title="FG Stock In" subtitle="Add stock to finished goods">
        <form onSubmit={handleStockIn} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select FG Product</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                onChange={e => setSelectedProduct(fgProducts.find(p => p.id === e.target.value) || null)}
                value={selectedProduct?.id || ''}
                required
              >
                <option value="">-- Select FG --</option>
                {fgProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.productcode})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Quantity</label>
              <input 
                type="number" required min="1" value={qty} onChange={e => setQty(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Remark</label>
              <input 
                type="text" value={remark} onChange={e => setRemark(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <button type="submit" className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all">
            Submit FG Stock IN
          </button>
        </form>
      </Card>
    );
  };

  const renderFGOut = () => {
    const [selectedProduct, setSelectedProduct] = useState<FGProduct | null>(null);
    const [qty, setQty] = useState(0);
    const [remark, setRemark] = useState('');

    const handleStockOut = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProduct || qty <= 0) return;
      
      const bal = computeBalance(selectedProduct.id, true);
      if (qty > bal) {
        toast.error("Insufficient stock balance");
        return;
      }

      const moveId = genId();
      await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), {
        id: moveId,
        fgId: selectedProduct.id,
        type: 'OUT',
        quantity: qty,
        date: todayISO(),
        remark,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      });

      logAction("FG_STOCK_OUT", selectedProduct.id, { qty, remark });
      toast.success(`Stock OUT successful for ${selectedProduct.name}`);
      setSelectedProduct(null);
      setQty(0);
      setRemark('');
    };

    return (
      <Card title="FG Stock Out" subtitle="Issue stock from finished goods">
        <form onSubmit={handleStockOut} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select FG Product</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                onChange={e => setSelectedProduct(fgProducts.find(p => p.id === e.target.value) || null)}
                value={selectedProduct?.id || ''}
                required
              >
                <option value="">-- Select FG --</option>
                {fgProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.productcode}) - Bal: {computeBalance(p.id, true)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Quantity</label>
              <input 
                type="number" required min="1" value={qty} onChange={e => setQty(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Remark</label>
              <input 
                type="text" value={remark} onChange={e => setRemark(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <button type="submit" className="px-8 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all">
            Submit FG Stock OUT
          </button>
        </form>
      </Card>
    );
  };

  const renderGRN = () => {
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [billNo, setBillNo] = useState('');
    const [date, setDate] = useState(todayISO());
    const [items, setItems] = useState<{ productId: string, qty: number, remark: string }[]>([]);

    const addItem = () => setItems([...items, { productId: '', qty: 0, remark: '' }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: string, val: any) => {
      const newItems = [...items];
      (newItems[idx] as any)[field] = val;
      setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedSupplier || items.length === 0) return;

      const id = genId();
      const bill: Bill = {
        id,
        billNo,
        date,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        items,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      };

      await set(ref(db, `${CLOUD_ROOT}/bills/${id}`), bill);

      // Add stock movements for each item
      for (const item of items) {
        const moveId = genId();
        await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), {
          id: moveId,
          productId: item.productId,
          type: 'IN',
          quantity: item.qty,
          date,
          remark: `GRN: ${billNo}`,
          billId: id,
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.username || 'unknown'
        });
      }

      logAction("GRN_ADD", id, bill);
      toast.success("GRN saved and stock updated");
      setCurrentPage('dashboard');
    };

    return (
      <Card title="Goods Received Note (GRN)" subtitle="Record incoming raw materials from suppliers">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Supplier</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                onChange={e => setSelectedSupplier(suppliers.find(s => s.id === e.target.value) || null)}
                value={selectedSupplier?.id || ''}
                required
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Bill / Invoice No</label>
              <input 
                type="text" required value={billNo} onChange={e => setBillNo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Date</label>
              <input 
                type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Items</h4>
              <button type="button" onClick={addItem} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl">
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Product</label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                      value={item.productId}
                      onChange={e => updateItem(idx, 'productId', e.target.value)}
                      required
                    >
                      <option value="">-- Select RM --</option>
                      {rmProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                    <input 
                      type="number" required min="1" value={item.qty}
                      onChange={e => updateItem(idx, 'qty', parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Remark</label>
                    <input 
                      type="text" value={item.remark}
                      onChange={e => updateItem(idx, 'remark', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setCurrentPage('dashboard')} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
              Submit GRN
            </button>
          </div>
        </form>
      </Card>
    );
  };

  const renderDN = () => {
    const [dnNo, setDnNo] = useState('');
    const [date, setDate] = useState(todayISO());
    const [to, setTo] = useState('');
    const [items, setItems] = useState<{ productId: string, qty: number, remark: string }[]>([]);

    const addItem = () => setItems([...items, { productId: '', qty: 0, remark: '' }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: string, val: any) => {
      const newItems = [...items];
      (newItems[idx] as any)[field] = val;
      setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (items.length === 0) return;

      // Check stock for all items
      for (const item of items) {
        const bal = computeBalance(item.productId, true);
        if (item.qty > bal) {
          toast.error(`Insufficient stock for item ${item.productId}`);
          return;
        }
      }

      const id = genId();
      const dn: DeliveryNote = {
        id,
        dnNo,
        date,
        from: 'Main Warehouse',
        to,
        productionPlan: '',
        prodRef: '',
        generalRemark: '',
        items,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'unknown'
      };

      await set(ref(db, `${CLOUD_ROOT}/deliveryNotes/${id}`), dn);

      // Add stock movements for each item
      for (const item of items) {
        const moveId = genId();
        await set(ref(db, `${CLOUD_ROOT}/stockMovements/${moveId}`), {
          id: moveId,
          fgId: item.productId,
          type: 'OUT',
          quantity: item.qty,
          date,
          remark: `DN: ${dnNo}`,
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.username || 'unknown'
        });
      }

      logAction("DN_ADD", id, dn);
      toast.success("Delivery Note saved and stock updated");
      setCurrentPage('dashboard');
    };

    return (
      <Card title="Delivery Note (DN)" subtitle="Record outgoing finished goods to customers">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">DN Number</label>
              <input 
                type="text" required value={dnNo} onChange={e => setDnNo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Destination / Customer</label>
              <input 
                type="text" required value={to} onChange={e => setTo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Date</label>
              <input 
                type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Items</h4>
              <button type="button" onClick={addItem} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl">
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">FG Product</label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                      value={item.productId}
                      onChange={e => updateItem(idx, 'productId', e.target.value)}
                      required
                    >
                      <option value="">-- Select FG --</option>
                      {fgProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.productcode}) - Bal: {computeBalance(p.id, true)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                    <input 
                      type="number" required min="1" value={item.qty}
                      onChange={e => updateItem(idx, 'qty', parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Remark</label>
                    <input 
                      type="text" value={item.remark}
                      onChange={e => updateItem(idx, 'remark', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setCurrentPage('dashboard')} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
              Submit DN
            </button>
          </div>
        </form>
      </Card>
    );
  };

  const renderAuth = () => {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-200">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">ProStock Manager</h1>
            <p className="text-slate-500 mt-2">Enterprise Inventory & Production</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Username</label>
                <input 
                  type="text" 
                  required
                  value={loginForm.username}
                  onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Password</label>
                <input 
                  type="password" 
                  required
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
              >
                Sign In
              </button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                Don't have an account? <button className="text-indigo-600 font-bold hover:underline">Contact Admin</button>
              </p>
            </div>
          </Card>
          <p className="text-center text-xs text-slate-400 mt-8">
            &copy; 2026 ProStock Systems. All rights reserved.
          </p>
        </motion.div>
      </div>
    );
  };

  if (isAuthLoading) return null;
  if (!currentUser) return renderAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-100 transition-all duration-300 ease-in-out flex flex-col",
          sidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <Database className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tight">ProStock</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={currentPage === 'dashboard'} 
            onClick={() => setCurrentPage('dashboard')}
            collapsed={sidebarCollapsed}
          />
          
          <SidebarItem 
            icon={Package} 
            label="Raw Materials" 
            collapsed={sidebarCollapsed}
            submenu={[
              { label: "Inventory List", active: currentPage === 'rmList', onClick: () => setCurrentPage('rmList') },
              { label: "Add Product", active: currentPage === 'rmAdd', onClick: () => setCurrentPage('rmAdd') },
              { label: "Stock In", active: currentPage === 'rmIn', onClick: () => setCurrentPage('rmIn') },
              { label: "Stock Out", active: currentPage === 'rmOut', onClick: () => setCurrentPage('rmOut') },
              { label: "History", active: currentPage === 'rmHistory', onClick: () => setCurrentPage('rmHistory') },
            ]}
          />

          <SidebarItem 
            icon={Factory} 
            label="Finished Goods" 
            collapsed={sidebarCollapsed}
            submenu={[
              { label: "Inventory List", active: currentPage === 'fgList', onClick: () => setCurrentPage('fgList') },
              { label: "Add Product", active: currentPage === 'fgAdd', onClick: () => setCurrentPage('fgAdd') },
              { label: "Stock In", active: currentPage === 'fgIn', onClick: () => setCurrentPage('fgIn') },
              { label: "Stock Out", active: currentPage === 'fgOut', onClick: () => setCurrentPage('fgOut') },
            ]}
          />

          <SidebarItem 
            icon={ArrowLeftRight} 
            label="Production" 
            collapsed={sidebarCollapsed}
            submenu={[
              { label: "New Entry", active: currentPage === 'prodAdd', onClick: () => setCurrentPage('prodAdd') },
              { label: "Records", active: currentPage === 'prodList', onClick: () => setCurrentPage('prodList') },
            ]}
          />

          <SidebarItem 
            icon={Truck} 
            label="Logistics" 
            collapsed={sidebarCollapsed}
            submenu={[
              { label: "Goods Received", active: currentPage === 'grn', onClick: () => setCurrentPage('grn') },
              { label: "Delivery Notes", active: currentPage === 'dn', onClick: () => setCurrentPage('dn') },
              { label: "Suppliers", active: currentPage === 'suppliers', onClick: () => setCurrentPage('suppliers') },
            ]}
          />

          {can("users:manage") && (
            <SidebarItem 
              icon={Users} 
              label="User Management" 
              active={currentPage === 'users'} 
              onClick={() => setCurrentPage('users')}
              collapsed={sidebarCollapsed}
            />
          )}

          <SidebarItem 
            icon={History} 
            label="Audit Trail" 
            active={currentPage === 'audit'} 
            onClick={() => setCurrentPage('audit')}
            collapsed={sidebarCollapsed}
          />
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className={cn("flex items-center gap-3 p-3 rounded-2xl bg-slate-50", sidebarCollapsed && "justify-center")}>
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
              {currentUser.username[0].toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{currentUser.username}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">{currentUser.role}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarCollapsed ? "ml-20" : "ml-72"
        )}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-slate-800 capitalize">{currentPage.replace(/([A-Z])/g, ' $1')}</h2>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search inventory, docs..."
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all w-64"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentPage === 'dashboard' && renderDashboard()}
              {currentPage === 'rmList' && renderRMList()}
              {currentPage === 'rmAdd' && renderRMAdd()}
              {currentPage === 'rmIn' && renderRMIn()}
              {currentPage === 'rmOut' && renderRMOut()}
              {currentPage === 'rmHistory' && renderRMHistory()}
              {currentPage === 'fgList' && renderFGList()}
              {currentPage === 'fgAdd' && renderFGAdd()}
              {currentPage === 'fgIn' && renderFGIn()}
              {currentPage === 'fgOut' && renderFGOut()}
              {currentPage === 'prodAdd' && renderProductionAdd()}
              {currentPage === 'prodList' && renderProductionList()}
              {currentPage === 'suppliers' && renderSuppliers()}
              {currentPage === 'grn' && renderGRN()}
              {currentPage === 'dn' && renderDN()}
              {currentPage === 'users' && renderUserManagement()}
              {currentPage === 'audit' && renderAuditTrail()}
              
              {/* Fallback for unimplemented pages */}
              {!['dashboard', 'rmList', 'rmAdd', 'rmIn', 'rmOut', 'rmHistory', 'fgList', 'fgAdd', 'fgIn', 'fgOut', 'prodAdd', 'prodList', 'suppliers', 'grn', 'dn', 'users', 'audit'].includes(currentPage) && (
                <div className="flex flex-col items-center justify-center py-24 opacity-20 grayscale">
                  <Database className="w-24 h-24 mb-4" />
                  <h3 className="text-2xl font-black">Feature Coming Soon</h3>
                  <p className="text-slate-500">This module is currently being migrated to the new ProStock architecture.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
