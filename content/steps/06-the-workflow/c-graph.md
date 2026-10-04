:::section kicker="Graph" headline="Graph definition"
:::figure id="graph-definition"
:::

```python
root_agent = Workflow(
    name="arena",
    edges=[
        ("START", enter),
        (enter, (read_rune, tick)),                   # fan-out: slow branch + fast loop
        (read_rune, spellwright, spell_ready),
        (spell_ready, {"retry": read_rune, "stored": rest}),   # misread: read the new spell card; else rest
        (tick, {"next": check_spell, "recast": read_rune, "done": summarise}),
        (check_spell, {"again": tick}),               # not ready? keep fighting
        (summarise, bard, finish),
    ],
)
```

A tuple as a *target* is a fan-out. A tuple as an *edge* is a chain. A dict
maps route names to nodes. `tick → check_spell → tick` is the fast loop.
`"recast": read_rune` starts the slow thread again after a spell is spent,
`"retry"` does the same after a fizzle, and `"stored": rest` lets the slow
thread end quietly, with no output, once the spell is in the slot. ADK requires at least one routed
edge in a cycle, so an unconditional loop is rejected before it can run
forever.

:::note
`root_agent` is what ADK's tools look for. `adk web agents` from the root of
the workshop opens the dev UI with the arena in it, if you want to see the
graph and the events in a browser rather than a terminal.
:::
:::

:::section kicker="Prerequisites" headline="Gemini access"
The workflow puts the Discriminative model and Gemini together, so Gemini needs access too.
It runs on Vertex AI in your project, with your own Google credentials and no
API key. `./setup_codelab.sh` set this up: `GOOGLE_GENAI_USE_VERTEXAI=1`,
`GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` in `.env`, and the Gemini
model your project can call in `JEV101_GEMINI_MODEL`.

:::exercise id="gemini" plain="true"
:::
:::

:::section kicker="Architecture" headline="Application structure"
The workflow mode adds two files to the game: `mode_workflow.py` on the server
and `static/modes/workflow.js` on the page. `mode_workflow.py` starts the ADK
workflow in `agents/arena/agent.py` as its own process. The workflow plays over
HTTP, posting each move and spell back to the app to be judged, and calls both
models.

:::figure id="workflow-mode-structure"
:::
:::
