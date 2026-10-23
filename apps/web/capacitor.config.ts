import type { CapacitorConfig } from '@capacitor/cli';

// TODO(release): confirm the final bundle id before the first store upload — it can't change afterwards.
const config: CapacitorConfig = {
  appId: 'com.htimeline.app',
  appName: 'News Timeline',
  webDir: 'out',
  backgroundColor: '#0a0a0b',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // hidden by NativeInitializer once React has mounted
      backgroundColor: '#0a0a0b',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0b',
      overlaysWebView: false,
    },
  },
};

export default config;
