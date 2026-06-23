export type Category = 
  | 'Bières et Boissons Alcoolisées'
  | 'Sodas et Boissons Gazeuses'
  | 'Boissons Énergisantes et Toniques'
  | 'Jus, Boissons Lactées et Fruits'
  | 'Eaux'
  | 'Cocktails'
  | 'Autres';

export interface Product {
  id: string;
  name: string;
  category: Category;
  retailPrice: number; // Prix de détail
  wholesalePrice: number; // Prix de gros
  wholesaleThreshold: number; // Quantité à partir de laquelle le prix de gros s'applique
  unitsPerWholesale?: number; // Nbre d'unités par carton/gros
  minStockLevel?: number; // Seuil d'alerte stock
  stock: number;
  costPrice: number; // Prix d'achat pour le calcul des bénéfices
  format?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  isWholesale: boolean;
}

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costPrice: number;
  isWholesale: boolean;
  unitsPerWholesale?: number;
}

export interface Transaction {
  id: string;
  sessionId: string;
  timestamp: number;
  items: TransactionItem[];
  totalAmount: number;
  totalProfit: number;
  amountTendered: number;
  change: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  timestamp: number;
}

export interface Session {
  id: string;
  startTime: number;
  endTime: number | null;
  initialCash: number;
  expectedFinalCash: number | null;
  actualFinalCash: number | null;
  status: 'OPEN' | 'CLOSED';
  expenses: Expense[];
}

export interface Credit {
  id: string;
  clientName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  timestamp: number;
  dueDate?: number;
  status: 'PENDING' | 'PAID';
}

export interface DashboardStats {
  totalSales: number;
  totalProfit: number;
  totalTransactions: number;
  topProducts: { name: string; quantity: number }[];
}
