
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
            return <span className="bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Pending</span>;
        case FileStatus.PROCESSING: 
            return <span className="bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-1.5 animate-pulse"></span>Processing</span>;
        case FileStatus.COMPLETED: 
            return <span className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5"></span>Ready</span>;
        case FileStatus.ERROR: 
            return <span className="bg-rose-900/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Error</span>;
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
        <button onClick={handleCopy} className={`p-1.5 rounded-md hover:bg-slate-700 transition-colors ${copied ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}`} title="Copy to clipboard">
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
};

const MetadataInput: React.FC<{ label: string; value: string; onChange: (e: any) => void; onBlur: () => void; rows?: number; count?: number | string }> = ({ label, value, onChange, onBlur, rows=1, count }) => (
    <div className="relative group">
        <div className="flex justify-between items-end mb-1.5">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
             <div className="flex items-center space-x-2">
                 {count !== undefined && <span className="text-[10px] text-slate-500 font-mono bg-slate-800/50 px-1.5 rounded">{count}</span>}
                 <CopyButton text={value} />
             </div>
        </div>
        {rows > 1 ? (
             <textarea
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                rows={rows}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none shadow-sm hover:border-slate-600"
            />
        ) : (
             <input
                type="text"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm hover:border-slate-600"
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
        <div onClick={() => inputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center bg-slate-800/50 rounded-lg border border-dashed border-slate-600 hover:border-indigo-500 cursor-pointer transition-colors group">
            <input ref={inputRef} type="file" className="hidden" onChange={handleChange} accept="image/jpeg,image/png" />
            <UploadIcon />
            <span className="text-[10px] text-slate-500 group-hover:text-indigo-400 mt-2 font-medium">Upload Preview</span>
        </div>
    );
};

export const FileItem: React.FC<FileItemProps> = React.memo(({ fileData, onRegenerate, onRemove, onUpdateMetadata, onAddPreview, isProcessing, platform, maxKeywords }) => {
    const { id, file, preview, status, metadata, error } = fileData;
    const [localMetadata, setLocalMetadata] = useState(metadata);

    useEffect(() => { setLocalMetadata(metadata); }, [metadata]);

    const handleBlur = (key: keyof ProcessedFile['metadata']) => {
        if (localMetadata[key] !== metadata[key]) {
            onUpdateMetadata(id, { [key]: localMetadata[key] });
        }
    };
    
    const handleKeywordChange = (newSelectedKeywords: string[]) => onUpdateMetadata(id, { selectedKeywords: newSelectedKeywords });

    const handleAddKeyword = (keyword: string) => {
        const lowerKeyword = keyword.toLowerCase();
        
        // 1. Check if it exists in ALL keywords (case-insensitive)
        let existingInAll = localMetadata.keywords.find(k => k.toLowerCase() === lowerKeyword);
        let newAllKeywords = localMetadata.keywords;
        
        if (!existingInAll) {
            newAllKeywords = [...localMetadata.keywords, keyword];
            existingInAll = keyword;
        }

        // 2. Check if it exists in SELECTED keywords (case-insensitive)
        const isAlreadySelected = localMetadata.selectedKeywords.some(k => k.toLowerCase() === lowerKeyword);
        let newSelectedKeywords = localMetadata.selectedKeywords;

        if (!isAlreadySelected) {
            newSelectedKeywords = [...localMetadata.selectedKeywords, existingInAll];
        }

        onUpdateMetadata(id, { keywords: newAllKeywords, selectedKeywords: newSelectedKeywords });
    };

    const isVideo = file.type.startsWith('video/');
    const isVectorWithoutPreview = !preview && (file.name.toLowerCase().endsWith('.eps') || file.name.toLowerCase().endsWith('.ai'));

    return (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-white/5 shadow-lg overflow-hidden flex flex-col md:flex-row hover:border-white/10 transition-colors group">
            {/* Visual Column */}
            <div className="w-full md:w-56 bg-black/20 flex-shrink-0 flex flex-col relative border-b md:border-b-0 md:border-r border-white/5">
                <div className="flex-1 p-4 flex items-center justify-center">
                     {isVectorWithoutPreview ? (
                        <div className="w-full h-40">
                             <PreviewUploader onFileSelect={(f) => onAddPreview(id, f)} />
                        </div>
                    ) : (
                        <div className="relative w-full h-full min-h-[160px] rounded-lg overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxZTI5M2IiLz48cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjM2YzNDQ2IiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjM2YzNDQ2IiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48L3N2Zz4=')]">
                             {isVideo ? <video src={preview} className="w-full h-full object-contain" /> : <img src={preview} className="w-full h-full object-contain" />}
                        </div>
                    )}
                </div>
                
                {/* File Info Bar */}
                <div className="px-4 py-2 bg-slate-900/80 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                     <span className="truncate max-w-[100px]">{file.name}</span>
                     <span>{(file.size / 1024).toFixed(0)}KB</span>
                </div>
                
                {/* Overlay Actions */}
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <button onClick={() => onRegenerate(id)} className="p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-indigo-600 transition-colors border border-slate-700" title="Regenerate"><RefreshIcon className="w-4 h-4"/></button>
                    <button onClick={() => onRemove(id)} className="p-2 bg-slate-900 text-rose-400 rounded-lg shadow-lg hover:bg-rose-900 transition-colors border border-slate-700" title="Remove"><TrashIcon className="w-4 h-4"/></button>
                </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 p-6 space-y-5 min-w-0">
                <div className="flex justify-between items-start">
                     <div>
                        <div className="flex items-center space-x-2 mb-1">
                             {getStatusBadge(status)}
                             {isVideo && <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 rounded">VIDEO</span>}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-200 truncate max-w-md select-all" title={file.name}>{file.name}</h3>
                    </div>
                    
                    <button 
                        onClick={() => onRegenerate(id)} 
                        disabled={isProcessing}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-indigo-600 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50 flex items-center shadow-sm"
                    >
                        <RefreshIcon className="w-3.5 h-3.5 mr-1.5" />
                        Regenerate
                    </button>
                </div>
                
                {error && (
                    <div className="bg-rose-950/30 border border-rose-500/20 p-3 rounded-lg flex items-start space-x-2">
                        <div className="mt-0.5 text-rose-400"><TrashIcon className="w-4 h-4" /></div>
                        <div>
                            <p className="text-xs font-bold text-rose-400">Generation Failed</p>
                            <p className="text-[11px] text-rose-300/80 mt-0.5">{error}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
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
                    <div className="pt-2 border-t border-white/5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Keywords</label>
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
