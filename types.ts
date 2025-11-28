
export enum Platform {
    GENERAL = "General",
    ADOBE_STOCK = "Adobe Stock",
    SHUTTERSTOCK = "Shutterstock",
    FREEPIK = "Freepik",
    VECTEEZY = "Vecteezy",
    POND5 = "Pond5",
    TEMPLATE_MONSTER = "Template Monster",
}

export enum ImageType {
    NONE = "None",
    VECTOR = "Vector/Illustration",
    LOGO = "Logo Design",
}

export enum FileStatus {
    PENDING = "Pending",
    PROCESSING = "Processing",
    COMPLETED = "Completed",
    ERROR = "Error",
}

export enum AIProvider {
    GEMINI = "Gemini",
    MISTRAL = "Mistral",
}

export enum GeminiModel {
    FLASH_LITE = "gemini-flash-lite-latest",
    FLASH = "gemini-2.5-flash",
    FLASH_2_0 = "gemini-2.0-flash-exp",
    PRO = "gemini-3-pro-preview",
}

export interface Settings {
    platform: Platform;
    titleLength: { min: number; max: number };
    descriptionLength: { min: number; max: number };
    maxKeywords: number;
    prefix: string;
    suffix: string;
    isolatedWhite: boolean;
    isolatedTransparent: boolean;
    imageType: ImageType;
    mistralApiKeys: string[]; // Mistral keys
    geminiApiKeys: string[]; // Gemini keys
    aiProvider: AIProvider;
    singleGenerationMode: boolean;
    geminiModel: GeminiModel;
}

export interface ProcessedFile {
    id: string;
    file: File;
    preview: string;
    status: FileStatus;
    metadata: {
        title: string;
        description: string;
        keywords: string[]; // All generated keywords
        selectedKeywords: string[]; // User-selected keywords
    };
    error?: string;
}