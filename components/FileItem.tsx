
import React, { useState, useEffect, useRef } from 'react';
import { ProcessedFile, FileStatus, Platform } from '../types';
import { RefreshIcon, TrashIcon, UploadIcon, CopyIcon, InfoIcon } from './icons';
import { KeywordSelector } from './KeywordSelector';

interface FileItemProps {
    fileData: ProcessedFile;
    onRegenerate: (id: string) => void;
    onRemove: (id: string) => void;
    onUpdateFile: (id: string, updates: Partial<ProcessedFile>) => void;
    onAddPreview: (id: string, previewFile: File) => void;
    isProcessing: boolean;
    platform: Platform;
    maxKeywords: number;
}

export const FileItem: React.FC<FileItemProps> = React.memo(({ fileData, onRegenerate, onRemove, onUpdateFile, onAddPreview, isProcessing, platform, maxKeywords }) => {
    const { id, file, preview, status, metadata, error } = fileData;
    const [localTitle, setLocalTitle] = useState(metadata.title);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { setLocalTitle(metadata.title); }, [metadata.title]);

    const handleTitleBlur = () => {
        if (localTitle !== metadata.title) {
            onUpdateFile(id, { metadata: { ...metadata, title: localTitle } });
        }
    };

    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov');
    const isVector = ['.eps', '.ai', '.svg'].some(ext => file.name.toLowerCase().endsWith(ext));

    return (
        <div className={`bg-[#0A0B0E] border rounded-[2rem] overflow-hidden flex flex-col xl:flex-row shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] group/card relative transition-all duration-500 hover:border-white/10 ${
            status === FileStatus.ERROR ? 'border-rose-500/20 shadow-rose-900/10' : 'border-white/[0.04]'
        }`}>
            
            {/* PROGRESS OVERLAY */}
            {status === FileStatus.PROCESSING && (
                <div className="absolute inset-0 bg-indigo-500/[0.02] z-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_2s_infinite]"></div>
                </div>
            )}

            {/* PREVIEW PANEL */}
            <div className="w-full xl:w-[320px] flex-shrink-0 bg-black/40 p-8 border-b xl:border-b-0 xl:border-r border-white/[0.04] relative z-10">
                <div className="relative aspect-square xl:aspect-[3/4] rounded-2xl overflow-hidden bg-[#0F1014] border border-white/[0.08] group/preview shadow-2xl transition-transform duration-500 group-hover/card:scale-[1.02]">
                    {!preview && isVector ? (
                        <PreviewUploader onFileSelect={(f) => onAddPreview(id, f)} />
                    ) : isVideo ? (
                        <video ref={videoRef} src={preview} className="w-full h-full object-cover" muted playsInline onMouseEnter={() => videoRef.current?.play()} onMouseLeave={() => videoRef.current?.pause()} />
                    ) : (
                        <img src={preview} className="w-full h-full object-contain" alt={file.name} />
                    )}
                    
                    {/* Floating Actions */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2.5 opacity-0 group-hover/preview:opacity-100 transition-all duration-500 translate-x-2 group-hover/preview:translate-x-0">
                         <button 
                            onClick={() => onRegenerate(id)} 
                            className="p-3 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 text-white hover:bg-indigo-600 transition-all shadow-2xl"
                            title="Regenerate Metadata"
                        >
                            <RefreshIcon className="w-4 h-4" />
                        </button>
                         <button 
                            onClick={() => onRemove(id)} 
                            className="p-3 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all shadow-2xl"
                            title="Remove Asset"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md text-[10px] font-black flex justify-between text-slate-400 border-t border-white/[0.04]">
                        <span className="truncate w-3/4 tracking-tight uppercase">{file.name}</span>
                        <span className="text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                    </div>
                </div>
            </div>

            {/* METADATA EDITOR PANEL */}
            <div className="flex-1 p-10 space-y-10 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                         <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border transition-all flex items-center gap-2 ${
                             status === FileStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                             status === FileStatus.PROCESSING ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                             status === FileStatus.ERROR ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                             'bg-white/[0.03] text-slate-500 border-white/[0.05]'
                         }`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${
                                 status === FileStatus.COMPLETED ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 
                                 status === FileStatus.PROCESSING ? 'bg-indigo-400 animate-pulse' :
                                 status === FileStatus.ERROR ? 'bg-rose-400' : 'bg-slate-700'
                             }`}></div>
                             {status === FileStatus.COMPLETED ? 'Operational' : status === FileStatus.PROCESSING ? 'Analyzing' : status === FileStatus.ERROR ? 'Fault' : 'Standby'}
                         </div>
                         <h3 className="text-sm font-black text-white/90 tracking-tight max-w-[300px] truncate">{file.name}</h3>
                    </div>
                    
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-[10px] font-bold uppercase bg-rose-500/5 px-4 py-2 rounded-xl border border-rose-500/10">
                            <InfoIcon className="w-3.5 h-3.5" />
                            {error}
                        </div>
                    )}
                </div>

                {/* TITLE INPUT */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">SEO Asset Title</label>
                            <div className="px-2 py-0.5 rounded-md bg-white/[0.03] text-[9px] font-bold text-slate-600 border border-white/[0.05] uppercase tracking-tighter">
                                Target: ${platform}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className={`text-[10px] font-mono px-3 py-1 rounded-lg border flex items-center gap-2 ${
                                 localTitle.length > 0 ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' : 'bg-black/40 border-white/[0.04] text-slate-700'
                             }`}>
                                <span className="font-black">{localTitle.length}</span>
                                <span className="opacity-40 uppercase text-[8px]">Chars</span>
                             </div>
                             <button 
                                onClick={() => localTitle && navigator.clipboard.writeText(localTitle)} 
                                className="p-2 text-slate-600 hover:text-indigo-400 transition-all active:scale-90"
                                title="Copy Content"
                             >
                                <CopyIcon className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
                    <textarea 
                        value={localTitle} 
                        onChange={(e) => setLocalTitle(e.target.value)} 
                        onBlur={handleTitleBlur}
                        rows={2}
                        placeholder="Neural engine output will populate here..."
                        className="w-full bg-black/40 border border-white/[0.05] rounded-2xl px-6 py-5 text-[15px] text-white/80 focus:border-indigo-500/30 focus:bg-black/60 transition-all font-medium resize-none leading-relaxed outline-none shadow-inner" 
                    />
                </div>

                {/* KEYWORDS */}
                <div className="space-y-4">
                     <div className="flex justify-between items-center px-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Global Keyword Index</label>
                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-white/[0.02] px-3 py-1 rounded-lg">
                            {metadata.selectedKeywords.length} of {maxKeywords} Deployed
                        </div>
                    </div>
                    <div className="bg-black/30 border border-white/[0.03] rounded-[2rem] p-8 shadow-inner">
                        <KeywordSelector
                            allKeywords={metadata.keywords}
                            selectedKeywords={metadata.selectedKeywords}
                            onChange={(k) => onUpdateFile(id, { metadata: { ...metadata, selectedKeywords: k } })}
                            onAddKeyword={(k) => {
                                const newKeywords = Array.from(new Set([...metadata.keywords, k]));
                                const newSelected = Array.from(new Set([...metadata.selectedKeywords, k])).slice(0, maxKeywords);
                                onUpdateFile(id, { 
                                    metadata: {
                                        ...metadata,
                                        keywords: newKeywords, 
                                        selectedKeywords: newSelected 
                                    }
                                });
                            }}
                            maxKeywords={maxKeywords}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

const PreviewUploader: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div onClick={() => inputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center bg-black/50 border-2 border-dashed border-white/5 rounded-xl hover:border-indigo-500/40 hover:bg-black/70 cursor-pointer transition-all duration-300">
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} accept="image/jpeg,image/png" />
            <UploadIcon className="w-8 h-8 text-slate-700 mb-4" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center px-8 leading-relaxed">
                Map Preview Sidecar (.JPG)
            </span>
        </div>
    );
};
