:::section kicker="Graph" headline="Graph definition"
:::figure id="graph-definition"
:::

```python
root_agent = Workflow(
    name="arena",
    edges=[
        ("START", enter),
        (enter, (read_card, tick)),                   # fan-out: both start
        (read_card, {"again": read_card, "stored": rest}),
        (tick, {"next": tick, "read": read_card, "done": summarise}),
        (summarise, bard, finish),
    ],
)
```

A tuple as a *target* is a fan-out: both nodes start. A tuple as an *edge* is
a chain. A dict maps route names to nodes. `tick → tick` is the fight loop.
`"read"` starts the card reader again after a spell is cast, `"again"` does
the same after a misread, and `"stored": rest` lets that branch end quietly,
with no output, once the spell is in state. ADK requires at least one routed
edge in a cycle, so an unconditional loop is rejected before it can run
forever.

`bard` is the only `LlmAgent` in the graph. It receives the fight log from
`summarise` and returns a title and a tale.

:::note
`root_agent` is what ADK's tools look for. `adk web agents` from the root of
the workshop opens the dev UI with the arena in it, if you want to see the
graph and the events in a browser rather than a terminal.
:::
:::

:::section kicker="Prerequisites" headline="Gemini API key"
The workflow uses the Gemini API key from step 2 in two places: Gemini
Decisions reads the spell card, and Gemini writes the tale. This is true
whichever decision model fights.

:::figure id="model-keys" caption="Step 6 uses the Gemini API key for the spell card and the tale. The fight uses the key for the model you chose."
:::

:::exercise id="gemini" plain="true"
:::
:::

:::section kicker="Architecture" headline="Application structure"
The workflow mode adds two files to the game: `mode_workflow.py` on the server
and `static/modes/workflow.js` on the page. `mode_workflow.py` starts the ADK
workflow in `agents/arena/agent.py` as its own process. The workflow plays over
HTTP, posting each move and each card reading back to the app to be judged,
and calls the models.

:::figure id="workflow-mode-structure"
:::
:::
