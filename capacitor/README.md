Capacitor wrapper for Skatryk Trainer

This project uses Vite for the web app. Capacitor will wrap the built web app (dist) into native Android/iOS projects.

Quick start:

1) Install Capacitor CLI locally (or globally):

   npm install --save @capacitor/core
   npm install --save-dev @capacitor/cli

2) Build the web app (production):

   npm run build

3) Initialize Capacitor (creates capacitor.config.json and native projects):

   npm run cap:init

4) Add the Android platform:

   npm run cap:add:android

5) Copy web assets and sync plugins:

   npm run cap:copy
   npm run cap:sync

6) Open Android Studio:

   npm run cap:open:android

## Building Android APK

To generate a release APK with geolocation support:

### Step 1: Sync Capacitor with Android

```bash
npx cap sync android
```

This synchronizes the Capacitor configuration with the Android project and ensures all plugins (including geolocation) are properly installed.

### Step 2: Build the web assets

```bash
npm run build
```

This creates the production web bundle in the `dist` folder.

### Step 3: Copy and sync

```bash
npm run cap:copy android
npx cap sync android
```

These commands copy the web assets to the Android project and synchronize any plugin changes.

### Step 4: Open Android Studio and build APK

```bash
npx cap open android
```

This opens the Android project in Android Studio. From there, you can:

- **For debug APK**: Build > Make Project (Ctrl+F9 / Cmd+F9)
- **For release APK**: Build > Generate Signed Bundle / APK (requires signing configuration)

The APK will be available in `android/app/build/outputs/apk/`.

**Note**: When building for release, you'll need to configure signing credentials. See [Android Documentation](https://developer.android.com/studio/publish/app-signing) for details.

Notes:
- For development (fast refresh) you can set capacitor.config.json server.url to your local dev server (e.g. http://10.0.2.2:5173) and enable live reload. Example configuration step:

  npx cap open android
  # In Android Studio, edit MainActivity to allow cleartext or use a secure tunnel to your dev server

- For production builds, ensure the web app is reachable locally during the build step and assets are generated into dist.
- To build an Android AAB/APK, open the generated Android project in Android Studio and use the usual build/signing flow.
