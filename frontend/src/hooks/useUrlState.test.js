import { describe, it, expect } from 'vitest';
import { applySearchUpdates, parseUrlValue, serializeUrlValue } from './useUrlState';

describe('parseUrlValue', () => {
  it('falls back to the default when missing', () => {
    expect(parseUrlValue(null, 'all')).toBe('all');
    expect(parseUrlValue(null, 1)).toBe(1);
  });
  it('follows the default type', () => {
    expect(parseUrlValue('3', 1)).toBe(3);
    expect(parseUrlValue('abc', 1)).toBe(1);
    expect(parseUrlValue('true', false)).toBe(true);
    expect(parseUrlValue('a,b', [])).toEqual(['a', 'b']);
    expect(parseUrlValue('x', '')).toBe('x');
  });
  it('parses nullable numeric ids', () => {
    expect(parseUrlValue('12', null, 'number')).toBe(12);
    expect(parseUrlValue('', null, 'number')).toBe(null);
    expect(parseUrlValue(null, null, 'number')).toBe(null);
  });
});

describe('serializeUrlValue', () => {
  it('drops defaults and empties', () => {
    expect(serializeUrlValue('all', 'all')).toBe(null);
    expect(serializeUrlValue(1, 1)).toBe(null);
    expect(serializeUrlValue('', 'x')).toBe(null);
    expect(serializeUrlValue([], [])).toBe(null);
    expect(serializeUrlValue(false, false)).toBe(null);
  });
  it('keeps non-default values', () => {
    expect(serializeUrlValue(2, 1)).toBe('2');
    expect(serializeUrlValue(['1', 2], [])).toBe('1,2');
    expect(serializeUrlValue(true, false)).toBe('true');
  });
});

describe('applySearchUpdates', () => {
  it('sets, replaces and removes keys while keeping others', () => {
    expect(applySearchUpdates('?a=1&b=2', { b: '3', c: 'x' })).toBe('?a=1&b=3&c=x');
    expect(applySearchUpdates('?a=1&b=2', { a: null, b: '' })).toBe('');
    expect(applySearchUpdates('?page=3', { page: 1 }, { page: 1 })).toBe('');
  });
});
