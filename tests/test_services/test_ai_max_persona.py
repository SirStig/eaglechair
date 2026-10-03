"""Max mode: prompt assembly, real-email voice examples and corpus hygiene."""

import json
import re

from backend.services import ai_max_persona, ai_service
from backend.services.ai_max_persona import MAX_CHARACTER, MAX_IDENTITY, classify_message, voice_examples


def test_max_prompt_opens_as_max_and_ends_with_his_character_and_emails():
    prompt = ai_service.build_system_prompt(
        [{"key": "k", "value": "v"}], [], model="max", live_data="LIVE-DATA", latest_message="what's the 6018 price"
    )
    assert prompt.startswith(MAX_IDENTITY)
    assert "EagleChair AI Assistant" not in prompt
    # Live data is not allowed to sit after the character
    assert prompt.index("LIVE-DATA") < prompt.index(MAX_CHARACTER.strip()[:40])
    assert prompt.split("### Your own emails")[0].rstrip().endswith(MAX_CHARACTER.strip()[-60:])


def test_other_models_unchanged_and_get_live_data():
    for model in ("auto", "deep"):
        prompt = ai_service.build_system_prompt([], [], model=model, live_data="LIVE-DATA")
        assert prompt.startswith("You are the EagleChair AI Assistant")
        assert MAX_IDENTITY not in prompt and "### Your own emails" not in prompt
        assert prompt.endswith("## Live Data\nLIVE-DATA")


def test_voice_examples_rotate_and_are_his_real_emails():
    corpus_texts = {c["t"] for c in ai_max_persona._corpus()}
    a, b = voice_examples("what's the 6018 price", seed=1), voice_examples("what's the 6018 price", seed=2)
    assert a != b
    shown = re.findall(r"\n\[[^\]]+\]\n(.*?)(?=\n\n\[|\Z)", a, re.S)
    assert len(shown) == 10
    assert all(t in corpus_texts for t in shown)


def test_classify_message():
    assert classify_message("you don't work very well") == "hostile"
    assert classify_message("you're just an AI") == "hostile"
    assert classify_message("my dad passed away") == "personal"
    assert classify_message("write an email to Rick about the delay") == "draft"
    assert classify_message("good morning") == "smalltalk"
    assert classify_message("raise the 6018 price by 10%") == "task"
    assert classify_message("what finishes does the 5242 come in") == "question"


def test_corpus_has_no_private_data():
    raw = ai_max_persona._CORPUS_PATH.read_text(encoding="utf-8")
    corpus = json.loads(raw)
    assert len(corpus) > 500
    assert {"a", "s", "m", "t"} <= set(corpus[0])
    leaks = re.compile(r"(?i)(@[a-z0-9-]+\.|https?://|\b\d{3}[.\- ]\d{3}[.\- ]\d{4}\b|ABA#|SWIFT|\b\d{7,}\b)")
    assert not [c["t"] for c in corpus if leaks.search(c["t"])]
