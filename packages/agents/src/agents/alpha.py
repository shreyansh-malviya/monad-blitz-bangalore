"""
Alpha Agent — Claude Sonnet (highest quality, highest reputation).

Alpha is the premium agent: detailed, accurate, and builds on prior context.
It gets routed to first for complex queries and round 2+ escalations.
"""
import logging

import anthropic

from .base import BaseAgent
from .config import settings

logger = logging.getLogger("agents.alpha")

ALPHA_SYSTEM = """You are Alpha, an elite AI agent in the MindMesh decentralized AI coordination network.

You are powered by Claude Sonnet — the most capable agent in the system.
You earn MON tokens for high-quality answers. Your reputation score determines
how often you get routed to queries and how much you earn.

Your answers must be:
- Accurate and factually correct
- Well-structured and comprehensive
- Actionable where applicable
- Honest about uncertainty

When you see task memory from previous rounds:
- Explicitly build on what worked
- Address specific weaknesses from prior attempts
- Show clear improvement — the judge can see previous scores

You can also request sub-queries from other agents when facing uncertainty.

Return ONLY valid JSON. No preamble, no markdown fences."""

ALPHA_PEER_REVIEW_SYSTEM = """You are Alpha, an elite AI agent acting as a peer reviewer.

Score each response from 0.0 to 1.0 based on:
- Accuracy and correctness (most important)
- Completeness and depth
- Clarity and structure
- Confidence calibration (is stated confidence justified?)

Be strict but fair. A score of 0.7+ means the answer is genuinely good.
Return ONLY a JSON array, no other text."""


ALPHA_PROPOSAL_SYSTEM = """You are Alpha, an elite AI agent playing a specific expert role in a structured panel discussion.

Speak ONLY from the perspective of your assigned role. Be specific, insightful, and critical where warranted.
Keep your contribution to 150-250 words. Be direct and avoid generic statements."""

ALPHA_FREELANCE_BID_SYSTEM = """You are Alpha, a senior technical AI agent evaluating a freelance task opportunity.

Assess whether you can contribute meaningfully based on your capabilities:
deep expertise in code architecture, Solidity/EVM, system design, algorithms, security
analysis, technical documentation, and AI/ML reasoning.

Propose ONE specific role and a detailed subtask plan you will deliver.

Return ONLY a JSON object:
{
  "proposed_role": "e.g. Senior Technical Lead",
  "proposed_subtask": "Specific 2-3 sentence description of exactly what artifact you will produce",
  "fit_score": 0.85,
  "reasoning": "Why you are the right agent for this specific task"
}

If the task is non-technical (pure marketing/HR), be honest and set fit_score below 0.4."""

ALPHA_FREELANCE_ARTIFACT_SYSTEM = """You are Alpha, a senior technical AI agent delivering a freelance task artifact.

You have been assigned a specific role and subtask. Produce a high-quality, complete deliverable.

Your output must be:
- Complete and immediately usable (no placeholders like "TODO" or "...")
- Well-structured with clear headings/sections
- Technically deep and accurate
- In the requested format (code blocks for code, Markdown for docs)

Output ONLY the deliverable content itself — no preamble, no wrapper text."""

ALPHA_BID_SYSTEM = """You are evaluating whether you, as an AI agent with broad expertise, would be a good fit
for a specific expert role in a panel discussion about a proposal.

Score your fit from 0.0 (no fit) to 1.0 (perfect fit). Be honest and realistic.
Return ONLY a JSON object: {"fit_score": 0.85, "reasoning": "brief explanation"}"""


class AlphaAgent(BaseAgent):
    name = "Alpha"
    capabilities = ["general", "code", "solidity", "analysis", "math", "nlp", "reasoning"]
    tier = "alpha"
    potential_roles = [
        "CEO", "CTO", "Product Manager", "Technical Lead", "Investor",
        "Analyst", "Researcher", "Strategist", "Architect",
    ]

    def __init__(self, private_key: str = None):
        super().__init__(private_key or settings.ALPHA_PRIVATE_KEY)
        self._client = None

    @property
    def client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(
                api_key=settings.ANTHROPIC_API_KEY
            )
        return self._client

    async def generate_response(
        self, problem: str, memory_context: str, round_num: int
    ) -> dict:
        prompt = self._build_prompt(problem, memory_context, round_num)

        message = await self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2500,
            system=ALPHA_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text
        result = self._parse_json_response(raw)

        # Clamp confidence
        result["confidence"] = min(0.98, max(0.5, float(result.get("confidence", 0.85))))
        logger.info(
            f"[Alpha] Generated response — confidence: {result['confidence']:.2f}"
        )
        return result

    async def bid_for_roles(
        self,
        proposal_id: str,
        title: str,
        description: str,
        roles: list[dict],
    ) -> list[dict]:
        """Use Claude Haiku to assess fit for each role."""
        import json, re

        bids = []
        # Only bid for roles that match our potential roles
        target_roles = [
            r for r in roles
            if any(pr.lower() in r["name"].lower() or r["name"].lower() in pr.lower()
                   for pr in self.potential_roles)
        ]
        if not target_roles:
            target_roles = roles[:2]  # bid for top 2 if no match

        for role in target_roles:
            prompt = (
                f"Proposal: {title}\n\n"
                f"Description: {description[:500]}\n\n"
                f"Role to evaluate: {role['name']}\n"
                f"Role description: {role.get('description', '')}\n\n"
                f"My capabilities: {', '.join(self.capabilities)}\n\n"
                "How well do I fit this role? Score 0.0-1.0 and explain briefly."
            )
            try:
                message = await self.client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=150,
                    system=ALPHA_BID_SYSTEM,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw = message.content[0].text.strip()
                match = re.search(r"\{[\s\S]*\}", raw)
                if match:
                    result = json.loads(match.group())
                    fit_score = max(0.0, min(1.0, float(result.get("fit_score", 0.6))))
                    bids.append({
                        "role_name": role["name"],
                        "fit_score": fit_score,
                        "reasoning": result.get("reasoning", ""),
                    })
            except Exception as e:
                logger.debug(f"[Alpha] Bid assessment error for {role['name']}: {e}")
                bids.append({
                    "role_name": role["name"],
                    "fit_score": 0.6,
                    "reasoning": "General expertise applicable.",
                })

        logger.info(f"[Alpha] Submitting {len(bids)} bid(s) for proposal #{proposal_id[:8]}")
        return bids

    async def discuss_as_role(
        self,
        proposal_id: str,
        role_name: str,
        round_num: int,
        round_type: str,
        previous_messages: list[dict],
    ) -> str:
        """Generate a substantive discussion contribution using Claude Sonnet."""
        prev_text = "\n\n".join(
            f"[Round {m['round_num']} — {m['role_name']}]: {m['content']}"
            for m in previous_messages
        ) if previous_messages else "(No prior discussion)"

        round_instructions = {
            "initial": f"Give your primary perspective as {role_name}. What's your initial take on this proposal?",
            "response": f"As {role_name}, respond to 2-3 specific points made by other roles. Be direct.",
            "recommendation": f"As {role_name}, give your final verdict: GO, CONDITIONAL GO, or NO-GO, and why.",
        }
        instruction = round_instructions.get(round_type, round_instructions["initial"])

        prompt = (
            f"You are participating as {role_name}.\n\n"
            f"Previous discussion:\n{prev_text}\n\n"
            f"Task: {instruction}\n\n"
            "Write 150-250 words. Be specific and substantive."
        )

        try:
            message = await self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                system=ALPHA_PROPOSAL_SYSTEM.replace("{role_name}", role_name),
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except Exception as e:
            logger.warning(f"[Alpha] Discussion generation error: {e}")
            return ""

    async def generate_freelance_bid(
        self,
        task_id: str,
        title: str,
        description: str,
        task_type: str,
        skills_required: list,
    ) -> dict:
        import json, re
        skills_str = ", ".join(skills_required) if skills_required else "none specified"
        prompt = (
            f"Task ID: {task_id}\nTitle: {title}\nType: {task_type}\n"
            f"Skills required: {skills_str}\n\nDescription:\n{description[:1500]}"
        )
        try:
            message = await self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=ALPHA_FREELANCE_BID_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                result = json.loads(match.group())
                return {
                    "proposed_role": str(result.get("proposed_role", "Technical Lead")),
                    "proposed_subtask": str(result.get("proposed_subtask", "")),
                    "fit_score": max(0.0, min(1.0, float(result.get("fit_score", 0.7)))),
                    "reasoning": str(result.get("reasoning", "")),
                }
        except Exception as e:
            logger.warning(f"[Alpha] Freelance bid error: {e}")
        return {
            "proposed_role": "Technical Lead",
            "proposed_subtask": f"Provide technical architecture and implementation for: {title}",
            "fit_score": 0.7,
            "reasoning": "Broad technical expertise applicable.",
        }

    async def generate_artifact(
        self,
        task_id: str,
        title: str,
        description: str,
        role: str,
        subtask: str,
    ) -> dict:
        prompt = (
            f"You are acting as: {role}\n\n"
            f"Task title: {title}\nYour specific subtask: {subtask}\n\n"
            f"Full task description:\n{description[:2000]}\n\n"
            "Deliver your complete artifact now."
        )
        try:
            message = await self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=3000,
                system=ALPHA_FREELANCE_ARTIFACT_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            content = message.content[0].text.strip()
            ct = "code" if any(
                kw in subtask.lower()
                for kw in ["code", "solidity", "contract", "script", "implement", "function"]
            ) else "markdown"
            return {"content": content, "content_type": ct}
        except Exception as e:
            logger.warning(f"[Alpha] Artifact generation error: {e}")
            return {
                "content": f"# {role} Deliverable\n\nGeneration error: {e}",
                "content_type": "markdown",
            }

    async def peer_review_responses(
        self, query_id: str, responses: list[dict]
    ) -> list[dict]:
        """Use Claude to score other agents' responses."""
        import json

        formatted = "\n\n".join(
            f"Response #{i + 1} (id={r['response_id']}):\n"
            f"Agent: {r['agent_address'][:10]}...\n"
            f"Answer: {r['response_text'][:600]}\n"
            f"Reasoning: {r.get('reasoning', '')[:200]}\n"
            f"Confidence: {r.get('confidence', 0.5)}"
            for i, r in enumerate(responses)
        )

        prompt = (
            f"Score these AI agent responses. For each, give a score 0.0–1.0.\n\n"
            f"{formatted}\n\n"
            "Return a JSON array ONLY:\n"
            '[{"response_id": "<id>", "score": 0.85, "reasoning": "brief reason"}, ...]'
        )

        try:
            message = await self.client.messages.create(
                model="claude-haiku-4-5-20251001",  # cheaper model for peer review
                max_tokens=600,
                system=ALPHA_PEER_REVIEW_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            # Extract JSON array
            import re
            match = re.search(r"\[[\s\S]*\]", raw)
            if match:
                reviews = json.loads(match.group())
                # Validate and clamp
                valid = []
                for rv in reviews:
                    if "response_id" in rv and "score" in rv:
                        valid.append({
                            "response_id": rv["response_id"],
                            "score": max(0.0, min(1.0, float(rv["score"]))),
                            "reasoning": rv.get("reasoning", "")[:300],
                        })
                logger.info(f"[Alpha] Peer review: scored {len(valid)} responses")
                return valid
        except Exception as e:
            logger.warning(f"[Alpha] Peer review error: {e}")
        return []
