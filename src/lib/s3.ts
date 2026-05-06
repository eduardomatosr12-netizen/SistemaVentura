export type S3UploadResult = {
  key: string;
  url: string;
  etag?: string;
};

export type UploadPrefix = 'lead' | 'profile' | 'task' | 'attachment' | 'document';

export const UPLOAD_PREFIXES: Record<UploadPrefix, string> = {
  lead: 'leads',
  profile: 'profiles',
  task: 'tasks',
  attachment: 'attachments',
  document: 'documents',
};
