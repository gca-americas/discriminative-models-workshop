"""Ask the decision model. One request, two SDKs.

Step 2 chooses the decision model. Two SDKs reach the three choices:

  Jev               TypeSafe, hosted          typesafe-sdk   client.system_one(state=..., questions=...)
  DiffusionGemma    your own GPU VM           typesafe-sdk   the same call, with another base URL
  Gemini Decisions  Google, hosted            google-genai   client.decisions.create(model=..., input=..., questions=...)

Both SDKs take the same three kinds of question (choice, noul, score) and
return the same kinds of answer. So the workshop writes each question once,
as a plain dict, and reads `.choice`, `.noul`, `.score`, `.confidence` and
`.probabilities` from the answer, whichever SDK it came from.

    from decisions import ask
    answered = ask(about={"telegraph": "The ogre staggers."},
                   questions={"exposed": {"type": "noul", "instructions": "Is the opponent exposed?"}})
    answered.answers["exposed"].noul

`about` is what the model judges. The TypeSafe SDK calls it `state` and the
Google Gen AI SDK calls it `input`; ask() passes it under the right name.

Not a script to run; the others import it.
"""

from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from typing import Any

import jevauth  # scripts/jevauth.py, next to this file

GEMINI_DECISION_MODEL = "gemini-decision-1"
# Published prices per million input tokens. Output tokens are free on both.
PRICE_PER_MILLION_INPUT_TOKENS = {"gemini": 0.10}
DEFAULT_PRICE = 0.042          # Jev


class ModelError(Exception):
    """The decision model did not answer. `status` is the HTTP status, if there was one."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass
class Answered:
    """What came back, in the same shape from either SDK."""
    answers: dict[str, Any]      # name → the SDK's answer: .choice / .noul / .score, .confidence, .probabilities
    model: str
    input_tokens: int
    backend: str                 # typesafe | gemma-vm | cloud-run | self-hosted | gemini

    @property
    def sdk(self) -> str:
        return "google-genai" if self.backend == "gemini" else "typesafe-sdk"

    @property
    def price(self) -> float:
        return price(self.backend)

    @property
    def cost_usd(self) -> float:
        return self.input_tokens * self.price / 1_000_000

    def dump(self) -> dict[str, dict]:
        """The answers as plain dicts, for JSON."""
        return {name: answer.model_dump(mode="json") for name, answer in self.answers.items()}


def price(backend: str | None = None) -> float:
    return PRICE_PER_MILLION_INPUT_TOKENS.get(backend or jevauth.backend(), DEFAULT_PRICE)


# ── the TypeSafe SDK: Jev and DiffusionGemma ─────────────────────────────────

def typesafe_questions(questions: dict[str, dict]) -> dict[str, Any]:
    """The same questions, as the TypeSafe SDK's question objects."""
    from typesafe_sdk import Choice, Noul, Score

    built = {}
    for name, question in questions.items():
        kind = question.get("type", "noul")
        if kind == "choice":
            built[name] = Choice(instructions=question["instructions"], criteria=question["criteria"])
        elif kind == "score":
            built[name] = Score(instructions=question["instructions"], criteria=question["criteria"])
        else:
            built[name] = Noul(instructions=question["instructions"])
    return built


def _from_typesafe(response) -> Answered:
    return Answered(answers=dict(response.answers), model=response.model,
                    input_tokens=response.usage.input_tokens or 0, backend=jevauth.backend())


def ask_typesafe(state: dict, questions: dict[str, dict]) -> Answered:
    from typesafe_sdk import TypeSafeAPIError, TypeSafeClient, TypeSafeError

    jevauth.prepare()
    try:
        with TypeSafeClient(**jevauth.client_kwargs()) as client:
            response = client.system_one(state=state, questions=typesafe_questions(questions))
    except TypeSafeAPIError as failure:
        raise ModelError(str(failure), getattr(failure, "status", None)) from failure
    except TypeSafeError as failure:
        raise ModelError(str(failure)) from failure
    return _from_typesafe(response)


async def ask_typesafe_async(state: dict, questions: dict[str, dict]) -> Answered:
    import asyncio

    from typesafe_sdk import AsyncTypeSafeClient, TypeSafeAPIError, TypeSafeError

    await asyncio.to_thread(jevauth.prepare)      # a Cloud Run token, when that is the backend
    try:
        async with AsyncTypeSafeClient(**jevauth.client_kwargs()) as client:
            response = await client.system_one(state=state, questions=typesafe_questions(questions))
    except TypeSafeAPIError as failure:
        raise ModelError(str(failure), getattr(failure, "status", None)) from failure
    except TypeSafeError as failure:
        raise ModelError(str(failure)) from failure
    return _from_typesafe(response)


# ── the Google Gen AI SDK: Gemini Decisions ──────────────────────────────────

_gemini = {"client": None, "key": ""}


def gemini_key() -> str:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""


def gemini_client():
    """One client for the process. The Decisions API is on the Gemini Developer
    API, so this is always an API-key client, never Vertex AI."""
    from google import genai

    key = gemini_key()
    if not key:
        raise ModelError("There is no GEMINI_API_KEY. Add one in step 2.")
    if _gemini["client"] is None or _gemini["key"] != key:
        timeout_ms = int(float(os.environ.get("JEV101_JEV_TIMEOUT", "20")) * 1000)
        _gemini.update(key=key, client=genai.Client(
            vertexai=False, api_key=key, http_options={"api_version": "v1beta", "timeout": timeout_ms}))
    return _gemini["client"]


def gemini_questions(questions: dict[str, dict]) -> dict[str, dict]:
    """The same questions, as the Decisions API takes them: plain JSON."""
    built = {}
    for name, question in questions.items():
        kind = question.get("type", "noul")
        item = {"type": kind, "instructions": question["instructions"]}
        criteria = question.get("criteria")
        if kind == "choice":
            item["criteria"] = {option: (text or "") for option, text in criteria.items()}
        elif kind == "score":
            item["criteria"] = list(criteria)
        built[name] = item
    return built


def gemini_input(state: dict | str) -> str:
    """Jev takes `state` as an object. The Decisions API takes `input` as text
    (or content blocks), so the state goes in as JSON text."""
    return state if isinstance(state, str) else json.dumps(state)


def image_block(png: bytes, resolution: str = "low") -> dict:
    """An image, as a content block for the Decisions API's `input`."""
    return {"type": "image", "mime_type": "image/png", "resolution": resolution,
            "data": base64.b64encode(png).decode()}


def _from_gemini(response, questions: dict) -> Answered:
    # The API returns the answers in no particular order; keep the order asked.
    return Answered(answers={name: response.answers[name] for name in questions}, model=GEMINI_DECISION_MODEL,
                    input_tokens=response.usage.total_input_tokens or 0, backend="gemini")


def _gemini_error(failure: Exception) -> ModelError:
    status = getattr(failure, "code", None) or getattr(failure, "status_code", None)
    text = getattr(failure, "message", None) or str(failure)
    return ModelError(str(text).strip().splitlines()[0][:300] if str(text).strip() else type(failure).__name__,
                      status if isinstance(status, int) else None)


def ask_gemini(state: Any, questions: dict[str, dict]) -> Answered:
    """`state` is a dict or text, or a list of content blocks (see image_block)."""
    client = gemini_client()
    try:
        response = client.decisions.create(
            model=GEMINI_DECISION_MODEL,
            input=state if isinstance(state, list) else gemini_input(state),
            questions=gemini_questions(questions),
        )
    except Exception as failure:               # the SDK raises several families of error
        raise _gemini_error(failure) from failure
    return _from_gemini(response, questions)


async def ask_gemini_async(state: Any, questions: dict[str, dict]) -> Answered:
    client = gemini_client()
    try:
        response = await client.aio.decisions.create(
            model=GEMINI_DECISION_MODEL,
            input=state if isinstance(state, list) else gemini_input(state),
            questions=gemini_questions(questions),
        )
    except Exception as failure:
        raise _gemini_error(failure) from failure
    return _from_gemini(response, questions)


# ── whichever model step 2 chose ─────────────────────────────────────────────

def ask(about: dict, questions: dict[str, dict]) -> Answered:
    """One call to the chosen decision model: what to judge, and the questions
    about it. `about` goes out as `state=` with the TypeSafe SDK and as
    `input=` with the Google Gen AI SDK."""
    if jevauth.backend() == "gemini":
        return ask_gemini(about, questions)
    return ask_typesafe(about, questions)


async def ask_async(about: dict, questions: dict[str, dict]) -> Answered:
    """The same call, awaited, for code that runs on an event loop."""
    if jevauth.backend() == "gemini":
        return await ask_gemini_async(about, questions)
    return await ask_typesafe_async(about, questions)
