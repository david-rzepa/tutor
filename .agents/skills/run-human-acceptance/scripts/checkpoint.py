#!/usr/bin/env python3
"""Privacy-minimized state machine for human-driven tutor acceptance runs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

SCHEMA = "tutor.human-acceptance-run/v2"
TOKEN = re.compile(r"^[a-z][a-z0-9_-]{2,79}$")
REF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$")
COMMIT = re.compile(r"^(?:[a-f0-9]{40}|[a-f0-9]{64})$")
OBSERVATIONS = ("as-expected", "different", "no-output", "access-barrier", "unavailable")
OUTCOMES = ("match", "mismatch")
VERDICTS = ("pass", "fail", "blocked", "skipped")
SEVERITIES = ("blocking", "major", "minor", "informational", "not-applicable")
DECISIONS = ("go", "no-go", "conditional")
FEEDBACK_KINDS = ("ux", "visual", "content", "accessibility", "workflow", "idea")


class StateError(ValueError):
    pass


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise StateError(f"cannot read validated checkpoint: {type(exc).__name__}") from exc
    if not isinstance(value, dict) or value.get("schema") != SCHEMA:
        raise StateError("checkpoint schema is not recognized")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(canonical(value))
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def require_token(value: str, field: str) -> str:
    if not TOKEN.fullmatch(value):
        raise StateError(f"{field} must be an opaque lowercase ID")
    return value


def require_ref(value: str | None) -> str | None:
    if value is not None and not REF.fullmatch(value):
        raise StateError("evidence references must be relative opaque artifact names, not content or URLs")
    return value


def require_feedback_summary(value: str) -> str:
    summary = " ".join(value.split())
    if not 8 <= len(summary) <= 240:
        raise StateError("feedback summary must contain 8 to 240 characters")
    if re.search(r"https?://|[A-Za-z]:[\\/]|(?:^|\s)/(?:home|Users?|var|tmp)/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", summary):
        raise StateError("feedback summary must not contain URLs, absolute paths, or contact identifiers")
    return summary


def require_human(value: str) -> None:
    if value != "human":
        raise StateError("only a human-assigned result may be recorded")


def require_running(state: dict[str, Any]) -> None:
    if state["status"] != "running":
        raise StateError("run must be resumed before this operation")


def load_bound(args: argparse.Namespace) -> tuple[Path, dict[str, Any]]:
    checkpoint = Path(args.checkpoint)
    state = read_json(checkpoint)
    plan = Path(args.plan).resolve()
    if not plan.is_file():
        raise StateError("canonical plan is unavailable")
    digest = hashlib.sha256(plan.read_bytes()).hexdigest()
    if state["plan"] != {"file": plan.name, "version": args.plan_version, "sha256": digest}:
        raise StateError("plan path, version, or digest changed; start a new reviewed run")
    return checkpoint, state


def add_binding(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--plan-version", required=True)


def mutate(args: argparse.Namespace, operation) -> dict[str, Any]:
    checkpoint, state = load_bound(args)
    operation(state)
    state["sequence"] += 1
    write_json(checkpoint, state)
    return state


def command_init(args: argparse.Namespace) -> dict[str, Any]:
    checkpoint = Path(args.checkpoint)
    if checkpoint.exists():
        raise StateError("checkpoint already exists; resume or reset it explicitly")
    require_token(args.run_id, "run ID")
    if not args.synthetic_confirmed:
        raise StateError("synthetic disposable data must be confirmed")
    if not COMMIT.fullmatch(args.product_checkpoint):
        raise StateError("product checkpoint must be an exact lowercase commit digest")
    plan = Path(args.plan).resolve()
    if not plan.is_file():
        raise StateError("canonical plan is unavailable")
    try:
        workspace = json.loads(Path(args.workspace_manifest).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise StateError(f"cannot validate disposable workspace manifest: {type(exc).__name__}") from exc
    if not isinstance(workspace, dict) or workspace.get("schema") != "tutor.workspace/v1" or workspace.get("test_only") is not True:
        raise StateError("workspace manifest must be tutor.workspace/v1 and explicitly test_only")
    require_token(workspace.get("workspace_id", ""), "workspace ID")
    state = {
        "schema": SCHEMA,
        "sequence": 1,
        "run_id": args.run_id,
        "status": "running",
        "platform": args.platform,
        "product_checkpoint": args.product_checkpoint,
        "synthetic_disposable_confirmed": True,
        "workspace": {"workspace_id": workspace["workspace_id"], "schema": workspace["schema"], "test_only": True},
        "plan": {"file": plan.name, "version": args.plan_version, "sha256": hashlib.sha256(plan.read_bytes()).hexdigest()},
        "active": None,
        "scenarios": {},
        "feedback": [],
        "decision": None,
    }
    write_json(checkpoint, state)
    return state


def command_begin(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_running(state)
        if state["active"] is not None:
            raise StateError("complete the active action before beginning another")
        scenario, action = require_token(args.scenario, "scenario"), require_token(args.action, "action")
        unfinished = [key for key, value in state["scenarios"].items() if value["verdict"] is None and key != scenario]
        if unfinished:
            raise StateError("finish the current scenario before beginning another")
        record = state["scenarios"].setdefault(scenario, {"actions": [], "verdict": None})
        if record["verdict"] is not None:
            raise StateError("scenario already has a human verdict")
        if any(item["action"] == action for item in record["actions"]):
            raise StateError("action was already recorded")
        setup_ref = require_ref(args.setup_ref)
        if scenario == "scn_access" and action == "act_motion" and setup_ref is None:
            raise StateError("reduced-motion action requires verified setup evidence")
        state["active"] = {"scenario": scenario, "action": action, "observation": None, **({"setup_evidence_ref": setup_ref} if setup_ref else {})}
    return mutate(args, operation)


def command_observe(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_running(state)
        if state["active"] is None or state["active"]["observation"] is not None:
            raise StateError("one active unobserved action is required")
        state["active"]["observation"] = {"category": args.category, "evidence_ref": require_ref(args.evidence_ref)}
    return mutate(args, operation)


def command_complete(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_running(state)
        require_human(args.assigned_by)
        active = state["active"]
        if active is None or active["observation"] is None:
            raise StateError("record the human observation before the human-assigned outcome")
        reset_ref = require_ref(args.reset_ref)
        if active["scenario"] == "scn_access" and active["action"] == "act_motion" and reset_ref is None:
            raise StateError("reduced-motion action requires verified reset evidence")
        state["scenarios"][active["scenario"]]["actions"].append({**active, "outcome": args.outcome, **({"reset_evidence_ref": reset_ref} if reset_ref else {})})
        state["active"] = None
    return mutate(args, operation)


def command_verdict(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_running(state)
        require_human(args.assigned_by)
        if state["active"] is not None:
            raise StateError("complete the active action before assigning a scenario verdict")
        scenario = require_token(args.scenario, "scenario")
        record = state["scenarios"].get(scenario)
        if not record or not record["actions"] or record["verdict"] is not None:
            raise StateError("scenario needs completed actions and no prior verdict")
        record["verdict"] = {"value": args.value, "severity": args.severity, "evidence_ref": require_ref(args.evidence_ref), "assigned_by": "human"}
    return mutate(args, operation)


def command_feedback(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_human(args.assigned_by)
        if state["status"] not in ("running", "paused"):
            raise StateError("feedback can be recorded only during an active run")
        scenario = require_token(args.scenario, "scenario") if args.scenario else None
        action = require_token(args.action, "action") if args.action else None
        if action and not scenario:
            raise StateError("feedback action requires a scenario")
        summary = require_feedback_summary(args.summary)
        signature = canonical({"kind": args.kind, "summary": summary, "scenario": scenario, "action": action})
        feedback_id = f"fbk_{hashlib.sha256(signature).hexdigest()[:16]}"
        if any(item["feedback_id"] == feedback_id for item in state["feedback"]):
            raise StateError("duplicate feedback item")
        state["feedback"].append({
            "feedback_id": feedback_id,
            "kind": args.kind,
            "summary": summary,
            "scenario": scenario,
            "action": action,
            "assigned_by": "human",
        })
    return mutate(args, operation)


def command_pause(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_running(state)
        state["status"] = "paused"
    return mutate(args, operation)


def command_resume(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        if state["status"] != "paused":
            raise StateError("only a paused run can resume")
        state["status"] = "running"
    return mutate(args, operation)


def summary(state: dict[str, Any]) -> dict[str, Any]:
    completed = {scenario: record for scenario, record in state["scenarios"].items() if record["verdict"]}
    verdicts = [record["verdict"] for record in completed.values()]
    counts = {value: sum(item["value"] == value for item in verdicts) for value in VERDICTS}
    evidence = set()
    for record in completed.values():
        for action in record["actions"]:
            if action["observation"]["evidence_ref"]:
                evidence.add(action["observation"]["evidence_ref"])
            for field in ("setup_evidence_ref", "reset_evidence_ref"):
                if action.get(field):
                    evidence.add(action[field])
        if record["verdict"]["evidence_ref"]:
            evidence.add(record["verdict"]["evidence_ref"])
    return {
        "schema": "tutor.human-acceptance-summary/v1",
        "run_id": state["run_id"],
        "plan": state["plan"],
        "product_checkpoint": state["product_checkpoint"],
        "counts": counts,
        "blocking_failures": sum(item["value"] == "fail" and item["severity"] == "blocking" for item in verdicts),
        "blocking_coverage_gates": sum(item["value"] == "blocked" and item["severity"] == "blocking" for item in verdicts),
        "scenario_results": {scenario: record["verdict"] for scenario, record in sorted(completed.items())},
        "evidence_refs": sorted(evidence),
        "feedback_count": len(state["feedback"]),
        "feedback": state["feedback"],
        "unresolved_active_action": state["active"] is not None,
        "human_decision": state["decision"],
        "decision_required": state["decision"] is None,
    }


def command_summary(args: argparse.Namespace) -> dict[str, Any]:
    _, state = load_bound(args)
    return summary(state)


def command_decide(args: argparse.Namespace) -> dict[str, Any]:
    def operation(state: dict[str, Any]) -> None:
        require_running(state)
        require_human(args.assigned_by)
        if state["active"] is not None:
            raise StateError("complete the active action before the human decision")
        state["decision"] = {"value": args.value, "assigned_by": "human"}
        state["status"] = "complete"
    state = mutate(args, operation)
    return summary(state)


def command_reset(args: argparse.Namespace) -> dict[str, Any]:
    checkpoint, state = load_bound(args)
    if args.confirm_run_id != state["run_id"]:
        raise StateError("exact run ID confirmation is required")
    checkpoint.resolve().unlink()
    return {"status": "reset", "run_id": state["run_id"], "deleted": checkpoint.name}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init"); add_binding(init)
    init.add_argument("--run-id", required=True); init.add_argument("--platform", choices=("windows", "macos", "linux"), required=True)
    init.add_argument("--product-checkpoint", required=True); init.add_argument("--workspace-manifest", required=True); init.add_argument("--synthetic-confirmed", action="store_true"); init.set_defaults(handler=command_init)
    begin = commands.add_parser("begin-action"); add_binding(begin); begin.add_argument("--scenario", required=True); begin.add_argument("--action", required=True); begin.add_argument("--setup-ref"); begin.set_defaults(handler=command_begin)
    observe = commands.add_parser("observe"); add_binding(observe); observe.add_argument("--category", choices=OBSERVATIONS, required=True); observe.add_argument("--evidence-ref"); observe.set_defaults(handler=command_observe)
    complete = commands.add_parser("complete-action"); add_binding(complete); complete.add_argument("--outcome", choices=OUTCOMES, required=True); complete.add_argument("--reset-ref"); complete.add_argument("--assigned-by", required=True); complete.set_defaults(handler=command_complete)
    verdict = commands.add_parser("verdict"); add_binding(verdict); verdict.add_argument("--scenario", required=True); verdict.add_argument("--value", choices=VERDICTS, required=True); verdict.add_argument("--severity", choices=SEVERITIES, required=True); verdict.add_argument("--evidence-ref"); verdict.add_argument("--assigned-by", required=True); verdict.set_defaults(handler=command_verdict)
    feedback = commands.add_parser("feedback"); add_binding(feedback); feedback.add_argument("--kind", choices=FEEDBACK_KINDS, required=True); feedback.add_argument("--summary", required=True); feedback.add_argument("--scenario"); feedback.add_argument("--action"); feedback.add_argument("--assigned-by", required=True); feedback.set_defaults(handler=command_feedback)
    for name, handler in (("pause", command_pause), ("resume", command_resume), ("summary", command_summary)):
        item = commands.add_parser(name); add_binding(item); item.set_defaults(handler=handler)
    decide = commands.add_parser("decide"); add_binding(decide); decide.add_argument("--value", choices=DECISIONS, required=True); decide.add_argument("--assigned-by", required=True); decide.set_defaults(handler=command_decide)
    reset = commands.add_parser("reset"); add_binding(reset); reset.add_argument("--confirm-run-id", required=True); reset.set_defaults(handler=command_reset)
    return result


def main() -> int:
    try:
        args = parser().parse_args()
        print(json.dumps(args.handler(args), ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return 0
    except StateError as exc:
        print(json.dumps({"error": str(exc)}, separators=(",", ":")), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
