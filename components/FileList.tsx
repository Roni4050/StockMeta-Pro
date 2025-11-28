import React from 'react';
import { ProcessedFile, Platform } from '../types';
import { FileItem } from './FileItem';

interface FileListProps {
    files: ProcessedFile[];
    onRegenerate: (id: string) => void;
    onRemove: (id: string) => void;
    onUpdateMetadata: (id: string, newMetadata: Partial<ProcessedFile['metadata']>) => void;
    onAddPreview: (id: string, previewFile: File) => void;
    isProcessing: boolean;
    platform: Platform;
    maxKeywords: number;
}

export const FileList: React.FC<FileListProps> = ({ files, onRegenerate, onRemove, onUpdateMetadata, onAddPreview, isProcessing, platform, maxKeywords }) => {
    if (files.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-800/30 rounded-lg">
                <h3 className="text-lg font-medium text-gray-400">Your uploaded files will appear here</h3>
                <p className="text-gray-500 mt-1">Upload some files to get started.</p>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 gap-6">
            {files.map((file) => (
                <FileItem
                    key={file.id}
                    fileData={file}
                    onRegenerate={onRegenerate}
                    onRemove={onRemove}
                    onUpdateMetadata={onUpdateMetadata}
                    onAddPreview={onAddPreview}
                    isProcessing={isProcessing}
                    platform={platform}
                    maxKeywords={maxKeywords}
                />
            ))}
        </div>
    );
};