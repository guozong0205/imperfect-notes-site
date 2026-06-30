# Imperfect Notes Site - Codex Instructions

Claude is currently unavailable. Codex owns planning, implementation, checking,
and handoff for this site.

Before substantial work, read:

- `/Users/jonguo/Documents/闲聊/codex_context/workspace_memory.md`
- `/Users/jonguo/Documents/闲聊/codex_context/project_map.md`
- `/Users/jonguo/Documents/闲聊/codex_context/automation_playbook.md`

Relevant migrated sections:

- `Imperfect Notes`
- `Imperfect Notes Website`
- `Divination Website: MBTI + Ba Zi + Zi Wei Dou Shu`

## Local Preview

The old Claude launch config serves this directory with:

```bash
python3 -m http.server 8765 --directory /Users/jonguo/Documents/imperfect-notes-site
```

Use another port if 8765 is occupied.

## Site Rules

- Preserve the Imperfect Notes visual identity: cold navy, restrained type,
  solitary light, warm amber accent, melancholic but healing tone.
- Keep public English-facing Imperfect Notes copy polished and non-generic.
- Do not fabricate composer, opus, or provenance claims.
- Treat `ziwei/` as a deterministic chart-calculation project where AI only
  interprets supplied chart facts.
- Do not use browser-direct model API calls in production. Use a backend proxy.

## Site Operations

- Codex owns future content updates for `imperfectnotes.com`.
- Use `/Users/jonguo/Desktop/Imperfect Notes/程序/更新网站.py` after each
  completed release package and verified YouTube URL.
- EP18 and EP19 were added on 2026-06-30. EP20 is not ready for the site until
  its release package and platform URLs exist.
- Zi Wei interpretation must use the backend proxy template in
  `workers/ziwei-interpreter-openai.js`; do not restore browser-side provider
  calls.
