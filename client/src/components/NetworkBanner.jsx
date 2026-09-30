import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3">
        <WifiOff className="w-4 h-4 text-red-400" />
        <span className="text-sm font-medium text-slate-200 tracking-tight">
          No internet connection. Waiting for network...
        </span>
      </div>
    </div>
  );
}
