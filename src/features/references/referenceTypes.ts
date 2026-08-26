export type SearchResult = {
  externalId: string;
  pageId: string | null;
  pageName: string;
  body: string;
  headline: string;
  description: string;
  cta: string;
  adSnapshotUrl: string | null;
  startDate: string | null;
  isActive: boolean;
  flightDays: number | null;
  isLongRunning: boolean;
  platforms: string[];
};

export type SavedReference = {
  id: string;
  advertiserId: string | null;
  advertiserName: string | null;
  platform: string;
  externalId: string | null;
  pageName: string | null;
  isCompetitor: boolean;
  body: string; headline: string; description: string; cta: string;
  landingUrl: string | null; thumbnailUrl: string | null; adSnapshotUrl: string | null;
  startDate: string | null; isActive: boolean | null; flightDays: number | null;
  tags: string[]; memo: string | null; createdAt: string;
  boards: { boardId: string; boardName: string }[];
};

export type ReferenceBoard = { id: string; advertiserId: string | null; name: string; createdAt: string; itemCount: number };
export type Competitor = { id: string; advertiserId: string; brandName: string; pageName: string | null; createdAt: string };
