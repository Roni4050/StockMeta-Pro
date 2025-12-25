
import { Platform, Settings, AIProvider, ImageType } from './types';

export const PLATFORMS: Platform[] = Object.values(Platform);

export const PROVIDER_MODELS: Record<AIProvider, { id: string; name: string }[]> = {
    [AIProvider.GEMINI]: [
        { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Fast)" },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Vision High)" }
    ],
    [AIProvider.OPENAI]: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4o", name: "GPT-4o (Premium)" }
    ],
    [AIProvider.MISTRAL]: [
        { id: "mistral-large-latest", name: "Mistral Large (Reasoning)" },
        { id: "pixtral-12b-2409", name: "Pixtral 12B" }
    ],
    [AIProvider.DEEPSEEK]: [
        { id: "deepseek-chat", name: "DeepSeek Chat" }
    ],
    [AIProvider.GROQ]: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Versatile)" },
        { id: "llama-3.2-90b-vision-preview", name: "Llama 3.2 90B (Vision)" },
        { id: "llama-3.1-405b-reasoning", name: "Llama 3.1 405B (Scrout)" }
    ],
    [AIProvider.GITHUB]: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4o", name: "GPT-4o" }
    ],
    [AIProvider.OPENROUTER]: [
        { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)" },
        { id: "mistralai/mistral-large-2411", name: "Mistral Large 2 (Mavertic)" },
        { id: "meta-llama/llama-3.1-405b", name: "Llama 3.1 405B (Enterprise)" }
    ],
};

export const DEFAULT_SETTINGS: Settings = {
    platform: Platform.ADOBE_STOCK,
    titleLength: { min: 70, max: 120 },
    descriptionLength: { min: 70, max: 200 },
    maxKeywords: 50,
    isolatedWhite: false,
    isolatedTransparent: false,
    safeMode: true,
    titlePrefix: "",
    titleSuffix: "",
    aiProvider: AIProvider.GEMINI,
    providerKeys: {
        [AIProvider.GEMINI]: [],
        [AIProvider.OPENAI]: [],
        [AIProvider.MISTRAL]: [],
        [AIProvider.DEEPSEEK]: [],
        [AIProvider.GROQ]: [],
        [AIProvider.GITHUB]: [],
        [AIProvider.OPENROUTER]: [],
    },
    activeModels: {
        [AIProvider.GEMINI]: "gemini-3-flash-preview",
        [AIProvider.OPENAI]: "gpt-4o-mini",
        [AIProvider.MISTRAL]: "mistral-large-latest",
        [AIProvider.DEEPSEEK]: "deepseek-chat",
        [AIProvider.GROQ]: "llama-3.3-70b-versatile",
        [AIProvider.GITHUB]: "gpt-4o-mini",
        [AIProvider.OPENROUTER]: "google/gemini-2.0-flash-exp:free",
    },
    singleGenerationMode: false,
    imageType: ImageType.IMAGE,
};
