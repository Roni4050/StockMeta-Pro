
import React from 'react';
import { ProcessedFile, FileStatus } from '../types';
import { TrashIcon, CheckCircleIcon, RefreshIcon, InfoIcon } from './icons';

interface StatusDashboardProps {
    files: ProcessedFile[];
    onClear: () => void;
    isProcessing: boolean;
}

const StatCard: React.FC<{ label: string; value: number; colorClass: string; gradientClass: string; icon: React.ReactNode; isPulse?: boolean }> = ({ label, value, colorClass, gradientClass, icon, isPulse }) => (
    <div className={`relative rounded-2xl border border-white/5 p-6 flex flex-col justify-between overflow-hidden backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-white/10 group shadow-lg ${gradientClass}`}>
        <div className="absolute -top-6 -right-6 p-4 opacity-10 transform scale-[2] transition-transform group-hover:scale-[2.2] group-hover:rotate-12 duration-500">
            {icon}
        </div>
        <div className="relative z-10">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2 opacity-80">{label}</p>
            <div className="flex items-center space-x-2">
                <p className={`text-4xl font-black tracking-tighter ${colorClass} ${isPulse && value > 0 ? 'animate-pulse' : ''}`}>{value}</p>
            </div>
        </div>
    </div>
);

export const StatusDashboard: React.FC<StatusDashboardProps> = ({ files, onClear, isProcessing }) => {
    if (files.length === 0) {
        return null;
    }

    const totalFiles = files.length;
    const completedCount = files.filter(f => f.status === FileStatus.COMPLETED).length;
    const processingCount = files.filter(f => f.status === FileStatus.PROCESSING || f.status === FileStatus.PENDING).length;
    const errorCount = files.filter(f => f.status === FileStatus.ERROR).length;

    return (
        <div className="mb-10">
            <div className="flex justify-between items-center mb-5">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
                    Session Overview
                </h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <StatCard 
                    label="Total Assets" 
                    value={totalFiles} 
                    colorClass="text-white"
                    gradientClass="bg-gradient-to-br from-slate-800/40 to-slate-900/40"
                    icon={<div className="scale-125"><RefreshIcon/></div>}
                />
                 <StatCard 
                    label="Processing" 
                    value={processingCount} 
                    colorClass="text-indigo-200"
                    gradientClass="bg-gradient-to-br from-indigo-900/30 to-slate-900/40 border-indigo-500/20"
                    icon={<RefreshIcon/>}
                    isPulse={isProcessing}
                />
                 <StatCard 
                    label="Completed" 
                    value={completedCount} 
                    colorClass="text-emerald-200"
                    gradientClass="bg-gradient-to-br from-emerald-900/20 to-slate-900/40 border-emerald-500/20"
                    icon={<CheckCircleIcon/>}
                />
                 <StatCard 
                    label="Issues" 
                    value={errorCount} 
                    colorClass="text-rose-200"
                    gradientClass="bg-gradient-to-br from-rose-900/20 to-slate-900/40 border-rose-500/20"
                    icon={<InfoIcon/>}
                />
            </div>
        </div>
    );
};
