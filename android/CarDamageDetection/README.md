# Car Damage Detection

React Native (Expo Managed Workflow, TypeScript) Android application for inspecting vehicle photos and video streams for damage.

This project uses the **Expo Managed Workflow** so that it can be previewed live on a physical Android device via the **Expo Go** sandbox app without requiring a local Android SDK or Gradle build toolchain.

## Features

- **Dashboard**: Primary "Inspect Vehicle" action, empty state for first-time users, and a recent-inspections list with media type indicators.
- **Live CarScan Camera (`react-native-vision-camera`)**:
  - **Full-Screen Viewfinder**: 30 FPS live stream directly on Android device.
  - **Semi-Transparent Silhouette Guide**: Vector SVG vehicle profile overlay with framing brackets and crosshairs to help align the car before capture.
  - **Circular Shutter Button**: Fixed bottom-center camera shutter with responsive press feedback.
  - **Three UI States**:
    - `idle`: Live 30 FPS camera feed, active alignment guide, and circular shutter button.
    - `scanning`: Processing state with ActivityIndicator stabilization feedback.
    - `captured`: Freeze frame display with "Retake" (reverts to live feed) and "Analyse Damage" actions.
- **Multi-Modal Inspection**:
  - **Live CarScan Guide**: Full-screen camera viewfinder with real-time alignment guide.
  - **Record Live Video**: Capture a live video stream of vehicle damage (up to 60s, MP4/MOV) with camera permission handling.
  - **Choose Video from Gallery**: Select pre-recorded vehicle videos from media library.
  - **Take Photo with Camera**: Instant live photo capture.
  - **Choose Photo from Gallery**: Select high-resolution photos (JPEG, PNG).
- **Video & Photo Preview**:
  - Full video playback via `expo-video` with loop and interactive play/pause controls.
  - Metadata display: dimensions, duration (mm:ss), and media type badges.
  - Image preview with aspect-ratio containment.
- **Detection Progress**: Honest lifecycle state machine ("uploading" / "processing"), cancel action, and retry path — no fabricated progress percentage.
- **Detection Results**: Bounding-box overlays with exact coordinate-scaling math across letterboxed/contained aspect ratios, damage classes + confidence scores, save-to-history, and dashboard navigation.
- **History**: Local persistence via `@react-native-async-storage/async-storage` (metadata + URI references only; never raw bytes), individual delete with confirmation, media type badges (`PHOTO` vs `VIDEO`), and duration display.
- **Settings**: Persistent backend URL configuration, "Test Connection" (`/health`), confidence threshold setting, clear history, and privacy policy note.

## Technology Stack

- **Framework**: Expo SDK 58 (React Native 0.88, React 19), TypeScript
- **Navigation**: React Navigation 7 (native-stack + bottom-tabs)
- **Image & Video Capture**: `expo-image-picker` (media library + live camera)
- **Video Playback**: `expo-video` (`VideoView`, `useVideoPlayer`)
- **Storage**: `@react-native-async-storage/async-storage`
- **Testing**: Jest + `jest-expo` + `@testing-library/react-native` + `react-test-renderer`
- **Linting**: ESLint + `eslint-config-expo`

## Project Structure

```
src/
  app/            App.tsx, navigation/, providers/
  components/     Shared presentational components (AppButton, AppHeader, ImagePreview, VideoPreview, etc.)
  features/
    dashboard/    DashboardScreen
    inspection/   Media selection -> preview -> progress -> results flow, detectionService,
                  detection.types.ts, inspectionSession.ts
    history/      HistoryScreen
    settings/     SettingsScreen
  services/
    api/          apiClient.ts (fetch wrapper), apiConfig.ts (endpoints, base URL)
    storage/      historyStorage.ts (AsyncStorage-backed)
  config/         appConfig.ts, damageClasses.ts, theme.ts
  hooks/          useDetection.ts (explicit lifecycle state machine)
  utils/          imageUtils.ts, formatters.ts, validation.ts
  types/          common.types.ts
```

## Running the App with Expo Go

### Prerequisites

1. Install the **Expo Go** app from the Google Play Store on your Android physical phone.
2. Ensure your computer and phone are connected to the same Wi-Fi network (or use `--tunnel` if on separate subnets).

### Start Metro Bundler

From this directory (`android/CarDamageDetection`):

```bash
npx expo start
```

This will launch the Metro bundler and display a QR code in the terminal.

### Open on Device

1. Open the **Expo Go** app on your Android phone.
2. Tap **Scan QR code** and point your camera at the QR code displayed in your terminal.
3. The bundle will build and load on your phone.

### Physical Device Network Configuration

When running against a development backend:
- Do **not** use `localhost` or `127.0.0.1` as the Backend URL in the app's Settings screen — on a physical device, `localhost` points to the phone itself.
- Instead, use your computer's local network IP (e.g. `http://192.168.1.50:8000`).

## Standalone APK Build (EAS)

This project is linked to the EAS project `@vedant_more/car-damage-detection`
(id: `13be9899-fd9f-4525-bb65-ad8e711c303a`, set in `app.json`'s `extra.eas.projectId`).
`eas.json` defines two profiles:

- **`preview`** — builds an installable `.apk` (internal distribution), for sharing a
  debug/test build directly without going through the Play Store.
- **`production`** — builds an `.aab` (Android App Bundle) for a real Play Store release.

### Prerequisites

1. `npx eas-cli login` (needs an Expo account with access to this project).
2. No local Android SDK/Gradle/keystore setup needed — EAS Build runs entirely in the
   cloud and auto-generates/stores the signing keystore for you on first build.

### Build the preview APK

```bash
npx eas-cli build --platform android --profile preview
```

This uploads the project, builds in the cloud, and prints a link to the build page
(`https://expo.dev/accounts/vedant_more/projects/car-damage-detection/builds/...`) where
you can watch progress and download the finished `.apk` once it finishes. You can also
list recent builds and grab the latest download URL with:

```bash
npx eas-cli build:list --platform android --limit 1
```

### Install on a physical device

Download the `.apk` from the build page (or the printed artifact URL) onto the phone and
open it; Android will prompt to allow installs from this source the first time. This is a
debug/internal build, not a Play Store install, so verify on-device: app launch, the
Settings screen (configure the backend URL + API key — see "Physical Device Network
Configuration" above), and a full inspection flow (capture → detect → results → claim).
There is currently no login/auth screen in the app, so "login" isn't part of this flow.

### App icon, splash screen, and permissions

- App icon / Android adaptive icon / splash screen are generated from
  `assets/branding/logo.svg` (also the source for `assets/icon.png`,
  `assets/android-icon-foreground.png`, `assets/android-icon-background.png`,
  `assets/android-icon-monochrome.png`, and `assets/splash-icon.png`). Regenerate with
  `rsvg-convert` (or any SVG rasterizer) if the logo changes.
- `app.json`'s `android.permissions` explicitly declares `CAMERA` and `INTERNET` (video/
  photo capture and reaching the detection backend); `expo-image-picker`/`expo-camera`
  also inject their own required permissions automatically via their config plugins.

### Local native build (alternative, no EAS account needed)

```bash
npx expo prebuild
```

This generates the native `android/` and `ios/` projects, which can then be built with
`./gradlew assembleRelease` using a standard local Android SDK / Gradle setup.

## Running Tests and Lint

```bash
# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Test suite (all 46 tests across 10 suites)
npm test
```
