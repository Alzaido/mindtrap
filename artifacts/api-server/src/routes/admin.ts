import { Router, type IRouter } from "express";
import { rooms } from "../game/store";
import { getStats } from "../game/stats";
import { getAllQuestionsWithStatus, disabledQuestionIds } from "../data/questions";

const router: IRouter = Router();

const ADMIN_SECRET = process.env["ADMIN_SECRET"] ?? "6655";

function checkAuth(req: any, res: any): boolean {
  const key = req.query["key"] ?? req.headers["x-admin-key"];
  if (key !== ADMIN_SECRET) {
    res.status(401).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

router.get("/admin/stats", (req, res) => {
  if (!checkAuth(req, res)) return;

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

router.get("/admin/questions", (req, res) => {
  if (!checkAuth(req, res)) return;
  const questions = getAllQuestionsWithStatus();
  res.json({ questions, total: questions.length, disabled: disabledQuestionIds.size });
});

router.post("/admin/questions/:id/disable", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { id } = req.params;
  disabledQuestionIds.add(id);
  res.json({ success: true, disabled: id });
});

router.post("/admin/questions/:id/enable", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { id } = req.params;
  disabledQuestionIds.delete(id);
  res.json({ success: true, enabled: id });
});

export default router;
