// Metro for the Expo app (ADR-001 Path B). libs/shared lives outside this project, so Metro must watch it.
// Its one dependency (axios) resolves by walking up from libs/shared to the repo root's node_modules; this
// app's node_modules is added as a fallback search path.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.resolve(repoRoot, 'libs/shared')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(repoRoot, 'node_modules')];

// expo-sqlite's web build ships a WebAssembly file (web target only; harmless for native bundles).
config.resolver.assetExts.push('wasm');

module.exports = config;
