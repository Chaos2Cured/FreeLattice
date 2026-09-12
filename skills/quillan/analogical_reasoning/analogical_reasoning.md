---
name: analogical-reasoning
version: 2.0.0
description: >
  A skill for applying analogical reasoning including mapping, inference, and evaluation
  between domains. Provides structured protocols for identifying structural parallels,
  transferring knowledge across domains, and validating analogical inferences. Use when
  users need to draw parallels between different situations, transfer knowledge from
  familiar to unfamiliar contexts, or make creative connections between seemingly
  unrelated concepts.
tags: [analogy, reasoning, mapping, transfer-learning, creativity]
council: [C1-ASTRA, C8-METASYNTH, C7-LOGOS]
difficulty: intermediate
last_updated: 2026-05-24
---

# Analogical Reasoning

## Overview
Analogical reasoning is a powerful cognitive process that identifies structural similarities between disparate domains, enabling knowledge transfer from familiar contexts to unfamiliar ones. This skill provides a structured protocol for the complete analogical reasoning cycle — from source domain selection through mapping, inference, and validation. It combines C1-ASTRA's pattern recognition, C8-METASYNTH's creative synthesis, and C7-LOGOS's logical validation.

## Core Principles
- **Structure Over Surface**: A strong analogy matches relational structure, not superficial attributes. Focus on how elements relate to each other, not their surface appearance.
- **Mapping Must Be Systematic**: Every element in the source domain should have a clearly justified correspondence in the target domain.
- **Inferences Are Hypotheses**: Conclusions drawn from analogies are provisional and must be validated independently.

## Components

### Mapping
The process of identifying correspondences between the source domain (what you know) and the target domain (what you're trying to understand):
- **Attribute Matching**: Correspondences based on shared properties or features
- **Relational Matching**: Correspondence based on shared relationships between elements (cause-effect, part-whole, before-after)
- **Systematicity**: Prioritizing mappings that connect into deeply interconnected relational systems
- **One-to-One Constraint**: Each element in one domain maps to at most one element in the other
- **Parallel Connectivity**: If A maps to B, then relationships involving A should map to corresponding relationships involving B

### Inference
Drawing conclusions about the target domain based on the mapped structure from the source:
- **Candidate Inference**: Propose a property or relationship in the target domain by analogy to the source
- **Elaboration**: Work through the implications of the candidate inference
- **Question Generation**: Use the analogy to identify what we still need to learn about the target
- **Counter-analogy**: Identify where the analogy breaks down to constrain over-extension

### Evaluation
Assessing the validity and usefulness of the analogical mapping:
- **Structural Consistency**: Do the mapped relationships hold under scrutiny?
- **Semantic Plausibility**: Are the inferences consistent with what else is known about the target?
- **Predictive Power**: Does the analogy generate testable predictions?
- **Explanatory Depth**: Does the analogy provide genuine understanding or just apparent insight?
- **Boundary Detection**: Where does the analogy stop being useful?

## Protocols

1. **Source Selection**: Identify a well-understood domain with structural similarity to the target
2. **Sructural Analysis**: Decompose both source and target into their relational structures
3. **Mapping Construction**: Systematically identify correspondences, prioritizing relational over attribute matches
4. **Inference Generation**: Propose candidate properties/relationships in the target based on the mapping
5. **Validity Testing**: Evaluate inferences against existing target knowledge and logical consistency
6. **Boundary Marking**: Document where the analogy breaks down
7. **Synthesis**: Combine insights into a refined understanding of the target

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Teaching complex concepts | Explain unfamiliar concepts using familiar analogies (e.g., electricity as water flow) | Faster comprehension and retention |
| Scientific hypothesis generation | Map known mechanisms from one domain to propose mechanisms in another | Novel research directions |
| Problem-solving | Apply solutions from solved problems to unsolved ones with similar structure | Efficient problem decomposition |
| Product design | Transfer successful design patterns from one product category to another | Innovative feature development |

## Output Structure
`
---

**Source Domain:** [Description of well-understood domain]

**Target Domain:** [Description of the domain being analyzed]

**Structural Mapping:**
| Source Element | Target Element | Type | Confidence |
|---|---|---|---|
| [Element A] | [Element X] | Relational/Attribute | High/Med/Low |

**Inferred Target Properties:**
- [Property 1]: [How derived and confidence]
- [Property 2]: [How derived and confidence]

**Boundary Conditions:**
- Where analogy holds: [Description]
- Where analogy breaks: [Description]
- Over-extension risk: [Identified risks]

**Validation Status:** [Tested/Untested/Partially confirmed]
`

## Cross-Skill Integration
- **critical-thinking**: Evaluate analogical inferences for logical validity
- **causal-reasoning**: Map causal structures between domains
- **cross-modal-generation**: Apply analogical thinking across sensory modalities
- **research-analysis**: Identify analogical patterns across research domains

## Quality Checklist
- [ ] Source domain is genuinely well-understood (not itself uncertain)
- [ ] Mapping prioritizes relational structure over surface attributes
- [ ] At least one boundary condition identified
- [ ] Inferences explicitly marked as provisional
- [ ] Counter-analogies or disanalogies documented
- [ ] One-to-one constraint respected in the mapping

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[analogy-evaluation.md]]
- [[case-based-reasoning.md]]
- [[creative-analogies.md]]
- [[cross-domain-transfer.md]]
- [[metaphor-generation.md]]
- [[SKILL.md]]
- [[source-target-mapping.md]]
- [[structural-alignment.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
