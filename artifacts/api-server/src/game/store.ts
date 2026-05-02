import { Question } from "../data/questions";

export type PlayerProfile =
  | "fast_reckless"
  | "slow_precise"
  | "hard_to_trick"
  | "easy_to_trick";

export interface PlayerAbilities {
  confuse: number;
  freeze: number;
  reverse: number;
  sabotage: number;
}

export interface PlayerAnswer {
  questionId: string;
  answerIndex: number;
  responseTime: number;
  correct: boolean;
  points: number;
  bonus: number;
}

export interface Player {
  name: string;
  score: number;
  isHost: boolean;
  abilities: PlayerAbilities;
  socketId: string;
  answers: PlayerAnswer[];
  frozenUntil?: number;
  abilitiesUsed: number;
}

export interface Room {
  id: string;
  code: string;
  hostName: string;
  players: Map<string, Player>;
  status: "waiting" | "playing" | "finished";
  maxPlayers: number;
  questionCount: number;
  currentQuestion: number;
  questions: Question[];
  usedQuestionIds: Set<string>;
  questionTimer?: ReturnType<typeof setTimeout>;
  createdAt: number;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(
  hostName: string,
  maxPlayers: number,
  questionCount: number
): Room {
  let code = generateCode();
  while (rooms.has(code)) {
    code = generateCode();
  }

  const room: Room = {
    id: `room_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    code,
    hostName,
    players: new Map(),
    status: "waiting",
    maxPlayers,
    questionCount,
    currentQuestion: 0,
    questions: [],
    usedQuestionIds: new Set(),
    createdAt: Date.now(),
  };

  const hostPlayer: Player = {
    name: hostName,
    score: 0,
    isHost: true,
    abilities: { confuse: 1, freeze: 1, reverse: 1, sabotage: 1 },
    socketId: "",
    answers: [],
    abilitiesUsed: 0,
  };

  room.players.set(hostName, hostPlayer);
  rooms.set(code, room);

  // Auto-cleanup after 2 hours
  setTimeout(() => {
    if (rooms.has(code)) {
      rooms.delete(code);
    }
  }, 2 * 60 * 60 * 1000);

  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function addPlayer(
  roomCode: string,
  playerName: string,
  socketId: string
): Player | null {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return null;
  if (room.status !== "waiting") return null;
  if (room.players.size >= room.maxPlayers) return null;
  if (room.players.has(playerName)) {
    // Reconnection — update socketId
    const existing = room.players.get(playerName)!;
    existing.socketId = socketId;
    return existing;
  }

  const player: Player = {
    name: playerName,
    score: 0,
    isHost: false,
    abilities: { confuse: 1, freeze: 1, reverse: 1, sabotage: 1 },
    socketId,
    answers: [],
    abilitiesUsed: 0,
  };

  room.players.set(playerName, player);
  return player;
}

export function resetRoom(roomCode: string): Room | null {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return null;

  // Reset room state
  room.status = "waiting";
  room.currentQuestion = 0;
  room.questions = [];
  room.usedQuestionIds = new Set();
  if (room.questionTimer) {
    clearTimeout(room.questionTimer);
    room.questionTimer = undefined;
  }

  // Reset all player stats
  for (const player of room.players.values()) {
    player.score = 0;
    player.answers = [];
    player.abilitiesUsed = 0;
    player.abilities = { confuse: 1, freeze: 1, reverse: 1, sabotage: 1 };
    delete player.frozenUntil;
  }

  return room;
}

export function removePlayer(roomCode: string, playerName: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.players.delete(playerName);
  if (room.players.size === 0) {
    rooms.delete(roomCode);
  }
}

export function roomToJSON(room: Room) {
  return {
    id: room.id,
    code: room.code,
    hostName: room.hostName,
    players: Array.from(room.players.values()).map((p) => ({
      name: p.name,
      score: p.score,
      isHost: p.isHost,
      abilities: p.abilities,
    })),
    status: room.status,
    maxPlayers: room.maxPlayers,
    questionCount: room.questionCount,
    currentQuestion: room.currentQuestion,
  };
}

export function recordAnswer(
  roomCode: string,
  playerName: string,
  questionId: string,
  answerIndex: number,
  responseTime: number,
  correctIndex: number,
  totalPlayers: number
): { points: number; bonus: number } {
  const room = rooms.get(roomCode);
  if (!room) return { points: 0, bonus: 0 };

  const player = room.players.get(playerName);
  if (!player) return { points: 0, bonus: 0 };

  // Check if already answered this question
  if (player.answers.some((a) => a.questionId === questionId)) {
    return { points: 0, bonus: 0 };
  }

  const correct = answerIndex === correctIndex;
  let points = 0;
  let bonus = 0;

  if (correct) {
    // Base points: speed-based (max 100)
    const timeLimit = 8;
    const speedRatio = Math.max(0, 1 - responseTime / (timeLimit * 1000));
    points = Math.round(50 + 50 * speedRatio);

    // Bonus for being the only correct one
    const othersCorrect = Array.from(room.players.values()).filter(
      (p) =>
        p.name !== playerName &&
        p.answers.some((a) => a.questionId === questionId && a.correct)
    ).length;

    if (othersCorrect === 0 && totalPlayers > 1) {
      bonus = 25;
    }
  }

  const answer: PlayerAnswer = {
    questionId,
    answerIndex,
    responseTime,
    correct,
    points,
    bonus,
  };

  player.answers.push(answer);
  player.score += points + bonus;

  return { points, bonus };
}

export function getLeaderboard(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const entries = Array.from(room.players.values())
    .map((p) => ({
      name: p.name,
      score: p.score,
      correctAnswers: p.answers.filter((a) => a.correct).length,
      totalAnswers: p.answers.length,
      avgResponseTime:
        p.answers.length > 0
          ? p.answers.reduce((sum, a) => sum + a.responseTime, 0) /
            p.answers.length /
            1000
          : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ rank: i + 1, ...e }));

  return entries;
}

export function getPlayerStats(roomCode: string, playerName: string) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const player = room.players.get(playerName);
  if (!player) return null;

  const leaderboard = getLeaderboard(roomCode)!;
  const rank = leaderboard.findIndex((e) => e.name === playerName) + 1;
  const totalPlayers = leaderboard.length;

  const correct = player.answers.filter((a) => a.correct).length;
  const wrong = player.answers.filter((a) => !a.correct).length;
  const avgTime =
    player.answers.length > 0
      ? player.answers.reduce((s, a) => s + a.responseTime, 0) /
        player.answers.length /
        1000
      : 0;
  const bonusPoints = player.answers.reduce((s, a) => s + a.bonus, 0);
  const accuracy = player.answers.length > 0 ? correct / player.answers.length : 0;

  let profileType: PlayerProfile;
  let profileLabel: string;
  let profileEmoji: string;

  if (avgTime < 3 && accuracy < 0.5) {
    profileType = "fast_reckless";
    profileLabel = "سريع ومتهور";
    profileEmoji = "😅";
  } else if (avgTime >= 4 && accuracy >= 0.6) {
    profileType = "slow_precise";
    profileLabel = "بطيء ودقيق";
    profileEmoji = "🧠";
  } else if (accuracy >= 0.7) {
    profileType = "hard_to_trick";
    profileLabel = "صعب ينخدع";
    profileEmoji = "🔥";
  } else {
    profileType = "easy_to_trick";
    profileLabel = "ينخدع بسهولة";
    profileEmoji = "😂";
  }

  return {
    playerName,
    profileType,
    profileLabel,
    profileEmoji,
    score: player.score,
    rank,
    totalPlayers,
    correctAnswers: correct,
    wrongAnswers: wrong,
    avgResponseTime: Math.round(avgTime * 10) / 10,
    bonusPoints,
    abilitiesUsed: player.abilitiesUsed,
  };
}

export { rooms };
