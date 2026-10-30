import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts } from '@/theme';

const SUGGESTIONS = ['Russia Ukraine war', 'Gaza war', 'World Series', 'India elections', 'Artificial intelligence'];

/** Search any story and open its timeline from the first report to now. */
export default function SearchScreen() {
  const [q, setQ] = useState('');
  const open = (query: string) => {
    const trimmed = query.trim();
    if (trimmed) router.push({ pathname: '/story', params: { q: trimmed } });
  };

  return (
    <View style={styles.screen}>
      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => open(q)}
        placeholder="Search a story, person or place"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel="Search stories"
      />
      <Text style={styles.kicker}>TRY</Text>
      {SUGGESTIONS.map((s) => (
        <Pressable key={s} onPress={() => open(s)} style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.6 }]}>
          <Text style={styles.suggestionText}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.ink,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  kicker: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.gold, marginTop: 24, marginBottom: 8 },
  suggestion: { minHeight: 44, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionText: { color: colors.ink, fontSize: 15 },
});
