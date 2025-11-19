import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define user types
interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  userType: 'client' | 'trainer' | 'admin' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userType: string, profile?: Record<string, any>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'client' | 'trainer' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('app-user');
    const storedType = localStorage.getItem('app-user-type');
    const storedToken = localStorage.getItem('auth_token');
    if (storedUser && storedType && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setUserType(storedType as 'client' | 'trainer' | 'admin');
      } catch {
        localStorage.removeItem('app-user');
        localStorage.removeItem('app-user-type');
        localStorage.removeItem('auth_token');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const maxRetries = 3;
    const retryDelay = 1000;
    const apiUrl = '/api.php';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', email, password }),
          credentials: 'include',
        });

        const contentType = response.headers.get('content-type');
        const isHtml = contentType?.includes('text/html');

        if (isHtml) {
          const errorText = await response.text();
          console.error(`Login attempt ${attempt}: Server returned HTML instead of JSON`);
          console.error('Response:', errorText.substring(0, 500));
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error('Server error: API returned invalid response. Please try again or contact support.');
        }

        const result = await response.json();
        if (result.status === 'error') {
          throw new Error(result.message || 'Login failed');
        }

        const userData = result.data;
        const sessionData = userData?.session || userData;
        const user_id = userData?.user?.id || userData?.session?.user?.id;
        const access_token = userData?.session?.access_token || sessionData?.access_token;

        if (!user_id || !access_token) {
          throw new Error('Invalid response from server');
        }

        const user = { id: user_id, email };
        setUser(user);

        const userProfile = userData?.profile;
        const type = userProfile?.user_type || 'client';
        setUserType(type as 'client' | 'trainer' | 'admin');

        localStorage.setItem('app-user', JSON.stringify(user));
        localStorage.setItem('app-user-type', type);
        localStorage.setItem('auth_token', access_token);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          localStorage.removeItem('app-user');
          localStorage.removeItem('app-user-type');
          localStorage.removeItem('auth_token');
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  };

  const signUp = async (email: string, password: string, userTypeParam: string, profile?: Record<string, any>) => {
    const maxRetries = 3;
    const retryDelay = 1000;
    const apiUrl = 'https://trainer.skatryk.co.ke/api.php';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const payload: any = {
          action: 'signup',
          email,
          password,
          user_type: userTypeParam,
          ...profile,
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });

        const contentType = response.headers.get('content-type');
        const isHtml = contentType?.includes('text/html');

        if (isHtml) {
          const errorText = await response.text();
          console.error(`Signup attempt ${attempt}: Server returned HTML instead of JSON`);
          console.error('Response:', errorText.substring(0, 500));
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error('Server error: API returned invalid response. Please try again or contact support.');
        }

        const result = await response.json();
        if (result.status === 'error') {
          throw new Error(result.message || 'Signup failed');
        }

        const userData = result.data;
        const sessionData = userData?.session || userData;
        const user_id = userData?.user?.id;
        const access_token = userData?.session?.access_token || sessionData?.access_token;

        if (!user_id || !access_token) {
          throw new Error('Invalid response from server');
        }

        const user = { id: user_id, email };
        setUser(user);
        setUserType(userTypeParam as 'client' | 'trainer' | 'admin');

        localStorage.setItem('app-user', JSON.stringify(user));
        localStorage.setItem('app-user-type', userTypeParam);
        localStorage.setItem('auth_token', access_token);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          localStorage.removeItem('app-user');
          localStorage.removeItem('app-user-type');
          localStorage.removeItem('auth_token');
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  };

  const signOut = async () => {
    setUser(null);
    setUserType(null);
    localStorage.removeItem('app-user');
    localStorage.removeItem('app-user-type');
    localStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider value={{ user, userType, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
