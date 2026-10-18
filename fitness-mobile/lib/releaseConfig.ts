import Constants from 'expo-constants';
import { readReleaseConfig } from '../config/release.cjs';
export const releaseConfig = readReleaseConfig(Constants.expoConfig?.extra?.release);
