import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { proxyImage } from "@/lib/api-config";

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

interface QuestionItem {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
  image?: string;
  explanation: string;
  disabled: boolean;
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

type AdminTab = "dashboard" | "questions";

export default function Admin() {
  const [key, setKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [inputKey, setInputKey] = useState("");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  // Questions state
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qSearch, setQSearch] = useState("");
  const [qFilter, setQFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [qCategory, setQCategory] = useState("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());

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

  const fetchQuestions = useCallback(async (k: string) => {
    if (!k) return;
    setQLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/questions?key=${encodeURIComponent(k)}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
      }
    } catch {
      // ignore
    } finally {
      setQLoading(false);
    }
  }, []);

  const toggleQuestion = async (id: string, disabled: boolean) => {
    setToggling((prev) => new Set(prev).add(id));
    const action = disabled ? "enable" : "disable";
    try {
      await fetch(`${BASE}/api/admin/questions/${id}/${action}?key=${encodeURIComponent(key)}`, { method: "POST" });
      setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, disabled: !disabled } : q));
    } catch {
      // ignore
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  useEffect(() => {
    if (!key) return;
    fetchStats(key);
    const interval = setInterval(() => fetchStats(key), 10000);
    return () => clearInterval(interval);
  }, [key, fetchStats]);

  useEffect(() => {
    if (!key || activeTab !== "questions") return;
    fetchQuestions(key);
  }, [key, activeTab, fetchQuestions]);

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

  const filteredQuestions = questions.filter((q) => {
    if (qFilter === "enabled" && q.disabled) return false;
    if (qFilter === "disabled" && !q.disabled) return false;
    if (qCategory !== "all" && q.category !== qCategory) return false;
    if (qSearch && !q.text.includes(qSearch)) return false;
    return true;
  });

  const categories = ["all", ...Array.from(new Set(questions.map((q) => q.category)))];

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-2">
              🛡️ لوحة التحكم
            </h1>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA")}
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([["dashboard", "📊 الإحصائيات"], ["questions", "❓ الأسئلة"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {!stats ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-pulse text-primary text-xl font-bold">جاري التحميل...</div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </motion.div>
          )}

          {activeTab === "questions" && (
            <motion.div key="questions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-primary">{questions.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">إجمالي الأسئلة</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-green-400">{questions.filter(q => !q.disabled).length}</div>
                  <div className="text-xs text-muted-foreground mt-1">مفعّلة</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-destructive">{questions.filter(q => q.disabled).length}</div>
                  <div className="text-xs text-muted-foreground mt-1">معطّلة</div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                <input
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                  placeholder="🔍 ابحث في الأسئلة..."
                  className="flex-1 min-w-48 h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
                <select
                  value={qFilter}
                  onChange={(e) => setQFilter(e.target.value as any)}
                  className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm"
                >
                  <option value="all">الكل</option>
                  <option value="enabled">المفعّلة فقط</option>
                  <option value="disabled">المعطّلة فقط</option>
                </select>
                <select
                  value={qCategory}
                  onChange={(e) => setQCategory(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === "all" ? "كل الفئات" : c}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchQuestions(key)}
                  disabled={qLoading}
                  className="h-9 px-4 rounded-lg border border-border text-sm font-bold hover:bg-background/50 transition-colors disabled:opacity-50"
                >
                  {qLoading ? "⏳" : "🔄"}
                </button>
              </div>

              {/* Questions List */}
              {qLoading ? (
                <div className="text-center py-16 text-primary animate-pulse font-bold">جاري التحميل...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground px-1">يظهر {filteredQuestions.length} سؤال</p>
                  {filteredQuestions.map((q) => (
                    <div
                      key={q.id}
                      className={`bg-card border rounded-xl p-4 flex gap-4 items-start transition-opacity ${q.disabled ? "opacity-50 border-destructive/30" : "border-border"}`}
                    >
                      {q.image && (
                        <img
                          src={proxyImage(q.image)}
                          alt=""
                          className="w-16 h-16 object-contain rounded-lg bg-black/30 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{q.id}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{q.category}</span>
                          {q.disabled && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">معطّل</span>}
                        </div>
                        <p className="text-sm font-bold text-foreground leading-snug">{q.text}</p>
                        <div className="flex gap-2 flex-wrap mt-1">
                          {q.options.map((opt, i) => (
                            <span
                              key={i}
                              className={`text-xs px-2 py-0.5 rounded-lg ${i === q.correctIndex ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-background text-muted-foreground border border-border"}`}
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleQuestion(q.id, q.disabled)}
                        disabled={toggling.has(q.id)}
                        className={`shrink-0 h-9 px-4 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${q.disabled ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30" : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"}`}
                      >
                        {toggling.has(q.id) ? "⏳" : q.disabled ? "تفعيل" : "تعطيل"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
