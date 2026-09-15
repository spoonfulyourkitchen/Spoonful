## AI models (server-side update, no app update required)

Spoonful's AI features now pick a model in a fixed, cost-aware order instead of
going straight to a paid model:

1. **Three hand-picked free models** are always tried first — and nothing else:
   a fast one with good German, a strong instruction follower, and the most
   capable model of the free group. The previous behaviour looked up a long list
   of free models on every request, which made answers unnecessarily slow.
2. If none of them answers, the cheap fallback chain runs:
   `meta-llama/llama-3.1-8b-instruct` → `microsoft/phi-4` →
   `deepseek/deepseek-v4.1-flash` → `openai/gpt-4o-mini`.
3. **DeepSeek is skipped during its peak hours**, when it costs twice as much —
   weekdays only, and it is always available on weekends.
4. A **daily limit for paid requests** (100 by default, a few cents) keeps the
   AI from ever becoming expensive, and paid usage can be switched off entirely.
5. **Faster answers:** one attempt per free model, no model-list lookup, and a
   fixed time budget (20 s for the free round, 30 s for the fallback chain) — a
   request can no longer run for minutes.

Because everything runs on the server, this change reaches existing installs
immediately — no new app version, no re-download.

Every AI answer now reports which model was used and whether it was a paid
fallback, so usage stays transparent and predictable.
