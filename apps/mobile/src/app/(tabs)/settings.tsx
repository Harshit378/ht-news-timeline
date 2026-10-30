import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { REGIONS } from '@ht/shared/region';
import { API_BASE_URL, newsApi } from '@/lib/api';
import { kv } from '@/lib/storage';
import { colors, fonts } from '@/theme';

const REGION_KEY = 'ht_timeline_region_v1';
const THEME_KEY = 'ht_timeline_theme_v1';

const REGION_OPTIONS = [
  { id: 'auto', label: 'Automatic (Device Locale)' },
  ...REGIONS.map((r) => ({ id: r.code as string, label: r.label })),
  { id: 'off', label: 'No Preference' },
];

const THEME_OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
];

export default function SettingsScreen() {
  const [regionSetting, setRegionSetting] = useState(
    () => kv.getItem(REGION_KEY) || 'auto',
  );
  const [themeSetting, setThemeSetting] = useState(
    () => kv.getItem(THEME_KEY) || 'dark',
  );

  const handleSelectRegion = (id: string) => {
    setRegionSetting(id);
    kv.setItem(REGION_KEY, id);
  };

  const handleSelectTheme = (id: string) => {
    setThemeSetting(id);
    kv.setItem(THEME_KEY, id);
  };

  const handleUpgrade = async (tier: 'PRO' | 'TEAM') => {
    try {
      const session = await newsApi.createCheckoutSession(tier);
      if (session.url) {
        await WebBrowser.openBrowserAsync(session.url);
      }
    } catch {
      Alert.alert(
        'Subscription',
        `News Timeline ${tier} plan: $${tier === 'TEAM' ? '29' : '9'}/month. Check server connectivity or configure Stripe.`,
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Subscription Tier */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SUBSCRIPTION & PLAN</Text>
        <View style={styles.card}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>Free Reader</Text>
              <Text style={styles.planDesc}>Chronological timelines with sponsored cards</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>CURRENT</Text>
            </View>
          </View>
          <View style={styles.upgradeRow}>
            <TouchableOpacity
              onPress={() => void handleUpgrade('PRO')}
              style={[styles.upgradeBtn, styles.proBtn]}
            >
              <Text style={styles.proTitle}>Upgrade to Pro</Text>
              <Text style={styles.btnPrice}>$9 / mo</Text>
              <Text style={styles.btnDesc}>Ad-free · Cloud sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void handleUpgrade('TEAM')}
              style={[styles.upgradeBtn, styles.teamBtn]}
            >
              <Text style={styles.teamTitle}>Newsroom Team</Text>
              <Text style={styles.btnPrice}>$29 / mo</Text>
              <Text style={styles.btnDesc}>Live alerts · Team seats</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Region Boost */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>REGION</Text>
        <Text style={styles.helpText}>
          News from your region ranks higher in the feed (~40% share). Nothing is hidden.
        </Text>
        <View style={styles.card}>
          {REGION_OPTIONS.map((opt, i) => {
            const active = regionSetting === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => handleSelectRegion(opt.id)}
                style={[styles.optionRow, i > 0 && styles.borderTop]}
              >
                <Text style={[styles.optionLabel, active && styles.activeLabel]}>
                  {opt.label}
                </Text>
                {active && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Theme */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={styles.card}>
          {THEME_OPTIONS.map((opt, i) => {
            const active = themeSetting === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => handleSelectTheme(opt.id)}
                style={[styles.optionRow, i > 0 && styles.borderTop]}
              >
                <Text style={[styles.optionLabel, active && styles.activeLabel]}>
                  {opt.label}
                </Text>
                {active && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Diagnostics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT & SERVER</Text>
        <View style={styles.card}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>App</Text>
            <Text style={styles.diagValue}>News Timeline (Path B)</Text>
          </View>
          <View style={[styles.diagRow, styles.borderTop]}>
            <Text style={styles.diagLabel}>Runtime</Text>
            <Text style={styles.diagValue}>Expo SDK 58 / React Native</Text>
          </View>
          <View style={[styles.diagRow, styles.borderTop]}>
            <Text style={styles.diagLabel}>API Endpoint</Text>
            <Text style={[styles.diagValue, styles.mono]} numberOfLines={1}>
              {API_BASE_URL}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.gold,
    marginBottom: 8,
  },
  helpText: { fontSize: 13, color: colors.muted, marginBottom: 8, lineHeight: 18 },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  planName: { fontFamily: fonts.serif, fontSize: 17, fontWeight: '700', color: colors.ink },
  planDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badgeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  upgradeRow: { flexDirection: 'row', gap: 10, padding: 12, paddingTop: 0 },
  upgradeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  proBtn: { borderColor: colors.accent, backgroundColor: 'rgba(232, 58, 46, 0.08)' },
  teamBtn: { borderColor: colors.gold, backgroundColor: 'rgba(201, 168, 76, 0.08)' },
  proTitle: { fontFamily: fonts.serif, fontSize: 13, fontWeight: '700', color: colors.accent },
  teamTitle: { fontFamily: fonts.serif, fontSize: 13, fontWeight: '700', color: colors.gold },
  btnPrice: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 2 },
  btnDesc: { fontSize: 9, color: colors.muted, marginTop: 4, textAlign: 'center' },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  borderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  optionLabel: { fontSize: 14, color: colors.ink },
  activeLabel: { color: colors.accent, fontWeight: '600' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  diagLabel: { fontSize: 13, color: colors.muted },
  diagValue: { fontSize: 13, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: 11 },
});
