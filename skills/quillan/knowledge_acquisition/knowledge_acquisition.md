---
name: knowledge-acquisition
version: 2.0.0
description: >
  A skill for acquiring and structuring knowledge from various sources including information
  extraction, web scraping, and reading comprehension. Provides structured protocols for
  gathering data from documents, extracting structured information from unstructured sources,
  and building knowledge bases from diverse information sources. Use when users need to
  gather data from documents, extract structured information from unstructured sources,
  or build knowledge bases from diverse information sources.
tags: [knowledge-acquisition, information-extraction, web-scraping, comprehension, knowledge-base]
council: [C6-OMNIS, C21-ARCHON, C5-ECHO]
difficulty: intermediate
last_updated: 2026-05-24
---

# Knowledge Acquisition

## Overview
Knowledge acquisition is the process of extracting, structuring, and integrating knowledge from diverse sources into a form that can be used for reasoning, decision-making, and further learning. This skill covers structured approaches to information extraction from text, web scraping techniques, deep reading comprehension, and knowledge base construction. It leverages C6-OMNIS's knowledge synthesis, C21-ARCHON's deep research capability, and C5-ECHO's memory and context management.

## Core Principles
- **Source Quality Determines Knowledge Quality**: Garbage in, garbage out — critically evaluate source reliability before acquisition.
- **Structure Enables Use**: Unstructured information has limited utility; the goal of acquisition is to produce structured, queryable knowledge.
- **Acquisition Is Iterative**: Initial passes surface broad structure; subsequent passes deepen and refine understanding.

## Components

### Information Extraction
The process of automatically extracting structured information from unstructured or semi-structured documents:
- **Named Entity Recognition (NER)**: Identifying entities (people, organizations, locations, dates, quantities) in text
- **Relation Extraction**: Identifying and classifying relationships between entities
- **Event Extraction**: Identifying events, their participants, temporal ordering, and causality
- **Coreference Resolution**: Determining when different expressions refer to the same entity
- **Template Filling**: Populating predefined structured templates from text
- **Open Information Extraction**: Extracting relational tuples without predefined schemas (subject-relation-object triples)

### Web Scraping
The process of systematically extracting data from websites:
- **HTML Parsing**: Navigating and extracting content from HTML document structure
- **API Interfacing**: Accessing structured data through web APIs (REST, GraphQL)
- **Dynamic Content Handling**: Extracting content from JavaScript-rendered pages
- **Rate Limiting and Politeness**: Respecting robots.txt, implementing delays between requests
- **Session Management**: Handling authentication, cookies, and session state
- **Data Deduplication**: Avoiding duplicate content when scraping across multiple sources
- **Scraping Resilience**: Handling network errors, page structure changes, and anti-scraping measures

### Reading Comprehension
The ability to read text, process it, and understand its meaning:
- **Surface Understanding**: Literal comprehension — what the text explicitly states
- **Inferential Understanding**: Reading between the lines — what the text implies
- **Critical Reading**: Evaluating the text's claims, evidence, and reasoning
- **Structural Analysis**: Understanding how the text is organized and how sections relate
- **Synthesis**: Combining information across multiple texts or sections
- **Question Answering**: Extracting specific information in response to queries
- **Summarization**: Producing concise, accurate summaries that capture essential content

## Protocols

### Knowledge Acquisition Protocol
1. **Define Knowledge Requirements**: What knowledge is needed? For what purpose? At what depth?
2. **Identify Sources**: What sources contain the required knowledge? (docs, websites, databases, experts)
3. **Source Evaluation**: Assess each source for authority, accuracy, currency, and relevance
4. **Extraction Strategy**: Choose extraction approach (manual reading, automated scraping, API access, hybrid)
5. **Extract and Structure**: Apply chosen methods to extract information into structured form
6. **Validate and Clean**: Check extracted information for accuracy, completeness, and consistency
7. **Integrate and Index**: Merge with existing knowledge, create indexes for retrieval
8. **Verify and Test**: Verify that the acquired knowledge supports its intended use

### Source Evaluation Protocol
1. **Authority**: Who created the source? What are their credentials?
2. **Accuracy**: Is the information verifiable from other sources? Are there factual errors?
3. **Currency**: When was the information created or last updated? Is it still relevant?
4. **Bias Assessment**: What perspective or agenda does the source represent?
5. **Coverage**: Does the source cover the topic with sufficient depth and breadth?
6. **Stability**: Is the source likely to remain available and unchanged?

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Research literature review | Extract key findings, methods, and data from research papers | Structured research synthesis |
| Competitive intelligence | Scrape and structure competitor product information | Actionable competitive analysis |
| Knowledge base construction | Build structured knowledge from technical documentation | Searchable, queryable knowledge base |
| Legal document analysis | Extract clauses, obligations, and deadlines from contracts | Automated contract management |
| News monitoring | Extract events, entities, and relationships from news feeds | Real-time situation awareness |

## Output Structure
`
---

**Knowledge Domain:** [Topic area]

**Sources Used:**
- [Source URL/Title]: Authority [Rating], Accuracy [Rating], Currency [Rating]

**Extraction Method:** [Manual/Automated/Hybrid]

**Structured Knowledge:**
| Entity/Concept | Property | Value | Source |
|---|---|---|---|
| [Entity] | [Attribute] | [Value] | [Source ref] |

**Relationships:**
- [Entity A] --[Relation]--> [Entity B] (confidence: High/Med/Low)

**Gaps Identified:**
- [What is still unknown or uncertain]

**Quality Assessment:**
- Completeness: [% of target knowledge acquired]
- Accuracy: [Verified vs estimate]
- Currency: [As of date]

**Source Integrity:**
- No sources had extraction errors
- [N] sources had rate-limiting backoff
- [N] sources required dynamic content handling
`

## Cross-Skill Integration
- **research-analysis**: Strategic framing of knowledge acquisition efforts
- **critical-thinking**: Evaluate source quality and detect misinformation
- **technical-coding**: Implement scrapers, parsers, and extraction pipelines
- **cognitive-skills**: Apply reading comprehension and learning strategies
- **execution-skills**: Operate scraping and extraction tools effectively

## Quality Checklist
- [ ] Source quality assessed before extraction begins
- [ ] Multiple sources consulted for cross-verification
- [ ] Structured output captures both explicit content and key implications
- [ ] Extraction method documented for reproducibility
- [ ] Gaps and uncertainties explicitly recorded
- [ ] Sources cited for each extracted fact
- [ ] Deduplication performed when multiple sources cover the same information
- [ ] Rate limiting and politeness respected in web scraping

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[critical-reading.md]]
- [[information-retrieval.md]]
- [[knowledge-synthesis.md]]
- [[note-taking-strategies.md]]
- [[reading-comprehension.md]]
- [[research-methods.md]]
- [[SKILL.md]]
- [[source-evaluation.md]]
- [[Quillan Knowledge files/13-Synthetic Epistemology & Truth Calibration Protocol.md]]
- [[Quillan Knowledge files/12-Multi-Domain Theoretical Breakthroughs Explained.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
