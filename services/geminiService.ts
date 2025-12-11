
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { ProcessedFile, Settings, Platform, ImageType, AIProvider, GeminiModel } from '../types';
import { retryWithBackoff } from './apiUtils';

// Global indices for Round-Robin Key Rotation
let globalGeminiKeyIndex = 0;
let globalMistralKeyIndex = 0;
let globalOpenRouterKeyIndex = 0;
let globalGroqKeyIndex = 0;

/**
 * Helper to safely parse JSON from AI response, handling markdown blocks and extra text.
 */
const parseJSONSafely = (text: string): any => {
    try {
        let cleanText = text.replace(/```json\s*|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            try {
                const jsonStr = text.substring(start, end + 1);
                return JSON.parse(jsonStr);
            } catch (e2) {
                try {
                     const fixedStr = text.substring(start, end + 1).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                     return JSON.parse(fixedStr);
                } catch(e3) { /* Ignore */ }
            }
        }
        throw new Error(`Failed to parse JSON. Raw output preview: ${text.substring(0, 50)}...`);
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
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            
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
        };
        img.onerror = (e) => reject(new Error("Failed to load image for resizing."));
        img.src = url;
    });
};

/**
 * Converts an SVG data URL to a PNG base64 string.
 */
const convertSvgToPng = (svgDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 1024; 
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const centerShiftX = (canvas.width - img.width * ratio) / 2;
            const centerShiftY = (canvas.height - img.height * ratio) / 2;
            ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl.split(',')[1]); // Return pure Base64
        };
        img.onerror = () => reject(new Error('Failed to load SVG image.'));
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
        }, 30000);

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
                // Calculate dimensions respecting maxDim
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
                            const seekTimeout = setTimeout(() => rej(new Error('Seek timeout')), 3000);
                            const onSeeked = () => {
                                clearTimeout(seekTimeout);
                                video.removeEventListener('seeked', onSeeked);
                                setTimeout(res, 100);
                            };
                            video.addEventListener('seeked', onSeeked);
                        });

                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        // Force JPEG for frames
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
    const { platform, isolatedWhite, isolatedTransparent, imageType, negativeTitleWords, negativeKeywords } = settings;
    const guidelines = getPlatformGuidelines(platform);
    
    return `
    You are an expert Stock Media Metadata Specialist.
    YOUR GOAL: Analyze the media style and content to generate accurate metadata.
    
    ${guidelines}
    
    RULES:
    1. Title MUST be strictly BETWEEN ${effectiveMinTitleLength} and ${effectiveMaxTitleLength} characters long (excluding suffixes).
    2. If the image is simple, add details about style, lighting, concept, or usage to meet the minimum length.
    3. ${isolatedWhite ? "CRITICAL: Image is isolated on WHITE background." : ""}
    4. ${isolatedTransparent ? "CRITICAL: Image is isolated on TRANSPARENT background." : ""}
    5. ${isVideo ? "VIDEO ANALYSIS: Describe motion (panning, zoom, slow-mo). Treat frames as timeline." : ""}
    6. ${isVector ? "VECTOR: Mention 'Vector illustration' or 'Flat design'." : ""}
    7. ${negativeTitleWords ? `FORBIDDEN TITLE WORDS: ${negativeTitleWords}` : ""}
    8. Generate ${targetKeywordCount} STRICTLY SINGLE-WORD keywords.
    
    OUTPUT JSON ONLY: { "title": "...", "description": "...", "keywords": [...] }
    `;
};

// ... existing sanitizeMetadata, enforceIsolationKeywords, applyModifiers, applyIsolationCasing, processResponseJSON ...

export const generateMetadata = async (processedFile: ProcessedFile, settings: Settings) => {
    const { file, preview } = processedFile;
    const { aiProvider, geminiApiKeys, mistralApiKeys, openRouterApiKeys, groqApiKeys, geminiModel, openRouterModel, groqModel } = settings;

    // 1. DETERMINE PROCESSING CONFIG (Resolves Payload/Bad Request Issues)
    const config = getProcessingConfig(aiProvider);
    
    let parts: any[] = [];

    try {
        if (file.type.startsWith('video/')) {
            // Video: Extract frames using strict config
            const frames = await extractFramesFromVideo(file, 6, config.maxDim, config.quality); 
            parts = frames.map(frame => ({ inlineData: { mimeType: 'image/jpeg', data: frame.data } }));
        } else if (file.name.match(/\.(eps|ai|pdf)$/i)) {
            // Vectors/PDF: Use Preview or Render PDF
            if (preview && !preview.startsWith('blob:')) {
                 // Fetch blob URL
                 const response = await fetch(preview);
                 const blob = await response.blob();
                 // Resize with strict config
                 const { data, mimeType } = await resizeImage(URL.createObjectURL(blob), config.maxDim, config.quality, config.outputMime);
                 parts = [{ inlineData: { mimeType, data } }];
            } else if (file.type === 'application/pdf') {
                 // PDF handling (basic)
                 const getBase64 = (f: File) => new Promise<string>((res) => { const r = new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.readAsDataURL(f); });
                 const b64 = await getBase64(file);
                 // Note: PDF raw is usually fine for Gemini, but for Groq we might need to render it. 
                 // Assuming PDF is supported natively by the vision model or we fallback. 
                 // For now, passing PDF as application/pdf usually only works with Gemini. 
                 // If Groq, we really should have generated a preview image in App.tsx or here.
                 // Fallback for Groq/Mistral if no preview: Try to treat as image/jpeg if user forced it, otherwise standard PDF.
                 parts = [{ inlineData: { mimeType: 'application/pdf', data: b64 } }];
            } else {
                 if (preview) {
                     const { data, mimeType } = await resizeImage(preview, config.maxDim, config.quality, config.outputMime);
                     parts = [{ inlineData: { mimeType, data } }];
                 } else {
                      throw new Error("Vector file requires a companion JPG/PNG preview.");
                 }
            }
        } else if (file.type === 'image/svg+xml') {
            // SVG: Convert to PNG Base64 -> Then Resize/Compress to target config
            const pngBase64 = await convertSvgToPng(preview || URL.createObjectURL(file));
            const dataUrl = `data:image/png;base64,${pngBase64}`;
            // Re-process through resizeImage to ensure maxDim and JPEG format for Groq
            const { data, mimeType } = await resizeImage(dataUrl, config.maxDim, config.quality, config.outputMime);
            parts = [{ inlineData: { mimeType, data } }];
        } else {
            // Standard Image (JPG, PNG, JPJ, etc): Resize/Compress
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
    
    // Calculate precise limits for the model (user setting - suffixes)
    const effectiveMaxTitleLength = Math.max(30, settings.titleLength.max - reservedLength - 2);
    // Ensure min length is at least 15 to avoid super short titles from model
    const effectiveMinTitleLength = Math.max(15, settings.titleLength.min - reservedLength);
    
    const targetKeywordCount = settings.maxKeywords + 25;

    const isVectorFile = file.name.match(/\.(eps|ai|svg|pdf)$/i) !== null;
    const isVectorMode = settings.imageType === ImageType.VECTOR || settings.imageType === ImageType.LOGO;
    const isVideo = file.type.startsWith('video/');
    const isRaster = !isVectorFile && !isVideo;

    const systemPrompt = buildSystemInstruction(settings, (isVectorFile || isVectorMode), isRaster, isVideo, effectiveMinTitleLength, effectiveMaxTitleLength, targetKeywordCount);
    
    // RE-INLINE HELPER FUNCTIONS FOR CONTEXT
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
    
    // Re-implemented sanitizeMetadata here to ensure scope access
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
        const cleanText = (text: string) => text.replace(/digital illustration displaying/gi, "digital illustration of");
        if (json.title && typeof json.title === 'string') {
            let title = cleanText(json.title.trim()).replace(/^(Title|Subject|Filename|Caption|Image):\s*/i, "").replace(/^["']|["']$/g, "");
            let mandatorySuffix = "";
            if (isolatedWhite) mandatorySuffix = "isolated on white background";
            else if (isolatedTransparent) mandatorySuffix = "isolated on transparent background";

            if (mandatorySuffix) {
                // Expanded regex list to catch more variations and partial phrases like "on white"
                const bgPhrases = [
                    /isolated\s+isolated/gi, 
                    /isolated\s+on\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                    /isolated\s+over\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                    /isolated\s+against\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                    /\bisolated\b/gi, 
                    /\bwhite\s*background\b/gi,
                    /\btransparent\s*background\b/gi,
                    // Catch "on white" or "on transparent" at the end of the string
                    /\b(on|over|against)\s+(?:a\s+)?white\s*$/gi,
                    /\b(on|over|against)\s+(?:a\s+)?transparent\s*$/gi
                ];
                bgPhrases.forEach(r => { title = title.replace(r, ' '); });
                
                // Clean up any dangling prepositions at the end (e.g. "Object on") resulting from removals
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
    
    // Helper to get error message (inline)
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
        
        // Strict frame limiting for Mistral
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

        // GROQ STRICT LIMIT: 1 Frame Only to prevent payload error
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

        // FORCE REPLACE DECOMMISSIONED MODELS
        // Even if user settings have the old one saved in localStorage, we must upgrade it.
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
                     if (res.status === 429 || res.status >= 500) continue; 
                     const errTxt = await res.text();
                     throw new Error(`Groq Error ${res.status}: ${errTxt}`);
                }
                const data = await res.json();
                if (!data.choices?.[0]?.message?.content) throw new Error("Invalid Groq response");

                let json = parseJSONSafely(data.choices[0].message.content);
                if (json.title) json.title = json.title.replace(/^(Title|Subject):\s*/i, "").trim();

                globalGroqKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);
             } catch(err: any) {
                 if (i === validKeys.length - 1) throw err;
             }
        }
        throw new Error("Groq failed.");
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
             
             // 401 Fix: Ensure key is trimmed
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
