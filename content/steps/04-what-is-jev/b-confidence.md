:::section kicker="Output" headline="Probabilities"
A Choice answer is not a label. It is a distribution over the labels, and the
label is just the tallest bar.

:::figure id="probability-bars" caption="Two answers with the same top choice. Only one of them should move the shield on its own."
:::

Both of these say "block high". The left one is sure. The right one is a coin
toss between blocking high and dodging.

**How the model gets the number.** It uses the same step a language model
uses to pick its next word. A transformer reads the text and, at one position,
gives every token in its vocabulary a raw score, called a *logit*. A higher
logit means the token fits that position better. A *softmax* turns the logits
into probabilities that add up to 1. A language model then picks one token,
adds it to the text, and repeats. A discriminative model stops after the
probabilities.

:::figure id="next-word-vs-blank" caption="The same scoring step, used two ways. A language model picks a word and keeps writing. A discriminative model reads the probabilities at a blank and stops."
:::

The *blank* is a gap in an answer form. The server writes the form itself,
such as `response: ▢`, and leaves one gap per question. The model's only job
is to score what belongs in each gap.

1. The prompt holds the state and each question, with every allowed answer as
   a short label: `a` for block_high, `b` for block_low, and so on.
2. The server adds the answer form, with one blank per question.
3. The model reads the prompt and the form in one pass and gives every token
   a logit at each blank. The diffusion model sees the whole form
   at once and scores all the blanks together.
4. The server keeps only the logits of the allowed labels and applies a
   softmax to them, so the allowed answers add up to 1.
5. If the read looks unsure, the server reads again from another random start
   and averages the reads.

:::figure id="how-probabilities" caption="One blank, from prompt to probabilities. Tokens that are not allowed answers are dropped before the softmax."
:::
:::

:::section kicker="Output" headline="Confidence"
**Confidence** is one number that says how sure the answer is. TypeSafe
computes it from how the probability is spread across the options. All of it
on one option gives 1, and an even spread gives 0. For three options it is
(3 × largest − 1) / 2.

**How you get it.** Confidence is not a separate output of the model. It comes
after the steps above. The model gives logits, the softmax turns them into
probabilities, and confidence is computed from those probabilities. When the
top logit is far above the rest, the probability piles onto one option and
confidence is high. When the logits are close, the probability spreads out
and confidence drops.

:::figure id="confidence-from-spread" caption="Three answers with the same top choice. Confidence comes from how the probability is spread."
:::

**Why it matters.** The top choice alone hides how sure the model is. Your code
needs both, the answer to know what to do, and the confidence to decide
whether to do it. In the arena, `choose()` trusts the response only when
confidence is 0.40 or more. Below that, with a heavy hit coming, it dodges.

TypeSafe trains Jev for **calibrated** probabilities.
The probability matches how often the answer is right. In a calibrated model,
answers given at 0.7 are right about 70% of the time, so a threshold on
confidence is a threshold on how often you accept a wrong answer. The
DiffusionGemma server in this workshop reports the top probability itself as
confidence, averaged over its reads. When the reads disagree, the average
spreads out and confidence drops.

:::key
The answer tells you *what*. The confidence tells you *whether to act*.
:::
:::

:::section kicker="Application logic" headline="Thresholds"
The threshold is how you define the action in the code. The model returns a
confidence or a probability. Your code compares it with a number you chose,
and the result decides what happens.

**A threshold per action.** TypeSafe suggests splitting confidence into bands. High confidence
acts on its own. Medium confidence acts with a check, such as asking for
confirmation or flagging the case for review. Low confidence does not act,
and falls back to something safe or to a person.

:::figure id="threshold-bands" caption="The same answer, block_high, at three levels of confidence. The bands decide what the code does with it."
:::

```python
TRUST = 0.40        # below this, the answer is a guess
AUTO = 0.80         # at or above this, act without a check

def route(answer):
    if answer.confidence >= AUTO:
        return act(answer.choice)          # high: act on its own
    if answer.confidence >= TRUST:
        return confirm(answer.choice)      # medium: act with a check
    return fall_back()                     # low: do something safe
```

**The arena's rules.** The arena's thresholds live in `choose()`, which you run
in step 5.

```python
TRUST_CONFIDENCE = 0.40    # below this, the model is guessing between responses
HEAVY_DANGER = 1.5         # a danger score at or above this is a heavy hit
SPEND_ON_OPENING = 0.60    # exposed at or above this, with a spell ready, cast

def choose(answers, spell_ready):
    response = answers["response"]
    exposed = answers["exposed"].noul
    danger = answers["danger"].score

    action = response.choice
    if response.confidence < TRUST_CONFIDENCE and danger >= HEAVY_DANGER:
        action = "dodge"                   # shaky answer, heavy hit coming
    if spell_ready and action == "strike" and exposed >= SPEND_ON_OPENING:
        action = "cast"                    # a clear opening is worth the spell
    return action
```

:::figure id="choose-flow" caption="How choose() turns the model's answers into one action. Each check compares an answer with a threshold."
:::

Start from the cost of each mistake, then test. Run the
question on situations you have already judged, and keep the threshold that
makes the fewest costly mistakes. The exercise below lets you try this with
the exposed probability.

:::warn
A valid answer is not always a correct one. The Discriminative model cannot return an option you did
not offer, so it never hallucinates a move, but it can pick the wrong one,
sometimes with high confidence. Test your questions against situations you
have already judged before you trust a threshold.
:::
:::
