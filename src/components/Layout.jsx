import React, { useEffect, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { EVENTO_AGGIORNAMENTO } from '@/lib/qualifica';
import {
  LayoutDashboard, Upload, ClipboardList, Truck, Factory,
  Ship, Warehouse, Target, FileText, CheckSquare, Menu, LogOut, Recycle, BarChart3, Shield, LineChart, Car, MapPin, ShieldCheck, ClipboardCheck, Sparkles, FileBarChart, Inbox, Users } from
'lucide-react';
import { caricaLivello, proteggiScritture } from '@/lib/permessi';

const NAV_ITEMS = [
{ label: 'Dashboard', path: '/', icon: LayoutDashboard },
{ label: 'Caricamento Dati', path: '/caricamento-dati', icon: Upload },
  { label: 'Assegnati Rete', path: '/assegnati', icon: ClipboardList },
{ label: 'Assegnati ACI', path: '/assegnati-aci', icon: Car },
  { label: 'PDR', path: '/pdr', icon: MapPin },
{ label: 'Terminati Rete', path: '/primarie-rete', icon: Truck },
  { label: 'Terminati ACI', path: '/primarie-aci', icon: Factory },
{ label: 'Secondarie', path: '/secondarie', icon: Truck },
{ label: 'Terziarie', path: '/terziarie', icon: Ship },
  { label: 'Giacenze', path: '/giacenze', icon: Warehouse },
   { label: 'Extra Raccolta', path: '/extra-raccolta', icon: Recycle },
  { label: 'Target & Status', path: '/target-status', icon: Target },
{ label: 'Report', path: '/report', icon: FileBarChart },
{ label: 'Report Mensile', path: '/report-mensile', icon: BarChart3 },
{ label: 'Alert & Controllo', path: '/alert-engine', icon: Shield },
{ label: 'Fatturazione', path: '/fatturazione', icon: FileText },
{ label: 'Qualifica Fornitori', path: '/qualifica-fornitori', icon: ShieldCheck, contatore: 'qualifica' },
{ label: 'Verifiche', path: '/verifiche', icon: ClipboardCheck },
{ label: 'Assistente', path: '/assistente', icon: Sparkles },
{ label: 'Predittività Secondarie', path: '/predittivita-secondarie', icon: LineChart },
{ label: 'To-Do List', path: '/todo', icon: CheckSquare },
{ label: 'Richieste', path: '/richieste', icon: Inbox, contatore: 'richieste' },
{ label: 'Utenti', path: '/utenti', icon: Users, soloAdmin: true }];


export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const [alertQualifica, setAlertQualifica] = useState(0);
  const [richiesteAperte, setRichiesteAperte] = useState(0);
  const isAdmin = !!user && user.role === 'admin';

  // Il ruolo serve anche fuori dai componenti, per fermare le scritture di chi
  // consulta soltanto. La rete di sicurezza si installa una volta sola.
  useEffect(() => {
    proteggiScritture();
    caricaLivello(user);
  }, [user]);

  // Contatore delle richieste: all'amministratore quelle da valutare, agli altri
  // le proprie ancora in attesa di risposta.
  useEffect(() => {
    let attivo = true;
    const leggi = async () => {
      try {
        const aperte = await base44.entities.RichiestaUtente.filter({ stato: 'in_attesa' }, '-created_date', 200);
        const mie = isAdmin ? aperte : aperte.filter(r => (r.richiedente_email || '') === ((user && user.email) || ''));
        if (attivo) setRichiesteAperte(mie.length);
      } catch (_e) { /* il contatore e' accessorio: in caso di errore resta nascosto */ }
    };
    leggi();
    const intervallo = setInterval(leggi, 5 * 60 * 1000);
    return () => { attivo = false; clearInterval(intervallo); };
  }, [isAdmin, user]);

  // Contatore degli alert della qualifica fornitori. Legge solo il riepilogo gia'
  // salvato, che si aggiorna a ogni calcolo del modulo e al controllo giornaliero:
  // ricalcolarlo qui vorrebbe dire rileggere le movimentazioni a ogni pagina.
  useEffect(() => {
    let attivo = true;
    const anno = new Date().getFullYear();
    const leggi = async () => {
      try {
        const r = await base44.entities.RiepilogoQualifica.filter({ anno }, '-updated_date', 1);
        if (attivo) setAlertQualifica(r.length ? (r[0].alert_aperti || 0) : 0);
      } catch (_e) { /* il contatore e' accessorio: in caso di errore resta nascosto */ }
    };
    const suAggiornamento = (e) => {
      if (e.detail && e.detail.anno === anno) setAlertQualifica(e.detail.alert_aperti || 0);
    };
    leggi();
    const intervallo = setInterval(leggi, 5 * 60 * 1000);
    window.addEventListener(EVENTO_AGGIORNAMENTO, suAggiornamento);
    return () => { attivo = false; clearInterval(intervallo); window.removeEventListener(EVENTO_AGGIORNAMENTO, suAggiornamento); };
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar mobile overlay */}
      {sidebarOpen &&
      <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      }

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <Recycle className="w-7 h-7 text-sidebar-primary" />
          <div>
            <h1 className="font-heading font-bold text-sidebar-foreground leading-tight text-lg">Gestionale PFU</h1>
            <p className="text-xs text-sidebar-foreground/60">Smoco · Ecotyre</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.filter((item) => !item.soloAdmin || isAdmin).map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active ?
                'bg-sidebar-primary text-sidebar-primary-foreground' :
                'text-sidebar-foreground hover:bg-sidebar-accent'}`
                }>
                
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.contatore === 'richieste' && richiesteAperte > 0 && (
                  <span
                    title={isAdmin ? `${richiesteAperte} richieste da valutare` : `${richiesteAperte} tue richieste in attesa`}
                    className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold leading-none text-center tabular-nums">
                    {richiesteAperte > 99 ? '99+' : richiesteAperte}
                  </span>
                )}
                {item.contatore === 'qualifica' && alertQualifica > 0 && (
                  <span
                    title={`${alertQualifica} alert da gestire`}
                    className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none text-center tabular-nums">
                    {alertQualifica > 99 ? '99+' : alertQualifica}
                  </span>
                )}
              </Link>);

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
              title="Esci">
              
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
    </div>);

}