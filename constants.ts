
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
        { id: "gemini-flash-latest", name: "Gemini Flash (Highly Stable)" },
        { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)" },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Preview)" }
    ],
    [AIProvider.OPENAI]: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4o", name: "GPT-4o (Vision)" }
    ],
    [AIProvider.MISTRAL]: [
        { id: "pixtral-12b-2409", name: "Pixtral 12B (Vision Native)" },
        { id: "mistral-large-latest", name: "Mistral Large" }
    ],
    [AIProvider.DEEPSEEK]: [
        { id: "deepseek-chat", name: "DeepSeek V3" }
    ],
    [AIProvider.GROQ]: [
        { id: "llama-4-maverick", name: "Llama 4 Maverick (Experimental)" },
        { id: "llama-4-scout", name: "Llama 4 Scout (Fast)" },
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Stable Text)" },
    ],
    [AIProvider.GITHUB]: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4o", name: "GPT-4o" }
    ],
    [AIProvider.OPENROUTER]: [
        { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
        { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Exp (Free)", isFree: true },
        { id: "openai/gpt-4o-2024-11-20", name: "GPT-4o (Vision)" },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
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
        [AIProvider.GEMINI]: [], [AIProvider.OPENAI]: [], [AIProvider.MISTRAL]: [], 
        [AIProvider.DEEPSEEK]: [], [AIProvider.GROQ]: [], [AIProvider.GITHUB]: [], [AIProvider.OPENROUTER]: [],
    },
    activeModels: {
        [AIProvider.GEMINI]: "gemini-flash-latest",
        [AIProvider.OPENAI]: "gpt-4o-mini",
        [AIProvider.MISTRAL]: "pixtral-12b-2409",
        [AIProvider.DEEPSEEK]: "deepseek-chat",
        [AIProvider.GROQ]: "llama-4-maverick",
        [AIProvider.GITHUB]: "gpt-4o-mini",
        [AIProvider.OPENROUTER]: "google/gemini-2.0-flash-001",
    },
    singleGenerationMode: false,
    imageType: ImageType.IMAGE,
};
