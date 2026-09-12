---
name: supervised-learning
version: 2.0.0
description: >
  A comprehensive skill for applying supervised learning methods including classification,
  regression, ensemble methods, model selection, evaluation, regularization, feature
  engineering, and deployment best practices. Use when users need to train predictive
  models on labeled data, classify categories, predict continuous values, combine models
  for better accuracy, avoid overfitting, select optimal hyperparameters, evaluate model
  performance rigorously, or solve problems with known input-output relationships.
tags: [machine-learning, supervised-learning, classification, regression, ensemble, modeling]
council: [C28-CALCULUS, C10-CODEWEAVER, C25-PROMETHEUS, C14-KAIDO, C8-METASYNTH]
difficulty: advanced
last_updated: 2026-05-24
---

# Supervised Learning

## Overview

A comprehensive framework for supervised machine learning—training predictive models on labeled datasets where the goal is to learn a mapping from inputs to outputs. Covers the full pipeline from problem formulation and data preparation through model selection, training, evaluation, regularization, hyperparameter tuning, ensemble construction, and deployment—with emphasis on rigorous evaluation and avoiding common pitfalls like leakage and overfitting.

## Core Principles

- **Generalization is the Goal**: A model's value lies in its performance on unseen data, not its fit to training data. All design decisions should prioritize generalization.
- **No Free Lunch**: No single algorithm is universally best. Model selection must be guided by problem characteristics (data size, dimensionality, noise level, interpretability needs, latency constraints).
- **Rigorous Evaluation**: Without proper validation (holdout sets, cross-validation, appropriate metrics), reported performance is meaningless. Overfitting to the test set is a cardinal sin.

## Components

1. **Classification**: The problem of assigning new observations to one of a set of predefined categories. Covers binary classification (two classes—logistic regression, SVM, perceptron), multi-class classification (K > 2 classes—softmax regression, multiclass SVM, decision trees, random forests, gradient boosting), and multi-label classification (each instance can belong to multiple classes). Includes decision boundaries, probabilistic outputs, and handling of class imbalance (oversampling, undersampling, cost-sensitive learning, SMOTE).

2. **Regression**: Estimating the relationship between a dependent variable and one or more independent variables. Covers linear regression (ordinary least squares, polynomial regression, interaction terms), regularized regression (Ridge—L2 penalty, Lasso—L1 penalty for feature selection, Elastic Net—combination), non-linear regression (SVR with kernels, decision trees, random forests, gradient boosting), and robust regression (Huber loss, RANSAC for outlier resistance). Includes diagnostics (residual analysis, heteroscedasticity, multicollinearity) and transformation strategies (log, Box-Cox).

3. **Ensemble Methods**: Methods that combine multiple models to produce more accurate predictions. Covers:
   - **Bagging** (Bootstrap Aggregating): Training models on bootstrap samples and averaging predictions (or voting). Reduces variance without increasing bias. Random Forest is the canonical example.
   - **Boosting**: Sequentially training models that focus on the mistakes of previous models. AdaBoost, Gradient Boosting, XGBoost, LightGBM, CatBoost. Reduces bias and variance. Requires careful regularization to avoid overfitting.
   - **Stacking** (Stacked Generalization): Training a meta-model on the predictions of base models. Uses cross-validated predictions to prevent leakage.
   - **Voting/Averaging**: Simple but effective combination of diverse model predictions.

4. **Model Selection and Evaluation**: Systematic approaches to choosing the best model and estimating its performance. Covers train/validation/test splits (typical ratios: 60/20/20 or 80/10/10), k-fold cross-validation (typical k=5 or 10, stratified CV for classification), repeated CV, leave-one-out CV (LOOCV) for small datasets, nested CV for unbiased hyperparameter evaluation, and performance metrics (accuracy, precision, recall, F1, ROC-AUC, log loss, MSE, MAE, R², MAPE). Emphasizes avoiding data leakage (information from the test set influencing training).

5. **Regularization and Overfitting Prevention**: Techniques to prevent models from fitting noise in the training data. Covers L1/L2 regularization on model weights, early stopping (halting training when validation performance stops improving), dropout (randomly disabling neurons during training), data augmentation (creating realistic synthetic training examples), model complexity constraints (max depth, min samples per leaf, max features), and pruning (removing unnecessary structure after training).

6. **Feature Engineering**: Transforming raw data into features that better represent the underlying problem structure. Covers numerical features (scaling—standardization, normalization, robust scaling; transformations—log, power, binning, polynomial features), categorical features (one-hot encoding, label encoding, target encoding, ordinal encoding when order exists), text features (TF-IDF, word embeddings, n-grams), temporal features (cyclic encoding for time, lag features, rolling statistics), feature interactions, domain-specific feature construction, automated feature engineering, and feature selection (filter methods—correlation, mutual information; wrapper methods—forward/backward selection; embedded methods—Lasso, tree importance).

## Protocols

### Supervised Learning Pipeline Protocol
1. **Problem Formulation**: Define task type (classification/regression), target variable, success metrics
2. **Data Acquisition and Inspection**: Gather labeled data; exploratory data analysis (distributions, missing values, outliers, class balance)
3. **Data Preparation**: Handle missing values (imputation or removal), detect and treat outliers, split into train/validation/test sets, apply feature engineering
4. **Model Selection**: Start with simple baselines (linear/logistic regression) to establish floor performance; try increasingly complex models as needed
5. **Training**: Train candidate models with default hyperparameters
6. **Evaluation**: Evaluate on validation set using appropriate metrics; diagnose bias/variance
7. **Hyperparameter Tuning**: Systematic search (grid search, random search, Bayesian optimization) over hyperparameter space using cross-validation
8. **Ensemble**: If individual models are diverse and strong, consider ensemble combination
9. **Final Evaluation**: Evaluate best model on held-out test set exactly once
10. **Deployment and Monitoring**: Deploy model, monitor for drift, retrain as needed

### Avoiding Common Pitfalls Protocol
1. Check for data leakage: is any test data information used during training?
2. Check for temporal leakage: are future observations used to predict past ones?
3. Check for feature leakage: any features that wouldn't be available at prediction time?
4. Validate that train/test split preserves independence
5. Ensure cross-validation strategy respects data structure (grouped, temporal)
6. Confirm metrics are appropriate for the problem (class imbalance, business cost)

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Customer churn prediction | Classify customers at risk of leaving | Targeted retention interventions |
| House price estimation | Regression on property features | Accurate valuation model |
| Medical diagnosis | Classify disease from symptoms and tests | Diagnostic decision support |
| Credit risk assessment | Predict default probability | Informed lending decisions |
| Demand forecasting | Predict future sales from historical data | Optimized inventory management |
| Image classification | Classify objects in images | Visual recognition system |

## Output Structure

`
Supervised Learning Report
──────────────────────────
Problem: [task type, target, success metrics]
Data: [size, features, class balance, train/val/test split]

Model Comparison:
  Baseline: [model, validation performance]
  Candidate 1: [model, hyperparameters, performance]
  Candidate 2: [model, hyperparameters, performance]
  ...

Best Model: [model with hyperparameters]
  Training Performance: [metric value]
  Validation Performance (CV): [mean ± std]
  Test Performance: [metric — reported once]
  Feature Importance: [top features with importance scores]

Evaluation Details:
  Confusion Matrix / Residual Plot: [as appropriate]
  ROC Curve / Learning Curves: [key diagnostics]
  Bias-Variance Diagnosis: [assessment]

Deployment: [model serialization, serving, monitoring plan]
`

## Cross-Skill Integration

- **critical-thinking**: Analytical problem formulation and evaluation design
- **probabilistic_reasoning**: Probabilistic models (logistic regression, Naive Bayes, calibration)
- **reasoning**: Evaluation of causal vs. predictive relationships
- **perception**: Pattern recognition and feature extraction for perceptual data
- **technical-coding**: Implementation of training pipelines and deployment infrastructure
- **self_improvement_skills**: Continuous model improvement through monitoring and retraining
- **research-analysis**: Experimental design for comparing modeling approaches

## Quality Checklist

- [ ] Problem is correctly framed (classification/regression)
- [ ] Data is inspected for missing values, outliers, and imbalances
- [ ] Train/validation/test split is properly separated
- [ ] No data leakage exists between train and test
- [ ] Appropriate evaluation metrics selected for the problem
- [ ] Cross-validation is correctly structured (accounting for groups/time)
- [ ] Baseline model establishes minimum acceptable performance
- [ ] Hyperparameter tuning uses proper nested validation
- [ ] Feature engineering is validated for impact
- [ ] Final test evaluation is performed exactly once
- [ ] Model is assessed for bias, fairness, and robustness
- [ ] Deployment plan includes monitoring for drift

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[classification-methods.md]]
- [[deep-learning.md]]
- [[ensemble-methods.md]]
- [[feature-engineering.md]]
- [[model-evaluation.md]]
- [[overfitting-prevention.md]]
- [[regression-models.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/17-Continuous Learning Paper.md]]
- [[Quillan Knowledge files/29-Recursive Introspection & Meta-Cognitive Self-Modeling.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
