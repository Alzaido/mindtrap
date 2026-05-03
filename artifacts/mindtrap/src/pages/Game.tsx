import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/contexts/SocketContext";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { playTick, playCorrect, playWrong, playNewQuestion, playAbility, playCountdownEnd } from "@/lib/sounds";

type Question = {
  id: string;
  text: string;
  options: string[];
  category: string;
  timeLimit: number;
  image?: string;
};

type ScoreUpdate = { name: string; score: number; delta: number };

export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [, setLocation] = useLocation();
  const [playerName] = useLocalStorage("mindtrap_playerName", "");
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

  const [question, setQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreUpdate[]>([]);
  const [yourDelta, setYourDelta] = useState<number | null>(null);

  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const [abilities, setAbilities] = useState({ confuse: 1, freeze: 1, reverse: 1, sabotage: 0 });
  const [activeEffect, setActiveEffect] = useState<{ type: string, message: string } | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<string[]>([]);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const lastTickRef = useRef<number>(0);
  const countdownEndPlayedRef = useRef(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectDeadlineRef = useRef<NodeJS.Timeout | null>(null);

  // Handle socket connect / disconnect for reconnection
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsReconnecting(false);
      if (reconnectDeadlineRef.current) {
        clearTimeout(reconnectDeadlineRef.current);
        reconnectDeadlineRef.current = null;
      }
      // Rejoin room and request current state
      if (roomCode && playerName) {
        socket.emit("join-room", { roomCode, playerName });
        setTimeout(() => {
          socket.emit("request-resync", { roomCode, playerName });
        }, 300);
      }
    };

    const handleDisconnect = () => {
      setIsReconnecting(true);
      // Only redirect to home after 12 seconds of being unreachable
      reconnectDeadlineRef.current = setTimeout(() => {
        setLocation("/");
      }, 12000);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // If already connected on mount, join the room
    if (isConnected && roomCode && playerName) {
      socket.emit("join-room", { roomCode, playerName });
      setTimeout(() => {
        socket.emit("request-resync", { roomCode, playerName });
      }, 300);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      if (reconnectDeadlineRef.current) clearTimeout(reconnectDeadlineRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Register game events when socket is ready
  useEffect(() => {
    if (!socket || !isConnected || !roomCode) return;

    socket.on("next-question", (data: { question: Question, questionNumber: number, totalQuestions: number, playerNames?: string[] }) => {
      playNewQuestion();
      setupNewQuestion(data);
      if (data.playerNames) {
        setOtherPlayers(data.playerNames.filter((n) => n !== playerName));
      }
    });

    socket.on("question-result", (data: { correctIndex: number, explanation: string, scores: ScoreUpdate[] }) => {
      setCorrectIndex(data.correctIndex);
      setExplanation(data.explanation);
      setScores(data.scores);
      const myScore = data.scores.find((s) => s.name === playerName);
      const delta = myScore ? myScore.delta : 0;
      setYourDelta(delta);
      if (timerRef.current) clearInterval(timerRef.current);
      if (delta > 0) {
        playCorrect();
      } else {
        playWrong();
      }
    });

    socket.on("ability-effect", (data: { ability: string, fromPlayer: string, toPlayer: string }) => {
      let message = "";
      if (data.ability === "confuse") message = `😵 ${data.fromPlayer} شوشك!`;
      if (data.ability === "freeze") message = `❄️ ${data.fromPlayer} جمدك!`;
      if (data.ability === "reverse") message = `🔄 ${data.fromPlayer} عكسك!`;
      
      playAbility(data.ability);
      setActiveEffect({ type: data.ability, message });
      setTimeout(() => setActiveEffect(null), 3000);
    });

    socket.on("sabotage-effect", (data: { fromPlayer: string; stolen: number }) => {
      playAbility("sabotage");
      setActiveEffect({
        type: "sabotage",
        message: `💣 ${data.fromPlayer} خرّبك وسرق ${data.stolen} نقطة!`,
      });
      setTimeout(() => setActiveEffect(null), 4000);
    });

    socket.on("score-update", (data: { scores: ScoreUpdate[] }) => {
      setScores(data.scores);
    });

    socket.on("ability-update", (data: { abilities: typeof abilities }) => {
      setAbilities(data.abilities);
    });

    socket.on("game-finished", () => {
      setLocation(`/results/${roomCode}`);
    });

    return () => {
      socket.off("next-question");
      socket.off("question-result");
      socket.off("ability-effect");
      socket.off("sabotage-effect");
      socket.off("score-update");
      socket.off("ability-update");
      socket.off("game-finished");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, isConnected, roomCode, setLocation]);

  useEffect(() => {
    if (correctIndex !== null) return;
    const ceiled = Math.ceil(timeLeft);
    if (ceiled <= 3 && ceiled >= 1 && ceiled !== lastTickRef.current) {
      lastTickRef.current = ceiled;
      playTick(ceiled);
    }
    if (timeLeft <= 0 && !countdownEndPlayedRef.current) {
      countdownEndPlayedRef.current = true;
      playCountdownEnd();
    }
  }, [timeLeft, correctIndex]);

  const setupNewQuestion = (data: { question: Question, questionNumber: number, totalQuestions: number }) => {
    setQuestion(data.question);
    setQuestionNumber(data.questionNumber);
    setTotalQuestions(data.totalQuestions);
    setSelectedAnswer(null);
    setCorrectIndex(null);
    setExplanation(null);
    setScores([]);
    setYourDelta(null);
    setTimeLeft(data.question.timeLimit);
    setTimeLimit(data.question.timeLimit);
    startTimeRef.current = Date.now();
    lastTickRef.current = 0;
    countdownEndPlayedRef.current = false;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null || timeLeft <= 0 || !question) return;
    
    setSelectedAnswer(index);
    const responseTime = (Date.now() - startTimeRef.current) / 1000;
    
    if (socket && roomCode && playerName) {
      socket.emit("submit-answer", {
        roomCode,
        playerName,
        questionId: question.id,
        answerIndex: index,
        responseTime
      });
    }
  };

  const useAbility = (ability: 'confuse' | 'freeze' | 'reverse') => {
    if (abilities[ability] <= 0 || !socket || !roomCode || !playerName) return;
    setAbilities(prev => ({ ...prev, [ability]: prev[ability] - 1 }));
    socket.emit("use-ability", { roomCode, playerName, ability, targetName: "random" });
    toast({ title: `استخدمت قدرة ${ability === 'confuse' ? 'التشويش 😵' : ability === 'freeze' ? 'التجميد ❄️' : 'الانعكاس 🔄'}` });
  };

  const useSabotage = (targetName: string) => {
    if (abilities.sabotage <= 0 || !socket || !roomCode || !playerName) return;
    setAbilities(prev => ({ ...prev, sabotage: 0 }));
    setShowTargetPicker(false);
    socket.emit("use-ability", { roomCode, playerName, ability: "sabotage", targetName });
    toast({ title: `💣 تخريب ${targetName}! سرقت نقاطه` });
  };

  if (isReconnecting) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-6">
        <div className="text-5xl animate-spin">🔄</div>
        <div className="text-2xl font-black text-primary">جاري إعادة الاتصال...</div>
        <div className="text-muted-foreground text-sm">سيتم إرجاعك للرئيسية إذا فشل الاتصال خلال 12 ثانية</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-2xl font-bold text-primary">جاري تحضير الأسئلة... 🧠</div>
      </div>
    );
  }

  const timePercentage = (timeLeft / timeLimit) * 100;
  const timeColor = timePercentage > 50 ? "text-green-500" : timePercentage > 25 ? "text-yellow-500" : "text-destructive";

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background relative overflow-hidden">
      {/* Ability effect overlay */}
      <AnimatePresence>
        {activeEffect && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none"
          >
            <h1 className="text-4xl md:text-6xl font-black text-destructive drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] text-center px-4">
              {activeEffect.message}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center px-4 pt-3 pb-2 z-10 shrink-0">
        {/* Question counter */}
        <div className="bg-card px-3 py-1.5 rounded-xl border border-border shadow-sm">
          <span className="font-bold text-muted-foreground text-xs">سؤال</span>
          <div className="text-xl font-black text-primary leading-none">{questionNumber} / {totalQuestions}</div>
        </div>

        {/* Timer circle */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="32" cy="32" r="28" className="stroke-muted fill-none" strokeWidth="6" />
            <circle 
              cx="32" cy="32" r="28"
              className={`fill-none transition-all duration-100 ${timeColor} stroke-current`} 
              strokeWidth="6" 
              strokeDasharray="176" 
              strokeDashoffset={176 - (176 * timePercentage) / 100}
              strokeLinecap="round"
            />
          </svg>
          <span className={`text-xl font-black ${timeColor}`}>{Math.ceil(timeLeft)}</span>
        </div>
      </div>

      {/* ── QUESTION ── */}
      <div className="px-4 z-10 shrink-0">
        <motion.div 
          key={question.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-card/90 backdrop-blur-md border-border shadow-lg overflow-hidden">
            {question.image && (
              <div className="w-full bg-black/40 flex items-center justify-center overflow-hidden rounded-t-xl" style={{ minHeight: 140, maxHeight: 220 }}>
                <img
                  src={question.image}
                  alt="سؤال"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 220 }}
                  onError={(e) => {
                    const container = (e.target as HTMLImageElement).parentElement;
                    if (container) container.style.display = "none";
                  }}
                />
              </div>
            )}
            <CardContent className={question.image ? "p-3 md:p-4" : "p-4 md:p-6"}>
              <h2 className={`font-black leading-snug text-foreground text-center ${question.image ? "text-sm md:text-base" : "text-xl md:text-2xl"}`}>
                {question.text}
              </h2>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── ANSWERS ── */}
      <div className="flex-1 px-4 py-3 z-10 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 h-full max-w-3xl mx-auto">
          {question.options.map((opt, i) => {
            let btnClass = "bg-card hover:bg-card/80 border-border text-foreground";
            let anim = {};

            if (correctIndex !== null) {
              if (i === correctIndex) {
                btnClass = "bg-green-500/20 border-green-500 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]";
                anim = { scale: [1, 1.05, 1] };
              } else if (i === selectedAnswer) {
                btnClass = "bg-destructive/20 border-destructive text-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)]";
                anim = { x: [-5, 5, -5, 5, 0] };
              } else {
                btnClass = "opacity-40 bg-card border-border";
              }
            } else if (selectedAnswer === i) {
              btnClass = "bg-primary/20 border-primary text-primary";
            }

            return (
              <motion.div key={i} animate={anim} transition={{ duration: 0.3 }} className="h-full">
                <Button
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null || timeLeft <= 0 || correctIndex !== null}
                  className={`w-full h-full min-h-[70px] p-3 text-base md:text-lg font-bold whitespace-normal rounded-xl border-2 transition-all leading-snug ${btnClass}`}
                >
                  {opt}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── RESULT OVERLAY — shown between questions ── */}
      <AnimatePresence>
        {correctIndex !== null && (
          <motion.div
            key="result-overlay"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur-lg overflow-y-auto"
          >
            {/* Image section */}
            {question.image && (
              <div
                className="w-full shrink-0 bg-black/50 flex items-center justify-center overflow-hidden"
                style={{ maxHeight: 240 }}
              >
                <img
                  src={question.image}
                  alt="صورة السؤال"
                  className="w-full object-contain"
                  style={{ maxHeight: 240 }}
                  onError={(e) => {
                    const container = (e.target as HTMLImageElement).parentElement;
                    if (container) container.style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div className="flex flex-col items-center px-5 py-4 gap-4 max-w-lg mx-auto w-full">

              {/* Result badge */}
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", damping: 14 }}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl font-black text-lg border-2 ${
                  yourDelta !== null && yourDelta > 0
                    ? "bg-green-500/15 border-green-500/60 text-green-500"
                    : "bg-destructive/15 border-destructive/50 text-destructive"
                }`}
              >
                <span className="text-3xl">
                  {yourDelta !== null && yourDelta > 0 ? "✅" : "❌"}
                </span>
                <span>
                  {yourDelta !== null && yourDelta > 0
                    ? `أحسنت! +${yourDelta} نقطة`
                    : "خانك الحظ!"}
                </span>
              </motion.div>

              {/* Correct answer */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="w-full text-center"
              >
                <p className="text-xs text-muted-foreground mb-1 font-medium">الإجابة الصحيحة</p>
                <div className="bg-green-500/15 border-2 border-green-500/50 rounded-xl px-4 py-2.5">
                  <p className="text-base md:text-lg font-black text-green-400">
                    {question.options[correctIndex]}
                  </p>
                </div>
              </motion.div>

              {/* Explanation */}
              {explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.26 }}
                  className="w-full"
                >
                  <Card className="bg-primary/10 border-primary/30">
                    <CardContent className="p-3 md:p-4 text-center">
                      <p className="text-sm md:text-base font-bold text-primary leading-relaxed">{explanation}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Live scores */}
              {scores.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="w-full"
                >
                  <p className="text-xs text-muted-foreground text-center mb-2 font-medium">النتائج الآن</p>
                  <div className="flex flex-col gap-1.5">
                    {scores.map((s, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                          s.name === playerName
                            ? "bg-primary/10 border-primary/40"
                            : "bg-card/60 border-border/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-muted-foreground w-5 text-center">
                            {i + 1}
                          </span>
                          <span className={`font-bold text-sm ${s.name === playerName ? "text-primary" : "text-foreground"}`}>
                            {s.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-foreground">{s.score}</span>
                          {s.delta > 0 && (
                            <span className="text-green-500 font-bold text-xs bg-green-500/15 px-1.5 py-0.5 rounded-full">
                              +{s.delta}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <p className="text-xs text-muted-foreground animate-pulse pb-2">السؤال التالي قريباً...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score float */}
      <AnimatePresence>
        {yourDelta !== null && yourDelta > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.5 }}
            animate={{ opacity: 1, y: -40, scale: 1.4 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 pointer-events-none text-3xl font-black text-green-500 drop-shadow-md z-50"
          >
            +{yourDelta} نقطة!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target Picker Overlay */}
      <AnimatePresence>
        {showTargetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm pb-4"
            onClick={() => setShowTargetPicker(false)}
          >
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-card border border-destructive/50 rounded-2xl p-5 w-full max-w-sm mx-4 shadow-[0_0_40px_rgba(239,68,68,0.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black text-destructive text-center mb-1">💣 اختار ضحيتك</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                ستسرق <span className="text-destructive font-bold">50 نقطة</span> من اللاعب المختار
              </p>
              <div className="flex flex-col gap-2">
                {otherPlayers.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm">ما في لاعبين ثانيين</p>
                ) : (
                  otherPlayers.map((name) => {
                    const playerScore = scores.find((s) => s.name === name);
                    return (
                      <motion.button
                        key={name}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => useSabotage(name)}
                        className="flex items-center justify-between bg-background/60 border border-border hover:border-destructive rounded-xl px-4 py-3 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center text-base font-bold text-destructive">
                            {name.charAt(0)}
                          </div>
                          <span className="font-bold text-base">{name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">نقاطه</div>
                          <div className="font-black text-foreground">{playerScore?.score ?? "—"}</div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3 text-muted-foreground"
                onClick={() => setShowTargetPicker(false)}
              >
                إلغاء
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM BAR ── */}
      <div className="shrink-0 px-4 pb-3 pt-2 border-t border-border z-10">
        <div className="flex items-center justify-between gap-3 max-w-3xl mx-auto">

          {/* All 4 ability buttons in one row */}
          <div className="flex gap-2">
            {/* Confuse */}
            <button
              onClick={() => useAbility('confuse')}
              disabled={abilities.confuse <= 0}
              title="تشويش"
              className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all
                ${abilities.confuse > 0 ? "bg-card border-border hover:border-primary active:scale-95" : "bg-card/40 border-border/40 opacity-40"}`}
            >
              <span className="text-xl">😵</span>
              <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center
                ${abilities.confuse > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {abilities.confuse}
              </span>
            </button>

            {/* Freeze */}
            <button
              onClick={() => useAbility('freeze')}
              disabled={abilities.freeze <= 0}
              title="تجميد"
              className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all
                ${abilities.freeze > 0 ? "bg-card border-border hover:border-primary active:scale-95" : "bg-card/40 border-border/40 opacity-40"}`}
            >
              <span className="text-xl">❄️</span>
              <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center
                ${abilities.freeze > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {abilities.freeze}
              </span>
            </button>

            {/* Reverse */}
            <button
              onClick={() => useAbility('reverse')}
              disabled={abilities.reverse <= 0}
              title="انعكاس"
              className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all
                ${abilities.reverse > 0 ? "bg-card border-border hover:border-primary active:scale-95" : "bg-card/40 border-border/40 opacity-40"}`}
            >
              <span className="text-xl">🔄</span>
              <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center
                ${abilities.reverse > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {abilities.reverse}
              </span>
            </button>

            {/* Sabotage — requires correct answer to unlock */}
            <div className="relative flex flex-col items-center">
              <button
                onClick={() => abilities.sabotage > 0 && setShowTargetPicker(true)}
                disabled={abilities.sabotage <= 0}
                title={abilities.sabotage > 0 ? "تخريب — اسرق 50 نقطة" : "أجب صح لتفعيل التخريب"}
                className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all
                  ${abilities.sabotage > 0
                    ? "bg-destructive/10 border-destructive/60 hover:bg-destructive/20 active:scale-95 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
                    : "bg-card/30 border-border/30 cursor-not-allowed"}`}
              >
                {abilities.sabotage > 0 ? (
                  <span className="text-xl">💣</span>
                ) : (
                  <span className="text-lg">🔒</span>
                )}
                {abilities.sabotage > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center bg-destructive text-white">
                    {abilities.sabotage}
                  </span>
                )}
              </button>
              {abilities.sabotage <= 0 && (
                <span className="text-[9px] text-muted-foreground/60 text-center leading-tight mt-0.5 w-12">أجب صح</span>
              )}
            </div>
          </div>

          {/* Live scores (top 3) */}
          <div className="flex flex-col gap-1 min-w-0">
            {scores.slice(0, 3).map((score, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold truncate max-w-[70px] text-foreground">{score.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{score.score}</span>
                  {score.delta > 0 && <span className="text-green-500 font-bold">+{score.delta}</span>}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}