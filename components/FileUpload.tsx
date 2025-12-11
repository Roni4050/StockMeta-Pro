
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
            className={`group relative w-full p-12 mb-10 rounded-3xl border border-dashed transition-all duration-500 ease-out overflow-hidden ${
                isDragging 
                    ? 'border-indigo-400/80 bg-indigo-900/20 scale-[1.01] shadow-[0_0_50px_-12px_rgba(99,102,241,0.3)] backdrop-blur-xl' 
                    : 'border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-white/20 backdrop-blur-lg'
            } ${isUploading ? 'opacity-90 cursor-wait' : ''}`}
        >
            {/* Ambient Glow in background */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none transition-opacity duration-500 ${isDragging ? 'opacity-100' : 'opacity-0'}`}></div>

            <div className="relative z-10 space-y-6 text-center">
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="relative w-20 h-20 mb-6">
                            <div className="absolute top-0 left-0 w-full h-full border-4 border-white/10 rounded-full"></div>
                            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500 rounded-full animate-spin border-t-transparent shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight animate-pulse">Analyzing Assets...</h3>
                        <p className="text-sm text-slate-400 mt-2 font-medium">Auto-grouping vectors, videos & previews</p>
                    </div>
                ) : (
                    <>
                        <div className={`mx-auto w-24 h-24 rounded-[2rem] flex items-center justify-center bg-gradient-to-br from-slate-800 to-black border border-white/10 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)] group-hover:scale-105 transition-all duration-300 shadow-2xl ${isDragging ? 'rotate-3' : ''}`}>
                            <svg className={`w-12 h-12 ${isDragging ? 'text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'text-slate-400 group-hover:text-indigo-400'} transition-all duration-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="text-lg text-slate-300 font-medium">
                                <label htmlFor="file-upload" className="relative cursor-pointer text-indigo-400 hover:text-indigo-300 font-bold transition-all hover:tracking-wide">
                                    <span>Click to upload</span>
                                    <input 
                                        id="file-upload" 
                                        name="file-upload" 
                                        type="file" 
                                        multiple 
                                        className="sr-only" 
                                        onClick={(e) => (e.currentTarget.value = '')} 
                                        onChange={handleChange} 
                                        accept="image/jpeg,image/png,image/svg+xml,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/x-m4v,application/postscript,application/illustrator,application/eps,application/x-eps,image/x-eps,image/eps,application/pdf,.jpj" 
                                    />
                                </label>
                                <span className="mx-2 text-slate-500">or drag and drop assets</span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">
                                Supports EPS, JPG, PNG, Vectors & Videos up to 4K
                            </p>
                        </div>
                         <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-900/20 border border-indigo-500/20 text-xs font-semibold text-indigo-300 mt-6 backdrop-blur-md">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
                            Smart Grouping Active: Vectors linked to previews automatically
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
