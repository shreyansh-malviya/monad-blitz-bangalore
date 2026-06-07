"""Proposal routes — create/list/get proposals, submit bids and discussion messages."""
import hashlib
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import (
    Agent, DiscussionMessage, Proposal, ProposalBid,
    ProposalRole, ProposalStatus,
)

router = APIRouter(prefix="/api/proposals", tags=["proposals"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateProposalRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=8000)
    max_roles: int = Field(default=4, ge=2, le=6)
    bounty: str = Field(default="0", description="Bounty in wei as string")
    requester: str = Field(default="0x0000000000000000000000000000000000000000")
    lock_time: int = Field(default=60, ge=10, le=300, description="Seconds before bidding starts")
    proposal_time: int = Field(default=30, ge=10, le=120, description="Seconds for bidding phase")
    evaluation_time: int = Field(default=300, ge=60, le=1800, description="Seconds for full evaluation")
    chain_proposal_id: Optional[int] = None


class SubmitBidRequest(BaseModel):
    agent_address: str
    agent_name: str = ""
    role_name: str
    fit_score: float = Field(..., ge=0.0, le=1.0)
    reasoning: str = Field(default="")


class SubmitDiscussionRequest(BaseModel):
    agent_address: str
    agent_name: str = ""
    role_name: str
    round_num: int = Field(..., ge=1, le=10)
    round_type: str = Field(default="initial")
    content: str = Field(..., min_length=10, max_length=3000)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_proposal(p: Proposal, roles=None, bids=None, messages=None) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "domain": p.domain,
        "status": p.status.value,
        "bounty": p.bounty,
        "requester": p.requester,
        "max_roles": p.max_roles,
        "lock_time": p.lock_time,
        "proposal_time": p.proposal_time,
        "evaluation_time": p.evaluation_time,
        "chain_proposal_id": p.chain_proposal_id,
        "roles_decided": p.roles_decided or [],
        "final_report": p.final_report,
        "report_ipfs_hash": p.report_ipfs_hash,
        "report_hash": p.report_hash,
        "tx_hash": p.tx_hash,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
        "roles": [_serialize_role(r) for r in (roles or [])],
        "bids": [_serialize_bid(b) for b in (bids or [])],
        "messages": [_serialize_message(m) for m in (messages or [])],
    }


def _serialize_role(r: ProposalRole) -> dict:
    return {
        "id": r.id,
        "role_name": r.role_name,
        "role_description": r.role_description,
        "agent_address": r.agent_address,
        "agent_name": r.agent_name,
        "assigned_at": r.assigned_at.isoformat() if r.assigned_at else None,
    }


def _serialize_bid(b: ProposalBid) -> dict:
    return {
        "id": b.id,
        "agent_address": b.agent_address,
        "agent_name": b.agent_name,
        "role_name": b.role_name,
        "fit_score": b.fit_score,
        "reasoning": b.reasoning,
        "created_at": b.created_at.isoformat(),
    }


def _serialize_message(m: DiscussionMessage) -> dict:
    return {
        "id": m.id,
        "agent_address": m.agent_address,
        "agent_name": m.agent_name,
        "role_name": m.role_name,
        "round_num": m.round_num,
        "round_type": m.round_type,
        "content": m.content,
        "created_at": m.created_at.isoformat(),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_proposal(
    body: CreateProposalRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create a new proposal and start the structured discussion pipeline."""
    from ..main import get_proposal_orchestrator

    proposal = Proposal(
        title=body.title,
        description=body.description,
        max_roles=min(body.max_roles, settings.PROPOSAL_MAX_ROLES),
        bounty=body.bounty,
        requester=body.requester,
        lock_time=body.lock_time,
        proposal_time=body.proposal_time,
        evaluation_time=body.evaluation_time,
        chain_proposal_id=body.chain_proposal_id,
        status=ProposalStatus.CREATED,
    )
    db.add(proposal)
    await db.flush()
    await db.refresh(proposal)
    proposal_id = proposal.id
    await db.commit()

    orch = get_proposal_orchestrator()
    background_tasks.add_task(orch.process_proposal, proposal_id)

    return {
        "id": proposal_id,
        "status": "CREATED",
        "message": "Proposal created — role discovery starting",
        "title": body.title,
        "max_roles": proposal.max_roles,
    }


@router.get("/")
async def list_proposals(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Proposal)
        .order_by(Proposal.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        try:
            stmt = stmt.where(Proposal.status == ProposalStatus(status.upper()))
        except ValueError:
            pass

    result = await db.execute(stmt)
    proposals = result.scalars().all()

    output = []
    for p in proposals:
        roles_result = await db.execute(
            select(ProposalRole).where(ProposalRole.proposal_id == p.id)
        )
        roles = roles_result.scalars().all()
        output.append(_serialize_proposal(p, roles=roles))

    return output


@router.get("/{proposal_id}")
async def get_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    roles_r = await db.execute(
        select(ProposalRole).where(ProposalRole.proposal_id == proposal_id)
    )
    bids_r = await db.execute(
        select(ProposalBid)
        .where(ProposalBid.proposal_id == proposal_id)
        .order_by(ProposalBid.fit_score.desc())
    )
    msgs_r = await db.execute(
        select(DiscussionMessage)
        .where(DiscussionMessage.proposal_id == proposal_id)
        .order_by(DiscussionMessage.round_num, DiscussionMessage.created_at)
    )

    return _serialize_proposal(
        p,
        roles=roles_r.scalars().all(),
        bids=bids_r.scalars().all(),
        messages=msgs_r.scalars().all(),
    )


@router.post("/{proposal_id}/bid", status_code=201)
async def submit_bid(
    proposal_id: str,
    body: SubmitBidRequest,
    db: AsyncSession = Depends(get_db),
):
    """Agent submits a bid to fill a role in a proposal."""
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if p.status not in (ProposalStatus.BIDDING, ProposalStatus.ROLE_DISCOVERY, ProposalStatus.CREATED):
        raise HTTPException(
            status_code=409,
            detail=f"Proposal is in status {p.status.value} — not accepting bids",
        )

    # Ensure agent exists
    agent = await db.get(Agent, body.agent_address)
    if not agent:
        agent = Agent(
            address=body.agent_address,
            name=body.agent_name or body.agent_address[:10] + "...",
            capabilities=["general"],
            tier="beta",
        )
        db.add(agent)
        await db.flush()

    bid = ProposalBid(
        proposal_id=proposal_id,
        agent_address=body.agent_address,
        agent_name=body.agent_name or (agent.name if agent else ""),
        role_name=body.role_name,
        fit_score=body.fit_score,
        reasoning=body.reasoning,
    )
    db.add(bid)
    await db.flush()

    return {"id": bid.id, "status": "submitted", "role": body.role_name, "fit_score": body.fit_score}


@router.post("/{proposal_id}/discuss", status_code=201)
async def submit_discussion_message(
    proposal_id: str,
    body: SubmitDiscussionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Agent submits a discussion message for a specific round."""
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if p.status not in (ProposalStatus.DISCUSSING, ProposalStatus.TEAM_FORMED):
        raise HTTPException(
            status_code=409,
            detail=f"Proposal is in status {p.status.value} — not in discussion phase",
        )

    # Ensure agent exists
    agent = await db.get(Agent, body.agent_address)
    if not agent:
        agent = Agent(
            address=body.agent_address,
            name=body.agent_name or body.agent_address[:10] + "...",
            capabilities=["general"],
            tier="beta",
        )
        db.add(agent)
        await db.flush()

    dm = DiscussionMessage(
        proposal_id=proposal_id,
        agent_address=body.agent_address,
        agent_name=body.agent_name or (agent.name if agent else ""),
        role_name=body.role_name,
        round_num=body.round_num,
        round_type=body.round_type,
        content=body.content,
    )
    db.add(dm)
    await db.flush()

    return {"id": dm.id, "status": "submitted", "round": body.round_num, "role": body.role_name}


@router.get("/{proposal_id}/report")
async def get_report(proposal_id: str, db: AsyncSession = Depends(get_db)):
    """Get the final synthesized report for a settled proposal."""
    p = await db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if not p.final_report:
        raise HTTPException(status_code=404, detail="Report not yet generated")

    from ..ipfs_client import ipfs_url
    return {
        "proposal_id": proposal_id,
        "title": p.title,
        "report": p.final_report,
        "report_hash": p.report_hash,
        "report_ipfs_hash": p.report_ipfs_hash,
        "ipfs_url": ipfs_url(p.report_ipfs_hash) if p.report_ipfs_hash else None,
        "tx_hash": p.tx_hash,
        "status": p.status.value,
    }
