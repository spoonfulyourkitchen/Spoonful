## AI models (server-side update, no app update required)

Spoonful's AI features now pick a model in a fixed, cost-aware order instead of
going straight to a paid model:

1. **All free models** are always tried first (their availability is checked
   live), with a strict limit on attempts and an overall time budget so a
   request can never take minutes.
2. Only if none of them answers, the cheap fallback chain runs:
   `meta-llama/llama-3.1-8b-instruct` → `microsoft/phi-4` →
   `deepseek/deepseek-v4.1-flash` → `openai/gpt-4o-mini`.
3. **DeepSeek is skipped during its peak hours**, when it costs twice as much —
   weekdays only, and it is always available on weekends.
4. A **daily limit for paid requests** (100 by default, a few cents) keeps the
   AI from ever becoming expensive, and paid usage can be switched off entirely.

Because everything runs on the server, this change reaches existing installs
immediately — no new app version, no re-download.

Every AI answer now reports which model was used and whether it was a paid
fallback, so usage stays transparent and predictable.
