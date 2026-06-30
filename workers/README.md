# Zi Wei Interpreter Worker

This folder contains a provider-neutral replacement for the old Claude/Anthropic
browser fallback in `ziwei/index.html`.

The page now always calls a backend endpoint. Model API keys must stay on the
server side.

## Contract

Request:

```json
{
  "system": "system prompt",
  "user": "chart facts and question",
  "max_tokens": 2000,
  "stream": true
}
```

Response:

- `text/plain; charset=utf-8`
- Plain text chunks when streaming.
- Plain text body when non-streaming.

## OpenAI-Compatible Cloudflare Worker

Template:

```text
workers/ziwei-interpreter-openai.js
```

Required secret:

```bash
wrangler secret put OPENAI_API_KEY
```

Optional variables:

```bash
wrangler secret put OPENAI_MODEL
wrangler secret put OPENAI_BASE_URL
wrangler secret put ALLOWED_ORIGIN
```

Suggested values:

```text
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
ALLOWED_ORIGIN=https://imperfectnotes.com
```

If testing locally or across preview domains, use `ALLOWED_ORIGIN=*` temporarily.

## Deployment Sketch

Create or update `wrangler.toml` outside this repo or in a deployment folder:

```toml
name = "ziwei-interpreter"
main = "workers/ziwei-interpreter-openai.js"
compatibility_date = "2026-06-30"
```

Then deploy:

```bash
wrangler deploy
```

After deployment, paste the Worker URL into the page's `解读接口` field or keep
the default value if the route is:

```text
https://ziwei-interpreter.imperfectnotes.workers.dev
```

## Safety Rule

Do not let the model calculate or invent chart facts. The browser app sends
deterministic chart facts; the model only interprets those facts.
