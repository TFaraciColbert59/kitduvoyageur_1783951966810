// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MentionPicker, buildMentionSearchFilter } from '../MentionPicker';

const MARIE = '11111111-1111-4111-8111-111111111111';
const SAM = '22222222-2222-4222-8222-222222222222';

const ROWS = [
  {
    id: MARIE,
    handle: 'marie',
    full_name: 'Marie Dupont',
    avatar_url: null,
  },
  {
    id: SAM,
    handle: 'sam',
    full_name: 'Sam (Le Berger)',
    avatar_url: 'https://example.com/sam.png',
  },
];

const supabase = vi.hoisted(() => {
  const state = {
    table: '',
    columns: '',
    filter: '',
    order: [] as unknown[],
    limit: 0,
    rows: [] as Array<Record<string, unknown>>,
    error: null as { message: string } | null,
    calls: 0,
  };

  const limit = vi.fn(async (value: number) => {
    state.limit = value;
    return { data: state.rows, error: state.error };
  });
  const order = vi.fn((...args: unknown[]) => {
    state.order = args;
    return { limit };
  });
  const or = vi.fn((filter: string) => {
    state.filter = filter;
    return { order };
  });
  const select = vi.fn((columns: string) => {
    state.columns = columns;
    return { or };
  });
  const from = vi.fn((table: string) => {
    state.table = table;
    state.calls += 1;
    return { select };
  });

  return { state, from, select, or, order, limit };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: supabase.from }),
}));

beforeEach(() => {
  supabase.state.rows = ROWS.map((row) => ({ ...row }));
  supabase.state.error = null;
  supabase.state.table = '';
  supabase.state.columns = '';
  supabase.state.filter = '';
  supabase.state.order = [];
  supabase.state.limit = 0;
  supabase.state.calls = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('buildMentionSearchFilter', () => {
  it('returns null for an empty or mention-only query', () => {
    expect(buildMentionSearchFilter('')).toBeNull();
    expect(buildMentionSearchFilter('   ')).toBeNull();
    expect(buildMentionSearchFilter('  @  ')).toBeNull();
  });

  it('normalizes the query and searches both name and handle', () => {
    expect(buildMentionSearchFilter('  @marie ')).toBe(
      'full_name.ilike."%marie%",handle.ilike."%marie%"'
    );
  });

  it('quotes PostgREST reserved characters instead of breaking the filter', () => {
    expect(buildMentionSearchFilter('Dupont, Jean (Le Voyageur)')).toBe(
      'full_name.ilike."%Dupont, Jean (Le Voyageur)%",handle.ilike."%Dupont, Jean (Le Voyageur)%"'
    );
  });

  it('escapes double quotes and backslashes', () => {
    expect(buildMentionSearchFilter('O"Neil\\')).toBe(
      'full_name.ilike."%O\\"Neil\\\\\\\\%",handle.ilike."%O\\"Neil\\\\\\\\%"'
    );
  });

  it('escapes LIKE wildcards so they are searched literally', () => {
    expect(buildMentionSearchFilter('100%')).toBe(
      'full_name.ilike."%100\\\\%%",handle.ilike."%100\\\\%%"'
    );
  });
});

describe('MentionPicker', () => {
  it('queries public_profiles with the expected projection and filter', async () => {
    render(<MentionPicker query="  @marie " onSelect={vi.fn()} onClose={vi.fn()} />);

    await screen.findByRole('option', { name: /Marie Dupont/ });

    expect(supabase.state.table).toBe('public_profiles');
    expect(supabase.state.columns).toBe('id,handle,full_name,avatar_url');
    expect(supabase.state.filter).toBe('full_name.ilike."%marie%",handle.ilike."%marie%"');
    expect(supabase.state.limit).toBe(5);
  });

  it('renders the name, handle and avatar fallback', async () => {
    render(<MentionPicker query="mar" onSelect={vi.fn()} onClose={vi.fn()} />);

    const marie = await screen.findByRole('option', { name: /Marie Dupont/ });
    expect(marie.textContent).toContain('@marie');
    expect(marie.querySelector('img')).toBeNull();

    const sam = screen.getByRole('option', { name: /Sam \(Le Berger\)/ });
    expect(sam.querySelector('img')?.getAttribute('src')).toBe('https://example.com/sam.png');
  });

  it('selects a profile on click and closes', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<MentionPicker query="mar" onSelect={onSelect} onClose={onClose} />);

    const options = await screen.findAllByRole('option');
    fireEvent.click(options[0]);

    expect(onSelect).toHaveBeenCalledWith(ROWS[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates with ArrowUp/ArrowDown and selects with Enter', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<MentionPicker query="mar" onSelect={onSelect} onClose={onClose} />);

    const options = await screen.findAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(ROWS[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<MentionPicker query="mar" onSelect={vi.fn()} onClose={onClose} />);

    await screen.findAllByRole('option');
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when no profile matches', async () => {
    supabase.state.rows = [];
    render(<MentionPicker query="zz" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText('Aucun voyageur trouvé')).toBeTruthy();
  });

  it('shows an error state when the query fails', async () => {
    supabase.state.error = { message: 'boom' };
    render(<MentionPicker query="mar" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText('Recherche indisponible')).toBeTruthy();
  });

  it('renders nothing and does not query for a blank query', async () => {
    const { container } = render(
      <MentionPicker query="   " onSelect={vi.fn()} onClose={vi.fn()} />
    );

    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(supabase.state.calls).toBe(0);
  });
});
