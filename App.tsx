import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FinanceProvider } from './components/FinanceContext';
import Dashboard from './components/Dashboard';
import TransactionManager from './components/TransactionManager';
import Analytics from './components/Analytics';
import AIAdvisor from './components/AIAdvisor';

const SidebarLink = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to === '/' && location.pathname === '');
  
  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 border-l-4 ${
        isActive 
          ? 'bg-slate-800 border-pink-500 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.3)]' 
          : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-green-400 hover:border-green-400'
      }`}
    >
      <div className={`${isActive ? 'text-pink-400' : 'text-slate-500 group-hover:text-green-400'}`}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const Layout: React.FC<{ children: React.ReactNode; toggleTheme: () => void; isDark: boolean }> = ({ children, toggleTheme, isDark }) => {
  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Sidebar */}
        <aside className={`w-full md:w-64 border-r md:h-screen sticky top-0 flex-shrink-0 transition-colors duration-300 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                {/* Icône Maison stylisée */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>LocaCool</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-2">
            <SidebarLink 
              to="/" 
              label="Tableau de Bord" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
            />
            <SidebarLink 
              to="/transactions" 
              label="Transactions" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <SidebarLink 
              to="/analytics" 
              label="Analyses" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
            />
            <SidebarLink 
              to="/advisor" 
              label="Conseiller IA" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
            />
          </nav>

          <div className={`absolute bottom-0 w-full p-4 border-t ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-white'}`}>
            <div className="flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg">U</div>
                 <div className="text-sm">
                   <p className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Propriétaire</p>
                 </div>
               </div>
               <button 
                onClick={toggleTheme}
                className={`p-2 rounded-full ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
               >
                 {isDark ? (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd" /></svg>
                 ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
                 )}
               </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <FinanceProvider>
      <Router>
        <Layout toggleTheme={toggleTheme} isDark={isDark}>
          <Routes>
            <Route path="/" element={<Dashboard isDark={isDark} />} />
            <Route path="/transactions" element={<TransactionManager isDark={isDark} />} />
            <Route path="/analytics" element={<Analytics isDark={isDark} />} />
            <Route path="/advisor" element={<AIAdvisor isDark={isDark} />} />
          </Routes>
        </Layout>
      </Router>
    </FinanceProvider>
  );
};

export default App;