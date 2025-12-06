import React, { useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Category, TransactionType } from '../types';

interface AnalyticsProps {
  isDark: boolean;
}

interface NeonContainerProps {
  children?: React.ReactNode;
  title: string;
  isDark: boolean;
}

const NeonContainer: React.FC<NeonContainerProps> = ({ children, title, isDark }) => (
   <div className={`p-6 rounded-xl border-2 transition-all duration-300 h-[700px] flex flex-col ${isDark 
    ? 'bg-slate-800 border-green-400 hover:border-pink-500 hover:shadow-[0_0_15px_rgba(236,72,153,0.5)]' 
    : 'bg-white border-slate-100'}`}>
      <h3 className={`text-lg font-bold mb-4 text-center ${isDark ? 'text-white' : 'text-slate-700'}`}>{title}</h3>
      <div className="flex-1 w-full min-h-0 relative">
        {children}
      </div>
   </div>
);

// Mapping des couleurs principales
const BASE_COLORS: { [key: string]: string } = {
  [Category.RENT]: '#34D399', // Emerald
  [Category.CLEANING_FEE]: '#F472B6', // Pink
  [Category.MAINTENANCE]: '#F87171', // Red
  [Category.UTILITIES]: '#60A5FA', // Blue
  [Category.TAXES]: '#A78BFA', // Violet
  [Category.SUPPLIES]: '#FBBF24', // Amber
  [Category.MARKETING]: '#2DD4BF', // Teal
  [Category.INVESTMENT]: '#22D3EE', // Cyan
  [Category.OTHER]: '#9CA3AF', // Gray
};

// Fonction pour assombrir/éclaircir hex
function adjustColor(color: string, amount: number) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

const Analytics: React.FC<AnalyticsProps> = ({ isDark }) => {
  const { transactions, globalYear, setGlobalYear } = useFinance();

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years = ['ALL'];
    for (let i = 0; i < 5; i++) {
      years.push((currentYear + i).toString());
    }
    return years;
  }, [currentYear]);

  // 1. Filter Transactions based on Year
  const filteredTransactions = useMemo(() => {
    if (globalYear === 'ALL') return transactions;
    return transactions.filter(t => new Date(t.date).getFullYear().toString() === globalYear);
  }, [transactions, globalYear]);

  // 2. Calculate Totals based on Filtered Data
  const { totalIncome, totalExpense } = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { totalIncome: income, totalExpense: expense };
  }, [filteredTransactions]);

  // 3. Prepare Chart Data
  const chartData = useMemo(() => {
    const groupedData: { [key: string]: { amount: number; color: string; category: string } } = {};

    filteredTransactions.forEach(t => {
      let key = t.category;
      let color = BASE_COLORS[t.category as string] || '#9CA3AF';

      // Logique de sous-catégorisation visuelle
      if (t.category === Category.UTILITIES || t.category === Category.TAXES) {
        let subKey = t.description;
        
        // Normalisation simple pour regrouper les descriptions similaires
        const descLower = t.description.toLowerCase();
        if (t.category === Category.UTILITIES) {
            if (descLower.includes('eau')) subKey = 'Eau';
            else if (descLower.includes('élect')) subKey = 'Électricité';
            else if (descLower.includes('gaz')) subKey = 'Gaz';
            else if (descLower.includes('box') || descLower.includes('internet')) subKey = 'Box/Internet';
            else if (descLower.includes('assurance')) subKey = 'Assurance';
        } else if (t.category === Category.TAXES) {
            if (descLower.includes('foncier')) subKey = 'Impôt Foncier';
            else if (descLower.includes('habitation')) subKey = 'Taxe Habitation';
            else if (descLower.includes('airbnb')) subKey = 'Taxe AirBnB';
        }

        // Clean up key name for display
        key = `${t.category} - ${subKey}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = { amount: 0, color: color, category: t.category as string };
      }
      groupedData[key].amount += t.amount;
    });

    const result = Object.entries(groupedData).map(([name, data]) => ({
      name,
      value: data.amount,
      color: data.color,
      category: data.category
    }));

    // Variation légère de couleur si même catégorie
    const categoryCounts: {[key: string]: number} = {};
    result.forEach(r => { categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1; });
    const categoryIndices: {[key: string]: number} = {};

    return result.map(item => {
      if (categoryCounts[item.category] > 1) {
        const idx = categoryIndices[item.category] || 0;
        categoryIndices[item.category] = idx + 1;
        // Alterne légèrement la teinte pour distinguer les sous-catégories
        const adjustment = (idx % 2 === 0 ? -20 : 20) * (Math.floor(idx/2) + 1);
        return { ...item, color: adjustColor(item.color, adjustment) };
      }
      return item;
    }).sort((a, b) => b.value - a.value); 

  }, [filteredTransactions]);

  const totalVolume = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  // Étiquettes externes pour la lisibilité
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }: any) => {
    // Afficher tout ce qui est supérieur à 0.5%
    if (percent < 0.005) return null;

    const RADIAN = Math.PI / 180;
    // Pousser le label bien plus loin que le rayon extérieur
    const radius = outerRadius * 1.2; 
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    // Nettoyer le nom pour l'affichage
    let displayName = name;
    if (name.includes(' - ')) {
        displayName = name.split(' - ')[1];
    } else if (name === Category.RENT) {
        displayName = "Loyer";
    }

    return (
      <text 
        x={x} 
        y={y} 
        fill={isDark ? "#e2e8f0" : "#334155"} 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central" 
        fontSize="11"
        fontWeight="bold"
      >
        {`${displayName}`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = totalVolume > 0 ? (data.value / totalVolume) * 100 : 0;
      
      const parts = data.name.split(' - ');
      const mainCat = parts[0];
      const subCat = parts.length > 1 ? parts[1] : null;

      return (
        <div className={`p-4 rounded-xl border shadow-xl z-50 ${
            isDark ? 'bg-slate-900 border-green-400 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="mb-2 border-b border-slate-600 pb-2">
            <p className="font-bold text-lg" style={{ color: data.color }}>{mainCat}</p>
            {subCat && <p className="text-sm opacity-80 italic">{subCat}</p>}
          </div>
          
          <div className="space-y-1 text-sm">
             <div className="flex justify-between gap-4">
                <span>Montant:</span>
                <span className="font-bold">{data.value.toLocaleString('fr-FR', {style:'currency', currency:'EUR'})}</span>
             </div>
             <div className="flex justify-between gap-4">
                <span>Part du volume:</span>
                <span className="font-bold text-pink-400">{percent.toFixed(1)}%</span>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Analyses Graphiques</h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Répartition détaillée des flux financiers</p>
        </div>

        {/* Year Selection Buttons */}
        <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="w-full">
        <NeonContainer title={`Répartition du Volume Financier (${globalYear === 'ALL' ? 'Global' : globalYear})`} isDark={isDark}>
            <div className="flex flex-col h-full">
                
                {/* Section Graphique */}
                <div className="flex-1 min-h-0 relative">
                    {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={renderCustomLabel}
                            innerRadius={100} 
                            outerRadius={140}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#1e293b' : '#fff'} strokeWidth={1} />
                            ))}
                        </Pie>
                        <Tooltip 
                            wrapperStyle={{ pointerEvents: 'none' }}
                            content={<CustomTooltip />} 
                        />
                        {/* Texte Central */}
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-current">
                            <tspan x="50%" dy="-1.2em" fontSize="12" fill={isDark ? '#94A3B8' : '#64748B'}>VOLUME TOTAL</tspan>
                            <tspan x="50%" dy="1.6em" fontSize="18" fontWeight="bold" fill={isDark ? '#fff' : '#1E293B'}>
                                {totalVolume.toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits: 0})}
                            </tspan>
                        </text>
                        </PieChart>
                    </ResponsiveContainer>
                    ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Pas de données disponibles pour cette période.
                    </div>
                    )}
                </div>

                {/* Section Résumé Financier (En bas de la carte) */}
                <div className={`mt-4 p-4 rounded-lg border flex flex-col sm:flex-row justify-around items-center gap-4 ${
                    isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                    <div className="text-center">
                        <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Revenus</p>
                        <p className="text-xl font-bold text-emerald-400">
                            {totalIncome.toLocaleString('fr-FR', {style:'currency', currency:'EUR'})}
                        </p>
                    </div>
                    
                    <div className={`hidden sm:block w-px h-10 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>

                    <div className="text-center">
                        <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Dépenses</p>
                        <p className="text-xl font-bold text-rose-400">
                            {totalExpense.toLocaleString('fr-FR', {style:'currency', currency:'EUR'})}
                        </p>
                    </div>

                     <div className={`hidden sm:block w-px h-10 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>

                    <div className="text-center">
                        <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Résultat Net</p>
                        <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-indigo-400' : 'text-orange-400'}`}>
                            {(totalIncome - totalExpense).toLocaleString('fr-FR', {style:'currency', currency:'EUR'})}
                        </p>
                    </div>
                </div>

            </div>
        </NeonContainer>
      </div>
    </div>
  );
};

export default Analytics;