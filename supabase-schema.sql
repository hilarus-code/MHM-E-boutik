-- Supabase Schema for OmniPOS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    retail_price NUMERIC NOT NULL,
    wholesale_price NUMERIC NOT NULL,
    wholesale_threshold INTEGER NOT NULL,
    units_per_wholesale INTEGER DEFAULT 24,
    min_stock_level INTEGER DEFAULT 20,
    stock INTEGER NOT NULL DEFAULT 0,
    cost_price NUMERIC NOT NULL,
    format TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    initial_cash NUMERIC NOT NULL,
    expected_final_cash NUMERIC,
    actual_final_cash NUMERIC,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE RESTRICT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_amount NUMERIC NOT NULL,
    total_profit NUMERIC NOT NULL,
    amount_tendered NUMERIC NOT NULL,
    change NUMERIC NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CREDIT'))
);

-- Table: transaction_items
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    cost_price NUMERIC NOT NULL,
    is_wholesale BOOLEAN NOT NULL DEFAULT FALSE,
    units_per_wholesale INTEGER
);

-- Table: credits
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    remaining_amount NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID'))
);

-- Optional: Create RLS policies if needed, but for now we keep it public/authenticated depending on your needs.
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
