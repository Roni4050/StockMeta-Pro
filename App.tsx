
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { Header } from './components/Header';
import { StatusDashboard } from './components/StatusDashboard';
import { generateMetadata } from './services/geminiService';
import { exportToCsv, exportVectorZip } from './services/csvService';
import { processWithConcurrency } from './services/apiUtils';
import { ProcessedFile, Settings, FileStatus, AIProvider } from './types';
import { PLATFORMS, IMAGE_TYPES, DEFAULT_SETTINGS } from './constants';

const CONCURRENCY_LIMIT = 4;
const INTER_REQUEST_DELAY_MS = 50;

const App: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const savedSettings = localStorage.getItem('metadataGeneratorSettings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
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
    
    // Ref to hold latest processedFiles for event handlers to avoid stale closures
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
        
        // Wait a tick to allow UI to show loading state
        await new Promise(resolve => setTimeout(resolve, 50));

        // OPTIMIZED: Use Map for O(N) grouping instead of O(N^2) nested loops
        const fileMap = new Map<string, { vector?: File; preview?: File; others: File[] }>();
        const getBaseName = (name: string) => name.substring(0, name.lastIndexOf('.')).toLowerCase();

        // 1. Group files by name stem
        for (const file of files) {
            const name = file.name.toLowerCase();
            const base = getBaseName(file.name);
            
            if (!fileMap.has(base)) {
                fileMap.set(base, { others: [] });
            }
            const entry = fileMap.get(base)!;

            if (name.endsWith('.eps') || name.endsWith('.ai') || name.endsWith('.pdf')) {
                entry.vector = file;
            } else if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')) {
                // If we already have a preview, treat this as another 'other' or overwrite. 
                // Usually overwrite is correct for pairs.
                entry.preview = file;
            } else {
                entry.others.push(file);
            }
        }

        const newItems: ProcessedFile[] = [];
        
        // 2. Flatten Map into ProcessedFiles
        for (const [baseName, entry] of fileMap.entries()) {
            // Case A: Vector File (with optional preview)
            if (entry.vector) {
                const fileId = `${entry.vector.name}-${entry.vector.lastModified}-${Math.random()}`;
                newItems.push({
                    id: fileId,
                    file: entry.vector,
                    preview: entry.preview ? URL.createObjectURL(entry.preview) : '',
                    status: FileStatus.PENDING,
                    metadata: { title: '', description: '', keywords: [], selectedKeywords: [] },
                });
                // Note: entry.preview is consumed here, so we don't add it as a standalone image below
            } 
            // Case B: Standalone Image (no vector partner)
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

            // Case C: Other files (videos, etc)
            entry.others.forEach(otherFile => {
                const fileId = `${otherFile.name}-${otherFile.lastModified}-${Math.random()}`;
                newItems.push({
                    id: fileId,
                    file: otherFile,
                    preview: URL.createObjectURL(otherFile), // Browser handles video/misc blob URLs mostly fine
                    status: FileStatus.PENDING,
                    metadata: { title: '', description: '', keywords: [], selectedKeywords: [] },
                });
            });
        }

        // 3. Batch Update State (Chunking) to prevent UI freeze
        const BATCH_SIZE = 50;
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
            const batch = newItems.slice(i, i + BATCH_SIZE);
            setProcessedFiles(prev => [...prev, ...batch]);
            // Small delay between batches to let React render
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        setIsUploading(false);
    }, []);
    
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
        const fileToProcess = processedFilesRef.current.find(f => f.id === fileId);

        if (!fileToProcess) {
            console.warn(`File with id ${fileId} not found for processing.`);
            return;
        }

        setProcessedFiles(prev =>
            prev.map(pf =>
                pf.id === fileId
                    ? { ...pf, status: FileStatus.PROCESSING, error: undefined }
                    : pf
            )
        );

        try {
            const newMetadata = await generateMetadata(fileToProcess, settingsRef.current);
            const fullMetadata = {
                title: newMetadata.title,
                description: newMetadata.description,
                keywords: newMetadata.keywords,
                selectedKeywords: newMetadata.keywords.slice(0, settingsRef.current.maxKeywords),
            };

            setProcessedFiles(prev =>
                prev.map(pf =>
                    pf.id === fileId
                        ? { ...pf, status: FileStatus.COMPLETED, metadata: fullMetadata, error: undefined }
                        : pf
                )
            );
        } catch (error) {
            console.error('Error generating metadata:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            setProcessedFiles(prev =>
                prev.map(pf =>
                    pf.id === fileId
                        ? { ...pf, status: FileStatus.ERROR, error: errorMessage }
                        : pf
                )
            );
        }
    }, []);


    const handleGenerateAll = async () => {
        if (isProcessing) return;
        
        const updatedFiles = processedFiles.map(pf =>
            pf.status === FileStatus.ERROR ? { ...pf, status: FileStatus.PENDING, error: undefined } : pf
        );

        const pendingFileIds = updatedFiles
            .filter(pf => pf.status === FileStatus.PENDING)
            .map(pf => pf.id);

        if (pendingFileIds.length > 0) {
            setProcessedFiles(updatedFiles);
            setIsProcessing(true);

            if (settings.singleGenerationMode) {
                for (const id of pendingFileIds) {
                    await processFile(id);
                    await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
                }
            } else {
                await processWithConcurrency(
                    pendingFileIds,
                    (id) => processFile(id),
                    CONCURRENCY_LIMIT,
                    INTER_REQUEST_DELAY_MS
                );
            }
            
            setIsProcessing(false);
        }
    };
    
    const handleRegenerate = useCallback(async (id: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      await processFile(id);
      setIsProcessing(false);
    }, [isProcessing, processFile]);


    const handleExport = () => {
        const completedFiles = processedFiles.filter(pf => pf.status === FileStatus.COMPLETED);
        if (completedFiles.length > 0) {
            exportToCsv(completedFiles, settings.platform);
        } else {
            alert('No completed files with metadata to export.');
        }
    };

    const handleExportVectorCsv = () => {
        const completedFiles = processedFiles.filter(pf => pf.status === FileStatus.COMPLETED);
        if (completedFiles.length > 0) {
            exportVectorZip(completedFiles, settings.platform);
        } else {
            alert('No completed files with metadata to export.');
        }
    };
    
    // Robust Clear All Handler
    const handleClearAll = useCallback(() => {
        const files = processedFilesRef.current;
        if (files.length === 0) return;
        
        if (window.confirm('Are you sure you want to clear all uploaded files? This action cannot be undone.')) {
            // Cleanup URLs
            files.forEach(pf => {
                if (pf.preview && pf.preview.startsWith('blob:')) {
                    URL.revokeObjectURL(pf.preview);
                }
            });
            // Force reset everything
            setProcessedFiles([]);
            processedFilesRef.current = [];
            setIsProcessing(false);
            setIsUploading(false);
        }
    }, []);
    
    const filesToProcessCount = processedFiles.filter(pf => [FileStatus.PENDING, FileStatus.ERROR].includes(pf.status)).length;

    return (
        <div className="flex h-screen bg-gray-900 text-gray-200 font-sans overflow-hidden">
            {/* Left Sidebar - Scrollable */}
            <aside className="w-80 lg:w-96 flex-shrink-0 bg-gray-800/80 backdrop-blur-md border-r border-gray-700 flex flex-col h-full shadow-2xl z-20">
                <Header />
                <div className="flex-grow overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    <SettingsPanel
                        settings={settings}
                        setSettings={setSettings}
                        platforms={PLATFORMS}
                        imageTypes={IMAGE_TYPES}
                    />
                </div>
                {/* Fixed Footer for Actions */}
                <div className="p-5 bg-gray-800 border-t border-gray-700 space-y-3">
                     <button
                        onClick={handleGenerateAll}
                        disabled={isProcessing || filesToProcessCount === 0 || isUploading}
                        className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
                    >
                        {isProcessing ? (
                            <><svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</>
                        ) : `Generate All (${filesToProcessCount})`}
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleExport}
                            disabled={isProcessing || !processedFiles.some(f => f.status === FileStatus.COMPLETED) || isUploading}
                            className="w-full px-2 py-2.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-gray-300 disabled:opacity-50 transition-colors"
                        >
                            Export CSV
                        </button>
                        <button
                            onClick={handleExportVectorCsv}
                            disabled={isProcessing || !processedFiles.some(f => f.status === FileStatus.COMPLETED) || isUploading}
                             className="w-full px-2 py-2.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-gray-300 disabled:opacity-50 transition-colors"
                        >
                            Vector CSV
                        </button>
                    </div>

                    <button
                        onClick={handleClearAll}
                        disabled={processedFiles.length === 0}
                        className="w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear All
                    </button>
                </div>
            </aside>
            
            {/* Right Main Content - Scrollable */}
            <main className="flex-1 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900 relative">
                 <div className="max-w-6xl mx-auto p-6 lg:p-10 pb-20">
                    <FileUpload onFilesChange={handleFilesChange} isUploading={isUploading} />
                    
                    <StatusDashboard 
                        files={processedFiles} 
                        onClear={handleClearAll}
                        isProcessing={isProcessing}
                    />

                    <FileList
                        files={processedFiles}
                        onRegenerate={handleRegenerate}
                        onRemove={removeFile}
                        onUpdateMetadata={updateFileMetadata}
                        onAddPreview={handleAddPreview}
                        isProcessing={isProcessing}
                        platform={settings.platform}
                        maxKeywords={settings.maxKeywords}
                    />
                 </div>
            </main>
        </div>
    );
};

export default App;
