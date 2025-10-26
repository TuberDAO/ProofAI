// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/JobRegistryV2.sol";

contract JobRegistryV2Test is Test {
    JobRegistryV2 public registry;
    
    address public payer = address(0x1);
    address public submitter = address(0x2);
    address public provider = address(0x3);
    bytes32 public constant TEST_HASH = keccak256("test attestation");

    function setUp() public {
        registry = new JobRegistryV2();
        vm.deal(payer, 10 ether);
    }

    function testSubmitJob() public {
        vm.prank(payer);
        uint256 jobId = registry.submitJob{value: 0.001 ether}(
            TEST_HASH,
            provider,
            submitter
        );

        assertEq(jobId, 1);
        assertEq(registry.jobCounter(), 1);

        JobRegistryV2.Job memory job = registry.getJob(jobId);
        assertEq(job.payer, payer);
        assertEq(job.submitter, submitter);
        assertEq(job.provider, provider);
        assertEq(job.attestationHash, TEST_HASH);
        assertEq(job.amount, 0.001 ether);
        assertGt(job.timestamp, 0);
    }

    function testSubmitJobEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit JobRegistryV2.JobSubmitted(
            1,
            TEST_HASH,
            submitter,
            payer,
            provider,
            0.001 ether,
            block.timestamp
        );

        vm.prank(payer);
        registry.submitJob{value: 0.001 ether}(TEST_HASH, provider, submitter);
    }

    function testSubmitJobRequiresPayment() public {
        vm.prank(payer);
        vm.expectRevert("Payment required");
        registry.submitJob{value: 0}(TEST_HASH, provider, submitter);
    }

    function testSubmitJobRequiresValidProvider() public {
        vm.prank(payer);
        vm.expectRevert("Invalid provider");
        registry.submitJob{value: 0.001 ether}(TEST_HASH, address(0), submitter);
    }

    function testSubmitJobRequiresValidSubmitter() public {
        vm.prank(payer);
        vm.expectRevert("Invalid submitter");
        registry.submitJob{value: 0.001 ether}(TEST_HASH, provider, address(0));
    }

    function testSubmitJobRequiresValidHash() public {
        vm.prank(payer);
        vm.expectRevert("Invalid attestation hash");
        registry.submitJob{value: 0.001 ether}(bytes32(0), provider, submitter);
    }

    function testGetJobsBySubmitter() public {
        // Submit 3 jobs with different submitters
        vm.prank(payer);
        registry.submitJob{value: 0.001 ether}(TEST_HASH, provider, submitter);
        
        vm.prank(payer);
        registry.submitJob{value: 0.001 ether}(TEST_HASH, provider, address(0x4));
        
        vm.prank(payer);
        registry.submitJob{value: 0.001 ether}(TEST_HASH, provider, submitter);

        // Check submitter has 2 jobs
        uint256[] memory jobs = registry.getJobsBySubmitter(submitter);
        assertEq(jobs.length, 2);
        assertEq(jobs[0], 1);
        assertEq(jobs[1], 3);
    }

    function testMultipleJobs() public {
        vm.startPrank(payer);
        
        uint256 jobId1 = registry.submitJob{value: 0.001 ether}(
            TEST_HASH,
            provider,
            submitter
        );
        uint256 jobId2 = registry.submitJob{value: 0.002 ether}(
            keccak256("second job"),
            provider,
            address(0x4)
        );

        vm.stopPrank();

        assertEq(jobId1, 1);
        assertEq(jobId2, 2);
        assertEq(registry.jobCounter(), 2);
    }
}

