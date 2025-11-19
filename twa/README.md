Trusted Web Activity (TWA) setup for Skatryk Trainer

This folder contains a Bubblewrap configuration and instructions to generate an Android TWA that wraps the PWA hosted at https://trainer.skatryk.co.ke.

1) Install Bubblewrap

   npm install -g @bubblewrap/cli

2) Initialize a TWA project (non-interactive command shown; you can run interactively too):

   npx @bubblewrap/cli init --manifest https://trainer.skatryk.co.ke/manifest.webmanifest --applicationId co.skatryk.trainer --name "Skatryk Trainer" --shortName Skatryk --launcherName Skatryk

   This creates an Android project in the current directory (twa/ by default) with settings aligned to the PWA manifest.

3) Generate a signing key (if you don't have one):

   keytool -genkeypair -v -keystore release-keystore.jks -alias twa-key -keyalg RSA -keysize 2048 -validity 10000

4) Obtain the app signing certificate fingerprint (SHA-256) and add it to the Digital Asset Links file. Example command (replace path/alias values as needed):

   keytool -list -v -keystore release-keystore.jks -alias twa-key -storepass <your-keystore-password> | grep -A1 "Certificate fingerprints" -A 2

   Or generate the SHA256 fingerprint directly:

   keytool -exportcert -alias twa-key -keystore release-keystore.jks -storepass <your-keystore-password> -rfc | openssl x509 -inform PEM -pubkey | openssl rsa -pubin -outform DER 2>/dev/null | openssl dgst -sha256 -binary | openssl enc -base64

5) Host your assetlinks.json at https://trainer.skatryk.co.ke/.well-known/assetlinks.json

Example assetlinks.json structure (replace the fingerprint with your app's SHA256):

[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.skatryk.trainer",
      "sha256_cert_fingerprints": ["REPLACE_WITH_YOUR_SHA256_FINGERPRINT"]
    }
  }
]

6) Build the TWA:

   npx @bubblewrap/cli build

7) Open the generated Android project in Android Studio if you need to build or sign with Play App Signing. You can also use Gradle commands to assemble APK/AAB.

Notes and tips:
- Ensure your PWA is served over HTTPS and that the manifest and service worker are accessible.
- Verify the assetlinks.json is reachable at https://trainer.skatryk.co.ke/.well-known/assetlinks.json and returns the correct JSON content.
- If you prefer a CI pipeline, you can add commands to build and sign the app non-interactively and upload to Play Console.

Reference commands used in package.json scripts:
- npm run twa:init
- npm run twa:build
- npm run twa:build:release

