
import React from 'react';
import { SettingsGearIcon } from './icons';

interface HeaderProps {
    onOpenVault: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenVault }) => (
    <header className="p-4 border-b border-white/[0.03] bg-black/60 backdrop-blur-2xl sticky top-0 z-[60]">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center space-x-5">
                <div className="group relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl group-hover:bg-indigo-500/40 transition-all duration-500 rounded-full"></div>
                    <div className="relative w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 transform group-hover:rotate-6 transition-transform">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                    </div>
                </div>
                <div>
                    <h1 className="text-xl font-black text-white tracking-tight flex items-center leading-none">
                        STOCKMETA <span className="text-indigo-500 ml-1.5 opacity-80">PRO</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em]">
                            Neural Metadata Engine
                        </p>
                        <div className="h-1 w-1 bg-slate-700 rounded-full"></div>
                        <span className="text-[9px] text-slate-400 font-bold">v3.3.5 Premium</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <button 
                    onClick={onOpenVault}
                    className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-xl text-[11px] font-black text-slate-300 uppercase tracking-widest transition-all active:scale-95 group"
                >
                    <SettingsGearIcon className="w-4 h-4 text-indigo-400 group-hover:rotate-45 transition-transform" />
                    <span className="hidden sm:inline">Manage API Keys</span>
                </button>
                <div className="relative flex items-center justify-center w-8 h-8">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full animate-pulse"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-black/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                </div>
            </div>
        </div>
    </header>
);
