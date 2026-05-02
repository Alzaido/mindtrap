import { useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function Results() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [playerName] = useLocalStorage("mindtrap_playerName", "");

  const { data: leaderboard, isLoading } = useGetLeaderboard(roomCode || "", {
    query: { enabled: !!roomCode }
  });

  const handlePlayAgain = () => {
    setLocation("/");
  };

  const handleShare = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({ title: "تم النسخ! دزها لربعك 🚀" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-2xl font-bold text-primary animate-pulse">نحسب النتايج... 🧮</div>
      </div>
    );
  }

  if (!leaderboard) return null;

  const top3 = leaderboard.entries.slice(0, 3);
  const rest = leaderboard.entries.slice(3);

  // Podium heights based on rank
  const getPodiumHeight = (rank: number) => {
    if (rank === 1) return "h-48 md:h-64";
    if (rank === 2) return "h-36 md:h-48";
    return "h-28 md:h-36";
  };

  const getPodiumColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-500 border-yellow-400";
    if (rank === 2) return "bg-gray-400 border-gray-300";
    return "bg-amber-700 border-amber-600";
  };

  // Reorder top 3 for podium display (2nd, 1st, 3rd)
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push(top3[1]);
  if (top3[0]) podiumOrder.push(top3[0]);
  if (top3[2]) podiumOrder.push(top3[2]);

  return (
    <div className="min-h-[100dvh] w-full p-4 flex flex-col items-center bg-background relative overflow-hidden overflow-y-auto">
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-2xl w-full z-10 flex flex-col items-center gap-8 pt-8 pb-20">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-2">
            النهاية! 🏁
          </h1>
          <p className="text-xl text-primary font-bold">شوف منو أقوى مخ...</p>
        </motion.div>

        {/* Podium */}
        <div className="flex justify-center items-end gap-2 w-full mt-10 h-72 md:h-80">
          {podiumOrder.map((entry, index) => {
            const isFirst = entry.rank === 1;
            return (
              <motion.div 
                key={entry.name}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 * (3 - entry.rank), type: "spring", bounce: 0.5 }}
                className="flex flex-col items-center flex-1 max-w-[120px]"
              >
                <div className="text-center mb-2 w-full">
                  <div className="text-4xl mb-1">{isFirst ? "👑" : ""}</div>
                  <div className="font-bold text-sm md:text-lg truncate px-1 w-full">
                    {entry.name}
                  </div>
                  <div className="font-black text-primary">{entry.score}</div>
                </div>
                <div className={`w-full rounded-t-xl border-t-4 border-l border-r flex justify-center pt-4 ${getPodiumColor(entry.rank)} ${getPodiumHeight(entry.rank)} shadow-lg relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                  <span className="text-4xl font-black text-black/40 relative z-10">{entry.rank}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full mt-6">
          <Button size="lg" onClick={handlePlayAgain} className="flex-1 text-lg font-bold h-14 rounded-xl shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
            العب مرة ثانية 🎮
          </Button>
          <Button size="lg" variant="secondary" onClick={handleShare} className="h-14 px-8 rounded-xl font-bold">
            شارك الكود 📋
          </Button>
        </div>

        {/* Leaderboard List */}
        <div className="w-full space-y-3 mt-4">
          <h2 className="text-xl font-bold text-muted-foreground mb-4">الترتيب الكامل:</h2>
          
          <AnimatePresence>
            {leaderboard.entries.map((entry, i) => (
              <motion.div
                key={entry.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + (i * 0.1) }}
              >
                <Link href={`/stats/${roomCode}/${encodeURIComponent(entry.name)}`}>
                  <Card className={`border-border hover:border-primary/50 transition-colors cursor-pointer ${entry.name === playerName ? 'bg-primary/10 border-primary' : 'bg-card/50'}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold
                          ${entry.rank === 1 ? 'bg-yellow-500 text-black' : 
                            entry.rank === 2 ? 'bg-gray-400 text-black' : 
                            entry.rank === 3 ? 'bg-amber-700 text-white' : 
                            'bg-muted text-muted-foreground'}`}
                        >
                          {entry.rank}
                        </div>
                        <div>
                          <p className="font-bold text-lg">{entry.name} {entry.name === playerName && "(أنت)"}</p>
                          <p className="text-xs text-muted-foreground">
                            إجابات صحيحة: {entry.correctAnswers}/{entry.totalAnswers}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-xl text-primary">{entry.score}</div>
                        <div className="text-xs text-muted-foreground opacity-70">
                          نقطة
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}