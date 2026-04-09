// ═══════════════════════════════════════
//  GameScreens.jsx  —  게임 온보딩 + 메인
// ═══════════════════════════════════════
import { useState, useEffect, useRef } from "react";
import {
  CHARACTERS, SURVEY, HELP_OPTIONS,
  PERSONALITY_TYPES, calcPersonality,
  GPT_API_URL, GPT_DEFAULT_MODEL,
  CURRENT_HOLDINGS, PAST_TRADES, ORDER_STOCKS, fetchStockQuote, fetchHistoricalOHLC, getGPTErrorMessage, buildLocalChatFallback,
} from "../data";
import { Char3D, Card3D, Btn3D, SubHeader3D, Room3D } from "../components";

// ── RAG 컨텍스트 뱃지 ──────────────────────────────────────
// AI 응답 아래에 사용된 skills + ChromaDB 참조 데이터를 표시
const SKILL_LABEL = {
  get_persona:        { icon:"🧠", label:"투자성향 프로필" },
  get_trade_history:  { icon:"📈", label:"매매 이력" },
  get_trade_journal:  { icon:"📋", label:"매매일지" },
};

function RagContextBadge({ docs, longTermDocs, skills, charColor }) {
  const [openDocs, setOpenDocs] = useState(false);
  const [openMem, setOpenMem] = useState(false);
  if ((!docs || docs.length === 0) && (!skills || skills.length === 0) && (!longTermDocs || longTermDocs.length === 0)) return null;
  return (
    <div style={{ marginTop:4, marginLeft:37, maxWidth:"80%" }}>
      {/* 사용된 Skills 뱃지 */}
      <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:4 }}>
        {(skills || []).map(s => {
          const m = SKILL_LABEL[s] || { icon:"📄", label:s };
          return (
            <span key={s} style={{ display:"inline-flex",alignItems:"center",gap:3,
              background:"#EDE9FE",border:"1px solid #A78BFA55",borderRadius:10,
              padding:"2px 8px",fontSize:9,color:"#6D28D9",fontWeight:700 }}>
              {m.icon} {m.label}
            </span>
          );
        })}
        {/* 장기기억 뱃지 */}
        {longTermDocs && longTermDocs.length > 0 && (
          <span
            onClick={() => setOpenMem(v => !v)}
            style={{ display:"inline-flex",alignItems:"center",gap:3,cursor:"pointer",
              background:"#FFF7ED",border:"1px solid #FCD34D",borderRadius:10,
              padding:"2px 8px",fontSize:9,color:"#92400E",fontWeight:700 }}>
            🧠 장기기억 {longTermDocs.length}건 {openMem ? "▲" : "▼"}
          </span>
        )}
        {/* 외부 데이터 뱃지 */}
        {docs && docs.length > 0 && (
          <span
            onClick={() => setOpenDocs(v => !v)}
            style={{ display:"inline-flex",alignItems:"center",gap:3,cursor:"pointer",
              background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:10,
              padding:"2px 8px",fontSize:9,color:"#166534",fontWeight:700 }}>
            📊 외부 데이터 {docs.length}건 {openDocs ? "▲" : "▼"}
          </span>
        )}
      </div>
      {/* 장기기억 펼치기 */}
      {openMem && longTermDocs && longTermDocs.length > 0 && (
        <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:4 }}>
          {longTermDocs.map((doc, i) => (
            <div key={i} style={{ background:"#FFF7ED",border:"1px solid #FCD34D55",
              borderRadius:8,padding:"6px 9px",fontSize:10,color:"#555",lineHeight:1.5 }}>
              <span style={{ fontWeight:700,color:"#92400E",marginRight:4 }}>과거 {i+1}</span>
              {doc.length > 150 ? doc.slice(0, 150) + "…" : doc}
            </div>
          ))}
        </div>
      )}
      {/* 외부 데이터 펼치기 */}
      {openDocs && docs && docs.length > 0 && (
        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
          {docs.map((doc, i) => (
            <div key={i} style={{ background:"#F0FDF4",border:"1px solid #86EFAC55",
              borderRadius:8,padding:"6px 9px",fontSize:10,color:"#555",lineHeight:1.5 }}>
              <span style={{ fontWeight:700,color:"#166534",marginRight:4 }}>#{i+1}</span>
              {doc.length > 130 ? doc.slice(0, 130) + "…" : doc}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  1. 캐릭터 선택
// ══════════════════════════════════════════════
export function SelectCharacterScreen({ onBack, onNext, selectedChar, setSelectedChar }) {
  const char = CHARACTERS.find(c => c.id === selectedChar);
  return (
    <div style={S.wrap}>
      <div style={S.darkHeader}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div onClick={onBack} style={S.backBtn}>←</div>
          <div>
            <div style={S.stepLabel}>STEP 1</div>
            <div style={S.screenTitle}>캐릭터 선택</div>
          </div>
        </div>
      </div>
      <div style={S.scrollBody}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
          {CHARACTERS.map(c => (
            <Card3D key={c.id}
              color={selectedChar===c.id ? `linear-gradient(135deg,${c.grad[0]}33,${c.grad[1]}22)` : "#fff"}
              onClick={() => setSelectedChar(c.id)}
              style={{ padding:"18px 10px",textAlign:"center",border:selectedChar===c.id?`2.5px solid ${c.color}`:"2.5px solid transparent" }}>
              <div style={{ display:"flex",justifyContent:"center",marginBottom:8 }}>
                <Char3D char={c} size={58} bounce={selectedChar===c.id} shadow={false} />
              </div>
              <div style={{ fontWeight:800,fontSize:14 }}>{c.name}</div>
              <div style={{ fontSize:10,color:"#888",marginTop:3,lineHeight:1.4 }}>{c.desc}</div>
              {selectedChar===c.id && (
                <div style={{ marginTop:8,background:`linear-gradient(90deg,${c.grad[0]},${c.grad[1]})`,borderRadius:20,padding:"2px 10px",fontSize:10,color:"#fff",fontWeight:800,display:"inline-block" }}>선택됨 ✓</div>
              )}
            </Card3D>
          ))}
        </div>
        <Card3D color="linear-gradient(135deg,#e8f4ff,#ddeeff)" style={{ padding:14,marginBottom:16 }} depth={false}>
          <div style={{ fontWeight:800,marginBottom:8,fontSize:13,color:"#0066aa" }}>💬 AI 챗봇 활용 안내</div>
          {["선택한 캐릭터 성격으로 AI가 대화해요","투자 성향에 맞춘 개인화 조언","주문 시 과거 데이터 기반 충고 제공","퀘스트 완료로 포인트·레벨 업!"].map((t,i) => (
            <div key={i} style={{ fontSize:12,color:"#446688",marginBottom:4,display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:"#0088cc",flexShrink:0 }} />{t}
            </div>
          ))}
        </Card3D>
        <Btn3D onClick={() => selectedChar && onNext()} color={selectedChar ? char?.color : "#ccc"} style={{ marginBottom:20 }} disabled={!selectedChar}>
          {selectedChar ? `${char?.name}와 시작하기 →` : "캐릭터를 선택하세요"}
        </Btn3D>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  2. 캐릭터 인트로
// ══════════════════════════════════════════════
export function CharIntroScreen({ char, onNext }) {
  return (
    <div style={{ ...S.wrap, background:`linear-gradient(160deg,${char?.grad[0]}44,${char?.grad[1]}22,#fff)` }}>
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28 }}>
        <div style={{ marginBottom:16,animation:"fadeIn 0.5s ease" }}><Char3D char={char} size={108} bounce={true} /></div>
        <div style={{ fontSize:28,fontWeight:900,color:"#1a1a2e" }}>{char?.name}</div>
        <div style={{ fontSize:13,color:"#666",marginTop:4 }}>{char?.desc}</div>
        <div style={{ background:`linear-gradient(90deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:30,padding:"4px 16px",fontSize:11,color:"#fff",fontWeight:700,marginTop:8,marginBottom:28 }}>{char?.personality} 성격</div>
        <Card3D color="#fff" style={{ padding:20,width:"100%",marginBottom:24 }} depth={false}>
          <div style={{ fontSize:13,color:"#444",lineHeight:1.9,textAlign:"center" }}>
            안녕하세요! 저는 <b style={{ color:char?.color }}>{char?.name}</b>이에요 👋<br />
            여러분의 투자 여정을 함께 도와드릴게요!<br />먼저 투자 성향을 파악해볼까요? 😊
          </div>
        </Card3D>
        <Btn3D onClick={onNext} color={char?.color} style={{ width:"100%" }}>투자 성향 분석 시작하기 →</Btn3D>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  3. 설문 + 과거 데이터 연동 (대화형)
// ══════════════════════════════════════════════
export function SurveyScreen({ char, surveyAnswers, setSurveyAnswers, dataConsent, setDataConsent, onNext }) {
  const TOTAL = SURVEY.length + 1; // 10 설문 + 1 데이터 동의
  const [currentQ,       setCurrentQ]       = useState(0);
  const [animKey,        setAnimKey]         = useState(0);
  const [showTradeModal, setShowTradeModal]  = useState(false);
  const [realTrades,     setRealTrades]      = useState(PAST_TRADES);
  const [loadingTrades,  setLoadingTrades]   = useState(false);

  const isConsentQ = currentQ === SURVEY.length;
  const progress   = currentQ / TOTAL;

  useEffect(() => {
    if (!showTradeModal) return;
    setLoadingTrades(true);
    (async () => {
      const fetched = await Promise.all(PAST_TRADES.map(t => fetchHistoricalOHLC(t.code, t.date)));
      const buyPriceMap = {};
      const updated = PAST_TRADES.map((t, i) => {
        const ohlc = fetched[i];
        if (!ohlc) return t;
        const price = ohlc.filledPrice;
        if (t.type === "buy") { buyPriceMap[t.code] = price; return { ...t, price }; }
        const buyPrice = buyPriceMap[t.code] ?? t.price;
        return { ...t, price, profit:(price-buyPrice)*t.qty, profitPct:((price-buyPrice)/buyPrice*100).toFixed(1) };
      });
      setRealTrades(updated);
      setLoadingTrades(false);
    })();
  }, [showTradeModal]);

  const advance = () => {
    setAnimKey(k => k + 1);
    if (currentQ < TOTAL - 1) setCurrentQ(q => q + 1);
    else onNext();
  };

  const handleAnswer = (idx) => {
    setSurveyAnswers({ ...surveyAnswers, [currentQ]: idx });
    setTimeout(advance, 350);
  };

  const handleConsent = (agreed) => {
    if (agreed) {
      setShowTradeModal(true); // 예 → 데이터 미리보기 모달
    } else {
      setDataConsent(false);
      setTimeout(onNext, 350);
    }
  };

  const q = !isConsentQ ? SURVEY[currentQ] : null;

  return (
    <div style={{ ...S.wrap, background:`linear-gradient(160deg,#1a0a3e,#2d1b69,#0f2060)`, position:"relative" }}>

      {/* ── 과거 거래 데이터 미리보기 모달 ── */}
      {showTradeModal && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"flex-end",zIndex:200,backdropFilter:"blur(4px)" }}>
          <div style={{ background:"linear-gradient(160deg,#1a1a2e,#0f2060)",width:"100%",borderRadius:"24px 24px 0 0",padding:22,animation:"slideUp 0.35s ease",maxHeight:"80vh",display:"flex",flexDirection:"column" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexShrink:0 }}>
              <div>
                <div style={{ fontSize:16,fontWeight:900,color:"#fff" }}>📂 연동될 데이터 미리보기</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2 }}>AI가 아래 데이터를 학습해 개인화된 조언을 드려요</div>
              </div>
              <div onClick={() => setShowTradeModal(false)} style={{ width:32,height:32,background:"rgba(255,255,255,0.1)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:16 }}>✕</div>
            </div>
            <div style={{ overflowY:"auto",flex:1 }}>
              <div style={{ fontSize:12,color:"#FFD580",fontWeight:700,marginBottom:8 }}>📈 현재 보유 종목</div>
              {CURRENT_HOLDINGS.map((h,i) => {
                const ret = ((h.currentPrice-h.avgPrice)/h.avgPrice*100).toFixed(1);
                const isP = ret >= 0;
                return (
                  <div key={i} style={{ background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>{h.name}</div>
                      <div style={{ fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2 }}>평균 {h.market==="KRX"?`${h.avgPrice.toLocaleString()}원`:`$${h.avgPrice}`} · {h.qty}주</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13,fontWeight:800,color:isP?"#4ADE80":"#FF6B6B" }}>{isP?"+":""}{ret}%</div>
                      <div style={{ fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2 }}>수익률</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize:12,color:"#A78BFA",fontWeight:700,marginBottom:8,marginTop:14 }}>🕐 과거 거래 내역</div>
              {loadingTrades
                ? <div style={{ textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.4)",fontSize:12 }}>실제 거래가 조회 중...</div>
                : realTrades.map((t,i) => (
                  <div key={i} style={{ background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 14px",marginBottom:8 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ background:t.type==="buy"?"rgba(74,222,128,0.2)":"rgba(255,107,107,0.2)",color:t.type==="buy"?"#4ADE80":"#FF6B6B",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700 }}>{t.type==="buy"?"매수":"매도"}</span>
                        <span style={{ fontSize:13,fontWeight:800,color:"#fff" }}>{t.name}</span>
                      </div>
                      <span style={{ fontSize:10,color:"rgba(255,255,255,0.4)" }}>{t.date}</span>
                    </div>
                    <div style={{ display:"flex",gap:12,fontSize:11,color:"rgba(255,255,255,0.6)" }}>
                      <span>{t.price.toLocaleString()}원 × {t.qty}주</span>
                      {t.profit && <span style={{ color:"#4ADE80",fontWeight:700 }}>수익 +{t.profit.toLocaleString()}원 (+{t.profitPct}%)</span>}
                    </div>
                    {t.note && <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:4 }}>💬 {t.note}</div>}
                  </div>
                ))}
            </div>
            <div style={{ display:"flex",gap:10,marginTop:16,flexShrink:0 }}>
              <div onClick={() => { setDataConsent(false); setShowTradeModal(false); setTimeout(onNext,200); }}
                style={{ flex:1,background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"12px",textAlign:"center",color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:13,cursor:"pointer" }}>
                동의 취소
              </div>
              <div onClick={() => { setDataConsent(true); setShowTradeModal(false); setTimeout(onNext,200); }}
                style={{ flex:1.5,background:"linear-gradient(135deg,#7c3aed,#4f46e5)",borderRadius:14,padding:"12px",textAlign:"center",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(124,58,237,0.5)" }}>
                ✓ 데이터 제공 동의
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 상단 진행바 ── */}
      <div style={{ position:"absolute",top:0,left:0,right:0,height:4,background:"rgba(255,255,255,0.1)",zIndex:10 }}>
        <div style={{ height:"100%",width:`${progress*100}%`,background:`linear-gradient(90deg,${char?.grad?.[0]},${char?.grad?.[1]})`,borderRadius:4,transition:"width 0.4s ease" }} />
      </div>

      {/* ── 질문 번호 ── */}
      <div style={{ position:"absolute",top:14,right:16,background:"rgba(255,255,255,0.12)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700,zIndex:10 }}>
        {currentQ + 1} / {TOTAL}
      </div>

      {/* ── 캐릭터 영역 ── */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:40 }}>
        <div style={{ animation:"fadeIn 0.4s ease" }}>
          <Char3D char={char} size={110} bounce={true} />
        </div>

        {/* ── 질문 버블 ── */}
        <div key={animKey} style={{ marginTop:24,width:"86%",animation:"fadeIn 0.35s ease" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:1 }}>
            질문 No. {currentQ + 1}
          </div>
          <div style={{ background:"rgba(255,255,255,0.1)",backdropFilter:"blur(8px)",borderRadius:20,padding:"18px 20px",border:"1px solid rgba(255,255,255,0.15)" }}>
            <div style={{ fontSize:15,fontWeight:800,color:"#fff",textAlign:"center",lineHeight:1.6 }}>
              {isConsentQ
                ? "과거 거래 데이터를\nAI에 연동하시겠습니까?"
                : q.q}
            </div>
            {isConsentQ && (
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.5)",textAlign:"center",marginTop:8,lineHeight:1.5 }}>
                보유 종목·거래내역을 제공하면<br />더 정확한 맞춤 조언을 받을 수 있어요
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 답변 버튼 영역 ── */}
      <div key={`opts-${animKey}`} style={{ padding:"0 16px 32px",display:"flex",flexDirection:"column",gap:10,animation:"slideUp 0.35s ease" }}>
        {isConsentQ ? (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            {[
              { label:"예", action:() => handleConsent(true),  bg:`linear-gradient(135deg,${char?.grad?.[0]},${char?.grad?.[1]})`, shadow:`0 4px 20px ${char?.color}66` },
              { label:"아니요", action:() => handleConsent(false), bg:"rgba(255,255,255,0.12)", shadow:"none" },
            ].map(btn => (
              <div key={btn.label} onClick={btn.action}
                style={{ background:btn.bg,borderRadius:16,padding:"16px",textAlign:"center",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:btn.shadow,border:"1px solid rgba(255,255,255,0.15)" }}>
                {btn.label}
              </div>
            ))}
          </div>
        ) : (
          q.opts.map((opt, j) => (
            <div key={j} onClick={() => handleAnswer(j)}
              style={{
                background: surveyAnswers[currentQ]===j
                  ? `linear-gradient(135deg,${char?.grad?.[0]},${char?.grad?.[1]})`
                  : "rgba(255,255,255,0.1)",
                backdropFilter:"blur(6px)",
                border: surveyAnswers[currentQ]===j
                  ? `2px solid ${char?.color}`
                  : "1px solid rgba(255,255,255,0.2)",
                borderRadius:14,padding:"13px 16px",cursor:"pointer",
                color:"#fff",fontSize:13,fontWeight: surveyAnswers[currentQ]===j ? 800 : 400,
                lineHeight:1.5,transition:"all 0.2s",
                boxShadow: surveyAnswers[currentQ]===j ? `0 4px 16px ${char?.color}55` : "none",
              }}>
              {opt}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  4. 로딩
// ══════════════════════════════════════════════
export function LoadingScreen({ char, onDone }) {
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setProg(p => { if(p>=100){clearInterval(iv);setTimeout(onDone,400);return 100;} return p+1.5; });
    }, 40);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ ...S.wrap,background:"linear-gradient(160deg,#0a0a1a,#1a1a3e,#0f2460)",alignItems:"center",justifyContent:"center" }}>
      {[...Array(18)].map((_,i) => <div key={i} style={{ position:"absolute",width:2,height:2,background:"#fff",borderRadius:"50%",top:`${Math.random()*70}%`,left:`${Math.random()*100}%`,opacity:Math.random()*0.6+0.2,animation:`pulse ${1+Math.random()*2}s infinite` }} />)}
      <div style={{ zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",width:"100%" }}>
        <Char3D char={char} size={100} bounce={true} />
        <div style={{ fontSize:22,fontWeight:900,color:"#fff",marginTop:20,marginBottom:6 }}>분석 중이에요...</div>
        <div style={{ fontSize:12,color:"#8899cc",marginBottom:40,textAlign:"center",lineHeight:1.7 }}>{char?.name}가 당신의 투자 성향을<br />꼼꼼히 분석하고 있어요 🔍</div>
        <div style={{ width:"70%",background:"rgba(255,255,255,0.1)",borderRadius:30,height:12,overflow:"hidden",marginBottom:10 }}>
          <div style={{ width:`${prog}%`,height:"100%",borderRadius:30,transition:"width 0.1s",background:`linear-gradient(90deg,${char?.grad[1]},${char?.grad[0]},#fff)`,boxShadow:`0 0 12px ${char?.color}99` }} />
        </div>
        <div style={{ color:char?.color,fontWeight:800,fontSize:18 }}>{Math.round(prog)}%</div>
        <div style={{ color:"#5566aa",fontSize:12,marginTop:18,height:20 }}>
          {prog<35?"📊 설문 데이터 처리 중...":prog<65?"🧠 투자 성향 분류 중...":prog<90?"🎯 맞춤 전략 수립 중...":"✨ 분석 완료!"}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  5. 도움 항목 선택
// ══════════════════════════════════════════════
export function HelpCheckScreen({ char, helpChecks, setHelpChecks, onNext }) {
  return (
    <div style={S.wrap}>
      <div style={S.darkHeader}>
        <div style={{ fontSize:18,fontWeight:900,color:"#fff" }}>도움 항목 선택</div>
        <div style={{ fontSize:11,color:"#8899bb",marginTop:2 }}>{char?.name}가 도와드릴 항목을 선택하세요</div>
      </div>
      <div style={S.scrollBody}>
        <Card3D color={`linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)`} style={{ padding:14,marginBottom:14,display:"flex",alignItems:"center",gap:14 }} depth={false}>
          <Char3D char={char} size={50} shadow={false} />
          <div style={{ fontSize:12,color:"#444",lineHeight:1.7 }}>도움받고 싶은 항목을 <b>모두</b> 체크해주세요!</div>
        </Card3D>
        {HELP_OPTIONS.map((opt,i) => (
          <Card3D key={i} onClick={() => { const n=[...helpChecks];n[i]=!n[i];setHelpChecks(n); }}
            color={helpChecks[i] ? `linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)` : "#fff"}
            style={{ padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:14,border:helpChecks[i]?`2.5px solid ${char?.color}`:"2.5px solid transparent" }}>
            <div style={{ width:26,height:26,borderRadius:9,flexShrink:0,transition:"all 0.2s",
              border:`2.5px solid ${helpChecks[i]?char?.color:"#ddd"}`,
              background:helpChecks[i]?`linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})`:"#fff",
              display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:900,
              boxShadow:helpChecks[i]?`0 4px 12px ${char?.color}55`:"none" }}>
              {helpChecks[i]?"✓":""}
            </div>
            <span style={{ fontSize:14,fontWeight:helpChecks[i]?700:400,color:helpChecks[i]?"#1a1a2e":"#555" }}>{opt}</span>
          </Card3D>
        ))}
        <Btn3D onClick={() => helpChecks.some(Boolean) && onNext()} color={char?.color} style={{ marginTop:8,marginBottom:20 }} disabled={!helpChecks.some(Boolean)}>
          선택 완료 →
        </Btn3D>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  닉네임 모달
// ══════════════════════════════════════════════
function NicknameModal({ onConfirm, onCancel }) {
  const [value, setValue] = useState("");
  return (
    <div style={{
      position:"absolute", inset:0, zIndex:9999,
      background:"rgba(8,14,52,0.88)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{
        background:"#fff",
        borderRadius:20,
        padding:"24px 20px 20px",
        width:"82%", maxWidth:320,
        position:"relative",
        boxShadow:"0 16px 48px rgba(0,0,30,0.45)",
      }}>
        {/* X 닫기 */}
        <div onClick={onCancel} style={{
          position:"absolute", top:14, right:16,
          fontSize:16, color:"#aaa", cursor:"pointer", fontWeight:700, lineHeight:1,
        }}>X</div>

        {/* 제목 */}
        <div style={{ textAlign:"center", fontWeight:700, fontSize:15, color:"#1a1a2e", marginBottom:18 }}>
          닉네임 설정
        </div>

        {/* 입력창 */}
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key==="Enter" && value.trim() && onConfirm(value.trim())}
          placeholder="닉네임을 입력하세요"
          maxLength={12}
          style={{
            width:"100%", boxSizing:"border-box",
            padding:"12px 16px",
            border:"none",
            borderRadius:30,
            fontSize:14, fontWeight:500,
            textAlign:"center",
            outline:"none",
            marginBottom:16,
            color:"#333",
            background:"#ebebeb",
          }}
        />

        {/* 버튼 */}
        <div style={{ display:"flex", gap:10 }}>
          <div onClick={onCancel} style={{
            flex:1, padding:"13px 0",
            background:"#d9d9d9",
            borderRadius:30,
            textAlign:"center", fontWeight:700, fontSize:14, color:"#555",
            cursor:"pointer",
          }}>
            취소
          </div>
          <div onClick={() => value.trim() && onConfirm(value.trim())} style={{
            flex:1, padding:"13px 0",
            background: value.trim() ? "#d63384" : "#e8a0c0",
            borderRadius:30,
            textAlign:"center", fontWeight:700, fontSize:14, color:"#fff",
            cursor: value.trim() ? "pointer" : "default",
          }}>
            확인
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  6. 분석 결과
// ══════════════════════════════════════════════
export function AnalysisResultScreen({ char, dataConsent, helpChecks, surveyAnswers, onGoMain }) {
  const pt = calcPersonality(surveyAnswers || {});
  const [showNickModal, setShowNickModal] = useState(false);
  return (
    <div style={S.wrap}>
      <div style={S.darkHeader}>
        <div style={{ fontSize:18,fontWeight:900,color:"#fff" }}>분석 완료!</div>
        <div style={{ fontSize:11,color:"#8899bb",marginTop:2 }}>{char?.name}의 맞춤 분석 결과예요</div>
      </div>
      <div style={S.scrollBody}>
        {/* 성향 타입 카드 */}
        <div style={{ background:`linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)`,borderRadius:20,padding:16,marginBottom:14,border:`2px solid ${char?.color}33` }}>
          <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:12 }}>
            <Char3D char={char} size={58} shadow={false} />
            <div>
              <div style={{ fontWeight:900,fontSize:17 }}>{pt.name}</div>
              <div style={{ display:"flex",gap:6,marginTop:5 }}>
                <span style={{ background:`${pt.color}22`,color:pt.color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800 }}>
                  {pt.icon} {pt.risk}형
                </span>
                <span style={{ background:"#f0f0f8",color:"#555",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700 }}>
                  {pt.style} 매매
                </span>
              </div>
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.7)",borderRadius:12,padding:"10px 12px",fontSize:12,color:"#444",fontStyle:"italic",lineHeight:1.6 }}>
            "{pt.desc}"
          </div>
        </div>

        {/* 4개 분석 카드 */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
          {pt.cards.map((c,i) => (
            <Card3D key={i} color={`linear-gradient(135deg,${c.color}22,${c.color}11)`} style={{ padding:14,border:`2px solid ${c.color}44` }}>
              <div style={{ fontSize:28,marginBottom:6 }}>{c.icon}</div>
              <div style={{ fontSize:10,color:"#888",marginBottom:3 }}>{c.title}</div>
              <div style={{ fontWeight:900,fontSize:13,color:"#1a1a2e" }}>{c.value}</div>
            </Card3D>
          ))}
        </div>

        {/* 특징 리스트 */}
        <Card3D color="#fff" style={{ padding:14,marginBottom:14 }} depth={false}>
          <div style={{ fontWeight:800,marginBottom:10,fontSize:13 }}>📋 {pt.name}의 특징</div>
          {pt.traits.map((t,i) => (
            <div key={i} style={{ fontSize:12,color:"#555",marginBottom:7,display:"flex",alignItems:"flex-start",gap:7,lineHeight:1.5 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:pt.color,flexShrink:0,marginTop:4 }} />
              {t}
            </div>
          ))}
        </Card3D>

        {/* 선택한 도움 항목 */}
        {helpChecks.some(Boolean) && (
          <Card3D color="linear-gradient(135deg,#f0fff4,#e8ffee)" style={{ padding:12,marginBottom:20 }} depth={false}>
            <div style={{ fontWeight:800,fontSize:12,marginBottom:6,color:"#226633" }}>✅ 선택한 도움 항목</div>
            {HELP_OPTIONS.filter((_,i) => helpChecks[i]).map((opt,i) => (
              <div key={i} style={{ fontSize:12,color:"#446644",marginBottom:4,display:"flex",alignItems:"center",gap:6 }}>
                <div style={{ width:5,height:5,borderRadius:"50%",background:"#22aa44" }} />{opt}
              </div>
            ))}
          </Card3D>
        )}

        <Btn3D onClick={() => setShowNickModal(true)} color={char?.color} style={{ marginBottom:20 }}>홈으로 이동하기 🏠</Btn3D>
      </div>

      {showNickModal && (
        <NicknameModal
          onConfirm={(nick) => { setShowNickModal(false); onGoMain(nick); }}
          onCancel={() => setShowNickModal(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  7. 나의 투자 원칙 화면
// ══════════════════════════════════════════════
const TRIGGER_LABELS = {
  buy_ath:      "매수 시 전고점 도달 경고",
  weight_limit: "종목 비중 초과 경고",
  profit_target:"보유 종목 수익률 도달 알림",
  loss_cut:     "보유 종목 손실 도달 알림",
};
const CATEGORY_COLORS = {
  "기술적":"#6BBFFF", "자산관리":"#FFD580", "익절":"#4ADE80",
  "손절":"#FF6B6B", "심리":"#A78BFA", "기타":"#aaa",
};
const CATEGORIES = ["기술적", "자산관리", "익절", "손절", "심리", "기타"];

function PrincipleScreen({ char, principles, setPrinciples, notifs, setNotifs, surveyAnswers, onBack }) {
  const [showAdd,      setShowAdd]      = useState(false);
  const [newText,      setNewText]      = useState("");
  const [newCategory,  setNewCategory]  = useState("기타");
  const [newTrigger,   setNewTrigger]   = useState("profit_target");
  const [newThreshold, setNewThreshold] = useState("");
  const [report,         setReport]         = useState("");
  const [reportLoading,  setReportLoading]  = useState(false);
  const [reportDone,     setReportDone]     = useState(false);
  const [suggestion,     setSuggestion]     = useState(null);  // { text, category, triggerType, threshold, reason, emoji }
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggest,    setShowSuggest]    = useState(false);
  const nextId = useRef(principles.length + 1);

  // 원칙 토글
  const toggle = (id) =>
    setPrinciples(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));

  // 원칙 삭제
  const remove = (id) =>
    setPrinciples(prev => prev.filter(p => p.id !== id));

  // 원칙 추가
  const addPrinciple = () => {
    if (!newText.trim()) return;
    const p = {
      id: nextId.current++,
      category: newCategory,
      text: newText.trim(),
      enabled: true,
      triggerType: newTrigger,
      threshold: newThreshold !== "" ? Number(newThreshold) : null,
    };
    setPrinciples(prev => [...prev, p]);
    setNewText(""); setNewThreshold(""); setShowAdd(false);
  };

  // 보유 종목 원칙 체크 → 투자원칙 알림 생성
  const checkAndNotify = () => {
    const triggered = [];
    principles.filter(p => p.enabled).forEach(p => {
      CURRENT_HOLDINGS.forEach(h => {
        const ret = (h.currentPrice - h.avgPrice) / h.avgPrice * 100;
        if (p.triggerType === "profit_target" && p.threshold != null && ret >= p.threshold) {
          const already = notifs.some(n => n.type === "principle" && n.stock === h.code && n.principleId === p.id);
          if (!already) triggered.push({
            id: Date.now() + Math.random(),
            icon: "⚖️", type: "principle", stock: h.code,
            title: `${h.name} — ${p.text}`,
            desc: `${h.name}이(가) +${ret.toFixed(1)}% 도달했습니다. 설정한 원칙(${p.text})을 확인하세요.`,
            time: "방금", read: false, principleId: p.id,
          });
        }
        if (p.triggerType === "loss_cut" && p.threshold != null && ret <= p.threshold) {
          const already = notifs.some(n => n.type === "principle" && n.stock === h.code && n.principleId === p.id);
          if (!already) triggered.push({
            id: Date.now() + Math.random(),
            icon: "🛡️", type: "principle", stock: h.code,
            title: `${h.name} — ${p.text}`,
            desc: `${h.name}이(가) ${ret.toFixed(1)}% 손실 구간입니다. 설정한 원칙(${p.text})을 확인하세요.`,
            time: "방금", read: false, principleId: p.id,
          });
        }
      });
    });
    if (triggered.length > 0) setNotifs(prev => [...triggered, ...prev]);
    return triggered.length;
  };

  // AI 코칭 리포트
  const generateReport = async () => {
    if (reportDone || reportLoading) return;
    setReportLoading(true);
    try {
      const pList = principles.map(p => `- [${p.category}] ${p.text}${p.threshold != null ? ` (기준: ${p.threshold}%)` : ""} (${p.enabled ? "활성" : "비활성"})`).join("\n");
      const prompt =
        `투자자의 원칙 목록:\n${pList}\n투자성향: ${JSON.stringify(surveyAnswers)}\n` +
        `위 원칙들에 대해 ${char?.personality} 성격으로 간결한 코칭 리포트를 작성해주세요. ` +
        `잘 설계된 원칙 칭찬, 보완할 점, 추가하면 좋을 원칙 제안 포함. 300자 이내, 이모지 포함, 한국어.`;
      const res = await fetch(GPT_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GPT_DEFAULT_MODEL,
          messages: [
            { role: "system", content: `당신은 투자 코치 캐릭터 "${char?.name}"입니다.` },
            { role: "user",   content: prompt },
          ],
          max_tokens: 400,
        }),
      });
      const data = await res.json();
      setReport(res.ok ? (data.choices?.[0]?.message?.content || "리포트를 생성할 수 없어요.") : "리포트 생성에 실패했어요.");
      setReportDone(true);
    } catch { setReport("리포트 생성에 실패했어요."); setReportDone(true); }
    setReportLoading(false);
  };

  // 보완 대책 제안 생성
  const generateSuggestion = async () => {
    setSuggestLoading(true); setShowSuggest(true); setSuggestion(null);
    try {
      const pList = principles.map(p => `[${p.category}] ${p.text}`).join(", ");
      const hList = CURRENT_HOLDINGS.map(h => {
        const ret = ((h.currentPrice - h.avgPrice) / h.avgPrice * 100).toFixed(1);
        return `${h.name}(${ret}%)`;
      }).join(", ");
      const prompt =
        `투자자의 현재 원칙: ${pList || "없음"}\n` +
        `보유 종목: ${hList}\n투자 성향: ${JSON.stringify(surveyAnswers)}\n\n` +
        `위 정보를 분석해서 아직 없는 보완 원칙 1개를 제안해주세요.\n` +
        `반드시 아래 JSON 형식으로만 답하세요(다른 텍스트 없이):\n` +
        `{"text":"원칙 내용","category":"익절|손절|기술적|자산관리|심리|기타","triggerType":"profit_target|loss_cut|buy_ath|weight_limit","threshold":숫자또는null,"reason":"이 원칙이 필요한 이유 2문장","emoji":"이모지 1개"}`;
      const res  = await fetch(GPT_API_URL, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model: GPT_DEFAULT_MODEL,
          messages:[
            { role:"system", content:`당신은 투자 코치 "${char?.name}"입니다. JSON만 출력하세요.` },
            { role:"user",   content:prompt },
          ],
          max_tokens:300,
        }),
      });
      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSuggestion(parsed);
      } else {
        setSuggestion({ text:"수익 15% 도달 시 절반 매도", category:"익절", triggerType:"profit_target", threshold:15, reason:"과거 거래 패턴을 보면 수익 실현 타이밍이 늦어 기회를 놓친 경우가 있었어요. 절반 익절 원칙이 있으면 심리적 부담 없이 수익을 챙길 수 있어요.", emoji:"📈" });
      }
    } catch {
      setSuggestion({ text:"수익 15% 도달 시 절반 매도", category:"익절", triggerType:"profit_target", threshold:15, reason:"과거 거래 패턴을 보면 수익 실현 타이밍이 늦어 기회를 놓친 경우가 있었어요. 절반 익절 원칙이 있으면 심리적 부담 없이 수익을 챙길 수 있어요.", emoji:"📈" });
    }
    setSuggestLoading(false);
  };

  // 제안 원칙 바로 적용
  const applySuggestion = () => {
    if (!suggestion) return;
    const p = {
      id: nextId.current++,
      category: suggestion.category ?? "기타",
      text: suggestion.text,
      enabled: true,
      triggerType: suggestion.triggerType ?? "profit_target",
      threshold: suggestion.threshold ?? null,
    };
    setPrinciples(prev => [...prev, p]);
    setShowSuggest(false);
  };

  return (
    <div style={S.wrap}>
      <SubHeader3D title="⚖️ 나의 투자 원칙" onBack={onBack} char={char} />
      <div style={S.scrollBody}>

        {/* 헤더 설명 */}
        <div style={{ background:`linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)`,border:`1px solid ${char?.color}33`,borderRadius:14,padding:"10px 14px",marginBottom:14 }}>
          <div style={{ fontSize:12,fontWeight:800,color:char?.color,marginBottom:4 }}>나의 투자 가이드라인</div>
          <div style={{ fontSize:11,color:"#666",lineHeight:1.6 }}>
            원칙이 <b>켜져 있으면</b> 매수 시 조건 충족 시 {char?.name}가 알려드려요.<br/>
            보유 종목 원칙 체크로 알림도 생성할 수 있어요.
          </div>
        </div>

        {/* 원칙 목록 */}
        {principles.map(p => (
          <Card3D key={p.id} color="#fff" style={{ padding:"11px 14px",marginBottom:10 }} depth={false}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ background:`${CATEGORY_COLORS[p.category] ?? "#aaa"}22`,color:CATEGORY_COLORS[p.category] ?? "#aaa",borderRadius:8,padding:"2px 8px",fontSize:9,fontWeight:700,flexShrink:0 }}>{p.category}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:700,color:"#222" }}>{p.text}</div>
                {p.threshold != null && <div style={{ fontSize:10,color:"#999",marginTop:2 }}>기준값: {p.threshold}%</div>}
                <div style={{ fontSize:9,color:"#bbb",marginTop:1 }}>{TRIGGER_LABELS[p.triggerType] ?? ""}</div>
              </div>
              {/* 토글 */}
              <div onClick={() => toggle(p.id)} style={{ width:42,height:24,borderRadius:12,background:p.enabled?char?.color:"#ddd",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0 }}>
                <div style={{ position:"absolute",top:3,left:p.enabled?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
              </div>
              {/* 삭제 */}
              <div onClick={() => remove(p.id)} style={{ width:26,height:26,borderRadius:8,background:"#FFF0F0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,color:"#FF6B6B",flexShrink:0 }}>✕</div>
            </div>
          </Card3D>
        ))}

        {/* 원칙 추가 */}
        {showAdd ? (
          <Card3D color="#fff" style={{ padding:14,marginBottom:10 }} depth={false}>
            <div style={{ fontSize:12,fontWeight:800,color:"#333",marginBottom:10 }}>새 원칙 추가</div>
            <textarea value={newText} onChange={e=>setNewText(e.target.value)}
              placeholder="예: 매수 전 거래량 확인 필수"
              style={{ width:"100%",border:"1.5px solid #eee",borderRadius:10,padding:"8px 10px",fontSize:12,resize:"none",outline:"none",minHeight:60,boxSizing:"border-box",marginBottom:8 }}
            />
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
              <div>
                <div style={{ fontSize:10,color:"#888",marginBottom:4 }}>카테고리</div>
                <select value={newCategory} onChange={e=>setNewCategory(e.target.value)}
                  style={{ width:"100%",border:"1.5px solid #eee",borderRadius:8,padding:"6px 8px",fontSize:12,outline:"none" }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:10,color:"#888",marginBottom:4 }}>기준값 (%)</div>
                <input type="number" value={newThreshold} onChange={e=>setNewThreshold(e.target.value)}
                  placeholder="예: 15"
                  style={{ width:"100%",border:"1.5px solid #eee",borderRadius:8,padding:"6px 8px",fontSize:12,outline:"none",boxSizing:"border-box" }}
                />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10,color:"#888",marginBottom:4 }}>알림 트리거</div>
              <select value={newTrigger} onChange={e=>setNewTrigger(e.target.value)}
                style={{ width:"100%",border:"1.5px solid #eee",borderRadius:8,padding:"6px 8px",fontSize:12,outline:"none" }}>
                {Object.entries(TRIGGER_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <div onClick={() => setShowAdd(false)} style={{ flex:1,background:"#f5f5f5",borderRadius:10,padding:"9px",textAlign:"center",fontSize:12,color:"#888",fontWeight:700,cursor:"pointer" }}>취소</div>
              <div onClick={addPrinciple} style={{ flex:2,background:`linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:10,padding:"9px",textAlign:"center",fontSize:12,color:"#fff",fontWeight:800,cursor:"pointer" }}>추가하기</div>
            </div>
          </Card3D>
        ) : (
          <div onClick={() => setShowAdd(true)} style={{ border:"2px dashed #ddd",borderRadius:14,padding:"12px",textAlign:"center",fontSize:12,color:"#aaa",cursor:"pointer",marginBottom:12 }}>
            ⊕ 새로운 원칙 직접 추가
          </div>
        )}

        {/* 큐밍 보완 대책 제안 버튼 */}
        <div onClick={generateSuggestion}
          style={{ background:`linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:14,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",marginBottom:10,boxShadow:`0 4px 14px ${char?.color}55` }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <Char3D char={char} size={28} shadow={false} />
            <span>{char?.name}에게 보완 대책 제안받기</span>
          </div>
          <span style={{ fontSize:16 }}>→</span>
        </div>

        {/* 보유 종목 원칙 체크 버튼 */}
        <div onClick={() => { const n = checkAndNotify(); alert(n > 0 ? `${n}개의 원칙 알림이 생성됐어요!` : "현재 조건에 해당하는 알림이 없어요."); }}
          style={{ background:"linear-gradient(135deg,#6BCFB7,#0a9e85)",borderRadius:14,padding:"11px",textAlign:"center",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",marginBottom:14,boxShadow:"0 4px 14px rgba(6,182,141,0.3)" }}>
          🔍 보유 종목 원칙 체크 &amp; 알림 생성
        </div>

        {/* AI 코칭 리포트 */}
        <Card3D color={`linear-gradient(135deg,${char?.grad[0]}15,${char?.grad[1]}08)`} style={{ padding:14,marginBottom:12,border:`1px solid ${char?.color}33` }} depth={false}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
            <div style={{ fontSize:12,fontWeight:800,color:char?.color }}>🏆 포디움 코칭 리포트</div>
            {!reportDone && (
              <div onClick={generateReport} style={{ background:`linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:20,padding:"4px 12px",fontSize:10,color:"#fff",fontWeight:800,cursor:"pointer" }}>
                {reportLoading ? "생성 중..." : "리포트 받기"}
              </div>
            )}
          </div>
          {reportLoading && (
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ display:"flex",gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,background:char?.color,borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}</div>
              <span style={{ fontSize:12,color:"#aaa" }}>분석 중...</span>
            </div>
          )}
          {report
            ? <div style={{ fontSize:12,color:"#444",lineHeight:1.8 }}>{report}</div>
            : !reportLoading && <div style={{ fontSize:11,color:"#bbb" }}>버튼을 눌러 {char?.name}의 원칙 코칭을 받아보세요.</div>
          }
        </Card3D>

      </div>

      {/* ── 제안 팝업 ── */}
      {showSuggest && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",zIndex:300,backdropFilter:"blur(4px)" }}
          onClick={() => setShowSuggest(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:"100%",background:"linear-gradient(160deg,#1a1a2e,#0f2060)",borderRadius:"24px 24px 0 0",padding:"22px 20px 28px",animation:"slideUp 0.3s ease",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)" }}>

            {/* 캐릭터 + 말풍선 */}
            <div style={{ display:"flex",alignItems:"flex-end",gap:12,marginBottom:18 }}>
              <Char3D char={char} size={52} bounce={true} shadow={false} />
              <div style={{ flex:1,background:"rgba(255,255,255,0.08)",borderRadius:"16px 16px 16px 4px",padding:"12px 14px",border:`1px solid ${char?.color}33` }}>
                <div style={{ fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:4 }}>{char?.name}의 제안</div>
                <div style={{ fontSize:13,color:"#fff",fontWeight:700,lineHeight:1.6 }}>
                  이런 원칙을 추가해보는 건 어떨까요?
                </div>
              </div>
            </div>

            {/* 제안 원칙 카드 */}
            {suggestLoading ? (
              <div style={{ background:"rgba(255,255,255,0.06)",borderRadius:16,padding:"20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:18 }}>
                <div style={{ display:"flex",gap:5 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:7,height:7,background:char?.color,borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}
                </div>
                <span style={{ fontSize:13,color:"rgba(255,255,255,0.5)" }}>분석 중...</span>
              </div>
            ) : suggestion && (
              <div style={{ background:`linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)`,border:`1.5px solid ${char?.color}55`,borderRadius:16,padding:"14px 16px",marginBottom:18 }}>
                {/* 원칙 제목 */}
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                  <span style={{ fontSize:26 }}>{suggestion.emoji ?? "📌"}</span>
                  <div>
                    <div style={{ fontSize:15,fontWeight:900,color:"#fff" }}>{suggestion.text}</div>
                    <div style={{ display:"flex",gap:6,marginTop:4 }}>
                      <span style={{ background:`${CATEGORY_COLORS[suggestion.category] ?? "#aaa"}33`,color:CATEGORY_COLORS[suggestion.category] ?? "#aaa",fontSize:9,fontWeight:800,borderRadius:6,padding:"2px 8px" }}>{suggestion.category}</span>
                      {suggestion.threshold != null && <span style={{ background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",fontSize:9,fontWeight:700,borderRadius:6,padding:"2px 8px" }}>기준 {suggestion.threshold}%</span>}
                    </div>
                  </div>
                </div>
                {/* 이유 */}
                <div style={{ fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.7,borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:10 }}>
                  {suggestion.reason}
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div style={{ display:"flex",gap:10 }}>
              <div onClick={() => setShowSuggest(false)}
                style={{ flex:1,background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"12px",textAlign:"center",color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:13,cursor:"pointer" }}>
                나중에 할게요
              </div>
              <div onClick={applySuggestion}
                style={{ flex:2,background:suggestion ? `linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})` : "rgba(255,255,255,0.1)",borderRadius:14,padding:"12px",textAlign:"center",color:"#fff",fontWeight:800,fontSize:13,cursor:suggestion?"pointer":"default",boxShadow:suggestion?`0 4px 16px ${char?.color}55`:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                좋아요! 원칙에 적용하기 →
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ══════════════════════════════════════════════
//  8. 게임 메인
// ══════════════════════════════════════════════
export function GameMainScreen({
  char, userName, level, xp, points, quests, setQuests, notifs, setNotifs,
  furniture, placedFurni, questSuccess,
  onGoHome, subScreen, setSubScreen,
  showProfile, setShowProfile,
  messages, setMessages, inputMsg, setInputMsg,
  isTyping, setIsTyping, surveyAnswers,
  completeQuest, buyFurniture, toggleFurni, resetGame,
  principles, setPrinciples,
  personaMD,
}) {
  const pt = calcPersonality(surveyAnswers || {});
  const chatEndRef = useRef(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, isTyping]);
  const [notifFilter, setNotifFilter] = useState("all");
  const [pointsTab,   setPointsTab]   = useState("earn");

  // ── 세션 ID (채팅 기록 저장 키) ─────────────────────
  const [sessionId] = useState(() => `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  // ── 대화 세션 관리 (localStorage + DB) ───────────────
  const [chatSessions, setChatSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cuming_sessions") || "[]"); } catch { return []; }
  });
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingName, setEditingName]           = useState("");
  const prevSubScreen = useRef(null);
  const messagesRef   = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── 앱 시작 시 DB에서 세션 목록 불러와 병합 ─────────
  useEffect(() => {
    fetch("/api/sessions")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.sessions?.length) return;
        setChatSessions(prev => {
          const localIds = new Set(prev.map(s => s.id));
          const fromDB = data.sessions
            .filter(s => !localIds.has(s.id))
            .map(s => ({
              id: s.id,
              name: (s.createdAt || "").slice(0, 16).replace("T", " ") || s.id,
              messages: null,   // 클릭 시 lazy load
              createdAt: new Date(s.createdAt || Date.now()).getTime(),
              msgCount: s.msgCount,
              preview: s.preview,
            }));
          if (!fromDB.length) return prev;
          return [...prev, ...fromDB].sort((a, b) => b.createdAt - a.createdAt);
        });
      })
      .catch(() => {});
  }, []);

  // subScreen 전환 감지
  useEffect(() => {
    const prev = prevSubScreen.current;
    // chat → 다른 화면: 메시지 있으면 저장
    if (prev === "chat" && subScreen !== "chat" && messagesRef.current.length > 0) {
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const label = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      // sessionId를 그대로 사용해 DB 저장 내역과 연결
      const session = { id: sessionId, name: label, messages: [...messagesRef.current], createdAt: Date.now() };
      setChatSessions(prev => {
        const filtered = prev.filter(s => s.id !== sessionId); // 중복 제거
        const updated  = [session, ...filtered].slice(0, 50);
        localStorage.setItem("cuming_sessions", JSON.stringify(updated));
        return updated;
      });
    }
    // 다른 화면 → chat: 새 대화 시작
    if (subScreen === "chat" && prev !== "chat") {
      setMessages([]);
      setShowSessionPanel(false);
    }
    prevSubScreen.current = subScreen;
  }, [subScreen]);

  const saveSessionName = (id, name) => {
    setChatSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, name } : s);
      localStorage.setItem("cuming_sessions", JSON.stringify(updated));
      return updated;
    });
    setEditingSessionId(null);
  };

  const deleteSession = (id) => {
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem("cuming_sessions", JSON.stringify(updated));
      return updated;
    });
  };

  const loadSession = async (session) => {
    if (session.messages) {
      setMessages(session.messages);
      setShowSessionPanel(false);
      return;
    }
    // messages가 없으면 DB에서 불러오기
    try {
      const res = await fetch(`/api/sessions/${session.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setChatSessions(prev => {
          const updated = prev.map(s => s.id === session.id ? { ...s, messages: data.messages } : s);
          localStorage.setItem("cuming_sessions", JSON.stringify(updated));
          return updated;
        });
      }
    } catch {}
    setShowSessionPanel(false);
  };

  const sendMessage = async () => {
    if (!inputMsg.trim()) return;
    const userMsg = inputMsg.trim(); setInputMsg("");
    const newMsgs = [...messages, { role:"user", content:userMsg }];
    setMessages(newMsgs); setIsTyping(true);
    setQuests(q => q.map(x => x.id===2 ? {...x,done:true} : x));

    // ── 통합 서버 /api/chat (OpenAI+tools → Gemini RAG → Gemini 직접, 폴백 서버에서 처리) ──
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:      userMsg,
          persona_md:   personaMD || "",
          persona_type: pt?.name || "",
          session_id:   sessionId,
          history:      messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages([...newMsgs, {
          role:       "assistant",
          content:    data.response,
          ragContext: data.retrieved_context || [],
          skillsUsed: data.tools_used || [],
        }]);
      } else {
        setMessages([...newMsgs, { role:"assistant", content: buildLocalChatFallback({ char, userMsg, surveyAnswers }) }]);
      }
    } catch {
      setMessages([...newMsgs, { role:"assistant", content: `연결 오류가 발생했어요. ${buildLocalChatFallback({ char, userMsg, surveyAnswers })}` }]);
    }

    setIsTyping(false);
  };

  // ── 서브화면: 알림 ────────────────────────
  if (subScreen === "notifications") {
    const typeMeta = {
      holding:   { label:"보유종목", color:"#FF6B6B",  icon:"📈" },
      ai_chat:   { label:"AI채팅",   color:"#A78BFA",  icon:"🤖" },
      history:   { label:"거래내역", color:"#FFD580",  icon:"📂" },
      principle: { label:"투자원칙", color:"#6BCFB7",  icon:"⚖️" },
    };
    const FILTERS = [
      { key:"all",       label:"전체",    color:"#7c3aed" },
      { key:"holding",   label:"보유종목", color:"#FF6B6B" },
      { key:"ai_chat",   label:"AI채팅",  color:"#A78BFA" },
      { key:"history",   label:"거래내역", color:"#FFD580" },
      { key:"principle", label:"투자원칙", color:"#6BCFB7" },
    ];
    const filtered = notifFilter === "all" ? notifs : notifs.filter(n => n.type === notifFilter);
    return (
      <div style={S.wrap}>
        <SubHeader3D title="📢 알림" onBack={() => setSubScreen(null)} char={char} />
        <div style={S.scrollBody}>


          {/* ── 필터 탭 ── */}
          <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4,paddingTop:8 }}>
            {FILTERS.map(f => {
              const isActive = notifFilter === f.key;
              const unread   = f.key === "all"
                ? notifs.filter(n=>!n.read).length
                : notifs.filter(n=>n.type===f.key && !n.read).length;
              return (
                <div key={f.key} onClick={() => setNotifFilter(f.key)}
                  style={{
                    flexShrink:0, position:"relative",
                    background: isActive ? f.color : "#fff",
                    borderRadius:20, padding:"6px 14px",
                    fontSize:11, fontWeight:isActive?800:600,
                    color: isActive ? "#fff" : "#555",
                    border: isActive ? `1.5px solid ${f.color}` : "1.5px solid #ddd",
                    cursor:"pointer", transition:"all 0.15s",
                  }}>
                  {f.label}
                  {unread > 0 && (
                    <span style={{ position:"absolute",top:-6,right:-6,background:"#B43A6B",color:"#fff",borderRadius:"50%",minWidth:16,height:16,fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",boxSizing:"border-box" }}>{unread}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── 알림 목록 ── */}
          {filtered.length === 0
            ? <div style={{ textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.3)",fontSize:13 }}>해당 알림이 없습니다</div>
            : filtered.map(n => {
              const meta = typeMeta[n.type] || { label:"알림", color:"#6BBFFF", icon:"🔔" };
              return (
                <Card3D key={n.id} color={n.read?"#f8f8f8":"#fff"}
                  style={{ padding:13,marginBottom:10,display:"flex",gap:12,border:n.read?"none":`2px solid ${meta.color}44` }}>
                  <div style={{ width:44,height:44,background:`linear-gradient(135deg,${meta.color}33,${meta.color}11)`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{n.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3 }}>
                      <span style={{ fontWeight:800,fontSize:13 }}>{n.title}</span>
                      <div style={{ display:"flex",gap:4 }}>
                        <span style={{ background:`${meta.color}22`,color:meta.color,borderRadius:10,padding:"1px 7px",fontSize:9,fontWeight:700 }}>{meta.label}</span>
                        {!n.read && <span style={{ background:"#B43A6B",borderRadius:20,padding:"2px 8px",fontSize:9,color:"#fff",fontWeight:800 }}>NEW</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:11,color:"#555",lineHeight:1.55 }}>{n.desc}</div>
                    <div style={{ fontSize:10,color:"#aaa",marginTop:4 }}>{n.stock ? `📌 ${n.stock} · ` : ""}{n.time}</div>
                  </div>
                </Card3D>
              );
            })
          }
        </div>
      </div>
    );
  }

  // ── 서브화면: 원칙 ───────────────────────
  if (subScreen === "principle") {
    return <PrincipleScreen
      char={char} principles={principles} setPrinciples={setPrinciples}
      notifs={notifs} setNotifs={setNotifs}
      surveyAnswers={surveyAnswers}
      onBack={() => setSubScreen(null)}
    />;
  }

  // ── 서브화면: 퀘스트 ──────────────────────
  if (subScreen === "quests") return (
    <div style={{ ...S.wrap, position:"relative" }}>
      <SubHeader3D title="🎯 일일 퀘스트" onBack={() => setSubScreen(null)} char={char} />
      <div style={S.scrollBody}>
        <Card3D color={`linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)`} style={{ padding:13,marginBottom:13,display:"flex",justifyContent:"space-between",alignItems:"center" }} depth={false}>
          <div>
            <div style={{ fontWeight:800,fontSize:13 }}>오늘의 진행률</div>
            <div style={{ fontSize:11,color:"#888",marginTop:2 }}>{quests.filter(q=>q.done).length}/{quests.length} 완료</div>
            <div style={{ width:130,height:6,background:"#eee",borderRadius:4,marginTop:7,overflow:"hidden" }}>
              <div style={{ width:`${quests.filter(q=>q.done).length/quests.length*100}%`,height:"100%",background:`linear-gradient(90deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:4,transition:"width 0.4s" }} />
            </div>
          </div>
          <div style={{ fontSize:34,fontWeight:900,color:char?.color }}>{Math.round(quests.filter(q=>q.done).length/quests.length*100)}%</div>
        </Card3D>
        {quests.map(q => (
          <Card3D key={q.id} color={q.done?"#f5f5f5":"#fff"} style={{ padding:13,marginBottom:10,opacity:q.done?0.72:1 }}>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:46,height:46,borderRadius:14,fontSize:22,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:q.done?"#eee":`linear-gradient(135deg,${char?.grad[0]}33,${char?.grad[1]}22)` }}>{q.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800,fontSize:13,display:"flex",alignItems:"center",gap:6 }}>
                  {q.title}
                  {q.done && <span style={{ background:"linear-gradient(90deg,#22CC66,#00AA44)",borderRadius:20,padding:"1px 8px",fontSize:9,color:"#fff" }}>완료 ✓</span>}
                </div>
                <div style={{ fontSize:10,color:"#888",marginTop:2 }}>{q.desc}</div>
                <div style={{ display:"flex",gap:6,marginTop:5 }}>
                  <span style={{ background:"#FFF3CC",borderRadius:8,padding:"2px 8px",fontSize:10,color:"#FF9900",fontWeight:700 }}>+{q.points}P</span>
                  <span style={{ background:"#EEFFEE",borderRadius:8,padding:"2px 8px",fontSize:10,color:"#22C55E",fontWeight:700 }}>+{q.xp}XP</span>
                </div>
              </div>
              {!q.done && <Btn3D onClick={() => completeQuest(q.id)} color={char?.color} style={{ padding:"8px 12px",fontSize:11,minWidth:50 }}>도전!</Btn3D>}
            </div>
          </Card3D>
        ))}
      </div>
      {questSuccess && <QuestPopup quest={questSuccess} />}
    </div>
  );

  // ── 서브화면: 상점 ────────────────────────
  if (subScreen === "shop") return (
    <div style={{ ...S.wrap, background:"#fff" }}>
      <SubHeader3D title="🛒 상점" onBack={() => setSubScreen(null)} char={char} />
      <div style={S.scrollBody}>
        <div style={{ background:"#EBF1FE",borderRadius:16,padding:13,marginBottom:13,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #B8CCFA" }}>
          <span style={{ color:"#4378F1",fontSize:13,fontWeight:700 }}>보유 포인트</span>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ fontSize:20 }}>⭐</span>
            <span style={{ color:"#4378F1",fontWeight:900,fontSize:20 }}>{points}P</span>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
          {furniture.map(f => (
            <Card3D key={f.id}
              color={f.owned ? "linear-gradient(135deg,#f5f5f5,#ebebeb)" : "#fff"}
              style={{ padding:15,textAlign:"center",border:"1.5px solid #ddd" }}>
              <div style={{ fontSize:40,marginBottom:8,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.14))" }}>{f.emoji}</div>
              <div style={{ fontWeight:800,fontSize:12,marginBottom:4 }}>{f.name}</div>
              <div style={{ fontSize:11,color:"#FF9900",fontWeight:700,marginBottom:8 }}>⭐ {f.price}P</div>
              {f.owned ? (
                <div style={{ fontSize:10,fontWeight:700,color:"#999",padding:"6px 0" }}>✅ 구매 완료</div>
              ) : (
                <Btn3D onClick={() => buyFurniture(f.id)} color={points<f.price?"#ccc":"#B43A6B"} style={{ padding:"6px 10px",fontSize:10 }} disabled={points<f.price}>
                  {points<f.price?"포인트 부족":"구매하기"}
                </Btn3D>
              )}
            </Card3D>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 서브화면: 수납장 ──────────────────────
  if (subScreen === "storage") return (
    <div style={{ ...S.wrap, background:"#fff" }}>
      <SubHeader3D title="🗄️ 수납장" onBack={() => setSubScreen(null)} char={char} />
      <div style={S.scrollBody}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
          {furniture.filter(f => f.owned).length === 0 ? (
            <div style={{ gridColumn:"1/-1",textAlign:"center",padding:"40px 0",color:"#bbb",fontSize:13 }}>보유한 가구가 없어요</div>
          ) : furniture.filter(f => f.owned).map(f => {
            const isPlaced = placedFurni.includes(f.name);
            return (
              <Card3D key={f.id}
                color={isPlaced ? "linear-gradient(135deg,#e8f4ff,#d0e8ff)" : "linear-gradient(135deg,#f5f5f5,#ebebeb)"}
                style={{ padding:15,textAlign:"center",border:"1.5px solid #ddd" }}>
                <div style={{ fontSize:40,marginBottom:8,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.14))" }}>{f.emoji}</div>
                <div style={{ fontWeight:800,fontSize:12,marginBottom:4 }}>{f.name}</div>
                <div onClick={() => toggleFurni(f.name)}
                  style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:isPlaced?"#e8f0ff":"#f0f0f0",borderRadius:12,padding:"7px 10px",cursor:"pointer",border:`2px solid ${isPlaced?"#4378F1":"#ddd"}`,transition:"all 0.2s" }}>
                  <span style={{ fontSize:10,fontWeight:700,color:isPlaced?"#4378F1":"#999" }}>
                    {isPlaced ? "🏠 방에 배치됨" : "📦 보관 중"}
                  </span>
                  <div style={{ width:34,height:20,borderRadius:10,background:isPlaced?"#4378F1":"#999",position:"relative",transition:"background 0.2s",flexShrink:0 }}>
                    <div style={{ position:"absolute",top:3,left:isPlaced?16:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                  </div>
                </div>
              </Card3D>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── 서브화면: 게임 ────────────────────────
  if (subScreen === "game") return (
    <div style={{ ...S.wrap, background:"#f5f5f7" }}>
      {/* 헤더 */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px 10px",background:"#fff",borderBottom:"1px solid #eee" }}>
        <div onClick={() => setSubScreen(null)} style={{ cursor:"pointer",fontSize:20,color:"#333",width:32 }}>←</div>
        <span style={{ fontWeight:600,fontSize:17,color:"#111" }}>K.Game</span>
        <div onClick={() => setSubScreen(null)} style={{ cursor:"pointer",fontSize:18,color:"#999",width:32,textAlign:"right" }}>✕</div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"14px 16px" }}>
        {/* 프로필 카드 */}
        <div style={{ background:"#f0f0f2",borderRadius:16,padding:16,marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:14 }}>
            <div style={{ width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#8899CC,#5566AA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>🛡️</div>
            <div>
              <div style={{ display:"inline-block",background:"#5566AA",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500,marginBottom:4 }}>실버 1</div>
              <div style={{ fontWeight:500,fontSize:15,color:"#111" }}>{char?.name} &gt;</div>
            </div>
          </div>
          <div style={{ background:"#fff",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:20 }}>🟣</span>
              <span style={{ fontSize:11,color:"#555",fontWeight:500 }}>보유 젤리</span>
              <div style={{ width:18,height:18,borderRadius:"50%",background:"#bbb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:800 }}>?</div>
            </div>
            <span style={{ fontSize:14,fontWeight:500,color:"#111" }}>0개</span>
          </div>
        </div>

        {/* 터치 한번으로 보상 받기 */}
        <div style={{ fontWeight:600,fontSize:15,color:"#111",marginBottom:12 }}>터치 한번으로 보상 받기</div>
        <div style={{ background:"#fff",borderRadius:16,padding:14,marginBottom:10,display:"flex",gap:14,alignItems:"center" }}>
          <div style={{ width:130,height:120,borderRadius:14,background:"linear-gradient(135deg,#8B1A1A,#CC4400)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:52,flexShrink:0 }}>🥠</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:6 }}>
              <span style={{ fontSize:16 }}>🕐</span>
              <div style={{ background:"#E91E8C",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:9,fontWeight:500 }}>보상 받기 가능!</div>
            </div>
            <div style={{ fontWeight:500,fontSize:15,color:"#111",marginBottom:4 }}>포춘 쿠키</div>
            <div style={{ fontSize:11,color:"#666",marginBottom:10 }}>오늘 나의 운세는 어떨까요?</div>
            <div style={{ display:"inline-block",background:"#E8E8F0",color:"#333",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,marginBottom:8 }}>오늘 5회 가능</div>
            <div>
              <div style={{ background:"#2C3090",color:"#fff",borderRadius:12,padding:"5px 12px",fontSize:11,fontWeight:500,display:"inline-block",cursor:"pointer" }}>보상 받기</div>
            </div>
          </div>
        </div>

        {/* 재미 가득 K.Game */}
        <div style={{ fontWeight:900,fontSize:17,color:"#111",marginBottom:12 }}>재미 가득! K.Game!</div>
        <div style={{ background:"#fff",borderRadius:16,overflow:"hidden",marginBottom:20 }}>
          <div style={{ height:140,background:"linear-gradient(135deg,#FFB800,#FF6600)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:60 }}>🎮</div>
          <div style={{ padding:"12px 14px" }}>
            <div style={{ fontWeight:800,fontSize:14,color:"#111",marginBottom:4 }}>미니게임 도전하기</div>
            <div style={{ fontSize:12,color:"#888" }}>게임을 즐기며 포인트를 모아보세요!</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── 서브화면: 운세 ────────────────────────
  if (subScreen === "fortune") return (
    <div style={{ ...S.wrap, background:"#fff" }}>
      {/* 헤더 */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px 10px",background:"#1E1060",borderBottom:"none" }}>
        <div onClick={() => setSubScreen(null)} style={{ cursor:"pointer",fontSize:20,color:"#fff",width:32 }}>←</div>
        <span style={{ fontWeight:800,fontSize:17,color:"#fff" }}>운세</span>
        <div style={{ width:32,textAlign:"right",color:"#fff",fontSize:20,cursor:"pointer" }}>⋮</div>
      </div>
      {/* 히어로 배너 */}
      <div style={{ background:"linear-gradient(180deg,#1E1060,#4A1090)",padding:"20px 16px 40px",textAlign:"center",position:"relative" }}>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600,marginBottom:10 }}>키움증권 K × 점신</div>
        <div style={{ fontSize:26,fontWeight:900,color:"#fff",marginBottom:6 }}>하루 한 번, 키움 운세</div>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:20 }}>어떤 날들이 펼쳐질지 매일 확인해 보세요!</div>
        {/* 카드 캐러셀 */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
          {["🀱","💰","🃏","🐯","🌿"].map((e,i) => (
            <div key={i} style={{
              width: i===2?70:50, height: i===2?70:50,
              borderRadius:14,
              background: i===2?"linear-gradient(135deg,#4A00C8,#2200A0)":"rgba(255,255,255,0.15)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize: i===2?28:20,
              boxShadow: i===2?"0 8px 24px rgba(0,0,0,0.4)":"none",
              border: i===2?"2px solid rgba(255,255,255,0.3)":"none",
              transition:"all 0.2s",
            }}>{e}</div>
          ))}
        </div>
      </div>
      {/* 흰 카드 섹션 */}
      <div style={{ flex:1,overflowY:"auto",background:"#fff",borderRadius:"24px 24px 0 0",marginTop:-20,padding:"24px 16px" }}>
        <div style={{ fontWeight:700,fontSize:15,color:"#111",marginBottom:12 }}>두근두근! 운세 모아보기</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
          {[
            { bg:"#FEFBE8", label:"매일 확인하는", title:"오늘의 재물운", emoji:"💰" },
            { bg:"#EBF5FE", label:"내일 운이 궁금하다면?", title:"내일의 재물운", emoji:"📅" },
            { bg:"#FEF0EE", label:"중요한 날엔", title:"지정일 운세", emoji:"📆" },
            { bg:"#FEF0E8", label:"띠별로 알아보는 운세", title:"띠운세", emoji:"🐯" },
          ].map((item,i) => (
            <div key={i} style={{ background:item.bg,borderRadius:16,padding:"16px 14px",cursor:"pointer" }}>
              <div style={{ fontSize:11,color:"#888",fontWeight:600,marginBottom:4 }}>{item.label}</div>
              <div style={{ fontWeight:900,fontSize:14,color:"#111",marginBottom:16 }}>{item.title}</div>
              <div style={{ fontSize:36,textAlign:"right" }}>{item.emoji}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 서브화면: 채팅 ────────────────────────
  if (subScreen === "chat") return (
    <div style={{ ...S.wrap, position:"relative" }}>
      <SubHeader3D title={`${userName || "투자자"}와의 대화`} onBack={() => setSubScreen(null)} char={char} />

      {/* ── 세션 패널 (왼쪽 슬라이드) ── */}
      {showSessionPanel && (
        <div style={{ position:"absolute", inset:0, zIndex:100, display:"flex" }}>
          {/* 패널 */}
          <div style={{ width:"72%", maxWidth:280, background:"#fff", display:"flex", flexDirection:"column", boxShadow:"4px 0 24px rgba(0,0,0,0.15)", animation:"slideRight 0.25s ease" }}>
            <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid #f0f0f0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <span style={{ fontWeight:800, fontSize:14, color:"#333" }}>📂 대화 기록</span>
              <div style={{ display:"flex", gap:6 }}>
                <div onClick={() => { setMessages([]); setShowSessionPanel(false); }}
                  style={{ fontSize:10, fontWeight:700, color:"#fff", background:`linear-gradient(135deg,${char?.grad?.[0]},${char?.grad?.[1]})`, borderRadius:10, padding:"4px 9px", cursor:"pointer" }}>
                  + 새 대화
                </div>
                <div onClick={() => setShowSessionPanel(false)}
                  style={{ width:24, height:24, borderRadius:8, background:"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:13, color:"#666" }}>✕</div>
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
              {chatSessions.length === 0 ? (
                <div style={{ textAlign:"center", color:"#bbb", marginTop:30, fontSize:12 }}>저장된 대화가 없어요</div>
              ) : chatSessions.map(s => (
                <div key={s.id} style={{ marginBottom:6, borderRadius:10, border:"1px solid #eee", overflow:"hidden", background:"#fafafa" }}>
                  {editingSessionId === s.id ? (
                    <div style={{ display:"flex", gap:4, padding:"8px 8px" }}>
                      <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter") saveSessionName(s.id, editingName); if(e.key==="Escape") setEditingSessionId(null); }}
                        style={{ flex:1, fontSize:12, border:`1.5px solid ${char?.color}`, borderRadius:7, padding:"4px 8px", outline:"none" }} />
                      <div onClick={() => saveSessionName(s.id, editingName)}
                        style={{ fontSize:11, color:"#fff", background:char?.color, borderRadius:7, padding:"4px 8px", cursor:"pointer", fontWeight:700 }}>저장</div>
                    </div>
                  ) : (
                    <div onClick={() => loadSession(s)}
                      style={{ padding:"9px 10px", cursor:"pointer" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"#444", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
                        <div style={{ display:"flex", gap:4, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                          <div onClick={() => { setEditingSessionId(s.id); setEditingName(s.name); }}
                            style={{ fontSize:11, color:"#A78BFA", cursor:"pointer", padding:"2px 4px" }}>✏️</div>
                          <div onClick={() => deleteSession(s.id)}
                            style={{ fontSize:11, color:"#f87171", cursor:"pointer", padding:"2px 4px" }}>🗑️</div>
                        </div>
                      </div>
                      <div style={{ fontSize:10, color:"#aaa", marginTop:3 }}>
                        {(s.messages?.length ?? (s.msgCount ? s.msgCount * 2 : 0))}개 메시지 · {(s.messages?.find(m=>m.role==="user")?.content ?? s.preview ?? "")?.slice(0,24)}…
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* 딤 영역 클릭 시 닫기 */}
          <div style={{ flex:1, background:"rgba(0,0,0,0.35)" }} onClick={() => setShowSessionPanel(false)} />
        </div>
      )}

      {/* ── RAG 활성화 뱃지 ── */}
      {personaMD && (
        <div style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",background:"linear-gradient(90deg,#6C47FF11,#A78BFA11)",borderBottom:"1px solid #A78BFA33",flexShrink:0 }}>
          <span style={{ fontSize:10 }}>🧠</span>
          <span style={{ fontSize:10,color:"#7c3aed",fontWeight:700 }}>RAG 활성</span>
          <span style={{ fontSize:9,color:"#9CA3AF" }}>페르소나 MD + ChromaDB 거래이력 연동 중</span>
        </div>
      )}

      <div style={{ flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10,background:"linear-gradient(180deg,#f0f4ff,#f8f8ff)" }}>
        {messages.length===0 && (
          <div style={{ textAlign:"center",marginTop:20,animation:"fadeIn 0.5s ease" }}>
            <Char3D char={char} size={78} bounce={true} />
            <div style={{ fontWeight:800,fontSize:16,marginTop:8,marginBottom:4 }}>안녕하세요!</div>
            <div style={{ fontSize:12,color:"#888",marginBottom:16 }}>투자에 관해 무엇이든 물어보세요 😊</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center" }}>
              {["내 수익률 어때?","삼성전자 분석해줘","내 매매 패턴은?","리스크 어때?"].map(hint => (
                <div key={hint} onClick={() => setInputMsg(hint)}
                  style={{ background:"#fff",border:`1.5px solid ${char?.color}55`,borderRadius:20,padding:"6px 13px",fontSize:11,cursor:"pointer",color:"#555",fontWeight:600 }}>
                  {hint}
                </div>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",animation:"fadeIn 0.3s ease" }}>
            <div style={{ display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:7,alignItems:"flex-end" }}>
              {m.role==="assistant" && <Char3D char={char} size={30} shadow={false} />}
              <div style={{ maxWidth:"72%",lineHeight:1.6,fontSize:13,padding:"10px 13px",
                borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                background:m.role==="user"?`linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})`:"#fff",
                color:m.role==="user"?"#fff":"#333",
                boxShadow:m.role==="user"?`0 4px 14px ${char?.color}55`:"0 4px 14px rgba(0,0,0,0.07)",
                fontWeight:m.role==="user"?600:400 }}>
                {m.content}
              </div>
            </div>
            {/* ChromaDB 참조 데이터 표시 */}
            {m.role==="assistant" && m.ragContext?.length > 0 && (
              <RagContextBadge docs={m.ragContext} longTermDocs={m.longTermContext} skills={m.skillsUsed} charColor={char?.color} />
            )}
          </div>
        ))}
        {isTyping && (
          <div style={{ display:"flex",alignItems:"flex-end",gap:7 }}>
            <Char3D char={char} size={30} shadow={false} />
            <div style={{ background:"#fff",borderRadius:"18px 18px 18px 4px",padding:"12px 15px",boxShadow:"0 4px 14px rgba(0,0,0,0.07)" }}>
              <div style={{ display:"flex",gap:5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:7,height:7,background:char?.color,borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding:"11px 14px",background:"#fff",borderTop:"1px solid #eee",display:"flex",gap:8,flexShrink:0 }}>
        <div onClick={() => setShowSessionPanel(p => !p)}
          style={{ position:"relative",width:36,height:36,borderRadius:12,background:showSessionPanel?"#A78BFA":"#f0f0ff",border:"1px solid #A78BFA44",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:16 }}>
          📂
          {chatSessions.length > 0 && !showSessionPanel && (
            <div style={{ position:"absolute",top:-5,right:-5,background:"#A78BFA",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:900 }}>
              {chatSessions.length > 9 ? "9+" : chatSessions.length}
            </div>
          )}
        </div>
        <input value={inputMsg} onChange={e => setInputMsg(e.target.value)}
          onKeyDown={e => e.key==="Enter" && sendMessage()}
          placeholder="메시지를 입력하세요..."
          style={{ flex:1,border:"1px solid rgba(67,120,241,0.35)",borderRadius:24,padding:"9px 15px",fontSize:13,outline:"none",background:"#fafafa" }} />
        <Btn3D onClick={sendMessage} color="#051893" noShadow style={{ padding:"9px 15px",borderRadius:24,minWidth:52 }}>전송</Btn3D>
      </div>
    </div>
  );

  // ── 서브화면: 포인트 ──────────────────────
  if (subScreen === "points") return (
    <div style={{ ...S.wrap, background:"#F5F5F7", display:"flex", flexDirection:"column" }}>
      {/* 헤더 */}
      <div style={{ background:"#2C3090", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div onClick={() => setSubScreen(null)} style={{ color:"#fff", fontSize:22, cursor:"pointer", width:32 }}>←</div>
        <div style={{ color:"#fff", fontWeight:800, fontSize:17 }}>포인트</div>
        <div style={{ color:"#fff", fontSize:20, width:32, textAlign:"right", cursor:"pointer" }}>⋮</div>
      </div>

      {/* 스크롤 영역 */}
      <div style={{ overflowY:"auto", flex:1 }}>
        {/* 공지 */}
        <div style={{ background:"#fff", margin:"12px 16px", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#2C3090", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:15 }}>📢</span>
          </div>
          <span style={{ fontSize:13, color:"#333", fontWeight:500 }}>키움증권에서 포인트 모아보세요!</span>
        </div>

        {/* 포인트 표시 */}
        <div style={{ background:"#fff", textAlign:"center", padding:"28px 0 20px" }}>
          <div style={{ fontSize:12, color:"#888", marginBottom:8 }}>사용가능한 포인트</div>
          <div style={{ fontSize:52, fontWeight:900, color:"#111", letterSpacing:"-2px" }}>{points} P</div>
          <div style={{ height:1, background:"#eee", margin:"18px 20px" }} />
          <div style={{ display:"flex", justifyContent:"center", fontSize:13, color:"#666" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"0 20px", cursor:"pointer" }}>
              <span style={{ fontSize:14 }}>📋</span> 이용내역
            </div>
            <div style={{ width:1, height:16, background:"#ddd", alignSelf:"center" }} />
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"0 20px", cursor:"pointer" }}>
              <span style={{ fontSize:14 }}>☆</span> 포인트 안내
            </div>
          </div>
        </div>

        {/* 적립/사용 탭 */}
        <div style={{ background:"#fff", padding:"14px 16px 0", marginTop:10 }}>
          <div style={{ background:"#F0F0F0", borderRadius:50, padding:3, display:"flex" }}>
            <div onClick={() => setPointsTab("earn")} style={{
              flex:1, textAlign:"center", padding:"11px 0", borderRadius:50, fontSize:14, fontWeight:700, cursor:"pointer",
              background: pointsTab==="earn" ? "#E91E8C" : "transparent",
              color: pointsTab==="earn" ? "#fff" : "#999",
            }}>적립하기</div>
            <div onClick={() => setPointsTab("use")} style={{
              flex:1, textAlign:"center", padding:"11px 0", borderRadius:50, fontSize:14, fontWeight:500, cursor:"pointer",
              background: pointsTab==="use" ? "#E91E8C" : "transparent",
              color: pointsTab==="use" ? "#fff" : "#999",
            }}>사용하기</div>
          </div>
        </div>

        {/* 적립 콘텐츠 */}
        {pointsTab === "earn" && (
          <div style={{ background:"#fff", padding:"20px 16px 28px" }}>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:22, fontWeight:900, color:"#E91E8C", lineHeight:1.4 }}>하루 한번,</div>
              <div style={{ fontSize:22, fontWeight:900, color:"#111", lineHeight:1.4 }}>매일 쌓이는 즐거움!</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ background:"#fff", borderRadius:16, padding:"20px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:10, boxShadow:"0 1px 8px rgba(0,0,0,0.07)", border:"1px solid #f0f0f0", cursor:"pointer" }}>
                <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,#FFACC7,#FF6FB0)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30 }}>📅</div>
                <span style={{ fontSize:13, fontWeight:600, color:"#333" }}>출석체크</span>
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:"20px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:10, boxShadow:"0 1px 8px rgba(0,0,0,0.07)", border:"1px solid #f0f0f0", cursor:"pointer" }}>
                <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,#C5AEFF,#9D7BEA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30 }}>🌐</div>
                <span style={{ fontSize:13, fontWeight:600, color:"#333", textAlign:"center", lineHeight:1.4 }}>키움비중 상위종목</span>
              </div>
            </div>
            <div style={{ marginTop:20 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#3B9EFF", borderRadius:50, padding:"4px 12px" }}>
                <span style={{ fontSize:12 }}>⚡</span>
                <span style={{ fontSize:12, color:"#fff", fontWeight:700 }}>추천미션</span>
              </div>
            </div>
          </div>
        )}
        {pointsTab === "use" && (
          <div style={{ background:"#fff", padding:"40px 16px", textAlign:"center", color:"#aaa", fontSize:14 }}>
            사용 가능한 혜택이 없습니다.
          </div>
        )}
      </div>

      {/* 하단 탭 바 */}
      <div style={{ background:"#fff", borderTop:"1px solid #eee", display:"flex", alignItems:"stretch", flexShrink:0 }}>
        <div style={{ background:"#6B2030", width:62, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 0 14px", gap:3, flexShrink:0 }}>
          <span style={{ fontSize:18, color:"#fff" }}>☰</span>
          <span style={{ fontSize:10, color:"#fff", fontWeight:700 }}>메뉴</span>
        </div>
        <div style={{ flex:1, display:"flex" }}>
          {["포인트","운세","리포트","주주혜택","쿠팡혜택"].map((tab, i) => (
            <div key={tab} style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              padding:"10px 0 14px", fontSize:10, fontWeight: i===0 ? 700 : 500,
              color: i===0 ? "#333" : "#999",
              borderBottom: i===0 ? "2px solid #333" : "2px solid transparent",
              cursor:"pointer",
            }}>{tab}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 게임 홈 메인 ──────────────────────────
  return (
    <div style={{ background:"#000", minHeight:"100vh" }}>
    <div style={{ ...S.wrap, background:"#e8d4a8" }}>
      <Room3D char={char} placedFurniture={placedFurni} onBubbleClick={() => setSubScreen("quests")} onCharClick={() => setSubScreen("chat")} userName={userName} />

      {/* HUD - 방 배경 위에 플로팅 */}
      <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:20,padding:"10px 12px",display:"flex",alignItems:"center" }}>
        {/* 캐릭터 아이콘 */}
        <div onClick={() => setShowProfile(true)} style={{ cursor:"pointer",flexShrink:0 }}>
          <Char3D char={char} size={36} shadow={false} />
        </div>

        {/* 경험치 게이지 바 — 별 아이콘이 왼쪽 14px 튀어나오므로 marginLeft:20 */}
        <div style={{ position:"relative",display:"inline-flex",alignItems:"center",flexShrink:0,marginLeft:20 }}>
          {/* 배경 바 (자연 비율 유지) */}
          <img src="/model/gaugebar.png" style={{ height:30,width:"auto",display:"block" }} />
          {/* 채우기 바 — 배경과 동일 위치·크기로 겹치고 오른쪽에서 clip */}
          <img src="/model/gauge_fillcolor.png" style={{ position:"absolute",top:3,left:0,height:24,width:"auto",clipPath:`inset(0 ${100-(xp||0)}% 0 0)`,transition:"clip-path 0.5s ease",pointerEvents:"none" }} />
          {/* xp 텍스트 */}
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#F3F4F4",paddingLeft:10,pointerEvents:"none" }}>{xp}%</div>
          {/* 별 아이콘 (왼쪽 14px 겹침) */}
          <div style={{ position:"absolute",left:-12,top:"50%",transform:"translateY(-50%)",zIndex:2,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
            <img src="/model/gaugestar.png" style={{ width:"100%",height:"100%",objectFit:"contain" }} />
            <span style={{ position:"absolute",fontSize:11,fontWeight:900,color:"#fff",textShadow:"0 1px 4px rgba(0,80,180,0.9)" }}>{level}</span>
          </div>
        </div>

        {/* 코인 바 — 코인 아이콘이 왼쪽 14px 튀어나오므로 marginLeft:22 */}
        <div style={{ position:"relative",display:"inline-flex",alignItems:"center",flexShrink:0,marginLeft:40 }}>
          {/* 배경 바 */}
          <img src="/model/coinbar.png" style={{ height:30,width:"auto",display:"block" }} />
          {/* 포인트 텍스트 */}
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#7A3000",paddingLeft:22,pointerEvents:"none" }}>{points}</div>
          {/* 코인 아이콘 (왼쪽 14px 겹침) */}
          <img src="/model/coin.png" style={{ position:"absolute",left:-14,top:"50%",transform:"translateY(-50%)",width:34,height:34,objectFit:"contain",zIndex:2,pointerEvents:"none" }} />
        </div>

        {/* X 버튼 */}
        <div onClick={onGoHome} style={{ marginLeft:"auto",width:30,height:30,background:"#2a2a2a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:13,boxShadow:"0 2px 8px rgba(0,0,0,0.4)",flexShrink:0 }}>✕</div>
      </div>

      {/* 우측 사이드 버튼 */}
      <div style={{ position:"absolute",right:10,top:"20%",display:"flex",flexDirection:"column",gap:10,zIndex:10 }}>
        {[
          { icon:"🔔", label:"알림",   key:"notifications", badge:notifs.filter(n=>!n.read).length },
          { icon:"🎯", label:"퀘스트", key:"quests",        badge:quests.filter(q=>!q.done).length },
          { icon:"⭐", label:"포인트", key:"points",        badge:0 },
          { icon:"🛒", label:"상점",   key:"shop",          badge:0 },
        ].map(btn => (
          <div key={btn.key} onClick={() => setSubScreen(btn.key)} style={{ position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer" }}>
            <div style={{ width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",boxShadow:"0 3px 12px rgba(0,0,0,0.18)" }}>
              <span style={{ fontSize:18,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center" }}>{btn.icon}</span>
            </div>
            <span style={{ fontSize:9,color:"#fff",fontWeight:500,textShadow:"0 1px 3px rgba(0,0,0,0.4)" }}>{btn.label}</span>
            {btn.badge>0 && <div style={{ position:"absolute",top:-4,right:-4,background:"#B43A6B",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontWeight:900 }}>{btn.badge}</div>}
          </div>
        ))}
      </div>

      {questSuccess && <QuestPopup quest={questSuccess} />}

      {/* 하단 네비게이션 바 */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, zIndex:30,
        background:"rgba(255,255,255,0.95)", backdropFilter:"blur(12px)",
        borderRadius:"20px 20px 0 0",
        borderTop:"1px solid rgba(0,0,0,0.08)",
        display:"flex", alignItems:"center", justifyContent:"space-around",
        padding:"14px 30px 12px",
      }}>
        {/* 게임 */}
        <div onClick={() => setSubScreen("game")} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer" }}>
          <div style={{ width:38,height:38,borderRadius:"50%",background:"#f0f0f0",border:"2px solid #E5E5E5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🎮</div>
          <span style={{ fontSize:9,fontWeight:600,color:"#333" }}>게임</span>
        </div>
        {/* 수납장 */}
        <div onClick={() => setSubScreen("storage")} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer" }}>
          <div style={{ width:38,height:38,borderRadius:"50%",background:"#f0f0f0",border:"2px solid #E5E5E5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🗄️</div>
          <span style={{ fontSize:9,fontWeight:600,color:"#333" }}>수납장</span>
        </div>
        {/* 대화 */}
        <div onClick={() => setSubScreen("chat")} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer" }}>
          <div style={{
            width:56, height:56, borderRadius:"50%",
            background:"#E54182",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:26,
            boxShadow:"0 4px 16px rgba(180,58,107,0.45)",
            border:"3px solid #fff",
            marginTop:-25,
          }}>💬</div>
          <span style={{ fontSize:9,fontWeight:700,color:"#E54182" }}>대화</span>
        </div>
        {/* 원칙 */}
        <div onClick={() => setSubScreen("principle")} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer" }}>
          <div style={{ width:38,height:38,borderRadius:"50%",background:"#f0f0f0",border:"2px solid #E5E5E5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>⚖️</div>
          <span style={{ fontSize:9,fontWeight:600,color:"#333" }}>원칙</span>
        </div>
        {/* 운세 */}
        <div onClick={() => setSubScreen("fortune")} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer" }}>
          <div style={{ width:38,height:38,borderRadius:"50%",background:"#f0f0f0",border:"2px solid #E5E5E5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🔮</div>
          <span style={{ fontSize:9,fontWeight:600,color:"#333" }}>운세</span>
        </div>
      </div>

      {/* 프로필 오버레이 */}
      {showProfile && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",zIndex:200,backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#fff",width:"100%",boxSizing:"border-box",borderRadius:"24px 24px 0 0",animation:"slideUp 0.3s ease",maxHeight:"85vh",display:"flex",flexDirection:"column",overflowX:"hidden" }}>
            {/* 스크롤 영역 */}
            <div style={{ overflowY:"auto",overflowX:"hidden",flex:1,padding:24,paddingBottom:8,boxSizing:"border-box" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
                <div style={{ fontSize:18,fontWeight:900,color:"#1a1a2e" }}>내 프로필</div>
                <div onClick={() => setShowProfile(false)} style={{ width:32,height:32,background:"#f0f0f5",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#333",fontSize:14 }}>✕</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:18 }}>
                <Char3D char={char} size={68} bounce={true} />
                <div>
                  <div style={{ fontSize:22,fontWeight:900,color:"#1a1a2e" }}>{char?.name}</div>
                  <div style={{ fontSize:12,color:"#888",marginTop:2 }}>{char?.desc}</div>
                  <div style={{ background:`linear-gradient(90deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:20,padding:"3px 12px",fontSize:11,color:"#fff",fontWeight:700,marginTop:6,display:"inline-block" }}>Lv.{level} · {points}P</div>
                </div>
              </div>
              <div style={{ background:`${pt.color}11`,borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:20 }}>{pt.icon}</span>
                <div>
                  <div style={{ fontSize:13,fontWeight:900,color:"#1a1a2e" }}>{pt.name}</div>
                  <div style={{ fontSize:10,color:"#888",marginTop:1 }}>{pt.desc}</div>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                {pt.cards.map((c,i) => (
                  <div key={i} style={{ background:`${c.color}18`,borderRadius:14,padding:12,border:`1.5px solid ${c.color}55` }}>
                    <div style={{ fontSize:20,marginBottom:4 }}>{c.icon}</div>
                    <div style={{ fontSize:9,color:"#aaa",marginBottom:2 }}>{c.title}</div>
                    <div style={{ fontWeight:800,fontSize:12,color:"#222" }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 고정 버튼 푸터 */}
            <div style={{ padding:"12px 20px 32px", flexShrink:0 }}>
              <div onClick={resetGame}
                style={{ background:"linear-gradient(180deg,#f87171,#EF4444)", borderRadius:16, padding:"15px 0",
                  textAlign:"center", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:"0 6px 0 #b91c1caa, 0 8px 18px #EF444433", userSelect:"none" }}>
                처음부터 다시 만들기
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ── 퀘스트 성공 팝업 ──────────────────────────
function QuestPopup({ quest }) {
  return (
    <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)" }}>
      <div style={{ background:"linear-gradient(135deg,#fff,#f8f0ff)",borderRadius:28,padding:28,textAlign:"center",width:250,animation:"successPop 0.4s ease",boxShadow:"0 20px 60px rgba(0,0,0,0.38)" }}>
        <div style={{ fontSize:52,marginBottom:8 }}>🎉</div>
        <div style={{ fontSize:21,fontWeight:900,marginBottom:4 }}>퀘스트 완료!</div>
        <div style={{ fontSize:13,color:"#666",marginBottom:16 }}>{quest.title}</div>
        <div style={{ display:"flex",justifyContent:"center",gap:10 }}>
          <div style={{ background:"#FFF3CC",borderRadius:14,padding:"8px 16px" }}>
            <div style={{ fontSize:9,color:"#aa8800" }}>포인트</div>
            <div style={{ fontWeight:900,color:"#FF9900",fontSize:15 }}>+{quest.points}P</div>
          </div>
          <div style={{ background:"#EEFFEE",borderRadius:14,padding:"8px 16px" }}>
            <div style={{ fontSize:9,color:"#006622" }}>경험치</div>
            <div style={{ fontWeight:900,color:"#22C55E",fontSize:15 }}>+{quest.xp}XP</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 공통 스타일 ───────────────────────────────
const S = {
  wrap:        { display:"flex",flexDirection:"column",height:"100vh",maxWidth:390,margin:"0 auto",fontFamily:"'Segoe UI',sans-serif",overflow:"hidden",position:"relative",background:"#f8f8f8" },
  darkHeader:  { background:"linear-gradient(135deg,#1a1a2e,#0f3460)",padding:"14px 18px 12px",flexShrink:0 },
  scrollBody:  { flex:1,overflowY:"auto",padding:"12px 16px" },
  stepLabel:   { fontSize:11,color:"#aaa",fontWeight:600,letterSpacing:2 },
  screenTitle: { fontSize:20,fontWeight:900,color:"#fff" },
  backBtn:     { width:32,height:32,background:"rgba(255,255,255,0.1)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:14 },
};
