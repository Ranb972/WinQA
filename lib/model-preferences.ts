// Model preferences storage (localStorage)
// Model preferences don't need encryption - they're not sensitive

const STORAGE_KEY = 'winqa_model_preferences';

export interface ModelPreferences {
  [provider: string]: string; // provider -> modelId
}

/**
 * Get all model preferences from localStorage
 */
export function getModelPreferences(): ModelPreferences {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }
    return JSON.parse(stored) as ModelPreferences;
  } catch {
    return {};
  }
}

/**
 * Set a model preference for a specific provider
 */
export function setModelPreference(provider: string, modelId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = getModelPreferences();
    current[provider] = modelId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Get the model preference for a specific provider
 */
export function getModelPreference(provider: string): string | undefined {
  const preferences = getModelPreferences();
  return preferences[provider];
}

/**
 * Remove a model preference for a specific provider
 */
export function removeModelPreference(provider: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = getModelPreferences();
    delete current[provider];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Clear all model preferences
 */
export function clearModelPreferences(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail if localStorage is not available
  }
}
