import { Check, Cpu, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ProviderStatus } from "@/fn/ai";
import { useAiPreference } from "@/lib/ai-preference";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/server/env";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface AiProviderToggleProps {
  className?: string;
}

function StatusPill({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.6875rem]",
        ok
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ok ? "bg-success" : "bg-destructive",
        )}
      />
      {children}
    </span>
  );
}

/**
 * The model dropdown for one provider, listing what that provider says it can
 * run right now. Both lists are discovered at request time — Ollama's pulled
 * tags, Gemini's catalogue for this key — so a model released or pulled after
 * this app was built appears here without a code change.
 *
 * Disabled with the reason showing rather than hidden when the list is empty,
 * so "the runner is not up" and "the runner is up with nothing pulled" do not
 * look like the same state.
 */
function ModelSelect({
  status,
  value,
  onChange,
  disabled,
  label,
}: {
  status: ProviderStatus | undefined;
  value: string;
  onChange: (model: string) => void;
  disabled: boolean;
  label: string;
}) {
  const options = status?.availableModels ?? [];
  // The configured default is not necessarily installed. Offering it anyway
  // keeps the control from rendering blank on a provider that has told us
  // nothing, and it is what a report would in fact be sent with.
  const items =
    value === "" || options.includes(value) ? options : [value, ...options];
  const isEmpty = items.length === 0;

  return (
    <Select
      value={value === "" ? undefined : value}
      onValueChange={onChange}
      disabled={disabled || isEmpty}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="font-mono text-[0.6875rem]"
      >
        <SelectValue
          placeholder={isEmpty ? "No models available" : "Select a model"}
        />
      </SelectTrigger>
      <SelectContent>
        {items.map((model) => (
          <SelectItem key={model} value={model} className="font-mono text-xs">
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * One provider's card: its status, its model dropdown, and the button that
 * makes that pairing the active one.
 *
 * The button is labelled for the model rather than the provider, because the
 * model is the choice being made — which provider serves it follows from it,
 * and is already named at the top of the card.
 */
function ProviderCard({
  selected,
  onSelect,
  disabled,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3.5 transition-all",
        disabled && "cursor-not-allowed opacity-60",
        selected
          ? "border-ink bg-sunk shadow-xs"
          : "border-rule bg-sheet hover:border-rule-strong",
      )}
    >
      {children}
      {!selected && !disabled && (
        <Button variant="outline" size="sm" onClick={onSelect} className="mt-1">
          Use this model
        </Button>
      )}
    </div>
  );
}

export function AiProviderToggle({ className }: AiProviderToggleProps) {
  const {
    effectiveProvider,
    effectiveModel,
    pickedModels,
    setProvider,
    setModel,
    status,
    refetchStatus,
  } = useAiPreference();

  const [open, setOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchStatus();
    setIsRefreshing(false);
  };

  const local = status?.local;
  const gemini = status?.gemini;
  const isLocalReachable = local?.isReachable ?? false;
  const hasGeminiKey = status?.hasGeminiKey ?? false;

  /** The model this card should show — the pick, unless it is no longer offered. */
  const modelFor = (provider: AIProvider): string => {
    const picked = pickedModels[provider];
    const providerStatus = provider === "gemini" ? gemini : local;
    const available = providerStatus?.availableModels ?? [];
    if (picked && (available.length === 0 || available.includes(picked))) {
      return picked;
    }
    return providerStatus?.defaultModel ?? "";
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex h-8 items-center gap-2 rounded-full border border-rule bg-sheet px-2.5 text-xs font-medium text-ink transition-colors hover:border-rule-strong hover:bg-sunk",
            className,
          )}
          title="Configure AI engine"
          aria-label={`AI provider: ${effectiveProvider === "local" ? "Local AI" : "Gemini API"}, model ${effectiveModel}`}
        >
          {effectiveProvider === "local" ? (
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                isLocalReachable ? "bg-success" : "bg-destructive",
              )}
              aria-hidden="true"
            />
          ) : (
            <Sparkles className="size-3 shrink-0 text-ink-muted" />
          )}
          <span className="font-mono text-[0.6875rem] text-ink-muted">
            {effectiveProvider === "local" ? "Local: " : "Gemini: "}
            <span className="font-semibold text-ink">{effectiveModel}</span>
          </span>
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-between text-base">
            <span>AI Scoring Provider</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh connection status"
              className="text-ink-muted"
            >
              <RefreshCw
                className={cn("size-3.5", isRefreshing && "animate-spin")}
              />
            </Button>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Choose whether session feedback is scored locally on your machine or
            by Google Gemini, and which model writes it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-1">
          <ProviderCard
            selected={effectiveProvider === "local"}
            onSelect={() => setProvider("local")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-ink-muted" />
                <span className="text-sm font-medium text-ink">Local AI</span>
                <StatusPill ok={isLocalReachable}>
                  {isLocalReachable ? "Online" : "Offline"}
                </StatusPill>
              </div>
              {effectiveProvider === "local" && (
                <Check className="size-4 shrink-0 text-ink" />
              )}
            </div>

            <div className="flex justify-between font-mono text-xs text-ink-muted">
              <span>Endpoint:</span>
              <span className="text-ink">
                {local?.baseUrl ?? "http://localhost:11434"}
              </span>
            </div>

            <ModelSelect
              status={local}
              value={modelFor("local")}
              onChange={(model) => setModel("local", model)}
              disabled={!isLocalReachable}
              label="Local AI model"
            />

            {!isLocalReachable && (
              <p className="rounded bg-destructive/10 px-2 py-1 font-sans text-[0.6875rem] leading-tight text-destructive">
                No local model server is responding at {local?.baseUrl}. Run{" "}
                <code className="font-mono font-semibold">ollama serve</code> to
                start it.
              </p>
            )}

            {isLocalReachable && (local?.availableModels.length ?? 0) === 0 && (
              <p className="rounded bg-warning/10 px-2 py-1 font-sans text-[0.6875rem] leading-tight text-warning">
                Running, but no models are installed. Run{" "}
                <code className="font-mono font-semibold">
                  ollama pull {local?.defaultModel ?? "llama3.2"}
                </code>
                .
              </p>
            )}
          </ProviderCard>

          <ProviderCard
            selected={effectiveProvider === "gemini"}
            onSelect={() => setProvider("gemini")}
            disabled={!hasGeminiKey}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-ink-muted" />
                <span className="text-sm font-medium text-ink">
                  Google Gemini API
                </span>
                <StatusPill ok={hasGeminiKey && (gemini?.isReachable ?? false)}>
                  {!hasGeminiKey
                    ? "No key"
                    : gemini?.isReachable
                      ? "Online"
                      : "Unreachable"}
                </StatusPill>
              </div>
              {effectiveProvider === "gemini" && (
                <Check className="size-4 shrink-0 text-ink" />
              )}
            </div>

            <ModelSelect
              status={gemini}
              value={modelFor("gemini")}
              onChange={(model) => setModel("gemini", model)}
              disabled={!hasGeminiKey}
              label="Gemini model"
            />

            {!hasGeminiKey && (
              <p className="rounded bg-warning/10 px-2 py-1 font-sans text-[0.6875rem] leading-tight text-warning">
                Set{" "}
                <code className="font-mono font-semibold">GEMINI_API_KEY</code>{" "}
                in <code className="font-mono">.env</code> to enable cloud
                generation.
              </p>
            )}

            {hasGeminiKey && !gemini?.isReachable && (
              <p className="rounded bg-destructive/10 px-2 py-1 font-sans text-[0.6875rem] leading-tight text-destructive">
                Could not list models: {gemini?.error ?? "unknown error"}
              </p>
            )}
          </ProviderCard>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Done</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
