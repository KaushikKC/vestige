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
