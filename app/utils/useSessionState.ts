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
        sessionStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);

    return [state, setState];
}
