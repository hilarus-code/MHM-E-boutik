import React, { useState, useEffect } from 'react';
import { Clock, Play, Square, DollarSign, ListOrdered, Receipt } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, cn } from '../lib/utils';
import { db } from '../lib/db';
import { Session, Transaction, Expense } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function SessionView() {
  const { activeSession, refreshSession } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [initialCash, setInitialCash] = useState('');
  const [finalCash, setFinalCash] = useState('');

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');

  const [activeSessionStats, setActiveSessionStats] = useState({ sales: 0, profit: 0, count: 0, expenses: 0 });

  const loadData = async () => {
    const s = await db.getSessions();
    setSessions(s);

    if (activeSession) {
      const txs = await db.getTransactionsForSession(activeSession.id);
      const totalExps = activeSession.expenses.reduce((sum, e) => sum + e.amount, 0);
      setActiveSessionStats({
        sales: txs.reduce((sum, t) => sum + t.totalAmount, 0),
        profit: txs.reduce((sum, t) => sum + t.totalProfit, 0),
        count: txs.length,
        expenses: totalExps
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSession]);

  const handleOpen = async () => {
    if (activeSession) return;
    try {
      await db.openSession(parseFloat(initialCash) || 0);
      await refreshSession();
      setInitialCash('');
      setIsOpening(false);
    } catch (e) {
      alert("Erreur");
    }
  };

  const handleClose = async () => {
    if (!activeSession) return;
    try {
      await db.closeSession(activeSession.id, parseFloat(finalCash) || 0);
      await refreshSession();
      setFinalCash('');
      setIsClosing(false);
    } catch (e) {
      alert("Erreur");
    }
  };

  const handleAddExpense = async () => {
    if (!activeSession) return;
    const amount = parseFloat(expenseAmt) || 0;
    if (amount <= 0 || !expenseDesc) return;

    await db.addExpenseToActiveSession(expenseDesc, amount);
    await refreshSession();
    setExpenseDesc('');
    setExpenseAmt('');
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 overflow-hidden">
      {/* Current Session Panel */}
      <div className="w-full md:w-1/3 md:min-w-[320px] max-w-full bg-white md:border-r border-b md:border-b-0 border-slate-200 p-6 md:p-8 flex flex-col shadow-sm z-10 overflow-y-auto flex-shrink-0">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center mb-8">
          <Clock className="w-6 h-6 mr-3 text-emerald-500" />
          Session du jour
        </h2>

        {activeSession ? (
          <div className="flex flex-col flex-1">
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 mb-6">
              <div className="flex items-center text-emerald-600 font-bold mb-4 uppercase tracking-wider text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                Session Ouverte
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-emerald-700/70 text-sm font-medium mb-1">Ouverte à</p>
                  <p className="font-bold text-emerald-900">{format(activeSession.startTime, 'HH:mm - dd MMM', { locale: fr })}</p>
                </div>
                <div>
                  <p className="text-emerald-700/70 text-sm font-medium mb-1">Fond de caisse initial</p>
                  <p className="text-2xl font-black text-emerald-900">{formatCurrency(activeSession.initialCash)}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Ventes réalisées</p>
                  <p className="text-2xl font-black text-slate-900">{formatCurrency(activeSessionStats.sales)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Nombre de tickets</p>
                  <p className="text-xl font-bold text-slate-700">{activeSessionStats.count}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-slate-500 text-sm font-medium mb-1">Total Dépenses</p>
                <p className="text-xl font-bold text-rose-600">-{formatCurrency(activeSessionStats.expenses)}</p>
              </div>
              <div className="pt-4 border-t border-slate-200 bg-emerald-50 -mx-6 -mb-6 p-6 rounded-b-2xl border-t-emerald-100">
                <p className="text-emerald-800 text-sm font-bold mb-1 uppercase tracking-wider">Caisse attendue</p>
                <p className="text-3xl font-black text-emerald-600 tracking-tight">
                  {formatCurrency(activeSession.initialCash + activeSessionStats.sales - activeSessionStats.expenses)}
                </p>
                <p className="text-xs text-emerald-600/70 mt-1 font-medium">Fond initial + Ventes - Dépenses</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                <Receipt className="w-4 h-4 mr-2 text-rose-500" />
                Déclarer une dépense
              </h3>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Motif (ex: Transport, Repas)"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-300"
                />
                <input 
                  type="number" 
                  placeholder="Montant"
                  value={expenseAmt}
                  onChange={(e) => setExpenseAmt(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-300"
                />
                <button 
                  onClick={handleAddExpense}
                  disabled={!expenseDesc || !expenseAmt}
                  className="w-full py-3 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
                >
                  Ajouter la dépense
                </button>
              </div>
            </div>

            {!isClosing ? (
              <button 
                onClick={() => setIsClosing(true)}
                className="mt-auto w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center transition-colors shadow-lg"
              >
                <Square className="w-5 h-5 mr-2" />
                Clôturer la session
              </button>
            ) : (
              <div className="mt-auto bg-white p-6 rounded-2xl border-2 border-slate-900 shadow-xl">
                <h3 className="font-bold mb-4 text-slate-900">Montant réel en caisse</h3>
                <input 
                  type="number" 
                  value={finalCash}
                  onChange={(e) => setFinalCash(e.target.value)}
                  className="w-full text-2xl font-black p-3 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none transition-all mb-4"
                  placeholder="0"
                />
                <div className="flex gap-2">
                  <button onClick={() => setIsClosing(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-lg text-slate-600 hover:bg-slate-200 transition-colors">Annuler</button>
                  <button onClick={handleClose} className="flex-1 py-3 bg-slate-900 font-bold rounded-lg text-white hover:bg-slate-800 transition-colors">Valider</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            <div className="bg-slate-100 rounded-2xl p-8 text-center mb-8 border border-slate-200 border-dashed">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="font-medium text-slate-500">Aucune session ouverte.</p>
              <p className="text-sm text-slate-400 mt-2">Veuillez renseigner le fond de caisse initial pour commencer.</p>
            </div>

            {!isOpening ? (
              <button 
                onClick={() => setIsOpening(true)}
                className="mt-auto w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center transition-colors shadow-lg hover:shadow-emerald-500/30"
              >
                <Play className="w-5 h-5 mr-2" />
                Ouvrir une session
              </button>
            ) : (
              <div className="mt-auto bg-white p-6 rounded-2xl border-2 border-emerald-500 shadow-xl animate-in slide-in-from-bottom-4">
                <h3 className="font-bold mb-4 text-slate-900">Fond de caisse initial</h3>
                <input 
                  type="number" 
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  autoFocus
                  className="w-full text-2xl font-black p-3 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all mb-4"
                  placeholder="0"
                />
                <div className="flex gap-2">
                  <button onClick={() => setIsOpening(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-lg text-slate-600 hover:bg-slate-200 transition-colors">Annuler</button>
                  <button onClick={handleOpen} className="flex-1 py-3 bg-emerald-500 font-bold rounded-lg text-white hover:bg-emerald-600 transition-colors">Ouvrir</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Panel */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 min-w-0">
        <h3 className="text-xl font-bold mb-6 text-slate-900 flex items-center">
          <ListOrdered className="w-5 h-5 mr-2 text-slate-400" />
          Historique des sessions
        </h3>
        
        <div className="space-y-4">
          {sessions.filter(s => s.status === 'CLOSED').map(session => (
            <div key={session.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col mb-4">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="font-bold text-slate-900 mb-1">
                    {format(session.startTime, 'dd MMMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-sm font-medium text-slate-500">
                    {format(session.startTime, 'HH:mm')} - {session.endTime ? format(session.endTime, 'HH:mm') : ''}
                  </p>
                </div>
                
                <div className="flex space-x-8">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Attendu</p>
                    <p className="font-bold text-slate-700">{formatCurrency(session.expectedFinalCash || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Déclaré</p>
                    <p className="font-black text-slate-900">{formatCurrency(session.actualFinalCash || 0)}</p>
                  </div>
                  <div className="text-right w-24">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Écart</p>
                    {(() => {
                      const diff = (session.actualFinalCash || 0) - (session.expectedFinalCash || 0);
                      return (
                        <span className={cn(
                          "font-black px-2 py-1 rounded-md text-sm",
                          diff === 0 ? "bg-slate-100 text-slate-600" : diff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              
              {session.expenses.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dépenses de la journée :</p>
                  <ul className="space-y-1">
                    {session.expenses.map(e => (
                      <li key={e.id} className="text-sm flex justify-between text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">
                        <span>{e.description}</span>
                        <span className="font-bold text-rose-600">-{formatCurrency(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {sessions.filter(s => s.status === 'CLOSED').length === 0 && (
            <p className="text-slate-500 font-medium text-center py-8">Aucun historique disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}
