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
  globalYear: string;
  setGlobalYear: (year: string) => void;
  isLoading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// URL de base pour vos fonctions Netlify
const API_BASE = '/.netlify/functions';

// Données initiales de démonstration (utilisées seulement si la base est vide)
const initialData: Transaction[] = [
  { id: '1', date: '2023-10-01', amount: 1200, description: 'Loyer - Réservation #442', category: Category.RENT, type: TransactionType.INCOME },
  { id: '2', date: '2023-10-05', amount: 150, description: 'Nettoyage fin de séjour', category: Category.CLEANING_FEE, type: TransactionType.EXPENSE },
  { id: '3', date: '2023-10-10', amount: 45, description: 'Réparation robinet', category: Category.MAINTENANCE, type: TransactionType.EXPENSE },
  { id: '4', date: '2023-10-15', amount: 1100, description: 'Loyer - Réservation #445', category: Category.RENT, type: TransactionType.INCOME },
  { id: '5', date: '2023-10-28', amount: 80, description: 'Facture Internet', category: Category.UTILITIES, type: TransactionType.EXPENSE },
];

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [globalYear, setGlobalYear] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Charger les transactions depuis Neon au démarrage
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE}/getTransactions`);
        if (response.ok) {
          const data = await response.json();
          
          // Si la base est vide, charger les données initiales
          if (data.length === 0) {
            console.log('Base vide, chargement des données initiales...');
            // Insérer les données initiales
            for (const transaction of initialData) {
              await fetch(`${API_BASE}/addTransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transaction)
              });
            }
            setTransactions(initialData);
          } else {
            setTransactions(data);
          }
          
          // Sauvegarder en backup local
          localStorage.setItem('locagest_transactions', JSON.stringify(data.length > 0 ? data : initialData));
        } else {
          // Si erreur API, charger depuis localStorage
          console.warn('Erreur API, chargement depuis localStorage');
          const saved = localStorage.getItem('locagest_transactions');
          setTransactions(saved ? JSON.parse(saved) : initialData);
        }
      } catch (error) {
        console.error('Erreur de chargement:', error);
        // En cas d'erreur, charger depuis localStorage
        const saved = localStorage.getItem('locagest_transactions');
        setTransactions(saved ? JSON.parse(saved) : initialData);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, []);

  // Sauvegarder dans localStorage à chaque changement (backup)
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem('locagest_transactions', JSON.stringify(transactions));
    }
  }, [transactions]);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };

    // Mise à jour optimiste (affichage immédiat)
    setTransactions(prev => [newTransaction, ...prev]);

    // Sauvegarde dans Neon
    try {
      const response = await fetch(`${API_BASE}/addTransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction)
      });

      if (!response.ok) {
        console.error('Erreur lors de l\'ajout dans Neon');
        // On garde quand même la transaction localement
      }
    } catch (error) {
      console.error('Erreur réseau:', error);
      // On garde quand même la transaction localement
    }
  };

  const updateTransaction = async (updatedTransaction: Transaction) => {
    // Mise à jour optimiste
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));

    // Sauvegarde dans Neon
    try {
      const response = await fetch(`${API_BASE}/updateTransaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTransaction)
      });

      if (!response.ok) {
        console.error('Erreur lors de la mise à jour dans Neon');
      }
    } catch (error) {
      console.error('Erreur réseau:', error);
    }
  };

  const deleteTransaction = async (id: string) => {
    // Suppression optimiste
    setTransactions(prev => prev.filter(t => t.id !== id));

    // Suppression dans Neon
    try {
      const response = await fetch(`${API_BASE}/deleteTransaction`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        console.error('Erreur lors de la suppression dans Neon');
      }
    } catch (error) {
      console.error('Erreur réseau:', error);
    }
  };

  const importTransactions = async (data: Transaction[]) => {
    if (Array.isArray(data)) {
      setTransactions(data);
      
      // Sauvegarder toutes les transactions dans Neon
      // Note: Pour une vraie app, il faudrait faire ça en batch ou avec confirmation
      for (const transaction of data) {
        try {
          await fetch(`${API_BASE}/addTransaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
          });
        } catch (error) {
          console.error('Erreur lors de l\'import:', error);
        }
      }
    }
  };

  const clearAllTransactions = async () => {
    // D'abord supprimer localement
    const idsToDelete = transactions.map(t => t.id);
    setTransactions([]);

    // Puis supprimer dans Neon
    for (const id of idsToDelete) {
      try {
        await fetch(`${API_BASE}/deleteTransaction`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
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
      setGlobalYear,
      isLoading
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