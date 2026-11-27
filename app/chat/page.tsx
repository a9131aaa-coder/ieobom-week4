import type { Metadata } from 'next';
import ChatClient from './ChatClient';

export const metadata: Metadata = {
  title: '기록 챗봇 — 입어봄',
  description: '저장된 코디 기록을 검색하고, 실제 기록을 근거로 답하는 입어봄 기록 챗봇입니다.',
};

export default function ChatPage() {
  return (
    <>
      <link rel="stylesheet" href="/chat.css" />
      <ChatClient />
    </>
  );
}
