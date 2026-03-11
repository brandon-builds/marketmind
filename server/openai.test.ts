import { describe, it, expect } from "vitest";

describe("OpenAI API key validation", () => {
  it("should have OPENAI_API_KEY set in environment", () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key!.startsWith("sk-")).toBe(true);
  });

  it("should successfully call OpenAI API with gpt-4o-mini", async () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key || !key.startsWith("sk-")) {
      console.warn("Skipping live API test — no valid OPENAI_API_KEY");
      return;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: "Reply with the single word: OK" },
        ],
        max_tokens: 5,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json() as any;
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    const content = data.choices[0].message.content as string;
    expect(content.toLowerCase()).toContain("ok");
  }, 30000);
});
