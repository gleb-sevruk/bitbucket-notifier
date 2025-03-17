import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { BitbucketPR, Repository, PullRequest } from './models';
import { BitbucketApiClient } from './bitbucketApi';
import { useNotificationStore } from './notificationStore';

// Pinia store for PR data
export const usePRStore = defineStore('pullRequests', () => {
  const repositories = ref<Repository[]>([]);
  const isLoading = ref(false);
  const lastSyncTime = ref<Date | null>(null);
  const syncInterval = ref<number | null>(null);
  const needsDockBadgeUpdate = ref(false);
  const apiClient = new BitbucketApiClient();

  // Global unread count for badge
  const totalUnreadCount = computed(() => {
    return repositories.value.reduce((total, repo) => total + repo.unreadCount, 0);
  });

  // Get repository by slug
  function getRepository(repoSlug: string) {
    return repositories.value.find(repo => repo.slug === repoSlug);
  }

  // Get pull request by id and repository
  function getPullRequest(repoSlug: string, prId: string) {
    const repo = getRepository(repoSlug);
    if (!repo) return null;
    return repo.pullRequests.find(pr => pr.id === prId);
  }

  // Add or update repository
  function updateRepository(repository: Repository) {
    const index = repositories.value.findIndex(r => r.slug === repository.slug);
    if (index >= 0) {
      repositories.value[index] = repository;
    } else {
      repositories.value.push(repository);
    }
    recalculateUnreadCounts();
  }

  // Add or update pull request
  function updatePullRequest(repoSlug: string, pullRequest: PullRequest) {
    const repo = getRepository(repoSlug);
    if (!repo) return;

    const index = repo.pullRequests.findIndex(pr => pr.id === pullRequest.id);
    if (index >= 0) {
      repo.pullRequests[index] = pullRequest;
    } else {
      repo.pullRequests.push(pullRequest);
    }
    recalculateUnreadCounts();
  }

  // Mark comment as read
  function markCommentAsRead(repoSlug: string, prId: string, commentId: string) {
    const pr = getPullRequest(repoSlug, prId);
    if (!pr) return;

    const comment = pr.comments.find(c => c.id === commentId);
    if (comment) {
      comment.isRead = true;
      recalculateUnreadCounts();
      needsDockBadgeUpdate.value = true;
    }
  }
  
  // Mark comment as unread
  function markCommentAsUnread(repoSlug: string, prId: string, commentId: string) {
    const pr = getPullRequest(repoSlug, prId);
    if (!pr) return;

    const comment = pr.comments.find(c => c.id === commentId);
    if (comment) {
      comment.isRead = false;
      recalculateUnreadCounts();
      needsDockBadgeUpdate.value = true;
    }
  }

  // Mark all comments in a PR as read
  function markAllCommentsAsRead(repoSlug: string, prId: string) {
    const pr = getPullRequest(repoSlug, prId);
    if (!pr) return;

    pr.comments.forEach(comment => {
      comment.isRead = true;
    });
    recalculateUnreadCounts();
    needsDockBadgeUpdate.value = true;
    
    // Return the PR for chaining
    return pr;
  }
  
  // Clear all unread notifications for all PRs
  function clearAllUnreadNotifications() {
    for (const repo of repositories.value) {
      for (const pr of repo.pullRequests) {
        pr.comments.forEach(comment => {
          comment.isRead = true;
        });
        pr.unreadCount = 0;
      }
      repo.unreadCount = 0;
    }
    needsDockBadgeUpdate.value = true;
    saveToLocalStorage();
  }

  // Recalculate unread counts at all levels
  function recalculateUnreadCounts() {
    // Calculate PR level unread counts
    for (const repo of repositories.value) {
      for (const pr of repo.pullRequests) {
        pr.unreadCount = pr.comments.filter(c => !c.isRead).length;
      }

      // Calculate repository level unread counts
      repo.unreadCount = repo.pullRequests.reduce((total, pr) => total + pr.unreadCount, 0);
    }
    
    // Save to local storage after recalculation
    saveToLocalStorage();
  }
  
  // Save data to local storage
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
  
  // Load data from local storage
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
      if (!isLoading.value) {
        console.log('Running periodic sync with Bitbucket');
        await syncWithBitbucket();
        needsDockBadgeUpdate.value = true;
      } else {
        console.log('Skipping periodic sync due to loading state');
      }
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

  // Fetch and process a list of PRs from Bitbucket
  async function processPullRequests(pullRequests: BitbucketPR[]) {
    const notificationStore = useNotificationStore();
    
    // Process each PR
    for (const bbPR of pullRequests) {
      const projectKey = bbPR.toRef.repository.project.key;
      const repoSlug = bbPR.toRef.repository.slug;
      const repoPath = `${projectKey}/${repoSlug}`;
      
      // Get existing PR if available
      const existingPR = getPullRequest(repoPath, bbPR.id.toString());
      
      // Get comments for PR
      const comments = await apiClient.getCommentsForPullRequest(projectKey, repoSlug, bbPR.id);
      
      // Convert to our model
      const pr = apiClient.convertPullRequest(bbPR, comments, existingPR);
      
      // Check for repository
      let repo = getRepository(repoPath);
      
      if (!repo) {
        // If repo doesn't exist, create it
        repo = {
          slug: repoPath,
          name: `${projectKey}/${repoSlug}`, // Use path as name temporarily
          pullRequests: [],
          unreadCount: 0
        };
        repositories.value.push(repo);
      }
      
      // Update the PR
      const prIndex = repo.pullRequests.findIndex(p => p.id === pr.id);
      
      // Check for new comments that need notification
      if (existingPR) {
        const newComments = pr.comments.filter(comment => {
          const existingComment = existingPR.comments.find(c => c.id === comment.id);
          return !existingComment;
        });
        
        // Notify about new comments
        if (newComments.length > 0) {
          newComments.forEach(comment => {
            notificationStore.addNotification(`New comment on ${repoPath}/${pr.id}: ${comment.content.substring(0, 50)}...`);
          });
        }
      }
      
      if (prIndex >= 0) {
        repo.pullRequests[prIndex] = pr;
      } else {
        repo.pullRequests.push(pr);
      }
    }
  }

  // Sync my PRs (both as reviewer and author) with Bitbucket API
  async function syncMyPRs() {
    isLoading.value = true;
    
    try {
      // Get all PRs relevant to me
      const myPRs = await apiClient.getAllMyPullRequests();
      
      // Process all PRs
      await processPullRequests(myPRs);
      
      // Recalculate all counts
      recalculateUnreadCounts();
      needsDockBadgeUpdate.value = true;
      lastSyncTime.value = new Date();
    } catch (error) {
      console.error('Error syncing my PRs:', error);
    } finally {
      isLoading.value = false;
    }
  }
  
  // Sync PRs where I'm a reviewer
  async function syncPRsToReview() {
    isLoading.value = true;
    
    try {
      // Get PRs where I'm a reviewer
      const prsToReview = await apiClient.getPullRequestsToReview();
      
      // Process all PRs
      await processPullRequests(prsToReview);
      
      // Recalculate all counts
      recalculateUnreadCounts();
      needsDockBadgeUpdate.value = true;
      lastSyncTime.value = new Date();
    } catch (error) {
      console.error('Error syncing PRs to review:', error);
    } finally {
      isLoading.value = false;
    }
  }
  
  // Sync PRs that I authored
  async function syncMyAuthoredPRs() {
    isLoading.value = true;
    
    try {
      // Get PRs that I authored
      const myAuthoredPRs = await apiClient.getMyPullRequests();
      
      // Process all PRs
      await processPullRequests(myAuthoredPRs);
      
      // Recalculate all counts
      recalculateUnreadCounts();
      needsDockBadgeUpdate.value = true;
      lastSyncTime.value = new Date();
    } catch (error) {
      console.error('Error syncing my authored PRs:', error);
    } finally {
      isLoading.value = false;
    }
  }

  // Sync with Bitbucket API - this is the master sync function
  async function syncWithBitbucket() {
    if (!isLoading.value) {
      isLoading.value = true;
      
      try {
        // Sync all PRs relevant to me (as author and reviewer)
        await syncMyPRs();
        
        // Additionally sync PRs where I'm a reviewer
        await syncPRsToReview();
        
        // Additionally sync PRs that I authored
        await syncMyAuthoredPRs();
        
        // Get recent repositories to ensure we have full repository data
        const repos = await apiClient.getRecentRepositories();
        
        // Update repository names if needed (for better display)
        for (const bbRepo of repos) {
          const projectKey = bbRepo.project.key;
          const repoSlug = bbRepo.slug;
          const repoPath = `${projectKey}/${repoSlug}`;
          
          // Get existing repository
          const existingRepo = getRepository(repoPath);
          
          // Update name if we have it in our store
          if (existingRepo && existingRepo.name === repoPath) {
            existingRepo.name = bbRepo.name; // Use proper name from API
          }
        }
        
        // Ensure unread counts are accurate
        recalculateUnreadCounts();
        
        // Update last sync time
        lastSyncTime.value = new Date();
        console.log('Sync completed successfully at', lastSyncTime.value);
        
        // Trigger badge update
        needsDockBadgeUpdate.value = true;
      } catch (error) {
        console.error('Error syncing with Bitbucket:', error);
      } finally {
        isLoading.value = false;
      }
    } else {
      console.log('Sync already in progress, skipping this request');
    }
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
    markCommentAsUnread,
    markAllCommentsAsRead,
    clearAllUnreadNotifications,
    recalculateUnreadCounts,
    saveToLocalStorage,
    loadFromLocalStorage,
    startPeriodicSync,
    stopPeriodicSync,
    syncWithBitbucket,
    syncMyPRs,
    syncPRsToReview,
    syncMyAuthoredPRs
  };
});