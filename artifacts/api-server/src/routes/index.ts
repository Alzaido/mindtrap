import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import questionsRouter from "./questions";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(questionsRouter);
router.use(leaderboardRouter);

export default router;
