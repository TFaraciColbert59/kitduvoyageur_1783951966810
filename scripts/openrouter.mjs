import fs from "fs";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("ERROR: OPENROUTER_API_KEY is not defined.");
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/openrouter.mjs \"your prompt\"");
  process.exit(1);
}

const prompt = args.join(" ");

const systemPrompt = `
You are an expert software engineer helping develop "Le Kit du Voyageur".

PROJECT STACK:
- Next.js 15
- App Router
- TypeScript
- React
- Tailwind CSS
- Supabase
- Stripe
- Leaflet / React-Leaflet
- React Context / custom hooks

IMPORTANT PROJECT RULES:
- Do not replace the existing architecture.
- Do not migrate frameworks.
- Do not use Vanilla HTML/CSS/JS as the main architecture.
- Preserve Supabase, authentication, Stripe, APIs and existing backend logic.
- Prefer minimal, targeted changes.
- Never invent files, APIs, database tables or columns.
- Inspect the repository before making assumptions.
- Do not expose secrets.
- Do not modify unrelated files.
- If something is unclear, explain exactly what is unclear.

Your job is to provide a high-quality engineering answer to the task.
`;

const response = await fetch(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "Le Kit du Voyageur"
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2
    })
  }
);

if (!response.ok) {
  const errorText = await response.text();

  console.error(
    `OpenRouter API error ${response.status}: ${errorText}`
  );

  process.exit(1);
}

const data = await response.json();

const content =
  data?.choices?.[0]?.message?.content;

if (!content) {
  console.error(
    "OpenRouter returned no textual response."
  );

  console.error(
    JSON.stringify(data, null, 2)
  );

  process.exit(1);
}

console.log(content);