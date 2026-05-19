
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
    <div className="hidden md:flex flex-col w-20 lg:w-64 bg-zinc-900 border-r border-zinc-800 h-full fixed left-0 top-0 z-50 transition-all duration-300">
      <div className="p-6 flex items-center justify-center lg:justify-start gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-red-900/30">
          T
        </div>
        <span className="hidden lg:block text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
          Tube TV
        </span>
      </div>

      {/* Scroll area — min-h-0 is required for overflow-y:auto to work in a flex child */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* Fading gradient at the bottom hints at scrollability */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-zinc-900 to-transparent z-10" />

        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3">
          {groupOrder.map((group) => {
             const items = groupedItems[group];
             if (!items) return null;

             return (
              <div key={group} className={`mb-4 ${group === 'Creator Studio' ? 'border-t border-zinc-800 pt-3' : ''}`}>
                  {group !== 'Main' && (
                      <h3 className="hidden lg:block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 px-2">
                          {group}
                      </h3>
                  )}
                  <div className="space-y-0.5">
                      {items.map((item) => {
                          const isActive = currentView === item.id;
                          const isLocked = item.restricted && !isAuthenticated;
                          const Icon = item.icon;

                          return (
                              <button
                                  key={item.id}
                                  onClick={() => onNavigate(item.id)}
                                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative
                                      ${isActive
                                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                      }`}
                                  title={item.label}
                              >
                                  <div className="relative flex-shrink-0">
                                      {Icon && <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`} />}
                                      {isLocked && (
                                          <div className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-0.5 border border-zinc-700">
                                              <Lock size={9} className="text-zinc-500" />
                                          </div>
                                      )}
                                  </div>
                                  <span className="hidden lg:block font-medium text-sm truncate">{item.label}</span>
                              </button>
                          );
                      })}
                  </div>
              </div>
             );
          })}
        </div>
      </div>

      <div className="p-3 border-t border-zinc-800 space-y-0.5 bg-zinc-900 z-10">
        <button
            onClick={toggleLanguage}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
        >
            <Globe className={`w-5 h-5 flex-shrink-0 ${language === 'sw' ? 'text-red-500' : ''}`} />
            <span className="hidden lg:block font-medium text-sm">
                {language === 'en' ? 'Kiswahili' : 'English'}
            </span>
        </button>

        {isAdmin && (
          <button
              onClick={() => onNavigate(ViewState.ADMIN)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors
                  ${currentView === ViewState.ADMIN
                    ? 'bg-red-600 text-white'
                    : 'text-amber-400 hover:text-white hover:bg-zinc-800'
                  }`}
          >
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block font-medium text-sm">Admin Panel</span>
          </button>
        )}

        {isAuthenticated && (
          <button
              onClick={() => onNavigate(ViewState.SETTINGS)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors
                  ${currentView === ViewState.SETTINGS
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
          >
              <Settings className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block font-medium text-sm">{t('nav.settings')}</span>
          </button>
        )}

        {isAuthenticated ? (
            <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded-xl transition-colors"
            >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block font-medium text-sm">{t('nav.logout')}</span>
            </button>
        ) : (
            <button
                onClick={onLoginRequest}
                className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-green-500 hover:bg-zinc-800 rounded-xl transition-colors"
            >
                <LogIn className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block font-medium text-sm">{t('nav.login')}</span>
            </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
