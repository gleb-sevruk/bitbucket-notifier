import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from '@tauri-apps/plugin-notification';

// Notification store
export const useNotificationStore = defineStore('notifications', () => {
  const showNotifications = ref(true);
  const dockBadgeEnabled = ref(true);
  const soundEnabled = ref(true);
  const notificationHistoryEnabled = ref(true);
  const notificationHistory = ref<{message: string, timestamp: Date}[]>([]);

  // Add notification to history
  function addNotification(message: string) {
    // Add to history if enabled
    if (notificationHistoryEnabled.value) {
      notificationHistory.value.push({
        message,
        timestamp: new Date()
      });
    }

    // Send system notification if enabled
    if (showNotifications.value) {
      sendNotification({ 
        title: 'Bitbucket Notifier',
        body: message
      });
    }
  }

  // Clear notification history
  function clearHistory() {
    notificationHistory.value = [];
  }

  // Update dock badge with count
  async function updateDockBadge(count: number) {
    if (dockBadgeEnabled.value) {
      try {
        await invoke("update_dock_badge_safe", { count });
        console.log(`Updated dock badge: ${count}`);
      } catch (error) {
        console.error('Failed to update dock badge:', error);
      }
    }
  }

  // Play notification sound
  function playSound() {
    if (soundEnabled.value) {
      try {
        // Simple HTML5 audio API to play a notification sound
        const audio = new Audio('/notification.mp3'); // You'll need to add this sound file
        audio.play().catch(e => console.log('Error playing sound', e));
      } catch (error) {
        console.error('Failed to play notification sound:', error);
      }
    }
  }

  // Save notification settings to localStorage
  function saveSettings() {
    try {
      const settings = {
        showNotifications: showNotifications.value,
        dockBadgeEnabled: dockBadgeEnabled.value,
        soundEnabled: soundEnabled.value,
        notificationHistoryEnabled: notificationHistoryEnabled.value
      };
      localStorage.setItem('notification-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  // Load notification settings from localStorage
  function loadSettings() {
    try {
      const savedSettings = localStorage.getItem('notification-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        showNotifications.value = settings.showNotifications ?? true;
        dockBadgeEnabled.value = settings.dockBadgeEnabled ?? true;
        soundEnabled.value = settings.soundEnabled ?? true;
        notificationHistoryEnabled.value = settings.notificationHistoryEnabled ?? true;
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  return {
    showNotifications,
    dockBadgeEnabled,
    soundEnabled,
    notificationHistoryEnabled,
    notificationHistory,
    addNotification,
    clearHistory,
    updateDockBadge,
    playSound,
    saveSettings,
    loadSettings
  };
});