import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/contexts/SocketContext";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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

  const [abilities, setAbilities] = useState({ confuse: 1, freeze: 1, reverse: 1 });
  const [activeEffect, setActiveEffect] = useState<{ type: string, message: string } | null>(null);

  useEffect(() => {
    if (!socket || !isConnected || !roomCode) {
      if (!socket && !isConnected) {
        setLocation("/");
      }
      return;
    }

    socket.on("next-question", (data: { question: Question, questionNumber: number, totalQuestions: number }) => {
      setupNewQuestion(data);
    });

    socket.on("question-result", (data: { correctIndex: number, explanation: string, scores: ScoreUpdate[] }) => {
      setCorrectIndex(data.correctIndex);
      setExplanation(data.explanation);
      setScores(data.scores);
      // Compute yourDelta from the scores list
      const myScore = data.scores.find((s) => s.name === playerName);
      setYourDelta(myScore ? myScore.delta : 0);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("ability-effect", (data: { ability: string, fromPlayer: string, toPlayer: string }) => {
      let message = "";
      if (data.ability === "confuse") message = `😵 ${data.fromPlayer} شوشك!`;
      if (data.ability === "freeze") message = `❄️ ${data.fromPlayer} جمدك!`;
      if (data.ability === "reverse") message = `🔄 ${data.fromPlayer} عكسك!`;
      
      setActiveEffect({ type: data.ability, message });
      setTimeout(() => setActiveEffect(null), 3000);
    });

    socket.on("game-finished", () => {
      setLocation(`/results/${roomCode}`);
    });

    return () => {
      socket.off("next-question");
      socket.off("question-result");
      socket.off("ability-effect");
      socket.off("game-finished");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, isConnected, roomCode, setLocation]);

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
    
    // In a real app we'd pick a target, here we just emit and server picks randomly or handles it
    socket.emit("use-ability", {
      roomCode,
      playerName,
      ability,
      targetName: "random" 
    });
    
    toast({ title: `استخدمت قدرة ${ability === 'confuse' ? 'التشويش 😵' : ability === 'freeze' ? 'التجميد ❄️' : 'الانعكاس 🔄'}` });
  };

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

      <div className="mt-8 pt-4 border-t border-border z-10">
        <div className="flex justify-between items-end gap-4">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="w-14 h-14 rounded-full bg-card relative group"
              onClick={() => useAbility('confuse')}
              disabled={abilities.confuse <= 0}
            >
              <span className="text-2xl">😵</span>
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center">
                {abilities.confuse}
              </span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-14 h-14 rounded-full bg-card relative group"
              onClick={() => useAbility('freeze')}
              disabled={abilities.freeze <= 0}
            >
              <span className="text-2xl">❄️</span>
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center">
                {abilities.freeze}
              </span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-14 h-14 rounded-full bg-card relative group"
              onClick={() => useAbility('reverse')}
              disabled={abilities.reverse <= 0}
            >
              <span className="text-2xl">🔄</span>
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center">
                {abilities.reverse}
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