# TODO

## Deep dive: how DiffusionGemma works (added 2026-09-29)

Come back to this and decide what belongs in the workshop.

- DiffusionGemma vs Gemma: fills blanks over several passes, all at once, vs
  writing one token at a time, left to right.
- What a blank can see: the whole text (diffusion) vs only the text before it
  (left to right). Why that suits several questions in one request.
- The link to image diffusion: noise removed step by step vs blanks filled
  step by step.
- A decision reads the probabilities after the first step and stops; unsure
  reads are repeated from a random start and averaged.
- Whether any Gemma could be used: the method (read scores, keep allowed
  labels, softmax) works on any LLM; djev-run is built for DiffusionGemma.
- Calibration: comes from training (Jev), not from the wrapper.
- DiffusionGemma as a normal LLM: the model can write text; djev-run on the VM
  only accepts structured requests; OpenJev also serves /v1/chat/completions.
- Possible home: a note or figure in step 4b's probabilities section, or in
  step 1 (serving).
