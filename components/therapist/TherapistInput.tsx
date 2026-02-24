import React, { useState, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface TherapistInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const TherapistInput: React.FC<TherapistInputProps> = ({
  onSend,
  disabled = false,
  placeholder = "Share what's on your mind..."
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="border-t border-zinc-800 bg-zinc-900/80 p-3 sm:p-4"
    >
      <div className="flex items-end gap-2 sm:gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="
              w-full bg-zinc-800/50 border border-zinc-700 
              rounded-lg px-4 py-3 
              text-white text-sm placeholder:text-zinc-500
              focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20
              transition-colors resize-none
              min-h-[48px] max-h-[150px]
            "
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="
            flex items-center justify-center
            w-12 h-12 sm:w-14 sm:h-14
            rounded-lg 
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            bg-rose-600 hover:bg-rose-500 active:bg-rose-700
            text-white
          "
        >
          {disabled ? (
            <Sparkles className="w-5 h-5 animate-pulse" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
      
      {/* Hint text */}
      <div className="text-[10px] font-mono text-zinc-600 mt-2 text-center">
        Press Enter to send • Shift+Enter for new line
      </div>
    </form>
  );
};

export default TherapistInput;
