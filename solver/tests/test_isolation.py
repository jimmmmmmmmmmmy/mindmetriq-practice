import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "practice_solver"
BANNED = {"playwright", "selenium", "urllib", "requests", "httpx", "webbrowser", "socket"}


def test_solver_modules_do_not_import_browsers_or_network():
    for path in ROOT.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module.split(".")[0]]
            else:
                continue
            assert BANNED.isdisjoint(names), f"{path.name} imports {names}"
