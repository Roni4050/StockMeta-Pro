
import React, { useState, useRef } from 'react';
import { Settings, Platform, ImageType, AIProvider, GeminiModel } from '../types';
import { KeyIcon, ViewIcon, HideIcon, TrashIcon, CheckCircleIcon, UploadIcon } from './icons';

interface SettingsPanelProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    platforms: Platform[];
    imageTypes: ImageType[];
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">
        {children}
    </h3>
);

const ProviderCard: React.FC<{
    provider: AIProvider;
    description: string;
    keysCount: number;
    isActive: boolean;
    onClick: () => void;
    children?: React.ReactNode;
}> = ({ provider, description, keysCount, isActive, onClick, children }) => (
    <div
        onClick={onClick}
        className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
            isActive
                ? 'bg-gray-700/60 border-teal-500 ring-1 ring-teal-500/20'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
        }`}
    >
        <div className="flex justify-between items-center">
            <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>{provider}</span>
            {isActive && <div className="h-2 w-2 rounded-full bg-teal-400 shadow-teal"></div>}
        </div>
         {isActive && children && <div className="mt-3">{children}</div>}
         <div className="text-xs text-gray-500 mt-2 flex justify-between">
            <span>{keysCount} key(s)</span>
         </div>
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

    const { aiProvider, geminiApiKeys, mistralApiKeys } = settings;
    const isGemini = aiProvider === AIProvider.GEMINI;

    const currentKeys = isGemini ? geminiApiKeys : mistralApiKeys;
    const currentKeySetter = (keys: string[]) => {
        const keyToUpdate = isGemini ? 'geminiApiKeys' : 'mistralApiKeys';
        handleSettingChange(keyToUpdate, keys);
    };

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

    const truncateKey = (key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

    return (
        <div className="space-y-8">
            {/* AI Config */}
            <div>
                <SectionTitle>AI Provider</SectionTitle>
                <div className="grid grid-cols-2 gap-3 mb-4">
                     <ProviderCard
                        provider={AIProvider.GEMINI}
                        description=""
                        keysCount={geminiApiKeys.length}
                        isActive={isGemini}
                        onClick={() => handleSettingChange('aiProvider', AIProvider.GEMINI)}
                    >
                        <select
                            value={settings.geminiModel}
                            onChange={(e) => handleSettingChange('geminiModel', e.target.value as GeminiModel)}
                            className="w-full bg-gray-900 border border-gray-600 text-xs text-white rounded p-1.5 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                        >
                            <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
                            <option value={GeminiModel.FLASH_LITE}>Gemini 2.5 Flash Lite</option>
                            <option value={GeminiModel.PRO}>Gemini 3.0 Pro</option>
                            <option value={GeminiModel.FLASH_2_0}>Gemini 2.0 Flash</option>
                        </select>
                    </ProviderCard>
                     <ProviderCard
                        provider={AIProvider.MISTRAL}
                        description=""
                        keysCount={mistralApiKeys.length}
                        isActive={!isGemini}
                        onClick={() => handleSettingChange('aiProvider', AIProvider.MISTRAL)}
                    />
                </div>
                
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <label className="text-xs text-gray-400 block mb-2">Manage Keys</label>
                    <textarea
                        value={newKeyInput}
                        onChange={(e) => setNewKeyInput(e.target.value)}
                        placeholder="Paste API keys here..."
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-600 text-xs text-white rounded-md p-2 placeholder-gray-600 focus:ring-1 focus:ring-teal-500 mb-2"
                    />
                    <div className="flex justify-between items-center mb-3">
                         <button onClick={() => fileInputRef.current?.click()} className="text-xs text-teal-400 hover:text-teal-300 flex items-center space-x-1">
                            <UploadIcon /> <span>Import</span>
                         </button>
                         <input ref={fileInputRef} type="file" className="hidden" onChange={handleImportKeys} />
                        <button onClick={handleAddKey} disabled={!newKeyInput.trim()} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50">Add</button>
                    </div>
                    
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-600">
                        {currentKeys.map((key, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-900/50 p-1.5 rounded">
                                <span className="text-xs font-mono text-gray-400">{visibleKeys[key] ? key : truncateKey(key)}</span>
                                <div className="flex space-x-1">
                                    <button onClick={() => setVisibleKeys(p => ({...p, [key]: !p[key]}))} className="p-1 text-gray-500 hover:text-white"><ViewIcon/></button>
                                    {idx !== 0 && <button onClick={() => handleActivateKey(idx)} className="p-1 text-gray-500 hover:text-green-400"><CheckCircleIcon/></button>}
                                    <button onClick={() => handleDeleteKey(idx)} className="p-1 text-gray-500 hover:text-red-400"><TrashIcon/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Metadata Rules */}
            <div>
                 <SectionTitle>Platform Rules</SectionTitle>
                 <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Target Platform</label>
                        <select
                            value={settings.platform}
                            onChange={(e) => handleSettingChange('platform', e.target.value as Platform)}
                            className="w-full bg-gray-800 border border-gray-600 text-sm text-white rounded-md p-2 focus:ring-1 focus:ring-teal-500"
                        >
                            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                             <label className="text-xs text-gray-400 block mb-1">Title Length (Chars)</label>
                             <div className="flex space-x-1">
                                <input type="number" value={settings.titleLength.min} onChange={(e) => handleSettingChange('titleLength', {...settings.titleLength, min: +e.target.value})} className="w-full bg-gray-800 border border-gray-600 text-xs text-white rounded p-1.5 text-center" />
                                <input type="number" value={settings.titleLength.max} onChange={(e) => handleSettingChange('titleLength', {...settings.titleLength, max: +e.target.value})} className="w-full bg-gray-800 border border-gray-600 text-xs text-white rounded p-1.5 text-center" />
                             </div>
                        </div>
                        <div>
                             <label className="text-xs text-gray-400 block mb-1">Max Keywords</label>
                             <input type="number" value={settings.maxKeywords} onChange={(e) => handleSettingChange('maxKeywords', +e.target.value)} className="w-full bg-gray-800 border border-gray-600 text-xs text-white rounded p-1.5 text-center" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 block">Customization</label>
                        <input type="text" value={settings.prefix} onChange={(e) => handleSettingChange('prefix', e.target.value)} placeholder="Title Prefix..." className="w-full bg-gray-800 border border-gray-600 text-xs text-white rounded p-2 placeholder-gray-500" />
                        <input type="text" value={settings.suffix} onChange={(e) => handleSettingChange('suffix', e.target.value)} placeholder="Title Suffix..." className="w-full bg-gray-800 border border-gray-600 text-xs text-white rounded p-2 placeholder-gray-500" />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-700">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={settings.isolatedWhite} onChange={(e) => handleSettingChange('isolatedWhite', e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white">Isolated on White</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={settings.isolatedTransparent} onChange={(e) => handleSettingChange('isolatedTransparent', e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white">Isolated on Transparent</span>
                        </label>
                         <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" checked={settings.singleGenerationMode} onChange={(e) => handleSettingChange('singleGenerationMode', e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-0" />
                            <span className="text-xs text-gray-300 group-hover:text-white">Single Mode (Slower)</span>
                        </label>
                    </div>
                 </div>
            </div>
        </div>
    );
}
