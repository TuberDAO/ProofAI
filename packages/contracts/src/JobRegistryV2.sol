// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title JobRegistryV2
 * @notice Enhanced job registry that tracks the submitter (signer) separately from the payer
 * @dev In client-signed mode, submitter = user's wallet; payer = relayer/server wallet
 */
contract JobRegistryV2 {
    struct Job {
        address payer;          // Who paid for the transaction (gas)
        address submitter;      // Who signed/submitted the job (user)
        address provider;       // AI provider address
        bytes32 attestationHash; // keccak256 of attestation artifact
        uint256 amount;         // Payment amount
        uint256 timestamp;      // Block timestamp
    }

    uint256 public jobCounter;
    mapping(uint256 => Job) public jobs;

    event JobSubmitted(
        uint256 indexed jobId,
        bytes32 indexed attestationHash,
        address indexed submitter,
        address payer,
        address provider,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @notice Submit a new job with explicit submitter tracking
     * @param attestationHash Hash of the attestation artifact
     * @param provider Address of the AI provider
     * @param submitter Address of the user who signed/submitted the job
     * @return jobId The unique identifier for this job
     */
    function submitJob(
        bytes32 attestationHash,
        address provider,
        address submitter
    ) external payable returns (uint256 jobId) {
        require(msg.value > 0, "Payment required");
        require(provider != address(0), "Invalid provider");
        require(submitter != address(0), "Invalid submitter");
        require(attestationHash != bytes32(0), "Invalid attestation hash");

        jobCounter++;
        jobId = jobCounter;

        jobs[jobId] = Job({
            payer: msg.sender,
            submitter: submitter,
            provider: provider,
            attestationHash: attestationHash,
            amount: msg.value,
            timestamp: block.timestamp
        });

        emit JobSubmitted(
            jobId,
            attestationHash,
            submitter,
            msg.sender,
            provider,
            msg.value,
            block.timestamp
        );

        return jobId;
    }

    /**
     * @notice Get job details by ID
     * @param jobId The job identifier
     * @return Job struct with all details
     */
    function getJob(uint256 jobId) external view returns (Job memory) {
        require(jobId > 0 && jobId <= jobCounter, "Invalid job ID");
        return jobs[jobId];
    }

    /**
     * @notice Get jobs submitted by a specific user
     * @param submitter The user's address
     * @return Array of job IDs submitted by this user
     */
    function getJobsBySubmitter(address submitter) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // First pass: count jobs
        for (uint256 i = 1; i <= jobCounter; i++) {
            if (jobs[i].submitter == submitter) {
                count++;
            }
        }

        // Second pass: collect job IDs
        uint256[] memory userJobs = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= jobCounter; i++) {
            if (jobs[i].submitter == submitter) {
                userJobs[index] = i;
                index++;
            }
        }

        return userJobs;
    }
}

