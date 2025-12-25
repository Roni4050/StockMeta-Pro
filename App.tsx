
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { Header } from './components/Header';
import { StatusDashboard } from './components/StatusDashboard';
import { ApiVault } from './components/ApiVault';
import { generateMetadata } from './services/geminiService';
import { exportToCsv, exportAdobeStockZip } from './services/csvService';
import { processWithConcurrency } from './services/apiUtils';
import { ProcessedFile, Settings, FileStatus, ImageType, AssetStyle, ApiKey, AIProvider } from './types';
import { PLATFORMS, DEFAULT_SETTINGS } from './constants';
import { TrashIcon, DownloadIcon, ArchiveIcon, RefreshIcon } from './components/icons';

const App: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const saved = localStorage.getItem('metadataGeneratorSettings');
            if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {}
        return DEFAULT_SETTINGS;
    });

    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const settingsRef = useRef(settings);
    
    useEffect(() => {
        settingsRef.current = settings;
        localStorage.setItem('metadataGeneratorSettings', JSON.stringify(settings));
    }, [settings]);

    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const stopProcessingRef = useRef(false);
    const processedFilesRef = useRef(processedFiles);
    
    useEffect(() => { processedFilesRef.current = processedFiles; }, [processedFiles]);

    const handleKeyStatusUpdate = useCallback((provider: AIProvider, keyId: string, status: ApiKey['status']) => {
        setSettings(prev => ({
            ...prev,
            providerKeys: {
                ...prev.providerKeys,
                [provider]: prev.providerKeys[provider].map(k => 
                    k.id === keyId ? { ...k, status } : k
                )
            }
        }));
    }, []);

    const handleUpdateKeys = useCallback((provider: AIProvider, keys: ApiKey[]) => {
        setSettings(prev => ({
            ...prev,
            providerKeys: {
                ...prev.providerKeys,
                [provider]: keys
            }
        }));
    }, []);

    const handleFilesChange = useCallback(async (files: File[]) => {
        setIsUploading(true);
        const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.jpj'];
        
        const newItems: ProcessedFile[] = files.map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            preview: (IMAGE_EXTS.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith('video/')) ? URL.createObjectURL(file) : '',
            status: FileStatus.PENDING,
            metadata: { title: '', description: '', keywords: [], selectedKeywords: [] },
        }));

        setProcessedFiles(prev => [...prev, ...newItems]);
        setIsUploading(false);
    }, []);

    const processFile = useCallback(async (fileId: string) => {
        if (stopProcessingRef.current) return;
        const target = processedFilesRef.current.find(f => f.id === fileId);
        if (!target) return;

        setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, status: FileStatus.PROCESSING, error: undefined } : pf));

        try {
            const result = await generateMetadata(target, settingsRef.current, handleKeyStatusUpdate);
            const finalTitle = `${settingsRef.current.titlePrefix}${result.title}${settingsRef.current.titleSuffix}`.trim();

            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { 
                ...pf, 
                status: FileStatus.COMPLETED, 
                style: result.style as AssetStyle,
                metadata: { 
                    ...result, 
                    title: finalTitle,
                    selectedKeywords: result.keywords.slice(0, settingsRef.current.maxKeywords) 
                }, 
                error: undefined 
            } : pf));
        } catch (error: any) {
            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, status: FileStatus.ERROR, error: error.message } : pf));
        }
    }, [handleKeyStatusUpdate]);

    const handleGenerateAll = async () => {
        if (isProcessing) return;
        stopProcessingRef.current = false;
        const pending = processedFiles.filter(pf => pf.status !== FileStatus.COMPLETED).map(pf => pf.id);

        if (pending.length > 0) {
            setIsProcessing(true);
            const concurrency = settings.aiProvider === AIProvider.GEMINI ? 2 : 5; 
            const delay = settings.safeMode ? 2000 : 200;
            await processWithConcurrency(pending, processFile, concurrency, delay);
            setIsProcessing(false);
        }
    };

    const handlePurge = () => {
        if (confirm("Reset current session data? All processing will stop immediately.")) {
            stopProcessingRef.current = true;
            setIsProcessing(false);
            setProcessedFiles([]);
            // Revoke URLs to free memory
            processedFiles.forEach(f => {
                if (f.preview.startsWith('blob:')) URL.revokeObjectURL(f.preview);
            });
        }
    };

    const pendingCount = processedFiles.filter(pf => pf.status !== FileStatus.COMPLETED).length;

    return (
        <div className="min-h-screen bg-[#050608] text-slate-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
            <Header onOpenVault={() => setIsVaultOpen(true)} />
            
            {isVaultOpen && (
                <ApiVault 
                    settings={settings} 
                    onUpdateKeys={handleUpdateKeys} 
                    onClose={() => setIsVaultOpen(false)} 
                />
            )}

            <main className="max-w-[1600px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    
                    {/* LEFT SIDEBAR: CONFIGURATION */}
                    <aside className="lg:col-span-3 space-y-8 lg:sticky lg:top-32">
                        <section className="bg-[#0A0B0E] border border-white/[0.05] rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/[0.03] blur-[80px] rounded-full pointer-events-none group-hover:bg-indigo-600/[0.07] transition-all duration-1000"></div>
                            <SettingsPanel 
                                settings={settings} 
                                setSettings={setSettings} 
                                platforms={PLATFORMS} 
                                onOpenVault={() => setIsVaultOpen(true)}
                            />
                        </section>

                        <section className="space-y-5">
                            {/* PREMIUM ACTION BUTTON: GENERATE */}
                            <button 
                                onClick={handleGenerateAll} 
                                disabled={isProcessing || processedFiles.length === 0}
                                className="w-full relative overflow-hidden group/btn px-8 py-7 bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-700 hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-30 disabled:grayscale text-white text-[15px] font-black rounded-[2.5rem] transition-all shadow-[0_30px_90px_-20px_rgba(79,70,229,0.5)] uppercase tracking-[0.3em] flex items-center justify-center gap-4 border border-white/20"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1s_infinite]"></div>
                                {isProcessing ? (
                                    <>
                                        <div className="w-5 h-5 border-[3.5px] border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>Analyzing...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshIcon className="w-6 h-6 text-white group-hover/btn:rotate-180 transition-transform duration-1000" />
                                        <span>Generate All ({pendingCount})</span>
                                    </>
                                )}
                            </button>

                            {/* EXPORT OPTIONS: CSV & BUNDLE */}
                            <div className="flex flex-col gap-3.5">
                                <button 
                                    onClick={() => exportToCsv(processedFiles, settings.platform)} 
                                    disabled={processedFiles.length === 0 || isProcessing}
                                    className="w-full py-5 bg-[#0D0F12] hover:bg-[#14171C] text-slate-300 border border-white/[0.1] hover:border-indigo-500/40 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.25em] disabled:opacity-20 transition-all flex items-center justify-center gap-3.5 active:scale-[0.98] group/export shadow-xl"
                                >
                                    <DownloadIcon className="w-5 h-5 text-indigo-400 group-hover/export:translate-y-1 transition-transform"/> 
                                    Download CSV
                                </button>
                                <button 
                                    onClick={() => exportAdobeStockZip(processedFiles)} 
                                    disabled={processedFiles.length === 0 || isProcessing}
                                    className="w-full py-5 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.25em] disabled:opacity-20 transition-all flex items-center justify-center gap-3.5 active:scale-[0.98] group/bundle shadow-xl"
                                >
                                    <ArchiveIcon className="w-5 h-5 text-emerald-500/80 group-hover/bundle:scale-110 transition-transform"/> 
                                    Adobe Stock Zip
                                </button>
                            </div>

                            {/* DELETE ALL / PURGE ACTION */}
                            {processedFiles.length > 0 && (
                                <button 
                                    onClick={handlePurge} 
                                    className="w-full py-3 mt-6 bg-transparent text-slate-700 hover:text-rose-500 transition-all font-black text-[11px] uppercase tracking-[0.45em] flex items-center justify-center gap-3 group/purge"
                                >
                                    <TrashIcon className="w-4.5 h-4.5 opacity-40 group-hover/purge:opacity-100 transition-all"/> 
                                    Reset Workspace
                                </button>
                            )}
                        </section>
                    </aside>

                    {/* MAIN CONTENT AREA */}
                    <div className="lg:col-span-9 space-y-12">
                        {/* UPLOAD ZONE */}
                        <section className="bg-black/40 rounded-[3.5rem] border border-white/[0.03] p-1.5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.5)]">
                            <FileUpload onFilesChange={handleFilesChange} isUploading={isUploading} />
                        </section>

                        {/* TELEMETRY / STATUS */}
                        <section className="px-4">
                             <StatusDashboard files={processedFiles} onClear={() => setProcessedFiles([])} isProcessing={isProcessing} />
                        </section>
                        
                        {/* ASSET LISTING */}
                        {processedFiles.length > 0 && (
                            <section className="space-y-10">
                                <div className="flex items-center gap-8 px-6">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.7)]"></div>
                                        <h2 className="text-[14px] font-black text-slate-300 uppercase tracking-[0.5em]">Workstream Pipeline</h2>
                                    </div>
                                    <div className="h-[1px] bg-gradient-to-r from-white/[0.1] via-white/[0.05] to-transparent flex-grow"></div>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{processedFiles.length} ACTIVE ASSETS</p>
                                </div>
                                
                                <FileList 
                                    files={processedFiles} 
                                    onRegenerate={processFile} 
                                    onRemove={(id) => setProcessedFiles(p => p.filter(f => f.id !== id))} 
                                    onUpdateFile={(id, updates) => setProcessedFiles(p => p.map(f => f.id === id ? {...f, ...updates} : f))} 
                                    onAddPreview={(id, f) => setProcessedFiles(p => p.map(pf => pf.id === id ? {...pf, preview: URL.createObjectURL(f)} : pf))} 
                                    isProcessing={isProcessing} 
                                    platform={settings.platform} 
                                    maxKeywords={settings.maxKeywords} 
                                />
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
