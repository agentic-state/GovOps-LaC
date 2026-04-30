# Deploying the v2.1 hosted demo

End-to-end recipe for the public live demo. Target platform: **Hugging Face Spaces**, free tier, single Docker container, $0/month.

> The demo is intentionally MVP-grade — see PLAN.md §11 (out-of-scope items) for what's deliberately *not* in v2.1. Production hardening (managed PG, AuthN, multi-tenancy, observability) is a separate track.

## Prerequisites (~15 min one-time setup)

Sign up for accounts. All free, no credit card required:

| Service | What it provides | Sign-up URL |
| --- | --- | --- |
| **Hugging Face** | Hosting (Docker Space, 16 GB RAM, /data disk) | https://huggingface.co/join |
| **Groq** | Default LLM provider — Llama 3.3 70B, very fast | https://console.groq.com |
| **OpenRouter** | Fail-over provider, free models | https://openrouter.ai |
| **Google AI Studio** | Gemini fail-over (generous free tier) | https://aistudio.google.com |
| **Mistral La Plateforme** | EU-residency-friendly fail-over | https://console.mistral.ai |

You only need *one* LLM provider key to boot — the others are fail-overs that activate when the primary throttles. Recommended minimum: Groq + OpenRouter.

## Create the Space

1. Go to https://huggingface.co/new-space
2. Owner: your account (or `agentic-state` if you have org access)
3. Name: `govops-lac` (URL becomes `https://huggingface.co/spaces/<owner>/govops-lac`)
4. License: **Apache 2.0**
5. **SDK: Docker** (NOT Streamlit / Gradio — we ship a custom Dockerfile)
6. Space hardware: **CPU basic** (free tier, 16 GB RAM, no GPU needed — inference happens at the LLM provider)
7. Visibility: Public
8. Click **Create Space**

## Configure secrets

In the new Space, click **Settings** → **Variables and secrets** → **New secret**. Add at minimum:

| Secret name | Value | Why |
| --- | --- | --- |
| `GROQ_API_KEY` | from console.groq.com | First provider in the chain |
| `OPENROUTER_API_KEY` | from openrouter.ai | Fail-over when Groq throttles |
| `GEMINI_API_KEY` | from aistudio.google.com | Optional — third in the chain |
| `MISTRAL_API_KEY` | from console.mistral.ai | Optional — fourth in the chain |
| `DEMO_ADMIN_TOKEN` | random string (e.g. `python -c "import secrets;print(secrets.token_urlsafe(32))"`) | Gates `POST /api/admin/gc` so only you can force a substrate clean-up |

The Dockerfile already sets `GOVOPS_DEMO_MODE=1`, `GOVOPS_SEED_DEMO=1`, `GOVOPS_DB_PATH=/data/govops.db`, and the rate-limit defaults — no need to set them as secrets unless you want to override.

## Wire the repo

Two ways to populate the Space with this code:

**Option A — Mirror the GitHub repo** (recommended; auto-rebuild on push)

```bash
# In the Space's "Files and versions" tab, click "Use git" and copy the URL,
# then locally:
git remote add hf https://huggingface.co/spaces/<owner>/govops-lac
git push hf main
```

Every `git push hf main` triggers a rebuild (~3-5 min for first build because of the Node + Python layers; subsequent builds are faster thanks to layer caching).

**Option B — Hugging Face's GitHub sync** (no manual push)

In the Space's settings, link the GitHub repo `agentic-state/GovOps-LaC`. HF will rebuild on every commit to `main`.

## What you should see

First boot: **3-5 min** while the Docker layers build. The Space's status will go from "Building" → "Running" → ready.

When ready, the public URL will be `https://<owner>-govops-lac.hf.space/` and you should see:

1. The v2 React/TanStack home page (`Statute meets System`) with a sticky banner: *"Public demo on free tier — anything you do here is visible to other visitors and auto-expires after 7 days. Seeded data and the demo cases stay forever."*
2. Working `/screen`, `/about`, `/cases`, `/impact`, `/config`, `/admin/federation`, `/encode` routes
3. The `/encode` page can paste a statute fragment and get LLM proposals back (rate-limited 5 req/min/IP via the proxy)
4. `/api/health` returns `{ "demo_mode": true, "llm_providers": ["groq", "openrouter", ...] }` — confirms the secrets landed

## Verify provider failover

```bash
# Should succeed via the first configured provider
curl -X POST https://<owner>-govops-lac.hf.space/api/llm/chat \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"Reply with: ok"}]}'
# => { "provider": "groq", "model": "...", "content": "ok", "elapsed_ms": ... }

# Verify rate limit kicks in after 5 hits in a minute
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://<owner>-govops-lac.hf.space/api/llm/chat \
    -H "content-type: application/json" \
    -d '{"messages":[{"role":"user","content":"hi"}]}'
done
# => 200 200 200 200 200 429
```

## Force a GC sweep (operator-only)

When a presentation is coming up and you want a clean substrate:

```bash
curl -X POST "https://<owner>-govops-lac.hf.space/api/admin/gc?token=$DEMO_ADMIN_TOKEN"
# => { "deleted": <count>, "max_age_days": 7, "ran_at": "2026-..." }
```

Or set `?max_age_days=0` to nuke every user-created record regardless of age.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Space stuck "Building" >10 min | Layer cache cold + Node install slow | Wait — first build is slow, subsequent builds use cache |
| `/api/health` returns `"llm_providers": []` | No `*_API_KEY` env var set, or all are blank | Re-check Space → Settings → Secrets; restart Space |
| 502 on `/api/llm/chat` | All configured providers exhausted simultaneously | Check provider dashboards for quota; add another `*_API_KEY` |
| Cold-start takes 30s on first visit | Free Spaces sleep after 48h idle | Expected — HF wakes the container on the first request |
| Drafts disappear after a day | Free-tier `/data` is ephemeral across some restarts | Expected per the demo banner; substrate re-seeds from `lawcode/` |
| Rate limit too aggressive | Defaults are 5 req/min, 100 req/day | Override `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_PER_DAY` in Space secrets |

## When to retire this deploy

The v2.1 demo is sized for ~1 week of "free-tier friendly" exposure. Watch for:

- **Provider free tiers shifting** (Groq's limits are documented but historically have changed every few months)
- **HF Spaces policy changes** (free tier terms can shift)
- **Sustained traffic** that pushes you near the per-day limits — at that point you've graduated past "MVP demo" and v3.x's production-target track is a better home

When any of these hit, the same Dockerfile deploys to Azure Container Apps unchanged — that's the production-grade path.
