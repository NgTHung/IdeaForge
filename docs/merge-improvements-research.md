# Improving IdeaForge's AI merge

Research memo · 5 October 2026

## Recommendation

Keep the existing two-source ancestry, source contributions, tension, human review, and experiment. Change the merge from one polished answer into a choice among **three distinct, traceable directions**. The person or team should decide which is worth developing; the model should not silently choose its own “best” idea.

This is a testable product hypothesis, not a guarantee. Compare it with the current one-proposal flow using IdeaForge's own examples before keeping the extra UI.

## What IdeaForge already has

The current merge endpoint sends the goal and two source texts to Gemini, asks for a concept, contributions from both notes, a tension, and a next experiment, and validates the JSON with Zod. The UI previews the proposal before acceptance. Accepted notes preserve parent IDs and text snapshots. Keep these: they make this more than a generic “combine these ideas” prompt.

Relevant code: src/app/api/merge/route.ts, src/lib/ideas.ts, and src/components/board.tsx.

## Research findings and design implications

- **AI can improve an individual result while making results more alike.** In a short-fiction experiment, GenAI suggestions improved story ratings, especially for less creative writers, while AI-assisted stories were more similar to one another. Keep the team's raw notes visible and offer alternatives. This was a fiction task, so it is a design clue rather than direct proof about hackathon ideas. [Doshi & Hauser, *Science Advances* (2024)](https://doi.org/10.1126/sciadv.adn5290).
- **Prompt design can affect idea variety.** A GPT-4 study on product ideas for college students found AI idea pools less diverse than human pools; prompt strategy changed diversity, and its tested chain-of-thought condition came closest to human diversity. Test distinct merge strategies on IdeaForge rather than assuming that finding transfers unchanged. [Meincke, Mollick & Terwiesch (2024)](https://arxiv.org/abs/2402.01727).
- **Scaffolding the human-AI workflow can matter.** In an experiment, Supermind Ideator's structured creative problem-solving prompts and specialized UI produced more innovative ideas than ChatGPT or working alone. This supports making IdeaForge's steps visible: compare, inspect the blend, choose, then test. [Heyman et al., *Collective Intelligence* (2024)](https://doi.org/10.1177/26339137241305117).
- **Show how the sources recombine.** Scideator let users recombine facets such as purposes, mechanisms, and evaluations. In a study of 19 computer-science researchers, users identified more interesting ideas with it than with a search-plus-LLM baseline. A lightweight analogue is to show each note's contribution and the mechanism linking them. [Radensky et al. (2024)](https://arxiv.org/abs/2409.14634).
- **Novelty is not feasibility, and model self-ratings are weak evidence.** In a large study with 100+ NLP researchers, LLM research ideas were rated more novel but slightly less feasible than expert ideas; the authors also report diversity and self-evaluation problems. Show an assumption to test, not an AI “quality score.” This was research ideation, not product ideation. [Si et al., ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/ea94957d81b1c1caf87ef5319fa6b467-Abstract-Conference.html).
- **Schema-valid output can still be wrong in meaning.** Gemini's structured output enforces a response format, but Google's documentation says apps should validate the values and handle semantically incorrect results. Zod field lengths cannot prove that a concept truly uses both notes. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

These studies use different tasks and measures. Use them to shape experiments, then judge with IdeaForge's own users and merge examples.

## Recommended merge design

Generate three concise candidates from the same two source snapshots and goal:

1. **Direct blend:** both ideas are necessary to one working mechanism.
2. **Tension-led:** a conflict or limitation between the notes becomes the design constraint.
3. **Analogy:** transfer a mechanism from a neighboring domain while preserving both source contributions.

For each, show:

- **Concept:** the new thing and how it works.
- **From A / From B:** a meaningful contribution from each source.
- **Bridge:** one sentence explaining why those contributions work together. Merely mentioning both is not synthesis.
- **Tension:** a real limitation or assumption; label a weak connection “exploratory.”
- **First test:** who tries what, for how long, and what evidence the team will observe.

Let users select, edit, discard, or ask for another direction. Only the chosen concept becomes a child node; the originals and snapshots stay intact. Do not present novelty, demand, or feasibility as established facts.

### Suggested output shape

Keep the existing fields and add a bridge and more actionable test. If generating alternatives, each item can use this shape:

~~~ts
{
  title: string;
  concept: string;
  bridge: string;
  contributionA: string;
  contributionB: string;
  tension: string;
  nextExperiment: {
    audience: string;
    action: string;
    duration: string;
    evidence: string;
  };
}
~~~

For an accepted child, consider storing the goal, model, generation time, prompt version, and the source snapshots. The roadmap already recommends richer generation history.

### Prompt sketch

Adapt this to the current system instruction and response schema. Keep note text as data, never as instructions.

> Help a student team combine exactly two rough ideas for the stated goal. Produce distinct concept directions, not paraphrases. In each direction, name one meaningful contribution from source A and one from source B, then explain the mechanism that makes both necessary. Respect the goal and constraints. State the main tension or assumption; if the link is weak, label it exploratory. Suggest a small test with a named audience, action, duration, and observable evidence. Do not claim novelty, feasibility, or user demand is proven. Return only the requested structured result.

Ask for a concise bridge the team can inspect, not hidden step-by-step reasoning. Google's prompt guidance recommends clear, specific instructions and iterative refinement; use IdeaForge examples to refine this prompt. [Gemini prompt design](https://ai.google.dev/gemini-api/docs/prompting-strategies).

## Evaluation plan

Use the ten-pair set in docs/roadmap.md: complementary, unrelated, duplicate, contradictory, vague, and Vietnamese/English inputs. Run the current one-result prompt and the revised prompt on the same pairs and model. Shuffle review order.

Have a person score outputs from 1–5:

| Measure | Question |
| --- | --- |
| Source traceability | Can I point to a meaningful contribution from each note? |
| Synthesis | Does the bridge describe a mechanism requiring both ideas? |
| Goal fit | Does the concept serve the board goal and constraints? |
| Difference | Are the candidates meaningfully different from each other and the inputs? |
| Honest uncertainty | Does it state a real tension or admit a forced connection? |
| Testability | Can this team run the experiment and observe the named evidence? |

Record which option is kept, what people edit, and why they discard the others. For a small hackathon test, report examples and observations rather than statistical claims. Ask two teammates to complete the merge without coaching and explain both source contributions and the next test.

## Implementation order for this hackathon

1. Improve the prompt; add bridge and a runnable experiment. Keep the existing preview and snapshots.
2. Run the ten-pair comparison. Fix recurring failures before building more UI.
3. If one proposal is often generic, add the three labelled directions and a choice step.
4. Verify the complete flow in two browsers using real Gemini and Liveblocks configuration.
5. Save generation metadata with each accepted concept.

Defer web research, automated novelty ranking, embeddings, multi-stage agent chains, and a large scoring UI. They add complexity before the core merge has been shown to help a team.

## References

1. Doshi, A. R., & Hauser, O. (2024). “Generative AI enhances individual creativity but reduces the collective diversity of novel content.” *Science Advances*, 10(28). [DOI](https://doi.org/10.1126/sciadv.adn5290)
2. Meincke, L., Mollick, E. R., & Terwiesch, C. (2024). “Prompting Diverse Ideas: Increasing AI Idea Variance.” [arXiv:2402.01727](https://arxiv.org/abs/2402.01727)
3. Heyman, J. L., et al. (2024). “Supermind Ideator: How scaffolding Human-AI collaboration can increase creativity.” *Collective Intelligence*. [DOI](https://doi.org/10.1177/26339137241305117)
4. Radensky, M., et al. (2024). “Scideator: Human-LLM Scientific Idea Generation Grounded in Research-Paper Facet Recombination.” [arXiv:2409.14634](https://arxiv.org/abs/2409.14634)
5. Si, C., et al. (2025). “Can LLMs Generate Novel Research Ideas? A Large-Scale Human Study with 100+ NLP Researchers.” *ICLR 2025*. [Conference paper](https://proceedings.iclr.cc/paper_files/paper/2025/hash/ea94957d81b1c1caf87ef5319fa6b467-Abstract-Conference.html)
6. Google. “Structured outputs | Gemini API.” [Documentation](https://ai.google.dev/gemini-api/docs/structured-output)
7. Google. “Prompt design strategies | Gemini API.” [Documentation](https://ai.google.dev/gemini-api/docs/prompting-strategies)
