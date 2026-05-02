import { useLocation, useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { useGetPlayerStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
const PROFILE_LABELS: Record<string, string> = {
  fast_reckless: "سريع ومتهور 😅",
  slow_precise: "بطيء ودقيق 🧠",
  hard_to_trick: "صعب ينخدع 🔥",
  easy_to_trick: "ينخدع بسهولة 😂",
};

const PROFILE_MESSAGES: Record<string, string> = {
  fast_reckless: "طاير وتجاوب بسرعة، بس مرات تنصاد بأشياء تافهة! ركز شوي المرة الياية.",
  slow_precise: "تأخذ وقتك وتفكر عدل، نادراً ما يطوف عليك شي خادع.",
  hard_to_trick: "مخك نظيف وما يطوف عليك العيار! محترف.",
  easy_to_trick: "تتسرع وتنصاد بسرعة! ركز ولا تخلي الأسئلة تفر مخك.",
};

export default function Stats() {
  const { roomCode, playerName } = useParams<{ roomCode: string; playerName: string }>();
  const [, setLocation] = useLocation();

  const decodedName = decodeURIComponent(playerName || "");

  const { data: stats, isLoading } = useGetPlayerStats(roomCode || "", decodedName, {
    query: { enabled: !!roomCode && !!decodedName }
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-2xl font-bold text-primary animate-pulse">نحلل مخك... 🧠</div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-[100dvh] w-full p-4 flex flex-col items-center bg-background relative overflow-hidden overflow-y-auto">
      <div className="absolute top-[-10%] right-[-20%] w-[80vw] h-[80vw] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-md w-full z-10 flex flex-col items-center gap-6 pt-8 pb-20">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-block px-4 py-1 rounded-full bg-card border border-border text-sm font-bold text-muted-foreground mb-4">
            المركز {stats.rank} من {stats.totalPlayers}
          </div>
          <h1 className="text-4xl font-black text-foreground mb-2">
            {stats.playerName}
          </h1>
          <div className="text-6xl my-4">
            {stats.profileEmoji}
          </div>
          <div className="text-2xl font-bold text-primary mb-2">
            {PROFILE_LABELS[stats.profileType] || stats.profileLabel}
          </div>
          <p className="text-muted-foreground text-sm px-4">
            {PROFILE_MESSAGES[stats.profileType] || "أداء قوي، بس في مجال أحسن!"}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full"
        >
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="text-sm font-bold text-muted-foreground mb-1">النقاط الكلية</div>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  {stats.score}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/50 rounded-xl p-4 text-center border border-border">
                  <div className="text-2xl mb-1">✅</div>
                  <div className="text-2xl font-bold text-green-500">{stats.correctAnswers}</div>
                  <div className="text-xs text-muted-foreground">إجابة صح</div>
                </div>
                <div className="bg-background/50 rounded-xl p-4 text-center border border-border">
                  <div className="text-2xl mb-1">❌</div>
                  <div className="text-2xl font-bold text-destructive">{stats.wrongAnswers}</div>
                  <div className="text-xs text-muted-foreground">إجابة غلط</div>
                </div>
                <div className="bg-background/50 rounded-xl p-4 text-center border border-border">
                  <div className="text-2xl mb-1">⏱️</div>
                  <div className="text-xl font-bold text-foreground">{stats.avgResponseTime.toFixed(1)}s</div>
                  <div className="text-xs text-muted-foreground">متوسط الرد</div>
                </div>
                <div className="bg-background/50 rounded-xl p-4 text-center border border-border">
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="text-xl font-bold text-accent">{stats.abilitiesUsed}</div>
                  <div className="text-xs text-muted-foreground">قدرات استخدمتها</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-3 w-full mt-4"
        >
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => setLocation(`/results/${roomCode}`)}
            className="w-full h-14 text-lg font-bold rounded-xl"
          >
            ارجع للنتايج 📊
          </Button>
          <Button 
            size="lg" 
            onClick={() => setLocation('/')}
            className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
          >
            العب مرة ثانية 🎮
          </Button>
        </motion.div>

      </div>
    </div>
  );
}