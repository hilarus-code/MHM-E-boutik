import React, { useState, useMemo, useRef, useEffect } from 'react';
import fuzzysort from 'fuzzysort';
import { Search, Plus, Minus, Trash2, CreditCard, Receipt, AlertCircle, Package, ShoppingCart, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db } from '../lib/db';

export default function PosView() {
  const { products, activeSession, cart, addToCart, updateCartItem, removeFromCart, clearCart, cartTotal, refreshProducts } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Toutes');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on mount for fast typing
  useEffect(() => {
    // Only auto-focus on desktop to avoid mobile keyboard pop-up
    if (window.innerWidth >= 768) {
      searchInputRef.current?.focus();
    }
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['Toutes', ...Array.from(cats)];
  }, [products]);

  const filteredProductsWithRank = useMemo(() => {
    if (searchTerm) {
      let resultToSearch = products;
      if (activeCategory !== 'Toutes') {
        resultToSearch = products.filter(p => p.category === activeCategory);
      }
      const searchResults = fuzzysort.go(searchTerm, resultToSearch, { key: 'name', threshold: -10000 });
      return searchResults.map((res, index) => ({ 
        product: res.obj, 
        rank: index,
        highlightedName: res.highlight('<span class="text-emerald-700 bg-emerald-200 px-0.5 rounded">', '</span>') || res.obj.name
      }));
    }

    let result = products;
    if (activeCategory !== 'Toutes') {
      result = products.filter(p => p.category === activeCategory);
    }
    return result.map(p => ({ product: p, rank: -1, highlightedName: p.name }));
  }, [products, searchTerm, activeCategory]);

  const handleCheckout = () => {
    if (!activeSession) {
      alert("Veuillez ouvrir une session avant d'encaisser.");
      return;
    }
    setIsCheckoutOpen(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full relative">
      {/* Product Selection Area */}
      <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
        {/* Top Bar with Search & Categories */}
        <div className="p-4 md:p-6 bg-white border-b border-slate-200 shadow-sm z-10 flex-shrink-0">
          <div className="relative mb-4 md:mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-12 pr-4 py-3 md:py-4 bg-slate-100 border-transparent rounded-2xl text-base md:text-lg focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all shadow-sm outline-none font-medium placeholder-slate-400 text-slate-900"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 md:px-5 md:py-2.5 rounded-full font-semibold text-xs md:text-sm whitespace-nowrap transition-all duration-200 border",
                  activeCategory === cat 
                    ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filteredProductsWithRank.map(item => (
              <ProductCard 
                key={item.product.id} 
                product={item.product} 
                rank={item.rank}
                highlightedName={item.highlightedName}
                onClick={() => addToCart(item.product)} 
              />
            ))}
          </div>
          {filteredProductsWithRank.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Package className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-xl font-medium">Aucun produit trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Cart Floating Button */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-20">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
        >
          <div className="flex items-center">
            <div className="relative">
              <ShoppingCart className="w-6 h-6 mr-3" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </div>
            <span className="font-bold text-lg">Panier</span>
          </div>
          <span className="font-black text-xl">{formatCurrency(cartTotal)}</span>
        </button>
      </div>

      {/* Cart Area */}
      <div className={cn(
        "fixed md:relative inset-y-0 right-0 w-full md:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl z-30 transition-transform duration-300 transform",
        isMobileCartOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center">
            <button 
              className="md:hidden mr-4 p-2 bg-slate-200 rounded-lg"
              onClick={() => setIsMobileCartOpen(false)}
            >
              <Minus className="w-5 h-5 rotate-90" />
            </button>
            <h2 className="text-xl font-bold tracking-tight">Panier Actuel</h2>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p className="font-medium text-lg">Panier vide</p>
              <p className="text-sm mt-1">Sélectionnez des articles</p>
            </div>
          ) : (
            cart.map(item => (
              <CartItemRow 
                key={item.product.id} 
                item={item} 
                onUpdate={(q, isW) => updateCartItem(item.product.id, q, isW)}
                onRemove={() => removeFromCart(item.product.id)}
              />
            ))
          )}
        </div>

        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 pb-8 md:pb-6">
          <div className="flex justify-between items-end mb-6">
            <span className="text-slate-500 font-medium uppercase tracking-wider text-sm">Total TTC</span>
            <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(cartTotal)}</span>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || !activeSession}
            className={cn(
              "w-full py-4 rounded-2xl flex items-center justify-center text-lg font-bold shadow-xl transition-all duration-200",
              cart.length === 0 || !activeSession
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-emerald-500/30 hover:-translate-y-1 active:translate-y-0"
            )}
          >
            <CreditCard className="w-6 h-6 mr-2" />
            Encaisser
          </button>

          {!activeSession && (
            <div className="mt-4 flex items-center text-amber-600 bg-amber-50 p-3 rounded-lg text-xs md:text-sm font-medium border border-amber-200">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              Ouvrez une session (Onglet Session) pour encaisser.
            </div>
          )}
        </div>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal 
          onClose={() => setIsCheckoutOpen(false)} 
          onSuccess={() => {
            setIsCheckoutOpen(false);
            setIsMobileCartOpen(false);
            clearCart();
            refreshProducts(); // Refresh stock
          }}
        />
      )}
    </div>
  );
}

function ProductCard({ product, rank, highlightedName, onClick }: { product: Product, rank: number, highlightedName: string, onClick: () => void }) {
  // Determine color based on category
  const bgColors: Record<string, string> = {
    'Bières et Boissons Alcoolisées': 'bg-amber-100 text-amber-900 border-amber-200',
    'Sodas et Boissons Gazeuses': 'bg-blue-100 text-blue-900 border-blue-200',
    'Boissons Énergisantes et Toniques': 'bg-green-100 text-green-900 border-green-200',
    'Jus, Boissons Lactées et Fruits': 'bg-orange-100 text-orange-900 border-orange-200',
    'Eaux': 'bg-cyan-100 text-cyan-900 border-cyan-200',
    'Cocktails': 'bg-pink-100 text-pink-900 border-pink-200',
  };
  
  const defaultColor = 'bg-slate-100 text-slate-900 border-slate-200';
  const colorClass = bgColors[product.category] || defaultColor;

  let matchBorder = "border-2 border-transparent";
  let matchBg = "bg-white";
  
  if (rank === 0) {
    matchBorder = "border-4 border-emerald-500 shadow-xl shadow-emerald-100/50";
    matchBg = "bg-emerald-50";
  } else if (rank > 0 && rank <= 2) {
    matchBorder = "border-2 border-emerald-400 shadow-md";
    matchBg = "bg-emerald-50/50";
  } else if (rank > 2) {
    matchBorder = "border-2 border-slate-200 opacity-60";
    matchBg = "bg-white";
  } else {
    matchBorder = "border-2 border-slate-100";
    matchBg = "bg-white";
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col p-4 rounded-2xl text-left transition-all duration-200 active:scale-95 group overflow-hidden",
        matchBg, matchBorder,
        rank === -1 && "hover:shadow-lg hover:-translate-y-1 hover:border-slate-300"
      )}
    >
      <div className={cn("absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full opacity-20 transition-transform group-hover:scale-150", colorClass.split(' ')[0])}></div>
      
      <div className="mb-4">
        <h3 
          className="font-bold text-lg leading-tight text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-2 break-words"
          dangerouslySetInnerHTML={{ __html: highlightedName }}
        />
        {product.format && <p className="text-sm text-slate-500 font-medium">{product.format}</p>}
      </div>
      
      <div className="mt-auto z-10">
        <p className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(product.retailPrice)}</p>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs font-semibold text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded-md">Stock: {product.stock}</p>
        </div>
      </div>
    </button>
  );
}

function CartItemRow({ item, onUpdate, onRemove }: { 
  item: { product: Product, quantity: number, isWholesale: boolean }, 
  onUpdate: (q: number, w: boolean) => void,
  onRemove: () => void 
}) {
  const { product, quantity, isWholesale } = item;
  
  // Auto-switch to wholesale if threshold met and user hasn't explicitly overridden?
  // For simplicity, we just allow manual toggle or show standard
  const price = isWholesale ? product.wholesalePrice : product.retailPrice;

  return (
    <div className="flex flex-col p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative group">
      <div className="flex justify-between items-start mb-3">
        <div className="pr-8">
          <h4 className="font-bold text-slate-900 leading-tight">{product.name}</h4>
          <p className="text-sm font-semibold text-amber-600">{formatCurrency(price)} / u</p>
        </div>
        <button 
          onClick={onRemove}
          className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-auto">
        {/* Quantity Controls */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
          <button 
            onClick={() => onUpdate(quantity - 1, isWholesale)}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-amber-600 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center font-bold text-slate-900">{quantity}</span>
          <button 
            onClick={() => onUpdate(quantity + 1, isWholesale)}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Pricing Toggle & Total */}
        <div className="flex flex-col items-end">
           <button
            onClick={() => onUpdate(quantity, !isWholesale)}
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded mb-1 border transition-colors",
              isWholesale 
                ? "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200" 
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            )}
            title={`Passer au prix de ${isWholesale ? 'détail' : 'gros'}`}
          >
            {isWholesale ? `Gros (${product.unitsPerWholesale || 24}u)` : 'Détail'}
          </button>
          <span className="font-black text-slate-900">{formatCurrency(price * quantity)}</span>
        </div>
      </div>
    </div>
  );
}

// Checkout Modal
function CheckoutModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { cart, cartTotal, cartProfit, activeSession } = useApp();
  
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [clientName, setClientName] = useState('');
  const [tendered, setTendered] = useState<string>(cartTotal.toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [showReceiptSettings, setShowReceiptSettings] = useState(false);
  const [receiptHeader, setReceiptHeader] = useState(() => localStorage.getItem('receipt_header') || 'MHM E-boutique\nGestion de Ventes & Caisse');
  const [receiptFooter, setReceiptFooter] = useState(() => localStorage.getItem('receipt_footer') || 'Merci pour votre confiance !\nMHM E-boutique');

  const tenderedAmount = parseFloat(tendered) || 0;
  
  let change = 0;
  let isValid = false;

  if (paymentType === 'CASH') {
    change = tenderedAmount - cartTotal;
    isValid = tenderedAmount >= cartTotal;
  } else {
    change = Math.max(0, tenderedAmount - cartTotal);
    isValid = clientName.trim().length > 0 && tenderedAmount >= 0;
  }

  const quickAmounts = [
    cartTotal,
    Math.ceil(cartTotal / 1000) * 1000,
    Math.ceil(cartTotal / 5000) * 5000,
    10000,
    20000
  ].filter((v, i, a) => a.indexOf(v) === i && v >= cartTotal);

  const handleComplete = async () => {
    if (!isValid || !activeSession || isProcessing) return;
    setIsProcessing(true);

    try {
      if (paymentType === 'CREDIT') {
        await db.saveCredit({
          id: crypto.randomUUID(),
          clientName: clientName.trim(),
          totalAmount: cartTotal,
          paidAmount: tenderedAmount,
          remainingAmount: Math.max(0, cartTotal - tenderedAmount),
          timestamp: Date.now(),
          status: tenderedAmount >= cartTotal ? 'PAID' : 'PENDING'
        });
      }

      const transaction = {
        id: crypto.randomUUID(),
        sessionId: activeSession.id,
        timestamp: Date.now(),
        items: cart.map(item => {
          const cost = item.isWholesale ? (item.product.costPrice * (item.product.unitsPerWholesale || 24)) : item.product.costPrice;
          const unitPrice = item.isWholesale ? item.product.wholesalePrice : item.product.retailPrice;
          return {
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: unitPrice,
            totalPrice: unitPrice * item.quantity,
            costPrice: cost,
            isWholesale: item.isWholesale,
            unitsPerWholesale: item.product.unitsPerWholesale || 24
          };
        }),
        totalAmount: cartTotal,
        totalProfit: cartProfit,
        amountTendered: tenderedAmount,
        change: change
      };

      await db.saveTransaction(transaction);
      
      if (autoPrint) {
        try {
          printReceipt(transaction);
        } catch (printErr) {
          console.error("Erreur d'impression du ticket:", printErr);
        }
      }
      
      onSuccess();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement de la vente.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh]">
        
        {/* Left Side: Summary */}
        <div className="w-full md:w-1/2 bg-slate-50 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col overflow-y-auto max-h-[40vh] md:max-h-none">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-slate-900">Validation</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 md:space-y-3 mb-4 md:mb-6">
            {cart.map(item => {
              const price = item.isWholesale ? item.product.wholesalePrice : item.product.retailPrice;
              return (
                <div key={item.product.id} className="flex justify-between text-xs md:text-sm">
                  <span className="font-medium text-slate-700">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-bold text-slate-900">{formatCurrency(price * item.quantity)}</span>
                </div>
              );
            })}
          </div>

          <div className="pt-4 md:pt-6 border-t border-slate-200">
            <div className="flex justify-between items-end mb-2">
              <span className="text-slate-500 font-medium">À payer</span>
              <span className="text-3xl md:text-4xl font-black text-emerald-600 tracking-tight">{formatCurrency(cartTotal)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between items-end mt-4 p-3 md:p-4 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-amber-800 font-bold uppercase tracking-wider text-xs md:text-sm">Monnaie à rendre</span>
                <span className="text-xl md:text-2xl font-black text-amber-600">{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Payment Input */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">
          
          {/* Payment Type Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 md:mb-6">
            <button 
              onClick={() => {
                setPaymentType('CASH');
                setTendered(cartTotal.toString());
              }}
              className={cn("flex-1 py-2 rounded-lg font-bold text-xs md:text-sm transition-all", paymentType === 'CASH' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
            >
              Comptant
            </button>
            <button 
              onClick={() => {
                setPaymentType('CREDIT');
                setTendered('0'); // Default avance to 0 for credit
              }}
              className={cn("flex-1 py-2 rounded-lg font-bold text-xs md:text-sm transition-all", paymentType === 'CREDIT' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
            >
              À Crédit
            </button>
          </div>

          {paymentType === 'CREDIT' && (
            <div className="mb-4 animate-in fade-in slide-in-from-top-2">
              <label className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nom du client</label>
              <input 
                type="text"
                className="w-full text-base md:text-lg font-bold p-3 md:p-4 bg-slate-100 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all text-slate-900"
                placeholder="Ex: Jean Dupont"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
          )}

          <label className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">
            {paymentType === 'CASH' ? 'Montant reçu' : 'Avance payée (Optionnel)'}
          </label>
          <input 
            type="number"
            autoFocus
            className="w-full text-3xl md:text-4xl font-black p-3 md:p-4 bg-slate-100 border-2 border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all mb-4 md:mb-6 text-slate-900"
            placeholder="0"
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            onFocus={(e) => e.target.select()}
          />

          {paymentType === 'CASH' ? (
            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-auto">
              {quickAmounts.map(amount => (
                <button
                  key={amount}
                  onClick={() => setTendered(amount.toString())}
                  className="py-2 md:py-3 px-3 md:px-4 bg-white border-2 border-slate-200 rounded-lg md:rounded-xl font-bold text-base md:text-lg text-slate-700 hover:border-amber-400 hover:text-amber-600 transition-colors"
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-auto mt-2 md:mt-4 p-3 md:p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <span className="text-indigo-800 font-bold uppercase tracking-wider text-xs">Reste à payer (Dette)</span>
              <p className="text-xl md:text-2xl font-black text-indigo-600">{formatCurrency(Math.max(0, cartTotal - tenderedAmount))}</p>
            </div>
          )}

          {/* Auto-print toggle option */}
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg mr-3">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Imprimer le ticket</p>
                  <p className="text-[10px] md:text-xs text-slate-400">Impression automatique après validation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoPrint(!autoPrint)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                  autoPrint ? "bg-emerald-500" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    autoPrint ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Collapsible Receipt Customizer */}
            <div className="border-t border-slate-200/60 pt-3 mt-1">
              <button
                type="button"
                onClick={() => setShowReceiptSettings(!showReceiptSettings)}
                className="w-full text-left flex items-center justify-between text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
              >
                <span>🔧 Personnaliser l'en-tête & pied de page</span>
                <span className="text-[10px]">{showReceiptSettings ? '▲ Masquer' : '▼ Afficher'}</span>
              </button>
              
              {showReceiptSettings && (
                <div className="mt-3 space-y-3 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">En-tête du Ticket</label>
                    <textarea
                      value={receiptHeader}
                      onChange={(e) => {
                        setReceiptHeader(e.target.value);
                        localStorage.setItem('receipt_header', e.target.value);
                      }}
                      rows={2}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-mono"
                      placeholder="MHM E-boutique&#10;Tel: +221..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pied de page du Ticket</label>
                    <textarea
                      value={receiptFooter}
                      onChange={(e) => {
                        setReceiptFooter(e.target.value);
                        localStorage.setItem('receipt_footer', e.target.value);
                      }}
                      rows={2}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-mono"
                      placeholder="Merci pour votre confiance !&#10;MHM E-boutique"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <button 
              onClick={onClose}
              className="py-3 md:py-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-sm md:text-base"
            >
              Annuler
            </button>
            <button 
              onClick={handleComplete}
              disabled={!isValid || isProcessing}
              className={cn(
                "py-3 md:py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center text-sm md:text-base",
                isValid 
                  ? "bg-emerald-500 hover:bg-emerald-600 hover:shadow-emerald-500/30 active:scale-95" 
                  : "bg-slate-300 cursor-not-allowed shadow-none"
              )}
            >
              <Receipt className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              {isProcessing ? 'Enregistrement...' : 'Valider'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function printReceipt(transaction: any) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  const headerRaw = localStorage.getItem('receipt_header') || 'MHM E-boutique\nGestion de Ventes & Caisse';
  const footerRaw = localStorage.getItem('receipt_footer') || 'Merci pour votre confiance !\nMHM E-boutique';

  const headerHtml = headerRaw.split('\n').map((line, idx) => {
    if (idx === 0) return `<h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: bold;">${line}</h2>`;
    return `<p style="margin: 2px 0 0 0; font-size: 12px;">${line}</p>`;
  }).join('');

  const footerHtml = footerRaw.split('\n').map((line, idx) => {
    if (idx === 0) return `<p style="margin: 0; font-weight: bold;">${line}</p>`;
    return `<p style="margin: 4px 0 0 0;">${line}</p>`;
  }).join('');

  const itemsHtml = transaction.items.map((item: any) => `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; text-align: left;">
        ${item.quantity}x ${item.name} 
        ${item.isWholesale ? '<span style="font-size: 10px; color: #555;">(Gros)</span>' : ''}
      </td>
      <td style="text-align: right; padding: 6px 0; font-size: 13px; font-weight: bold;">
        ${(item.unitPrice * item.quantity).toLocaleString('fr-FR')} F
      </td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>Ticket MHM E-boutique</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0;
            padding: 15px 10px;
            color: #000;
            background-color: #fff;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .border-dashed { border-bottom: 1px dashed #000; margin: 12px 0; }
          table { width: 100%; border-collapse: collapse; }
          .flex-between { display: flex; justify-content: space-between; margin: 4px 0; }
          .large-text { font-size: 16px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="text-center">
          ${headerHtml}
          <p style="margin: 4px 0 0 0; font-size: 11px;">Date: ${new Date(transaction.timestamp).toLocaleString('fr-FR')}</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #555;">ID: ${transaction.id.substring(0, 8)}</p>
        </div>
        
        <div class="border-dashed"></div>
        
        <table>
          <thead>
            <tr>
              <th style="text-align: left; padding-bottom: 6px; font-size: 12px;">Désignation</th>
              <th style="text-align: right; padding-bottom: 6px; font-size: 12px;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="border-dashed"></div>
        
        <div class="flex-between large-text">
          <span>TOTAL :</span>
          <span>${transaction.totalAmount.toLocaleString('fr-FR')} F CFA</span>
        </div>
        <div class="flex-between" style="font-size: 12px;">
          <span>Reçu :</span>
          <span>${transaction.amountTendered.toLocaleString('fr-FR')} F CFA</span>
        </div>
        <div class="flex-between" style="font-size: 12px;">
          <span>Rendu :</span>
          <span>${transaction.change.toLocaleString('fr-FR')} F CFA</span>
        </div>
        
        <div class="border-dashed"></div>
        
        <div class="text-center" style="font-size: 11px; margin-top: 15px;">
          ${footerHtml}
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.parent.document.body.removeChild(window.frameElement);
            }, 1000);
          }
        </script>
      </body>
    </html>
  `;

  iframe.contentWindow?.document.open();
  iframe.contentWindow?.document.write(html);
  iframe.contentWindow?.document.close();
}

