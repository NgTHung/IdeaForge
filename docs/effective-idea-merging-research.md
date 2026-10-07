# Merging two ideas effectively

This note gives IdeaForge a repeatable way to turn two source notes into one testable concept. Use it to decide whether a pair has a real connection, draft more than one candidate, and check that the result keeps both contributions. The research below studies human design and brainstorming; applying it to an AI merge flow is a product recommendation, not a measured result for IdeaForge.

## What the research supports

Combining distant concepts can increase novelty, but a first combination is not reliably both novel and useful. Chan and Schunn traced hundreds of concepts across twelve problems. Distant combinations had no positive average direct effect on creative outcomes; later concepts that built on those combinations performed more consistently well. Their study followed existing ideas, so it supports an iteration step without proving a fixed number of revisions will work for every pair. [Chan and Schunn, 2015](https://joelchan.me/assets/pdf/2015-cognition-openideo-diversity-inpress.pdf).

Building on an idea also has a selection problem. In nine professional group sessions, Gillier and Bayus found no general gain in novelty, feasibility, or usefulness from building on prior ideas. Building on novel ideas tended to improve novelty while reducing feasibility. This small field study suggests that IdeaForge should let a team reject a forced merge and compare the proposed concept with its source ideas. [Gillier and Bayus, 2022](https://onlinelibrary.wiley.com/doi/10.1111/caim.12509).

For a distant pair, transfer the relationship or mechanism behind an idea, not just its vocabulary. Gick and Holyoak's analogy experiments found that people could use a prior story to solve a different problem when they were prompted to make the connection. The result supports making the bridge explicit when IdeaForge proposes an analogy. [Gick and Holyoak, 1980](https://www.sciencedirect.com/science/article/pii/0010028580900134).

A proposed solution can change how a team defines the problem. Protocol studies of nine experienced designers support treating problem framing and solution design as an iterative pair. If two notes target different users or problems, the team should revisit the board goal before forcing them into one concept. [Dorst and Cross, 2001](https://www.sciencedirect.com/science/article/pii/S0142694X01000096).

Evaluate more than novelty. Dean and colleagues developed idea-rating scales for novelty, workability, relevance, and specificity. Those dimensions give the team a way to distinguish an unusual sentence from a useful concept that it can explain and try. [Dean et al., 2006](https://aisel.aisnet.org/jais/vol7/iss10/30/).

## A repeatable merge method

1. Write one line for each source: user, problem, proposed mechanism, distinct benefit, and constraint. Keep the source text and author attached to that line.
2. Decide how the notes relate. A pair may be a duplicate, a complement, a tension, a transferable mechanism, or unrelated. The table below gives the next action.
3. State a causal bridge before writing the merged title. Complete: “A makes B more useful because …” or “B removes the main obstacle to A by …”. If neither sentence can name a real mechanism, keep the ideas separate or ask a clarifying question.
4. Draft two or three candidates. Try a direct integration for complementary notes, a condition that resolves a tension, and a mechanism transfer for a distant pair. A candidate should describe one user journey, what each source contributes, and what new outcome the combination might create.
5. Revise the strongest candidate. Remove features that do not serve the common outcome. Check whether the concept still makes sense if either source is removed. If it does, that source may have been appended rather than integrated.
6. Compare the candidate with A alone, B alone, and no merge. A human selects or edits it. Record the largest assumption and one small experiment that could disprove the claimed benefit.

| Relationship | Useful action | Common failure |
| --- | --- | --- |
| Duplicate | Consolidate wording and preserve both authors. | Claiming a duplicate is a new concept. |
| Complement | Make one mechanism enable or strengthen the other. | Listing two unrelated features in one app. |
| Tension | State the condition under which both can work, or choose one. | Hiding the conflict in vague language. |
| Mechanism transfer | Apply a working principle from one domain to the other's problem. | Copying a surface feature without a causal link. |
| Unrelated | Keep both notes or ask what shared problem they serve. | Inventing a connection to force a merge. |

The relationship labels and steps are a synthesis for IdeaForge. They are not a validated taxonomy from one paper. They turn the findings above into choices a user can inspect.

## Worked example

Source A: “Students struggle to find study partners.” Source B: “Short daily challenges help people keep a habit.” A weak merge is “an app with partner matching and daily challenges.” It places the features side by side without explaining why they belong together.

A stronger candidate is a seven-day study sprint. A student matches with a partner for one subject; the pair completes one short challenge each day and checks in. A supplies the match, B gives the matched pair a repeatable activity, and the proposed bridge is that a partner may improve follow-through. The bridge is a hypothesis, not evidence. The main tension is scheduling. A one-week trial could compare completion and check-in rates for partner pairs and students doing the same challenges alone. Preserve both source notes even if the team keeps the merged concept.

## What this means for IdeaForge

The current `POST /api/merge` route accepts a board goal and two note texts. It returns one title and concept plus each source's contribution, a tension, and a next experiment. It does not currently return a causal bridge, assumptions, a relationship type, alternatives, or a reason to decline the merge. The current canvas does not expose the merge route. These are implementation gaps relative to the workflow above, not evidence that the existing model produces poor results. See `src/app/api/merge/route.ts`, `src/lib/ideas.ts`, and the status in `docs/roadmap.md`.

When the team implements the canvas merge flow, show the two sources beside the preview. Ask the model to classify the relationship and state the bridge in plain language. Let it return “no useful merge” or a question when the pair lacks a defensible bridge. Offer a small set of distinct candidates and let a person edit or reject them. Keep source IDs, authors, and text snapshots when the user accepts a concept, as `docs/decisions.md` requires.

Use embedding similarity to find candidates, not to decide merge quality. Two close notes may disagree, and a distant pair may need several revisions before its value is clear. The score cannot replace a check of the bridge, both contributions, and the board goal. This is an inference from the combination studies and the current IdeaForge similarity findings, not a universal score threshold. [Chan and Schunn, 2015](https://joelchan.me/assets/pdf/2015-cognition-openideo-diversity-inpress.pdf); [IdeaForge decisions](decisions.md#similarity).

## Evaluate the merge flow

Use the pair categories already in `docs/roadmap.md`: complementary, conflicting, duplicate, vague, unrelated, and mixed-language notes. Start with at least ten pairs so the team can compare the current one-shot prompt with a structured bridge-and-revision flow. Hide which flow made each proposal from two human reviewers.

For each output, record whether both source contributions survive, whether the bridge is concrete, and whether the proposal beats A alone and B alone for the board goal. Rate novelty, workability, relevance, and specificity separately, using written examples for each rating. Record keep, edit, or reject decisions, the edits people make, generation latency, and invalid JSON rate. Treat this as a local product evaluation, not a claim that the research papers validate the specific IdeaForge prompt. [Dean et al., 2006](https://aisel.aisnet.org/jais/vol7/iss10/30/); [Gillier and Bayus, 2022](https://onlinelibrary.wiley.com/doi/10.1111/caim.12509).

## Sources

- Chan, J., and Schunn, C. D. (2015). [The importance of iteration in creative conceptual combination](https://joelchan.me/assets/pdf/2015-cognition-openideo-diversity-inpress.pdf). *Cognition*, 145, 104–115.
- Gillier, T., and Bayus, B. L. (2022). [Group creativity in the wild: When building on ideas enhances the generation and selection of creative ideas](https://onlinelibrary.wiley.com/doi/10.1111/caim.12509). *Creativity and Innovation Management*, 31(3), 430–446.
- Gick, M. L., and Holyoak, K. J. (1980). [Analogical problem solving](https://www.sciencedirect.com/science/article/pii/0010028580900134). *Cognitive Psychology*, 12(3), 306–355.
- Dorst, K., and Cross, N. (2001). [Creativity in the design process: Co-evolution of problem–solution](https://www.sciencedirect.com/science/article/pii/S0142694X01000096). *Design Studies*, 22(5), 425–437.
- Dean, D. L., Hender, J. M., Rodgers, T. L., and Santanen, E. L. (2006). [Identifying quality, novel, and creative ideas: Constructs and scales for idea evaluation](https://aisel.aisnet.org/jais/vol7/iss10/30/). *Journal of the Association for Information Systems*, 7(10), 646–699.
