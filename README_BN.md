# Maira Forge Server

Maira AI-er nijer website-bananor সার্ভার (Cloudflare Worker)।

## কাজ
- `POST /v1/forge/generate` — `{prompt}` দিলে SSE stream-e website banay
- Stage: `PARSING_PROMPT → SCAFFOLD → STYLING → IMAGERY → MOTION → FINALIZING → DONE`
- Stream-e `stage`, `progress`, `chunk`, `section`, `log`, `complete` / `fail` event ase
- AI: Groq (model `llama-3.3-70b-versatile`, `wrangler.toml`-এ বদলানো যায়)

## Deploy
```bash
cd maira-forge-worker
npm install
npx wrangler login
npx wrangler secret put GROQ_API_KEY
npx wrangler deploy
```
Deploy হলে Cloudflare যে URL দেবে (যেমন `https://maira-forge-server.tomar-subdomain.workers.dev`), সেটা Maira app-er `Config.kt`-তে `FORGE_SERVER_URL` হিসাবে বসাও।

## Test
```bash
curl -N -X POST https://<tomar-forge-url>/v1/forge/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Maira AI-er jonno ekta portfolio website banao"}'
```
