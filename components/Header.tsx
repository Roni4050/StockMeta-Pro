
import React from 'react';

export const Header: React.FC = () => (
    <header className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-teal-400 bg-clip-text text-transparent filter drop-shadow-sm">StockMeta</span>
                    <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shadow-[0_0_10px_-3px_rgba(99,102,241,0.3)]">Pro</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-medium tracking-wide">
                    Intelligent Metadata Automation
                </p>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.3)] animate-pulse"></div>
        </div>
    </header>
);
