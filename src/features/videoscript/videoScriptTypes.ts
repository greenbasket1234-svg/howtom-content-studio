export type ScenePurpose = 'hook' | 'problem' | 'solution' | 'benefit' | 'proof' | 'cta' | 'other';
export type VideoScene = { sceneId: string; order: number; startSecond: number; endSecond: number; purpose: ScenePurpose; visual?: string; narration?: string; caption?: string };
export type VideoScriptProject = {
  projectId: string;
  title: string;
  advertiserId: string;
  advertiserName: string;
  videoType: string;
  targetSeconds: number;
  ratio: string;
  keyMessage: string;
  cta: string;
  scenes: VideoScene[];
  status: 'draft' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
};
