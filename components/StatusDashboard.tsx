import React from 'react';
import { ProcessedFile, FileStatus } from '../types';

interface StatusDashboardProps {
    files: ProcessedFile[];
    onClear: () => void;
    isProcessing: boolean;
}

const StatCard: React.FC<{ label: string; value: number; colorClass: string; borderColor: string; glowColor: string; icon?: React.ReactNode }> = ({ label, value, colorClass, borderColor, glowColor, icon }) => (
    <div className={`relative bg-dark-950/40 border ${borderColor} rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl overflow-hidden group min-h-[160px] transition-all duration-700 hover:bg-dark-950/60 inner-glow`}>
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity"></div>
        
        {/* Glow */}
        <div className={`absolute -top-12 -right-12 w-32 h-32 ${glowColor} opacity-5 blur-[60px] pointer-events-none group-hover:opacity-20 transition-opacity duration-1000`}></div>
        
        <div className="flex justify-between items-start relative z-10">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">{label}</p>
            {icon}
        </div>
        
        <div className="relative z-10 mt-6 flex items-baseline gap-2">
            <span className={`text-5xl font-black ${colorClass} tracking-tighter leading-none`}>
                {value.toString().padStart(2, '0')}
            </span>
            <div className={`h-1.5 w-1.5 rounded-full ${colorClass} opacity-30`}></div>
        </div>
    </div>
);

export const StatusDashboard: React.FC<StatusDashboardProps> = ({ files }) => {
    if (files.length === 0) return null;

    const total = files.length;
    const completed = files.filter(f => f.status === FileStatus.COMPLETED).length;
    const processing = files.filter(f => f.status === FileStatus.PROCESSING || f.status === FileStatus.PENDING).length;
    const errors = files.filter(f => f.status === FileStatus.ERROR).length;

    return (
        <div className="space-y-6 animate-float-in">
            <div className="flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 bg-brand-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)] animate-pulse"></div>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em]">Telemetry Feed</h2>
                </div>
                <div className="flex items-center gap-4">
                     <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Neural Link Capacity:</span>
                     <div className="flex gap-1.5">
                        {[1,2,3,4,5,6,7,8].map(i => (
                            <div key={i} className={`w-1.5 h-4 rounded-[3px] transition-all duration-500 ${processing > 0 && i <= Math.ceil(processing/total * 8) ? 'bg-brand-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse' : 'bg-slate-800'}`}></div>
                        ))}
                     </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label="Active Nodes" 
                    value={total} 
                    colorClass="text-white/90"
                    borderColor="border-white/[0.05]"
                    glowColor="bg-white"
                />
                <StatCard 
                    label="In Pipeline" 
                    value={processing} 
                    colorClass="text-brand-400"
                    borderColor="border-brand-500/10"
                    glowColor="bg-brand-500"
                />
                <StatCard 
                    label="Synced" 
                    value={completed} 
                    colorClass="text-emerald-400"
                    borderColor="border-emerald-500/10"
                    glowColor="bg-emerald-500"
                />
                <StatCard 
                    label="Exceptions" 
                    value={errors} 
                    colorClass="text-rose-500"
                    borderColor="border-rose-500/10"
                    glowColor="bg-rose-500"
                />
            </div>
        </div>
    );
};