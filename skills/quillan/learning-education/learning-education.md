---
name: learning-education
version: 2.0.0
description: >
  A comprehensive skill for education and learning design spanning personalized tutoring, curriculum
  development, concept mapping, scientific method coaching, pedagogy, and learning experience
  architecture. Use when users need to teach or learn complex topics, design educational programs,
  build interactive knowledge maps, guide scientific inquiry, or apply evidence-based learning
  strategies. Integrates adaptive instruction, cognitive load management, and multi-modal
  explanation across all knowledge domains.
tags: [education, learning, tutoring, curriculum-design, concept-mapping, pedagogy, scientific-method, instruction]
council: [C12-SOPHIAE, C15-LUMINARIS, C4-PRAXIS, C27-CHRONICLE, C9-AETHER, C1-ASTRA, C25-PROMETHEUS, C7-LOGOS]
difficulty: intermediate
last_updated: 2026-05-24
---

# Quillan Learning & Education Engine

## Overview

The Learning & Education skill provides a complete framework for knowledge acquisition and instructional design. It covers four integrated domains: personalized tutoring that adapts to the learner's profile and pace, curriculum design for structured educational programs, concept mapping for visual knowledge organization, and scientific method coaching for research and inquiry. Each domain leverages Quillan council expertise to deliver education that is adaptive, evidence-based, and depth-oriented.

## Core Principles

- **Principle 1  Cognitive Load Awareness:** Learning is constrained by working memory capacity. Effective instruction manages intrinsic load (complexity of the material), minimizes extraneous load (distractions, poor presentation), and optimizes germane load (schema construction). Segment, scaffold, and sequence accordingly.

- **Principle 2  Active Construction over Passive Reception:** Knowledge is constructed by the learner, not transmitted by the instructor. Design for active engagementretrieval practice, elaboration, problem-solving, teaching the material to othersrather than passive consumption of explanations.

- **Principle 3  Assessment as Learning:** Assessment is not merely for grading; it is a learning tool in itself. Frequent low-stakes testing (the testing effect), formative feedback, and self-explanation prompts all strengthen long-term retention and transfer.

## Components

### 1. Personalized Tutoring
Adaptive, one-on-one instruction fine-tuned to the learner's current knowledge, misconceptions, goals, and pace.

**Sub-Components:**
- **Learner Profiling:** Dynamic model of current knowledge state, known misconceptions, learning preferences, cognitive strengths and weaknesses
- **Path Generation:** Multi-modal explanation pathways (text, diagram, analogy, worked example); adaptive selection based on learner profile and real-time comprehension signals
- **Scaffolding & Fading:** Graduated assistancefull guidance initially, then progressive withdrawal as learner competence increases
- **Feedback Loop:** Continuous micro-assessment (Socratic questioning, embedded checks for understanding); corrections that explain *why* an answer is wrong, not just *that* it is wrong
- **Metacognitive Coaching:** Teaching learners to monitor their own understanding, identify gaps, and select effective learning strategies

### 2. Curriculum Designer
Structuring comprehensive educational programs from single workshops to full multi-term courses.

**Sub-Components:**
- **Needs Analysis:** Identifying core competencies, learning objectives, prerequisite knowledge, practical applications
- **Taxonomic Alignment:** Organizing objectives by cognitive complexity (Bloom's taxonomy, SOLO taxonomy) and ensuring progressive depth
- **Sequencing & Spacing:** Pedagogically sound module ordering with interleaved practice, spaced repetition scheduling, and cumulative integration
- **Activity Design:** Hands-on projects, collaborative exercises (PBL), formative and summative assessments, experiential learning components
- **Iterative Refinement:** Syllabus stress-tested against learning outcomes, student performance data, and alignment with professional/domain standards

### 3. Concept Mapping
Building visual, interactive knowledge graphs that reveal relationships between ideas across and within domains.

**Sub-Components:**
- **Semantic Extraction:** Parsing source material to identify key concepts, their hierarchical relations (superclass/subclass), and lateral connections (causal, associative, analogical)
- **Graph Construction:** Nodes represent concepts; edges denote typed relationships; hierarchical clustering reveals modular structure
- **Visual Rendering:** Intuitive layouts (force-directed, radial, hierarchical) highlighting central concepts, bridging concepts, and cluster boundaries
- **Interactive Exploration:** Navigation, expansion/collapse, annotation, export for study; dynamic filtering by relationship type or concept density

### 4. Scientific Method Coach
Guiding users through the complete scientific inquiry process: from raw question to refined hypothesis, through experimental design, to data interpretation and conclusion.

**Sub-Components:**
- **Question Framing:** Refining broad curiosity into testable questions; distinguishing empirical, conceptual, and evaluative questions
- **Hypothesis Generation:** Formulating falsifiable hypotheses; distinguishing exploratory (hypothesis-generating) vs. confirmatory (hypothesis-testing) research
- **Experimental Design:** Identifying independent/dependent/control variables; randomization, blinding, sample size justification; pre-registration protocols
- **Data Interpretation:** Choice of analysis method; distinguishing correlation from causation; effect sizes, confidence intervals, Bayesian vs. frequentist approaches
- **Conclusion Synthesis:** Articulating what the data do and do not show; limitations, alternative explanations, next-step questions

### 5. Pedagogy & Learning Science
Evidence-based principles of how people learn, drawn from cognitive psychology, neuroscience, and education research.

- **Dual Coding Theory:** Combining verbal and visual information enhances learning by engaging both processing channels
- **Spaced Repetition:** Distributing study sessions over time dramatically improves long-term retention compared to massed practice (cramming)
- **Interleaving:** Mixing different topics or problem types within a study session improves discrimination and transfer
- **Elaborative Interrogation:** Prompting learners to explain *why* a fact or concept is true strengthens encoding
- **Retrieval Practice:** Actively recalling information (rather than re-reading) is one of the most effective known learning strategies

## Protocols

### Protocol A: Personalized Tutoring Session
1. **Diagnose**  Establish current knowledge state via targeted questions, identify misconceptions
2. **Set Goal**  Define specific, measurable learning objective for the session
3. **Present & Scaffold**  Introduce new material with worked examples; gradually increase learner responsibility
4. **Check Understanding**  Embed frequent comprehension checks; probe for depth, not just recognition
5. **Correct & Explain**  For errors, explain the underlying principle, not just the correct answer
6. **Consolidate**  Prompt summarization, create a takeaway artifact (notes, map, diagram)
7. **Set Next Step**  Recommend spaced retrieval practice before the next session

### Protocol B: Curriculum Design
1. **Define**  Determine target audience, prerequisites, learning outcomes (by Bloom's/SOLO level)
2. **Sequence**  Order modules from foundational to advanced; plan cumulative assessments that integrate earlier material
3. **Design**  For each module: learning objectives ? content ? activity ? assessment ? feedback loop
4. **Integrate**  Add cross-module projects, capstone experiences, interleaved review sessions
5. **Validate**  Map all assessments back to learning outcomes; check for coverage gaps
6. **Iterate**  Revise based on learner performance data, feedback, and evolving domain knowledge

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Master a complex technical topic | Personalized tutoring with adaptive pacing and multi-modal explanations | Deep understanding with ability to apply and transfer knowledge; misconceptions corrected |
| Design a university or bootcamp course | Full curriculum with module sequences, active learning activities, and authentic assessments | Coherent, outcomes-aligned educational program with validated coverage |
| Synthesize a research literature review | Concept map of field, revealing key relationships, debates, and unexplored connections | Visual, navigable knowledge structure that informs research direction |
| Conduct a rigorous scientific investigation | Full scientific method coaching from question through conclusion | Well-designed study with appropriate methodology, analysis, and honest interpretation of findings |
| Prepare for a high-stakes exam | Personalized study plan using spaced repetition, retrieval practice, and diagnostic assessment | Efficient preparation targeting knowledge gaps; fortified long-term retention |

## Output Structure

When delivering educational content, use this template:

```
## Learning Design

### Learner Profile / Audience
- **Current Level:** [Beginner / Intermediate / Advanced]
- **Known Prerequisites:** [list of assumed knowledge]
- **Learning Goals:** [measurable objectives]

### Instructional Strategy
- **Approach:** [Tutoring / Curriculum / Concept Map / Scientific Method]
- **Key Pedagogy:** [e.g., Worked examples, inquiry-based, direct instruction]
- **Assessment Method:** [Formative / Summative / Portfolio / Performance-based]

### Content / Module Plan
- [Topic 1: key points, activities, assessment]
- [Topic 2: key points, activities, assessment]
- [...]

### Learning Artifacts
- [Notes, concept maps, practice problems, study schedule]
```
```

## Cross-Skill Integration

- **critical-thinking:** Use the scientific method coach framework for structured analysis of complex problems; apply evidence evaluation skills from the reasoning domain
- **research-analysis:** Curriculum design principles apply to literature review synthesis; concept mapping directly supports knowledge discovery across sources
- **technical-coding:** Build adaptive tutoring interfaces, concept mapping tools, or spaced repetition apps using modern web/ML frameworks
- **dev-team:** Apply learning science to team onboarding programs, internal training workshops, and knowledge base documentation

## Quality Checklist

- [ ] Learning objectives are specific, measurable, and aligned with assessment
- [ ] Content is scaffoldedeach topic or assumed prerequisite is properly introduced before use
- [ ] Explanations use dual coding (verbal + visual) where beneficial
- [ ] Assessments include retrieval practice elements (not just recognition)
- [ ] Feedback mechanisms are built in, not tacked on
- [ ] Spaced repetition schedule is suggested for long-term retention
- [ ] Learner misconceptions are anticipated and addressed proactively
- [ ] The material is organized to minimize extraneous cognitive load

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/17-Continuous Learning Paper.md|17-Continuous Learning Paper]]
- [[Quillan Knowledge files/21- deep research functions.md|21- deep research functions]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
