import React, { useState } from 'react';
import { Package, Search, Edit2, Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn, formatCurrency } from '../lib/utils';
import { Product } from '../types';
import { db } from '../lib/db';

export default function InventoryView() {
  const { products, refreshProducts } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    costPrice: number;
    wholesalePrice: number;
    retailPrice: number;
    unitsPerWholesale: number;
    minStockLevel: number;
    stock: number;
  }>({ costPrice: 0, wholesalePrice: 0, retailPrice: 0, unitsPerWholesale: 24, minStockLevel: 20, stock: 0 });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({
      costPrice: product.costPrice,
      wholesalePrice: product.wholesalePrice,
      retailPrice: product.retailPrice,
      unitsPerWholesale: product.unitsPerWholesale || 24,
      minStockLevel: product.minStockLevel || 20,
      stock: product.stock
    });
  };

  const handleSave = async (product: Product) => {
    const updated = { ...product, ...editForm };
    await db.updateProduct(updated);
    await refreshProducts();
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 md:p-8 bg-white border-b border-slate-200">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center">
          <Package className="w-8 h-8 mr-3 text-indigo-500" />
          Inventaire & Tarification
        </h2>
        <p className="text-slate-500 mt-2 font-medium">Gestion des stocks et ajustement des prix d'achat/vente.</p>
      </div>

      <div className="p-4 md:p-8 overflow-y-auto">
        <div className="relative max-w-md mb-6 md:mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-medium"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4 w-1/4">Produit</th>
                  <th className="p-4 text-right">Achat (u)</th>
                  <th className="p-4 text-right">Gros (Carton)</th>
                  <th className="p-4 text-right">Qté/Carton</th>
                  <th className="p-4 text-right">Détail (u)</th>
                  <th className="p-4 text-right">Stock</th>
                  <th className="p-4 text-right">Min</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{product.name} {product.format && <span className="text-slate-400 font-normal text-sm ml-1">({product.format})</span>}</div>
                      <div className="text-xs text-slate-500">{product.category}</div>
                    </td>
                    
                    {editingId === product.id ? (
                      <>
                        <td className="p-4">
                          <input type="number" className="w-24 p-2 bg-white border border-slate-300 rounded text-right font-medium float-right" value={editForm.costPrice} onChange={e => setEditForm({...editForm, costPrice: parseFloat(e.target.value) || 0})} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="w-24 p-2 bg-white border border-slate-300 rounded text-right font-medium float-right text-indigo-600" value={editForm.wholesalePrice} onChange={e => setEditForm({...editForm, wholesalePrice: parseFloat(e.target.value) || 0})} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="w-20 p-2 bg-white border border-slate-300 rounded text-right font-bold float-right text-slate-600" value={editForm.unitsPerWholesale} onChange={e => setEditForm({...editForm, unitsPerWholesale: parseFloat(e.target.value) || 0})} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="w-24 p-2 bg-white border border-slate-300 rounded text-right font-bold float-right" value={editForm.retailPrice} onChange={e => setEditForm({...editForm, retailPrice: parseFloat(e.target.value) || 0})} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="w-20 p-2 bg-white border border-slate-300 rounded text-right font-bold float-right" value={editForm.stock} onChange={e => setEditForm({...editForm, stock: parseFloat(e.target.value) || 0})} />
                        </td>
                        <td className="p-4">
                          <input type="number" className="w-16 p-2 bg-white border border-slate-300 rounded text-right font-bold float-right text-slate-500" value={editForm.minStockLevel} onChange={e => setEditForm({...editForm, minStockLevel: parseFloat(e.target.value) || 0})} />
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center space-x-2">
                            <button onClick={() => handleSave(product)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <Check className="w-5 h-5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-right font-medium text-slate-500">{formatCurrency(product.costPrice)}</td>
                        <td className="p-4 text-right font-bold text-indigo-600">{formatCurrency(product.wholesalePrice)}</td>
                        <td className="p-4 text-right font-bold text-slate-500">{product.unitsPerWholesale || 24}</td>
                        <td className="p-4 text-right font-black text-slate-900">{formatCurrency(product.retailPrice)}</td>
                        <td className="p-4 text-right">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-sm font-bold",
                            product.stock <= (product.minStockLevel || 20) ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-slate-400">{product.minStockLevel || 20}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
