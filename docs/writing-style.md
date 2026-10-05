# Writing style

This guide applies to everything written in this repo: the README, the documents in `docs/`, and code comments. Follow it whenever you write or edit any of them. The aim is plain technical prose that tells readers what they need to know and how to act on it.

## Voice

Write short sentences in the active voice. Address the reader as "you". Every sentence should state a fact, a reason, or an action the reader can take.

Be specific. Replace a generalization with the concrete case behind it, and back a claim with data or an example. "Merges time out after 30 seconds" is useful; "merges are fast" isn't.

Separate clauses with commas or periods, and start a new sentence for a new idea. Name things literally. "The proposal is stored with its source text" says more than a metaphor about preserving history.

## Word choice

Choose the plain word. Write "use", not "utilize". Drop adjectives and adverbs that add no information, such as "simply", "very", "powerful", and "seamless".

Leave out marketing and filler vocabulary, including comprehensive, delve, utilize, harness, leverage, realm, tapestry, unlock, revolutionary, groundbreaking, remarkable, pivotal, robust, and cutting-edge. If a sentence needs one of these words, rewrite it with the specific claim the word stands in for.

Skip framing phrases like "in conclusion", "it's worth noting", and "not only X, but also Y". Say X and Y directly.

## Structure

Open every document with a 3 to 4 line paragraph that says what it covers and why the reader needs it. Give documents short titles that name their subject, such as "Decisions" or "Roadmap".

Write in paragraphs. Use a list only for items that are truly parallel, such as steps, options, or rules, and use a table for comparisons. Formatting belongs to code and UI: put file names, commands, and identifiers in code formatting, and bold the names of buttons the reader clicks. Leave the prose itself plain, with no bold or italic for emphasis, no emoji, and no hashtags.

Explain in prose first, then add a short example when it makes the point faster. Include a code block only when the reader will run or copy it. Describe architecture and flows in sentences rather than in ASCII or Mermaid diagrams.

## Scope

Docs describe the software as it is and teach the reader how to use and change it, so balance explanation with examples. Mention planned work in a sentence or a roadmap item.

## Code comments

Comments explain why the code does something: a constraint, a workaround, or a non-obvious decision. Write them as one or two plain sentences next to the code they explain, and let names and types describe what the code does.
