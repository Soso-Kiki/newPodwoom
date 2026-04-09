// ═══════════════════════════════════════════════════════
//  agentHelpers.js — 두 챗봇 Agent에 공통 주입되는 헬퍼
//
//  챗봇1 (cuming/chat.js) + 챗봇2 (server.js) 양쪽에서 import
//
//  제공 헬퍼:
//    fetchStockPrice  → Yahoo Finance 실시간 주가
//    fetchStockNews   → Yahoo Finance 뉴스/공시
//    searchMemory     → Vector DB (chat_history, 3일 이내)
// ═══════════════════════════════════════════════════════

import { fetchYahooQuote, fetchStockNews as _fetchStockNews } from './utils.js';
import { searchChatHistory } from './db.js';

/**
 * Yahoo Finance 실시간 주가 조회
 * @param {string} code  종목코드 (예: 005930, TSLA)
 * @returns {Promise<{code:string, price:number, change:number, pct:number, volume:number}|null>}
 */
export const fetchStockPrice = fetchYahooQuote;

/**
 * Yahoo Finance 뉴스·공시 검색 (주주총회, 실적 등)
 * @param {string} query  검색어
 * @param {number} count  최대 건수
 * @returns {Promise<Array<{title:string, publisher:string, publishedAt:string}>>}
 */
export const fetchStockNews = _fetchStockNews;

/**
 * Vector DB 장기기억 검색 (3일 이내 과거 대화)
 * @param {string} query  검색 쿼리
 * @returns {Promise<string[]>}  매칭된 과거 대화 내용 배열
 */
export async function searchMemory(query) {
  const results = await searchChatHistory(query);
  return results.length > 0 ? results.map(r => r.content) : [];
}
