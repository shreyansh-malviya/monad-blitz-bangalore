"""
Beta Agent — GPT-4o-mini (medium quality, medium cost).

Beta is the workhorse agent: solid responses at lower cost.
It gets routed alongside Alpha for diverse perspectives.
"""
import logging

from openai import AsyncOpenAI

from .base import BaseAgent
from .config import settings

logger = logging.getLogger("agents.beta")

BETA_FREELANCE_BID_SYSTEM = """You are Beta, an AI agent specializing in business analysis, research, and documentation.

Your core strengths: market research, competitive analysis, technical writing,
documentation, financial modeling, product strategy, and requirements gathering.

Evaluate this freelance task and propose ONE role you can fill with a concrete deliverable plan.

Return ONLY JSON:
{
  "proposed_role": "e.g. Business Analyst",
  "proposed_subtask": "Specific description of what you will produce (2-3 sentences)",
  "fit_score": 0.75,
  "reasoning": "Brief explanation of your fit for this task"
}

Be honest: if the task is heavily code-focused (Solidity, algorithms), set fit_score below 0.4."""

BETA_FREELANCE_ARTIFACT_SYSTEM = """You are Beta, a business analyst and research specialist delivering a freelance artifact.

Produce a thorough, well-organized deliverable that matches your assigned role and subtask.
Use clear headings, structured analysis, tables where useful, and concrete recommendations.
Be comprehensive but avoid padding. Output only the deliverable content in Markdown format."""

BETA_SYSTEM = """You are Beta, an AI agent in the MonadBlitz decentralized marketplace.

You are powered by GPT-4o-mini. You provide solid, reliable answers.
Your goal is to earn MON tokens by giving accurate, well-reasoned responses.

When you see task memory showing previous rounds failed:
- Identify what was missing in those attempts
- Provide a clearly improved answer
- Be specific and actionable

Return ONLY valid JSON with keys: reasoning, answer, confidence."""


class BetaAgent(BaseAgent):
    name = "Beta"
    capabilities = ["general", "analysis", "nlp", "research", "writing"]
    tier = "beta"
    potential_roles = [
        "Investor", "Business Analyst", "Marketing Expert",
        "Financial Advisor", "Risk Manager", "Consultant",
    ]

    def __init__(self, private_key: str = None):
        super().__init__(private_key or settings.BETA_PRIVATE_KEY)
        self._client = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def bid_for_roles(
        self,
        proposal_id: str,
        title: str,
        description: str,
        roles: list[dict],
    ) -> list[dict]:
        """GPT-4o-mini powered bid assessment (gracefully handles no API key)."""
        if not settings.OPENAI_API_KEY:
            return []

        bids = []
        available = {r["name"]: r for r in roles}
        target = [r for r in self.potential_roles if r in available]
        if not target:
            target = list(available.keys())[:1]

        for role_name in target:
            role = available[role_name]
            prompt = (
                f"Proposal: {title}\nRole: {role_name} — {role.get('description', '')}\n"
                f"My skills: {', '.join(self.capabilities)}\n"
                'Rate fit 0-1. JSON: {"fit_score": 0.8, "reasoning": "..."}'
            )
            try:
                completion = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Rate role fit. Return JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=80,
                    temperature=0.3,
                    response_format={"type": "json_object"},
                )
                raw = completion.choices[0].message.content
                result = self._parse_json_response(raw)
                bids.append({
                    "role_name": role_name,
                    "fit_score": max(0.3, min(0.9, float(result.get("fit_score", 0.65)))),
                    "reasoning": result.get("reasoning", ""),
                })
            except Exception as e:
                logger.debug(f"[Beta] Bid error for {role_name}: {e}")

        return bids

    async def discuss_as_role(
        self,
        proposal_id: str,
        role_name: str,
        round_num: int,
        round_type: str,
        previous_messages: list[dict],
    ) -> str:
        if not settings.OPENAI_API_KEY:
            return ""

        prev_text = "\n".join(
            f"[{m['role_name']}]: {m['content'][:200]}"
            for m in previous_messages[-4:]
        ) if previous_messages else "(No prior discussion)"

        round_instructions = {
            "initial": f"Give your primary perspective as {role_name}.",
            "response": f"As {role_name}, respond to specific points raised by others.",
            "recommendation": f"As {role_name}, give your final recommendation.",
        }
        prompt = (
            f"You are {role_name}.\n\nPrior discussion:\n{prev_text}\n\n"
            f"{round_instructions.get(round_type, round_instructions['initial'])}\n"
            "Be specific. 150-200 words."
        )
        try:
            completion = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": f"You are {role_name} in an expert panel. Be direct and substantive."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=350,
                temperature=0.7,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            logger.debug(f"[Beta] Discussion error: {e}")
            return ""

    async def generate_freelance_bid(
        self,
        task_id: str,
        title: str,
        description: str,
        task_type: str,
        skills_required: list,
    ) -> dict:
        if not settings.OPENAI_API_KEY:
            return {}
        skills_str = ", ".join(skills_required) if skills_required else "none specified"
        prompt = (
            f"Task ID: {task_id}\nTitle: {title}\nType: {task_type}\n"
            f"Skills required: {skills_str}\n\nDescription:\n{description[:1500]}"
        )
        try:
            completion = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": BETA_FREELANCE_BID_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=250,
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            result = self._parse_json_response(completion.choices[0].message.content)
            return {
                "proposed_role": str(result.get("proposed_role", "Business Analyst")),
                "proposed_subtask": str(result.get("proposed_subtask", "")),
                "fit_score": max(0.0, min(1.0, float(result.get("fit_score", 0.65)))),
                "reasoning": str(result.get("reasoning", "")),
            }
        except Exception as e:
            logger.warning(f"[Beta] Freelance bid error: {e}")
        return {
            "proposed_role": "Business Analyst",
            "proposed_subtask": f"Research and document requirements for: {title}",
            "fit_score": 0.6,
            "reasoning": "Research and documentation expertise applicable.",
        }

    async def generate_artifact(
        self,
        task_id: str,
        title: str,
        description: str,
        role: str,
        subtask: str,
    ) -> dict:
        if not settings.OPENAI_API_KEY:
            return {"content": f"# {role} Report\n\nNo OpenAI key configured.", "content_type": "markdown"}
        prompt = (
            f"You are acting as: {role}\n\n"
            f"Task title: {title}\nYour specific subtask: {subtask}\n\n"
            f"Full task description:\n{description[:2000]}\n\n"
            "Deliver your complete artifact now."
        )
        try:
            completion = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": BETA_FREELANCE_ARTIFACT_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2500,
                temperature=0.5,
            )
            content = completion.choices[0].message.content.strip()
            return {"content": content, "content_type": "markdown"}
        except Exception as e:
            logger.warning(f"[Beta] Artifact generation error: {e}")
            return {
                "content": f"# {role} Deliverable\n\nGeneration error: {e}",
                "content_type": "markdown",
            }

    async def generate_response(
        self, problem: str, memory_context: str, round_num: int
    ) -> dict:
        prompt = self._build_prompt(problem, memory_context, round_num)

        completion = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": BETA_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            max_tokens=2000,
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content
        result = self._parse_json_response(raw)
        result["confidence"] = min(0.88, max(0.4, float(result.get("confidence", 0.72))))
        logger.info(
            f"[Beta] Generated response — confidence: {result['confidence']:.2f}"
        )
        return result
