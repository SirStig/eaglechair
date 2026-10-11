import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applySlotOption, materialSlot, optionKind } from './slotMaterial';

describe('materialSlot', () => {
  it('prefers the glTF extras tag', () => {
    expect(materialSlot({ name: 'Material_0', userData: { ec_slot: 'frame' } })).toBe('frame');
    expect(materialSlot({ name: 'Frame', userData: { ec_slot: 'upholstery' } })).toBe('upholstery');
  });

  it('falls back to the material name', () => {
    expect(materialSlot({ name: 'Seat_Fabric', userData: {} })).toBe('upholstery');
    expect(materialSlot({ name: 'wood_legs', userData: {} })).toBe('frame');
  });

  it('ignores unknown tags and names', () => {
    expect(materialSlot({ name: 'Material_0', userData: { ec_slot: 'glass' } })).toBeNull();
    expect(materialSlot(null)).toBeNull();
  });
});

describe('optionKind', () => {
  it('maps upholstery material types to vinyl or fabric maps', () => {
    expect(optionKind('upholstery', { material_type: 'Vinyl' })).toBe('leather');
    expect(optionKind('upholstery', { material_type: 'Leather' })).toBe('leather');
    expect(optionKind('upholstery', { name: 'Naugahyde Allure' })).toBe('leather');
    expect(optionKind('upholstery', { material_type: 'Fabric' })).toBe('fabric');
    expect(optionKind('upholstery', {})).toBe('fabric');
  });

  it('maps finish types to wood or metal', () => {
    expect(optionKind('frame', { finish_type: 'Wood Stain' })).toBe('wood');
    expect(optionKind('frame', { finish_type: 'Powder Coat' })).toBe('metal');
    expect(optionKind('frame', { finish_type: 'Chrome' })).toBe('metal');
    expect(optionKind('frame', null)).toBeNull();
  });
});

describe('applySlotOption', () => {
  const woodMaterial = () => {
    const m = new THREE.MeshStandardMaterial({ color: '#050403', roughness: 1 });
    m.userData.ec_kind = 'wood';
    m.map = new THREE.Texture();
    return m;
  };

  it('tints with the option colour, keeping the model maps for the same kind', async () => {
    const m = woodMaterial();
    const grain = m.map;
    await applySlotOption([m], { colorHex: '#ffffff', kind: 'wood' });
    expect(m.map).not.toBeNull();
    expect(m.map.source).toBe(grain.source);
    // brightened to offset the grain map's average (0.8)
    expect(m.color.r).toBeCloseTo(1.25, 2);
  });

  it('switches to a smooth metal with no wood grain', async () => {
    const m = woodMaterial();
    await applySlotOption([m], { colorHex: '#cccccc', kind: 'metal' });
    expect(m.map).toBeNull();
    expect(m.metalness).toBe(1);
  });

  it('restores the modelled look for "Original"', async () => {
    const m = woodMaterial();
    const grain = m.map;
    const color = m.color.clone();
    await applySlotOption([m], { colorHex: '#cccccc', kind: 'metal' });
    await applySlotOption([m], null);
    expect(m.map).toBe(grain);
    expect(m.color.equals(color)).toBe(true);
    expect(m.metalness).toBe(0);
  });

  it('scales the grain', async () => {
    const m = woodMaterial();
    await applySlotOption([m], { colorHex: '#8b5a2b', kind: 'wood' }, { grain: 2 });
    expect(m.map.repeat.x).toBeCloseTo(0.5);
  });
});
