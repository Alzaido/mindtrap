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

  const [abilities, setAbilities] = useState({ confuse: 1, freeze: 1, reverse: 1, sabotage: 1 });
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

    socket.on("game-finished", () => {
      setLocation(`/results/${roomCode}`);
    });

    return () => {
      socket.off("next-question");
      socket.off("question-result");
      socket.off("ability-effect");
      socket.off("sabotage-effect");
      socket.off("score-update");
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
    <div className="min-h-[100dvh] w-full flex flex-col p-4 bg-background relative overflow-hidden">
      <AnimatePresence>
        {activeEffect && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none"
          >
            <h1 className="text-5xl md:text-7xl font-black text-destructive drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">
              {activeEffect.message}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-6 z-10">
        <div className="bg-card px-4 py-2 rounded-xl border border-border shadow-sm">
          <span className="font-bold text-muted-foreground text-sm">سؤال</span>
          <div className="text-2xl font-black text-primary">{questionNumber} / {totalQuestions}</div>
        </div>

        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="36" className="stroke-muted fill-none" strokeWidth="8" />
            <circle 
              cx="40" cy="40" r="36" 
              className={`fill-none transition-all duration-100 ${timeColor} stroke-current`} 
              strokeWidth="8" 
              strokeDasharray="226" 
              strokeDashoffset={226 - (226 * timePercentage) / 100}
              strokeLinecap="round"
            />
          </svg>
          <span className={`text-2xl font-black ${timeColor}`}>{Math.ceil(timeLeft)}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10 gap-8 max-w-3xl w-full mx-auto">
        <motion.div 
          key={question.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center"
        >
          <Card className="bg-card/80 backdrop-blur-md border-border shadow-xl">
            <CardContent className="p-8">
              <h2 className="text-3xl md:text-4xl font-black leading-tight text-foreground">
                {question.text}
              </h2>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
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
                btnClass = "opacity-50 bg-card border-border";
              }
            } else if (selectedAnswer === i) {
              btnClass = "bg-primary/20 border-primary text-primary";
            }

            return (
              <motion.div key={i} animate={anim} transition={{ duration: 0.3 }}>
                <Button
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null || timeLeft <= 0 || correctIndex !== null}
                  className={`w-full min-h-[80px] h-auto p-4 text-xl md:text-2xl font-bold whitespace-normal rounded-xl border-2 transition-all ${btnClass}`}
                >
                  {opt}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {explanation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mt-4"
            >
              <Card className="bg-primary/10 border-primary/30">
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold text-primary">{explanation}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {yourDelta !== null && yourDelta > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.5 }}
              animate={{ opacity: 1, y: -50, scale: 1.5 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none text-4xl font-black text-green-500 drop-shadow-md z-50"
            >
              +{yourDelta} نقطة!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Target Picker Overlay */}
      <AnimatePresence>
        {showTargetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm pb-8"
            onClick={() => setShowTargetPicker(false)}
          >
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-card border border-destructive/50 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-[0_0_40px_rgba(239,68,68,0.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-black text-destructive text-center mb-2">💣 اختار ضحيتك</h3>
              <p className="text-sm text-muted-foreground text-center mb-5">
                ستسرق <span className="text-destructive font-bold">50 نقطة</span> من اللاعب المختار
              </p>
              <div className="flex flex-col gap-3">
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
                        className="flex items-center justify-between bg-background/60 border border-border hover:border-destructive rounded-xl px-5 py-4 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center text-lg font-bold text-destructive">
                            {name.charAt(0)}
                          </div>
                          <span className="font-bold text-lg">{name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">نقاطه</div>
                          <div className="font-black text-foreground">{playerScore?.score ?? "—"}</div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-4 text-muted-foreground"
                onClick={() => setShowTargetPicker(false)}
              >
                إلغاء
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 pt-4 border-t border-border z-10">
        <div className="flex justify-between items-end gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="icon" 
              className="w-14 h-14 rounded-full bg-card relative"
              onClick={() => useAbility('confuse')}
              disabled={abilities.confuse <= 0}
              title="تشويش"
            >
              <span className="text-2xl">😵</span>
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center">
                {abilities.confuse}
              </span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-14 h-14 rounded-full bg-card relative"
              onClick={() => useAbility('freeze')}
              disabled={abilities.freeze <= 0}
              title="تجميد"
            >
              <span className="text-2xl">❄️</span>
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center">
                {abilities.freeze}
              </span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-14 h-14 rounded-full bg-card relative"
              onClick={() => useAbility('reverse')}
              disabled={abilities.reverse <= 0}
              title="انعكاس"
            >
              <span className="text-2xl">🔄</span>
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center">
                {abilities.reverse}
              </span>
            </Button>
            {/* Sabotage — targeted ability */}
            <Button 
              variant="outline" 
              size="icon" 
              className={`w-14 h-14 rounded-full relative transition-all ${
                abilities.sabotage > 0
                  ? "bg-destructive/10 border-destructive/50 hover:bg-destructive/20 hover:border-destructive shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  : "bg-card opacity-40"
              }`}
              onClick={() => abilities.sabotage > 0 && setShowTargetPicker(true)}
              disabled={abilities.sabotage <= 0}
              title="تخريب"
            >
              <span className="text-2xl">💣</span>
              <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                abilities.sabotage > 0 ? "bg-destructive text-white" : "bg-muted text-muted-foreground"
              }`}>
                {abilities.sabotage}
              </span>
            </Button>
          </div>

          <div className="flex flex-col gap-2 w-1/2 max-w-xs">
            {scores.slice(0, 3).map((score, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="font-bold truncate max-w-[80px]">{score.name}</span>
                <div className="flex items-center gap-2">
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