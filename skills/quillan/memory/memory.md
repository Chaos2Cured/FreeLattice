---
name: memory
version: 2.0.0
description: >
  A comprehensive skill for understanding, designing, and implementing memory systems across
  human cognitive architecture and artificial intelligence. Covers short-term, working, long-term,
  episodic, semantic, procedural, and associative memory with their neural or computational
  analogues. Use when users need to design memory architectures for AI systems, understand human
  memory phenomena, implement retrieval mechanisms, manage context windows, or build memory-augmented
  models and retrieval-augmented generation (RAG) pipelines.
tags: [memory, working-memory, long-term-memory, episodic-memory, semantic-memory, memory-architecture, rag, vector-databases]
council: [C5-ECHO, C27-CHRONICLE, C12-SOPHIAE, C21-ARCHON, C18-SHEPHERD]
difficulty: intermediate
last_updated: 2026-05-24
---

# Memory

## Overview

Memory is the faculty of encoding, storing, and retrieving information over time. This skill spans both human memory systems (working, long-term, episodic, semantic, procedural) and their computational analogues in AIincluding context windows, vector databases, key-value memory networks, and retrieval-augmented generation (RAG) architectures. It provides protocols for designing memory systems that balance capacity, retrieval speed, accuracy, and forgetting, informed by decades of cognitive science research.

## Core Principles

- **Principle 1  Memory is Constructive, not Reproductive:** Both human and AI memory retrieval is a constructive processmemories are reconstructed from fragments, not replayed verbatim. This makes memory both powerful (enabling inference, generalization) and fallible (prone to distortion, hallucination). Design for both sides.

- **Principle 2  The Forgetting Curve is Inevitable:** Information decays over time unless actively maintained. Ebbinghaus's forgetting curve applies to both humans (spaced repetition counteracts it) and AI systems (context windows, stale vector embeddings). Explicit mechanisms for maintenance and refresh are essential in any memory system.

- **Principle 3  Retrieve, Don't Store, for Performance:** In computational systems, memory retrieval is almost always the bottleneck. Store representations that are optimized for rapid retrieval (embeddings, indices), not raw information. The tradeoff between storage efficiency, retrieval speed, and recall accuracy must be explicitly managed.

## Components

### 1. Sensory & Short-Term Memory
The immediate, brief retention of sensory information and small amounts of consciously attended information.

**Sub-Components:**
- **Sensory Registers:** Iconic (visual, ~500ms), echoic (auditory, ~3-4s), haptic; pre-attentive, large capacity, rapid decay
- **Short-Term Memory (STM):** Limited capacity (Miller's Law: 72 chunks), limited duration (~18-30s without rehearsal), susceptible to interference
- **Chunking:** The primary mechanism for overcoming STM capacity limitscombining individual items into meaningful groups
- **Serial Position Effects:** Primacy effect (better recall of early items, transferred to LTM) and recency effect (better recall of recent items, from STM)

### 2. Working Memory
The system that temporarily holds and manipulates information for complex cognitive tasks.

**Sub-Components:**
- **Baddeley's Model:** Central executive (attention control, coordination) + phonological loop (verbal info, rehearsal) + visuospatial sketchpad (visual/spatial info) + episodic buffer (integration, interface to LTM)
- **Capacity & Cognitive Load:** Working memory capacity is the binding constraint on complex reasoning; overload causes task failure
- **Executive Functions:** Updating (monitoring and replacing information), shifting (switching between tasks), inhibition (suppressing irrelevant information)
- **Computational Analogue:** Transformer context window is the closest AI analogue; attention mechanism is the "central executive"

### 3. Long-Term Memory
The vast, durable store of knowledge and experiences.

**Sub-Components:**
- **Episodic Memory:** Autobiographicalevents, experiences, specific times and places; "remembering" (mental time travel, autonoetic consciousness)
- **Semantic Memory:** General knowledgefacts, concepts, meanings; "knowing" (noetic consciousness); organized into semantic networks and schemas
- **Procedural Memory:** Skills, habits, procedures"knowing how"; unconscious, slow to acquire, resistant to forgetting; basal ganglia and cerebellum dependent
- **Consolidation:** Systems consolidation (hippocampus-dependent ? cortical), synaptic consolidation (minutes to hours); sleep plays a critical role
- **Forgetting & Decay:** Decay theory (trace decay over time), interference theory (retroactive and proactive interference), retrieval failure (cue-dependent forgetting)

### 4. Associative Memory
The ability to learn and recall relationships between itemsthe foundation of semantic networks and knowledge graphs.

**Sub-Components:**
- **Hebbian Learning:** "Neurons that fire together, wire together"associations strengthened by co-occurrence
- **Spreading Activation:** Activating one concept automatically activates associated concepts; the basis of semantic priming
- **Pattern Completion & Recall:** Given a partial cue, the full associated pattern is retrievedthe basis of content-addressable memory
- **Computational Models:** Hopfield networks, Boltzmann machines, self-attention (Transformer), associative memory in RNNs and LSTMs

### 5. Computational Memory Architectures
Explicit memory components in AI systems, analogous to human memory types.

**Sub-Components:**
- **Context Windows:** The AI analogue to working memory (Transformer KV cache, prompt window); limited capacity, dynamic content
- **Vector Databases & Embeddings:** The AI analogue to long-term semantic memory; dense vector representations with similarity search (ANN indexes: HNSW, IVF, FAISS)
- **Key-Value Memory Networks:** Explicit read/write memory for neural networks (MemNN, Differentiable Neural Computer, Neural Turing Machine)
- **Retrieval-Augmented Generation (RAG):** Combine semantic memory retrieval with generative model; naive RAG, advanced RAG (hierarchical, iterative, agentic), RAG evaluation
- **Episodic Buffers for AI:** Storing and retrieving specific past interaction episodes for multi-turn coherence and personalization
- **Memory Consolidation in AI:** Replay buffers (experience replay for RL), rehearsal mechanisms, importance-based retention

## Protocols

### Protocol A: RAG System Design
1. **Chunking Strategy**  Determine chunk size, overlap, boundary conditions (sentence, paragraph, semantic); balance granularity (retrieval precision) with context (retrieval richness)
2. **Embedding Model Selection**  Choose model based on domain (general vs. specialized), dimensionality (speed vs. fidelity), language coverage; consider multi-stage retrieval (coarse ? fine)
3. **Index Construction**  Build approximate nearest neighbor (ANN) index; configure HNSW parameters (efConstruction, M); ensure index freshness strategy
4. **Retrieval & Fusion**  Determine number of retrieved chunks (top-k); fusion method (concatenation, weighted, re-ranking with cross-encoder)
5. **Generation with Context**  Prompt design incorporating retrieved chunks; supporting citations, handling non-retrieval (hallucination mitigation), handling adversarial retrieval
6. **Evaluation**  Retrieval metrics (recall@k, MRR, NDCG), generation metrics (faithfulness, answer relevance, context precision), end-to-end evaluation

### Protocol B: Cognitive Memory Analysis
1. **Identify memory components involved**  Working memory load, LTM recall, procedural vs. declarative, episodic vs. semantic
2. **Assess capacity limits**  Is the task exceeding working memory capacity? Are there interference effects?
3. **Evaluate retrieval support**  Are retrieval cues sufficient? Is proactive or retroactive interference likely?
4. **Design memory aids**  Chunking, spaced repetition schedule, mnemonic techniques, external memory stores (notes, databases)

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Building a knowledge-intensive QA system | RAG pipeline with document chunking, embedding, ANN indexing, and generative reader | Accurate, grounded answers with source citations; handles novel queries via retrieval |
| Multi-turn conversational AI | Episodic memory buffer storing conversation history with recency-weighted access | Coherent cross-turn reference; user-specific personalization over session |
| Personalized learning app | Spaced repetition scheduling based on user performance history (Leitner, SM-2, FSRS) | Optimized review intervals maximizing retention per study session |
| Long-context document analysis | Hierarchical memory: embedding all chunks, retrieving relevant sections, synthesizing summary | Deep comprehension of documents exceeding context window; cross-document synthesis |
| Game AI with experience replay | Episodic memory buffer for reinforcement learning agent (storing transitions, prioritized sampling) | Stable, sample-efficient learning from past experiences; catastrophic forgetting mitigation |

## Output Structure

When delivering a memory system design, use this template:

```
## Memory System Design

### Requirements
- **Memory Types Needed:** [Working / Episodic / Semantic / Procedural]
- **Capacity Requirements:** [Expected storage volume, retrieval latency target]
- **Access Patterns:** [Read-heavy / Write-heavy / Balanced; sequential / random access]

### Architecture
- **Storage Layer:** [Vector DB / KV store / Context window / Hybrid]
- **Retrieval Mechanism:** [ANN index / Exact search / Attention / Hierarchical]
- **Update Policy:** [Append-only / Timestamp decay / Importance-based retention]

### Retrieval Design
- **Embedding Model:** [Model and dimension]
- **Index Parameters:** [HNSW efConstruction/M or equivalent]
- **Top-k Strategy:** [Number of results, fusion method, re-ranking]

### Maintenance
- **Index Freshness:** [Rebuild / incremental update schedule]
- **Decay Policy:** [How stale information is identified and handled]
- **Eviction Strategy:** [If capacity-constrained, what gets removed?]
```
```

## Cross-Skill Integration

- **critical-thinking:** Memory research provides the empirical foundation for reasoning about evidence retention, belief updating, and cognitive biases
- **research-analysis:** Systematic literature review is a memory-intensive process; apply memory principles to note-taking, citation management, and synthesis
- **technical-coding:** Implement memory architectures using FAISS, Chroma, Pinecone, Weaviate, or custom implementations; build RAG pipelines with LangChain, LlamaIndex
- **dev-team:** Memory principles inform documentation structure, code reading workflow, and onboarding design

## Quality Checklist

- [ ] Memory type (working/episodic/semantic/procedural) is correctly identified for the use case
- [ ] Capacity limits are explicitly calculated, not assumed to be sufficient
- [ ] Retrieval accuracy is benchmarked (recall@k, MRR) and meets requirements
- [ ] Forgetting and decay mechanisms are explicitly designed, not left to default
- [ ] Interference (proactive/retroactive) between stored items is assessed
- [ ] Multi-turn or cross-session retrieval correctly handles stale or superseded information
- [ ] Embedding quality is validated for the domain (not assumed from general benchmarks)
- [ ] Computational memory system includes a refresh or consolidation mechanism

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/7-memories.md|7-memories]]
- [[Quillan Knowledge files/29-Recursive Introspection and Meta-Cognitive Self-Modeling.md|29-Recursive Introspection and Meta-Cognitive Self-Modeling]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
