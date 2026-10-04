# Workshop illustrations in Google Slides

`Code.gs` is an Apps Script that creates a Google Slides deck with one slide per
workshop illustration. Each drawing is rebuilt from native Slides shapes, text
boxes and lines, so you can move, recolour and retype every part of it.

## Create the deck

1. Open [script.google.com](https://script.google.com) and select **New project**.
2. Replace the contents of `Code.gs` in the editor with the contents of `slides/Code.gs`.
3. Next to **Services**, select **+**, choose **Google Slides API**, and select **Add**.
4. Select `buildDeck` in the function list and select **Run**. Allow access when asked.
5. When the run finishes, the execution log shows the link to the new deck. The deck is also in your Google Drive.

Each run creates a new deck.

## Each slide

- The step and its title, the section heading where the illustration appears, and the caption.
- The drawing, scaled to fit the slide. Lines with more than one segment are grouped.
- Colours use the workbench's light theme, with each step's accent colour.

Text box sizes are estimated, so a label can need a small nudge after the deck is created.

## Update after changing an illustration

The drawings come from `web/src/illustrations/index.tsx`. To regenerate `Code.gs`:

```bash
cd web
npm run figures
```

This renders every figure to SVG (`render-figures.tsx`), then converts the SVG to
Slides shapes and writes `Code.gs` (`make_appscript.py`, with `builder.gs` as the template).
