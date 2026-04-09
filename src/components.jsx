// ═══════════════════════════════════════
//  components.jsx  —  공통 UI 컴포넌트
// ═══════════════════════════════════════
import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, OrthographicCamera, useGLTF } from '@react-three/drei';
import {
  CHARACTERS,
  GPT_API_URL,
  GPT_DEFAULT_MODEL,
  getGPTErrorMessage,
  buildLocalOrderFallback,
  PAST_TRADES,
} from "./data";

// ── 3D 캐릭터 SVG ─────────────────────────────
export function Char3D({ char, size = 80, bounce = false, shadow = true, float = false }) {
  if (!char) return null;
  const id = char.id;

  // ── 이미지 캐릭터 (id 1,2) ──
  const IMG_MAP = { 1: "/model/fish2d.png", 2: "/model/rabit2d.png", 3: "/model/chick2d.png", 4: "/model/dino2d.png" };
  if (IMG_MAP[id]) return (
    <div style={{
      position: "relative", display: "inline-block",
      animation: float ? "charFloat 3s ease-in-out infinite"
                : bounce ? "charBounce 1.8s ease-in-out infinite" : "none"
    }}>
      <img
        src={IMG_MAP[id]}
        width={size * 1.3}
        height={size * 1.3 * 1.2}
        style={{ objectFit: "contain", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.28))", display: "block" }}
      />
      {shadow && (
        <div style={{
          position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
          width: size * 0.55, height: 8, borderRadius: "50%",
          background: "rgba(0,0,0,0.16)"
        }} />
      )}
    </div>
  );

  return (
    <div style={{
      position: "relative", display: "inline-block",
      animation: float ? "charFloat 3s ease-in-out infinite"
                : bounce ? "charBounce 1.8s ease-in-out infinite" : "none"
    }}>
      <svg width={size} height={size * 1.2} viewBox="0 0 100 120"
        style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.28))", overflow: "visible" }}>
        {shadow && <ellipse cx="50" cy="115" rx="26" ry="5" fill="rgba(0,0,0,0.16)" />}

        {/* ── 병아리 (흰곰) ── */}
        {id===3&&<>
          {/* 귀 L (둥근) */}
          <circle cx="27" cy="20" r="14" fill="#F8F8F8" stroke="#7B5C3A" strokeWidth="1.5"/>
          <ellipse cx="27" cy="18" rx="8" ry="7" fill="#F0CCCC"/>
          {/* 귀 R */}
          <circle cx="73" cy="20" r="14" fill="#F8F8F8" stroke="#7B5C3A" strokeWidth="1.5"/>
          <ellipse cx="73" cy="18" rx="8" ry="7" fill="#F0CCCC"/>
          {/* 몸통 */}
          <ellipse cx="50" cy="60" rx="40" ry="44" fill="#F8F8F8" stroke="#7B5C3A" strokeWidth="2"/>
          {/* 눈 L */}
          <circle cx="38" cy="48" r="2.8" fill="#7B5C3A"/>
          {/* 눈 R */}
          <circle cx="62" cy="48" r="2.8" fill="#7B5C3A"/>
          {/* 코 (원형) */}
          <circle cx="50" cy="59" r="8" fill="none" stroke="#7B5C3A" strokeWidth="1.5"/>
          <circle cx="50" cy="59" r="3.5" fill="#9B7A5A"/>
          {/* 입 */}
          <path d="M43 69 Q47 73 50 70 Q53 73 57 69" stroke="#7B5C3A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          {/* 발 L */}
          <ellipse cx="33" cy="104" rx="14" ry="8" fill="#F8F8F8" stroke="#7B5C3A" strokeWidth="1.5"/>
          {/* 발 R */}
          <ellipse cx="67" cy="104" rx="14" ry="8" fill="#F8F8F8" stroke="#7B5C3A" strokeWidth="1.5"/>
        </>}

        {/* ── 초록이 (초록 펭귄) ── */}
        {id===4&&<>
          {/* 몸통 */}
          <ellipse cx="50" cy="57" rx="33" ry="42" fill="#C8E898" stroke="#7B5C3A" strokeWidth="2"/>
          {/* 흰 배 */}
          <ellipse cx="50" cy="68" rx="20" ry="27" fill="#F8F8F8"/>
          {/* 날개 L */}
          <ellipse cx="20" cy="64" rx="10" ry="18" fill="#C8E898" stroke="#7B5C3A" strokeWidth="1.5" transform="rotate(-12,20,64)"/>
          {/* 날개 R */}
          <ellipse cx="80" cy="64" rx="10" ry="18" fill="#C8E898" stroke="#7B5C3A" strokeWidth="1.5" transform="rotate(12,80,64)"/>
          {/* 눈 L */}
          <circle cx="39" cy="40" r="2.8" fill="#7B5C3A"/>
          {/* 눈 R */}
          <circle cx="61" cy="40" r="2.8" fill="#7B5C3A"/>
          {/* 부리 */}
          <ellipse cx="50" cy="50" rx="8" ry="5" fill="#F5D070" stroke="#7B5C3A" strokeWidth="1.2"/>
          {/* 발 L */}
          <ellipse cx="34" cy="99" rx="11" ry="6" fill="#F5D070" stroke="#7B5C3A" strokeWidth="1.2"/>
          {/* 발 R */}
          <ellipse cx="66" cy="99" rx="11" ry="6" fill="#F5D070" stroke="#7B5C3A" strokeWidth="1.2"/>
        </>}
      </svg>
    </div>
  );
}

// ── 3D 틸트 카드 ──────────────────────────────
export function Card3D({ children, style, onClick, color = "#fff", depth = true }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseMove={e => {
        if (!depth) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * 12, y: ((e.clientX - r.left) / r.width - 0.5) * -12 });
      }}
      onMouseLeave={() => { setTilt({ x: 0, y: 0 }); setHov(false); }}
      onMouseEnter={() => setHov(true)}
      style={{
        ...style, background: color, borderRadius: 20,
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${hov && onClick ? -3 : 0}px)`,
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: hov && onClick
          ? "0 18px 36px rgba(0,0,0,0.16),inset 0 1px 0 rgba(255,255,255,0.5)"
          : "0 6px 20px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.4)",
        cursor: onClick ? "pointer" : "default",
      }}>
      {children}
    </div>
  );
}

// ── 3D 버튼 ───────────────────────────────────
export function Btn3D({ children, onClick, color = "#FF6B6B", style, disabled, noShadow }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div onClick={disabled ? null : onClick}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...style,
        background: disabled ? "#ccc" : `linear-gradient(180deg,${color}ee,${color})`,
        borderRadius: 16, padding: "13px 20px", color: "#fff", fontWeight: 800, fontSize: 14,
        textAlign: "center", cursor: disabled ? "default" : "pointer",
        transform: pressed ? "translateY(3px) scale(0.98)" : "translateY(0)",
        boxShadow: noShadow ? "none" : disabled ? "0 2px 0 #aaa" : pressed ? `0 2px 0 ${color}88` : `0 6px 0 ${color}77,0 8px 18px ${color}33`,
        transition: "all 0.1s", userSelect: "none",
      }}>
      {children}
    </div>
  );
}

// ── 서브화면 헤더 ─────────────────────────────
export function SubHeader3D({ title, onBack, char }) {
  return (
    <div style={{
      background: "#fff",
      borderBottom: "1px solid #eee",
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
      flexShrink: 0,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}>
      <div onClick={onBack} style={{
        width: 36, height: 36, background: "#f0f0f5", borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 16, color: "#333",
      }}>←</div>
      <span style={{ fontWeight: 900, fontSize: 16, color: "#1a1a2e" }}>{title}</span>
      <div style={{ marginLeft: "auto" }}><Char3D char={char} size={30} shadow={false} /></div>
    </div>
  );
}

// ── GLB 모델 매핑 ────────────────────────────
const CHAR_MODELS = {
  1: "/model/fish.glb",
  2: "/model/rabit.glb",
  3: "/model/chick.glb",
  4: "/model/dino_G.glb",
};

// ── 3D 캐릭터 (GLB — 방 전용) ───────────
function FloatingChar({ char, position, rotation=[0,0,0] }) {
  const groupRef = useRef(null);
  const t = useRef(0);
  const id = char?.id;
  const startY = position[1];
  const modelPath = CHAR_MODELS[id] || CHAR_MODELS[1];
  const { scene } = useGLTF(modelPath);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useFrame((_, delta) => {
    t.current += delta;
    if (!groupRef.current) return;
    groupRef.current.position.y = startY + Math.sin(t.current * 1.0) * 0.04;
  });

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]} rotation={rotation} scale={[48, 48, 48]}>
      <primitive object={cloned} />
    </group>
  );
}

// GLB 파일 프리로드
Object.values(CHAR_MODELS).forEach(path => useGLTF.preload(path));

// ── 3D 방 씬 ──────────────────────────────────
function RoomScene({ char, placedFurniture }) {
  return (
    <>
      {/* 조명 */}
      <ambientLight intensity={1.3} color="#FFF8E8" />
      <directionalLight position={[8,10,4]} intensity={0.85} castShadow
        shadow-mapSize-width={512} shadow-mapSize-height={512}
        shadow-camera-near={0.1} shadow-camera-far={25}
        shadow-camera-left={-7} shadow-camera-right={7}
        shadow-camera-top={7} shadow-camera-bottom={-7}
        shadow-radius={4}
      />
      <pointLight position={[4,3,2]} intensity={0.7} color="#FFF5D0" />
      <pointLight position={[-2,4,3]} intensity={0.3} color="#FFE0B0" />
      {/* 바닥 — 짙은 나무 */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1,3]} receiveShadow>
        <planeGeometry args={[14,26]}/><meshToonMaterial color="#63554C"/>
      </mesh>
      {/* 나무 판재 */}
      {Array.from({length:12},(_,i)=>(
        <mesh key={`p${i}`} rotation={[-Math.PI/2,0,0]} position={[(i-5.5)*1.08,-0.998,3]}>
          <planeGeometry args={[1.0,26]}/><meshToonMaterial color="#63554C" opacity={0.45} transparent/>
        </mesh>
      ))}
      {/* 판재 경계선 */}
      {Array.from({length:13},(_,i)=>(
        <mesh key={`l${i}`} rotation={[-Math.PI/2,0,0]} position={[(i-6)*1.08,-0.996,3]}>
          <planeGeometry args={[0.022,26]}/><meshToonMaterial color="#2A1208" opacity={0.3} transparent/>
        </mesh>
      ))}
      {/* 뒷벽 */}
      <mesh position={[0,1.5,-5.5]} receiveShadow>
        <planeGeometry args={[14,7]}/><meshToonMaterial color="#C5C3B6"/>
      </mesh>
      {/* 왼쪽 벽 */}
      <mesh position={[-5.5,1.5,0]} rotation={[0,Math.PI/2,0]} receiveShadow>
        <planeGeometry args={[14,7]}/><meshToonMaterial color="#C5C3B6"/>
      </mesh>
      {/* 오른쪽 벽 */}
      <mesh position={[5.5,1.5,0]} rotation={[0,-Math.PI/2,0]} receiveShadow>
        <planeGeometry args={[14,7]}/><meshToonMaterial color="#C5C3B6"/>
      </mesh>
      {/* 창문 — 뒤쪽 벽 오른쪽 */}
      <group position={[1.7,1.2,-5.44]} rotation={[0,0,0]}>
        <RoundedBox args={[2.8,1.7,0.12]} radius={0.08} smoothness={4}>
          <meshToonMaterial color="#B8873B"/>
        </RoundedBox>
        <mesh position={[-0.58,0.4,0.08]}>
          <boxGeometry args={[1.08,0.52,0.02]}/>
          <meshToonMaterial color="#A2D2FF" opacity={0.95} transparent/>
        </mesh>
        <mesh position={[0.58,0.4,0.08]}>
          <boxGeometry args={[1.08,0.52,0.02]}/>
          <meshToonMaterial color="#A2D2FF" opacity={0.95} transparent/>
        </mesh>
        <mesh position={[-0.58,-0.4,0.08]}>
          <boxGeometry args={[1.08,0.52,0.02]}/>
          <meshToonMaterial color="#A2D2FF" opacity={0.95} transparent/>
        </mesh>
        <mesh position={[0.58,-0.4,0.08]}>
          <boxGeometry args={[1.08,0.52,0.02]}/>
          <meshToonMaterial color="#A2D2FF" opacity={0.95} transparent/>
        </mesh>
        <mesh position={[0,0,0.1]}><boxGeometry args={[2.4,0.12,0.02]}/><meshToonMaterial color="#B8873B"/></mesh>
        <mesh position={[0,0,0.1]} rotation={[0,0,0]}><boxGeometry args={[0.12,1.5,0.02]}/><meshToonMaterial color="#B8873B"/></mesh>
      </group>
      {/* 천장 펜던트 조명 제거됨 */}
      {/* 소파 — RoundedBox로 전부 둥글게 */}
      <group position={[-1.8,-0.5,-2.0]}>
        {/* 방석 */}
        <RoundedBox args={[2.2,0.48,1.06]} radius={0.14} smoothness={4} position={[0,0.2,0]} castShadow>
          <meshToonMaterial color="#A66666"/>
        </RoundedBox>
        {/* 등받이 */}
        <RoundedBox args={[2.2,0.86,0.26]} radius={0.13} smoothness={4} position={[0,0.76,-0.5]} castShadow>
          <meshToonMaterial color="#A66666"/>
        </RoundedBox>
        {/* 팔걸이 L */}
        <RoundedBox args={[0.26,0.72,1.06]} radius={0.12} smoothness={4} position={[-1.1,0.44,0]} castShadow>
          <meshToonMaterial color="#A66666"/>
        </RoundedBox>
        {/* 팔걸이 R */}
        <RoundedBox args={[0.26,0.72,1.06]} radius={0.12} smoothness={4} position={[1.1,0.44,0]} castShadow>
          <meshToonMaterial color="#A66666"/>
        </RoundedBox>
        {/* 다리 */}
        {[[-0.85,-0.45],[-0.85,0.45],[0.85,-0.45],[0.85,0.45]].map(([x,z],i)=>(
          <mesh key={i} position={[x,-0.16,z]} castShadow>
            <capsuleGeometry args={[0.07,0.2,4,8]}/><meshToonMaterial color="#A66666"/>
          </mesh>
        ))}
      </group>
      {/* 러그 */}
      <mesh rotation={[-Math.PI/2,0,0.15]} position={[0,-0.99,1.2]} scale={[2.8,1.7,1]}>
        <circleGeometry args={[1,48]}/><meshToonMaterial color="#E0CA90"/>
      </mesh>
      {/* 원형 테이블 */}
      <group position={[1.4,-0.45,0.6]}>
        {/* 상판 — 두꺼운 원통으로 둥근 느낌 */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.74,0.74,0.14,36]}/><meshToonMaterial color="#8C6A4F"/>
        </mesh>
        {/* 다리 — capsule로 부드럽게 */}
        {[0,1,2,3].map(i=>{const a=(i/4)*Math.PI*2;return(
          <mesh key={i} position={[Math.cos(a)*0.46,-0.38,Math.sin(a)*0.46]} castShadow>
            <capsuleGeometry args={[0.06,0.58,4,10]}/><meshToonMaterial color="#8C6A4F"/>
          </mesh>
        );})}
        {/* 당근 화분 */}
        <mesh position={[0,0.23,0]}>
          <cylinderGeometry args={[0.14,0.17,0.3,14]}/><meshToonMaterial color="#88AACC"/>
        </mesh>
        <mesh position={[0,0.52,0]}><coneGeometry args={[0.14,0.34,10]}/><meshToonMaterial color="#89A377"/></mesh>
        <mesh position={[0,0.71,0]}><sphereGeometry args={[0.12,12,12]}/><meshToonMaterial color="#58861A"/></mesh>
      </group>
      {/* 화분 */}
      {placedFurniture.includes("화분")&&(
        <group position={[0,-0.77,-2.2]}>
          <mesh castShadow><cylinderGeometry args={[0.18,0.22,0.4,14]}/><meshToonMaterial color="#88AACC"/></mesh>
          <mesh position={[0,0.44,0]}><sphereGeometry args={[0.24,16,16]}/><meshToonMaterial color="#58861A"/></mesh>
        </group>
      )}
      {/* 트로피 */}
      {placedFurniture.includes("트로피")&&(
        <group position={[3.5,-0.65,-3.8]}>
          <mesh castShadow><cylinderGeometry args={[0.12,0.18,0.4,10]}/><meshToonMaterial color="#FFD740"/></mesh>
          <mesh position={[0,0.36,0]}><sphereGeometry args={[0.22,16,16]}/><meshToonMaterial color="#FFDD50"/></mesh>
          <mesh position={[0,0.58,0]}><sphereGeometry args={[0.06,8,8]}/><meshToonMaterial color="#FFD740"/></mesh>
        </group>
      )}
      {/* 황금 소파 */}
      {placedFurniture.includes("소파")&&(
        <group position={[1.8,-0.5,-2.0]}>
          <RoundedBox args={[2.2,0.48,1.06]} radius={0.14} smoothness={4} position={[0,0.2,0]} castShadow>
            <meshToonMaterial color="#A66666"/>
          </RoundedBox>
          <RoundedBox args={[2.2,0.86,0.26]} radius={0.13} smoothness={4} position={[0,0.76,-0.5]} castShadow>
            <meshToonMaterial color="#A66666"/>
          </RoundedBox>
          <RoundedBox args={[0.26,0.72,1.06]} radius={0.12} smoothness={4} position={[-1.1,0.44,0]} castShadow>
            <meshToonMaterial color="#A66666"/>
          </RoundedBox>
          <RoundedBox args={[0.26,0.72,1.06]} radius={0.12} smoothness={4} position={[1.1,0.44,0]} castShadow>
            <meshToonMaterial color="#A66666"/>
          </RoundedBox>
        </group>
      )}
      {/* 주식 시계 */}
      {placedFurniture.includes("주식 시계")&&(
        <group position={[-0.5,1.5,-5.4]}>
          <mesh><cylinderGeometry args={[0.38,0.38,0.08,32]}/><meshToonMaterial color="#F5EED8"/></mesh>
          <mesh position={[0,0,0.05]}><cylinderGeometry args={[0.35,0.35,0.02,32]}/><meshToonMaterial color="#FFF8E8"/></mesh>
          <mesh position={[0,0.09,0.07]} rotation={[0,0,-0.5]}><boxGeometry args={[0.04,0.2,0.02]}/><meshToonMaterial color="#444"/></mesh>
          <mesh position={[0.07,0.06,0.07]} rotation={[0,0,-2.2]}><boxGeometry args={[0.03,0.26,0.02]}/><meshToonMaterial color="#333"/></mesh>
          <mesh><torusGeometry args={[0.38,0.04,8,32]}/><meshToonMaterial color="#C49060"/></mesh>
        </group>
      )}
      {/* 그림 */}
      {placedFurniture.includes("그림")&&(
        <group position={[-2.0,1.4,-5.44]} rotation={[0,0,0]}>
          <RoundedBox args={[1.6,1.1,0.08]} radius={0.06} smoothness={4}>
            <meshToonMaterial color="#C49060"/>
          </RoundedBox>
          <mesh position={[0,0,0.06]}><boxGeometry args={[1.36,0.86,0.02]}/><meshToonMaterial color="#FFF8F0"/></mesh>
          <mesh position={[0,-0.12,0.08]}><boxGeometry args={[1.36,0.36,0.01]}/><meshToonMaterial color="#88CCFF"/></mesh>
          <mesh position={[0,0.22,0.08]}><boxGeometry args={[1.36,0.22,0.01]}/><meshToonMaterial color="#99DD88"/></mesh>
          <mesh position={[-0.28,0.16,0.09]}><sphereGeometry args={[0.18,8,8]}/><meshToonMaterial color="#58861A"/></mesh>
          <mesh position={[0.24,0.12,0.09]}><sphereGeometry args={[0.14,8,8]}/><meshToonMaterial color="#58861A"/></mesh>
          <mesh position={[0.44,0.28,0.09]}><sphereGeometry args={[0.1,8,8]}/><meshToonMaterial color="#FFD740"/></mesh>
        </group>
      )}
      {/* 3D 캐릭터 — 중앙 카펫 앞 */}
      <Suspense fallback={null}>
        <FloatingChar char={char} position={[-0.9,0.5,1.8]} />
      </Suspense>
    </>
  );
}

// ── 3D 방 ─────────────────────────────────────
function getEulReul(word) {
  if (!word) return "를";
  const last = word[word.length - 1];
  const code = last.charCodeAt(0);
  // 한글 완성형
  if (code >= 0xAC00 && code <= 0xD7A3) {
    return (code - 0xAC00) % 28 > 0 ? "을" : "를";
  }
  // 영문 모음으로 끝나면 "를", 자음이면 "을"
  if (/[aeiouAEIOU]/.test(last)) return "를";
  if (/[a-zA-Z]/.test(last)) return "을";
  // 숫자: 0이(영)→를, 1(일)→을, 2(이)→를, 3(삼)→을, 4(사)→를, 5(오)→를, 6(육)→을, 7(칠)→을, 8(팔)→을, 9(구)→를
  const numMap = { "0":"를","1":"을","2":"를","3":"을","4":"를","5":"를","6":"을","7":"을","8":"을","9":"를" };
  if (numMap[last]) return numMap[last];
  return "를";
}

export function Room3D({ char, placedFurniture, onBubbleClick, onCharClick, userName }) {
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    let showTimer, hideTimer;
    // 3초 후 숨김
    showTimer = setTimeout(() => setHintVisible(false), 3000);
    // 13초(3+10) 후 다시 표시 → 반복
    const cycle = () => {
      setHintVisible(true);
      showTimer = setTimeout(() => {
        setHintVisible(false);
        hideTimer = setTimeout(cycle, 10000);
      }, 3000);
    };
    hideTimer = setTimeout(cycle, 13000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <Canvas
        shadows
        style={{ background: "#2A3448", width: "100%", height: "100%" }}
      >
        <OrthographicCamera
          makeDefault
          position={[0, 5.5, 10]}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
          zoom={60}
          near={0.1}
          far={100}
        />
        <RoomScene char={char} placedFurniture={placedFurniture} />
      </Canvas>
      {/* 말풍선 — 정중앙 상단 */}
      <div onClick={onBubbleClick} style={{
        position: "absolute", top: "9%", left: "50%", transform: "translateX(-50%)",
        background: "#ffffff",
        borderRadius: 20, padding: "6px 18px",
        color: "#333", fontSize: 12, fontWeight: 700,
        textAlign: "center", lineHeight: 1.5,
        zIndex: 6, cursor: "pointer",
        border: "2px solid #eeeeee",
        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        whiteSpace: "nowrap",
      }}>
        💰 오늘의 퀘스트!
      </div>
      {/* 캐릭터 힌트 말풍선 */}
      <div style={{
        position: "absolute",
        bottom: "62%", left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 7,
        opacity: hintVisible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: 14, padding: "7px 13px",
          color: "#333", fontSize: 11, fontWeight: 700,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          border: "2px solid #eee",
          whiteSpace: "nowrap",
          position: "relative",
        }}>
          💬 {userName ? `"${userName}"${getEulReul(userName)} 눌러서 대화를 해보세요!` : "저를 눌러서 대화를 해보세요!"}
          {/* 말풍선 꼬리 */}
          <div style={{
            position: "absolute", bottom: -10, left: 24,
            width: 0, height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "10px solid #ffffff",
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.1))",
          }} />
        </div>
      </div>
      {/* 캐릭터 클릭 영역 — 캐릭터 위치에 맞춘 투명 오버레이 */}
      <div onClick={onCharClick} style={{
        position: "absolute",
        bottom: "22%", left: "20%",
        width: "35%", height: "38%",
        cursor: "pointer",
        zIndex: 5,
      }} />
    </div>
  );
}

// ── 포디움 ────────────────────────────────────
export function Podium({ podiumData }) {
  const heights = { 1:90, 2:65, 3:48 };
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:8, padding:"0 10px" }}>
      {podiumData.map(p => {
        const char = CHARACTERS.find(c => c.name === p.name);
        return (
          <div key={p.rank} style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
            <div style={{ marginBottom:4 }}><Char3D char={char} size={p.rank===1?48:38} shadow={false} /></div>
            <div style={{ fontSize:p.rank===1?13:11, fontWeight:800, color:"#fff", marginBottom:2 }}>{p.name}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)", marginBottom:4 }}>{p.score.toLocaleString()}P</div>
            <div style={{ width:"100%", height:heights[p.rank], background:`linear-gradient(180deg,${p.color}cc,${p.color}88)`, borderRadius:"8px 8px 0 0", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 -4px 16px ${p.color}66`, animation:"podiumRise 0.6s ease" }}>
              <span style={{ fontSize:20, fontWeight:900, color:"rgba(0,0,0,0.4)" }}>{p.rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 주문 충고 모달 ────────────────────────────
export function OrderAdviceModal({ stock, char, onClose, surveyAnswers, principles = [], setNotifs }) {
  /* ── 기본 AI 충고 ── */
  const [advice,   setAdvice]   = useState("");
  const [loading,  setLoading]  = useState(true);

  /* ── AI 한마디 토글 ── */
  const [adviceOpen, setAdviceOpen] = useState(true);

  /* ── 과거 거래 내역 폴더 ── */
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const [openCycles,   setOpenCycles]   = useState({});

  /* ── 이 종목의 과거 매매 사이클 (buy→sell 쌍) ── */
  const pastCycles = (() => {
    const trades = PAST_TRADES.filter(t => t.code === stock.code);
    const cycles = [];
    let buy = null;
    trades.forEach(t => {
      if (t.type === "buy") { buy = t; }
      else if (t.type === "sell" && buy) { cycles.push({ buy, sell: t }); buy = null; }
    });
    return cycles;
  })();

  /* ── 배너0: 매매포인트 ── */
  const [pointOpen,    setPointOpen]    = useState(false);
  const [point,        setPoint]        = useState(null);  // { computed, market_flow, ai_advice }
  const [pointLoading, setPointLoading] = useState(false);
  const [pointDone,    setPointDone]    = useState(false);

  /* ── 배너1: 매매일지 ── */
  const [diaryOpen,    setDiaryOpen]    = useState(false);
  const [diary,        setDiary]        = useState(null);  // { computed, aiData, raw }
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryDone,    setDiaryDone]    = useState(false);

  /* ── 사이클별 유사도 분석 상태 ── */
  const [cycleSimResult,   setCycleSimResult]   = useState({});
  const [cycleSimLoading,  setCycleSimLoading]  = useState({});
  const [cycleShowWeights, setCycleShowWeights] = useState({});
  const [cycleWeights,     setCycleWeights]     = useState({});
  const getCycleWeights = (ci) => cycleWeights[ci] || { support:25, ma:25, volume:25, candle:25 };

  /* ── 배너3: 챗봇 ── */
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsgs,    setChatMsgs]    = useState([]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  /* ── 원칙 경고 체크 ── */
  const [principleAlerts, setPrincipleAlerts] = useState([]);
  useEffect(() => {
    const buyPrinciples = (principles || []).filter(p => p.enabled && p.triggerType === "buy_ath");
    if (buyPrinciples.length === 0) return;
    // 52주 고가 조회 후 전고점 근접 여부 확인
    (async () => {
      try {
        const sym = /^\d{6}$/.test(stock.code) ? `${stock.code}.KS` : stock.code;
        const res  = await fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=1d&range=1y`);
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const highs  = result?.indicators?.quote?.[0]?.high?.filter(Boolean) ?? [];
        if (highs.length === 0) return;
        const high52w = Math.max(...highs);
        const ratio   = stock.price / high52w;
        if (ratio >= 0.95) {
          setPrincipleAlerts(buyPrinciples.map(p => ({
            id: p.id, text: p.text,
            msg: `현재가(${stock.price.toLocaleString()})가 52주 고가(${Math.round(high52w).toLocaleString()})의 ${Math.round(ratio*100)}% 수준입니다. 전고점 근처입니다.`,
          })));
          // 투자원칙 알림 추가
          if (setNotifs) {
            setNotifs(prev => {
              const already = prev.some(n => n.type === "principle" && n.stock === stock.code && n.principleId === buyPrinciples[0].id);
              if (already) return prev;
              return [{ id: Date.now(), icon:"⚖️", type:"principle", stock:stock.code,
                title:`${stock.name} — 전고점 도달 경고`,
                desc:`${stock.name}이(가) 52주 고가의 ${Math.round(ratio*100)}% 수준에 있습니다. 매수 원칙을 확인하세요.`,
                time:"방금", read:false, principleId: buyPrinciples[0].id,
              }, ...prev];
            });
          }
        }
      } catch { /* 조회 실패 시 무시 */ }
    })();
  }, []);

  /* ── 기본 AI 충고 fetch ── */
  useEffect(() => {
    (async () => {
      try {
        const pd = stock.pastData;
        const prompt =
          `사용자가 ${stock.name}(${stock.code}) 주식을 매수하려 합니다.\n` +
          `과거 데이터: 평균매입가 ${pd.avgPrice.toLocaleString()}원, 보유수량 ${pd.qty}주, ` +
          `총수익률 ${pd.totalReturn}, 보유기간 ${pd.holdDays}일.\n` +
          `현재가: ${stock.price.toLocaleString()} (전일대비 ${stock.pct}%).\n` +
          `사용자 투자성향: ${JSON.stringify(surveyAnswers)}.\n` +
          `위 정보를 바탕으로 ${char?.personality} 성격으로 매수 결정에 대한 개인화된 충고를 3~4문장으로. 이모지 2~3개, 한국어로.`;
        const res  = await fetch(GPT_API_URL, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model: GPT_DEFAULT_MODEL,
            messages:[
              { role:"system", content:`당신은 투자 도우미 캐릭터 "${char?.name}"입니다.` },
              { role:"user",   content:prompt },
            ],
            max_tokens:400,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setAdvice(`${getGPTErrorMessage(res.status, data.error)} ${buildLocalOrderFallback({ char, stock, surveyAnswers })}`); return; }
        setAdvice(data.choices?.[0]?.message?.content || "신중하게 결정하세요!");
      } catch { setAdvice(buildLocalOrderFallback({ char, stock, surveyAnswers })); }
      setLoading(false);
    })();
  }, []);

  /* ── 챗봇 스크롤 ── */
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMsgs]);

  /* ── 배너0: 매매포인트 생성 ── */
  const generatePoint = async () => {
    if (pointDone || pointLoading) return;
    setPointLoading(true);
    try {
      const sym = /^\d{6}$/.test(stock.code) ? `${stock.code}.KS` : stock.code;
      const ohlcvRes  = await fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=1d&range=10y`);
      const ohlcvData = await ohlcvRes.json();
      const result = ohlcvData?.chart?.result?.[0];
      const q  = result?.indicators?.quote?.[0];
      const ts = result?.timestamp;

      let computed = null;
      if (ts && q) {
        const candles = ts.map((t, i) => ({
          time: t * 1000, close: q.close[i], high: q.high[i] ?? q.close[i],
          low: q.low[i] ?? q.close[i], volume: q.volume[i] ?? 0,
        })).filter(c => c.close != null);
        const N = candles.length;
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const closes  = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const ma5   = avg(closes.slice(-5));
        const ma20  = avg(closes.slice(-20));
        const ma60  = closes.length >= 60 ? avg(closes.slice(-60)) : null;
        const curP  = closes[N - 1];
        const maTrend = ma5 > ma20 && (!ma60 || ma20 > ma60) ? "정배열"
                      : ma5 < ma20 && (!ma60 || ma20 < ma60) ? "역배열" : "혼조";
        const vol5avg  = avg(volumes.slice(-5));
        const vol20avg = avg(volumes.slice(-20));
        const volRatio = vol20avg > 0 ? (vol5avg / vol20avg).toFixed(2) : "1.00";
        const ret5d    = ((curP - closes[N - 6]) / closes[N - 6] * 100).toFixed(1);
        const ret20d   = ((curP - closes[N - 21]) / closes[N - 21] * 100).toFixed(1);
        const highs252 = candles.slice(-252).map(c => c.high);
        const lows252  = candles.slice(-252).map(c => c.low);
        const high52w  = Math.max(...highs252);
        const low52w   = Math.min(...lows252);
        const pos52w   = high52w === low52w ? 50
                       : Math.round((curP - low52w) / (high52w - low52w) * 100);
        const wins    = pastCycles.filter(c => (c.sell.profit ?? 0) >= 0);
        const winRate = pastCycles.length > 0 ? Math.round(wins.length / pastCycles.length * 100) : null;
        const rets    = pastCycles.map(c => parseFloat(c.sell.profitPct ?? 0)).filter(v => !isNaN(v));
        const avgRet  = rets.length > 0 ? (rets.reduce((a,b)=>a+b,0)/rets.length).toFixed(1) : null;
        const holds   = pastCycles.map(c => c.buy?.date && c.sell?.date
          ? Math.round((new Date(c.sell.date) - new Date(c.buy.date)) / 86400000) : null).filter(Boolean);
        const avgHold = holds.length > 0 ? Math.round(holds.reduce((a,b)=>a+b,0)/holds.length) : null;
        const lastBuy   = pastCycles.length > 0 ? pastCycles[pastCycles.length - 1].buy.price : null;
        const vsLastBuy = lastBuy ? ((curP - lastBuy) / lastBuy * 100).toFixed(1) : null;
        computed = { curP, ma5: Math.round(ma5), ma20: Math.round(ma20),
          ma60: ma60 ? Math.round(ma60) : null, maTrend, volRatio, ret5d, ret20d,
          high52w: Math.round(high52w), low52w: Math.round(low52w), pos52w,
          totalTrades: pastCycles.length, winRate, avgRet, avgHold, lastBuy, vsLastBuy };
      }

      const ctx = computed
        ? `종목: ${stock.name}(${stock.code}), 현재가: ${Math.round(computed.curP).toLocaleString()}원(전일대비 ${stock.pct}%)\n` +
          `[현재 기술적 지표] MA5=${computed.ma5.toLocaleString()} MA20=${computed.ma20.toLocaleString()}${computed.ma60?` MA60=${computed.ma60.toLocaleString()}`:""} 배열=${computed.maTrend} 5일수익률=${computed.ret5d}% 20일수익률=${computed.ret20d}% 거래량비율(5일/20일평균)=${computed.volRatio}배\n` +
          `[시장상황] 52주고가=${computed.high52w.toLocaleString()} 52주저가=${computed.low52w.toLocaleString()} 현재위치=${computed.pos52w}%\n` +
          `[과거 거래 요약] 총${computed.totalTrades}회${computed.winRate!=null?` 승률${computed.winRate}%`:""}${computed.avgRet!=null?` 평균수익${computed.avgRet}%`:""}${computed.avgHold!=null?` 평균보유${computed.avgHold}일`:""}${computed.vsLastBuy!=null?` 직전매수가대비현재${computed.vsLastBuy}%`:""}`
        : `종목: ${stock.name}, 현재가: ${stock.price.toLocaleString()}원, 전일대비: ${stock.pct}%`;

      const POINT_SYSTEM = `당신은 주식 시장 분석 전문가입니다. 현재 기술적 지표와 과거 거래 데이터를 바탕으로 투자 조언을 제공합니다. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.`;
      const pointPrompt = `${ctx}\n\n아래 JSON만 반환하세요 (마크다운 없이 순수 JSON):\n{"market_flow":"현재 기술적 지표(MA배열, 거래량비율, 52주 위치, 최근 수익률)를 바탕으로 현재 시장 흐름 2~3문장. 구체적 수치 포함. 한국어.","ai_advice":"과거 거래 데이터(승률, 평균수익률, 평균보유기간, 직전매수가 대비 현재)를 바탕으로 지금 이 종목에 대한 투자 조언 2~3문장. 한국어."}`;

      const res = await fetch(GPT_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GPT_DEFAULT_MODEL,
          messages: [
            { role: "system", content: POINT_SYSTEM },
            { role: "user",   content: pointPrompt },
          ],
          max_tokens: 400,
        }),
      });
      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content ?? "";
      let aiPoint = null;
      try {
        const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        aiPoint = JSON.parse(jsonStr);
      } catch { /* 파싱 실패 시 무시 */ }
      setPoint({ computed, market_flow: aiPoint?.market_flow ?? null, ai_advice: aiPoint?.ai_advice ?? null });
      setPointDone(true);
    } catch {
      setPoint({ computed: null, market_flow: null, ai_advice: "매매포인트 생성에 실패했어요." });
      setPointDone(true);
    }
    setPointLoading(false);
  };

  /* ── 배너1: 매매일지 생성 ── */
  const generateDiary = async () => {
    if (diaryDone || diaryLoading) return;
    setDiaryLoading(true);
    try {
      const sym = /^\d{6}$/.test(stock.code) ? `${stock.code}.KS` : stock.code;

      // ── OHLCV 10년치 ──
      const ohlcvRes  = await fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=1d&range=10y`);
      const ohlcvData = await ohlcvRes.json();
      const result = ohlcvData?.chart?.result?.[0];
      const q  = result?.indicators?.quote?.[0];
      const ts = result?.timestamp;

      let computed = null;

      if (ts && q) {
        const candles = ts.map((t, i) => ({
          time: t * 1000,
          close:  q.close[i],
          high:   q.high[i]   ?? q.close[i],
          low:    q.low[i]    ?? q.close[i],
          volume: q.volume[i] ?? 0,
        })).filter(c => c.close != null);
        const N = candles.length;
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

        // ─ 섹션1: 현재 매수 시점 분석 ─
        const closes  = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const ma5   = avg(closes.slice(-5));
        const ma20  = avg(closes.slice(-20));
        const ma60  = closes.length >= 60 ? avg(closes.slice(-60)) : null;
        const curP  = closes[N - 1];
        const maTrend = ma5 > ma20 && (!ma60 || ma20 > ma60) ? "정배열"
                      : ma5 < ma20 && (!ma60 || ma20 < ma60) ? "역배열" : "혼조";
        const vol5avg  = avg(volumes.slice(-5));
        const vol20avg = avg(volumes.slice(-20));
        const volRatio = vol20avg > 0 ? vol5avg / vol20avg : 1;
        const ret5d    = ((curP - closes[N - 6]) / closes[N - 6] * 100).toFixed(1);
        const ret20d   = ((curP - closes[N - 21]) / closes[N - 21] * 100).toFixed(1);

        // ─ 섹션3: 시장 상황 ─
        const highs252 = candles.slice(-252).map(c => c.high);
        const lows252  = candles.slice(-252).map(c => c.low);
        const high52w  = Math.max(...highs252);
        const low52w   = Math.min(...lows252);
        const pos52w   = high52w === low52w ? 50
                       : Math.round((curP - low52w) / (high52w - low52w) * 100);

        // ─ 섹션2: 과거 거래 데이터 ─
        const wins      = pastCycles.filter(c => (c.sell.profit ?? 0) >= 0);
        const winRate   = pastCycles.length > 0 ? Math.round(wins.length / pastCycles.length * 100) : null;
        const rets      = pastCycles.map(c => parseFloat(c.sell.profitPct ?? 0)).filter(v => !isNaN(v));
        const avgRet    = rets.length > 0 ? (avg(rets)).toFixed(1) : null;
        const holds     = pastCycles.map(c => c.buy?.date && c.sell?.date
          ? Math.round((new Date(c.sell.date) - new Date(c.buy.date)) / 86400000) : null).filter(Boolean);
        const avgHold   = holds.length > 0 ? Math.round(avg(holds)) : null;
        const lastBuy   = pastCycles.length > 0 ? pastCycles[pastCycles.length - 1].buy.price : null;
        const vsLastBuy = lastBuy ? ((curP - lastBuy) / lastBuy * 100).toFixed(1) : null;

        computed = {
          curP, ma5: Math.round(ma5), ma20: Math.round(ma20),
          ma60: ma60 ? Math.round(ma60) : null, maTrend,
          volRatio: volRatio.toFixed(2), ret5d, ret20d,
          high52w: Math.round(high52w), low52w: Math.round(low52w), pos52w,
          totalTrades: pastCycles.length, winRate, avgRet, avgHold,
          lastBuy, vsLastBuy,
        };
      }

      // ── Gemini: 매매 패턴 분류 + 일지 JSON 생성 ──
      const lastCycle = pastCycles.length > 0 ? pastCycles[pastCycles.length - 1] : null;
      const lastHoldDays = lastCycle?.buy?.date && lastCycle?.sell?.date
        ? Math.round((new Date(lastCycle.sell.date) - new Date(lastCycle.buy.date)) / 86400000)
        : null;

      const ctx = computed
        ? `종목: ${stock.name}(${stock.code}), 현재가: ${Math.round(computed.curP).toLocaleString()}원(전일대비 ${stock.pct}%)\n` +
          `[현재 기술적 지표] MA5=${computed.ma5.toLocaleString()} MA20=${computed.ma20.toLocaleString()}${computed.ma60?` MA60=${computed.ma60.toLocaleString()}`:""} 배열=${computed.maTrend} 5일수익률=${computed.ret5d}% 20일수익률=${computed.ret20d}% 거래량비율(5일/20일평균)=${computed.volRatio}배\n` +
          `[과거 거래 요약] 총${computed.totalTrades}회${computed.winRate!=null?` 승률${computed.winRate}%`:""}${computed.avgRet!=null?` 평균수익${computed.avgRet}%`:""}${computed.avgHold!=null?` 평균보유${computed.avgHold}일`:""}${computed.vsLastBuy!=null?` 직전매수가대비현재${computed.vsLastBuy}%`:""}\n` +
          `[시장상황] 52주고가=${computed.high52w.toLocaleString()} 52주저가=${computed.low52w.toLocaleString()} 현재위치=${computed.pos52w}% 최근20일추세=${computed.ret20d}%`
        : `종목: ${stock.name}, 현재가: ${stock.price.toLocaleString()}원(참고용 정적값), 전일대비: ${stock.pct}%`;

      const lastCycleCtx = lastCycle
        ? `\n[분석 대상 거래 (최근 매매)]\n` +
          `매수일: ${lastCycle.buy?.date || '?'} / 매수가: ${lastCycle.buy?.price?.toLocaleString() || '?'}원\n` +
          `매도일: ${lastCycle.sell?.date || '?'} / 매도가: ${(lastCycle.sell?.price ?? lastCycle.sell?.sellPrice)?.toLocaleString() || '?'}원\n` +
          `수익률: ${lastCycle.sell?.profitPct != null ? lastCycle.sell.profitPct + '%' : '?'} / 보유기간: ${lastHoldDays != null ? lastHoldDays + '일' : '?'}`
        : '\n[분석 대상 거래] 완료된 매매 기록 없음 — 현재 기술적 지표 기반으로만 분석하세요.';

      const SYSTEM_PROMPT = `당신은 주식 매매 패턴 분석 전문가입니다.
주어진 차트 지표 데이터를 분석하여 매수/매도 패턴을 분류하고, AI 매매일지를 작성합니다.

## 매수 패턴 분류 기준
아래 패턴 중 가장 일치하는 것 하나를 선택하세요. 복수 해당 시 가장 지배적인 패턴 하나만 선택합니다.

### 좋은 매수 패턴
1. 눌림목_진입 - 조건: 정배열(MA5 > MA20) + 매수 전 3~5일 하락/횡보 + 매수일 양봉. 의미: 상승 추세 중 숨 고르기 구간에서 진입
2. 지지선_반등 - 조건: 20일 최저가 대비 매수가 ±3% 이내 + 매수일 양봉 전환. 의미: 지지선에서 반등을 확인하고 진입
3. 횡보_돌파 - 조건: 매수 전 5일 이상 좁은 박스권(등락 ±2% 이내) + 매수일 거래량 150% 이상 급증 + 양봉. 의미: 에너지 응축 후 위로 돌파하는 시점 진입
4. 저점_분할매수 - 조건: 역배열이나 하락 추세 중 + 매수가가 20일 최저가 근처 + 거래량 감소. 의미: 하락 추세에서 저점을 분할로 쌓는 전략적 진입

### 아쉬운 매수 패턴
5. 급등_추격 - 조건: 매수일 또는 전일 주가 +5% 이상 급등 + 거래량 200% 이상. 의미: 이미 급등한 자리에서 늦게 올라탄 추격 매수
6. 역배열_진입 - 조건: MA5 < MA20 역배열 + 연속 음봉 3일 이상 + 지지선 이탈. 의미: 하락 추세 한복판에서 진입 — 리스크 높음
7. 고점_근처_진입 - 조건: 매수가가 20일 최고가 대비 -3% 이내 + 음봉 전환 신호 존재. 의미: 이미 충분히 오른 고점 근처에서 진입
8. 충동_진입 - 조건: 뚜렷한 기술적 근거 없음 + 거래량 평범 + 매수 전 추세 불명확. 의미: 명확한 진입 근거 없이 들어간 경우

## 매도 패턴 분류 기준
아래 패턴 중 가장 일치하는 것 하나를 선택하세요.

### 좋은 매도 패턴
1. 저항선_익절 - 조건: 직전 고점(저항선) ±3% 구간에서 매도 + 매도 후 주가 하락 or 횡보. 의미: 저항선을 인식하고 계획적으로 수익 실현
2. 추세_이탈_손절 - 조건: MA5 하향 이탈 시점 매도 + 매도 후 주가 추가 하락. 의미: 추세 이탈 신호를 보고 원칙대로 손절
3. 목표가_달성_매도 - 조건: 보유 중 최고 수익률 80% 이상 실현 + 매도 후 주가 하락. 의미: 목표가 근처에서 수익을 잘 챙긴 경우
4. 분할_익절 - 조건: 보유 기간 중 수익 구간에서 매도 + 매도 후 소폭 추가 상승. 의미: 욕심 부리지 않고 적당한 자리에서 나온 경우

### 아쉬운 매도 패턴
5. 패닉_손절 - 조건: 단기 급락(-3% 이상) 당일 매도 + 매도 후 7일 내 +5% 이상 반등. 의미: 감정적 공포에 의한 손절 — 손절 후 반등 확인됨
6. 조기_익절 - 조건: 수익 매도 + 매도 후 7일 내 추가 +5% 이상 상승. 의미: 더 갈 수 있었는데 너무 일찍 팔았음
7. 늦은_손절 - 조건: 손실 매도 + 최대 낙폭이 최종 손실의 2배 이상. 의미: 손절 기준 없이 버티다가 손실이 커진 후 매도
8. 갭하락_패닉매도 - 조건: 매도일 시가 전일 종가 대비 -3% 이상 갭하락 + 시가 즉시 매도. 의미: 갭하락 충격에 패닉 매도 — 장 진행 후 회복 여부 확인 필요

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.`;

      const prompt = `${ctx}${lastCycleCtx}\n\n위 데이터를 분석하여 아래 JSON만 반환하세요 (마크다운 없이 순수 JSON):\n` +
        `{"buy_pattern":{"name":"패턴명","grade":"좋음|아쉬움","reason":"분류 근거 2~3문장. 구체적 수치 포함.","score":1~10},` +
        `"sell_pattern":{"name":"패턴명","grade":"좋음|아쉬움","reason":"분류 근거 2~3문장. 구체적 수치 포함.","score":1~10},` +
        `"hold_analysis":{"comment":"보유 구간 분석 2문장. 최고 수익률 대비 실현 수익률, 낙폭 버팀 여부 포함.","score":1~10},` +
        `"tags":["태그1","태그2","태그3"],` +
        `"journal":{"summary":"이번 거래 한 줄 요약","buy_comment":"매수 시점 평가 3~4문장","hold_comment":"보유 구간 평가 2~3문장","sell_comment":"매도 시점 평가 3~4문장","improvement":"다음 거래를 위한 구체적 개선 제안 2~3가지. 짧고 직설적으로."}}`;

      const res  = await fetch(GPT_API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GPT_DEFAULT_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: prompt },
          ],
          max_tokens: 900,
        }),
      });
      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content ?? "";
      let aiData = null;
      try {
        const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        aiData = JSON.parse(jsonStr);
      } catch { /* 파싱 실패 시 raw 폴백 */ }

      setDiary({ computed, aiData, raw });
      setDiaryDone(true);
    } catch {
      setDiary({ computed: null, aiData: null, raw: "매매포인트 생성에 실패했어요." });
      setDiaryDone(true);
    }
    setDiaryLoading(false);
  };

  /* ── 사이클별 유사도 분석 ── */
  const analyzeSimilarityForCycle = async (ci, w) => {
    const cycle = pastCycles[ci];
    if (!cycle) return;
    setCycleSimLoading(prev => ({ ...prev, [ci]: true }));
    setCycleSimResult(prev => ({ ...prev, [ci]: null }));
    try {
      const sym = /^\d{6}$/.test(stock.code) ? `${stock.code}.KS` : stock.code;
      const res  = await fetch(`/api/yahoo/v8/finance/chart/${sym}?interval=1d&range=10y`);
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      const q  = result?.indicators?.quote?.[0];
      const ts = result?.timestamp;
      if (!ts || !q || ts.length < 25) throw new Error("데이터가 부족해요");

      const candles = ts.map((t, i) => ({
        time: t * 1000, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] ?? 0,
      })).filter(c => c.close != null && c.open != null);
      const N = candles.length;

      const normalize = (arr) => {
        const mn = Math.min(...arr), mx = Math.max(...arr);
        return mx === mn ? arr.map(() => 0.5) : arr.map(v => (v - mn) / (mx - mn));
      };
      const cosineSim = (a, b) => {
        const n = Math.min(a.length, b.length);
        if (n === 0) return 0;
        const dot  = a.slice(0, n).reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
        const magA = Math.sqrt(a.slice(0, n).reduce((s, v) => s + v * v, 0));
        const magB = Math.sqrt(b.slice(0, n).reduce((s, v) => s + v * v, 0));
        if (magA === 0 || magB === 0) return 0;
        return Math.max(0, dot / (magA * magB));
      };

      const findIdx = (dateStr) => {
        const target = new Date(dateStr + "T00:00:00Z").getTime();
        let best = 0, bestDiff = Infinity;
        candles.forEach((c, i) => {
          const diff = Math.abs(c.time - target);
          if (diff < bestDiff) { bestDiff = diff; best = i; }
        });
        return best;
      };

      const sellIdx = cycle.sell.date
        ? findIdx(cycle.sell.date)
        : Math.floor(N * 0.45);

      if (sellIdx >= N - 2) throw new Error("데이터 범위를 벗어났어요");

      // 과거: 매수일 -20일 ~ 매도일
      const buyIdx = cycle.buy?.date ? findIdx(cycle.buy.date) : Math.max(0, sellIdx - 20);
      const pastStart = Math.max(0, buyIdx - 20);
      const windowLen = Math.max(5, sellIdx - pastStart);

      const pastClose = candles.slice(pastStart, sellIdx).map(c => c.close);
      const pastVol   = candles.slice(pastStart, sellIdx).map(c => c.volume);
      const pastOpen  = candles.slice(pastStart, sellIdx).map(c => c.open);
      const pastHigh  = candles.slice(pastStart, sellIdx).map(c => c.high ?? c.close);
      const pastLow_  = candles.slice(pastStart, sellIdx).map(c => c.low  ?? c.close);
      const after5Raw = candles.slice(sellIdx, Math.min(sellIdx + 7, N));

      // 현재: 가장 최근 windowLen 캔들
      const currStart = Math.max(0, N - windowLen);
      const currClose = candles.slice(currStart, N).map(c => c.close);
      const currVol   = candles.slice(currStart, N).map(c => c.volume);
      const currOpen  = candles.slice(currStart, N).map(c => c.open);
      const currHigh  = candles.slice(currStart, N).map(c => c.high ?? c.close);
      const currLow_  = candles.slice(currStart, N).map(c => c.low  ?? c.close);

      const supportDist = (closes, lows) => {
        const minL = Math.min(...lows);
        const range = Math.max(...closes) - minL || 1;
        return closes.map((v, i) => (Math.min(v, lows[i]) - minL) / range);
      };
      const supportScore = cosineSim(supportDist(pastClose, pastLow_), supportDist(currClose, currLow_));

      const maAvg = (arr, n) => arr.slice(n - 1).map((_, i) => arr.slice(i, i + n).reduce((a, b) => a + b, 0) / n);
      const pastMA = maAvg(pastClose, 3);
      const currMA = maAvg(currClose, 3);
      const maScore = pastMA.length > 0 && currMA.length > 0 ? cosineSim(normalize(pastMA), normalize(currMA)) : 0.5;

      const volumeScore = cosineSim(normalize(pastVol), normalize(currVol));

      const bodyRatio = (opens, closes, highs, lows) =>
        opens.map((o, i) => {
          const range = (highs[i] - lows[i]) || 1;
          return (closes[i] - o) / range;
        });
      const pastBody = bodyRatio(pastOpen, pastClose, pastHigh, pastLow_);
      const currBody = bodyRatio(currOpen, currClose, currHigh, currLow_);
      const normBody = (arr) => arr.map(v => (v + 1) / 2);
      const candleScore = cosineSim(normBody(pastBody), normBody(currBody));

      const total = w.support + w.ma + w.volume + w.candle || 1;
      const score = Math.round(
        (supportScore * w.support + maScore * w.ma + volumeScore * w.volume + candleScore * w.candle) / total * 100
      );

      const after5Pct = after5Raw.length >= 2
        ? parseFloat(((after5Raw[after5Raw.length-1].close - after5Raw[0].close) / after5Raw[0].close * 100).toFixed(1))
        : null;

      const allPrices = [...pastClose, ...currClose];
      const mn = Math.min(...allPrices), mx = Math.max(...allPrices);
      const normChart = (v) => mx === mn ? 0.5 : (v - mn) / (mx - mn);

      setCycleSimResult(prev => ({ ...prev, [ci]: {
        score, after5Pct,
        sellDate: cycle.sell?.date ?? new Date(candles[sellIdx].time).toLocaleDateString("ko-KR", { month:"long", day:"numeric" }),
        pastPricesNorm:  pastClose.map(normChart),
        currPricesNorm:  currClose.map(normChart),
        after5PricesNorm: after5Raw.map(c => normChart(c.close)),
        breakdown: {
          support: Math.round(supportScore * 100),
          ma:      Math.round(maScore * 100),
          volume:  Math.round(volumeScore * 100),
          candle:  Math.round(candleScore * 100),
        },
      }}));
    } catch(e) { setCycleSimResult(prev => ({ ...prev, [ci]: { error: e.message } })); }
    setCycleSimLoading(prev => ({ ...prev, [ci]: false }));
  };

  /* ── 배너3: 챗봇 전송 ── */
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const newMsgs = [...chatMsgs, { role:"user", text:msg }];
    setChatMsgs(newMsgs);
    setChatLoading(true);
    try {
      // 종목 컨텍스트 구성 (Yahoo Finance 데이터 + 매매포인트 + 유사도)
      const context =
        `종목: ${stock.name}(${stock.code}), 현재가: ${stock.price.toLocaleString()}원(${stock.pct}%).\n` +
        `과거 데이터: 평균매입가 ${stock.pastData.avgPrice.toLocaleString()}원, 수익률 ${stock.pastData.totalReturn}, 보유기간 ${stock.pastData.holdDays}일.\n` +
        (diary?.aiData?.aiLine ? `매매포인트 AI요약: ${diary.aiData.aiLine}. 승률: ${diary.computed?.winRate ?? ""}%, 52주위치: ${diary.computed?.pos52w ?? ""}%\n` : diary?.raw ? `매매포인트: ${diary.raw.slice(0,150)}\n` : "") +
        (Object.values(cycleSimResult).filter(r => r && !r.error).map((r, i) => `제${i+1}차 유사도: ${r.score}%, 매도 후 7일: ${r.after5Pct ?? "N/A"}%`).join(" | ") || "");

      // 통합 서버 /api/stock-chat (OpenAI+tools → Gemini RAG → Gemini 직접)
      const res = await fetch("/api/stock-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:    msg,
          context,
          history:    newMsgs.map(m => ({ role: m.role, text: m.text })),
          stock_code: stock.code,  // 서버 사이드 Yahoo Finance 조회 + 벡터 유사도 검색용
        }),
      });
      const data  = await res.json();
      const reply = res.ok
        ? (data.response || "답변을 생성할 수 없어요.")
        : "잠시 후 다시 시도해주세요.";
      setChatMsgs(prev => [...prev, { role:"model", text:reply }]);
    } catch {
      setChatMsgs(prev => [...prev, { role:"model", text:"잠시 후 다시 시도해주세요." }]);
    }
    setChatLoading(false);
  };

  const INDICATORS = [
    { key:"support", label:"지지선",    icon:"🛡️" },
    { key:"ma",      label:"이동평균선", icon:"📉" },
    { key:"volume",  label:"거래량",    icon:"📊" },
    { key:"candle",  label:"캔들 형식", icon:"🕯️" },
  ];

  /* ══════════ RENDER ══════════ */
  return (
    <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",zIndex:300,backdropFilter:"blur(4px)" }}>
      <div style={{ background:"linear-gradient(160deg,#1a1a2e,#0f2060)",width:"100%",borderRadius:"24px 24px 0 0",animation:"slideUp 0.35s ease",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)",maxHeight:"92vh",display:"flex",flexDirection:"column" }}>

        {/* ─ 헤더 (고정) ─ */}
        <div style={{ padding:"18px 22px 12px",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <Char3D char={char} size={44} shadow={false} bounce={true} />
              <div>
                <div style={{ fontSize:15,fontWeight:900,color:"#fff" }}>{char?.name}의 충고</div>
                <div style={{ fontSize:10,color:"rgba(255,255,255,0.5)" }}>과거 거래 데이터 기반 분석</div>
              </div>
            </div>
            <div onClick={onClose} style={{ width:32,height:32,background:"rgba(255,255,255,0.1)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:16 }}>✕</div>
          </div>
        </div>

        {/* ─ 스크롤 영역 ─ */}
        <div style={{ overflowY:"auto",flex:1,padding:"0 22px 8px" }}>


          {/* ── 원칙 경고 배너 ── */}
          {principleAlerts.length > 0 && (
            <div style={{ marginBottom:14 }}>
              {principleAlerts.map(alert => (
                <div key={alert.id} style={{ background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:14,padding:"10px 14px",marginBottom:6,display:"flex",gap:10,alignItems:"flex-start" }}>
                  <span style={{ fontSize:18,flexShrink:0 }}>⚖️</span>
                  <div>
                    <div style={{ fontSize:11,fontWeight:800,color:"#f87171",marginBottom:3 }}>나의 원칙 — {alert.text}</div>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,0.7)",lineHeight:1.6 }}>{alert.msg} {char?.name}가 확인을 권장해요!</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 과거 거래 내역 — 폴더 */}
          <div style={{ background:"rgba(255,215,0,0.07)",border:"1px solid rgba(255,215,0,0.25)",borderRadius:16,marginBottom:10,overflow:"hidden" }}>
            <div onClick={() => setHistoryOpen(o=>!o)}
              style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",cursor:"pointer" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:20 }}>📂</span>
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>과거 거래 내역</div>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.45)" }}>{pastCycles.length}건의 매매 기록</div>
                </div>
              </div>
              <span style={{ color:"rgba(255,255,255,0.5)",fontSize:16,transition:"transform 0.2s",transform:historyOpen?"rotate(180deg)":"none" }}>▾</span>
            </div>
            {historyOpen && (
              <div style={{ padding:"0 12px 12px" }}>
                {pastCycles.length > 0 ? pastCycles.map((cycle, ci) => {
                  const profit    = cycle.sell.profit ?? 0;
                  const profitPct = cycle.sell.profitPct ?? "0";
                  const up        = profit >= 0;
                  const buyDate   = cycle.buy?.date  ?? "-";
                  const sellDate  = cycle.sell?.date ?? "-";
                  const holdDays  = cycle.buy?.date && cycle.sell?.date
                    ? Math.round((new Date(sellDate) - new Date(buyDate)) / 86400000) : null;
                  const isOpen    = !!openCycles[ci];
                  return (
                    <div key={ci} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,215,0,0.18)",borderRadius:12,marginBottom:8,overflow:"hidden" }}>
                      {/* 사이클 헤더 — 클릭으로 열기/닫기 */}
                      <div onClick={() => setOpenCycles(prev => ({ ...prev, [ci]: !prev[ci] }))}
                        style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",cursor:"pointer" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:14 }}>{isOpen ? "📖" : "📄"}</span>
                          <span style={{ fontSize:12,fontWeight:800,color:"#FFD580" }}>제{ci+1}차 매매</span>
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:11,fontWeight:800,color:up?"#4ADE80":"#FF6B6B" }}>
                            {up?"+":""}{Math.round(profit).toLocaleString()}원
                          </span>
                          <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)",transition:"transform 0.2s",transform:isOpen?"rotate(180deg)":"none" }}>▾</span>
                        </div>
                      </div>
                      {/* 상세 내용 */}
                      {isOpen && (
                        <div style={{ padding:"0 12px 12px" }}>
                          {/* 거래 정보 그리드 */}
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12 }}>
                            {[
                              { l:"매수일",   v: buyDate },
                              { l:"매도일",   v: sellDate },
                              { l:"매수가",   v: `${(cycle.buy?.price ?? 0).toLocaleString()}원 × ${cycle.buy?.qty ?? 0}주` },
                              { l:"매도가",   v: `${(cycle.sell?.price ?? 0).toLocaleString()}원` },
                              ...(holdDays != null ? [{ l:"보유기간", v:`${holdDays}일` }] : []),
                              { l:"수익",     v: `${up?"+":""}${Math.round(profit).toLocaleString()}원 (${up?"+":""}${profitPct}%)` },
                              { l:"메모",     v: cycle.sell?.note ?? cycle.buy?.note ?? "-" },
                            ].map((item, i) => (
                              <div key={i} style={{ background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"6px 9px" }}>
                                <div style={{ fontSize:9,color:"rgba(255,255,255,0.35)",marginBottom:2 }}>{item.l}</div>
                                <div style={{ fontSize:11,fontWeight:700,color: item.l==="수익" ? (up?"#4ADE80":"#FF6B6B") : "#fff" }}>{item.v}</div>
                              </div>
                            ))}
                          </div>

                          {/* 차트 유사도 분석 (사이클별) */}
                          {(() => {
                            const cr  = cycleSimResult[ci];
                            const lod = cycleSimLoading[ci];
                            const sw  = cycleShowWeights[ci];
                            const w   = getCycleWeights(ci);
                            return (
                              <div style={{ background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:12,overflow:"hidden" }}>
                                <div onClick={() => { if (!cr && !lod) analyzeSimilarityForCycle(ci, w); }}
                                  style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",cursor:"pointer" }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                                    <span style={{ fontSize:15 }}>📊</span>
                                    <div>
                                      <div style={{ fontSize:11,fontWeight:800,color:"#fff" }}>차트 유사도 분석</div>
                                      <div style={{ fontSize:9,color:"rgba(255,255,255,0.4)" }}>매도 시점 패턴 ↔ 현재 비교</div>
                                    </div>
                                  </div>
                                  {cr
                                    ? <span style={{ fontSize:18,fontWeight:900,color:cr.score>=70?"#f87171":cr.score>=40?"#fbbf24":"#4ADE80" }}>{cr.score}%</span>
                                    : lod
                                      ? <div style={{ display:"flex",gap:3 }}>{[0,1,2].map(i=><div key={i} style={{ width:4,height:4,background:"#f87171",borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}</div>
                                      : <span style={{ fontSize:10,color:"rgba(255,255,255,0.35)" }}>탭하여 분석</span>
                                  }
                                </div>
                                {cr && !cr.error && (
                                  <div style={{ padding:"0 12px 10px" }}>
                                    <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginBottom:8 }}>
                                      <strong style={{ color:"#FFD580" }}>{cr.sellDate}</strong> 매도 전 패턴과 현재 <strong style={{ color:cr.score>=60?"#f87171":"#4ADE80" }}>{cr.score}% 유사</strong>.
                                      {cr.after5Pct != null && (
                                        <span> 당시 매도 후 7일 <strong style={{ color:cr.after5Pct>=0?"#4ADE80":"#f87171" }}>{cr.after5Pct>=0?"+":""}{cr.after5Pct}%</strong></span>
                                      )}
                                    </div>
                                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8 }}>
                                      {INDICATORS.map(ind => (
                                        <div key={ind.key} style={{ background:"rgba(255,255,255,0.04)",borderRadius:7,padding:"5px 8px" }}>
                                          <div style={{ fontSize:8,color:"rgba(255,255,255,0.35)",marginBottom:2 }}>{ind.icon} {ind.label}</div>
                                          <div style={{ height:2,background:"rgba(255,255,255,0.1)",borderRadius:2,marginBottom:2 }}>
                                            <div style={{ height:"100%",width:`${cr.breakdown[ind.key]}%`,background:"linear-gradient(90deg,#f87171,#fbbf24)",borderRadius:2 }}/>
                                          </div>
                                          <div style={{ fontSize:10,fontWeight:800,color:"#fff" }}>{cr.breakdown[ind.key]}%</div>
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{ fontSize:9,color:"rgba(255,255,255,0.3)",textAlign:"right",marginBottom:6 }}>⚠️ 참고용 정보로 활용해야 합니다.</div>
                                    <div onClick={() => setCycleShowWeights(prev => ({ ...prev, [ci]: !prev[ci] }))}
                                      style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"6px 10px",cursor:"pointer",marginBottom:sw?6:0 }}>
                                      <span style={{ fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:700 }}>⚙️ 지표 가중치 설정</span>
                                      <span style={{ fontSize:11,color:"rgba(255,255,255,0.35)" }}>{sw?"▲":"▼"}</span>
                                    </div>
                                    {sw && (
                                      <div style={{ background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 10px" }}>
                                        {(() => {
                                          const total = Object.values(w).reduce((a,b)=>a+b,0);
                                          const ok    = total === 100;
                                          return (
                                            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,background:ok?"rgba(74,222,128,0.1)":"rgba(255,107,107,0.12)",borderRadius:7,padding:"5px 8px" }}>
                                              <span style={{ fontSize:9,color:"rgba(255,255,255,0.5)" }}>합이 100%여야 재분석 가능</span>
                                              <span style={{ fontSize:12,fontWeight:900,color:ok?"#4ADE80":"#FF6B6B" }}>{total}%</span>
                                            </div>
                                          );
                                        })()}
                                        {INDICATORS.map(ind => (
                                          <div key={ind.key} style={{ marginBottom:8 }}>
                                            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                                              <span style={{ fontSize:10,color:"rgba(255,255,255,0.7)" }}>{ind.icon} {ind.label}</span>
                                              <span style={{ fontSize:10,fontWeight:800,color:"#818cf8" }}>{w[ind.key]}%</span>
                                            </div>
                                            <input type="range" min={0} max={100} value={w[ind.key]}
                                              onChange={e => setCycleWeights(prev => ({ ...prev, [ci]: { ...getCycleWeights(ci), [ind.key]: Number(e.target.value) } }))}
                                              style={{ width:"100%",accentColor:"#818cf8",cursor:"pointer" }}
                                            />
                                          </div>
                                        ))}
                                        {(() => {
                                          const total = Object.values(w).reduce((a,b)=>a+b,0);
                                          const ok    = total === 100;
                                          return (
                                            <div onClick={() => ok && analyzeSimilarityForCycle(ci, w)}
                                              style={{ background:ok?"linear-gradient(135deg,#ef4444,#dc2626)":"rgba(255,255,255,0.1)",borderRadius:8,padding:"7px",textAlign:"center",color:ok?"#fff":"rgba(255,255,255,0.3)",fontWeight:800,fontSize:11,cursor:ok?"pointer":"not-allowed",marginTop:2 }}>
                                              {ok ? "가중치 적용 후 재분석" : `합계 ${total}% — 100%를 맞춰주세요`}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {cr?.error && <div style={{ fontSize:11,color:"#f87171",padding:"6px 12px 10px" }}>⚠️ {cr.error}</div>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",padding:"8px 4px" }}>과거 거래 내역이 없습니다.</div>
                )}
              </div>
            )}
          </div>

          {/* AI 충고 — 토글 */}
          <div style={{ background:`linear-gradient(135deg,${char?.grad[0]}22,${char?.grad[1]}11)`,border:`1px solid ${char?.color}44`,borderRadius:14,marginBottom:14,overflow:"hidden" }}>
            <div onClick={() => setAdviceOpen(o=>!o)}
              style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",cursor:"pointer" }}>
              <div style={{ fontSize:11,color:char?.color,fontWeight:700 }}>💡 {char?.name}의 한마디</div>
              <span style={{ color:"rgba(255,255,255,0.4)",fontSize:14,transition:"transform 0.2s",transform:adviceOpen?"rotate(180deg)":"none" }}>▾</span>
            </div>
            {adviceOpen && (
              <div style={{ padding:"0 14px 14px" }}>
                {loading
                  ? <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <div style={{ display:"flex",gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,background:char?.color,borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}</div>
                      <span style={{ fontSize:12,color:"rgba(255,255,255,0.5)" }}>분석 중...</span>
                    </div>
                  : <>
                      <div style={{ fontSize:13,color:"rgba(255,255,255,0.9)",lineHeight:1.7 }}>{advice}</div>
                      <div style={{ fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:8,textAlign:"right" }}>⚠️ 참고용 정보로 활용해야 합니다.</div>
                    </>
                }
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════
              배너0: 매매포인트
          ══════════════════════════════════════ */}
          <div style={{ background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.35)",borderRadius:16,marginBottom:10,overflow:"hidden" }}>
            <div onClick={() => { setPointOpen(o=>!o); if(!pointOpen && !pointDone) generatePoint(); }}
              style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",cursor:"pointer" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:20 }}>📡</span>
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>매매포인트</div>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.45)" }}>현재 시장 흐름 · 과거 데이터 기반 AI 조언</div>
                </div>
              </div>
              <span style={{ color:"rgba(255,255,255,0.5)",fontSize:16,transition:"transform 0.2s",transform:pointOpen?"rotate(180deg)":"none" }}>▾</span>
            </div>
            {pointOpen && (
              <div style={{ padding:"0 16px 14px" }}>
                {pointLoading
                  ? <div style={{ display:"flex",alignItems:"center",gap:8,padding:"12px 0" }}>
                      <div style={{ display:"flex",gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:5,height:5,background:"#fbbf24",borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}</div>
                      <span style={{ fontSize:12,color:"rgba(255,255,255,0.4)" }}>시장 데이터 분석 중...</span>
                    </div>
                  : !point
                    ? <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",padding:"8px 0" }}>데이터를 불러오는 중...</div>
                    : (() => {
                        const c = point.computed;
                        return (
                          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>

                            {/* ── 현재 시장 지표 그리드 ── */}
                            {c && (
                              <div>
                                <div style={{ fontSize:10,fontWeight:800,color:"#fbbf24",marginBottom:6,letterSpacing:0.5 }}>📊 현재 시장 흐름</div>
                                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:6 }}>
                                  {[
                                    { label:"MA배열",    val:c.maTrend,       color: c.maTrend==="정배열"?"#10b981":c.maTrend==="역배열"?"#f87171":"#f59e0b" },
                                    { label:"52주위치",  val:`${c.pos52w}%`,  color: c.pos52w>80?"#f87171":c.pos52w<30?"#10b981":"#f59e0b" },
                                    { label:"거래량비율",val:`×${c.volRatio}`,color: parseFloat(c.volRatio)>=1.2?"#10b981":parseFloat(c.volRatio)<=0.8?"#f87171":"#a78bfa" },
                                    { label:"5일수익률", val:`${c.ret5d>=0?"+":""}${c.ret5d}%`, color: parseFloat(c.ret5d)>=0?"#10b981":"#f87171" },
                                    { label:"20일수익률",val:`${c.ret20d>=0?"+":""}${c.ret20d}%`,color: parseFloat(c.ret20d)>=0?"#10b981":"#f87171" },
                                    { label:"MA5",       val:c.ma5.toLocaleString(),             color:"#e0e7ff" },
                                  ].map((item,i) => (
                                    <div key={i} style={{ background:"rgba(255,255,255,0.04)",borderRadius:7,padding:"5px 4px",textAlign:"center" }}>
                                      <div style={{ fontSize:8,color:"rgba(255,255,255,0.3)",marginBottom:1 }}>{item.label}</div>
                                      <div style={{ fontSize:11,fontWeight:800,color:item.color }}>{item.val}</div>
                                    </div>
                                  ))}
                                </div>
                                {point.market_flow && (
                                  <div style={{ fontSize:11,color:"rgba(255,255,255,0.75)",lineHeight:1.7,background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:8,padding:"8px 10px" }}>
                                    {point.market_flow}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── 과거 데이터 기반 AI 조언 ── */}
                            {c && (
                              <div>
                                <div style={{ fontSize:10,fontWeight:800,color:"#fbbf24",marginBottom:6,letterSpacing:0.5 }}>🤖 과거 데이터 기반 AI 조언</div>
                                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:6 }}>
                                  {[
                                    { label:"총 거래",     val:`${c.totalTrades}회`,                                       color:"#e0e7ff" },
                                    { label:"승률",        val:c.winRate!=null?`${c.winRate}%`:"N/A",                       color:c.winRate>=60?"#10b981":c.winRate>=40?"#f59e0b":"#f87171" },
                                    { label:"평균수익",    val:c.avgRet!=null?`${c.avgRet>=0?"+":""}${c.avgRet}%`:"N/A",   color:parseFloat(c.avgRet)>=0?"#10b981":"#f87171" },
                                  ].map((item,i) => (
                                    <div key={i} style={{ background:"rgba(255,255,255,0.04)",borderRadius:7,padding:"5px 4px",textAlign:"center" }}>
                                      <div style={{ fontSize:8,color:"rgba(255,255,255,0.3)",marginBottom:1 }}>{item.label}</div>
                                      <div style={{ fontSize:11,fontWeight:800,color:item.color }}>{item.val}</div>
                                    </div>
                                  ))}
                                </div>
                                {point.ai_advice && (
                                  <div style={{ fontSize:11,color:"rgba(255,255,255,0.75)",lineHeight:1.7,background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:8,padding:"8px 10px" }}>
                                    {point.ai_advice}
                                  </div>
                                )}
                              </div>
                            )}

                            <div style={{ fontSize:9,color:"rgba(255,255,255,0.2)",textAlign:"right" }}>⚠️ 참고용 정보로 활용해야 합니다.</div>
                          </div>
                        );
                      })()
                }
              </div>
            )}
          </div>



          {/* ══════════════════════════════════════
              배너3: AI 챗봇
          ══════════════════════════════════════ */}
          <div style={{ background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:16,marginBottom:14,overflow:"hidden" }}>
            <div onClick={() => setChatOpen(o=>!o)}
              style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",cursor:"pointer" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:20 }}>💬</span>
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>AI 챗봇에게 물어보기</div>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.45)" }}>매매포인트·패턴분석 결과 기반 맞춤 답변</div>
                </div>
              </div>
              <span style={{ color:"rgba(255,255,255,0.5)",fontSize:16,transition:"transform 0.2s",transform:chatOpen?"rotate(180deg)":"none" }}>▾</span>
            </div>
            {chatOpen && (
              <div style={{ padding:"0 16px 14px" }}>
                {/* 빠른 질문 버튼 */}
                {chatMsgs.length === 0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {["매매일지 요약해줘","지금 사도 될까?","유사도 결과 해석해줘","손절 기준 알려줘"].map(q => (
                      <div key={q} onClick={() => { setChatInput(q); }}
                        style={{ background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:20,padding:"5px 12px",fontSize:11,color:"#6ee7b7",cursor:"pointer" }}>
                        {q}
                      </div>
                    ))}
                  </div>
                )}
                {/* 채팅 메시지 */}
                {chatMsgs.length > 0 && (
                  <div style={{ maxHeight:200,overflowY:"auto",marginBottom:10,display:"flex",flexDirection:"column",gap:8 }}>
                    {chatMsgs.map((m,i) => (
                      <div key={i} style={{ display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                        <div style={{
                          maxWidth:"82%",padding:"8px 12px",borderRadius:12,fontSize:12,lineHeight:1.6,
                          background: m.role==="user"?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.07)",
                          color:"#fff",
                        }}>{m.text}</div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ display:"flex",gap:4,padding:"6px 12px" }}>
                        {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,background:"#10b981",borderRadius:"50%",animation:`pulse ${0.5+i*0.15}s infinite` }}/>)}
                      </div>
                    )}
                    <div ref={chatBottomRef}/>
                  </div>
                )}
                {/* 입력창 */}
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); }}}
                    placeholder="궁금한 점을 물어보세요..."
                    style={{ flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"9px 12px",fontSize:12,color:"#fff",outline:"none" }}
                  />
                  <div onClick={sendChat}
                    style={{ background:"linear-gradient(135deg,#10b981,#059669)",borderRadius:10,padding:"9px 14px",fontSize:12,color:"#fff",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap" }}>
                    전송
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>{/* /scroll */}

        {/* ─ 버튼 (고정) ─ */}
        <div style={{ display:"flex",gap:10,padding:"12px 22px 20px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.07)" }}>
          <div onClick={onClose} style={{ flex:1,background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"12px",textAlign:"center",color:"rgba(255,255,255,0.7)",fontWeight:700,fontSize:13,cursor:"pointer" }}>다시 검토할게요</div>
          <div onClick={onClose} style={{ flex:1.5,background:`linear-gradient(135deg,${char?.grad[0]},${char?.grad[1]})`,borderRadius:14,padding:"12px",textAlign:"center",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",boxShadow:`0 4px 16px ${char?.color}55` }}>그래도 매수할게요</div>
        </div>

      </div>
    </div>
  );
}
