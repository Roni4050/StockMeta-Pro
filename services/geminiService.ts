
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { ProcessedFile, Settings, Platform, ImageType, AIProvider, GeminiModel } from '../types';
import { retryWithBackoff } from './apiUtils';

// Global indices for Round-Robin Key Rotation
let globalGeminiKeyIndex = 0;
let globalMistralKeyIndex = 0;
let globalOpenRouterKeyIndex = 0;
let globalGroqKeyIndex = 0;

/**
 * Helper to safely parse JSON from AI response, handling markdown blocks, newlines, and extra text.
 */
const parseJSONSafely = (text: string): any => {
    // 1. Locate the outer JSON object
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1 || start >= end) {
        throw new Error(`Response does not contain a valid JSON object. Preview: ${text.substring(0, 50)}...`);
    }

    const jsonStr = text.substring(start, end + 1);

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // Fallback Strategy for malformed JSON
        try {
            let fixed = jsonStr;
            
            // 1. Replace literal newlines/tabs with spaces
            fixed = fixed.replace(/[\n\r\t]/g, ' ');
            
            // 2. Remove trailing commas
            fixed = fixed.replace(/,\s*([}\]])/g, '$1');

            // 3. Attempt to fix markdown code block artifacts if inside
            fixed = fixed.replace(/```json/g, '').replace(/```/g, '');
            
            // 4. Advanced: Attempt to fix unescaped quotes inside values. 
            return JSON.parse(fixed);
        } catch (e2) {
             throw new Error(`Failed to parse JSON. Original Error: ${(e as Error).message}. Content: ${jsonStr.substring(0, 100)}...`);
        }
    }
};

/**
 * Returns processing constraints based on the provider.
 * Groq and Mistral have strict payload limits, so we force lower res and aggressive compression.
 */
const getProcessingConfig = (provider: AIProvider) => {
    if (provider === AIProvider.GROQ || provider === AIProvider.MISTRAL || provider === AIProvider.OPENROUTER) {
        return { maxDim: 512, quality: 0.6, outputMime: 'image/jpeg' };
    }
    // Gemini handles larger payloads well
    return { maxDim: 1024, quality: 0.8, outputMime: 'image/jpeg' };
};

/**
 * Resizes and compresses an image to ensure it fits within AI model constraints.
 */
const resizeImage = async (url: string, maxDimension: number, quality: number, outputType: string): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Prevent tainted canvas
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
            if (width === 0 || height === 0) {
                // Fallback for SVGs or weird images that didn't load dims
                width = 1024;
                height = 1024;
            }

            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width *= ratio;
                height *= ratio;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(width);
            canvas.height = Math.floor(height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context unavailable'));
                return;
            }
            
            // Fill background for JPEGs (handling transparent PNGs/SVGs)
            if (outputType === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
            } else {
                ctx.clearRect(0, 0, width, height);
            }
            
            try {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL(outputType, quality);
                const parts = dataUrl.split(',');
                if (parts.length < 2) {
                    reject(new Error("Invalid data URL generated during resize"));
                    return;
                }
                resolve({
                    mimeType: outputType,
                    data: parts[1]
                });
            } catch (err) {
                reject(new Error("Failed to draw image to canvas (likely tainted or corrupt)."));
            }
        };
        img.onerror = (e) => reject(new Error("Failed to load image for resizing. File may be corrupt."));
        img.src = url;
    });
};

/**
 * Converts an SVG data URL to a PNG base64 string reliably.
 */
const convertSvgToPng = (svgDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Force a decent resolution for the AI to see details
            const size = 1024; 
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            
            // 1. Fill White Background (Crucial for black logos)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 2. Calculate scaling to fit 1024x1024 while maintaining aspect ratio
            const sourceWidth = img.width || 500;
            const sourceHeight = img.height || 500;
            
            const hRatio = canvas.width / sourceWidth;
            const vRatio = canvas.height / sourceHeight;
            const ratio = Math.min(hRatio, vRatio);
            
            const renderWidth = sourceWidth * ratio;
            const renderHeight = sourceHeight * ratio;
            
            const centerShiftX = (canvas.width - renderWidth) / 2;
            const centerShiftY = (canvas.height - renderHeight) / 2;
            
            ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight, centerShiftX, centerShiftY, renderWidth, renderHeight);

            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl.split(',')[1]); // Return pure Base64
        };
        img.onerror = (e) => reject(new Error('Failed to render SVG. The file might be malformed.'));
        img.src = svgDataUrl;
    });
};

/**
 * Extracts frames from video.
 */
const extractFramesFromVideo = (videoFile: File, frameCount: number, maxDim: number, quality: number): Promise<{ timestamp: number; data: string; }[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.style.position = 'absolute';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        video.style.zIndex = '-1';
        document.body.appendChild(video);

        const canvas = document.createElement('canvas');
        const videoUrl = URL.createObjectURL(videoFile);
        
        const cleanup = () => {
            try {
                if (video.parentNode) document.body.removeChild(video);
                URL.revokeObjectURL(videoUrl);
                video.removeAttribute('src');
                video.load();
            } catch (e) { console.warn("Cleanup warning:", e); }
        };

        const masterTimeout = setTimeout(() => {
            cleanup();
            if (frames.length > 0) resolve(frames);
            else reject(new Error("Video processing timed out."));
        }, 40000); // Increased timeout for 4K files

        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        
        const frames: { timestamp: number; data: string; }[] = [];

        video.onerror = () => {
             clearTimeout(masterTimeout);
             cleanup();
             reject(new Error(`Video Error: ${video.error?.message || "Unknown error"}`));
        };

        video.onloadeddata = async () => {
            try {
                let w = video.videoWidth;
                let h = video.videoHeight;
                if (w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w *= ratio;
                    h *= ratio;
                }

                canvas.width = Math.floor(w);
                canvas.height = Math.floor(h);
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas context not available");

                const duration = video.duration;
                const safeDuration = (isFinite(duration) && duration > 0) ? duration : 5; 
                const interval = safeDuration / (frameCount + 1);

                for (let i = 1; i <= frameCount; i++) {
                    const seekTime = interval * i;
                    if (seekTime > safeDuration) break;
                    
                    try {
                        video.currentTime = seekTime;
                        await new Promise<void>((res, rej) => {
                            const seekTimeout = setTimeout(() => rej(new Error('Seek timeout')), 5000);
                            const onSeeked = () => {
                                clearTimeout(seekTimeout);
                                video.removeEventListener('seeked', onSeeked);
                                setTimeout(res, 100);
                            };
                            video.addEventListener('seeked', onSeeked);
                        });

                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const frameDataUrl = canvas.toDataURL('image/jpeg', quality);
                        frames.push({
                            timestamp: seekTime,
                            data: frameDataUrl.split(',')[1]
                        });
                    } catch (e) {
                        console.warn(`Frame skip at ${seekTime}s`);
                    }
                }

                clearTimeout(masterTimeout);
                cleanup();
                resolve(frames.length > 0 ? frames : []);
            } catch (e) {
                clearTimeout(masterTimeout);
                cleanup();
                reject(e);
            }
        };
        video.src = videoUrl;
    });
};

const getPlatformGuidelines = (platform: Platform): string => {
    switch (platform) {
        case Platform.ADOBE_STOCK:
            return `
            ADOBE STOCK SPECIFIC GUIDELINES:
            1. **STRUCTURE**: [Main Subject] + [Action/Interaction] + [Context/Location] + [Art Style].
            2. **CRITICAL LENGTH RULE**: The title MUST be descriptive and detailed to meet the MINIMUM length requirement. Do not generate short titles.
            `;
        default:
            return `GENERAL GUIDELINES: Descriptive, accurate, and long. Focus on visual content.`;
    }
};

const buildSystemInstruction = (settings: Settings, isVector: boolean, isRaster: boolean, isVideo: boolean, effectiveMinTitleLength: number, effectiveMaxTitleLength: number, targetKeywordCount: number): string => {
    const { platform, isolatedWhite, isolatedTransparent, negativeTitleWords } = settings;
    const guidelines = getPlatformGuidelines(platform);
    
    return `
    You are an expert Stock Media Metadata Specialist.
    YOUR GOAL: Analyze the media style and content to generate accurate metadata.
    
    ${guidelines}

    VISUAL STYLE ANALYSIS (MANDATORY):
    Determine the visual style of the image and apply these rules:
    
    1. **LOGO / ICON / SYMBOL**:
       - If it looks like a logo, icon, or lettermark, use keywords: "logo, icon, symbol, vector, branding, identity, flat, minimalist".
       - Title must describe the shape explicitly (e.g., "Minimalist eagle head logo symbol").
    
    2. **SILHOUETTE**:
       - If the subject is black against a light background with no internal detail, it is a "Silhouette".
       - Use keywords: "silhouette, black, shadow, outline, profile, contrast, backlighting".
    
    3. **3D RENDER**:
       - If it looks CGI, glossy, plastic, or has isometric perspective, it is a "3D Render".
       - Use keywords: "3d illustration, 3d rendering, cgi, cartoon, plastic, glossy, isometric".
    
    4. **VECTOR / FLAT ILLUSTRATION**:
       - If it looks drawn with clean lines and flat colors, it is a "Vector".
       - Use keywords: "vector, illustration, flat design, graphic, clip art".

    RULES:
    1. Title MUST be strictly BETWEEN ${effectiveMinTitleLength} and ${effectiveMaxTitleLength} characters long (excluding suffixes).
    2. If the image is simple (like a logo or silhouette), describe the SHAPE, CONCEPT, STYLE, and COLOR to meet the length requirement.
    3. ${isolatedWhite ? "CRITICAL: Image is isolated on WHITE background." : ""}
    4. ${isolatedTransparent ? "CRITICAL: Image is isolated on TRANSPARENT background." : ""}
    5. ${isVideo ? "VIDEO ANALYSIS: Describe motion (panning, zoom, slow-mo). Treat frames as timeline." : ""}
    6. ${isVector ? "VECTOR: Mention 'Vector illustration' or 'Flat design'." : ""}
    7. ${negativeTitleWords ? `FORBIDDEN TITLE WORDS: ${negativeTitleWords}` : ""}
    8. Generate ${targetKeywordCount} STRICTLY SINGLE-WORD keywords.
    9. FORBIDDEN PHRASE: Do NOT use "realistic illustration". Use "illustration" or "3D render" or "vector" as appropriate.
    
    OUTPUT JSON ONLY. 
    CRITICAL: Ensure all strings are properly escaped. Do not use Markdown formatting (no \`\`\`json).
    Structure: { "title": "...", "description": "...", "keywords": [...] }
    `;
};

export const generateMetadata = async (processedFile: ProcessedFile, settings: Settings) => {
    const { file, preview } = processedFile;
    const { aiProvider, geminiApiKeys, mistralApiKeys, openRouterApiKeys, groqApiKeys, geminiModel, openRouterModel, groqModel } = settings;

    // 1. DETERMINE PROCESSING CONFIG (Resolves Payload/Bad Request Issues)
    const config = getProcessingConfig(aiProvider);
    
    let parts: any[] = [];

    try {
        if (file.type.startsWith('video/')) {
            const frames = await extractFramesFromVideo(file, 6, config.maxDim, config.quality); 
            parts = frames.map(frame => ({ inlineData: { mimeType: 'image/jpeg', data: frame.data } }));
        } else if (file.name.match(/\.(eps|ai|pdf)$/i)) {
            if (preview && !preview.startsWith('blob:')) {
                 const response = await fetch(preview);
                 const blob = await response.blob();
                 const { data, mimeType } = await resizeImage(URL.createObjectURL(blob), config.maxDim, config.quality, config.outputMime);
                 parts = [{ inlineData: { mimeType, data } }];
            } else if (file.type === 'application/pdf') {
                 const getBase64 = (f: File) => new Promise<string>((res) => { const r = new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.readAsDataURL(f); });
                 const b64 = await getBase64(file);
                 parts = [{ inlineData: { mimeType: 'application/pdf', data: b64 } }];
            } else {
                 if (preview) {
                     if (preview.startsWith('data:image/svg+xml') || file.type === 'image/svg+xml') {
                         const pngBase64 = await convertSvgToPng(preview);
                         const dataUrl = `data:image/png;base64,${pngBase64}`;
                         const { data, mimeType } = await resizeImage(dataUrl, config.maxDim, config.quality, config.outputMime);
                         parts = [{ inlineData: { mimeType, data } }];
                     } else {
                         const { data, mimeType } = await resizeImage(preview, config.maxDim, config.quality, config.outputMime);
                         parts = [{ inlineData: { mimeType, data } }];
                     }
                 } else {
                      throw new Error("Vector file requires a companion JPG/PNG/SVG preview.");
                 }
            }
        } else if (file.type === 'image/svg+xml') {
            const url = URL.createObjectURL(file);
            const pngBase64 = await convertSvgToPng(url);
            URL.revokeObjectURL(url);
            const dataUrl = `data:image/png;base64,${pngBase64}`;
            const { data, mimeType } = await resizeImage(dataUrl, config.maxDim, config.quality, config.outputMime);
            parts = [{ inlineData: { mimeType, data } }];
        } else {
            const { mimeType, data } = await resizeImage(preview || URL.createObjectURL(file), config.maxDim, config.quality, config.outputMime);
            parts = [{ inlineData: { mimeType, data } }];
        }
    } catch (e) {
        throw new Error(`Preprocessing failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // --- 2. CALCULATE PROMPT CONSTRAINTS ---
    let mandatorySuffixLength = 0;
    if (settings.isolatedWhite) mandatorySuffixLength = "isolated on white background".length;
    else if (settings.isolatedTransparent) mandatorySuffixLength = "isolated on transparent background".length;

    const userSuffixLength = settings.suffix ? settings.suffix.length + 1 : 0;
    const userPrefixLength = settings.prefix ? settings.prefix.length + 1 : 0;
    const reservedLength = mandatorySuffixLength + userSuffixLength + userPrefixLength;
    
    const effectiveMaxTitleLength = Math.max(30, settings.titleLength.max - reservedLength - 2);
    const effectiveMinTitleLength = Math.max(15, settings.titleLength.min - reservedLength);
    const targetKeywordCount = settings.maxKeywords + 25;

    const isVectorFile = file.name.match(/\.(eps|ai|svg|pdf)$/i) !== null;
    const isVectorMode = settings.imageType === ImageType.VECTOR || settings.imageType === ImageType.LOGO;
    const isVideo = file.type.startsWith('video/');
    const isRaster = !isVectorFile && !isVideo;

    const systemPrompt = buildSystemInstruction(settings, (isVectorFile || isVectorMode), isRaster, isVideo, effectiveMinTitleLength, effectiveMaxTitleLength, targetKeywordCount);
    
    const enforceIsolationKeywords = (json: any) => {
        if (!json.keywords) json.keywords = [];
        let required: string[] = [];
        if (settings.isolatedWhite) required = ['isolated', 'white', 'background'];
        else if (settings.isolatedTransparent) required = ['isolated', 'transparent', 'background'];
        required.forEach(req => { if (!json.keywords.includes(req)) json.keywords.push(req); });
        return json;
    };

    const applyModifiers = (json: any) => {
        if (json.title) {
            let t = json.title;
            if (settings.prefix && settings.prefix.trim()) t = `${settings.prefix.trim()} ${t}`;
            if (settings.suffix && settings.suffix.trim()) t = `${t} ${settings.suffix.trim()}`;
            json.title = t;
        }
        if (json.keywords && settings.negativeKeywords) {
            const negs = settings.negativeKeywords.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
            if (negs.length > 0) json.keywords = json.keywords.filter((k: string) => !negs.includes(k.toLowerCase()));
        }
        return json;
    };

    const applyIsolationCasing = (json: any) => {
        if (json.title) {
            if (settings.isolatedTransparent) json.title = json.title.replace(/isolated on (a\s+)?transparent background/gi, (m:string) => m.toLowerCase());
            else if (settings.isolatedWhite) json.title = json.title.replace(/isolated on (a\s+)?white background/gi, (m:string) => m.toLowerCase());
            if (json.title.length > 0) json.title = json.title.charAt(0).toUpperCase() + json.title.slice(1);
        }
        return json;
    };
    
    const sanitizeMetadata = (json: any, maxTitleLength: number, isolatedWhite: boolean, isolatedTransparent: boolean): any => {
        if (json.keywords && Array.isArray(json.keywords)) {
            const uniqueWords = new Set<string>();
            json.keywords.forEach((k: string) => {
                const words = k.trim().split(/[\s,_,-]+/);
                words.forEach(w => {
                    const clean = w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                    if (clean.length > 1) uniqueWords.add(clean.toLowerCase());
                });
            });
            json.keywords = Array.from(uniqueWords);
        }
        // Force replace "realistic illustration"
        const cleanText = (text: string) => text
            .replace(/digital illustration displaying/gi, "digital illustration of")
            .replace(/\brealistic illustration\b/gi, "illustration");

        if (json.title && typeof json.title === 'string') {
            let title = cleanText(json.title.trim()).replace(/^(Title|Subject|Filename|Caption|Image):\s*/i, "").replace(/^["']|["']$/g, "");
            let mandatorySuffix = "";
            if (isolatedWhite) mandatorySuffix = "isolated on white background";
            else if (isolatedTransparent) mandatorySuffix = "isolated on transparent background";

            if (mandatorySuffix) {
                const bgPhrases = [
                    /isolated\s+isolated/gi, 
                    /isolated\s+on\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                    /isolated\s+over\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                    /isolated\s+against\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                    /\bisolated\b/gi, 
                    /\bwhite\s*background\b/gi,
                    /\btransparent\s*background\b/gi,
                    /\b(on|over|against)\s+(?:a\s+)?white\s*$/gi,
                    /\b(on|over|against)\s+(?:a\s+)?transparent\s*$/gi
                ];
                bgPhrases.forEach(r => { title = title.replace(r, ' '); });
                title = title.replace(/\s+(on|over|against|in|with|at)\s*$/i, "");
                title = title.replace(/\s{2,}/g, ' ').trim();
            }

            const availableSpace = mandatorySuffix ? (maxTitleLength - mandatorySuffix.length - 1) : maxTitleLength;
            if (title.length > availableSpace) {
                 let truncated = title.substring(0, availableSpace);
                 const lastSpace = truncated.lastIndexOf(' ');
                 if (lastSpace > availableSpace * 0.7) truncated = truncated.substring(0, lastSpace);
                 title = truncated;
            }
            if (mandatorySuffix) title = `${title} ${mandatorySuffix}`;
            if (title.endsWith(',') || title.endsWith(';')) title = title.slice(0, -1);
            json.title = title;
        }
        if (json.description) json.description = cleanText(json.description.trim()).replace(/^(Description|Caption):\s*/i, "");
        return json;
    };

    const processResponseJSON = (json: any) => {
        let currentMaxTitle = settings.titleLength.max;
        if (settings.platform === Platform.TEMPLATE_MONSTER) currentMaxTitle = Math.min(currentMaxTitle, 100);
        json = enforceIsolationKeywords(json);
        json = applyModifiers(json);
        json = sanitizeMetadata(json, currentMaxTitle, settings.isolatedWhite, settings.isolatedTransparent);
        json = applyIsolationCasing(json);
        return json;
    };

    // --- EXECUTION WITH ROTATION ---
    
    const getErrorMessage = (e: any) => e?.message || String(e);

    const callGemini = async () => {
        const validKeys = geminiApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No Gemini API Key found.");
        
        const attempts = validKeys.length;
        for (let i = 0; i < attempts; i++) {
            const keyIndex = (globalGeminiKeyIndex + i) % validKeys.length;
            const key = validKeys[keyIndex];
            try {
                const ai = new GoogleGenAI({ apiKey: key });
                const modelName = geminiModel || GeminiModel.FLASH;
                
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: modelName,
                    contents: {
                        role: 'user',
                        parts: [...parts, { text: systemPrompt + "\n\nProvide the JSON response:" }]
                    },
                    config: {
                        responseMimeType: "application/json",
                        temperature: 0.7,
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["title", "description", "keywords"]
                        }
                    }
                });
                const text = response.text;
                if (!text) throw new Error("Empty response from Gemini");
                let json = parseJSONSafely(text);
                globalGeminiKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);
            } catch (e: any) {
                const msg = getErrorMessage(e).toLowerCase();
                if (msg.includes('429') || msg.includes('quota') || msg.includes('403')) {
                    continue; 
                }
                throw e; 
            }
        }
        throw new Error("All Gemini keys exhausted.");
    };

    const callMistral = async () => {
        if (!parts || parts.length === 0) throw new Error("No image data available for Mistral.");
        const validKeys = mistralApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No Mistral API Key found.");
        
        let effectiveParts = parts;
        if (parts.length > 2) {
             effectiveParts = [parts[0], parts[parts.length - 1]];
             effectiveParts = Array.from(new Set(effectiveParts));
        }

        const messagesContent: any[] = [];
        effectiveParts.forEach(p => {
            const url = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            messagesContent.push({ type: "image_url", image_url: { url } });
        });
        messagesContent.push({ type: "text", text: systemPrompt + " Output ONLY JSON." });

        const payload = {
            model: "pixtral-12b-2409", 
            messages: [{ role: "user", content: messagesContent }],
            temperature: 0.7, 
            response_format: { type: "json_object" }
        };

        for (let i = 0; i < validKeys.length; i++) {
             const keyIndex = (globalMistralKeyIndex + i) % validKeys.length;
             const key = validKeys[keyIndex];
             try {
                const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                     if (res.status === 429 || res.status >= 500) continue;
                     const errTxt = await res.text();
                     throw new Error(`Mistral Error ${res.status}: ${errTxt}`);
                }
                const data = await res.json();
                if (!data.choices?.[0]?.message?.content) throw new Error("Invalid Mistral response");
                let json = parseJSONSafely(data.choices[0].message.content);
                if (json.title) json.title = json.title.replace(/^(Title|Subject):\s*/i, "").trim();
                globalMistralKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);
            } catch (err: any) {
                if (i === validKeys.length - 1) throw err;
            }
        }
        throw new Error("Mistral failed.");
    };

    const callGroq = async () => {
        if (!parts || parts.length === 0) throw new Error("No image data available for Groq.");
        const validKeys = groqApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No Groq API Key found.");

        let effectiveParts = parts;
        if (parts.length > 1) {
             const idx = Math.floor(parts.length / 2);
             effectiveParts = [parts[idx]];
        }

        const messagesContent: any[] = [];
        effectiveParts.forEach(p => {
            const url = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            messagesContent.push({ type: "image_url", image_url: { url } });
        });
        messagesContent.push({ type: "text", text: systemPrompt + " Output ONLY JSON." });

        let modelId = groqModel ? groqModel.trim() : "meta-llama/llama-4-scout-17b-16e-instruct";
        if (modelId === "llama-3.2-11b-vision-preview" || modelId === "llama-3.2-90b-vision-preview") {
             modelId = "meta-llama/llama-4-scout-17b-16e-instruct";
        }
        
        for (let i = 0; i < validKeys.length; i++) {
             const keyIndex = (globalGroqKeyIndex + i) % validKeys.length;
             const key = validKeys[keyIndex];
             try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
                    body: JSON.stringify({
                        model: modelId,
                        messages: [{ role: "user", content: messagesContent }],
                        temperature: 0.7,
                        response_format: { type: "json_object" }
                    })
                });

                if (!res.ok) {
                     let errorDetails = await res.text();
                     let status = res.status;
                     
                     try {
                        const jsonError = JSON.parse(errorDetails);
                        if (jsonError.error && jsonError.error.message) {
                            errorDetails = jsonError.error.message;
                        }
                     } catch (e) { /* ignore */ }

                     // Rate Limit or Server Error -> Rotate Key
                     if (status === 429 || status >= 500) {
                         console.warn(`Groq key ${key.substring(0,6)}... failed with ${status}. Rotating.`);
                         continue; 
                     }
                     
                     // Bad Request (Usually non-vision model or payload too large)
                     if (status === 400) {
                        if (errorDetails.toLowerCase().includes("vision") || errorDetails.toLowerCase().includes("image")) {
                             throw new Error("The selected Groq model does not support image analysis. Please use a Llama 3.2 Vision model.");
                        }
                        throw new Error(`Groq Bad Request: ${errorDetails}`);
                     }

                     if (status === 413) {
                         throw new Error("Image payload too large for Groq. Please resize image or try Gemini.");
                     }

                     throw new Error(`Groq API Error (${status}): ${errorDetails}`);
                }
                
                const data = await res.json();
                if (!data.choices?.[0]?.message?.content) throw new Error("Invalid Groq response");

                let json = parseJSONSafely(data.choices[0].message.content);
                if (json.title) json.title = json.title.replace(/^(Title|Subject):\s*/i, "").trim();

                globalGroqKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);
             } catch(err: any) {
                 // Stop rotation for configuration errors
                 const msg = err.message || "";
                 if (msg.includes("does not support image") || msg.includes("payload too large") || msg.includes("Bad Request")) {
                     throw err;
                 }
                 if (i === validKeys.length - 1) throw err;
             }
        }
        throw new Error("All Groq keys exhausted or rate limited.");
    };

    const callOpenRouter = async () => {
        const validKeys = openRouterApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No OpenRouter API Key.");
        
        let effectiveParts = parts;
        if (parts.length > 4) {
             effectiveParts = [parts[0], parts[Math.floor(parts.length/2)], parts[parts.length-1]];
             effectiveParts = Array.from(new Set(effectiveParts));
        }

        const messagesContent: any[] = [];
        effectiveParts.forEach(p => {
            const url = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            messagesContent.push({ type: "image_url", image_url: { url } });
        });
        messagesContent.push({ type: "text", text: systemPrompt + " Output ONLY JSON." });

        for (let i = 0; i < validKeys.length; i++) {
             const keyIndex = (globalOpenRouterKeyIndex + i) % validKeys.length;
             const key = validKeys[keyIndex];
             const cleanKey = key.trim();

             try {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json", 
                        "Authorization": `Bearer ${cleanKey}`,
                        "HTTP-Referer": window.location.origin || "http://localhost:3000", 
                        "X-Title": "Stock Metadata Generator"
                    },
                    body: JSON.stringify({
                        model: openRouterModel || "google/gemini-2.0-flash-001",
                        messages: [{ role: "user", content: messagesContent }],
                        temperature: 0.7,
                        response_format: { type: "json_object" }
                    })
                });

                if (!res.ok) {
                     if (res.status === 429 || res.status >= 500) continue;
                     const errTxt = await res.text();
                     throw new Error(`OpenRouter Error ${res.status}: ${errTxt}`);
                }
                const data = await res.json();
                if (!data.choices?.[0]?.message?.content) throw new Error("Invalid OpenRouter response");
                let json = parseJSONSafely(data.choices[0].message.content);
                if (json.title) json.title = json.title.replace(/^(Title|Subject):\s*/i, "").trim();
                globalOpenRouterKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);
             } catch(err: any) {
                 if (i === validKeys.length - 1) throw err;
             }
        }
        throw new Error("OpenRouter failed.");
    };

    return retryWithBackoff(async () => {
        if (aiProvider === AIProvider.GEMINI) return await callGemini();
        if (aiProvider === AIProvider.MISTRAL) return await callMistral();
        if (aiProvider === AIProvider.GROQ) return await callGroq();
        return await callOpenRouter();
    }, 3, 2000, (error) => {
        const msg = getErrorMessage(error).toLowerCase();
        return msg.includes('429') || msg.includes('quota') || msg.includes('503') || msg.includes('500');
    });
};
