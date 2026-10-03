"""Max mode persona injection in ai_service.build_system_prompt."""

from backend.services import ai_service
from backend.services.ai_max_persona import MAX_PERSONA


def test_max_mode_includes_persona():
    prompt = ai_service.build_system_prompt([], [], model="max")
    assert MAX_PERSONA in prompt
    assert "Max Yuglich" in prompt


def test_other_models_have_no_persona():
    for model in ("auto", "deep"):
        assert "MAX MODE" not in ai_service.build_system_prompt([], [], model=model)


def test_persona_does_not_name_call_or_leak_private_data():
    lowered = MAX_PERSONA.lower()
    assert "call the user an idiot" not in lowered
    for leak in ("aba#", "swift", "account #", "@eaglechair.com", "713."):
        assert leak not in lowered
