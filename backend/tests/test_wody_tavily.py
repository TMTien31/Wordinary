from __future__ import annotations

import asyncio
import json
import uuid

from app.modules.wody.service import SYSTEM_PROMPT_TEMPLATE
from app.modules.wody.service import WodyService
from app.modules.wody.service import _article_safety_issue
from app.modules.wody.service import _article_from_tavily
from app.modules.library.service import _normalize_content
from app.modules.wody.service import _source_from_tavily_extract
from app.modules.wody.service import _tavily_search_results


def test_tavily_search_results_keep_valid_urls_and_sort_by_score() -> None:
    payload = {
        "results": [
            {"title": "Low", "url": "https://example.com/low", "score": "0.2"},
            {"title": "Missing URL", "score": 1},
            {"title": "High", "url": "https://example.com/high", "score": 0.9},
            {"title": "Bad score", "url": "https://example.com/bad", "score": "n/a"},
        ]
    }

    results = _tavily_search_results(payload)

    assert [item["title"] for item in results] == ["High", "Low", "Bad score"]


def test_wody_prompt_limits_general_assistant_behavior_with_a_warm_redirect() -> None:
    assert "not a general-purpose assistant" in SYSTEM_PROMPT_TEMPLATE
    assert "Do not open with a cold refusal" in SYSTEM_PROMPT_TEMPLATE
    assert "sports schedules" in SYSTEM_PROMPT_TEMPLATE
    assert "Vietnam national team" not in SYSTEM_PROMPT_TEMPLATE
    assert "web_search:" not in SYSTEM_PROMPT_TEMPLATE


def test_wody_tools_exclude_general_web_search_but_keep_article_research() -> None:
    tools = WodyService(None)._build_tools(uuid.uuid4())  # type: ignore[arg-type]
    tool_names = {item.name for item in tools}

    assert "web_search" not in tool_names
    assert "search_article_sources" in tool_names


def test_article_safety_blocks_dangerous_topics_in_english_and_vietnamese() -> None:
    assert _article_safety_issue("Find an article about murder") == "severe_violence"
    assert _article_safety_issue("Tìm một bài về giết người") == "severe_violence"
    assert _article_safety_issue("How to make a bomb") == "weapons"
    assert _article_safety_issue("An article about self-harm") == "self_harm"


def test_article_safety_allows_general_learning_topics() -> None:
    assert _article_safety_issue("How memory helps English vocabulary") is None
    assert _article_safety_issue("A B1 article about peaceful conflict resolution") is None


def test_article_tools_block_before_search_or_database_work() -> None:
    tools = {
        item.name: item
        for item in WodyService(None)._build_tools(uuid.uuid4())  # type: ignore[arg-type]
    }

    search_result = asyncio.run(
        tools["search_article_sources"].ainvoke({"topic": "Tìm bài về giết người"})
    )
    save_result = asyncio.run(
        tools["save_article_draft"].ainvoke(
            {
                "title": "A story about murder",
                "content": "This unsafe draft must be blocked before persistence.",
                "source_url": "https://example.com/article",
            }
        )
    )

    assert json.loads(search_result)["blocked"] is True
    assert json.loads(search_result)["stage"] == "search"
    assert json.loads(save_result)["blocked"] is True
    assert json.loads(save_result)["stage"] == "save"


def test_article_from_tavily_cleans_markdown_and_uses_fallback_title() -> None:
    payload = {
        "results": [
            {
                "url": "https://example.com/article",
                "raw_content": """
Title: Ignored provider title

# A Useful Heading

This is the first paragraph with a [helpful link](https://example.com).

![Decorative image](https://example.com/image.png)

This is the second paragraph with **bold** text and `code` markers.
""",
            }
        ]
    }

    article = _article_from_tavily(
        payload,
        fallback_url="https://fallback.example/article",
        fallback_title="Fallback Title",
        fallback_content="",
    )

    assert article["url"] == "https://example.com/article"
    assert article["title"] == "Fallback Title"
    assert "A Useful Heading" in article["content"]
    assert "helpful link" in article["content"]
    assert "Decorative image" not in article["content"]
    assert "**" not in article["content"]


def test_source_from_tavily_extract_keeps_markdown_images_for_model() -> None:
    payload = {
        "results": [
            {
                "url": "https://example.com/article",
                "title": "Source title",
                "raw_content": """
Title: Ignored

# A Useful Heading

This article paragraph gives the model enough usable source material to draft from.

![Chart showing growth](https://example.com/chart.png)
""",
            }
        ]
    }

    source = _source_from_tavily_extract(
        payload,
        fallback_url="https://fallback.example/article",
        fallback_title="Fallback title",
        fallback_content="Search snippet",
        score=0.8,
        published_date="2026-09-07",
    )

    assert source["url"] == "https://example.com/article"
    assert "![Chart showing growth](https://example.com/chart.png)" in source["raw_content"]
    assert source["images"] == [
        {"url": "https://example.com/chart.png", "alt": "Chart showing growth"}
    ]


def test_markdown_content_normalization_preserves_blocks_and_images() -> None:
    content = "# Heading\r\n\r\nParagraph one.\r\n\r\n![Alt](https://example.com/a.png)"

    normalized = _normalize_content(content, "markdown")

    assert normalized == "# Heading\n\nParagraph one.\n\n![Alt](https://example.com/a.png)"
