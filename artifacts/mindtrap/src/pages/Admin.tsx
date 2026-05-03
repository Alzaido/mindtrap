import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

interface RoomInfo {
  code: string;
  status: "waiting" | "playing" | "finished";
  hostName: string;
  playerCount: number;
  playerNames: string[];
  currentQuestion: number;
  totalQuestions: number;
  createdAt: number;
}

interface GameRecord {
  roomCode: string;
  startedAt: number;
  endedAt?: number;
  playerCount: number;
  playerNames: string[];
  durationMin: number | null;
}

interface StatsResponse {
  live: {
    totalRooms: number;
    waiting: number;
    playing: number;
    finished: number;
    totalOnline: number;
    rooms: RoomInfo[];
  };
  daily: {
    date: string;
    gamesStarted: number;
    gamesCompleted: number;
    uniquePlayersToday: number;
    questionsAnswered: number;
    peakConcurrent: number;
    currentConcurrent: number;
    recentGames: GameRecord[];
  };
  serverTime: string;
}

const STORAGE_KEY = "mindtrap_admin_key";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function toWesternNumerals(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function statusLabel(s: string) {
  if (s === "waiting") return { text: "انتظار", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" };
  if (s === "playing") return { text: "تلعب", color: "text-green-400 bg-green-400/10 border-green-400/30" };
  return { text: "انتهت", color: "text-muted-foreground bg-muted/20 border-border" };
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `منذ ${diff}ث`;
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)}د`;
  return `منذ ${Math.floor(diff / 3600)}س`;
}

export default function Admin() {
  const [key, setKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [inputKey, setInputKey] = useState("");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async (k: string) => {
    if (!k) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/admin/stats?key=${encodeURIComponent(k)}`);
      if (res.status === 401) {
        setError("كلمة المرور خاطئة");
        setKey("");
        localStorage.removeItem(STORAGE_KEY);
        setStats(null);
        return;
      }
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch {
      setError("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    fetchStats(key);
    const interval = setInterval(() => fetchStats(key), 10000);
    return () => clearInterval(interval);
  }, [key, fetchStats]);

  const handleLogin = () => {
    const k = toWesternNumerals(inputKey.trim());
    if (!k) return;
    localStorage.setItem(STORAGE_KEY, k);
    setKey(k);
    setInputKey("");
  };

  if (!key) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🛡️</div>
            <h1 className="text-2xl font-black text-foreground">لوحة التحكم</h1>
            <p className="text-muted-foreground text-sm mt-1">أدخل كلمة المرور للوصول</p>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="كلمة المرور..."
              className="h-12 px-4 rounded-xl border border-border bg-card text-foreground text-center text-lg tracking-widest focus:outline-none focus:border-primary"
              autoFocus
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <button
              onClick={handleLogin}
              className="h-12 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-opacity"
            >
              دخول
            </button>
            <Link href="/" className="text-center text-sm text-muted-foreground hover:text-foreground">
              ← رجوع للرئيسية
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-2">
              🛡️ لوحة التحكم
            </h1>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA")} — يتجدد كل 10 ثوانٍ
              </p>
            )}
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => fetchStats(key)}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-border text-sm font-bold hover:bg-card transition-colors disabled:opacity-50"
            >
              {loading ? "⏳" : "🔄 تحديث"}
            </button>
            <button
              onClick={() => { setKey(""); localStorage.removeItem(STORAGE_KEY); setStats(null); }}
              className="px-4 py-2 rounded-xl border border-destructive/40 text-destructive text-sm font-bold hover:bg-destructive/10 transition-colors"
            >
              خروج
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!stats ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-pulse text-primary text-xl font-bold">جاري التحميل...</div>
            </div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Live Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "غرف مفتوحة", value: stats.live.totalRooms, icon: "🏠", color: "text-blue-400" },
                  { label: "تلعب الآن", value: stats.live.playing, icon: "🎮", color: "text-green-400" },
                  { label: "لاعبين متصلين", value: stats.live.totalOnline, icon: "👥", color: "text-purple-400" },
                  { label: "ذروة اليوم", value: stats.daily.peakConcurrent, icon: "📈", color: "text-yellow-400" },
                ].map((card) => (
                  <div key={card.label} className="bg-card border border-border rounded-2xl p-4 text-center">
                    <div className="text-3xl mb-1">{card.icon}</div>
                    <div className={`text-4xl font-black ${card.color}`}>{card.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Daily Stats */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-lg font-black mb-4 text-foreground flex items-center gap-2">
                  📊 إحصائيات اليوم
                  <span className="text-xs font-normal text-muted-foreground">({stats.daily.date})</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: "ألعاب بدأت", value: stats.daily.gamesStarted, icon: "▶️" },
                    { label: "ألعاب اكتملت", value: stats.daily.gamesCompleted, icon: "✅" },
                    { label: "لاعبين فريدين", value: stats.daily.uniquePlayersToday, icon: "🙋" },
                    { label: "أسئلة أُجيبت", value: stats.daily.questionsAnswered, icon: "💡" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-2xl">{item.icon}</div>
                      <div className="text-3xl font-black text-primary">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Rooms */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-lg font-black mb-4 text-foreground">🏠 الغرف الحالية</h2>
                {stats.live.rooms.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">لا توجد غرف مفتوحة حالياً</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {stats.live.rooms.map((room) => {
                      const s = statusLabel(room.status);
                      return (
                        <div key={room.code} className="flex items-center justify-between bg-background/50 rounded-xl px-4 py-3 border border-border flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-xl text-primary">{room.code}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${s.color}`}>{s.text}</span>
                            {room.status === "playing" && (
                              <span className="text-xs text-muted-foreground">س{room.currentQuestion}/{room.totalQuestions}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{room.playerNames.join("، ")}</span>
                            <span className="font-bold text-foreground">{room.playerCount} 👥</span>
                            <span className="text-xs text-muted-foreground">{timeAgo(room.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Games */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-lg font-black mb-4 text-foreground">🕹️ آخر الألعاب</h2>
                {stats.daily.recentGames.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">لا توجد ألعاب اليوم بعد</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {stats.daily.recentGames.map((game, i) => (
                      <div key={i} className="flex items-center justify-between bg-background/50 rounded-xl px-4 py-3 border border-border flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-primary">{game.roomCode}</span>
                          <span className="text-muted-foreground text-sm">{game.playerNames.join("، ")}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-foreground font-bold">{game.playerCount} لاعبين</span>
                          {game.durationMin !== null && (
                            <span className="text-muted-foreground">{game.durationMin} دقيقة</span>
                          )}
                          <span className="text-xs text-muted-foreground">{timeAgo(game.startedAt)}</span>
                          {!game.endedAt && <span className="text-xs text-green-400 font-bold">جارية</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
