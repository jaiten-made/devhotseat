import { Check, Cpu, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAiPreference } from "@/lib/ai-preference";
import { cn } from "@/lib/utils";
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

interface AiProviderToggleProps {
  className?: string;
}

export function AiProviderToggle({ className }: AiProviderToggleProps) {
  const { effectiveProvider, setPreference, status, refetchStatus } =
    useAiPreference();

  const [open, setOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchStatus();
    setIsRefreshing(false);
  };

  const isLocalReachable = status?.localAi.isReachable ?? false;
  const localModel = status?.localAi.model ?? "llama3.2";
  const hasGeminiKey = status?.hasGeminiKey ?? false;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex h-8 items-center gap-2 rounded-full border border-rule bg-sheet px-2.5 text-xs font-medium text-ink transition-colors hover:border-rule-strong hover:bg-sunk",
            className,
          )}
          title="Configure AI Engine"
          aria-label={`AI Provider: ${effectiveProvider === "local" ? "Local AI" : "Gemini API"}`}
        >
          {effectiveProvider === "local" ? (
            <>
              <span
                className={cn(
                  "size-2 rounded-full shrink-0",
                  isLocalReachable ? "bg-success" : "bg-destructive",
                )}
                aria-hidden="true"
              />
              <span className="font-mono text-[0.6875rem] text-ink-muted">
                Local:{" "}
                <span className="text-ink font-semibold">{localModel}</span>
              </span>
            </>
          ) : (
            <>
              <Sparkles className="size-3 text-ink-muted shrink-0" />
              <span className="font-mono text-[0.6875rem] text-ink">
                Gemini API
              </span>
            </>
          )}
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
            by Google Gemini.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-1">
          {/* Local AI Option */}
          <button
            type="button"
            onClick={() => setPreference("local")}
            className={cn(
              "w-full flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-all cursor-pointer",
              effectiveProvider === "local"
                ? "border-ink bg-sunk shadow-xs"
                : "border-rule bg-sheet hover:border-rule-strong hover:bg-paper",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-ink-muted" />
                <span className="font-medium text-sm text-ink">Local AI</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-mono",
                    isLocalReachable
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isLocalReachable ? "bg-success" : "bg-destructive",
                    )}
                  />
                  {isLocalReachable ? "Online" : "Offline"}
                </span>
              </div>
              {effectiveProvider === "local" && (
                <Check className="size-4 text-ink shrink-0" />
              )}
            </div>

            <div className="text-xs text-ink-muted space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Endpoint:</span>
                <span className="text-ink">
                  {status?.localAi.baseUrl ?? "http://localhost:11434"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-ink font-semibold">{localModel}</span>
              </div>
            </div>

            {!isLocalReachable && (
              <p className="rounded bg-destructive/10 px-2 py-1 text-[0.6875rem] text-destructive leading-tight font-sans">
                Ollama is not responding at {status?.localAi.baseUrl}. Run{" "}
                <code className="font-mono font-semibold">
                  ollama run {localModel}
                </code>{" "}
                to start it.
              </p>
            )}

            {isLocalReachable &&
              status?.localAi.availableModels &&
              status.localAi.availableModels.length > 0 && (
                <p className="text-[0.6875rem] text-ink-faint font-mono">
                  Installed:{" "}
                  {status.localAi.availableModels.slice(0, 3).join(", ")}
                  {status.localAi.availableModels.length > 3 ? "…" : ""}
                </p>
              )}
          </button>

          {/* Gemini API Option */}
          <button
            type="button"
            onClick={() => {
              if (hasGeminiKey) setPreference("gemini");
            }}
            disabled={!hasGeminiKey}
            className={cn(
              "w-full flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-all",
              hasGeminiKey ? "cursor-pointer" : "opacity-60 cursor-not-allowed",
              effectiveProvider === "gemini"
                ? "border-ink bg-sunk shadow-xs"
                : "border-rule bg-sheet hover:border-rule-strong hover:bg-paper",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-ink-muted" />
                <span className="font-medium text-sm text-ink">
                  Google Gemini API
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-mono",
                    hasGeminiKey
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning",
                  )}
                >
                  {hasGeminiKey ? "Key Configured" : "No Key"}
                </span>
              </div>
              {effectiveProvider === "gemini" && (
                <Check className="size-4 text-ink shrink-0" />
              )}
            </div>

            <div className="text-xs text-ink-muted space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-ink">
                  {status?.geminiModel ?? "gemini-3.5-flash-lite"}
                </span>
              </div>
            </div>

            {!hasGeminiKey && (
              <p className="rounded bg-warning/10 px-2 py-1 text-[0.6875rem] text-warning leading-tight font-sans">
                Set{" "}
                <code className="font-mono font-semibold">GEMINI_API_KEY</code>{" "}
                in <code className="font-mono">.env</code> to enable cloud
                generation.
              </p>
            )}
          </button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Done</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
