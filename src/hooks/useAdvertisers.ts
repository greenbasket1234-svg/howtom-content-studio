import { useAdvertiserContext, type Advertiser } from '../context/AdvertiserContext';

/**
 * BlogProductionPage compatibility hook.
 * Content Studio keeps one advertiser source of truth in AdvertiserContext;
 * this hook only exposes the legacy tuple shape used by the migrated blog UI.
 */
export function useAdvertisers(): [Advertiser[]] {
  const { advertisers } = useAdvertiserContext();
  return [advertisers];
}
