<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue';
import { useConfigStore, usePRStore, useNotificationStore } from './store';
import { invoke } from "@tauri-apps/api/core";
import 'primeicons/primeicons.css'

// Initialize stores
const configStore = useConfigStore();
const prStore = usePRStore();
const notificationStore = useNotificationStore();

// For updating the "seconds ago" counter
const secondsInterval = ref<number | null>(null);
const secondsSinceSync = ref(0);

// Watch for changes in unread counts to update dock badge
watch(() => prStore.totalUnreadCount, async (newCount) => {
  if (notificationStore.dockBadgeEnabled) {
    await updateDockBadge(newCount);
  }
});

// Update dock badge count
async function updateDockBadge(count: number) {
  try {
    await invoke("update_dock_badge_safe", { count });
    console.log(`Updated dock badge: ${count}`);
  } catch (error) {
    console.error('Failed to update dock badge:', error);
  }
}

// Start seconds counter
function startSecondsCounter() {
  // Clear existing interval if any
  if (secondsInterval.value !== null) {
    clearInterval(secondsInterval.value);
  }
  
  // Update seconds counter every second
  secondsInterval.value = setInterval(() => {
    if (prStore.lastSyncTime) {
      secondsSinceSync.value = Math.round((new Date().getTime() - prStore.lastSyncTime.getTime()) / 1000);
    }
  }, 1000) as unknown as number;
}

// Watch for changes in lastSyncTime
watch(() => prStore.lastSyncTime, () => {
  if (prStore.lastSyncTime) {
    secondsSinceSync.value = 0;
  }
}, { immediate: true });

// Initialize app on mount
onMounted(async () => {
  // Load configuration
  await configStore.loadConfig();
  
  // Try to load saved PR data
  const loaded = await prStore.loadFromLocalStorage();
  if (loaded && prStore.lastSyncTime) {
    secondsSinceSync.value = Math.round((new Date().getTime() - prStore.lastSyncTime.getTime()) / 1000);
  }
  
  // Update the dock badge with the current unread count
  await updateDockBadge(prStore.totalUnreadCount);
  
  // Start periodic sync with Bitbucket (every 5 minutes by default)
  prStore.startPeriodicSync(configStore.pollInterval);
  
  // Start the seconds counter
  startSecondsCounter();
  
  console.log('App initialized');
});

// Clean up on unmount
onUnmounted(() => {
  if (secondsInterval.value !== null) {
    clearInterval(secondsInterval.value);
  }
});

</script>

<template>
  <nav class="navbar">
    <div class="container">
      <h2 class="logo">Bitbucket Notifier</h2>
      <div class="nav-links">
        <RouterLink to="/" class="nav-link">Home</RouterLink>
        <RouterLink to="/test-notifications" class="nav-link">Notifications</RouterLink>
        <RouterLink to="/settings" class="nav-link">Settings</RouterLink>
      </div>
    </div>
  </nav>

  <div class="sync-status-bar">
    <div class="container">
      <div class="sync-status">
        <div class="sync-info">
          <span v-if="prStore.isLoading" class="sync-status-loading">
            <i class="pi pi-spin pi-spinner"></i> Syncing with Bitbucket...
          </span>
          <span v-else-if="prStore.lastSyncTime" class="sync-status-success">
            <i class="pi pi-check-circle"></i> 
            Last sync: {{ prStore.lastSyncTime.toLocaleTimeString() }} 
            ({{ secondsSinceSync }}s ago)
          </span>
          <span v-else class="sync-status-pending">
            <i class="pi pi-clock"></i> Waiting for initial sync...
          </span>
        </div>
        <div class="sync-count" v-if="prStore.totalUnreadCount > 0">
          <span class="unread-badge">{{ prStore.totalUnreadCount }} unread</span>
        </div>
      </div>
    </div>
  </div>

  <main class="main-content">
    <RouterView />
  </main>
</template>

<style scoped>
.navbar {
  background-color: #205081;
  color: white;
  padding: 0.5rem 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 0;
  transition: all 0.2s ease;
  position: relative;
}

.nav-link:hover {
  opacity: 0.9;
}

.nav-link:after {
  content: '';
  position: absolute;
  width: 0;
  height: 2px;
  bottom: 0;
  left: 0;
  background-color: white;
  transition: width 0.3s ease;
}

.nav-link:hover:after,
.router-link-active:after {
  width: 100%;
}

.sync-status-bar {
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  padding: 0.5rem 0;
  font-size: 0.85rem;
}

.sync-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sync-info {
  display: flex;
  align-items: center;
}

.sync-status-loading {
  color: #3498db;
}

.sync-status-success {
  color: #2ecc71;
}

.sync-status-pending {
  color: #95a5a6;
}

.sync-count {
  display: flex;
  align-items: center;
}

.unread-badge {
  background-color: #e74c3c;
  color: white;
  border-radius: 12px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: bold;
}

.main-content {
  padding: 1rem;
}
</style>
<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-weight: 400;
  color: #0f0f0f;
  background-color: #f6f6f6;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 0;
  color: #205081;
}

.card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin-bottom: 1rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  a:hover {
    color: #24c8db;
  }

  input,
  button {
    color: #ffffff;
    background-color: #0f0f0f98;
  }
  
  button:active {
    background-color: #0f0f0f69;
  }
  
  .card {
    background-color: #333;
  }
  
  .sync-status-bar {
    background-color: #222;
    border-bottom: 1px solid #444;
  }
  
  h1, h2, h3, h4, h5, h6 {
    color: #4fa2ee;
  }
}

</style>