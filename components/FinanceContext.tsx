import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Transaction, TransactionType, Category } from '../types';

interface FinanceContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (data: Transaction[]) => void;
  clearAllTransactions: () => void;
  getSummary: () => { totalIncome: number; totalExpense: number; balance: number };
  // Global Year State
  globalYear: string;
  setGlobalYear: (year: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Dummy initial data for demonstration
const initialData: Transaction[] = [
  { id: '1', date: '2023-10-01', amount: 1200, description: 'Loyer - Réservation #442', category: Category.RENT, type: TransactionType.INCOME },
  { id: '2', date: '2023-10-05', amount: 150, description: 'Nettoyage fin de séjour', category: Category.CLEANING_FEE, type: TransactionType.EXPENSE },
  { id: '3', date: '2023-10-10', amount: 45, description: 'Réparation robinet', category: Category.MAINTENANCE, type: TransactionType.EXPENSE },
  { id: '4', date: '2023-10-15', amount: 1100, description: 'Loyer - Réservation #445', category: Category.RENT, type: TransactionType.INCOME },
  { id: '5', date: '2023-10-28', amount: 80, description: 'Facture Internet', category: Category.UTILITIES, type: TransactionType.EXPENSE },
];

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('locagest_transactions');
    return saved ? JSON.parse(saved) : initialData;
  });

  const [globalYear, setGlobalYear] = useState<string>('ALL');

  useEffect(() => {
    localStorage.setItem('locagest_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const updateTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const importTransactions = (data: Transaction[]) => {
    if (Array.isArray(data)) {
      // Basic validation could be improved
      setTransactions(data);
    }
  };

  const clearAllTransactions = () => {
    setTransactions([]);
  };

  const getSummary = () => {
    const totalIncome = transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  };

  return (
    <FinanceContext.Provider value={{ 
      transactions, 
      addTransaction, 
      updateTransaction, 
      deleteTransaction, 
      importTransactions, 
      clearAllTransactions, 
      getSummary,
      globalYear,
      setGlobalYear
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};