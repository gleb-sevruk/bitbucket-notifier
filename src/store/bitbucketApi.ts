import { useConfigStore } from './configStore';
import { fetch } from '@tauri-apps/plugin-http';
import { 
  BitbucketRepo, 
  BitbucketPR, 
  BitbucketComment,
  PullRequest,
  Comment,
  Repository
} from './models';

export class BitbucketApiClient {
  private configStore = useConfigStore();

  // Get authorization header for Bitbucket API
  private async getAuthHeader(): Promise<string> {
    // Base64 encode the username:apiKey combination
    const auth = btoa(`${this.configStore.username}:${this.configStore.apiKey}`);
    return `Basic ${auth}`;
  }

  // Generic request method for Bitbucket API
  private async request<T>(endpoint: string, method = 'GET', data: any = null): Promise<T> {
    const options: any = {
      method,
      headers: {
        'Authorization': await this.getAuthHeader(),
        'Content-Type': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const baseUrl = this.configStore.baseUrl;
      const response = await fetch(`${baseUrl}/rest/api/latest${endpoint}`, options);
      console.log('Got response:', response);

      if (!response.status.toString().startsWith('2')) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      let result = await response.json();
      // This can be problematic for tauri http rust
      console.log('Response:', result);
      return result
    } catch (error) {
      console.error(`Bitbucket API error (${endpoint}):`, error);
      throw error;
    }
  }

  // Get repositories user has access to
  async getRecentRepositories(): Promise<BitbucketRepo[]> {
    const response = await this.request<{values: BitbucketRepo[]}>('/profile/recent/repos');
    return response.values;
  }

  // Get pull requests where I am a reviewer
  async getPullRequestsToReview(): Promise<BitbucketPR[]> {
    // Default Bitbucket REST API endpoint for PRs assigned to the authenticated user
    const response = await this.request<{values: BitbucketPR[]}>('/dashboard/pull-requests?state=OPEN&role=REVIEWER');
    return response.values;
  }
  
  // Get pull requests that I authored
  async getMyPullRequests(): Promise<BitbucketPR[]> {
    // Fetch PRs authored by the current user
    const response = await this.request<{values: BitbucketPR[]}>('/dashboard/pull-requests?state=OPEN&role=AUTHOR');
    return response.values;
  }

  // Get all pull requests relevant to me (both as reviewer and author)
  async getAllMyPullRequests(): Promise<BitbucketPR[]> {
    try {
      // Fetch both sets of PRs concurrently
      const [prToReview, myPrs] = await Promise.all([
        this.getPullRequestsToReview(),
        this.getMyPullRequests()
      ]);
      
      // Combine and deduplicate (in case a PR appears in both sets)
      const allPRs = [...prToReview];
      
      // Add PRs that aren't already in the array
      for (const pr of myPrs) {
        if (!allPRs.some(existingPr => existingPr.id === pr.id)) {
          allPRs.push(pr);
        }
      }
      
      return allPRs;
    } catch (error) {
      console.error('Error fetching all PRs:', error);
      throw error;
    }
  }

  // Get pull requests for a specific repository
  async getPullRequestsForRepository(projectKey: string, repoSlug: string): Promise<BitbucketPR[]> {
    const response = await this.request<{values: BitbucketPR[]}>(`/projects/${projectKey}/repos/${repoSlug}/pull-requests?state=OPEN`);
    return response.values;
  }

  // Get comments for a pull request
  async getCommentsForPullRequest(projectKey: string, repoSlug: string, prId: number): Promise<BitbucketComment[]> {
      // If the direct comments endpoint fails, try fetching activities instead
      try {
        const activities = await this.request<{values: any[]}>(`/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/activities`);
        
        // Extract comments from activities
        const commentActivities = activities.values.filter(
          activity => activity.action === 'COMMENTED' && activity.comment
        );
        
        // Process all comments, including nested replies
        const comments: BitbucketComment[] = [];
        
        // Function to process a comment and its replies recursively
        const processComment = (comment: any): BitbucketComment => {
          const commentObj: BitbucketComment = {
            id: comment.id,
            text: comment.text,
            author: comment.author,
            createdDate: comment.createdDate,
            updatedDate: comment.updatedDate || comment.createdDate
          };
          
          // Add the comment to the flat list
          comments.push(commentObj);
          
          // Process any nested replies
          if (comment.comments && Array.isArray(comment.comments)) {
            comment.comments.forEach((reply: any) => {
              processComment(reply);
            });
          }
          
          return commentObj;
        };
        
        // Process each top-level comment and its replies
        commentActivities.forEach(activity => {
          processComment(activity.comment);
        });
        
        return comments;
      } catch (activityError) {
        console.error(`Error fetching activities for PR ${prId}:`, activityError);
        // Return empty array if all attempts fail
        return [];
      }
  }

  // Convert Bitbucket PR to our internal model
  convertPullRequest(bbPR: BitbucketPR, comments: BitbucketComment[], existingPR?: PullRequest): PullRequest {
    try {
      // Safely extract repository info
      const projectKey = bbPR.toRef?.repository?.project?.key || 'UNKNOWN';
      const repoSlug = bbPR.toRef?.repository?.slug || 'unknown-repo';
      const repoPath = `${projectKey}/${repoSlug}`;

      // Safely extract author info
      let authorName = 'Unknown User';
      try {
        if (bbPR.author?.user?.displayName) {
          authorName = bbPR.author.user.displayName;
        } else if (bbPR.author?.user?.name) {
          authorName = bbPR.author.user.name;
        } else if (bbPR.author?.displayName) {
          authorName = bbPR.author.displayName;
        } else if (bbPR.author?.name) {
          authorName = bbPR.author.name;
        }
      } catch (error) {
        console.warn('Error extracting author name:', error);
      }

      // Convert comments, preserving read status from existing comments if available
      const convertedComments: Comment[] = (comments || []).map(bbComment => {
        try {
          const existingComment = existingPR?.comments.find(c => c.id === bbComment.id.toString());
          
          // Safely extract comment author
          let commentAuthor = 'Unknown User';
          if (bbComment.author?.displayName) {
            commentAuthor = bbComment.author.displayName;
          } else if (bbComment.author?.name) {
            commentAuthor = bbComment.author.name;
          }
          
          return {
            id: bbComment.id.toString(),
            content: bbComment.text || '',
            author: commentAuthor,
            createdOn: new Date(bbComment.createdDate || Date.now()).toISOString(),
            updatedOn: new Date(bbComment.updatedDate || bbComment.createdDate || Date.now()).toISOString(),
            isRead: existingComment?.isRead || false
          };
        } catch (error) {
          console.warn('Error converting comment:', error);
          // Return a placeholder comment if there's an error
          return {
            id: `error-${Math.random().toString(36).substring(7)}`,
            content: 'Error loading comment',
            author: 'Unknown',
            createdOn: new Date().toISOString(),
            updatedOn: new Date().toISOString(),
            isRead: false
          };
        }
      });

      // Get approval status from reviewers
      let approved = false;
      let approvalStatus = 'UNAPPROVED';
      
      try {
        if (bbPR.reviewers && bbPR.reviewers.length > 0) {
          // Count approved reviewers
          const approvedReviewers = bbPR.reviewers.filter(reviewer => reviewer.approved === true);
          
          // If any reviewer has approved, set approved to true
          if (approvedReviewers.length > 0) {
            approved = true;
            approvalStatus = 'APPROVED';
          }
          
          // Show partial approval if some but not all reviewers approved
          if (approvedReviewers.length > 0 && approvedReviewers.length < bbPR.reviewers.length) {
            approvalStatus = `APPROVED (${approvedReviewers.length}/${bbPR.reviewers.length})`;
          }
        }
      } catch (error) {
        console.warn('Error calculating approval status:', error);
      }

      // Create new PR or update existing, preserving comment status
      return {
        id: bbPR.id.toString(),
        title: bbPR.title || 'Untitled Pull Request',
        author: authorName,
        repository: repoPath,
        createdOn: new Date(bbPR.createdDate || Date.now()).toISOString(),
        updatedOn: new Date(bbPR.updatedDate || bbPR.createdDate || Date.now()).toISOString(),
        status: bbPR.state || 'UNKNOWN',
        comments: convertedComments,
        unreadCount: convertedComments.filter(c => !c.isRead).length,
        approved: approved,
        approvalStatus: approvalStatus
      };
    } catch (error) {
      console.error('Error converting pull request:', error);
      // Return a placeholder PR if there's an error
      return {
        id: `error-${Math.random().toString(36).substring(7)}`,
        title: 'Error loading pull request',
        author: 'Unknown',
        repository: 'unknown/unknown',
        createdOn: new Date().toISOString(),
        updatedOn: new Date().toISOString(),
        status: 'ERROR',
        comments: [],
        unreadCount: 0,
        approved: false,
        approvalStatus: 'UNKNOWN'
      };
    }
  }

  // Convert Bitbucket repository to our internal model
  convertRepository(bbRepo: BitbucketRepo, pullRequests: PullRequest[]): Repository {
    try {
      const projectKey = bbRepo.project?.key || 'UNKNOWN';
      const repoSlug = bbRepo.slug || 'unknown-repo';
      const repoPath = `${projectKey}/${repoSlug}`;
      const unreadCount = pullRequests.reduce((total, pr) => total + pr.unreadCount, 0);

      return {
        slug: repoPath,
        name: bbRepo.name || repoSlug,
        pullRequests,
        unreadCount
      };
    } catch (error) {
      console.error('Error converting repository:', error);
      // Return a placeholder repository if there's an error
      return {
        slug: 'unknown/unknown',
        name: 'Error loading repository',
        pullRequests,
        unreadCount: pullRequests.reduce((total, pr) => total + pr.unreadCount, 0)
      };
    }
  }
}