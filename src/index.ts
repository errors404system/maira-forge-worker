/**
 * Maira Forge Server - Cloudflare Worker (original code)
 * AI diye website banano:
 *   POST /v1/forge/generate   {prompt, theme?, model?} -> SSE stream
 *   GET  /health               -> {ok:true}
 *   GET  /                    -> info
 * Stream events (Forge app-er sathe milano):
 *   {"type":"stage","stage":"PARSING_PROMPT"|"SCAFFOLD"|"STYLING"|"IMAGERY"|"MOTION"|"FINALIZING"}
 *   {"type":"progress","progress":0..1}
 *   {"type":"chunk","text":"..."}        // website-er HTML tukro
 *   {"type":"section","name":"Hero"}
 *   {"type":"log","text":"..."}
 *   {"type":"complete","html":"<full html>","sections":[...]}
 *   {"type":"fail","message":"..."}
 * AI: Groq chat completions (env GROQ_API_KEY, model GROQ_MODEL).
 * Groq key na thakle 401 dey - key kokhono code-e likhbe na, wrangler secret-e bosabe.
 */
export interface Env { GROQ_API_KEY?: string; GEMINI_API_KEY?: string; GROQ_MODEL?: string }
const STAGES = ["PARSING_PROMPT", "SCAFFOLD", "STYLING", "IMAGERY", "MOTION", "FINALIZING"] as const;
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
function err(status: number, code: string, message: string) { return json({ error: code, message }, status); }
async function groqHtml(env: Env, prompt: string): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY bosano hoyni. wrangler secret put GROQ_API_KEY diye bosao.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You build a complete single-file website. Reply with ONLY the full HTML file, starting with <!doctype html>. Use inline CSS, dark purple theme (#0A0A0F background, #7C6CFF accent), responsive, no external images except placeholder gradients." },
        { role: "user", content: `Website banao: ${prompt}` },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const html = data.choices?.[0]?.message?.content || "";
  if (!html) throw new Error("Groq khali uttor diyeche.");
  return html;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type" } });
    if (url.pathname === "/health") return json({ ok: true, service: "maira-forge-server", version: "1.0.0" });
    if (url.pathname === "/") return new Response("Maira Forge Server - POST /v1/forge/generate diye website banao.", { headers: { "Content-Type": "text/plain" } });
    if (url.pathname === "/v1/forge/generate" && req.method === "POST") {
      const body = await req.json().catch(() => ({})) as { prompt?: string; theme?: string };
      const prompt = (body.prompt || "").trim();
      if (!prompt) return err(400, "bad_request", "prompt khali - ki website banabe likho.");
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
          try {
            for (let i = 0; i < STAGES.length; i++) {
              send({ type: "stage", stage: STAGES[i] });
              send({ type: "progress", progress: (i + 1) / (STAGES.length + 1) });
              send({ type: "log", text: `${STAGES[i]} cholche...` });
              await new Promise(r => setTimeout(r, 150));
            }
            const html = await groqHtml(env, prompt);
            const sections = ["Hero", "About", "Features", "Contact"];
            for (const s of sections) send({ type: "section", name: s });
            // chunk kore pathano - app-er Forge scene-e progress dekhabe
            const size = 4000;
            for (let i = 0; i < html.length; i += size) send({ type: "chunk", text: html.slice(i, i + size) });
            send({ type: "progress", progress: 1 });
            send({ type: "complete", html, sections });
          } catch (e) {
            send({ type: "fail", message: e instanceof Error ? e.message : "Forge fail koreche." });
          } finally { controller.close(); }
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
    }
    return err(404, "not_found", "Ei path-ta ei server-e nei.");
  },
};
