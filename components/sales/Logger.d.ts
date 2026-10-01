import React from 'react';

export interface LoggerProps {
  user: { id: string; email: string };
  repName: string;
  onLogout: () => void;
  isActive?: boolean;
  mode?: string;
  onModeChange?: ((newMode: string) => void) | null;
  initialSalesMode?: string;
  hideHeader?: boolean;
}

declare const Logger: React.FC<LoggerProps>;
export default Logger;
