import React, { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { db } from '../lib/db';
import { Credit } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function CreditsView() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');

  const loadCredits = async () => {
    const data = await db.getCredits();
    setCredits(data);
  };

  useEffect(() => {
    loadCredits();
  }, []);

  const handleAdd = async () => {
    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    
    if (!clientName || total <= 0) return;

    const credit: Credit = {
      id: crypto.randomUUID(),
      clientName,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: total - paid,
      timestamp: Date.now(),
      status: (total - paid) <= 0 ? 'PAID' : 'PENDING'
    };

    await db.saveCredit(credit);
    setIsAdding(false);
    setClientName('');
    setTotalAmount('');
    setPaidAmount('');
    loadCredits();
  };

  const handlePayment = async (id: string) => {
    const amount = window.prompt("Entrez le montant payé:");
    if (!amount) return;
    
    const parsedAmount = parseFloat(amount);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      await db.updateCreditPayment(id, parsedAmount);
      loadCredits();
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
              <Users className="w-8 h-8 mr-3 text-indigo-500" />
              Crédits & Avances
            </h2>
            <p className="text-slate-500 mt-2 font-medium">Gérez les paiements partiels et les dettes clients.</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nouveau Crédit
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-lg mb-4 text-slate-900">Enregistrer une nouvelle avance</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Nom du client</label>
                <input 
                  type="text" 
                  value={clientName} onChange={e => setClientName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 outline-none"
                  placeholder="Ex: Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Montant total dû</label>
                <input 
                  type="number" 
                  value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Montant payé (Avance)</label>
                <input 
                  type="number" 
                  value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="flex items-end">
                <button onClick={handleAdd} className="w-full p-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {credits.map(credit => (
            <div key={credit.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className={cn("absolute top-0 right-0 w-2 h-full", credit.status === 'PAID' ? "bg-emerald-500" : "bg-amber-500")}></div>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{credit.clientName}</h3>
                  <p className="text-xs text-slate-500">{format(credit.timestamp, 'dd MMM yyyy - HH:mm', { locale: fr })}</p>
                </div>
                {credit.status === 'PAID' ? (
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" /> Réglé
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-bold flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> En cours
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Montant Total</span>
                  <span className="font-bold text-slate-900">{formatCurrency(credit.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Déjà payé</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(credit.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-slate-100 mt-2">
                  <span className="text-slate-700 font-bold">Reste à payer</span>
                  <span className="font-black text-rose-600">{formatCurrency(credit.remainingAmount)}</span>
                </div>
              </div>

              {credit.status === 'PENDING' && (
                <button 
                  onClick={() => handlePayment(credit.id)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Ajouter un paiement
                </button>
              )}
            </div>
          ))}

          {credits.length === 0 && !isAdding && (
            <div className="col-span-full py-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Aucun crédit ou avance enregistré.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
