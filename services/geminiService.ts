
import { GoogleGenAI } from '@google/genai';
import { ProcessedFile, Settings, AIProvider, AssetStyle, ApiKey, Platform } from '../types';
import { retryWithBackoff } from './apiUtils';

const ADOBE_CATEGORIES = [
    "1: Animals", "2: Buildings and Architecture", "3: Business", "4: Drinks", "5: Environment", 
    "6: States of Mind", "7: Food", "8: Graphic Resources", "9: Hobbies and Leisure", "10: Industry", 
    "11: Landscapes", "12: Lifestyle", "13: People", "14: Plants and Flowers", "15: Culture and Religion", 
    "16: Science", "17: Social Issues", "18: Sports", "19: Technology", "20: Transport", "21: Travel"
];

const parseJSONSafely = (text: string): any => {
    if (!text) return {};
    const cleanText = text.replace(/```json|```/gi, "").trim();
    try {
        const parsed = JSON.parse(cleanText);
        if (typeof parsed.keywords === 'string') {
            parsed.keywords = parsed.keywords.split(',').map((k: string) => k.trim());
        }
        return parsed;
    } catch (e) {
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("Neural output sync failure. Retrying compute cycle...");
    }
};

const resizeImage = async (url: string, maxDim: number): Promise<{ mimeType: string; data: string }> => {
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
            if (!ctx) return reject(new Error('Canvas failure'));
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] });
        };
        img.onerror = () => reject(new Error("Visual stream interrupted"));
        img.src = url;
    });
};

const extractVideoFrames = async (file: File, count: number): Promise<{ mimeType: string, data: string }[]> => {
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
                canvas.width = Math.min(video.videoWidth, 1280);
                canvas.height = (canvas.width / video.videoWidth) * video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push({ mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.7).split(',')[1] });
            }
            URL.revokeObjectURL(url);
            resolve(frames);
        };
    });
};

export const generateMetadata = async (
    processedFile: ProcessedFile, 
    settings: Settings,
    onKeyStatusChange?: (provider: AIProvider, keyId: string, status: ApiKey['status']) => void
) => {
    const { file, preview } = processedFile;
    let visualParts: { mimeType: string, data: string }[] = [];

    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4');
    const isVector = file.name.toLowerCase().endsWith('.eps') || file.name.toLowerCase().endsWith('.ai') || file.name.toLowerCase().endsWith('.svg');

    if (isVideo) {
        visualParts = await extractVideoFrames(file, 4);
    } else {
        const resized = await resizeImage(preview || URL.createObjectURL(file), 2000);
        visualParts = [resized];
    }
    
    const provider = settings.aiProvider;
    const model = settings.activeModels[provider];

    let platformRequirement = "";
    if (settings.platform === Platform.ADOBE_STOCK) {
        platformRequirement = `
        MARKETPLACE COMPLIANCE: ADOBE STOCK (STRICT)
        - TITLE: 70-120 characters. Descriptive natural language only.
        - KEYWORDS: Exactly ${settings.maxKeywords}. Sort by most relevant first.
        - CATEGORY: Choose valid ID from: ${ADOBE_CATEGORIES.join(', ')}.
        `;
    } else {
        platformRequirement = `MARKETPLACE COMPLIANCE: ${settings.platform} SEO standards.`;
    }

    // Title formatting instructions based on user examples
    const formattingInstruction = `
    TITLE FORMATTING RULE (MUST FOLLOW):
    The title must be a descriptive sentence followed by the isolation status. 
    Examples:
    - "Black silhouette of a human pelvis bone structure, isolated on white background"
    - "Minimalist black hook symbol icon silhouette flat design isolated on white background"
    - "Black and white flat illustration of gavel on law books isolated on white background"
    `;

    const isolationDirective = settings.isolatedWhite 
        ? "ISOLATION STATUS: PURE WHITE BACKGROUND. Title MUST end with ', isolated on white background'. Keywords 1-3 MUST be: isolated, white background, cut out." 
        : settings.isolatedTransparent 
            ? "ISOLATION STATUS: TRANSPARENT BACKGROUND. Title MUST end with ', isolated on transparent background'. Keywords 1-4 MUST be: isolated, transparent background, png, alpha." 
            : "CONTEXT: Natural environment. Describe the full scene background details.";

    const prompt = `
    ROLE: High-End Microstock SEO Specialist.
    ${platformRequirement}
    ${isolationDirective}
    ${formattingInstruction}

    ASSET TYPE: ${isVideo ? 'Video' : isVector ? 'Vector' : 'Image'}
    
    TASK:
    - Analyze the visual content with extreme precision (textures, lighting, materials, exact subject).
    - Provide commercial-grade metadata.
    - Output must be a strictly valid JSON object.

    JSON SCHEMA:
    {
      "style": "Exact Style (e.g., FLAT VECTOR, 3D RENDER, REALISTIC PHOTO)",
      "category": "Numeric Adobe ID",
      "title": "Descriptive subject phrase, isolated on ...",
      "description": "Engaging marketing summary",
      "keywords": ["keyword1", "keyword2", ...]
    }
    `;

    const executeGeminiRequest = async (apiKey: string = process.env.API_KEY as string) => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    ...visualParts.map(v => ({ inlineData: v })),
                    { text: prompt }
                ]
            },
            config: { 
                responseMimeType: "application/json",
                temperature: 0.1
            }
        });
        return parseJSONSafely(response.text || "");
    };

    const executeOpenAICompatibleRequest = async (keyObj: ApiKey) => {
        let baseUrl = "https://api.openai.com/v1";
        const headers: Record<string, string> = { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${keyObj.key}` 
        };

        if (provider === AIProvider.GROQ) baseUrl = "https://api.groq.com/openai/v1";
        if (provider === AIProvider.MISTRAL) baseUrl = "https://api.mistral.ai/v1";
        if (provider === AIProvider.GITHUB) baseUrl = "https://models.inference.ai.azure.com";
        if (provider === AIProvider.DEEPSEEK) baseUrl = "https://api.deepseek.com";
        if (provider === AIProvider.OPENROUTER) {
            baseUrl = "https://openrouter.ai/api/v1";
            headers["HTTP-Referer"] = window.location.origin;
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({ 
                model, 
                messages: [{ role: "user", content: [
                    { type: "text", text: prompt },
                    ...visualParts.map(v => ({ type: "image_url", image_url: { url: `data:${v.mimeType};base64,${v.data}`, detail: "high" } }))
                ]}], 
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            if (response.status === 429 || response.status === 402) {
                if (onKeyStatusChange) onKeyStatusChange(provider, keyObj.id, response.status === 429 ? 'rate_limited' : 'exhausted');
            }
            throw new Error(`API Critical Error: ${response.status}`);
        }

        const data = await response.json();
        return parseJSONSafely(data.choices[0].message.content);
    };

    const result = await retryWithBackoff(async () => {
        const keys = (settings.providerKeys[provider] || []).filter(k => k.status === 'valid' || k.status === 'testing');
        
        if (provider === AIProvider.GEMINI && keys.length === 0) {
            return await executeGeminiRequest();
        }

        if (keys.length === 0) throw new Error("API Vault Exhausted: No valid nodes found.");
        
        for (const keyObj of keys) {
            try {
                return provider === AIProvider.GEMINI ? await executeGeminiRequest(keyObj.key) : await executeOpenAICompatibleRequest(keyObj);
            } catch (err) { continue; }
        }
        throw new Error("Cluster failure: All active nodes failed analysis.");
    }, 1);

    // POST-PROCESSING: Hard-enforce the isolation rules to prevent AI hallucination
    if (settings.isolatedWhite) {
        if (!result.title.toLowerCase().includes('white background')) {
            result.title = result.title.replace(/,?\s*isolated.*$/gi, "") + ', isolated on white background';
        }
        const core = ['isolated', 'white background', 'cut out'];
        result.keywords = [...new Set([...core, ...result.keywords])];
    } else if (settings.isolatedTransparent) {
        if (!result.title.toLowerCase().includes('transparent background')) {
            result.title = result.title.replace(/,?\s*isolated.*$/gi, "") + ', isolated on transparent background';
        }
        const core = ['isolated', 'transparent background', 'png', 'alpha'];
        result.keywords = [...new Set([...core, ...result.keywords])];
    }

    return result;
};
