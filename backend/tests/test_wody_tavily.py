from __future__ import annotations

from app.modules.wody.service import _article_from_tavily
from app.modules.wody.service import _tavily_search_results
from app.modules.wody.service import _tavily_web_search_output


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


def test_tavily_web_search_output_is_compact_and_source_friendly() -> None:
    output = _tavily_web_search_output(
        {
            "query": "latest AI news",
            "answer": "A short answer.",
            "usage": {"credits": 1},
            "results": [
                {
                    "title": "Source",
                    "url": "https://example.com/source",
                    "content": "Useful search snippet.",
                    "score": 0.8,
                    "published_date": "2026-09-07",
                }
            ],
        }
    )

    assert output["provider"] == "tavily"
    assert output["answer"] == "A short answer."
    assert output["results"][0]["url"] == "https://example.com/source"
    assert output["results"][0]["score"] == 0.8
    assert output["usage"] == {"credits": 1}


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
