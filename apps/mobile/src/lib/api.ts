import axios from 'axios';
import { Platform } from 'react-native';
import { createNewsApi } from '@ht/shared/news-api';

/**
 * The Expo app's instance of the shared API client (libs/shared). EXPO_PUBLIC_API_URL wins; otherwise the
 * dev API on this machine: the Android emulator reaches the host as 10.0.2.2.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api');

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });

export const newsApi = createNewsApi(api);
