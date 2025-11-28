
import React, { useState, useEffect, useRef } from 'react';
import { ProcessedFile, FileStatus, Platform } from '../types';
import { RefreshIcon, TrashIcon, VectorIcon, UploadIcon, InfoIcon, CopyIcon, CheckIcon } from './icons';
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

const getStatusColor = (status: FileStatus) => {
    switch (status) {
        case FileStatus.PENDING: return "bg-gray-700 border-gray-600 text-gray-300";
        case FileStatus.PROCESSING: return "bg-blue-900/30 border-blue-700/50 text-blue-300";
        case FileStatus.COMPLETED: return "bg-green-900/30 border-green-700/50 text-green-300";
        case FileStatus.ERROR: return "bg-red-900/30 border-red-700/50 text-red-300";
        default: return "bg-gray-700 border-gray-600 text-gray-300";
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
        <button onClick={handleCopy} className={`p-1 rounded hover:bg-white/10 transition-colors ${copied ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}>
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
    );
};

const MetadataInput: React.FC<{ label: string; value: string; onChange: (e: any) => void; onBlur: () => void; rows?: number; count?: number | string }> = ({ label, value, onChange, onBlur, rows=1, count }) => (
    <div className="relative group">
        <div className="flex justify-between items-center mb-1">
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
             <div className="flex items-center space-x-2">
                 {count !== undefined && <span className="text-[10px] text-gray-600">{count}</span>}
                 <CopyButton text={value} />
             </div>
        </div>
        {rows > 1 ? (
             <textarea
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                rows={rows}
                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            />
        ) : (
             <input
                type="text"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
        <div onClick={() => inputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded border border-dashed border-gray-600 hover:border-blue-500 cursor-pointer transition-colors group">
            <input ref={inputRef} type="file" className="hidden" onChange={handleChange} accept="image/jpeg,image/png" />
            <UploadIcon />
            <span className="text-[10px] text-gray-500 group-hover:text-blue-400 mt-1">Add Preview</span>
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
        const existingKeyword = localMetadata.keywords.find(k => k.toLowerCase() === keyword.toLowerCase()) || keyword;
        const newAllKeywords = localMetadata.keywords.includes(existingKeyword) ? localMetadata.keywords : [...localMetadata.keywords, existingKeyword];
        const newSelectedKeywords = [...localMetadata.selectedKeywords, existingKeyword];
        onUpdateMetadata(id, { keywords: newAllKeywords, selectedKeywords: newSelectedKeywords });
    };

    const isVideo = file.type.startsWith('video/');
    const isVectorWithoutPreview = !preview && (file.name.toLowerCase().endsWith('.eps') || file.name.toLowerCase().endsWith('.ai'));

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden flex flex-col md:flex-row">
            {/* Visual Column */}
            <div className="w-full md:w-48 bg-black/20 flex-shrink-0 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-700 relative group">
                <div className="w-full h-48 md:h-full p-4">
                    {isVectorWithoutPreview ? (
                        <PreviewUploader onFileSelect={(f) => onAddPreview(id, f)} />
                    ) : (
                        <div className="w-full h-full relative rounded overflow-hidden bg-gray-900 border border-gray-700">
                             {isVideo ? <video src={preview} className="w-full h-full object-cover" /> : <img src={preview} className="w-full h-full object-contain" />}
                        </div>
                    )}
                </div>
                {/* Overlay Controls (Original) */}
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onRegenerate(id)} className="p-1.5 bg-gray-900/80 text-white rounded hover:bg-blue-600 transition-colors" title="Regenerate"><RefreshIcon/></button>
                    <button onClick={() => onRemove(id)} className="p-1.5 bg-gray-900/80 text-red-400 rounded hover:bg-red-900 transition-colors" title="Remove"><TrashIcon/></button>
                </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 p-5 space-y-4 min-w-0">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-200 truncate pr-2" title={file.name}>{file.name}</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-mono mt-0.5">{(file.size / 1024).toFixed(0)} KB • {file.type || 'Unknown Type'}</p>
                    </div>
                    {/* Status and Actions */}
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <button 
                            onClick={() => onRegenerate(id)} 
                            disabled={isProcessing}
                            className="p-1.5 text-xs font-medium bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white rounded transition-colors disabled:opacity-50 flex items-center"
                            title="Regenerate Metadata"
                        >
                            <RefreshIcon className="w-3 h-3 mr-1" />
                            Regenerate
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getStatusColor(status)}`}>
                            {status}
                        </span>
                    </div>
                </div>
                
                {error && (
                    <div className="bg-red-900/10 border border-red-500/20 p-3 rounded text-xs text-red-300">
                        <span className="font-bold block mb-1">Error:</span> {error}
                    </div>
                )}

                <div className="space-y-3">
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
                    <div className="pt-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Keywords</label>
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
