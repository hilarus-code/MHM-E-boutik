import { supabase } from './supabase';
import { Product, Transaction, Session, Credit } from '../types';

export const supabaseDb = {
  // --- Products ---
  async initProductsIfEmpty() {
    if (!supabase) throw new Error("Supabase is not configured");
    const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
    if (error) throw error;
    
    if (count === 0) {
      const { initialProducts } = await import('../data/initial-products');
      const payload = initialProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        retail_price: p.retailPrice,
        wholesale_price: p.wholesalePrice,
        wholesale_threshold: p.wholesaleThreshold,
        units_per_wholesale: p.unitsPerWholesale || 24,
        min_stock_level: p.minStockLevel || 20,
        stock: p.stock,
        cost_price: p.costPrice,
        format: p.format
      }));
      const { error: insertError } = await supabase.from('products').insert(payload);
      if (insertError) throw insertError;
    }
  },

  async getProducts(): Promise<Product[]> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    
    // Map to camelCase
    return data.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      retailPrice: p.retail_price,
      wholesalePrice: p.wholesale_price,
      wholesaleThreshold: p.wholesale_threshold,
      unitsPerWholesale: p.units_per_wholesale || 24,
      minStockLevel: p.min_stock_level || 20,
      stock: p.stock,
      costPrice: p.cost_price,
      format: p.format
    }));
  },

  async getProduct(id: string): Promise<Product | null> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      retailPrice: data.retail_price,
      wholesalePrice: data.wholesale_price,
      wholesaleThreshold: data.wholesale_threshold,
      unitsPerWholesale: data.units_per_wholesale || 24,
      minStockLevel: data.min_stock_level || 20,
      stock: data.stock,
      costPrice: data.cost_price,
      format: data.format
    };
  },

  async updateProduct(product: Product): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const payload = {
      id: product.id,
      name: product.name,
      category: product.category,
      retail_price: product.retailPrice,
      wholesale_price: product.wholesalePrice,
      wholesale_threshold: product.wholesaleThreshold,
      units_per_wholesale: product.unitsPerWholesale,
      min_stock_level: product.minStockLevel,
      stock: product.stock,
      cost_price: product.costPrice,
      format: product.format
    };

    const { error } = await supabase.from('products').upsert(payload);
    if (error) throw error;
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
    if (!supabase) throw new Error("Supabase is not configured");
    const active = await this.getActiveSession();
    if (active) throw new Error("A session is already open");

    const { data, error } = await supabase.from('sessions').insert({
      initial_cash: initialCash,
      status: 'OPEN'
    }).select().single();

    if (error) throw error;
    
    return {
      id: data.id,
      startTime: new Date(data.start_time).getTime(),
      endTime: null,
      initialCash: data.initial_cash,
      expectedFinalCash: null,
      actualFinalCash: null,
      status: data.status,
      expenses: []
    };
  },

  async getActiveSession(): Promise<Session | null> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase
      .from('sessions')
      .select('*, expenses(*)')
      .eq('status', 'OPEN')
      .maybeSingle();
      
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      startTime: new Date(data.start_time).getTime(),
      endTime: data.end_time ? new Date(data.end_time).getTime() : null,
      initialCash: data.initial_cash,
      expectedFinalCash: data.expected_final_cash,
      actualFinalCash: data.actual_final_cash,
      status: data.status,
      expenses: data.expenses ? data.expenses.map((e: any) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        timestamp: new Date(e.timestamp).getTime()
      })) : []
    };
  },

  async getSessions(): Promise<Session[]> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase
      .from('sessions')
      .select('*, expenses(*)')
      .order('start_time', { ascending: false });

    if (error) throw error;
    return data.map(s => ({
      id: s.id,
      startTime: new Date(s.start_time).getTime(),
      endTime: s.end_time ? new Date(s.end_time).getTime() : null,
      initialCash: s.initial_cash,
      expectedFinalCash: s.expected_final_cash,
      actualFinalCash: s.actual_final_cash,
      status: s.status,
      expenses: s.expenses ? s.expenses.map((e: any) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        timestamp: new Date(e.timestamp).getTime()
      })) : []
    }));
  },

  async updateSession(session: Session): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.from('sessions').update({
      start_time: new Date(session.startTime).toISOString(),
      end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
      initial_cash: session.initialCash,
      expected_final_cash: session.expectedFinalCash,
      actual_final_cash: session.actualFinalCash,
      status: session.status
    }).eq('id', session.id);
    if (error) throw error;
  },

  async closeSession(sessionId: string, actualFinalCash: number): Promise<Session> {
    if (!supabase) throw new Error("Supabase is not configured");
    
    // First get the active session to calculate expectations
    const session = await this.getActiveSession();
    if (!session || session.id !== sessionId) throw new Error("Session not found or not active");

    const transactions = await this.getTransactionsForSession(sessionId);
    const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);
    
    session.expectedFinalCash = session.initialCash + totalSales - totalExpenses;
    session.actualFinalCash = actualFinalCash;
    session.endTime = Date.now();
    session.status = 'CLOSED';
    
    await this.updateSession(session);
    return session;
  },

  async addExpenseToActiveSession(description: string, amount: number): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const session = await this.getActiveSession();
    if (!session) throw new Error("No active session");
    
    const { error } = await supabase.from('expenses').insert({
      session_id: session.id,
      description,
      amount
    });
    if (error) throw error;
  },

  // --- Transactions ---
  async saveTransaction(transaction: Transaction): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    
    // 1. Save transaction
    const { error: txError } = await supabase.from('transactions').insert({
      id: transaction.id,
      session_id: transaction.sessionId,
      timestamp: new Date(transaction.timestamp).toISOString(),
      total_amount: transaction.totalAmount,
      total_profit: transaction.totalProfit,
      amount_tendered: transaction.amountTendered,
      change: transaction.change,
      payment_method: 'CASH' // or dynamic based on what's available
    });
    if (txError) throw txError;
    
    // 2. Save items
    const itemsPayload = transaction.items.map(item => ({
      transaction_id: transaction.id,
      product_id: item.productId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      cost_price: item.costPrice,
      is_wholesale: item.isWholesale,
      units_per_wholesale: item.unitsPerWholesale || null
    }));

    const { error: itemsError } = await supabase.from('transaction_items').insert(itemsPayload);
    if (itemsError) throw itemsError;

    // 3. Update product stock
    for (const item of transaction.items) {
      const unitsToDeduct = item.isWholesale ? (item.quantity * (item.unitsPerWholesale || 24)) : item.quantity;
      await this.updateProductStock(item.productId, -unitsToDeduct);
    }
  },

  async getTransactionsForSession(sessionId: string): Promise<Transaction[]> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_items(*)')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    
    return data.map(t => ({
      id: t.id,
      sessionId: t.session_id,
      timestamp: new Date(t.timestamp).getTime(),
      totalAmount: t.total_amount,
      totalProfit: t.total_profit,
      amountTendered: t.amount_tendered,
      change: t.change,
      items: t.transaction_items.map((i: any) => ({
        productId: i.product_id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.total_price,
        costPrice: i.cost_price,
        isWholesale: i.is_wholesale,
        unitsPerWholesale: i.units_per_wholesale
      }))
    }));
  },
  
  async getAllTransactions(): Promise<Transaction[]> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_items(*)')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    
    return data.map(t => ({
      id: t.id,
      sessionId: t.session_id,
      timestamp: new Date(t.timestamp).getTime(),
      totalAmount: t.total_amount,
      totalProfit: t.total_profit,
      amountTendered: t.amount_tendered,
      change: t.change,
      items: t.transaction_items.map((i: any) => ({
        productId: i.product_id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.total_price,
        costPrice: i.cost_price,
        isWholesale: i.is_wholesale,
        unitsPerWholesale: i.units_per_wholesale
      }))
    }));
  },

  // --- Credits / Advances ---
  async saveCredit(credit: Credit): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.from('credits').upsert({
      id: credit.id,
      client_name: credit.clientName,
      total_amount: credit.totalAmount,
      paid_amount: credit.paidAmount,
      remaining_amount: credit.remainingAmount,
      timestamp: new Date(credit.timestamp).toISOString(),
      due_date: credit.dueDate ? new Date(credit.dueDate).toISOString() : null,
      status: credit.status
    });
    if (error) throw error;
  },

  async getCredits(): Promise<Credit[]> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase
      .from('credits')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    
    return data.map(c => ({
      id: c.id,
      clientName: c.client_name,
      totalAmount: c.total_amount,
      paidAmount: c.paid_amount,
      remainingAmount: c.remaining_amount,
      timestamp: new Date(c.timestamp).getTime(),
      dueDate: c.due_date ? new Date(c.due_date).getTime() : undefined,
      status: c.status
    }));
  },

  async updateCreditPayment(creditId: string, additionalPayment: number): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data: credit, error: fetchError } = await supabase.from('credits').select('*').eq('id', creditId).single();
    if (fetchError) throw fetchError;
    if (credit) {
      const paidAmount = credit.paid_amount + additionalPayment;
      const remainingAmount = credit.total_amount - paidAmount;
      const status = remainingAmount <= 0 ? 'PAID' : 'PENDING';
      
      const { error: updateError } = await supabase.from('credits').update({
        paid_amount: paidAmount,
        remaining_amount: Math.max(0, remainingAmount),
        status
      }).eq('id', creditId);
      if (updateError) throw updateError;
    }
  }
};
