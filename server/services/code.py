"""Editing one block of a file from a step: an `edit` task.

A task names a file and a top-level symbol (`REQUEST`, say), or several
(`symbols`), in which case the block runs from the first to the last of them.
The student sees and edits that block only; the rest of the file is left alone. A save is
checked before it is written: the block and the whole file must still be
valid Python, and the symbol must still be defined. Reset puts the block back
from the starter copy under starter/, the file as the workshop shipped it.

Only files named by an `edit` task can be read or written this way.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

from server import config

STARTER = config.ROOT / "starter"


class EditError(Exception):
    pass


def _path(task: dict[str, Any]) -> Path:
    rel = task.get("file", "")
    path = (config.ROOT / rel).resolve()
    if not rel or config.ROOT.resolve() not in path.parents or not path.is_file():
        raise EditError(f"no file {rel}")
    return path


def _span(source: str, symbol: str) -> tuple[int, int]:
    """The 0-based line range [start, end) of a top-level assignment or def."""
    for node in ast.parse(source).body:
        names: list[str] = []
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names = [node.name]
        elif isinstance(node, ast.Assign):
            names = [t.id for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            names = [node.target.id]
        if symbol in names:
            start = min([node.lineno] + [d.lineno for d in getattr(node, "decorator_list", [])])
            return start - 1, node.end_lineno or node.lineno
    raise EditError(f"{symbol} is not defined in the file")


def _symbols(task: dict[str, Any]) -> list[str]:
    return list(task.get("symbols") or ([task["symbol"]] if task.get("symbol") else []))


def _block_span(source: str, symbols: list[str]) -> tuple[int, int]:
    spans = [_span(source, symbol) for symbol in symbols]
    return min(start for start, _ in spans), max(end for _, end in spans)


def read(task: dict[str, Any]) -> dict[str, Any]:
    path = _path(task)
    source = path.read_text()
    symbols = _symbols(task)
    if not symbols:
        return {"file": task["file"], "content": source, "startLine": 1}
    start, end = _block_span(source, symbols)
    lines = source.splitlines()
    return {"file": task["file"], "content": "\n".join(lines[start:end]), "startLine": start + 1}


def _check_block(block: str, symbols: list[str]) -> None:
    try:
        ast.parse(block)
    except SyntaxError as error:
        raise EditError(f"SyntaxError: {error.msg} (line {error.lineno}). The file was not changed.")
    for symbol in symbols:
        try:
            _span(block, symbol)
        except EditError:
            raise EditError(f"The block must still define {symbol}. The file was not changed.")


def write(task: dict[str, Any], block: str) -> dict[str, Any]:
    path = _path(task)
    symbols = _symbols(task)
    block = block.rstrip("\n")
    _check_block(block, symbols)
    source = path.read_text()
    if symbols:
        start, end = _block_span(source, symbols)
        lines = source.splitlines()
        updated = "\n".join(lines[:start] + block.split("\n") + lines[end:]) + "\n"
    else:
        updated = block + "\n"
    try:
        ast.parse(updated)
    except SyntaxError as error:
        raise EditError(f"SyntaxError: {error.msg} (file line {error.lineno}). The file was not changed.")
    path.write_text(updated)
    return read(task)


def reset(task: dict[str, Any]) -> dict[str, Any]:
    path = _path(task)
    starter = STARTER / task["file"]
    if not starter.is_file():
        raise EditError(f"no starter copy of {task['file']}")
    if not _symbols(task):
        path.write_text(starter.read_text())
        return read(task)
    original = read({**task, "file": str(starter.relative_to(config.ROOT))})["content"]
    try:
        return write(task, original)
    except EditError:
        path.write_text(starter.read_text())    # the block is past repair; restore the file
        return read(task)
