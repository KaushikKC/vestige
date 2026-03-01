# Vestige Mobile

This project has **expo-dev-client** installed. By default `npx expo start` shows a URL for a **development build** (custom app), not for **Expo Go**. If you're using the Expo Go app on your phone, use the **`--go`** flag so the URL works in Expo Go.

## Running the app

**With Expo Go (recommended for quick testing):**
```bash
npm install
npx expo start --go
```
Or: `npm run start:go`

**With a development build** (after running `npx expo run:ios` or `npx expo run:android` once):
```bash
npx expo start
```

## Connecting your phone (Expo Go)

**Important:** Because this project has expo-dev-client, you must run with **`--go`** when using Expo Go. Otherwise the URL is for a development build and tapping the server in Expo Go won't open the app. Use `npx expo start --go` or `npm run start:go`.

### Option 1: Tunnel (recommended if “Development server” won’t connect)

If Expo Go **shows** your development server but tapping it fails or shows troubleshooting (same account, same Wi‑Fi), your network or firewall is likely blocking the connection. Use **tunnel mode** so the phone connects over the internet instead of LAN:

```bash
npx expo start --tunnel
```

Or:

```bash
npm run start:tunnel
```

Wait until the terminal shows **“Tunnel ready”** and a new URL/QR code. Then in **Expo Go**:

- The **“Development servers”** list should update and show your project again — **tap it** to connect, or  
- If your Expo Go has **“Enter URL manually”** (e.g. on the home screen or under Development servers), paste the **`exp://…`** URL shown in the terminal.

Reloads are slower over tunnel, but the connection is reliable.

### Option 2: QR code (when Expo Go has a scanner)

The QR code from `expo start` uses the `exp://` protocol. **Do not scan it with your phone’s Camera app** — you’ll get “No usable data found”. Scan **from inside Expo Go** if your version has a “Scan QR code” option (home screen or Development servers). Not all Expo Go versions show this; if you don’t see it, use Option 1 (tunnel) and tap the development server or enter the URL manually.

### Checklist when it still doesn’t connect

- Logged into the **same Expo account** on your computer (`npx expo login`) and in Expo Go (Profile).
- **Tunnel**: run `npx expo start --tunnel` and connect after “Tunnel ready”.
- **Latest tools**: `npx expo install --check` and update Expo Go from the store if needed.

## Android native build (NDK)

If `npx expo run:android` fails with **"NDK did not have a source.properties file"**, the NDK version expected by Expo was not fully installed (e.g. only the installer stub is present). This project is set to use **NDK 26.1.10909125**. Install it in Android Studio:

1. **Settings → Appearance & Behavior → System Settings → Android SDK → SDK Tools**
2. Check **Show Package Details**
3. Under **NDK (Side by side)**, select **26.1.10909125** and apply.

Then run `npx expo run:android` again.

## Android build: JVM / JDK

If you see **"Inconsistent JVM Target"** (Java 17 vs Kotlin 23) or **"A restricted method in java.lang.System has been called"** during CMake tasks, the project is already configured to fix this (Kotlin forced to JVM 17, and JVM `--add-opens` flags for newer JDKs). After changing `gradle.properties`, stop old daemons and rebuild:

```bash
cd android && ./gradlew --stop && cd ..
npx expo run:android
```

If it still fails, build with **JDK 17** (recommended for React Native): install JDK 17, then run with `JAVA_HOME` set to it, e.g. `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` (macOS) before `npx expo run:android`.

## Android build: std::format / graphicsConversions (C++)

**Root cause:** React Native 0.81.5's `graphicsConversions.h` uses `std::format` (C++20), but NDK 26's libc++ conflicts with Folly's own `format` in scope. The header is packaged inside the pre-built AAR (`react-android-0.81.5-debug.aar`) and is extracted by Gradle into a transform cache — **the version in `node_modules` is not used by the compiler at all**.

**This has already been patched** in two places:
1. Inside the AAR itself: `~/.gradle/caches/modules-2/files-2.1/com.facebook.react/react-android/0.81.5/.../react-android-0.81.5-debug.aar`
2. In the active Gradle transform cache: `~/.gradle/caches/8.14.3/transforms/52fba397ee69a489802542663b2a7886/...`

The change replaces `return std::format("{}%", dimension.value);` with `return folly::dynamic(std::to_string(dimension.value) + "%");` on line 80.

**If this error comes back** (e.g. after Gradle deletes and re-extracts its transform cache), re-patch the two files above, then clear the native build cache:

```bash
# Re-patch the transform cache copy
sed -i '' 's/return std::format("{}%", dimension.value);/return folly::dynamic(std::to_string(dimension.value) + "%");/' \
  ~/.gradle/caches/8.14.3/transforms/52fba397ee69a489802542663b2a7886/transformed/react-android-0.81.5-debug/prefab/modules/reactnative/include/react/renderer/core/graphicsConversions.h

# Re-patch inside the AAR (do this once — survives transform cache clears)
# (Requires unzip/zip — see the git history for the full commands)

# Clear native build cache
rm -rf android/app/.cxx

# Rebuild
npx expo run:android
```
