import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

// claude-sonnet-4-5 / claude-3-5-sonnet
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

export const anthropic =
  apiKey && apiKey !== "your_anthropic_api_key_here"
    ? new Anthropic({ apiKey })
    : null;

/**
 * Extended thinking configuration for complex network & RADIUS diagnoses.
 */
export function buildThinkingConfig(budgetTokens = 8000): {
  thinking: { type: "enabled"; budget_tokens: number };
  temperature: 1;
} {
  return {
    thinking: { type: "enabled", budget_tokens: budgetTokens },
    temperature: 1,
  };
}
