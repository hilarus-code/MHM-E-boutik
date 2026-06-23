import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Mail } from 'lucide-react';
import { db } from '../lib/db';
import { Transaction, Session } from '../types';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ReportsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const load = async () => {
      setSessions(await db.getSessions());
      setTransactions(await db.getAllTransactions());
    };
    load();
  }, []);

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

                <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 border-b border-slate-100">
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Ventes Brutes</p>
                    <p className="text-lg md:text-xl font-black text-slate-900">{formatCurrency(totalSales)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Marge Brute</p>
                    <p className="text-lg md:text-xl font-black text-indigo-600">{formatCurrency(totalProfit)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Dépenses</p>
                    <p className="text-lg md:text-xl font-black text-rose-600">{totalExpenses > 0 ? `-${formatCurrency(totalExpenses)}` : formatCurrency(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Bénéfice Net</p>
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
