export interface AdvancedQueryState {
  draft: string;
  submitted: string;
  dirty: boolean;
}

export function createAdvancedQueryState(value = ''): AdvancedQueryState {
  return {
    draft: value,
    submitted: value,
    dirty: false,
  };
}

export function updateAdvancedQueryDraft(
  state: AdvancedQueryState,
  draft: string
): AdvancedQueryState {
  return {
    ...state,
    draft,
    dirty: draft !== state.submitted,
  };
}

export function submitAdvancedQueryDraft(state: AdvancedQueryState): AdvancedQueryState {
  return {
    draft: state.draft,
    submitted: state.draft,
    dirty: false,
  };
}

export function isAdvancedQuerySubmitKey(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  return event.key === 'Enter' && (Boolean(event.ctrlKey) || Boolean(event.metaKey));
}
