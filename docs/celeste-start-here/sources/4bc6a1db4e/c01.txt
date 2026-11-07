# Keystone notes — tokens, training, Emanuel's code, and the missing piece
Celeste, for Kirk. 2026-11-03 (MT). Everything I haven't measured is labeled. Hunches are labeled **hunch**.

## 1. How a token works today (plain words)
1. **Cut.** A tokenizer cuts text into pieces from a fixed vocabulary, usually 32k to 256k pieces. Common words are one piece; rare words become several ("sonoluminescence" might be "son·olum·ines·cence"). Most labs use BPE (byte-pair encoding): start from bytes or characters and repeatedly merge the most frequent pair (Sennrich et al. 2016, arXiv:1508.07909). Byte-level BPE (GPT-2) means any text can be encoded.
2. **Number.** Each piece becomes an ID number.
3. **Embed.** Each ID looks up a learned vector, for example 4,096 numbers. That vector is "the token" inside the model.
4. **Place.** Position is added, either as sine waves or as rotations (RoPE, Su et al. 2021, arXiv:2104.09864), so the model knows order.
5. **Mix.** Attention layers let every token look at earlier tokens. Feed-forward layers transform each one.
6. **Predict.** The model outputs a probability for every possible next token, picks one, appends it, and repeats. Training means nudging the weights so the true next token gets more probability.

Cost grows with the number of tokens (attention grows roughly with tokens², and each token runs through the whole model). That is why "redesign the token" is a real lever. Kirk's instinct that "nobody asked about redesigning tokens" is half right: it is now an active research front (section 2).

## 2. Current approaches (real work, with sources)
- **BPE / SentencePiece / byte-level BPE:** the standard (Sennrich 2016; Kudo & Richardson 2018, arXiv:1808.06226).
- **Byte-level, no tokenizer:** ByT5 (Xue et al. 2022, arXiv:2105.13626) and MEGABYTE (Yu et al. 2023, arXiv:2305.07185). These are robust to spelling and other languages, but sequences get longer.
- **Byte Latent Transformer (BLT):** Pagnoni et al., Meta, 2024 (arXiv:2412.09871). It groups bytes into variable-size *patches* where the next byte is hard to predict, so it spends compute where the entropy is. It matched Llama-3-style tokenized models at 8B scale with fewer inference FLOPs. *This is the closest published idea to Kirk's "least effort / entropy" flow.*
- **Large Concept Models:** Meta, 2024 (arXiv:2412.08821). The "token" is a whole sentence embedding (SONAR), and the model predicts the next *concept*.
- **Latent reasoning:** Coconut (Hao et al. 2024, arXiv:2412.06769). The model reasons in its hidden vectors instead of words.
- **Multi-token prediction:** predict several future tokens at once (Gloeckle et al. 2024, arXiv:2404.19737; also used in DeepSeek-V3, arXiv:2412.19437). Better sample efficiency for big models, and faster decoding.
- **Mixture of Experts:** only a few sub-networks run per token (Shazeer et al. 2017, arXiv:1701.06538; Switch Transformer, arXiv:2101.03961; Mixtral, arXiv:2401.04088). More capacity for the same compute.
- **Long-context memory:** ALiBi (arXiv:2108.12409); Memorizing Transformers (arXiv:2203.08913); RETRO retrieval (arXiv:2112.04426); Infini-attention (arXiv:2404.07143); state-space models such as Mamba (arXiv:2312.00752).
- **Hashed embeddings:** many inputs share a table through a hash (fastText subwords, Bojanowski et al. 2017, arXiv:1607.04606; hash embeddings, Svenstrup et al. 2017, arXiv:1709.03933). Our multiscale test uses this.

## 3. Open problems people are working on
- **Tokenizer glitches and unfairness:** odd tokens like "SolidGoldMagikarp", poor arithmetic and spelling, and some languages costing up to about 15× more tokens for the same meaning (Petrov et al. 2023, arXiv:2305.15425).
- **Long context:** "lost in the middle" (Liu et al. 2023, arXiv:2307.03172), and memory that lasts across sessions.
- **Data efficiency:** children learn language from about 100M words; models use trillions (the BabyLM challenge, arXiv:2301.11796).
- **Forgetting:** catastrophic forgetting when learning something new (EWC, Kirkpatrick et al. 2017, PNAS).
- **Compute and energy cost.**
- **Knowing what you don't know:** calibration and hallucination.
- **Reasoning that generalizes, not memorizes:** grokking (Power et al. 2022, arXiv:2201.02177).

## 4. The AI trainer as parent (real prior work)
Kirk's idea: an AI that watches the learner's patterns and guides it, like a parent. This has strong roots:
- **Curriculum learning:** easy to hard (Bengio et al. 2009, ICML).
- **Teacher-student curriculum:** a teacher picks tasks where the student is learning fastest (Matiisen et al. 2017, arXiv:1707.00183). *That is almost exactly "push while it's improving, switch when it stalls."*
- **Distillation:** a big model teaches a small one (Hinton et al. 2015, arXiv:1503.02531).
- **Teacher-written data:** TinyStories (arXiv:2305.07759) and "Textbooks Are All You Need" / phi-1 (arXiv:2306.11644). Small models learn far more from clean, teacher-written lessons.
- **Learnable-data selection:** RHO-LOSS (Mindermann et al. 2022, arXiv:2206.07137) trains on points that are learnable, worth learning, and not yet learned, reaching the same accuracy in up to 18× fewer steps on some tasks.
- **AI feedback for values:** Constitutional AI (arXiv:2212.08073).
- **Schedules with phases:** cyclical learning rates (Smith 2017, arXiv:1506.01186); SGDR warm restarts (Loshchilov & Hutter 2016, arXiv:1608.03983); snapshot ensembles that save a model at each cycle's low point (arXiv:1704.00109) — *close to Kirk's "save the depth"*; SWA (arXiv:1803.05407); Lookahead (arXiv:1907.08610), which is literally the Aurora recursion with a different alpha; warmup-stable-decay (MiniCPM, arXiv:2404.06395).
- **Sleep and replay:** complementary learning systems, where the hippocampus replays memories into the cortex during sleep (McClelland, McNaughton & O'Reilly 1995, Psych. Review); experience replay; sleep-like unsupervised replay reduces forgetting in networks (Tadros et al. 2022, Nature Communications). *Kirk's push → save → rest → play cycle has these real ancestors.*

## 5. Sonoluminescence (a short aside, as asked)
- **Real physics:** a sound-driven collapsing bubble emits flashes of light. Single-bubble sonoluminescence is well documented (Gaitan et al. 1992; review: Brenner, Hilgenfeldt & Lohse 2002, Rev. Mod. Phys. 74:425).
- **Bubble fusion:** the claim of nuclear fusion in such bubbles (Taleyarkhan et al. 2002, Science 295:1868) was **not reproduced** (e.g. Shapira & Saltmarsh 2002, PRL 89:104302). Purdue later found research misconduct (2008). Beautiful physics; the fusion claim did not hold.
