import { useState, useEffect } from "react";

export function useSessionState<T>(key: string, initialValue: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void] {
    const [state, setState] = useState<T>(() => {
        try {
            const saved = sessionStorage.getItem(key);
            if (saved) return JSON.parse(saved);
            if (typeof initialValue === "function") return (initialValue as () => T)();
            return initialValue;
        } catch {
            return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(key, JSON.stringify(state));
        } catch {
            // Quota exceeded (large base64 payloads) — drop silently, state still works in memory
        }
    }, [key, state]);

    return [state, setState];
}
