import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Persists form state to localStorage as a draft.
 * On mount, restores draft if available. On state change, saves to localStorage (debounced).
 * Call `clearDraft()` after a successful save to remove the local copy.
 *
 * @param key - Unique key for this draft (e.g. "verification" or "product-<id>")
 * @param tenantId - Tenant ID for scoping
 * @param serverState - The state loaded from the server (used as default if no draft exists)
 * @param isReady - Whether the server state has finished loading
 */
export function useLocalDraft<T extends Record<string, any>>(
  key: string,
  tenantId: string | null,
  serverState: T,
  isReady: boolean
): {
  draft: T;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  clearDraft: () => void;
  hasDraft: boolean;
  discardDraft: () => void;
} {
  const storageKey = tenantId ? `draft:${tenantId}:${key}` : null;

  const [draft, setDraft] = useState<T>(serverState);
  const [hasDraft, setHasDraft] = useState(false);
  const initialized = useRef(false);

  // On server state ready, check if there's a saved draft
  useEffect(() => {
    if (!isReady || !storageKey || initialized.current) return;
    initialized.current = true;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        setDraft(parsed);
        setHasDraft(true);
      } else {
        setDraft(serverState);
      }
    } catch {
      setDraft(serverState);
    }
  }, [isReady, storageKey]);

  // When server state changes and we haven't initialized yet, update draft
  useEffect(() => {
    if (!initialized.current && isReady) {
      // Already handled above
      return;
    }
  }, [serverState, isReady]);

  // Debounced save to localStorage on draft changes
  useEffect(() => {
    if (!storageKey || !initialized.current) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setHasDraft(true);
      } catch {
        // localStorage full or unavailable
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [draft, storageKey]);

  const clearDraft = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setHasDraft(false);
  }, [storageKey]);

  const discardDraft = useCallback(() => {
    clearDraft();
    setDraft(serverState);
  }, [clearDraft, serverState]);

  return { draft, setDraft, clearDraft, hasDraft, discardDraft };
}
