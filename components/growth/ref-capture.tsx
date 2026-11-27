"use client";

import { useEffect } from "react";
import { rememberRefCode } from "@/lib/referral";

/**
 * Remembers who referred this visitor (lib/referral.ts). With `code`, uses
 * that; without, reads ?ref= from the URL - mounted once in the root layout
 * so any page can be a referral landing page.
 */
export function RefCapture({ code }: { code?: string }) {
  useEffect(() => {
    rememberRefCode(code ?? new URLSearchParams(window.location.search).get("ref"));
  }, [code]);
  return null;
}
