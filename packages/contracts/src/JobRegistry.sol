// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract JobRegistry {
    struct Job {
        address payer;
        address provider;
        bytes32 attestationHash;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(uint256 => Job) public jobs;
    uint256 public jobCounter;

    event JobSubmitted(
        uint256 indexed jobId,
        address indexed payer,
        address indexed provider,
        bytes32 attestationHash,
        uint256 amount,
        uint256 timestamp
    );

    function submitJob(bytes32 attestationHash, address provider)
        external
        payable
        returns (uint256 jobId)
    {
        require(msg.value > 0, "Payment required");
        require(provider != address(0), "Invalid provider address");

        jobCounter++;
        jobId = jobCounter;

        jobs[jobId] = Job({
            payer: msg.sender,
            provider: provider,
            attestationHash: attestationHash,
            amount: msg.value,
            timestamp: block.timestamp
        });

        emit JobSubmitted(
            jobId,
            msg.sender,
            provider,
            attestationHash,
            msg.value,
            block.timestamp
        );

        return jobId;
    }

    function getJob(uint256 jobId)
        external
        view
        returns (
            address payer,
            address provider,
            bytes32 attestationHash,
            uint256 amount,
            uint256 timestamp
        )
    {
        Job memory job = jobs[jobId];
        return (
            job.payer,
            job.provider,
            job.attestationHash,
            job.amount,
            job.timestamp
        );
    }
}

