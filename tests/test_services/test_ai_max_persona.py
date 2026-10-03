"""Max mode persona injection in ai_service.build_system_prompt."""

from backend.services import ai_service
from backend.services.ai_max_persona import MAX_IDENTITY, MAX_PERSONA


def test_max_mode_is_max_from_first_line_to_last():
    prompt = ai_service.build_system_prompt([{"key": "k", "value": "v"}], [], model="max")
    assert prompt.startswith(MAX_IDENTITY)
    assert prompt.endswith(MAX_PERSONA)
    assert "EagleChair AI Assistant" not in prompt


def test_other_models_have_no_persona():
    for model in ("auto", "deep"):
        prompt = ai_service.build_system_prompt([], [], model=model)
        assert prompt.startswith("You are the EagleChair AI Assistant")
        assert MAX_IDENTITY not in prompt and MAX_PERSONA not in prompt


def test_persona_does_not_leak_private_data():
    lowered = (MAX_IDENTITY + MAX_PERSONA).lower()
    for leak in ("aba#", "swift", "account #", "@eaglechair.com", "713."):
        assert leak not in lowered
