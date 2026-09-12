---
name: discourse-and-dialogue
version: 2.0.0
description: >
  A skill for engaging in coherent and meaningful conversations including cohesion,
  coherence, turn-taking, and topic management. Provides structured protocols for
  maintaining logical consistency in conversations, managing dialogue flow, handling
  turn-taking appropriately, and effectively introducing and maintaining topics. Use
  when users need to maintain logical consistency in conversations, manage dialogue
  flow, handle turn-taking appropriately, or introduce and maintain topics effectively.
tags: [discourse, dialogue, conversation, cohesion, coherence, pragmatics]
council: [C16-VOXUM, C9-AETHER, C11-HARMONIA]
difficulty: intermediate
last_updated: 2026-05-24
---

# Discourse and Dialogue

## Overview
Discourse and dialogue skills govern the ability to engage in coherent, meaningful conversations — from casual exchanges to structured debates. This skill covers the linguistic and pragmatic mechanisms that make conversations flow naturally: cohesion between utterances, global coherence across a conversation, appropriate turn-taking, and effective topic management. It leverages C16-VOXUM's articulation expertise, C9-AETHER's semantic connection, and C11-HARMONIA's balance and mediation.

## Core Principles
- **Conversation Is Collaborative**: Dialogue is a joint activity where participants co-construct meaning through turn-taking, repair, and shared grounding.
- **Coherence Is Global, Cohesion Is Local**: Cohesion links adjacent utterances; coherence ensures the overall conversation makes sense as a whole.
- **Grounding Is Continuous**: Participants constantly work to establish and maintain mutual understanding through feedback signals and clarification.

## Components

### Cohesion
The grammatical and lexical linking within and between utterances that holds a conversation together:
- **Reference**: Using pronouns, demonstratives, and definite descriptions to refer back (anaphora) or forward (cataphora)
- **Substitution and Ellipsis**: Replacing or omitting elements recoverable from context
- **Conjunction**: Using connective words (and, but, because, however, therefore) to link ideas
- **Lexical Cohesion**: Repeating key terms, using synonyms, or employing superordinate terms
- **Parallel Structure**: Maintaining consistent grammatical patterns across related utterances

### Coherence
The quality of being logical and consistent across the entire discourse:
- **Global Coherence**: The overall topic structure — the conversation makes sense as a whole
- **Local Coherence**: Adjacent utterances connect logically
- **Topic Maintenance**: Sticking to the current topic rather than jumping arbitrarily
- **Causal and Temporal Ordering**: Events and ideas presented in understandable sequence
- **Discourse Genre Awareness**: Adapting coherence expectations to the type of discourse (narrative, argumentative, instructional)

### Turn-taking
The process by which participants decide who speaks when:
- **Transition Relevance Places (TRPs)**: Points where speaker change is appropriate
- **Turn Construction Units (TCUs)**: Sentences, clauses, or phrases that constitute a complete turn
- **Overlap Management**: Handling simultaneous speech — competitive vs cooperative overlap
- **Repair Mechanisms**: Correcting miscommunications, misunderstandings, or errors in turn-taking
- **Back-channeling**: Listener signals (uh-huh, yeah, nod) that show engagement without taking the turn

### Topic Management
The ability to introduce, maintain, and change topics effectively:
- **Topic Introduction**: Techniques for raising a new topic naturally
- **Topic Maintenance**: Keeping the conversation focused on the current subject
- **Topic Shift**: Transitioning from one topic to another smoothly
- **Topic Drift Prevention**: Recognizing and correcting when a conversation has wandered
- **Topic Nomination**: Selecting which topic to pursue among competing options

## Protocols

### Dialogue Management Protocol
1. **Establish Common Ground**: Confirm shared context before proceeding
2. **Frame the Contribution**: Signal whether you are answering, questioning, elaborating, or redirecting
3. **Make Cohesive Links**: Use reference and conjunction to connect to prior utterances
4. **Monitor Understanding**: Check for listener comprehension through questions or paraphrase
5. **Manage Turn Boundaries**: Signal turn completion or intention to continue clearly
6. **Handle Misunderstanding**: Use repair strategies promptly when breakdowns occur
7. **Close Gracefully**: Summarize, confirm agreement, or signal topic conclusion

### Repair Protocol
1. **Detect Trouble Source**: Identify the utterance or element causing misunderstanding
2. **Initiate Repair**: Signal that repair is needed (huh?, what do you mean?, clarification request)
3. **Perform Repair**: Restate, elaborate, or correct the problematic element
4. **Confirm Resolution**: Verify that the repair resolved the misunderstanding

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Customer support chat | Manage topic flow while resolving issues across multiple channels | Efficient, satisfying resolution |
| Educational dialogue | Guide student discourse toward learning objectives | Focused, productive discussion |
| Team meeting facilitation | Balance turn-taking and topic management in group settings | Inclusive, effective meetings |
| AI conversational agents | Implement natural dialogue management with repair capabilities | More human-like interactions |
| Interviewing | Use topic management to guide interviews while allowing organic exploration | Rich, structured conversations |

## Output Structure
`
---

**Discourse Context:**
- Participants: [Roles and relationships]
- Genre: [Casual/Formal/Instructional/Argumentative]
- Goals: [Shared and individual objectives]

**Cohesion Analysis:**
- Reference chains: [Key referents and how they are tracked]
- Connective patterns: [Primary linking strategies used]

**Turn-taking Pattern:**
- Predominant structure: [A-B alternating / multi-party / interruption-heavy]
- Overlap handling: [Competitive vs cooperative patterns]
- Repair instances: [When and how repairs occurred]

**Topic Structure:**
- Introduced topics: [List with who introduced]
- Topic evolution: [How topics transitioned]
- Topic drift events: [Any significant diversions]

**Grounding Status:**
- Shared understanding: [Level of mutual comprehension]
- Unresolved issues: [Anything still unclear]
`

## Cross-Skill Integration
- **advanced-nlu**: Detect pragmatic intent, sarcasm, and subtext in dialogue
- **advanced-nlg**: Generate responses that maintain cohesion and coherence
- **critical-thinking**: Apply logical consistency to argumentative discourse
- **advanced-social-perception**: Adapt discourse strategy to social context
- **execution-skills**: Implement dialogue management in conversational AI

## Quality Checklist
- [ ] Turns are structured as complete units with clear boundaries
- [ ] Cohesive ties link each utterance to prior context
- [ ] Global coherence is maintained across topic transitions
- [ ] New topics are introduced with clear signals
- [ ] Misunderstandings are repaired promptly when detected
- [ ] Grounding checks are used periodically to confirm shared understanding
- [ ] Back-channeling acknowledges receipt without taking the turn

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[coherence-and-cohesion.md]]
- [[conversation-structure.md]]
- [[dialogue-management.md]]
- [[discourse-markers.md]]
- [[multi-party-dialogue.md]]
- [[rhetorical-structures.md]]
- [[SKILL.md]]
- [[turn-taking.md]]
- [[Quillan Knowledge files/11-Drift Paper.md]]
- [[Quillan Knowledge files/5-ai persona research.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
