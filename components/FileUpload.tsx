
// Added React import to fix 'Cannot find namespace React' errors
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
            className={`group relative w-full p-16 rounded-[3rem] border-2 border-dashed transition-all duration-500 ease-out overflow-hidden cursor-pointer ${
                isDragging 
                    ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_100px_-30px_rgba(99,102,241,0.3)] scale-[1.01]' 
                    : 'border-white/5 bg-[#0A0A0A] hover:bg-[#0E0E0E] hover:border-white/10'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => !isUploading && document.getElementById('file-upload')?.click()}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.02] to-purple-500/[0.02] pointer-events-none"></div>
            
            <div className="relative z-10 space-y-8 text-center">
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="relative w-20 h-20 mb-8">
                            <div className="absolute inset-0 border-[3px] border-white/5 rounded-full"></div>
                            <div className="absolute inset-0 border-[3px] border-transparent border-t-indigo-500 rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-xl font-extrabold text-white tracking-tight animate-pulse">Initializing SEO Analysis...</h3>
                    </div>
                ) : (
                    <>
                        <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center bg-[#111111] border border-white/5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] relative transition-all duration-700 group-hover:scale-110 group-hover:border-indigo-500/30 ${isDragging ? 'animate-bounce' : ''}`}>
                             <div className="absolute inset-0 bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                             <svg className={`w-10 h-10 relative z-10 ${isDragging ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors duration-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                            </svg>
                        </div>
                        
                        <div className="space-y-3">
                            <h2 className="text-2xl font-extrabold text-white tracking-tight">
                                <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">Import Assets</span>
                                <span className="mx-3 text-slate-600 font-medium">or drop files</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.3em] max-w-md mx-auto leading-relaxed">
                                EPS • JPJ • JPG • PNG • Video (MP4/MOV)
                            </p>
                        </div>

                         <div className="flex justify-center gap-4 mt-10">
                             <div className="px-5 py-2 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Adobe Stock Guidelines Sync: Active</span>
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
                accept="image/jpeg,image/png,image/svg+xml,video/mp4,video/quicktime,application/postscript,application/illustrator,application/eps,.jpj" 
            />
        </div>
    );
};
