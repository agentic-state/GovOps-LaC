/**
 * Stub identity for the human-authority surface (govops-007).
 * v1: reads from `localStorage["govops-user"]`, defaulting to "maintainer".
 * NOT a security boundary — the backend is the source of truth on every action.
 */
import { StorageKeys } from "./storageKeys";
const STORAGE_KEY = StorageKeys.currentUser;
const DEFAULT_USER = "maintainer";

export function getCurrentUser(): string {
  if (typeof window === "undefined") return DEFAULT_USER;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

export function setCurrentUser(user: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, user);
  } catch {
    /* ignore quota / disabled storage */
  }
}
