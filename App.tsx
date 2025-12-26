
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
            const finalTitle = `${settingsRef.current.titlePrefix}${result.title}${settingsRef.current.titleSuffix}`.trim();

            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { 
                ...pf, 
                status: FileStatus.COMPLETED, 
                metadata: { 
                    ...result, 
                    title: finalTitle,
                    selectedKeywords: result.keywords.slice(0, settingsRef.current.maxKeywords) 
                }
            } : pf));
        } catch (error: any) {
            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, status: FileStatus.ERROR, error: "Retrying in next cycle..." } : pf));
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
            // Turbo Concurrency: Higher limits if safeMode is off
            const limit = settings.safeMode ? 3 : 6;
            const delay = settings.safeMode ? 1000 : 300;
            
            await processWithConcurrency(currentBatch, processFile, limit, delay);
            setIsProcessing(false);
        }
    };

    const handlePurge = () => {
        if (confirm("Reset current workspace?")) {
            stopProcessingRef.current = true;
            setIsProcessing(false);
            processedFiles.forEach(f => f.preview && URL.revokeObjectURL(f.preview));
            setProcessedFiles([]);
        }
    };

    return (
        <div className="min-h-screen bg-[#050608] text-slate-300 font-sans">
            <Header onOpenVault={() => setIsVaultOpen(true)} />
            {isVaultOpen && (
                <ApiVault 
                    settings={settings} 
                    onUpdateKeys={handleUpdateKeys} 
                    onUpdateActiveModel={handleUpdateActiveModel}
                    onClose={() => setIsVaultOpen(false)} 
                />
            )}
            <main className="max-w-[1600px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <aside className="lg:col-span-3 space-y-8">
                        <section className="bg-[#0A0B0E] border border-white/[0.05] rounded-[2.5rem] p-8 shadow-2xl">
                            <SettingsPanel 
                                settings={settings} 
                                setSettings={setSettings} 
                                platforms={PLATFORMS} 
                                onOpenVault={() => setIsVaultOpen(true)}
                            />
                        </section>
                        <section className="space-y-4">
                            <button 
                                onClick={handleGenerateAll} 
                                disabled={isProcessing || processedFiles.length === 0}
                                className="w-full relative py-6 bg-gradient-to-br from-indigo-600 to-indigo-700 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 text-white font-black rounded-[2rem] transition-all shadow-xl uppercase tracking-widest flex items-center justify-center gap-4"
                            >
                                {isProcessing ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <RefreshIcon className="w-5 h-5"/>}
                                {isProcessing ? 'Analyzing...' : `Analyze Batch (${processedFiles.filter(f => f.status !== FileStatus.COMPLETED).length})`}
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => exportToCsv(processedFiles, settings.platform)} className="py-4 bg-[#0D0F12] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2"><DownloadIcon className="w-4 h-4 text-indigo-400"/> CSV</button>
                                <button onClick={() => exportAdobeStockZip(processedFiles)} className="py-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2"><ArchiveIcon className="w-4 h-4 text-emerald-400"/> ZIP Bundle</button>
                            </div>
                            {processedFiles.length > 0 && (
                                <button onClick={handlePurge} className="w-full py-2 text-[9px] font-black text-slate-600 hover:text-rose-500 transition-all uppercase tracking-[0.4em]">Clear Workspace</button>
                            )}
                        </section>
                    </aside>
                    <div className="lg:col-span-9 space-y-12">
                        <FileUpload onFilesChange={handleFilesChange} isUploading={isUploading} />
                        <StatusDashboard files={processedFiles} onClear={() => setProcessedFiles([])} isProcessing={isProcessing} />
                        {processedFiles.length > 0 && (
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
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
