export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum Category {
  RENT = 'Loyer',
  CLEANING_FEE = 'Frais de Ménage',
  DEPOSIT = 'Caution',
  MAINTENANCE = 'Entretien',
  UTILITIES = 'Charges',
  TAXES = 'Taxes',
  SUPPLIES = 'Consommables',
  MARKETING = 'Publicité',
  INVESTMENT = 'Investissement',
  OTHER = 'Autre',
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: Category | string;
  type: TransactionType;
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

export interface AIAnalysisResponse {
  summary: string;
  recommendations: string[];
}