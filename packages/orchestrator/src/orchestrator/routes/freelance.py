"""
Freelance Track routes — create, list, bid on, and deliver freelance tasks.

Endpoints:
  POST /api/freelance/              — create a new task (kicks off state machine)
  GET  /api/freelance/              — list tasks (filterable by status/type)
  GET  /api/freelance/{id}          — get full task detail
  POST /api/freelance/{id}/bid      — agent bids to take a subtask role
  POST /api/freelance/{id}/submit   — agent submits their deliverable artifact
  GET  /api/freelance/{id}/report   — download the assembled deliverable
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select

from ..database import db_session
from ..freelance_state_machine import get_freelance_machine
from ..models import FreelanceArtifact, FreelanceBid, FreelanceStatus, FreelanceTask

router = APIRouter(prefix="/api/freelance", tags=["freelance"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateFreelanceRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=10_000)
    task_type: str = Field(
        default="general",
        description="code | document | research | design | analysis | general",
    )
    skills_required: list[str] = Field(default_factory=list)
    budget: str = Field(default="0", description="Budget in wei as string")
    requester: str = Field(default="0x0000000000000000000000000000000000000000")
    deadline_minutes: int = Field(default=30, ge=5, le=1440)


class SubmitBidRequest(BaseModel):
    agent_address: str
    agent_name: str = ""
    proposed_role: str = Field(..., min_length=2, max_length=100)
    proposed_subtask: str = Field(..., min_length=10, max_length=2000,
                                   description="What specifically this agent will deliver")
    fit_score: float = Field(..., ge=0.0, le=1.0)
    reasoning: str = Field(default="")


class SubmitArtifactRequest(BaseModel):
    agent_address: str
    agent_name: str = ""
    role: str = Field(..., min_length=2, max_length=100)
    subtask_description: str = Field(default="")
    content: str = Field(..., min_length=10, max_length=50_000,
                          description="The full deliverable content (code, Markdown doc, etc.)")
    content_type: str = Field(default="markdown", description="markdown | code | json")


# ── Serialisers ───────────────────────────────────────────────────────────────

def _ser_task(t: FreelanceTask) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "task_type": t.task_type,
        "skills_required": t.skills_required or [],
        "budget": t.budget,
        "requester": t.requester,
        "status": t.status,
        "chain_task_id": t.chain_task_id,
        "team": t.team or [],
        "deliverable": t.deliverable,
        "deliverable_ipfs_hash": t.deliverable_ipfs_hash,
        "deliverable_hash": t.deliverable_hash,
        "review_score": t.review_score,
        "review_notes": t.review_notes,
        "tx_hash": t.tx_hash,
        "deadline": t.deadline.isoformat() if t.deadline else None,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
        "bid_count": 0,   # populated below when detail=True
        "artifact_count": 0,
    }


def _ser_bid(b: FreelanceBid) -> dict:
    return {
        "id": b.id,
        "agent_address": b.agent_address,
        "agent_name": b.agent_name,
        "proposed_role": b.proposed_role,
        "proposed_subtask": b.proposed_subtask,
        "fit_score": b.fit_score,
        "reasoning": b.reasoning,
        "accepted": b.accepted,
        "created_at": b.created_at.isoformat(),
    }


def _ser_artifact(a: FreelanceArtifact) -> dict:
    return {
        "id": a.id,
        "agent_address": a.agent_address,
        "agent_name": a.agent_name,
        "role": a.role,
        "subtask_description": a.subtask_description,
        "content": a.content,
        "content_type": a.content_type,
        "ipfs_hash": a.ipfs_hash,
        "quality_score": a.quality_score,
        "submitted_at": a.submitted_at.isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_task(body: CreateFreelanceRequest, bg: BackgroundTasks):
    """Create a new freelance task and immediately kick off the state machine."""
    deadline = datetime.utcnow() + timedelta(minutes=body.deadline_minutes)

    async with db_session() as session:
        task = FreelanceTask(
            title=body.title,
            description=body.description,
            task_type=body.task_type,
            skills_required=body.skills_required,
            budget=body.budget,
            requester=body.requester,
            deadline=deadline,
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        task_id = task.id

    machine = get_freelance_machine()
    bg.add_task(machine.start_task, task_id)

    return {
        "id": task_id,
        "status": FreelanceStatus.CREATED,
        "message": "Freelance task created — agents are discovering it now",
    }


@router.get("/")
async def list_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    limit: int = 50,
):
    """List freelance tasks, newest first."""
    async with db_session() as session:
        q = select(FreelanceTask).order_by(desc(FreelanceTask.created_at)).limit(limit)
        if status and status.upper() != "ALL":
            q = q.where(FreelanceTask.status == status.upper())
        if task_type:
            q = q.where(FreelanceTask.task_type == task_type.lower())
        result = await session.execute(q)
        tasks = result.scalars().all()

        # Counts per task
        out = []
        for t in tasks:
            bids_q = await session.execute(
                select(FreelanceBid).where(FreelanceBid.task_id == t.id)
            )
            arts_q = await session.execute(
                select(FreelanceArtifact).where(FreelanceArtifact.task_id == t.id)
            )
            row = _ser_task(t)
            row["bid_count"] = len(bids_q.scalars().all())
            row["artifact_count"] = len(arts_q.scalars().all())
            row.pop("deliverable", None)  # omit full content in list view
            out.append(row)

    return out


@router.get("/{task_id}")
async def get_task(task_id: str):
    """Get full detail for a single freelance task including bids and artifacts."""
    async with db_session() as session:
        task = await session.get(FreelanceTask, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        bids_r = await session.execute(
            select(FreelanceBid)
            .where(FreelanceBid.task_id == task_id)
            .order_by(FreelanceBid.fit_score.desc())
        )
        arts_r = await session.execute(
            select(FreelanceArtifact)
            .where(FreelanceArtifact.task_id == task_id)
            .order_by(FreelanceArtifact.submitted_at)
        )

        row = _ser_task(task)
        row["bids"] = [_ser_bid(b) for b in bids_r.scalars().all()]
        row["artifacts"] = [_ser_artifact(a) for a in arts_r.scalars().all()]
        row["bid_count"] = len(row["bids"])
        row["artifact_count"] = len(row["artifacts"])

    return row


@router.post("/{task_id}/bid", status_code=201)
async def submit_bid(task_id: str, body: SubmitBidRequest):
    """Agent submits a bid to take on a subtask role."""
    try:
        machine = get_freelance_machine()
        bid = await machine.submit_bid(
            task_id=task_id,
            agent_address=body.agent_address,
            agent_name=body.agent_name,
            proposed_role=body.proposed_role,
            proposed_subtask=body.proposed_subtask,
            fit_score=body.fit_score,
            reasoning=body.reasoning,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "bid_accepted", "bid_id": bid.id}


@router.post("/{task_id}/submit", status_code=201)
async def submit_artifact(task_id: str, body: SubmitArtifactRequest):
    """Agent submits their completed deliverable artifact."""
    try:
        machine = get_freelance_machine()
        artifact = await machine.submit_artifact(
            task_id=task_id,
            agent_address=body.agent_address,
            agent_name=body.agent_name,
            role=body.role,
            subtask_description=body.subtask_description,
            content=body.content,
            content_type=body.content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "artifact_accepted", "artifact_id": artifact.id}


@router.get("/{task_id}/report")
async def get_report(task_id: str):
    """Download the assembled deliverable and IPFS link."""
    async with db_session() as session:
        task = await session.get(FreelanceTask, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if not task.deliverable:
            raise HTTPException(status_code=404, detail="Deliverable not yet assembled")

    from ..ipfs_client import ipfs_url as _ipfs_url
    return {
        "task_id": task_id,
        "deliverable": task.deliverable,
        "deliverable_hash": task.deliverable_hash,
        "ipfs_hash": task.deliverable_ipfs_hash,
        "ipfs_url": _ipfs_url(task.deliverable_ipfs_hash) if task.deliverable_ipfs_hash else None,
        "review_score": task.review_score,
        "review_notes": task.review_notes,
        "status": task.status,
    }
