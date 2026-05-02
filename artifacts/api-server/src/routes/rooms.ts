import { Router, type IRouter } from "express";
import { CreateRoomBody } from "@workspace/api-zod";
import { createRoom, getRoom, roomToJSON } from "../game/store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/rooms", (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const { hostName, maxPlayers = 6, questionCount = 10 } = parsed.data;
  const room = createRoom(hostName, maxPlayers, questionCount);

  req.log.info({ roomCode: room.code, hostName }, "Room created");
  res.status(201).json(roomToJSON(room));
});

router.get("/rooms/:code", (req, res) => {
  const code = req.params["code"]?.toUpperCase();
  if (!code) {
    res.status(400).json({ error: "رمز الغرفة مطلوب" });
    return;
  }

  const room = getRoom(code);
  if (!room) {
    res.status(404).json({ error: "الغرفة غير موجودة" });
    return;
  }

  res.json(roomToJSON(room));
});

export default router;
