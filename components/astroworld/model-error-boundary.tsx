"use client";

/**
 * The game's safety net for downloads. Wrap anything that loads a model or
 * texture: if the file fails to download or parse, `fallback` is shown (a
 * code-built stand-in, or nothing) instead of the whole page failing with
 * "This page couldn't load". Suspense still works through it while loading.
 */
import { Component, type ReactNode } from "react";

/** Shows `fallback` instead of crashing the game when a model fails to download or parse. */
export class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode; what?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn(`[astroworld] ${this.props.what ?? "character model"} failed to load, using the stand-in`, err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
