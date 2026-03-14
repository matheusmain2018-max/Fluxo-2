import { Node, Edge } from 'reactflow';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
}

export type AppNode = Node & {
  workspaceId: string;
};

export type AppEdge = Edge & {
  workspaceId: string;
};

export interface Invite {
  id: string;
  workspaceId: string;
  createdBy: string;
  expiresAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
