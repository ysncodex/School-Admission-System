import { describe, expect, it } from 'vitest';
import { isValidStudentId, normalizeStudentId } from './student';

describe('student registration number validation', () => {
  it('accepts exactly 17 digits', () => {
    expect(isValidStudentId('20152691234567890')).toBe(true);
  });

  it('rejects values that are too short or contain non-digits', () => {
    expect(isValidStudentId('12345')).toBe(false);
    expect(isValidStudentId('2015269123456789A')).toBe(false);
  });

  it('trims accidental surrounding whitespace', () => {
    expect(normalizeStudentId(' 20152691234567890 ')).toBe('20152691234567890');
  });
});
