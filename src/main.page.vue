<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Tabs from 'primevue/tabs';
import TabPanel from 'primevue/tabpanel';
import TabList from 'primevue/tablist';
import TabPanels from 'primevue/tabpanels';
import Tab from 'primevue/tab';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
import Chip from 'primevue/chip';
import { useConfigStore, usePRStore, useNotificationStore, PullRequest } from "./store";

const router = useRouter();

const configStore = useConfigStore();
const prStore = usePRStore();
const notificationStore = useNotificationStore();
const pullRequests = ref<PullRequest[]>([]);
const prsToReview = ref<PullRequest[]>([]);
const myAuthoredPRs = ref<PullRequest[]>([]);
const loading = ref(true);
// Initialize activeTab with a number (converted from localStorage if available)
const activeTab = ref(0);

// Watch for changes to activeTab and save to localStorage
const nextUpdateIn = ref(0);
const updateTimerId = ref<number | null>(null);

// Format date string to a more readable format
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

// Get repository-level unread count
function getRepositoryUnreadCount(repoSlug: string) {
  const repo = prStore.getRepository(repoSlug);
  return repo ? repo.unreadCount : 0;
}

// Navigate to PR details page within the app
function viewPullRequest(pr: PullRequest) {
  router.push(`/pr/${encodeURIComponent(pr.repository)}/${pr.id}`);
}

// Open PR in browser
async function openPRInBrowser(pr: PullRequest) {
  try {
    const baseUrl = configStore.baseUrl;
    const [projectKey, repoSlug] = pr.repository.split('/');
    const prUrl = `${baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${pr.id}`;
    
    // Import the open function from Tauri plugin
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(prUrl);
  } catch (error) {
    console.error('Error opening PR in browser:', error);
  }
}

// Mark all comments in a PR as read
function markAsRead(pr: PullRequest) {
  prStore.markAllCommentsAsRead(pr.repository, pr.id);
}

// Get all repositories for the table
const allRepositories = computed(() => {
  return prStore.repositories;
});

// Get the total PR count
const totalPRCount = computed(() => {
  return pullRequests.value.length;
});

// Get all PRs with unread comments
const unreadPRs = computed(() => {
  return pullRequests.value.filter(pr => pr.unreadCount > 0);
});

// Last sync time
const lastUpdated = computed(() => {
  return prStore.lastSyncTime;
});

// Fetch data from Bitbucket
async function fetchData() {
  // Show existing data immediately if we have it
  if (prStore.repositories.length > 0) {
    updateLocalPRs();
    loading.value = false;
  } else {
    loading.value = true;
  }
  
  try {
    // Always fetch fresh data from API in background
    await prStore.syncWithBitbucket();
    
    // Load comment states from storage
    await prStore.loadFromLocalStorage();
    
    updateLocalPRs();
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    loading.value = false;
  }
}

// Fetch PRs where I'm a reviewer
async function fetchPRsToReview() {
  loading.value = true;
  try {
    await prStore.syncPRsToReview();
    updateLocalPRs();
  } catch (error) {
    console.error('Error fetching PRs to review:', error);
  } finally {
    loading.value = false;
  }
}

// Fetch PRs that I authored
async function fetchMyAuthoredPRs() {
  loading.value = true;
  try {
    await prStore.syncMyAuthoredPRs();
    updateLocalPRs();
  } catch (error) {
    console.error('Error fetching my authored PRs:', error);
  } finally {
    loading.value = false;
  }
}

// Refresh data from Bitbucket
async function refreshData() {
  // Force refresh regardless of loading state
  loading.value = true;
  try {
    // Force a full refresh from API
    await prStore.syncWithBitbucket();
    updateLocalPRs();
    notificationStore.updateDockBadge(prStore.totalUnreadCount);
    
    // Reset countdown timer after manual refresh
    nextUpdateIn.value = configStore.pollInterval;
  } catch (error) {
    console.error('Error during manual refresh:', error);
  } finally {
    loading.value = false;
  }
}

// Clear all notifications
function clearAllNotifications() {
  prStore.clearAllUnreadNotifications();
  notificationStore.updateDockBadge(0);
}

// Update local PRs from store
function updateLocalPRs() {
  // Get current username to categorize PRs
  const currentUsername = configStore.username;
  
  // All PRs
  const allPRs = prStore.repositories.flatMap(repo => 
    repo.pullRequests.map(pr => ({...pr}))
  );
  
  pullRequests.value = allPRs;
  
  // PRs where I'm a reviewer (not authored by me)
  prsToReview.value = allPRs.filter(pr => 
    pr.author.toLowerCase() !== currentUsername.toLowerCase()
  );
  
  // PRs that I authored
  myAuthoredPRs.value = allPRs.filter(pr => 
    pr.author.toLowerCase() === currentUsername.toLowerCase()
  );
}

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Start the countdown timer for next update
function startUpdateCountdown() {
  // Clear any existing timer
  if (updateTimerId.value !== null) {
    clearInterval(updateTimerId.value);
  }
  
  // Set initial value based on poll interval
  nextUpdateIn.value = configStore.pollInterval;
  
  // Update the countdown every second
  updateTimerId.value = setInterval(() => {
    if (nextUpdateIn.value > 0) {
      nextUpdateIn.value -= 1;
    } else {
      // When timer reaches zero, it will trigger a sync via the watcher
      // The watcher will reset the timer
      // Just ensure we don't create double syncs
      if (!prStore.isLoading) {
        nextUpdateIn.value = 0; // This will trigger the watcher
      } else {
        // If currently loading, wait a bit
        nextUpdateIn.value = 10;
      }
    }
  }, 1000) as unknown as number;
}

// Load data on component mount
onMounted(async () => {
  await configStore.loadConfig();
  await notificationStore.loadSettings();
  await fetchData();
  
  // Start periodic sync
  prStore.startPeriodicSync(configStore.pollInterval);
  
  // Start countdown timer
  startUpdateCountdown();
  
  // Make sure activeTab is applied to the tabs 
  activeTab.value = 0;
});

// Watch for changes in PR store
watch(() => prStore.lastSyncTime, (newTime, oldTime) => {
  if (newTime && (!oldTime || newTime.getTime() !== oldTime.getTime())) {
    console.log('Detected PR store update, refreshing local data');
    updateLocalPRs();
    notificationStore.updateDockBadge(prStore.totalUnreadCount);
    // Reset the countdown timer on store update
    nextUpdateIn.value = configStore.pollInterval;
  }
});

// Watch the countdown timer
watch(() => nextUpdateIn.value, (newValue) => {
  if (newValue === 0) {
    // When timer reaches zero, trigger a sync
    console.log('Timer reached zero, syncing with Bitbucket');
    prStore.syncWithBitbucket();
  }
});

// Clean up timers when component is unmounted
onUnmounted(() => {
  if (updateTimerId.value !== null) {
    clearInterval(updateTimerId.value);
  }
  // Stop the periodic sync when the component is unmounted
  prStore.stopPeriodicSync();
});
</script>

<template>
<main class="container">
  <div class="header-area">
    <div class="header-title">
      <h1>Pull Requests</h1>
      <div v-if="lastUpdated" class="next-update">
        Next update in: <span class="countdown">{{ formatTime(nextUpdateIn) }}</span>
      </div>
    </div>
    <div class="header-actions">
      <Button 
        icon="pi pi-refresh" 
        label="Refresh" 
        @click="refreshData" 
        :loading="loading || prStore.isLoading" 
        :disabled="loading || prStore.isLoading"
        class="mr-2" 
      />
      <Button 
        icon="pi pi-check-circle" 
        label="Clear All" 
        @click="clearAllNotifications" 
        severity="secondary"
        :disabled="prStore.totalUnreadCount === 0" 
        class="mr-2" 
      />
      <Badge :value="prStore.totalUnreadCount" severity="danger" size="large"/>
    </div>
  </div>
  
  <Tabs :value="activeTab">
    <TabList>
      <Tab :value="0">All Pull Requests</Tab>
      <Tab :value="1">To Review</Tab>
      <Tab :value="2">My Pull Requests</Tab>
      <Tab :value="3">By Repository</Tab>
      <Tab :value="4">Unread Only</Tab>
    </TabList>
    <TabPanels>
      <TabPanel :value="0">
      <div v-if="loading" class="loading-container">
        <ProgressSpinner />
        <p>Loading pull requests...</p>
      </div>
      
      <Card v-else>
        <template #title>
          <div class="flex justify-content-between align-items-center">
            <h3>All Pull Requests ({{ totalPRCount }})</h3>
            <Chip :label="`Unread: ${prStore.totalUnreadCount}`" severity="danger" v-if="prStore.totalUnreadCount > 0" />
          </div>
        </template>
        
        <template #content>
          <DataTable 
            :value="pullRequests" 
            tableStyle="width: 100%" 
            stripedRows 
            paginator 
            :rows="10"
            :rowsPerPageOptions="[5, 10, 20, 50]" 
            sortField="updatedOn"
            :sortOrder="-1"
            rowHover
            responsiveLayout="scroll"
            filterDisplay="menu"
            :globalFilterFields="['repository', 'title', 'author']">
            
            <Column field="repository" header="Repository" sortable>
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.repository }}</span>
                  <Badge v-if="getRepositoryUnreadCount(data.repository) > 0" 
                        :value="getRepositoryUnreadCount(data.repository)" 
                        severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column field="id" header="PR" sortable style="width: 5rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.id }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column field="title" header="Title" sortable />
            <Column field="author" header="Author" sortable style="width: 10rem" />
            <Column field="status" header="Status" sortable style="width: 8rem">
              <template #body="{ data }">
                <Chip 
                  :label="data.status" 
                  :severity="data.status === 'OPEN' ? 'info' : 'success'" 
                />
              </template>
            </Column>
            
            <Column field="approvalStatus" header="Approval" sortable style="width: 8rem">
              <template #body="{ data }">
                <Chip 
                  :label="data.approvalStatus || 'UNAPPROVED'" 
                  :severity="data.approved ? 'success' : 'warning'" 
                />
              </template>
            </Column>
            
            <Column field="updatedOn" header="Updated" sortable style="width: 12rem">
              <template #body="{ data }">
                {{ formatDate(data.updatedOn) }}
              </template>
            </Column>
            
            <Column field="comments" header="C" sortable style="width: 3rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.comments ? data.comments.length : 0 }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column header="Actions" style="width: 8rem">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-2 justify-content-center">
                  <Button icon="pi pi-search" severity="info" text rounded @click="viewPullRequest(data)"
                          v-tooltip.top="'Open in Bitbucket'" ></Button>
                  <Button icon="pi pi-check" severity="success" text rounded @click="markAsRead(data)" 
                          :disabled="data.unreadCount === 0" v-tooltip.top="'Mark as read'"></Button>
                </div>
              </template>
            </Column>
          </DataTable>

          <div v-if="lastUpdated" class="mt-2 text-sm text-gray-500">
            Last updated: {{ lastUpdated.toLocaleString() }}
          </div>
        </template>
      </Card>
    </TabPanel>
      
      <TabPanel :value="1">
      <div v-if="loading" class="loading-container">
        <ProgressSpinner />
        <p>Loading pull requests to review...</p>
      </div>
      
      <Card v-else-if="prsToReview.length === 0">
        <template #title>
          <h3>Pull Requests to Review</h3>
        </template>
        <template #content>
          <div class="empty-state">
            <i class="pi pi-info-circle empty-icon"></i>
            <p>There are no pull requests assigned to you for review.</p>
            <Button label="Refresh" icon="pi pi-refresh" @click="fetchPRsToReview" />
          </div>
        </template>
      </Card>
      
      <Card v-else>
        <template #title>
          <div class="flex justify-content-between align-items-center">
            <h3>Pull Requests to Review ({{ prsToReview.length }})</h3>
            <Button icon="pi pi-refresh" text rounded @click="fetchPRsToReview" />
          </div>
        </template>
        
        <template #content>
          <DataTable 
            :value="prsToReview" 
            tableStyle="width: 100%" 
            stripedRows 
            paginator 
            :rows="5"
            sortField="updatedOn"
            :sortOrder="-1"
            rowHover
            responsiveLayout="scroll">
            
            <Column field="repository" header="Repository" sortable />
            
            <Column field="id" header="PR" sortable style="width: 5rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.id }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column field="title" header="Title" sortable />
            <Column field="author" header="Author" sortable style="width: 10rem" />
            <Column field="approvalStatus" header="Approval" sortable style="width: 8rem">
              <template #body="{ data }">
                <Chip 
                  :label="data.approvalStatus || 'UNAPPROVED'" 
                  :severity="data.approved ? 'success' : 'warning'" 
                />
              </template>
            </Column>
            <Column field="updatedOn" header="Updated" sortable style="width: 12rem">
              <template #body="{ data }">
                {{ formatDate(data.updatedOn) }}
              </template>
            </Column>
            
            <Column header="Actions" style="width: 12rem">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-2 justify-content-center">
                  <Button icon="pi pi-list" severity="primary" text rounded @click="viewPullRequest(data)" 
                          v-tooltip.top="'View Comments'" />
                  <Button icon="pi pi-external-link" severity="info" text rounded @click="openPRInBrowser(data)" 
                          v-tooltip.top="'Open in Bitbucket'" />
                  <Button icon="pi pi-check" severity="success" text rounded @click="markAsRead(data)" 
                          :disabled="data.unreadCount === 0" v-tooltip.top="'Mark as read'" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </TabPanel>
      
      <TabPanel :value="2">
      <div v-if="loading" class="loading-container">
        <ProgressSpinner />
        <p>Loading your pull requests...</p>
      </div>
      
      <Card v-else-if="myAuthoredPRs.length === 0">
        <template #title>
          <h3>My Pull Requests</h3>
        </template>
        <template #content>
          <div class="empty-state">
            <i class="pi pi-info-circle empty-icon"></i>
            <p>You don't have any open pull requests.</p>
            <Button label="Refresh" icon="pi pi-refresh" @click="fetchMyAuthoredPRs" />
          </div>
        </template>
      </Card>
      
      <Card v-else>
        <template #title>
          <div class="flex justify-content-between align-items-center">
            <h3>My Pull Requests ({{ myAuthoredPRs.length }})</h3>
            <Button icon="pi pi-refresh" text rounded @click="fetchMyAuthoredPRs" />
          </div>
        </template>
        
        <template #content>
          <DataTable 
            :value="myAuthoredPRs" 
            tableStyle="width: 100%" 
            stripedRows 
            paginator 
            :rows="5"
            sortField="updatedOn"
            :sortOrder="-1"
            rowHover
            responsiveLayout="scroll">
            
            <Column field="repository" header="Repository" sortable />
            
            <Column field="id" header="PR" sortable style="width: 5rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.id }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column field="title" header="Title" sortable />
            <Column field="status" header="Status" sortable style="width: 8rem">
              <template #body="{ data }">
                <Chip 
                  :label="data.status" 
                  :severity="data.status === 'OPEN' ? 'info' : 'success'" 
                />
              </template>
            </Column>
            <Column field="approvalStatus" header="Approval" sortable style="width: 8rem">
              <template #body="{ data }">
                <Chip 
                  :label="data.approvalStatus || 'UNAPPROVED'" 
                  :severity="data.approved ? 'success' : 'warning'" 
                />
              </template>
            </Column>
            <Column field="updatedOn" header="Updated" sortable style="width: 12rem">
              <template #body="{ data }">
                {{ formatDate(data.updatedOn) }}
              </template>
            </Column>
            
            <Column field="comments" header="C" sortable style="width: 3rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.comments ? data.comments.length : 0 }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column header="Actions" style="width: 12rem">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-2 justify-content-center">
                  <Button icon="pi pi-list" severity="primary" text rounded @click="viewPullRequest(data)" 
                          v-tooltip.top="'View Comments'" />
                  <Button icon="pi pi-external-link" severity="info" text rounded @click="openPRInBrowser(data)" 
                          v-tooltip.top="'Open in Bitbucket'" />
                  <Button icon="pi pi-check" severity="success" text rounded @click="markAsRead(data)" 
                          :disabled="data.unreadCount === 0" v-tooltip.top="'Mark as read'" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </TabPanel>
      
      <TabPanel :value="3">
      <div v-if="loading" class="loading-container">
        <ProgressSpinner />
        <p>Loading repositories...</p>
      </div>
      
      <Card v-else-if="allRepositories.length === 0">
        <template #title>
          <h3>Repositories</h3>
        </template>
        <template #content>
          <div class="empty-state">
            <i class="pi pi-info-circle empty-icon"></i>
            <p>No repositories found.</p>
            <Button label="Refresh" icon="pi pi-refresh" @click="refreshData" />
          </div>
        </template>
      </Card>
      
      <div v-else>
        <Card v-for="repo in allRepositories" :key="repo.slug" class="mb-3">
          <template #title>
            <div class="flex justify-content-between align-items-center">
              <h3>{{ repo.name }}</h3>
              <Badge v-if="repo.unreadCount > 0" :value="repo.unreadCount" severity="danger" />
            </div>
          </template>
          
          <template #content>
            <DataTable 
              :value="repo.pullRequests" 
              tableStyle="width: 100%" 
              stripedRows 
              sortField="updatedOn"
              :sortOrder="-1"
              rowHover
              class="repo-table">
              
              <Column field="id" header="PR" sortable style="width: 5rem">
                <template #body="{ data }">
                  <div class="flex align-items-center gap-2">
                    <span>{{ data.id }}</span>
                    <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                  </div>
                </template>
              </Column>
              
              <Column field="title" header="Title" sortable />
              <Column field="author" header="Author" sortable style="width: 10rem" />
              <Column field="approvalStatus" header="Approval" sortable style="width: 8rem">
                <template #body="{ data }">
                  <Chip 
                    :label="data.approvalStatus || 'UNAPPROVED'" 
                    :severity="data.approved ? 'success' : 'warning'" 
                  />
                </template>
              </Column>
              <Column field="updatedOn" header="Updated" sortable style="width: 12rem">
                <template #body="{ data }">
                  {{ formatDate(data.updatedOn) }}
                </template>
              </Column>
              
              <Column field="comments" header="C" sortable style="width: 3rem">
                <template #body="{ data }">
                  <div class="flex align-items-center gap-2">
                    <span>{{ data.comments ? data.comments.length : 0 }}</span>
                    <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                  </div>
                </template>
              </Column>
              
              <Column header="Actions" style="width: 12rem">
                <template #body="{ data }">
                  <div class="flex flex-wrap gap-2 justify-content-center">
                    <Button icon="pi pi-list" severity="primary" text rounded @click="viewPullRequest(data)" 
                            v-tooltip.top="'View Comments'" />
                    <Button icon="pi pi-external-link" severity="info" text rounded @click="openPRInBrowser(data)" 
                            v-tooltip.top="'Open in Bitbucket'" />
                    <Button icon="pi pi-check" severity="success" text rounded @click="markAsRead(data)" 
                            :disabled="data.unreadCount === 0" v-tooltip.top="'Mark as read'" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </TabPanel>
      
      <TabPanel :value="4">
      <div v-if="loading" class="loading-container">
        <ProgressSpinner />
        <p>Loading unread pull requests...</p>
      </div>
      
      <Card v-else-if="unreadPRs.length === 0">
        <template #title>
          <h3>Unread Pull Requests</h3>
        </template>
        <template #content>
          <div class="empty-state">
            <i class="pi pi-check-circle empty-icon success-icon"></i>
            <p>All pull requests have been read! 🎉</p>
          </div>
        </template>
      </Card>
      
      <Card v-else>
        <template #title>
          <div class="flex justify-content-between align-items-center">
            <h3>Unread Pull Requests</h3>
            <Badge :value="prStore.totalUnreadCount" severity="danger" />
          </div>
        </template>
        
        <template #content>
          <DataTable 
            :value="unreadPRs" 
            tableStyle="width: 100%" 
            stripedRows 
            paginator 
            :rows="10"
            sortField="updatedOn"
            :sortOrder="-1"
            rowHover>
            
            <Column field="repository" header="Repository" sortable />
            
            <Column field="id" header="PR" sortable style="width: 5rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.id }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column field="title" header="Title" sortable />
            <Column field="approvalStatus" header="Approval" sortable style="width: 8rem">
              <template #body="{ data }">
                <Chip 
                  :label="data.approvalStatus || 'UNAPPROVED'" 
                  :severity="data.approved ? 'success' : 'warning'" 
                />
              </template>
            </Column>
            <Column field="updatedOn" header="Updated" sortable style="width: 12rem">
              <template #body="{ data }">
                {{ formatDate(data.updatedOn) }}
              </template>
            </Column>
            
            <Column field="comments" header="C" sortable style="width: 3rem">
              <template #body="{ data }">
                <div class="flex align-items-center gap-2">
                  <span>{{ data.comments ? data.comments.length : 0 }}</span>
                  <Badge v-if="data.unreadCount > 0" :value="data.unreadCount" severity="danger" />
                </div>
              </template>
            </Column>
            
            <Column header="Actions" style="width: 12rem">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-2 justify-content-center">
                  <Button icon="pi pi-list" severity="primary" text rounded @click="viewPullRequest(data)" 
                          v-tooltip.top="'View Comments'" />
                  <Button icon="pi pi-external-link" severity="info" text rounded @click="openPRInBrowser(data)" 
                          v-tooltip.top="'Open in Bitbucket'" />
                  <Button icon="pi pi-search" severity="success" text rounded @click="markAsRead(data)"
                          v-tooltip.top="'Mark as read'" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </TabPanel>
    </TabPanels>
  </Tabs>
</main>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.header-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-title {
  display: flex;
  flex-direction: column;
}

.next-update {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.countdown {
  font-family: monospace;
  font-weight: bold;
}

.header-actions {
  display: flex;
  align-items: center;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: #64748b;
  margin-bottom: 1rem;
}

.success-icon {
  color: #22c55e;
}

.repo-table {
  margin-bottom: 0;
}

.mb-3 {
  margin-bottom: 1.5rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-gray-500 {
  color: #6b7280;
}

/* Make sure tab panels display properly */
:deep(.p-tabview-panels) {
  padding: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .header-area {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    margin-top: 1rem;
    width: 100%;
    justify-content: space-between;
  }
}
</style>