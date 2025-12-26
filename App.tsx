import { useState, useCallback, useRef, useEffect } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { Header } from './components/Header';
import { StatusDashboard } from './components/StatusDashboard';
import { ApiVault } from './components/ApiVault';
import { generateMetadata } from './services/geminiService';
import { exportToCsv, exportAdobeStockZip } from './services/csvService';
import { processWithConcurrency } from './services/apiUtils';
import { ProcessedFile, Settings, FileStatus, ApiKey, AIProvider } from './types';
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
    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const settingsRef = useRef(settings);
    const stopProcessingRef = useRef(false);
    const processedFilesRef = useRef(processedFiles);

    useEffect(() => { 
        settingsRef.current = settings;
        localStorage.setItem('metadataGeneratorSettings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => { processedFilesRef.current = processedFiles; }, [processedFiles]);

    const handleUpdateKeys = useCallback((provider: AIProvider, keys: ApiKey[]) => {
        setSettings(prev => ({ ...prev, providerKeys: { ...prev.providerKeys, [provider]: keys } }));
    }, []);

    const handleUpdateActiveModel = useCallback((provider: AIProvider, modelId: string) => {
        setSettings(prev => ({ ...prev, activeModels: { ...prev.activeModels, [provider]: modelId } }));
    }, []);

    const handleFilesChange = useCallback(async (files: File[]) => {
        setIsUploading(true);
        const newItems: ProcessedFile[] = files.map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            preview: (file.type.startsWith('image/') || file.type.startsWith('video/')) ? URL.createObjectURL(file) : '',
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
            const result = await generateMetadata(target, settingsRef.current);
            const s = settingsRef.current;
            
            let base = result.title;
            const suffix = s.isolatedWhite ? " isolated on white background" : s.isolatedTransparent ? " isolated on transparent background" : "";
            
            let finalTitle = `${s.titlePrefix}${base}${suffix}${s.titleSuffix}`.trim();
            const maxLen = s.titleLength.max;
            
            if (finalTitle.length > maxLen) {
                const words = finalTitle.split(' ');
                while (finalTitle.length > maxLen && words.length > 0) {
                    words.pop();
                    finalTitle = words.join(' ').trim();
                }
                if (finalTitle.length > maxLen) {
                    finalTitle = finalTitle.substring(0, maxLen).trim();
                }
            }

            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { 
                ...pf, 
                status: FileStatus.COMPLETED, 
                metadata: { 
                    ...result, 
                    title: finalTitle,
                    selectedKeywords: result.keywords.slice(0, s.maxKeywords) 
                }
            } : pf));
        } catch (error: any) {
            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { 
                ...pf, 
                status: FileStatus.ERROR, 
                error: error.message || "Unknown error occurred" 
            } : pf));
        }
    }, []);

    const handleGenerateAll = async () => {
        if (isProcessing) return;
        stopProcessingRef.current = false;
        
        const currentBatch = processedFilesRef.current
            .filter(pf => pf.status !== FileStatus.COMPLETED)
            .map(pf => pf.id);

        if (currentBatch.length > 0) {
            setIsProcessing(true);
            const limit = settings.safeMode ? 4 : 8;
            const delay = settings.safeMode ? 500 : 100;
            
            await processWithConcurrency(currentBatch, processFile, limit, delay);
            setIsProcessing(false);
        }
    };

    const handlePurge = () => {
        if (confirm("Permanently delete all assets and reset workspace?")) {
            stopProcessingRef.current = true;
            setIsProcessing(false);
            processedFiles.forEach(f => f.preview && URL.revokeObjectURL(f.preview));
            setProcessedFiles([]);
        }
    };

    const pendingCount = processedFiles.filter(f => f.status !== FileStatus.COMPLETED).length;

    return (
        <div className="min-h-screen bg-[#030305] text-slate-300 font-sans selection:bg-indigo-500/30">
            <Header onOpenVault={() => setIsVaultOpen(true)} />
            {isVaultOpen && (
                <ApiVault 
                    settings={settings} 
                    onUpdateKeys={handleUpdateKeys} 
                    onUpdateActiveModel={handleUpdateActiveModel}
                    onClose={() => setIsVaultOpen(false)} 
                />
            )}
            
            <main className="max-w-[1600px] mx-auto px-6 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left Sidebar: Controls & Settings */}
                    <aside className="lg:w-[380px] flex-shrink-0 space-y-6">
                        <div className="glass-card rounded-[2.5rem] p-8 inner-glow shadow-2xl">
                            <SettingsPanel 
                                settings={settings} 
                                setSettings={setSettings} 
                                platforms={PLATFORMS} 
                                onOpenVault={() => setIsVaultOpen(true)}
                            />
                        </div>
                        
                        <div className="space-y-4">
                            <button 
                                onClick={handleGenerateAll} 
                                disabled={isProcessing || pendingCount === 0}
                                className="w-full relative group py-6 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:opacity-30 text-white font-black rounded-3xl transition-all shadow-xl shadow-brand-600/20 uppercase tracking-widest flex items-center justify-center gap-4 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:animate-shimmer transition-all duration-1000"></div>
                                {isProcessing ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <RefreshIcon className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700"/>
                                )}
                                {isProcessing ? 'Analyzing Core...' : `Turbo Analyze (${pendingCount})`}
                            </button>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => exportToCsv(processedFiles, settings.platform)} 
                                    className="py-4 bg-dark-900/50 hover:bg-dark-800 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                                >
                                    <DownloadIcon className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform"/> CSV Export
                                </button>
                                <button 
                                    onClick={() => exportAdobeStockZip(processedFiles)} 
                                    className="py-4 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                                >
                                    <ArchiveIcon className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform"/> Adobe Bundle
                                </button>
                            </div>
                            
                            {processedFiles.length > 0 && (
                                <button 
                                    onClick={handlePurge} 
                                    className="w-full py-6 text-[11px] font-black text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 rounded-3xl transition-all uppercase tracking-[0.5em] shadow-xl shadow-rose-900/10"
                                >
                                    Remove All
                                </button>
                            )}
                        </div>
                    </aside>

                    {/* Right Content: Upload & Results */}
                    <div className="flex-1 min-w-0 space-y-10">
                        <FileUpload onFilesChange={handleFilesChange} isUploading={isUploading} />
                        
                        <StatusDashboard files={processedFiles} onClear={() => setProcessedFiles([])} isProcessing={isProcessing} />
                        
                        {processedFiles.length > 0 ? (
                            <div className="space-y-6 animate-float-in">
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
                            </div>
                        ) : (
                            <div className="py-24 flex flex-col items-center justify-center text-center opacity-30 select-none pointer-events-none">
                                <div className="w-24 h-24 mb-6 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center">
                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth="1.5"/></svg>
                                </div>
                                <p className="text-xl font-black uppercase tracking-[0.3em]">No Assets Active</p>
                                <p className="text-xs font-bold mt-2">Upload media to initialize the neural engine</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;