import React, { ReactNode } from 'react';

// --- Types ---
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
}

// --- Components ---

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  contentClassName = '',
  onClick,
  hoverEffect = false
}) => {
  const hoverClasses = hoverEffect
    ? "transition-transform duration-300 hover:-translate-y-[2px]"
    : "";

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden
        bg-white/[0.04] 
        border border-white/[0.08] 
        shadow-[0_4px_20px_0_rgba(0,0,0,0.3)] 
        rounded-[24px] 
        p-4 sm:p-6
        text-glass-text
        ${hoverClasses}
        ${className}
      `}
    >
      <div className={`relative z-10 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  isLoading,
  ...props
}) => {
  const baseStyles = "relative px-6 py-3 rounded-[18px] font-medium text-sm tracking-wide transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";

  const variants = {
    primary: "bg-accent-primary/80 hover:bg-accent-primary text-white border border-white/10",
    secondary: "bg-accent-secondary/80 hover:bg-accent-secondary text-white border border-white/10",
    danger: "bg-accent-danger/80 hover:bg-accent-danger text-white border border-white/10",
    ghost: "bg-transparent hover:bg-white/5 text-glass-text border border-transparent hover:border-white/10",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      <span className={`flex items-center justify-center gap-2 ${isLoading ? 'opacity-0' : ''}`}>
        {children}
      </span>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      )}
    </button>
  );
};

export const Input: React.FC<InputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-glass-muted ml-1">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-glass-muted">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full bg-black/20 
            border-b-2 border-white/10 
            text-glass-text placeholder-glass-muted 
            py-3 px-4 ${icon ? 'pl-11' : ''}
            rounded-t-xl
            focus:outline-none focus:border-accent-primary focus:bg-white/[0.02]
            transition-colors duration-200
          `}
          {...props}
        />
      </div>
    </div>
  );
};

export const Avatar: React.FC<{ src?: string, name: string, size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ src, name, size = 'md' }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  return (
    <div className={`relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-accent-primary to-accent-secondary border border-white/10 ${sizes[size]}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-white tracking-widest">{name.substring(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
};