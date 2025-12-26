
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
                // Using the most stable model available for validation
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
        
        if (response.status === 200) return 'valid';
        if (response.status === 401) return 'invalid';
        if (response.status === 402) return 'exhausted';
        if (response.status === 429) return 'rate_limited';

        // 404/400 often means model is wrong but key might be fine.
        if (response.status === 400 || response.status === 404) {
            return 'valid';
        }
        
        return 'invalid';
    } catch (e) {
        return 'testing';
    }
};
