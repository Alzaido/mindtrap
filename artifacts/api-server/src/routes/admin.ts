import { Router, type IRouter } from "express";
import { rooms } from "../game/store";
import { getStats } from "../game/stats";

const router: IRouter = Router();

const ADMIN_SECRET = process.env["ADMIN_SECRET"] ?? "6655";

router.get("/admin/stats", (req, res) => {
  const key = req.query["key"];
  if (key !== ADMIN_SECRET) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  const liveRooms = Array.from(rooms.values()).map((r) => ({
    code: r.code,
    status: r.status,
    hostName: r.hostName,
    playerCount: r.players.size,
    playerNames: Array.from(r.players.keys()),
    currentQuestion: r.currentQuestion,
    totalQuestions: r.questions.length,
    createdAt: r.createdAt,
  }));

  const waiting = liveRooms.filter((r) => r.status === "waiting").length;
  const playing = liveRooms.filter((r) => r.status === "playing").length;
  const finished = liveRooms.filter((r) => r.status === "finished").length;
  const totalOnline = liveRooms.reduce((sum, r) => sum + r.playerCount, 0);

  res.json({
    live: {
      totalRooms: liveRooms.length,
      waiting,
      playing,
      finished,
      totalOnline,
      rooms: liveRooms,
    },
    daily: getStats(),
    serverTime: new Date().toISOString(),
  });
});

export default router;
