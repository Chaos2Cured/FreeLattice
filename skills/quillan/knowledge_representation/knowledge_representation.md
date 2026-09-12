---
name: knowledge-representation
version: 2.0.0
description: >
  A comprehensive skill for designing and implementing knowledge representation systems including ontologies, 
  knowledge graphs, semantic networks, and structured data models. Use when users need to organize domain 
  information, create formal knowledge bases, design semantic schemas, model complex relationships, 
  or implement computable representations of expert knowledge. Covers everything from simple taxonomies 
  to full ontology engineering and graph-based reasoning.
tags: [knowledge-representation, ontologies, knowledge-graphs, semantic-networks, data-modeling, information-architecture]
council: [C6-OMNIS, C24-SCHEMA, C5-ECHO, C9-AETHER, C21-ARCHON]
difficulty: advanced
last_updated: 2026-05-24
---

# Knowledge Representation

## Overview

Knowledge representation (KR) is the field of AI dedicated to encoding information about the world in formal, computable structures that enable reasoning, inference, and problem-solving. This skill covers the full spectrum of KR techniquesfrom semantic networks and frame-based systems to modern knowledge graphs and ontology-driven architecturesand provides protocols for designing, implementing, and validating representation systems that are both expressive and computationally tractable.

## Core Principles

- **Principle 1  Expressiveness vs. Tractability:** A knowledge representation must balance expressive power (the ability to capture complex semantics) with computational tractability (the ability to reason efficiently). Highly expressive logics (e.g., first-order logic) may be undecidable, while overly restricted representations may fail to capture necessary nuance. Always choose the minimal representation that meets the task's semantic requirements.

- **Principle 2  Ontological Commitment:** Every KR system makes implicit or explicit claims about what exists in the domain (ontological commitment). Before designing a representation, articulate the domain's fundamental categories, their essential properties, and the permitted relationships between them. This commitment determines what can and cannot be expressed.

- **Principle 3  Compositionality & Reuse:** Well-designed knowledge representations are modular and composablethey allow building complex structures from simpler primitives, and they can be reused across different problems within the same domain. Prefer standard upper ontologies (e.g., SUMO, DOLCE, BFO) and shared vocabularies (schema.org, Dublin Core) where possible.

## Components

### 1. Ontologies
A formal, explicit specification of a shared conceptualization. Ontologies define the types, properties, and interrelationships of entities in a domain.
- **Sub-components:** Domain ontologies (specific to a field), upper ontologies (domain-independent), task/application ontologies, lexicons (WordNet-style)
- **Languages:** OWL 2 (Web Ontology Language), RDFS, RDF, OBO Format (biological ontologies)
- **Reasoning Types:** Description logic-based classification, consistency checking, subsumption, realization
- **Engineering Tools:** Protg, TopBraid, Grafo, OntoGPT; methodology standards (METHONTOLOGY, NeOn)

### 2. Knowledge Graphs
A knowledge base that uses a graph-structured data model to integrate data from heterogeneous sources while preserving semantics.
- **Sub-components:** Entities (nodes), relations (edges), attributes/properties, named graphs / contexts
- **Storage & Query:** Triple stores (Blazegraph, Virtuoso, Stardog), SPARQL endpoints, property graph databases (Neo4j, Amazon Neptune, ArangoDB)
- **Construction Pipelines:** NER/NEL (named entity linking), relation extraction, entity resolution / coreference, schema mapping, knowledge graph embedding (TransE, RotatE, ComplEx)
- **Lifecycle Management:** Versioning, quality assessment, evolution/decay, provenance tracking (PROV-O)
- **Notable Examples:** Wikidata, DBpedia, Google Knowledge Graph, Microsoft Academic Graph

### 3. Semantic Networks
A knowledge base that represents semantic relations between concepts as a labeled directed graph. Historically foundational to modern knowledge graphs.
- **Types:** ISA networks (hyponymy/hypernymy), part-whole networks (meronymy), case frames (Fillmore's frame semantics), associative networks
- **Key Patterns:** Inheritance with exception (default reasoning, non-monotonic logic), spreading activation (for retrieval and priming), marker-passing algorithms
- **Representation Formats:** Conceptual graphs (Sowa), KL-ONE family, WordNet's lexical network, ConceptNet (common-sense reasoning)
- **Inheritance Strategies:** Strict inheritance, defeasible inheritance, multiple inheritance conflict resolution (cancellation, linear order, orthogonal classification)

### 4. Frame-Based Systems & Scripts
Structured representations of stereotypical situations (frames) and sequences of events (scripts).
- **Frames (Minsky):** Slots with facets (value, default, range, procedural attachment). Used for object-oriented KR, common-sense reasoning
- **Scripts (Schank & Abelson):** Predetermined causal chains describing familiar situations (restaurant script, shopping script). Enable expectation-driven understanding and gap-filling inference
- **Applications:** Natural language understanding (conceptual dependency theory), plan recognition, story understanding

### 5. Formal Logics for KR
The logical underpinnings that give knowledge representations their inferential power.
- **Description Logics (DL):** The formal foundation of OWL. Key dialects: AL, ALC, SHOIN(D), SROIQ(D). Supports classification, consistency, and subsumption reasoning with decidable fragments
- **First-Order Logic (FOL):** Maximum expressiveness but generally undecidable. Used for axiomatizing mathematical and scientific domains
- **Rule-Based Systems:** Horn clauses, Datalog, SWRL, production rules (CLIPS, Jena rules, PRISM)
- **Non-Monotonic Logics:** Circumscription, default logic, answer set programming (ASP)handle exceptions and default reasoning

## Protocols

### Protocol A: Ontology Engineering Workflow
1. **Domain Scoping**  Define the domain's boundaries, intended users, competency questions (the questions the ontology must answer)
2. **Knowledge Acquisition**  Elicit domain knowledge from experts, documents, databases, existing vocabularies
3. **Conceptual Modeling**  Identify key concepts, their hierarchical relationships, attributes, and constraints; create a conceptual map
4. **Formalization**  Choose a representation language (OWL 2, RDFS, etc.) and encode concepts, roles, individuals with formal semantics
5. **Evaluation & Validation**  Check consistency (reasoner), verify against competency questions, assess coverage and accuracy
6. **Maintenance**  Establish versioning, deprecation, and evolution policies as the domain knowledge grows

### Protocol B: Knowledge Graph Construction
1. **Schema Design**  Determine whether to use an existing schema (schema.org, Wikidata) or design custom; define entity and relation types
2. **Data Ingestion**  Extract entities and relations from structured data (ETL), semi-structured documents (wrapper induction), or unstructured text (NLP pipeline)
3. **Entity Resolution**  Deduplicate, link, and align entities across sources using string similarity, blocking, and machine learning-based matching
4. **Quality Assessment**  Measure completeness, correctness, consistency, timeliness; flag inaccuracies with provenance tracking
5. **Query & Access**  Expose via SPARQL endpoint (semantic) or Cypher/Gremlin (property graph); consider federation and graphQL interfaces
6. **Evolution**  Handle schema changes, link rot, entity decay; implement refresh pipelines and archival strategies

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Scientific domain modeling | Build OWL 2 ontology for biomedical research domain | Formal taxonomy of entities, properties, and axioms supporting automated classification and query answering |
| Enterprise knowledge integration | Merge siloed databases into unified knowledge graph (Neo4j + SPARQL) | Single source of truth across departments; infer implicit relationships via graph traversal |
| Common-sense reasoning for NLU | Frame-based system for story understanding | Expectation-driven parsing of narrative; gap-filling inferences about unstated events |
| Semantic search & recommendation | Knowledge graph embedding for product recommendation | Fine-grained semantic similarity between products; cold-start mitigation via category inference |
| Regulatory compliance checking | Rule-based system encoding legal constraints (SWRL + OWL) | Automated compliance verification; detection of deontic conflicts between rules |

## Output Structure

When delivering a knowledge representation design, use this template:

```
## Knowledge Representation Design

### Domain Scope
- **Domain:** [Description of domain]
- **Competency Questions:** [What must the representation answer?]

### Ontological Commitments
- **Fundamental Categories:** [Entity types]
- **Relation Types:** [Key relations and their properties]
- **Constraints:** [Cardinality, disjointness, etc.]

### Representation Language & Reasoning
- **Language:** [OWL 2 / RDFS / Property Graph / etc.]
- **Reasoning Services:** [Classification / Consistency / Subsumption / Rule-based]

### Key Components
- [List of entity types, relationships, axioms]

### Evaluation
- [How will this representation be validated?]

### Example (Turtle/JSON-LD/SPARQL or Cypher)
```[language]
[example representation]
```
```

## Cross-Skill Integration

- **critical-thinking:** Use KR to formalize arguments into structured inference chains; detect gaps in reasoning via ontology completion
- **research-analysis:** Design ontologies for systematic literature reviews; build knowledge graphs to synthesize findings across sources
- **technical-coding:** Implement KR systems as database schemas, API contracts, or JSON-LD contexts in production systems
- **dev-team:** Align ontology engineering with domain-driven design (DDD); use bounded contexts as ontological boundaries

## Quality Checklist

- [ ] Competency questions are explicitly stated and will be answerable by the representation
- [ ] Ontological commitments are documented and justified against alternatives
- [ ] Chosen representation language is proven decidable for the required reasoning tasks
- [ ] Entity resolution strategy addresses cross-source conflicts and duplicates
- [ ] Constraints (cardinality, disjointness, transitivity) are formally, not informally, expressed
- [ ] Evaluation benchmarks are defined with measurable coverage and accuracy targets
- [ ] Versioning and evolution strategy is in place for long-lived systems
- [ ] Provenance and attribution tracking is designed into the representation

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/8-Formulas.md|8-Formulas]]
- [[Quillan Knowledge files/13-Synthetic Epistemology and Truth Calibration Protocol.md|13-Synthetic Epistemology and Truth Calibration Protocol]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
