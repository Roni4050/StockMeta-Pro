
import React, { useState, useRef, useEffect } from 'react';
import { AIProvider, ApiKey, Settings } from '../types';
import { SettingsGearIcon, TrashIcon, ViewIcon, HideIcon, UploadIcon, CheckIcon, RefreshIcon } from './icons';
import { validateKey } from '../services/keyValidator';
import { PROVIDER_MODELS, BILLING_URLS } from '../constants';

interface ApiVaultProps {
    settings: Settings;
    onUpdateKeys: (provider: AIProvider, keys: ApiKey[]) => void;
    onUpdateActiveModel?: (provider: AIProvider, modelId: string) => void;
    onClose: () => void;
}

export const ApiVault: React.FC<ApiVaultProps> = ({ settings, onUpdateKeys, onUpdateActiveModel, onClose }) => {
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>(settings.aiProvider);
    const [inputValue, setInputValue] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [validatingKeyId, setValidatingKeyId] = useState<string | null>(null);
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const providerKeys = settings.providerKeys[selectedProvider] || [];
    const availableModels = PROVIDER_MODELS[selectedProvider] || [];
    const activeModelId = settings.activeModels[selectedProvider];
    const activeModel = availableModels.find(m => m.id === activeModelId) || availableModels[0];
    const billingUrl = BILLING_URLS[selectedProvider];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddKeys = async () => {
        const keysToAdd = inputValue
            .split(/[\n,]+/)
            .map(k => k.trim())
            .filter(k => k.length > 0);
            
        if (keysToAdd.length === 0) return;

        setIsValidating(true);
        const newValidatedKeys: ApiKey[] = [];
        
        for (let i = 0; i < keysToAdd.length; i++) {
            const key = keysToAdd[i];
            if (providerKeys.some(k => k.key === key)) continue;

            const status = await validateKey(selectedProvider, key);
            newValidatedKeys.push({
                id: `${selectedProvider}-${Date.now()}-${i}`,
                key: key,
                status
            });
        }
        
        onUpdateKeys(selectedProvider, [...providerKeys, ...newValidatedKeys]);
        setInputValue('');
        setIsValidating(false);
    };

    const handleRevalidateKey = async (id: string, key: string) => {
        setValidatingKeyId(id);
        const status = await validateKey(selectedProvider, key);
        const updatedKeys = providerKeys.map(k => k.id === id ? { ...k, status } : k);
        onUpdateKeys(selectedProvider, updatedKeys);
        setValidatingKeyId(null);
    };

    const toggleVisibility = (id: string) => {
        setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleRemoveKey = (id: string) => {
        const updatedKeys = providerKeys.filter(k => k.id !== id);
        onUpdateKeys(selectedProvider, updatedKeys);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            
            <div className="relative w-full max-w-[550px] bg-[#0A0B0E] border border-white/5 rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 flex flex-col gap-1 border-b border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <SettingsGearIcon className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-[12px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                API VAULT CONFIGURATION
                            </h2>
                        </div>
                        {billingUrl && (
                            <a 
                                href={billingUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-[10px] font-black text-indigo-400 uppercase tracking-widest transition-all"
                            >
                                Top Up Credits
                            </a>
                        )}
                    </div>
                </div>

                {/* Provider Selector - Small Pills */}
                <div className="flex gap-2 p-6 pb-2 overflow-x-auto no-scrollbar">
                    {Object.values(AIProvider).map(p => {
                         const count = (settings.providerKeys[p] || []).length;
                         return (
                            <button
                                key={p}
                                onClick={() => setSelectedProvider(p)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-2 flex-shrink-0 ${
                                    selectedProvider === p 
                                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                                        : 'bg-white/[0.02] border-white/[0.05] text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {p}
                                {count > 0 && <span className="text-[9px] opacity-60">({count})</span>}
                            </button>
                         );
                    })}
                </div>

                <div className="p-8 pt-4 space-y-6">
                    {/* Model Selector Section */}
                    <div className="space-y-3">
                        <label className="text-[12px] font-black text-slate-300 tracking-wide">Analysis Node</label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                className="w-full flex items-center justify-between bg-black/40 border border-white/[0.1] rounded-xl px-5 py-4 text-[14px] font-bold text-white hover:bg-black/60 transition-all outline-none"
                            >
                                <span className="flex items-center gap-2">
                                    {activeModel?.name}
                                    {activeModel?.isFree && (
                                        <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-2 py-0.5 rounded-md uppercase font-black tracking-tighter">Free Tier</span>
                                    )}
                                </span>
                                <svg className={`w-4 h-4 text-slate-500 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            
                            {isModelDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#121418] border border-white/[0.08] rounded-2xl shadow-2xl z-50 py-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                    {availableModels.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                if (onUpdateActiveModel) onUpdateActiveModel(selectedProvider, m.id);
                                                setIsModelDropdownOpen(false);
                                            }}
                                            className="w-full flex items-center justify-between px-5 py-3.5 text-[14px] font-bold hover:bg-white/[0.03] transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 flex items-center justify-center">
                                                    {activeModelId === m.id && <CheckIcon className="w-4 h-4 text-indigo-400" />}
                                                </div>
                                                <span className={`${activeModelId === m.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                    {m.name}
                                                </span>
                                                {m.isFree && (
                                                    <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-tighter">Free</span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input Row */}
                    <div className="space-y-3">
                        <label className="text-[12px] font-black text-slate-300 tracking-wide">Add Credentials</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeys()}
                                    placeholder={`Paste ${selectedProvider} API Key(s)...`}
                                    className="w-full bg-black/40 border border-white/[0.05] rounded-2xl px-6 py-4 text-[14px] text-white placeholder-slate-700 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/10 transition-all outline-none font-mono"
                                />
                                {isValidating && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleAddKeys}
                                disabled={isValidating || !inputValue.trim()}
                                className="px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[13px] uppercase tracking-widest rounded-2xl border border-white/10 disabled:opacity-20 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                            >
                                {isValidating ? '...' : 'Add'}
                            </button>
                        </div>
                    </div>

                    {/* Key List */}
                    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2 no-scrollbar">
                        {providerKeys.length === 0 ? (
                            <div className="py-12 text-center border border-dashed border-white/[0.05] rounded-[2rem] bg-white/[0.01]">
                                <p className="text-[11px] text-slate-600 font-black uppercase tracking-widest leading-loose">No active keys for this cluster<br/>Enter keys above to proceed</p>
                            </div>
                        ) : (
                            providerKeys.map((k) => (
                                <div key={k.id} className={`flex items-center justify-between p-5 bg-black/20 border rounded-[1.5rem] group hover:bg-black/40 transition-all ${
                                    k.status === 'exhausted' ? 'border-rose-500/30 bg-rose-500/[0.02]' : 'border-white/[0.04]'
                                }`}>
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                            k.status === 'valid' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                            k.status === 'invalid' ? 'bg-rose-500' : 
                                            k.status === 'rate_limited' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                                            k.status === 'exhausted' ? 'bg-rose-600 shadow-[0_0_12px_rgba(225,29,72,0.8)] animate-pulse' : 
                                            'bg-slate-700'
                                        }`} />
                                        <div className="flex flex-col">
                                            <p className={`text-[13px] font-mono truncate tracking-tight ${k.status === 'exhausted' ? 'text-rose-400' : 'text-slate-400'}`}>
                                                {visibleKeys[k.id] ? k.key : `••••••••${k.key.slice(-12)}`}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[9px] font-black uppercase tracking-tighter ${
                                                    k.status === 'exhausted' ? 'text-rose-500' : 
                                                    k.status === 'valid' ? 'text-emerald-500' : 'text-slate-600'
                                                }`}>
                                                    {k.status === 'exhausted' ? 'Insufficient Balance (402)' : 
                                                     k.status === 'valid' ? 'Active Node' : 
                                                     k.status === 'invalid' ? 'Access Denied' : 
                                                     k.status === 'rate_limited' ? 'Rate Limited' : 'Syncing Status'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-4">
                                        <button 
                                            onClick={() => handleRevalidateKey(k.id, k.key)}
                                            disabled={validatingKeyId === k.id}
                                            className={`p-2 text-slate-600 hover:text-indigo-400 transition-all ${validatingKeyId === k.id ? 'animate-spin' : ''}`}
                                            title="Check Status"
                                        >
                                            <RefreshIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                            onClick={() => toggleVisibility(k.id)}
                                            className="p-2 text-slate-600 hover:text-white transition-all"
                                        >
                                            {visibleKeys[k.id] ? <HideIcon className="w-4 h-4" /> : <ViewIcon className="w-4 h-4" />}
                                        </button>
                                        <button 
                                            onClick={() => handleRemoveKey(k.id)}
                                            className="p-2 text-slate-600 hover:text-rose-500 transition-all"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer Decor */}
                <div className="px-8 pb-8 pt-2">
                     <div className="h-1 bg-white/[0.03] rounded-full relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 w-1/3 bg-indigo-500/20 blur-sm animate-[shimmer_4s_infinite]"></div>
                     </div>
                </div>
            </div>
        </div>
    );
};
