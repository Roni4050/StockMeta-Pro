
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { ProcessedFile, Settings, Platform, ImageType, AIProvider, GeminiModel } from '../types';
import { retryWithBackoff } from './apiUtils';

// Updated Backup keys
const BACKUP_API_KEYS = [
    "AIzaSyCUQV-kO9lFEDcyyst6YN8krLsdMp9EHHg",
    "AIzaSyANPT8cfdXaZvep5aiIu9oZhni7wjHFQ3E",
    "AIzaSyBwt1o4d2JCH7JBuY50fNf6hM3rV2HWywE",
    "AIzaSyBaWFh_wxZ7WKbh0zjK3u-9ENjxZypuDk4",
    "AIzaSyAis9ds4DL-8r42N2B4owkcTBcir38ZLfw",
    "AIzaSyD0aUK_GHZO6Y_AW-YOiQZmYF54bkv_JvI"
];

// Internal Mistral Key added to pool
const BACKUP_MISTRAL_KEYS = [
    "zNG6OjF6i62sIPgsxsAF4vCZC8kFPbs0"
];

/**
 * Resizes and compresses an image to ensure it fits within AI model constraints.
 * @param url The blob URL or data URL of the image.
 * @param maxDimension The maximum width or height (default 1024 for Pixtral stability).
 * @returns A promise resolving to the processed { mimeType, data }.
 */
const resizeImage = async (url: string, maxDimension: number = 1024): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions keeping aspect ratio
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width *= ratio;
                height *= ratio;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context unavailable'));
                return;
            }
            
            // Fill white background for transparency handling (prevents black backgrounds in JPEGs)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG 0.85 to reduce payload size significantly
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const parts = dataUrl.split(',');
            if (parts.length < 2) {
                reject(new Error("Invalid data URL generated during resize"));
                return;
            }
            resolve({
                mimeType: 'image/jpeg',
                data: parts[1]
            });
        };
        img.onerror = (e) => reject(new Error("Failed to load image for resizing."));
        img.src = url;
    });
};

/**
 * Converts an SVG data URL to a PNG base64 string by rendering it on a canvas.
 * @param svgDataUrl The data URL of the SVG image.
 * @returns A promise that resolves with the base64 encoded PNG data.
 */
const convertSvgToPng = (svgDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 512; // Standard size for analysis
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }
            // Add a white background for SVGs with transparency
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw image scaled and centered
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const centerShiftX = (canvas.width - img.width * ratio) / 2;
            const centerShiftY = (canvas.height - img.height * ratio) / 2;
            ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error('Failed to load SVG image for conversion.'));
        img.src = svgDataUrl;
    });
};

/**
 * Extracts multiple frames from a video file and returns them as base64 encoded JPEGs with timestamps.
 * @param videoFile The video file to process.
 * @param frameCount The number of frames to extract.
 * @returns A promise that resolves with an array of objects containing frame data and timestamps.
 */
const extractFramesFromVideo = (videoFile: File, frameCount: number = 6): Promise<{ timestamp: number; data: string; }[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;
        video.muted = true;
        const frames: { timestamp: number; data: string; }[] = [];

        video.onloadeddata = async () => {
            canvas.width = 512; // Limit video frame size for performance
            canvas.height = 512 * (video.videoHeight / video.videoWidth);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(videoUrl);
                return reject(new Error("Canvas context not available"));
            }

            const duration = video.duration;
            // Distribute frames evenly, avoiding the very start and end.
            const interval = duration / (frameCount + 1);

            for (let i = 1; i <= frameCount; i++) {
                const seekTime = interval * i;
                if (seekTime > duration) continue;
                
                // Seeking is asynchronous, so we need to wait for it.
                video.currentTime = seekTime;
                await new Promise<void>((res, rej) => {
                    const seekTimeout = setTimeout(() => rej(new Error('Video seek timed out')), 2000);
                    video.onseeked = () => {
                        clearTimeout(seekTimeout);
                        res();
                    };
                });

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                frames.push({
                    timestamp: seekTime,
                    data: frameDataUrl.split(',')[1]
                });
            }

            URL.revokeObjectURL(videoUrl);
            resolve(frames);
        };

        video.onerror = () => {
            URL.revokeObjectURL(videoUrl);
            reject(new Error("Failed to load video file for frame extraction."));
        };
    });
};

const getPlatformGuidelines = (platform: Platform): string => {
    switch (platform) {
        case Platform.ADOBE_STOCK:
            return `
            ADOBE STOCK MASTER GUIDELINES:
            1. STRUCTURE: [Subject with Detailed Adjectives] + [Action/Interaction/Symbolism] + [Environment/Context].
            2. DETAIL: Be extremely descriptive. Mention clothing (e.g., "striped shirt"), physical traits (e.g., "blue shorts"), objects held (e.g., "crossed swords"), and background vibe (e.g., "fiery background").
            3. STYLE: Describe the style naturally (e.g., "A flat vector illustration of...", "A minimalistic logo of..."). Do NOT append a list of tags like "vector art, logo design" at the end of the sentence.
            4. TONE: Commercial, literal, and SEO-focused.
            `;
        case Platform.SHUTTERSTOCK:
            return `
            SHUTTERSTOCK GUIDELINES:
            1. Create a rich, descriptive sentence.
            2. Include: Subject, Action, Context, and Style.
            3. Example: "A stylized bird wearing a striped shirt and blue shorts standing on one leg."
            `;
        default:
            return "Create a commercially appealing title as a descriptive sentence. Be literal and detailed.";
    }
}

const SUPPORTED_MIME_TYPES_FOR_VISUAL_ANALYSIS = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/svg+xml', // Supported via conversion to PNG
    'video/mp4', // Supported via frame extraction
    'video/quicktime', // Supported via frame extraction
    'video/mov', // Supported via frame extraction
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/x-m4v'
];

const getAssetTypeInfo = (file: File, imageType: ImageType): string => {
    const fileMime = file.type;
    const fileName = file.name.toLowerCase();

    if (fileMime.startsWith('video/')) {
        return "Format: Video Footage.";
    }
    if (imageType === ImageType.LOGO) {
        return "Format: Professional Logo Design. Style: Minimalist, Modern, or Emblematic. Focus on symbolism, shapes, and branding potential.";
    }
    if (fileMime === 'image/svg+xml' || fileName.endsWith('.svg') || fileName.endsWith('.eps') || fileName.endsWith('.ai') || imageType === ImageType.VECTOR) {
        return "Format: Vector Illustration. Style: Flat, Clean, or Isometic.";
    }
    return "Format: Photography.";
}

const extractJson = (text: string): string => {
    if (!text) return "";
    let cleanText = text.trim();
    // Remove markdown code blocks
    cleanText = cleanText.replace(/```json\s*|```/g, '');
    
    const firstOpen = cleanText.indexOf('{');
    const lastClose = cleanText.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1) {
        return cleanText.substring(firstOpen, lastClose + 1);
    }
    return cleanText;
}

// Main generation function that delegates to the correct provider
export const generateMetadata = async (
    processedFile: ProcessedFile,
    settings: Settings
): Promise<{ title: string; description: string; keywords: string[] }> => {
    if (settings.aiProvider === AIProvider.MISTRAL) {
        return generateMistralMetadata(processedFile, settings);
    }
    return generateGeminiMetadata(processedFile, settings);
};

const getVisualContentParts = async (processedFile: ProcessedFile, provider: AIProvider): Promise<any[]> => {
    const { file, preview } = processedFile;
    const fileType = file.type;
    const hasManualPreview = preview.startsWith('blob:');

    // Handle video separately to allow for interleaved text/image parts
    if (!hasManualPreview && fileType.startsWith('video/')) {
        const frames = await extractFramesFromVideo(file);
        const videoParts: any[] = [];
        
        // Mistral prefers images then text, or interleaved. We'll add images first.
        if (provider === AIProvider.MISTRAL) {
             frames.forEach(frame => {
                videoParts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frame.data}` } });
             });
             videoParts.push({ type: 'text', text: "The above are sequential frames from the video footage." });
        } else { // Gemini
            for (const frame of frames) {
                const timestampText = `Frame at ${frame.timestamp.toFixed(2)}s:`;
                videoParts.push(
                    { text: timestampText },
                    { inlineData: { mimeType: 'image/jpeg', data: frame.data } }
                );
            }
        }
        return videoParts;
    }

    // --- Fallback for images or videos with manual previews ---
    let imageDatas: { mimeType: string, data: string }[] = [];

    if (hasManualPreview) {
        // Optimize image size before sending
        try {
            const resized = await resizeImage(preview);
            imageDatas.push(resized);
        } catch (e) {
            console.warn("Failed to resize manual preview, falling back to blob extraction (unsafe size).", e);
            // Fallback to old method only if resize fails
             const response = await fetch(preview);
             const blob = await response.blob();
             const reader = new FileReader();
             const p = new Promise<{mimeType: string, data: string}>((resolve) => {
                 reader.onload = () => resolve({mimeType: blob.type, data: (reader.result as string).split(',')[1]});
                 reader.readAsDataURL(blob);
             });
             imageDatas.push(await p);
        }
    } else if (fileType === 'image/svg+xml') {
        const svgDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
        const pngBase64 = await convertSvgToPng(svgDataUrl);
        imageDatas.push({ mimeType: 'image/png', data: pngBase64 });
    } else if (SUPPORTED_MIME_TYPES_FOR_VISUAL_ANALYSIS.includes(fileType)) {
        // Use resizeImage for native supported types (jpg, png, etc) via temporary object URL
        const objectUrl = URL.createObjectURL(file);
        try {
             const resized = await resizeImage(objectUrl);
             imageDatas.push(resized);
        } catch (e) {
             console.warn("Failed to resize native image, sending raw.", e);
             // Fallback
             const base64EncodedData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
             });
             imageDatas.push({ mimeType: file.type, data: base64EncodedData });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }
    
    // Convert the collected image data to the provider-specific format
    if (provider === AIProvider.MISTRAL) {
        return imageDatas.map(({ mimeType, data }) => ({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${data}` },
        }));
    } 
    
    // Default to Gemini format
    return imageDatas.map(({ mimeType, data }) => ({
        inlineData: { mimeType, data }
    }));
};

const buildSystemInstruction = (settings: Settings): string => {
    const platformGuidelines = getPlatformGuidelines(settings.platform);
    
    const logoExamples = `
       - "Elegant black and white fox head logo design, perfect for branding"
       - "Upgradable logo with a blue ship and shovel, symbolizing progress and innovation"
       - "Stylized logo with three green leaves and a glowing yellow starburst"
    `;

    const standardExamples = `
       - "Skull with horns holding crossed swords in fiery background, dark fantasy art, logo design"
       - "A stylized bird wearing a striped shirt and blue shorts standing on one leg"
    `;

    // Calculate approximate word count (heuristic: 1 word ~ 5-6 chars)
    // Asking for "50 characters" often fails, asking for "10 words" works better.
    const minWords = Math.ceil(Math.max(10, settings.titleLength.min) / 5);
    
    // If the max is short, add strict concise constraint
    const brevityConstraint = settings.titleLength.max < 120 
        ? "STRICT: Keep the title CONCISE and SHORT. Do not be verbose." 
        : "";

    return `
    Role: Elite Stock Photography & Vector Metadata Specialist.
    
    Objective: Generate highly descriptive, SEO-optimized titles and keywords that maximize sales.
    
    **TITLE GENERATION RULES:**
    1. **LENGTH CONSTRAINT**: 
       - Title MUST be at least ${minWords} words long (approx ${settings.titleLength.min} characters).
       - Maximum length is ${settings.titleLength.max} characters. ${brevityConstraint}
       - If visual details are sparse, elaborate on textures, lighting, and mood to meet the MINIMUM length.
    2. **GUIDELINES**: ${platformGuidelines}
    3. **EXAMPLES (GOOD)**:
       ${settings.imageType === ImageType.LOGO ? logoExamples : standardExamples}
    4. **BEHAVIOR**: Describe the subject's accessories, colors, and the exact action. Integrate style descriptions naturally (e.g. "A flat vector illustration of..."). Do NOT append a list of tags at the end.
    5. **ISOLATION**: Do NOT include "Isolated on white" or "Transparent background" in the generated title. (This is added programmatically based on user settings).
    6. **PROHIBITED**: Do not start with "A picture of", "Vector of". Start directly with the subject.
    
    **KEYWORD RULES:**
    1. Generate EXACTLY ${settings.maxKeywords} keywords. This is a strict count.
    2. Single words only. Split phrases (e.g., "red-car" -> "red", "car").
    3. Include subject, action, style, mood, and specific object keywords.
    
    Output strictly JSON.
    `;
};

const buildPrompt = (processedFile: ProcessedFile, settings: Settings, provider: AIProvider) => {
    const assetTypeInfo = getAssetTypeInfo(processedFile.file, settings.imageType);
    
    // Explicitly tell the AI NOT to add isolation text, we will add it manually if needed
    const isolationInstr = "Do NOT add 'Isolated on white' or 'Transparent background' to the title. We will add it programmatically.";
    
    const minWords = Math.ceil(Math.max(10, settings.titleLength.min) / 5);
    const brevityConstraint = settings.titleLength.max < 120 
        ? "Keep it CONCISE. Do not exceed limit." 
        : "Be DESCRIPTIVE.";

    const visualPrompt = `
    Analyze this ${assetTypeInfo}.
    
    Task: Generate a high-converting Title and Keywords for ${settings.platform}.
    
    CRITICAL TITLE INSTRUCTIONS:
    - **LENGTH**: The title MUST be at least ${minWords} words long (Min ${settings.titleLength.min} chars).
    - ${brevityConstraint}
    - Describe the SUBJECT in detail (appearance, clothing, items held).
    - Describe the ACTION or POSE.
    - Describe the BACKGROUND or CONTEXT.
    - Describe the ART STYLE (e.g., "dark fantasy art", "sticker design", "flat vector", "logo design").
    - ${isolationInstr}
    
    Filename: ${processedFile.file.name}
    Prefix: ${settings.prefix}
    Suffix: ${settings.suffix}
    `;

    if (provider === AIProvider.MISTRAL) {
         return `
        ${visualPrompt}
        
        Output JSON: { "title": "...", "keywords": ["..."] }
        `;
    }

    return visualPrompt;
};

const normalizeMetadata = (metadata: any, settings: Settings): { title: string; description: string; keywords: string[] } => {
    const rawTitle = metadata.title || metadata.Title || '';
    const rawDesc = metadata.description || metadata.Description || '';
    const rawKeywords = metadata.keywords || metadata.Keywords || [];

    let title = (rawTitle || '').trim();
    
    // 1. Clean prefixes
    title = title.replace(/^(A |An |The |Image of |Photo of |Vector of )/i, "");

    // 2. Remove hyphens as requested
    title = title.replace(/-/g, " ");

    // 3. GLOBAL CLEANUP: Aggressively strip ANY AI-generated isolation text.
    title = title.replace(/\bisolated on (a\s+)?(white|transparent)(\s+background)?\b/gi, " ");
    title = title.replace(/\bon (a\s+)?(white|transparent)(\s+background)?\b/gi, " ");

    // 4. CLEANUP STYLE TAGS AT END
    const tagsToRemove = ["vector art", "logo design", "illustration", "vector illustration", "flat design"];
    for (const tag of tagsToRemove) {
        const regex = new RegExp(`[,\\s]+${tag}\\.?$`, 'gi');
        title = title.replace(regex, "");
    }

    // Clean up resulting punctuation mess
    title = title.replace(/\s*,\s*,/g, ","); // double commas
    title = title.replace(/\s+/g, ' ').trim(); // double spaces
    title = title.replace(/,\s*$/, ""); // trailing comma

    // --- HARD LENGTH ENFORCEMENT ---
    // Calculate how much space we have left after we add mandatory suffixes/prefixes
    let reservedLength = 0;
    let isolationSuffix = "";
    
    if (settings.isolatedWhite) {
        isolationSuffix = ", isolated on white background";
        reservedLength += isolationSuffix.length;
    } else if (settings.isolatedTransparent) {
        isolationSuffix = ", isolated on transparent background";
        reservedLength += isolationSuffix.length;
    }

    if (settings.prefix) reservedLength += (settings.prefix.length + 1); // +1 for space
    if (settings.suffix) reservedLength += (settings.suffix.length + 1);

    // Calculate max allowed length for the AI core text
    const maxCoreLength = Math.max(10, settings.titleLength.max - reservedLength);

    // If core title is too long, truncate it intelligently
    if (title.length > maxCoreLength) {
        // Cut to limit
        let truncated = title.substring(0, maxCoreLength);
        // Try to walk back to last space to avoid cutting a word in half
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 0) {
            truncated = truncated.substring(0, lastSpace);
        }
        title = truncated;
    }

    // 5. Force Append Isolation Suffix
    title = title + isolationSuffix;
    
    // 6. Apply Prefix/Suffix
    if (settings.prefix && !title.toLowerCase().startsWith(settings.prefix.toLowerCase())) {
        title = `${settings.prefix} ${title}`;
    }
    if (settings.suffix && !title.toLowerCase().endsWith(settings.suffix.toLowerCase())) {
        title = `${title} ${settings.suffix}`;
    }

    // Capitalize
    if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    metadata.title = title;
    // Force Description to match Title by default
    metadata.description = title; 
    
    const keywordsInput = Array.isArray(rawKeywords) 
        ? rawKeywords.join(',') 
        : rawKeywords || '';

    let keywordsArray = keywordsInput.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
    
    // --- STRICT SINGLE WORD ENFORCEMENT ---
    const stopWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'and', 'or', 'but', 'is', 'are', 'illustration', 'vector', 'image', 'background']);
    
    keywordsArray = keywordsArray.flatMap((k: string) => {
        return k.split(/[\s\-_]+/);
    }).map(k => k.replace(/[^\w]/g, '')) 
      .filter((k: string) => k.length > 2 && !stopWords.has(k) && !/^\d+$/.test(k)); 

    metadata.keywords = [...new Set(keywordsArray)];
    return metadata;
};

const parseApiError = (error: any, apiKey: string, provider: 'Gemini' | 'Mistral'): string => {
    const message = String(error?.message || error).toLowerCase();
    const keyIdentifier = `(key ending in ...${apiKey.slice(-4)})`;

    if (message.includes('(400)')) {
        return `Bad Request ${keyIdentifier}: The AI model rejected the request.`;
    }
    if (message.includes('(401)') || message.includes('(403)')) {
        return `Invalid API Key ${keyIdentifier}`;
    }
    if (message.includes('(429)') || message.includes('quota') || message.includes('resource_exhausted')) {
        return `Quota Exceeded ${keyIdentifier}`;
    }
    if (message.includes('(500)') || message.includes('(503)')) {
        return `Server Error ${keyIdentifier}`;
    }
    if (message.includes('failed to fetch')) {
        return `Network Error`;
    }
    if (message.includes('finishreason: safety') || message.includes('blocked: safety')) {
         return `Content Blocked ${keyIdentifier}`;
    }

    const rawMessage = error instanceof Error ? error.message : 'Unknown error';
    return `Error ${keyIdentifier}: ${rawMessage}`;
};

const isRetryableApiError = (error: any): boolean => {
    const message = String(error?.message || error).toLowerCase();
    // 429 (Quota) is NOT retryable for the SAME KEY. We want to fail fast to switch keys.
    if (message.includes('429') || message.includes('quota') || message.includes('resource_exhausted')) return false;
    
    // Other 4xx are also not retryable
    if (/\(4\d\d\)/.test(message)) return false;
    
    // 5xx errors are retryable
    if (message.includes('500') || message.includes('503') || message.includes('internal server error')) return true;
    if (message.includes('overloaded')) return true;
    
    // Network errors are retryable
    if (message.includes('failed to fetch')) return true;
    if (message.includes('unexpected end of json input') || message.includes('json')) return true;
    
    return false;
};

// MISTRAL IMPLEMENTATION
const generateMistralMetadata = async (
    processedFile: ProcessedFile,
    settings: Settings
): Promise<{ title: string; description: string; keywords: string[] }> => {
    const { mistralApiKeys } = settings;
    const keysToUse = [...new Set([...mistralApiKeys, ...BACKUP_MISTRAL_KEYS])];
    const availableKeys = (keysToUse && keysToUse.length > 0) ? keysToUse : BACKUP_MISTRAL_KEYS;

    const errors: string[] = [];
    const shuffledKeys = [...availableKeys].sort(() => Math.random() - 0.5);

    for (const apiKey of shuffledKeys) {
        try {
            const systemPrompt = buildSystemInstruction(settings);

            const userPromptText = buildPrompt(processedFile, settings, AIProvider.MISTRAL);

            const messages: any[] = [
                { role: 'system', content: systemPrompt }
            ];

            const userContent: any[] = [
                { type: 'text', text: userPromptText }
            ];

            let visualParts: any[] = [];
            try {
                visualParts = await getVisualContentParts(processedFile, AIProvider.MISTRAL);
            } catch(e) {
                console.error("Failed to process visual content for Mistral:", e);
            }

            if (visualParts.length > 0) {
                 userContent.push(...visualParts);
            }

            messages.push({ role: 'user', content: userContent });

            const apiCall = async () => {
                const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'pixtral-12b-2409', 
                        messages: messages,
                        temperature: 0.1, 
                        max_tokens: 2000, 
                        response_format: { type: 'json_object' } 
                    }),
                });

                const text = await response.text();
                if (!response.ok) throw new Error(text);
                if (!text) throw new Error("Empty response");

                try {
                    return JSON.parse(text);
                } catch(e) {
                    const cleaned = extractJson(text);
                    return JSON.parse(cleaned);
                }
            };

            const responseData = await retryWithBackoff(apiCall, 3, 2000, isRetryableApiError);
            const content = responseData.choices[0]?.message?.content;
            const jsonString = extractJson(content);
            const metadata = JSON.parse(jsonString);

            return normalizeMetadata(metadata, settings);

        } catch (e) {
            console.error(`Mistral error`, e);
            errors.push(parseApiError(e, apiKey, 'Mistral'));
        }
    }
    throw new Error(`All Mistral API keys failed.`);
};

// GEMINI IMPLEMENTATION
const generateGeminiMetadata = async (
    processedFile: ProcessedFile,
    settings: Settings
): Promise<{ title: string; description: string; keywords: string[] }> => {
    const { geminiApiKeys, geminiModel } = settings;
    
    // Strategy: Prioritize User Keys, then Backup Keys.
    // This ensures if a user provides a working key, it's used immediately without waiting for exhausted public keys.
    const userKeys = [...new Set(geminiApiKeys)].filter(k => k.trim().length > 0);
    const backupKeys = [...new Set(BACKUP_API_KEYS)];
    
    // Shuffle arrays independently to distribute load but keep priority groups
    const shuffledUserKeys = userKeys.sort(() => Math.random() - 0.5);
    const shuffledBackupKeys = backupKeys.sort(() => Math.random() - 0.5);
    
    const allKeysOrdered = [...shuffledUserKeys, ...shuffledBackupKeys];

    if (allKeysOrdered.length === 0) {
        throw new Error("No API keys available.");
    }

    const prompt = buildPrompt(processedFile, settings, AIProvider.GEMINI);
    const systemInstruction = buildSystemInstruction(settings);
    const isAdobeStock = settings.platform === Platform.ADOBE_STOCK;

    const responseSchema = { 
        type: Type.OBJECT, 
        properties: {
            title: { type: Type.STRING },
            keywords: { type: Type.STRING },
            ...(isAdobeStock ? {} : { description: { type: Type.STRING } })
        }, 
        required: ['title', 'keywords'],
    };
    
    const errors: string[] = [];
    const fallbackChain = [GeminiModel.FLASH_LITE, GeminiModel.PRO, GeminiModel.FLASH_2_0, GeminiModel.FLASH];
    const modelsToAttempt: string[] = [];
    
    if (fallbackChain.includes(geminiModel)) {
        modelsToAttempt.push(geminiModel);
        fallbackChain.forEach(m => { if (m !== geminiModel) modelsToAttempt.push(m); });
    } else {
        modelsToAttempt.push(geminiModel, ...fallbackChain);
    }

    for (const currentModel of modelsToAttempt) {
        for (const key of allKeysOrdered) {
            try {
                const ai = new GoogleGenAI({ apiKey: key });
                const contentParts: any[] = [];
                
                let visualParts: any[] = [];
                 try {
                    visualParts = await getVisualContentParts(processedFile, AIProvider.GEMINI);
                } catch(e) {}

                let finalPrompt = prompt;
                if (visualParts.length > 0) {
                     contentParts.push(...visualParts);
                } else {
                     const canProcessVisually = SUPPORTED_MIME_TYPES_FOR_VISUAL_ANALYSIS.includes(processedFile.file.type) || processedFile.preview.startsWith('blob:');
                     if (canProcessVisually) {
                        finalPrompt = buildPrompt({ ...processedFile, preview: '' }, settings, AIProvider.GEMINI);
                    }
                }
                contentParts.push({ text: finalPrompt });
                
                const apiCall = () => ai.models.generateContent({
                    model: currentModel,
                    contents: { parts: contentParts },
                    config: { 
                        responseMimeType: 'application/json', 
                        responseSchema: responseSchema,
                        systemInstruction: systemInstruction,
                        temperature: 0.2, 
                    }
                });

                // NOTE: We rely on isRetryableApiError to return FALSE for Quota errors.
                // This ensures we don't retry the same exhausted key in this loop, but fail fast to the next key.
                const response = await retryWithBackoff(apiCall, 1, 500, isRetryableApiError) as GenerateContentResponse;
                
                if (!response.text) throw new Error("Empty response from AI");
                const metadata = JSON.parse(response.text);
                return normalizeMetadata(metadata, settings);

            } catch (e) {
                const message = String(e?.message || e).toLowerCase();
                // If it's a quota error, we just log and continue to the next KEY immediately.
                // If it's a model specific error (e.g. not found), we might continue to next MODEL after keys.
                
                // Only delay if it's a rate limit to respect server health, but switch key immediately.
                if (message.includes('429')) {
                     // console.warn(`Key ...${key.slice(-4)} exhausted.`);
                }
                errors.push(`[${currentModel}] ${parseApiError(e, key, 'Gemini')}`);
            }
        }
    }
    
    // If we reach here, all keys for all models failed.
    const uniqueErrors = [...new Set(errors)].slice(0, 3);
    throw new Error(`Generation failed. ${uniqueErrors.join(' | ')}`);
};
