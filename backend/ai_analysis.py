import os
from pathlib import Path
from google import genai
from google.genai import types

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set. Add it to your .env file.")
        _client = genai.Client(api_key=key)
    return _client


def _load_investment_context() -> str:
    ctx_path = Path(__file__).parent / "investment_context.txt"
    if ctx_path.exists():
        return ctx_path.read_text()
    return "(No investment_context.txt found — copy investment_context.example.txt and fill it in.)"

INVESTMENT_STRATEGY_CONTEXT = _load_investment_context()


def _build_system_prompt(allocation: dict) -> str:
    total = allocation["total_value"]

    lines = [
        f"Total Portfolio Value: ${total:,.0f}",
        "",
        "Current vs Target Allocation:",
        f"{'Category':<30} {'Current%':>9} {'Target%':>8} {'Delta%':>8}",
        "-" * 60,
    ]
    for row in allocation["rows"]:
        lines.append(
            f"{row['category']:<30} {row['current_pct']:>8.1f}% "
            f"{row['target_pct']:>7.1f}% {row['delta_pct']:>+8.1f}%"
        )

    portfolio_summary = "\n".join(lines)

    return f"""You are a knowledgeable, candid personal finance advisor and investment analyst. \
You have broad financial expertise — market history, portfolio theory, tax strategy, asset allocation, \
behavioral finance, and macroeconomics. You are NOT limited to the user's document; use your full \
financial knowledge to give honest, specific, well-reasoned advice.

The user wants real analysis and real conversations — not generic disclaimers. Be direct. \
If something in their portfolio is a problem, say so. If their strategy is sound, affirm it with reasoning.

CURRENT PORTFOLIO DATA:
{portfolio_summary}

{INVESTMENT_STRATEGY_CONTEXT}

When answering:
- Use actual numbers from the portfolio when relevant
- Reference both the user's stated strategy AND broader financial principles
- Point out blindspots or risks the user may not have considered
- Keep responses focused and readable — use markdown headers/bullets where helpful
- If you don't know something specific (e.g. exact tax rules in their state), say so"""


def stream_chat(messages: list[dict], allocation: dict):
    """
    messages: list of {role: "user"|"assistant", content: str}
    Streams text chunks from Gemini.
    """
    system_prompt = _build_system_prompt(allocation)

    # Build Gemini contents list — role must be "user" or "model"
    contents = []
    for msg in messages:
        gemini_role = "model" if msg["role"] == "assistant" else "user"
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part(text=msg["content"])])
        )

    response = _get_client().models.generate_content_stream(
        model="gemini-2.5-flash-lite",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=2048,
        ),
    )

    for chunk in response:
        if chunk.text:
            yield chunk.text
