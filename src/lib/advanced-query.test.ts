import { describe, expect, it } from 'vitest';
import {
  createAdvancedQueryState,
  isAdvancedQuerySubmitKey,
  submitAdvancedQueryDraft,
  updateAdvancedQueryDraft,
} from './advanced-query';

describe('advanced query state', () => {
  it('keeps typed draft changes separate from the submitted query', () => {
    const initial = createAdvancedQueryState('select=id');
    const edited = updateAdvancedQueryDraft(initial, 'select=id&name=eq.Ada');

    expect(edited.draft).toBe('select=id&name=eq.Ada');
    expect(edited.submitted).toBe('select=id');
    expect(edited.dirty).toBe(true);
  });

  it('submits the current draft explicitly', () => {
    const edited = updateAdvancedQueryDraft(createAdvancedQueryState(), 'name=ilike.*Ada*');
    const submitted = submitAdvancedQueryDraft(edited);

    expect(submitted.draft).toBe('name=ilike.*Ada*');
    expect(submitted.submitted).toBe('name=ilike.*Ada*');
    expect(submitted.dirty).toBe(false);
  });

  it('uses Ctrl+Enter or Cmd+Enter as the submit shortcut', () => {
    expect(isAdvancedQuerySubmitKey({ key: 'Enter', ctrlKey: true })).toBe(true);
    expect(isAdvancedQuerySubmitKey({ key: 'Enter', metaKey: true })).toBe(true);
    expect(isAdvancedQuerySubmitKey({ key: 'Enter' })).toBe(false);
    expect(isAdvancedQuerySubmitKey({ key: 'a', ctrlKey: true })).toBe(false);
  });
});
