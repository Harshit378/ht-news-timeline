'use client';

import axios, { type AxiosRequestConfig } from 'axios';

const apiKey = process.env.NEXT_PUBLIC_NEWSORG_API_KEY;
const apiUrl = process.env.NEXT_PUBLIC_NEWSORG_API_URL || 'https://newsapi.org/v2';

export const newsOrgClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'X-Api-Key': apiKey ?? '',
  },
});

newsOrgClient.interceptors.request.use((config: any) => {
  const headers = config.headers ?? {};

  if (apiKey) {
    (headers as Record<string, string>)['X-Api-Key'] = apiKey;
  }

  config.headers = headers;
  return config;
});
