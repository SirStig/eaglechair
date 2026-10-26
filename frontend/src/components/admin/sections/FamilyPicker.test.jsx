import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FamilyPicker from './FamilyPicker';

afterEach(() => cleanup());

const families = [
  { id: 1, name: 'Alpine' },
  { id: 2, name: 'Harbor' },
  { id: 3, name: 'Lobo' },
];

describe('FamilyPicker select all', () => {
  it('clears every chosen family in one click', () => {
    const onSelectedChange = vi.fn();
    render(
      <FamilyPicker families={families} selectedIds={[1, 2, 3]} onSelectedChange={onSelectedChange} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Unselect all families/ }));
    expect(onSelectedChange).toHaveBeenCalledWith([]);
  });

  it('selects every family, keeping the current primary', () => {
    const onSelectedChange = vi.fn();
    const onPrimaryChange = vi.fn();
    render(
      <FamilyPicker
        families={families}
        primaryId={2}
        onPrimaryChange={onPrimaryChange}
        selectedIds={[]}
        onSelectedChange={onSelectedChange}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Select all families/ }));
    expect(onPrimaryChange).toHaveBeenCalledWith(2);
    expect(onSelectedChange).toHaveBeenCalledWith([1, 3]);
  });

  it('clears the primary family along with the rest', () => {
    const onSelectedChange = vi.fn();
    const onPrimaryChange = vi.fn();
    render(
      <FamilyPicker
        families={families}
        primaryId={1}
        onPrimaryChange={onPrimaryChange}
        selectedIds={[2, 3]}
        onSelectedChange={onSelectedChange}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Unselect all families/ }));
    expect(onPrimaryChange).toHaveBeenCalledWith(null);
    expect(onSelectedChange).toHaveBeenCalledWith([]);
  });
});
