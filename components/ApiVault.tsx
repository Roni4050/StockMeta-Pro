
import React, { useState } from 'react';
import { AIProvider, ApiKey, Settings } from '../types';
import { SettingsGearIcon, TrashIcon, ViewIcon, HideIcon, UploadIcon } from './icons';
import { validateKey } from '../services/keyValidator';

interface ApiVaultProps {
    settings: Settings;
    onUpdateKeys: (provider: AIProvider, keys: ApiKey[]) => void;
    onClose: () => void;
}

export const ApiVault: React.FC<ApiVaultProps> = ({ settings, onUpdateKeys, onClose }) => {
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>(settings.aiProvider);
    const [inputValue, setInputValue] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

    const providerKeys = settings.providerKeys[selectedProvider] || [];

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
                <div className="px-8 py-6 flex items-center justify-between border-b border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent">
                    <div className="flex items-center gap-3">
                        <SettingsGearIcon className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-[12px] font-black text-slate-300 uppercase tracking-[0.2em]">
                            API KEYS FOR {selectedProvider}
                        </h2>
                    </div>
                    <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <UploadIcon className="w-4 h-4" />
                        Bulk Import
                    </button>
                </div>

                {/* Provider Selector - Small Pills */}
                <div className="flex gap-2 p-6 pb-0 overflow-x-auto no-scrollbar">
                    {Object.values(AIProvider).map(p => {
                         const count = (settings.providerKeys[p] || []).length;
                         return (
                            <button
                                key={p}
                                onClick={() => setSelectedProvider(p)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-2 ${
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

                <div className="p-8 space-y-8">
                    {/* Input Row */}
                    <div className="space-y-3">
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
                        <p className="px-2 text-[10px] text-slate-600 font-bold uppercase tracking-tight">System automatically rotates nodes on rate-limit exhaustion.</p>
                    </div>

                    {/* Key List */}
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 no-scrollbar">
                        {providerKeys.length === 0 ? (
                            <div className="py-16 text-center border border-dashed border-white/[0.05] rounded-[2rem] bg-white/[0.01]">
                                <div className="w-12 h-12 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                     <SettingsGearIcon className="w-6 h-6 text-slate-800" />
                                </div>
                                <p className="text-[12px] text-slate-500 font-black uppercase tracking-widest">Node Registry Offline</p>
                                <p className="text-[9px] text-slate-700 mt-2">Initialize your endpoint matrix to begin batch processing</p>
                            </div>
                        ) : (
                            providerKeys.map((k) => (
                                <div key={k.id} className="flex items-center justify-between p-5 bg-black/20 border border-white/[0.04] rounded-[1.5rem] group hover:border-indigo-500/20 hover:bg-black/40 transition-all">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-lg ${
                                            k.status === 'valid' ? 'bg-emerald-500 shadow-emerald-500/20' :
                                            k.status === 'invalid' ? 'bg-rose-500 shadow-rose-500/20' : 
                                            k.status === 'rate_limited' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-slate-700'
                                        }`} />
                                        <div className="space-y-0.5">
                                            <p className="text-[14px] font-mono text-slate-300 truncate tracking-tight">
                                                {visibleKeys[k.id] ? k.key : `••••••••${k.key.slice(-12)}`}
                                            </p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${
                                                k.status === 'valid' ? 'text-emerald-500/60' :
                                                k.status === 'invalid' ? 'text-rose-500/60' : 'text-slate-600'
                                            }`}>{k.status}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-4">
                                        <button 
                                            onClick={() => toggleVisibility(k.id)}
                                            className="p-2.5 rounded-xl bg-white/[0.03] text-slate-600 hover:text-white transition-all"
                                            title="Toggle Visibility"
                                        >
                                            {visibleKeys[k.id] ? <HideIcon className="w-4 h-4" /> : <ViewIcon className="w-4 h-4" />}
                                        </button>
                                        <button 
                                            onClick={() => handleRemoveKey(k.id)}
                                            className="p-2.5 rounded-xl bg-rose-500/5 text-slate-600 hover:text-rose-500 transition-all"
                                            title="Decommission Node"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="px-8 pb-8 pt-2">
                     <div className="h-4 bg-black/40 rounded-full flex items-center px-2">
                        <div className="flex-1 flex items-center justify-between">
                             <div className="w-1.5 h-1.5 border-t border-l border-white/20 rotate-[225deg]"></div>
                             <div className="w-3/4 h-1 bg-slate-800/50 rounded-full mx-2 relative overflow-hidden">
                                  <div className="absolute inset-0 bg-indigo-500/20 w-1/3 animate-[shimmer_3s_infinite]"></div>
                             </div>
                             <div className="w-1.5 h-1.5 border-t border-l border-white/20 rotate-[45deg]"></div>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};
