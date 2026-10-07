import { describe, it, expect } from 'vitest';
import { companyKey } from './company';

describe('companyKey', () => {
  it('strips corporate suffixes and non-alphanumerics', () => {
    expect(companyKey('Apex Edge Inc.')).toBe('apexedge');
    expect(companyKey('Apex Edge Incorporated')).toBe('apexedge');
    expect(companyKey('Skyline Construction Ltd.')).toBe('skylineconstruction');
    expect(companyKey('Pinnacle Group LLC')).toBe('pinnacle');
    expect(companyKey('Turner-Fleischer Architects Corp')).toBe('turnerfleischerarchitects');
    expect(companyKey('Blue & Gold Co.')).toBe('bluegold');
  });

  it('returns null for empty or placeholder companies', () => {
    expect(companyKey('')).toBeNull();
    expect(companyKey('   ')).toBeNull();
    expect(companyKey(null)).toBeNull();
    expect(companyKey(undefined)).toBeNull();
    expect(companyKey('Commercial Prospect')).toBeNull();
    expect(companyKey('commercial prospect')).toBeNull();
  });
});
