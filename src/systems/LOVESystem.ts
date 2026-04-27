import { SaveData, writeSave } from './SaveSystem';
import type { EncounterAction } from './EncounterSystem';

/**
 * LOVE = Level of Virtue Expressed
 * Tracks compassion, faithfulness, and faith across all choices.
 * The higher the LOVE, the richer the world becomes.
 * The game never shames a low LOVE score — it simply reflects reality.
 */

const XP_REWARDS: Record<EncounterAction, number> = {
  listen: 15,
  serve:  20,
  pray:   12,
  pass:   0,
};

const VIRTUE_GAINS: Record<EncounterAction, Partial<Pick<SaveData, 'compassion' | 'faithfulness' | 'faith'>>> = {
  listen: { compassion: 1 },
  serve:  { faithfulness: 1 },
  pray:   { faith: 1 },
  pass:   {},
};

export function applyEncounterChoice(save: SaveData, action: EncounterAction): SaveData {
  // XP
  save.totalXP += XP_REWARDS[action];
  save.faithLevel = Math.min(40, Math.floor(save.totalXP / 250) + 1);

  // Virtue stats
  const gains = VIRTUE_GAINS[action];
  if (gains.compassion)   save.compassion   += gains.compassion;
  if (gains.faithfulness) save.faithfulness += gains.faithfulness;
  if (gains.faith)        save.faith        += gains.faith;

  // LOVE = sum of all virtue
  save.love = save.compassion + save.faithfulness + save.faith;

  writeSave(save);
  return save;
}

export function getLOVETier(save: SaveData): 'seeking' | 'following' | 'abiding' | 'fruit' {
  const love = save.love;
  if (love >= 30) return 'fruit';
  if (love >= 15) return 'abiding';
  if (love >= 5)  return 'following';
  return 'seeking';
}

export function getLOVETierLabel(save: SaveData): string {
  const tier = getLOVETier(save);
  const labels: Record<string, string> = {
    seeking:   'Seeking',
    following: 'Following',
    abiding:   'Abiding',
    fruit:     'Bearing Fruit',
  };
  return labels[tier];
}

/** Returns bonus scroll room cards unlocked at higher tiers */
export function getUnlockedScrollCards(save: SaveData): string[] {
  const tier = getLOVETier(save);
  const base = ['otRoot', 'wordStudy'];
  if (tier === 'following' || tier === 'abiding' || tier === 'fruit') {
    base.push('narrativeArc');
  }
  if (tier === 'abiding' || tier === 'fruit') {
    base.push('newCreation');
  }
  if (tier === 'fruit') {
    base.push('deepDive');
  }
  return base;
}
