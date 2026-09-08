import { describe, expect, it } from 'vitest'
import {
  computeProgress,
  getChecklistStatuses,
  getCompletionCategory,
  getStatusesForFields,
  matchesTrackerFilter,
} from '#/lib/payroll'
import type { ChecklistStatus, PayrollChecklist } from '#/lib/types'

function mockChecklist(
  overrides: Partial<PayrollChecklist> = {},
): PayrollChecklist {
  return {
    id: 'checklist-1',
    employee_id: 'emp-1',
    year: 2026,
    month: 6,
    certificate_of_appearance: 'not_yet_submitted',
    special_order: 'not_yet_submitted',
    override_status: 'not_yet_submitted',
    leave_application: 'not_yet_submitted',
    progress_override: null,
    notes: null,
    updated_by: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeProgress', () => {
  it('uses progress override when set', () => {
    expect(computeProgress([], 75)).toBe(75)
    expect(computeProgress(['not_yet_submitted'], 150)).toBe(100)
    expect(computeProgress(['not_yet_submitted'], -10)).toBe(0)
  })

  it('ignores NaN override and calculates from statuses', () => {
    expect(computeProgress(['completed'], Number.NaN)).toBe(100)
  })

  it('returns 100 when all statuses are not_needed', () => {
    expect(computeProgress(['not_needed', 'not_needed'])).toBe(100)
  })

  it('returns 100 when there are no applicable statuses', () => {
    expect(computeProgress([])).toBe(100)
  })

  it('counts submitted and completed as done', () => {
    expect(
      computeProgress([
        'submitted',
        'completed',
        'not_yet_submitted',
        'not_needed',
      ]),
    ).toBe(67)
  })

  it('returns 0 when nothing is done', () => {
    expect(computeProgress(['not_yet_submitted', 'not_yet_submitted'])).toBe(0)
  })

  it('returns 100 when all applicable items are done', () => {
    expect(computeProgress(['submitted', 'completed'])).toBe(100)
  })
})

describe('getStatusesForFields', () => {
  it('returns defaults when checklist is null', () => {
    expect(
      getStatusesForFields(null, [], ['certificate_of_appearance'], false),
    ).toEqual(['not_yet_submitted'])
  })

  it('filters built-in fields by field keys', () => {
    const checklist = mockChecklist({
      certificate_of_appearance: 'submitted',
      special_order: 'completed',
    })

    expect(
      getStatusesForFields(
        checklist,
        [],
        ['certificate_of_appearance', 'special_order'],
        false,
      ),
    ).toEqual(['submitted', 'completed'])
  })

  it('includes custom values when requested', () => {
    const custom: ChecklistStatus[] = ['completed', 'submitted']

    expect(
      getStatusesForFields(
        null,
        custom,
        ['leave_application'],
        true,
      ),
    ).toEqual(['not_yet_submitted', 'completed', 'submitted'])
  })
})

describe('getChecklistStatuses', () => {
  it('returns all-not-yet-submitted built-ins when checklist is null', () => {
    expect(getChecklistStatuses(null, ['completed'])).toEqual([
      'not_yet_submitted',
      'not_yet_submitted',
      'not_yet_submitted',
      'not_yet_submitted',
      'completed',
    ])
  })

  it('returns built-in and custom statuses from checklist', () => {
    const checklist = mockChecklist({
      certificate_of_appearance: 'submitted',
      special_order: 'completed',
      override_status: 'not_needed',
      leave_application: 'not_yet_submitted',
    })

    expect(getChecklistStatuses(checklist, ['completed'])).toEqual([
      'submitted',
      'completed',
      'not_needed',
      'not_yet_submitted',
      'completed',
    ])
  })
})

describe('getCompletionCategory', () => {
  it('classifies progress into completion buckets', () => {
    expect(getCompletionCategory(100)).toBe('completed')
    expect(getCompletionCategory(101)).toBe('completed')
    expect(getCompletionCategory(50)).toBe('in_progress')
    expect(getCompletionCategory(1)).toBe('in_progress')
    expect(getCompletionCategory(0)).toBe('not_started')
  })
})

describe('matchesTrackerFilter', () => {
  it('matches all employees when filter is all', () => {
    expect(matchesTrackerFilter(0, 'all')).toBe(true)
    expect(matchesTrackerFilter(50, 'all')).toBe(true)
    expect(matchesTrackerFilter(100, 'all')).toBe(true)
  })

  it('matches completed filter at 100%', () => {
    expect(matchesTrackerFilter(100, 'completed')).toBe(true)
    expect(matchesTrackerFilter(99, 'completed')).toBe(false)
  })

  it('matches not_started filter at 0%', () => {
    expect(matchesTrackerFilter(0, 'not_started')).toBe(true)
    expect(matchesTrackerFilter(1, 'not_started')).toBe(false)
  })

  it('matches pending filter for partial progress', () => {
    expect(matchesTrackerFilter(50, 'pending')).toBe(true)
    expect(matchesTrackerFilter(0, 'pending')).toBe(false)
    expect(matchesTrackerFilter(100, 'pending')).toBe(false)
  })
})
