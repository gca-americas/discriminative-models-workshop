:::section kicker="Architecture" headline="Application structure"
Now, automate the character with the model's analytics.

:::figure id="model-mode-structure"
:::
:::

:::section kicker="Request" headline="One request per tick"
Each tick, the app sends the telegraph as state and asks three things in one
call:

- **Which response** is right, from the five (or six, when a spell is ready).
  A Choice.
- **Whether the ogre is exposed** to a counter right now. A Noul.
- **How hard the incoming hit is**, on a three-level rubric. A Score.

:::figure id="arena-flow" caption="The app sends what the ogre just did, the model answers each question, and the game's rules decide the character's action."
:::

```python
def reflex_questions(spell_ready):
    options = dict(RESPONSES)
    if spell_ready:
        options["cast"] = CAST                # only offered when there is a spell
    return {
        "response": Choice(instructions="The opponent has just done this. What is the right response?",
                           criteria=options),
        "exposed": Noul(instructions="Is the opponent exposed to a counter-attack right now?"),
        "danger": Score(instructions="How much damage is about to land if the fighter does nothing?",
                        criteria=["None: this is not an attack.", "A light hit.", "A heavy hit."]),
    }
```
:::

:::section kicker="Decision logic" headline="The choose() function"
Remember the thresholds from step 4? `choose()` compares the model's answers
with fixed numbers, and these fixed numbers are the thresholds.

```python
TRUST_CONFIDENCE = 0.40
HEAVY_DANGER = 1.5
SPEND_ON_OPENING = 0.60

def choose(answers, spell_ready):
    action = answers["response"].choice
    if answers["response"].confidence < TRUST_CONFIDENCE and answers["danger"].score >= HEAVY_DANGER:
        action = "dodge"                      # shaky call, heavy hit coming: play it safe
    if spell_ready and action == "strike" and answers["exposed"].noul >= SPEND_ON_OPENING:
        action = "cast"                       # the Discriminative model saw the opening; the code spends the spell
    ...
```

`choose()` is ordinary Python reading typed values, with two rules. The
Discriminative model provides its probability and analysis, and the code uses
the thresholds for the rules. The chosen action is sent to the engine, where it
will be used to battle against the ogre.

:::key
Keep the questions and the thresholds in one place. They are the part of a
System One integration you will tune most.
:::
:::
