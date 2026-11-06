"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * What the floating copilot knows about the screen, and how a screen talks
 * to it.
 *
 * A screen that shows one tender — the dossier panel, Redactare or
 * Strategie opened for a source_id — registers it here, and the copilot
 * sends it with every question, so "Ce riscuri are acest dosar?" needs no
 * copy-pasting. Registrations stack: a dossier opened on top of Strategie
 * wins while it is open and hands back to Strategie's tender when it
 * closes.
 *
 * Right-hand drawers (the dossier, a document preview, an authority or a
 * grant panel, the mobile menu) register here too, so the copilot can step
 * to the left instead of sitting on their text and buttons.
 */
export interface ActiveTender {
  source_id: string;
  title?: string | null;
}

interface CopilotContextValue {
  activeTender: ActiveTender | null;
  registerTender: (tender: ActiveTender) => () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the copilot, optionally with a question already sent. */
  ask: (prompt?: string) => void;
  /** Read once by the widget. */
  pendingPrompt: string | null;
  takePendingPrompt: () => string | null;
  /** True while any right-hand drawer is open. */
  rightDrawerOpen: boolean;
  registerRightDrawer: () => () => void;
}

const CopilotContext = createContext<CopilotContextValue>({
  activeTender: null,
  registerTender: () => () => {},
  open: false,
  setOpen: () => {},
  ask: () => {},
  pendingPrompt: null,
  takePendingPrompt: () => null,
  rightDrawerOpen: false,
  registerRightDrawer: () => () => {},
});

/** Fired after the copilot changes the pipeline, so an open Pipeline page
 *  reloads instead of showing the old stage. */
export const PIPELINE_CHANGED_EVENT = "ro-intel:pipeline-changed";

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const stack = useRef<{ id: number; tender: ActiveTender }[]>([]);
  const nextId = useRef(1);
  const [activeTender, setActiveTender] = useState<ActiveTender | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [rightDrawers, setRightDrawers] = useState(0);

  const registerTender = useCallback((tender: ActiveTender) => {
    const id = nextId.current++;
    stack.current.push({ id, tender });
    setActiveTender(tender);
    return () => {
      stack.current = stack.current.filter((entry) => entry.id !== id);
      setActiveTender(stack.current[stack.current.length - 1]?.tender ?? null);
    };
  }, []);

  const registerRightDrawer = useCallback(() => {
    setRightDrawers((n) => n + 1);
    return () => setRightDrawers((n) => Math.max(0, n - 1));
  }, []);

  const ask = useCallback((prompt?: string) => {
    if (prompt) setPendingPrompt(prompt);
    setOpen(true);
  }, []);

  const takePendingPrompt = useCallback(() => {
    const prompt = pendingPrompt;
    setPendingPrompt(null);
    return prompt;
  }, [pendingPrompt]);

  const value = useMemo(
    () => ({
      activeTender,
      registerTender,
      open,
      setOpen,
      ask,
      pendingPrompt,
      takePendingPrompt,
      rightDrawerOpen: rightDrawers > 0,
      registerRightDrawer,
    }),
    [activeTender, registerTender, open, ask, pendingPrompt, takePendingPrompt, rightDrawers, registerRightDrawer]
  );
  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot() {
  return useContext(CopilotContext);
}

/** Declares the tender this component shows, for as long as it is mounted. */
export function useActiveTender(sourceId: string | null | undefined, title?: string | null) {
  const { registerTender } = useCopilot();
  useEffect(() => {
    if (!sourceId) return;
    return registerTender({ source_id: sourceId, title });
  }, [sourceId, title, registerTender]);
}

/** Declares a right-hand drawer as open for as long as it is mounted. */
export function useRightDrawer(active = true) {
  const { registerRightDrawer } = useCopilot();
  useEffect(() => {
    if (!active) return;
    return registerRightDrawer();
  }, [active, registerRightDrawer]);
}

/** For JSX that opens conditionally without a component of its own. */
export function RightDrawerMarker() {
  useRightDrawer();
  return null;
}
