import { randomUUID } from 'node:crypto';
import {
  AccountError, accountErrorResponse, accountJson, checkedId, instagramPublishConfig,
  readAccountBody, verifyAccountContext,
} from './account-data.mjs';

const providerId = /^[0-9]{1,30}$/;
const pendingError = (status = 409) => new AccountError(
  '인스타그램 게시 결과를 확인 중이에요. 중복 게시를 막기 위해 다시 보내지 않았어요.', status, 'publication_pending',
);

/** @param {{getContext: () => Promise<import('./supabase/server').AccountContext>, env?: NodeJS.ProcessEnv, fetcher?: typeof fetch}} options */
export function createInstagramPublishHandler({ getContext, env = process.env, fetcher = fetch }) {
  return async request => {
    let account;
    try {
      account = await getContext();
      const { client, user } = verifyAccountContext(account, request, { mutation: true });
      const config = instagramPublishConfig(env);
      if (!config || config.ownerId !== user.id) {
        throw new AccountError('이 계정에서 인스타그램 게시를 사용할 수 없어요.', 403, 'instagram_unavailable');
      }

      const body = await readAccountBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('id' in body)) {
        throw new AccountError('게시할 코디를 선택해 주세요.', 400, 'invalid_input');
      }
      const recordId = checkedId(body.id);
      const { data: outfit, error: outfitError } = await client.from('ieobom_user_outfits').select('title,description')
        .eq('id', recordId).eq('user_id', user.id).maybeSingle().abortSignal(AbortSignal.timeout(8000));
      if (outfitError) throw new AccountError('코디 기록을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', 503, 'storage_unavailable');
      if (!outfit) throw new AccountError('내 코디 기록을 찾지 못했어요.', 404, 'not_found');
      const claim = { outfit_id: recordId, claim_token: randomUUID() };
      const { data: reservation, error } = await client.rpc('ieobom_instagram_claim', claim).abortSignal(AbortSignal.timeout(8000));
      if (error) {
        throw new AccountError('게시를 준비하지 못했어요. 인스타그램 연결을 확인해 주세요.', 503, 'instagram_unavailable');
      }
      if (reservation?.status === 'published') {
        throw new AccountError('이미 인스타그램에 게시한 코디예요.', 409, 'already_published');
      }
      if (reservation?.status === 'publishing') throw pendingError();
      if (reservation?.status === 'not_found') {
        throw new AccountError('내 코디 기록을 찾지 못했어요.', 404, 'not_found');
      }
      if (reservation?.status !== 'claimed') throw pendingError(502);

      // The remote action can have succeeded if its response is lost. Keep the reservation in every ambiguous case.
      let postId;
      try {
        const response = await fetcher(config.webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ieoga-secret': config.secret },
          body: JSON.stringify({ image_url: config.imageUrl, caption: `${outfit.title}\n\n${outfit.description}\n\n#입어봄` }),
          redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000),
        });
        if (response.ok) {
          const result = await response.json();
          if (typeof result?.id === 'string' && providerId.test(result.id)) postId = result.id;
        }
      } catch { /* A timeout or network failure does not confirm that Instagram skipped publishing. */ }
      if (!postId) throw pendingError(502);

      // Retry recording the receipt only. The webhook is never invoked again for this record.
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await client.rpc('ieobom_instagram_finish', { ...claim, provider_post_id: postId })
          .abortSignal(AbortSignal.timeout(5000)).then(value => value, () => null);
        if (result?.data?.status === 'published' && result.data.post_id === postId && typeof result.data.posted_at === 'string') {
          return account.apply(accountJson({ instagramPublishStatus: 'published', instagramPostId: postId, instagramPostedAt: result.data.posted_at }));
        }
      }
      throw pendingError(502);
    } catch (error) {
      const response = accountErrorResponse(error);
      return account?.apply ? account.apply(response) : response;
    }
  };
}
