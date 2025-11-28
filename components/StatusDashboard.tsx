
import React from 'react';
import { ProcessedFile, FileStatus } from '../types';
import { TrashIcon, CheckCircleIcon, RefreshIcon } from './icons';

interface StatusDashboardProps {
    files: ProcessedFile[];
    onClear: () => void;
    isProcessing: boolean;
}

const StatCard: React.FC<{ label: string; value: number; colorClass: string; bgClass: string; icon: React.ReactNode }> = ({ label, value, colorClass, bgClass, icon }) => (
    <div className={`rounded-xl border border-gray-700/50 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden ${bgClass}`}>
        <div className="absolute top-0 right-0 p-4 opacity-10 transform scale-150">
            {icon}
        </div>
        <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-2">{label}</p>
        <div className="flex items-end space-x-2">
            <p className={`text-3xl font-bold leading-none ${colorClass}`}>{value}</p>
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
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Session Overview</h2>
                <button
                    onClick={onClear}
                    disabled={isProcessing}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <span className="text-gray-500 group-hover:text-red-400 transition-colors"><TrashIcon /></span>
                    <span className="text-xs font-medium">Clear Session</span>
                </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <StatCard 
                    label="Total Files" 
                    value={totalFiles} 
                    colorClass="text-white"
                    bgClass="bg-gray-800"
                    icon={<div className="scale-125"><RefreshIcon/></div>}
                />
                 <StatCard 
                    label="Completed" 
                    value={completedCount} 
                    colorClass="text-green-400"
                    bgClass="bg-green-900/10"
                    icon={<CheckCircleIcon/>}
                />
                 <StatCard 
                    label="In Progress" 
                    value={processingCount} 
                    colorClass="text-blue-400"
                    bgClass="bg-blue-900/10"
                    icon={<RefreshIcon/>}
                />
                 <StatCard 
                    label="Needs Attention" 
                    value={errorCount} 
                    colorClass="text-red-400"
                    bgClass="bg-red-900/10"
                    icon={<TrashIcon/>}
                />
            </div>
        </div>
    );
};
