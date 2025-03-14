<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { invoke } from "@tauri-apps/api/core";
import { usePRStore, useNotificationStore, PullRequest, Comment } from './store';
import Button from 'primevue/button';
import Knob from 'primevue/knob';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Panel from 'primevue/panel';
import Badge from 'primevue/badge';
import Card from 'primevue/card';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import InputSwitch from 'primevue/inputswitch';

const prStore = usePRStore();
const notificationStore = useNotificationStore();
const badgeValue = ref(0);
const selectedPR = ref<PullRequest | null>(null);
const selectedRepo = ref<string | null>(null);
const showSettings = ref(false);

// Get all PRs with unread comments
const unreadPRs = computed(() => {
  return prStore.repositories.flatMap(repo => 
    repo.pullRequests.filter(pr => pr.unreadCount > 0)
  );
});

// Get the total number of unread comments across all PRs
const totalUnreadCount = computed(() => {
  return prStore.totalUnreadCount;
});

// Detect if we have permission to send notifications
async function checkNotificationPermission() {
  const permissionGranted = await isPermissionGranted();
  return permissionGranted;
}

async function requestNotificationPermission() {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  return permissionGranted;
}

// Apply the badge count to the dock icon
async function applyBadgeCount() {
  try {
    await invoke("update_dock_badge_safe", { count: badgeValue.value });
    notificationStore.updateDockBadge(badgeValue.value);
  } catch (error) {
    console.error('Failed to update dock badge:', error);
  }
}

// Send a test notification
async function sendTestNotification() {
  let permissionGranted = await isPermissionGranted();
  if (permissionGranted) {
    sendNotification({ 
      title: 'Bitbucket Notifier', 
      body: 'This is a test notification. You have ' + totalUnreadCount.value + ' unread comments.'
    });
    notificationStore.addNotification('Test notification sent');
  } else {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendTestNotification();
    }
  }
}

// View PR details and comments
function viewPR(pr: any) {
  selectedPR.value = pr;
  selectedRepo.value = pr.repository;
}

// Mark a comment as read
function markCommentAsRead(comment: Comment) {
  if (selectedPR.value && selectedRepo.value) {
    prStore.markCommentAsRead(selectedRepo.value, selectedPR.value.id, comment.id);
  }
}

// Mark all comments in a PR as read
function markAllAsRead(pr: PullRequest) {
  prStore.markAllCommentsAsRead(pr.repository, pr.id);
}

// Format date to a more readable format
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

// Initialize by loading mock data and checking notification permission
onMounted(async () => {
  // Load mock data if not already loaded
  if (prStore.repositories.length === 0) {
  }
  
  // Set badge value to the total unread count
  badgeValue.value = totalUnreadCount.value;
  
  // Check if we have permission to send notifications
  await checkNotificationPermission();
  
  // Update the dock badge with the current count
  await applyBadgeCount();
});
</script>

<template>
<main class="container">
  <h1>Notifications</h1>
  
  <div class="flex gap-3 mb-4">
    <Button label="Settings" icon="pi pi-cog" @click="showSettings = !showSettings" />
    <Button label="Test Notification" icon="pi pi-bell" @click="sendTestNotification" />
    <Button label="Update Badge" icon="pi pi-refresh" @click="applyBadgeCount" />
  </div>
  
  <Panel v-if="showSettings" header="Notification Settings" toggleable class="mb-4">
    <div class="flex flex-column gap-3">
      <div class="flex align-items-center gap-3">
        <label for="show-notifications">Show Notifications:</label>
        <InputSwitch id="show-notifications" v-model="notificationStore.showNotifications" />
      </div>
      
      <div class="flex align-items-center gap-3">
        <label for="dock-badge">Enable Dock Badge:</label>
        <InputSwitch id="dock-badge" v-model="notificationStore.dockBadgeEnabled" />
      </div>
      
      <div class="flex align-items-center gap-3">
        <label for="sound-enabled">Enable Sound:</label>
        <InputSwitch id="sound-enabled" v-model="notificationStore.soundEnabled" />
      </div>
      
      <div class="flex align-items-center gap-3">
        <label for="history-enabled">Keep Notification History:</label>
        <InputSwitch id="history-enabled" v-model="notificationStore.notificationHistoryEnabled" />
      </div>
      
      <div class="flex align-items-center gap-3">
        <label for="badge-count">Badge Count:</label>
        <Knob id="badge-count" v-model="badgeValue" :min="0" :max="100" />
      </div>
      
      <Button label="Clear Notification History" icon="pi pi-trash" severity="danger" 
              @click="notificationStore.clearHistory()" />
    </div>
  </Panel>
  
  <div class="grid">
    <div :class="selectedPR ? 'col-6' : 'col-12'">
      <Card>
        <template #title>
          <div class="flex align-items-center justify-content-between">
            <h2>Unread Pull Requests</h2>
            <Badge :value="totalUnreadCount" size="large" severity="danger" />
          </div>
        </template>
        
        <template #content>
          <DataTable 
            :value="unreadPRs" 
            stripedRows 
            :paginator="unreadPRs.length > 5" 
            :rows="5" 
            tableStyle="min-width: 100%"
            v-model:selection="selectedPR"
            selectionMode="single"
            dataKey="id"
            @row-select="viewPR"
            emptyMessage="No unread pull requests">
            
            <Column field="repository" header="Repository" :sortable="true" />
            <Column field="id" header="PR" :sortable="true" />
            <Column field="title" header="Title" :sortable="true" />
            <Column field="unreadCount" header="Unread" :sortable="true">
              <template #body="{ data }">
                <Badge :value="data.unreadCount" severity="danger" />
              </template>
            </Column>
            <Column header="Actions">
              <template #body="{ data }">
                <Button icon="pi pi-check" severity="success" text rounded 
                        @click.stop="markAllAsRead(data)" />
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
      
      <Card v-if="notificationStore.notificationHistory.length > 0" class="mt-4">
        <template #title>
          <div class="flex align-items-center justify-content-between">
            <h2>Notification History</h2>
            <Button icon="pi pi-trash" severity="danger" text rounded 
                    @click="notificationStore.clearHistory()" />
          </div>
        </template>
        
        <template #content>
          <DataTable 
            :value="notificationStore.notificationHistory" 
            stripedRows 
            :paginator="notificationStore.notificationHistory.length > 5" 
            :rows="5" 
            tableStyle="min-width: 100%">
            
            <Column field="timestamp" header="Time" :sortable="true">
              <template #body="{ data }">
                {{ data.timestamp.toLocaleString() }}
              </template>
            </Column>
            <Column field="message" header="Message" :sortable="true" />
          </DataTable>
        </template>
      </Card>
    </div>
    
    <div class="col-6" v-if="selectedPR">
      <Card>
        <template #title>
          <div class="flex align-items-center justify-content-between">
            <h2>{{ selectedPR.repository }} - {{ selectedPR.id }}</h2>
            <Badge :value="selectedPR.unreadCount" severity="danger" />
          </div>
        </template>
        <template #subtitle>
          {{ selectedPR.title }}
        </template>
        
        <template #content>
          <Accordion>
            <AccordionTab v-for="comment in selectedPR.comments" :key="comment.id" 
                          :header="comment.author + ' - ' + formatDate(comment.createdOn)">
              <div class="flex flex-column gap-2">
                <div class="comment-content">{{ comment.content }}</div>
                <div class="flex justify-content-between">
                  <span :class="comment.isRead ? 'text-success' : 'text-danger'">
                    {{ comment.isRead ? 'Read' : 'Unread' }}
                  </span>
                  <Button v-if="!comment.isRead" label="Mark as Read" severity="success" 
                          @click="markCommentAsRead(comment)" />
                </div>
              </div>
            </AccordionTab>
          </Accordion>
          
          <div class="flex justify-content-end mt-3">
            <Button label="Mark All as Read" severity="success" 
                    @click="markAllAsRead(selectedPR)" 
                    :disabled="selectedPR.unreadCount === 0" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</main>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.text-success {
  color: #22c55e;
}

.text-danger {
  color: #ef4444;
}

.comment-content {
  white-space: pre-wrap;
  padding: 0.5rem;
  background-color: #f9fafb;
  border-radius: 0.25rem;
  border-left: 4px solid #e5e7eb;
}
</style>