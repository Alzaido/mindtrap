export interface DailyStats {
  date: string;
  gamesStarted: number;
  gamesCompleted: number;
  uniquePlayers: Set<string>;
  questionsAnswered: number;
  peakConcurrent: number;
  currentConcurrent: number;
}

export interface GameRecord {
  roomCode: string;
  startedAt: number;
  endedAt?: number;
  playerCount: number;
  playerNames: string[];
}

const stats: DailyStats = {
  date: todayStr(),
  gamesStarted: 0,
  gamesCompleted: 0,
  uniquePlayers: new Set(),
  questionsAnswered: 0,
  peakConcurrent: 0,
  currentConcurrent: 0,
};

const recentGames: GameRecord[] = [];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay() {
  const today = todayStr();
  if (stats.date !== today) {
    stats.date = today;
    stats.gamesStarted = 0;
    stats.gamesCompleted = 0;
    stats.uniquePlayers = new Set();
    stats.questionsAnswered = 0;
    stats.peakConcurrent = 0;
    stats.currentConcurrent = 0;
  }
}

export function trackGameStarted(roomCode: string, playerNames: string[]) {
  resetIfNewDay();
  stats.gamesStarted++;
  playerNames.forEach((n) => stats.uniquePlayers.add(n));
  stats.currentConcurrent = Math.max(stats.currentConcurrent, playerNames.length);
  if (stats.currentConcurrent > stats.peakConcurrent) {
    stats.peakConcurrent = stats.currentConcurrent;
  }
  recentGames.unshift({
    roomCode,
    startedAt: Date.now(),
    playerCount: playerNames.length,
    playerNames,
  });
  if (recentGames.length > 20) recentGames.pop();
}

export function trackGameCompleted(roomCode: string) {
  resetIfNewDay();
  stats.gamesCompleted++;
  const game = recentGames.find((g) => g.roomCode === roomCode && !g.endedAt);
  if (game) game.endedAt = Date.now();
}

export function trackQuestionAnswered() {
  resetIfNewDay();
  stats.questionsAnswered++;
}

export function trackPlayerConnected() {
  resetIfNewDay();
  stats.currentConcurrent++;
  if (stats.currentConcurrent > stats.peakConcurrent) {
    stats.peakConcurrent = stats.currentConcurrent;
  }
}

export function trackPlayerDisconnected() {
  if (stats.currentConcurrent > 0) stats.currentConcurrent--;
}

export function getStats() {
  resetIfNewDay();
  return {
    date: stats.date,
    gamesStarted: stats.gamesStarted,
    gamesCompleted: stats.gamesCompleted,
    uniquePlayersToday: stats.uniquePlayers.size,
    questionsAnswered: stats.questionsAnswered,
    peakConcurrent: stats.peakConcurrent,
    currentConcurrent: stats.currentConcurrent,
    recentGames: recentGames.slice(0, 10).map((g) => ({
      roomCode: g.roomCode,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
      playerCount: g.playerCount,
      playerNames: g.playerNames,
      durationMin: g.endedAt ? Math.round((g.endedAt - g.startedAt) / 60000) : null,
    })),
  };
}
