
import { Platform, ImageType, Settings, AIProvider, GeminiModel } from './types';

export const PLATFORMS: Platform[] = [
    Platform.GENERAL,
    Platform.ADOBE_STOCK,
    Platform.SHUTTERSTOCK,
    Platform.FREEPIK,
    Platform.VECTEEZY,
    Platform.POND5,
    Platform.TEMPLATE_MONSTER,
];

export const IMAGE_TYPES: ImageType[] = [
    ImageType.NONE,
    ImageType.VECTOR,
    ImageType.LOGO,
];

export const DEFAULT_SETTINGS: Settings = {
    platform: Platform.ADOBE_STOCK,
    titleLength: { min: 70, max: 150 },
    descriptionLength: { min: 70, max: 150 },
    maxKeywords: 50,
    prefix: '',
    suffix: '',
    isolatedWhite: false,
    isolatedTransparent: false,
    imageType: ImageType.NONE,
    mistralApiKeys: [],
    geminiApiKeys: [],
    aiProvider: AIProvider.GEMINI,
    singleGenerationMode: false,
    geminiModel: GeminiModel.FLASH, // Default to Gemini 2.5 Flash
};