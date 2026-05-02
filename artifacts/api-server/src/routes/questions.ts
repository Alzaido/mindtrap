import { Router, type IRouter } from "express";
import { getQuestionsByCategory } from "../data/questions";

const router: IRouter = Router();

router.get("/questions", (req, res) => {
  const count = parseInt(String(req.query["count"] ?? "10"), 10);
  const category = String(req.query["category"] ?? "all");

  const validCategories = ["tricky", "psychological", "visual", "reverse", "all"];
  const cat = validCategories.includes(category) ? category : "all";
  const safeCount = Math.min(Math.max(1, isNaN(count) ? 10 : count), 50);

  const questions = getQuestionsByCategory(cat, safeCount);
  res.json({ questions, total: questions.length });
});

export default router;
