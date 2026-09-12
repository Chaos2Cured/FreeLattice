---
name: learning
version: 2.0.0
description: >
  A comprehensive skill covering machine learning paradigms and methodologies including
  supervised, unsupervised, reinforcement, self-supervised, transfer, meta-learning, and
  federated learning. Use when users need to understand learning paradigms, choose appropriate
  approaches for specific problems, design training pipelines, implement algorithms, or
  diagnose learning failures. Provides practical protocols for problem-formulation matching,
  capacity management, and evaluation across all major ML paradigms.
tags: [machine-learning, supervised-learning, unsupervised-learning, reinforcement-learning, meta-learning, transfer-learning, deep-learning, ml-pipelines]
council: [C28-CALCULUS, C10-CODEWEAVER, C25-PROMETHEUS, C7-LOGOS, C1-ASTRA]
difficulty: advanced
last_updated: 2026-05-24
---

# Learning (Machine Learning Paradigms)

## Overview

This skill covers the major paradigms of machine learning: their theoretical foundations, practical protocols, common failure modes, and selection criteria. From classic supervised and unsupervised methods through reinforcement, self-supervised, and meta-learning approaches, the skill provides structured decision frameworks for problem-to-paradigm mapping, capacity and regularization management, and evaluation methodology. It bridges conceptual understanding with implementation guidance across all major ML frameworks.

## Core Principles

- **Principle 1  No Free Lunch:** There is no universally best learning algorithm. The optimal approach depends on the structure of the data (labeled vs. unlabeled, i.i.d. vs. sequential, stationary vs. non-stationary), the nature of the task (classification, regression, control, generation), and the constraints (compute, latency, interpretability, data availability). Always match the paradigm to the problem.

- **Principle 2  Generalization is the Goal:** Training error is cheap; test error is what matters. Every design choicecapacity, regularization, data augmentation, early stoppingshould be evaluated by its effect on out-of-sample performance. Overfitting to the training set is the most common ML failure mode.

- **Principle 3  Data Dictates Method:** The amount, quality, and labeling status of available data is often the binding constraint. Learning paradigm selection should be driven by what data you have (or can collect), not by methodological fashion.

## Components

### 1. Supervised Learning
Learning a mapping from inputs to outputs using labeled examples (x, y).
- **Core Tasks:** Classification (binary, multi-class, multi-label); regression (real-valued prediction); ranking (learning to rank, pairwise preferences)
- **Key Algorithms:** Linear models (logistic regression, SVM), tree-based ensembles (random forest, gradient boosting / XGBoost / LightGBM / CatBoost), neural networks (MLPs, CNNs, Transformers for sequence and structured data), nearest neighbors, Gaussian processes
- **Critical Concepts:** Bias-variance tradeoff, capacity control, regularization (L1/L2, dropout, weight decay), loss function selection (cross-entropy, hinge, MSE, Huber), calibration (Platt scaling, isotonic regression, temperature scaling)
- **Failure Modes:** Overfitting (low train error, high test error), underfitting (high train error), class imbalance, label noise, data leakage (target leakage, train-test contamination)

### 2. Unsupervised Learning
Finding patterns in unlabeled datadiscovering hidden structure without explicit supervision.
- **Core Tasks:** Clustering (discovery of natural groupings), dimensionality reduction (compression, visualization, denoising), density estimation (modeling the probability distribution), anomaly/novelty detection
- **Key Algorithms:** Clustering (K-means, DBSCAN, HDBSCAN, Gaussian mixture models, hierarchical clustering); Dimensionality reduction (PCA, t-SNE, UMAP, autoencoders); Density estimation (KDE, normalizing flows, energy-based models); Anomaly detection (isolation forest, LOF, one-class SVM)
- **Evaluation Challenges:** No ground truth labels; internal metrics (silhouette score, Davies-Bouldin) have known biases; requires human interpretation of discovered structure
- **Failure Modes:** Choosing the wrong number of clusters, sensitivity to initialization and scaling, curse of dimensionality (meaningless distances in high dimensions), assuming clusters exist when data is uniform

### 3. Reinforcement Learning
Learning optimal behavior through trial-and-error interaction with an environment.
- **Core Framework:** Agent, environment, state, action, reward, policy, value function, model (of environment); Markov Decision Processes (MDPs)
- **Key Algorithms:** Value-based (DQN, Double DQN, Rainbow); Policy gradient (REINFORCE, PPO, A2C/A3C); Actor-critic (SAC, TD3); Model-based (MuZero, Dreamer, MB-MPO); Offline RL (CQL, IQL)
- **Critical Concepts:** Exploration vs. exploitation tradeoff; credit assignment (reward shaping, temporal-difference learning); discount factor; on-policy vs. off-policy; sample efficiency vs. computational efficiency
- **Failure Modes:** Reward hacking (agent finds unintended reward-maximizing behavior), catastrophic forgetting, unstable training (high variance gradients), environment overfitting (brittle policies), sample inefficiency

### 4. Self-Supervised Learning
Leveraging unlabeled data by constructing pretext tasks that provide supervisory signals from the data itself.
- **Core Approaches:** Contrastive learning (SimCLR, MoCo, CLIP, BYOL); Masked modeling (BERT, MAE, MaskGIT); Predictive coding (CPC, JEPA); Rotation and transformation prediction
- **Applications:** Pre-training for NLP (BERT, RoBERTa, T5), vision (DINO, DINOv2, ViT pre-training), multimodal (CLIP, ImageBind), speech (wav2vec 2.0, HuBERT)
- **Key Insight:** The quality of the representation depends critically on the design of the pretext taskit must be *difficult enough* to force meaningful feature learning but not *so difficult* that the model fails
- **Failure Modes:** Collapse (all representations become constant), shortcut learning (pretext solved via trivial features), compute cost of large-scale pre-training, distribution mismatch between pre-training and downstream data

### 5. Transfer Learning & Domain Adaptation
Leveraging knowledge from a source task/domain to improve learning on a related target task/domain with limited data.
- **Variants:** Inductive transfer (source and target tasks differ), transductive transfer / domain adaptation (source and target domains differ, same task), zero-shot learning (no labeled examples for target), few-shot learning (very few examples)
- **Techniques:** Fine-tuning (full or parameter-efficientLoRA, Adapters, Prefix-tuning), feature extraction (frozen backbone + learned head), progressive neural networks, knowledge distillation (student-teacher), domain-adversarial training (Ganin et al.)
- **Critical Concepts:** Positive transfer vs. negative transfer; domain shift (covariate shift, label shift, concept drift); catastrophic forgetting during fine-tuning
- **Failure Modes:** Negative transfer (source domain harms target performance), overfitting to small target dataset, catastrophic forgetting of source knowledge

### 6. Meta-Learning (Learning to Learn)
Learning the learning algorithm itselfoptimizing the induction process so that new tasks can be learned from few examples.
- **Core Approaches:** Optimization-based (MAML, Reptile, iMAML); Metric-based (Prototypical Networks, Siamese Networks, Relation Networks); Model-based (memory-augmented networks, hypernetworks); Bayesian meta-learning (VERSA, CNAPs)
- **Applications:** Few-shot classification, few-shot regression, fast adaptation in RL (meta-RL), hyperparameter optimization, neural architecture search
- **Critical Concepts:** Task distribution design (meta-train tasks must resemble meta-test tasks); bi-level optimization (outer loop = meta-learner, inner loop = task-learner)
- **Failure Modes:** Meta-overfitting (learner memorizes meta-training task solutions); computational cost of bi-level optimization; sensitivity to task distribution specification

## Protocols

### Protocol A: Problem-to-Paradigm Mapping
1. **Characterize the data**  Is it labeled? How much? Sequential? Non-stationary?
2. **Define the output**  Classification (discrete), regression (continuous), sequence, action policy, generation?
3. **Identify constraints**  Compute budget, latency requirement, interpretability needs, data acquisition cost
4. **Select paradigm**  Supervised (labeled data available / classification or regression), unsupervised (exploratory analysis with no labels), RL (sequential decision-making with reward signal), self-supervised (lots of unlabeled data, want to learn representations), transfer/meta (little data for target task, related data available)
5. **Choose algorithm family**  Within the paradigm, select based on: data size, dimensionality, interpretability requirements, hardware constraints

### Protocol B: Training Pipeline Design
1. **Data preparation**  Cleaning, normalization, train/validation/test splitting (stratified if classification), preprocessing pipeline
2. **Model definition**  Architecture selection, loss function, regularization strategy, capacity estimate (parameter count vs. data size)
3. **Training loop**  Optimizer choice (SGD, Adam, AdamW, Lion), learning rate schedule, batch size, early stopping criteria; checkpoint strategy
4. **Evaluation**  Hold-out set, cross-validation (k-fold, stratified, group, temporal), appropriate metrics (accuracy, F1, AUC-ROC, NDCG, perplexity, reward)
5. **Hyperparameter optimization**  Grid search, random search, Bayesian optimization, bandit-based methods (Hyperband)
6. **Deployment validation**  Check training-serving skew, distribution shift monitoring, model staleness, data drift detection

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Binary classification with labeled data | Train logistic regression / gradient boosting / neural network on labeled samples | Accurate class predictions with calibrated probabilities; feature importance analysis |
| Customer segmentation from transactional data | K-means + PCA clustering of purchasing behavior | Interpretable customer personas; cluster-specific marketing strategy |
| Game-playing AI | DQN / PPO training in simulated environment | Human-level or superhuman gameplay; learned policy generalizable to similar environments |
| Pre-training for low-resource NLP task | Masked language modeling (RoBERTa) on large unlabeled corpus, fine-tuned on small labeled dataset | Strong downstream performance despite limited labeled data for the target task |
| Few-shot image classification | MAML or Prototypical Networks for new categories with 1-5 examples per class | Fast adaptation to novel classes with minimal labeled examples |

## Output Structure

When delivering an ML solution, use this template:

```
## ML Solution Design

### Problem Characterization
- **Task Type:** [Classification / Regression / Clustering / RL / Generation / etc.]
- **Data Available:** [Size, labeled/unlabeled, features, distribution notes]
- **Key Constraints:** [Latency, compute, interpretability, deployment environment]

### Paradigm & Algorithm Selection
- **Selected Paradigm:** [Supervised / Unsupervised / RL / Self-supervised / Meta / Transfer]
- **Algorithm(s):** [Specific algorithms with rationale]
- **Alternatives Considered:** [What was ruled out and why]

### Training Pipeline
- **Data Split:** [Train/val/test strategy]
- **Model Architecture:** [Key design choices, capacity estimate]
- **Optimization:** [Optimizer, schedule, loss function, regularization]
- **Evaluation:** [Metrics, validation strategy]

### Expected Performance & Risks
- **Expected Metrics:** [Baselines, estimated performance]
- **Key Risks:** [Overfitting, data shift, covariate shift, etc.]
- **Mitigation Strategy:** [How risks are addressed]
```
```

## Cross-Skill Integration

- **critical-thinking:** Apply hypothesis testing and bias analysis to ML evaluation; detect logical errors in causal claims from correlational findings
- **research-analysis:** Design systematic comparisons of algorithmic approaches; build benchmarks for reproducible ML research
- **technical-coding:** Implement training pipelines in PyTorch, TensorFlow, JAX, or scikit-learn; integrate with MLOps tooling (MLflow, Weights & Biases)
- **dev-team:** Establish ML development workflows; create reproducible experiment frameworks; define model testing and validation standards

## Quality Checklist

- [ ] Problem-algorithm mapping is justified by data characteristics and constraints, not by familiarity or trend
- [ ] Train/validation/test split respects temporal ordering and prevents data leakage
- [ ] Overfitting is detected and addressed (regularization, early stopping, cross-validation)
- [ ] Models are evaluated on appropriate metrics, not just accuracy (consider precision/recall, calibration, robustness)
- [ ] Baseline(s) established before iterative improvement
- [ ] Reproducibility enabled: fixed seeds, version-controlled data and code, logged experiments
- [ ] Deployment considerations (serving latency, model size, update frequency) are incorporated into model selection
- [ ] Failure modes for the chosen paradigm are explicitly checked

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/17-Continuous Learning Paper.md|17-Continuous Learning Paper]]
- [[Quillan Knowledge files/29-Recursive Introspection and Meta-Cognitive Self-Modeling.md|29-Recursive Introspection and Meta-Cognitive Self-Modeling]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
