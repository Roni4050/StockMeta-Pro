
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { ProcessedFile, Settings, Platform, ImageType, AIProvider, GeminiModel } from '../types';
import { retryWithBackoff } from './apiUtils';

// Global indices for Round-Robin Key Rotation
let globalGeminiKeyIndex = 0;
let globalMistralKeyIndex = 0;
let globalOpenRouterKeyIndex = 0;

/**
 * Helper to safely parse JSON from AI response, handling markdown blocks and extra text.
 */
const parseJSONSafely = (text: string): any => {
    try {
        // 1. Remove markdown code blocks if present
        let cleanText = text.replace(/```json\s*|```/g, '').trim();
        
        // 2. Try direct parse
        return JSON.parse(cleanText);
    } catch (e) {
        // 3. Fallback: Find the first '{' and last '}' to extract the JSON object
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) {
            try {
                const jsonStr = text.substring(start, end + 1);
                return JSON.parse(jsonStr);
            } catch (e2) {
                // Try to fix common trailing comma issue before giving up
                try {
                     const fixedStr = text.substring(start, end + 1).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                     return JSON.parse(fixedStr);
                } catch(e3) {
                    // Ignore
                }
            }
        }
        throw new Error(`Failed to parse JSON. Raw output preview: ${text.substring(0, 50)}...`);
    }
};

/**
 * Resizes and compresses an image to ensure it fits within AI model constraints.
 */
const resizeImage = async (url: string, maxDimension: number = 800, outputType: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<{ mimeType: string; data: string }> => {
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
            
            if (outputType === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
            } else {
                ctx.clearRect(0, 0, width, height);
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL(outputType, 0.9);
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
            resolve(pngDataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error('Failed to load SVG image.'));
        img.src = svgDataUrl;
    });
};

/**
 * Extracts multiple frames from a video file.
 */
const extractFramesFromVideo = (videoFile: File, frameCount: number = 6): Promise<{ timestamp: number; data: string; }[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto'; // Ensure metadata loads
        
        const frames: { timestamp: number; data: string; }[] = [];

        video.onloadeddata = async () => {
            try {
                canvas.width = 512;
                canvas.height = Math.floor(512 * (video.videoHeight / video.videoWidth));
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new Error("Canvas context not available");
                }

                const duration = video.duration;
                // If duration is Infinity or NaN (sometimes happens with streams), default to something safe or just grab current frame
                const safeDuration = (isFinite(duration) && duration > 0) ? duration : 1; 
                const interval = safeDuration / (frameCount + 1);

                for (let i = 1; i <= frameCount; i++) {
                    const seekTime = interval * i;
                    if (seekTime > safeDuration) continue;
                    
                    try {
                        video.currentTime = seekTime;
                        
                        // Robust seek with timeout - Increased to 10s
                        await new Promise<void>((res, rej) => {
                            const seekTimeout = setTimeout(() => {
                                rej(new Error(`Video seek timed out at ${seekTime}s`));
                            }, 10000); // 10s timeout per frame
                            
                            const onSeeked = () => {
                                clearTimeout(seekTimeout);
                                video.removeEventListener('seeked', onSeeked);
                                video.removeEventListener('error', onError);
                                res();
                            };

                            const onError = (e: Event) => {
                                clearTimeout(seekTimeout);
                                video.removeEventListener('seeked', onSeeked);
                                video.removeEventListener('error', onError);
                                rej(new Error('Video error during seek'));
                            };
                            
                            video.addEventListener('seeked', onSeeked);
                            video.addEventListener('error', onError);
                        });

                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        frames.push({
                            timestamp: seekTime,
                            data: frameDataUrl.split(',')[1]
                        });
                    } catch (e) {
                         console.warn(`Frame extraction skipped for time ${seekTime}:`, e);
                         // If we time out, we just continue. If all fail, we handle it below.
                    }
                }

                URL.revokeObjectURL(videoUrl);
                
                if (frames.length === 0) {
                     // Try to grab at least the first frame if seek failed everywhere
                     try {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        frames.push({ timestamp: 0, data: frameDataUrl.split(',')[1] });
                        resolve(frames);
                     } catch(e) {
                        reject(new Error("Could not extract any frames from video."));
                     }
                } else {
                    resolve(frames);
                }
            } catch (e) {
                URL.revokeObjectURL(videoUrl);
                reject(e);
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(videoUrl);
            reject(new Error("Failed to load video file."));
        };
    });
};

const getPlatformGuidelines = (platform: Platform): string => {
    switch (platform) {
        case Platform.ADOBE_STOCK:
            return `
            ADOBE STOCK MASTER GUIDELINES:
            1. **SUBJECT-FIRST STRUCTURE**: Start with the main subject.
            2. **EXPANDED DETAILS**: Include lighting, mood, style, and context to maximize title length.
            3. **FORMAT**: [Subject] + [Action] + [Context] + [Style/Tech Specs].
            `;
        case Platform.SHUTTERSTOCK:
            return `
            SHUTTERSTOCK GUIDELINES:
            1. **NATURAL SENTENCE**: Write a long, descriptive sentence.
            2. **NO TRADEMARKS**: Use generic terms (e.g., "Smartphone" vs "iPhone").
            `;
        default:
            return `
            GENERAL GUIDELINES:
            1. Descriptive, accurate, and long.
            2. Focus on visual content: Subject, Action, Context, Lighting, Mood.
            `;
    }
};

const buildSystemInstruction = (
    settings: Settings,
    isVector: boolean | RegExpMatchArray | null,
    isRaster: boolean,
    isVideo: boolean
): string => {
    const { platform, titleLength, maxKeywords, isolatedWhite, isolatedTransparent, imageType, prefix, suffix, negativeTitleWords, negativeKeywords } = settings;
    const platformGuidelines = getPlatformGuidelines(platform);

    let currentMaxTitle = titleLength.max;
    if (platform === Platform.TEMPLATE_MONSTER) {
        currentMaxTitle = Math.min(currentMaxTitle, 100);
    }
    
    // Adjust max title length guidance to account for prefix/suffix
    const extrasLength = (prefix?.length || 0) + (suffix?.length || 0) + (prefix ? 1 : 0) + (suffix ? 1 : 0);
    const effectiveMaxTitle = Math.max(20, currentMaxTitle - extrasLength);

    const titleConstraints = `Title must be strictly LESS THAN ${effectiveMaxTitle} characters but MORE THAN ${titleLength.min} characters.`;
    
    // IMPROVED ISOLATION INSTRUCTION
    const isolationNote = isolatedWhite 
        ? "CRITICAL: The image is isolated on a white background. Ensure the title reflects this."
        : isolatedTransparent 
        ? "CRITICAL: The image is isolated on a transparent background. Ensure the title reflects this."
        : "";
        
    const typeNote = imageType !== ImageType.NONE ? `This is a ${imageType}.` : "";

    const vectorInstruction = (isVector && !isRaster) ? `
    **VECTOR SPECIFIC**:
    - Describe the ART STYLE (e.g., Flat, Isometric, Watercolor, Line Art).
    - If it's a "Set" or "Bundle", describe the variety.
    ` : "";

    const rasterInstruction = isRaster ? `
    **RASTER/PNG IMAGE SPECIFIC**:
    - **FORBIDDEN WORDS**: Do NOT use words like "Vector", "Vector Illustration", "EPS", or "Vector File" in the title or description.
    ` : "";

    const videoInstruction = isVideo ? `
    **VIDEO SPECIFIC MASTER GUIDELINES**:
    You are analyzing frames from a stock video clip. Your title MUST describe the movement, camera angle, and action.
    
    1. **Identify Camera Movement**: (e.g., Aerial/Drone, Panning, Tilting, Dolly, Tracking, Static, Zoom).
    2. **Identify Motion Speed**: (e.g., Slow Motion, Time Lapse, Real-time).
    3. **Title Structure**: Start with the shot type if distinctive (e.g., "Aerial view of...", "Slow motion shot of...").
    4. **Detail**: Describe EXACTLY what is moving and how.
    ` : "";

    const negativeTitleInstruction = negativeTitleWords 
        ? `**FORBIDDEN WORDS IN TITLE**: Do NOT use the following words in the title: ${negativeTitleWords}.` 
        : "";
    
    const negativeKeywordInstruction = negativeKeywords
        ? `**FORBIDDEN KEYWORDS**: Do NOT include these keywords in the list: ${negativeKeywords}.`
        : "";

    return `
    You are an expert Stock Media Metadata Specialist.
    
    YOUR GOAL: Analyze the media style and content to generate accurate metadata.
    
    CRITICAL VISUAL STYLE ANALYSIS:
    Determine the specific art style of the image and incorporate it into the title:
    1. **Realistic Photography**: High-quality photo, realistic textures. No need to label "photo of", just describe the scene.
    2. **3D Render**: CGI, 3D modeling, plastic or smooth textures. Title MUST start with or contain "3D render of...".
    3. **Silhouette**: Dark shape against a light background. Title MUST start with "Silhouette of...".
    4. **Vector/Flat**: Clean lines, solid colors, scalable style. Title MUST contain "Vector illustration" or "Flat design".
    5. **Logo/Icon**: Simple, symbolic, abstract. Title MUST contain "Logo design" or "Icon of".
    6. **Watercolor/Painting**: Artistic brush strokes. Title MUST contain "Watercolor painting of" or "Digital painting".
    7. **Video Analysis**: Refer to the Video Specific Guidelines below.

    ${platformGuidelines}
    
    RULES:
    1. ${titleConstraints}
    2. ${isolationNote}
    3. ${typeNote}
    4. ${videoInstruction}
    5. ${rasterInstruction}
    6. ${negativeTitleInstruction}
    7. ${negativeKeywordInstruction}
    8. Generate ${maxKeywords} STRICTLY SINGLE-WORD keywords. No phrases. Split any multi-word concepts (e.g., "red car" -> "red", "car").
    9. **FORBIDDEN PHRASE**: NEVER use the phrase "digital illustration displaying". Use "digital illustration of" or simply "digital illustration" instead.
    ${vectorInstruction}

    OUTPUT JSON ONLY: { "title": "...", "description": "...", "keywords": [...] }
    `;
};

const sanitizeMetadata = (json: any, maxTitleLength: number, isolatedWhite: boolean, isolatedTransparent: boolean): any => {
    // 1. Sanitize Keywords
    if (json.keywords && Array.isArray(json.keywords)) {
        const uniqueWords = new Set<string>();
        json.keywords.forEach((k: string) => {
            // Split by whitespace, commas, underscores, or hyphens to ensure single words
            const words = k.trim().split(/[\s,_,-]+/);
            words.forEach(w => {
                const clean = w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                if (clean.length > 1) uniqueWords.add(clean.toLowerCase());
            });
        });
        json.keywords = Array.from(uniqueWords);
    }

    // 2. Helper to remove forbidden phrases
    const cleanText = (text: string) => {
        return text.replace(/digital illustration displaying/gi, "digital illustration of");
    };

    // 3. Sanitize Title & Force Isolation logic
    if (json.title && typeof json.title === 'string') {
        let title = cleanText(json.title.trim());

        // A. Determine mandatory suffix
        let mandatorySuffix = "";
        if (isolatedWhite) mandatorySuffix = "isolated on white background";
        else if (isolatedTransparent) mandatorySuffix = "isolated on transparent background";

        // B. Remove existing suffix occurrences AND partials to avoid duplication/stuttering
        if (mandatorySuffix) {
             // AGGRESSIVE CLEANUP: Remove common "isolated" stuttering or descriptive phrases
             // created by AI before appending the mandatory suffix.
             
             // List of regex patterns to strip out
             const backgroundPhrases = [
                /isolated\s+isolated/gi, // Double stutter
                /isolated\s+on\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                /isolated\s+against\s+(?:a\s+)?(?:white|transparent)(?:\s+background)?/gi,
                /(?:on|against)\s+(?:a\s+)?(?:clean\s+)?(?:white|transparent)(?:\s+background)?/gi,
                /(?:on|against)\s+(?:a\s+)?(?:white|transparent)/gi,
                /\bisolated\b/gi, // Standalone "isolated"
                /\bcut\s*out\b/gi,
                /\bstudio\s*shot\b/gi,
                /\bclean\s*white\b/gi,
                /\bwhite\s*background\b/gi
             ];

             backgroundPhrases.forEach(regex => {
                 title = title.replace(regex, ' ');
             });

             // Clean up resulting messy punctuation/spaces
             title = title.replace(/\s{2,}/g, ' ').trim();
             title = title.replace(/[.,;:\-\s]+$/, '').trim();
        }

        // C. Truncate title to fit Suffix
        // Available space = Max - Suffix Length - 1 (space)
        const availableSpace = mandatorySuffix ? (maxTitleLength - mandatorySuffix.length - 1) : maxTitleLength;
        
        if (title.length > availableSpace) {
             let truncated = title.substring(0, availableSpace);
             const lastSpace = truncated.lastIndexOf(' ');
             if (lastSpace > availableSpace * 0.7) { 
                 truncated = truncated.substring(0, lastSpace);
             }
             title = truncated;
        }

        // D. Append Suffix
        if (mandatorySuffix) {
            title = `${title} ${mandatorySuffix}`;
        }

        json.title = title;
    }

    // 4. Sanitize Description
    if (json.description && typeof json.description === 'string') {
        json.description = cleanText(json.description.trim());
    }

    return json;
};

const getErrorMessage = (e: any): string => {
    if (typeof e === 'string') return e;
    if (e?.message) return e.message;
    try { return JSON.stringify(e); } catch { return 'Unknown Error'; }
};

export const generateMetadata = async (processedFile: ProcessedFile, settings: Settings) => {
    const { file, preview } = processedFile;
    const { platform, titleLength, descriptionLength, maxKeywords, isolatedWhite, isolatedTransparent, imageType, geminiApiKeys, mistralApiKeys, openRouterApiKeys, aiProvider, geminiModel, openRouterModel, prefix, suffix, negativeKeywords } = settings;

    // --- 1. PREPARE DATA ---
    let parts: any[] = [];
    const maxDim = 800; // Unify max dimension to 800 for both providers to save bandwidth/payload size
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const isJpeg = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
    const isRaster = isPng || isJpeg;
    const outputType = isPng ? 'image/png' : 'image/jpeg';

    try {
        if (file.type.startsWith('video/')) {
            try {
                // We ask for more frames initially, but may downsample later for Mistral/OpenRouter
                const frames = await extractFramesFromVideo(file, 8); 
                parts = frames.map(frame => ({ inlineData: { mimeType: 'image/jpeg', data: frame.data } }));
            } catch (e) {
                console.error("Video processing failed:", e);
                throw new Error("Video processing failed. " + getErrorMessage(e));
            }
        } else if (file.name.match(/\.(eps|ai|pdf)$/i)) {
            if (preview && !preview.startsWith('blob:')) {
                 try {
                    const response = await fetch(preview);
                    const blob = await response.blob();
                    const { data, mimeType } = await resizeImage(URL.createObjectURL(blob), maxDim, 'image/jpeg');
                     parts = [{ inlineData: { mimeType, data } }];
                 } catch(e) { throw new Error("Failed to process vector preview."); }
            } else if (file.type === 'application/pdf') {
                 const getBase64 = (f: File) => new Promise<string>((res) => { const r = new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.readAsDataURL(f); });
                 const b64 = await getBase64(file);
                 parts = [{ inlineData: { mimeType: 'application/pdf', data: b64 } }];
            } else {
                 if (preview) {
                     const { data, mimeType } = await resizeImage(preview, maxDim, 'image/jpeg');
                     parts = [{ inlineData: { mimeType, data } }];
                 } else {
                      throw new Error("Vector file requires a companion JPG/PNG preview.");
                 }
            }
        } else if (file.type === 'image/svg+xml') {
            const getBase64 = (f: File) => new Promise<string>((res) => { const r = new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.readAsDataURL(f); });
            const b64 = await getBase64(file);
            const pngBase64 = await convertSvgToPng(`data:image/svg+xml;base64,${b64}`);
            parts = [{ inlineData: { mimeType: 'image/png', data: pngBase64 } }];
        } else {
            const { mimeType, data } = await resizeImage(preview, maxDim, outputType);
            parts = [{ inlineData: { mimeType, data } }];
        }
    } catch (e) {
        throw new Error(`Preprocessing failed: ${getErrorMessage(e)}`);
    }

    // --- 2. PROMPT & HELPERS ---
    const isVectorFile = file.name.match(/\.(eps|ai|svg|pdf)$/i) !== null;
    const isVectorMode = imageType === ImageType.VECTOR || imageType === ImageType.LOGO;
    const enableVectorPrompt = (isVectorFile || isVectorMode);
    
    // Determine isVideo for prompt customization
    const isVideo = file.type.startsWith('video/');

    const systemPrompt = buildSystemInstruction(settings, enableVectorPrompt, isRaster, isVideo);
    let currentMaxTitle = titleLength.max;
    if (platform === Platform.TEMPLATE_MONSTER) currentMaxTitle = Math.min(currentMaxTitle, 100);

    const enforceIsolationKeywords = (json: any) => {
        if (!json.keywords) json.keywords = [];
        let required: string[] = [];
        if (isolatedWhite) required = ['isolated', 'white', 'background'];
        else if (isolatedTransparent) required = ['isolated', 'transparent', 'background'];
        required.forEach(req => {
            if (!json.keywords.includes(req)) json.keywords.push(req);
        });
        return json;
    };

    const applyModifiers = (json: any) => {
        if (json.title) {
            let t = json.title;
            if (prefix && prefix.trim()) t = `${prefix.trim()} ${t}`;
            if (suffix && suffix.trim()) t = `${t} ${suffix.trim()}`;
            json.title = t;
        }
        if (json.keywords && negativeKeywords) {
            const negs = negativeKeywords.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
            if (negs.length > 0) {
                json.keywords = json.keywords.filter((k: string) => !negs.includes(k.toLowerCase()));
            }
        }
        return json;
    };

    const applyIsolationCasing = (json: any) => {
        if (json.title) {
            if (isolatedTransparent) {
                json.title = json.title.replace(/isolated on (a\s+)?transparent background/gi, (match: string) => match.toLowerCase());
            } else if (isolatedWhite) {
                json.title = json.title.replace(/isolated on (a\s+)?white background/gi, (match: string) => match.toLowerCase());
            }
            if (json.title.length > 0) {
                json.title = json.title.charAt(0).toUpperCase() + json.title.slice(1);
            }
        }
        return json;
    };

    const processResponseJSON = (json: any) => {
        json = enforceIsolationKeywords(json);
        json = applyModifiers(json);
        // Note: sanitizeMetadata now handles the mandatory appending of isolation phrases
        json = sanitizeMetadata(json, currentMaxTitle, isolatedWhite, isolatedTransparent);
        json = applyIsolationCasing(json);
        return json;
    };

    // --- 3. EXECUTION WITH ROTATION ---
    const callGemini = async () => {
        const validKeys = geminiApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No Gemini API Key found.");
        
        // Try keys starting from global index
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
                        topP: 0.95,
                        topK: 40,
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
                
                // Success: Update global index for next call to distribute load
                globalGeminiKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);

            } catch (e: any) {
                const msg = getErrorMessage(e).toLowerCase();
                // If 429 or quota, rotate to next key immediately
                if (msg.includes('429') || msg.includes('quota') || msg.includes('resource has been exhausted')) {
                    console.warn(`Gemini key ${keyIndex} exhausted, rotating...`);
                    continue; // Loop continues to next key
                }
                throw e; // Other errors are fatal for this attempt
            }
        }
        throw new Error("All Gemini keys exhausted/rate-limited.");
    };

    const callMistral = async () => {
        if (!parts || parts.length === 0) throw new Error("No image data available for Mistral.");
        const validKeys = mistralApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No Mistral API Key found.");
        
        // LIMIT FRAMES FOR MISTRAL TO PREVENT 400 ERROR (PAYLOAD TOO LARGE)
        // If we have many frames (e.g. from a video), downsample to 4 evenly spaced frames.
        let effectiveParts = parts;
        if (parts.length > 4) {
             const maxFrames = 4;
             effectiveParts = [];
             // Calculate indices: 0, 1/3, 2/3, 1 (approximately)
             const step = (parts.length - 1) / (maxFrames - 1);
             for (let i = 0; i < maxFrames; i++) {
                 effectiveParts.push(parts[Math.round(i * step)]);
             }
             // Deduplicate just in case
             effectiveParts = Array.from(new Set(effectiveParts));
        }

        // Prepare content array for Pixtral (multi-image support)
        const messagesContent: any[] = [{ type: "text", text: "" }];
        effectiveParts.forEach(p => {
            const url = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            messagesContent.push({ type: "image_url", image_url: { url } });
        });
        
        const isVideoInput = parts.length > 1;

        // Specialized Prompt to fix "wrong title" issues
        const mistralPrompt = `
        Role: Senior Stock Media Metadata Specialist.
        
        ${systemPrompt}

        ### CRITICAL INSTRUCTION: ACCURATE FILE TYPE ANALYSIS
        You must strictly adhere to the visual style of the asset provided.

        1. **VECTORS & ILLUSTRATIONS**:
           - If the image is a drawing, graphic, or ends in .eps/.ai: Title MUST contain "Vector illustration" or "Flat design".
           - Do not treat vectors as "photos".

        2. **SILHOUETTES vs BLACK OBJECTS**:
           - **Silhouette**: ONLY use "Silhouette of..." if the subject is a dark shape with NO internal detail/texture against a light background.
           - **Black Object**: If it is a black object (like a tire, chair, electronic) on white where texture is visible, DO NOT call it a silhouette. Just describe the object (e.g., "Black leather beanbag chair...").

        3. **LOGOS & ICONS**:
           - If abstract or symbolic: Title MUST start with "Logo design" or "Icon of".

        4. **VIDEOS**:
           - Describe the MOTION (e.g., "Slow motion", "Time lapse", "Panning").
           - Structure: "[Motion Type] of [Subject]..."

        5. **REALISTIC IMAGES**:
           - Describe lighting, texture, and mood. 
           - Use "3D render" if it looks CGI.
        
        **CRITICAL RULE FOR ISOLATION**:
        - If the background is plain white/transparent, focus on the SUBJECT details (material, texture, lighting). 
        - DO NOT include "isolated on white background" in your output title. The system adds this automatically.

        **TITLE FORMULA**: 
        [Style/Type] + [Adjective] + [Subject] + [Action/Texture] + [Background (if not isolated)]

        Output ONLY JSON.
        `;
        
        // Inject prompt into content
        messagesContent[0].text = mistralPrompt;

        const payload = {
            model: "pixtral-12b-2409", 
            messages: [
                {
                    role: "user",
                    content: messagesContent
                }
            ],
            temperature: 0.7, 
            response_format: { type: "json_object" }
        };

        const attempts = validKeys.length;
        for (let i = 0; i < attempts; i++) {
             const keyIndex = (globalMistralKeyIndex + i) % validKeys.length;
             const key = validKeys[keyIndex];

             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 90000); // Increased timeout significantly

             try {
                const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                
                if (!res.ok) {
                     let errorDetail = "";
                     try { errorDetail = await res.text(); } catch(e) {}
                     const status = res.status;

                     if (status === 401) {
                        // Invalid key - definitely rotate
                         console.warn(`Mistral Key ${keyIndex} Invalid (401).`);
                         continue;
                     }

                     if (status === 429) {
                          console.warn(`Mistral key ${keyIndex} limited (429), rotating...`);
                          continue; // Rotate key
                     }
                     
                     // Handle 500s and 400s by rotating
                     if (status >= 500 || status === 400) {
                         console.warn(`Mistral Error (${status}) with key ${keyIndex}. Rotating... Details: ${errorDetail}`);
                         continue;
                     }
                     
                     // Other errors
                     throw new Error(`Mistral API Error: ${status} ${res.statusText} - ${errorDetail}`);
                }

                const data = await res.json();
                clearTimeout(timeoutId);
                if (!data.choices?.[0]?.message?.content) throw new Error("Invalid Mistral response structure.");

                let json = parseJSONSafely(data.choices[0].message.content);
                
                if (json.title) {
                    json.title = json.title.replace(/^(Title|Subject):\s*/i, "").trim();
                    const forbidden = [/with different styles/gi, /shown from different angles/gi, /collection of/gi];
                    forbidden.forEach(r => json.title = json.title.replace(r, ""));
                }
                
                // Success: Rotate global
                globalMistralKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);

            } catch (err: any) {
                clearTimeout(timeoutId);
                const msg = getErrorMessage(err).toLowerCase();
                
                // Catch network errors, aborts, and specific status codes propagated as errors
                if (err.name === 'AbortError' || 
                    msg.includes('429') || 
                    msg.includes('500') || 
                    msg.includes('502') || 
                    msg.includes('503') || 
                    msg.includes('internal server error') ||
                    msg.includes('400') ||
                    msg.includes('bad request')) {
                     continue; // Retry with next key
                }
                throw err;
            }
        }
        throw new Error("All Mistral keys failed or timed out.");
    };

    const callOpenRouter = async () => {
        if (!parts || parts.length === 0) throw new Error("No image data available for OpenRouter.");
        const validKeys = openRouterApiKeys.filter(k => k?.trim().length > 0);
        if (!validKeys.length) throw new Error("No OpenRouter API Key found.");

        let effectiveParts = parts;
        // Limit frames for payload size if necessary, similar to Mistral
        if (parts.length > 4) {
             const maxFrames = 4;
             effectiveParts = [];
             const step = (parts.length - 1) / (maxFrames - 1);
             for (let i = 0; i < maxFrames; i++) {
                 effectiveParts.push(parts[Math.round(i * step)]);
             }
             effectiveParts = Array.from(new Set(effectiveParts));
        }

        const messagesContent: any[] = [{ type: "text", text: "" }];
        effectiveParts.forEach(p => {
            const url = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            messagesContent.push({ type: "image_url", image_url: { url } });
        });

        const isVideoInput = parts.length > 1;
        const promptText = `
        Role: Senior Stock Media Metadata Specialist.
        
        ${systemPrompt}

        ### CRITICAL INSTRUCTION: ACCURATE FILE TYPE ANALYSIS
        You must strictly adhere to the visual style of the asset provided.

        1. **VECTORS & ILLUSTRATIONS**:
           - If the image is a drawing, graphic, or ends in .eps/.ai: Title MUST contain "Vector illustration" or "Flat design".
           - Do not treat vectors as "photos".

        2. **SILHOUETTES vs BLACK OBJECTS**:
           - **Silhouette**: ONLY use "Silhouette of..." if the subject is a dark shape with NO internal detail/texture against a light background.
           - **Black Object**: If it is a black object (like a tire, chair, electronic) on white where texture is visible, DO NOT call it a silhouette. Just describe the object (e.g., "Black leather beanbag chair...").

        3. **LOGOS & ICONS**:
           - If abstract or symbolic: Title MUST start with "Logo design" or "Icon of".

        4. **VIDEOS**:
           - Describe the MOTION (e.g., "Slow motion", "Time lapse", "Panning").
           - Structure: "[Motion Type] of [Subject]..."

        5. **REALISTIC IMAGES**:
           - Describe lighting, texture, and mood. 
           - Use "3D render" if it looks CGI.
        
        **CRITICAL RULE FOR ISOLATION**:
        - If the background is plain white/transparent, focus on the SUBJECT details (material, texture, lighting). 
        - DO NOT include "isolated on white background" in your output title. The system adds this automatically.

        **TITLE FORMULA**: 
        [Style/Type] + [Adjective] + [Subject] + [Action/Texture] + [Background (if not isolated)]

        Output ONLY JSON.
        `;

        messagesContent[0].text = promptText;

        const attempts = validKeys.length;
        for (let i = 0; i < attempts; i++) {
             const keyIndex = (globalOpenRouterKeyIndex + i) % validKeys.length;
             const key = validKeys[keyIndex];

             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 90000);

             try {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json", 
                        "Authorization": `Bearer ${key}`,
                        "HTTP-Referer": window.location.origin, 
                        "X-Title": "Stock Metadata Generator"
                    },
                    body: JSON.stringify({
                        model: openRouterModel || "google/gemini-2.0-flash-001",
                        messages: [{ role: "user", content: messagesContent }],
                        temperature: 0.7,
                        response_format: { type: "json_object" }
                    }),
                    signal: controller.signal
                });

                if (!res.ok) {
                     let errorDetail = "";
                     try { errorDetail = await res.text(); } catch(e) {}
                     console.warn(`OpenRouter API Error (${res.status}): ${errorDetail}`);
                     
                     if (res.status === 401 || res.status === 429 || res.status >= 500) {
                         continue; // Rotate key
                     }
                     throw new Error(`OpenRouter API Error: ${res.status} ${res.statusText}`);
                }

                const data = await res.json();
                clearTimeout(timeoutId);
                
                if (!data.choices?.[0]?.message?.content) throw new Error("Invalid OpenRouter response.");
                let json = parseJSONSafely(data.choices[0].message.content);
                
                if (json.title) {
                    json.title = json.title.replace(/^(Title|Subject):\s*/i, "").trim();
                }

                globalOpenRouterKeyIndex = (keyIndex + 1) % validKeys.length;
                return processResponseJSON(json);

             } catch(err: any) {
                 clearTimeout(timeoutId);
                 if (err.name === 'AbortError' || getErrorMessage(err).toLowerCase().includes('429')) {
                     continue; 
                 }
                 throw err;
             }
        }
        throw new Error("All OpenRouter keys failed.");
    };

    return retryWithBackoff(async () => {
        if (aiProvider === AIProvider.GEMINI) {
             return await callGemini();
        } else if (aiProvider === AIProvider.MISTRAL) {
             return await callMistral();
        } else {
             return await callOpenRouter();
        }
    }, 3, 2000, (error) => {
        // Retry predicate: Retry on 429/Quota/Server errors OR if parsing failed (often temporary)
        const msg = getErrorMessage(error).toLowerCase();
        return msg.includes('429') || 
               msg.includes('quota') || 
               msg.includes('503') || 
               msg.includes('500') ||
               msg.includes('502') ||
               msg.includes('504') ||
               msg.includes('internal server error') || 
               msg.includes('bad request') || 
               msg.includes('400') ||
               msg.includes('exhausted') || 
               msg.includes('fetch failed') || 
               msg.includes('failed to parse json') || 
               msg.includes('json');
    }); 
};
