import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateRoom, useListPublicRooms } from "@workspace/api-client-react";
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

type Tab = "join" | "create" | "browse";

export default function Home() {
  const [, setLocation] = useLocation();
  const [playerName, setPlayerName] = useLocalStorage("mindtrap_playerName", "");
  const [activeTab, setActiveTab] = useState<Tab>("join");
  const [showTutorial, setShowTutorial] = useState(false);

  // Join form
  const [roomCode, setRoomCode] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);

  // Create form
  const [roomName, setRoomName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [createPin, setCreatePin] = useState("");

  const { toast } = useToast();
  const createRoomMutation = useCreateRoom();

  const { data: publicRoomsData, refetch: refetchRooms } = useListPublicRooms({
    query: { enabled: activeTab === "browse", refetchInterval: 5000 },
  });
  const publicRooms = publicRoomsData?.rooms ?? [];

  // Auto-refetch when switching to browse tab
  useEffect(() => {
    if (activeTab === "browse") refetchRooms();
  }, [activeTab, refetchRooms]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      toast({ title: "اكتب اسمك أول شي!", variant: "destructive" });
      return;
    }
    if (!isPublic && createPin && !/^\d{4}$/.test(createPin)) {
      toast({ title: "الرقم السري يجب أن يكون 4 أرقام!", variant: "destructive" });
      return;
    }
    createRoomMutation.mutate(
      {
        data: {
          hostName: playerName.trim(),
          roomName: roomName.trim() || undefined,
          isPublic,
          pin: !isPublic && createPin ? createPin : undefined,
        },
      },
      {
        onSuccess: (room) => setLocation(`/lobby/${room.code}`),
        onError: () => toast({ title: "صار خطأ، جرب مرة ثانية", variant: "destructive" }),
      }
    );
  };

  const handleJoinRoom = (code?: string, isPrivate?: boolean) => {
    const targetCode = (code ?? roomCode).trim().toUpperCase();
    if (!playerName.trim()) {
      toast({ title: "اكتب اسمك أول شي!", variant: "destructive" });
      return;
    }
    if (!targetCode) {
      toast({ title: "اكتب كود الغرفة!", variant: "destructive" });
      return;
    }
    // If room is private and PIN not entered yet, show PIN prompt
    if (isPrivate && !joinPin) {
      setRoomCode(targetCode);
      setNeedsPin(true);
      setActiveTab("join");
      return;
    }
    setLocation(`/lobby/${targetCode}${joinPin ? `?pin=${joinPin}` : ""}`);
  };

  const statusLabel = (s: string) =>
    s === "waiting" ? { text: "تنطر", color: "text-green-400" }
    : s === "playing" ? { text: "تلعب", color: "text-yellow-400" }
    : { text: "انتهت", color: "text-muted-foreground" };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center p-4 bg-background overflow-y-auto relative">
      {/* Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-secondary/20 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="w-full max-w-md z-10 py-6 flex flex-col gap-4"
      >
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/mindtrap-logo.png"
            alt="MindTrap"
            className="w-48 h-48 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]"
          />
        </div>

        {/* Name input */}
        <div className="space-y-1">
          <label className="text-sm font-bold text-foreground/80 block text-right">شنو اسمك؟</label>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="عبود .. حمود"
            className="h-14 text-lg bg-card/60 border-primary/30 focus-visible:ring-primary rounded-xl"
            maxLength={15}
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border overflow-hidden bg-card/40">
          {([
            { id: "join", label: "ادخل غرفة" },
            { id: "create", label: "أنشئ غرفة" },
            { id: "browse", label: "تصفح الغرف" },
          ] as { id: Tab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setNeedsPin(false); setJoinPin(""); }}
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── JOIN TAB ── */}
          {activeTab === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3"
            >
              <div className="flex gap-2">
                <Input
                  value={roomCode}
                  onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setNeedsPin(false); setJoinPin(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                  placeholder="كود الغرفة — مثال: 4821"
                  className="h-14 text-center text-xl font-mono tracking-widest bg-card/60 border-border rounded-xl"
                  maxLength={4}
                />
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => handleJoinRoom()}
                  className="h-14 px-6 text-lg font-bold rounded-xl"
                >
                  ادخل
                </Button>
              </div>
              {needsPin && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex gap-2">
                  <Input
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom(roomCode)}
                    placeholder="الرقم السري (4 أرقام)"
                    className="h-12 text-center text-xl font-mono tracking-widest bg-card/60 border-yellow-500/50 rounded-xl"
                    maxLength={4}
                    autoFocus
                  />
                  <Button
                    size="lg"
                    onClick={() => handleJoinRoom(roomCode)}
                    className="h-12 px-6 font-bold rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black"
                  >
                    تأكيد 🔓
                  </Button>
                </motion.div>
              )}
              {needsPin && (
                <p className="text-center text-sm text-yellow-400 font-bold">🔒 هذي الغرفة خاصة — اكتب الرقم السري</p>
              )}
            </motion.div>
          )}

          {/* ── CREATE TAB ── */}
          {activeTab === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3"
            >
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="اسم الغرفة (اختياري)"
                className="h-12 text-base bg-card/60 border-border rounded-xl"
                maxLength={30}
              />

              {/* Public / Private toggle */}
              <div className="flex rounded-xl border border-border overflow-hidden bg-card/20">
                <button
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    isPublic ? "bg-primary/20 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🌍 عامة
                </button>
                <button
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    !isPublic ? "bg-yellow-500/10 text-yellow-400 border-b-2 border-yellow-500" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🔒 خاصة
                </button>
              </div>

              <AnimatePresence>
                {!isPublic && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <Input
                      value={createPin}
                      onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="الرقم السري — 4 أرقام"
                      className="h-12 text-center text-xl font-mono tracking-widest bg-card/60 border-yellow-500/50 rounded-xl"
                      maxLength={4}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-xs text-muted-foreground text-center">
                {isPublic ? "الغرفة ستظهر للجميع في قائمة الغرف العامة" : "الغرفة خاصة — لا تظهر في القائمة ولا يدخلها أحد بدون رقم سري"}
              </p>

              <Button
                size="lg"
                onClick={handleCreateRoom}
                disabled={createRoomMutation.isPending}
                className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
              >
                {createRoomMutation.isPending ? "جاري الإنشاء..." : "أنشئ الغرفة 🚀"}
              </Button>
            </motion.div>
          )}

          {/* ── BROWSE TAB ── */}
          {activeTab === "browse" && (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{publicRooms.length} غرفة متاحة</span>
                <button onClick={() => refetchRooms()} className="text-xs text-primary font-bold hover:text-primary/80 transition-colors">
                  🔄 تحديث
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-3">🏜️</div>
                  <p className="font-bold">ما في غرف مفتوحة الحين</p>
                  <p className="text-sm mt-1">أنشئ غرفة وشارك ربعك!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  <AnimatePresence>
                    {publicRooms.map((room) => {
                      const sl = statusLabel(room.status);
                      return (
                        <motion.div
                          key={room.code}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-3 p-3 bg-card/60 border border-border rounded-xl hover:border-primary/40 transition-all"
                        >
                          <div className="flex-1 min-w-0 text-right">
                            <div className="font-bold text-sm truncate">
                              {room.roomName || `غرفة ${room.hostName}`}
                              {room.isPrivate && <span className="mr-1 text-yellow-400 text-xs">🔒</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {room.hostName} · <span className={sl.color}>{sl.text}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono bg-background/50 border border-border px-2 py-1 rounded-lg text-muted-foreground">
                              {room.playerCount}/{room.maxPlayers} 👥
                            </span>
                            <Button
                              size="sm"
                              variant={room.status === "waiting" ? "default" : "secondary"}
                              disabled={room.status !== "waiting" || room.playerCount >= room.maxPlayers}
                              onClick={() => handleJoinRoom(room.code, room.isPrivate)}
                              className="h-8 px-3 text-xs font-bold rounded-lg"
                            >
                              {room.status === "waiting" && room.playerCount < room.maxPlayers
                                ? "ادخل"
                                : room.playerCount >= room.maxPlayers
                                ? "ممتلئة"
                                : "جارية"}
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tutorial toggle */}
        <button
          onClick={() => setShowTutorial((v) => !v)}
          className="text-sm text-primary/80 hover:text-primary font-bold flex items-center justify-center gap-2 transition-colors py-2"
        >
          {showTutorial ? "▲ إخفاء شرح اللعبة" : "▼ كيف تلعب MindTrap؟"}
        </button>

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
              <Card className="border-primary/20 bg-card/40 backdrop-blur-xl text-right">
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
                    <p className="text-sm text-muted-foreground mt-1">الأسئلة مصممة تخدعك — فكر مرتين قبل ما تجاوب!</p>
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
