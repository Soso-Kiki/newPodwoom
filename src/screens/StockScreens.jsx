// ═══════════════════════════════════════
//  StockScreens.jsx  —  홈 · 주문 · 메뉴
// ═══════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import { createChart, CandlestickSeries, ColorType, createSeriesMarkers } from "lightweight-charts";
import {
  MENU_ITEMS, PODIUM_TOP, ORDER_STOCKS, RANKING_STOCKS,
  YAHOO_STOCK_URL, toYahooSymbol, toTVSymbol, CURRENT_HOLDINGS, PAST_TRADES,
  GPT_API_URL, GPT_DEFAULT_MODEL,
} from "../data";
import { Char3D, Podium, OrderAdviceModal } from "../components";

// ══════════════════════════════════════════════
//  실시간 시세 훅
//  - Yahoo Finance API 폴링 (API 키 불필요)
//  - 응답 실패 시 목업 시뮬레이션 (±0.3% 랜덤 틱) 폴백
// ══════════════════════════════════════════════
function useRealtimeQuotes(symbols, intervalMs = 4000) {
  const [quotes, setQuotes] = useState({});
  const timerRef = useRef(null);

  const fetchOne = useCallback(async (symbol) => {
    try {
      const yahooSym = toYahooSymbol(symbol);
      const url = `${YAHOO_STOCK_URL}/v8/finance/chart/${yahooSym}?interval=1m&range=1d`;
      const res  = await fetch(url);
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || !meta.regularMarketPrice) return null;
      const price     = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      const change    = parseFloat((price - prevClose).toFixed(2));
      const pct       = parseFloat(((change / prevClose) * 100).toFixed(2));
      return { price, change, pct, volume: meta.regularMarketVolume || 0 };
    } catch { return null; }
  }, []);

  useEffect(() => {
    // Yahoo Finance 폴링 + 실패 시 목업 폴백
    const refresh = async () => {
      const results = await Promise.all(symbols.map(async sym => {
        const q = await fetchOne(sym);
        return [sym, q];
      }));
      setQuotes(prev => {
        const next = { ...prev };
        results.forEach(([sym, q]) => {
          if (q) {
            // Yahoo Finance 성공
            const prevPrice = prev[sym]?.price ?? q.price;
            next[sym] = { ...q, flash: q.price > prevPrice ? "up" : q.price < prevPrice ? "down" : null };
          } else {
            // 폴백: 목업 시뮬레이션
            const base = ORDER_STOCKS.find(s => s.code === sym)
                      || RANKING_STOCKS.find(s => s.code === sym);
            const basePrice = prev[sym]?.price ?? (base?.price ?? 100);
            const delta    = (Math.random() - 0.495) * basePrice * 0.003;
            const newPrice = Math.round((basePrice + delta) * 100) / 100;
            const change   = parseFloat((newPrice - (base?.price ?? basePrice)).toFixed(2));
            const pct      = parseFloat(((change / (base?.price ?? basePrice)) * 100).toFixed(2));
            next[sym] = { price: newPrice, change, pct, flash: delta > 0 ? "up" : "down" };
          }
        });
        return next;
      });
    };
    refresh();
    timerRef.current = setInterval(refresh, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [symbols.join(",")]);

  return quotes;
}

// ── 실시간 점멸 인디케이터 ────────────────────
function LiveDot() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(p => !p), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%",
      background: on ? "#4ADE80" : "rgba(74,222,128,0.2)",
      boxShadow: on ? "0 0 6px #4ADE80" : "none",
      transition: "all 0.3s",
    }} />
  );
}

// ══════════════════════════════════════════════
//  차트 컴포넌트 — 한국주식 / 미국주식 분기
// ══════════════════════════════════════════════

// 한국 주식: Yahoo Finance 일봉 (항상 가능)
const KR_PERIODS = [
  { label:"1일", interval:"5m",  range:"1d"  },
  { label:"1주", interval:"1d",  range:"5d"  },
  { label:"1달", interval:"1d",  range:"1mo" },
  { label:"6달", interval:"1d",  range:"6mo" },
  { label:"1년",  interval:"1d",  range:"1y"  },
  { label:"5년",  interval:"1wk", range:"5y"  },
  { label:"10년", interval:"1mo", range:"10y" },
];

// 미국 주식: TradingView
const TV_INTERVALS = ["5", "60", "D", "W"];
const TV_PERIODS   = ["1일","1주","1달","3달"];

// 진입점: 종목 코드에 따라 렌더러 분기
function StockChart({ symbol }) {
  return /^\d{6}$/.test(symbol)
    ? <KRStockChart symbol={symbol} />
    : <TVStockChart symbol={symbol} />;
}

// 기간 버튼 → 보여줄 범위(일수)
const PERIOD_DAYS = { 0:1, 1:5, 2:30, 3:180, 4:365, 5:1825, 6:3650 };

// 날짜 문자열에서 N일 전 날짜 계산
function subtractDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
// 날짜 문자열에서 N일 후 날짜 계산
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// Unix timestamp(초) → "YYYY-MM-DD"
function tsToDate(t) {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

// ── 차트 유사도 분석 ──────────────────────────
// 캔들 배열에서 날짜 범위 슬라이스
function sliceByDate(candles, from, to) {
  return candles.filter(c => c.time >= from && c.time <= to);
}
// 가격 배열 → 수익률 배열 정규화 (첫 가격 기준)
function normalizeReturns(candles) {
  if (candles.length === 0) return [];
  const base = candles[0].close;
  return candles.map(c => (c.close - base) / base * 100);
}
// 피어슨 상관계수 (-1 ~ 1)
function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ax = a.slice(0, n), bx = b.slice(0, n);
  const ma = ax.reduce((s, v) => s + v, 0) / n;
  const mb = bx.reduce((s, v) => s + v, 0) / n;
  const num = ax.reduce((s, v, i) => s + (v - ma) * (bx[i] - mb), 0);
  const da  = Math.sqrt(ax.reduce((s, v) => s + (v - ma) ** 2, 0));
  const db  = Math.sqrt(bx.reduce((s, v) => s + (v - mb) ** 2, 0));
  if (da === 0 || db === 0) return 0;
  return num / (da * db);
}
// 날짜 차이 (일수)
function dateDiffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// 매수-매도 쌍 추출 및 유사도 계산
function calcSimilarities(symbol, candles) {
  const trades = PAST_TRADES.filter(t => t.code === symbol);
  const pairs = [];
  // 매수-매도 쌍 매칭 (id 순서대로 같은 종목의 buy→sell)
  const buys = trades.filter(t => t.type === "buy");
  const sells = trades.filter(t => t.type === "sell");
  buys.forEach(buy => {
    // 같은 종목에서 매수 이후 가장 가까운 매도 찾기
    const sell = sells.find(s => s.date > buy.date);
    if (!sell) return;
    const holdDays = dateDiffDays(buy.date, sell.date);
    // 윈도우 결정: 20일 이하면 매수일 -20일, 초과면 매수일
    // k=30이 최적값 (2000회×3시나리오 AUC 시뮬레이션, 평균AUC 0.8347)
    const windowFrom = holdDays <= 20 ? subtractDays(buy.date, 20) : buy.date;
    const windowTo   = sell.date;
    const pastSlice  = sliceByDate(candles, windowFrom, windowTo);
    if (pastSlice.length < 2) return;
    const windowLen = pastSlice.length;
    // 현재 최근 같은 길이 패턴
    const recent = candles.slice(-windowLen);
    const pastReturns    = normalizeReturns(pastSlice);
    const currentReturns = normalizeReturns(recent);
    const score = pearson(pastReturns, currentReturns);
    const pct = Math.round((score + 1) / 2 * 100); // -1~1 → 0~100%
    pairs.push({
      buyDate:  buy.date,
      sellDate: sell.date,
      holdDays,
      windowFrom,
      windowTo,
      mode: holdDays <= 20 ? "단기(매수-20일)" : "전체기간",
      score: pct,
      profit: sell.profit ?? null,
      profitPct: sell.profitPct ?? null,
      note: sell.note,
    });
  });
  return pairs;
}

// ── 차트 데이터 캐시 (중복 API 요청 방지) ──
const _diaryChartCache = {};

// ── 패턴별 마커 색상 ──
const _patternColor = (grade, type) => {
  if (type === "buy")  return grade === "좋음" ? "#10b981" : grade === "아쉬움" ? "#f59e0b" : "#FF6B8A";
  return grade === "좋음" ? "#10b981" : grade === "아쉬움" ? "#ef4444" : "#4FC3FF";
};
// 매수 패턴별 — 어떤 캔들 구간에 하이라이트를 줄지
const _buyZoneRule = (patternName) => {
  if (!patternName) return null;
  const n = patternName;
  if (["눌림목_진입","지지선_반등","저점_분할매수"].some(p => n.includes(p.split("_")[0])))
    return { offset: -4, count: 4, pos: "aboveBar" }; // 매수 직전 4봉 (하락→눌림목)
  if (n.includes("횡보_돌파") || n.includes("횡보"))
    return { offset: -5, count: 5, pos: "aboveBar" }; // 매수 직전 5봉 (횡보 구간)
  if (n.includes("급등_추격") || n.includes("급등"))
    return { offset: -4, count: 4, pos: "aboveBar" }; // 매수 직전 4봉 (급등 구간)
  return null;
};
const _sellZoneRule = (patternName) => {
  if (!patternName) return null;
  const n = patternName;
  if (["추세_이탈_손절","늦은_손절","패닉_손절"].some(p => n.includes(p.split("_")[0])))
    return { offset: 0, count: 3, pos: "aboveBar" }; // 매도 이후 3봉 (하락 지속)
  return null;
};

// ── 매매일지 미니 차트 (매수~매도 구간 + 패턴 하이라이트) ──
function DiaryMiniChart({ stock, buyDate: buyDateProp, sellDate: sellDateProp, buyPattern, sellPattern }) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const markersRef    = useRef(null);
  const candlesRef    = useRef(null);
  const buyDateRef    = useRef(null);
  const sellDateRef   = useRef(null);
  const fallbackRef   = useRef(false);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData]   = useState(false);

  // 마커 업데이트 함수 (chart 생성 후 / 패턴 변경 시 공통 사용)
  const applyMarkers = useCallback((candles, buyDate, sellDate, buyPat, sellPat) => {
    if (!markersRef.current || !candles || !buyDate) return;
    const markers = [];
    const buyColor  = _patternColor(buyPat?.grade,  "buy");
    const sellColor = _patternColor(sellPat?.grade, "sell");

    const buyIdx    = candles.findIndex(c => c.time >= buyDate);
    const buyCandle = candles[buyIdx] ?? candles.find(c => c.time?.slice(0,7) === buyDate?.slice(0,7));

    if (buyCandle) {
      // 패턴 존 — 해당 구간 캔들에 작은 마커로 하이라이트
      const rule = _buyZoneRule(buyPat?.name);
      if (rule) {
        const zoneStart = Math.max(0, buyIdx + rule.offset);
        for (let i = zoneStart; i < zoneStart + rule.count && i < buyIdx; i++) {
          markers.push({ time: candles[i].time, position: rule.pos, color: buyColor + "99", shape: "circle", size: 0.6 });
        }
      }
      markers.push({
        time: buyCandle.time, position: "belowBar",
        color: "#10b981", shape: "arrowUp",
        text: "B", size: 1.5,
      });
    }

    if (sellDate) {
      const sellIdx    = candles.findIndex(c => c.time >= sellDate);
      const sellCandle = candles[sellIdx] ?? candles.find(c => c.time?.slice(0,7) === sellDate?.slice(0,7));
      if (sellCandle) {
        const rule = _sellZoneRule(sellPat?.name);
        if (rule && sellIdx >= 0) {
          const zoneEnd = Math.min(candles.length, sellIdx + rule.offset + rule.count);
          for (let i = sellIdx + rule.offset; i < zoneEnd; i++) {
            if (i >= 0) markers.push({ time: candles[i].time, position: rule.pos, color: sellColor + "99", shape: "circle", size: 0.6 });
          }
        }
        markers.push({
          time: sellCandle.time, position: "aboveBar",
          color: "#ef4444", shape: "arrowDown",
          text: "S", size: 1.5,
        });
      }
    }

    markersRef.current.setMarkers(markers.sort((a, b) => a.time < b.time ? -1 : 1));
  }, []);

  // Effect 1: 차트 생성 + 데이터 fetch
  useEffect(() => {
    if (!containerRef.current) return;

    // props로 받은 날짜를 직접 사용 (없으면 PAST_TRADES에서 폴백)
    let buyDate = buyDateProp ?? null;
    let sellDate = sellDateProp ?? null;
    if (!buyDate) {
      const trades = PAST_TRADES.filter(t => t.code === stock.code);
      const buys = trades.filter(t => t.type === "buy");
      buyDate = buys[buys.length - 1]?.date ?? null;
    }
    // 매수 기록 없으면 3개월 전을 기본 시작으로 폴백
    fallbackRef.current = !buyDate;
    if (fallbackRef.current) {
      const d = new Date(); d.setMonth(d.getMonth() - 3);
      buyDate = d.toISOString().slice(0, 10);
    }
    buyDateRef.current  = buyDate;
    sellDateRef.current = sellDate;

    const startDt = new Date(buyDate);
    startDt.setDate(startDt.getDate() - 20);
    const endDt = sellDate ? new Date(sellDate) : new Date();
    endDt.setDate(endDt.getDate() + 5);

    const p1       = Math.floor(startDt.getTime() / 1000);
    const p2       = Math.floor(endDt.getTime()   / 1000);
    const isKR     = /^\d{6}$/.test(stock.code);
    const sym      = isKR ? `${stock.code}.KS` : stock.code;
    const interval = "1d";
    const cacheKey = `${sym}_${p1}_${p2}_${interval}`;

    const chart = createChart(containerRef.current, {
      autoSize: true, height: 155,
      layout:   { background:{ type: ColorType.Solid, color:"#0d1128" }, textColor:"#999" },
      grid:     { vertLines:{ color:"#1a1a2e" }, horzLines:{ color:"#1a1a2e" } },
      timeScale:       { borderColor:"#333", timeVisible:false, rightOffset:3 },
      rightPriceScale: { borderColor:"#333", scaleMargins:{ top:0.15, bottom:0.1 } },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor:"#FF6B8A", downColor:"#4FC3FF",
      borderUpColor:"#FF6B8A", borderDownColor:"#4FC3FF",
      wickUpColor:"#FF6B8A",   wickDownColor:"#4FC3FF",
    });
    chartRef.current   = chart;
    seriesRef.current  = series;
    markersRef.current = createSeriesMarkers(series, []);

    // 평균매입가 기준선
    if (stock.avgPrice) {
      series.createPriceLine({
        price: stock.avgPrice, color: "#FF6B8A44",
        lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "",
      });
    }

    const applyData = (candles) => {
      candlesRef.current = candles;
      series.setData(candles);
      chart.timeScale().fitContent();
      if (!fallbackRef.current) applyMarkers(candles, buyDate, sellDate, buyPattern, sellPattern);
      setLoading(false);
    };

    if (_diaryChartCache[cacheKey]) {
      applyData(_diaryChartCache[cacheKey]);
    } else {
      fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=${interval}&period1=${p1}&period2=${p2}`)
        .then(r => r.json())
        .then(data => {
          const result = data?.chart?.result?.[0];
          const q  = result?.indicators?.quote?.[0];
          const ts = result?.timestamp;
          if (!ts || !q) { setNoData(true); setLoading(false); return; }
          const candles = ts.map((t, i) => ({
            time:  tsToDate(t),
            open:  q.open[i]  ?? q.close[i],
            high:  q.high[i]  ?? q.close[i],
            low:   q.low[i]   ?? q.close[i],
            close: q.close[i],
          })).filter(c => c.close != null && c.open != null);
          if (candles.length === 0) { setNoData(true); setLoading(false); return; }
          _diaryChartCache[cacheKey] = candles;
          applyData(candles);
        })
        .catch(() => { setNoData(true); setLoading(false); });
    }

    return () => { markersRef.current?.detach(); markersRef.current = null; chart.remove(); chartRef.current = null; seriesRef.current = null; candlesRef.current = null; };
  }, [stock.code, buyDateProp, sellDateProp]);

  // Effect 2: 패턴 데이터 변경 시 마커만 업데이트 (실제 매수일 있을 때만)
  useEffect(() => {
    if (candlesRef.current && buyDateRef.current && !fallbackRef.current) {
      applyMarkers(candlesRef.current, buyDateRef.current, sellDateRef.current, buyPattern, sellPattern);
    }
  }, [buyPattern?.name, sellPattern?.name, applyMarkers]);

  const buyColor  = _patternColor(buyPattern?.grade,  "buy");
  const sellColor = _patternColor(sellPattern?.grade, "sell");

  if (noData) return null;
  return (
    <div style={{ background:"#0d1128", borderRadius:10, overflow:"hidden", flexShrink:0 }}>
      {/* 헤더 범례 */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px 3px", flexWrap:"wrap" }}>
        <span style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>📊 매매 구간</span>
        <span style={{ fontSize:9, color:buyColor, fontWeight:700 }}>
          ▲ {buyPattern?.name?.replace(/_/g," ") ?? "매수"}
        </span>
        <span style={{ fontSize:9, color:sellColor, fontWeight:700 }}>
          ▼ {sellPattern?.name?.replace(/_/g," ") ?? "매도"}
        </span>
        {buyPattern?.grade && (
          <span style={{ fontSize:8, background: buyPattern.grade==="좋음"?"#d1fae5":"#fef3c7",
            color: buyPattern.grade==="좋음"?"#065f46":"#92400e",
            borderRadius:4, padding:"1px 5px", fontWeight:700 }}>
            매수 {buyPattern.grade}
          </span>
        )}
        {sellPattern?.grade && (
          <span style={{ fontSize:8, background: sellPattern.grade==="좋음"?"#d1fae5":"#fee2e2",
            color: sellPattern.grade==="좋음"?"#065f46":"#991b1b",
            borderRadius:4, padding:"1px 5px", fontWeight:700 }}>
            매도 {sellPattern.grade}
          </span>
        )}
      </div>
      <div style={{ position:"relative" }}>
        {loading && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#0d1128", zIndex:1, height:155 }}>
            <span style={{ fontSize:11, color:"#aaa" }}>차트 로딩 중...</span>
          </div>
        )}
        <div ref={containerRef} style={{ height:155 }} />
      </div>
      <div style={{ padding:"8px 10px 12px", fontSize:10, color:"#bbb", lineHeight:1.4 }}>
        매수 구간: 매수일 20일 전부터 매도 후 7일까지 표시합니다. 매수 포인트는 차트에서 강조되어 있어 구간별 진입 이유를 쉽게 확인할 수 있습니다.
      </div>
    </div>
  );
}

// ── 한국 주식: lightweight-charts + Yahoo Finance 일봉 ──
function KRStockChart({ symbol }) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const markersRef    = useRef(null);
  const allCandlesRef = useRef([]);   // 전체 로드된 캔들 (줌 아웃용)
  const [activePeriod, setActivePeriod] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastTime, setLastTime] = useState("");
  const [similarities, setSimilarities] = useState([]);
  const [showSimilarity, setShowSimilarity] = useState(false);

  // 차트 생성 (1회)
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height:   300,
      layout:   { background:{ type: ColorType.Solid, color:"#0d1128" }, textColor:"#aaa" },
      grid:     { vertLines:{ color:"#1a1a2e" }, horzLines:{ color:"#1a1a2e" } },
      timeScale:       { borderColor:"#333", timeVisible:false, rightOffset:5 },
      rightPriceScale: { borderColor:"#333" },
      handleScroll: true,
      handleScale:  true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor:"#FF6B8A",   downColor:"#4FC3FF",
      borderUpColor:"#FF6B8A", borderDownColor:"#4FC3FF",
      wickUpColor:"#FF6B8A",   wickDownColor:"#4FC3FF",
    });
    chartRef.current   = chart;
    seriesRef.current  = series;
    markersRef.current = createSeriesMarkers(series, []);
    return () => { markersRef.current?.detach(); markersRef.current = null; chart.remove(); };
  }, []);

  // 심볼 변경 시 5년치 전체 데이터 한 번 로드
  useEffect(() => {
    if (!seriesRef.current) return;
    setLoading(true); setError(null);
    // 10년치 월봉 + 1년치 일봉 병합하여 전체 데이터 확보
    Promise.all([
      fetch(`/api/yahoo/v8/finance/chart/${symbol}.KS?interval=1mo&range=10y`).then(r=>r.json()),
      fetch(`/api/yahoo/v8/finance/chart/${symbol}.KS?interval=1d&range=1y`).then(r=>r.json()),
    ]).then(([wkData, dayData]) => {
      const toCandles = (data) => {
        const result = data?.chart?.result?.[0];
        const q = result?.indicators?.quote?.[0];
        const ts = result?.timestamp;
        if (!ts || !q) return [];
        return ts.map((t, i) => ({
          time:  tsToDate(t),           // "YYYY-MM-DD"
          open:  q.open[i]  ?? q.close[i],
          high:  q.high[i]  ?? q.close[i],
          low:   q.low[i]   ?? q.close[i],
          close: q.close[i],
        })).filter(c => c.close != null && c.open != null);
      };
      const weekly = toCandles(wkData);
      const daily  = toCandles(dayData);
      // 일봉 시작일 이전은 주봉, 이후는 일봉 사용
      const dailyStart = daily[0]?.time ?? "9999-12-31";
      const merged = [
        ...weekly.filter(c => c.time < dailyStart),
        ...daily,
      ];
      // 중복 제거 + 날짜 오름차순 정렬
      const seen = new Set();
      const candles = merged
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
        .sort((a, b) => (a.time < b.time ? -1 : 1));

      if (candles.length === 0) throw new Error("데이터를 불러올 수 없어요");
      allCandlesRef.current = candles;
      seriesRef.current.setData(candles);

      // ── 매수/매도 마커 표시 ──
      const trades = PAST_TRADES.filter(t => t.code === symbol);
      const markers = trades
        .filter(t => candles.some(c => c.time === t.date))
        .map(t => ({
          time:     t.date,
          position: t.type === "buy" ? "belowBar" : "aboveBar",
          color:    t.type === "buy" ? "#4FC3FF"  : "#FF6B8A",
          shape:    t.type === "buy" ? "arrowUp"  : "arrowDown",
          text:     t.type === "buy" ? `매수 ${t.price.toLocaleString()}` : `매도 ${t.price.toLocaleString()}`,
          size: 1,
        }))
        .sort((a, b) => (a.time < b.time ? -1 : 1));
      if (markers.length > 0) markersRef.current?.setMarkers(markers);

      // ── 유사도 분석 ──
      const sims = calcSimilarities(symbol, candles);
      setSimilarities(sims);

      // 기본 보기 범위 설정 (1주)
      const lastDate = candles[candles.length - 1].time;
      chartRef.current.timeScale().setVisibleRange({
        from: subtractDays(lastDate, PERIOD_DAYS[1]),
        to:   addDays(lastDate, 1),
      });
      const d = new Date();
      setLastTime(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [symbol]);

  // 기간 버튼 → 보이는 범위만 이동 (데이터 재로드 없음)
  const handlePeriod = (i) => {
    setActivePeriod(i);
    if (!chartRef.current || allCandlesRef.current.length === 0) return;
    const candles = allCandlesRef.current;
    const lastDate = candles[candles.length - 1].time;
    chartRef.current.timeScale().setVisibleRange({
      from: subtractDays(lastDate, PERIOD_DAYS[i]),
      to:   addDays(lastDate, 1),
    });
  };

  // 실시간 폴링: 60초마다 마지막 캔들 갱신
  useEffect(() => {
    if (loading || error) return;
    const poll = async () => {
      try {
        const r    = await fetch(`/api/yahoo/v8/finance/chart/${symbol}.KS?interval=1d&range=5d`);
        const data = await r.json();
        const result = data?.chart?.result?.[0];
        const q = result?.indicators?.quote?.[0];
        const ts = result?.timestamp;
        if (!ts || !q || !seriesRef.current) return;
        const i = ts.length - 1;
        const c = {
          time:  tsToDate(ts[i]),       // "YYYY-MM-DD"
          open:  q.open[i]  ?? q.close[i],
          high:  q.high[i]  ?? q.close[i],
          low:   q.low[i]   ?? q.close[i],
          close: q.close[i],
        };
        if (c.close != null) {
          seriesRef.current.update(c);
          const d = new Date();
          setLastTime(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`);
        }
      } catch {}
    };
    const id = setInterval(poll, 60000);
    return () => clearInterval(id);
  }, [symbol, loading, error]);

  return (
    <div style={{ background:"#0d1128", padding:"8px 0 0" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px", marginBottom:8 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {KR_PERIODS.map((p, i) => (
            <div key={i} onClick={() => handlePeriod(i)}
              style={{ background:i===activePeriod?"#7c3aed":"rgba(255,255,255,0.06)", borderRadius:20,
                padding:"4px 10px", fontSize:11, cursor:"pointer",
                color:i===activePeriod?"#fff":"rgba(255,255,255,0.5)",
                border:i===activePeriod?"1px solid #7c3aed":"1px solid rgba(255,255,255,0.1)" }}>
              {p.label}
            </div>
          ))}
        </div>
        {!loading && !error && (
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <LiveDot />
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{lastTime}</span>
          </div>
        )}
      </div>
      <div style={{ position:"relative", height:300 }}>
        <div ref={containerRef} style={{ width:"100%", height:"100%" }} />
        {loading && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0d1128",zIndex:2,color:"rgba(255,255,255,0.4)",fontSize:12 }}>
            차트 로딩 중...
          </div>
        )}
        {!loading && error && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,background:"#0d1128",zIndex:2 }}>
            <span style={{ color:"#FF6B6B", fontSize:12 }}>{error}</span>
            <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10 }}>장 마감 후엔 당일 분봉 없음 (일봉은 정상)</span>
          </div>
        )}
      </div>

      {/* ── 차트 유사도 분석 패널 ── */}
      {!loading && !error && similarities.length > 0 && (
        <div style={{ borderTop:"1px solid #1a1a2e", padding:"8px 12px" }}>
          <div
            onClick={() => setShowSimilarity(v => !v)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", marginBottom: showSimilarity ? 8 : 0 }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, color:"#A78BFA", fontWeight:700 }}>📊 차트 유사도 분석</span>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>과거 매매 패턴 vs 현재</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {/* 최고 유사도 배지 */}
              {(() => {
                const best = similarities.reduce((a, b) => a.score > b.score ? a : b);
                const col = best.score >= 70 ? "#4ADE80" : best.score >= 40 ? "#FBBF24" : "#F87171";
                return (
                  <span style={{ fontSize:10, fontWeight:800, color:col, background:`${col}22`, borderRadius:8, padding:"1px 7px" }}>
                    최고 {best.score}%
                  </span>
                );
              })()}
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{showSimilarity ? "▲" : "▼"}</span>
            </div>
          </div>

          {showSimilarity && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {similarities.map((s, i) => {
                const barCol = s.score >= 70 ? "#4ADE80" : s.score >= 40 ? "#FBBF24" : "#F87171";
                return (
                  <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.07)" }}>
                    {/* 헤더 */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:9, background:"#4FC3FF22", color:"#4FC3FF", borderRadius:6, padding:"1px 6px", fontWeight:700 }}>
                          매수 {s.buyDate}
                        </span>
                        <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>→</span>
                        <span style={{ fontSize:9, background:"#FF6B8A22", color:"#FF6B8A", borderRadius:6, padding:"1px 6px", fontWeight:700 }}>
                          매도 {s.sellDate}
                        </span>
                        <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>{s.holdDays}일 보유</span>
                      </div>
                      {s.profitPct != null && (
                        <span style={{ fontSize:10, fontWeight:800, color: parseFloat(s.profitPct) >= 0 ? "#4ADE80" : "#F87171" }}>
                          {parseFloat(s.profitPct) >= 0 ? "+" : ""}{s.profitPct}%
                        </span>
                      )}
                    </div>
                    {/* 분석 모드 */}
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", marginBottom:6 }}>
                      분석 윈도우: {s.mode === "단기(매수-30일)" ? `${s.windowFrom} ~ ${s.windowTo} (매수 30일 전 포함)` : `${s.windowFrom} ~ ${s.windowTo}`}
                    </div>
                    {/* 유사도 바 */}
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, height:6, background:"rgba(255,255,255,0.08)", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ width:`${s.score}%`, height:"100%", background:`linear-gradient(90deg,${barCol}88,${barCol})`, borderRadius:4, transition:"width 0.6s ease" }} />
                      </div>
                      <span style={{ fontSize:11, fontWeight:800, color:barCol, minWidth:36 }}>{s.score}%</span>
                    </div>
                    {/* 메모 */}
                    {s.note && (
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", marginTop:5, fontStyle:"italic" }}>
                        💬 {s.note}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", textAlign:"center", paddingBottom:2 }}>
                ※ 피어슨 상관계수 기반 수익률 패턴 유사도 · 과거가 미래를 보장하지 않음
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 미국 주식: TradingView 위젯 ──────────────
function TVStockChart({ symbol }) {
  const containerRef = useRef(null);
  const [activePeriod, setActivePeriod] = useState(2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    el.appendChild(wrapper);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol:   toTVSymbol(symbol),
      interval: TV_INTERVALS[activePeriod],
      timezone: "Asia/Seoul",
      theme:    "dark",
      style:    "1",
      locale:   "kr",
      allow_symbol_change: false,
      hide_top_toolbar: false,
      save_image: false,
      withdateranges: true,
      height: 320,
    });
    el.appendChild(script);
    return () => { if (el) el.innerHTML = ""; };
  }, [symbol, activePeriod]);

  return (
    <div style={{ background:"#0d1128", padding:"8px 0 0" }}>
      <div style={{ display:"flex", gap:6, padding:"0 12px", marginBottom:8, alignItems:"center" }}>
        {TV_PERIODS.map((label, i) => (
          <div key={i} onClick={() => setActivePeriod(i)}
            style={{ background:i===activePeriod?"#7c3aed":"rgba(255,255,255,0.06)", borderRadius:20,
              padding:"4px 14px", fontSize:11, cursor:"pointer",
              color:i===activePeriod?"#fff":"rgba(255,255,255,0.5)",
              border:i===activePeriod?"1px solid #7c3aed":"1px solid rgba(255,255,255,0.1)" }}>
            {label}
          </div>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
          <LiveDot />
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>실시간</span>
        </div>
      </div>
      <div ref={containerRef} className="tradingview-widget-container"
        style={{ width:"100%", height:320 }} />
    </div>
  );
}

// ══════════════════════════════════════════════
//  홈 화면
// ══════════════════════════════════════════════
export function HomeScreen({ onGoMenu, onGoOrder, onGoChart, onGoGame, onGoAccount, hasOnboarded, char, userName }) {
  const allSymbols = [...new Set([
    ...RANKING_STOCKS.map(s => s.code),
    ...ORDER_STOCKS.map(s => s.code),
  ])];
  const quotes = useRealtimeQuotes(allSymbols, 4000);

  return (
    <div style={S.homeWrap}>
      {/* 상태바 */}
      <div style={{ padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
        <span style={{ color:"#222",fontSize:13,fontWeight:700 }}>
          {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2,"0")}
        </span>
        <span style={{ color:"#444",fontSize:11 }}>📶 WiFi 🔋</span>
      </div>

      {/* 배너 */}
      <div style={{ margin:"0 14px",borderRadius:18,overflow:"hidden",height:110,background:"linear-gradient(135deg,#1e1b4b,#312e81)",position:"relative",flexShrink:0 }}>
        <div style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:4 }}>국내주식</div>
          <div style={{ fontSize:20,fontWeight:900,color:"#fff" }}>영웅문S#</div>
        </div>
        <div style={{ position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",display:"flex",gap:6 }}>
          {["🇭🇰","🇯🇵","🇺🇸","🇨🇳"].map((f,i) => (
            <div key={i} style={{ width:32,height:42,background:"linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.05))",borderRadius:6,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:4,border:"1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ fontSize:12 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display:"flex",padding:"10px 16px 0",gap:16,flexShrink:0 }}>
        {["국내","해외","상품"].map((t,i) => (
          <div key={i} style={{ fontSize:14,fontWeight:i===0?800:400,color:i===0?"#7c3aed":"rgba(0,0,0,0.4)",paddingBottom:6,borderBottom:i===0?"2px solid #7c3aed":"none",cursor:"pointer" }}>{t}</div>
        ))}
      </div>

      {/* 검색 */}
      <div style={{ margin:"8px 14px",flexShrink:0 }}>
        <div style={{ background:"#f0f0f5",borderRadius:24,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,border:"1px solid #e0e0e8" }}>
          <span>🔍</span>
          <span style={{ fontSize:12,color:"#999",flex:1 }}>종목·메뉴를 검색해주세요</span>
          <span>🎤</span>
        </div>
      </div>

      {/* 해시태그 */}
      <div style={{ display:"flex",gap:8,padding:"0 14px",overflowX:"auto",flexShrink:0,paddingBottom:4 }}>
        {["#삼성전자","#SK하이닉스","#현대차","#카카오","#네이버"].map((t,i) => (
          <div key={i} style={{ background:"#fff",borderRadius:20,padding:"5px 12px",fontSize:11,color:"#555",whiteSpace:"nowrap",border:"1px solid #e0e0e8",cursor:"pointer",flexShrink:0 }}>{t}</div>
        ))}
      </div>

      {/* 이벤트 */}
      <div style={{ margin:"8px 14px",background:"linear-gradient(90deg,#1e1b4b,#312e81)",borderRadius:12,padding:"12px 16px",textAlign:"center",flexShrink:0 }}>
        <span style={{ color:"#fff",fontSize:13 }}>福 터지는 <b style={{ color:"#FFD580" }}>연금이전 이벤트</b></span>
      </div>

      {/* ── 실시간 순위 검색 ── */}
      <div style={{ margin:"0 14px",background:"#fff",borderRadius:16,padding:"12px 14px 0",flex:1,overflow:"hidden",border:"1px solid #eee" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <span style={{ color:"#111",fontWeight:800,fontSize:14 }}>순위 검색</span>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <LiveDot /><span style={{ color:"#aaa",fontSize:11 }}>실시간</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:6,marginBottom:10 }}>
          {["시가총액","거래대금","상승률","하락률"].map((t,i) => (
            <div key={i} style={{ background:i===0?"#7c3aed":"#f5f5f5",borderRadius:20,padding:"5px 10px",fontSize:11,color:i===0?"#fff":"#888",cursor:"pointer",border:i===0?"1px solid #7c3aed":"1px solid #eee" }}>{t}</div>
          ))}
        </div>

        {RANKING_STOCKS.map((stock, i) => {
          const q      = quotes[stock.code];
          const base   = ORDER_STOCKS.find(s => s.code === stock.code);
          const price  = q?.price  ?? base?.price  ?? 0;
          const pct    = q?.pct    ?? base?.pct    ?? 0;
          const flash  = q?.flash;
          const isUp   = pct >= 0;

          return (
            <div key={stock.code}
              onClick={() => onGoOrder(stock.code)}
              style={{
                display:"flex", alignItems:"center", padding:"10px 0",
                borderTop:"1px solid #f2f2f2", cursor:"pointer", borderRadius:8,
                background: flash==="up" ? "rgba(74,222,128,0.08)" : flash==="down" ? "rgba(255,107,107,0.08)" : "transparent",
                transition:"background 0.3s",
              }}>
              <span style={{ width:18,fontSize:10,color:"#bbb",flexShrink:0 }}>{i+1}</span>
              <span style={{ flex:1.4,color:"#222",fontSize:12,marginLeft:4 }}>{stock.name}</span>
              <span style={{ flex:1,fontSize:12,textAlign:"right",fontWeight:700,transition:"color 0.3s",
                color: flash==="up" ? "#4ADE80" : flash==="down" ? "#FF6B6B" : isUp ? "#FF6B8A" : "#4FC3FF" }}>
                {price > 1000 ? Math.round(price).toLocaleString() : price.toFixed(2)}
              </span>
              <span style={{ fontSize:11,color:isUp?"#FF6B8A":"#4FC3FF",margin:"0 4px" }}>{isUp?"▲":"▼"}</span>
              <span style={{ flex:0.7,fontSize:11,textAlign:"right",fontWeight:700,color:isUp?"#FF6B8A":"#4FC3FF" }}>
                {isUp?"+":""}{pct?.toFixed(2)}%
              </span>
              <span style={{ fontSize:14,marginLeft:8,color:"#ccc" }}>›</span>
            </div>
          );
        })}
      </div>

      {/* 주가 티커 */}
      <div style={{ background:"rgba(10,10,30,0.9)",padding:"6px 0",display:"flex",alignItems:"center",gap:10,flexShrink:0,overflow:"hidden" }}>
        <div style={{ background:"#4f46e5",borderRadius:20,padding:"3px 10px",fontSize:10,color:"#fff",fontWeight:700,marginLeft:10,flexShrink:0 }}>📈 지수</div>
        <div style={{ overflow:"hidden",flex:1 }}>
          <div style={{ whiteSpace:"nowrap",animation:"ticker 14s linear infinite",fontSize:11,color:"rgba(255,255,255,0.6)" }}>
            S&P500 6,343.72 0.00 0.00% &nbsp;&nbsp; NASDAQ 19,827.42 +134.22 +0.68% &nbsp;&nbsp; KOSPI 2,607.31 +12.45 +0.48%
          </div>
        </div>
      </div>

      {/* 하단 네비 */}
      <div style={{ background:"#fff",display:"flex",alignItems:"center",padding:"8px 0 4px",borderTop:"1px solid #eee",flexShrink:0 }}>
        {[["☰\n메뉴","menu"],["관심종목",""],["현재가",""],["주문","order"],["차트","chart"],["계좌","account"],["종합",""]].map(([lb,sc],i) => (
          <div key={i} onClick={() => { if(sc==="menu") onGoMenu(); if(sc==="order") onGoOrder(null); if(sc==="chart") onGoChart(null); if(sc==="account") onGoAccount?.(); }}
            style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",cursor:sc?"pointer":"default" }}>
            {i===0 ? (
              <div style={{ background:"#7c3aed",borderRadius:8,padding:"4px 6px",minWidth:36,textAlign:"center" }}>
                <div style={{ fontSize:13,color:"#fff",lineHeight:1.2 }}>☰</div>
                <div style={{ fontSize:8,color:"#fff",fontWeight:700 }}>메뉴</div>
              </div>
            ) : (
              <span style={{ fontSize:11,color:sc?"#7c3aed":"#aaa",fontWeight:sc?700:400,paddingTop:4 }}>{lb}</span>
            )}
          </div>
        ))}
      </div>

      {/* AI 캐릭터 플로팅 */}
      {hasOnboarded && char ? (
        <div onClick={onGoGame} style={{ position:"absolute",bottom:80,left:12,zIndex:50,cursor:"pointer",animation:"charFloat 3s ease-in-out infinite" }}>
          <div style={{ position:"relative" }}>
            <Char3D char={char} size={58} />
            <div style={{ position:"absolute",top:-6,left:-4,background:`linear-gradient(90deg,${char.grad[0]},${char.grad[1]})`,borderRadius:20,padding:"2px 8px",fontSize:9,color:"#fff",fontWeight:800,whiteSpace:"nowrap",animation:"blink 2s infinite" }}>{userName || char.name} ✨</div>
            <div style={{ position:"absolute",bottom:-2,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.7)",borderRadius:10,padding:"2px 8px",fontSize:8,color:"#fff",whiteSpace:"nowrap" }}>탭해서 입장 →</div>
          </div>
        </div>
      ) : (
        <div onClick={onGoGame} style={{ position:"absolute",bottom:80,left:12,zIndex:50,cursor:"pointer" }}>
          <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:20,padding:"10px 14px",boxShadow:"0 8px 24px rgba(124,58,237,0.5)",border:"1px solid rgba(167,139,250,0.3)",animation:"glow 2s infinite",maxWidth:160 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
              <span style={{ fontSize:24 }}>🤖</span>
              <div>
                <div style={{ fontSize:11,fontWeight:900,color:"#fff" }}>AI 투자 파트너</div>
                <div style={{ fontSize:9,color:"rgba(255,255,255,0.6)" }}>지금 시작해보세요!</div>
              </div>
            </div>
            <div style={{ background:"linear-gradient(90deg,#a78bfa,#7c3aed)",borderRadius:10,padding:"5px 10px",fontSize:10,color:"#fff",fontWeight:800,textAlign:"center" }}>캐릭터 선택하기 →</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  주문 화면
// ══════════════════════════════════════════════
// ── 째릿 표정 캐릭터 (주문창 전용) ─────────────

export function OrderScreen({ onBack, char, hasOnboarded, surveyAnswers, dataConsent, initialCode, initialView = "order", onGoAccount, principles = [], setNotifs }) {
  const [orderStock, setOrderStock] = useState(
    ORDER_STOCKS.find(s => s.code === initialCode) ?? ORDER_STOCKS[0]
  );
  useEffect(() => {
    if (initialCode) {
      const found = ORDER_STOCKS.find(s => s.code === initialCode);
      if (found) setOrderStock(found);
    }
  }, [initialCode]);

  const quotes = useRealtimeQuotes([orderStock.code], 3000);
  const q          = quotes[orderStock.code];
  const livePrice  = q?.price  ?? orderStock.price;
  const liveChange = q?.change ?? orderStock.change;
  const livePct    = q?.pct    ?? orderStock.pct;
  const flash      = q?.flash;
  const isUp       = livePct >= 0;

  const [orderAdviceStock, setOrderAdviceStock] = useState(null);
  const [activeView, setActiveView] = useState(initialView);
  const [qty, setQty] = useState(0);

  const fmtPrice = (p) => p > 1000 ? `${Math.round(p).toLocaleString()}원` : `$${p.toFixed(2)}`;
  const isKR = /^\d{6}$/.test(orderStock.code);

  // 호가 목록 생성
  const hoga = [
    {p:1.0035,q:15055,t:"ask"},{p:1.003,q:8217,t:"ask"},{p:1.002,q:22876,t:"ask"},
    {p:1.0015,q:1,t:"ask"},{p:1.001,q:2366,t:"ask"},
    {p:1.000,q:0,t:"cur"},
    {p:0.9995,q:3332,t:"bid"},{p:0.999,q:12223,t:"bid"},
    {p:0.9985,q:4804,t:"bid"},{p:0.998,q:3025,t:"bid"},
  ];

  return (
    <div style={S.wrap}>
      {/* 헤더 */}
      <div style={{ background:"#1e1b4b",padding:"10px 14px",display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
        <div onClick={onBack} style={{ color:"#fff",fontSize:20,cursor:"pointer",marginRight:2 }}>←</div>
        <span style={{ color:"#fff",fontWeight:900,fontSize:15 }}>키움주문</span>
        {["호가주문","자동감시주문","체결확인"].map((t,i) => (
          <span key={i} style={{ color:"rgba(255,255,255,0.45)",fontSize:11,marginLeft:6 }}>{t}</span>
        ))}
        <span style={{ color:"rgba(255,255,255,0.4)",fontSize:18,marginLeft:"auto" }}>⋮</span>
      </div>

      {/* 종목 선택 행 */}
      <div style={{ background:"#fff",padding:"10px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid #eee",flexShrink:0 }}>
        <span style={{ fontSize:20,color:"#FFB800" }}>★</span>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <select value={orderStock.code}
              onChange={e => setOrderStock(ORDER_STOCKS.find(s => s.code===e.target.value))}
              style={{ background:"transparent",border:"none",fontWeight:900,fontSize:16,color:"#111",outline:"none",cursor:"pointer" }}>
              {ORDER_STOCKS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <span style={{ color:"#aaa",fontSize:13 }}>▼</span>
          </div>
          <div style={{ fontSize:10,color:"#aaa",marginTop:1 }}>
            <span style={{ background:"#4f46e5",color:"#fff",borderRadius:3,padding:"0 4px",fontSize:9,marginRight:4 }}>신</span>
            {orderStock.code}{isKR ? "" : " · NASDAQ"}
          </div>
        </div>
        <span style={{ fontSize:20,color:"#888",cursor:"pointer" }}>🔍</span>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:22,fontWeight:900,transition:"color 0.3s",
            color: flash==="up" ? "#e03" : flash==="down" ? "#0066cc" : isUp ? "#e03" : "#0066cc" }}>
            {livePrice > 1000 ? Math.round(livePrice).toLocaleString() : livePrice.toFixed(2)}
          </div>
          <div style={{ fontSize:11,fontWeight:700,color:isUp?"#e03":"#0066cc",display:"flex",alignItems:"center",gap:2,justifyContent:"flex-end" }}>
            <LiveDot />
            {isUp?"▲":"▼"} {Math.abs(liveChange).toLocaleString()} {isUp?"+":""}{livePct?.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 계좌 */}
      <div style={{ background:"#f8f8fa",padding:"7px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid #eee",flexShrink:0 }}>
        <div style={{ background:"#fff",border:"1px solid #ccc",borderRadius:4,padding:"3px 8px",fontSize:11,color:"#444",display:"flex",alignItems:"center",gap:3 }}>
          통합 <span style={{ width:6,height:6,borderRadius:"50%",background:"#e03",display:"inline-block" }} />
        </div>
        <div style={{ flex:1,background:"#fff",border:"1px solid #ccc",borderRadius:6,padding:"5px 10px",fontSize:12,color:"#333",display:"flex",justifyContent:"space-between" }}>
          <span>6234-1320 [위탁종합]</span><span style={{ color:"#aaa" }}>▼</span>
        </div>
        <div style={{ background:"#fff",border:"1px solid #ccc",borderRadius:6,padding:"5px 10px",fontSize:12,color:"#aaa" }}>비밀번호 입력</div>
      </div>

      {/* 매수/매도 탭 */}
      <div style={{ display:"flex",background:"#fff",borderBottom:"1px solid #eee",flexShrink:0 }}>
        {["매수","매도","정정/취소","미체결","잔고"].map((t,i) => (
          <div key={i} style={{ flex:1,padding:"9px 0",textAlign:"center",fontSize:12,
            fontWeight:i===0?800:400,
            color:i===0?"#e03":"#888",
            borderBottom:i===0?"2.5px solid #e03":"2.5px solid transparent",
            cursor:"pointer" }}>{t}</div>
        ))}
      </div>

      {/* 차트 뷰 */}
      {activeView === "chart" && (
        <div style={{ flex:1,overflowY:"auto",background:"#0d1128" }}>
          <StockChart key={orderStock.code} symbol={orderStock.code} />
        </div>
      )}

      {/* 주문 뷰 */}
      <div style={{ flex:1,overflow:"hidden",display:activeView==="chart"?"none":"flex",background:"#fff",position:"relative" }}>

        {/* 호가창 */}
        <div style={{ width:110,background:"#fff",borderRight:"1px solid #eee",display:"flex",flexDirection:"column",flexShrink:0 }}>
          <div style={{ display:"flex",justifyContent:"space-between",padding:"4px 8px",fontSize:10,color:"#aaa",borderBottom:"1px solid #eee",background:"#fafafa" }}>
            <span>호가</span><span>잔량</span>
          </div>
          <div style={{ flex:1,overflowY:"auto" }}>
            {hoga.map((h,i) => {
              const hp = Math.round(livePrice * h.p);
              const isCur = h.t==="cur";
              const isAsk = h.t==="ask";
              return (
                <div key={i} style={{
                  display:"flex",justifyContent:"space-between",padding:"5px 8px",fontSize:11,
                  background: isCur ? "rgba(230,0,51,0.08)" : isAsk ? "rgba(0,102,204,0.04)" : "rgba(230,0,51,0.04)",
                  borderBottom:"1px solid #f5f5f5",
                  border: isCur ? "1.5px solid rgba(230,0,51,0.5)" : undefined,
                }}>
                  <span style={{ fontWeight:isCur?900:500,
                    color:isAsk?"#0066cc":isCur?"#e03":"#e03" }}>
                    {hp.toLocaleString()}
                  </span>
                  {!isCur && <span style={{ color:"#aaa",fontSize:10 }}>{h.q.toLocaleString()}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 주문 폼 */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",padding:"10px 10px",gap:8,overflowY:"auto" }}>

          {/* 현금 / 신용 */}
          <div style={{ display:"flex",gap:6 }}>
            {["현금","신용"].map((t,i) => (
              <div key={i} style={{
                flex:1,border:i===0?"2px solid #1e1b4b":"1px solid #ccc",
                borderRadius:8,padding:"9px 0",textAlign:"center",
                fontSize:13,fontWeight:i===0?800:400,
                color:i===0?"#1e1b4b":"#999",cursor:"pointer",
                background:i===0?"#fff":"#fafafa",
              }}>{t}</div>
            ))}
          </div>

          {/* 보통(지정가) */}
          <div style={{ border:"1px solid #ccc",borderRadius:8,padding:"9px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff" }}>
            <span style={{ fontSize:13,color:"#333" }}>보통(지정가)</span>
            <span style={{ color:"#aaa",fontSize:13 }}>▼</span>
          </div>

          {/* 수량 */}
          <div style={{ border:"1px solid #ccc",borderRadius:8,overflow:"hidden",background:"#fff" }}>
            <div style={{ display:"flex",alignItems:"center",borderBottom:"1px solid #eee" }}>
              <div onClick={() => setQty(q => Math.max(0,q-1))}
                style={{ width:40,height:42,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#888",cursor:"pointer",borderRight:"1px solid #eee" }}>−</div>
              <div style={{ flex:1,textAlign:"center",fontSize:14,color:qty>0?"#111":"#ccc",fontWeight:700 }}>
                {qty > 0 ? qty : "수량"}
              </div>
              <div onClick={() => setQty(q => q+1)}
                style={{ width:40,height:42,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#888",cursor:"pointer",borderLeft:"1px solid #eee" }}>+</div>
            </div>
            {/* 미수수량 행 */}
            <div style={{ display:"flex",alignItems:"center",padding:"4px 8px",gap:6,background:"#fafafa" }}>
              <input type="checkbox" style={{ width:14,height:14,accentColor:"#4f46e5" }} />
              <span style={{ fontSize:11,color:"#888" }}>미수수량</span>
              <div style={{ flex:1 }} />
              <div style={{ border:"1px solid #ccc",borderRadius:4,padding:"2px 8px",fontSize:11,color:"#333",display:"flex",alignItems:"center",gap:3 }}>
                % <span style={{ color:"#aaa" }}>▼</span>
              </div>
              <div style={{ border:"1px solid #4f46e5",borderRadius:4,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#4f46e5",cursor:"pointer" }}>가능</div>
            </div>
          </div>

          {/* 가격 */}
          <div style={{ border:"1px solid #ccc",borderRadius:8,overflow:"hidden",background:"#fff" }}>
            <div style={{ display:"flex",alignItems:"center",borderBottom:"1px solid #eee" }}>
              <div style={{ width:40,height:42,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#888",cursor:"pointer",borderRight:"1px solid #eee" }}>−</div>
              <div style={{ flex:1,textAlign:"center",fontSize:14,fontWeight:700,
                background:"rgba(255,240,180,0.5)",
                transition:"color 0.3s",
                color: flash==="up"?"#e03":flash==="down"?"#0066cc":isUp?"#e03":"#0066cc" }}>
                {fmtPrice(livePrice)}
              </div>
              <div style={{ width:40,height:42,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#888",cursor:"pointer",borderLeft:"1px solid #eee" }}>+</div>
            </div>
            {/* 시장가 / 호가 행 */}
            <div style={{ display:"flex",gap:6,padding:"5px 8px",background:"#fafafa" }}>
              <div style={{ flex:1,border:"1px solid #4f46e5",borderRadius:4,padding:"4px 0",textAlign:"center",fontSize:11,color:"#4f46e5",fontWeight:700,cursor:"pointer" }}>✓ 시장가</div>
              <div style={{ flex:1,border:"1px solid #ccc",borderRadius:4,padding:"4px 0",textAlign:"center",fontSize:11,color:"#666",cursor:"pointer" }}>호가</div>
            </div>
          </div>

          {/* 가격 자동 체크 */}
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"2px 2px" }}>
            <input type="checkbox" style={{ width:15,height:15,accentColor:"#4f46e5" }} />
            <span style={{ fontSize:12,color:"#555" }}>가격 자동(현재가)</span>
          </div>

          {/* 충고 뱃지 */}
          {hasOnboarded && char && orderStock.pastBuy && dataConsent && (
            <div onClick={() => setOrderAdviceStock(orderStock)}
              style={{ border:`2px solid ${char.color}66`,borderRadius:12,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:`${char.color}08`,animation:"glow 2s infinite" }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <div>
                <div style={{ fontSize:11,fontWeight:800,color:char.color }}>과거 매매 기록 있음</div>
                <div style={{ fontSize:10,color:"#999" }}>탭해서 {char.name}의 충고 확인</div>
              </div>
            </div>
          )}
        </div>

        {/* 캐릭터 플로팅 */}
        {hasOnboarded && char && (
          <div style={{
            position:"absolute", right:8, top:8,
            animation:"charFloat 3s ease-in-out infinite",
            pointerEvents:"none", zIndex:10,
          }}>
            <Char3D char={char} size={62} shadow={false} />
          </div>
        )}
      </div>

      {/* 현금매수 버튼 */}
      <div onClick={() => { if(hasOnboarded && char && orderStock.pastBuy) setOrderAdviceStock(orderStock); }}
        style={{ background:"#e60033",padding:"15px",textAlign:"center",fontSize:16,fontWeight:900,color:"#fff",cursor:"pointer",flexShrink:0 }}>
        현금매수
      </div>

      {/* 하단 바 */}
      <div style={{ background:"#fff",display:"flex",alignItems:"center",padding:"5px 0",borderTop:"1px solid #eee",flexShrink:0 }}>
        <div style={{ background:"#1e1b4b",borderRadius:8,padding:"4px 6px",marginLeft:8,minWidth:36,textAlign:"center",flexShrink:0 }}>
          <div style={{ fontSize:11,color:"#fff",lineHeight:1.2 }}>☰</div>
          <div style={{ fontSize:8,color:"#fff",fontWeight:700 }}>메뉴</div>
        </div>
        {["관심종목","현재가","주문","차트","계좌"].map((t,i) => {
          const isActive = (t==="주문" && activeView==="order") || (t==="차트" && activeView==="chart");
          return (
            <div key={i}
              onClick={() => { if(t==="주문") setActiveView("order"); if(t==="차트") setActiveView("chart"); if(t==="계좌") onGoAccount?.(); }}
              style={{ flex:1,textAlign:"center",fontSize:10,cursor:"pointer",paddingTop:4,
                color:isActive?"#1e1b4b":"#aaa",
                fontWeight:isActive?800:400,
                borderTop:isActive?"2px solid #1e1b4b":"2px solid transparent" }}>
              {t}
            </div>
          );
        })}
      </div>

      {/* 충고 모달 */}
      {orderAdviceStock && (
        <OrderAdviceModal stock={orderAdviceStock} char={char}
          onClose={() => setOrderAdviceStock(null)} surveyAnswers={surveyAnswers}
          principles={principles} setNotifs={setNotifs} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  메뉴 화면
// ══════════════════════════════════════════════
export function MenuScreen({ onBack, onGoGame, onGoOrder, hasOnboarded, char }) {
  const [activeMenu, setActiveMenu] = useState(0);

  return (
    <div style={S.wrap}>
      {/* 헤더 */}
      <div style={{ background:"#fff",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #eee",flexShrink:0 }}>
        <div onClick={onBack} style={{ width:36,height:36,background:"#f0f0f0",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14 }}>←</div>
        <div style={{ width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#c084fc,#818cf8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,position:"relative" }}>
          🤖
          <div style={{ position:"absolute",top:-3,right:-3,background:"#7c3aed",borderRadius:20,padding:"1px 5px",fontSize:8,color:"#fff",fontWeight:800 }}>Chat</div>
        </div>
        <div style={{ flex:1,background:"#f0f0f5",borderRadius:24,padding:"8px 14px",fontSize:12,color:"#888" }}>메뉴·종목 검색 가능</div>
        <div style={{ display:"flex",gap:10 }}>{["📢","🎁","⚙️"].map((ic,i) => <div key={i} style={{ fontSize:18,cursor:"pointer" }}>{ic}</div>)}</div>
      </div>

      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        {/* 좌측 카테고리 */}
        <div style={{ width:90,background:"#1e1b4b",display:"flex",flexDirection:"column",overflowY:"auto",flexShrink:0 }}>
          {MENU_ITEMS.map((m,i) => (
            <div key={i} onClick={() => setActiveMenu(i)}
              style={{ padding:"16px 10px",textAlign:"center",fontSize:12,fontWeight:activeMenu===i?800:400,color:activeMenu===i?"#fff":"rgba(255,255,255,0.55)",background:activeMenu===i?"rgba(255,255,255,0.1)":"transparent",cursor:"pointer",borderRight:activeMenu===i?"3px solid #a78bfa":"3px solid transparent",lineHeight:1.4,whiteSpace:"pre-wrap" }}>
              {m.label}
            </div>
          ))}
          <div onClick={onGoGame} style={{ margin:"8px 8px 4px",borderRadius:12,overflow:"hidden",cursor:"pointer",boxShadow:"0 4px 16px rgba(124,58,237,0.5)",flexShrink:0 }}>
            <div style={{ background:"linear-gradient(135deg,#7c3aed,#4f46e5)",padding:"10px 8px",display:"flex",alignItems:"center",gap:6 }}>
              {hasOnboarded && char ? <Char3D char={char} size={22} shadow={false} /> : <span style={{ fontSize:20 }}>🤖</span>}
              <div>
                <div style={{ fontSize:10,fontWeight:900,color:"#fff",lineHeight:1.2 }}>AI챗봇</div>
                <div style={{ fontSize:10,fontWeight:900,color:"#e0d7ff",lineHeight:1.2 }}>키우Me</div>
              </div>
            </div>
          </div>
          <div style={{ margin:"0 8px 8px",background:"linear-gradient(135deg,#1e40af,#3b82f6)",borderRadius:12,padding:"10px 8px",cursor:"pointer" }}>
            <div style={{ fontSize:10,fontWeight:900,color:"#fff" }}>계좌개설</div>
          </div>
        </div>

        {/* 우측 콘텐츠 */}
        <div style={{ flex:1,overflowY:"auto",background:"#fafafa" }}>
          <div style={{ background:"#f0ecff",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e8e0ff" }}>
            <div>
              <div style={{ fontSize:11,color:"#7c3aed",fontWeight:700 }}>쉬운 투자, 쉬운 경험</div>
              <div style={{ fontSize:11,color:"#7c3aed" }}>간편모드를 이용해보세요!</div>
            </div>
            <div style={{ display:"flex",gap:4 }}>
              <div style={{ background:"#7c3aed",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#fff",fontWeight:700 }}>일반</div>
              <div style={{ background:"#e8e0ff",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#7c3aed",fontWeight:700 }}>간편</div>
            </div>
          </div>

          {/* 포디움 */}
          <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)",margin:12,borderRadius:20,padding:"16px 14px 0",boxShadow:"0 8px 24px rgba(79,46,229,0.35)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:900,color:"#fff" }}>🏆 캐릭터 랭킹</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2 }}>이번 주 Top 3</div>
              </div>
              <div onClick={onGoGame} style={{ background:"linear-gradient(90deg,#a78bfa,#7c3aed)",borderRadius:20,padding:"6px 14px",fontSize:11,color:"#fff",fontWeight:800,cursor:"pointer" }}>
                내 캐릭터 키우기 →
              </div>
            </div>
            <Podium podiumData={PODIUM_TOP} />
          </div>

          {/* 메뉴 그리드 */}
          <div style={{ padding:"12px 14px" }}>
            <div style={{ fontSize:13,fontWeight:800,marginBottom:10 }}>{MENU_ITEMS[activeMenu]?.label.replace("\n","")}</div>
            <div style={{ background:"#fff",borderRadius:12,border:"1px solid #eee",padding:"4px 0",marginBottom:10 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #f5f5f5" }}>
                <span style={{ fontSize:13,color:"#333" }}>주식/ETF/ETN</span><span style={{ color:"#999" }}>▼</span>
              </div>
            </div>
            {[["관심종목","현재가"],["주문","차트"],["계좌","종합뉴스"],["투자정보","주식분석"],
              ["투자자별","빅데이터"],["기업정보","조건검색"],["미수반대","커뮤니티"],
              ["자동일지","ETF분석"],["캐치(모의)","캐치(실전)"],["소수점","투자분석"],["주식대여","공모주"],
            ].map(([a,b],i) => (
              <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"1px solid #f5f5f5" }}>
                {[a,b].map((t,j) => (
                  <div key={j} onClick={() => { if(t==="주문") onGoOrder(null); }}
                    style={{ padding:"13px 14px",fontSize:13,color:"#333",cursor:t==="주문"?"pointer":"default",fontWeight:i===3&&j===1?700:400,borderRight:j===0?"1px solid #f5f5f5":"none",background:t==="주문"?"rgba(124,58,237,0.05)":"transparent" }}>
                    {t}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 바 */}
      <div style={{ background:"#1a1a1a",display:"flex",alignItems:"center",padding:"10px 0",borderTop:"1px solid #333",flexShrink:0 }}>
        {[["✕",""],["🏠","HOME"],["👤","MY"],["🔔","알림센터"],["🔐","인증/보안"],["🎧","고객센터"],["↪","로그아웃"]].map(([ic,lb],i) => (
          <div key={i} onClick={i === 0 ? onBack : undefined} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer" }}>
            <span style={{ fontSize:16,color:"#ccc" }}>{ic}</span>
            {lb && <span style={{ fontSize:8,color:"#888" }}>{lb}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  내계좌 화면 (키움 잔고 스타일)
// ══════════════════════════════════════════════
export function AccountScreen({ onBack, onGoOrder, onGoChart }) {
  const [activeTab, setActiveTab] = useState(0); // 0=키움잔고, 1=타사잔고, 2=과거매매

  // ── 과거매매 일지 상태 ─────────────────────
  // diaries[code] = undefined → DB 미조회, null → DB에 없음, { aiData, raw } → 데이터 있음
  const [diaries,           setDiaries]           = useState({});
  const [diaryLoading,      setDiaryLoading]      = useState({});   // { code: bool }
  const [selectedDiaryCode, setSelectedDiaryCode] = useState(null); // 현재 열린 종목

  // 과거매매 목록: 현재 보유 + 과거 완료 거래 병합
  const PAST_TRADE_STOCKS = [
    ...CURRENT_HOLDINGS.map(h => {
      const holdingBuys = PAST_TRADES.filter(t => t.code === h.code && t.type === "buy");
      const lastHoldingBuy = holdingBuys[holdingBuys.length - 1];
      return {
        code: h.code, name: h.name, market: h.market,
        avgPrice: h.avgPrice, qty: h.qty,
        currentPrice: h.currentPrice,
        gain: (h.currentPrice - h.avgPrice) * h.qty,
        gainPct: (h.currentPrice - h.avgPrice) / h.avgPrice * 100,
        status: "보유중",
        tradeId: `${h.code}_holding`,
        buyDate: lastHoldingBuy?.date ?? null,
        sellDate: null,
      };
    }),
    // PAST_TRADES에서 매도 완료된 건
    ...PAST_TRADES.filter(t => t.type === "sell").map(t => {
      const priorBuys = PAST_TRADES.filter(b => b.code === t.code && b.type === "buy" && b.date <= t.date);
      const matchingBuy = priorBuys[priorBuys.length - 1];
      return {
        code: t.code, name: t.name, market: t.market ?? "KRX",
        avgPrice: t.price, qty: t.qty,
        currentPrice: t.price,
        gain: t.profit ?? 0,
        gainPct: t.profitPct ? parseFloat(t.profitPct) : 0,
        status: `매도완료 (${t.date})`,
        tradeId: `${t.code}_${t.date}`,
        buyDate: matchingBuy?.date ?? null,
        sellDate: t.date,
      };
    }),
  ];

  // DB에서 매매일지 조회 (클릭 시 호출)
  const loadDiary = async (tradeId) => {
    if (diaries[tradeId] !== undefined || diaryLoading[tradeId]) return;
    setDiaryLoading(prev => ({ ...prev, [tradeId]: true }));
    try {
      const res = await fetch(`/api/trade-journal/${encodeURIComponent(tradeId)}`);
      const data = await res.json();
      setDiaries(prev => ({
        ...prev,
        [tradeId]: data.found ? { aiData: data.aiData, raw: data.raw } : null,
      }));
    } catch {
      setDiaries(prev => ({ ...prev, [tradeId]: null }));
    }
    setDiaryLoading(prev => ({ ...prev, [tradeId]: false }));
  };

  // 매매일지 생성 (구조화 JSON) — 명시적 버튼 클릭 시만 호출
  const generateDiary = async (stock, force = false) => {
    if (!force && diaryLoading[stock.tradeId]) return;
    setDiaryLoading(prev => ({ ...prev, [stock.tradeId]: true }));
    try {
      const isKR = /^\d{6}$/.test(stock.code);
      const unit = isKR ? "원" : "$";
      // 이 거래건의 매수/매도일을 stock 객체에서 직접 사용
      const pastTrades = PAST_TRADES.filter(t => t.code === stock.code);
      const lastBuy  = stock.buyDate
        ? pastTrades.find(t => t.type === "buy"  && t.date === stock.buyDate)  ?? null
        : null;
      const lastSell = stock.sellDate
        ? pastTrades.find(t => t.type === "sell" && t.date === stock.sellDate) ?? null
        : null;
      const holdDays = lastBuy?.date && lastSell?.date
        ? Math.round((new Date(lastSell.date) - new Date(lastBuy.date)) / 86400000) : null;

      // ── 기술적 지표 계산 헬퍼 ────────────────────────────────
      const _ma = (arr, end, period) => {
        if (end < period - 1) return null;
        return arr.slice(end - period + 1, end + 1).reduce((s, c) => s + c.close, 0) / period;
      };
      const _ema = (arr, period, upToIdx) => {
        if (upToIdx < period - 1) return null;
        const k = 2 / (period + 1);
        let ema = arr.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
        for (let i = period; i <= upToIdx; i++) ema = arr[i].close * k + ema * (1 - k);
        return ema;
      };
      const _rsi = (arr, end, period = 14) => {
        if (end < period) return null;
        let gains = 0, losses = 0;
        for (let i = end - period + 1; i <= end; i++) {
          const ch = arr[i].close - arr[i - 1].close;
          if (ch > 0) gains += ch; else losses += Math.abs(ch);
        }
        gains /= period; losses /= period;
        return losses === 0 ? 100 : Math.round(100 - 100 / (1 + gains / losses));
      };
      const _bb = (arr, end, period = 20) => {
        if (end < period - 1) return null;
        const sl = arr.slice(end - period + 1, end + 1).map(c => c.close);
        const mean = sl.reduce((s, v) => s + v, 0) / period;
        const std  = Math.sqrt(sl.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
        return { upper: mean + 2 * std, lower: mean - 2 * std, mid: mean, std };
      };
      const _atr = (arr, end, period = 14) => {
        if (end < period) return null;
        let sum = 0;
        for (let i = end - period + 1; i <= end; i++) {
          sum += Math.max(arr[i].high - arr[i].low, Math.abs(arr[i].high - arr[i-1].close), Math.abs(arr[i].low - arr[i-1].close));
        }
        return Math.round(sum / period);
      };
      const _trendDir = (pct) => pct === null ? null : parseFloat(pct) > 3 ? "상승" : parseFloat(pct) < -3 ? "하락" : "횡보";
      const _bbPos = (price, bb) => {
        if (!bb) return null;
        const r = (price - bb.lower) / (bb.upper - bb.lower);
        return r >= 0.8 ? "상단(과매수권)" : r <= 0.2 ? "하단(과매도권)" : "중심";
      };
      const _candlePattern = (c, prev) => {
        if (!c) return "없음";
        const body = Math.abs(c.close - c.open);
        const range = c.high - c.low;
        if (range === 0) return "없음";
        const lw = Math.min(c.close, c.open) - c.low;
        const uw = c.high - Math.max(c.close, c.open);
        if (body < range * 0.05) return "도지(방향전환신호)";
        if (lw > body * 2 && uw < body * 0.5) return c.close > c.open ? "망치형(강세반전)" : "역망치형";
        if (uw > body * 2 && lw < body * 0.5) return "유성형(약세반전)";
        if (prev && prev.close < prev.open && c.close > c.open && c.open < prev.close && c.close > prev.open) return "강세장악형(Bullish Engulfing)";
        if (prev && prev.close > prev.open && c.close < c.open && c.open > prev.close && c.close < prev.open) return "약세장악형(Bearish Engulfing)";
        return "없음";
      };

      // ── 차트 데이터 fetch (160일치, MA120 계산용) ──────────────
      let chartCtx = "";
      if (stock.buyDate) {
        const sym     = isKR ? `${stock.code}.KS` : stock.code;
        const startDt = new Date(stock.buyDate);
        startDt.setDate(startDt.getDate() - 160);
        const endDt = stock.sellDate ? new Date(stock.sellDate) : new Date();
        endDt.setDate(endDt.getDate() + 10);
        const p1       = Math.floor(startDt.getTime() / 1000);
        const p2       = Math.floor(endDt.getTime()   / 1000);
        const cacheKey = `${sym}_${p1}_${p2}_1d`;
        try {
          let candles = _diaryChartCache[cacheKey];
          if (!candles) {
            const r   = await fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=1d&period1=${p1}&period2=${p2}`);
            const d   = await r.json();
            const rst = d?.chart?.result?.[0];
            const q   = rst?.indicators?.quote?.[0];
            const ts  = rst?.timestamp;
            if (ts && q) {
              candles = ts.map((t, i) => ({
                time:   tsToDate(t),
                open:   q.open[i]   ?? q.close[i],
                high:   q.high[i]   ?? q.close[i],
                low:    q.low[i]    ?? q.close[i],
                close:  q.close[i],
                volume: q.volume?.[i] ?? null,
              })).filter(c => c.close != null);
              _diaryChartCache[cacheKey] = candles;
            }
          }
          if (candles?.length > 10) {
            const bi = candles.findIndex(c => c.time >= stock.buyDate);
            if (bi >= 5) {
              const buyPrc = candles[bi].close;

              // ── 이동평균 ──
              const ma5   = _ma(candles, bi, 5);
              const ma20  = _ma(candles, bi, 20);
              const ma60  = _ma(candles, bi, 60);
              const ma120 = _ma(candles, bi, 120);

              // ── 정배열/역배열 ──
              const maList = [ma5, ma20, ma60, ma120].filter(m => m !== null);
              let maAlign = "혼재";
              if (maList.length >= 3) {
                const desc = [...maList].sort((a,b)=>b-a);
                const asc  = [...maList].sort((a,b)=>a-b);
                if (maList.every((v,i)=>v===desc[i])) maAlign = "정배열(상승 우호적)";
                else if (maList.every((v,i)=>v===asc[i])) maAlign = "역배열(하락 압력)";
              }

              // ── 골든/데드크로스 (매수일 기준 최근 10일) ──
              let crossSignal = "없음";
              for (let i = Math.max(21, bi - 9); i <= bi; i++) {
                const p5  = _ma(candles, i-1, 5), p20 = _ma(candles, i-1, 20);
                const c5  = _ma(candles, i,   5), c20 = _ma(candles, i,   20);
                if (p5 && p20 && c5 && c20) {
                  if (p5 < p20 && c5 >= c20) { crossSignal = "골든크로스(매수신호)"; break; }
                  if (p5 > p20 && c5 <= c20) { crossSignal = "데드크로스(매도신호)"; break; }
                }
              }

              // ── RSI ──
              const rsiBuy  = _rsi(candles, bi);

              // ── MACD ──
              const ema12 = _ema(candles, 12, bi);
              const ema26 = _ema(candles, 26, bi);
              const macdLine = ema12 && ema26 ? ema12 - ema26 : null;
              const macdDir  = macdLine === null ? "데이터부족" : macdLine > 0 ? "양수(매수우세)" : "음수(매도우세)";

              // ── 볼린저밴드 ──
              const bb     = _bb(candles, bi);
              const bbPosB = _bbPos(buyPrc, bb);
              const bbSqueeze = bb ? (bb.std / bb.mid * 100).toFixed(1) : null;

              // ── ATR ──
              const atr = _atr(candles, bi);

              // ── 추세 ──
              const t5  = bi>=5  ? ((buyPrc - candles[bi-5].close)  / candles[bi-5].close  * 100).toFixed(1) : null;
              const t20 = bi>=20 ? ((buyPrc - candles[bi-20].close) / candles[bi-20].close * 100).toFixed(1) : null;
              const t60 = bi>=60 ? ((buyPrc - candles[bi-60].close) / candles[bi-60].close * 100).toFixed(1) : null;

              // ── 20일 고저 범위 내 위치 ──
              const pre20 = candles.slice(Math.max(0, bi-20), bi);
              const h20 = Math.max(...pre20.map(c=>c.high));
              const l20 = Math.min(...pre20.map(c=>c.low));
              const pctile = h20 > l20 ? Math.round((buyPrc - l20) / (h20 - l20) * 100) : 50;

              // ── 피보나치 (60일 스윙 기준) ──
              const lookback = candles.slice(Math.max(0, bi-60), bi);
              const swHigh = lookback.length ? Math.max(...lookback.map(c=>c.high)) : null;
              const swLow  = lookback.length ? Math.min(...lookback.map(c=>c.low))  : null;
              let fibLevel = "없음";
              if (swHigh && swLow) {
                const rng = swHigh - swLow;
                const fibs = [
                  { label:"38.2%", price: swHigh - rng * 0.382 },
                  { label:"50.0%", price: swHigh - rng * 0.500 },
                  { label:"61.8%", price: swHigh - rng * 0.618 },
                ];
                const near = fibs.map(f=>({...f, diff:Math.abs(buyPrc-f.price)})).sort((a,b)=>a.diff-b.diff)[0];
                if (near.diff / rng < 0.1) fibLevel = `${near.label} 레벨 근접(${Math.round(near.price).toLocaleString()}${unit})`;
              }

              // ── 캔들 패턴 ──
              const cpat = _candlePattern(candles[bi], candles[bi-1]);

              // ── 직전 5봉 ──
              const last5 = candles.slice(Math.max(0, bi-5), bi);
              const bullCnt = last5.filter(c=>c.close>=c.open).length;

              // ── 거래량 분석 ──
              let volCtx = "";
              if (candles[bi].volume !== null) {
                const vol20avg = pre20.reduce((s,c)=>s+(c.volume??0),0) / (pre20.length||1);
                const volRatio = vol20avg > 0 ? ((candles[bi].volume / vol20avg) * 100).toFixed(0) : null;
                if (volRatio) volCtx = `매수일 거래량: 20일 평균 대비 ${volRatio}% (${parseInt(volRatio)>=150?"거래량 급증(세력개입 가능)":parseInt(volRatio)<=70?"거래량 감소":"평균 수준"})\n`;
              }

              // ── 매수 후 5일 수익 ──
              const post5 = candles.slice(bi+1, bi+6);
              const post5txt = post5.length > 0 ? `매수 후 ${post5.length}일 등락: ${((post5[post5.length-1].close - buyPrc)/buyPrc*100).toFixed(1)}%\n` : "";

              // ── chartCtx 조립 (매수) ──
              chartCtx = `\n[기술적 분석 데이터 — 매수 당시 (${stock.buyDate})]\n`;
              chartCtx += `매수가: ${Math.round(buyPrc).toLocaleString()}${unit}\n`;
              chartCtx += `단기 추세(5일): ${t5}% → ${_trendDir(t5) ?? "데이터부족"}\n`;
              chartCtx += `중기 추세(20일): ${t20}% → ${_trendDir(t20) ?? "데이터부족"}\n`;
              if (t60) chartCtx += `장기 추세(60일): ${t60}% → ${_trendDir(t60)}\n`;
              chartCtx += `이동평균 배열: ${maAlign}\n`;
              if (ma5)  chartCtx += `  MA5=${Math.round(ma5).toLocaleString()}${unit} (이격 ${((buyPrc-ma5)/ma5*100).toFixed(1)}%)\n`;
              if (ma20) chartCtx += `  MA20=${Math.round(ma20).toLocaleString()}${unit} (이격 ${((buyPrc-ma20)/ma20*100).toFixed(1)}%)\n`;
              if (ma60) chartCtx += `  MA60=${Math.round(ma60).toLocaleString()}${unit} (이격 ${((buyPrc-ma60)/ma60*100).toFixed(1)}%)\n`;
              if (ma120)chartCtx += `  MA120=${Math.round(ma120).toLocaleString()}${unit} (이격 ${((buyPrc-ma120)/ma120*100).toFixed(1)}%)\n`;
              chartCtx += `크로스 신호: ${crossSignal}\n`;
              if (rsiBuy !== null) chartCtx += `RSI(14): ${rsiBuy} → ${rsiBuy>=70?"과매수(주의)":rsiBuy<=30?"과매도(반등기대)":"중립"}\n`;
              chartCtx += `MACD: ${macdDir}\n`;
              if (bb) chartCtx += `볼린저밴드: 위치=${bbPosB}, 밴드폭(변동성)=${bbSqueeze}%\n`;
              chartCtx += `20일 고저 범위 내 위치: ${pctile}% (0%=최저점, 100%=최고점)\n`;
              chartCtx += `피보나치: ${fibLevel}\n`;
              if (atr) chartCtx += `ATR(14): ${atr.toLocaleString()}${unit}\n`;
              if (cpat !== "없음") chartCtx += `매수 당일 캔들 패턴: ${cpat}\n`;
              chartCtx += `매수 직전 5봉: 양봉 ${bullCnt}개 / 음봉 ${5-bullCnt}개\n`;
              chartCtx += volCtx;
              chartCtx += post5txt;

              // ── 매도 시점 분석 ──
              if (stock.sellDate) {
                const si = candles.findIndex(c => c.time >= stock.sellDate);
                if (si > 0) {
                  const sellPrc = candles[si].close;
                  const rsiSell = _rsi(candles, si);
                  const bbSell  = _bb(candles, si);
                  const bbPosS  = _bbPos(sellPrc, bbSell);
                  const preSell = candles.slice(Math.max(0, si-5), si);
                  const sellTrend = preSell.length > 0 ? ((sellPrc - preSell[0].close)/preSell[0].close*100).toFixed(1) : null;
                  const postSell = candles.slice(si+1, si+6);
                  const postSellTxt = postSell.length > 0 ? `매도 후 ${postSell.length}일 등락: ${((postSell[postSell.length-1].close - sellPrc)/sellPrc*100).toFixed(1)}%\n` : "";
                  let sellVolCtx = "";
                  if (candles[si].volume !== null) {
                    const sellPre20 = candles.slice(Math.max(0, si-20), si);
                    const svAvg = sellPre20.reduce((s,c)=>s+(c.volume??0),0) / (sellPre20.length||1);
                    const svRatio = svAvg > 0 ? ((candles[si].volume / svAvg)*100).toFixed(0) : null;
                    if (svRatio) sellVolCtx = `매도일 거래량: 20일 평균 대비 ${svRatio}%\n`;
                  }
                  chartCtx += `\n[기술적 분석 데이터 — 매도 당시 (${stock.sellDate})]\n`;
                  chartCtx += `매도가: ${Math.round(sellPrc).toLocaleString()}${unit}\n`;
                  if (rsiSell !== null) chartCtx += `RSI(14): ${rsiSell} → ${rsiSell>=70?"과매수":rsiSell<=30?"과매도":"중립"}\n`;
                  if (bbPosS) chartCtx += `볼린저밴드 위치: ${bbPosS}\n`;
                  if (sellTrend) chartCtx += `매도 직전 5일 흐름: ${sellTrend}% → ${parseFloat(sellTrend)>=0?"상승 국면":"하락 국면"} 매도\n`;
                  chartCtx += sellVolCtx;
                  chartCtx += postSellTxt;
                }
              }
            }
          }
        } catch { /* 차트 데이터 없어도 계속 진행 */ }
      }
      // ─────────────────────────────────────────────────────────

      const ctx =
        `종목: ${stock.name}(${stock.code})\n` +
        `평균매입가: ${stock.avgPrice.toLocaleString()}${unit}, 수량: ${stock.qty}주\n` +
        `평가손익: ${stock.gain>=0?"+":""}${Math.round(stock.gain).toLocaleString()}${unit} (${stock.gainPct>=0?"+":""}${stock.gainPct.toFixed(2)}%), 상태: ${stock.status}\n` +
        (lastBuy  ? `매수일: ${lastBuy.date} / 매수가: ${lastBuy.price.toLocaleString()}${unit}\n` : "") +
        (lastSell ? `매도일: ${lastSell.date} / 매도가: ${lastSell.price.toLocaleString()}${unit} / 수익률: ${lastSell.profitPct ?? "?"}%\n` : "") +
        (holdDays != null ? `보유기간: ${holdDays}일\n` : "") +
        chartCtx;

      const SYSTEM_PROMPT = `당신은 주식 매매 패턴 분석 전문가입니다. 제공된 기술적 분석 데이터를 바탕으로 매매일지를 작성합니다.

## 분석 기준 (모든 수치를 실제로 인용할 것)

### 1. 추세 분석
- 단기(5일)/중기(20일)/장기(60일) 추세 방향과 강도
- 이동평균 정배열(MA5>MA20>MA60>MA120)이면 상승 우호, 역배열이면 하락 압력
- 골든크로스(5일선이 20일선 상향 돌파): 매수 신호 / 데드크로스: 매도 신호

### 2. 이격도 분석
- MA 대비 매수/매도가 이격도(%)를 반드시 언급
- 이격도 +10% 초과: 단기 과열권, -10% 이하: 과매도권

### 3. RSI / MACD / 볼린저밴드
- RSI 30↓ = 과매도(반등기대), RSI 70↑ = 과매수(조정주의)
- MACD 양수: 매수 우세, 음수: 매도 우세
- BB 하단: 과매도권 진입, 상단: 과매수권 진입

### 4. 거래량
- 거래량 150% 이상: 세력 개입 가능성, 70% 이하: 관망세

### 5. 캔들 패턴
- 망치형/강세장악형: 반등 신호 / 유성형/약세장악형/도지: 반전 경고

### 6. 피보나치
- 61.8% 근접: 강한 지지선, 38.2%: 약한 되돌림

## 패턴 분류
- 매수 좋음: 눌림목_진입 지지선_반등 횡보_돌파 저점_분할매수 피보나치_지지
- 매수 아쉬움: 급등_추격 역배열_진입 고점_근처_진입 충동_진입 RSI과매수_진입
- 매도 좋음: 저항선_익절 추세_이탈_손절 목표가_달성 BB상단_익절 RSI과매수_매도
- 매도 아쉬움: 패닉_손절 조기_익절 늦은_손절 갭하락_패닉

반드시 아래 JSON만 출력하세요. 마크다운 없이 순수 JSON.`;

      const jsonSchema =
        `{"buy_pattern":{"name":"패턴명","grade":"좋음|아쉬움","reason":"실제 수치 인용 2~3문장","score":1}` +
        `,"sell_pattern":{"name":"패턴명","grade":"좋음|아쉬움","reason":"실제 수치 인용 2~3문장","score":1}` +
        `,"hold_analysis":{"comment":"보유 구간 MA/RSI/가격흐름 2문장","score":1}` +
        `,"technical":{"trend_short":"상승|하락|횡보","trend_mid":"상승|하락|횡보","ma_alignment":"정배열|역배열|혼재","cross_signal":"골든크로스|데드크로스|없음","rsi_buy":0,"rsi_sell":0,"macd_signal":"양수|음수|데이터부족","bb_pos_buy":"하단|중심|상단","bb_pos_sell":"하단|중심|상단","candle_pattern":"패턴명|없음","fib_level":"없음|38.2%|50.0%|61.8%","volume_signal":"급증|감소|평균|데이터없음"}` +
        `,"signals":{"direction":"매수관점|매도관점|관망","strength":"강|중|약","entry_reasons":["근거1","근거2","근거3"],"target1":{"price":0,"reason":"1차 목표가 근거"},"target2":{"price":0,"reason":"2차 목표가 근거"},"stop_loss":{"price":0,"reason":"손절 기준"},"rr_ratio":"1:X","signal_validity":"N~M일"}` +
        `,"risk":{"volatility":"낮음|보통|높음","rr_meets_min":true,"position_suggestion":"계좌의 N%"}` +
        `,"tags":["태그1","태그2","태그3"]` +
        `,"journal":{"summary":"한 줄 요약","buy_comment":"매수 시점 평가 2~3문장(수치 인용)","hold_comment":"보유 구간 평가 2문장","sell_comment":"매도 시점 평가 2~3문장(수치 인용)","improvement":"개선 제안 3가지. 직설적으로."}}`;

      const prompt = `${ctx}\n아래 JSON만 반환하세요 (마크다운 없이 순수 JSON):\n${jsonSchema}`;

      const res = await fetch(GPT_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GPT_DEFAULT_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: prompt },
          ],
          max_tokens: 2000,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw new Error(`GPT API 오류: ${res.status} ${res.statusText} ${errorText}`);
      }
      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        throw new Error("AI 응답이 비어 있습니다. 다시 시도해 주세요.");
      }
      let aiData = null;
      try {
        const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        aiData = JSON.parse(jsonStr);
      } catch (err) {
        console.error("일지 파싱 실패", err, raw);
      }
      const result = { aiData, raw: raw || "AI 응답을 받지 못했습니다." };
      setDiaries(prev => ({ ...prev, [stock.tradeId]: result }));
      // DB에 저장 (다음 접속 시 재생성 불필요)
      fetch("/api/trade-journal/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stock.tradeId, ai_data: JSON.stringify(aiData), raw: result.raw }),
      }).catch(() => {});
    } catch (err) {
      console.error("[generateDiary] 실패:", err);
      setDiaries(prev => ({ ...prev, [stock.tradeId]: { aiData: null, raw: `일지 생성에 실패했어요.\n(${err?.message ?? "알 수 없는 오류"})` } }));
    } finally {
      setDiaryLoading(prev => ({ ...prev, [stock.tradeId]: false }));
    }
  };

  const selectedStock = PAST_TRADE_STOCKS.find(s => s.tradeId === selectedDiaryCode);

  // 총 손익 계산 (가상 데이터 기반)
  const totalBuy = CURRENT_HOLDINGS.reduce((s, h) => {
    const isKR = /^\d{6}$/.test(h.code);
    return s + (isKR ? h.avgPrice * h.qty : h.avgPrice * h.qty * 1350);
  }, 0);
  const totalVal = CURRENT_HOLDINGS.reduce((s, h) => {
    const isKR = /^\d{6}$/.test(h.code);
    return s + (isKR ? h.currentPrice * h.qty : h.currentPrice * h.qty * 1350);
  }, 0);
  const totalGain = totalVal - totalBuy;
  const totalGainPct = totalBuy > 0 ? (totalGain / totalBuy * 100) : 0;
  const isUp = totalGain >= 0;

  return (
    <div style={S.wrap}>
      {/* 헤더 */}
      <div style={{ background:"#1e1b4b",padding:"10px 14px",display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
        <div onClick={onBack} style={{ color:"#fff",fontSize:18,cursor:"pointer",padding:"0 4px" }}>←</div>
        <span style={{ color:"#fff",fontWeight:800,fontSize:16,flex:1 }}>국내잔고</span>
        {["미체결","예수금","주문가능금액"].map((t,i) => (
          <span key={i} style={{ color:"rgba(255,255,255,0.55)",fontSize:11 }}>{t}</span>
        ))}
        <span style={{ color:"rgba(255,255,255,0.5)",fontSize:16,marginLeft:4 }}>⋮</span>
      </div>

      {/* 탭 */}
      <div style={{ display:"flex",background:"#fff",borderBottom:"2px solid #eee",flexShrink:0 }}>
        {["키움 잔고","타사 잔고","과거매매"].map((t,i) => (
          <div key={i} onClick={() => setActiveTab(i)}
            style={{ flex:1,padding:"12px 0",textAlign:"center",fontSize:13,fontWeight:i===activeTab?800:400,
              color:i===activeTab?"#1e1b4b":"#999",
              borderBottom:i===activeTab?"2px solid #1e1b4b":"2px solid transparent",marginBottom:-2,cursor:"pointer" }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ flex:1,overflowY:"auto",background:"#f5f5f7" }}>
        {activeTab === 0 ? (
          <>
            {/* 계좌 선택 */}
            <div style={{ background:"#fff",padding:"10px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid #eee",flexShrink:0 }}>
              <div style={{ flex:1,border:"1px solid #ddd",borderRadius:6,padding:"7px 12px",fontSize:12,color:"#333",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span>6234-1320 [위탁종합] 가상계좌</span><span style={{ color:"#999" }}>▼</span>
              </div>
              <div style={{ border:"1px solid #e44",borderRadius:6,padding:"7px 10px",fontSize:11,color:"#e44",fontWeight:700,cursor:"pointer" }}>↻</div>
              <div style={{ border:"1px solid #ddd",borderRadius:6,padding:"7px 10px",fontSize:11,color:"#333",cursor:"pointer" }}>해외잔고</div>
            </div>

            {/* 총 손익 카드 */}
            <div style={{ background:"#fff",margin:"8px 12px",borderRadius:12,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <span style={{ fontSize:13,fontWeight:700,color:"#333" }}>총 손익</span>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:18,fontWeight:900,color:isUp?"#FF4466":"#4FC3FF" }}>
                    {isUp?"+":""}{Math.round(totalGain).toLocaleString()}원
                  </span>
                  <span style={{ fontSize:13,fontWeight:700,color:isUp?"#FF4466":"#4FC3FF" }}>
                    {isUp?"+":""}{totalGainPct.toFixed(2)}%
                  </span>
                  <span style={{ color:"#aaa" }}>∧</span>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,paddingTop:10,borderTop:"1px solid #f0f0f0" }}>
                <div>
                  <div style={{ fontSize:10,color:"#999",marginBottom:2 }}>총 매입</div>
                  <div style={{ fontSize:13,fontWeight:700 }}>{Math.round(totalBuy).toLocaleString()}원</div>
                </div>
                <div>
                  <div style={{ fontSize:10,color:"#999",marginBottom:2 }}>총 평가</div>
                  <div style={{ fontSize:13,fontWeight:700 }}>{Math.round(totalVal).toLocaleString()}원</div>
                </div>
              </div>
            </div>

            {/* MY랭킹 */}
            <div style={{ background:"#fff",margin:"4px 12px",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize:12,color:"#1e1b4b",fontWeight:700 }}>MY랭킹</span>
              <span style={{ fontSize:11,color:"#555" }}>월 수익률 순위 조회 (키움전체)</span>
              <span style={{ color:"#aaa" }}>↻</span>
            </div>

            {/* 컬럼 헤더 */}
            <div style={{ background:"#f0f0f5",padding:"8px 14px",display:"grid",gridTemplateColumns:"2fr 1.5fr 1.5fr 1.5fr",gap:4,margin:"8px 12px 0",borderRadius:"8px 8px 0 0",border:"1px solid #e8e8ef" }}>
              {["종목명","매입가 / 현재가","보유 / 가능","평가손익 / 수익률"].map((h,i) => (
                <div key={i} style={{ fontSize:10,color:"#888",fontWeight:700,textAlign:i>0?"right":"left" }}>{h}</div>
              ))}
            </div>

            {/* 보유종목 목록 */}
            {CURRENT_HOLDINGS.map((h, idx) => {
              const isKR = /^\d{6}$/.test(h.code);
              const gain = (h.currentPrice - h.avgPrice) * h.qty;
              const gainPct = ((h.currentPrice - h.avgPrice) / h.avgPrice * 100);
              const up = gain >= 0;
              const fmtP = (p) => isKR ? p.toLocaleString() : `$${p}`;
              return (
                <div key={h.code}
                  onClick={() => onGoOrder?.(h.code)}
                  style={{ background:"#fff",padding:"12px 14px",display:"grid",gridTemplateColumns:"2fr 1.5fr 1.5fr 1.5fr",gap:4,
                    margin:`0 12px`,borderLeft:"1px solid #e8e8ef",borderRight:"1px solid #e8e8ef",
                    borderBottom: idx===CURRENT_HOLDINGS.length-1?"1px solid #e8e8ef":"1px solid #f0f0f0",
                    borderRadius:idx===CURRENT_HOLDINGS.length-1?"0 0 8px 8px":"0",
                    cursor:"pointer" }}>
                  <div>
                    <div style={{ fontWeight:800,fontSize:13,color:"#222" }}>{h.name}</div>
                    <div style={{ fontSize:10,color:"#aaa",marginTop:2 }}>{h.code}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12,color:"#555" }}>{fmtP(h.avgPrice)}</div>
                    <div style={{ fontSize:12,fontWeight:700,color:up?"#FF4466":"#4FC3FF" }}>{fmtP(h.currentPrice)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12,color:"#555" }}>{h.qty}주</div>
                    <div style={{ fontSize:12,color:"#aaa" }}>{h.qty}주</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12,fontWeight:700,color:up?"#FF4466":"#4FC3FF" }}>
                      {up?"+":""}{isKR ? `${Math.round(gain).toLocaleString()}` : gain.toFixed(0)}
                    </div>
                    <div style={{ fontSize:11,color:up?"#FF4466":"#4FC3FF" }}>{up?"+":""}{gainPct.toFixed(2)}%</div>
                  </div>
                </div>
              );
            })}

            <div style={{ height:16 }} />
          </>
        ) : activeTab === 1 ? (
          /* 타사 잔고 탭 */
          <div style={{ padding:20 }}>
            <div style={{ background:"#fff",borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <span style={{ fontSize:13,fontWeight:700 }}>총 손익</span>
                <span style={{ fontSize:16,fontWeight:900,color:"#333" }}>0원  0.00%</span>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,paddingTop:10,borderTop:"1px solid #f0f0f0" }}>
                <div><div style={{ fontSize:10,color:"#999" }}>총 매입</div><div style={{ fontSize:13,fontWeight:700 }}>0</div></div>
                <div><div style={{ fontSize:10,color:"#999" }}>총 평가</div><div style={{ fontSize:13,fontWeight:700 }}>0</div></div>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <div style={{ background:"#fff",borderRadius:10,padding:"13px 0",textAlign:"center",fontSize:13,fontWeight:700,color:"#1e1b4b",border:"1px solid #ddd",cursor:"pointer" }}>내 계좌 한눈에</div>
              <div style={{ background:"#fff",borderRadius:10,padding:"13px 0",textAlign:"center",fontSize:13,fontWeight:700,color:"#1e1b4b",border:"1px solid #ddd",cursor:"pointer" }}>타사종목 연결</div>
            </div>
          </div>
        ) : (
          /* 과거매매 탭 */
          <>
            {/* 컬럼 헤더 */}
            <div style={{ background:"#f0f0f5",padding:"8px 14px",display:"grid",gridTemplateColumns:"2fr 1.5fr 1.5fr 1.5fr",gap:4,margin:"8px 12px 0",borderRadius:"8px 8px 0 0",border:"1px solid #e8e8ef" }}>
              {["종목명","매입가 / 상태","수량","손익 / 수익률"].map((h,i) => (
                <div key={i} style={{ fontSize:10,color:"#888",fontWeight:700,textAlign:i>0?"right":"left" }}>{h}</div>
              ))}
            </div>

            {PAST_TRADE_STOCKS.map((s, idx) => {
              const isKR   = /^\d{6}$/.test(s.code);
              const unit   = isKR ? "원" : "$";
              const up     = s.gain >= 0;
              const hasDiary = !!diaries[s.tradeId];
              const isLoading = !!diaryLoading[s.tradeId];
              return (
                <div key={s.tradeId}
                  onClick={() => { setSelectedDiaryCode(s.tradeId); loadDiary(s.tradeId); }}
                  style={{ background:"#fff",padding:"12px 14px",display:"grid",gridTemplateColumns:"2fr 1.5fr 1.5fr 1.5fr",gap:4,
                    margin:"0 12px",borderLeft:"1px solid #e8e8ef",borderRight:"1px solid #e8e8ef",
                    borderBottom: idx===PAST_TRADE_STOCKS.length-1?"1px solid #e8e8ef":"1px solid #f0f0f0",
                    borderRadius:idx===PAST_TRADE_STOCKS.length-1?"0 0 8px 8px":"0",cursor:"pointer" }}>
                  <div>
                    <div style={{ fontWeight:800,fontSize:13,color:"#222",display:"flex",alignItems:"center",gap:4 }}>
                      {s.name}
                      {hasDiary && <span style={{ background:"#e0f2fe",color:"#0284c7",fontSize:8,fontWeight:800,borderRadius:4,padding:"1px 5px" }}>일지</span>}
                      {isLoading && <span style={{ fontSize:9,color:"#aaa" }}>생성중...</span>}
                    </div>
                    <div style={{ fontSize:10,color:"#aaa",marginTop:2 }}>{s.code}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12,color:"#555" }}>{isKR ? s.avgPrice.toLocaleString() : `$${s.avgPrice}`}</div>
                    <div style={{ fontSize:10,color:s.status==="보유중"?"#4ADE80":"#aaa",fontWeight:700 }}>{s.status}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12,color:"#555" }}>{s.qty}주</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12,fontWeight:700,color:up?"#FF4466":"#4FC3FF" }}>
                      {up?"+":""}{isKR ? Math.round(s.gain).toLocaleString() : s.gain.toFixed(0)}{unit}
                    </div>
                    <div style={{ fontSize:11,color:up?"#FF4466":"#4FC3FF" }}>{up?"+":""}{s.gainPct.toFixed(2)}%</div>
                  </div>
                </div>
              );
            })}
            <div style={{ height:16 }} />
          </>
        )}
      </div>

      {/* ── 일지 바텀시트 모달 ── */}
      {selectedDiaryCode && selectedStock && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",zIndex:300 }}
          onClick={() => setSelectedDiaryCode(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:22,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp 0.3s ease" }}>
            {/* 모달 헤더 */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexShrink:0 }}>
              <div>
                <div style={{ fontSize:16,fontWeight:900,color:"#1e1b4b" }}>📓 {selectedStock.name} 매매일지</div>
                <div style={{ fontSize:11,color:"#aaa",marginTop:2 }}>{selectedStock.code} · {selectedStock.status}</div>
              </div>
              <div onClick={() => setSelectedDiaryCode(null)}
                style={{ width:32,height:32,background:"#f5f5f5",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#333" }}>✕</div>
            </div>

            {/* 종목 요약 */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10,flexShrink:0 }}>
              {[
                { l:"평균매입가", v: /^\d{6}$/.test(selectedStock.code) ? `${selectedStock.avgPrice.toLocaleString()}원` : `$${selectedStock.avgPrice}` },
                { l:"수량",       v:`${selectedStock.qty}주` },
                { l:"평가손익",   v:`${selectedStock.gain>=0?"+":""}${Math.round(selectedStock.gain).toLocaleString()}`, c:selectedStock.gain>=0?"#FF4466":"#4FC3FF" },
              ].map((item,i) => (
                <div key={i} style={{ background:"#f8f8fc",borderRadius:10,padding:"8px 10px" }}>
                  <div style={{ fontSize:9,color:"#aaa",marginBottom:3 }}>{item.l}</div>
                  <div style={{ fontSize:13,fontWeight:800,color:item.c ?? "#222" }}>{item.v}</div>
                </div>
              ))}
            </div>

            {/* 차트 — 요약카드 바로 아래, 스크롤 밖에 고정 */}
            <div style={{ marginBottom:10, flexShrink:0 }}>
              <DiaryMiniChart
                stock={selectedStock}
                buyDate={selectedStock.buyDate}
                sellDate={selectedStock.sellDate}
                buyPattern={diaries[selectedDiaryCode]?.aiData?.buy_pattern}
                sellPattern={diaries[selectedDiaryCode]?.aiData?.sell_pattern}
              />
            </div>

            {/* 일지 본문 */}
            <div style={{ flex:1,overflowY:"auto" }}>
              {diaryLoading[selectedDiaryCode] ? (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"30px 0",gap:10 }}>
                  <div style={{ display:"flex",gap:6 }}>
                    {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,background:"#1e1b4b",borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}
                  </div>
                  <div style={{ fontSize:12,color:"#aaa" }}>AI가 매매 패턴을 분석 중이에요...</div>
                </div>
              ) : (() => {
                const d = diaries[selectedDiaryCode];
                // DB에 일지 없음 → 생성 버튼 표시
                if (d === null) return (
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 0",gap:14 }}>
                    <div style={{ fontSize:36 }}>📓</div>
                    <div style={{ fontSize:13,color:"#aaa" }}>아직 생성된 일지가 없어요</div>
                    <div onClick={() => generateDiary(selectedStock)}
                      style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:12,padding:"11px 28px",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>
                      ✨ AI 일지 생성
                    </div>
                  </div>
                );
                if (!d) return null;
                if (!d.aiData) return <div style={{ fontSize:13,color:"#333",lineHeight:1.85,background:"#f8f8fc",borderRadius:12,padding:"14px 16px",whiteSpace:"pre-wrap" }}>{d.raw}</div>;
                const ai = d.aiData;
                const gradeColor = g => g === "좋음" ? "#10b981" : "#f59e0b";
                const gradeBg    = g => g === "좋음" ? "#f0fdf4" : "#fffbeb";
                const gradeBd    = g => g === "좋음" ? "#86efac" : "#fde68a";
                const PatternCard = ({ icon, label, pattern }) => pattern ? (
                  <div style={{ background:gradeBg(pattern.grade),border:`1px solid ${gradeBd(pattern.grade)}`,borderRadius:10,padding:"10px 12px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                      <span style={{ fontSize:14 }}>{icon}</span>
                      <span style={{ fontSize:12,fontWeight:800,color:"#1e1b4b" }}>{label}</span>
                      <span style={{ fontSize:10,background:"#fff",border:`1px solid ${gradeBd(pattern.grade)}`,borderRadius:4,padding:"1px 5px",color:gradeColor(pattern.grade),fontWeight:700 }}>{pattern.name?.replace(/_/g," ")}</span>
                      <span style={{ marginLeft:"auto",fontSize:9,fontWeight:800,color:gradeColor(pattern.grade),background:"#fff",border:`1px solid ${gradeBd(pattern.grade)}`,borderRadius:4,padding:"1px 6px" }}>{pattern.grade}</span>
                    </div>
                    <div style={{ fontSize:11,color:"#444",lineHeight:1.7 }}>{pattern.reason}</div>
                  </div>
                ) : null;

                // ── 기술적 지표 배지 렌더러 ──
                const TechBadge = ({ label, value, highlight }) => value ? (
                  <div style={{ background: highlight ? "#fef3c7" : "#f1f5f9", borderRadius:6, padding:"4px 8px", fontSize:10 }}>
                    <span style={{ color:"#888", marginRight:4 }}>{label}</span>
                    <span style={{ fontWeight:700, color: highlight ? "#b45309" : "#334155" }}>{value}</span>
                  </div>
                ) : null;

                const t = ai.technical;
                const s = ai.signals;
                const r = ai.risk;
                const strengthColor = v => v==="강"?"#ef4444":v==="중"?"#f59e0b":"#10b981";
                const dirColor = v => v?.includes("매수")?"#10b981":v?.includes("매도")?"#ef4444":"#888";

                return (
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    {/* ① 패턴 분석 */}
                    <PatternCard icon="📈" label="매수 타이밍 분석" pattern={ai.buy_pattern} />
                    <PatternCard icon="📉" label="매도 타이밍 분석" pattern={ai.sell_pattern} />

                    {/* ② 보유 구간 */}
                    {ai.hold_analysis && (
                      <div style={{ background:"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:10,padding:"10px 12px" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                          <span style={{ fontSize:13 }}>⏳</span>
                          <span style={{ fontSize:12,fontWeight:800,color:"#1e1b4b" }}>보유 구간 분석</span>
                        </div>
                        <div style={{ fontSize:11,color:"#444",lineHeight:1.7 }}>{ai.hold_analysis.comment}</div>
                      </div>
                    )}

                    {/* ③ 기술적 지표 요약 */}
                    {t && (
                      <div style={{ background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"10px 12px" }}>
                        <div style={{ fontSize:11,fontWeight:800,color:"#94a3b8",marginBottom:7,letterSpacing:0.5 }}>📊 기술적 지표 요약</div>
                        <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
                          <TechBadge label="단기추세" value={t.trend_short} highlight={t.trend_short==="하락"} />
                          <TechBadge label="중기추세" value={t.trend_mid}   highlight={t.trend_mid==="하락"} />
                          <TechBadge label="MA배열"   value={t.ma_alignment} highlight={t.ma_alignment?.includes("역배열")} />
                          <TechBadge label="크로스"   value={t.cross_signal} highlight={t.cross_signal?.includes("데드")} />
                          <TechBadge label="매수RSI"  value={t.rsi_buy != null ? String(t.rsi_buy) : null} highlight={t.rsi_buy>=70||t.rsi_buy<=30} />
                          <TechBadge label="매도RSI"  value={t.rsi_sell != null ? String(t.rsi_sell) : null} highlight={t.rsi_sell>=70||t.rsi_sell<=30} />
                          <TechBadge label="MACD"     value={t.macd_signal} />
                          <TechBadge label="BB매수"   value={t.bb_pos_buy} highlight={t.bb_pos_buy?.includes("상단")} />
                          <TechBadge label="BB매도"   value={t.bb_pos_sell} />
                          <TechBadge label="캔들"     value={t.candle_pattern !== "없음" ? t.candle_pattern : null} />
                          <TechBadge label="피보나치" value={t.fib_level !== "없음" ? t.fib_level : null} />
                          <TechBadge label="거래량"   value={t.volume_signal} highlight={t.volume_signal==="급증"} />
                        </div>
                      </div>
                    )}

                    {/* ④ 매매 시그널 */}
                    {s && (
                      <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 12px" }}>
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                          <span style={{ fontSize:11,fontWeight:800,color:"#1e1b4b" }}>🎯 매매 시그널 분석</span>
                          <div style={{ display:"flex",gap:5 }}>
                            <span style={{ fontSize:10,fontWeight:800,color:dirColor(s.direction),background:dirColor(s.direction)+"18",borderRadius:5,padding:"2px 7px" }}>{s.direction}</span>
                            <span style={{ fontSize:10,fontWeight:800,color:strengthColor(s.strength),background:strengthColor(s.strength)+"18",borderRadius:5,padding:"2px 7px" }}>신호:{s.strength}</span>
                          </div>
                        </div>
                        {s.entry_reasons?.length > 0 && (
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:9,fontWeight:800,color:"#94a3b8",marginBottom:4,letterSpacing:0.5 }}>진입 근거</div>
                            {s.entry_reasons.map((r,i)=>(
                              <div key={i} style={{ fontSize:11,color:"#334155",lineHeight:1.6,paddingLeft:10,position:"relative" }}>
                                <span style={{ position:"absolute",left:0,color:"#3b82f6" }}>•</span>{r}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:6 }}>
                          {s.target1?.price > 0 && (
                            <div style={{ background:"#f0fdf4",borderRadius:7,padding:"6px 8px" }}>
                              <div style={{ fontSize:8,color:"#16a34a",fontWeight:800,marginBottom:2 }}>1차 목표가</div>
                              <div style={{ fontSize:12,fontWeight:800,color:"#15803d" }}>{s.target1.price.toLocaleString()}</div>
                              <div style={{ fontSize:9,color:"#555",marginTop:2,lineHeight:1.4 }}>{s.target1.reason}</div>
                            </div>
                          )}
                          {s.target2?.price > 0 && (
                            <div style={{ background:"#eff6ff",borderRadius:7,padding:"6px 8px" }}>
                              <div style={{ fontSize:8,color:"#2563eb",fontWeight:800,marginBottom:2 }}>2차 목표가</div>
                              <div style={{ fontSize:12,fontWeight:800,color:"#1d4ed8" }}>{s.target2.price.toLocaleString()}</div>
                              <div style={{ fontSize:9,color:"#555",marginTop:2,lineHeight:1.4 }}>{s.target2.reason}</div>
                            </div>
                          )}
                          {s.stop_loss?.price > 0 && (
                            <div style={{ background:"#fff5f5",borderRadius:7,padding:"6px 8px" }}>
                              <div style={{ fontSize:8,color:"#dc2626",fontWeight:800,marginBottom:2 }}>손절가</div>
                              <div style={{ fontSize:12,fontWeight:800,color:"#b91c1c" }}>{s.stop_loss.price.toLocaleString()}</div>
                              <div style={{ fontSize:9,color:"#555",marginTop:2,lineHeight:1.4 }}>{s.stop_loss.reason}</div>
                            </div>
                          )}
                        </div>
                        <div style={{ display:"flex",gap:8,marginTop:6 }}>
                          {s.rr_ratio && <span style={{ fontSize:10,color:"#7c3aed",background:"#ede9fe",borderRadius:5,padding:"2px 8px" }}>R:R = {s.rr_ratio}</span>}
                          {s.signal_validity && <span style={{ fontSize:10,color:"#0284c7",background:"#e0f2fe",borderRadius:5,padding:"2px 8px" }}>유효기간 {s.signal_validity}</span>}
                        </div>
                      </div>
                    )}

                    {/* ⑤ 리스크 평가 */}
                    {r && (
                      <div style={{ background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 12px" }}>
                        <div style={{ fontSize:11,fontWeight:800,color:"#1e1b4b",marginBottom:6 }}>⚖️ 리스크 평가</div>
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                          {r.volatility && <span style={{ fontSize:10,background:r.volatility==="높음"?"#fee2e2":r.volatility==="낮음"?"#d1fae5":"#fef3c7",color:r.volatility==="높음"?"#b91c1c":r.volatility==="낮음"?"#065f46":"#92400e",borderRadius:5,padding:"2px 8px",fontWeight:700 }}>변동성 {r.volatility}</span>}
                          {r.rr_meets_min !== undefined && <span style={{ fontSize:10,background:r.rr_meets_min?"#d1fae5":"#fee2e2",color:r.rr_meets_min?"#065f46":"#b91c1c",borderRadius:5,padding:"2px 8px",fontWeight:700 }}>R:R 기준 {r.rr_meets_min?"충족":"미달"}</span>}
                          {r.position_suggestion && <span style={{ fontSize:10,background:"#e0f2fe",color:"#0369a1",borderRadius:5,padding:"2px 8px" }}>권장비중 {r.position_suggestion}</span>}
                        </div>
                      </div>
                    )}

                    {/* ⑥ 태그 */}
                    {ai.tags?.length > 0 && (
                      <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
                        {ai.tags.map((tag,i) => (
                          <span key={i} style={{ fontSize:10,color:"#7c3aed",background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:12,padding:"2px 8px" }}>#{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* ⑦ 종합 일지 */}
                    {ai.journal && (
                      <div style={{ background:"#f8f8fc",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:8 }}>
                        <div style={{ fontSize:13,fontWeight:800,color:"#1e1b4b",lineHeight:1.5,borderBottom:"1px solid #e5e7eb",paddingBottom:7 }}>{ai.journal.summary}</div>
                        {[
                          { label:"매수 평가", text: ai.journal.buy_comment },
                          { label:"보유 평가", text: ai.journal.hold_comment },
                          { label:"매도 평가", text: ai.journal.sell_comment },
                        ].map((item,i) => item.text && (
                          <div key={i}>
                            <div style={{ fontSize:9,fontWeight:800,color:"#aaa",marginBottom:3,textTransform:"uppercase",letterSpacing:1 }}>{item.label}</div>
                            <div style={{ fontSize:12,color:"#333",lineHeight:1.7 }}>{item.text}</div>
                          </div>
                        ))}
                        {ai.journal.improvement && (
                          <div style={{ background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:8,padding:"8px 10px" }}>
                            <div style={{ fontSize:9,fontWeight:800,color:"#ef4444",marginBottom:4,letterSpacing:1 }}>개선 포인트</div>
                            <div style={{ fontSize:12,color:"#333",lineHeight:1.7,whiteSpace:"pre-wrap" }}>{ai.journal.improvement}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 다시 생성 버튼 — 일지가 있을 때만 표시 */}
            {diaries[selectedDiaryCode] && !diaryLoading[selectedDiaryCode] && (
              <div onClick={e => { e.stopPropagation(); generateDiary(selectedStock, true); }}
                style={{ marginTop:14,background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:12,padding:"11px",textAlign:"center",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",flexShrink:0 }}>
                🔄 일지 다시 생성
              </div>
            )}
          </div>
        </div>
      )}

      {/* 하단 네비 */}
      <div style={{ background:"#fff",display:"flex",alignItems:"center",padding:"6px 0",borderTop:"1px solid #eee",flexShrink:0 }}>
        <div style={{ background:"#1e1b4b",borderRadius:8,padding:"5px 8px",marginLeft:8,minWidth:40,textAlign:"center" }}>
          <div style={{ fontSize:12,color:"#fff",lineHeight:1.2 }}>☰</div>
          <div style={{ fontSize:8,color:"#fff",fontWeight:700 }}>메뉴</div>
        </div>
        {["관심종목","현재가","주문","차트","계좌","종합"].map((t,i) => (
          <div key={i} onClick={() => { if(t==="주문") onGoOrder?.(null); if(t==="차트") onGoChart?.(null); }}
            style={{ flex:1,textAlign:"center",fontSize:10,cursor:"pointer",paddingTop:4,
              color:t==="계좌"?"#1e1b4b":"#aaa",fontWeight:t==="계좌"?800:400,
              borderTop:t==="계좌"?"2px solid #1e1b4b":"2px solid transparent" }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 공통 스타일 ───────────────────────────────
const S = {
  wrap: { display:"flex",flexDirection:"column",height:"100vh",maxWidth:390,margin:"0 auto",fontFamily:"'Segoe UI',sans-serif",overflow:"hidden",position:"relative",background:"#f8f8f8" },
  homeWrap: { display:"flex",flexDirection:"column",height:"100vh",maxWidth:390,margin:"0 auto",fontFamily:"'Segoe UI',sans-serif",overflow:"hidden",position:"relative",background:"#f5f5f7" },
};