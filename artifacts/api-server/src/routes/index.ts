import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import questionsRouter from "./questions";
import leaderboardRouter from "./leaderboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(questionsRouter);
router.use(leaderboardRouter);
router.use(adminRouter);

export default router;
