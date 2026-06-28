import localforage from 'localforage';
import { Product, Transaction, Session, Credit } from '../types';
import { initialProducts } from '../data/initial-products';
import { supabaseDb } from './supabase-db';


// Configure stores
const productsStore = localforage.createInstance({ name: 'pos', storeName: 'products' });
const transactionsStore = localforage.createInstance({ name: 'pos', storeName: 'transactions' });
const sessionsStore = localforage.createInstance({ name: 'pos', storeName: 'sessions' });
const creditsStore = localforage.createInstance({ name: 'pos', storeName: 'credits' });

const localDb = {
  // --- Products ---
  async initProductsIfEmpty() {
    const keys = await productsStore.keys();
    if (keys.length === 0) {
      console.log('Initializing database with default products...');
      for (const product of initialProducts) {
        await productsStore.setItem(product.id, product);
      }
    }
  },

  async getProducts(): Promise<Product[]> {
    const products: Product[] = [];
    await productsStore.iterate((value: Product) => {
      if (value.unitsPerWholesale === undefined) value.unitsPerWholesale = 24;
      if (value.minStockLevel === undefined) value.minStockLevel = 20;
      products.push(value);
    });
    return products;
  },

  async getProduct(id: string): Promise<Product | null> {
    const p = await productsStore.getItem<Product>(id);
    if (p) {
      if (p.unitsPerWholesale === undefined) p.unitsPerWholesale = 24;
      if (p.minStockLevel === undefined) p.minStockLevel = 20;
    }
    return p;
  },

  async updateProduct(product: Product): Promise<void> {
    await productsStore.setItem(product.id, product);
  },

  async deleteProduct(id: string): Promise<void> {
    await productsStore.removeItem(id);
  },

  async updateProductStock(id: string, quantityChange: number): Promise<void> {
    const product = await this.getProduct(id);
    if (product) {
      product.stock += quantityChange;
      await this.updateProduct(product);
    }
  },

  // --- Sessions ---
  async openSession(initialCash: number): Promise<Session> {
    const active = await this.getActiveSession();
    if (active) throw new Error("A session is already open");

    const newSession: Session = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      endTime: null,
      initialCash,
      expectedFinalCash: null,
      actualFinalCash: null,
      status: 'OPEN',
      expenses: []
    };
    await sessionsStore.setItem(newSession.id, newSession);
    return newSession;
  },

  async getActiveSession(): Promise<Session | null> {
    let activeSession: Session | null = null;
    await sessionsStore.iterate((value: Session) => {
      if (value.status === 'OPEN') {
        activeSession = value;
      }
    });
    return activeSession;
  },

  async getSessions(): Promise<Session[]> {
    const sessions: Session[] = [];
    await sessionsStore.iterate((value: Session) => {
      sessions.push(value);
    });
    return sessions.sort((a, b) => b.startTime - a.startTime);
  },

  async updateSession(session: Session): Promise<void> {
    await sessionsStore.setItem(session.id, session);
  },

  async closeSession(sessionId: string, actualFinalCash: number): Promise<Session> {
    const session = await sessionsStore.getItem<Session>(sessionId);
    if (!session) throw new Error("Session not found");
    
    // Calculate expected cash: initial + total sales - total expenses
    const transactions = await this.getTransactionsForSession(sessionId);
    const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);
    
    session.expectedFinalCash = session.initialCash + totalSales - totalExpenses;
    session.actualFinalCash = actualFinalCash;
    session.endTime = Date.now();
    session.status = 'CLOSED';
    
    await sessionsStore.setItem(session.id, session);
    return session;
  },

  async addExpenseToActiveSession(description: string, amount: number): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) throw new Error("No active session");
    
    session.expenses.push({
      id: crypto.randomUUID(),
      description,
      amount,
      timestamp: Date.now()
    });
    await this.updateSession(session);
  },

  // --- Transactions ---
  async saveTransaction(transaction: Transaction): Promise<void> {
    // 1. Save transaction
    await transactionsStore.setItem(transaction.id, transaction);
    
    // 2. Update product stock (immutable inventory reduction)
    for (const item of transaction.items) {
      const unitsToDeduct = item.isWholesale ? (item.quantity * (item.unitsPerWholesale || 24)) : item.quantity;
      await this.updateProductStock(item.productId, -unitsToDeduct);
    }
  },

  async getTransactionsForSession(sessionId: string): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    await transactionsStore.iterate((value: Transaction) => {
      if (value.sessionId === sessionId) {
        transactions.push(value);
      }
    });
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  },
  
  async getAllTransactions(): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    await transactionsStore.iterate((value: Transaction) => {
      transactions.push(value);
    });
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  },

  // --- Credits / Advances ---
  async saveCredit(credit: Credit): Promise<void> {
    await creditsStore.setItem(credit.id, credit);
  },

  async getCredits(): Promise<Credit[]> {
    const credits: Credit[] = [];
    await creditsStore.iterate((value: Credit) => {
      credits.push(value);
    });
    return credits.sort((a, b) => b.timestamp - a.timestamp);
  },

  async updateCreditPayment(creditId: string, additionalPayment: number): Promise<void> {
    const credit = await creditsStore.getItem<Credit>(creditId);
    if (credit) {
      credit.paidAmount += additionalPayment;
      credit.remainingAmount = credit.totalAmount - credit.paidAmount;
      if (credit.remainingAmount <= 0) {
        credit.status = 'PAID';
        credit.remainingAmount = 0;
      }
      await creditsStore.setItem(credit.id, credit);
    }
  }
};

const apiDb = {
  async initProductsIfEmpty() {
    // Already pre-seeded in cloud Postgres
  },

  async getProducts(): Promise<Product[]> {
    const res = await fetch('/api/db/products');
    if (!res.ok) throw new Error("Erreur de récupération des produits");
    return res.json();
  },

  async getProduct(id: string): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  },

  async updateProduct(product: Product): Promise<void> {
    const res = await fetch('/api/db/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error("Erreur de mise à jour du produit");
  },

  async deleteProduct(id: string): Promise<void> {
    const res = await fetch(`/api/db/products/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error("Erreur de suppression du produit");
  },

  async updateProductStock(id: string, quantityChange: number): Promise<void> {
    const p = await this.getProduct(id);
    if (p) {
      p.stock += quantityChange;
      await this.updateProduct(p);
    }
  },

  // --- Sessions ---
  async openSession(initialCash: number): Promise<Session> {
    const res = await fetch('/api/db/sessions/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialCash })
    });
    if (!res.ok) throw new Error("Erreur d'ouverture de session");
    return res.json();
  },

  async getActiveSession(): Promise<Session | null> {
    const res = await fetch('/api/db/sessions/active');
    if (!res.ok) throw new Error("Erreur de récupération de la session active");
    return res.json();
  },

  async getSessions(): Promise<Session[]> {
    const res = await fetch('/api/db/sessions');
    if (!res.ok) throw new Error("Erreur de récupération des sessions");
    return res.json();
  },

  async updateSession(session: Session): Promise<void> {
    const res = await fetch('/api/db/sessions/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    if (!res.ok) throw new Error("Erreur de mise à jour de la session");
  },

  async closeSession(sessionId: string, actualFinalCash: number): Promise<Session> {
    const res = await fetch('/api/db/sessions/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, actualFinalCash })
    });
    if (!res.ok) throw new Error("Erreur de fermeture de session");
    return res.json();
  },

  async addExpenseToActiveSession(description: string, amount: number): Promise<void> {
    const active = await this.getActiveSession();
    if (!active) throw new Error("Aucune session active");
    const res = await fetch('/api/db/sessions/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: active.id, description, amount })
    });
    if (!res.ok) throw new Error("Erreur d'ajout de la dépense");
  },

  // --- Transactions ---
  async saveTransaction(transaction: Transaction): Promise<void> {
    const res = await fetch('/api/db/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    if (!res.ok) throw new Error("Erreur d'enregistrement de la transaction");
  },

  async getTransactionsForSession(sessionId: string): Promise<Transaction[]> {
    const txs = await this.getAllTransactions();
    return txs.filter(t => t.sessionId === sessionId);
  },

  async getAllTransactions(): Promise<Transaction[]> {
    const res = await fetch('/api/db/transactions');
    if (!res.ok) throw new Error("Erreur de récupération des transactions");
    return res.json();
  },

  // --- Credits ---
  async saveCredit(credit: Credit): Promise<void> {
    const res = await fetch('/api/db/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credit)
    });
    if (!res.ok) throw new Error("Erreur d'enregistrement du crédit");
  },

  async getCredits(): Promise<Credit[]> {
    const res = await fetch('/api/db/credits');
    if (!res.ok) throw new Error("Erreur de récupération des crédits");
    return res.json();
  },

  async updateCreditPayment(creditId: string, additionalPayment: number): Promise<void> {
    const res = await fetch('/api/db/credits/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditId, additionalPayment })
    });
    if (!res.ok) throw new Error("Erreur de mise à jour du paiement");
  }
};

export async function syncLocalToSupabase() {
  // Now we are fully real-time directly to the central cloud database!
  // No local sync needed as every transaction is stored instantly.
  return {
    products: 0,
    sessions: 0,
    transactions: 0,
    credits: 0
  };
}

export const db = apiDb;
export const isSupabaseConfigured = true;

