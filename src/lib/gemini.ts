import "server-only";

const MODEL = "gemini-flash-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function generate(prompt: string, json: boolean): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    // a hung upstream must fail fast into the deterministic fallbacks
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  return text;
}

export async function geminiText(prompt: string): Promise<string> {
  return generate(prompt, false);
}

export async function geminiJSON<T>(prompt: string): Promise<T> {
  const raw = await generate(prompt, true);
  return JSON.parse(raw) as T;
}
