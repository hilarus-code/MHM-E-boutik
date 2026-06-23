import localforage from 'localforage';
import { Product, Transaction, Session, Credit } from '../types';
import { initialProducts } from '../data/initial-products';
import { supabaseDb } from './supabase-db';
import { isSupabaseConfigured } from './supabase';

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

export const db = isSupabaseConfigured ? supabaseDb : localDb;
