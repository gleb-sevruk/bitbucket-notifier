import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ConfigStore } from './storage'

// Types for PR store
export interface Comment {
  id: string;
  content: string;
  author: string;
  createdOn: string;
  updatedOn: string;
  isRead: boolean;
}

export interface PullRequest {
  id: string;
  title: string;
  author: string;
  repository: string;
  createdOn: string;
  updatedOn: string;
  status: string;
  comments: Comment[];
  unreadCount: number;
}

export interface Repository {
  slug: string;
  name: string;
  pullRequests: PullRequest[];
  unreadCount: number;
}

// Pinia store for app configuration
export const useConfigStore = defineStore('config', () => {
  const username = ref('')
  const apiKey = ref('')
  const baseUrl = ref('')
  const pollInterval = ref(300) // Default 5 minutes in seconds
  const trackedRepositories = ref<string[]>([])
  const configLoaded = ref(false)

  // Load configuration from Tauri store
  async function loadConfig() {
    const store = new ConfigStore()
    username.value = await store.getUsername()
    apiKey.value = await store.getApiKey()
    baseUrl.value = await store.getUrl()
    configLoaded.value = true
  }

  // Save configuration to Tauri store
  async function saveConfig() {
    const store = new ConfigStore()
    await store.saveUsername(username.value)
    await store.saveApiKey(apiKey.value)
    await store.saveUrl(baseUrl.value)
  }

  // Check if configuration is valid
  const isConfigValid = computed(() => {
    return !!username.value && !!apiKey.value && !!baseUrl.value
  })

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
  }
})

// Pinia store for PR data
export const usePRStore = defineStore('pullRequests', () => {
  const repositories = ref<Repository[]>([])
  const isLoading = ref(false)
  const lastSyncTime = ref<Date | null>(null)
  const syncInterval = ref<number | null>(null)
  const needsDockBadgeUpdate = ref(false)

  // Global unread count for badge
  const totalUnreadCount = computed(() => {
    return repositories.value.reduce((total, repo) => total + repo.unreadCount, 0)
  })

  // Get repository by slug
  function getRepository(repoSlug: string) {
    return repositories.value.find(repo => repo.slug === repoSlug)
  }

  // Get pull request by id and repository
  function getPullRequest(repoSlug: string, prId: string) {
    const repo = getRepository(repoSlug)
    if (!repo) return null
    return repo.pullRequests.find(pr => pr.id === prId)
  }

  // Add or update repository
  function updateRepository(repository: Repository) {
    const index = repositories.value.findIndex(r => r.slug === repository.slug)
    if (index >= 0) {
      repositories.value[index] = repository
    } else {
      repositories.value.push(repository)
    }
    recalculateUnreadCounts()
  }

  // Add or update pull request
  function updatePullRequest(repoSlug: string, pullRequest: PullRequest) {
    const repo = getRepository(repoSlug)
    if (!repo) return

    const index = repo.pullRequests.findIndex(pr => pr.id === pullRequest.id)
    if (index >= 0) {
      repo.pullRequests[index] = pullRequest
    } else {
      repo.pullRequests.push(pullRequest)
    }
    recalculateUnreadCounts()
  }

  // Mark comment as read
  function markCommentAsRead(repoSlug: string, prId: string, commentId: string) {
    const pr = getPullRequest(repoSlug, prId)
    if (!pr) return

    const comment = pr.comments.find(c => c.id === commentId)
    if (comment) {
      comment.isRead = true
      recalculateUnreadCounts()
      needsDockBadgeUpdate.value = true
    }
  }

  // Mark all comments in a PR as read
  function markAllCommentsAsRead(repoSlug: string, prId: string) {
    const pr = getPullRequest(repoSlug, prId)
    if (!pr) return

    pr.comments.forEach(comment => {
      comment.isRead = true
    })
    recalculateUnreadCounts()
    needsDockBadgeUpdate.value = true
  }

  // Recalculate unread counts at all levels
  function recalculateUnreadCounts() {
    // Calculate PR level unread counts
    for (const repo of repositories.value) {
      for (const pr of repo.pullRequests) {
        pr.unreadCount = pr.comments.filter(c => !c.isRead).length
      }

      // Calculate repository level unread counts
      repo.unreadCount = repo.pullRequests.reduce((total, pr) => total + pr.unreadCount, 0)
    }
    
    // Save to local storage after recalculation
    saveToLocalStorage();
  }
  
  // Save data to local storage or Tauri store
  async function saveToLocalStorage() {
    try {
      // Convert date to string for storage
      const dataToSave = {
        repositories: repositories.value,
        lastSyncTime: lastSyncTime.value ? lastSyncTime.value.toISOString() : null
      };
      
      localStorage.setItem('bitbucket-pr-data', JSON.stringify(dataToSave));
      console.log('PR data saved to storage');
    } catch (error) {
      console.error('Error saving PR data:', error);
    }
  }
  
  // Load data from local storage or Tauri store
  async function loadFromLocalStorage() {
    try {
      const savedData = localStorage.getItem('bitbucket-pr-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        repositories.value = parsedData.repositories;
        lastSyncTime.value = parsedData.lastSyncTime ? new Date(parsedData.lastSyncTime) : null;
        console.log('PR data loaded from storage');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading PR data:', error);
      return false;
    }
  }

  // Start periodic sync with Bitbucket
  function startPeriodicSync(intervalSeconds = 300) {
    // Clear any existing interval
    if (syncInterval.value) {
      clearInterval(syncInterval.value);
    }
    
    // Set up new interval
    syncInterval.value = setInterval(async () => {
      await syncWithBitbucket();
    }, intervalSeconds * 1000) as unknown as number;
    
    console.log(`Periodic sync started with interval of ${intervalSeconds} seconds`);
  }
  
  // Stop periodic sync
  function stopPeriodicSync() {
    if (syncInterval.value) {
      clearInterval(syncInterval.value);
      syncInterval.value = null;
      console.log('Periodic sync stopped');
    }
  }

  // Sync with Bitbucket API
  async function syncWithBitbucket() {
    // In a real implementation, this would fetch data from Bitbucket API
    // For now, we're just updating the last sync time
    isLoading.value = true;
    
    try {
      // In the real implementation, we would:
      // 1. Fetch open PRs for tracked repositories
      // 2. Fetch comments for each PR
      // 3. Compare with local state to identify new/updated comments
      // 4. Mark new comments as unread
      // 5. Update repositories and recalculate counts
      
      // For the mock implementation, let's just add a random new comment occasionally
      const shouldAddComment = Math.random() > 0.7;
      
      if (shouldAddComment && repositories.value.length > 0) {
        // Select a random repository and PR
        const repoIndex = Math.floor(Math.random() * repositories.value.length);
        const repo = repositories.value[repoIndex];
        
        if (repo.pullRequests.length > 0) {
          const prIndex = Math.floor(Math.random() * repo.pullRequests.length);
          const pr = repo.pullRequests[prIndex];
          
          // Add a new comment
          const newComment: Comment = {
            id: `comment${Date.now()}`,
            content: `New comment added at ${new Date().toLocaleString()}`,
            author: `user${Math.floor(Math.random() * 5) + 1}`,
            createdOn: new Date().toISOString(),
            updatedOn: new Date().toISOString(),
            isRead: false
          };
          
          pr.comments.push(newComment);
          console.log(`Added new comment to ${repo.slug}/${pr.id}`);
          
          // Update counts
          recalculateUnreadCounts();
          needsDockBadgeUpdate.value = true;
          
          // Send notification
          const notificationStore = useNotificationStore();
          notificationStore.addNotification(`New comment on ${repo.slug}/${pr.id}`);
        }
      }
      
      lastSyncTime.value = new Date();
    } catch (error) {
      console.error('Error syncing with Bitbucket:', error);
    } finally {
      isLoading.value = false;
    }
  }

  // Function for loading mock data (completely removed)
  function loadMockData() {
    // All mock data removed
    // Just set empty repositories array
    repositories.value = []
    lastSyncTime.value = new Date()
    saveToLocalStorage()
    console.log('Mock data functionality has been disabled')
  }

  return {
    repositories,
    isLoading,
    lastSyncTime,
    syncInterval,
    needsDockBadgeUpdate,
    totalUnreadCount,
    getRepository,
    getPullRequest,
    updateRepository,
    updatePullRequest,
    markCommentAsRead,
    markAllCommentsAsRead,
    recalculateUnreadCounts,
    saveToLocalStorage,
    loadFromLocalStorage,
    startPeriodicSync,
    stopPeriodicSync,
    syncWithBitbucket,
    loadMockData
  }
})

// Notification store
export const useNotificationStore = defineStore('notifications', () => {
  const showNotifications = ref(true)
  const dockBadgeEnabled = ref(true)
  const soundEnabled = ref(true)
  const notificationHistoryEnabled = ref(true)
  const notificationHistory = ref<{message: string, timestamp: Date}[]>([])

  // Add notification to history
  function addNotification(message: string) {
    if (notificationHistoryEnabled.value) {
      notificationHistory.value.push({
        message,
        timestamp: new Date()
      })
    }
  }

  // Clear notification history
  function clearHistory() {
    notificationHistory.value = []
  }

  // Update dock badge with count
  async function updateDockBadge(count: number) {
    if (dockBadgeEnabled.value) {
      // TODO: Implement using Tauri's badge API
      console.log(`Setting dock badge to ${count}`)
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
    updateDockBadge
  }
})