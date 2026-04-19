/**
 * Safe Local Storage Utilities
 * Handles localStorage errors gracefully for private mode, quota exceeded, etc.
 */

type StorageResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Safely get item from localStorage
 */
export function safeGetItem<T = string>(key: string): StorageResult<T> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window not defined' };
    }

    const item = localStorage.getItem(key);
    if (item === null) {
      return { success: false, error: 'Item not found' };
    }

    try {
      const parsed = JSON.parse(item) as T;
      return { success: true, data: parsed };
    } catch {
      // Return as string if JSON parse fails
      return { success: true, data: item as T };
    }
  } catch (error) {
    // Private mode, quota exceeded, or other error
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Safely set item in localStorage
 */
export function safeSetItem<T>(key: string, value: T): StorageResult<void> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window not defined' };
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('circular')) {
        return { success: false, error: 'Cannot store circular references' };
      }
      return { success: false, error: `Serialization failed: ${msg}` };
    }
    localStorage.setItem(key, serialized);
    return { success: true };
  } catch (error) {
    // Quota exceeded or other error
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Safely remove item from localStorage
 */
export function safeRemoveItem(key: string): StorageResult<void> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window not defined' };
    }

    localStorage.removeItem(key);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get item with fallback
 */
export function getItemWithFallback<T>(key: string, fallback: T): T {
  const result = safeGetItem<T>(key);
  return result.success ? (result.data ?? fallback) : fallback;
}

/**
 * Safely read a cookie value by name.
 * Uses string splitting instead of RegExp to avoid regex injection
 * when cookie names contain special characters.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const encodedName = encodeURIComponent(name);
  const pairs = document.cookie.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.trim().indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.trim().substring(0, eqIndex);
    const value = pair.trim().substring(eqIndex + 1);
    if (key === encodedName || key === name) {
      return decodeURIComponent(value || '');
    }
  }
  return null;
}
