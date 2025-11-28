
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
        // If the max keywords limit from settings is lowered, adjust the "select top" count
        // to not exceed the new limit.
        setSelectTopCount(prev => Math.min(prev, maxKeywords));
    }, [maxKeywords]);

    const selectedKeywordsSet = new Set(selectedKeywords);
    const atLimit = selectedKeywords.length >= maxKeywords;

    const handleKeywordToggle = (keyword: string) => {
        const isSelected = selectedKeywordsSet.has(keyword);
        let newSelected: string[];
        if (isSelected) {
            newSelected = selectedKeywords.filter(k => k !== keyword);
        } else {
            if (!atLimit) {
                newSelected = [...selectedKeywords, keyword];
            } else {
                return; // Do nothing if at limit and trying to add
            }
        }
        onChange(newSelected);
    };
    
    const handleAddCustomKeyword = () => {
        const trimmedValue = inputValue.trim().toLowerCase();
        // Check if keyword is valid, not already present (case-insensitive), and not at the limit
        if (trimmedValue && !allKeywords.some(k => k.toLowerCase() === trimmedValue) && !atLimit) {
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
        const count = Math.min(selectTopCount, maxKeywords);
        onChange(allKeywords.slice(0, count));
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
                            title={`Select the first ${selectTopCount} keywords`}
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
                <div className="text-xs text-gray-400 font-medium text-right flex-shrink-0 ml-auto">
                    <span>{selectedKeywords.length} / {maxKeywords} keywords</span>
                    { atLimit && <span className="block text-yellow-400 font-medium">Limit reached!</span> }
                </div>
            </div>

            <div className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm min-h-[76px]">
                {allKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {allKeywords.map(keyword => {
                            const isSelected = selectedKeywordsSet.has(keyword);
                            const isDisabled = !isSelected && atLimit;
                            return (
                                <button
                                    key={keyword}
                                    onClick={() => handleKeywordToggle(keyword)}
                                    disabled={isDisabled}
                                    className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                                        isSelected 
                                            ? 'bg-teal-500 text-white hover:bg-teal-600' 
                                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {keyword}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500" style={{minHeight: '52px'}}>
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
