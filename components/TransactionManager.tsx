import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from './FinanceContext';
import { TransactionType, Category, Transaction } from '../types';
import { useLocation } from 'react-router-dom';

interface TransactionManagerProps {
  isDark: boolean;
}

const MONTHS = [
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
];

// Helper pour gérer les dates sans soucis de fuseau horaire (YYYY-MM-DD)
const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const getDatesRange = (startDate: string, nights: number) => {
  const dates = [];
  let currentDate = new Date(startDate);
  for (let i = 0; i < nights; i++) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

// Calculate nights between two dates (inclusive of start, exclusive of end for hotel math, 
// but here we usually count nights. e.g. 1st to 3rd = 2 nights)
const calculateNights = (start: string, end: string) => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
};

const TransactionManager: React.FC<TransactionManagerProps> = ({ isDark }) => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, importTransactions, clearAllTransactions, globalYear, setGlobalYear } = useFinance();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Filter State
  const [filterMonth, setFilterMonth] = useState(''); // Stores "01", "02", etc.
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  // States are strings to allow better input handling (comma vs dot)
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<Category | string>(Category.MAINTENANCE);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [repeatCount, setRepeatCount] = useState<number>(1);

  // Calendar Selection State
  const [calendarViewDate, setCalendarViewDate] = useState(new Date()); // To navigate months without changing form data
  const [selectionStep, setSelectionStep] = useState<'none' | 'start_selected'>('none');
  const [tempStartDate, setTempStartDate] = useState<string | null>(null);

  // Delete Confirmation State inside Modal
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  // Specific Rental Fields
  const [nbAdults, setNbAdults] = useState(2);
  const [nbChildren, setNbChildren] = useState(0);
  const [nbNights, setNbNights] = useState(2);
  
  // Configurable Rates and Costs for Rent Calculation (Stored as strings for input flexibility)
  const [feeRate, setFeeRate] = useState<string>('3');
  const [taxRate, setTaxRate] = useState<string>('17.2');
  const [waterCostPerNight, setWaterCostPerNight] = useState<string>('2');
  const [electricityCostPerNight, setElectricityCostPerNight] = useState<string>('3.5');

  // --- INPUT HELPER FOR DECIMAL VALUES ---
  const handleDecimalChange = (value: string, setter: (val: string) => void) => {
    // Replace comma with dot for JS compatibility
    let normalized = value.replace(',', '.');
    
    // Allow empty, or regex for number (allows "12." while typing)
    if (normalized === '' || /^-?\d*\.?\d*$/.test(normalized)) {
        setter(normalized);
    }
  };

  const safeParseFloat = (val: string) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
  };

  // --- RENT CALCULATION LOGIC ---
  const isRentIncome = category === Category.RENT && type === TransactionType.INCOME;
  
  // Input "amount" is "Brut Nuitée" for Rents
  const nightlyGross = safeParseFloat(amount);
  const weeklyGross = nightlyGross * 7;
  const totalGrossForStay = isRentIncome ? nightlyGross * nbNights : nightlyGross; 
  
  const numFeeRate = safeParseFloat(feeRate);
  const numTaxRate = safeParseFloat(taxRate);
  const numWaterCost = safeParseFloat(waterCostPerNight);
  const numElecCost = safeParseFloat(electricityCostPerNight);

  // Deductions calculation (based on Total Gross of the stay)
  const totalFees = isRentIncome ? totalGrossForStay * (numFeeRate / 100) : 0;
  const totalTaxBase = isRentIncome ? totalGrossForStay * 0.5 : 0;
  const totalTaxes = isRentIncome ? totalTaxBase * (numTaxRate / 100) : 0;
  
  // Calcul des totaux charges basés sur le coût nuitée
  const totalWater = isRentIncome ? numWaterCost * nbNights : 0;
  const totalElectricity = isRentIncome ? numElecCost * nbNights : 0;
  
  // Net Calculations
  const totalDeductions = totalFees + totalTaxes + totalWater + totalElectricity;
  const finalNetToSave = isRentIncome ? totalGrossForStay - totalDeductions : totalGrossForStay;
  const netPerNight = isRentIncome && nbNights > 0 ? finalNetToSave / nbNights : 0;

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years = ['ALL'];
    for (let i = 0; i < 5; i++) {
      years.push((currentYear + i).toString());
    }
    return years;
  }, [currentYear]);

  // --- OCCUPANCY LOGIC ---
  
  // 1. Extract all booked dates from existing transactions
  const bookedDatesSet = useMemo(() => {
    const set = new Set<string>();
    
    transactions.forEach(t => {
      // Skip the transaction currently being edited
      if (editingId && t.id === editingId) return;

      if (t.type === TransactionType.INCOME && t.category === Category.RENT) {
        // Parse nights from description
        const guestMatch = t.description.match(/Séjour - .*\((\d+) nuits\)/);
        const nights = guestMatch ? parseInt(guestMatch[1]) : 1;
        const dates = getDatesRange(t.date, nights);
        dates.forEach(d => set.add(d));
      }
    });
    return set;
  }, [transactions, editingId]);

  // 2. Calculate current selection range
  const selectionDates = useMemo(() => {
    if (!isRentIncome) return [];
    
    // If we are in the middle of selecting visually
    if (selectionStep === 'start_selected' && tempStartDate) {
        return [tempStartDate]; 
    }
    
    // Otherwise show current form state
    return getDatesRange(date, nbNights);
  }, [date, nbNights, isRentIncome, selectionStep, tempStartDate]);

  // 3. Check Collision (Form state only)
  const hasCollision = useMemo(() => {
    if (!isRentIncome) return false;
    const currentFormRange = getDatesRange(date, nbNights);
    return currentFormRange.some(d => bookedDatesSet.has(d));
  }, [date, nbNights, bookedDatesSet, isRentIncome]);


  // Initialize filter from navigation state if present (Drilldown from Dashboard)
  useEffect(() => {
    if (location.state && location.state.filterMonth) {
      // Expecting format "YYYY-MM"
      const [y, m] = location.state.filterMonth.split('-');
      setGlobalYear(y);
      setFilterMonth(m);
    }
  }, [location.state, setGlobalYear]);

  // Update description automatically for RENT category
  useEffect(() => {
    if (category === Category.RENT) {
      setDescription(`Séjour - ${nbAdults} Adulte(s), ${nbChildren} Enfant(s) (${nbNights} nuits)`);
    }
  }, [category, nbAdults, nbChildren, nbNights]);

  // Sync Calendar View with Form Date when opening modal
  useEffect(() => {
    if (isOpen) {
        setCalendarViewDate(new Date(date));
    }
  }, [isOpen, date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRentIncome && hasCollision) {
        alert("Impossible d'enregistrer : La période sélectionnée chevauche une réservation existante.");
        return;
    }

    const baseDate = new Date(date);
    
    // Determine Final Amount and Description based on category
    let finalAmount = safeParseFloat(amount); // Default for non-rent
    let finalDescription = description;

    if (isRentIncome) {
        finalAmount = finalNetToSave;
        
        // Append Brut info, rates, and costs for record keeping
        // New Format saves costs PER NIGHT (Eau/Nuit, Elec/Nuit)
        let details = `[Brut Nuit: ${nightlyGross}€, Total Brut: ${totalGrossForStay.toFixed(2)}€, Frais: ${numFeeRate}%, Impôt: ${numTaxRate}%`;
        if (numWaterCost > 0) details += `, Eau/Nuit: ${numWaterCost}€`;
        if (numElecCost > 0) details += `, Elec/Nuit: ${numElecCost}€`;
        details += `]`;

        finalDescription = `${description} ${details}`;
    }

    if (editingId) {
      updateTransaction({
        id: editingId,
        amount: finalAmount,
        description: finalDescription,
        type,
        category,
        date: baseDate.toISOString().split('T')[0],
      });
    } else {
      for (let i = 0; i < repeatCount; i++) {
        const currentTransactionDate = new Date(baseDate);
        currentTransactionDate.setMonth(baseDate.getMonth() + i);
        
        const descSuffix = repeatCount > 1 ? ` (${i + 1}/${repeatCount})` : '';
        
        addTransaction({
          amount: finalAmount,
          description: finalDescription + descSuffix,
          type,
          category,
          date: currentTransactionDate.toISOString().split('T')[0],
        });
      }
    }

    setIsOpen(false);
    resetForm();
  };

  const handleFinalDelete = () => {
    if (editingId) {
      deleteTransaction(editingId);
      setIsOpen(false);
      resetForm();
    }
  };

  const handleClearAllConfirm = () => {
    clearAllTransactions();
    setShowClearConfirm(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setDescription('');
    setCategory(Category.MAINTENANCE);
    setType(TransactionType.EXPENSE);
    setDate(new Date().toISOString().split('T')[0]);
    setRepeatCount(1);
    setNbAdults(2);
    setNbChildren(0);
    setNbNights(2);
    setFeeRate('3');
    setTaxRate('17.2');
    setWaterCostPerNight('2');
    setElectricityCostPerNight('3.5');
    setIsDeleteConfirming(false);
    
    // Reset calendar state
    setSelectionStep('none');
    setTempStartDate(null);
  };

  const handleNewReservation = () => {
    resetForm();
    setType(TransactionType.INCOME);
    setCategory(Category.RENT);
    setIsOpen(true);
  };

  const parseRentDescription = (desc: string) => {
    // Extract guest details
    const guestMatch = desc.match(/Séjour - (\d+) Adulte\(s\), (\d+) Enfant\(s\) \((\d+) nuits\)/);
    const nights = guestMatch ? parseInt(guestMatch[3]) : 1;
    
    let parsedAmount = ''; // This will hold the "Brut Nuit" string
    let parsedFee = '3';
    let parsedTax = '17.2';
    let parsedWaterPerNight = '0';
    let parsedElecPerNight = '0';

    // Check for NEW format first: Brut Nuit
    const brutNuitMatch = desc.match(/Brut Nuit:\s*([0-9.]+)€/);
    if (brutNuitMatch) {
        parsedAmount = brutNuitMatch[1];
    } else {
        // Fallback to OLD format: Brut (Total)
        const totalBrutMatch = desc.match(/Brut:\s*([0-9.]+)€/);
        if (totalBrutMatch) {
            const total = parseFloat(totalBrutMatch[1]);
            parsedAmount = (total / nights).toFixed(2);
        }
    }

    const feeMatch = desc.match(/Frais:\s*([0-9.]+)%/);
    if (feeMatch) parsedFee = feeMatch[1];

    const taxMatch = desc.match(/Impôt:\s*([0-9.]+)%/);
    if (taxMatch) parsedTax = taxMatch[1];

    // Parsing Water
    const waterPerNightMatch = desc.match(/Eau\/Nuit:\s*([0-9.]+)€/);
    if (waterPerNightMatch) {
        parsedWaterPerNight = waterPerNightMatch[1];
    } else {
        // Fallback Old Format (Total Eau) -> Convert to per night
        const waterTotalMatch = desc.match(/Eau:\s*([0-9.]+)€/);
        if (waterTotalMatch) {
             parsedWaterPerNight = (parseFloat(waterTotalMatch[1]) / nights).toString();
        }
    }

    // Parsing Elec
    const elecPerNightMatch = desc.match(/Elec\/Nuit:\s*([0-9.]+)€/);
    if (elecPerNightMatch) {
        parsedElecPerNight = elecPerNightMatch[1];
    } else {
        // Fallback Old Format (Total Elec) -> Convert to per night
        const elecTotalMatch = desc.match(/Elec:\s*([0-9.]+)€/);
        if (elecTotalMatch) {
            parsedElecPerNight = (parseFloat(elecTotalMatch[1]) / nights).toString();
        }
    }
    
    return { parsedAmount, parsedFee, parsedTax, parsedWaterPerNight, parsedElecPerNight, guestMatch };
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setIsDeleteConfirming(false);
    
    let editAmount = transaction.amount.toString();
    
    setType(transaction.type);
    setCategory(transaction.category); 

    if (transaction.category === Category.RENT && transaction.type === TransactionType.INCOME) {
        const { parsedAmount, parsedFee, parsedTax, parsedWaterPerNight, parsedElecPerNight, guestMatch } = parseRentDescription(transaction.description);
        
        if (parsedAmount) {
            editAmount = parsedAmount;
            setFeeRate(parsedFee);
            setTaxRate(parsedTax);
            setWaterCostPerNight(parsedWaterPerNight);
            setElectricityCostPerNight(parsedElecPerNight);
        } else {
            editAmount = transaction.amount.toString();
            setFeeRate('3');
            setTaxRate('17.2');
            setWaterCostPerNight('0');
            setElectricityCostPerNight('0');
        }

        if (guestMatch) {
            setNbAdults(parseInt(guestMatch[1]));
            setNbChildren(parseInt(guestMatch[2]));
            setNbNights(parseInt(guestMatch[3]));
        }
    } else {
        setDescription(transaction.description);
        setWaterCostPerNight('0');
        setElectricityCostPerNight('0');
    }
    
    setAmount(editAmount);
    setDate(transaction.date);
    setRepeatCount(1);
    setIsOpen(true);
  };

  const handleDuplicate = (transaction: Transaction) => {
    setEditingId(null);
    setIsDeleteConfirming(false);
    
    let dupAmount = transaction.amount.toString();

    if (transaction.category === Category.RENT && transaction.type === TransactionType.INCOME) {
        const { parsedAmount, parsedFee, parsedTax, parsedWaterPerNight, parsedElecPerNight, guestMatch } = parseRentDescription(transaction.description);
        
        if (parsedAmount) {
            dupAmount = parsedAmount;
            setFeeRate(parsedFee);
            setTaxRate(parsedTax);
            setWaterCostPerNight(parsedWaterPerNight);
            setElectricityCostPerNight(parsedElecPerNight);
        } else {
            setFeeRate('3');
            setTaxRate('17.2');
            setWaterCostPerNight('0');
            setElectricityCostPerNight('0');
        }

        if (guestMatch) {
            setNbAdults(parseInt(guestMatch[1]));
            setNbChildren(parseInt(guestMatch[2]));
            setNbNights(parseInt(guestMatch[3]));
        }
    } else {
        setDescription(transaction.description);
        setWaterCostPerNight('0');
        setElectricityCostPerNight('0');
    }

    setAmount(dupAmount);
    setType(transaction.type);
    setCategory(transaction.category);
    setDate(transaction.date);
    setRepeatCount(1);
    setIsOpen(true);
  };

  // -----------------------------
  // Filter Logic
  // -----------------------------
  const filteredTransactions = transactions.filter(t => {
    // t.date format is YYYY-MM-DD. We extract MM.
    const tMonth = t.date.split('-')[1];
    
    const matchesMonth = filterMonth ? tMonth === filterMonth : true;
    const matchesCategory = filterCategory ? t.category === filterCategory : true;
    const matchesYear = globalYear === 'ALL' || t.date.startsWith(globalYear);
    return matchesMonth && matchesCategory && matchesYear;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // -----------------------------
  // Import / Export Logic
  // -----------------------------

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `locacool_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Description", "Catégorie", "Recettes (+)", "Dépenses (-)"];
    
    const rows = sortedTransactions.map(t => {
        const safeDesc = t.description.replace(/"/g, '""');
        const incomeAmount = t.type === TransactionType.INCOME ? t.amount.toString().replace('.', ',') : "";
        const expenseAmount = t.type === TransactionType.EXPENSE ? t.amount.toString().replace('.', ',') : "";

        return [
            t.date,
            `"${safeDesc}"`,
            t.category,
            incomeAmount,
            expenseAmount
        ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filenameLabel = filterMonth ? `_${filterMonth}` : (filterCategory ? `_${filterCategory}` : (globalYear !== 'ALL' ? `_${globalYear}` : '_complet'));
    link.download = `locacool_export${filenameLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const importedData = JSON.parse(result);
          if (Array.isArray(importedData)) {
             importTransactions(importedData);
             alert("Données restaurées avec succès !");
          } else {
              alert("Format de fichier invalide.");
          }
        }
      } catch (error) {
        console.error("Import error", error);
        alert("Erreur lors de la lecture du fichier.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAdultChange = (val: number) => {
    setNbAdults(val);
    if (val + nbChildren > 4) {
      setNbChildren(4 - val);
    }
  };

  const handleChildChange = (val: number) => {
    if (nbAdults + val <= 4) {
      setNbChildren(val);
    }
  };

  const handleChargePreset = (preset: string) => {
    setDescription(preset);
  };

  // -----------------------------
  // Calendar Interaction Handlers
  // -----------------------------
  const handleCalendarNav = (direction: -1 | 1) => {
    const newDate = new Date(calendarViewDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCalendarViewDate(newDate);
  };

  const handleDayClick = (dayStr: string, isBooked: boolean) => {
    // New Logic: Check overlap ONLY based on NIGHTS occupancy, not checkout day.
    
    if (selectionStep === 'none') {
        // Step 1: Select Start Date
        // Impossible to start ON a night that is already slept in.
        if (isBooked) {
             alert("Impossible de commencer le séjour : cette nuit est déjà réservée.");
             return; 
        }
        
        setTempStartDate(dayStr);
        setSelectionStep('start_selected');
    } else if (selectionStep === 'start_selected' && tempStartDate) {
        // Step 2: Select End Date (determine order)
        let start = tempStartDate;
        let end = dayStr;
        
        if (new Date(dayStr) < new Date(tempStartDate)) {
            start = dayStr;
            end = tempStartDate;
        }

        // Calculate nights (Start inclusive, End exclusive)
        const potentialNights = calculateNights(start, end);
        // Get the specific nights occupied by this new range
        const range = getDatesRange(start, potentialNights);
        
        // Check collision: Do any of the NIGHTS of the new stay overlap with existing NIGHTS?
        const collision = range.some(d => bookedDatesSet.has(d));

        if (collision) {
            alert("Sélection invalide : La période inclut des dates déjà réservées.");
            // Reset to step 1 to let user retry
            setSelectionStep('none');
            setTempStartDate(null);
            return;
        }

        // Valid Selection: Update Form
        setDate(start);
        // Minimum 1 night
        setNbNights(potentialNights === 0 ? 1 : potentialNights);
        
        setSelectionStep('none');
        setTempStartDate(null);
    }
  };

  // MINI CALENDAR RENDERER
  const renderMiniCalendar = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth(); // 0-indexed
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon
    // Adjust for Monday start
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const days = [];
    for (let i = 0; i < startOffset; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const monthName = calendarViewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return (
        <div className={`mt-4 p-3 rounded-lg border select-none ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center mb-2">
                <button 
                    type="button"
                    onClick={() => handleCalendarNav(-1)}
                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                >
                    &lt;
                </button>
                <div className="text-center font-bold text-sm capitalize">{monthName}</div>
                <button 
                    type="button"
                    onClick={() => handleCalendarNav(1)}
                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                >
                    &gt;
                </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['L','M','M','J','V','S','D'].map(d => <div key={d} className="opacity-50 font-semibold">{d}</div>)}
                {days.map((d, idx) => {
                    if (d === null) return <div key={idx}></div>;
                    
                    const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isBooked = bookedDatesSet.has(currentDayStr);
                    
                    // Visual Logic
                    let isSelected = false;
                    
                    if (selectionStep === 'none') {
                        // Show current form selection
                        isSelected = selectionDates.includes(currentDayStr);
                    } else if (selectionStep === 'start_selected' && tempStartDate) {
                        // Show temporary start point
                        if (currentDayStr === tempStartDate) isSelected = true;
                    }

                    const isConflict = isBooked && isSelected;

                    let bgClass = isDark ? 'bg-slate-800' : 'bg-white';
                    let textClass = '';
                    let cursorClass = 'cursor-pointer hover:opacity-80';
                    
                    if (isConflict) {
                        bgClass = 'bg-orange-500 text-white font-bold animate-pulse';
                    } else if (isBooked) {
                        bgClass = 'bg-red-500/80 text-white';
                        // Allow clicking booked days ONLY if we are selecting the End date (because checkout day can be a checkin day)
                        // Or if we are just viewing
                        if (selectionStep === 'none') {
                             cursorClass = 'cursor-not-allowed opacity-50';
                        } else {
                             // In selection mode, we might click a red square to finish the stay there
                             cursorClass = 'cursor-pointer hover:opacity-100 ring-2 ring-blue-400';
                        }
                    } else if (isSelected) {
                        bgClass = 'bg-emerald-500 text-white font-bold shadow-[0_0_5px_rgba(16,185,129,0.5)]';
                    } else {
                        // Hover effect for unselected days
                        bgClass = isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-slate-100';
                    }

                    return (
                        <div 
                            key={idx} 
                            onClick={() => handleDayClick(currentDayStr, isBooked)}
                            className={`p-1.5 rounded transition-all ${bgClass} ${textClass} ${cursorClass}`}
                        >
                            {d}
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-3 text-[10px] flex gap-2 justify-center opacity-70">
                <span className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Réservé</span>
                <span className="flex items-center"><span className="w-2 h-2 bg-emerald-500 rounded-full mr-1"></span>Sélection</span>
            </div>

            {hasCollision && (
                <div className="mt-2 text-xs text-orange-500 font-bold text-center">
                    ⚠️ Période chevauchante !
                </div>
            )}
            
            {selectionStep === 'start_selected' && (
                 <div className="mt-2 text-xs text-blue-400 font-bold text-center animate-pulse">
                    Sélectionnez la date de départ...
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Transactions</h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Gérez vos revenus et dépenses</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
           {/* Backup Button (JSON) */}
           <button 
            onClick={handleExportJSON}
            title="Sauvegarde technique complète (JSON)"
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center ${
              isDark 
              ? 'border-blue-400 text-blue-400 hover:bg-blue-900/30' 
              : 'border-blue-600 text-blue-600 hover:bg-blue-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Sauvegarder
          </button>

           <button 
            onClick={handleImportClick}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center ${
              isDark 
              ? 'border-yellow-400 text-yellow-400 hover:bg-yellow-900/30' 
              : 'border-yellow-600 text-yellow-600 hover:bg-yellow-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Restaurer
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
          />

          <button 
            onClick={() => setShowClearConfirm(true)}
            title="Tout Effacer"
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center ${
              isDark 
              ? 'border-red-500 text-red-500 hover:bg-red-900/30' 
              : 'border-red-600 text-red-600 hover:bg-red-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Tout Effacer
          </button>

          <div className="w-2 md:w-6"></div>

          <button 
            onClick={handleExportCSV}
            title="Exporter pour Excel (CSV)"
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center ${
              isDark 
              ? 'border-emerald-400 text-emerald-400 hover:bg-emerald-900/30' 
              : 'border-emerald-600 text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </button>

          <button 
            onClick={handleNewReservation}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-5 py-2 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.5)] flex items-center transition-all font-bold ml-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Nouvelle Réservation
          </button>

          <button 
            onClick={() => { resetForm(); setIsOpen(true); }}
            className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-5 py-2 rounded-lg shadow-[0_0_10px_rgba(236,72,153,0.5)] flex items-center transition-all font-bold ml-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Nouvelle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl border-2 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center ${isDark ? 'bg-slate-800 border-green-400 text-white' : 'bg-white border-slate-100 text-slate-800'}`}>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Année :</span>
          <select 
            value={globalYear}
            onChange={(e) => setGlobalYear(e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-pink-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {yearOptions.map(year => (
                <option key={year} value={year}>{year === 'ALL' ? 'Toutes' : year}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Mois :</span>
          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-pink-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="">Tous</option>
            {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Catégorie :</span>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-pink-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="">Toutes</option>
            {Object.values(Category).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {(filterMonth || filterCategory || globalYear !== 'ALL') && (
          <button 
            onClick={() => { setFilterMonth(''); setFilterCategory(''); setGlobalYear('ALL'); }}
            className="text-sm text-pink-500 hover:text-pink-400 underline ml-auto md:ml-0"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Confirm Clear All Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
            <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 border-2 animate-fade-in ${
                isDark ? 'bg-slate-900 border-red-500 text-white' : 'bg-white border-red-500 text-slate-800'
            }`}>
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-3 bg-red-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold">Êtes-vous sûr ?</h3>
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Cette action est <span className="font-bold text-red-500">irréversible</span>. Toutes les transactions seront effacées définitivement de ce navigateur.
                    </p>
                    <div className="flex w-full space-x-3 pt-2">
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            className={`flex-1 py-2 rounded-lg font-medium border ${
                                isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleClearAllConfirm}
                            className="flex-1 py-2 rounded-lg font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg"
                        >
                            Tout Effacer
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Modal / Form */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto border-2 ${
            isDark ? 'bg-slate-900 border-green-400 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <h2 className="text-xl font-bold mb-4 flex items-center">
              {editingId ? 'Modifier' : 'Ajouter'}
              <span className="ml-2 text-pink-500">Transaction</span>
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setType(TransactionType.INCOME)}
                  className={`flex-1 px-4 py-2 text-sm font-bold border rounded-l-lg transition-colors ${
                    type === TransactionType.INCOME 
                      ? 'bg-emerald-500 text-white border-emerald-500' 
                      : `${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`
                  }`}
                >
                  Revenu
                </button>
                <button
                  type="button"
                  onClick={() => setType(TransactionType.EXPENSE)}
                  className={`flex-1 px-4 py-2 text-sm font-bold border rounded-r-lg transition-colors ${
                    type === TransactionType.EXPENSE 
                      ? 'bg-rose-500 text-white border-rose-500' 
                      : `${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`
                  }`}
                >
                  Dépense
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Catégorie</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800'
                  }`}
                >
                  {Object.values(Category).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                    {isRentIncome ? "Montant Brut Nuitée (€)" : "Montant (€)"}
                </label>
                <input 
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  required
                  value={amount}
                  onChange={(e) => handleDecimalChange(e.target.value, setAmount)}
                  className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800'
                  }`}
                  placeholder="0.00"
                />
                 {isRentIncome && nightlyGross > 0 && (
                    <div className={`mt-1 text-xs px-2 py-1 rounded font-bold inline-block border ${
                        isDark ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    }`}>
                        Soit {weeklyGross.toFixed(2)} € / semaine
                    </div>
                )}
              </div>

              {/* RENT: NET CALCULATION DETAILS */}
              {isRentIncome && nightlyGross > 0 && (
                <div className={`p-3 rounded-lg border text-sm space-y-2 ${
                    isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-300'
                }`}>
                    <div className="flex justify-between items-center text-xs opacity-80 border-b border-slate-600/50 pb-2">
                        <span>Total Brut Séjour ({nbNights} nuits):</span>
                        <span className="font-bold">{totalGrossForStay.toFixed(2)} €</span>
                    </div>

                    {/* Paramètres Modifiables - Frais & Impôts */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="block text-xs font-medium text-rose-400 mb-1">Taux Frais (%)</label>
                            <input 
                                type="text"
                                inputMode="decimal"
                                value={feeRate}
                                onChange={(e) => handleDecimalChange(e.target.value, setFeeRate)}
                                className={`w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500 ${
                                    isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                                }`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-rose-400 mb-1">Taux Impôt (%)</label>
                            <input 
                                type="text"
                                inputMode="decimal"
                                value={taxRate}
                                onChange={(e) => handleDecimalChange(e.target.value, setTaxRate)}
                                className={`w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500 ${
                                    isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                                }`}
                            />
                            <span className="text-[10px] opacity-60 block mt-0.5">sur 50% du brut</span>
                        </div>
                    </div>

                    {/* Paramètres Modifiables - Eau & Électricité */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                         <div>
                            <label className="block text-xs font-medium text-blue-400 mb-1">Coût Eau/Nuit (€)</label>
                            <input 
                                type="text"
                                inputMode="decimal"
                                value={waterCostPerNight}
                                onChange={(e) => handleDecimalChange(e.target.value, setWaterCostPerNight)}
                                className={`w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500 ${
                                    isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                                }`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-yellow-400 mb-1">Coût Elec/Nuit (€)</label>
                            <input 
                                type="text"
                                inputMode="decimal"
                                value={electricityCostPerNight}
                                onChange={(e) => handleDecimalChange(e.target.value, setElectricityCostPerNight)}
                                className={`w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-pink-500 ${
                                    isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                                }`}
                            />
                        </div>
                    </div>

                    {/* Résultat Calcul */}
                    <div className="space-y-1 pt-2 border-t border-slate-600/50">
                        <div className="flex justify-between text-xs text-rose-400">
                            <span>- Total Frais:</span>
                            <span>{totalFees.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between text-xs text-rose-400">
                            <span>- Total Impôts:</span>
                            <span>{totalTaxes.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between text-xs text-rose-400">
                            <span>- Total Eau ({nbNights}n):</span>
                            <span>{totalWater.toFixed(2)} €</span>
                        </div>
                         <div className="flex justify-between text-xs text-rose-400">
                            <span>- Total Elec ({nbNights}n):</span>
                            <span>{totalElectricity.toFixed(2)} €</span>
                        </div>
                    </div>

                    {/* Net per Night Display */}
                    <div className={`flex justify-between font-bold pt-2 mt-2 border-t border-dashed ${
                        isDark ? 'border-slate-600 text-blue-400' : 'border-slate-300 text-blue-600'
                    }`}>
                        <span>Montant Net par Nuit:</span>
                        <span>{netPerNight.toFixed(2)} €</span>
                    </div>

                    {/* Final Net to Record */}
                    <div className={`flex justify-between font-bold pt-2 text-lg border-t ${
                        isDark ? 'border-slate-600 text-emerald-400' : 'border-slate-300 text-emerald-600'
                    }`}>
                        <span>Net Séjour à Enregistrer:</span>
                        <span>{finalNetToSave.toFixed(2)} €</span>
                    </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                {isRentIncome ? (
                    <div className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800 bg-slate-50'
                    }`}>
                       Du <span className="text-emerald-400">{new Date(date).toLocaleDateString('fr-FR')}</span> au <span className="text-emerald-400">{new Date(addDays(date, nbNights)).toLocaleDateString('fr-FR')}</span>
                    </div>
                ) : (
                    <input 
                    type="date" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800'
                    }`}
                    />
                )}
              </div>

              {/* Conditional Inputs for RENT */}
              {category === Category.RENT ? (
                <div className={`p-4 rounded-lg border space-y-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className="text-sm font-bold text-pink-500">Détails de la réservation</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Adultes (1-4)</label>
                      <select 
                        value={nbAdults}
                        onChange={(e) => handleAdultChange(parseInt(e.target.value))}
                        className={`w-full rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}
                      >
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Enfants (0-3)</label>
                      <select 
                        value={nbChildren}
                        onChange={(e) => handleChildChange(parseInt(e.target.value))}
                        className={`w-full rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}
                      >
                        {[0, 1, 2, 3].filter(n => nbAdults + n <= 4).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                       <label className="block text-xs font-medium mb-1">Nuits</label>
                       <input 
                         type="number"
                         readOnly
                         value={nbNights}
                         className={`w-full rounded-lg border px-2 py-1.5 text-sm font-bold opacity-80 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                       />
                       <p className="text-[10px] mt-1 opacity-60">Sélectionnez les dates sur le calendrier ci-dessous</p>
                    </div>
                  </div>
                  {/* MINI CALENDAR FOR AVAILABILITY CHECK & SELECTION */}
                  {renderMiniCalendar()}

                  <input type="hidden" value={description} />
                </div>
              ) : category === Category.UTILITIES ? (
                 <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {["Eau", "Électricité", "Assurance", "Box"].map((preset) => (
                         <button 
                            key={preset}
                            type="button" 
                            onClick={() => handleChargePreset(preset)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                isDark 
                                ? 'border-indigo-500 text-indigo-400 hover:bg-indigo-900' 
                                : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                            }`}
                          >
                            {preset}
                          </button>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800'
                      }`}
                      placeholder="Autre charge..."
                    />
                 </div>
              ) : category === Category.TAXES ? (
                 <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {["Impôt foncier", "Taxe Habitation", "AirBnB"].map((preset) => (
                         <button 
                            key={preset}
                            type="button" 
                            onClick={() => handleChargePreset(preset)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                isDark 
                                ? 'border-purple-500 text-purple-400 hover:bg-purple-900' 
                                : 'border-purple-300 text-purple-600 hover:bg-purple-50'
                            }`}
                          >
                            {preset}
                          </button>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800'
                      }`}
                      placeholder="Autre taxe..."
                    />
                 </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input 
                    type="text" 
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-300 text-slate-800'
                    }`}
                    placeholder="Ex: Réparation climatisation"
                  />
                </div>
              )}

              {!editingId && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-indigo-900/30 border-indigo-700' : 'bg-indigo-50 border-indigo-100'}`}>
                   <label className="block text-sm font-medium text-indigo-400 mb-1">Répétition</label>
                   <div className="flex items-center space-x-2">
                     <input 
                      type="number" 
                      min="1" 
                      max="60"
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                      className={`w-20 rounded-lg border px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-800 border-slate-600 text-white' : 'border-slate-300 text-slate-800'
                      }`}
                     />
                     <span className="text-sm text-indigo-500">mois</span>
                   </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2 text-sm font-medium border rounded-lg ${
                    isDark ? 'text-slate-300 border-slate-600 hover:bg-slate-800' : 'text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isRentIncome && hasCollision} 
                  className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-[0_0_10px_rgba(236,72,153,0.4)] ${
                    isRentIncome && hasCollision 
                    ? 'bg-slate-500 cursor-not-allowed' 
                    : 'bg-pink-600 hover:bg-pink-700'
                  }`}
                >
                  {editingId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>

              {/* DELETE BUTTON SECTION */}
              {editingId && (
                <div className={`mt-6 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    {!isDeleteConfirming ? (
                        <button
                            type="button"
                            onClick={() => setIsDeleteConfirming(true)}
                            className="w-full py-2 text-sm font-bold text-rose-500 border border-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                        >
                            Supprimer la transaction
                        </button>
                    ) : (
                        <div className="flex flex-col items-center space-y-3 animate-fade-in">
                            <p className="text-sm font-medium text-rose-500">Confirmer la suppression définitive ?</p>
                            <div className="flex space-x-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteConfirming(false)}
                                    className={`flex-1 py-2 text-sm font-medium border rounded-lg ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFinalDelete}
                                    className="flex-1 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-lg"
                                >
                                    Confirmer
                                </button>
                            </div>
                        </div>
                    )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
        isDark ? 'bg-slate-800 border-green-400 hover:border-pink-500 hover:shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'bg-white border-slate-100'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase font-medium ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4 text-right">Recettes (+)</th>
                <th className="px-6 py-4 text-right">Dépenses (-)</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700 text-slate-300' : 'divide-slate-100 text-slate-600'}`}>
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Aucune transaction trouvée pour ces critères.
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((t) => (
                  <tr key={t.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                    <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.description}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border 
                        ${t.type === TransactionType.INCOME 
                          ? (isDark ? 'bg-emerald-500/30 text-white border-emerald-500' : 'bg-emerald-100 text-emerald-800 border-emerald-200') 
                          : (isDark ? 'bg-pink-500/30 text-white border-pink-500' : 'bg-rose-100 text-rose-800 border-rose-200')}`}>
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                      {t.type === TransactionType.INCOME ? `${t.amount.toFixed(2)} €` : ''}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-rose-400">
                      {t.type === TransactionType.EXPENSE ? `${t.amount.toFixed(2)} €` : ''}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <button 
                          onClick={() => handleEdit(t)}
                          title="Éditer"
                          className={`hover:text-pink-500 transition-colors ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                           </svg>
                        </button>
                        <button 
                          onClick={() => handleDuplicate(t)}
                          title="Dupliquer"
                          className={`hover:text-pink-500 transition-colors ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionManager;