:::section kicker="API" headline="Request and response"
:::figure id="request-path"
:::

**Request.** A request has two parts: something to judge, and named questions
about it. Each SDK builds the questions and sends them to its model.

With the TypeSafe SDK, for Jev and DiffusionGemma:

```python
from typesafe_sdk import Choice, Noul, TypeSafeClient

with TypeSafeClient() as client:
    response = client.system_one(
        state={"opponent": OPPONENT, "telegraph": telegraph},
        questions={
            "response": Choice(instructions="What is the right response?", criteria=RESPONSES),
            "exposed": Noul(instructions="Is the opponent exposed to a counter-attack right now?"),
        },
    )

response.answers["response"].choice     # "strike"
response.answers["exposed"].noul        # 0.97
```

With the Google Gen AI SDK, for Gemini Decisions:

```python
from google import genai

client = genai.Client(http_options={"api_version": "v1beta"})
result = client.decisions.create(
    model="gemini-decision-1",
    input=json.dumps({"opponent": OPPONENT, "telegraph": telegraph}),
    questions={
        "response": {"type": "choice", "instructions": "What is the right response?", "criteria": RESPONSES},
        "exposed": {"type": "noul", "instructions": "Is the opponent exposed to a counter-attack right now?"},
    },
)

result.answers["response"].choice       # "strike"
result.answers["exposed"].noul          # 0.98
```

**Response.** Both return one answer per question, under the name you gave
it. A Choice has `.choice`, a Noul has `.noul`, a Score has `.score`, and all
three have a `.confidence`.
:::

:::section kicker="Workshop code" headline="One function for both SDKs"
The workshop writes each question once, as a plain dict, and calls
`ask(about, questions)` from `scripts/decisions.py`. `about` is what the model
judges. The function sends it as `state` with the TypeSafe SDK or as `input`
with the Google Gen AI SDK, whichever reaches the model you chose in step 2,
and returns the answers in the same shape either way.

:::figure id="two-sdks" caption="ask() picks the SDK. The code that builds the questions and reads the answers is the same for all three models."
:::

```python
from decisions import ask

answered = ask(
    about={"opponent": OPPONENT, "telegraph": telegraph},
    questions={
        "response": {"type": "choice", "instructions": "What is the right response?", "criteria": RESPONSES},
        "exposed": {"type": "noul", "instructions": "Is the opponent exposed to a counter-attack right now?"},
    },
)

answered.answers["response"].choice
answered.model, answered.sdk            # which model and SDK answered
```
:::
