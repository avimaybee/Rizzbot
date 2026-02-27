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

const toastConfig: Record<ToastType, { icon: React.ReactNode; accentColor: string; textColor: string }> = {
  success: {
    icon: <CheckCircle className="w-4 h-4" />,
    accentColor: 'bg-emerald-500',
    textColor: 'text-emerald-400',
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    accentColor: 'bg-red-500',
    textColor: 'text-red-400',
  },
  warning: {
    icon: <AlertCircle className="w-4 h-4" />,
    accentColor: 'bg-amber-500',
    textColor: 'text-amber-400',
  },
  info: {
    icon: <Bell className="w-4 h-4" />,
    accentColor: 'bg-hard-blue',
    textColor: 'text-blue-400',
  },
  copied: {
    icon: <Copy className="w-4 h-4" />,
    accentColor: 'bg-hard-gold',
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

    // Haptic feedback for system notification
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
      className={`fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ease-out ${
        isExiting ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      <div 
        className="glass-dark border-white/5 px-5 py-3.5 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[280px] max-w-[90vw] relative overflow-hidden"
      >
        {/* Leading accent bar */}
        <div className={`absolute top-0 left-0 w-1 h-full ${config.accentColor} opacity-60`}></div>
        
        <span className={config.textColor}>{config.icon}</span>
        
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">System Alert</span>
          <span className="text-white text-xs font-mono uppercase tracking-wide">
            {message}
          </span>
        </div>

        <button 
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className="text-zinc-600 hover:text-white transition-colors p-1"
        >
          <X className="w-3.5 h-3.5" />
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
