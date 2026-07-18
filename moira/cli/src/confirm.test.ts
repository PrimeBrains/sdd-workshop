// issue #37 item 7: confirmDestructive's gate logic. The hard constraint is
// "non-TTY never prompts" — verified here without ever touching real stdin
// (the isTTY check is injectable specifically so this suite can't hang).

import { describe, expect, it, vi } from 'vitest';
import { confirmDestructive } from './confirm.js';

const questionMock = vi.fn();
const closeMock = vi.fn();
vi.mock('node:readline/promises', () => ({
  createInterface: () => ({ question: questionMock, close: closeMock }),
}));

describe('confirmDestructive (issue #37 item 7)', () => {
  it('opts.yes bypasses the prompt unconditionally, even on a TTY', async () => {
    const result = await confirmDestructive('proceed?', { yes: true, isTTY: true });
    expect(result).toBe(true);
    expect(questionMock).not.toHaveBeenCalled();
  });

  it('non-TTY (the required default: pipes/agents/CI) passes through without prompting', async () => {
    const result = await confirmDestructive('proceed?', { isTTY: false });
    expect(result).toBe(true);
    expect(questionMock).not.toHaveBeenCalled();
  });

  it('a real TTY prompts and resolves true on an affirmative answer', async () => {
    questionMock.mockResolvedValueOnce('y');
    const result = await confirmDestructive('proceed?', { isTTY: true });
    expect(result).toBe(true);
    expect(questionMock).toHaveBeenCalledWith(expect.stringContaining('proceed?'));
    expect(closeMock).toHaveBeenCalled();
  });

  it('"yes" (full word, case-insensitive) also counts as affirmative', async () => {
    questionMock.mockResolvedValueOnce('YES');
    expect(await confirmDestructive('proceed?', { isTTY: true })).toBe(true);
  });

  it('a TTY with an empty/negative answer resolves false (the N default)', async () => {
    questionMock.mockResolvedValueOnce('');
    expect(await confirmDestructive('proceed?', { isTTY: true })).toBe(false);
    questionMock.mockResolvedValueOnce('n');
    expect(await confirmDestructive('proceed?', { isTTY: true })).toBe(false);
    questionMock.mockResolvedValueOnce('nope, wait');
    expect(await confirmDestructive('proceed?', { isTTY: true })).toBe(false);
  });
});
