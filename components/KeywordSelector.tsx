import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon } from './icons';

interface KeywordSelectorProps {
    allKeywords: string[];
    selectedKeywords: string[];
    onChange: (newSelectedKeywords: string[]) => void;
    onAddKeyword: (keyword: string) => void;
    maxKeywords: number;
}

export const KeywordSelector: React.FC<KeywordSelectorProps> = ({ allKeywords, selectedKeywords, onChange, onAddKeyword, maxKeywords }) => {
    const [inputValue, setInputValue] = useState('');
    const [copied, setCopied] = useState(false);

    const selectedLowerSet = new Set(selectedKeywords.map(k => k.toLowerCase()));
    const atLimit = selectedKeywords.length >= maxKeywords;

    const handleKeywordToggle = (keyword: string) => {
        const lowerKey = keyword.toLowerCase();
        const isSelected = selectedLowerSet.has(lowerKey);
        
        if (isSelected) {
            onChange(selectedKeywords.filter(k => k.toLowerCase() !== lowerKey));
        } else if (!atLimit) {
            onChange([...selectedKeywords, keyword]);
        }
    };
    
    const handleAddCustomKeyword = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !selectedLowerSet.has(trimmed.toLowerCase()) && !atLimit) {
            onAddKeyword(trimmed);
            setInputValue('');
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomKeyword();
        }
    };

    const handleSelectTop = () => {
        const uniqueAll = Array.from(new Set(allKeywords));
        onChange(uniqueAll.slice(0, maxKeywords));
    };

    const handleCopyKeywords = () => {
        if (selectedKeywords.length === 0) return;
        navigator.clipboard.writeText(selectedKeywords.join(', ')).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-8">
            {/* CONTROL BAR */}
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                    <div className="bg-dark-950 border border-white/10 rounded-xl px-4 py-2 text-[12px] font-black text-brand-400 font-mono shadow-inner">
                        {selectedKeywords.length.toString().padStart(2, '0')}
                    </div>
                    <div className="flex bg-dark-950/50 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
                        <button
                            onClick={handleSelectTop}
                            className="px-5 py-2.5 hover:bg-white/[0.03] text-[10px] font-black text-slate-400 border-r border-white/5 transition-all uppercase tracking-widest"
                        >
                            Sync Top
                        </button>
                        <button
                            onClick={() => onChange([])}
                            className="px-5 py-2.5 hover:bg-rose-500/10 text-[10px] font-black text-rose-500 border-r border-white/5 transition-all uppercase tracking-widest"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleCopyKeywords}
                            className="px-5 py-2.5 hover:bg-brand-500/10 text-[10px] font-black text-slate-400 hover:text-brand-400 transition-all flex items-center gap-2.5 uppercase tracking-widest"
                        >
                            {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
                            Copy
                        </button>
                    </div>
                </div>

                <div className="text-[10px] font-black text-slate-600 bg-dark-950/50 px-4 py-2 rounded-xl border border-white/5 uppercase tracking-[0.2em]">
                    Active SEO Pool: {selectedKeywords.length} / {maxKeywords}
                </div>
            </div>

            {/* KEYWORD CHIPS CONTAINER */}
            <div className="flex flex-wrap gap-2.5 min-h-[140px] p-1 overflow-y-auto no-scrollbar max-h-[300px]">
                {allKeywords.length > 0 ? (
                    allKeywords.map(keyword => {
                        const isSelected = selectedLowerSet.has(keyword.toLowerCase());
                        const isDisabled = !isSelected && atLimit;
                        return (
                            <button
                                key={keyword}
                                onClick={() => handleKeywordToggle(keyword)}
                                disabled={isDisabled}
                                className={`px-5 py-2.5 text-[11px] font-bold rounded-2xl border transition-all duration-300 transform active:scale-95 ${
                                    isSelected 
                                        ? 'bg-brand-600 text-white border-brand-500 shadow-xl shadow-brand-600/20' 
                                        : 'bg-dark-950 text-slate-500 border-white/5 hover:border-brand-500/30 hover:text-slate-300'
                                } ${isDisabled ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                            >
                                {keyword.toLowerCase()}
                            </button>
                        );
                    })
                ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center text-slate-700 italic text-[12px] border-2 border-dashed border-white/5 rounded-3xl bg-dark-950/20">
                        <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center mb-3 animate-pulse">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/></svg>
                        </div>
                        <p className="font-black uppercase tracking-widest text-[10px]">Neural Indexing Required</p>
                    </div>
                )}
            </div>

            {/* CUSTOM INPUT */}
            <div className="flex gap-3 pt-6 border-t border-white/5">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Manually Inject Keyword..."
                    className="flex-1 bg-dark-950 border border-white/5 rounded-2xl px-6 py-4 text-[13px] font-bold text-white placeholder-slate-700 focus:border-brand-500/30 transition-all outline-none"
                    disabled={atLimit}
                />
                <button
                    onClick={handleAddCustomKeyword}
                    disabled={atLimit || !inputValue.trim()}
                    className="px-10 py-4 bg-dark-950 hover:bg-dark-900 text-white text-[11px] font-black rounded-2xl border border-white/10 disabled:opacity-20 transition-all uppercase tracking-[0.3em] shadow-lg active:scale-95"
                >
                    Inject
                </button>
            </div>
        </div>
    );
};