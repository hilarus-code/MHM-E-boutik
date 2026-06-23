import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, LayoutDashboard, Settings, LogOut, Clock, Users, FileText, Lock, Sparkles, Menu, X } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useApp } from '../context/AppContext';

import PosView from './PosView';
import InventoryView from './InventoryView';
import DashboardView from './DashboardView';
import SessionView from './SessionView';
import CreditsView from './CreditsView';
import ReportsView from './ReportsView';
import AiAgentView from './AiAgentView';

type View = 'POS' | 'INVENTORY' | 'DASHBOARD' | 'SESSION' | 'CREDITS' | 'REPORTS' | 'AI_AGENT';

export default function Layout() {
  const [currentView, setCurrentView] = useState<View>('POS');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { activeSession, cart, isAdmin, setIsAdmin, hasPromptedSession, setHasPromptedSession } = useApp();

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Auto prompt session
  useEffect(() => {
    if (isAuthenticated && !activeSession && !hasPromptedSession) {
      setCurrentView('SESSION');
      setHasPromptedSession(true);
    }
  }, [isAuthenticated, activeSession, hasPromptedSession, setHasPromptedSession]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'admin') {
      setIsAdmin(true);
      setIsAuthenticated(true);
    } else if (passwordInput === 'vendeur') {
      setIsAdmin(false);
      setIsAuthenticated(true);
    } else {
      alert("Mot de passe incorrect");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setPasswordInput('');
    setCurrentView('POS');
  };

  const NavItem = ({ view, icon: Icon, label, badge, requiresAdmin = false }: { view: View, icon: any, label: string, badge?: number, requiresAdmin?: boolean }) => {
    if (requiresAdmin && !isAdmin) return null;
    
    return (
      <button
        onClick={() => {
          setCurrentView(view);
          setIsMobileMenuOpen(false);
        }}
        className={cn(
          "flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 group relative",
          currentView === view 
            ? "bg-slate-800 text-white shadow-lg" 
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <Icon className={cn("w-5 h-5 mr-3", currentView === view ? (view === 'AI_AGENT' ? "text-indigo-400" : "text-amber-400") : "text-slate-400 group-hover:text-slate-600")} />
        <span className="font-medium">{label}</span>
        {badge ? (
          <span className="absolute right-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        ) : null}
      </button>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">
          <div className="flex items-center justify-center w-16 h-16 bg-slate-900 rounded-xl mb-6 mx-auto">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">OmniPOS</h1>
          <p className="text-slate-500 text-center mb-6 font-medium">Connectez-vous pour commencer</p>
          
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Mot de passe"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all mb-4"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
            >
              Entrer
            </button>
            <p className="text-xs text-center text-slate-400 mt-4">
              Admin: "admin" | Vendeur: "vendeur"
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 flex items-center justify-between p-4 z-30">
        <div className="flex items-center">
          <span className="w-8 h-8 bg-slate-900 rounded-lg mr-2 flex items-center justify-center">
            <span className="text-white font-bold">O</span>
          </span>
          <span className="font-bold text-lg">OmniPOS</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed md:relative inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col shadow-2xl md:shadow-sm z-40 transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white md:bg-transparent hidden md:flex">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-slate-900 rounded-lg mr-2 flex items-center justify-center">
                <span className="text-white text-lg leading-none">O</span>
              </span>
              OmniPOS
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium tracking-wide uppercase">
              {isAdmin ? 'Administrateur' : 'Vendeur'}
            </p>
          </div>
        </div>

        {/* Mobile Header Inside Sidebar */}
        <div className="md:hidden p-6 flex items-center justify-between border-b border-slate-100">
          <div>
            <p className="font-bold text-lg text-slate-900">Menu</p>
            <p className="text-xs text-slate-500 mt-1 font-medium uppercase">
              {isAdmin ? 'Administrateur' : 'Vendeur'}
            </p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem view="POS" icon={ShoppingCart} label="Caisse" badge={totalCartItems} />
          <NavItem view="SESSION" icon={Clock} label="Session & Clôture" />
          <NavItem view="CREDITS" icon={Users} label="Crédits & Avances" />
          
          {isAdmin && <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Gestion</div>}
          <NavItem view="INVENTORY" icon={Package} label="Inventaire" requiresAdmin />
          <NavItem view="DASHBOARD" icon={LayoutDashboard} label="Tableau de bord" requiresAdmin />
          <NavItem view="REPORTS" icon={FileText} label="Rapports" requiresAdmin />
          
          {isAdmin && <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">IA & Automatisation</div>}
          <NavItem view="AI_AGENT" icon={Sparkles} label="Agent IA" requiresAdmin />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Session Actuelle</div>
            {activeSession ? (
              <div>
                <div className="flex items-center text-emerald-600 font-medium mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                  Ouverte
                </div>
                <div className="text-sm font-medium text-slate-900">
                  Fond: {formatCurrency(activeSession.initialCash)}
                </div>
              </div>
            ) : (
              <div className="flex items-center text-rose-500 font-medium">
                <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                Fermée
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-2 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col min-w-0 w-full">
        {currentView === 'POS' && <PosView />}
        {currentView === 'INVENTORY' && <InventoryView />}
        {currentView === 'DASHBOARD' && <DashboardView />}
        {currentView === 'SESSION' && <SessionView />}
        {currentView === 'CREDITS' && <CreditsView />}
        {currentView === 'REPORTS' && <ReportsView />}
        {currentView === 'AI_AGENT' && <AiAgentView />}
      </main>
    </div>
  );
}
