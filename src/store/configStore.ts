import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ConfigStore } from './storage';

// Pinia store for app configuration
export const useConfigStore = defineStore('config', () => {
  const username = ref('');
  const apiKey = ref('');
  const baseUrl = ref('');
  const pollInterval = ref(300); // Default 5 minutes in seconds
  const trackedRepositories = ref<string[]>([]);
  const configLoaded = ref(false);

  // Load configuration from Tauri store
  async function loadConfig() {
    const store = new ConfigStore();
    username.value = await store.getUsername();
    apiKey.value = await store.getApiKey();
    baseUrl.value = await store.getUrl();
    configLoaded.value = true;
  }

  // Save configuration to Tauri store
  async function saveConfig() {
    const store = new ConfigStore();
    await store.saveUsername(username.value);
    await store.saveApiKey(apiKey.value);
    await store.saveUrl(baseUrl.value);
  }

  // Check if configuration is valid
  const isConfigValid = computed(() => {
    return !!username.value && !!apiKey.value && !!baseUrl.value;
  });

  return {
    username,
    apiKey,
    baseUrl,
    pollInterval,
    trackedRepositories,
    configLoaded,
    loadConfig,
    saveConfig,
    isConfigValid
  };
});