
import { ProcessedFile, Platform } from '../types';

declare const JSZip: any;

const convertToCsv = (data: ProcessedFile[], platform: Platform, filenameTransformer?: (name: string) => string): string => {
    let headers: string[];
    let rows: string[][];

    const getFilename = (file: File) => filenameTransformer ? filenameTransformer(file.name) : file.name;
    const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

    // Platform-specific headers and row mapping
    switch (platform) {
        case Platform.SHUTTERSTOCK:
            headers = ["Filename", "Description", "Keywords", "Categories", "Editorial", "R-Rated", "Location"];
            rows = data.map(item => [
                getFilename(item.file),
                escape(`${item.metadata.title}. ${item.metadata.description}`),
                escape(item.metadata.selectedKeywords.join(', ')),
                "", // Categories
                "false", // Editorial
                "false", // R-Rated
                "", // Location
            ]);
            break;
        case Platform.ADOBE_STOCK:
            headers = ["Filename", "Title", "Keywords", "Category"];
            rows = data.map(item => [
                getFilename(item.file),
                escape(item.metadata.title),
                escape(item.metadata.selectedKeywords.join(', ')),
                "", // Category is optional, left empty
            ]);
            break;
        case Platform.TEMPLATE_MONSTER:
            headers = ["Filename", "Title", "Description", "Keywords"];
            rows = data.map(item => [
                getFilename(item.file),
                escape(item.metadata.title),
                escape(item.metadata.description),
                escape(item.metadata.selectedKeywords.join(', ')),
            ]);
            break;
        default: // General, Freepik, Vecteezy, Pond5
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

    // Add Byte Order Mark (BOM) to ensure UTF-8 is correctly recognized by Excel/Adobe
    return `\uFEFF${headerString}\n${rowStrings}`;
};

export const exportToCsv = (data: ProcessedFile[], platform: Platform) => {
    if (data.length === 0) {
        alert("No data to export.");
        return;
    }
    
    try {
        const csvString = convertToCsv(data, platform);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const platformName = platform.toLowerCase().replace(/\s+/g, '-');
        link.setAttribute("download", `metadata-export-${platformName}-${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Failed to export CSV:", error);
        alert("An error occurred while creating the CSV file.");
    }
};

export const exportVectorZip = async (data: ProcessedFile[], platform: Platform) => {
    if (data.length === 0) {
        alert("No data to export.");
        return;
    }

    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded. Please refresh the page.");
        return;
    }

    try {
        const zip = new JSZip();
        
        // FORCE Adobe Stock Format for Vector CSVs as requested.
        // This ensures headers are always: Filename, Title, Keywords, Category.
        const targetPlatform = Platform.ADOBE_STOCK;

        // 1. Source CSV (Original Filenames: e.g. image.jpg or vector.svg)
        const sourceCsv = convertToCsv(data, targetPlatform);
        zip.file("metadata_source.csv", sourceCsv);

        // 2. EPS CSV (Filenames transformed to .eps: e.g. image.eps or vector.eps)
        const epsCsv = convertToCsv(data, targetPlatform, (name) => {
            const parts = name.split('.');
            if (parts.length > 1) parts.pop();
            return parts.join('.') + ".eps";
        });
        zip.file("metadata_eps.csv", epsCsv);

        const content = await zip.generateAsync({type:"blob"});
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `vector-metadata-export-adobe-stock-${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to generate ZIP:", error);
        alert("An error occurred while creating the ZIP file.");
    }
};
