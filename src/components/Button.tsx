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
    primary: 'bg-[#5d8df4] hover:bg-[#4c7ce4] text-white shadow-lg active:scale-95',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
    outline: 'border-2 border-[#5d8df4] text-[#5d8df4] hover:bg-[#eef3ff]',
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
