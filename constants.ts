import { Platform, Settings, AIProvider, ImageType } from './types';

export const PLATFORMS: Platform[] = Object.values(Platform);

export const BILLING_URLS: Record<AIProvider, string> = {
    [AIProvider.GEMINI]: "https://aistudio.google.com/app/billing",
    [AIProvider.OPENROUTER]: "https://openrouter.ai/credits",
    [AIProvider.OPENAI]: "https://platform.openai.com/account/billing",
    [AIProvider.MISTRAL]: "https://console.mistral.ai/billing/",
    [AIProvider.DEEPSEEK]: "https://platform.deepseek.com/usage",
    [AIProvider.GROQ]: "https://console.groq.com/billing",
    [AIProvider.GITHUB]: "https://github.com/settings/billing",
};

export const PROVIDER_MODELS: Record<AIProvider, { id: string; name: string; isFree?: boolean }[]> = {
    [AIProvider.GEMINI]: [
        { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Fast & Smart)" },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (High Detail Vision)" },
        { id: "gemini-2.0-flash-lite-preview-02-05", name: "Gemini 2.0 Flash-Lite (Eco)" }
    ],
    [AIProvider.OPENAI]: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini (Efficient)" },
        { id: "gpt-4o", name: "GPT-4o (Vision Flagship)" }
    ],
    [AIProvider.MISTRAL]: [
        { id: "pixtral-12b-2409", name: "Pixtral 12B (Vision Native)" },
        { id: "mistral-large-latest", name: "Mistral Large" }
    ],
    [AIProvider.DEEPSEEK]: [
        { id: "deepseek-chat", name: "DeepSeek V3 (Text Only)" }
    ],
    [AIProvider.GROQ]: [
        { id: "llama-3.1-8b-instant", name: "Llama Scout (Ultra Fast)" },
        { id: "llama-3.3-70b-versatile", name: "Llama Maverick (Powerful Text)" },
        { id: "llama-3.2-11b-vision-preview", name: "Llama Vision (Preview)" }
    ],
    [AIProvider.GITHUB]: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4o", name: "GPT-4o" }
    ],
    [AIProvider.OPENROUTER]: [
        { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
        { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Exp (Free)", isFree: true },
        { id: "meta-llama/llama-3.2-11b-vision-instruct:free", name: "Llama 3.2 Vision (Free)", isFree: true },
        { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
    ],
};

export const DEFAULT_SETTINGS: Settings = {
    platform: Platform.ADOBE_STOCK,
    titleLength: { min: 70, max: 150 },
    descriptionLength: { min: 70, max: 200 },
    maxKeywords: 50,
    isolatedWhite: false,
    isolatedTransparent: false,
    safeMode: true,
    titlePrefix: "",
    titleSuffix: "",
    aiProvider: AIProvider.GEMINI,
    providerKeys: {
        [AIProvider.GEMINI]: [], [AIProvider.OPENAI]: [], [AIProvider.MISTRAL]: [], 
        [AIProvider.DEEPSEEK]: [], [AIProvider.GROQ]: [], [AIProvider.GITHUB]: [], [AIProvider.OPENROUTER]: [],
    },
    activeModels: {
        [AIProvider.GEMINI]: "gemini-3-flash-preview",
        [AIProvider.OPENAI]: "gpt-4o-mini",
        [AIProvider.MISTRAL]: "pixtral-12b-2409",
        [AIProvider.DEEPSEEK]: "deepseek-chat",
        [AIProvider.GROQ]: "llama-3.1-8b-instant",
        [AIProvider.GITHUB]: "gpt-4o-mini",
        [AIProvider.OPENROUTER]: "google/gemini-2.0-flash-001",
    },
    singleGenerationMode: false,
    imageType: ImageType.IMAGE,
};