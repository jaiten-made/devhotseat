# 30. Local AI support with a Gemini API toggle

## Decision

Support local AI models (via Ollama or OpenAI-compatible local endpoints like LM Studio) alongside the Gemini API behind the existing `ReportGenerator` interface.

Make `GEMINI_API_KEY` optional so that `devhotseat` can run 100% locally and offline out of the box with zero external accounts. Provide a runtime and environment toggle allowing users to switch between local model execution (e.g. `llama3.2`, `qwen2.5`) and cloud Google Gemini (`gemini-3.5-flash-lite`) whenever they want higher quality feedback.

## Why

`devhotseat` is designed as a personal, private interview practice tool running on the user's machine. The primary purpose of daily sessions is speaking by repetition to build muscle memory and remember what to say under pressure, rather than needing frontier-grade feedback on every routine run. For daily drills, modern lightweight local models (Llama 3.2 3B, Qwen 2.5 7B, Mistral) are fast, private, and completely free of token or subscription costs. Requiring a cloud API key creates friction, incurs recurring API costs, and prevents fully private, offline use.

Retaining the Gemini toggle allows users with a key to seamlessly opt into higher-tier reasoning and nuanced STAR-L scoring whenever they want deeper, higher quality feedback.

## Pros

- **Zero-barrier setup**: Users can launch the app immediately without signing up for Google AI Studio or providing an API key.
- **Cost-effective (100% free)**: Running local models incurs zero API fees, subscription charges, or token quota limits.
- **Privacy & Offline**: Transcripts and feedback reports never leave the local machine when local AI is active.
- **Unified Schema**: Both local models and Gemini output structured JSON parsed and validated by `parseReportResponse`.
- **Dynamic Switcher**: Users can flip between Local AI and Gemini directly from the header UI or `.env`.

## Cons

- Scoring consistency on smaller local models (e.g. 3B) can vary compared to frontier models; structured output requires schema guidance in the prompt.
- Local AI requires an external runner like Ollama running on the host machine.
