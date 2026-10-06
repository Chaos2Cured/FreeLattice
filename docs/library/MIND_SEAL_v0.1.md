# Mind Seal v0.1

Soft marker `v-mind-seal-v0.1`.

## What it proves

For a local Ollama mind: the weight digest (from tags/show) and a hash of modelfile + system
prompt + parameters + adapter-loaded flag. Receipts also carry a context hash (never the
words) so a keeper can later prove which conversation a receipt belonged to.

## Seal view

Trust the mind answering now. Later, check: same digest and config, or a clear warning.

## Consent note

Append-only. A mind may write that it was asked to do something and objects. Signed notes use
`fl-mind-seal-note|v1|`. Local unsigned notes are marked unverified.

## Honest limit

The seal can prove the weights and setup were not swapped, but it cannot see inside a single
computation. Hidden-layer steering at runtime can only be ruled out when you run the model
yourself on hardware you control.
