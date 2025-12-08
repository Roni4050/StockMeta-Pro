
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
                // Filter out any existing case-variants just in case, then add the new one
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
            <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                {/* Left side: Controls */}
                <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                         <input
                            type="number"
                            value={selectTopCount}
                            onChange={handleSelectTopCountChange}
                            min="1"
                            max={maxKeywords}
                            className="w-14 h-8 bg-gray-800 border border-gray-600 text-white rounded-l-md text-center text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            onClick={handleSelectTop}
                            disabled={allKeywords.length === 0}
                            className="px-2 h-8 text-xs font-semibold bg-gray-600 text-gray-200 rounded-r-md hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all border border-l-0 border-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            title={`Select the first ${selectTopCount} unique keywords`}
                        >
                            Select Top
                        </button>
                    </div>

                    <button
                        onClick={handleClearSelection}
                        disabled={selectedKeywords.length === 0}
                        className="px-2 h-8 text-xs font-semibold bg-gray-600 text-gray-200 rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
                        title="Deselect all keywords"
                    >
                        Clear
                    </button>
                     <button
                        onClick={handleCopyKeywords}
                        disabled={selectedKeywords.length === 0}
                        className={`px-2 h-8 text-xs font-semibold rounded-md transition-all flex items-center space-x-1 ${
                            copied 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed'
                        }`}
                        title="Copy selected keywords as comma-separated list"
                    >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>

                {/* Right side: Status */}
                <div className="text-xs text-gray-400 font-medium text-right flex-shrink-0 ml-auto flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded ${atLimit ? 'bg-amber-900/30 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                        {count} / {maxKeywords}
                    </span>
                </div>
            </div>

            <div className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm min-h-[76px]">
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
                                    className={`px-2 py-1 text-xs font-medium rounded-full transition-colors select-none ${
                                        isSelected 
                                            ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm' 
                                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    {keyword}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 italic" style={{minHeight: '52px'}}>
                        No keywords generated yet.
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2 mt-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add custom keyword..."
                    className="flex-grow bg-gray-800 border border-gray-600 rounded-md p-1.5 text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-teal-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                    disabled={atLimit}
                />
                <button
                    onClick={handleAddCustomKeyword}
                    disabled={atLimit || !inputValue.trim()}
                    className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                >
                    Add
                </button>
            </div>
        </div>
    );
};
