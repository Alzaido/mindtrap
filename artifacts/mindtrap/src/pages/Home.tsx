import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateRoom } from "@workspace/api-client-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const HOW_TO_STEPS = [
  { icon: "👤", title: "اكتب اسمك", desc: "اختار اسم يعرفك فيه ربعك" },
  { icon: "🚀", title: "أنشئ أو ادخل غرفة", desc: "الهوست ينشئ الغرفة ويشارك الكود، وبقية اللاعبين يدخلون الكود" },
  { icon: "🧠", title: "أجب بسرعة", desc: "أسئلة خادعة — كل ما جاوبت أسرع حصلت على نقاط أكثر. في أسئلة صور وألغاز وخدع بصرية!" },
  { icon: "😵", title: "قدرات التشويش", desc: "تشويش 😵 تجميد ❄️ انعكاس 🔄 — تُرسل لخصم عشوائي. كل واحدة تستخدمها مرة واحدة" },
  { icon: "🔒", title: "التخريب 💣 — مقفول في البداية!", desc: "التخريب مقفول من البداية. أجب على أي سؤال صح ✅ لتفتح قدرة التخريب وتسرق 50 نقطة من خصمك. إذا أجبت غلط ❌ تفقد التخريب فوراً — حافظ عليه!" },
  { icon: "⚡", title: "النقاط", desc: "إجابة صحيحة: 50-100 نقطة حسب السرعة. الأول يجاوب صح يكسب بونص +25 نقطة إضافية" },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [playerName, setPlayerName] = useLocalStorage("mindtrap_playerName", "");
  const [roomCode, setRoomCode] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const { toast } = useToast();

  const createRoomMutation = useCreateRoom();

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      toast({ title: "اكتب اسمك أول شي!", variant: "destructive" });
      return;
    }
    createRoomMutation.mutate(
      { data: { hostName: playerName.trim() } },
      {
        onSuccess: (room) => {
          setLocation(`/lobby/${room.code}`);
        },
        onError: () => {
          toast({ title: "صار خطأ، جرب مرة ثانية", variant: "destructive" });
        }
      }
    );
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      toast({ title: "اكتب اسمك أول شي!", variant: "destructive" });
      return;
    }
    if (!roomCode.trim()) {
      toast({ title: "اكتب كود الغرفة!", variant: "destructive" });
      return;
    }
    setLocation(`/lobby/${roomCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-background overflow-hidden relative overflow-y-auto">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-secondary/20 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="text-center z-10 w-full max-w-md py-8"
      >
        <div className="flex justify-center mb-4">
          <img 
            src="/mindtrap-logo.png" 
            alt="MindTrap" 
            className="w-56 h-56 md:w-64 md:h-64 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]"
          />
        </div>

        <Card className="border-none bg-card/50 backdrop-blur-xl shadow-2xl relative">
          <CardContent className="p-6 md:p-8 flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground/80 block text-right">شنو اسمك؟</label>
              <Input 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                placeholder="عبود .. حمود"
                className="h-14 text-lg bg-background/50 border-primary/30 focus-visible:ring-primary rounded-xl"
                maxLength={15}
              />
            </div>

            <Button 
              size="lg" 
              onClick={handleCreateRoom}
              disabled={createRoomMutation.isPending}
              className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
            >
              {createRoomMutation.isPending ? "جاري إنشاء الغرفة..." : "أنشئ غرفة جديدة 🚀"}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card/50 px-2 text-muted-foreground font-bold">أو ادخل غرفة موجودة</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Input 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                placeholder="مثال: 4821"
                className="h-14 text-center text-xl font-mono tracking-widest bg-background/50 border-border rounded-xl"
                maxLength={4}
              />
              <Button 
                size="lg" 
                variant="secondary"
                onClick={handleJoinRoom}
                className="h-14 px-8 text-lg font-bold rounded-xl"
              >
                ادخل
              </Button>
            </div>

            {/* Tutorial toggle */}
            <button
              onClick={() => setShowTutorial(v => !v)}
              className="text-sm text-primary/80 hover:text-primary font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {showTutorial ? "▲ إخفاء شرح اللعبة" : "▼ كيف تلعب MindTrap؟"}
            </button>
          </CardContent>
        </Card>

        {/* Tutorial Panel */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <Card className="mt-4 border-primary/20 bg-card/40 backdrop-blur-xl text-right">
                <CardContent className="p-6 flex flex-col gap-5">
                  <div className="text-center mb-2">
                    <h2 className="text-2xl font-black text-primary">دليل اللعبة 🧠</h2>
                    <p className="text-sm text-muted-foreground mt-1">مو الذكاء… الهدف إنك ما تنخدع</p>
                  </div>

                  {HOW_TO_STEPS.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-4 p-4 bg-background/40 rounded-xl border border-border"
                    >
                      <div className="text-3xl shrink-0">{step.icon}</div>
                      <div className="flex-1">
                        <div className="font-black text-foreground text-base">{step.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{step.desc}</div>
                      </div>
                    </motion.div>
                  ))}

                  <div className="mt-2 p-4 bg-primary/10 border border-primary/30 rounded-xl text-center">
                    <p className="text-sm font-bold text-primary">⚡ نصيحة</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      الأسئلة مصممة تخدعك — فكر مرتين قبل ما تجاوب!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
