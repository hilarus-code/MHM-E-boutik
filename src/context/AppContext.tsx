import React, { createContext, useContext, useEffect, useState } from 'react';
import { Product, Session, Transaction, CartItem } from '../types';
import { db } from '../lib/db';

interface AppContextType {
  products: Product[];
  activeSession: Session | null;
  loading: boolean;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  refreshProducts: () => Promise<void>;
  refreshSession: () => Promise<void>;
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, isWholesale?: boolean) => void;
  updateCartItem: (productId: string, quantity: number, isWholesale: boolean) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartProfit: number;
  hasPromptedSession: boolean;
  setHasPromptedSession: (val: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPromptedSession, setHasPromptedSession] = useState(false);

  const refreshProducts = async () => {
    try {
      const p = await db.getProducts();
      setProducts(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error("Failed to fetch products from DB:", err);
      setProducts([]);
    }
  };

  const refreshSession = async () => {
    try {
      const s = await db.getActiveSession();
      setActiveSession(s);
    } catch (err) {
      console.error("Failed to fetch active session from DB:", err);
      setActiveSession(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await db.initProductsIfEmpty();
      } catch (err) {
        console.error("Failed to initialize products on start:", err);
      }
      
      try {
        await refreshProducts();
      } catch (err) {
        console.error("refreshProducts error:", err);
      }

      try {
        await refreshSession();
      } catch (err) {
        console.error("refreshSession error:", err);
      }
      
      setLoading(false);
    };
    init();
  }, []);

  const addToCart = (product: Product, quantity = 1, isWholesale = false) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity, isWholesale: isWholesale !== undefined ? isWholesale : item.isWholesale } 
            : item
        );
      }
      return [...prev, { product, quantity, isWholesale }];
    });
  };

  const updateCartItem = (productId: string, quantity: number, isWholesale: boolean) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity, isWholesale } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((total, item) => {
    const price = item.isWholesale ? item.product.wholesalePrice : item.product.retailPrice;
    return total + (price * item.quantity);
  }, 0);

  const cartProfit = cart.reduce((total, item) => {
    const price = item.isWholesale ? item.product.wholesalePrice : item.product.retailPrice;
    const cost = item.isWholesale ? (item.product.costPrice * (item.product.unitsPerWholesale || 24)) : item.product.costPrice;
    const profit = price - cost;
    return total + (profit * item.quantity);
  }, 0);

  return (
    <AppContext.Provider value={{
      products,
      activeSession,
      loading,
      isAdmin,
      setIsAdmin,
      refreshProducts,
      refreshSession,
      cart,
      addToCart,
      updateCartItem,
      removeFromCart,
      clearCart,
      cartTotal,
      cartProfit,
      hasPromptedSession,
      setHasPromptedSession
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
