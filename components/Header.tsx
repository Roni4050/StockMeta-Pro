
import React from 'react';

export const Header: React.FC = () => (
    <header className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center space-x-3">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-gradient-x bg-300%">StockMeta</span>
                    <span className="bg-white/5 border border-white/10 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] backdrop-blur-md">Pro</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">
                    AI-Powered Metadata Automation
                </p>
            </div>
            <div className="relative">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.5)] animate-pulse"></div>
                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            </div>
        </div>
    </header>
);
