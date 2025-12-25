
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
        <div className="space-y-6">
            {/* CONTROL BAR */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="bg-[#1A1A1B] border border-white/5 rounded-lg px-4 py-1.5 text-[12px] font-black text-white">
                        {selectedKeywords.length}
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-white/5">
                        <button
                            onClick={handleSelectTop}
                            className="px-4 py-2 bg-[#1A1A1B] hover:bg-[#252526] text-[11px] font-bold text-slate-300 border-r border-white/5 transition-all"
                        >
                            Select Top
                        </button>
                        <button
                            onClick={() => onChange([])}
                            className="px-4 py-2 bg-[#1A1A1B] hover:bg-[#252526] text-[11px] font-bold text-slate-300 border-r border-white/5 transition-all"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleCopyKeywords}
                            className="px-4 py-2 bg-[#1A1A1B] hover:bg-[#252526] text-[11px] font-bold text-slate-300 transition-all flex items-center gap-2"
                        >
                            {copied ? <CheckIcon className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
                            Copy
                        </button>
                    </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500 bg-black/40 px-3 py-1 rounded-lg border border-white/5">
                    {selectedKeywords.length} / {maxKeywords}
                </div>
            </div>

            {/* KEYWORD CHIPS CONTAINER */}
            <div className="flex flex-wrap gap-2 min-h-[120px] p-1">
                {allKeywords.length > 0 ? (
                    allKeywords.map(keyword => {
                        const isSelected = selectedLowerSet.has(keyword.toLowerCase());
                        const isDisabled = !isSelected && atLimit;
                        return (
                            <button
                                key={keyword}
                                onClick={() => handleKeywordToggle(keyword)}
                                disabled={isDisabled}
                                className={`px-4 py-2 text-[12px] font-bold rounded-lg border transition-all ${
                                    isSelected 
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20 hover:bg-indigo-500' 
                                        : 'bg-[#1A1A1B] text-slate-400 border-white/5 hover:border-indigo-500/30'
                                } ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                {keyword}
                            </button>
                        );
                    })
                ) : (
                    <div className="w-full flex items-center justify-center text-slate-700 italic text-[12px]">
                        Analyzing visual features for metadata extraction...
                    </div>
                )}
            </div>

            {/* CUSTOM INPUT */}
            <div className="flex gap-2 pt-2 border-t border-white/5">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add custom keyword..."
                    className="flex-1 bg-[#121213] border border-white/5 rounded-xl px-5 py-3 text-[13px] text-white placeholder-slate-700 focus:ring-1 focus:ring-indigo-500/20"
                    disabled={atLimit}
                />
                <button
                    onClick={handleAddCustomKeyword}
                    disabled={atLimit || !inputValue.trim()}
                    className="px-6 py-3 bg-[#1A1A1B] hover:bg-[#252526] text-white text-[12px] font-black rounded-xl border border-white/5 disabled:opacity-50 transition-all uppercase tracking-widest"
                >
                    Add
                </button>
            </div>
        </div>
    );
};
