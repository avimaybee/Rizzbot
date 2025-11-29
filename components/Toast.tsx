import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X, Copy } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'copied';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  visible: boolean;
}

const toastConfig: Record<ToastType, { icon: React.ReactNode; bgColor: string; borderColor: string; textColor: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    bgColor: 'bg-emerald-950/90',
    borderColor: 'border-emerald-500/50',
    textColor: 'text-emerald-400',
  },
  error: {
    icon: <XCircle className="w-5 h-5" />,
    bgColor: 'bg-red-950/90',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-400',
  },
  warning: {
    icon: <AlertCircle className="w-5 h-5" />,
    bgColor: 'bg-amber-950/90',
    borderColor: 'border-amber-500/50',
    textColor: 'text-amber-400',
  },
  info: {
    icon: <AlertCircle className="w-5 h-5" />,
    bgColor: 'bg-blue-950/90',
    borderColor: 'border-blue-500/50',
    textColor: 'text-blue-400',
  },
  copied: {
    icon: <Copy className="w-5 h-5" />,
    bgColor: 'bg-zinc-900/95',
    borderColor: 'border-hard-gold/50',
    textColor: 'text-hard-gold',
  },
};

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'info', 
  duration = 3000, 
  onClose,
  visible 
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const config = toastConfig[type];

  useEffect(() => {
    if (!visible) return;

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    const closeTimer = setTimeout(() => {
      onClose();
      setIsExiting(false);
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div 
      className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div 
        className={`${config.bgColor} ${config.borderColor} border backdrop-blur-md px-4 py-3 flex items-center gap-3 shadow-2xl min-w-[200px] max-w-[90vw]`}
      >
        <span className={config.textColor}>{config.icon}</span>
        <span className={`${config.textColor} text-sm font-mono uppercase tracking-wider flex-1`}>
          {message}
        </span>
        <button 
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className={`${config.textColor} hover:opacity-70 transition-opacity p-1`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Hook for easy toast management
interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  return { toast, showToast, hideToast };
};

// Global toast context for app-wide access
import { createContext, useContext } from 'react';

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useGlobalToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useGlobalToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast, showToast, hideToast } = useToast();

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast 
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
};
