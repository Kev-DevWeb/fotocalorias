"use client";

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsoleLog {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export default function MobileConsole() {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar en desarrollo y en dispositivos móviles
    const isDev = process.env.NODE_ENV === 'development';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsVisible(isDev && isMobile);

    if (!isDev) return;

    const addLog = (type: ConsoleLog['type'], ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev.slice(-50), {
        type,
        message,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };

    // Interceptar console.log
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', ...args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', ...args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', ...args);
    };

    console.info = (...args) => {
      originalInfo(...args);
      addLog('info', ...args);
    };

    // Capturar errores no manejados
    const handleError = (event: ErrorEvent) => {
      addLog('error', `${event.message} at ${event.filename}:${event.lineno}`);
    };

    window.addEventListener('error', handleError);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-black text-green-400 font-mono text-xs">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 bg-gray-900 border-t border-gray-700 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-bold">🔍 Console ({logs.length})</span>
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setLogs([]); }}
            className="px-2 py-1 bg-red-600 text-white rounded text-xs"
          >
            Clear
          </button>
          {isExpanded ? <ChevronDown /> : <ChevronUp />}
        </div>
      </div>

      {/* Logs */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto bg-black p-2 space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, i) => (
              <div 
                key={i} 
                className={`text-xs leading-tight ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warn' ? 'text-yellow-400' :
                  log.type === 'info' ? 'text-blue-400' :
                  'text-green-400'
                }`}
              >
                <span className="text-gray-600">[{log.timestamp}]</span>{' '}
                <span className="font-bold">{log.type.toUpperCase()}:</span>{' '}
                <pre className="inline whitespace-pre-wrap break-all">{log.message}</pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
