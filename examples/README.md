# Wiring this skill into your project

The audit scripts are language-agnostic but the *allowlists* are
project-specific. Below is a worked example of the env-var overrides
a typical UK clinical kids' audio app would set in CI.

## Typical Flutter audio app

```yaml
# .github/workflows/aadc-ci.yml
env:
  AADC_PERM_ALLOWLIST_IOS: >-
    NSMicrophoneUsageDescription
    NSBluetoothAlwaysUsageDescription
  AADC_PERM_ALLOWLIST_ANDROID: >-
    android.permission.RECORD_AUDIO
    android.permission.BLUETOOTH
    android.permission.BLUETOOTH_CONNECT
    android.permission.MODIFY_AUDIO_SETTINGS
    android.permission.FOREGROUND_SERVICE
    android.permission.FOREGROUND_SERVICE_MICROPHONE
    android.permission.INTERNET
  AADC_SDK_ALLOWLIST_FLUTTER: >-
    flutter cupertino_icons go_router just_audio audio_session
    audio_service video_player drift drift_flutter path_provider
    shared_preferences characters http cryptography crypto
    url_launcher google_fonts sentry_flutter
    in_app_review webview_flutter
    flutter_lints flutter_launcher_icons flutter_native_splash
    flutter_test
  AADC_PROTECTED_PATHS: >-
    apps/mobile/lib/features/microphone
    apps/mobile/lib/services/microphone_service.dart
```

Tune the lists to match what your project actually needs and adds
no more.

## Typical web kids app

```yaml
env:
  AADC_SDK_ALLOWLIST_NPM: >-
    react react-dom react-router next typescript tslib
    @testing-library/react vitest
```

## Typical Python backend serving a kids product

```yaml
env:
  AADC_SDK_ALLOWLIST_PYTHON: >-
    fastapi pydantic uvicorn httpx
```

## Rules of thumb for choosing an allowlist

1. **Start from the smallest possible set.** Anything you can't
   immediately justify in safeguarding terms should not be on the
   list.
2. **No analytics, no ads, no behavioural tracking SDKs ever.** The
   hard-block list in `audit-sdks.sh` catches the common ones; the
   allowlist is the second layer for everything else.
3. **Document each addition.** When you add a new package to the
   allowlist, add a one-line note in your project's conformance
   statement saying why it's safe for children.
