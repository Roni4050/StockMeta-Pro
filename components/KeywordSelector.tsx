
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
    const [selectTopCount, setSelectTopCount] = useState(Math.min(50, maxKeywords));
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setSelectTopCount(prev => Math.min(prev, maxKeywords));
    }, [maxKeywords]);

    // Derived state for quick lookup, ensuring case-insensitive uniqueness check
    const selectedLowerSet = new Set(selectedKeywords.map(k => k.toLowerCase()));
    
    // Accurate unique count
    const count = selectedLowerSet.size;
    const atLimit = count >= maxKeywords;

    const handleKeywordToggle = (keyword: string) => {
        const lowerKey = keyword.toLowerCase();
        const isSelected = selectedLowerSet.has(lowerKey);
        
        let newSelected: string[];
        if (isSelected) {
            // Remove matching keys
            newSelected = selectedKeywords.filter(k => k.toLowerCase() !== lowerKey);
        } else {
            if (!atLimit) {
                // Add new key, ensuring we don't duplicate visually if backend didn't clean it
                const cleanExisting = selectedKeywords.filter(k => k.toLowerCase() !== lowerKey);
                newSelected = [...cleanExisting, keyword];
            } else {
                return; 
            }
        }
        onChange(newSelected);
    };
    
    const handleAddCustomKeyword = () => {
        const trimmedValue = inputValue.trim();
        const lowerValue = trimmedValue.toLowerCase();
        
        // Check valid, not present (normalized), not limit
        if (trimmedValue && !selectedLowerSet.has(lowerValue) && !atLimit) {
            onAddKeyword(trimmedValue);
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
        const limit = Math.min(selectTopCount, maxKeywords);
        
        // Create unique list from allKeywords
        const uniqueAll = new Set<string>();
        const result: string[] = [];
        
        for (const k of allKeywords) {
            if (result.length >= limit) break;
            const lower = k.toLowerCase();
            if (!uniqueAll.has(lower)) {
                uniqueAll.add(lower);
                result.push(k);
            }
        }
        
        onChange(result);
    };

    const handleClearSelection = () => {
        onChange([]);
    };

    const handleSelectTopCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value)) {
             setSelectTopCount(1);
             return;
        }
        setSelectTopCount(Math.max(1, Math.min(value, maxKeywords)));
    };

    const handleCopyKeywords = () => {
        if (selectedKeywords.length === 0) return;
        const text = selectedKeywords.join(', ');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                {/* Left side: Controls */}
                <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                         <input
                            type="number"
                            value={selectTopCount}
                            onChange={handleSelectTopCountChange}
                            min="1"
                            max={maxKeywords}
                            className="w-14 h-8 bg-black/20 border border-white/10 text-white rounded-l-lg text-center text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            onClick={handleSelectTop}
                            disabled={allKeywords.length === 0}
                            className="px-3 h-8 text-xs font-bold bg-white/5 text-slate-300 rounded-r-lg hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-l-0 border-white/10"
                            title={`Select the first ${selectTopCount} unique keywords`}
                        >
                            Select Top
                        </button>
                    </div>

                    <button
                        onClick={handleClearSelection}
                        disabled={selectedKeywords.length === 0}
                        className="px-3 h-8 text-xs font-bold bg-white/5 text-slate-300 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/10"
                        title="Deselect all keywords"
                    >
                        Clear
                    </button>
                     <button
                        onClick={handleCopyKeywords}
                        disabled={selectedKeywords.length === 0}
                        className={`px-3 h-8 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 border ${
                            copied 
                                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' 
                                : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border-white/10 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                        title="Copy selected keywords as comma-separated list"
                    >
                        {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>

                {/* Right side: Status */}
                <div className="text-xs text-gray-400 font-medium text-right flex-shrink-0 ml-auto flex items-center space-x-2">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${atLimit ? 'bg-amber-900/30 text-amber-500 border border-amber-500/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
                        {count} / {maxKeywords}
                    </span>
                </div>
            </div>

            <div className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm min-h-[76px]">
                {allKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {allKeywords.map(keyword => {
                            const isSelected = selectedLowerSet.has(keyword.toLowerCase());
                            const isDisabled = !isSelected && atLimit;
                            return (
                                <button
                                    key={keyword}
                                    onClick={() => handleKeywordToggle(keyword)}
                                    disabled={isDisabled}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all select-none border ${
                                        isSelected 
                                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-900/20 hover:bg-indigo-500' 
                                            : 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10 hover:border-white/10'
                                    } ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                    {keyword}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-600 italic text-xs" style={{minHeight: '52px'}}>
                        No keywords generated yet.
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2 mt-3">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add custom keyword..."
                    className="flex-grow bg-black/20 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-50"
                    disabled={atLimit}
                />
                <button
                    onClick={handleAddCustomKeyword}
                    disabled={atLimit || !inputValue.trim()}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/20"
                >
                    Add
                </button>
            </div>
        </div>
    );
};
