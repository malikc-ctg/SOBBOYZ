import { describe, it, expect } from 'vitest';
import {
  toValidServiceType,
  resolveCanonicalSector,
  VALID_SERVICE_TYPE_SET,
} from './sectorUtils';

describe('sectorUtils', () => {
  describe('toValidServiceType', () => {
    it('preserves valid PostgreSQL enum service types', () => {
      expect(toValidServiceType('commercial_cleaning')).toBe('commercial_cleaning');
      expect(toValidServiceType('post_construction_clean')).toBe('post_construction_clean');
      expect(toValidServiceType('standard_clean')).toBe('standard_clean');
      expect(toValidServiceType('deep_clean')).toBe('deep_clean');
      expect(toValidServiceType('strip_and_wax')).toBe('strip_and_wax');
      expect(toValidServiceType('carpet_clean')).toBe('carpet_clean');
    });

    it('maps sector keys and friendly names to valid service types', () => {
      // The bug that triggered the issue: "franchise_owners"
      expect(toValidServiceType('franchise_owners')).toBe('commercial_cleaning');
      expect(toValidServiceType('commercial_office')).toBe('commercial_cleaning');
      expect(toValidServiceType('property_management')).toBe('commercial_cleaning');
      expect(toValidServiceType('industrial_warehouse')).toBe('commercial_cleaning');
      expect(toValidServiceType('medical_healthcare')).toBe('commercial_cleaning');
      expect(toValidServiceType('retail_hospitality')).toBe('commercial_cleaning');
      expect(toValidServiceType('post_construction')).toBe('post_construction_clean');
    });

    it('maps ad-hoc scope descriptions safely', () => {
      expect(toValidServiceType('Final Turnover Clean')).toBe('post_construction_clean');
      expect(toValidServiceType('Carpet Steam Cleaning')).toBe('carpet_clean');
      expect(toValidServiceType('Floor Strip and Wax')).toBe('strip_and_wax');
      expect(toValidServiceType('Debris & Junk Removal')).toBe('junk_removal');
    });

    it('guarantees output is always in VALID_SERVICE_TYPE_SET', () => {
      const inputs = [
        'franchise_owners',
        '',
        null,
        undefined,
        'some unknown service',
        'Corporate Office Cleaning',
        'Restaurant Franchise',
      ];
      for (const input of inputs) {
        const result = toValidServiceType(input);
        expect(VALID_SERVICE_TYPE_SET.has(result)).toBe(true);
      }
    });
  });

  describe('resolveCanonicalSector', () => {
    it('correctly maps franchise keywords and keys', () => {
      expect(resolveCanonicalSector('franchise_owners')).toBe('franchise_owners');
      expect(resolveCanonicalSector('Franchise Owner')).toBe('franchise_owners');
      expect(resolveCanonicalSector('Multi-Unit Franchisee')).toBe('franchise_owners');
    });

    it('correctly maps office and corporate sectors', () => {
      expect(resolveCanonicalSector('commercial_office')).toBe('commercial_office');
      expect(resolveCanonicalSector('Corporate Headquarters')).toBe('commercial_office');
      expect(resolveCanonicalSector('Law Firm / Legal')).toBe('commercial_office');
    });

    it('correctly maps construction sectors', () => {
      expect(resolveCanonicalSector('post_construction')).toBe('post_construction');
      expect(resolveCanonicalSector('post_construction_clean')).toBe('post_construction');
      expect(resolveCanonicalSector('General Contractor')).toBe('post_construction');
      expect(resolveCanonicalSector('Site Super')).toBe('post_construction');
    });

    it('defaults to post_construction when missing', () => {
      expect(resolveCanonicalSector('')).toBe('post_construction');
      expect(resolveCanonicalSector(null)).toBe('post_construction');
      expect(resolveCanonicalSector(undefined)).toBe('post_construction');
    });
  });
});
