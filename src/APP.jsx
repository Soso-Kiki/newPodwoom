// ═══════════════════════════════════════
//  App.jsx  —  전역 상태 + 라우터
// ═══════════════════════════════════════
import { useState } from "react";
import {
  CHARACTERS, FURNITURE_LIST, QUESTS_INIT, NOTIFS_INIT, PRINCIPLES_INIT, ANIM_CSS,
  buildPersonaMD,
} from "./data";
import { HomeScreen, OrderScreen, MenuScreen, AccountScreen } from "./screens/StockScreens";
import {
  SelectCharacterScreen, CharIntroScreen, SurveyScreen,
  LoadingScreen, HelpCheckScreen, AnalysisResultScreen, GameMainScreen,
} from "./screens/GameScreens";

export default function App() {
  // ── 라우팅 ────────────────────────────────
  const [screen,    setScreen]    = useState("home");
  // home | menu | order
  // select-character | character-intro | survey | loading | help-check | analysis-result | main
  const [subScreen, setSubScreen] = useState(null);
  // notifications | quests | chat | shop

  // ── 주문 / 차트 진입 ─────────────────────
  const [orderCode,      setOrderCode]      = useState(null);
  const [orderInitView,  setOrderInitView]  = useState("order"); // "order" | "chart"
  const goOrder = (code = null) => { setOrderCode(code); setOrderInitView("order"); setScreen("order"); };
  const goChart = (code = null) => { setOrderCode(code); setOrderInitView("chart"); setScreen("order"); };
  const goAccount = () => setScreen("account");

  // ── 온보딩 상태 ───────────────────────────
  const [hasOnboarded,   setHasOnboarded]   = useState(false);
  const [selectedChar,   setSelectedChar]   = useState(null);
  const [surveyAnswers,  setSurveyAnswers]  = useState({});
  const [dataConsent,    setDataConsent]    = useState(false);
  const [helpChecks,     setHelpChecks]     = useState([false,false,false,false,false]);

  // ── 게임 상태 ─────────────────────────────
  const [points,       setPoints]       = useState(300);
  const [level,        setLevel]        = useState(1);
  const [xp,           setXp]           = useState(0);
  const [quests,       setQuests]       = useState(QUESTS_INIT);
  const [notifs,       setNotifs]       = useState(NOTIFS_INIT);
  const [principles,   setPrinciples]   = useState(PRINCIPLES_INIT);
  const [furniture,    setFurniture]    = useState(FURNITURE_LIST);
  const [placedFurni,  setPlacedFurni]  = useState(["화분"]);
  const [questSuccess, setQuestSuccess] = useState(null);
  const [showProfile,  setShowProfile]  = useState(false);

  // ── 닉네임 ────────────────────────────────
  const [userName, setUserName] = useState("");

  // ── 채팅 상태 ─────────────────────────────
  const [messages,  setMessages]  = useState([]);
  const [inputMsg,  setInputMsg]  = useState("");
  const [isTyping,  setIsTyping]  = useState(false);

  // ── 페르소나 MD (AIdamtic RAG용) ──────────
  const [personaMD, setPersonaMD] = useState("");

  // ── 파생 ──────────────────────────────────
  const char = CHARACTERS.find(c => c.id === selectedChar);

  // ── 게임 진입 ─────────────────────────────
  const enterGame = () => {
    if (hasOnboarded && selectedChar) setScreen("main");
    else setScreen("select-character");
  };

  // ── 온보딩 완료 → 페르소나 MD 생성 ──────────
  const finishOnboarding = () => {
    setHasOnboarded(true);
    if (char) setPersonaMD(buildPersonaMD(char, surveyAnswers));
    setScreen("analysis-result");
  };

  // ── 초기화 ───────────────────────────────
  const resetGame = () => {
    setHasOnboarded(false); setSelectedChar(null);
    setSurveyAnswers({}); setDataConsent(false);
    setHelpChecks([false,false,false,false,false]);
    setMessages([]); setShowProfile(false); setPersonaMD("");
    setScreen("select-character");
  };

  // ── 퀘스트 완료 ───────────────────────────
  const completeQuest = (id) => {
    const q = quests.find(x => x.id === id);
    if (!q || q.done) return;
    setQuests(quests.map(x => x.id===id ? {...x,done:true} : x));
    setPoints(p => p + q.points);
    setXp(x => { const n = x + q.xp; if(n>=100){setLevel(l=>l+1);return n-100;} return n; });
    setQuestSuccess(q);
    setTimeout(() => setQuestSuccess(null), 2500);
  };

  // ── 가구 구매 ─────────────────────────────
  const buyFurniture = (id) => {
    const f = furniture.find(x => x.id === id);
    if (!f || f.owned || points < f.price) return;
    setFurniture(furniture.map(x => x.id===id ? {...x,owned:true} : x));
    setPoints(p => p - f.price);
    // 구매 시 자동 배치
    setPlacedFurni(prev => [...prev, f.name]);
  };

  // ── 가구 배치 토글 ────────────────────────
  const toggleFurni = (name) => {
    setPlacedFurni(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // ══════════════════════════════════════════
  //  라우터
  // ══════════════════════════════════════════
  return (
    <>
      <style>{ANIM_CSS}</style>

      {/* ── 증권 앱 ── */}
      {screen === "home" && (
        <HomeScreen
          onGoMenu={() => setScreen("menu")}
          onGoOrder={goOrder}
          onGoChart={goChart}
          onGoGame={enterGame}
          onGoAccount={goAccount}
          hasOnboarded={hasOnboarded}
          char={char}
          userName={userName}
        />
      )}
      {screen === "menu" && (
        <MenuScreen
          onBack={() => setScreen("home")}
          onGoGame={enterGame}
          onGoOrder={goOrder}
          hasOnboarded={hasOnboarded}
          char={char}
        />
      )}
      {screen === "order" && (
        <OrderScreen
          onBack={() => setScreen("home")}
          char={char}
          hasOnboarded={hasOnboarded}
          surveyAnswers={surveyAnswers}
          dataConsent={dataConsent}
          initialCode={orderCode}
          initialView={orderInitView}
          onGoAccount={goAccount}
          principles={principles}
          setNotifs={setNotifs}
        />
      )}
      {screen === "account" && (
        <AccountScreen
          onBack={() => setScreen("home")}
          onGoOrder={goOrder}
          onGoChart={goChart}
        />
      )}

      {/* ── 게임 온보딩 ── */}
      {screen === "select-character" && (
        <SelectCharacterScreen
          onBack={() => setScreen("menu")}
          onNext={() => setScreen("character-intro")}
          selectedChar={selectedChar}
          setSelectedChar={setSelectedChar}
        />
      )}
      {screen === "character-intro" && (
        <CharIntroScreen char={char} onNext={() => setScreen("survey")} />
      )}
      {screen === "survey" && (
        <SurveyScreen
          char={char}
          surveyAnswers={surveyAnswers}
          setSurveyAnswers={setSurveyAnswers}
          dataConsent={dataConsent}
          setDataConsent={setDataConsent}
          onNext={() => setScreen("loading")}
        />
      )}
      {screen === "loading" && (
        <LoadingScreen char={char} onDone={finishOnboarding} />
      )}
      {screen === "analysis-result" && (
        <AnalysisResultScreen
          char={char}
          dataConsent={dataConsent}
          helpChecks={helpChecks}
          surveyAnswers={surveyAnswers}
          onGoMain={(nick) => { setUserName(nick || "투자자"); setScreen("main"); }}
        />
      )}

      {/* ── 게임 메인 ── */}
      {screen === "main" && (
        <GameMainScreen
          char={char}
          userName={userName}
          level={level}   xp={xp}   points={points}
          quests={quests} setQuests={setQuests}
          notifs={notifs} setNotifs={setNotifs}
          furniture={furniture}
          placedFurni={placedFurni}
          questSuccess={questSuccess}
          onGoHome={() => setScreen("home")}
          subScreen={subScreen}
          setSubScreen={setSubScreen}
          showProfile={showProfile}
          setShowProfile={setShowProfile}
          messages={messages}   setMessages={setMessages}
          inputMsg={inputMsg}   setInputMsg={setInputMsg}
          isTyping={isTyping}   setIsTyping={setIsTyping}
          surveyAnswers={surveyAnswers}
          personaMD={personaMD}
          completeQuest={completeQuest}
          buyFurniture={buyFurniture}
          toggleFurni={toggleFurni}
          resetGame={resetGame}
          principles={principles}
          setPrinciples={setPrinciples}
        />
      )}
    </>
  );
}