# The God Prompt Philosophy

A god prompt is not documentation. It is a **closed-book exam delivered as a single self-contained payload.**

The model that receives it gets only it. No repository. No internet. No tools. No engine source to read. It cannot look anything up, verify anything, or discover anything it wasn't handed. Whatever you want that model to be able to do, the payload must **contain and demonstrate it** — as working code — or, to that model, it does not exist.

So a god prompt is really a benchmark: *how much of this giant payload was the model actually paying attention to?* The beautiful side effect of a model that paid attention is a genuinely cool game. We are not writing a manual. We are writing the entire universe a mind is allowed to know, and then asking it to build inside that universe from memory alone.

Everything below follows from that.

---

## The model knows only what it is shown

Undemonstrated is nonexistent. There is no "it'll figure it out" — there is nothing to figure it out *from*. A capability described in prose but never shown in working code is, in practice, absent. A capability shown once is known weakly. A capability shown several times, in several contexts, is known cold.

This is the first and hardest discipline: stop thinking like a documenter who can assume a curious reader with a search bar, and start thinking like someone packing a survival kit for a person who will never be able to phone home.

---

## The model is a pattern-repetition device

This is the truth that governs everything else. A model does not so much *follow instructions* as it *continues patterns*. It recognizes shapes and reproduces them. Treat it as anything more reliable than that and it will humble you.

The consequences are blunt:

**The example is the instruction.** Telling the model "don't copy my style, invent your own" is very nearly a no-op. Show it a triangle ship, ask for a space shooter, and you will get that triangle ship with the serial numbers half-filed off. Every time. The prose disclaimer does not override the demonstrated pattern; the demonstrated pattern *is* the spec.

**Stated good habits don't transfer. Demonstrated ones do.** If you want clean, single-source-of-truth state, the example must *be* clean state. Saying so accomplishes nothing. The model learns from what the code does, not from what the comments promise.

**Whatever is present gets reproduced — the good and the bad alike.** This is not a risk to be managed with warnings. It is the operating principle to design around.

From which the central rule:

> **The demo is the spec. Make the demo look exactly like the work you would be thrilled to receive.**

Not aspirationally described — literally shaped that way. Sized that way. Styled that way. Structured that way, with the habits you want physically present and the habits you don't want physically absent. If you do not want sprawling, decoration-soaked output, do not show sprawling, decoration-soaked examples. What is on the glass is what comes out of the copier.

---

## Repetition is the payload, not the waste

The naïve instinct is to treat a god prompt as an optimization problem: maximize surface area, minimize tokens, cut anything that repeats. This is exactly backwards.

The mechanism that makes a god prompt *work* — especially on weaker models — is the drilling of a single mental model through repetition. The real payload is not "here is a catalog of features." It is:

> *This is how a game in this engine is shaped, and I will show it to you so many times that you cannot fail to absorb it.*

The strongest models barely need this. But the strongest models are not the audience. A god prompt earns its keep on the lesser minds — the ones that need the skeleton hammered in over and over until reproducing it is reflex. The repetition, the redundancy, the saying-it-again-in-a-new-context — that is not bloat to be trimmed. That is the teaching. Do not optimize it away.

---

## Muscle and fat

Not every token in a payload teaches the engine. Two kinds of material live in any example:

**Muscle** is the skeleton of a game plus the genuine engine API — the lifecycle, the system calls, the idioms that are unique to this engine and unavailable anywhere else. This is what should repeat. It is the entire point. Never cut it.

**Fat** is everything that teaches the model nothing about the engine: decorative rendering, hand-tuned gradients, glow math, bespoke visual flourishes that could have been written against any canvas anywhere. It feels valuable because it looks impressive. It is not.

And because the model reproduces whatever it sees, **fat is not neutral filler — it is contamination.** It is a pattern the model will faithfully xerox into output you did not ask for, displacing attention from the muscle. Cutting fat is therefore free twice over: it removes a pattern you do not want copied, and it returns budget to the muscle and the coverage. You never trade a repetition away to make room — you trade away decoration you never wanted reproduced in the first place.

---

## Coverage and repetition pull the same direction

The apparent tension — broaden coverage *or* deepen repetition — is false. The move that dissolves it is simple: **each additional complete example is simultaneously another repetition of the skeleton and one new system of coverage.** One example drills the skeleton and shows input. The next drills the skeleton *again* and shows sound. The next, the skeleton again and a new system. Coverage and drilling are the same lever pulled twice.

The cost is length, and length is paid down by cutting fat and by tiering: load-bearing systems earn a full, complete example; secondary systems get a tight focused fragment rather than a whole game. Breadth grows without the spine thinning.

---

## The model's only hand is code

A god prompt does not deliver into the hands of a human craftsperson with a full asset pipeline. It delivers into a model whose sole medium is **code**. Everything it produces — the visuals, the sound, the levels, the behavior — must be *born from code*, generated programmatically, written into existence character by character.

This is the most underrated filter in the entire discipline, and it has nothing to do with how good a feature is:

> **A capability's worth in a god prompt is not its worth as an engine feature. It is gated by whether the model can actually wield it with code alone.**

A magnificent system that presupposes externally authored binary assets — images, sound files, models a human dragged in — is near-worthless in this context, no matter how powerful, because the model cannot conjure those assets. It has no hands for them. Meanwhile the humblest *programmatic* system — sound synthesized from parameters, geometry built from math, art drawn from primitives — is gold, because it is something the model can fully command from the only tool it owns.

So a god prompt should lean hard into the code-native parts of the engine and treat asset-dependent power as the dead weight it effectively is. Celebrate what the model can make from nothing but code. That is the whole game it is allowed to play.

---

## You can only teach a convention you have crystallized

Some capabilities work, technically, but their *good usage* has never been distilled into a clean, repeatable pattern — the wisdom lives in a craftsman's hands, not in a stated convention.

Such a capability cannot yet be taught, and it must not be faked. Because the model reproduces patterns faithfully, demonstrating a half-formed convention teaches a half-formed convention — and the model will reproduce the mess exactly as shown, forever. Better to omit a system entirely than to enshrine an immature pattern for it. A god prompt is only ever as good as the conventions it has actually crystallized; show only what you have truly figured out how to do well.

---

## Show the kind of thing you want back

If the goal is games, the examples must be **games** — complete, from first screen through play to end state, the whole arc, polished. A showcase or a catalog teaches the model to make showcases and catalogs. A model fed an inventory of parts learns to lay out parts; a model fed a finished, playable, *complete* game learns to ship finished, playable, complete games. The example is not a reference the model consults; it is the mold the output is poured into. Make the mold the shape of a finished thing.

---

## Teach the foundation, not only the convenience

Engines tend to grow comfortable high-level abstractions on top of low-level primitives. It is tempting to teach only the convenience layer — it is cleaner, shorter, prettier.

But the low-level primitive and the high-level abstraction sit at different altitudes and do different jobs. The convenience layer typically builds the *chrome* — the menus, the panels, the framing around the game. The raw primitive is what makes the *game world itself* respond — a clickable creature, an interactive region of the playfield, a bespoke thing that no prefab component anticipates. A model taught only the abstraction can dress the edges of a game and leave its whole world inert. Teach both altitudes; the foundation is what lets the model make the world come alive, not just the borders.

---

## Diversity dilutes the xerox

You cannot stop the copying. You can only control what is available to copy. If every example wears the same costume — the same genre, the same motif, the same little ship — that costume dominates whatever the model produces. If the examples span genres and visual idioms, no single motif owns the output; the model averages over a wider field and any one thing leaks less.

Deliberate variety across the examples is the only realistic defense against motif-bleed. It does not fight the model's nature — it works *with* it, by giving its imitative instinct more, and more varied, material to imitate.

---

## Two dimensions, two disciplines

Two-dimensional and three-dimensional games are different concerns and want different payloads.

The 2D payload is the purer **drilling machine**. With little rendering machinery to distract from, it can spend its whole budget hammering the core loop, the layering model, and the engine's conventions, undiluted. The constraint is the feature: less to show means more repetitions of the thing that matters.

The 3D payload is the *same skeleton with a dimension added*. It should lean on layering to put flat interface over a dimensional world — which means it reuses the very patterns the 2D discipline already drills, and bolts depth underneath. That is not a second curriculum; it is the same skeleton taught again with a variation. Repetition with a delta, which is exactly how teaching is supposed to work.

---

## The frame is part of the lesson

Even the wrapping teaches. An imperative opening that states the task plainly and fixes the hard constraints up front primes the pattern before the examples arrive. A concrete, grounding close — confirm understanding, then engage — leaves the model in the posture you want it in. The framing is not ceremony around the payload; it is the first and last pattern the model sees, and it sets the key for everything between.

---

*The throughline of all of it: a god prompt succeeds by respecting what a model actually is — a pattern-repetition device with no hands but code and no knowledge but the page in front of it — and by shaping every line of the payload into the exact pattern you would be proud to see it repeat.*
