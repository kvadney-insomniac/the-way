export interface FruitStatus {
  status: 'locked' | 'growing' | 'bloomed';
}

export interface EpisodeStatus {
  status: 'locked' | 'unlocked' | 'completed';
  choicesMade: Record<string, string>;
  completedAt: string | null;
}

export interface JournalEntry {
  id: string;
  date: string;
  context: string;
  text: string;
}

export interface SaveData {
  version: number;
  createdAt: string;
  lastPlayedAt: string;
  totalXP: number;
  faithLevel: number;
  streakDays: number;
  lastStreakDate: string | null;
  love: number;
  compassion: number;
  faithfulness: number;
  faith: number;
  episodes: Record<string, EpisodeStatus>;
  fruits: Record<string, FruitStatus>;
  dailyVerseDate: string | null;
  prayerSessionsCompleted: number;
  journal: JournalEntry[];
}

const SAVE_KEY = 'the-way-save';

const defaultEpisode = (status: 'locked' | 'unlocked'): EpisodeStatus => ({
  status,
  choicesMade: {},
  completedAt: null,
});

const defaultFruit = (): FruitStatus => ({ status: 'locked' });

export function defaultSave(): SaveData {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    totalXP: 0,
    faithLevel: 1,
    streakDays: 0,
    lastStreakDate: null,
    love: 0,
    compassion: 0,
    faithfulness: 0,
    faith: 0,
    episodes: {
      andrew_encounter: defaultEpisode('unlocked'),
      call_of_peter: defaultEpisode('locked'),
      cana_wedding: defaultEpisode('locked'),
      paralytic_healing: defaultEpisode('locked'),
      sermon_mount: defaultEpisode('locked'),
      feeding_5000: defaultEpisode('locked'),
      walking_water: defaultEpisode('locked'),
      nicodemus: defaultEpisode('locked'),
      woman_adultery: defaultEpisode('locked'),
      last_supper: defaultEpisode('locked'),
      gethsemane: defaultEpisode('locked'),
      passion: defaultEpisode('locked'),
      empty_tomb: defaultEpisode('locked'),
      emmaus: defaultEpisode('locked'),
      restoration_peter: defaultEpisode('locked'),
    },
    fruits: {
      love: defaultFruit(),
      joy: defaultFruit(),
      peace: defaultFruit(),
      patience: defaultFruit(),
      kindness: defaultFruit(),
      goodness: defaultFruit(),
      faithfulness: defaultFruit(),
      gentleness: defaultFruit(),
      self_control: defaultFruit(),
    },
    dailyVerseDate: null,
    prayerSessionsCompleted: 0,
    journal: [],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  data.lastPlayedAt = new Date().toISOString();
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function awardXP(data: SaveData, amount: number): SaveData {
  data.totalXP += amount;
  data.faithLevel = Math.min(40, Math.floor(data.totalXP / 250) + 1);
  return data;
}

export function recordChoice(
  data: SaveData,
  episodeId: string,
  choiceKey: string,
  value: string
): SaveData {
  if (data.episodes[episodeId]) {
    data.episodes[episodeId].choicesMade[choiceKey] = value;
  }
  return data;
}

export function completeEpisode(data: SaveData, episodeId: string): SaveData {
  if (data.episodes[episodeId]) {
    data.episodes[episodeId].status = 'completed';
    data.episodes[episodeId].completedAt = new Date().toISOString();
  }
  return data;
}

export function unlockEpisode(data: SaveData, episodeId: string): SaveData {
  if (data.episodes[episodeId] && data.episodes[episodeId].status === 'locked') {
    data.episodes[episodeId].status = 'unlocked';
  }
  return data;
}

export function bloomFruit(data: SaveData, fruitId: string): SaveData {
  if (data.fruits[fruitId]) {
    data.fruits[fruitId].status = 'bloomed';
  }
  return data;
}
