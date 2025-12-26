import React, { useCallback, useState } from 'react';

interface FileUploadProps {
    onFilesChange: (files: File[]) => void;
    isUploading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, isUploading = false }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (isUploading) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    }, [isUploading]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (isUploading) return;
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesChange(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    }, [onFilesChange, isUploading]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFilesChange(Array.from(e.target.files));
        }
    };

    return (
        <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`group relative w-full p-16 rounded-[3rem] border-2 border-dashed transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden cursor-pointer glass-card inner-glow ${
                isDragging 
                    ? 'border-brand-500 bg-brand-500/5 shadow-[0_0_80px_-20px_rgba(99,102,241,0.2)] scale-[1.005]' 
                    : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !isUploading && document.getElementById('file-upload')?.click()}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/[0.01] to-purple-500/[0.01] pointer-events-none group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-8">
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="relative w-24 h-24 mb-10">
                            <div className="absolute inset-0 border-[4px] border-white/5 rounded-full"></div>
                            <div className="absolute inset-0 border-[4px] border-transparent border-t-brand-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-4 border-[2px] border-transparent border-b-purple-500 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight animate-pulse uppercase">Ingesting Meta-Data...</h3>
                    </div>
                ) : (
                    <>
                        <div className={`mx-auto w-24 h-24 rounded-[2rem] flex items-center justify-center bg-dark-950 border border-white/5 shadow-2xl relative transition-all duration-700 group-hover:scale-110 group-hover:border-brand-500/30 ${isDragging ? 'animate-bounce' : ''}`}>
                             <div className="absolute inset-0 bg-brand-500/10 blur-2xl group-hover:bg-brand-500/20 transition-all duration-700"></div>
                             <svg className={`w-10 h-10 relative z-10 ${isDragging ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'} transition-colors duration-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                            </svg>
                        </div>
                        
                        <div className="space-y-4 text-center">
                            <h2 className="text-3xl font-black text-white tracking-tighter">
                                <span className="st-active">SYNC MEDIA ASSETS</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em] max-w-md mx-auto leading-relaxed flex items-center justify-center gap-4">
                                <span className="hover:text-slate-300 transition-colors">EPS</span>
                                <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                                <span className="hover:text-slate-300 transition-colors">JPJ</span>
                                <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                                <span className="hover:text-slate-300 transition-colors">MP4</span>
                                <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                                <span className="hover:text-slate-300 transition-colors">VECTOR</span>
                            </p>
                        </div>

                         <div className="flex justify-center gap-4 mt-4">
                             <div className="px-6 py-2.5 rounded-full bg-white/[0.03] border border-white/5 flex items-center gap-3 group-hover:bg-white/[0.05] transition-all">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Stock Standards Encoded</span>
                             </div>
                         </div>
                    </>
                )}
            </div>
            <input 
                id="file-upload" 
                name="file-upload" 
                type="file" 
                multiple 
                className="sr-only" 
                onChange={handleChange} 
                accept="image/jpeg,image/png,image/svg+xml,video/mp4,video/quicktime,application/postscript,application/illustrator,application/eps,.jpj,.eps" 
            />
        </div>
    );
};