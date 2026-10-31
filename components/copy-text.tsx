"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A long value (hash, address) shown in full with a one-click copy. */
export function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be unavailable (e.g. insecure context) - not worth surfacing an error for
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className="hud-tag w-full cursor-pointer justify-between !normal-case !tracking-normal text-left transition-colors hover:!text-foreground"
    >
      <span className="break-all">{value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-good" aria-label="Copied" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
