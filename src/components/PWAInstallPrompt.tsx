import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Handle the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
      beforeInstallPromptEvent.preventDefault();
      setDeferredPrompt(beforeInstallPromptEvent);
      setShowPrompt(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('PWA installed successfully');
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    const checkIfInstalled = async () => {
      if ('getInstalledRelatedApps' in navigator) {
        const relatedApps = await (navigator as any).getInstalledRelatedApps?.();
        if (relatedApps && relatedApps.length > 0) {
          localStorage.setItem('pwa_installed', 'true');
        }
      }
    };
    checkIfInstalled();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  // Don't show if already dismissed or if running in Capacitor app
  if (
    dismissed ||
    !isMobile ||
    !showPrompt ||
    localStorage.getItem('pwa_install_dismissed') === 'true' ||
    localStorage.getItem('pwa_installed') === 'true' ||
    (window as any).Capacitor !== undefined
  ) {
    return null;
  }

  // Only show if we have a deferred prompt or if on mobile without native app
  if (!deferredPrompt && !isMobile) {
    return null;
  }

  return (
    <Alert className="fixed bottom-4 left-4 right-4 md:max-w-sm md:left-auto md:bottom-4 z-50 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-lg">
      <Download className="h-4 w-4" />
      <AlertDescription className="ml-2 flex flex-col gap-3">
        <div>
          <p className="font-semibold text-foreground">Install App</p>
          <p className="text-sm text-muted-foreground mt-1">
            Install Skatryk Trainer on your device for faster access and offline support.
          </p>
        </div>
        <div className="flex gap-2">
          {deferredPrompt ? (
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="flex-1"
            >
              Install
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // For iOS, show manual instructions
                alert(
                  'To install on iOS:\n\n' +
                  '1. Tap the Share button\n' +
                  '2. Tap "Add to Home Screen"\n' +
                  '3. Tap "Add"\n\n' +
                  'For Android:\n\n' +
                  '1. Tap the menu (⋮)\n' +
                  '2. Tap "Install app"'
                );
              }}
              className="flex-1"
            >
              How to Install
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
