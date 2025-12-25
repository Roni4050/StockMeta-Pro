
import { ProcessedFile, Platform } from '../types';

declare const JSZip: any;

const convertToCsv = (data: ProcessedFile[], platform: Platform, filenameTransformer?: (name: string) => string): string => {
    let headers: string[];
    let rows: string[][];

    const getFilename = (file: File) => filenameTransformer ? filenameTransformer(file.name) : file.name;
    const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

    switch (platform) {
        case Platform.SHUTTERSTOCK:
            headers = ["Filename", "Description", "Keywords", "Categories", "Editorial", "R-Rated", "Location"];
            rows = data.map(item => [
                getFilename(item.file),
                escape(`${item.metadata.title}. ${item.metadata.description}`),
                escape(item.metadata.selectedKeywords.join(', ')),
                "", 
                "false", 
                "false", 
                "", 
            ]);
            break;
        case Platform.ADOBE_STOCK:
            headers = ["Filename", "Title", "Keywords", "Category"];
            rows = data.map(item => [
                getFilename(item.file),
                escape(item.metadata.title),
                escape(item.metadata.selectedKeywords.join(', ')),
                item.metadata.category || "8", // Default to 8 (Graphic Resources)
            ]);
            break;
        default:
            headers = ["Filename", "Title", "Description", "Keywords"];
            rows = data.map(item => [
                getFilename(item.file),
                escape(item.metadata.title),
                escape(item.metadata.description),
                escape(item.metadata.selectedKeywords.join(', ')),
            ]);
    }

    const headerString = headers.join(',');
    const rowStrings = rows.map(row => row.join(',')).join('\n');
    return `\uFEFF${headerString}\n${rowStrings}`;
};

export const exportToCsv = (data: ProcessedFile[], platform: Platform) => {
    if (data.length === 0) return;
    try {
        const csvString = convertToCsv(data, platform);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const platformName = platform.toLowerCase().replace(/\s+/g, '-');
        link.setAttribute("download", `metadata-${platformName}-${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export CSV:", error);
    }
};

export const exportAdobeStockZip = async (data: ProcessedFile[]) => {
    if (data.length === 0 || typeof JSZip === 'undefined') {
        console.error("Missing data or JSZip library");
        return;
    }

    try {
        const zip = new JSZip();
        
        // 1. Uploaded Files CSV (Standard)
        const standardCsv = convertToCsv(data, Platform.ADOBE_STOCK);
        zip.file("adobe_stock_uploaded_formats.csv", standardCsv);

        // 2. EPS Mapped CSV (Forces .eps extension in filename for sidecar submissions)
        const epsCsv = convertToCsv(data, Platform.ADOBE_STOCK, (name) => {
            const parts = name.split('.');
            if (parts.length > 1) parts.pop();
            return parts.join('.') + ".eps";
        });
        zip.file("adobe_stock_eps_vectors.csv", epsCsv);

        const content = await zip.generateAsync({type:"blob"});
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `adobe-stock-metadata-bundle-${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to generate Adobe Stock ZIP bundle:", error);
    }
};
