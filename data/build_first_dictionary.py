"""Reproduce the complete pinned WordTyper CET-4 sample using Python stdlib.

Run from any directory: python data/build_first_dictionary.py
Uses the vendored small source file first; if missing, fetches the pinned
GitHub blob (raw HTTPS, then authenticated gh API as a transport fallback).
No ECDICT database download and no model-generated dictionary content.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import subprocess
import urllib.request
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
COMMIT = "b5790cafcad1795873410e984c834ef1ddac20ac"
REPO = "grhliu/wordtyper-vocabularies"
SOURCE_PATH = "vocabularies/cet4.json"
SHA256 = "568b5203eb6b48bdecf8deb8d5ad3bc6546b7960c72e9eafcd877242b6b70105"
SOURCE_ID = "wordtyper-cet4-2-0-0"
CACHE = ROOT / "data/sources/wordtyper-cet4/cet4.json"
POS = re.compile(r"^(n|vt|vi|a|adv|v|prep|conj|num|pron|pl|interj|aux|pref|vi\.vt)\.\s+")


def read_source():
    if CACHE.exists():
        raw = CACHE.read_bytes()
    else:
        url = f"https://raw.githubusercontent.com/{REPO}/{COMMIT}/{SOURCE_PATH}"
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                raw = response.read()
        except Exception:
            response = subprocess.check_output([
                "gh", "api", f"repos/{REPO}/contents/{SOURCE_PATH}?ref={COMMIT}"
            ])
            raw = base64.b64decode(json.loads(response)["content"])
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        # Never persist a response that fails the pin.
        if hashlib.sha256(raw).hexdigest() != SHA256:
            raise ValueError("Downloaded source SHA256 mismatch")
        CACHE.write_bytes(raw)
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("Cached source SHA256 mismatch")
    return json.loads(raw)


def build():
    source = read_source()
    assert source["wordCount"] == len(source["words"]) == 3815
    cards = []
    for word in source["words"]:
        term = word["word"]
        assert term and word["translations"]
        senses = []
        counters = Counter()
        for translation in word["translations"]:
            match = POS.match(translation)
            part = match.group(1) + "." if match else "other"
            body = translation[match.end():] if match else translation
            # Preserve each source row as its own sense. Split only explicit
            # list separators, never infer a meaning or a missing part of speech.
            definitions = [s.strip() for s in re.split(r",\s+|;\s+|[，；]", body) if s.strip()]
            assert definitions
            key = part.rstrip(".").replace(".", "-")
            counters[key] += 1
            senses.append({"id": f"{key}-{counters[key]}", "partOfSpeech": part,
                           "definitions": definitions})
        # Reading excerpt only: full definitions remain in senses. Prefer whole
        # definitions (at most three) while they fit 32 code points.
        excerpt = []
        for definition in senses[0]["definitions"][:3]:
            if len("；".join(excerpt + [definition])) > 32:
                break
            excerpt.append(definition)
        short = "；".join(excerpt) if excerpt else senses[0]["definitions"][0][:31] + "…"
        pronunciations = []
        if word["phonetic"].strip():
            pronunciations.append({"system": "ipa", "region": "general", "value": word["phonetic"]})
        cards.append({
            "id": "wordtyper-cet4-" + hashlib.sha256(term.encode("utf-8")).hexdigest()[:16],
            "type": "vocabulary", "term": term, "shortDefinition": short,
            "pronunciations": pronunciations, "senses": senses, "sourceRefs": [SOURCE_ID],
        })
    deck = {
        "format": "lexora.deck", "schemaVersion": 2,
        "id": "wordtyper-cet4-core", "revision": 1,
        "title": "WordTyper 四级核心词表（3815 词）",
        "description": "完整转换 WordTyper Vocabularies 2.0.0 的 CET-4 核心词汇，共 3815 词。上游声明派生自 ECDICT；仅供学习参考，不代表官方四级大纲全部词汇。释义与音标保留源数据，未人工校订。",
        "language": "en", "answerLanguage": "zh-Hans",
        "sources": [{"id": SOURCE_ID, "title": "WordTyper Vocabularies — CET-4 核心词汇 2.0.0",
                     "url": f"https://github.com/{REPO}/blob/{COMMIT}/{SOURCE_PATH}", "license": "MIT"}],
        "cards": cards,
    }
    assert len({c["id"] for c in cards}) == len(cards)
    assert len({c["term"] for c in cards}) == len(cards)
    assert [c["term"] for c in cards] == [w["word"] for w in source["words"]]
    # Verify every full source row survives the only documented separator transform.
    for word, card in zip(source["words"], cards):
        assert len(word["translations"]) == len(card["senses"])
        for row, sense in zip(word["translations"], card["senses"]):
            match = POS.match(row)
            body = row[match.end():] if match else row
            assert sense["definitions"] == [s.strip() for s in re.split(r",\s+|;\s+|[，；]", body) if s.strip()]
        assert not word["phonetic"].strip() or card["pronunciations"][0]["value"] == word["phonetic"]
    output = ROOT / "examples/first-dictionary.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    stats = {
        "cards": len(cards), "uniqueIds": len({c["id"] for c in cards}),
        "uniqueTerms": len({c["term"] for c in cards}),
        "withPronunciation": sum(bool(c["pronunciations"]) for c in cards),
        "missingPronunciation": sum(not c["pronunciations"] for c in cards),
        "multipleKnownPartsOfSpeech": sum(len({s["partOfSpeech"] for s in c["senses"] if s["partOfSpeech"] != "other"}) > 1 for c in cards),
        "multipleDefinitions": sum(sum(len(s["definitions"]) for s in c["senses"]) > 1 for c in cards),
        "sourceTranslationRows": sum(len(c["senses"]) for c in cards),
        "unknownPartOfSpeechRows": sum(s["partOfSpeech"] == "other" for c in cards for s in c["senses"]),
        "cardsWithUnknownPartOfSpeech": sum(any(s["partOfSpeech"] == "other" for s in c["senses"]) for c in cards),
        "onlyUnknownPartOfSpeech": sum(all(s["partOfSpeech"] == "other" for s in c["senses"]) for c in cards),
        "shortDefinitionMaxLength": max(len(c["shortDefinition"]) for c in cards),
        "sourceCommit": COMMIT, "sourceSha256": SHA256,
        "outputSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    build()
