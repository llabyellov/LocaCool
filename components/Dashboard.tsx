import React, { useState, useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import { TransactionType, Category } from '../types';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  isDark: boolean;
}

// Couleurs Néon pour les catégories
const NEON_COLORS: { [key: string]: string } = {
  [Category.RENT]: '#34D399', // Emerald 400
  [Category.CLEANING_FEE]: '#F472B6', // Pink 400
  [Category.MAINTENANCE]: '#F87171', // Red 400
  [Category.UTILITIES]: '#60A5FA', // Blue 400
  [Category.TAXES]: '#A78BFA', // Violet 400
  [Category.SUPPLIES]: '#FBBF24', // Amber 400 (Consommables)
  [Category.MARKETING]: '#2DD4BF', // Teal 400
  [Category.INVESTMENT]: '#22D3EE', // Cyan 400
  [Category.OTHER]: '#9CA3AF', // Gray 400
};

interface NeonCardProps {
  children?: React.ReactNode;
  className?: string;
  isDark: boolean;
}

const NeonCard: React.FC<NeonCardProps> = ({ children, className = '', isDark }) => (
  <div className={`p-6 rounded-xl border-2 transition-all duration-300 ${isDark 
    ? 'bg-slate-800 border-green-400 hover:border-pink-500 hover:shadow-[0_0_15px_rgba(236,72,153,0.5)] text-white' 
    : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-lg text-slate-800'} ${className}`}>
    {children}
  </div>
);

interface KPICardProps {
  title: string;
  amount: number;
  colorClass: string;
  icon: React.ReactNode;
  isDark: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, amount, colorClass, icon, isDark }) => (
  <NeonCard className="flex items-center justify-between" isDark={isDark}>
    <div>
      <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
      <h3 className={`text-2xl font-bold ${colorClass} drop-shadow-md`}>
        {amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </h3>
    </div>
    <div className={`p-3 rounded-full bg-opacity-10 ${isDark ? 'bg-white' : ''} ${colorClass.replace('text-', isDark ? 'text-' : 'bg-')}`}>
      {icon}
    </div>
  </NeonCard>
);

const CustomTooltip = ({ active, payload, label, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-3 rounded-lg border shadow-lg ${
        isDark ? 'bg-slate-900 border-green-400 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <p className="font-bold mb-2 text-center border-b pb-1 border-slate-600">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            // Determine real name and color
            const rawName = entry.name;
            const categoryName = rawName === Category.RENT ? Category.RENT : rawName;
            
            // Special handling for Net Balance in drilldown
            let color;
            if (entry.payload.isBalance) {
                color = entry.value >= 0 ? '#3B82F6' : '#EF4444';
            } else {
                color = NEON_COLORS[categoryName] || entry.fill;
            }
            
            return (
              <div key={index} className="flex items-center justify-between text-xs gap-4">
                <span style={{ color: color }} className="font-medium">
                  {categoryName}:
                </span>
                <span className="font-bold">
                  {Math.abs(entry.value).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ isDark }) => {
  const { transactions, globalYear, setGlobalYear } = useFinance();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  
  // Drilldown state
  const [drillDownMonth, setDrillDownMonth] = useState<{ key: string, label: string } | null>(null);

  // Génération des années disponibles (Tout + 5 années à partir de l'actuelle)
  const yearOptions = useMemo(() => {
    const years = ['ALL'];
    for (let i = 0; i < 5; i++) {
      years.push((currentYear + i).toString());
    }
    return years;
  }, [currentYear]);

  // --- Calcul Dynamique des KPIs (Total, Année, ou Mois) ---
  const { kpiIncome, kpiExpense, kpiBalance, kpiLabel } = useMemo(() => {
    let filteredData = transactions;
    let label = 'Total';

    if (drillDownMonth) {
        filteredData = transactions.filter(t => t.date.startsWith(drillDownMonth.key));
        label = drillDownMonth.label; // Ex: "Octobre 2023"
    } else if (globalYear !== 'ALL') {
        filteredData = transactions.filter(t => new Date(t.date).getFullYear().toString() === globalYear);
        label = globalYear; // Ex: "2023"
    }

    const income = filteredData
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);

    const expense = filteredData
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

    return {
        kpiIncome: income,
        kpiExpense: expense,
        kpiBalance: income - expense,
        kpiLabel: label
    };
  }, [transactions, globalYear, drillDownMonth]);


  // --- Préparation des données ANNUELLES (Vue Principale) ---
  const { chartData, incomeCategories, expenseCategories, maxRentCount } = useMemo(() => {
    let filteredTransactions = transactions;
    if (globalYear !== 'ALL') {
      filteredTransactions = transactions.filter(t => 
        new Date(t.date).getFullYear().toString() === globalYear
      );
    }

    const monthsMap: { [key: string]: any } = {};
    const incCats = new Set<string>();
    const expCats = new Set<string>();
    
    // Suivi spécifique pour les loyers afin de créer des barres individuelles
    const rentCounts: { [key: string]: number } = {};
    let maxRents = 0;

    // Initialisation des mois si une année spécifique est sélectionnée
    if (globalYear !== 'ALL') {
      for (let i = 0; i < 12; i++) {
        const date = new Date(parseInt(globalYear), i, 1);
        const key = `${date.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
        const name = date.toLocaleDateString('fr-FR', { month: 'short' });
        const fullDate = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        monthsMap[key] = { name, fullDate, key };
      }
    }

    // Remplissage avec les données
    const sortedTrans = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTrans.forEach(t => {
      const date = new Date(t.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      if (!monthsMap[key]) {
        const name = globalYear === 'ALL' 
          ? date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
          : date.toLocaleDateString('fr-FR', { month: 'short' });
        const fullDate = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        monthsMap[key] = { name, fullDate, key };
      }

      // Gestion spécifique des loyers pour les séparer visuellement
      if (t.type === TransactionType.INCOME) {
        if (t.category === Category.RENT) {
          const currentCount = rentCounts[key] || 0;
          const rentKey = `inc_${Category.RENT}_${currentCount}`;
          monthsMap[key][rentKey] = t.amount;
          rentCounts[key] = currentCount + 1;
          maxRents = Math.max(maxRents, rentCounts[key]);
        } else {
          const catKey = `inc_${t.category}`;
          monthsMap[key][catKey] = (monthsMap[key][catKey] || 0) + t.amount;
          incCats.add(t.category as string);
        }
      } else {
        const catKey = `exp_${t.category}`;
        monthsMap[key][catKey] = (monthsMap[key][catKey] || 0) + t.amount;
        expCats.add(t.category as string);
      }
    });

    return {
      chartData: Object.values(monthsMap).sort((a: any, b: any) => a.key.localeCompare(b.key)),
      incomeCategories: Array.from(incCats),
      expenseCategories: Array.from(expCats),
      maxRentCount: maxRents
    };
  }, [transactions, globalYear]);

  // --- Préparation des données MENSUELLES (Vue Détaillée) ---
  const monthDetailData = useMemo(() => {
    if (!drillDownMonth) return [];

    const monthTransactions = transactions.filter(t => t.date.startsWith(drillDownMonth.key));
    
    // Aggregate by category
    const catMap: { [key: string]: { amount: number, type: TransactionType } } = {};
    let totalInc = 0;
    let totalExp = 0;

    monthTransactions.forEach(t => {
        if (!catMap[t.category]) {
            catMap[t.category] = { amount: 0, type: t.type };
        }
        catMap[t.category].amount += t.amount;

        if(t.type === TransactionType.INCOME) totalInc += t.amount;
        else totalExp += t.amount;
    });

    // Convert to array for chart
    // Income positive, Expense negative for visualization
    const data: {
      name: string;
      value: number;
      type: TransactionType | string;
      color: string;
      isBalance?: boolean;
    }[] = Object.entries(catMap).map(([cat, info]) => ({
        name: cat,
        value: info.type === TransactionType.EXPENSE ? -info.amount : info.amount,
        type: info.type,
        color: NEON_COLORS[cat] || '#9CA3AF'
    }));

    // Add Net Balance
    const balance = totalInc - totalExp;
    data.push({
        name: 'SOLDE NET',
        value: balance,
        type: 'BALANCE',
        color: balance >= 0 ? '#3B82F6' : '#EF4444', // Blue or Red
        isBalance: true
    });

    return data;

  }, [transactions, drillDownMonth]);

  const closeDrillDown = () => {
    setDrillDownMonth(null);
  };

  const navigateToMonthTransactions = () => {
    if (drillDownMonth) {
        navigate('/transactions', { state: { filterMonth: drillDownMonth.key } });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-slate-800'}`}>Tableau de Bord</h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Aperçu de votre activité locative</p>
        </div>
      </div>

      {/* Year Selection Buttons (Only visible in main view) */}
      {!drillDownMonth && (
        <div className="flex flex-wrap gap-2 mb-6">
            {yearOptions.map(year => (
            <button
                key={year}
                onClick={() => setGlobalYear(year)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 border-2
                ${globalYear === year 
                    ? 'bg-pink-600 border-pink-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.7)]' 
                    : isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-green-400 hover:text-green-400' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-400'
                }`}
            >
                {year === 'ALL' ? 'Tout' : year}
            </button>
            ))}
        </div>
      )}

      {/* KPI Cards (Always visible, now dynamic) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard 
          title={`Revenus ${kpiLabel === 'Total' ? 'Totaux' : `(${kpiLabel})`}`} 
          amount={kpiIncome} 
          colorClass="text-emerald-400"
          isDark={isDark}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KPICard 
          title={`Dépenses ${kpiLabel === 'Total' ? 'Totales' : `(${kpiLabel})`}`} 
          amount={kpiExpense} 
          colorClass="text-rose-400"
          isDark={isDark}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
        />
        <KPICard 
          title={`Solde Net ${kpiLabel === 'Total' ? '' : `(${kpiLabel})`}`} 
          amount={kpiBalance} 
          colorClass="text-indigo-400"
          isDark={isDark}
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
        />
      </div>

      {/* Main Chart Section */}
      <NeonCard className="flex flex-col" isDark={isDark}>
        {drillDownMonth ? (
             // --- VUE DÉTAILLÉE PAR MOIS ---
             <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Détails : <span className="text-pink-400 uppercase">{drillDownMonth.label}</span>
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Revenus (droite) vs Dépenses (gauche) & Solde Net
                        </p>
                    </div>
                    <div className="flex gap-2">
                         <button 
                            onClick={navigateToMonthTransactions}
                            className={`px-3 py-1.5 text-xs font-bold border rounded transition-colors ${
                                isDark ? 'border-slate-600 text-slate-300 hover:border-pink-500 hover:text-pink-500' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Voir les transactions
                        </button>
                        <button 
                            onClick={closeDrillDown}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center shadow-lg border border-slate-600"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Retour au graphe annuel
                        </button>
                    </div>
                </div>
                
                {monthDetailData.length > 0 ? (
                    <div style={{ width: '100%', height: 500 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={monthDetailData}
                                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                                <XAxis type="number" hide />
                                <YAxis 
                                    type="category" 
                                    dataKey="name" 
                                    tick={{fill: isDark ? '#fff' : '#1E293B', fontSize: 12, fontWeight: 'bold'}} 
                                    width={120}
                                />
                                <Tooltip 
                                    wrapperStyle={{ pointerEvents: 'none' }}
                                    content={<CustomTooltip isDark={isDark} />} 
                                    cursor={{fill: isDark ? '#1E293B' : '#F1F5F9'}} 
                                />
                                <ReferenceLine x={0} stroke={isDark ? '#94A3B8' : '#64748B'} />
                                <Bar dataKey="value" barSize={30}>
                                    {monthDetailData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.color} 
                                            stroke={isDark ? '#0f172a' : '#fff'}
                                            strokeWidth={1}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[500px] flex items-center justify-center text-slate-500">
                        Aucune donnée pour ce mois.
                    </div>
                )}
             </>
        ) : (
            // --- VUE GÉNÉRALE ANNUELLE ---
            <>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Flux de Trésorerie Détaillé</h3>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Revenus en <span className="text-emerald-400 font-bold">Vert</span> / Dépenses en <span className="text-rose-400 font-bold">Rouge</span>
                        </p>
                    </div>
                </div>
                
                {chartData.length > 0 ? (
                    <div style={{ width: '100%', height: 450 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDark ? '#94A3B8' : '#64748B'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: isDark ? '#94A3B8' : '#64748B'}} />
                            <Tooltip 
                                wrapperStyle={{ pointerEvents: 'none' }}
                                content={<CustomTooltip isDark={isDark} />} 
                                cursor={{fill: isDark ? '#1E293B' : '#F1F5F9'}} 
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            
                            {/* Barres pour les Loyers (séparées pour la distinction visuelle) */}
                            {maxRentCount > 0 && Array.from({ length: maxRentCount }).map((_, i) => (
                                <Bar 
                                key={`inc-${Category.RENT}-${i}`}
                                dataKey={`inc_${Category.RENT}_${i}`}
                                name={Category.RENT}
                                stackId="a"
                                fill={NEON_COLORS[Category.RENT]}
                                stroke={isDark ? '#0f172a' : '#fff'}
                                strokeWidth={1}
                                legendType={i === 0 ? 'rect' : 'none'}
                                maxBarSize={50}
                                radius={(incomeCategories.length === 0 && i === maxRentCount - 1) ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                                />
                            ))}

                            {/* Stacked Bars for Other Income */}
                            {incomeCategories.map((cat, index) => (
                                <Bar 
                                key={`inc-${cat}`}
                                dataKey={`inc_${cat}`}
                                name={cat}
                                stackId="a"
                                fill={NEON_COLORS[cat] || '#34D399'}
                                radius={index === incomeCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                maxBarSize={50}
                                stroke={isDark ? '#0f172a' : '#fff'}
                                strokeWidth={1}
                                />
                            ))}

                            {/* Stacked Bars for Expense */}
                            {expenseCategories.map((cat, index) => (
                                <Bar 
                                key={`exp-${cat}`}
                                dataKey={`exp_${cat}`}
                                name={cat}
                                stackId="b"
                                fill={NEON_COLORS[cat] || '#F43F5E'}
                                radius={index === expenseCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                maxBarSize={50}
                                stroke={isDark ? '#0f172a' : '#fff'}
                                strokeWidth={1}
                                />
                            ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[450px] flex items-center justify-center text-slate-500">
                        Aucune transaction à afficher pour cette période.
                    </div>
                )}

                {/* ZONE DE BOUTONS POUR LE DRILL-DOWN */}
                <div className="mt-8 pt-6 border-t border-slate-700/50">
                    <p className={`text-sm font-bold mb-4 flex items-center ${isDark ? 'text-pink-400' : 'text-slate-600'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Détails Mensuels (Cliquez pour voir le détail) :
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {chartData.map((data: any) => (
                            <button
                                key={data.key}
                                onClick={() => setDrillDownMonth({ key: data.key, label: data.fullDate })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                    isDark 
                                    ? 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-pink-500 hover:text-white hover:shadow-[0_0_10px_rgba(236,72,153,0.5)]' 
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                                }`}
                            >
                                {data.name}
                            </button>
                        ))}
                    </div>
                </div>
            </>
        )}
      </NeonCard>

      {/* Recent Transactions Snippet */}
      <NeonCard className="overflow-hidden p-0" isDark={isDark}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Dernières Transactions</h3>
          <button onClick={() => navigate('/transactions')} className="text-pink-500 hover:text-pink-400 text-sm font-medium">
            Voir tout &rarr;
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase font-medium ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Catégorie</th>
                <th className="px-6 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-600'}`}>
              {transactions.slice(0, 5).map((t) => (
                <tr key={t.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-3 whitespace-nowrap">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                  <td className={`px-6 py-3 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.description}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {t.category}
                    </span>
                  </td>
                  <td className={`px-6 py-3 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeonCard>
    </div>
  );
};

export default Dashboard;