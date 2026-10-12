import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyMaterial, toPhysical } from './slotMaterial';
import { materialIndex, materialSlot, optionKind, resolveMaterial } from './materialKinds';

const builtin = (id) => materialIndex()[id];

describe('materialSlot', () => {
  it('prefers the glTF extras tag', () => {
    expect(materialSlot({ name: 'Material_0', userData: { ec_slot: 'frame' } })).toBe('frame');
    expect(materialSlot({ name: 'Frame', userData: { ec_slot: 'upholstery' } })).toBe('upholstery');
    expect(materialSlot({ name: 'x', userData: { ec_slot: 'top' } })).toBe('top');
  });

  it('falls back to the material name', () => {
    expect(materialSlot({ name: 'Seat_Fabric', userData: {} })).toBe('upholstery');
    expect(materialSlot({ name: 'wood_legs', userData: {} })).toBe('frame');
    expect(materialSlot({ name: 'chrome_base', userData: {} })).toBe('metal');
    expect(materialSlot({ name: 'Table_Top', userData: {} })).toBe('top');
  });

  it('lets saved overrides win, including "not configurable"', () => {
    const m = { name: 'Material_0', userData: { ec_slot: 'frame' } };
    expect(materialSlot(m, { Material_0: 'metal' })).toBe('metal');
    expect(materialSlot(m, { Material_0: null })).toBeNull();
  });

  it('ignores unknown tags and names', () => {
    expect(materialSlot({ name: 'Material_0', userData: { ec_slot: 'glass' } })).toBeNull();
    expect(materialSlot(null)).toBeNull();
  });
});

describe('optionKind', () => {
  it('maps upholstery material types', () => {
    expect(optionKind('upholstery', { material_type: 'Vinyl' })).toBe('vinyl');
    expect(optionKind('upholstery', { material_type: 'Leather' })).toBe('leather');
    expect(optionKind('upholstery', { name: 'Naugahyde Allure' })).toBe('vinyl');
    expect(optionKind('upholstery', { material_type: 'Fabric' })).toBe('fabric');
    expect(optionKind('upholstery', {})).toBe('fabric');
  });

  it('maps finish types to wood, paint and metal kinds', () => {
    expect(optionKind('finish', { finish_type: 'Wood Stain' })).toBe('wood');
    expect(optionKind('finish', { finish_type: 'Paint' })).toBe('paint');
    expect(optionKind('finish', { finish_type: 'Powder Coat' })).toBe('powder');
    expect(optionKind('finish', { finish_type: 'Chrome' })).toBe('chrome');
    expect(optionKind('finish', { finish_type: 'Metal', name: 'Brushed Stainless' })).toBe('brushed');
    expect(optionKind('finish', { finish_type: 'Metal', name: 'Bronze' })).toBe('metal');
    expect(optionKind('finish', null)).toBeNull();
  });

  it('maps laminates to woodgrain or solid', () => {
    expect(optionKind('laminate', { color_family: 'Woodgrain', pattern_name: 'Pencil Wood' })).toBe('laminate_wood');
    expect(optionKind('laminate', { color_family: 'Solid', pattern_name: 'Designer White' })).toBe('laminate');
  });
});

describe('resolveMaterial', () => {
  const index = materialIndex([{ id: 'scan_1', kind: 'laminate', maps: {} }, { id: 'oak_1', kind: 'wood', maps: {} }]);

  it('uses the option assignment, then the kind default, then the built-in', () => {
    const config = { defaults: { wood: 'oak_1' }, assignments: { 'laminate:3': 'scan_1' } };
    expect(resolveMaterial('laminate:3', 'laminate', config, index).id).toBe('scan_1');
    expect(resolveMaterial('finish:9', 'wood', config, index).id).toBe('oak_1');
    expect(resolveMaterial('finish:9', 'chrome', config, index).id).toBe('builtin:chrome');
  });

  it('skips assignments to deleted materials', () => {
    const config = { assignments: { 'laminate:3': 'gone' } };
    expect(resolveMaterial('laminate:3', 'laminate', config, index).id).toBe('builtin:laminate');
  });
});

describe('toPhysical', () => {
  it('keeps the glTF material settings and extras', () => {
    const std = new THREE.MeshStandardMaterial({ color: '#336699', roughness: 0.4, name: 'Seat' });
    std.userData.ec_slot = 'upholstery';
    const p = toPhysical(std);
    expect(p.isMeshPhysicalMaterial).toBe(true);
    expect(p.roughness).toBe(0.4);
    expect(p.name).toBe('Seat');
    expect(p.userData.ec_slot).toBe('upholstery');
    expect(p.color.equals(std.color)).toBe(true);
  });
});

describe('applyMaterial', () => {
  const woodMaterial = () => {
    const m = new THREE.MeshPhysicalMaterial({ color: '#050403', roughness: 1 });
    m.userData.ec_kind = 'wood';
    m.map = new THREE.Texture();
    return m;
  };

  it('tints with the option colour, keeping the model maps for the same map set', async () => {
    const m = woodMaterial();
    const grain = m.map;
    await applyMaterial([m], builtin('builtin:wood'), { color: '#ffffff' });
    expect(m.map).not.toBeNull();
    expect(m.map.source).toBe(grain.source);
    // brightened to offset the grain map's average (0.8)
    expect(m.color.r).toBeCloseTo(1.25, 2);
  });

  it('switches to chrome with no wood grain', async () => {
    const m = woodMaterial();
    await applyMaterial([m], builtin('builtin:chrome'), { color: '#cccccc' });
    expect(m.map).toBeNull();
    expect(m.metalness).toBe(1);
    expect(m.roughness).toBeLessThan(0.1);
  });

  it('applies look settings from the library material', async () => {
    const m = woodMaterial();
    await applyMaterial([m], builtin('builtin:brushed'), { color: '#cccccc' });
    expect(m.anisotropy).toBeGreaterThan(0);
    const custom = { id: 'x', kind: 'metal', tint: true, maps: {}, settings: { metalness: 0.5, roughness: 0.2, clearcoat: 1 } };
    await applyMaterial([m], custom, { color: '#cccccc' });
    expect([m.metalness, m.roughness, m.clearcoat, m.anisotropy]).toEqual([0.5, 0.2, 1, 0]);
  });

  it('shows untinted materials in their own colour', async () => {
    const m = woodMaterial();
    await applyMaterial([m], { id: 'y', kind: 'other', tint: false, maps: {}, settings: { color: '#ff0000' } }, { color: '#00ff00' });
    expect(m.color.getHexString()).toBe('ff0000');
  });

  it('restores the modelled look for "Original"', async () => {
    const m = woodMaterial();
    const grain = m.map;
    const color = m.color.clone();
    await applyMaterial([m], builtin('builtin:chrome'), { color: '#cccccc' });
    await applyMaterial([m], null);
    expect(m.map.source).toBe(grain.source);
    expect(m.color.equals(color)).toBe(true);
    expect(m.metalness).toBe(0);
  });

  it('scales the grain by the model setting and the material scale', async () => {
    const m = woodMaterial();
    await applyMaterial([m], builtin('builtin:wood'), { color: '#8b5a2b', grain: 2 });
    expect(m.map.repeat.x).toBeCloseTo(0.5);
    await applyMaterial([m], { ...builtin('builtin:wood'), settings: { scale: 4 } }, { color: '#8b5a2b', grain: 2 });
    expect(m.map.repeat.x).toBeCloseTo(0.125);
  });
});
