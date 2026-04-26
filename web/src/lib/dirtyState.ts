import { useEffect } from "react";

/**
 * Warns the user before they unload the page (browser-level confirm) while
 * `dirty` is true. The in-app router-level confirm is handled by the form
 * component using `window.confirm` on its Cancel/back action, since TanStack
 * Router's blocker API varies by version.
 */
export function useUnsavedChangesPrompt(dirty: boolean, message?: string) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the custom string but require a returnValue.
      e.returnValue = message ?? "";
      return message ?? "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, message]);
}
