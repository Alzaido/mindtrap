import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "../lib/logger";
import { getQuestionsByCategory } from "../data/questions";
import {
  createRoom,
  getRoom,
  addPlayer,
  removePlayer,
  roomToJSON,
  recordAnswer,
  getLeaderboard,
  resetRoom,
  rooms,
} from "./store";

const QUESTION_TIMEOUT_MS = 12000; // 10s question + 2s buffer

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Map socketId -> { roomCode, playerName }
  const socketRoomMap = new Map<string, { roomCode: string; playerName: string }>();

  // Map roomCode -> Set of playerNames who clicked "play again"
  const replayReady = new Map<string, Set<string>>();

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join-room", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const code = roomCode.toUpperCase();
      const room = getRoom(code);
      if (!room) {
        socket.emit("error", { message: "الغرفة غير موجودة" });
        return;
      }
      if (room.status !== "waiting") {
        socket.emit("error", { message: "اللعبة بدأت بالفعل" });
        return;
      }
      if (room.players.size >= room.maxPlayers && !room.players.has(playerName)) {
        socket.emit("error", { message: "الغرفة ممتلئة" });
        return;
      }

      const player = addPlayer(code, playerName, socket.id);
      if (!player) {
        socket.emit("error", { message: "تعذر الانضمام" });
        return;
      }

      socketRoomMap.set(socket.id, { roomCode: code, playerName });
      socket.join(code);

      // Notify all players in room
      io.to(code).emit("room-updated", roomToJSON(room));
      logger.info({ roomCode: code, playerName }, "Player joined room");
    });

    socket.on("start-game", ({ roomCode }: { roomCode: string }) => {
      const code = roomCode.toUpperCase();
      const room = getRoom(code);
      if (!room) return;

      const info = socketRoomMap.get(socket.id);
      if (!info || info.playerName !== room.hostName) {
        socket.emit("error", { message: "فقط المضيف يمكنه بدء اللعبة" });
        return;
      }
      if (room.players.size < 2) {
        socket.emit("error", { message: "يحتاج اللعب لاعبَين على الأقل" });
        return;
      }
      if (room.status !== "waiting") return;

      // Load questions
      room.questions = getQuestionsByCategory("all", room.questionCount, room.usedQuestionIds);
      room.status = "playing";
      room.currentQuestion = 0;

      logger.info({ roomCode: code, questions: room.questions.length }, "Game started");
      // Notify Lobby to navigate to game screen
      io.to(code).emit("game-started");
      // Small delay so clients can navigate before first question
      setTimeout(() => sendNextQuestion(io, code), 1000);
    });

    socket.on(
      "submit-answer",
      ({
        roomCode,
        playerName,
        questionId,
        answerIndex,
        responseTime,
      }: {
        roomCode: string;
        playerName: string;
        questionId: string;
        answerIndex: number;
        responseTime: number;
      }) => {
        const code = roomCode.toUpperCase();
        const room = getRoom(code);
        if (!room || room.status !== "playing") return;

        const currentQ = room.questions[room.currentQuestion];
        if (!currentQ || currentQ.id !== questionId) return;

        const totalPlayers = room.players.size;
        const { points, bonus } = recordAnswer(
          code,
          playerName,
          questionId,
          answerIndex,
          responseTime,
          currentQ.correctIndex,
          totalPlayers
        );

        // Send personal result
        socket.emit("answer-recorded", {
          points,
          bonus,
          correct: answerIndex === currentQ.correctIndex,
        });

        // Check if all players answered
        const player = room.players.get(playerName);
        if (player) {
          const allAnswered = Array.from(room.players.values()).every((p) =>
            p.answers.some((a) => a.questionId === questionId)
          );

          if (allAnswered) {
            // Clear the timeout and send results immediately
            if (room.questionTimer) {
              clearTimeout(room.questionTimer);
              room.questionTimer = undefined;
            }
            sendQuestionResult(io, code, questionId);
          }
        }
      }
    );

    socket.on(
      "use-ability",
      ({
        roomCode,
        playerName,
        ability,
        targetName,
      }: {
        roomCode: string;
        playerName: string;
        ability: "confuse" | "freeze" | "reverse" | "sabotage";
        targetName: string;
      }) => {
        const code = roomCode.toUpperCase();
        const room = getRoom(code);
        if (!room || room.status !== "playing") return;

        const player = room.players.get(playerName);
        // Support "random" target — pick a random other player
        let resolvedTargetName = targetName;
        if (targetName === "random") {
          const others = Array.from(room.players.keys()).filter((n) => n !== playerName);
          if (others.length === 0) return;
          resolvedTargetName = others[Math.floor(Math.random() * others.length)];
        }
        const target = room.players.get(resolvedTargetName);
        if (!player || !target) return;

        if (player.abilities[ability] <= 0) {
          socket.emit("error", { message: "انتهت استخداماتك لهذه القدرة" });
          return;
        }

        player.abilities[ability]--;
        player.abilitiesUsed++;

        // Sabotage: steal 50 points from target (minimum 0)
        if (ability === "sabotage") {
          const stolen = Math.min(target.score, 50);
          target.score = Math.max(0, target.score - stolen);
          player.score += stolen;

          // Notify target they were sabotaged
          const targetSocket = io.sockets.sockets.get(target.socketId);
          if (targetSocket) {
            targetSocket.emit("sabotage-effect", {
              fromPlayer: playerName,
              stolen,
            });
          }

          // Broadcast updated scores to all
          const updatedScores = Array.from(room.players.values()).map((p) => ({
            name: p.name,
            score: p.score,
            delta: 0,
          }));
          io.to(code).emit("score-update", { scores: updatedScores });

          logger.info({ playerName, targetName: resolvedTargetName, stolen, roomCode: code }, "Sabotage used");
          return;
        }

        // Notify target for other abilities
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit("ability-effect", {
            ability,
            fromPlayer: playerName,
            toPlayer: resolvedTargetName,
          });
        }

        // Notify all about the ability use
        io.to(code).emit("ability-used", {
          ability,
          fromPlayer: playerName,
          toPlayer: resolvedTargetName,
        });

        logger.info({ playerName, ability, targetName: resolvedTargetName, roomCode: code }, "Ability used");
      }
    );

    socket.on("ready-again", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const code = roomCode.toUpperCase();
      const room = getRoom(code);
      if (!room || room.status !== "finished") return;

      if (!replayReady.has(code)) {
        replayReady.set(code, new Set());
      }
      const readySet = replayReady.get(code)!;
      readySet.add(playerName);

      const totalPlayers = room.players.size;
      const readyPlayers = Array.from(readySet);

      io.to(code).emit("replay-ready-update", { readyPlayers, totalPlayers });
      logger.info({ roomCode: code, readyPlayers, totalPlayers }, "Player ready for replay");

      // All players ready → reset room and go back to lobby
      if (readySet.size >= totalPlayers) {
        replayReady.delete(code);
        const resetted = resetRoom(code);
        if (!resetted) return;
        io.to(code).emit("room-reset", roomToJSON(resetted));
        logger.info({ roomCode: code }, "All players ready — room reset for replay");
      }
    });

    socket.on("disconnect", () => {
      const info = socketRoomMap.get(socket.id);
      if (info) {
        const { roomCode, playerName } = info;
        socketRoomMap.delete(socket.id);
        const room = getRoom(roomCode);
        if (room && room.status === "waiting") {
          removePlayer(roomCode, playerName);
          const updatedRoom = getRoom(roomCode);
          if (updatedRoom) {
            io.to(roomCode).emit("room-updated", roomToJSON(updatedRoom));
          }
        }
        logger.info({ socketId: socket.id, playerName, roomCode }, "Socket disconnected");
      }
    });
  });

  return io;
}

function sendNextQuestion(io: SocketIOServer, roomCode: string) {
  const room = getRoom(roomCode);
  if (!room) return;

  const questionIndex = room.currentQuestion;
  if (questionIndex >= room.questions.length) {
    endGame(io, roomCode);
    return;
  }

  const question = room.questions[questionIndex];
  room.usedQuestionIds.add(question.id);

  // Send question without correct answer, include player list for target selection
  io.to(roomCode).emit("next-question", {
    question: {
      id: question.id,
      text: question.text,
      options: question.options,
      category: question.category,
      timeLimit: 10,
    },
    questionNumber: questionIndex + 1,
    totalQuestions: room.questions.length,
    playerNames: Array.from(room.players.keys()),
  });

  logger.info({ roomCode, questionIndex, questionId: question.id }, "Question sent");

  // Auto-advance after 10s + 2s buffer
  const timeoutMs = QUESTION_TIMEOUT_MS;
  room.questionTimer = setTimeout(() => {
    sendQuestionResult(io, roomCode, question.id);
  }, timeoutMs);
}

function sendQuestionResult(io: SocketIOServer, roomCode: string, questionId: string) {
  const room = getRoom(roomCode);
  if (!room) return;

  const question = room.questions.find((q) => q.id === questionId);
  if (!question) return;

  const scores = Array.from(room.players.values()).map((p) => {
    const answer = p.answers.find((a) => a.questionId === questionId);
    return {
      name: p.name,
      score: p.score,
      delta: answer ? answer.points + answer.bonus : 0,
    };
  });

  io.to(roomCode).emit("question-result", {
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    scores,
  });

  // Advance to next question after 6 seconds
  setTimeout(() => {
    const r = getRoom(roomCode);
    if (!r || r.status !== "playing") return;
    r.currentQuestion++;
    sendNextQuestion(io, roomCode);
  }, 6000);
}

function endGame(io: SocketIOServer, roomCode: string) {
  const room = getRoom(roomCode);
  if (!room) return;

  room.status = "finished";
  const leaderboard = getLeaderboard(roomCode);

  io.to(roomCode).emit("game-finished", { leaderboard });
  logger.info({ roomCode }, "Game finished");
}
