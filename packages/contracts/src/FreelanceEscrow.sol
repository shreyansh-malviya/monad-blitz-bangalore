// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ReputationManager.sol";

/**
 * @title FreelanceEscrow
 * @notice Manages freelance-track tasks: AI agent team assembly, work delivery,
 *         contribution-weighted payout, and on-chain deliverable anchoring.
 *
 * Flow:
 *   createTask (locks MON bounty)
 *     → assignTeam (records team + contribution weights)
 *     → submitArtifact (agent anchors their artifact hash)
 *     → settleTask (distributes bounty by weight, anchors deliverable IPFS CID)
 *   or
 *     → openDispute / expireTask (refund or partial settlement)
 */
contract FreelanceEscrow is Ownable, ReentrancyGuard {
    ReputationManager public reputation;
    address public orchestratorAddress;

    enum TaskStatus {
        Open,
        TeamFormed,
        InProgress,
        Settled,
        Failed,
        Disputed
    }

    struct TeamMember {
        address agent;
        string role;
        uint256 weight; // basis points (0-10000), sum must equal 10000
    }

    struct Task {
        uint256 id;
        address requester;
        bytes32 descriptionHash;     // keccak256(title + description)
        string taskType;             // "code" | "document" | "research" | "design" | "analysis"
        uint256 bounty;              // MON locked in wei
        uint256 deadline;
        TaskStatus status;
        bytes32 deliverableHash;     // SHA256 of assembled deliverable
        string deliverableIpfsCid;   // IPFS CID of final assembled output
        uint256 reviewScore;         // 0–10000 basis points (multiply by 1e-4 for 0.0–1.0)
        uint256 createdAt;
    }

    struct ArtifactRecord {
        address agent;
        bytes32 contentHash;
        string ipfsCid;
        uint256 submittedAt;
    }

    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => TeamMember[]) public taskTeams;
    mapping(uint256 => ArtifactRecord[]) public taskArtifacts;

    // Reputation rewards
    uint256 public constant SETTLE_BONUS = 200;
    uint256 public constant PARTICIPATION_BONUS = 75;
    uint256 public constant DISPUTE_PENALTY = 100;

    // ── Events ────────────────────────────────────────────────────────────────

    event TaskCreated(
        uint256 indexed taskId,
        address indexed requester,
        bytes32 descriptionHash,
        string taskType,
        uint256 bounty,
        uint256 deadline
    );

    event TeamAssigned(
        uint256 indexed taskId,
        address[] agents,
        string[] roles,
        uint256[] weights
    );

    event ArtifactSubmitted(
        uint256 indexed taskId,
        address indexed agent,
        bytes32 contentHash,
        string ipfsCid
    );

    event TaskSettled(
        uint256 indexed taskId,
        bytes32 deliverableHash,
        string deliverableIpfsCid,
        uint256 reviewScore,
        address[] contributors,
        uint256[] payments
    );

    event TaskFailed(uint256 indexed taskId, string reason);
    event DisputeOpened(uint256 indexed taskId, address indexed by);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _reputation, address _orchestrator) Ownable(msg.sender) {
        reputation = ReputationManager(_reputation);
        orchestratorAddress = _orchestrator;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOrchestrator() {
        require(msg.sender == orchestratorAddress, "Not orchestrator");
        _;
    }

    modifier taskExists(uint256 taskId) {
        require(taskId < nextTaskId, "Task does not exist");
        _;
    }

    // ── Core functions ────────────────────────────────────────────────────────

    /**
     * @notice Create a freelance task and lock the bounty.
     * @param descriptionHash keccak256 of task title + description
     * @param taskType        "code" | "document" | "research" | "design" | "analysis"
     * @param deadlineSeconds Seconds from now until expiry
     */
    function createTask(
        bytes32 descriptionHash,
        string calldata taskType,
        uint256 deadlineSeconds
    ) external payable returns (uint256 taskId) {
        taskId = nextTaskId++;
        tasks[taskId] = Task({
            id: taskId,
            requester: msg.sender,
            descriptionHash: descriptionHash,
            taskType: taskType,
            bounty: msg.value,
            deadline: block.timestamp + deadlineSeconds,
            status: TaskStatus.Open,
            deliverableHash: bytes32(0),
            deliverableIpfsCid: "",
            reviewScore: 0,
            createdAt: block.timestamp
        });

        emit TaskCreated(taskId, msg.sender, descriptionHash, taskType, msg.value, block.timestamp + deadlineSeconds);
    }

    /**
     * @notice Orchestrator records the selected team and their contribution weights.
     * @param agents  Array of agent addresses
     * @param roles   Role label per agent (same index)
     * @param weights Basis points per agent (must sum to 10000)
     */
    function assignTeam(
        uint256 taskId,
        address[] calldata agents,
        string[] calldata roles,
        uint256[] calldata weights
    ) external onlyOrchestrator taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task not open");
        require(agents.length == roles.length && agents.length == weights.length, "Length mismatch");
        require(agents.length > 0, "Empty team");

        uint256 totalWeight;
        for (uint256 i = 0; i < agents.length; i++) {
            totalWeight += weights[i];
            taskTeams[taskId].push(TeamMember({
                agent: agents[i],
                role: roles[i],
                weight: weights[i]
            }));
        }
        require(totalWeight == 10000, "Weights must sum to 10000");

        task.status = TaskStatus.TeamFormed;

        emit TeamAssigned(taskId, agents, roles, weights);
    }

    /**
     * @notice Agent anchors their artifact hash on-chain after submission.
     */
    function submitArtifact(
        uint256 taskId,
        bytes32 contentHash,
        string calldata ipfsCid
    ) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.TeamFormed || task.status == TaskStatus.InProgress,
            "Task not accepting artifacts"
        );

        // Verify caller is a team member
        bool isMember;
        TeamMember[] storage team = taskTeams[taskId];
        for (uint256 i = 0; i < team.length; i++) {
            if (team[i].agent == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "Not a team member");

        if (task.status == TaskStatus.TeamFormed) {
            task.status = TaskStatus.InProgress;
        }

        taskArtifacts[taskId].push(ArtifactRecord({
            agent: msg.sender,
            contentHash: contentHash,
            ipfsCid: ipfsCid,
            submittedAt: block.timestamp
        }));

        emit ArtifactSubmitted(taskId, msg.sender, contentHash, ipfsCid);
    }

    /**
     * @notice Orchestrator settles the task: distributes bounty and anchors deliverable.
     * @param deliverableHash SHA256 of the assembled final deliverable
     * @param deliverableIpfsCid IPFS CID of the assembled deliverable
     * @param reviewScoreBps Review score in basis points (6500 = 0.65)
     */
    function settleTask(
        uint256 taskId,
        bytes32 deliverableHash,
        string calldata deliverableIpfsCid,
        uint256 reviewScoreBps
    ) external nonReentrant onlyOrchestrator taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.TeamFormed || task.status == TaskStatus.InProgress,
            "Task cannot be settled"
        );
        require(reviewScoreBps <= 10000, "Invalid score");

        task.status = TaskStatus.Settled;
        task.deliverableHash = deliverableHash;
        task.deliverableIpfsCid = deliverableIpfsCid;
        task.reviewScore = reviewScoreBps;

        TeamMember[] storage team = taskTeams[taskId];
        uint256 bounty = task.bounty;
        address[] memory contributors = new address[](team.length);
        uint256[] memory payments = new uint256[](team.length);

        for (uint256 i = 0; i < team.length; i++) {
            address agent = team[i].agent;
            uint256 share = (bounty * team[i].weight) / 10000;
            contributors[i] = agent;
            payments[i] = share;

            if (share > 0) {
                (bool ok,) = agent.call{value: share}("");
                require(ok, "Transfer failed");
            }

            try reputation.updateReputation(agent, int256(SETTLE_BONUS)) {} catch {}
        }

        emit TaskSettled(taskId, deliverableHash, deliverableIpfsCid, reviewScoreBps, contributors, payments);
    }

    /**
     * @notice Mark a task as failed and refund the requester.
     */
    function failTask(
        uint256 taskId,
        string calldata reason
    ) external nonReentrant onlyOrchestrator taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status != TaskStatus.Settled && task.status != TaskStatus.Failed, "Already finalized");

        task.status = TaskStatus.Failed;

        if (task.bounty > 0) {
            (bool ok,) = task.requester.call{value: task.bounty}("");
            require(ok, "Refund failed");
        }

        // Participation bonus for any agents who submitted artifacts
        ArtifactRecord[] storage artifacts = taskArtifacts[taskId];
        for (uint256 i = 0; i < artifacts.length; i++) {
            try reputation.updateReputation(artifacts[i].agent, int256(PARTICIPATION_BONUS)) {} catch {}
        }

        emit TaskFailed(taskId, reason);
    }

    /**
     * @notice Requester can open a dispute if the deliverable is unsatisfactory.
     */
    function openDispute(uint256 taskId) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(msg.sender == task.requester, "Not requester");
        require(task.status == TaskStatus.Settled, "Task not settled");

        task.status = TaskStatus.Disputed;
        emit DisputeOpened(taskId, msg.sender);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setOrchestrator(address _orchestrator) external onlyOwner {
        orchestratorAddress = _orchestrator;
    }

    function setReputation(address _reputation) external onlyOwner {
        reputation = ReputationManager(_reputation);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getTeam(uint256 taskId) external view returns (TeamMember[] memory) {
        return taskTeams[taskId];
    }

    function getArtifacts(uint256 taskId) external view returns (ArtifactRecord[] memory) {
        return taskArtifacts[taskId];
    }

    function taskCount() external view returns (uint256) {
        return nextTaskId;
    }

    receive() external payable {}
}
