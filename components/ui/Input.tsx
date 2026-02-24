import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full bg-zinc-900 border ${error ? 'border-red-500' : 'border-zinc-700'} 
            px-4 py-2.5 text-white text-sm 
            placeholder:text-zinc-600
            focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20
            transition-colors rounded-md
            ${icon ? 'pl-10' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full bg-zinc-900 border ${error ? 'border-red-500' : 'border-zinc-700'} 
          px-4 py-3 text-white text-sm 
          placeholder:text-zinc-600
          focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20
          transition-colors rounded-md resize-none
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

export default Input;
