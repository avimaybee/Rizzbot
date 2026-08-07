import { useState, useEffect } from "react";

// Keys must be namespaced per user so switching accounts on the same device
// never leaks drafts/screenshots/chats between users.
export function useSessionState<T>(key: string, initialValue: T | (() => T), uid?: string | null): [T, (val: T | ((prev: T) => T)) => void] {
    const storageKey = uid ? `${key}_${uid}` : key;
    const [state, setState] = useState<T>(() => {
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
            if (typeof initialValue === "function") return (initialValue as () => T)();
            return initialValue;
        } catch {
            return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(state));
        } catch {
            // Quota exceeded (large base64 payloads) — drop silently, state still works in memory
        }
    }, [storageKey, state]);

    return [state, setState];
}

/** Remove all per-user session state (used on sign-out to avoid cross-account leaks). */
export function clearUserSessionState(uid: string): void {
    try {
        const prefix = `_${uid}`;
        const keys: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.endsWith(prefix)) keys.push(k);
        }
        keys.forEach((k) => sessionStorage.removeItem(k));
    } catch {
        // ignore
    }
}
