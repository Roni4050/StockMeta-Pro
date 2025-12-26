import React from 'react';
import { Settings, Platform, AIProvider } from '../types';
import { SettingsGearIcon, InfoIcon } from './icons';
import { PROVIDER_MODELS } from '../constants';

interface SettingsPanelProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    platforms: Platform[];
    onOpenVault: () => void;
}

const ControlGroup: React.FC<{ label: string; children: React.ReactNode; rightElement?: React.ReactNode }> = ({ label, children, rightElement }) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{label}</label>
            {rightElement}
        </div>
        {children}
    </div>
);

const ToggleRow: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; subLabel?: string }> = ({ label, checked, onChange, subLabel }) => (
    <div className="flex items-center justify-between py-3.5 px-2 group cursor-pointer" onClick={() => onChange(!checked)}>
        <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-black text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-tight">{label}</span>
            {subLabel && <span className="text-[9px] font-black text-brand-500/60 uppercase tracking-widest">{subLabel}</span>}
        </div>
        <button
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-500 focus:outline-none ${
                checked ? 'bg-brand-600 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-dark-950 border border-white/10'
            }`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-500 ${
                    checked ? 'translate-x-6' : 'translate-x-0.5'
                }`}
            />
        </button>
    </div>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings, platforms, onOpenVault }) => {
    const activeKeyCount = settings.providerKeys[settings.aiProvider]?.filter(k => k.status === 'valid').length || 0;
    const availableModels = PROVIDER_MODELS[settings.aiProvider] || [];

    return (
        <div className="space-y-12">
            {/* PLATFORM SECTION */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_10px_rgba(99,102,241,1)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Operational Target</h2>
                </div>
                
                <div className="space-y-6">
                    <ControlGroup label="Asset Marketplace">
                        <div className="relative group">
                            <select 
                                value={settings.platform} 
                                onChange={(e) => setSettings(s => ({...s, platform: e.target.value as Platform}))}
                                className="w-full bg-dark-950 border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-black text-white focus:border-brand-500/40 appearance-none cursor-pointer hover:bg-dark-900 transition-all outline-none uppercase tracking-widest"
                            >
                                {platforms.map(p => <option key={p} value={p} className="bg-[#111]">{p}</option>)}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </ControlGroup>
                </div>
            </div>

            {/* AI CONFIGURATION */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,1)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Intelligence Grid</h2>
                </div>

                <div className="space-y-7">
                    <ControlGroup 
                        label="AI Engine" 
                        rightElement={
                            <button onClick={onOpenVault} className="text-[9px] font-black text-brand-400 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-tighter">
                                <SettingsGearIcon className="w-3.5 h-3.5" /> Manage Keys
                            </button>
                        }
                    >
                        <select 
                            value={settings.aiProvider} 
                            onChange={(e) => setSettings(s => ({...s, aiProvider: e.target.value as AIProvider}))}
                            className="w-full bg-dark-950 border border-white/5 rounded-2xl px-5 py-3.5 text-[13px] font-black text-white focus:border-brand-500/40 appearance-none cursor-pointer outline-none transition-all uppercase tracking-widest"
                        >
                            {Object.values(AIProvider).map(p => <option key={p} value={p} className="bg-[#111]">{p}</option>)}
                        </select>
                        <div className="flex items-center justify-between px-2 mt-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${activeKeyCount > 0 ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{activeKeyCount} Nodes Online</span>
                            </div>
                        </div>
                    </ControlGroup>

                    <ControlGroup label="Neural Analysis Model">
                        <select 
                            value={settings.activeModels[settings.aiProvider]} 
                            onChange={(e) => setSettings(s => ({
                                ...s, 
                                activeModels: { ...s.activeModels, [settings.aiProvider]: e.target.value }
                            }))}
                            className="w-full bg-dark-950 border border-white/5 rounded-2xl px-5 py-3.5 text-[12px] font-bold text-slate-300 focus:border-purple-500/40 appearance-none cursor-pointer outline-none transition-all"
                        >
                            {availableModels.map(m => <option key={m.id} value={m.id} className="bg-[#111]">{m.name}</option>)}
                        </select>
                    </ControlGroup>
                </div>
            </div>

            {/* PARAMETERS SECTION */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">SEO Framework</h2>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <ControlGroup label="Keywords">
                            <input 
                                type="number" 
                                value={settings.maxKeywords}
                                onChange={(e) => setSettings(s => ({...s, maxKeywords: parseInt(e.target.value) || 0}))}
                                className="w-full bg-dark-950 border border-white/5 rounded-2xl py-3.5 px-4 text-center text-[13px] font-black text-white outline-none focus:border-brand-500/30 transition-all font-mono"
                            />
                        </ControlGroup>
                        <ControlGroup label="Parallel Safe">
                            <div className="h-full flex items-center justify-center bg-dark-950/50 rounded-2xl border border-white/[0.03] px-2">
                                <ToggleRow 
                                    label="" 
                                    checked={settings.safeMode} 
                                    onChange={(v) => setSettings(s => ({...s, safeMode: v}))} 
                                />
                            </div>
                        </ControlGroup>
                    </div>

                    <ControlGroup label="Title Character Budget">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    value={settings.titleLength.min}
                                    onChange={(e) => setSettings(s => ({...s, titleLength: {...s.titleLength, min: parseInt(e.target.value) || 0}}))}
                                    className="w-full bg-dark-950 border border-white/5 rounded-2xl py-3.5 text-center text-[12px] font-black text-white outline-none font-mono"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-700 uppercase">Min</span>
                            </div>
                            <div className="w-3 h-[1px] bg-slate-800"></div>
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    value={settings.titleLength.max}
                                    onChange={(e) => setSettings(s => ({...s, titleLength: {...s.titleLength, max: parseInt(e.target.value) || 0}}))}
                                    className="w-full bg-dark-950 border border-white/5 rounded-2xl py-3.5 text-center text-[12px] font-black text-white outline-none font-mono"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-700 uppercase">Max</span>
                            </div>
                        </div>
                    </ControlGroup>
                </div>
            </div>

            {/* VISUAL ISOLATION SECTION */}
            <div className="space-y-4">
                <div className="flex items-center gap-4 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,1)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Asset Refinement</h2>
                </div>
                <div className="bg-dark-950/40 border border-white/5 rounded-[2.5rem] p-4 space-y-1 shadow-inner">
                    <ToggleRow 
                        label="White Suffix" 
                        subLabel="Stock Classic"
                        checked={settings.isolatedWhite} 
                        onChange={(v) => setSettings(s => ({ ...s, isolatedWhite: v, isolatedTransparent: v ? false : s.isolatedTransparent }))} 
                    />
                    <div className="h-[1px] bg-white/[0.03] mx-3"></div>
                    <ToggleRow 
                        label="Alpha Layer" 
                        subLabel="Transparent"
                        checked={settings.isolatedTransparent} 
                        onChange={(v) => setSettings(s => ({ ...s, isolatedTransparent: v, isolatedWhite: v ? false : s.isolatedWhite }))} 
                    />
                </div>
            </div>
        </div>
    );
};