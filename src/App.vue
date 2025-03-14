<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useConfigStore, usePRStore, useNotificationStore } from './store';
import { invoke } from "@tauri-apps/api/core";
import 'primeicons/primeicons.css'

// Initialize stores
const configStore = useConfigStore();
const prStore = usePRStore();
const notificationStore = useNotificationStore();

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

// Initialize app on mount
onMounted(async () => {
  // Load configuration
  await configStore.loadConfig();
  
  // Try to load saved PR data
  const loaded = await prStore.loadFromLocalStorage();
  if (!loaded) {
  //   do nothing
  }
  
  // Update the dock badge with the current unread count
  await updateDockBadge(prStore.totalUnreadCount);
  
  // Start periodic sync with Bitbucket (every 5 minutes by default)
  prStore.startPeriodicSync(configStore.pollInterval);
  
  console.log('App initialized');
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
  
  h1, h2, h3, h4, h5, h6 {
    color: #4fa2ee;
  }
}

</style>