// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/JobRegistry.sol";

contract JobRegistryTest is Test {
    JobRegistry public registry;
    address public payer = address(0x1);
    address public provider = address(0x2);

    function setUp() public {
        registry = new JobRegistry();
        vm.deal(payer, 10 ether);
    }

    function testSubmitJob() public {
        bytes32 attestationHash = keccak256("test prompt");
        uint256 amount = 0.01 ether;

        vm.prank(payer);
        uint256 jobId = registry.submitJob{value: amount}(
            attestationHash,
            provider
        );

        assertEq(jobId, 1, "First job ID should be 1");

        (
            address returnedPayer,
            address returnedProvider,
            bytes32 returnedHash,
            uint256 returnedAmount,
            uint256 timestamp
        ) = registry.getJob(jobId);

        assertEq(returnedPayer, payer, "Payer mismatch");
        assertEq(returnedProvider, provider, "Provider mismatch");
        assertEq(returnedHash, attestationHash, "Attestation hash mismatch");
        assertEq(returnedAmount, amount, "Amount mismatch");
        assertGt(timestamp, 0, "Timestamp should be set");
    }

    function testSubmitJobEmitsEvent() public {
        bytes32 attestationHash = keccak256("test prompt");
        uint256 amount = 0.01 ether;

        vm.expectEmit(true, true, true, true);
        emit JobRegistry.JobSubmitted(
            1,
            payer,
            provider,
            attestationHash,
            amount,
            block.timestamp
        );

        vm.prank(payer);
        registry.submitJob{value: amount}(attestationHash, provider);
    }

    function testSubmitJobRequiresPayment() public {
        bytes32 attestationHash = keccak256("test prompt");

        vm.prank(payer);
        vm.expectRevert("Payment required");
        registry.submitJob{value: 0}(attestationHash, provider);
    }

    function testSubmitJobRequiresValidProvider() public {
        bytes32 attestationHash = keccak256("test prompt");
        uint256 amount = 0.01 ether;

        vm.prank(payer);
        vm.expectRevert("Invalid provider address");
        registry.submitJob{value: amount}(attestationHash, address(0));
    }

    function testMultipleJobs() public {
        bytes32 hash1 = keccak256("prompt 1");
        bytes32 hash2 = keccak256("prompt 2");

        vm.startPrank(payer);
        uint256 jobId1 = registry.submitJob{value: 0.01 ether}(hash1, provider);
        uint256 jobId2 = registry.submitJob{value: 0.02 ether}(hash2, provider);
        vm.stopPrank();

        assertEq(jobId1, 1, "First job ID");
        assertEq(jobId2, 2, "Second job ID");
        assertEq(registry.jobCounter(), 2, "Job counter should be 2");
    }
}

