import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { X, Check, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Haptic feedback for toast
    if (navigator.vibrate) {
      navigator.vibrate(type === "error" ? [50, 50, 50] : 10);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ id, message, type, onDismiss }: Toast & { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icons = {
    success: <Check size={18} className="text-[#C8522A]" />,
    error: <AlertCircle size={18} className="text-[#C8522A]" />,
    info: <Info size={18} className="text-[#C8522A]" />,
  };

  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2"
      style={{
        backgroundColor: "#FDFAF5",
        border: "1px solid #E8E0D4",
        color: "#1A1208",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#F5E8E0] flex items-center justify-center">
        {icons[type]}
      </div>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button onClick={onDismiss} className="shrink-0 text-[#1A1208]/40 hover:text-[#1A1208]">
        <X size={16} />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
