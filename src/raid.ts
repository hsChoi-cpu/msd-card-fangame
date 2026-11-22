type RaidDifficulty = 'OMEN' | 'CALAMITY' | 'OBLIVION';

interface RaidBossEntry {
  name: string;
  portrait?: string;
  encounters: Partial<Record<RaidDifficulty, BossEncounter>>;
}

interface RaidProgress {
  regularClears: number;
  oblivionClears: number[];
  announcedClears: number;
  announcedOblivion: number;
}

(function (root: any) {
  const difficulties: readonly RaidDifficulty[] = ['OMEN', 'CALAMITY', 'OBLIVION'];
  // Each entry corresponds to one position, starting at 1 o'clock.
  const bosses: (RaidBossEntry | null)[] = [
    null, null, null, null, null, null, null, null, null, null, null, null
  ];
  const regularClearCount = bosses.length * 2;

  function readProgress(value: unknown): RaidProgress {
    const raw = value as Partial<RaidProgress> | null | undefined;
    const count = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n)
      ? Math.min(max, Math.max(0, n)) : 0;
    const regularClears = count(raw?.regularClears, regularClearCount);
    const oblivionClears = regularClears === regularClearCount && Array.isArray(raw?.oblivionClears)
      ? [...new Set(raw.oblivionClears.filter(n => Number.isInteger(n) && n >= 0 && n < bosses.length))]
      : [];
    return {
      regularClears, oblivionClears,
      announcedClears: count(raw?.announcedClears, regularClears),
      announcedOblivion: count(raw?.announcedOblivion, oblivionClears.length)
    };
  }

  function isUnlocked(progress: RaidProgress, index: number, difficulty: RaidDifficulty): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= bosses.length) return false;
    switch (difficulty) {
      case 'OMEN': return progress.regularClears >= index * 2;
      case 'CALAMITY': return progress.regularClears >= index * 2 + 1;
      case 'OBLIVION': return progress.regularClears === regularClearCount;
      default: return false;
    }
  }

  function isCleared(progress: RaidProgress, index: number, difficulty: RaidDifficulty): boolean {
    if (!isUnlocked(progress, index, difficulty)) return false;
    if (difficulty === 'OBLIVION') return progress.oblivionClears.includes(index);
    return progress.regularClears > index * 2 + (difficulty === 'CALAMITY' ? 1 : 0);
  }

  function recordClear(progress: RaidProgress, index: number, difficulty: RaidDifficulty): RaidProgress {
    if (!isUnlocked(progress, index, difficulty) || isCleared(progress, index, difficulty)) return progress;
    if (difficulty === 'OBLIVION') return {...progress, oblivionClears: [...progress.oblivionClears, index]};
    return {...progress, regularClears: progress.regularClears + 1};
  }

  const api = {difficulties, bosses, regularClearCount, readProgress, isUnlocked, isCleared, recordClear};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RaidCampaign = api;
})(typeof window !== 'undefined' ? window : globalThis);
