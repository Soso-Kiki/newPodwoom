// ═══════════════════════════════════════════════════════
//  utils.js — 공유 유틸리티 (server.js + cuming/chat.js 공용)
// ═══════════════════════════════════════════════════════

export const YAHOO_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1)';

/**
 * Yahoo Finance 단일 종목 현재가 조회
 * @param {string} code  종목코드 (예: 005930, TSLA)
 * @returns {Promise<{code:string, price:number, change:number, pct:number, volume:number}|null>}
 */
export async function fetchYahooQuote(code) {
  try {
    const sym = /^\d{6}$/.test(code) ? `${code}.KS` : code;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`;
    const r   = await fetch(url, { headers: { 'User-Agent': YAHOO_UA } });
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price     = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change    = parseFloat((price - prevClose).toFixed(2));
    const pct       = parseFloat(((change / prevClose) * 100).toFixed(2));
    return { code, price, change, pct, volume: meta.regularMarketVolume || 0 };
  } catch {
    return null;
  }
}

/**
 * Yahoo Finance 종목 관련 뉴스·공시 검색
 * @param {string} query  검색어 (종목명, 이벤트명 등. 예: "삼성전자 주주총회")
 * @param {number} count  최대 뉴스 건수 (기본 5)
 * @returns {Promise<Array<{title:string, publisher:string, publishedAt:string}>>}
 */
export async function fetchStockNews(query, count = 5) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${count}&lang=ko-KR&region=KR`;
    const r   = await fetch(url, { headers: { 'User-Agent': YAHOO_UA } });
    const data = await r.json();
    const news = data?.news || [];
    return news.slice(0, count).map(n => ({
      title:       n.title,
      publisher:   n.publisher,
      publishedAt: new Date((n.providerPublishTime || 0) * 1000).toLocaleDateString('ko-KR'),
    }));
  } catch {
    return [];
  }
}
