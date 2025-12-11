
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
            className={`group relative w-full p-10 mb-8 rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out ${
                isDragging 
                    ? 'border-indigo-400 bg-indigo-900/20 scale-[1.01] shadow-2xl shadow-indigo-500/20' 
                    : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600'
            } ${isUploading ? 'opacity-70 cursor-wait' : ''}`}
        >
            <div className="space-y-4 text-center">
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="relative w-16 h-16 mb-4">
                            <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-700 rounded-full"></div>
                            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500 rounded-full animate-spin border-t-transparent"></div>
                        </div>
                        <p className="text-lg font-bold text-white tracking-tight">Analysing Assets...</p>
                        <p className="text-sm text-slate-400">Grouping vectors, videos & previews</p>
                    </div>
                ) : (
                    <>
                        <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700 group-hover:border-indigo-500/30 group-hover:scale-110 transition-transform duration-300 shadow-xl ${isDragging ? 'bg-indigo-900/30' : ''}`}>
                            <svg className={`w-10 h-10 ${isDragging ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        
                        <div className="space-y-1">
                            <div className="text-base text-slate-300 font-medium">
                                <label htmlFor="file-upload" className="relative cursor-pointer text-indigo-400 hover:text-indigo-300 hover:underline decoration-indigo-500/30 underline-offset-4 font-bold transition-all">
                                    <span>Upload files</span>
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
                                <span className="mx-1">or drag and drop</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Supports: EPS, JPG, PNG, Vector, Video
                            </p>
                        </div>
                         <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 text-[10px] text-slate-400 mt-4">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                            Smart Bulk Grouping: Vectors + Previews linked automatically
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
