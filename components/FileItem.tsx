
import React, { useState, useEffect, useRef } from 'react';
import { ProcessedFile, FileStatus, Platform } from '../types';
import { RefreshIcon, TrashIcon, UploadIcon, CopyIcon, CheckIcon } from './icons';
import { KeywordSelector } from './KeywordSelector';

interface FileItemProps {
    fileData: ProcessedFile;
    onRegenerate: (id: string) => void;
    onRemove: (id: string) => void;
    onUpdateMetadata: (id: string, newMetadata: Partial<ProcessedFile['metadata']>) => void;
    onAddPreview: (id: string, previewFile: File) => void;
    isProcessing: boolean;
    platform: Platform;
    maxKeywords: number;
}

const getStatusBadge = (status: FileStatus) => {
    switch (status) {
        case FileStatus.PENDING: 
            return <span className="bg-slate-800/80 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-white/5">Pending</span>;
        case FileStatus.PROCESSING: 
            return <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center border border-indigo-500/20"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>Processing</span>;
        case FileStatus.COMPLETED: 
            return <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center border border-emerald-500/20"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></span>Ready</span>;
        case FileStatus.ERROR: 
            return <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-rose-500/20">Error</span>;
        default: return null;
    }
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault(); 
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={handleCopy} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${copied ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}`} title="Copy to clipboard">
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
};

const MetadataInput: React.FC<{ label: string; value: string; onChange: (e: any) => void; onBlur: () => void; rows?: number; count?: number | string }> = ({ label, value, onChange, onBlur, rows=1, count }) => (
    <div className="relative group">
        <div className="flex justify-between items-end mb-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{label}</label>
             <div className="flex items-center space-x-2">
                 {count !== undefined && <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{count}</span>}
                 <CopyButton text={value} />
             </div>
        </div>
        {rows > 1 ? (
             <textarea
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                rows={rows}
                className="w-full bg-black/20 border-b-2 border-white/5 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-700 focus:bg-black/40 focus:border-indigo-500 focus:ring-0 transition-all resize-none hover:border-white/10"
            />
        ) : (
             <input
                type="text"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                className="w-full bg-black/20 border-b-2 border-white/5 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-700 focus:bg-black/40 focus:border-indigo-500 focus:ring-0 transition-all hover:border-white/10"
            />
        )}
    </div>
);

const PreviewUploader: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onFileSelect(file);
    };
    return (
        <div onClick={() => inputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-white/10 cursor-pointer transition-all group backdrop-blur-sm">
            <input ref={inputRef} type="file" className="hidden" onChange={handleChange} accept="image/jpeg,image/png" />
            <div className="p-3 bg-black/20 rounded-full mb-2 group-hover:scale-110 transition-transform">
                <UploadIcon className="text-slate-500 group-hover:text-indigo-400" />
            </div>
            <span className="text-[10px] text-slate-500 group-hover:text-white font-medium uppercase tracking-wide">Upload Preview</span>
        </div>
    );
};

export const FileItem: React.FC<FileItemProps> = React.memo(({ fileData, onRegenerate, onRemove, onUpdateMetadata, onAddPreview, isProcessing, platform, maxKeywords }) => {
    const { id, file, preview, status, metadata, error } = fileData;
    const [localMetadata, setLocalMetadata] = useState(metadata);
    const [videoResolution, setVideoResolution] = useState<{w: number, h: number} | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { setLocalMetadata(metadata); }, [metadata]);

    const handleBlur = (key: keyof ProcessedFile['metadata']) => {
        if (localMetadata[key] !== metadata[key]) {
            onUpdateMetadata(id, { [key]: localMetadata[key] });
        }
    };
    
    const handleKeywordChange = (newSelectedKeywords: string[]) => onUpdateMetadata(id, { selectedKeywords: newSelectedKeywords });

    const handleAddKeyword = (keyword: string) => {
        const lowerKeyword = keyword.toLowerCase();
        
        let existingInAll = localMetadata.keywords.find(k => k.toLowerCase() === lowerKeyword);
        let newAllKeywords = localMetadata.keywords;
        
        if (!existingInAll) {
            newAllKeywords = [...localMetadata.keywords, keyword];
            existingInAll = keyword;
        }

        const isAlreadySelected = localMetadata.selectedKeywords.some(k => k.toLowerCase() === lowerKeyword);
        let newSelectedKeywords = localMetadata.selectedKeywords;

        if (!isAlreadySelected) {
            newSelectedKeywords = [...localMetadata.selectedKeywords, existingInAll];
        }

        onUpdateMetadata(id, { keywords: newAllKeywords, selectedKeywords: newSelectedKeywords });
    };

    const isVideo = file.type.startsWith('video/');
    const isVectorWithoutPreview = !preview && (file.name.toLowerCase().endsWith('.eps') || file.name.toLowerCase().endsWith('.ai'));

    const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const v = e.currentTarget;
        setVideoResolution({ w: v.videoWidth, h: v.videoHeight });
    };

    const is4K = videoResolution && (videoResolution.w >= 3840 || videoResolution.h >= 3840);
    const isHD = videoResolution && !is4K && (videoResolution.w >= 1920 || videoResolution.h >= 1920);

    return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden flex flex-col md:flex-row hover:border-white/10 transition-all duration-300 group hover:shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
            {/* Visual Column */}
            <div className="w-full md:w-64 bg-black/40 flex-shrink-0 flex flex-col relative border-b md:border-b-0 md:border-r border-white/5">
                <div className="flex-1 p-5 flex items-center justify-center relative overflow-hidden">
                     {/* Glossy overlay */}
                     <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none z-10"></div>
                     
                     {isVectorWithoutPreview ? (
                        <div className="w-full h-40 z-20">
                             <PreviewUploader onFileSelect={(f) => onAddPreview(id, f)} />
                        </div>
                    ) : (
                        <div className="relative w-full h-full min-h-[180px] rounded-xl overflow-hidden bg-white/5 shadow-inner border border-white/5 group-hover:scale-[1.02] transition-transform duration-500">
                             {isVideo ? (
                                <>
                                    <video 
                                        ref={videoRef}
                                        src={preview} 
                                        className="w-full h-full object-cover" 
                                        controls 
                                        muted 
                                        playsInline
                                        onLoadedMetadata={handleVideoLoad}
                                        onMouseEnter={() => videoRef.current?.play().catch(() => {})}
                                        onMouseLeave={() => videoRef.current?.pause()}
                                    />
                                    {is4K && <span className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-amber-400 text-[9px] font-black px-2 py-1 rounded-md border border-amber-500/30 shadow-lg z-30 tracking-widest">4K UHD</span>}
                                    {isHD && !is4K && <span className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-blue-400 text-[9px] font-black px-2 py-1 rounded-md border border-blue-500/30 shadow-lg z-30 tracking-widest">HD</span>}
                                </>
                             ) : (
                                <img src={preview} className="w-full h-full object-cover" />
                             )}
                        </div>
                    )}
                </div>
                
                {/* File Info Bar */}
                <div className="px-5 py-3 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-400 font-mono backdrop-blur-md">
                     <span className="truncate max-w-[120px] opacity-70 hover:opacity-100 transition-opacity">{file.name}</span>
                     <div className="flex items-center space-x-3">
                        {isVideo && videoResolution && <span className="text-indigo-400">{videoResolution.w}x{videoResolution.h}</span>}
                        <span>{(file.size / 1024).toFixed(0)}KB</span>
                     </div>
                </div>
                
                {/* Overlay Actions */}
                <div className="absolute top-3 right-3 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 z-30">
                    <button onClick={() => onRegenerate(id)} className="p-2.5 bg-black/80 text-white rounded-xl shadow-lg hover:bg-indigo-600 transition-colors border border-white/10 backdrop-blur-md" title="Regenerate"><RefreshIcon className="w-4 h-4"/></button>
                    <button onClick={() => onRemove(id)} className="p-2.5 bg-black/80 text-rose-400 rounded-xl shadow-lg hover:bg-rose-900 transition-colors border border-white/10 backdrop-blur-md" title="Remove"><TrashIcon className="w-4 h-4"/></button>
                </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 p-6 space-y-6 min-w-0">
                <div className="flex justify-between items-start">
                     <div>
                        <div className="flex items-center space-x-2 mb-2">
                             {getStatusBadge(status)}
                             {isVideo && <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full border border-white/5">VIDEO</span>}
                        </div>
                        <h3 className="text-base font-bold text-white truncate max-w-lg select-all tracking-tight" title={file.name}>{file.name}</h3>
                    </div>
                    
                    <button 
                        onClick={() => onRegenerate(id)} 
                        disabled={isProcessing}
                        className="px-4 py-2 text-xs font-bold bg-white/5 hover:bg-indigo-600 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all disabled:opacity-50 flex items-center shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                    >
                        <RefreshIcon className="w-3.5 h-3.5 mr-2" />
                        Regenerate
                    </button>
                </div>
                
                {error && (
                    <div className="bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl flex items-start space-x-3 backdrop-blur-sm">
                        <div className="mt-0.5 text-rose-400 p-1 bg-rose-900/30 rounded-full"><TrashIcon className="w-4 h-4" /></div>
                        <div>
                            <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Generation Failed</p>
                            <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">{error}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    <MetadataInput 
                        label="Title" 
                        value={localMetadata.title} 
                        onChange={(e) => setLocalMetadata(p => ({...p, title: e.target.value}))} 
                        onBlur={() => handleBlur('title')} 
                        count={`${localMetadata.title.length} chars`}
                    />
                    {platform !== Platform.ADOBE_STOCK && (
                         <MetadataInput 
                            label="Description" 
                            value={localMetadata.description} 
                            onChange={(e) => setLocalMetadata(p => ({...p, description: e.target.value}))} 
                            onBlur={() => handleBlur('description')} 
                            rows={2}
                            count={`${localMetadata.description.split(/\s+/).filter(Boolean).length} words`}
                        />
                    )}
                    <div className="pt-4 border-t border-white/5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Keywords</label>
                        <KeywordSelector
                            allKeywords={localMetadata.keywords}
                            selectedKeywords={localMetadata.selectedKeywords}
                            onChange={handleKeywordChange}
                            onAddKeyword={handleAddKeyword}
                            maxKeywords={maxKeywords}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});
