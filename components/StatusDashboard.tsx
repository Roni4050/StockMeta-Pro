
import React from 'react';
import { ProcessedFile, FileStatus } from '../types';

interface StatusDashboardProps {
    files: ProcessedFile[];
    onClear: () => void;
    isProcessing: boolean;
}

const StatCard: React.FC<{ label: string; value: number; colorClass: string; borderColor: string; glowColor: string; icon?: React.ReactNode }> = ({ label, value, colorClass, borderColor, glowColor, icon }) => (
    <div className={`relative bg-black/40 border ${borderColor} rounded-[2rem] p-8 flex flex-col justify-between shadow-2xl overflow-hidden group min-h-[160px] transition-all duration-500 hover:bg-black/60`}>
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none"></div>
        
        {/* Glow */}
        <div className={`absolute -top-12 -right-12 w-32 h-32 ${glowColor} opacity-5 blur-[60px] pointer-events-none group-hover:opacity-15 transition-opacity duration-1000`}></div>
        
        <div className="flex justify-between items-start relative z-10">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{label}</p>
            {icon}
        </div>
        
        <div className="relative z-10 mt-6">
            <span className={`text-5xl font-black ${colorClass} tracking-tighter leading-none`}>
                {value.toString().padStart(2, '0')}
            </span>
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
        <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,1)] animate-pulse"></div>
                    <h2 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em]">Real-time Telemetry</h2>
                </div>
                <div className="flex items-center gap-3">
                     <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Compute Health:</span>
                     <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className={`w-1.5 h-3 rounded-sm ${processing > 0 && i < 4 ? 'bg-indigo-500/50 animate-pulse' : 'bg-emerald-500/50'}`}></div>
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
                    colorClass="text-indigo-400"
                    borderColor="border-indigo-500/10"
                    glowColor="bg-indigo-500"
                />
                <StatCard 
                    label="Processed" 
                    value={completed} 
                    colorClass="text-emerald-400"
                    borderColor="border-emerald-500/10"
                    glowColor="bg-emerald-500"
                />
                <StatCard 
                    label="Exceptions" 
                    value={errors} 
                    colorClass="text-rose-400"
                    borderColor="border-rose-500/10"
                    glowColor="bg-rose-500"
                />
            </div>
        </div>
    );
};
