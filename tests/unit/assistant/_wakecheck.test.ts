import { describe, it, expect } from 'vitest';
import { matchesWakeWord } from '../../../src/features/audio/wake-word';
describe('x', () => {
  it('x', () => {
    console.log('matchesWakeWord("saat kaç","quatra") =', matchesWakeWord('saat kaç', 'quatra'));
    expect(true).toBe(true);
  });
});
