:::section kicker="Concurrency" headline="One event loop"
ADK runs both branches as tasks on one event loop, in a single thread. Only
one task runs at a time. When a task reaches `await`, it waits for its answer,
and the loop runs the other branch in the meantime. The fast branch waits for
the model for about a tenth of a second, and the slow branch waits for Gemini
for several seconds, so neither holds up the other.

:::figure id="event-loop"
:::
:::

:::section kicker="Spell reading" headline="Slow branch"
**read_rune()** takes the spell card off the screen as an image.

:::figure id="read-rune-node"
:::

```python
def read_rune(ctx: Context, node_input) -> Event:
    png = _arena(ctx).rune_png()                  # exactly what the screen shows
    return Event(output=types.Content(role="user", parts=[
        types.Part(text="This spell card is on the arena's screen right now. Sing the spell that matches it."),
        types.Part.from_bytes(data=png, mime_type="image/png"),
    ]))
```

**spellwright** is Gemini. It reads the image and answers in a fixed shape.

:::figure id="spellwright-node"
:::

```python
class Sung(BaseModel):
    element: str          # fire, frost, earth, storm
    glyphs: list[str]     # three of: circle, ring, square, diamond, triangle, cross, crescent, bar
    incantation: str

spellwright = LlmAgent(name="spellwright", model="gemini-flash-latest",
                       instruction="You are the spellwright ... read the three shapes left to right ...",
                       output_schema=Sung)
```

**spell_ready()** has the arena judge the spell, then stores it or tries again.

:::figure id="spell-ready-node"
:::

```python
def spell_ready(ctx: Context, node_input: dict) -> Event:
    spell = _arena(ctx).sung(dict(node_input))    # the arena judges it against the spell card
    return Event(state={"spell": spell if spell["damage"] > 0 else None},
                 route="retry" if spell["damage"] <= 0 else "stored")
```

A function node can return a `Content` with an image part, and the LLM node
receives it as its user turn. `spell_ready` returns an `Event` with a state
delta and no `output`. The next tick reads the spell from state, and a branch
with no output is not a second ending for the graph: ADK requires one
terminal output, and that is the fight's.

:::note
The judging is code, in the arena, against the spell card's hidden answer. A perfect
reading does 45, more into an opening. Two shapes right does 25. A misread
fizzles and burns the spell card. Gemini is not asked whether it was right.
:::
:::

:::exercise id="slow"
:::

:::section kicker="Game loop" headline="Fast branch"
**tick()** plays one exchange, then picks the next edge.

:::figure id="tick-node"
:::

```python
async def tick(ctx: Context, node_input) -> Event:
    arena = _arena(ctx)
    spell = ctx.state.get("spell")                # did the slow branch deliver?
    move = await asyncio.to_thread(arena.telegraph)

    async with AsyncTypeSafeClient() as jev:
        answers = await jev.system_one(
            state={"opponent": engine.OPPONENT["description"], "telegraph": move["telegraph"]},
            questions=reflex.reflex_questions(spell_ready=spell is not None),
        )

    decision = reflex.choose(answers.answers, spell_ready=spell is not None)
    entry = await asyncio.to_thread(arena.respond, decision["action"], decision, ...)
    over = entry["you"] <= 0 or entry["foe"] <= 0 or entry["tick"] >= engine.MAX_TICKS

    routes = []                                   # which arrows in the graph to follow next
    if entry["spell_used"] and not over:
        routes.append("recast")                   # a new spell card is on the screen: read it
    routes.append("done" if over else "next")
    return Event(output="fight", route=routes, state={"tick": ..., "spell": None, ...})
```

**check_spell()** looks at the spell slot after every exchange.

:::figure id="check-spell-node"
:::

```python
def check_spell(ctx: Context, node_input) -> Event:
    spell = ctx.state.get("spell")                # thread 1 writes it; this only reads
    if spell:
        report = {"ready": True}
    else:
        report = {"ready": False, "waited": now - ctx.state["forging_since"]}
    return Event(output="fight", route="again", state={"spell_check": report})
```

`check_spell` looks at the slot after every exchange. It never blocks: if
the spell is not ready, it reports that and moves on.

Three things carry the design. The Discriminative model call is `await`ed with the async
client, so the loop yields while it waits and the Gemini branch keeps
running. The questions are built fresh each tick, so `cast` appears only when
there is something to cast. And `route` can be a list: `["recast", "next"]`
takes both edges at once.

The arena itself is behind a small client: the running app over HTTP when
there is one, so the page shows the fight; the engine in-process when there
is not.
:::

:::exercise id="fast"
:::
