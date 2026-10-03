"""Agent loop in ai_service.stream_ai_response, driven by a fake Gemini client."""

import pytest
from google.genai import types

from backend.services import ai_service

pytestmark = pytest.mark.asyncio


def _chunk(parts, tokens=10, finish=None):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=parts), finish_reason=finish)],
        usage_metadata=types.GenerateContentResponseUsageMetadata(total_token_count=tokens),
    )


class FakeModels:
    def __init__(self, turns):
        self.turns = list(turns)
        self.requests = []

    async def generate_content_stream(self, model, contents, config):
        self.requests.append({"model": model, "contents": list(contents), "config": config})
        chunks = self.turns.pop(0)

        async def gen():
            for c in chunks:
                yield c
        return gen()


class FakeClient:
    def __init__(self, turns):
        self.aio = type("Aio", (), {})()
        self.aio.models = FakeModels(turns)


async def _run(monkeypatch, turns, **kwargs):
    client = FakeClient(turns)
    monkeypatch.setattr(ai_service, "get_gemini_client", lambda: client)
    events = [e async for e in ai_service.stream_ai_response([{"role": "user", "content": "hi"}], "sys", **kwargs)]
    return client, events


async def test_parallel_calls_keep_thought_signatures(monkeypatch):
    signed_call = types.Part(
        function_call=types.FunctionCall(id="call-1", name="calculate", args={"expression": "2+2"}),
        thought_signature=b"sig-1",
    )
    second_call = types.Part(function_call=types.FunctionCall(id="call-2", name="calculate", args={"expression": "3*3"}))
    turns = [
        [_chunk([types.Part(text="Let me check. ")]), _chunk([signed_call, second_call], tokens=40)],
        [_chunk([types.Part(text="4 and 9.")], tokens=60, finish=types.FinishReason.STOP)],
    ]
    client, events = await _run(monkeypatch, turns)

    second_request = client.aio.models.requests[1]["contents"]
    model_turn, tool_turn = second_request[-2], second_request[-1]
    # The model turn goes back verbatim, signatures included
    assert model_turn.role == "model"
    assert [p.thought_signature for p in model_turn.parts if p.function_call] == [b"sig-1", None]
    # Both calls answered, ids echoed, in order
    assert [(p.function_response.id, p.function_response.response["result"]) for p in tool_turn.parts] == [
        ("call-1", "4"), ("call-2", "9"),
    ]

    types_seen = [e["type"] for e in events]
    assert types_seen.count("tool_call_started") == 2 and types_seen.count("tool_call") == 2
    text = "".join(e["data"]["content"] for e in events if e["type"] == "text_chunk")
    assert text == "Let me check. 4 and 9."
    done = events[-1]
    assert done["type"] == "message_done" and done["data"]["tokens"] == 100


async def test_config_uses_current_model_and_thinking(monkeypatch):
    turns = [[_chunk([types.Part(text="ok")], finish=types.FinishReason.STOP)]]
    client, _ = await _run(monkeypatch, turns, model="deep", mode="ask")
    req = client.aio.models.requests[0]
    assert req["model"] == ai_service.settings.GEMINI_MODEL
    assert req["config"].thinking_config.thinking_level == types.ThinkingLevel.HIGH
    names = {d.name for d in req["config"].tools[0].function_declarations}
    assert "propose_changes" not in names and "list_records" in names


async def test_tool_errors_are_returned_to_model(monkeypatch):
    bad = types.Part(function_call=types.FunctionCall(id="c", name="list_records", args={"entity_type": "spaceship"}))
    turns = [[_chunk([bad])], [_chunk([types.Part(text="sorry")], finish=types.FinishReason.STOP)]]
    client, events = await _run(monkeypatch, turns)
    response = client.aio.models.requests[1]["contents"][-1].parts[0].function_response.response
    assert "Unknown entity_type" in response["error"]
    assert events[-1]["type"] == "message_done"


async def test_propose_changes_refused_in_ask_mode(monkeypatch):
    call = types.Part(function_call=types.FunctionCall(id="c", name="propose_changes", args={"title": "x", "changes": []}))
    turns = [[_chunk([call])], [_chunk([types.Part(text="ok")], finish=types.FinishReason.STOP)]]
    client, _ = await _run(monkeypatch, turns, mode="ask")
    response = client.aio.models.requests[1]["contents"][-1].parts[0].function_response.response
    assert "read-only" in response["error"]
