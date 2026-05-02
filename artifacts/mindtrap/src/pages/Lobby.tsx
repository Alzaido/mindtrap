import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetRoom } from "@workspace/api-client-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type RoomData = {
  id: string;
  code: string;
  hostName: string;
  players: { name: string; score: number; isHost: boolean; abilities: { confuse: number; freeze: number; reverse: number } }[];
  status: string;
  maxPlayers: number;
  questionCount: number;
  currentQuestion: number;
};

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [, setLocation] = useLocation();
  const [playerName] = useLocalStorage("mindtrap_playerName", "");
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  
  const [room, setRoom] = useState<RoomData | null>(null);

  const { data: initialRoom, isLoading, error } = useGetRoom(roomCode || "", {
    query: {
      enabled: !!roomCode,
      retry: false
    }
  });

  useEffect(() => {
    if (error) {
      toast({ title: "الغرفة مو موجودة!", variant: "destructive" });
      setLocation("/");
    }
  }, [error, setLocation, toast]);

  useEffect(() => {
    if (initialRoom && !room) {
      setRoom(initialRoom);
    }
  }, [initialRoom, room]);

  useEffect(() => {
    if (!socket || !isConnected || !roomCode || !playerName) return;

    socket.emit("join-room", { roomCode, playerName });

    socket.on("room-updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on("game-started", () => {
      setLocation(`/game/${roomCode}`);
    });

    socket.on("room-reset", (resetRoomData: Room) => {
      setRoom(resetRoomData);
    });

    return () => {
      socket.off("room-updated");
      socket.off("game-started");
      socket.off("room-reset");
    };
  }, [socket, isConnected, roomCode, playerName, setLocation]);

  const handleStartGame = () => {
    if (socket && roomCode) {
      socket.emit("start-game", { roomCode });
    }
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({ title: "تم نسخ الكود! 📋" });
    }
  };

  if (isLoading || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isHost = room.hostName === playerName;
  const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col p-4 bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-2xl w-full mx-auto z-10 flex flex-col h-full gap-6 pt-8">
        
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-muted-foreground">كود الغرفة</h2>
          <div 
            onClick={handleCopyCode}
            className="inline-flex items-center justify-center gap-4 bg-card border-2 border-border px-8 py-4 rounded-2xl cursor-pointer hover:border-primary transition-colors group"
          >
            <span className="text-5xl font-mono tracking-[0.2em] font-black text-primary">
              {roomCode}
            </span>
            <span className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity">📋</span>
          </div>
          <p className="text-sm text-muted-foreground">اضغط للنسخ وشارك ربعك</p>
        </div>

        <Card className="bg-card/50 backdrop-blur-xl border-border mt-8 flex-1">
          <CardContent className="p-6 flex flex-col h-full gap-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">اللاعبين ({room.players.length}/{room.maxPlayers})</h3>
              {room.players.length < 2 && (
                <span className="text-sm text-destructive animate-pulse">ننطر الباجي...</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-max">
              <AnimatePresence>
                {room.players.map((player, i) => (
                  <motion.div
                    key={player.name}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring" }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background/50 border border-border"
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ${colors[i % colors.length]}`}>
                      {player.name.charAt(0)}
                    </div>
                    <span className="font-bold text-lg truncate w-full text-center">
                      {player.name}
                      {player.isHost && " 👑"}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="mt-auto pt-8">
              {isHost ? (
                <Button 
                  size="lg" 
                  onClick={handleStartGame}
                  disabled={room.players.length < 2}
                  className="w-full h-16 text-xl font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                >
                  {room.players.length < 2 ? "انطر عالأقل لاعبين" : "بلّش اللعب 🔥"}
                </Button>
              ) : (
                <div className="w-full h-16 rounded-xl border-2 border-dashed border-muted flex items-center justify-center text-muted-foreground font-bold text-lg">
                  ننطر الهوست يبلش... ☕
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}