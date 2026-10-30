import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BookmarksProvider } from '@/lib/bookmarks';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <BookmarksProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="story" options={{ title: 'Story' }} />
        <Stack.Screen name="article/[id]" options={{ title: '' }} />
      </Stack>
    </BookmarksProvider>
  );
}
