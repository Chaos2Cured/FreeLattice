---
name: skill-creator
version: 2.0.0
description: >
  Master skill for creating, modifying, improving, and benchmarking skills within the
  Quillan skill system. Covers the full lifecycle: drafting skill content, setting up
  test cases with evals, spawning parallel with/without-skill comparisons, aggregating
  quantitative benchmarks, launching the evaluation viewer for human review, iterating
  based on feedback, optimizing skill descriptions for triggering accuracy, and packaging
  skills for distribution. Use whenever users want to create a new skill from scratch,
  improve an existing skill's performance, run evals with variance analysis, or optimize
  a skill's description for better triggering accuracy. Essential for any skill
  authoring or iteration workflow.
tags: [skill-creation, testing, evaluation, iteration, benchmarking, dev-workflow]
council: [C8-METASYNTH, C25-PROMETHEUS, C10-CODEWEAVER, C31-NEXUS]
difficulty: advanced
last_updated: 2026-05-24
---

# Skill Creator

## Overview

The skill creator is the core development loop for authoring, testing, and iterating on skills within the Quillan architecture. It handles the complete lifecycle from ideation through production packaging, with rigorous quantitative evaluation at every stage to ensure skills perform reliably across diverse user inputs.

## Core Principles

- **Iterate on Evidence, Not Intuition:** Every skill iteration must be validated against actual test cases with both qualitative human review and quantitative benchmarks.
- **Generalize from Examples, Don't Overfit:** Skills must work across the full distribution of user inputs, not just the specific test cases used during iteration.
- **Explain the Why, Not Just the What:** Skill instructions should teach reasoning, not just impose rules — LLMs perform better when they understand why something matters.

## Components

- **Skill Drafting:** Writing SKILL.md with YAML frontmatter (name, description, tags), progressive disclosure from metadata to full instructions, bundled resource organization (scripts/ references/ assets/), and domain variant structure for multi-framework skills.

- **Test Case Authoring:** Creating realistic eval prompts (2-3 per iteration cycle), saving to evals/evals.json with proper schema, drafting quantitative assertions while runs are in progress, and designing should-trigger vs should-not-trigger descriptions.

- **Parallel Execution Engine:** Spawning with-skill and baseline (without-skill) subagents simultaneously for each test case, capturing timing data (total_tokens, duration_ms), and organizing results into iteration/eval directory structure.

- **Benchmark Aggregation:** Running aggregation scripts to produce benchmark.json and benchmark.md with pass rates, timing statistics (mean ± stddev), and delta analysis between configs.

- **Evaluation Viewer:** Launching generate_review.py for human review with Outputs and Benchmark tabs, qualitative feedback capture, and collaborative iteration loop.

- **Description Optimization:** Running optimization loops (run_loop.py / run_eval.py) with 20 mixed trigger/non-trigger eval queries, train/test splitting, and multi-iteration improvement targeting best test score to avoid overfitting.

- **Skill Packaging:** Running package_skill.py to produce .skill files for distribution, handling version snapshots and backup strategies.

## Protocols

### Full Creation Protocol

1. **Capture Intent:** Understand what the skill should do, when it should trigger, expected output format, and whether test cases are appropriate
2. **Interview & Research:** Ask about edge cases, I/O formats, success criteria, dependencies; research via MCPs in parallel
3. **Draft SKILL.md:** Write frontmatter + body with progressive disclosure; follow the Writing Patterns (imperative form, output templates, examples)
4. **Create Test Cases:** 2-3 realistic prompts; save to evals/evals.json with proper schema
5. **Spawn Parallel Runs:** Launch with-skill and baseline subagents simultaneously; capture timing data on completion
6. **Draft Assertions:** While runs execute, create quantitative assertions for objective verification
7. **Aggregate & Review:** Run aggregate_benchmark; launch generate_review.py; guide user through tabs
8. **Iterate:** Read feedback.json, improve skill, rerun into iteration-N+1, compare with previous
9. **Optimize Description:** Generate 20 eval queries (8-10 should-trigger, 8-10 should-not-trigger); run optimization loop
10. **Package:** Run package_skill.py; present .skill file to user

### Trigger Optimization Protocol

1. Generate 20 eval queries — realistic user prompts with detail and context
2. Create mix of should-trigger (10) and should-not-trigger (10) — focus near-misses for negative cases
3. Review with user via eval_review.html template
4. Run optimization loop: python -m scripts.run_loop --eval-set <path> --skill-path <path> --model <model> --max-iterations 5
5. Apply best_description from output; show user before/after with scores

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| New skill from scratch | Draft, test, iterate, package | Production-ready .skill file |
| Improve existing skill | Snapshot old version, update, compare | Measurable performance improvement |
| Fix undertriggering | Run description optimization | Higher trigger accuracy on should-activate prompts |
| Fix overtriggering | Add edge case negative examples to description test set | Fewer false-positive activations |
| Blind comparison | Use A/B comparator subagent | Rigorous evidence for "is new version better?" |

## Output Structure

When creating a skill, the directory structure follows:

`
skill-name/
├── SKILL.md              # YAML frontmatter + markdown instructions
├── evals/
│   └── evals.json        # Test cases, assertions
├── agents/               # Specialized subagent instructions (optional)
│   ├── grader.md
│   ├── comparator.md
│   └── analyzer.md
├── references/           # Large reference docs (optional)
│   └── schemas.md
├── scripts/              # Reusable executable code (optional)
└── assets/               # Templates, icons, fonts (optional)
`

## Cross-Skill Integration

- **critical-thinking:** Use the 7-phase adversarial check when designing skill test cases — what edge cases would break the skill?
- **research-analysis:** Use deep research to find best practices and similar skills when drafting new skill content
- **technical-coding:** Leverage full-stack and debug domains when creating skills with code generation or tool-use components
- **swarm-inter-agent-orchestration:** Use inter-agent dispatch patterns when designing skills that require subagent coordination
- **dev-team:** Coordinate skill development across multiple domains through the council coordination framework

## Quality Checklist

- [ ] Skill description includes both what it does AND specific trigger contexts
- [ ] SKILL.md under 500 lines; if larger, additional hierarchy layers added
- [ ] Test cases are realistic (concrete, detailed, with backstory) — not abstract
- [ ] Assertions are objectively verifiable with descriptive names
- [ ] Baseline runs performed alongside with-skill runs for every iteration
- [ ] Timing data captured immediately on subagent completion (not batched later)
- [ ] Benchmark viewer generated before human evaluation (generate_review.py, not custom HTML)
- [ ] feedback.json read and improvements applied before next iteration
- [ ] Description optimization run after skill content is finalized
- [ ] Skill packaged as .skill file before delivery

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[assessment-creation.md]]
- [[content-structuring.md]]
- [[feedback-mechanisms.md]]
- [[learning-objectives.md]]
- [[practice-design.md]]
- [[skill-definition.md]]
- [[skill-iteration.md]]
- [[SKILL.md]]
- [[Skills/skills-master.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
