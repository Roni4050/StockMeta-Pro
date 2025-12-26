import React, { useState, useEffect, useRef } from 'react';
import { ProcessedFile, FileStatus, Platform } from '../types';
import { RefreshIcon, TrashIcon, UploadIcon, CopyIcon, InfoIcon, CheckIcon } from './icons';
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
    const [copied, setCopied] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { setLocalTitle(metadata.title); }, [metadata.title]);

    const handleTitleBlur = () => {
        if (localTitle !== metadata.title) {
            onUpdateFile(id, { metadata: { ...metadata, title: localTitle } });
        }
    };

    const handleCopyTitle = () => {
        if (!localTitle) return;
        navigator.clipboard.writeText(localTitle).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov');
    const isVector = ['.eps', '.ai', '.svg'].some(ext => file.name.toLowerCase().endsWith(ext));

    return (
        <div className={`glass-card rounded-[2.5rem] overflow-hidden flex flex-col xl:flex-row inner-glow transition-all duration-500 relative group/card shadow-2xl ${
            status === FileStatus.ERROR ? 'border-rose-500/20' : 'hover:border-white/10'
        }`}>
            
            {/* PROGRESS OVERLAY */}
            {status === FileStatus.PROCESSING && (
                <div className="absolute inset-0 bg-brand-500/[0.01] z-0 pointer-events-none">
                    <div className="absolute bottom-0 left-0 h-1 bg-brand-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[shimmer_2s_infinite]"></div>
                </div>
            )}

            {/* PREVIEW PANEL */}
            <div className="w-full xl:w-[350px] flex-shrink-0 bg-dark-950/40 p-8 border-b xl:border-b-0 xl:border-r border-white/[0.04] relative z-10 flex flex-col justify-between">
                <div className="relative aspect-square xl:aspect-auto xl:h-[320px] rounded-3xl overflow-hidden bg-dark-950 border border-white/5 group/preview shadow-2xl transition-transform duration-700 group-hover/card:scale-[1.02]">
                    {!preview && isVector ? (
                        <PreviewUploader onFileSelect={(f) => onAddPreview(id, f)} />
                    ) : isVideo ? (
                        <video ref={videoRef} src={preview} className="w-full h-full object-cover" muted playsInline onMouseEnter={() => videoRef.current?.play()} onMouseLeave={() => videoRef.current?.pause()} />
                    ) : (
                        <img src={preview} className="w-full h-full object-contain" alt={file.name} />
                    )}
                    
                    {/* Floating Actions */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2.5 opacity-0 group-hover/preview:opacity-100 transition-all duration-500 translate-x-3 group-hover/preview:translate-x-0">
                         <button 
                            onClick={() => onRegenerate(id)} 
                            className="p-3 bg-dark-950/80 backdrop-blur-xl rounded-2xl border border-white/10 text-white hover:bg-brand-600 transition-all shadow-2xl"
                            title="Refactor Metadata"
                        >
                            <RefreshIcon className="w-4 h-4" />
                        </button>
                         <button 
                            onClick={() => onRemove(id)} 
                            className="p-3 bg-dark-950/80 backdrop-blur-xl rounded-2xl border border-white/10 text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-2xl"
                            title="Drop Asset"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Asset ID</span>
                        <span className="text-[10px] font-mono text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <p className="text-[12px] font-bold text-slate-400 truncate uppercase tracking-tight">{file.name}</p>
                </div>
            </div>

            {/* METADATA EDITOR PANEL */}
            <div className="flex-1 p-10 space-y-10 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                         <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all flex items-center gap-2.5 ${
                             status === FileStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                             status === FileStatus.PROCESSING ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' :
                             status === FileStatus.ERROR ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                             'bg-white/[0.03] text-slate-500 border-white/[0.05]'
                         }`}>
                             <div className={`w-2 h-2 rounded-full ${
                                 status === FileStatus.COMPLETED ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 
                                 status === FileStatus.PROCESSING ? 'bg-brand-400 animate-pulse' :
                                 status === FileStatus.ERROR ? 'bg-rose-400' : 'bg-slate-700'
                             }`}></div>
                             {status === FileStatus.COMPLETED ? 'Ready for Export' : status === FileStatus.PROCESSING ? 'Neural Scan' : status === FileStatus.ERROR ? 'Sync Failed' : 'Idle'}
                         </div>
                         <div className="h-4 w-[1px] bg-white/5"></div>
                         <p className="text-xs font-black text-slate-600 uppercase tracking-widest">{isVideo ? 'MP4 VIDEO' : isVector ? 'EPS VECTOR' : 'RASTER IMAGE'}</p>
                    </div>
                    
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase bg-rose-500/5 px-4 py-2.5 rounded-2xl border border-rose-500/10 animate-pulse tracking-widest">
                            <InfoIcon className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                {/* TITLE INPUT */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Generated Title</label>
                            <div className="px-2.5 py-1 rounded-md bg-brand-500/10 text-[9px] font-black text-brand-400 border border-brand-500/20 uppercase tracking-tighter">
                                Target: {platform}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                                 localTitle.length > 0 ? 'bg-brand-500/5 border-brand-500/10 text-brand-300' : 'bg-dark-950 border-white/5 text-slate-700'
                             }`}>
                                <span className="font-black">{localTitle.length}</span>
                                <span className="opacity-40 uppercase text-[8px] font-black tracking-widest">Chars</span>
                             </div>
                             <button 
                                onClick={handleCopyTitle} 
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest ${
                                    copied ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-brand-500/5 border-brand-500/10 text-slate-500 hover:text-brand-400 hover:border-brand-500/30'
                                }`}
                                title="Copy Content"
                             >
                                {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                {copied ? 'Copied' : 'Copy'}
                             </button>
                        </div>
                    </div>
                    <textarea 
                        value={localTitle} 
                        onChange={(e) => setLocalTitle(e.target.value)} 
                        onBlur={handleTitleBlur}
                        rows={2}
                        placeholder="Neural engine results will appear here after analysis..."
                        className="w-full bg-dark-950/50 border border-white/5 rounded-3xl px-8 py-6 text-[15px] text-white/90 placeholder:text-slate-700 focus:border-brand-500/30 focus:bg-dark-950 transition-all font-semibold resize-none leading-relaxed outline-none shadow-inner" 
                    />
                </div>

                {/* KEYWORDS */}
                <div className="space-y-5">
                     <div className="flex justify-between items-center px-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">SEO Intelligence Tags</label>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-dark-950 px-4 py-2 rounded-xl border border-white/5">
                            <span className="text-brand-400">{metadata.selectedKeywords.length}</span> / {maxKeywords} Deployed
                        </div>
                    </div>
                    <div className="bg-dark-950/30 border border-white/5 rounded-[2.5rem] p-10 shadow-inner">
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
        <div onClick={() => inputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center bg-dark-950/80 border-2 border-dashed border-white/10 rounded-3xl hover:border-brand-500/40 hover:bg-dark-950 transition-all duration-500 group/sidecar cursor-pointer">
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} accept="image/jpeg,image/png" />
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 group-hover/sidecar:scale-110 group-hover/sidecar:border-brand-500/20 transition-all">
                <UploadIcon className="w-8 h-8 text-slate-600" />
            </div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] text-center px-10 leading-relaxed">
                Add JPG Preview Sidecar
            </span>
            <p className="mt-2 text-[9px] font-bold text-slate-700 uppercase tracking-tighter">Required for EPS analysis</p>
        </div>
    );
};