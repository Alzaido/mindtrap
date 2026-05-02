import { Router, type IRouter } from "express";
import { getLeaderboard, getPlayerStats } from "../game/store";

const router: IRouter = Router();

router.get("/leaderboard/:roomCode", (req, res) => {
  const roomCode = req.params["roomCode"]?.toUpperCase();
  if (!roomCode) {
    res.status(400).json({ error: "رمز الغرفة مطلوب" });
    return;
  }

  const entries = getLeaderboard(roomCode);
  if (!entries) {
    res.status(404).json({ error: "الغرفة غير موجودة" });
    return;
  }

  res.json({ roomCode, entries });
});

router.get("/stats/:roomCode/:playerName", (req, res) => {
  const roomCode = req.params["roomCode"]?.toUpperCase();
  const playerName = req.params["playerName"];

  if (!roomCode || !playerName) {
    res.status(400).json({ error: "البيانات مطلوبة" });
    return;
  }

  const stats = getPlayerStats(roomCode, decodeURIComponent(playerName));
  if (!stats) {
    res.status(404).json({ error: "اللاعب غير موجود" });
    return;
  }

  res.json(stats);
});

export default router;
