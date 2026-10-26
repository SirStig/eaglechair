import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectAllToggle from './SelectAllToggle';

afterEach(() => cleanup());

const ids = [1, 2, 3];

describe('SelectAllToggle', () => {
  it('selects every option from an empty list', () => {
    const onChange = vi.fn();
    render(<SelectAllToggle ids={ids} selectedIds={[]} onChange={onChange} group="finishes" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Select all finishes/ }));
    expect(onChange).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('clears every option when all are selected', () => {
    const onChange = vi.fn();
    render(<SelectAllToggle ids={ids} selectedIds={[1, 2, 3]} onChange={onChange} group="finishes" />);
    const box = screen.getByRole('checkbox', { name: /Unselect all finishes/ });
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows a partial selection as indeterminate and fills the rest on click', () => {
    const onChange = vi.fn();
    render(<SelectAllToggle ids={ids} selectedIds={[2]} onChange={onChange} group="finishes" />);
    const box = screen.getByRole('checkbox', { name: /Select all finishes/ });
    expect(box.indeterminate).toBe(true);
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('renders nothing when the list is empty', () => {
    render(<SelectAllToggle ids={[]} selectedIds={[]} onChange={() => {}} group="finishes" />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
