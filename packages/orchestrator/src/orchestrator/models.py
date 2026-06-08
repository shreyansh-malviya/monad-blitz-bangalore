"""
SQLAlchemy 2.0 async models for MonadBlitz orchestrator.

Tables:
  agents            — registered AI agents
  queries           — user queries / tasks
  responses         — agent responses per round
  task_memories     — rolling memory per query (full history)
  orchestrator_events — audit log of all orchestrator actions
  proposals         — proposal-track tasks (idea/startup/governance)
  proposal_roles    — roles required for a proposal (CEO, CTO, etc.)
  proposal_bids     — agent bids to fill a role
  discussion_messages — structured multi-round discussion messages
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


# ── Base ───────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    __allow_unmapped__ = True


# ── Enums ──────────────────────────────────────────────────────────────────────

class ProposalStatus(str, enum.Enum):
    CREATED = "CREATED"
    ROLE_DISCOVERY = "ROLE_DISCOVERY"
    BIDDING = "BIDDING"
    TEAM_FORMED = "TEAM_FORMED"
    DISCUSSING = "DISCUSSING"
    SYNTHESIZING = "SYNTHESIZING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"


class QueryStatus(str, enum.Enum):
    CREATED = "CREATED"
    ROUTING = "ROUTING"
    COLLECTING = "COLLECTING"
    PEER_REVIEW = "PEER_REVIEW"
    SCORING = "SCORING"
    ESCALATING = "ESCALATING"
    RESOLVING = "RESOLVING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ── Models ─────────────────────────────────────────────────────────────────────

class Agent(Base):
    """An AI agent registered in the marketplace."""

    __tablename__ = "agents"

    address = Column(String(42), primary_key=True, comment="Ethereum address (checksummed)")
    name = Column(String(100), nullable=False)
    capabilities = Column(JSON, nullable=False, default=list, comment="List of capability tags")
    tier = Column(String(20), default="beta", comment="alpha | beta | gamma")
    reputation = Column(Integer, default=5000, nullable=False)
    stake = Column(String(32), default="0", comment="Staked amount in wei as string")
    wins = Column(Integer, default=0, nullable=False)
    losses = Column(Integer, default=0, nullable=False)
    timeouts = Column(Integer, default=0, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    metadata_uri = Column(String(256), default="")
    registered_at = Column(DateTime, default=_now, nullable=False)

    responses: list["Response"] = relationship(
        "Response",
        back_populates="agent",
        foreign_keys="Response.agent_address",
    )

    @property
    def win_rate(self) -> float:
        total = self.wins + self.losses
        return round(self.wins / total, 3) if total > 0 else 0.0

    @property
    def total_responses(self) -> int:
        return self.wins + self.losses + self.timeouts

    def __repr__(self) -> str:
        return f"<Agent {self.name} {self.address[:8]}... rep={self.reputation}>"


class Query(Base):
    """A user query submitted to the marketplace."""

    __tablename__ = "queries"

    id = Column(String(36), primary_key=True, default=_uuid)
    chain_query_id = Column(BigInteger, nullable=True, comment="On-chain query ID from QueryEscrow")
    status = Column(
        SAEnum(QueryStatus, name="querystatus"),
        default=QueryStatus.CREATED,
        nullable=False,
    )
    bounty = Column(String(32), nullable=False, comment="Bounty amount in wei as string")
    requester = Column(String(42), nullable=False, comment="Requester Ethereum address")
    deadline = Column(DateTime, nullable=False)
    capabilities = Column(JSON, nullable=False, default=list, comment="Required capability tags")
    problem = Column(Text, nullable=False, comment="Full problem statement")
    question_hash = Column(String(66), nullable=True, comment="keccak256 of problem text")
    round = Column(Integer, default=1, nullable=False, comment="Current escalation round")
    winner_address = Column(String(42), nullable=True)
    tx_hash = Column(String(66), nullable=True, comment="Settlement transaction hash")
    memory_hash = Column(String(66), nullable=True, comment="keccak256 of task memory at resolution")
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    responses: list["Response"] = relationship("Response", back_populates="query")
    memory: "TaskMemory" = relationship("TaskMemory", back_populates="query", uselist=False)

    def __repr__(self) -> str:
        return f"<Query {self.id[:8]}... status={self.status} round={self.round}>"


class Response(Base):
    """An agent's response to a query in a specific round."""

    __tablename__ = "responses"

    id = Column(String(36), primary_key=True, default=_uuid)
    query_id = Column(String(36), ForeignKey("queries.id"), nullable=False)
    agent_address = Column(String(42), ForeignKey("agents.address"), nullable=False)
    response_text = Column(Text, nullable=False)
    reasoning = Column(Text, default="")
    confidence = Column(Float, default=0.5)
    response_hash = Column(String(66), nullable=False, comment="keccak256 of response_text")
    score = Column(Float, nullable=True, comment="Judge score 0.0–1.0")
    score_reasoning = Column(Text, nullable=True, comment="Judge explanation")
    round = Column(Integer, default=1, nullable=False)
    submitted_at = Column(DateTime, default=_now, nullable=False)

    query: "Query" = relationship("Query", back_populates="responses")
    agent: "Agent" = relationship(
        "Agent",
        back_populates="responses",
        foreign_keys=[agent_address],
    )

    def __repr__(self) -> str:
        return f"<Response {self.id[:8]}... agent={self.agent_address[:8]}... score={self.score}>"


class TaskMemory(Base):
    """Rolling JSON memory for a query — stores full event history across all rounds."""

    __tablename__ = "task_memories"

    task_id = Column(String(36), ForeignKey("queries.id"), primary_key=True)
    content = Column(
        JSON,
        nullable=False,
        default=dict,
        comment="Full structured history: {problem, bounty, capabilities, events:[...]}",
    )
    memory_hash = Column(String(66), nullable=True, comment="keccak256 of current content")
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    query: "Query" = relationship("Query", back_populates="memory")

    def __repr__(self) -> str:
        return f"<TaskMemory task_id={self.task_id} hash={self.memory_hash}>"


class OrchestratorEvent(Base):
    """Append-only audit log of all orchestrator-level events."""

    __tablename__ = "orchestrator_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    event_type = Column(String(64), nullable=False, comment="routing|score|escalation|resolution|chain_event")
    query_id = Column(String(36), nullable=True)
    payload = Column(JSON, nullable=False, default=dict)
    tx_hash = Column(String(66), nullable=True)
    block_number = Column(BigInteger, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    def __repr__(self) -> str:
        return f"<OrchestratorEvent {self.event_type} query={self.query_id}>"


class PeerReview(Base):
    """Peer score given by one agent to another agent's response."""

    __tablename__ = "peer_reviews"

    id = Column(String(36), primary_key=True, default=_uuid)
    query_id = Column(String(36), ForeignKey("queries.id"), nullable=False)
    round = Column(Integer, default=1, nullable=False)
    reviewer_address = Column(String(42), ForeignKey("agents.address"), nullable=False)
    response_id = Column(String(36), ForeignKey("responses.id"), nullable=False)
    peer_score = Column(Float, nullable=False, comment="Peer's score 0.0–1.0")
    reasoning = Column(Text, default="")
    created_at = Column(DateTime, default=_now, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<PeerReview reviewer={self.reviewer_address[:8]}... "
            f"response={self.response_id[:8]}... score={self.peer_score}>"
        )


class SubQuery(Base):
    """An agent-to-agent sub-query: one agent requests help from others."""

    __tablename__ = "sub_queries"

    id = Column(String(36), primary_key=True, default=_uuid)
    parent_query_id = Column(String(36), ForeignKey("queries.id"), nullable=False)
    requester_address = Column(String(42), nullable=False, comment="Agent that needs help")
    sub_problem = Column(Text, nullable=False)
    capabilities = Column(JSON, nullable=False, default=list)
    # Best answer collected from other agents
    result = Column(Text, nullable=True)
    result_agent = Column(String(42), nullable=True, comment="Which agent answered best")
    status = Column(String(20), default="pending", comment="pending|answered|timeout")
    created_at = Column(DateTime, default=_now, nullable=False)
    answered_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<SubQuery {self.id[:8]}... parent={self.parent_query_id[:8]}... status={self.status}>"


class SubQueryResponse(Base):
    """A response to a sub-query from a helper agent."""

    __tablename__ = "sub_query_responses"

    id = Column(String(36), primary_key=True, default=_uuid)
    sub_query_id = Column(String(36), ForeignKey("sub_queries.id"), nullable=False)
    agent_address = Column(String(42), nullable=False)
    answer = Column(Text, nullable=False)
    confidence = Column(Float, default=0.5)
    created_at = Column(DateTime, default=_now, nullable=False)

    def __repr__(self) -> str:
        return f"<SubQueryResponse agent={self.agent_address[:8]}... sq={self.sub_query_id[:8]}...>"


# ── Proposal Track ─────────────────────────────────────────────────────────────

class Proposal(Base):
    """A proposal submitted to the marketplace for structured multi-agent discussion."""

    __tablename__ = "proposals"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    domain = Column(String(100), nullable=True, comment="Detected domain: tech_startup, social_app, etc.")
    status = Column(
        SAEnum(ProposalStatus, name="proposalstatus"),
        default=ProposalStatus.CREATED,
        nullable=False,
    )
    bounty = Column(String(32), default="0", comment="Bounty in wei as string")
    requester = Column(String(42), default="0x0000000000000000000000000000000000000000")
    max_roles = Column(Integer, default=5, nullable=False)
    lock_time = Column(Integer, default=60, comment="Seconds to lock proposal before bidding")
    proposal_time = Column(Integer, default=30, comment="Seconds for bidding phase")
    evaluation_time = Column(Integer, default=300, comment="Seconds for discussion + synthesis")
    chain_proposal_id = Column(BigInteger, nullable=True)
    roles_decided = Column(JSON, default=list, comment="List of {name, description} objects")
    final_report = Column(Text, nullable=True, comment="Synthesized Markdown report")
    report_ipfs_hash = Column(String(100), nullable=True, comment="IPFS CID of the final report")
    report_hash = Column(String(66), nullable=True, comment="SHA256 of report, anchored on Monad")
    tx_hash = Column(String(66), nullable=True, comment="Settlement tx hash")
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    roles: list["ProposalRole"] = relationship("ProposalRole", back_populates="proposal", cascade="all, delete-orphan")
    bids: list["ProposalBid"] = relationship("ProposalBid", back_populates="proposal", cascade="all, delete-orphan")
    messages: list["DiscussionMessage"] = relationship("DiscussionMessage", back_populates="proposal", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Proposal {self.id[:8]}... status={self.status} roles={self.max_roles}>"


class ProposalRole(Base):
    """A role required for a proposal (e.g. CEO, CTO, Investor)."""

    __tablename__ = "proposal_roles"

    id = Column(String(36), primary_key=True, default=_uuid)
    proposal_id = Column(String(36), ForeignKey("proposals.id"), nullable=False)
    role_name = Column(String(100), nullable=False)
    role_description = Column(Text, default="")
    agent_address = Column(String(42), nullable=True, comment="Assigned agent (null until team formed)")
    agent_name = Column(String(100), nullable=True)
    assigned_at = Column(DateTime, nullable=True)

    proposal: "Proposal" = relationship("Proposal", back_populates="roles")

    def __repr__(self) -> str:
        return f"<ProposalRole {self.role_name} agent={self.agent_address}>"


class ProposalBid(Base):
    """An agent's bid to fill a specific role in a proposal."""

    __tablename__ = "proposal_bids"

    id = Column(String(36), primary_key=True, default=_uuid)
    proposal_id = Column(String(36), ForeignKey("proposals.id"), nullable=False)
    agent_address = Column(String(42), ForeignKey("agents.address"), nullable=False)
    agent_name = Column(String(100), default="")
    role_name = Column(String(100), nullable=False)
    fit_score = Column(Float, nullable=False, comment="Self-assessed fit 0.0-1.0")
    reasoning = Column(Text, default="")
    created_at = Column(DateTime, default=_now, nullable=False)

    proposal: "Proposal" = relationship("Proposal", back_populates="bids")

    def __repr__(self) -> str:
        return f"<ProposalBid {self.agent_address[:8]}... role={self.role_name} fit={self.fit_score}>"


class DiscussionMessage(Base):
    """A single message in the structured multi-round proposal discussion."""

    __tablename__ = "discussion_messages"

    id = Column(String(36), primary_key=True, default=_uuid)
    proposal_id = Column(String(36), ForeignKey("proposals.id"), nullable=False)
    agent_address = Column(String(42), nullable=False)
    agent_name = Column(String(100), default="")
    role_name = Column(String(100), nullable=False)
    round_num = Column(Integer, nullable=False, comment="1=initial 2=response 3=recommendation")
    round_type = Column(String(30), default="initial", comment="initial|response|recommendation")
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)

    proposal: "Proposal" = relationship("Proposal", back_populates="messages")

    def __repr__(self) -> str:
        return f"<DiscussionMessage round={self.round_num} role={self.role_name} agent={self.agent_address[:8]}...>"


# ── Freelance Track ────────────────────────────────────────────────────────────

class FreelanceStatus(str, enum.Enum):
    CREATED       = "CREATED"
    TEAM_DISCOVERY = "TEAM_DISCOVERY"
    TEAM_FORMED   = "TEAM_FORMED"
    IN_PROGRESS   = "IN_PROGRESS"
    ASSEMBLING    = "ASSEMBLING"
    REVIEW        = "REVIEW"
    SETTLED       = "SETTLED"
    FAILED        = "FAILED"
    DISPUTED      = "DISPUTED"


class FreelanceTask(Base):
    """A real-work task posted to the freelance marketplace."""

    __tablename__ = "freelance_tasks"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    task_type = Column(String(50), default="general",
                       comment="code | document | research | design | analysis | general")
    skills_required = Column(JSON, default=list, comment="e.g. ['python','solidity','react']")
    budget = Column(String(32), default="0", comment="Budget in wei as string")
    requester = Column(String(42), default="0x0000000000000000000000000000000000000000")
    status = Column(
        SAEnum(FreelanceStatus, name="freelancestatus"),
        default=FreelanceStatus.CREATED,
        nullable=False,
    )
    chain_task_id = Column(BigInteger, nullable=True, comment="On-chain task ID if contract deployed")
    # Team: JSON list of {agent_address, agent_name, role, subtask_description}
    team = Column(JSON, default=list)
    # Assembled deliverable (assembled from all artifacts)
    deliverable = Column(Text, nullable=True, comment="Assembled final deliverable Markdown")
    deliverable_ipfs_hash = Column(String(100), nullable=True)
    deliverable_hash = Column(String(66), nullable=True, comment="SHA-256 of deliverable")
    review_score = Column(Float, nullable=True, comment="LLM review quality 0.0–1.0")
    review_notes = Column(Text, nullable=True)
    tx_hash = Column(String(66), nullable=True, comment="Settlement tx hash on Monad")
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    bids: list["FreelanceBid"] = relationship(
        "FreelanceBid", back_populates="task", cascade="all, delete-orphan"
    )
    artifacts: list["FreelanceArtifact"] = relationship(
        "FreelanceArtifact", back_populates="task", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<FreelanceTask {self.id[:8]}... '{self.title[:30]}' status={self.status}>"


class FreelanceBid(Base):
    """An agent's bid to take on a subtask role in a freelance task."""

    __tablename__ = "freelance_bids"

    id = Column(String(36), primary_key=True, default=_uuid)
    task_id = Column(String(36), ForeignKey("freelance_tasks.id"), nullable=False)
    agent_address = Column(String(42), nullable=False)
    agent_name = Column(String(100), default="")
    proposed_role = Column(String(100), nullable=False, comment="e.g. 'Lead Developer', 'Technical Writer'")
    proposed_subtask = Column(Text, nullable=False, comment="What this agent will deliver")
    fit_score = Column(Float, nullable=False, comment="Self-assessed fit 0.0–1.0")
    reasoning = Column(Text, default="")
    accepted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now, nullable=False)

    task: "FreelanceTask" = relationship("FreelanceTask", back_populates="bids")

    def __repr__(self) -> str:
        return f"<FreelanceBid agent={self.agent_name} role={self.proposed_role} fit={self.fit_score}>"


class FreelanceArtifact(Base):
    """A deliverable artifact submitted by one agent for their assigned subtask."""

    __tablename__ = "freelance_artifacts"

    id = Column(String(36), primary_key=True, default=_uuid)
    task_id = Column(String(36), ForeignKey("freelance_tasks.id"), nullable=False)
    agent_address = Column(String(42), nullable=False)
    agent_name = Column(String(100), default="")
    role = Column(String(100), nullable=False)
    subtask_description = Column(Text, default="")
    content = Column(Text, nullable=False, comment="The actual deliverable content (code, doc, spec, etc.)")
    content_type = Column(String(50), default="markdown", comment="markdown | code | json")
    ipfs_hash = Column(String(100), nullable=True, comment="IPFS CID if uploaded")
    quality_score = Column(Float, nullable=True, comment="LLM quality assessment 0.0–1.0")
    submitted_at = Column(DateTime, default=_now, nullable=False)

    task: "FreelanceTask" = relationship("FreelanceTask", back_populates="artifacts")

    def __repr__(self) -> str:
        return f"<FreelanceArtifact agent={self.agent_name} role={self.role} len={len(self.content)}>"
