
import React from 'react';
import { Settings, LogOut, LogIn, Lock, Globe, ShieldCheck } from 'lucide-react';
import { ViewStateOrString, NavItem, ViewState } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  currentView: ViewStateOrString;
  navItems: NavItem[];
  onNavigate: (view: ViewStateOrString) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  onLogout: () => void;
  onLoginRequest: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  navItems,
  onNavigate, 
  isAuthenticated,
  isAdmin = false,
  onLogout, 
  onLoginRequest 
}) => {
  const { t, language, toggleLanguage } = useLanguage();
  
  // Group items by 'group' property or 'Main'
  const groupedItems = navItems.reduce((acc, item) => {
    const group = item.group || 'Main';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  // Define group order to ensure Main is first, Creator Studio is last of specific groups
  const groupOrder = ['Main', ...Object.keys(groupedItems).filter(k => k !== 'Main' && k !== 'Creator Studio'), 'Creator Studio'];

  return (
    <nav aria-label="Primary navigation" className="hidden md:flex flex-col w-20 lg:w-64 bg-zinc-900 border-r border-zinc-800 h-full fixed left-0 top-0 z-50 transition-all duration-300">
      <div className="p-6 flex items-center justify-center lg:justify-start gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-red-900/30">
          T
        </div>
        <span className="hidden lg:block text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
          Tube TV
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4">
        {groupOrder.map((group) => {
           const items = groupedItems[group];
           if (!items) return null;

           return (
            <div key={group} className={`mb-6 ${group === 'Creator Studio' ? 'border-t border-zinc-800 pt-4' : ''}`}>
                {group !== 'Main' && (
                    <h3 className="hidden lg:block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-2">
                        {group}
                    </h3>
                )}
                <div className="space-y-1">
                    {items.map((item) => {
                        const isActive = currentView === item.id;
                        const isLocked = item.restricted && !isAuthenticated;
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative
                                    ${isActive 
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
                                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                    }`}
                                title={item.label}
                            >
                                <div className="relative">
                                    {Icon && <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`} />}
                                    {isLocked && (
                                        <div className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-0.5 border border-zinc-700">
                                            <Lock size={10} className="text-zinc-500" />
                                        </div>
                                    )}
                                </div>
                                <span className="hidden lg:block font-medium truncate">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
           );
        })}
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-2 mt-auto bg-zinc-900 z-10">
        <button 
            onClick={toggleLanguage}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
        >
            <Globe className={`w-6 h-6 ${language === 'sw' ? 'text-red-500' : ''}`} />
            <span className="hidden lg:block font-medium">
                {language === 'en' ? 'Kiswahili' : 'English'}
            </span>
        </button>

        {isAdmin && (
          <button 
              onClick={() => onNavigate(ViewState.ADMIN)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors
                  ${currentView === ViewState.ADMIN
                    ? 'bg-red-600 text-white' 
                    : 'text-amber-400 hover:text-white hover:bg-zinc-800'
                  }`}
          >
              <ShieldCheck className="w-6 h-6" />
              <span className="hidden lg:block font-medium">Admin Panel</span>
          </button>
        )}

        {isAuthenticated && (
          <button 
              onClick={() => onNavigate(ViewState.SETTINGS)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors
                  ${currentView === ViewState.SETTINGS 
                    ? 'bg-zinc-800 text-white' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
          >
              <Settings className="w-6 h-6" />
              <span className="hidden lg:block font-medium">{t('nav.settings')}</span>
          </button>
        )}
        
        {isAuthenticated ? (
            <button 
                onClick={onLogout}
                className="w-full flex items-center gap-4 p-3 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded-xl transition-colors"
            >
                <LogOut className="w-6 h-6" />
                <span className="hidden lg:block font-medium">{t('nav.logout')}</span>
            </button>
        ) : (
             <button 
                onClick={onLoginRequest}
                className="w-full flex items-center gap-4 p-3 text-zinc-400 hover:text-green-500 hover:bg-zinc-800 rounded-xl transition-colors"
            >
                <LogIn className="w-6 h-6" />
                <span className="hidden lg:block font-medium">{t('nav.login')}</span>
            </button>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;
