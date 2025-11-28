import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  icon,
  disabled = false,
  fullWidth = false,
  className = '',
}) => {
  const baseStyles = 'font-bold rounded-xl transition-all flex items-center justify-center gap-2';

  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
  };

  const sizeStyles = {
    sm: 'py-3 px-4 text-base',
    md: 'py-4 px-6 text-lg',
    lg: 'py-6 px-8 text-2xl',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${disabledStyles} ${className}`}
    >
      {children}
      {icon && icon}
    </button>
  );
};

export default Button;