// llm_api.js

export async function parseBalanceWithLLM(base64Image, provider, apiKey) {
    if (provider === 'openai') {
        return await callOpenAI(base64Image, apiKey);
    } else if (provider === 'gemini') {
        return await callGemini(base64Image, apiKey);
    } else {
        throw new Error("Unknown provider: " + provider);
    }
}

async function callOpenAI(base64Image, apiKey) {
    const url = "https://api.openai.com/v1/chat/completions";
    // Remove header if present in data URL
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const payload = {
        model: "gpt-4o", // Or gpt-4-turbo
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Identify the total wallet balance in this image. It is usually in the top right or center. The format is like $1,234.56. Return ONLY the numeric value (e.g. 1234.56). Do not output any markdown or other text."
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${cleanBase64}`
                        }
                    }
                ]
            }
        ],
        max_tokens: 50
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    return cleanBalanceString(content);
}

async function callGemini(base64Image, apiKey) {
    // Gemini 1.5 Flash is good for vision and cheap
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const payload = {
        contents: [{
            parts: [
                { text: "Identify the total wallet balance in this image. Return ONLY the numeric value (e.g. 1234.56)." },
                {
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: cleanBase64
                    }
                }
            ]
        }]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    // Path to text in Gemini response
    const content = data.candidates[0].content.parts[0].text.trim();
    return cleanBalanceString(content);
}

function cleanBalanceString(str) {
    // Remove $, commas, references to USD etc.
    const cleaned = str.replace(/[$,]/g, '').replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    if (isNaN(val)) throw new Error(`Could not parse balance from: ${str}`);
    return val;
}
