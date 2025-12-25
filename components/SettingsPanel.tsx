
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
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</label>
            {rightElement}
        </div>
        {children}
    </div>
);

const ToggleRow: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-3 px-1 group cursor-pointer" onClick={() => onChange(!checked)}>
        <span className="text-[13px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
        <button
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 focus:outline-none ${
                checked ? 'bg-indigo-500 shadow-[0_0_12px_rgba(79,70,229,0.4)]' : 'bg-white/[0.05] border border-white/[0.05]'
            }`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${
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
        <div className="space-y-10">
            {/* PLATFORM SECTION */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-1 h-3.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Operational Target</h2>
                </div>
                
                <div className="bg-[#0D0E12] border border-white/[0.05] rounded-3xl p-6 space-y-6 shadow-inner">
                    <ControlGroup label="Asset Marketplace">
                        <div className="relative group">
                            <select 
                                value={settings.platform} 
                                onChange={(e) => setSettings(s => ({...s, platform: e.target.value as Platform}))}
                                className="w-full bg-black/40 border border-white/[0.05] rounded-2xl px-5 py-4 text-[13px] font-bold text-white focus:border-indigo-500/40 appearance-none cursor-pointer hover:bg-black/60 transition-all outline-none"
                            >
                                {platforms.map(p => <option key={p} value={p} className="bg-[#111]">{p}</option>)}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </ControlGroup>
                </div>
            </div>

            {/* AI CONFIGURATION */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-1 h-3.5 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Intelligence Grid</h2>
                </div>

                <div className="bg-[#0D0E12] border border-white/[0.05] rounded-3xl p-6 space-y-7 shadow-inner">
                    <ControlGroup 
                        label="AI Engine" 
                        rightElement={
                            <button onClick={onOpenVault} className="text-[9px] font-black text-indigo-400 hover:text-white transition-colors flex items-center gap-1.5 uppercase tracking-tighter">
                                <SettingsGearIcon className="w-3 h-3" /> Manage API Keys
                            </button>
                        }
                    >
                        <select 
                            value={settings.aiProvider} 
                            onChange={(e) => setSettings(s => ({...s, aiProvider: e.target.value as AIProvider}))}
                            className="w-full bg-black/40 border border-white/[0.05] rounded-2xl px-5 py-3.5 text-[13px] font-bold text-white focus:border-indigo-500/40 appearance-none cursor-pointer outline-none transition-all"
                        >
                            {Object.values(AIProvider).map(p => <option key={p} value={p} className="bg-[#111]">{p}</option>)}
                        </select>
                        <div className="flex items-center justify-between px-2 mt-2">
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${activeKeyCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{activeKeyCount} Nodes Online</span>
                            </div>
                            {settings.safeMode && (
                                <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold uppercase tracking-tighter">
                                    <InfoIcon className="w-3 h-3" /> Safe Mode Active
                                </div>
                            )}
                        </div>
                    </ControlGroup>

                    <ControlGroup label="Analysis Model">
                        <select 
                            value={settings.activeModels[settings.aiProvider]} 
                            onChange={(e) => setSettings(s => ({
                                ...s, 
                                activeModels: { ...s.activeModels, [settings.aiProvider]: e.target.value }
                            }))}
                            className="w-full bg-black/40 border border-white/[0.05] rounded-2xl px-5 py-3.5 text-[13px] font-bold text-white focus:border-purple-500/40 appearance-none cursor-pointer outline-none transition-all"
                        >
                            {availableModels.map(m => <option key={m.id} value={m.id} className="bg-[#111]">{m.name}</option>)}
                        </select>
                    </ControlGroup>
                </div>
            </div>

            {/* PARAMETERS SECTION */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-1 h-3.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">SEO Parameters</h2>
                </div>

                <div className="bg-[#0D0E12] border border-white/[0.05] rounded-3xl p-6 space-y-6 shadow-inner">
                    <div className="grid grid-cols-2 gap-4">
                        <ControlGroup label="Keywords (Max)">
                            <input 
                                type="number" 
                                value={settings.maxKeywords}
                                onChange={(e) => setSettings(s => ({...s, maxKeywords: parseInt(e.target.value) || 0}))}
                                className="w-full bg-black/40 border border-white/[0.05] rounded-2xl py-3 px-4 text-center text-[13px] font-black text-white outline-none focus:border-indigo-500/30 transition-all"
                            />
                        </ControlGroup>
                        <ControlGroup label="Safe Batch">
                            <div className="h-full flex items-center justify-center bg-black/20 rounded-2xl border border-white/[0.02]">
                                <ToggleRow label="" checked={settings.safeMode} onChange={(v) => setSettings(s => ({...s, safeMode: v}))} />
                            </div>
                        </ControlGroup>
                    </div>

                    <ControlGroup label="Title Bounds (Min/Max)">
                        <div className="flex items-center gap-3">
                            <input 
                                type="number" 
                                value={settings.titleLength.min}
                                onChange={(e) => setSettings(s => ({...s, titleLength: {...s.titleLength, min: parseInt(e.target.value) || 0}}))}
                                className="w-1/2 bg-black/40 border border-white/[0.05] rounded-2xl py-3 text-center text-[13px] font-black text-white outline-none"
                            />
                            <div className="w-4 h-[1px] bg-slate-800"></div>
                            <input 
                                type="number" 
                                value={settings.titleLength.max}
                                onChange={(e) => setSettings(s => ({...s, titleLength: {...s.titleLength, max: parseInt(e.target.value) || 0}}))}
                                className="w-1/2 bg-black/40 border border-white/[0.05] rounded-2xl py-3 text-center text-[13px] font-black text-white outline-none"
                            />
                        </div>
                    </ControlGroup>
                </div>
            </div>

            {/* VISUAL ISOLATION SECTION - MODERNIZED */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-1 h-3.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Asset Intelligence</h2>
                </div>
                <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 rounded-[2.2rem] p-7 space-y-2 shadow-inner">
                    <ToggleRow 
                        label="White Isolation" 
                        checked={settings.isolatedWhite} 
                        onChange={(v) => setSettings(s => ({ ...s, isolatedWhite: v, isolatedTransparent: v ? false : s.isolatedTransparent }))} 
                    />
                    <div className="h-[1px] bg-white/[0.03] mx-1"></div>
                    <ToggleRow 
                        label="Alpha Transparency" 
                        checked={settings.isolatedTransparent} 
                        onChange={(v) => setSettings(s => ({ ...s, isolatedTransparent: v, isolatedWhite: v ? false : s.isolatedWhite }))} 
                    />
                </div>
            </div>
        </div>
    );
};
