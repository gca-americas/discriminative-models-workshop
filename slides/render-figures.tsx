// Render every workbench illustration to static SVG markup, for the slide
// builder (slides/make_appscript.py). Run: npm --prefix web run figures
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { FIGURES } from "../web/src/illustrations";

const out: Record<string, string> = {};
for (const [id, Drawing] of Object.entries(FIGURES)) {
  out[id] = renderToStaticMarkup(createElement(Drawing));
}
process.stdout.write(JSON.stringify(out));
