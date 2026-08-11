import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Upload, ClipboardList, Truck, Factory,
  Ship, Target, FileText, CheckSquare, Menu, X, LogOut, Recycle, BarChart3, Shield, LineChart
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Caricamento Dati', path: '/caricamento-dati', icon: Upload },
  { label: 'Assegnati', path: '/assegnati', icon: ClipboardList },
  { label: 'Primarie Rete', path: '/primarie-rete', icon: Truck },
  { label: 'Primarie ACI', path: '/primarie-aci', icon: Factory },
  { label: 'Secondarie', path: '/secondarie', icon: Truck },
  { label: 'Terziarie', path: '/terziarie', icon: Ship },
  { label: 'Target & Status', path: '/target-status', icon: Target },
  { label: 'Report Mensile', path: '/report-mensile', icon: BarChart3 },
  { label: 'Alert & Controllo', path: '/alert-engine', icon: Shield },
  { label: 'Fatturazione', path: '/fatturazione', icon: FileText },
  { label: 'Predittività Secondarie', path: '/predittivita-secondarie', icon: LineChart },
  { label: 'To-Do List', path: '/todo', icon: CheckSquare },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <Recycle className="w-7 h-7 text-sidebar-primary" />
          <div>
            <h1 className="font-heading font-bold text-sidebar-foreground leading-tight">Gestionale PFU</h1>
            <p className="text-xs text-sidebar-foreground/60">Smoco · Ecotyre</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.full_name || 'Utente'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md hover:bg-accent">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Recycle className="w-5 h-5 text-primary" />
            <span className="font-heading font-bold">Gestionale PFU</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}