// src/infrastructure/config/env.helpers.ts
// Shared environment variable parsing helpers for config factories

export const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const getRequiredEnv = (key: string): string => {
  const value = getOptionalEnv(key);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

export const parseStrictInteger = (raw: string): number => {
  const normalized = raw.trim();
  if (!/^-?\d+$/.test(normalized)) {
    return Number.NaN;
  }
  return Number(normalized);
};

export const getRequiredIntEnv = (key: string): number => {
  const value = getRequiredEnv(key);
  const parsed = parseStrictInteger(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be a valid integer`);
  }
  return parsed;
};

export const getIntEnvWithDefault = (key: string, defaultValue: number): number => {
  const value = getOptionalEnv(key);
  if (!value) {
    return defaultValue;
  }
  const parsed = parseStrictInteger(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be a valid integer`);
  }
  return parsed;
};
