
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
            className={`w-full p-8 mb-8 bg-gray-800/50 border-2 ${isDragging ? 'border-teal-400' : 'border-gray-700'} border-dashed rounded-lg transition-colors duration-200 ${isUploading ? 'opacity-70 cursor-wait' : ''}`}
        >
            <div className="space-y-2 text-center">
                {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-4">
                        <svg className="animate-spin h-10 w-10 text-teal-400 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm font-semibold text-gray-300">Processing bulk upload...</p>
                        <p className="text-xs text-gray-500">Matching files and creating previews</p>
                    </div>
                ) : (
                    <>
                        <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex justify-center text-sm text-gray-400">
                            <label htmlFor="file-upload" className="relative cursor-pointer font-semibold text-teal-400 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-teal-500">
                                <span>Click to bulk upload</span>
                                <input 
                                    id="file-upload" 
                                    name="file-upload" 
                                    type="file" 
                                    multiple 
                                    className="sr-only" 
                                    onChange={handleChange} 
                                    accept="image/jpeg,image/png,image/svg+xml,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/x-m4v,application/postscript,application/illustrator,application/eps,application/x-eps,image/x-eps,image/eps,application/pdf" 
                                />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Supported formats:
                            <br />
                            Images: JPG, PNG, SVG
                            <br />
                            Vectors: EPS, AI, PDF
                            <br />
                            Videos: MP4, MOV, AVI, WEBM, MKV
                        </p>
                         <p className="text-xs text-gray-500 pt-1">
                            Tip: For Vector files (EPS/AI), bulk upload matching JPG previews for best results.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
