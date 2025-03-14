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

// Bitbucket API response types
export interface BitbucketRepo {
  slug: string;
  name: string;
  project: {
    key: string;
    name: string;
  };
  [key: string]: any; // For any additional fields
}

export interface BitbucketPR {
  id: number;
  version?: number;
  title: string;
  description?: string;
  state: string;
  open?: boolean;
  closed?: boolean;
  draft?: boolean;
  createdDate: number; // Unix timestamp
  updatedDate: number; // Unix timestamp
  fromRef?: {
    id?: string;
    displayId?: string;
    latestCommit?: string;
    type?: string;
    repository?: {
      slug: string;
      id?: number;
      name?: string;
      project?: {
        key: string;
        id?: number;
        name?: string;
        type?: string;
      };
      [key: string]: any;
    };
  };
  toRef: {
    id?: string;
    displayId?: string;
    latestCommit?: string;
    type?: string;
    repository: {
      slug: string;
      id?: number;
      name?: string;
      project: {
        key: string;
        id?: number;
        name?: string;
        type?: string;
      };
      [key: string]: any;
    };
  };
  locked?: boolean;
  author: {
    name: string;
    displayName: string;
    user: {
      name: string;
      emailAddress?: string;
      active?: boolean;
      displayName?: string;
      id?: number;
      slug?: string;
      type?: string;
    };
    role?: string;
    approved?: boolean;
    status?: string;
  };
  reviewers?: Array<{
    user: {
      name: string;
      emailAddress?: string;
      active?: boolean;
      displayName?: string;
      id?: number;
      slug?: string;
      type?: string;
    };
    role?: string;
    approved?: boolean;
    status?: string;
  }>;
  participants?: Array<any>;
  properties?: {
    mergeResult?: {
      outcome?: string;
      current?: boolean;
    };
    resolvedTaskCount?: number;
    commentCount?: number;
    openTaskCount?: number;
  };
  [key: string]: any; // For any additional fields
}

export interface BitbucketComment {
  id: number;
  version?: number;
  text: string;
  author: {
    name: string;
    emailAddress?: string;
    active?: boolean;
    displayName?: string;
    id?: number;
    slug?: string;
    type?: string;
    [key: string]: any;
  };
  createdDate: number; // Unix timestamp
  updatedDate: number; // Unix timestamp
  comments?: BitbucketComment[]; // For nested replies
  threadResolved?: boolean;
  severity?: string;
  state?: string;
  permittedOperations?: {
    deletable?: boolean;
    editable?: boolean;
    transitionable?: boolean;
    [key: string]: any;
  };
  anchors?: Array<{
    id?: number;
    fileType?: string;
    path?: string;
    lineType?: string;
    fromHash?: string;
    toHash?: string;
    line?: number;
    [key: string]: any;
  }>;
  [key: string]: any; // For any additional fields
}

export interface BitbucketActivity {
  id: number;
  createdDate: number;
  user: {
    name: string;
    emailAddress?: string;
    active?: boolean;
    displayName?: string;
    id?: number;
    slug?: string;
    type?: string;
    [key: string]: any;
  };
  action: string; // COMMENTED, OPENED, MERGED, etc.
  comment?: BitbucketComment;
  commentAnchor?: {
    fromHash?: string;
    toHash?: string;
    line?: number;
    lineType?: string;
    fileType?: string;
    path?: string;
    srcPath?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface BitbucketApiError {
  statusCode: number;
  message: string;
}