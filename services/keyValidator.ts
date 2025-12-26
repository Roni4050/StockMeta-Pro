
import { AIProvider, ApiKey } from '../types';

export const validateKey = async (provider: AIProvider, key: string): Promise<ApiKey['status']> => {
    try {
        let endpoint = "";
        let headers: Record<string, string> = { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        };

        const testPayload = {
            model: "", 
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1
        };

        switch (provider) {
            case AIProvider.GEMINI:
                return 'valid'; 
            case AIProvider.OPENAI:
                endpoint = "https://api.openai.com/v1/chat/completions";
                testPayload.model = "gpt-4o-mini";
                break;
            case AIProvider.GITHUB:
                endpoint = "https://models.inference.ai.azure.com/chat/completions";
                testPayload.model = "gpt-4o-mini";
                break;
            case AIProvider.GROQ:
                endpoint = "https://api.groq.com/openai/v1/chat/completions";
                // Using stable llama-3.3-70b-versatile for validation
                testPayload.model = "llama-3.3-70b-versatile"; 
                break;
            case AIProvider.MISTRAL:
                endpoint = "https://api.mistral.ai/v1/chat/completions";
                testPayload.model = "pixtral-12b-2409";
                break;
            case AIProvider.DEEPSEEK:
                endpoint = "https://api.deepseek.com/chat/completions";
                testPayload.model = "deepseek-chat";
                break;
            case AIProvider.OPENROUTER:
                endpoint = "https://openrouter.ai/api/v1/chat/completions";
                testPayload.model = "google/gemini-2.0-flash-001";
                headers["HTTP-Referer"] = window.location.origin;
                headers["X-Title"] = "StockMeta Pro";
                break;
            default:
                return 'valid';
        }

        const response = await fetch(endpoint, { 
            method: "POST", 
            headers, 
            body: JSON.stringify(testPayload) 
        });
        
        // 200 is always valid
        if (response.status === 200) return 'valid';
        
        // 401 is a definitive Authentication Failure
        if (response.status === 401) return 'invalid';
        
        // 402 is specifically out of money
        if (response.status === 402) return 'exhausted';
        
        // 429 is too many requests
        if (response.status === 429) return 'rate_limited';

        /**
         * RELAXED VALIDATION:
         * If we get a 400 (Bad Request) or 404 (Not Found), it often means the *model ID* 
         * we used for testing is wrong for that specific account/key tier, but the 
         * API key itself might still be valid for other models.
         * We default to 'valid' to let the user attempt to use it.
         */
        if (response.status === 400 || response.status === 404) {
            console.warn(`Key validation probe returned ${response.status} for ${provider}. Key likely valid, but test model rejected.`);
            return 'valid';
        }
        
        return 'invalid';
    } catch (e) {
        console.error(`Validation probe failed for ${provider}:`, e);
        // On network error, don't kill the key, just mark as testing or pending
        return 'testing';
    }
};
