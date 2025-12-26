import { GoogleGenAI } from '@google/genai';
import { ProcessedFile, Settings, AIProvider, ApiKey, Platform, ImageType, FileStatus } from '../types';
import { retryWithBackoff } from './apiUtils';

/**
 * Visual Data Normalizer: Prepares images for high-accuracy neural analysis.
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
            if (!ctx) return reject(new Error('Neural buffer init failed.'));
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1] });
        };
        img.onerror = () => reject(new Error("Visual input stream broken."));
        img.src = url;
    });
};

/**
 * Temporal Sequence Extraction: Analyzes video motion across multiple frames.
 */
const extractVideoFrames = async (file: File, count: number = 4): Promise<{ mimeType: string, data: string }[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        video.onloadedmetadata = async () => {
            try {
                const frames: { mimeType: string, data: string }[] = [];
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                const duration = video.duration;
                for (let i = 0; i < count; i++) {
                    video.currentTime = (duration / (count + 1)) * (i + 1);
                    await new Promise(r => video.onseeked = r);
                    canvas.width = 1024;
                    canvas.height = (1024 / video.videoWidth) * video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    frames.push({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] });
                }
                URL.revokeObjectURL(url);
                resolve(frames);
            } catch (e) {
                reject(e);
            }
        };
        video.onerror = () => reject(new Error("Video format not supported."));
    });
};

/**
 * JSON & Keyword Normalizer: Ensures single-word SEO tokens and complete titles.
 */
const parseJSONSafely = (text: string): any => {
    const cleanedText = text.replace(/```json|```/gi, '').trim();
    const match = cleanedText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI failed to return valid JSON metadata.");
    
    try {
        const parsed = JSON.parse(match[0]);
        
        if (parsed.title) {
            let title = parsed.title.trim();
            title = title.replace(/\.{2,}$/, '');
            title = title.replace(/\s+/g, ' ');
            title = title.charAt(0).toUpperCase() + title.slice(1);
            if (title.endsWith('.')) title = title.slice(0, -1);
            parsed.title = title;
        }

        if (Array.isArray(parsed.keywords)) {
            parsed.keywords = parsed.keywords
                .flatMap((k: string) => k.split(/[\s\-_,]+/)) 
                .map((k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .filter((k: string) => k.length > 2); 
            parsed.keywords = Array.from(new Set(parsed.keywords));
        } else {
            parsed.keywords = [];
        }
        
        return parsed;
    } catch (e) {
        throw new Error("Metadata response was corrupted.");
    }
};

/**
 * Strictly enforces character limits by popping words from end until length is satisfied.
 */
const enforceTitleConstraints = (text: string, max: number): string => {
    if (!text) return "";
    
    const words = text.split(/\s+/);
    const seen = new Set();
    const uniqueWords = [];
    for (const word of words) {
        const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isFunctionWord = ['of', 'a', 'on', 'with', 'and', 'the', 'in', 'at', 'to', 'for'].includes(clean);
        if (clean.length > 3 && !isFunctionWord) {
            if (!seen.has(clean)) {
                seen.add(clean);
                uniqueWords.push(word);
            }
        } else {
            uniqueWords.push(word);
        }
    }
    
    let result = uniqueWords.join(' ').trim();
    
    if (result.length > max) {
        const parts = result.split(' ');
        while (parts.length > 0) {
            const current = parts.join(' ').trim();
            if (current.length <= max) {
                result = current;
                break;
            }
            parts.pop();
        }
        if (result.length > max) {
            result = result.substring(0, max).trim();
        }
    }
    
    return result;
};

const getProviderEndpoint = (provider: AIProvider): string => {
    switch (provider) {
        case AIProvider.GROQ: return "https://api.groq.com/openai/v1/chat/completions";
        case AIProvider.OPENAI: return "https://api.openai.com/v1/chat/completions";
        case AIProvider.DEEPSEEK: return "https://api.deepseek.com/chat/completions";
        case AIProvider.MISTRAL: return "https://api.mistral.ai/v1/chat/completions";
        case AIProvider.GITHUB: return "https://models.inference.ai.azure.com/chat/completions";
        case AIProvider.OPENROUTER: return "https://openrouter.ai/api/v1/chat/completions";
        default: return "";
    }
};

const validateMetadataIntegrity = (result: any): boolean => {
    if (!result.visual_check || !result.title) return true;
    
    const visual = result.visual_check.toLowerCase();
    const title = result.title.toLowerCase();
    
    const guardSubjects = ['soccer', 'phoenix', 'bird', 'car', 'truck', 'turtle', 'watch', 'clock', 'person'];
    for (const sub of guardSubjects) {
        if (title.includes(sub) && !visual.includes(sub)) {
            return false;
        }
    }
    return true;
};

export const generateMetadata = async (
    processedFile: ProcessedFile, 
    settings: Settings
) => {
    const { file, preview } = processedFile;
    const nameLower = file.name.toLowerCase();
    
    const isVideo = file.type.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.mov');
    const isVector = nameLower.endsWith('.eps') || nameLower.endsWith('.ai') || nameLower.endsWith('.svg');
    const isImage = file.type.startsWith('image/') || nameLower.endsWith('.jpj') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png') || nameLower.endsWith('.webp');

    let visualParts: { mimeType: string, data: string }[] = [];
    try {
        if (isVideo) {
            visualParts = await extractVideoFrames(file, 4);
        } else if (preview) {
            visualParts = [await resizeImage(preview, 1024)];
        } else if (isImage) {
            visualParts = [await resizeImage(URL.createObjectURL(file), 1024)];
        }
    } catch (e: any) {
        console.warn(`Vision buffer fallback: ${e.message}`);
    }

    const provider = settings.aiProvider;
    const modelId = settings.activeModels[provider];
    const keys = settings.providerKeys[provider] || [];
    const activeKey = keys.find(k => k.status === 'valid')?.key || 
                      (keys.length > 0 ? keys[0].key : null) || 
                      (provider === AIProvider.GEMINI ? process.env.API_KEY : null);

    if (!activeKey) throw new Error(`${provider} API Key Required.`);

    // PRE-CALCULATE CHARACTER BUDGET
    const isolationText = settings.isolatedWhite ? " isolated on white background" : settings.isolatedTransparent ? " isolated on transparent background" : "";
    const decorLength = settings.titlePrefix.length + settings.titleSuffix.length + isolationText.length;
    
    const userMax = settings.titleLength.max;
    const userMin = settings.titleLength.min;
    
    // Reserve buffer for final assembly to avoid 122ch when 100ch selected
    const aiMaxLen = Math.max(25, userMax - decorLength - 2); 
    const aiMinLen = Math.max(15, userMin - decorLength);

    const promptText = `
    TASK: GENERATE PROFESSIONAL STOCK METADATA.
    
    STRICT QUANTITATIVE LIMITS:
    - TITLE LENGTH: Your title MUST be between ${aiMinLen} and ${aiMaxLen} characters (including spaces). This is non-negotiable.
    
    NEGATIVE CONSTRAINTS (FORBIDDEN CONTENT):
    1. NEVER use the word "backdrop". Use "background" only if describing physical features.
    2. NEVER mention background isolation (e.g., "isolated on white", "transparent background", "white background", "cut out") in the title. The system adds this automatically.
    3. NEVER repeat words in the title.
    4. NEVER use ellipses, dots at the end, or incomplete phrases.
    5. NEVER include technical metadata like resolution, file size, or file format names in the title.
    
    QUALITATIVE RULES:
    1. PIXEL FIDELITY: Describe ONLY what is visible in the provided images. 
    2. KEYWORDS: Provide exactly ${settings.maxKeywords} highly relevant, single-word keywords.
    
    RESPONSE FORMAT (STRICT JSON):
    {
      "visual_check": "What specific subject, colors, and shapes are in the pixels?",
      "category": "Adobe Stock Category ID (Integer)",
      "title": "A highly descriptive, complete, non-repetitive sentence of EXACTLY ${aiMinLen}-${aiMaxLen} characters.",
      "keywords": ["single", "word", "seo", "terms"]
    }
    `;

    const executeOnce = async (currentModel: string = modelId): Promise<any> => {
        if (provider === AIProvider.GEMINI) {
            const ai = new GoogleGenAI({ apiKey: activeKey });
            const response = await ai.models.generateContent({
                model: currentModel,
                contents: { parts: [...visualParts.map(v => ({ inlineData: v })), { text: promptText }] },
                config: { 
                    responseMimeType: "application/json", 
                    temperature: 0.1, 
                    topP: 0.8,
                    maxOutputTokens: 1000,
                    ...(currentModel.includes('gemini-3') ? { thinkingConfig: { thinkingBudget: 4000 } } : {})
                }
            });
            return parseJSONSafely(response.text || "");
        }

        const response = await fetch(getProviderEndpoint(provider), {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${activeKey}` },
            body: JSON.stringify({
                model: currentModel,
                messages: [{ role: "user", content: [{ type: "text", text: promptText }, ...visualParts.map(v => ({ type: "image_url", image_url: { url: `data:${v.mimeType};base64,${v.data}` } }))] }],
                temperature: 0.1,
                ...(provider !== AIProvider.GROQ ? { response_format: { type: "json_object" } } : {})
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return parseJSONSafely(data.choices?.[0]?.message?.content || "");
    };

    return await retryWithBackoff(async () => {
        let lastResult = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await executeOnce();
                result.title = enforceTitleConstraints(result.title, aiMaxLen);
                if (result.title.length >= aiMinLen && result.title.length <= aiMaxLen && validateMetadataIntegrity(result)) {
                    if (result.keywords.length > settings.maxKeywords) {
                        result.keywords = result.keywords.slice(0, settings.maxKeywords);
                    }
                    return result;
                }
                lastResult = result;
            } catch (err) {
                if (attempt === 2) throw err;
            }
        }
        return lastResult || { title: "Analysis result slightly out of bounds - manual check recommended.", keywords: [], category: "8" };
    });
};