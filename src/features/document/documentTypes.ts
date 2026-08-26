export type DocumentBlockType = 'paragraph' | 'h1' | 'h2' | 'callout';
export type DocumentBlock = { blockId: string; type: DocumentBlockType; title?: string; text?: string };
export type DocumentProject = {
  projectId: string;
  title: string;
  advertiserId: string;
  advertiserName: string;
  documentType: string;
  blocks: DocumentBlock[];
  status: 'draft' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
};
