export type AdProjectStatus = 'draft' | 'in-progress' | 'review' | 'completed' | 'archived';

export type AdCopyVariant = {
  variantId: string;
  label: string;
  headline: string;
  description: string;
  body: string;
  cta: string;
};

export type AdImagePlan = {
  visualType: string;
  subject: string;
  background: string;
  mainText: string;
  subText: string;
  ratio: string;
  textRatio: string;
};

export type AdVideoPlan = {
  length: string;
  style: string;
  hook3s: string;
  scenes: string;
  endingCta: string;
};

export type AdProject = {
  projectId: string;
  title: string;
  advertiserId: string;
  advertiserName: string;
  channel: string;
  objective: string;
  creativeType: string;
  representativeKpi: string;
  target: string;
  keyBenefit: string;
  price: string;
  mandatoryText: string;
  prohibitedText: string;
  landingUrl: string;
  format: string;
  hookType: string;
  hooks: string[];
  copyVariants: AdCopyVariant[];
  imagePlan: AdImagePlan;
  videoPlan: AdVideoPlan;
  referenceIds: string[];
  resultAssetIds: string[];
  status: AdProjectStatus;
  createdAt: string;
  updatedAt: string;
};
