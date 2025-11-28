import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  shadow?: boolean;
  border?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  shadow = true,
  border = true,
  className = '',
}) => {
  const paddingStyles = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const shadowStyle = shadow ? 'shadow-md' : '';
  const borderStyle = border ? 'border border-slate-100' : '';

  return (
    <div className={`bg-white rounded-2xl ${paddingStyles[padding]} ${shadowStyle} ${borderStyle} ${className}`}>
      {children}
    </div>
  );
};

export default Card;