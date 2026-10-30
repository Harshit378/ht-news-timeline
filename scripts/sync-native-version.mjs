#!/usr/bin/env node
// Copies the web app's version into the native projects (ADR-001 Path A), so store builds match package.json.
//   node scripts/sync-native-version.mjs            # versionCode/build number derived from the version
//   BUILD_NUMBER=42 node scripts/sync-native-version.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** "1.2.3" → 1002003: increases with every release as long as minor/patch stay below 1000. */
export function buildNumberFor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) throw new Error(`version "${version}" is not semver (x.y.z)`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 999 || patch > 999) throw new Error(`version "${version}": minor and patch must be < 1000`);
  const code = major * 1_000_000 + minor * 1_000 + patch;
  return Math.max(1, code);
}

export function applyAndroid(gradle, version, build) {
  return gradle
    .replace(/versionCode\s+\d+/, `versionCode ${build}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
}

export function applyIos(pbxproj, version, build) {
  return pbxproj
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const web = join(root, 'apps/web');
  const { version } = JSON.parse(readFileSync(join(web, 'package.json'), 'utf8'));
  const build = process.env.BUILD_NUMBER ? Number(process.env.BUILD_NUMBER) : buildNumberFor(version);
  if (!Number.isInteger(build) || build < 1) throw new Error(`BUILD_NUMBER must be a positive integer`);

  const gradlePath = join(web, 'android/app/build.gradle');
  writeFileSync(gradlePath, applyAndroid(readFileSync(gradlePath, 'utf8'), version, build));
  const pbxPath = join(web, 'ios/App/App.xcodeproj/project.pbxproj');
  writeFileSync(pbxPath, applyIos(readFileSync(pbxPath, 'utf8'), version, build));
  console.log(`native version ${version} (${build})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
