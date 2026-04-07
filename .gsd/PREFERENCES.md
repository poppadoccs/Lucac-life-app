---
version: 1
token_profile: budget
skill_discovery: suggest
show_token_cost: true

budget_ceiling: 25.00
budget_enforcement: pause
context_pause_threshold: 80

# Override gsd-pi v2.64.0's stale budget-profile model IDs.
# The profile hardcodes claude-sonnet-4-5-20250514 and claude-haiku-4-5-20250414
# which are NOT in the current model registry — gsd2 fails the lookup, falls
# through to the auto-mode-start model, and bleeds tokens onto Opus 4.6.
# Aliases (claude-sonnet-4-6, claude-haiku-4-5) are first-class registry entries
# in pi-ai/models.generated.ts and auto-track the latest snapshot.
models:
  research: claude-haiku-4-5
  planning: claude-sonnet-4-6
  discuss: claude-sonnet-4-6
  execution: claude-sonnet-4-6
  execution_simple: claude-haiku-4-5
  completion: claude-haiku-4-5
  validation: claude-sonnet-4-6
  subagent: claude-haiku-4-5

auto_supervisor:
  model: claude-haiku-4-5
---
