
import { GoogleGenAI } from '@google/genai';
import { ProcessedFile, Settings, AIProvider, ApiKey, Platform } from '../types';
import { retryWithBackoff } from './apiUtils';

/**
 * Optimized Resizing: 1024px is the "Sweet Spot" for fast Gemini analysis.
 */
const resizeImage = async (url: string, maxDim: number = 1024): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            let { width: w, height: h } = img;
            if (w > maxDim || h > maxDim) {
                const r = Math.min(maxDim / w, maxDim / h);
                w *= r; h *= r;
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(w); canvas.height = Math.floor(h);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas Internal Error'));
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] });
        };
        img.onerror = () => reject(new Error("Image stream interrupted"));
        img.src = url;
    });
};

/**
 * Turbo Video Frame Extraction: Reduced to 5 high-impact frames for 2x speed.
 */
const extractVideoFrames = async (file: File, count: number = 5): Promise<{ mimeType: string, data: string }[]> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        video.onloadedmetadata = async () => {
            const frames: { mimeType: string, data: string }[] = [];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            const duration = video.duration;
            for (let i = 0; i < count; i++) {
                video.currentTime = (duration / (count + 1)) * (i + 1);
                await new Promise(r => video.onseeked = r);
                canvas.width = 1024;
                canvas.height = (canvas.width / video.videoWidth) * video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.6).split(',')[1] });
            }
            URL.revokeObjectURL(url);
            resolve(frames);
        };
    });
};

const parseJSONSafely = (text: string): any => {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid neural output format.");
    try {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.keywords === 'string') {
            parsed.keywords = parsed.keywords.split(',').map((k: string) => k.trim());
        }
        return parsed;
    } catch (e) {
        throw new Error("Neural output parse failure.");
    }
};

const validateAdobeTitle = (title: string): boolean => {
    if (title.length < 70 || title.length > 120) return false;
    const words = title.toLowerCase().replace(/[,.;:()!]/g, '').split(/\s+/).filter(w => w.length > 3);
    return new Set(words).size === words.length; // Ensure uniqueness
};

export const generateMetadata = async (
    processedFile: ProcessedFile, 
    settings: Settings
) => {
    const { file, preview } = processedFile;
    const nameLower = file.name.toLowerCase();
    const isVideo = file.type.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.mov');
    const isVector = nameLower.endsWith('.eps') || nameLower.endsWith('.ai') || nameLower.endsWith('.svg');

    // 1. Prepare visual data at lightspeed
    let visualParts: { mimeType: string, data: string }[] = [];
    if (isVideo) {
        visualParts = await extractVideoFrames(file, 5);
    } else {
        const resized = await resizeImage(preview || URL.createObjectURL(file), 1024);
        visualParts = [resized];
    }
    
    const provider = settings.aiProvider;
    const initialModel = settings.activeModels[provider];

    // 2. High-performance prompt
    const prompt = `
    TASK: Microstock SEO Generation.
    FORMAT: Strictly JSON.
    ASSET_TYPE: ${isVideo ? 'Video' : isVector ? 'Vector Graphic' : 'Photo'}.
    
    CONSTRAINTS:
    - Title: Natural descriptive sentence (70-120 chars).
    - No word repetition (strictly unique keywords).
    - Keywords: Exactly ${settings.maxKeywords}. Most specific first.
    - Category: 1-21 (Adobe Stock ID).
    
    JSON STRUCTURE:
    {
      "category": "ID",
      "title": "Natural sentence...",
      "keywords": ["key1", "key2", ...]
    }
    `;

    // 3. Resilient Execution Loop
    const execute = async (attempt: number = 1, modelToUse: string = initialModel): Promise<any> => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        try {
            const response = await ai.models.generateContent({
                model: modelToUse,
                contents: { parts: [...visualParts.map(v => ({ inlineData: v })), { text: prompt }] },
                config: { 
                    responseMimeType: "application/json",
                    temperature: 0.4 
                }
            });

            const result = parseJSONSafely(response.text || "");
            
            // Auto-fix Title if length or repetition fails
            if (settings.platform === Platform.ADOBE_STOCK && !validateAdobeTitle(result.title) && attempt < 3) {
                return execute(attempt + 1, modelToUse);
            }
            
            return result;
        } catch (error: any) {
            // Instant fallback for model availability
            if (error?.status === 404 || error?.message?.includes('not found')) {
                const fallback = 'gemini-flash-latest';
                if (modelToUse !== fallback) return execute(attempt, fallback);
            }
            throw error;
        }
    };

    return await retryWithBackoff(() => execute());
};
