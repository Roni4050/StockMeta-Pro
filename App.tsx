
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { Header } from './components/Header';
import { StatusDashboard } from './components/StatusDashboard';
import { generateMetadata } from './services/geminiService';
import { exportToCsv, exportVectorZip } from './services/csvService';
import { processWithConcurrency } from './services/apiUtils';
import { ProcessedFile, Settings, FileStatus, AIProvider, ImageType } from './types';
import { PLATFORMS, IMAGE_TYPES, DEFAULT_SETTINGS } from './constants';
import { TrashIcon, DownloadIcon, ArchiveIcon } from './components/icons';

const CONCURRENCY_LIMIT = 2; 
const INTER_REQUEST_DELAY_MS = 2000;

const App: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const savedSettings = localStorage.getItem('metadataGeneratorSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // MIGRATION: Auto-update decommissioned or legacy Groq models to new Llama 4 Scout
                if (parsed.groqModel === "llama-3.2-11b-vision-preview" || parsed.groqModel === "llama-3.2-90b-vision-preview") {
                    parsed.groqModel = "meta-llama/llama-4-scout-17b-16e-instruct";
                }
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.error("Could not load settings from localStorage", e);
        }
        return DEFAULT_SETTINGS;
    });

    const settingsRef = useRef(settings);
    useEffect(() => {
        settingsRef.current = settings;
        try {
            localStorage.setItem('metadataGeneratorSettings', JSON.stringify(settings));
        } catch(e) {
             console.error("Could not save settings to localStorage", e);
        }
    }, [settings]);

    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Ref to control processing loop stop
    const stopProcessingRef = useRef(false);
    
    const processedFilesRef = useRef(processedFiles);
    useEffect(() => {
        processedFilesRef.current = processedFiles;
    }, [processedFiles]);

    useEffect(() => {
        return () => {
            processedFilesRef.current.forEach(pf => {
                if (pf.preview && pf.preview.startsWith('blob:')) {
                    URL.revokeObjectURL(pf.preview);
                }
            });
        };
    }, []);


    const handleFilesChange = useCallback(async (files: File[]) => {
        setIsUploading(true);
        let hasVector = false;
        let hasLogo = false;

        // Supported extensions
        const VECTOR_EXTS = ['.eps', '.ai', '.pdf', '.svg'];
        const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.jpj', '.svg']; // Added .svg here as image
        const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.m4v'];

        for (const file of files) {
             const n = file.name.toLowerCase();
             if (VECTOR_EXTS.some(ext => n.endsWith(ext))) {
                 hasVector = true;
                 if (n.includes('logo')) {
                     hasLogo = true;
                     break; 
                 }
             }
        }

        if (hasLogo) {
            setSettings(prev => ({ ...prev, imageType: ImageType.LOGO }));
        } else if (hasVector) {
            setSettings(prev => {
                if (prev.imageType === ImageType.LOGO) return prev;
                return { ...prev, imageType: ImageType.VECTOR };
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));

        const fileMap = new Map<string, { vector?: File; preview?: File; others: File[] }>();
        const getBaseName = (name: string) => name.substring(0, name.lastIndexOf('.')).toLowerCase();

        for (const file of files) {
            const name = file.name.toLowerCase();
            const base = getBaseName(file.name);
            
            if (!fileMap.has(base)) {
                fileMap.set(base, { others: [] });
            }
            const entry = fileMap.get(base)!;

            if (VECTOR_EXTS.some(ext => name.endsWith(ext)) && !name.endsWith('.svg')) {
                // Treat non-SVG vectors strictly as source files
                entry.vector = file;
            } else if (IMAGE_EXTS.some(ext => name.endsWith(ext))) {
                // SVGs can act as both vector source OR preview
                if (name.endsWith('.svg') && !entry.vector) {
                     // Temporary assignment, logic below handles if it stays as preview or vector
                     entry.preview = file;
                } else {
                     entry.preview = file;
                }
            } else if (VIDEO_EXTS.some(ext => name.endsWith(ext))) {
                entry.others.push(file); 
            } else {
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                     entry.others.push(file);
                }
            }
        }

        const newItems: ProcessedFile[] = [];
        
        for (const [baseName, entry] of fileMap.entries()) {
            // Case 1: Vector file (optionally with preview)
            if (entry.vector) {
                const fileId = `${entry.vector.name}-${entry.vector.lastModified}-${Math.random()}`;
                newItems.push({
                    id: fileId,
                    file: entry.vector,
                    preview: entry.preview ? URL.createObjectURL(entry.preview) : '',
                    status: FileStatus.PENDING,
                    metadata: { title: '', description: '', keywords: [], selectedKeywords: [] },
                });
            } 
            // Case 2: Standalone Preview (JPG/PNG/SVG) - if no vector paired
            else if (entry.preview) {
                const fileId = `${entry.preview.name}-${entry.preview.lastModified}-${Math.random()}`;
                newItems.push({
                    id: fileId,
                    file: entry.preview,
                    preview: URL.createObjectURL(entry.preview),
                    status: FileStatus.PENDING,
                    metadata: { title: '', description: '', keywords: [], selectedKeywords: [] },
                });
            }

            // Case 3: Videos and other standalone files
            entry.others.forEach(otherFile => {
                const fileId = `${otherFile.name}-${otherFile.lastModified}-${Math.random()}`;
                newItems.push({
                    id: fileId,
                    file: otherFile,
                    preview: URL.createObjectURL(otherFile),
                    status: FileStatus.PENDING,
                    metadata: { title: '', description: '', keywords: [], selectedKeywords: [] },
                });
            });
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
            const batch = newItems.slice(i, i + BATCH_SIZE);
            setProcessedFiles(prev => [...prev, ...batch]);
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        setIsUploading(false);
    }, []);
    
    // ... existing handlers (handleAddPreview, updateFileMetadata, removeFile, processFile) ...

    const handleAddPreview = useCallback((id: string, previewFile: File) => {
        setProcessedFiles(prev =>
            prev.map(pf => {
                if (pf.id === id) {
                    if (pf.preview.startsWith('blob:')) {
                        URL.revokeObjectURL(pf.preview);
                    }
                    return { ...pf, preview: URL.createObjectURL(previewFile) };
                }
                return pf;
            })
        );
    }, []);

    const updateFileMetadata = useCallback((id: string, newMetadata: Partial<ProcessedFile['metadata']>) => {
        setProcessedFiles(prev =>
            prev.map(pf => pf.id === id ? { ...pf, metadata: { ...pf.metadata, ...newMetadata } } : pf)
        );
    }, []);

    const removeFile = useCallback((id: string) => {
        setProcessedFiles(prev => {
            const fileToRemove = prev.find(pf => pf.id === id);
            if (fileToRemove && fileToRemove.preview.startsWith('blob:')) {
                URL.revokeObjectURL(fileToRemove.preview);
            }
            return prev.filter(pf => pf.id !== id);
        });
    }, []);

    const processFile = useCallback(async (fileId: string) => {
        if (stopProcessingRef.current) return;
        const fileToProcess = processedFilesRef.current.find(f => f.id === fileId);
        if (!fileToProcess) return;

        setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, status: FileStatus.PROCESSING, error: undefined } : pf));

        try {
            const newMetadata = await generateMetadata(fileToProcess, settingsRef.current);
            const fullMetadata = {
                title: newMetadata.title,
                description: newMetadata.description,
                keywords: newMetadata.keywords,
                selectedKeywords: newMetadata.keywords.slice(0, settingsRef.current.maxKeywords),
            };

            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, status: FileStatus.COMPLETED, metadata: fullMetadata, error: undefined } : pf));
        } catch (error) {
            console.error('Error generating metadata:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setProcessedFiles(prev => prev.map(pf => pf.id === fileId ? { ...pf, status: FileStatus.ERROR, error: errorMessage } : pf));
        }
    }, []);

    const handleGenerateAll = async () => {
        if (isProcessing) return;
        stopProcessingRef.current = false;
        
        const updatedFiles = processedFiles.map(pf => pf.status === FileStatus.ERROR ? { ...pf, status: FileStatus.PENDING, error: undefined } : pf);
        const pendingFileIds = updatedFiles.filter(pf => pf.status === FileStatus.PENDING).map(pf => pf.id);

        if (pendingFileIds.length > 0) {
            setProcessedFiles(updatedFiles);
            setIsProcessing(true);

            const processWrapper = async (id: string) => {
                if (stopProcessingRef.current) return;
                await processFile(id);
            };

            if (settings.singleGenerationMode) {
                for (const id of pendingFileIds) {
                    if (stopProcessingRef.current) break;
                    if (!processedFilesRef.current.some(f => f.id === id)) break; 
                    await processWrapper(id);
                    if (!stopProcessingRef.current) await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
                }
            } else {
                await processWithConcurrency(pendingFileIds, processWrapper, CONCURRENCY_LIMIT, INTER_REQUEST_DELAY_MS);
            }
            
            setIsProcessing(false);
            stopProcessingRef.current = false;
        }
    };
    
    const handleStopProcessing = () => {
        stopProcessingRef.current = true;
        setIsProcessing(false);
    };
    
    const handleRegenerate = useCallback(async (id: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      stopProcessingRef.current = false;
      await processFile(id);
      setIsProcessing(false);
    }, [isProcessing, processFile]);

    const handleExport = () => {
        const completedFiles = processedFiles.filter(pf => pf.status === FileStatus.COMPLETED);
        if (completedFiles.length > 0) exportToCsv(completedFiles, settings.platform);
        else alert('No completed files with metadata to export.');
    };

    const handleExportVectorCsv = () => {
        const completedFiles = processedFiles.filter(pf => pf.status === FileStatus.COMPLETED);
        if (completedFiles.length > 0) exportVectorZip(completedFiles, settings.platform);
        else alert('No completed files with metadata to export.');
    };
    
    const handleClearAll = useCallback(() => {
        const files = processedFilesRef.current;
        if (files.length === 0) return;
        if (window.confirm('Are you sure you want to clear all uploaded files? This action cannot be undone.')) {
            stopProcessingRef.current = true;
            files.forEach(pf => {
                if (pf.preview && pf.preview.startsWith('blob:')) URL.revokeObjectURL(pf.preview);
            });
            processedFilesRef.current = []; 
            setProcessedFiles([]);
            setIsProcessing(false);
            setIsUploading(false);
        }
    }, []);
    
    const filesToProcessCount = processedFiles.filter(pf => [FileStatus.PENDING, FileStatus.ERROR].includes(pf.status)).length;

    return (
        <div className="flex h-screen bg-[#05050A] text-slate-200 font-sans overflow-hidden">
            {/* Ambient Background Gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-900/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <aside className="w-80 lg:w-96 flex-shrink-0 bg-black/40 backdrop-blur-2xl border-r border-white/5 flex flex-col h-full shadow-2xl z-20 relative">
                <Header />
                <div className="flex-grow overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <SettingsPanel settings={settings} setSettings={setSettings} platforms={PLATFORMS} imageTypes={IMAGE_TYPES} />
                </div>
                <div className="p-5 bg-black/40 backdrop-blur-xl border-t border-white/5 space-y-3">
                     {isProcessing ? (
                        <button onClick={handleStopProcessing} className="w-full flex items-center justify-center px-4 py-3 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all transform active:scale-[0.98] border border-white/10 group">
                            <span className="mr-2 animate-pulse w-2 h-2 bg-white rounded-full"></span> 
                            <span className="group-hover:tracking-wider transition-all">Stop Processing</span>
                        </button>
                     ) : (
                        <button onClick={handleGenerateAll} disabled={filesToProcessCount === 0 || isUploading} className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] border border-white/10 group">
                            <span className="group-hover:tracking-wider transition-all">Start Batch Process ({filesToProcessCount})</span>
                        </button>
                     )}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleExport} disabled={isProcessing || !processedFiles.some(f => f.status === FileStatus.COMPLETED) || isUploading} className="w-full flex items-center justify-center space-x-2 px-2 py-3 text-xs font-bold uppercase tracking-wide bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 transition-all border border-emerald-500/50 hover:border-emerald-400 group">
                            <DownloadIcon className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /><span>CSV</span>
                        </button>
                        <button onClick={handleExportVectorCsv} disabled={isProcessing || !processedFiles.some(f => f.status === FileStatus.COMPLETED) || isUploading} className="w-full flex items-center justify-center space-x-2 px-2 py-3 text-xs font-bold uppercase tracking-wide bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 transition-all border border-emerald-500/50 hover:border-emerald-400 group">
                            <ArchiveIcon className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /><span>ZIP</span>
                        </button>
                    </div>
                    <button onClick={handleClearAll} disabled={processedFiles.length === 0} className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-rose-400 hover:text-white bg-transparent hover:bg-rose-600/90 border border-rose-900/30 hover:border-rose-500/50 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-rose-400">
                        <TrashIcon className="w-4 h-4" /><span>Clear Session</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative z-10">
                 <div className="max-w-7xl mx-auto p-6 lg:p-10 pb-32">
                    <FileUpload onFilesChange={handleFilesChange} isUploading={isUploading} />
                    <StatusDashboard files={processedFiles} onClear={handleClearAll} isProcessing={isProcessing} />
                    <FileList files={processedFiles} onRegenerate={handleRegenerate} onRemove={removeFile} onUpdateMetadata={updateFileMetadata} onAddPreview={handleAddPreview} isProcessing={isProcessing} platform={settings.platform} maxKeywords={settings.maxKeywords} />
                 </div>
            </main>
        </div>
    );
};
export default App;
