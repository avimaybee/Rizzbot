import React from 'react';

interface ScreenLayoutProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  className = '',
  noPadding = false,
}) => {
  return (
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${className}`}>
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${!noPadding ? 'p-4 sm:p-6' : ''}`}>
        {children}
      </div>
    </div>
  );
};

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({
  children,
  className = '',
  noPadding = false,
}) => {
  return (
    <div className={`h-full flex flex-col min-h-0 relative bg-matte-base ${className}`}>
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${!noPadding ? 'px-4 pb-24 sm:px-6 sm:pb-6' : ''} safe-area-inset-bottom`}>
        {children}
      </div>
    </div>
  );
};

export default ScreenLayout;