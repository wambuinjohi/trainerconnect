import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiConfigContextType {
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
  testConnection: () => Promise<boolean>;
}

const ApiConfigContext = createContext<ApiConfigContextType | undefined>(undefined);

const DEFAULT_API_URL = 'https://trainer.skatryk.co.ke/api.php';

export const ApiConfigProvider = ({ children }: { children: ReactNode }) => {
  const [apiUrl, setApiUrlState] = useState<string>(DEFAULT_API_URL);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Load API URL from localStorage on mount
  useEffect(() => {
    const storedUrl = localStorage.getItem('api_url');
    if (storedUrl) {
      setApiUrlState(storedUrl);
    }
    setInitialized(true);
  }, []);

  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    localStorage.setItem('api_url', url);
  };

  const testConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' }),
        credentials: 'include',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        setIsConnected(true);
        setConnectionError(null);
        return true;
      } else {
        setIsConnected(false);
        setConnectionError(`Server returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      setIsConnected(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to API';
      setConnectionError(errorMessage);
      return false;
    }
  };

  // Test connection on mount
  useEffect(() => {
    if (initialized) {
      testConnection();
    }
  }, [initialized]);

  return (
    <ApiConfigContext.Provider
      value={{
        apiUrl,
        setApiUrl,
        isConnected,
        setIsConnected,
        connectionError,
        setConnectionError,
        testConnection,
      }}
    >
      {children}
    </ApiConfigContext.Provider>
  );
};

export const useApiConfig = (): ApiConfigContextType => {
  const context = useContext(ApiConfigContext);
  if (!context) {
    throw new Error('useApiConfig must be used within an ApiConfigProvider');
  }
  return context;
};
