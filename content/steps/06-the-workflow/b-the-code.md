:::section kicker="Spell reading" headline="Read the spell card with Gemini Decisions"
Reading the card is one call with the Google Gen AI SDK. The `input` is the
image, and the questions are four Choices about it.

:::figure id="card-questions" caption="One image, four choice questions, four answers with a confidence each. The arena judges them against the card's hidden answer."
:::

The criteria describe each option in words, so the model matches what it sees
against them:

```python
ELEMENTS = {
    "fire": "The card is red-orange.", "frost": "The card is light blue.",
    "earth": "The card is green.", "storm": "The card is purple.",
}
SHAPES = {"circle": "A solid filled circle.", "ring": "A hollow circle.", ...}

QUESTIONS = {
    "element": {
        "type": "choice",
        "instructions": "What color is this spell card? The color is its element.",
        "criteria": ELEMENTS,
    },
    "first": {
        "type": "choice",
        "instructions": "Which shape is the first one, on the left?",
        "criteria": SHAPES,
    },
    ...                        # "second" and "third": the middle and the right
}
```

**read_card()** sends the image and the questions, and gets all four answers
back in one response. It runs alongside the fight, so the fight keeps ticking
while it waits.

:::figure id="read-card-node"
:::

```python
async def read_card(ctx: Context, node_input) -> Event:
    png = _arena(ctx).rune_png()                  # exactly what the screen shows
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"],
                          http_options={"api_version": "v1beta"})
    result = await client.aio.decisions.create(
        model="gemini-decision-1",
        input=[{"type": "image", "mime_type": "image/png",
                "data": base64.b64encode(png).decode()}],
        questions=QUESTIONS,
    )
    read = result.answers
    element = read["element"].choice
    shapes = [read[p].choice for p in ("first", "second", "third")]
    spell = _arena(ctx).sung({"element": element, "glyphs": shapes,
                              "incantation": INCANTATIONS[element]})
    fizzled = spell["damage"] <= 0                # a misread burns the card
    return Event(route="again" if fizzled else "stored",
                 state={"spell": None if fizzled else spell})
```

The arena judges the reading against the spell card's hidden answer in
`sung()`.

`read_card` uses the Google Gen AI SDK directly, because it always goes to
Gemini Decisions. `client.aio.decisions.create(...)` is the SDK's own async
call. The fight loop below goes to whichever model you chose, so it uses the
workshop's helper `ask_async`, which makes this same call for Gemini
Decisions and the TypeSafe SDK's call for Jev and DiffusionGemma.

`read_card` returns a state change and no `output`. The next tick finds the
spell in state, and a path with no output is not a second ending for the
graph: ADK requires one terminal output, and that is the fight's.

:::note
The judging is code, in the arena, against the spell card's hidden answer. A perfect
reading does 45, more into an opening. Two shapes right does 25. A misread
fizzles and burns the spell card. The model is not asked whether it was right.
:::
:::

:::exercise id="card"
:::

:::section kicker="Game loop" headline="The fight loop"
**tick()** plays one exchange, then picks the next edge.

It asks the model with `ask_async`, the awaitable form of the `ask` you used
in step 5. Both are the workshop's own functions, in `scripts/decisions.py`,
not part of an SDK. `ask_async` calls the async method of the SDK for your
model:

| Model | What `ask_async` calls |
|---|---|
| Jev, DiffusionGemma | `AsyncTypeSafeClient().system_one(state=..., questions=...)` |
| Gemini Decisions | `genai.Client().aio.decisions.create(model=..., input=..., questions=...)` |

It takes the same two arguments as `ask` and returns the same answers. The
only difference is the `await` in front:

```python
answered = ask(about=..., questions=...)                # step 5: waits, and holds everything up
answered = await ask_async(about=..., questions=...)    # step 6: waits, and lets other work run
```

:::file path="scripts/decisions.py" label="Show ask_async" symbols="ask_async,ask_gemini_async,ask_typesafe_async"
:::

`tick` is an `async` function, so while it waits for the model at that
`await`, the card reader can run. With plain `ask`, the whole workflow would
stand still until the answer came back.

:::figure id="tick-node"
:::

```python
async def tick(ctx: Context, node_input) -> Event:
    arena = _arena(ctx)
    spell = ctx.state.get("spell")                # what read_card left, if it has finished
    move = await asyncio.to_thread(arena.telegraph)

    answered = await decisions.ask_async(         # the model you chose in step 2
        about={"opponent": engine.OPPONENT["description"], "telegraph": move["telegraph"]},
        questions=reflex.reflex_questions(spell_ready=spell is not None),
    )

    decision = reflex.choose(answered.answers, spell_ready=spell is not None)
    entry = await asyncio.to_thread(arena.respond, decision["action"], decision, ...)
    over = entry["you"] <= 0 or entry["foe"] <= 0 or entry["tick"] >= engine.MAX_TICKS

    routes = []                                   # which edges to follow next
    if entry["spell_used"] and not over:
        routes.append("read")                     # a new card is up: read it, in the background
    routes.append("done" if over else "next")     # and keep fighting, or end
    return Event(output="fight", route=routes, state={"tick": ..., ...})
```

Two different things are in play here. `about` is what the model judges on
this tick. `ctx.state` and `Event(state=...)` are ADK's shared workflow
state, which is how the card reader's spell reaches the fight.

The questions are built fresh each tick, so `cast` appears only when there is
a spell to cast. `ask_async` uses the TypeSafe SDK or the Google Gen AI SDK,
depending on your model, the same way `ask` does. `route` can be a list, and
`["read", "next"]` takes both edges at once.

The arena itself is behind a small client: the running app over HTTP when
there is one, so the page shows the fight; the engine in-process when there
is not.
:::

:::exercise id="loop"
:::
