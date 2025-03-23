<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from 'vue-router';
import { useConfigStore } from "./store";
import { usePRStore } from "./store/prStore";
import { PullRequest } from "./shared/models.ts";
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import ProgressSpinner from 'primevue/progressspinner';
import Chip from 'primevue/chip';
import Timeline from 'primevue/timeline';
import Tooltip from 'primevue/tooltip';

// Register the Tooltip directive for this component
defineOptions({
  directives: {
    tooltip: Tooltip
  }
});

const route = useRoute();
const router = useRouter();
const prStore = usePRStore();
const configStore = useConfigStore();
const repoSlug = ref<string>(route.params.repoSlug as string);
const prId = ref<string>(route.params.prId as string);
const pr = ref<PullRequest | null>(null);
const loading = ref(true);

// Format date to readable format
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

// Get PR details
function loadPullRequest() {
  loading.value = true;
  
  if (repoSlug.value && prId.value) {
    const pullRequest = prStore.getPullRequest(repoSlug.value, prId.value);
    
    if (pullRequest) {
      pr.value = pullRequest;
    } else {
      console.error('Pull request not found');
    }
  } else {
    console.error('Missing repo slug or PR ID in route params');
  }
  
  loading.value = false;
}

// Mark a specific comment as read
function markCommentAsRead(commentId: string) {
  if (repoSlug.value && prId.value) {
    prStore.markCommentAsRead(repoSlug.value, prId.value, commentId);
    // Reload the PR to update the UI
    loadPullRequest();
  }
}

// Mark a specific comment as unread
function markCommentAsUnread(commentId: string) {
  if (repoSlug.value && prId.value && pr.value) {
    // Since markCommentAsUnread seems to have an issue, let's implement it directly here
    const comment = pr.value.comments.find(c => c.id === commentId);
    if (comment) {
      comment.isRead = false;
      // Call recalculateUnreadCounts to update badge counts
      prStore.recalculateUnreadCounts();
      // Update dock badge
      prStore.needsDockBadgeUpdate = true;
      // Save changes to storage
      prStore.saveToLocalStorage();
      // Reload the PR to update the UI
      loadPullRequest();
    }
  }
}

// Mark all comments as read
function markAllAsRead() {
  if (repoSlug.value && prId.value) {
    prStore.markAllCommentsAsRead(repoSlug.value, prId.value);
    // Reload the PR to update the UI
    loadPullRequest();
  }
}

// Mark all comments as unread
function markAllAsUnread() {
  if (repoSlug.value && prId.value && pr.value) {
    // Mark each comment as unread directly
    for (const comment of pr.value.comments) {
      comment.isRead = false;
    }
    
    // Update counts and storage
    prStore.recalculateUnreadCounts();
    prStore.needsDockBadgeUpdate = true;
    prStore.saveToLocalStorage();
    
    // Reload the PR to update the UI
    loadPullRequest();
  }
}

// Open PR in browser
async function openInBrowser() {
  if (pr.value) {
    try {
      const baseUrl = configStore.baseUrl;
      const [projectKey, repo] = pr.value.repository.split('/');
      const prUrl = `${baseUrl}/projects/${projectKey}/repos/${repo}/pull-requests/${pr.value.id}`;
      
      // Import the open function from Tauri plugin
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(prUrl);
    } catch (error) {
      console.error('Error opening PR in browser:', error);
    }
  }
}

// Go back to PR list
function goBack() {
  router.push('/');
}

// Timeline events from comments
const timelineEvents = computed(() => {
  if (!pr.value) return [];
  
  return pr.value.comments.map(comment => ({
    comment,
    status: comment.isRead ? 'Read' : 'Unread',
    icon: comment.isRead ? 'pi pi-check' : 'pi pi-envelope',
    color: comment.isRead ? '#22c55e' : '#ef4444'
  })).sort((a, b) => {
    return new Date(b.comment.createdOn).getTime() - new Date(a.comment.createdOn).getTime();
  });
});

// Load PR on component mount
onMounted(() => {
  loadPullRequest();
});
</script>

<template>
  <div class="container">
    <div class="header-actions">
      <Button icon="pi pi-arrow-left" label="Back" @click="goBack" severity="secondary" />
    </div>
    
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Loading pull request details...</p>
    </div>
    
    <div v-else-if="!pr" class="error-state">
      <h2>Pull Request Not Found</h2>
      <p>The requested pull request could not be found.</p>
      <Button icon="pi pi-arrow-left" label="Go Back" @click="goBack" severity="secondary" />
    </div>
    
    <div v-else class="pr-content">
      <Card class="mb-4">
        <template #title>
          <div class="pr-header">
            <div class="pr-title">
              <h2>{{ pr.title }}</h2>
              <Chip :label="pr.status" :severity="pr.status === 'OPEN' ? 'info' : 'success'" class="ml-2" />
            </div>
            <div class="pr-badges">
              <Badge v-if="pr.unreadCount > 0" :value="pr.unreadCount" severity="danger" size="large" />
            </div>
          </div>
        </template>
        
        <template #subtitle>
          <div class="pr-subtitle">
            <div>Repository: <strong>{{ pr.repository }}</strong></div>
            <div>PR: <strong>#{{ pr.id }}</strong></div>
            <div>Author: <strong>{{ pr.author }}</strong></div>
            <div>Created: <strong>{{ formatDate(pr.createdOn) }}</strong></div>
            <div>Updated: <strong>{{ formatDate(pr.updatedOn) }}</strong></div>
          </div>
        </template>
        
        <template #content>
          <div class="pr-actions">
            <Button 
              icon="pi pi-external-link" 
              label="Open in Bitbucket" 
              @click="openInBrowser" 
              class="mr-2"
            />
            <Button 
              icon="pi pi-check" 
              label="Mark All as Read" 
              @click="markAllAsRead" 
              :disabled="pr.unreadCount === 0" 
              severity="success"
              class="mr-2"
            />
            <Button 
              icon="pi pi-times" 
              label="Mark All as Unread" 
              @click="markAllAsUnread" 
              :disabled="pr.unreadCount === pr.comments.length" 
              severity="danger"
            />
          </div>
        </template>
      </Card>
      
      <Card>
        <template #title>
          <div class="comments-header">
            <h3>Comments ({{ pr.comments.length }})</h3>
            <Badge v-if="pr.unreadCount > 0" :value="pr.unreadCount" severity="danger" />
          </div>
        </template>
        
        <template #content>
          <div v-if="pr.comments.length === 0" class="empty-state">
            <i class="pi pi-comments empty-icon"></i>
            <p>There are no comments on this pull request yet.</p>
          </div>
          
          <div v-else class="comments-container">
            <!-- Timeline view for comments -->
            <Timeline :value="timelineEvents" align="alternate" class="mb-4">
              <template #content="slotProps">
                <Card class="comment-card" :class="{ 'unread': !slotProps.item.comment.isRead }">
                  <template #title>
                    <div class="comment-header">
                      <div>
                        <strong>{{ slotProps.item.comment.author }}</strong>
                        <Chip 
                          :label="slotProps.item.status" 
                          :severity="slotProps.item.comment.isRead ? 'success' : 'danger'" 
                          class="ml-2" 
                          size="small"
                        />
                      </div>
                      <div class="button-group">
                        <Button 
                          v-if="!slotProps.item.comment.isRead" 
                          icon="pi pi-check" 
                          label="Mark as Read"
                          @click="markCommentAsRead(slotProps.item.comment.id)" 
                          size="small" 
                          severity="success"
                          v-tooltip.top="'Mark as read'" 
                        />
                        <Button 
                          v-else
                          icon="pi pi-times" 
                          label="Mark as Unread"
                          @click="markCommentAsUnread(slotProps.item.comment.id)" 
                          size="small" 
                          severity="danger"
                          v-tooltip.top="'Mark as unread'" 
                        />
                      </div>
                    </div>
                  </template>
                  
                  <template #subtitle>
                    <div class="comment-date">
                      {{ formatDate(slotProps.item.comment.createdOn) }}
                    </div>
                  </template>
                  
                  <template #content>
                    <div class="comment-content">
                      {{ slotProps.item.comment.content }}
                    </div>
                  </template>
                </Card>
              </template>
              
              <template #opposite="slotProps">
                <div class="comment-time">
                  {{ new Date(slotProps.item.comment.createdOn).toLocaleTimeString() }}
                </div>
              </template>
              
              <template #marker="slotProps">
                <span class="custom-marker" :style="{ backgroundColor: slotProps.item.color }">
                  <i :class="slotProps.item.icon"></i>
                </span>
              </template>
            </Timeline>
            
            <!-- Table view as alternative -->
            <DataTable 
              :value="pr.comments" 
              tableStyle="min-width: 50rem" 
              stripedRows 
              paginator 
              :rows="10"
              :rowsPerPageOptions="[5, 10, 20, 50]" 
              sortField="createdOn"
              :sortOrder="-1"
              rowHover
              responsiveLayout="scroll"
              class="comments-table"
            >
              <Column field="author" header="Author" sortable style="width: 15rem" />
              
              <Column field="content" header="Comment" style="min-width: 20rem">
                <template #body="{ data }">
                  <div :class="{ 'unread-comment': !data.isRead }">
                    {{ data.content }}
                  </div>
                </template>
              </Column>
              
              <Column field="createdOn" header="Created" sortable style="width: 12rem">
                <template #body="{ data }">
                  {{ formatDate(data.createdOn) }}
                </template>
              </Column>
              
              <Column field="isRead" header="Status" sortable style="width: 8rem">
                <template #body="{ data }">
                  <Chip 
                    :label="data.isRead ? 'Read' : 'Unread'" 
                    :severity="data.isRead ? 'success' : 'danger'" 
                  />
                </template>
              </Column>
              
              <Column header="Actions" style="width: 10rem">
                <template #body="{ data }">
                  <div class="flex justify-content-center">
                    <Button 
                      v-if="!data.isRead"
                      icon="pi pi-check" 
                      label="Mark as Read" 
                      severity="success" 
                      size="small"
                      @click="markCommentAsRead(data.id)" 
                      v-tooltip.top="'Mark as read'" 
                    />
                    <Button 
                      v-else
                      icon="pi pi-times" 
                      label="Mark as Unread"
                      severity="danger" 
                      size="small"
                      @click="markCommentAsUnread(data.id)" 
                      v-tooltip.top="'Mark as unread'" 
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.header-actions {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-top: 0.5rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.pr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pr-title {
  display: flex;
  align-items: center;
}

.pr-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
  color: #6b7280;
}

.pr-actions {
  margin-top: 1rem;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comments-container {
  margin-top: 1rem;
}

.pr-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  color: #64748b;
  margin-bottom: 1rem;
}

.comment-card {
  margin-bottom: 0;
  border-left: 3px solid #3b82f6;
}

.comment-card.unread {
  border-left-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.05);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comment-date {
  color: #6b7280;
  font-size: 0.875rem;
}

.comment-content {
  margin-top: 0.5rem;
  white-space: pre-wrap;
}

.comments-table .unread-comment {
  font-weight: bold;
}

.mb-4 {
  margin-bottom: 1.5rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.custom-marker {
  display: flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 1;
}

.custom-marker i {
  color: white;
}

.comment-time {
  color: #6b7280;
  font-size: 0.875rem;
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .pr-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .pr-badges {
    margin-top: 0.5rem;
  }
  
  .pr-subtitle {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>