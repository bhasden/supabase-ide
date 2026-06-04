import type { RuleGroupType, RuleType } from 'react-querybuilder';
import type { TableViewState } from './types';

export const EMPTY_RULES: RuleGroupType = {
  combinator: 'and',
  rules: [],
};

function withoutDisabled<T extends { disabled?: unknown }>(value: T): Omit<T, 'disabled'> {
  const next = { ...value };
  delete next.disabled;
  return next;
}

export function stripRuleLocks(group: RuleGroupType): RuleGroupType {
  const groupWithoutLock = withoutDisabled(group as RuleGroupType & { disabled?: boolean });

  return {
    ...groupWithoutLock,
    rules: group.rules.map((rule) => {
      if (isRuleGroup(rule)) return stripRuleLocks(rule);

      return withoutDisabled(rule as RuleType & { disabled?: boolean });
    }),
  };
}

export function createDefaultTableViewState(): TableViewState {
  return {
    rules: stripRuleLocks(EMPTY_RULES),
    sortOrder: null,
  };
}

export function normalizeTableViewState(
  viewState?: Partial<TableViewState>
): TableViewState {
  return {
    rules: viewState?.rules ? stripRuleLocks(viewState.rules) : stripRuleLocks(EMPTY_RULES),
    sortOrder: viewState?.sortOrder ?? null,
  };
}

function isRuleGroup(rule: RuleGroupType['rules'][number]): rule is RuleGroupType {
  return typeof rule === 'object' && rule !== null && 'rules' in rule;
}
