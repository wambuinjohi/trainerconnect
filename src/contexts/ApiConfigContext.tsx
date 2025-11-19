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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' }),
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
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
      console.warn('API connection test failed:', errorMessage);
      setConnectionError(errorMessage);
      return false;
    }
  };

  // Don't automatically test connection on mount to avoid blocking the app
  // Users can test connection manually when needed via the UI
  // The login/signup flow will verify the API is working

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
