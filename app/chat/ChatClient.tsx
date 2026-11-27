'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Source = {
  id: string;
  title: string;
  date: string;
  content: string;
  similarity: number;
  thumbnail?: string;
};

type Metrics = {
  embeddingMs: number;
  searchMs: number;
  generationMs: number;
  totalMs: number;
  embeddingTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  retrievedCount?: number;
  topSimilarity?: number | null;
};

type ChatResponse = {
  status: 'answered' | 'no_evidence' | 'fallback';
  answer: string;
  sources: Source[];
  fallback: boolean;
  reason: string | null;
  metrics: Metrics;
  model: string;
  embeddingModel: string;
};

const examples = [
  { label: '니트와 로퍼', question: '크림 니트와 로퍼를 함께 쓴 코디를 찾아줘.' },
  { label: '친구와 카페', question: '친구와 카페에 갈 때 참고할 코디 기록이 있어?' },
  { label: '재킷과 데님', question: '재킷과 데님을 조합한 기록을 보여줘.' },
];

function Icon({ children }: { children: ReactNode }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const navigation = [
  { href: '/#home', label: '홈 대시보드', icon: <Icon><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon> },
  { href: '/#wardrobe', label: '내 옷장', icon: <Icon><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18M9 11v2M15 11v2" /></Icon> },
  { href: '/#consult', label: '코디 상담', icon: <Icon><path d="M21 12a9 9 0 0 1-9 9c-2 0-3-1-4-1l-5 1 1-5a9 9 0 1 1 17-4Z" /><path d="M8 10h8M8 14h5" /></Icon> },
  { href: '/#history', label: '착용 기록', icon: <Icon><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h6" /></Icon> },
  { href: '/#profile', label: '스타일 프로필', icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></Icon> },
  { href: '/chat', label: '기록 챗봇', icon: <Icon><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3M8 7h3M7 11h4M7 15h5" /><circle cx="17" cy="7" r="4" /><path d="m20 10 2 2" /></Icon> },
];

function isChatResponse(value: unknown): value is ChatResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ChatResponse>;
  if (!['answered', 'no_evidence', 'fallback'].includes(data.status ?? '') || typeof data.answer !== 'string' || !data.answer.trim() || !Array.isArray(data.sources)) return false;
  if (!data.sources.every(source => source && typeof source.id === 'string' && typeof source.title === 'string' && typeof source.date === 'string' && typeof source.content === 'string' && Number.isFinite(source.similarity))) return false;
  return data.status !== 'answered' || data.sources.length > 0;
}

function safeThumbnail(value?: string) {
  return typeof value === 'string' && /^\/images\/[a-z\d][a-z\d._-]*\.(?:webp|png|jpe?g|avif)$/i.test(value) ? value : undefined;
}

function displayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll('-', '.') : '날짜 미기록';
}

function sourceExcerpt(content: string) {
  return content.split('\n').filter(line => !/^(?:프로필|기록 ID|제목|날짜):\s*/.test(line)).join('\n').trim();
}

function measure(value: number | null | undefined, unit: string) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${Math.round(value).toLocaleString('ko-KR')}${unit}` : '미제공';
}

function ResponseInfo({ response }: { response: ChatResponse }) {
  const metrics = response.metrics;
  return (
    <details className="chat-response-info">
      <summary>응답 정보</summary>
      <dl>
        <div><dt>질문 임베딩</dt><dd>{measure(metrics?.embeddingMs, ' ms')}</dd></div>
        <div><dt>기록 검색</dt><dd>{measure(metrics?.searchMs, ' ms')}</dd></div>
        <div><dt>답변 생성</dt><dd>{measure(metrics?.generationMs, ' ms')}</dd></div>
        <div><dt>전체 시간</dt><dd>{measure(metrics?.totalMs, ' ms')}</dd></div>
        <div><dt>임베딩 토큰</dt><dd>{measure(metrics?.embeddingTokens, '')}</dd></div>
        <div><dt>입력 / 출력 토큰</dt><dd>{measure(metrics?.inputTokens, '')} / {measure(metrics?.outputTokens, '')}</dd></div>
        <div><dt>추론 토큰</dt><dd>{measure(metrics?.thinkingTokens, '')}</dd></div>
        <div><dt>검색 후보 수</dt><dd>{measure(metrics?.retrievedCount, '개')}</dd></div>
        <div><dt>최고 검색 유사도</dt><dd>{typeof metrics?.topSimilarity === 'number' && Number.isFinite(metrics.topSimilarity) ? `${Math.round(metrics.topSimilarity * 100)}%` : '미제공'}</dd></div>
        <div><dt>답변 모델</dt><dd>{typeof response.model === 'string' ? response.model : '미제공'}</dd></div>
        <div><dt>임베딩 모델</dt><dd>{typeof response.embeddingModel === 'string' ? response.embeddingModel : '미제공'}</dd></div>
        <div><dt>대체 안내 응답</dt><dd>{response.fallback ? '예' : '아니요'}</dd></div>
      </dl>
      <p>제공되지 않은 사용량은 추정하지 않습니다.</p>
    </details>
  );
}

export default function ChatClient() {
  const [question, setQuestion] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  useEffect(() => {
    if (response || error) resultHeading.current?.focus();
  }, [response, error]);

  async function ask(rawQuestion: string) {
    if (activeRequest.current) return;
    const text = rawQuestion.trim();
    if (!text || text.length > 300) {
      setResponse(null);
      setLastQuestion('');
      setError('질문을 1~300자로 입력해 주세요.');
      textarea.current?.focus();
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    setLoading(true);
    setError('');
    setResponse(null);
    setLastQuestion(text);
    try {
      const result = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
        signal: controller.signal,
      });
      const data: unknown = await result.json().catch(() => null);
      if (activeRequest.current !== controller) return;
      if (!result.ok) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '';
        throw new Error(result.status >= 400 && result.status < 500 && message ? message : '연결이 원활하지 않아 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      if (!isChatResponse(data)) throw new Error('답변과 근거를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setResponse(data);
    } catch (caught) {
      if (activeRequest.current !== controller) return;
      setError(controller.signal.aborted
        ? '응답을 기다리는 시간이 길어졌어요. 다시 시도하거나 다른 질문을 입력해 주세요.'
        : caught instanceof Error && caught.name !== 'TypeError' ? caught.message : '연결이 원활하지 않아 답변을 가져오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  const sources = response?.status === 'answered' ? response.sources : [];

  return (
    <>
      <a className="skip-link" href="#main-content">본문 바로가기</a>
      <div className="app-shell chat-shell">
        <aside className="sidebar">
          <a href="/#home" className="wordmark">입어봄<span>.</span><small>YOUR EVERYDAY EDIT</small></a>
          <div className="sidebar-label">MY STYLE SPACE</div>
          <nav aria-label="주 메뉴">{navigation.map(item => <a key={item.href} href={item.href} className={`nav-item${item.href === '/chat' ? ' active' : ''}`} aria-current={item.href === '/chat' ? 'page' : undefined}>{item.icon}<span>{item.label}</span></a>)}</nav>
          <div className="sidebar-foot"><span /><p>새로 사기 전에,<br />내 옷으로 한 번 더.</p><small>WEEK 08 · STYLE ARCHIVE</small></div>
        </aside>
        <div className="workspace">
          <header className="topbar"><span className="breadcrumb">MY STYLE <i>/</i> <b>기록 챗봇</b></span><span className="pill">수업용 시제품</span></header>
          <main id="main-content" className="chat-main" tabIndex={-1}>
            <div className="chat-heading">
              <span className="eyebrow">ASK YOUR STYLE ARCHIVE</span>
              <h1>내 코디 기록에<br className="chat-mobile-break" /> 물어보세요<span>.</span></h1>
              <p>기억이 가물가물한 조합도, 다시 입고 싶은 스타일도.<br />저장된 코디 기록을 찾아 근거와 함께 답해요.</p>
            </div>

            <div className="chat-scope"><span className="chat-scope-label">검색 범위</span><p><strong>공통 예시 코디 기록</strong>을 검색합니다. 이 브라우저에서 개인적으로 추가·수정한 기록은 포함되지 않아요.</p></div>

            <form className="chat-form" onSubmit={submit} aria-busy={loading}>
              <label htmlFor="chat-question">어떤 코디가 궁금한가요?</label>
              <p id="chat-question-help" className="chat-form-help">질문마다 새로 검색해요. 이전 답변을 기억하지 않으니 옷이나 상황을 구체적으로 적어 주세요.</p>
              <div className="chat-examples" aria-label="예시 질문">{examples.map(example => <button type="button" key={example.label} title={example.question} aria-label={`예시 질문: ${example.question}`} disabled={loading} onClick={() => { setQuestion(example.question); setError(''); textarea.current?.focus(); }}>{example.label}<span aria-hidden="true">↗</span></button>)}</div>
              <textarea ref={textarea} id="chat-question" name="question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={300} rows={3} required disabled={loading} aria-describedby="chat-question-help chat-question-count" placeholder="예: 니트와 함께 입을 하의를 고른 코디 기록이 있어?" />
              <div className="chat-form-bottom"><span id="chat-question-count">{question.length} / 300자</span><button className="button chat-submit" type="submit" disabled={loading || !question.trim()}>{loading ? '기록을 찾고 있어요…' : '기록에 물어보기'}{!loading && <span aria-hidden="true">↗</span>}</button></div>
            </form>

            {loading && <div className="chat-loading" role="status"><span aria-hidden="true" /><p>질문과 비슷한 기록을 찾아 답변을 준비하고 있어요.</p></div>}

            {!loading && !response && !error && <div className="chat-start-note"><Icon><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></Icon><p>기록에 없는 내용은 찾지 못했다고 알려드려요.<br /><span>새로운 코디를 제안받고 싶다면 <a href="/#consult">코디 상담</a>을 이용해 주세요.</span></p></div>}

            {!loading && (response || error) && <section className={`chat-result${error || response?.status === 'fallback' ? ' chat-result-failed' : ''}`} aria-labelledby="chat-result-title" aria-live="polite">
              <div className="chat-result-top"><span className="eyebrow">{error || response?.status === 'fallback' ? 'PLEASE TRY AGAIN' : response?.status === 'no_evidence' ? 'NO MATCHING EVIDENCE' : 'FROM YOUR STYLE ARCHIVE'}</span><h2 id="chat-result-title" tabIndex={-1} ref={resultHeading}>{error || response?.status === 'fallback' ? '답변을 가져오지 못했어요' : response?.status === 'no_evidence' ? '답할 수 있는 기록을 찾지 못했어요' : '기록에서 찾은 답변'}</h2></div>
              {lastQuestion && <p className="chat-asked-question"><span>질문</span>{lastQuestion}</p>}
              <p className="chat-answer">{error || response?.answer}</p>
              {(error || response?.status === 'fallback') && <button className="button secondary small" type="button" onClick={() => void ask(lastQuestion || question)}>같은 질문 다시 시도</button>}
              {response?.status === 'no_evidence' && <p className="chat-no-evidence-note">질문에 답할 근거가 없어 출처 카드를 표시하지 않았어요. 다른 옷이나 상황으로 질문해 보세요.</p>}

              {sources.length > 0 && <div className="chat-sources"><div className="chat-sources-heading"><h3>답변에 사용한 코디 기록 <span>{sources.length}</span></h3><p>정답 확률이 아닌 질문과 기록의 유사도</p></div><div className="chat-source-grid">{sources.map(source => {
                const thumbnail = safeThumbnail(source.thumbnail);
                return <article className={`chat-source-card${thumbnail ? ' has-image' : ''}`} key={source.id}>
                  {thumbnail && <img src={thumbnail} alt="" width="120" height="150" loading="lazy" />}
                  <div className="chat-source-body"><div className="chat-source-meta"><time dateTime={/^\d{4}-\d{2}-\d{2}$/.test(source.date) ? source.date : undefined}>{displayDate(source.date)}</time><span>유사도 {Math.round(source.similarity * 100)}%</span></div><h4>{source.title}</h4><p>{sourceExcerpt(source.content)}</p></div>
                </article>;
              })}</div><a className="chat-archive-link" href="/#history">전체 코디 기록 보기 <span aria-hidden="true">↗</span></a></div>}
              {response && <ResponseInfo response={response} />}
            </section>}

            <footer className="page-footer chat-footer"><p>공통 데이터는 수업용 예시입니다. 답변은 검색한 기록을 바탕으로 하며, 전체 기록의 개수를 집계하지 않습니다.</p><a href="/#home">홈 대시보드로 ↗</a></footer>
          </main>
        </div>
      </div>
    </>
  );
}
