/**
 * studioHelpers.mjs – Content Studio 보안 순수 함수 모음
 *
 * server.mjs 와 테스트 코드가 동일한 구현을 공유하도록
 * 부작용 없는 순수 함수만 이 파일에 모읍니다.
 */

/**
 * ctx.advertiserIds가 null이면 전체 허용(owner/admin),
 * 배열이면 그 안에 포함될 때만 허용합니다.
 */
export function ctxCanAccessAdvertiser(ctx, advertiserId) {
  if (!ctx || !advertiserId) return false;
  if (ctx.advertiserIds === null) return true;
  return ctx.advertiserIds.includes(advertiserId);
}

/**
 * 레코드의 advertiser_id 기준으로 접근 가능 여부를 확인합니다.
 *  - advertiser_id === null 인 고아 데이터: owner(advertiserIds===null)만 접근 가능
 *  - advertiser_id !== null : ctxCanAccessAdvertiser 로 위임
 */
export function canAccessRecord(recordAdvertiserId, payload) {
  if (recordAdvertiserId === null || recordAdvertiserId === undefined) {
    return payload.advertiserIds === null;
  }
  return ctxCanAccessAdvertiser(payload, recordAdvertiserId);
}

/**
 * scope된 사용자가 공용 템플릿(advertiserId=null)을 복제할 때
 * 담당 광고주를 강제 지정합니다.
 * @returns 적용할 advertiserId (null 가능)
 */
export function forceAdvertiserIfPublicTemplate(sourceAdvertiserId, payload) {
  if (payload.advertiserIds !== null && !sourceAdvertiserId) {
    return payload.advertiserIds[0] || null;
  }
  return sourceAdvertiserId || null;
}

/**
 * 오버에지 처리 임대(lease)가 획득되었는지 확인합니다.
 * atomic UPDATE … RETURNING 이 반환한 행 수가 1 이상이면 획득 성공.
 */
export function acquireOverageLease(lockRowCount) {
  return lockRowCount > 0;
}
