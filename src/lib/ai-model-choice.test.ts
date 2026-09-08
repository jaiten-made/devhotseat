import { describe, expect, it } from "vitest";
import type { ProviderStatus } from "../fn/ai";
import { parseModelChoices, resolveEffectiveModel } from "./ai-model-choice";

const status = (overrides: Partial<ProviderStatus> = {}): ProviderStatus => ({
  isReachable: true,
  availableModels: ["llama3.2", "qwen2.5:7b"],
  defaultModel: "llama3.2",
  ...overrides,
});

describe("resolveEffectiveModel", () => {
  it("uses the configured default when nothing is picked", () => {
    expect(resolveEffectiveModel(undefined, status())).toBe("llama3.2");
  });

  it("keeps a pick the provider still offers", () => {
    expect(resolveEffectiveModel("qwen2.5:7b", status())).toBe("qwen2.5:7b");
  });

  it("drops a pick the provider no longer offers", () => {
    expect(resolveEffectiveModel("mistral", status())).toBe("llama3.2");
  });

  it("keeps the pick when the provider listed nothing, which is not a denial", () => {
    expect(
      resolveEffectiveModel(
        "mistral",
        status({ isReachable: false, availableModels: [] }),
      ),
    ).toBe("mistral");
  });

  it("has nothing to offer before the status query lands", () => {
    expect(resolveEffectiveModel(undefined, undefined)).toBe("");
  });
});

describe("parseModelChoices", () => {
  it("reads a stored choice per provider", () => {
    expect(
      parseModelChoices('{"local":"qwen2.5:7b","gemini":"gemini-3.5-pro"}'),
    ).toEqual({ local: "qwen2.5:7b", gemini: "gemini-3.5-pro" });
  });

  it("ignores unknown keys and non-string values", () => {
    expect(parseModelChoices('{"local":42,"openai":"gpt-4"}')).toEqual({});
  });

  it("survives storage that is absent or not JSON", () => {
    expect(parseModelChoices(null)).toEqual({});
    expect(parseModelChoices("not json")).toEqual({});
    expect(parseModelChoices('"a string"')).toEqual({});
  });
});
