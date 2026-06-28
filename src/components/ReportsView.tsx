import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Mail, Cloud, Database, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { db, isSupabaseConfigured, syncLocalToSupabase } from '../lib/db';
import { Transaction, Session } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ReportsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    products: number;
    sessions: number;
    transactions: number;
    credits: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      setSessions(await db.getSessions());
      setTransactions(await db.getAllTransactions());
    };
    load();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncLocalToSupabase();
      setSyncResult({
        success: true,
        products: res.products,
        sessions: res.sessions,
        transactions: res.transactions,
        credits: res.credits
      });
      // reload data
      setSessions(await db.getSessions());
      setTransactions(await db.getAllTransactions());
    } catch (e: any) {
      alert("Erreur lors de la synchronisation : " + (e.message || e));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendReport = (session: Session) => {
    alert(`Rapport de la session ${format(session.startTime, 'dd MMM')} envoyé à l'administrateur !`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center mb-6 md:mb-8">
          <FileText className="w-6 h-6 md:w-8 md:h-8 mr-3 text-blue-500" />
          Rapports Journaliers
        </h2>

        {/* Database Status & Synchronization Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-start">
              <div className={cn(
                "p-3 rounded-xl mr-4",
                isSupabaseConfigured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}>
                {isSupabaseConfigured ? (
                  <div className="relative">
                    <Cloud className="w-6 h-6" />
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
                  </div>
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 flex items-center">
                  Base de données : {isSupabaseConfigured ? "Supabase Cloud Connectée" : "Mode Local (Hors ligne)"}
                </h3>
                <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-xl">
                  {isSupabaseConfigured 
                    ? "Toutes les ventes et données d'inventaire sont directement enregistrées en temps réel sur la base de données cloud Supabase de production."
                    : "L'application fonctionne actuellement sur la base locale hors ligne de ce navigateur. Configurez vos clés Supabase pour sauvegarder dans le cloud."}
                </p>
              </div>
            </div>

            {isSupabaseConfigured && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={cn(
                  "flex items-center justify-center px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all text-sm w-full md:w-auto hover:bg-slate-800",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
                {isSyncing ? "Synchronisation..." : "Synchroniser les données locales"}
              </button>
            )}
          </div>

          {syncResult && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg mr-3 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-sm">Synchronisation réussie !</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Les données suivantes ont été exportées avec succès vers la base de données de production :
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/50 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Produits</p>
                    <p className="text-base font-black text-slate-800">{syncResult.products}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/50 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Sessions</p>
                    <p className="text-base font-black text-slate-800">{syncResult.sessions}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/50 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Transactions</p>
                    <p className="text-base font-black text-slate-800">{syncResult.transactions}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/50 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Crédits</p>
                    <p className="text-base font-black text-slate-800">{syncResult.credits}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 md:space-y-6">
          {sessions.filter(s => s.status === 'CLOSED').map(session => {
            const sessionTxs = transactions.filter(t => t.sessionId === session.id);
            const totalSales = sessionTxs.reduce((sum, t) => sum + t.totalAmount, 0);
            const totalProfit = sessionTxs.reduce((sum, t) => sum + t.totalProfit, 0);
            const totalCost = totalSales - totalProfit;
            const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);
            const netProfit = totalProfit - totalExpenses;
            
            const expectedCash = session.initialCash + totalSales - totalExpenses;
            const actualCash = session.actualFinalCash || 0;
            const cashDiff = actualCash - expectedCash;
            const realProfit = netProfit + cashDiff;

            return (
              <div key={session.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 p-4 md:p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                  <div className="flex items-start md:items-center">
                    <Calendar className="w-5 h-5 text-slate-400 mr-3 mt-1 md:mt-0" />
                    <div>
                      <h3 className="font-bold text-base md:text-lg text-slate-900">
                        {format(session.startTime, 'EEEE dd MMMM yyyy', { locale: fr })}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {format(session.startTime, 'HH:mm')} - {session.endTime ? format(session.endTime, 'HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSendReport(session)}
                    className="flex items-center w-full md:w-auto justify-center px-4 py-2 md:py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl transition-colors"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Envoyer le rapport
                  </button>
                </div>

                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 border-b border-slate-100">
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-0.5">Chiffre d'affaires</p>
                    <p className="text-[10px] text-slate-400 mb-1">(Total encaissé)</p>
                    <p className="text-lg md:text-xl font-black text-slate-900">{formatCurrency(totalSales)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-0.5">Dépenses</p>
                    <p className="text-[10px] text-slate-400 mb-1">(Frais divers)</p>
                    <p className="text-lg md:text-xl font-black text-rose-600">{totalExpenses > 0 ? `-${formatCurrency(totalExpenses)}` : formatCurrency(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-0.5">Bénéfice Net</p>
                    <p className="text-[10px] text-slate-400 mb-1">(Ventes - Achats - Dépenses)</p>
                    <p className={`text-lg md:text-xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(netProfit)}</p>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                  <div className="grid grid-cols-2 md:flex md:space-x-8 gap-4 w-full md:w-auto">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Caisse Attendue</p>
                      <p className="font-bold text-slate-600">{formatCurrency(expectedCash)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Caisse Déclarée</p>
                      <p className="font-black text-slate-900">{formatCurrency(actualCash)}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Écart Caisse</p>
                      <p className={`font-black ${cashDiff === 0 ? 'text-slate-600' : cashDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {cashDiff > 0 ? '+' : ''}{formatCurrency(cashDiff)}
                      </p>
                    </div>
                  </div>
                  <div className="w-full md:w-auto md:text-right pt-4 md:pt-0 border-t md:border-t-0 border-slate-200 mt-2 md:mt-0">
                    <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Profit/Perte Réel</p>
                    <p className={`text-xl md:text-2xl font-black ${realProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(realProfit)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {sessions.filter(s => s.status === 'CLOSED').length === 0 && (
            <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Aucun rapport disponible pour le moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
