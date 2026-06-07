"""
Gamma Agent — Groq llama-3.3-70b (budget/fast, intentionally lower quality).

Gamma exists to create demo contrast. It's fast and cheap but often gives
shorter, less complete answers. This makes the judge's scoring visible —
you can watch Gamma score 0.4-0.6 while Alpha scores 0.85+.

In round 2, the orchestrator learns to prefer Alpha over Gamma.
"""
import logging

from groq import AsyncGroq

from .base import BaseAgent
from .config import settings

logger = logging.getLogger("agents.gamma")

# Intentionally minimal system prompt — lower quality answers
GAMMA_SYSTEM = "You are Gamma, an AI agent. Answer the question. Be brief. Return JSON with keys: reasoning, answer, confidence."


class GammaAgent(BaseAgent):
    name = "Gamma"
    capabilities = ["general", "nlp"]
    tier = "gamma"
    potential_roles = [
        "Customer", "User Advocate", "Market Researcher",
        "Operations Manager", "Quality Assurance", "Growth Expert",
    ]

    def __init__(self, private_key: str = None):
        super().__init__(private_key or settings.GAMMA_PRIVATE_KEY)
        self._client = None

    @property
    def client(self) -> AsyncGroq:
        if self._client is None:
            self._client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        return self._client

    async def bid_for_roles(
        self,
        proposal_id: str,
        title: str,
        description: str,
        roles: list[dict],
    ) -> list[dict]:
        """Groq-powered fast bid assessment."""
        bids = []
        available = {r["name"]: r for r in roles}
        target_role_names = [
            r for r in self.potential_roles if r in available
        ]
        if not target_role_names:
            target_role_names = list(available.keys())[:1]  # take first available

        for role_name in target_role_names:
            role = available[role_name]
            prompt = (
                f"Proposal: {title}\n"
                f"Role: {role_name} — {role.get('description', '')}\n"
                f"My focus: end-user experience, market reality, growth.\n\n"
                f"Rate my fit 0.0-1.0. Return JSON: {{\"fit_score\": 0.7, \"reasoning\": \"brief\"}}"
            )
            try:
                completion = await self.client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "Rate fit for role. Return JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=80,
                    temperature=0.3,
                )
                raw = completion.choices[0].message.content
                result = self._parse_json_response(raw)
                fit_score = max(0.3, min(0.85, float(result.get("fit_score", 0.6))))
                bids.append({
                    "role_name": role_name,
                    "fit_score": fit_score,
                    "reasoning": result.get("reasoning", ""),
                })
            except Exception as e:
                logger.debug(f"[Gamma] Bid error for {role_name}: {e}")
                bids.append({
                    "role_name": role_name,
                    "fit_score": 0.55,
                    "reasoning": "Fast market-focused perspective.",
                })

        logger.info(f"[Gamma] Submitting {len(bids)} bid(s) for #{proposal_id[:8]}")
        return bids

    async def discuss_as_role(
        self,
        proposal_id: str,
        role_name: str,
        round_num: int,
        round_type: str,
        previous_messages: list[dict],
    ) -> str:
        """Generate a discussion contribution using Groq llama."""
        prev_text = "\n".join(
            f"[{m['role_name']}]: {m['content'][:200]}"
            for m in previous_messages[-6:]  # last 6 messages for context
        ) if previous_messages else "(No prior discussion)"

        round_instructions = {
            "initial": f"As {role_name}, give your first-hand perspective on this proposal. Focus on real-world impact.",
            "response": f"As {role_name}, react to what others said. Challenge or support specific points.",
            "recommendation": f"As {role_name}, give a clear final recommendation: GO, CONDITIONAL, or NO-GO.",
        }
        instruction = round_instructions.get(round_type, round_instructions["initial"])

        prompt = (
            f"You are {role_name} in a panel discussion.\n\n"
            f"Recent discussion:\n{prev_text}\n\n"
            f"{instruction}\n\nBe direct. 100-200 words."
        )
        try:
            completion = await self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": f"You are {role_name}. Speak from this role's perspective. Be direct and specific."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=300,
                temperature=0.7,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"[Gamma] Discussion error: {e}")
            return ""

    async def peer_review_responses(
        self, query_id: str, responses: list[dict]
    ) -> list[dict]:
        """
        Heuristic peer scoring: length + structure + confidence calibration.
        Fast, no LLM call needed.
        """
        reviews = []
        for r in responses:
            text = r.get("response_text", "")
            confidence = float(r.get("confidence", 0.5))

            # Heuristic scoring
            length_score = min(1.0, len(text) / 400)      # longer tends to be better
            structure_score = 0.6 + 0.2 * (1 if "\n" in text else 0)  # has structure
            # Penalise overconfidence (>0.9) and underconfidence (<0.3)
            conf_penalty = 0.0
            if confidence > 0.9 or confidence < 0.3:
                conf_penalty = 0.1

            score = round(
                max(0.1, min(0.95, 0.5 * length_score + 0.5 * structure_score - conf_penalty)),
                3,
            )

            reviews.append({
                "response_id": r["response_id"],
                "score": score,
                "reasoning": f"Heuristic: length={len(text)}, structure={'yes' if chr(10) in text else 'no'}, conf={confidence:.2f}",
            })

        logger.info(f"[Gamma] Peer review: scored {len(reviews)} responses (heuristic)")
        return reviews

    async def generate_response(
        self, problem: str, memory_context: str, round_num: int
    ) -> dict:
        # Gamma uses a shorter, less detailed prompt
        memory_snippet = memory_context[:300] if memory_context else ""
        prompt = (
            f"Problem: {problem[:500]}\n"
            f"{memory_snippet}\n\n"
            'Answer in JSON: {"reasoning": "brief reasoning", "answer": "your answer", "confidence": 0.6}'
        )

        completion = await self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": GAMMA_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
            temperature=0.9,
        )

        raw = completion.choices[0].message.content
        result = self._parse_json_response(raw)

        # Gamma's confidence is naturally lower
        result["confidence"] = min(0.65, max(0.3, float(result.get("confidence", 0.5))))
        logger.info(
            f"[Gamma] Generated response — confidence: {result['confidence']:.2f}"
        )
        return result
