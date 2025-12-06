import React, { useState } from 'react';
import { useFinance } from './FinanceContext';
import { analyzeFinancials } from '../services/geminiService';

interface AIAdvisorProps {
  isDark: boolean;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ isDark }) => {
  const { transactions } = useFinance();
  const [analysis, setAnalysis] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeFinancials(transactions);
      if (result) {
        setAnalysis(result);
      } else {
        setError("Aucune réponse reçue du conseiller.");
      }
    } catch (e) {
      setError("Une erreur est survenue lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Conseiller IA</h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Obtenez des conseils personnalisés pour votre gestion</p>
        </div>
      </div>

      <div className={`rounded-xl p-8 shadow-lg bg-gradient-to-r ${isDark ? 'from-indigo-900 to-purple-900 border-2 border-pink-500' : 'from-indigo-500 to-purple-600 text-white'}`}>
        <div className="flex items-start space-x-6">
          <div className="hidden sm:block p-4 bg-white bg-opacity-20 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-white'}`}>Analyse Intelligente Gemini</h2>
            <p className={`mb-6 max-w-2xl ${isDark ? 'text-slate-300' : 'text-indigo-100'}`}>
              Laissez notre intelligence artificielle analyser vos transactions pour détecter des tendances, 
              optimiser vos dépenses et maximiser vos profits locatifs.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={`px-6 py-3 font-bold rounded-lg shadow-md transition-all flex items-center ${
                isDark 
                  ? 'bg-pink-600 text-white hover:bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' 
                  : 'bg-white text-indigo-600 hover:bg-indigo-50'
              } ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${isDark ? 'text-white' : 'text-indigo-600'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyse en cours...
                </>
              ) : (
                <>Lancer l'analyse</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-900/20 border-l-4 border-rose-500 p-4 rounded-r-lg">
          <p className="text-rose-500">{error}</p>
        </div>
      )}

      {analysis && (
        <div className={`rounded-xl border-2 transition-all duration-300 animate-fade-in ${
           isDark ? 'bg-slate-800 border-green-400 hover:border-pink-500 shadow-[0_0_15px_rgba(74,222,128,0.2)]' : 'bg-white border-slate-100'
        }`}>
          <div className={`px-6 py-4 border-b flex items-center ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mr-2 ${isDark ? 'text-green-400' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-indigo-900'}`}>{analysis.title}</h3>
          </div>
          <div className="p-6">
             <div className={`prose max-w-none whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
               {analysis.content}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAdvisor;