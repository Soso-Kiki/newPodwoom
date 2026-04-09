// ═══════════════════════════════════════════════════════
//  chat.js  —  챗봇1  Pre-fetch RAG  (OpenAI 1번 호출)
//
//  흐름:
//    Q
//    └→ JS가 모든 데이터 병렬 수집 (LLM 호출 전)
//        ├ Yahoo Finance 실시간 주가  (보유 종목 전체)
//        ├ 과거 매매이력 DB           (하드코딩 배열)
//        ├ 매매일지 DB               (하드코딩 배열)
//        ├ 투자원칙                  (하드코딩 배열)
//        ├ 페르소나                  (프론트 전달값)
//        ├ 장기기억                  (Vector DB, 3일 이내)
//        └ 관련 뉴스                 (Yahoo Finance)
//    └→ system prompt 에 전부 주입
//    └→ OpenAI 1번만 호출
//    └→ A
// ═══════════════════════════════════════════════════════

import dotenv  from 'dotenv';
import OpenAI  from 'openai';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

import { addVector }                                      from '../db.js';
import { fetchStockPrice, fetchStockNews, searchMemory }  from '../agentHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ── Skills 로드 (서버 시작 시 1번만) ─────────────────────
const BASE_SYSTEM = ['index', 'trade_history', 'trade_journal', 'persona']
  .map(f => fs.readFileSync(path.join(__dirname, 'skills', `${f}.md`), 'utf-8'))
  .join('\n\n---\n\n');

// ══════════════════════════════════════════════════════════
//  데이터 — 과거 매매이력 DB (하드코딩)
// ══════════════════════════════════════════════════════════
const CURRENT_HOLDINGS = [
  { code: '005930', name: '삼성전자',   avgPrice: 67400,  qty: 15, currentPrice: 167000, profitPct: 147.8 },
  { code: '000660', name: 'SK하이닉스', avgPrice: 132000, qty: 5,  currentPrice: 198500, profitPct: 50.4  },
  { code: 'TSLA',   name: '테슬라',     avgPrice: 210.5,  qty: 3,  currentPrice: 248.9,  profitPct: 18.2  },
];

const PAST_TRADES = [
  { id:1, code:'005930', name:'삼성전자', type:'buy',  price:24800, qty:50, date:'2015-09-01', note:'중국 쇼크 폭락 구간 분할 매수 진입' },
  { id:2, code:'005930', name:'삼성전자', type:'sell', price:30200, qty:50, date:'2016-08-18', note:'갤럭시 노트7 발표 전 목표가 달성 매도', profit:270000, profitPct:21.8, holdDays:351 },
  { id:3, code:'005930', name:'삼성전자', type:'buy',  price:38500, qty:40, date:'2018-11-06', note:'반도체 업황 둔화로 주가 급락, 저점 분할 매수' },
  { id:4, code:'005930', name:'삼성전자', type:'sell', price:46200, qty:40, date:'2019-04-22', note:'1Q 실적 발표 전 목표가 도달, 전량 매도', profit:308000, profitPct:20.0, holdDays:167 },
  { id:5, code:'005930', name:'삼성전자', type:'buy',  price:42000, qty:20, date:'2021-03-15', note:'반도체 슈퍼사이클 기대 매수' },
  { id:6, code:'005930', name:'삼성전자', type:'sell', price:53000, qty:20, date:'2021-09-08', note:'목표가 달성 매도', profit:220000, profitPct:26.2, holdDays:177 },
  { id:7, code:'005930', name:'삼성전자', type:'buy',  price:58500, qty:15, date:'2022-10-12', note:'주가 저점 판단, 분할 매수 진입' },
  { id:8, code:'005930', name:'삼성전자', type:'sell', price:71200, qty:15, date:'2023-06-20', note:'단기 고점 판단, 목표가 도달 매도', profit:190500, profitPct:21.7, holdDays:251 },
];

const TRADE_JOURNAL = [
  { tradeId:2, date:'2016-08-18', stock:'삼성전자', action:'매도', reason:'목표가(30,200원) 달성 전량 매도.', emotion:'1년 보유 인내 끝 목표 달성.', lesson:'목표가를 사전에 정하면 감정에 흔들리지 않는다.' },
  { tradeId:4, date:'2019-04-22', stock:'삼성전자', action:'매도', reason:'1Q 실적 전 목표가 도달, 전량 매도.', emotion:'실적 불확실성 리스크 관리.', lesson:'이벤트 전 수익실현이 심리적으로 안정적.' },
  { tradeId:6, date:'2021-09-08', stock:'삼성전자', action:'매도', reason:'목표가(53,000원) 달성. 원칙대로 수익 실현.', emotion:'3개월 횡보 불안했지만 원칙 유지.', lesson:'목표가 사전 설정 → 감정 배제 성공.' },
  { tradeId:7, date:'2022-10-12', stock:'삼성전자', action:'매수', reason:'52주 신저가 근처 저점 판단, 분할 매수.', emotion:'저점 확신 어려워 분할로 심리 안정.', lesson:'불확실 구간에서 분할 매수가 유리.' },
  { tradeId:8, date:'2023-06-20', stock:'삼성전자', action:'매도', reason:'단기 고점 판단, 71,200원 목표가 도달 전량 매도.', emotion:'더 오를 것 같아 아쉬웠지만 원칙 지킴.', lesson:'익절선 계획 준수가 장기 수익에 유리.' },
];

const INVESTMENT_PRINCIPLES = [
  { category:'기술적',   text:'매수 전 전고점 확인 필수',    enabled:true,  threshold:null },
  { category:'자산관리', text:'한 종목 비중 20% 이내',       enabled:true,  threshold:20   },
  { category:'익절',     text:'15% 수익 도달 시 절반 익절', enabled:true,  threshold:15   },
  { category:'손절',     text:'매입가 대비 -8% 손절',       enabled:false, threshold:-8   },
];

// ══════════════════════════════════════════════════════════
//  Step 1: 모든 데이터 병렬 Pre-fetch (LLM 호출 전)
// ══════════════════════════════════════════════════════════
async function prefetchAll(userMessage) {
  const [stockQuotes, memories, news] = await Promise.all([
    // Yahoo Finance 실시간 주가 (보유 종목 전체 병렬)
    Promise.all(CURRENT_HOLDINGS.map(h => fetchStockPrice(h.code).catch(() => null))),
    // Vector DB 장기기억 (3일 이내 과거 대화)
    searchMemory(userMessage).catch(() => []),
    // Yahoo Finance 뉴스/공시
    fetchStockNews(userMessage, 3).catch(() => []),
  ]);

  return { stockQuotes, memories, news };
}

// ══════════════════════════════════════════════════════════
//  Step 2: 수집한 데이터 → system prompt 컨텍스트 블록 생성
// ══════════════════════════════════════════════════════════
function buildContextBlock(stockQuotes, memories, news, personaMD) {

  // ── 실시간 주가 (Yahoo Finance) ───────────────────────
  const stockLines = CURRENT_HOLDINGS.map((h, i) => {
    const q    = stockQuotes[i];
    const isKR = /^\d{6}$/.test(h.code);
    if (!q) return `${h.name}(${h.code}): 실시간 조회 실패 | 저장가 현재가 ${isKR ? h.currentPrice.toLocaleString()+'원' : '$'+h.currentPrice}, 수익률 +${h.profitPct}%`;
    const price = isKR ? `${Math.round(q.price).toLocaleString()}원` : `$${q.price}`;
    const sign  = q.pct >= 0 ? '+' : '';
    // Vector 저장 (비동기 — 응답 차단 없음)
    addVector(
      `yahoo_${h.code}`,
      `[Yahoo Finance 실시간] ${h.name}(${h.code}): ${price} (${sign}${q.pct}%)`,
      { code: h.code, name: h.name },
      'yahoo',
    ).catch(() => {});
    return `${h.name}(${h.code}): 현재가 ${price} (${sign}${q.pct}%), 평균매입가 ${isKR ? h.avgPrice.toLocaleString()+'원' : '$'+h.avgPrice}, 보유수익률 +${h.profitPct}%`;
  });

  // ── 과거 매매이력 DB ──────────────────────────────────
  const tradeLines = PAST_TRADES.map(t => {
    const isKR   = t.code !== 'TSLA';
    const price  = isKR ? `${t.price.toLocaleString()}원` : `$${t.price}`;
    const profit = t.profitPct ? ` → 수익률 +${t.profitPct}% (${t.holdDays}일)` : '';
    return `[${t.date}] ${t.name} ${t.type === 'buy' ? '매수' : '매도'} ${price} ${t.qty}주${profit} | ${t.note}`;
  });

  // ── 현재 보유종목 ─────────────────────────────────────
  const holdingLines = CURRENT_HOLDINGS.map(h => {
    const isKR = h.code !== 'TSLA';
    return `${h.name}(${h.code}): ${h.qty}주 | 평균매입가 ${isKR ? h.avgPrice.toLocaleString()+'원' : '$'+h.avgPrice} | 수익률 +${h.profitPct}%`;
  });

  // ── 매매일지 DB ───────────────────────────────────────
  const journalLines = TRADE_JOURNAL.map(j =>
    `[${j.date}] ${j.stock} ${j.action}: ${j.reason} | 감정: ${j.emotion} | 교훈: ${j.lesson}`
  );

  // ── 투자원칙 ──────────────────────────────────────────
  const principleLines = INVESTMENT_PRINCIPLES.map(p =>
    `[${p.category}] ${p.text}${p.threshold != null ? ` (기준: ${p.threshold}%)` : ''} ${p.enabled ? '✅' : '⏸'}`
  );

  // ── 페르소나 ──────────────────────────────────────────
  const personaBlock = personaMD?.trim()
    ? `### 👤 투자자 성향 (페르소나)\n${personaMD}`
    : '';

  // ── 장기기억 (Vector DB, 3일 이내) ───────────────────
  const memoryBlock = memories.length > 0
    ? `### 🧠 관련 과거 대화 (장기기억)\n${memories.join('\n')}`
    : '';

  // ── 뉴스/공시 ────────────────────────────────────────
  const newsBlock = news.length > 0
    ? `### 📰 관련 뉴스/공시 (Yahoo Finance)\n${news.map(n => `- ${n.title} (${n.publishedAt || n.publisher || ''})`).join('\n')}`
    : '';

  return [
    personaBlock,
    `### 📡 보유종목 실시간 주가 (Yahoo Finance)\n${stockLines.join('\n')}`,
    `### 💼 현재 보유종목\n${holdingLines.join('\n')}`,
    `### 📈 과거 매매이력 DB\n${tradeLines.join('\n')}`,
    `### 📓 매매일지 DB\n${journalLines.join('\n')}`,
    `### 🎯 투자원칙\n${principleLines.join('\n')}`,
    memoryBlock,
    newsBlock,
  ].filter(Boolean).join('\n\n');
}

// ══════════════════════════════════════════════════════════
//  메인 함수: Pre-fetch → OpenAI 1번 호출
// ══════════════════════════════════════════════════════════
export async function chat(messages, personaMD = '') {
  const userMessage = messages[messages.length - 1]?.content || '';

  // ① 모든 데이터 병렬 수집 (LLM 호출 전)
  const { stockQuotes, memories, news } = await prefetchAll(userMessage);

  // ② 수집 데이터 → 컨텍스트 블록
  const contextBlock = buildContextBlock(stockQuotes, memories, news, personaMD);

  // ③ system prompt 조합
  const personaDynamic = personaMD.trim()
    ? `\n### 현재 설정된 투자자 정보\n${personaMD}\n`
    : '';

  const systemPrompt =
    BASE_SYSTEM.replace('[PERSONA_DYNAMIC]', personaDynamic) +
    '\n\n' + contextBlock;

  // ④ OpenAI 1번만 호출 (tools 없음)
  const res = await openai.chat.completions.create({
    model:      MODEL,
    max_tokens: 1024,
    messages:   [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  return {
    text:       res.choices[0].message?.content ?? '응답을 생성하지 못했어요.',
    tools_used: [],
  };
}
