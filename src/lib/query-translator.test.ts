import { describe, expect, it } from 'vitest';
import type { RuleGroupType } from 'react-querybuilder';
import {
  applyQueryRules,
  areRuleValuesReadyForSubmit,
  buildRuleFilterSignature,
  buildRuleFilterParams,
} from './query-translator';

class FakeFilterBuilder {
  calls: Array<[string, ...unknown[]]> = [];

  eq(field: string, value: unknown) {
    this.calls.push(['eq', field, value]);
    return this;
  }

  neq(field: string, value: unknown) {
    this.calls.push(['neq', field, value]);
    return this;
  }

  gt(field: string, value: unknown) {
    this.calls.push(['gt', field, value]);
    return this;
  }

  lt(field: string, value: unknown) {
    this.calls.push(['lt', field, value]);
    return this;
  }

  gte(field: string, value: unknown) {
    this.calls.push(['gte', field, value]);
    return this;
  }

  lte(field: string, value: unknown) {
    this.calls.push(['lte', field, value]);
    return this;
  }

  ilike(field: string, value: unknown) {
    this.calls.push(['ilike', field, value]);
    return this;
  }

  in(field: string, value: unknown) {
    this.calls.push(['in', field, value]);
    return this;
  }

  is(field: string, value: unknown) {
    this.calls.push(['is', field, value]);
    return this;
  }

  not(field: string, operator: string, value: unknown) {
    this.calls.push(['not', field, operator, value]);
    return this;
  }

  or(expression: string) {
    this.calls.push(['or', expression]);
    return this;
  }
}

function createBaseQuery(builder: FakeFilterBuilder) {
  return {
    select: (cols: string, opts?: unknown) => {
      builder.calls.push(['select', cols, opts]);
      return builder;
    },
  };
}

describe('query translator', () => {
  it('builds PostgREST params for every supported visual operator', () => {
    const rules: RuleGroupType = {
      combinator: 'and',
      rules: [
        { field: 'name', operator: '=', value: 'Ada' },
        { field: 'status', operator: '!=', value: 'archived' },
        { field: 'age', operator: '>', value: '30' },
        { field: 'score', operator: '<', value: '100' },
        { field: 'created_rank', operator: '>=', value: '2' },
        { field: 'priority', operator: '<=', value: '5' },
        { field: 'title', operator: 'contains', value: 'engineer' },
        { field: 'slug', operator: 'beginsWith', value: 'supabase' },
        { field: 'email', operator: 'endsWith', value: '.com' },
        { field: 'role', operator: 'in', value: 'admin,editor' },
        { field: 'deleted_at', operator: 'isNull', value: '' },
        { field: 'published_at', operator: 'isNotNull', value: '' },
        { field: 'subtitle', operator: 'isEmpty', value: '' },
        { field: 'summary', operator: 'isNotEmpty', value: '' },
      ],
    };

    expect(buildRuleFilterParams(rules)).toEqual([
      { key: 'name', value: 'eq.Ada' },
      { key: 'status', value: 'neq.archived' },
      { key: 'age', value: 'gt.30' },
      { key: 'score', value: 'lt.100' },
      { key: 'created_rank', value: 'gte.2' },
      { key: 'priority', value: 'lte.5' },
      { key: 'title', value: 'ilike.*engineer*' },
      { key: 'slug', value: 'ilike.supabase*' },
      { key: 'email', value: 'ilike.*.com' },
      { key: 'role', value: 'in.(admin,editor)' },
      { key: 'deleted_at', value: 'is.null' },
      { key: 'published_at', value: 'not.is.null' },
      { key: 'subtitle', value: 'eq.' },
      { key: 'summary', value: 'neq.' },
    ]);
  });

  it('builds nested and/or preview params', () => {
    const rules: RuleGroupType = {
      combinator: 'or',
      rules: [
        { field: 'status', operator: '=', value: 'active' },
        {
          combinator: 'and',
          rules: [
            { field: 'age', operator: '>', value: '30' },
            { field: 'name', operator: 'contains', value: 'sam' },
          ],
        },
      ],
    };

    expect(buildRuleFilterParams(rules)).toEqual([
      {
        key: 'or',
        value: '(status.eq.active,and(age.gt.30,name.ilike.*sam*))',
      },
    ]);
  });

  it('coerces number and boolean fields before applying filters', () => {
    const builder = new FakeFilterBuilder();
    const rules: RuleGroupType = {
      combinator: 'and',
      rules: [
        { field: 'age', operator: '>=', value: '42' },
        { field: 'enabled', operator: '=', value: 'true' },
      ],
    };

    applyQueryRules(
      createBaseQuery(builder) as never,
      rules,
      '*',
      'exact',
      { age: 'number', enabled: 'boolean' }
    );

    expect(builder.calls).toContainEqual(['gte', 'age', 42]);
    expect(builder.calls).toContainEqual(['eq', 'enabled', true]);
  });

  it('applies top-level or groups through Supabase or expressions', () => {
    const builder = new FakeFilterBuilder();
    const rules: RuleGroupType = {
      combinator: 'or',
      rules: [
        { field: 'name', operator: 'contains', value: 'ada' },
        { field: 'enabled', operator: '=', value: 'true' },
      ],
    };

    applyQueryRules(
      createBaseQuery(builder) as never,
      rules,
      '*',
      'exact',
      { enabled: 'boolean' }
    );

    expect(builder.calls).toContainEqual(['or', 'name.ilike.*ada*,enabled.eq.true']);
  });

  it('holds incomplete structured values out of preview params and requests', () => {
    const builder = new FakeFilterBuilder();
    const rules: RuleGroupType = {
      combinator: 'and',
      rules: [
        { field: 'id', operator: '=', value: '84218236-b0f5' },
        { field: 'created_at', operator: '=', value: '2026-03-30T05:26:34' },
      ],
    };
    const fieldTypes = {
      id: 'uuid',
      created_at: 'timestamptz',
    };

    expect(areRuleValuesReadyForSubmit(rules, fieldTypes)).toBe(false);
    expect(buildRuleFilterParams(rules, fieldTypes)).toEqual([]);

    applyQueryRules(createBaseQuery(builder) as never, rules, '*', 'exact', fieldTypes);

    expect(builder.calls).toEqual([['select', '*', { count: 'exact' }]]);
  });

  it('keeps in-progress value rules out of the executable filter signature', () => {
    const emptyRules: RuleGroupType = {
      combinator: 'and',
      rules: [],
    };
    const inProgressRules: RuleGroupType = {
      combinator: 'and',
      rules: [{ field: 'name', operator: '=', value: '' }],
    };
    const completeRules: RuleGroupType = {
      combinator: 'and',
      rules: [{ field: 'name', operator: '=', value: 'Ada' }],
    };

    expect(buildRuleFilterSignature(inProgressRules)).toBe(
      buildRuleFilterSignature(emptyRules)
    );
    expect(buildRuleFilterSignature(completeRules)).not.toBe(
      buildRuleFilterSignature(emptyRules)
    );
  });

  it('allows complete structured values through preview params and requests', () => {
    const builder = new FakeFilterBuilder();
    const rules: RuleGroupType = {
      combinator: 'and',
      rules: [
        { field: 'id', operator: '=', value: '84218236-b0f5-4e8c-b2d0-890e8a47fe2a' },
        { field: 'created_at', operator: '=', value: '2026-03-30T05:26:34+00:00' },
      ],
    };
    const fieldTypes = {
      id: 'uuid',
      created_at: 'timestamptz',
    };

    expect(areRuleValuesReadyForSubmit(rules, fieldTypes)).toBe(true);
    expect(buildRuleFilterParams(rules, fieldTypes)).toEqual([
      { key: 'id', value: 'eq.84218236-b0f5-4e8c-b2d0-890e8a47fe2a' },
      { key: 'created_at', value: 'eq.2026-03-30T05:26:34+00:00' },
    ]);

    applyQueryRules(createBaseQuery(builder) as never, rules, '*', 'exact', fieldTypes);

    expect(builder.calls).toContainEqual([
      'eq',
      'id',
      '84218236-b0f5-4e8c-b2d0-890e8a47fe2a',
    ]);
    expect(builder.calls).toContainEqual(['eq', 'created_at', '2026-03-30T05:26:34+00:00']);
  });
});
