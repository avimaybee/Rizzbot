import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X, Copy, Bell } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'copied';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  visible: boolean;
}

const toastConfig: Record<ToastType, { icon: React.ReactNode; color: string }> = {
  success: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-emerald-400',
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-400',
  },
  warning: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'text-amber-400',
  },
  info: {
    icon: <Bell className="w-4 h-4" />,
    color: 'text-blue-400',
  },
  copied: {
    icon: <Copy className="w-4 h-4" />,
    color: 'text-amber-400',
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

    if ('vibrate' in navigator) {
      if (type === 'error') navigator.vibrate([30, 50, 30]);
      else navigator.vibrate(10);
    }

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
  }, [visible, duration, onClose, type]);

  if (!visible) return null;

  return (
    <div 
      className={`fixed bottom-28 md:bottom-12 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ease-out ${
        isExiting ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      <div 
        className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl min-w-[280px] max-w-[90vw]"
      >
        <span className={config.color}>{config.icon}</span>
        
        <div className="flex-1">
          <span className="text-white text-xs font-bold uppercase tracking-tight">
            {message}
          </span>
        </div>

        <button 
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className="text-zinc-600 hover:text-white transition-colors"
        >
          <X size={14} />
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

// Global toast context
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
