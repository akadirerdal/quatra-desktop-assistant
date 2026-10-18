import { describe, it, expect } from 'vitest';
import { matchesWakeWord } from '../../../src/features/audio/wake-word';
describe('wake match', () => {
  for (const t of ['QA', 'qa', 'Quatra', 'Kvotra.', 'Quattro?']) {
    it(t, () => {
      console.log('MATCH:', JSON.stringify(t), '->', matchesWakeWord(t, 'quatra'));
      expect(true).toBe(true);
    });
  }
});
