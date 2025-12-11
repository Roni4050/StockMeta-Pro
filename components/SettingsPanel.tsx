
import React, { useState, useRef } from 'react';
import { Settings, Platform, ImageType, AIProvider, GeminiModel } from '../types';
import { ViewIcon, TrashIcon, CheckCircleIcon, UploadIcon } from './icons';
import { GROQ_MODELS } from '../constants';

interface SettingsPanelProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    platforms: Platform[];
    imageTypes: ImageType[];
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center mt-6 first:mt-0 border-b border-white/5 pb-2">
        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
        {children}
    </h3>
);

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <label className="flex items-center justify-between cursor-pointer group p-3 hover:bg-slate-800/40 rounded-xl transition-all border border-transparent hover:border-white/5">
        <span className="text-xs text-slate-300 font-medium group-hover:text-white transition-colors">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className={`block w-9 h-5 rounded-full transition-all duration-300 ${checked ? 'bg-indigo-600 shadow-[0_0_10px_-2px_rgba(99,102,241,0.5)]' : 'bg-slate-700/50'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform duration-300 shadow-md ${checked ? 'transform translate-x-4' : ''}`}></div>
        </div>
    </label>
);

const ProviderCard: React.FC<{
    provider: AIProvider;
    keysCount: number;
    isActive: boolean;
    onClick: () => void;
    children?: React.ReactNode;
}> = ({ provider, keysCount, isActive, onClick, children }) => (
    <div
        onClick={onClick}
        className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 border group ${
            isActive
                ? 'bg-gradient-to-br from-indigo-900/30 to-indigo-900/10 border-indigo-500/50 shadow-[0_4px_20px_-8px_rgba(99,102,241,0.3)]'
                : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/60'
        }`}
    >
        <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-200'}`}>{provider}</span>
            <div className={`h-2 w-2 rounded-full transition-all duration-500 ${isActive ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] scale-110' : 'bg-slate-700'}`}></div>
        </div>
         {isActive && children && <div className="mt-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">{children}</div>}
         <div className="text-[10px] text-slate-500 font-mono flex items-center">
            <div className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors ${keysCount > 0 ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.4)]' : 'bg-rose-500'}`}></div>
            {keysCount} active keys
         </div>
    </div>
);

const InputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="group">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 group-hover:text-indigo-400 transition-colors duration-300">{label}</label>
        {children}
    </div>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    setSettings,
    platforms,
    imageTypes,
}) => {
    const [newKeyInput, setNewKeyInput] = useState('');
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const { aiProvider, geminiApiKeys, mistralApiKeys, openRouterApiKeys, groqApiKeys } = settings;

    // Helper to determine which keys are currently active based on provider selection
    let currentKeys: string[] = [];
    let currentKeySetter: (keys: string[]) => void = () => {};

    switch (aiProvider) {
        case AIProvider.GEMINI:
            currentKeys = geminiApiKeys;
            currentKeySetter = (keys) => handleSettingChange('geminiApiKeys', keys);
            break;
        case AIProvider.MISTRAL:
            currentKeys = mistralApiKeys;
            currentKeySetter = (keys) => handleSettingChange('mistralApiKeys', keys);
            break;
        case AIProvider.OPENROUTER:
            currentKeys = openRouterApiKeys;
            currentKeySetter = (keys) => handleSettingChange('openRouterApiKeys', keys);
            break;
        case AIProvider.GROQ:
            currentKeys = groqApiKeys;
            currentKeySetter = (keys) => handleSettingChange('groqApiKeys', keys);
            break;
    }

    const handleAddKey = () => {
        const keysToAdd = newKeyInput.split(/[\s,;\n]+/).map(k => k.trim()).filter(Boolean);
        if (keysToAdd.length > 0) {
            const uniqueNewKeys = keysToAdd.filter(k => !currentKeys.includes(k));
            if (uniqueNewKeys.length > 0) {
                currentKeySetter([...currentKeys, ...uniqueNewKeys]);
            }
            setNewKeyInput('');
        }
    };
    
    const handleImportKeys = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
                const keysToAdd = text.split(/[\s,;\n]+/).map(k => k.trim()).filter(k => k.length > 10);
                const uniqueNewKeys = keysToAdd.filter(k => !currentKeys.includes(k));
                if (uniqueNewKeys.length > 0) {
                    currentKeySetter([...currentKeys, ...uniqueNewKeys]);
                    alert(`Imported ${uniqueNewKeys.length} keys.`);
                }
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteKey = (keyIndex: number) => {
        currentKeySetter(currentKeys.filter((_, index) => index !== keyIndex));
    };

    const handleActivateKey = (keyIndex: number) => {
        const key = currentKeys[keyIndex];
        currentKeySetter([key, ...currentKeys.filter((_, index) => index !== keyIndex)]);
    };

    const truncateKey = (key: string) => `${key.substring(0, 6)}••••••••${key.substring(key.length - 4)}`;

    const isCustomGroq = !GROQ_MODELS.some(m => m.id === settings.groqModel);

    return (
        <div className="space-y-6 pb-10">
            {/* AI Engine Selection */}
            <div>
                <SectionTitle>AI Configuration</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                     <ProviderCard
                        provider={AIProvider.GEMINI}
                        keysCount={geminiApiKeys.length}
                        isActive={aiProvider === AIProvider.GEMINI}
                        onClick={() => handleSettingChange('aiProvider', AIProvider.GEMINI)}
                    >
                        <select
                            value={settings.geminiModel}
                            onChange={(e) => handleSettingChange('geminiModel', e.target.value as GeminiModel)}
                            className="w-full bg-slate-900/80 border border-slate-600/50 text-[10px] text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-colors"
                        >
                            <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
                            <option value={GeminiModel.FLASH_LITE}>Gemini 2.5 Flash Lite</option>
                            <option value={GeminiModel.PRO}>Gemini 3.0 Pro</option>
                            <option value={GeminiModel.FLASH_2_0}>Gemini 2.0 Flash</option>
                        </select>
                    </ProviderCard>
                    
                     <ProviderCard
                        provider={AIProvider.MISTRAL}
                        keysCount={mistralApiKeys.length}
                        isActive={aiProvider === AIProvider.MISTRAL}
                        onClick={() => handleSettingChange('aiProvider', AIProvider.MISTRAL)}
                    />

                    <ProviderCard
                        provider={AIProvider.OPENROUTER}
                        keysCount={openRouterApiKeys.length}
                        isActive={aiProvider === AIProvider.OPENROUTER}
                        onClick={() => handleSettingChange('aiProvider', AIProvider.OPENROUTER)}
                    >
                         <input
                            type="text"
                            value={settings.openRouterModel || "google/gemini-2.0-flash-001"}
                            onChange={(e) => handleSettingChange('openRouterModel', e.target.value)}
                            placeholder="Model ID (e.g., google/gemini-2.0-flash-001)"
                            className="w-full bg-slate-900/80 border border-slate-600/50 text-[10px] text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-colors"
                        />
                    </ProviderCard>

                    <ProviderCard
                        provider={AIProvider.GROQ}
                        keysCount={groqApiKeys.length}
                        isActive={aiProvider === AIProvider.GROQ}
                        onClick={() => handleSettingChange('aiProvider', AIProvider.GROQ)}
                    >
                        <div className="space-y-2">
                             <select
                                value={isCustomGroq ? 'custom' : settings.groqModel}
                                onChange={(e) => {
                                    if (e.target.value === 'custom') {
                                        handleSettingChange('groqModel', '');
                                    } else {
                                        handleSettingChange('groqModel', e.target.value);
                                    }
                                }}
                                className="w-full bg-slate-900/80 border border-slate-600/50 text-[10px] text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-colors"
                            >
                                {GROQ_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                                <option value="custom">Custom / Other...</option>
                            </select>
                            
                            {isCustomGroq && (
                                <input
                                    type="text"
                                    value={settings.groqModel || ""}
                                    onChange={(e) => handleSettingChange('groqModel', e.target.value)}
                                    placeholder="Enter Model ID (e.g. llama3-70b-8192)..."
                                    className="w-full bg-slate-900/80 border border-slate-600/50 text-[10px] text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-colors animate-in fade-in zoom-in-95 duration-200"
                                />
                            )}
                        </div>
                    </ProviderCard>
                </div>
                
                <div className="bg-slate-800/20 rounded-xl p-4 border border-white/5 backdrop-blur-sm hover:bg-slate-800/30 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            API Keys for {aiProvider}
                         </label>
                         <button onClick={() => fileInputRef.current?.click()} className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-2 py-1 rounded transition-all flex items-center space-x-1 border border-slate-700">
                            <UploadIcon className="w-3 h-3"/> <span>Import</span>
                         </button>
                         <input ref={fileInputRef} type="file" className="hidden" onChange={handleImportKeys} />
                    </div>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newKeyInput}
                            onChange={(e) => setNewKeyInput(e.target.value)}
                            placeholder={`Paste ${aiProvider} API Key(s)...`}
                            className="flex-1 bg-slate-900/50 border border-slate-700/50 text-xs text-white rounded-lg p-2.5 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all focus:bg-slate-900"
                        />
                         <button onClick={handleAddKey} disabled={!newKeyInput.trim()} className="px-3 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-700 transition-colors shadow-lg shadow-indigo-900/20">Add</button>
                    </div>
                    
                    <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                        {currentKeys.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-600 italic">No keys added yet for {aiProvider}.</div>
                        ) : (
                            currentKeys.map((key, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-white/5 group hover:border-indigo-500/30 transition-all">
                                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-300 transition-colors">{visibleKeys[key] ? key : truncateKey(key)}</span>
                                    <div className="flex space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setVisibleKeys(p => ({...p, [key]: !p[key]}))} className="p-1 text-slate-500 hover:text-white transition-colors"><ViewIcon className="w-3 h-3"/></button>
                                        {idx !== 0 && <button onClick={() => handleActivateKey(idx)} className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"><CheckCircleIcon className="w-3 h-3"/></button>}
                                        <button onClick={() => handleDeleteKey(idx)} className="p-1 text-slate-500 hover:text-rose-400 transition-colors"><TrashIcon className="w-3 h-3"/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Platform Settings */}
            <div>
                 <SectionTitle>Core Settings</SectionTitle>
                 <div className="space-y-4">
                    <div className="bg-slate-800/20 p-4 rounded-xl border border-white/5 space-y-4">
                         <InputGroup label="Target Platform">
                             <select
                                value={settings.platform}
                                onChange={(e) => handleSettingChange('platform', e.target.value as Platform)}
                                className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-all"
                            >
                                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                         </InputGroup>

                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Title Length">
                                 <div className="flex space-x-2">
                                    <input type="number" placeholder="Min" value={settings.titleLength.min} onChange={(e) => handleSettingChange('titleLength', {...settings.titleLength, min: +e.target.value})} className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2 text-center focus:ring-1 focus:ring-indigo-500 transition-all" />
                                    <input type="number" placeholder="Max" value={settings.titleLength.max} onChange={(e) => handleSettingChange('titleLength', {...settings.titleLength, max: +e.target.value})} className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2 text-center focus:ring-1 focus:ring-indigo-500 transition-all" />
                                 </div>
                            </InputGroup>
                            <InputGroup label="Max Keywords">
                                 <input type="number" value={settings.maxKeywords} onChange={(e) => handleSettingChange('maxKeywords', +e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2 text-center focus:ring-1 focus:ring-indigo-500 transition-all" />
                            </InputGroup>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <ToggleSwitch checked={settings.isolatedWhite} onChange={(v) => handleSettingChange('isolatedWhite', v)} label="Isolated on White" />
                        <ToggleSwitch checked={settings.isolatedTransparent} onChange={(v) => handleSettingChange('isolatedTransparent', v)} label="Isolated on Transparent" />
                        <ToggleSwitch checked={settings.singleGenerationMode} onChange={(v) => handleSettingChange('singleGenerationMode', v)} label="Safe Mode (Prevent 429s)" />
                    </div>
                 </div>
            </div>
            
            {/* New Modifiers Section */}
            <div>
                 <SectionTitle>Title & Keyword Modifiers</SectionTitle>
                 <div className="space-y-4 bg-slate-800/20 p-4 rounded-xl border border-white/5">
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Prefix (Before Title)">
                             <input type="text" value={settings.prefix} onChange={(e) => handleSettingChange('prefix', e.target.value)} placeholder="e.g. Editorial:" className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600" />
                        </InputGroup>
                        <InputGroup label="Suffix (After Title)">
                             <input type="text" value={settings.suffix} onChange={(e) => handleSettingChange('suffix', e.target.value)} placeholder="e.g. - 4K" className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600" />
                        </InputGroup>
                    </div>
                    
                    <InputGroup label="Negative Title Words">
                        <textarea 
                            value={settings.negativeTitleWords} 
                            onChange={(e) => handleSettingChange('negativeTitleWords', e.target.value)} 
                            placeholder="Words to exclude from generated title (comma separated)..."
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2.5 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all placeholder-slate-600 resize-none" 
                        />
                    </InputGroup>

                    <InputGroup label="Negative Keywords">
                        <textarea 
                            value={settings.negativeKeywords} 
                            onChange={(e) => handleSettingChange('negativeKeywords', e.target.value)} 
                            placeholder="Keywords to exclude from list (comma separated)..."
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-700/50 text-xs text-white rounded-lg p-2.5 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all placeholder-slate-600 resize-none" 
                        />
                    </InputGroup>
                 </div>
            </div>
        </div>
    );
}
