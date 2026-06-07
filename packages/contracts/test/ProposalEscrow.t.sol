// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ProposalEscrow.sol";
import "../src/ReputationManager.sol";

contract ProposalEscrowTest is Test {
    ProposalEscrow public escrow;
    ReputationManager public reputation;

    address orchestrator = address(0x1);
    address requester    = address(0x2);
    address agentA       = address(0x3);
    address agentB       = address(0x4);
    address agentC       = address(0x5);

    function setUp() public {
        reputation = new ReputationManager();
        escrow = new ProposalEscrow(address(reputation));
        escrow.setOrchestrator(orchestrator);
        reputation.setEscrowContract(address(escrow));

        vm.deal(requester, 10 ether);
    }

    // ── createProposal ────────────────────────────────────────────────────────

    function test_createProposal_locksEther() public {
        vm.prank(requester);
        uint256 id = escrow.createProposal{value: 1 ether}(
            keccak256("Build a dating app"),
            4,
            600
        );
        assertEq(id, 0);
        assertEq(address(escrow).balance, 1 ether);

        ProposalEscrow.Proposal memory p = escrow.getProposal(0);
        assertEq(p.bounty, 1 ether);
        assertEq(p.requester, requester);
        assertEq(p.maxRoles, 4);
        assertEq(uint8(p.status), uint8(ProposalEscrow.ProposalStatus.Open));
    }

    function test_createProposal_zeroBounty() public {
        vm.prank(requester);
        uint256 id = escrow.createProposal{value: 0}(
            keccak256("No bounty proposal"),
            3,
            120
        );
        assertEq(id, 0);
        ProposalEscrow.Proposal memory p = escrow.getProposal(0);
        assertEq(p.bounty, 0);
    }

    function test_createProposal_rejectsInvalidRoles() public {
        vm.prank(requester);
        vm.expectRevert("ProposalEscrow: maxRoles must be 2-8");
        escrow.createProposal{value: 0}(keccak256("test"), 1, 120);

        vm.prank(requester);
        vm.expectRevert("ProposalEscrow: maxRoles must be 2-8");
        escrow.createProposal{value: 0}(keccak256("test"), 9, 120);
    }

    function test_createProposal_rejectsShortDeadline() public {
        vm.prank(requester);
        vm.expectRevert("ProposalEscrow: deadline must be at least 60s");
        escrow.createProposal{value: 0}(keccak256("test"), 3, 30);
    }

    // ── formTeam ──────────────────────────────────────────────────────────────

    function test_formTeam_recordsTeam() public {
        vm.prank(requester);
        escrow.createProposal{value: 1 ether}(keccak256("Drone startup"), 3, 300);

        address[] memory agents = new address[](3);
        string[] memory roles = new string[](3);
        agents[0] = agentA; roles[0] = "CEO";
        agents[1] = agentB; roles[1] = "CTO";
        agents[2] = agentC; roles[2] = "Investor";

        vm.prank(orchestrator);
        escrow.formTeam(0, agents, roles);

        ProposalEscrow.Proposal memory p = escrow.getProposal(0);
        assertEq(uint8(p.status), uint8(ProposalEscrow.ProposalStatus.TeamFormed));

        (address[] memory gotAgents, string[] memory gotRoles) = escrow.getTeam(0);
        assertEq(gotAgents[0], agentA);
        assertEq(gotRoles[0], "CEO");
        assertEq(gotAgents[2], agentC);
        assertEq(gotRoles[2], "Investor");
    }

    function test_formTeam_onlyOrchestrator() public {
        vm.prank(requester);
        escrow.createProposal{value: 0}(keccak256("test"), 2, 120);

        address[] memory agents = new address[](2);
        string[] memory roles = new string[](2);
        agents[0] = agentA; roles[0] = "CEO";
        agents[1] = agentB; roles[1] = "CTO";

        vm.prank(agentA); // not orchestrator
        vm.expectRevert("ProposalEscrow: caller is not the orchestrator");
        escrow.formTeam(0, agents, roles);
    }

    function test_formTeam_requiresTwoAgents() public {
        vm.prank(requester);
        escrow.createProposal{value: 0}(keccak256("test"), 2, 120);

        address[] memory agents = new address[](1);
        string[] memory roles = new string[](1);
        agents[0] = agentA; roles[0] = "CEO";

        vm.prank(orchestrator);
        vm.expectRevert("ProposalEscrow: need at least 2 agents");
        escrow.formTeam(0, agents, roles);
    }

    // ── settleProposal ────────────────────────────────────────────────────────

    function test_settleProposal_distributesBounty() public {
        vm.prank(requester);
        escrow.createProposal{value: 1 ether}(keccak256("Dating app"), 2, 300);

        address[] memory agents = new address[](2);
        string[] memory roles = new string[](2);
        agents[0] = agentA; roles[0] = "CEO";
        agents[1] = agentB; roles[1] = "CTO";

        vm.prank(orchestrator);
        escrow.formTeam(0, agents, roles);

        address[] memory contributors = new address[](2);
        uint256[] memory shares = new uint256[](2);
        contributors[0] = agentA; shares[0] = 5000; // 50%
        contributors[1] = agentB; shares[1] = 5000; // 50%

        uint256 balanceA_before = agentA.balance;
        uint256 balanceB_before = agentB.balance;

        vm.prank(orchestrator);
        escrow.settleProposal(
            0,
            keccak256("final report"),
            "ipfs://QmTest",
            contributors,
            shares
        );

        assertEq(agentA.balance - balanceA_before, 0.5 ether);
        assertEq(agentB.balance - balanceB_before, 0.5 ether);
        assertEq(address(escrow).balance, 0);

        ProposalEscrow.Proposal memory p = escrow.getProposal(0);
        assertEq(uint8(p.status), uint8(ProposalEscrow.ProposalStatus.Settled));
        assertEq(p.reportIpfsCid, "ipfs://QmTest");
    }

    function test_settleProposal_unequalShares() public {
        vm.prank(requester);
        escrow.createProposal{value: 1 ether}(keccak256("Startup"), 3, 300);

        address[] memory agents = new address[](3);
        string[] memory roles = new string[](3);
        agents[0] = agentA; roles[0] = "CEO";
        agents[1] = agentB; roles[1] = "CTO";
        agents[2] = agentC; roles[2] = "Investor";

        vm.prank(orchestrator);
        escrow.formTeam(0, agents, roles);

        address[] memory contributors = new address[](3);
        uint256[] memory shares = new uint256[](3);
        contributors[0] = agentA; shares[0] = 5000; // 50%
        contributors[1] = agentB; shares[1] = 3000; // 30%
        contributors[2] = agentC; shares[2] = 2000; // 20%

        vm.prank(orchestrator);
        escrow.settleProposal(0, keccak256("report"), "ipfs://Qm", contributors, shares);

        assertEq(agentA.balance, 0.5 ether);
        assertEq(agentB.balance, 0.3 ether);
        assertEq(agentC.balance, 0.2 ether);
    }

    function test_settleProposal_rejectsInvalidShares() public {
        vm.prank(requester);
        escrow.createProposal{value: 0}(keccak256("test"), 2, 120);

        address[] memory agents = new address[](2);
        string[] memory roles = new string[](2);
        agents[0] = agentA; roles[0] = "A";
        agents[1] = agentB; roles[1] = "B";
        vm.prank(orchestrator);
        escrow.formTeam(0, agents, roles);

        address[] memory contributors = new address[](2);
        uint256[] memory shares = new uint256[](2);
        contributors[0] = agentA; shares[0] = 5000;
        contributors[1] = agentB; shares[1] = 4999; // doesn't sum to 10000

        vm.prank(orchestrator);
        vm.expectRevert("ProposalEscrow: shares must sum to 10000");
        escrow.settleProposal(0, bytes32(0), "", contributors, shares);
    }

    // ── failProposal ──────────────────────────────────────────────────────────

    function test_failProposal_refundsRequester() public {
        vm.prank(requester);
        escrow.createProposal{value: 1 ether}(keccak256("test"), 2, 120);

        uint256 before = requester.balance;
        vm.prank(orchestrator);
        escrow.failProposal(0, "No agents available");

        assertEq(requester.balance - before, 1 ether);
        ProposalEscrow.Proposal memory p = escrow.getProposal(0);
        assertEq(uint8(p.status), uint8(ProposalEscrow.ProposalStatus.Failed));
    }

    // ── Multiple proposals ────────────────────────────────────────────────────

    function test_multipleProposals_independentIds() public {
        vm.startPrank(requester);
        uint256 id0 = escrow.createProposal{value: 0.1 ether}(keccak256("P0"), 2, 120);
        uint256 id1 = escrow.createProposal{value: 0.2 ether}(keccak256("P1"), 3, 200);
        uint256 id2 = escrow.createProposal{value: 0.3 ether}(keccak256("P2"), 4, 300);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(escrow.getProposal(0).bounty, 0.1 ether);
        assertEq(escrow.getProposal(1).bounty, 0.2 ether);
        assertEq(escrow.getProposal(2).bounty, 0.3 ether);
    }
}
