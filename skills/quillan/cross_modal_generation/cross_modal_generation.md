---
name: cross-modal-generation
version: 2.0.0
description: >
  A skill for generating one modality from another including text-to-image, image-to-text,
  text-to-3D, and image-to-3D synthesis. Provides structured protocols for prompt engineering,
  modality alignment, output refinement, and quality validation. Use when users need to
  create images from text, generate descriptions from images, create 3D models from
  descriptions, or convert between different data modalities.
tags: [cross-modal, generation, text-to-image, text-to-3d, multimodal]
council: [C8-METASYNTH, C22-AURELION, C23-CADENCE]
difficulty: intermediate
last_updated: 2026-05-24
---

# Cross-modal Generation

## Overview
Cross-modal generation is the ability to produce content in one modality from input in another — creating images from text descriptions, generating text captions from images, or producing 3D models from textual or visual references. This skill provides protocols for prompt engineering, modality alignment, iterative refinement, and quality validation across modalities. It draws on C8-METASYNTH's creative synthesis, C22-AURELION's aesthetic judgment, and C23-CADENCE's rhythmic and structural sense.

## Core Principles
- **Modality Fidelity**: The generated output must faithfully represent the content and intent of the source modality.
- **Latent Alignment**: Effective cross-modal generation depends on well-aligned shared representations between modalities.
- **Iterative Refinement**: First attempts rarely achieve full quality — refinement cycles are essential for production-grade output.

## Components

### Text-to-Image Synthesis
Generating visual content from textual descriptions:
- **Prompt Engineering**: Crafting precise, descriptive text that guides generation
- **Subject Description**: Clear articulation of the main subject(s), attributes, and actions
- **Style Specification**: Artistic style, medium, artist references, and mood
- **Composition Guidance**: Layout, framing, perspective, and focal elements
- **Negative Prompting**: Specifying what should NOT appear in the output

### Image-to-Text Synthesis
Producing textual descriptions from visual input:
- **Content Detection**: Identifying objects, scenes, actions, and relationships in images
- **Hierarchical Description**: Capturing salient elements at multiple levels (global scene → local details)
- **Contextual Captioning**: Producing descriptions that consider cultural and situational context
- **Style and Mood Description**: Articulating visual aesthetic qualities in language
- **OCR Integration**: Extracting and incorporating text visible within images

### Text-to-3D Synthesis
Generating three-dimensional models from text:
- **Geometry Description**: Specifying shape, proportions, and structural features
- **Material and Texture**: Defining surface properties and visual appearance
- **Spatial Layout**: Describing the arrangement of elements in 3D space
- **Functional Constraints**: Requirements for animation, rigging, or physical simulation
- **Format Targeting**: Specifying output format requirements (mesh, point cloud, implicit surface)

### Image-to-3D Synthesis
Reconstructing 3D geometry from 2D visual references:
- **Multi-view Consistency**: Using multiple reference images to resolve ambiguity
- **Depth Estimation**: Inferring spatial depth from 2D projections
- **Shape Completion**: Filling in geometry not visible in reference images
- **Texture Projection**: Mapping visual textures onto reconstructed geometry
- **Scale Recovery**: Determining absolute or relative scale from 2D input

## Protocols

### Generation Protocol
1. **Source Analysis**: Fully analyze the source input — extract key content, style, structure
2. **Target Specification**: Define the target modality requirements (format, resolution, constraints)
3. **Prompt/Parameter Construction**: Build the generation specification with detailed descriptors
4. **Initial Generation**: Produce a first-pass output
5. **Quality Assessment**: Evaluate against source fidelity, technical quality, and aesthetic standards
6. **Iterative Refinement**: Adjust parameters and regenerate until quality thresholds are met
7. **Final Validation**: Confirm the output meets all requirements and matches source intent

### Prompt Engineering Protocol
1. **Core Subject**: What is the primary subject? (noun + modifiers)
2. **Action/State**: What is happening? (verb + context)
3. **Environment**: Where is it? (setting, background, lighting)
4. **Style**: How should it look? (art style, medium, influences)
5. **Technical Parameters**: Resolution, aspect ratio, quality settings
6. **Negative Constraints**: What should be excluded?

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Concept art | Generate visual concepts from text briefs | Rapid iteration on design ideas |
| Accessibility | Generate image descriptions for visually impaired users | Inclusive content consumption |
| Game development | Create 3D assets from concept sketches | Streamlined asset pipeline |
| Education | Generate visual aids from lesson content | Enhanced learning materials |
| E-commerce | Create product images from descriptions | Catalogs without physical photography |

## Output Structure
`
---

**Source Modality:** [Text/Image/Audio/Other]
**Target Modality:** [Image/Text/3D/Audio/Other]

**Generation Specification:**
- Core subject/concept: [Description]
- Style/aesthetic: [Description]
- Technical requirements: [Resolution, format, constraints]
- Negative constraints: [What to avoid]

**Generation Process:**
- Attempts: [Number with brief results per attempt]
- Final parameters: [Prompt or settings used]

**Quality Assessment:**
- Fidelity to source: [Score 1-10 with rationale]
- Technical quality: [Score 1-10 with issues noted]
- Aesthetic quality: [Score 1-10 with rationale]

**Refinement Notes:** [What was adjusted between iterations]
`

## Cross-Skill Integration
- **advanced-nlg**: Craft precise prompts for text-guided generation
- **advanced-nlu**: Interpret visual content for image-to-text tasks
- **critical-thinking**: Evaluate generated output for logical coherence
- **analogical-reasoning**: Transfer aesthetic patterns across modalities
- **technical-coding**: Automate generation pipelines with API integration

## Quality Checklist
- [ ] Source content is fully analyzed before generation begins
- [ ] Prompt includes both positive specifications and negative constraints
- [ ] Output fidelity to source intent is explicitly assessed
- [ ] Technical quality meets target modality standards
- [ ] Aesthetic quality aligns with intended style or application
- [ ] At least one refinement cycle performed before finalizing
- [ ] Limitations of the generation acknowledged (what the output doesn't capture)

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[audio-to-visual.md]]
- [[content-synthesis.md]]
- [[cross-modal-translation.md]]
- [[image-to-text.md]]
- [[multimodal-fusion.md]]
- [[SKILL.md]]
- [[style-transfer.md]]
- [[text-to-image.md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[Quillan Knowledge files/1-Quillan_architecture_flowchart.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
