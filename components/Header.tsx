
import React from 'react';

export const Header: React.FC = () => (
    <header className="p-5 border-b border-gray-700 bg-gray-800/50">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
            <span className="bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">StockMeta</span>
            <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">Pro</span>
        </h1>
        <p className="text-xs text-gray-500 mt-1">
            AI-Powered Bulk Metadata Generator
        </p>
    </header>
);
