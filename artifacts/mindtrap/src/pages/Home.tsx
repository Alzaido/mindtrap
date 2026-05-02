import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useCreateRoom } from "@workspace/api-client-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const [playerName, setPlayerName] = useLocalStorage("mindtrap_playerName", "");
  const [roomCode, setRoomCode] = useState("");
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
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-background overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-secondary/20 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="text-center z-10 w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <img 
            src="/mindtrap-logo.png" 
            alt="MindTrap" 
            className="w-64 h-64 md:w-72 md:h-72 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]"
          />
        </div>

        <Card className="border-none bg-card/50 backdrop-blur-xl shadow-2xl relative">
          <CardContent className="p-6 md:p-8 flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground/80 block text-right">شنو اسمك؟</label>
              <Input 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="مثال: عبود، فويصل..."
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
                placeholder="كود الغرفة"
                className="h-14 text-center text-xl font-mono tracking-widest bg-background/50 border-border rounded-xl"
                maxLength={6}
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}