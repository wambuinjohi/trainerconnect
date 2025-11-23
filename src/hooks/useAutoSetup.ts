import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';

export function useAutoSetup() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    const checkAndSetup = async () => {
      // Check if setup was already done in this browser session
      const setupFlag = localStorage.getItem('db_setup_complete');
      if (setupFlag === 'true') {
        setIsSetupComplete(true);
        return;
      }

      // Check if database is already set up by trying to fetch users
      try {
        const checkResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_users' }),
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        // Check if response is OK and has content
        if (!checkResponse.ok) {
          throw new Error(`Server error: ${checkResponse.status} ${checkResponse.statusText}`);
        }

        const clonedCheckResponse = checkResponse.clone();
        const responseText = await clonedCheckResponse.text();
        if (!responseText) {
          throw new Error('Server returned empty response');
        }

        const checkResult = JSON.parse(responseText);

        // If we can fetch users and there are some, setup is done
        if (checkResult.status === 'success' && checkResult.data?.length > 0) {
          localStorage.setItem('db_setup_complete', 'true');
          setIsSetupComplete(true);
          return;
        }
      } catch (error: any) {
        // If it's a network error, skip auto-setup and allow app to load
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.warn('API not reachable, skipping auto-setup. App will load in limited mode.');
          setIsSetupComplete(true); // Allow app to load
          return;
        }
        console.log('Database not set up yet, will run auto-setup', error);
      }

      // Database needs setup - run migration and seeding
      setIsSettingUp(true);

      try {
        // Step 1: Run migration (may succeed even if tables exist)
        const migrateResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'migrate' }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        const clonedMigrateResponse = migrateResponse.clone();
        const migrateText = await clonedMigrateResponse.text();
        let migrateResult;

        try {
          migrateResult = JSON.parse(migrateText);
        } catch (e) {
          console.error('Migration response parse error:', migrateText);
          throw new Error('Invalid server response during migration. Check server PHP errors.');
        }

        // Log migration result but continue even if it partially fails
        console.log('Migration result:', migrateResult);

        // Step 2: Run seeding (most important step)
        const seedResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed_all_users' }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        const seedText = await seedResponse.text();
        let seedResult;

        try {
          seedResult = JSON.parse(seedText);
        } catch (e) {
          console.error('Seeding response parse error:', seedText);
          throw new Error('Invalid server response during seeding. Check server PHP errors.');
        }

        if (seedResult.status !== 'success') {
          throw new Error(seedResult.message || 'Failed to create test users');
        }

        // Mark setup as complete
        localStorage.setItem('db_setup_complete', 'true');
        setIsSetupComplete(true);
        console.log('✓ Database setup completed automatically');
      } catch (error: any) {
        // If it's a network error, allow app to load anyway
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.warn('API not reachable, allowing app to load without setup.');
          setIsSetupComplete(true); // Allow app to load
          setIsSettingUp(false);
          return;
        }

        console.error('Auto-setup failed:', error);
        const errorMsg = error.message || 'Setup failed';
        setSetupError(errorMsg);
        setIsSetupComplete(false);
      } finally {
        setIsSettingUp(false);
      }
    };

    checkAndSetup();
  }, []);

  return { isSetupComplete, isSettingUp, setupError };
}
