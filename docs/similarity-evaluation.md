# Similarity evaluation

This report records a synthetic 40-note pilot for WORK-006. It compares raw cosine scores with cosine scores after subtracting the board's mean embedding. The pilot checks the evaluation pipeline and prepares a blind review sheet. It does not replace real team notes or a teammate's judgment.

## Dataset

The notes describe one goal: help first-year university students form small study groups and keep a useful weekly study habit. The dataset has 40 generated notes in five creator-assigned themes. See [`notes.json`](../data/similarity-evaluation/notes.json); the notes are synthetic, not collected from students or an actual brainstorm.

## Method

The run embedded all 40 notes in one Gemini request with `gemini-embedding-001` at 768 dimensions. It computed raw cosine scores and mean-centered cosine scores from the same vectors. For each method, it selected each note's two nearest neighbors and one nearest note from a different synthetic theme. The run produced 81 unique candidate pairs for review.

The `review-pairs.csv` sheet hides themes, scores, and ranking method so a reviewer can judge each pair without seeing which method selected it. The separate `candidate-rankings.csv` file maps each pair to raw and centered scores and ranks. A reviewer should enter `related`, `unrelated`, or `unclear`, then add their name and any short rationale.

## Results

| Measure | Raw cosine | Mean-centered cosine |
| --- | ---: | ---: |
| Top-two neighbors that shared the synthetic theme | 38 / 80 (47.5%) | 44 / 80 (55.0%) |

Theme agreement is only a rough synthetic proxy. A useful pair can connect different themes, and notes in the same theme can still be unrelated. These rates do not establish which method performs better on real notes. The task's current threshold is 8 cards. The two-neighbor and one-cross-theme counts above are review settings, not final product choices.

## Status and next step

WORK-006 remains in progress. To complete it, replace this pilot with at least 40 real notes on one goal and have a team member review the resulting neighbor pairs. Use the same 768-dimensional vectors for both scoring methods, then choose the small-board threshold and nearest and cross-group candidate counts from the human review.

The evaluator caps each run at one outbound Gemini request and sets the text-only model for this data shape. Google lists `gemini-embedding-001` for text-only use. Google documents that `gemini-embedding-2` aggregates multiple inputs unless each input is sent in a separate content object or batch request. [Gemini embeddings guide](https://ai.google.dev/gemini-api/docs/embeddings).
