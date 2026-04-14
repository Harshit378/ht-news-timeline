'use client';

import { NewsProvider } from '@/app/contexts/NewsContext';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import Chatbot from './components/Chatbot';
import { ReactNode } from 'react';

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NewsProvider>
        {children}
        <Chatbot />
      </NewsProvider>
    </ThemeProvider>
  );
}
