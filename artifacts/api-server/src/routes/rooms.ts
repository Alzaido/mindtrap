import { Router, type IRouter } from "express";
import { CreateRoomBody } from "@workspace/api-zod";
import { createRoom, getRoom, getPublicRooms, roomToJSON } from "../game/store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/rooms", (_req, res) => {
  res.json({ rooms: getPublicRooms() });
});

router.post("/rooms", (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const {
    hostName,
    maxPlayers = 10,
    questionCount = 20,
    roomName,
    isPublic = true,
    pin,
  } = parsed.data;

  if (!isPublic && pin && !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "الرقم السري يجب أن يكون 4 أرقام" });
    return;
  }

  const room = createRoom(
    hostName,
    maxPlayers,
    questionCount,
    roomName?.trim() || undefined,
    isPublic,
    !isPublic && pin ? pin : undefined
  );

  req.log.info({ roomCode: room.code, hostName, isPublic }, "Room created");
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
