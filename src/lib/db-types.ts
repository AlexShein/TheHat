export interface RoomMeta {
  createdBy: string
  createdAt: number // serverTimestamp
  lastActiveAt: number // serverTimestamp
}

export interface RoomConfig {
  wordCount: number
  numTeams: number
  skipPenalty: boolean
  timerDuration: number
}

export interface Player {
  name: string
  color: string
  teamId: string | null
  wordsSubmitted: boolean
  ready: boolean
  connected: boolean
  isAdmin: boolean
}

export interface Team {
  name: string
  playerOrder: string[]
  currentPlayerIndex: number
  roundScores: {
    round1: number
    round2: number
    round3: number
  }
}

export interface Word {
  text: string
  addedBy: string
}

export interface LastAction {
  type: "guessed" | "skipped" | null
  wordId: string | null
  scoredTeamId: string | null
  scoreWasPenalty: boolean
}

export interface PlayerStats {
  wordsExplained: number
}

export interface GameState {
  round: number
  currentTeamId: string
  currentExplainerId: string
  timerStartedAt: number | null // serverTimestamp
  timerDuration: number
  pausedAt: number | null // serverTimestamp
  timeRemainingAtPause: number | null // plain number
  phase: "waiting_start" | "explaining" | "post_expiry" | "post_turn" | "round_end"
  hat: string[]
  currentWordId: string | null
  currentWordText: string | null // written at draw time, read by observers + explainer
  wordsGuessedThisTurn: number // reset to 0 on each new turn, incremented on Guessed
  lastAction: LastAction | null
  playerStats: Record<string, PlayerStats>
}

export const RoomStatus = {
  WordEntry: "word-entry",
  PreStart: "pre-start",
  Playing: "playing",
  Finished: "finished",
} as const

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus]
