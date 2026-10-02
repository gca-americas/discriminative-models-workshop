:::section kicker="Background" headline="Decisions in software"
Language models have been good at conversation for years. Most software still
does not use them for anything automatic, and the reason is not intelligence.
It is speed.

Ask a language model whether the ogre in front of you is about to strike,
and it writes its answer one token at a time. By the time the paragraph
arrives, the club has landed. You felt the two-second version of that in
step 3. And even then, the "yes" is buried in a paragraph your code has to
find and trust, with no idea how sure the model was.

:::figure id="two-paths" caption="Models handle it differently."
:::

The Discriminative model takes the state and your typed questions and answers
in one pass, in milliseconds. Each answer comes with a calibrated probability:
0.9 means right nine times out of ten. There is no text to parse and no JSON
to coax out of it.
:::

:::section kicker="Model types" headline="System One and System Two models"
The name comes from Daniel Kahneman's *Thinking, Fast and Slow*. System Two is
slow, deliberate reasoning, one step after another. System One is fast, pattern
matching.

:::figure id="two-systems" caption="System Two writes its answer one token at a time. System One answers every question in a single pass and returns probabilities."
:::

A language model is a System Two machine. It reasons in tokens, one at a time.
The Discriminative model is a **System One model**: it does not reason out
loud, does not generate anything, and answers every question in one pass. That
is why it is fast (roughly 70 to 500 milliseconds) and cheap (fractions of a
cent per thousand decisions).

:::key
A language model writes. A decision model decides. Most of what software
needs from AI is a decision.
:::
:::

:::section kicker="Scope" headline="Limitations"
The Discriminative model will not generate text, write code, hold a conversation, do arithmetic,
read an image, or follow a chain of steps.

In the workshop, we'll choose one of the Discriminative models.

:::note
One of the Discriminative models is Jev. It is a hosted API from TypeSafe AI,
released in September 2026. The first model is `jev-1.13`, reached through the alias `jev-latest`. There are no
published weights, so it is called, not downloaded.
:::

:::note
Jev is not the only way to get a System One model. Google's **DiffusionGemma**
is an open-weights model that writes a whole block of tokens in parallel
instead of one at a time, and that same parallel pass can read out
probabilities over a fixed set of options. Open-source servers such as
djev-run put Jev's exact API in front of it, so everything in this workshop
runs against it unchanged.
:::
:::

:::section kicker="Request structure" headline="State and questions"
Each call sends state and questions. The state is the text you want judged.
It can be a string, a JSON object, or a list. The questions ask what you want
to know about that text. Each question has a type: Choice, Score, or Noul. The
questions are processed in parallel, which lets it respond fast. You can add
multiple questions if needed.

:::figure id="one-request" caption="You choose the questions and how you would like them answered (their types)."
:::
:::

:::section kicker="Question types" headline="Choice, Score, and Noul"
**Choice** picks one option from a set you name, up to 255 of them. The answer
is the option, a probability for every option, and a confidence. Use it when
the options have no order between them: block high, block low, dodge, strike,
wait.

:::figure id="primitive-choice"
:::

**Score** rates the state along ordered levels you describe, from two to ten
of them. The answer is a position along the scale (a decimal, so 1.4 means
"between one and two, closer to one"), the probability of each level, and a
confidence. Use it when the answer is a matter of degree: how hard the
incoming hit will land.

:::figure id="primitive-score"
:::

:::note
Choice and Score both return a probability for each option and a confidence.
The difference is the main answer. A Choice returns the most likely option. A
Score treats the options as ordered levels and returns their
probability-weighted average, which can land between two levels. With none
0.05, light 0.55 and heavy 0.40, a Choice answers "light" and a Score answers
1.35, between light and heavy. The arena uses that value: `choose()` treats a
danger score of 1.5 or more as a heavy hit.
:::

**Noul** asks a yes/no question and returns the probability that the answer is
yes. Near 1 is a strong yes, near 0 a strong no, near 0.5 is "could be either".
There is no separate confidence, since the probability is its confidence level.

:::figure id="primitive-noul"
:::

:::

:::section kicker="Best practices" headline="Write focused questions"
The Discriminative model works best when a question asks one specific, well-scoped thing. "What is
the situation?" returns a plausible, low-confidence answer. "What is the right
response?", "Is the opponent exposed?", and "How hard will this hit?" return
three focused answers that your code combines.

:::figure id="focused-questions" caption="A vague question gets a spread-out, low-confidence answer. Focused questions get clear answers that your code combines."
:::

Descriptions on options and levels are cheap and they matter. The rules you
read in step 3 become the option descriptions: `block_high: "Raise the shield.
Right against an overhead or a high swing."` That is how the Discriminative model learns the rules
of the fight, at request time, in one line each. And the options can change
with the situation: the arena only offers `cast` when a spell is ready.
:::
