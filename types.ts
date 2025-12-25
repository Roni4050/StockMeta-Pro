
export enum Platform {
    GENERAL = "General",
    ADOBE_STOCK = "Adobe Stock",
    SHUTTERSTOCK = "Shutterstock",
    FREEPIK = "Freepik",
    VECTEEZY = "Vecteezy",
    POND5 = "Pond5",
    TEMPLATE_MONSTER = "Template Monster",
}

export enum AssetStyle {
    REALISTIC = "Realistic Photo",
    LOGO = "Logo/Icon",
    SILHOUETTE = "Silhouette",
    VECTOR_FLAT = "Flat Vector",
    THREE_D = "3D Render",
    ILLUSTRATION = "Digital Illustration",
}

export enum FileStatus {
    PENDING = "Pending",
    PROCESSING = "Processing",
    COMPLETED = "Completed",
    ERROR = "Error",
}

export enum ImageType {
    IMAGE = "Image",
    VECTOR = "Vector",
    VIDEO = "Video",
}

export enum AIProvider {
    GEMINI = "Gemini",
    OPENAI = "OpenAI",
    MISTRAL = "Mistral",
    DEEPSEEK = "DeepSeek",
    GROQ = "Groq",
    GITHUB = "GitHub Models",
    OPENROUTER = "OpenRouter",
}

export interface ApiKey {
    id: string;
    key: string;
    status: 'valid' | 'invalid' | 'testing' | 'pending' | 'rate_limited' | 'exhausted';
    lastUsed?: number;
}

export interface Settings {
    platform: Platform;
    titleLength: { min: number; max: number };
    descriptionLength: { min: number; max: number };
    maxKeywords: number;
    isolatedWhite: boolean;
    isolatedTransparent: boolean;
    safeMode: boolean;
    titlePrefix: string;
    titleSuffix: string;
    aiProvider: AIProvider;
    providerKeys: Record<AIProvider, ApiKey[]>;
    activeModels: Record<AIProvider, string>;
    singleGenerationMode: boolean;
    imageType?: ImageType;
}

export interface ProcessedFile {
    id: string;
    file: File;
    preview: string;
    status: FileStatus;
    style?: AssetStyle;
    metadata: {
        title: string;
        description: string;
        keywords: string[];
        selectedKeywords: string[];
        category?: string;
    };
    error?: string;
}
