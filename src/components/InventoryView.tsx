import React, { useState } from 'react';
import { 
  Package, Search, Edit2, Plus, Trash2, X, Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn, formatCurrency } from '../lib/utils';
import { Product, Category } from '../types';
import { db } from '../lib/db';

const CATEGORIES: Category[] = [
  'Bières et Boissons Alcoolisées',
  'Sodas et Boissons Gazeuses',
  'Boissons Énergisantes et Toniques',
  'Jus, Boissons Lactées et Fruits',
  'Eaux',
  'Cocktails',
  'Autres'
];

export default function InventoryView() {
  const { products, refreshProducts } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('Bières et Boissons Alcoolisées');
  const [formFormat, setFormFormat] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('0');
  const [formRetailPrice, setFormRetailPrice] = useState('0');
  const [formWholesalePrice, setFormWholesalePrice] = useState('0');
  const [formWholesaleThreshold, setFormWholesaleThreshold] = useState('24');
  const [formUnitsPerWholesale, setFormUnitsPerWholesale] = useState('24');
  const [formMinStockLevel, setFormMinStockLevel] = useState('20');
  const [formStock, setFormStock] = useState('0');

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedProduct(null);
    setFormName('');
    setFormCategory('Bières et Boissons Alcoolisées');
    setFormFormat('');
    setFormCostPrice('1000');
    setFormRetailPrice('1500');
    setFormWholesalePrice('1200');
    setFormWholesaleThreshold('24');
    setFormUnitsPerWholesale('24');
    setFormMinStockLevel('20');
    setFormStock('100');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setModalMode('edit');
    setSelectedProduct(product);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormFormat(product.format || '');
    setFormCostPrice(product.costPrice.toString());
    setFormRetailPrice(product.retailPrice.toString());
    setFormWholesalePrice(product.wholesalePrice.toString());
    setFormWholesaleThreshold((product.wholesaleThreshold || 24).toString());
    setFormUnitsPerWholesale((product.unitsPerWholesale || 24).toString());
    setFormMinStockLevel((product.minStockLevel || 20).toString());
    setFormStock(product.stock.toString());
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      alert("Le nom du produit est requis !");
      return;
    }

    const cost = parseFloat(formCostPrice) || 0;
    const retail = parseFloat(formRetailPrice) || 0;
    const wholesale = parseFloat(formWholesalePrice) || 0;

    if (cost < 0 || retail < 0 || wholesale < 0) {
      alert("Les prix doivent être des valeurs positives.");
      return;
    }

    const productData: Product = {
      id: modalMode === 'edit' && selectedProduct ? selectedProduct.id : crypto.randomUUID(),
      name: formName.trim(),
      category: formCategory,
      format: formFormat.trim() || undefined,
      costPrice: cost,
      retailPrice: retail,
      wholesalePrice: wholesale,
      wholesaleThreshold: parseInt(formWholesaleThreshold) || 24,
      unitsPerWholesale: parseInt(formUnitsPerWholesale) || 24,
      minStockLevel: parseInt(formMinStockLevel) || 20,
      stock: parseInt(formStock) || 0
    };

    try {
      await db.updateProduct(productData);
      await refreshProducts();
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Erreur lors de l'enregistrement de produit : " + err.message);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (confirm(`⚠️ Êtes-vous sûr de vouloir supprimer définitivement le produit "${product.name}" de votre base de données centrale cloud ?`)) {
      try {
        await db.deleteProduct(product.id);
        await refreshProducts();
      } catch (err: any) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const filteredProducts = (products || []).filter(p => {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    const category = String(p.category || '').toLowerCase();
    const search = (searchTerm || '').toLowerCase();
    return name.includes(search) || category.includes(search);
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header Banner */}
      <div className="p-6 md:p-8 bg-white border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center">
              <Package className="w-8 h-8 mr-3 text-indigo-600" />
              Inventaire & Catalogue Cloud
            </h2>
            <p className="text-slate-500 mt-1 font-medium text-sm">
              Gérez votre stock centralisé, ajoutez de nouveaux produits et modifiez les tarifs à tout moment.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm gap-2 whitespace-nowrap self-start md:self-auto"
            id="btn-add-product"
          >
            <Plus className="w-5 h-5" />
            Créer un Produit
          </button>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-medium text-sm"
            placeholder="Rechercher un produit ou une catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Products Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4 w-1/4">Produit</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4 text-right">Achat (Unit.)</th>
                  <th className="p-4 text-right">Vente Gros (Carton)</th>
                  <th className="p-4 text-right">Qté/Carton (Seuil)</th>
                  <th className="p-4 text-right">Vente Détail</th>
                  <th className="p-4 text-right">Stock Actuel</th>
                  <th className="p-4 text-right">Seuil Alerte</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-medium text-sm">
                      Aucun produit ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => {
                    const idStr = String(product?.id || '');
                    const name = product?.name || 'Sans nom';
                    const category = product?.category || 'Autres';
                    const format = product?.format || '';
                    const costPrice = product?.costPrice || 0;
                    const wholesalePrice = product?.wholesalePrice || 0;
                    const unitsPerWholesale = product?.unitsPerWholesale || 24;
                    const wholesaleThreshold = product?.wholesaleThreshold || 24;
                    const retailPrice = product?.retailPrice || 0;
                    const stock = product?.stock || 0;
                    const minStockLevel = product?.minStockLevel || 20;

                    return (
                      <tr key={idStr || crypto.randomUUID()} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {name}
                            {format && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-normal">
                                {format}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{idStr.substring(0, 8)}...</div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
                            {category}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-slate-500">{formatCurrency(costPrice)}</td>
                        <td className="p-4 text-right font-bold text-indigo-600">{formatCurrency(wholesalePrice)}</td>
                        <td className="p-4 text-right font-semibold text-slate-500">
                          {unitsPerWholesale} u <span className="text-xs text-slate-400 font-normal">({wholesaleThreshold})</span>
                        </td>
                        <td className="p-4 text-right font-black text-slate-900">{formatCurrency(retailPrice)}</td>
                        <td className="p-4 text-right">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold inline-block",
                            stock <= minStockLevel 
                              ? "bg-rose-100 text-rose-700 animate-pulse border border-rose-200" 
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          )}>
                            {stock}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium text-slate-400">{minStockLevel}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleOpenEdit(product)} 
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Modifier ce produit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(product)} 
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Supprimer ce produit"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE & EDIT OVERLAY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {modalMode === 'create' ? 'Créer un nouveau produit' : 'Modifier le produit'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {modalMode === 'create' 
                      ? 'Remplissez les détails pour ajouter un produit dans la base cloud.' 
                      : `Ajustez les détails du produit ID: ${(selectedProduct?.id || '').substring(0,8)}...`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
              
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Informations de base</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Produit *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Coca Cola"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Format / Taille</label>
                    <input
                      type="text"
                      value={formFormat}
                      onChange={(e) => setFormFormat(e.target.value)}
                      placeholder="Ex: 33cl, 1L, PM, GM"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as Category)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-950"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tarification & Coûts</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prix d'Achat Unitaire *</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        required
                        value={formCostPrice}
                        onChange={(e) => setFormCostPrice(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-slate-950 text-right"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">FCFA</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prix de Gros (Carton) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        required
                        value={formWholesalePrice}
                        onChange={(e) => setFormWholesalePrice(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-indigo-600 text-right"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">FCFA</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prix Détail (Unité) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        required
                        value={formRetailPrice}
                        onChange={(e) => setFormRetailPrice(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-emerald-600 text-right"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock and Threshold Settings */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logistique & Stocks</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Stock Initial</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-slate-950 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alerte Stock Min</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formMinStockLevel}
                      onChange={(e) => setFormMinStockLevel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-slate-950 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Qté / Carton</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formUnitsPerWholesale}
                      onChange={(e) => setFormUnitsPerWholesale(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-slate-950 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Seuil Prix Gros</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formWholesaleThreshold}
                      onChange={(e) => setFormWholesaleThreshold(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-bold text-slate-950 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {modalMode === 'create' ? 'Ajouter au catalogue' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
