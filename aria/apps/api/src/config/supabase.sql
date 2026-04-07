-- Schema Supabase — Fonte de verdade para dados financeiros
-- Execute isso no SQL Editor do Supabase após criar o projeto

-- ============================================================
-- 1. Configurações e Integrações
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
  provider TEXT PRIMARY KEY,
  refresh_token TEXT,
  access_token TEXT,
  is_valid BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. Dados Financeiros
-- ============================================================

-- Transações
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'income' ou 'expense'
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  tags TEXT[], -- array de tags
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orçamento por categoria
CREATE TABLE IF NOT EXISTS budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT UNIQUE NOT NULL,
  monthly_budget DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dívidas
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor TEXT NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  interest_rate DECIMAL(5, 2), -- % ao mês
  remaining_installments INT,
  due_day INT,
  monthly_payment DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contas em atraso
CREATE TABLE IF NOT EXISTS overdue_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  overdue_amount DECIMAL(12, 2) NOT NULL,
  days_overdue INT NOT NULL,
  registration_date DATE NOT NULL,
  status TEXT, -- 'pending', 'negotiating', 'resolved'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Metas financeiras
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Perfil do usuário
CREATE TABLE IF NOT EXISTS user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_date DATE,
  fixed_income DECIMAL(12, 2),
  variable_income DECIMAL(12, 2),
  total_income DECIMAL(12, 2),
  savings_capacity DECIMAL(12, 2),
  financial_health_score INT, -- 0-100
  classification TEXT,
  main_objective TEXT,
  debt_payoff_deadline TEXT,
  action_plan TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Índices para performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_budget_category ON budget(category);
CREATE INDEX IF NOT EXISTS idx_debts_creditor ON debts(creditor);
CREATE INDEX IF NOT EXISTS idx_overdue_accounts_status ON overdue_accounts(status);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON goals(deadline);
