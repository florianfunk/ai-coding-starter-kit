export const AI_PROVIDERS = ["openai", "anthropic"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (schnell, günstig)" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
    { id: "gpt-5", label: "GPT-5" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (schnell, günstig)" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  ],
};

export const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

export function isValidModel(provider: AiProvider, model: string): boolean {
  return AI_MODELS[provider].some((m) => m.id === model);
}
