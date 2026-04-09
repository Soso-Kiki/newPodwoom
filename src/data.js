// ═══════════════════════════════════════
//  data.js  —  데이터 상수 + API 설정
// ═══════════════════════════════════════

// ── 캐릭터 ───────────────────────────────────
export const CHARACTERS = [
  { id:1, name:"도룡이", emoji:"🦕", desc:"손실을 기억하는 회고 코치",    color:"#E8849A", grad:["#F4A8BC","#E8849A"], personality:"친근하고 쉽게 설명해주는" },
  { id:2, name:"토깽이", emoji:"🐱", desc:"시장 소식 제일 먼저 전달",  color:"#9B7FD4", grad:["#B8A0E8","#9B7FD4"], personality:"자신감 넘치고 공격적인" },
  { id:3, name:"삐약이", emoji:"🐻", desc:"같이 성장하는 주린이 버디", color:"#F5B800", grad:["#FFD84D","#F5B800"], personality:"신중하고 분석적인" },
  { id:4, name:"룡룡이", emoji:"🌿", desc:"흔들리지 않는 원칙 코치",   color:"#77AA44", grad:["#77AA44","#58861A"], personality:"영리하고 전략적인" },
];

// ── 가구 ─────────────────────────────────────
export const FURNITURE_LIST = [
  { id:1, name:"소파",  emoji:"🛋️", price:300, owned:false },
  { id:2, name:"주식 시계",  emoji:"🕐", price:150, owned:false },
  { id:4, name:"그림",       emoji:"🖼️", price:200, owned:false },
  { id:5, name:"화분",       emoji:"🪴", price:100, owned:true  },
];

// ── 퀘스트 ───────────────────────────────────
export const QUESTS_INIT = [
  { id:1, type:"attendance", icon:"📅", title:"출석 체크",        desc:"오늘 앱에 접속하기",      points:50,  xp:10, done:false },
  { id:2, type:"chat",       icon:"💬", title:"AI와 대화하기",    desc:"캐릭터와 1번 대화하기",   points:80,  xp:15, done:false },
  { id:3, type:"chat",       icon:"🤖", title:"투자 질문하기",    desc:"투자 관련 질문 2개 하기", points:100, xp:20, done:false },
  { id:4, type:"stock",      icon:"📈", title:"오늘의 시황 확인", desc:"시장 알림 1개 읽기",      points:60,  xp:12, done:false },
  { id:5, type:"stock",      icon:"💰", title:"포트폴리오 점검",  desc:"자산 분석 리포트 보기",   points:120, xp:25, done:false },
];

// ── 알림 ─────────────────────────────────────
export const NOTIFS_INIT = [
  {
    id:1, icon:"📉", type:"holding", stock:"005930",
    title:"삼성전자 주의",
    desc:"보유 중인 삼성전자가 오늘 3.2% 하락했습니다. 현재 평균매입가(67,400원) 대비 손실 구간입니다.",
    time:"10분 전", read:false,
  },
  {
    id:2, icon:"🚀", type:"holding", stock:"000660",
    title:"SK하이닉스 급등",
    desc:"보유 중인 SK하이닉스가 장 시작 후 4.1% 상승 중입니다. 분할 매도 타이밍을 고려해보세요.",
    time:"32분 전", read:false,
  },
  {
    id:3, icon:"🤖", type:"ai_chat", stock:"TSLA",
    title:"AI 채팅 인사이트",
    desc:"지난 대화에서 언급한 '테슬라 추가 매수' 관련 — TSLA가 목표가 $250 근처에 도달했습니다.",
    time:"1시간 전", read:false,
  },
  {
    id:4, icon:"📊", type:"history", stock:"005930",
    title:"삼성전자 과거 패턴",
    desc:"2021년 42,000원 매수 → 53,000원 매도 이력 있음. 현재가(167,000원)는 당시 대비 +215% 구간입니다.",
    time:"3시간 전", read:true,
  },
  {
    id:5, icon:"⚖️", type:"principle", stock:null,
    title:"분산투자 원칙 알림",
    desc:"현재 포트폴리오의 삼성전자 비중이 62%를 초과했습니다. 분산 투자 원칙에 따라 비중 조절을 권장합니다.",
    time:"5시간 전", read:false,
  },
  {
    id:6, icon:"🛡️", type:"principle", stock:null,
    title:"손절 원칙 리마인더",
    desc:"설정하신 손절 기준(-8%)에 근접한 종목이 있습니다. 사전에 정한 원칙을 지키는 것이 장기 수익에 유리합니다.",
    time:"어제", read:true,
  },
];

// ── 현재 보유 종목 ────────────────────────────
export const CURRENT_HOLDINGS = [
  { code:"005930", name:"삼성전자",   market:"KRX",    avgPrice:67400,  qty:15, currentPrice:167000 },
  { code:"000660", name:"SK하이닉스", market:"KRX",    avgPrice:132000, qty:5,  currentPrice:198500 },
  { code:"TSLA",   name:"테슬라",     market:"NASDAQ", avgPrice:210.5,  qty:3,  currentPrice:248.9  },
];

// ── 과거 거래 내역 ────────────────────────────
export const PAST_TRADES = [
  // ── 2015~2016: 삼성전자 초기 매수 (액면분할 전 가격 환산) ──
  {
    id:1, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:24800, qty:50, date:"2015-09-01",
    note:"중국 쇼크 폭락 구간 분할 매수 진입",
  },
  {
    id:2, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:30200, qty:50, date:"2016-08-18",
    note:"갤럭시 노트7 발표 전 목표가 달성 매도",
    profit: (30200 - 24800) * 50,
    profitPct: ((30200 - 24800) / 24800 * 100).toFixed(1),
  },

  // ── 2018: 반도체 슈퍼사이클 고점 이후 분할 매수 ──
  {
    id:3, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:38500, qty:40, date:"2018-11-06",
    note:"반도체 업황 둔화로 주가 급락, 저점 분할 매수",
  },
  {
    id:4, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:46200, qty:40, date:"2019-04-22",
    note:"1Q 실적 발표 전 목표가 도달, 전량 매도",
    profit: (46200 - 38500) * 40,
    profitPct: ((46200 - 38500) / 38500 * 100).toFixed(1),
  },

  // ── 2019: 미중 무역전쟁 폭락 저점 매수 ──
  {
    id:5, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:41200, qty:30, date:"2019-08-06",
    note:"미중 무역전쟁 격화로 급락, 저점 매수",
  },
  {
    id:6, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:55800, qty:15, date:"2020-01-20",
    note:"연초 상승 랠리, 절반 분할 매도",
    profit: (55800 - 41200) * 15,
    profitPct: ((55800 - 41200) / 41200 * 100).toFixed(1),
  },

  // ── 2020: COVID-19 폭락 & 회복 ──
  {
    id:7, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:42800, qty:20, date:"2020-03-19",
    note:"코로나 공포 최저점, 분할 매수 추가 진입",
  },
  {
    id:8, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:59400, qty:15, date:"2020-08-07",
    note:"V자 반등 목표가 달성, 분할 매도",
    profit: (59400 - 41200) * 15,
    profitPct: ((59400 - 41200) / 41200 * 100).toFixed(1),
  },
  {
    id:9, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:72100, qty:20, date:"2020-12-23",
    note:"연말 외국인 수급 폭발, 전고점 돌파 매도",
    profit: (72100 - 42800) * 20,
    profitPct: ((72100 - 42800) / 42800 * 100).toFixed(1),
  },

  // ── 2021: 신고가 구간 매수 & 하락 손절 ──
  {
    id:10, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:84000, qty:20, date:"2021-01-11",
    note:"신고가 돌파 모멘텀 매수",
  },
  {
    id:11, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:88500, qty:10, date:"2021-04-09",
    note:"1분기 호실적 발표 후 목표가 달성, 절반 매도",
    profit: (88500 - 84000) * 10,
    profitPct: ((88500 - 84000) / 84000 * 100).toFixed(1),
  },
  {
    id:12, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:73200, qty:10, date:"2021-09-14",
    note:"하락 추세 전환 판단, 손절 매도",
    profit: (73200 - 84000) * 10,
    profitPct: ((73200 - 84000) / 84000 * 100).toFixed(1),
  },

  // ── 2022: 금리 인상 하락장 분할 매수 ──
  {
    id:13, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:63500, qty:25, date:"2022-05-12",
    note:"금리 인상 공포 급락, 저점 1차 분할 매수",
  },
  {
    id:14, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:58500, qty:15, date:"2022-10-12",
    note:"추가 하락 구간, 저점 2차 분할 매수",
  },

  // ── 2023: 반도체 업황 회복 차익실현 ──
  {
    id:15, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:66800, qty:25, date:"2023-03-15",
    note:"외국인 수급 개선, 1차 분할 매도",
    profit: (66800 - 63500) * 25,
    profitPct: ((66800 - 63500) / 63500 * 100).toFixed(1),
  },
  {
    id:16, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:71200, qty:15, date:"2023-06-20",
    note:"HBM·AI 반도체 기대감, 목표가 도달 매도",
    profit: (71200 - 58500) * 15,
    profitPct: ((71200 - 58500) / 58500 * 100).toFixed(1),
  },

  // ── 카카오 2017 매수 → 2021 매도 ──
  {
    id:20, code:"035720", name:"카카오", market:"KRX",
    type:"buy", price:16400, qty:100, date:"2017-06-08",
    note:"카카오뱅크·카카오페이 출범 기대, 플랫폼 성장성 보고 진입 (액면분할 조정가)",
  },
  {
    id:21, code:"035720", name:"카카오", market:"KRX",
    type:"sell", price:153000, qty:100, date:"2021-08-02",
    note:"코로나 비대면 수혜 + 카카오페이 IPO 기대 고점, 전량 매도",
    profit: (153000 - 16400) * 100,
    profitPct: ((153000 - 16400) / 16400 * 100).toFixed(1),
  },

  // ── 2024: 현재 보유분 매수 ──
  {
    id:17, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:74800, qty:10, date:"2024-01-18",
    note:"HBM3E 양산 기대, 신규 매수",
  },
  {
    id:18, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:78200, qty:10, date:"2024-03-29",
    note:"1분기 실적 발표 전 단기 차익실현",
    profit: (78200 - 74800) * 10,
    profitPct: ((78200 - 74800) / 74800 * 100).toFixed(1),
  },
  {
    id:19, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:67400, qty:15, date:"2024-07-25",
    note:"주가 조정 구간, 현재 보유분 매수 (보유 중)",
  },

  // ── SK하이닉스 현재 보유분 ──
  {
    id:40, code:"000660", name:"SK하이닉스", market:"KRX",
    type:"buy",  price:132000, qty:5, date:"2023-09-12",
    note:"AI 반도체 수요 급증 기대, HBM 수혜주 매수 (보유 중)",
  },

  // ── 테슬라 현재 보유분 ──
  {
    id:41, code:"TSLA", name:"테슬라", market:"NASDAQ",
    type:"buy",  price:210.5, qty:3, date:"2024-04-22",
    note:"실적 발표 후 급락 눌림목 구간, 분할 매수 진입 (보유 중)",
  },

  // ── 단기 가상 거래 (≤30일, 파라미터 최적화용) ──────────────────
  // 시뮬레이션 2000회×3시나리오 AUC 분석으로 k=30일이 최적값으로 도출됨
  {
    id:30, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:71500, qty:20, date:"2024-08-05",
    note:"[단기] 블랙먼데이 엔캐리 청산 폭락, RSI 과매도 단기 반등 진입",
  },
  {
    id:31, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:76600, qty:20, date:"2024-08-22",
    note:"[단기] 17일 보유, V자 반등 목표가 달성 차익실현",
    profit: (76600 - 71500) * 20,
    profitPct: ((76600 - 71500) / 71500 * 100).toFixed(1),
  },
  {
    id:32, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:62500, qty:15, date:"2024-09-23",
    note:"[단기] 추석 연휴 이후 외국인 수급 개선 기대, 단기 반등 진입",
  },
  {
    id:33, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:65200, qty:15, date:"2024-10-11",
    note:"[단기] 18일 보유, 저항선 도달 차익실현",
    profit: (65200 - 62500) * 15,
    profitPct: ((65200 - 62500) / 62500 * 100).toFixed(1),
  },
  {
    id:34, code:"005930", name:"삼성전자", market:"KRX",
    type:"buy",  price:54200, qty:10, date:"2024-11-18",
    note:"[단기] 연말 반등 기대 단기 진입",
  },
  {
    id:35, code:"005930", name:"삼성전자", market:"KRX",
    type:"sell", price:53100, qty:10, date:"2024-12-05",
    note:"[단기] 17일 보유, 추가 하락 전환 판단 손절",
    profit: (53100 - 54200) * 10,
    profitPct: ((53100 - 54200) / 54200 * 100).toFixed(1),
  },
];

// ── 주문화면 종목 ─────────────────────────────
export const ORDER_STOCKS = [
  { code:"005930", name:"삼성전자",   price:57300,  change:-700,  pct:-1.21, pastBuy:true,
    pastData:{ avgPrice:61000,  qty:10, totalReturn:"+173.8%", holdDays:420 } },
  { code:"000660", name:"SK하이닉스", price:198500, change:+3200, pct:+1.64, pastBuy:true,
    pastData:{ avgPrice:132000, qty:5,  totalReturn:"+50.4%",  holdDays:280 } },
  { code:"005380", name:"현대차",     price:235000, change:+2500, pct:+1.07, pastBuy:false, pastData:null },
  { code:"035420", name:"네이버",     price:198500, change:-1500, pct:-0.75, pastBuy:false, pastData:null },
  { code:"035720", name:"카카오",     price:42300,  change:+300,  pct:+0.71, pastBuy:true,
    pastData:{ avgPrice:16400, qty:100, totalReturn:"+832.9%", holdDays:1516 } },
  { code:"NVDA",   name:"엔비디아",       price:166.16, change:+0.99, pct:+0.60, pastBuy:false, pastData:null },
  { code:"AAPL",   name:"애플",           price:248.49, change:+1.86, pct:+0.75, pastBuy:false, pastData:null },
  { code:"TSLA",   name:"테슬라",         price:248.90, change:+4.10, pct:+1.68, pastBuy:true,
    pastData:{ avgPrice:195000, qty:3,  totalReturn:"+27.2%",  holdDays:180 } },
  { code:"000270", name:"기아",           price:110500, change:-500,  pct:-0.45, pastBuy:false, pastData:null },
  { code:"373220", name:"LG에너지솔루션", price:352000, change:+4000, pct:+1.15, pastBuy:false, pastData:null },
  { code:"068270", name:"셀트리온",       price:163500, change:+1500, pct:+0.93, pastBuy:false, pastData:null },
  { code:"005490", name:"포스코홀딩스",   price:378000, change:-2000, pct:-0.53, pastBuy:false, pastData:null },
  { code:"105560", name:"KB금융",         price:82100,  change:+300,  pct:+0.37, pastBuy:false, pastData:null },
];

// ── 홈 순위 종목 ──────────────────────────────
export const RANKING_STOCKS = [
  { name:"삼성전자",       code:"005930" },
  { name:"SK하이닉스",     code:"000660" },
  { name:"현대차",         code:"005380" },
  { name:"네이버",         code:"035420" },
  { name:"카카오",         code:"035720" },
  { name:"기아",           code:"000270" },
  { name:"LG에너지솔루션", code:"373220" },
  { name:"셀트리온",       code:"068270" },
  { name:"포스코홀딩스",   code:"005490" },
  { name:"KB금융",         code:"105560" },
];

// ── 나의 투자 원칙 ───────────────────────────
export const PRINCIPLES_INIT = [
  { id:1, category:"기술적",  text:"매수 전 전고점 확인 필수",    enabled:true,  triggerType:"buy_ath",      threshold:null },
  { id:2, category:"자산관리", text:"한 종목 비중 20% 이내",       enabled:true,  triggerType:"weight_limit", threshold:20   },
  { id:3, category:"익절",    text:"15% 수익 도달 시 절반 익절", enabled:true,  triggerType:"profit_target",threshold:15   },
  { id:4, category:"손절",    text:"매입가 대비 -8% 손절",        enabled:false, triggerType:"loss_cut",     threshold:-8   },
];

// ── 메뉴 ─────────────────────────────────────
export const MENU_ITEMS = [
  { label:"국내주식",         subs:["국내주식","시장정보","로보마켓"] },
  { label:"해외주식",         subs:[] },
  { label:"파생상품",         subs:[] },
  { label:"주식\n더모으기",   subs:[] },
  { label:"금융상품",         subs:[] },
  { label:"생활/혜택",        subs:[] },
  { label:"환전",             subs:[] },
  { label:"대출/\n카드/보험", subs:[] },
  { label:"자산/뱅킹",        subs:[] },
];

// ── 포디움 ────────────────────────────────────
export const PODIUM_TOP = [
  { rank:2, name:"흰곰",   score:4820, color:"#C0C0C0" },
  { rank:1, name:"공룡이", score:6340, color:"#FFD700" },
  { rank:3, name:"초록이", score:3910, color:"#CD7F32" },
];

// ── 투자 성향 타입 정의 ───────────────────────
// riskQs(보수↔공격): 문항 인덱스 0,2,4,6,8,9  /  styleQs(단기↔장기): 1,3,5,7
export const PERSONALITY_TYPES = {
  "보수×장기": {
    name:    "신중한 가치 투자자",
    risk:    "보수",  style: "장기",
    icon:    "🛡️",   color: "#6BBFFF",
    desc:    "잃지 않는 것이 이기는 것. 천천히 확실하게.",
    traits:  ["원금 보전 최우선. 수익보다 안전이 먼저다", "좋은 기업을 발굴해 수년 이상 보유. 분기 배당을 즐긴다", "단기 급등에 흔들리지 않음. 차트보다 재무제표를 본다", "손실 시 심리적 충격이 크고 회복에 시간이 걸림"],
    cards:   [
      { title:"투자 성향",   value:"보수형",     icon:"🛡️", color:"#6BBFFF" },
      { title:"투자 스타일", value:"장기 보유",  icon:"⏳", color:"#6BCB77" },
      { title:"리스크 등급", value:"저위험",     icon:"⚖️", color:"#FFD580" },
      { title:"추천 전략",   value:"가치 투자",  icon:"📊", color:"#A78BFA" },
    ],
  },
  "보수×단기": {
    name:    "원칙주의 스윙 투자자",
    risk:    "보수",  style: "단기",
    icon:    "📐",   color: "#6BCB77",
    desc:    "안전하게 치고 빠지는 스타일. 욕심 없이 원칙대로.",
    traits:  ["손절 원칙이 확고함. 정해진 기준을 어기지 않는다", "1~4주 단위 스윙. 목표 수익 도달 시 미련 없이 매도", "뉴스·이슈 중심 매매. 이슈 소멸되면 바로 나온다", "수익이 작아도 불안감이 없으면 된다는 마인드"],
    cards:   [
      { title:"투자 성향",   value:"보수형",     icon:"🛡️", color:"#6BBFFF" },
      { title:"투자 스타일", value:"스윙 매매",  icon:"📐", color:"#6BCB77" },
      { title:"리스크 등급", value:"중위험",     icon:"⚖️", color:"#FFD580" },
      { title:"추천 전략",   value:"원칙 매매",  icon:"📋", color:"#A78BFA" },
    ],
  },
  "공격×장기": {
    name:    "트렌드 선도 투자자",
    risk:    "공격",  style: "장기",
    icon:    "🚀",   color: "#A78BFA",
    desc:    "큰 그림을 보고 베팅하는 스타일. 트렌드를 앞서 잡는다.",
    traits:  ["남들이 모를 때 미리 들어가서 크게 먹는 스타일", "AI·바이오·2차전지 등 성장 섹터에 집중 투자", "확신 있는 종목엔 포트폴리오 50% 이상 집중도 감행", "단기 변동성은 노이즈로 봄. 6개월~3년 보유 태세"],
    cards:   [
      { title:"투자 성향",   value:"공격형",       icon:"🚀", color:"#FF6B8A" },
      { title:"투자 스타일", value:"중장기 보유",  icon:"📈", color:"#A78BFA" },
      { title:"리스크 등급", value:"고위험",       icon:"🔥", color:"#FF9900" },
      { title:"추천 전략",   value:"성장주 집중",  icon:"🎯", color:"#6BBFFF" },
    ],
  },
  "공격×단기": {
    name:    "모멘텀 헌터",
    risk:    "공격",  style: "단기",
    icon:    "⚡",   color: "#FF6B6B",
    desc:    "빠르게 판단하고 빠르게 움직인다. 기회를 놓치는 게 더 두렵다.",
    traits:  ["급등 모멘텀에 빠르게 올라타고 빠르게 나온다", "하루에도 수십 번 차트 확인. 실시간 흐름을 읽는다", "거래량·수급·모멘텀 중심. 펀더멘털은 크게 안 본다"],
    cards:   [
      { title:"투자 성향",   value:"공격형",         icon:"⚡", color:"#FF6B6B" },
      { title:"투자 스타일", value:"단기 트레이딩",  icon:"🏃", color:"#FF9900" },
      { title:"리스크 등급", value:"초고위험",       icon:"🎰", color:"#FF4444" },
      { title:"추천 전략",   value:"모멘텀 매매",    icon:"📡", color:"#A78BFA" },
    ],
  },
};

// 설문 답변 → 성향 계산 (점수표 방식)
// 각 질문의 선택지 인덱스(0~3)가 surveyAnswers[질문인덱스]에 저장됨
// [con: 보수점수, agg: 공격점수, sht: 단기점수, lng: 장기점수]
const _SCORE_TABLE = [
  // Q1: -20% 됐을 때 (즉시손절 / 지켜본다 / 버틴다 / 추가매수)
  [{con:2,sht:2}, {con:1,sht:1}, {con:1,lng:1}, {agg:2,lng:2}],
  // Q2: 수익 났을 때 매도 시점 (5~10%즉시 / 단기이슈해소 / 펀더멘털 / 10년보유)
  [{con:2,sht:2}, {con:1,sht:2}, {agg:1,lng:2}, {con:1,lng:2}],
  // Q3: 가장 중요한 것 (원금보전 / 안정수익 / 수익극대화 / 고수익고위험)
  [{con:2}, {con:1}, {agg:1}, {agg:2}],
  // Q4: 차트 확인 빈도 (하루수십번 / 하루2~3번 / 주1~2번 / 분기1번)
  [{agg:1,sht:2}, {sht:1}, {lng:1}, {con:1,lng:2}],
  // Q5: 지인 추천 시 (절대안산다 / 소액만 / 조사후의미있게 / 바로크게)
  [{con:2}, {con:1}, {agg:1}, {agg:2}],
  // Q6: 종목 선택 기준 (차트모멘텀 / 단기이슈뉴스 / 실적성장성 / 재무제표배당)
  [{agg:1,sht:2}, {agg:1,sht:1}, {agg:1,lng:1}, {con:2,lng:2}],
  // Q7: 한 종목 최대 비중 (10%이하 / 20~30% / 50%이상 / 100%몰빵)
  [{con:2}, {con:1}, {agg:1}, {agg:2}],
  // Q8: +15% 급등 시 (즉시전량매도 / 절반매도홀딩 / 목표가까지홀딩 / 조정시추가매수)
  [{con:1,sht:2}, {con:1,sht:1}, {agg:1,lng:1}, {agg:2,lng:1}],
  // Q9: 손실로 잠 못 잔 경험 (자주있다 / 가끔있다 / 거의없다 / 전혀없다)
  [{con:2}, {con:1}, {agg:1}, {agg:2}],
  // Q10: 투자 목표 (물가상승률이상 / 연10~20% / 연30%이상 / 단기2배)
  [{con:2,lng:1}, {con:1}, {agg:1}, {agg:2,sht:1}],
];

export function calcPersonality(surveyAnswers) {
  let conScore = 0, aggScore = 0, shtScore = 0, lngScore = 0;
  _SCORE_TABLE.forEach((optScores, qIdx) => {
    const chosen = surveyAnswers[qIdx];
    if (chosen == null || chosen < 0 || chosen >= optScores.length) return;
    const s = optScores[chosen];
    conScore += s.con ?? 0;
    aggScore += s.agg ?? 0;
    shtScore += s.sht ?? 0;
    lngScore += s.lng ?? 0;
  });
  const risk  = aggScore >= conScore ? "공격" : "보수";
  const style = lngScore >= shtScore ? "장기" : "단기";
  return PERSONALITY_TYPES[`${risk}×${style}`] ?? PERSONALITY_TYPES["보수×장기"];
}

// 하위 호환 – ANALYSIS_CARDS가 필요한 곳은 calcPersonality().cards 사용
export const ANALYSIS_CARDS = PERSONALITY_TYPES["보수×장기"].cards;

// ── 페르소나 MD 생성 ──────────────────────────────────────
// 캐릭터 선택 + 설문 결과 → persona.md 문자열 반환
// AIdamtic 스타일: 챗봇이 대화 전 "어떤 MD를 써야 하나" 판단하는 기준 문서
export function buildPersonaMD(char, surveyAnswers) {
  if (!char) return "";
  const pt = calcPersonality(surveyAnswers || {});
  return `# 투자자 페르소나 (persona.md)

## AI 파트너 캐릭터
- 이름: ${char.name} ${char.emoji}
- 성격: ${char.personality}
- 설명: ${char.desc}

## 투자 성향 분석 결과
- 유형: ${pt.name} ${pt.icon}
- 리스크 성향: ${pt.risk}형
- 투자 스타일: ${pt.style} 보유
- 한 줄 요약: ${pt.desc}

## 성향 세부 특징
${pt.traits.map(t => `- ${t}`).join("\n")}

## 대화 규칙 (skills → md 선택 기준)
- "${char.name}"의 ${char.personality} 어조와 성격으로 대화할 것
- 수익률(%) 숫자를 반드시 언급하여 인사이트 중심으로 답변
- ChromaDB에서 검색된 실제 거래 데이터를 반드시 활용
- 투자 성향(${pt.risk}×${pt.style})에 맞는 조언 제공
- 한국어, 이모지 1~2개, 2~4문장 간결 답변
`;
}

// ── 설문 ─────────────────────────────────────
export const SURVEY = [
  {
    q: "100만원을 투자했는데 갑자기 -20%가 됐어요. 어떻게 하시겠어요?",
    opts: ["즉시 손절한다. 더 잃기 전에 빠진다.", "일단 지켜본다. 손절 기준을 다시 생각해본다.", "버틴다. 언젠간 회복할 거라 믿는다.", "오히려 추가 매수한다. 더 싸게 살 기회다."],
  },
  {
    q: "투자 수익이 났을 때 주로 언제 파시나요?",
    opts: ["목표 수익률(5~10%) 도달하면 바로 판다.", "단기 이슈가 해소되면 판다. 보통 1~4주.", "기업 펀더멘털이 바뀔 때까지 들고 간다.", "10년 이상 장기 보유. 배당 받으며 기다린다."],
  },
  {
    q: "투자에서 가장 중요하게 생각하는 것은?",
    opts: ["원금 보전. 잃지 않는 것이 최우선이다.", "안정적인 수익. 높지 않아도 꾸준하면 된다.", "수익 극대화. 리스크가 있어도 도전한다.", "고수익 고위험. 크게 벌거나 크게 잃거나."],
  },
  {
    q: "차트를 얼마나 자주 보시나요?",
    opts: ["하루에도 수십 번. 실시간으로 체크한다.", "하루 2~3번. 장 시작·중간·마감 정도.", "주 1~2번. 큰 흐름만 체크한다.", "거의 안 본다. 분기마다 한 번 정도."],
  },
  {
    q: "지인이 '이 종목 무조건 오른다'고 추천했어요. 어떻게 하시겠어요?",
    opts: ["절대 사지 않는다. 근거 없는 정보는 믿지 않는다.", "직접 조사해보고 괜찮으면 소액만 넣는다.", "조사하고 괜찮으면 의미 있는 금액 넣는다.", "믿을 만한 지인이면 바로 크게 넣는다."],
  },
  {
    q: "투자 종목을 고를 때 주로 무엇을 보시나요?",
    opts: ["차트·거래량·모멘텀. 지금 당장 움직이는 걸 본다.", "단기 이슈·뉴스·수급. 1~4주 흐름을 본다.", "실적·성장성. 6개월~1년 보고 투자한다.", "재무제표·배당·밸류에이션. 수년 보고 투자한다."],
  },
  {
    q: "포트폴리오에서 한 종목에 최대 얼마까지 비중을 두시나요?",
    opts: ["10% 이하. 분산이 생명이다.", "20~30% 정도. 적당히 분산한다.", "50% 이상. 확신 있는 종목에 집중한다.", "100% 몰빵도 한다. 확신이 있으면."],
  },
  {
    q: "보유 종목이 갑자기 +15% 급등했어요. 어떻게 하시겠어요?",
    opts: ["즉시 전량 매도. 먹을 만큼 먹었다.", "절반 매도하고 나머지는 홀딩한다.", "목표가 아직 멀었으면 들고 간다.", "급등 후 조정 오면 더 산다. 상승 추세 탄다."],
  },
  {
    q: "투자 손실로 잠을 못 잔 경험이 있나요?",
    opts: ["자주 있다. 손실이 머릿속을 떠나지 않는다.", "가끔 있다. 큰 손실일 때는 신경 쓰인다.", "거의 없다. 투자는 투자일 뿐이다.", "전혀 없다. 손실도 과정이라 생각한다."],
  },
  {
    q: "당신의 투자 목표는 무엇인가요?",
    opts: ["물가상승률 이상의 안정적 수익.", "연 10~20% 꾸준한 수익.", "연 30% 이상 공격적 수익 추구.", "단기간 자산 2배 이상 불리기."],
  },
];

// ── 도움 항목 ─────────────────────────────────
export const HELP_OPTIONS = [
  "📊 포트폴리오 분석 도움",
  "📰 시장 뉴스 요약",
  "💡 종목 추천 받기",
  "📚 투자 공부 가이드",
  "🔔 맞춤 알림 설정",
];

// ══════════════════════════════════════════════
//  API 설정
// ══════════════════════════════════════════════

// ── OpenAI ───────────────────────────────────
export const OPENAI_API_KEY =
  import.meta.env.GOOGLE_API_KEY || "";
export const GPT_API_URL = "/api/openai";
export const GPT_DEFAULT_MODEL = "gemini-4.0-flash-lite";

export function getGPTErrorMessage(status, error = {}) {
  const rawMessage = String(error?.message || "");
  if (status === 429) {
    return "AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.";
  }
  if (status === 400) {
    return "요청 형식에 문제가 있어요. 잠시 후 다시 시도해주세요.";
  }
  if (status === 401 || status === 403) {
    return "API 키가 없거나 권한이 없어요. .env 파일의 GOOGLE_API_KEY를 확인해주세요.";
  }
  if (status >= 500) {
    return "AI 서버 응답이 잠시 불안정해요. 잠시 후 다시 시도해주세요.";
  }
  return rawMessage || `AI 응답 오류 (${status})`;
}

export function buildLocalChatFallback({ char, userMsg, surveyAnswers }) {
  const tone = char?.personality || "친근하고 차분한";
  const style = Object.values(surveyAnswers || {}).filter(Boolean).slice(0, 2).join(", ");
  const riskHint =
    typeof userMsg === "string" && /몰빵|올인|레버리지|빚투|한방/.test(userMsg)
      ? "한 종목에 과하게 집중하기보다 비중을 나눠서 접근하는 게 좋아요."
      : "진입 전에는 분할 매수와 손절 기준을 같이 정해두면 훨씬 안정적이에요.";

  return `${char?.name || "AI 파트너"}가 ${tone} 톤으로 정리해드릴게요. ${style ? `지금 투자 성향은 ${style} 쪽으로 보여요. ` : ""}${riskHint} 지금은 Gemini AI 연결이 일시적으로 어려워서 로컬 가이드로 먼저 안내드렸어요.`;
}

export function buildLocalOrderFallback({ char, stock, surveyAnswers }) {
  const style = Object.values(surveyAnswers || {}).filter(Boolean).slice(0, 2).join(", ");
  return `${char?.name || "AI 파트너"} 의견으로는 ${stock.name} 매수 전 평균매입가와 현재가 차이, 보유 기간, 최근 변동성을 함께 보는 게 좋아요. ${style ? `현재 성향은 ${style} 쪽이라 ` : ""}한 번에 진입하기보다 분할 매수로 접근하는 쪽이 더 안정적이에요.`;
}

// ── TradingView 심볼 매핑 ────────────────────────
export const TV_SYMBOL_MAP = {
  "005930": "KRX:005930",
  "000660": "KRX:000660",
  "005380": "KRX:005380",
  "035420": "KRX:035420",
  "035720": "KRX:035720",
  "NVDA":   "NASDAQ:NVDA",
  "AAPL":   "NASDAQ:AAPL",
  "TSLA":   "NASDAQ:TSLA",
  "MSFT":   "NASDAQ:MSFT",
  "AMZN":   "NASDAQ:AMZN",
  "TSM":    "NYSE:TSM",
  "000270": "KRX:000270",
  "373220": "KRX:373220",
  "068270": "KRX:068270",
  "005490": "KRX:005490",
  "105560": "KRX:105560",
};
export function toTVSymbol(code) {
  return TV_SYMBOL_MAP[code] ?? code;
}

// ── 주식 REST API (Yahoo Finance) ─────────────
// API 키 불필요 — Vite 프록시(/api/yahoo)로 CORS 우회
export const YAHOO_STOCK_URL = "/api/yahoo";

// 종목 코드 → Yahoo Finance 심볼 변환 (한국 주식은 .KS 접미사)
export function toYahooSymbol(code) {
  if (/^\d{6}$/.test(code)) return `${code}.KS`;
  return code;
}

// ── 특정 날짜 OHLC 조회 (과거 거래가 산출용) ─
// open×0.38 + close×0.62 사이 값을 "체결가"로 사용
export async function fetchHistoricalOHLC(code, dateStr) {
  try {
    const yahooSym = toYahooSymbol(code);
    const date   = new Date(dateStr + "T00:00:00Z");
    const period1 = Math.floor(date.getTime() / 1000);
    const period2 = period1 + 5 * 24 * 3600; // +5일 (주말/공휴일 포함)
    const url = `${YAHOO_STOCK_URL}/v8/finance/chart/${yahooSym}?interval=1d&period1=${period1}&period2=${period2}`;
    const res  = await fetch(url);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const q  = result?.indicators?.quote?.[0];
    const ts = result?.timestamp;
    if (!ts || !q || !q.open[0]) return null;
    const open  = q.open[0];
    const close = q.close[0];
    // 시가와 종가 사이 38:62 비율 지점을 체결가로 사용
    const filledPrice = Math.round(open * 0.38 + close * 0.62);
    return { open, close, filledPrice, timestamp: ts[0] };
  } catch {
    return null;
  }
}

// ── 주식 현재가 조회 ──────────────────────────
export async function fetchStockQuote(symbol) {
  try {
    const yahooSym = toYahooSymbol(symbol);
    const url = `${YAHOO_STOCK_URL}/v8/finance/chart/${yahooSym}?interval=1m&range=1d`;
    const res  = await fetch(url);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    const price    = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change   = parseFloat((price - prevClose).toFixed(2));
    const pct      = parseFloat(((change / prevClose) * 100).toFixed(2));
    return {
      price,
      change,
      pct,
      prev:   prevClose,
      volume: meta.regularMarketVolume || 0,
    };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════
//  CSS 애니메이션
// ══════════════════════════════════════════════
export const ANIM_CSS = `
@keyframes charBounce  { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-8px)} }
@keyframes fadeIn      { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse       { 0%,100%{transform:scale(1)}  50%{transform:scale(1.12)} }
@keyframes successPop  { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
@keyframes podiumRise  { from{transform:scaleY(0);transform-origin:bottom} to{transform:scaleY(1);transform-origin:bottom} }
@keyframes slideUp     { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes slideRight  { from{transform:translateX(-100%);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes glow        { 0%,100%{box-shadow:0 0 20px rgba(167,139,250,0.4)} 50%{box-shadow:0 0 40px rgba(167,139,250,0.8)} }
@keyframes ticker      { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
@keyframes charFloat   { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-10px) rotate(1deg)} }
@keyframes blink       { 0%,100%{opacity:1} 50%{opacity:0.4} }
`;
