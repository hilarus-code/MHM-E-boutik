import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, PackageOpen, AlertTriangle } from 'lucide-react';
import { db } from '../lib/db';
import { Transaction, Product } from '../types';
import { formatCurrency } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardView() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    grossMargin: 0,
    totalExpenses: 0,
    totalProfit: 0,
    transactionCount: 0,
  });
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const txs = await db.getAllTransactions();
      const products = await db.getProducts();
      const sessions = await db.getSessions();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter for today
      const todayTxs = txs.filter(t => new Date(t.timestamp) >= today);
      const todaySessions = sessions.filter(s => new Date(s.startTime) >= today || (s.endTime && new Date(s.endTime) >= today));
      
      const todayExpenses = todaySessions.reduce((sum, s) => sum + s.expenses.reduce((s2, e) => s2 + e.amount, 0), 0);
      
      const rev = todayTxs.reduce((sum, t) => sum + t.totalAmount, 0);
      const grossMargin = todayTxs.reduce((sum, t) => sum + t.totalProfit, 0);
      
      setStats({
        totalRevenue: rev,
        grossMargin: grossMargin,
        totalExpenses: todayExpenses,
        totalProfit: grossMargin - todayExpenses,
        transactionCount: todayTxs.length
      });

      // Product sales for chart (today)
      const productSales: Record<string, { name: string, qty: number, profit: number }> = {};
      todayTxs.forEach(t => {
        t.items.forEach(i => {
          if (!productSales[i.productId]) {
            productSales[i.productId] = { name: i.name, qty: 0, profit: 0 };
          }
          productSales[i.productId].qty += i.quantity;
          productSales[i.productId].profit += (i.unitPrice - i.costPrice) * i.quantity;
        });
      });

      const chartD = Object.values(productSales)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
      setChartData(chartD);

      setLowStock(products.filter(p => p.stock <= (p.minStockLevel || 20)).sort((a, b) => a.stock - b.stock));
    };
    
    loadData();
  }, []);

  const StatCard = ({ title, subtitle, value, icon: Icon, colorClass }: any) => (
    <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center">
      <div className={`p-3 md:p-4 rounded-xl mr-3 md:mr-4 ${colorClass}`}>
        <Icon className="w-6 h-6 md:w-8 md:h-8" />
      </div>
      <div>
        <div className="flex flex-col">
          <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          {subtitle && <p className="text-[10px] md:text-xs text-slate-400 mb-1">{subtitle}</p>}
        </div>
        <p className="text-xl md:text-3xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-8">
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 md:mb-8 tracking-tight">Vue d'ensemble - Aujourd'hui</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <StatCard 
          title="Chiffre d'affaires" 
          subtitle="(Total des ventes)"
          value={formatCurrency(stats.totalRevenue)} 
          icon={TrendingUp} 
          colorClass="bg-indigo-100 text-indigo-600" 
        />
        <StatCard 
          title="Total Dépenses" 
          subtitle="(Frais divers)"
          value={'- ' + formatCurrency(stats.totalExpenses)} 
          icon={AlertTriangle} 
          colorClass="bg-rose-100 text-rose-600" 
        />
        <StatCard 
          title="Bénéfice Net" 
          subtitle="(Ventes - Achats - Dépenses)"
          value={formatCurrency(stats.totalProfit)} 
          icon={DollarSign} 
          colorClass={stats.totalProfit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"} 
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:flex-2 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex-grow">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Top 5 Ventes (Quantité)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="qty" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-full lg:flex-1 lg:max-w-xs bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-rose-500" />
            Alertes Stock
          </h3>
          <div className="space-y-3">
            {lowStock.length === 0 ? (
              <p className="text-slate-500 text-sm font-medium">Aucune alerte de stock.</p>
            ) : (
              lowStock.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="font-bold text-slate-800">{p.name}</span>
                  <span className="font-black text-rose-600 bg-rose-200 px-2 py-1 rounded-md text-sm">{p.stock}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
