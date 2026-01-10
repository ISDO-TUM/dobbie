// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DevOpsGovernor is
    Governor,
    GovernorCountingSimple,
    GovernorTimelockControl,
    AccessControl
{
    // --- ROLES ---
    bytes32 public constant STAKEHOLDER_ROLE = keccak256("STAKEHOLDER_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // --- STATE ---
    // REMOVED: mapping(address => string) public stakeholderUsernames;
    // We now rely on events for identity metadata to be platform-agnostic.

    uint256 public stakeholderCount;
    mapping(string => uint256) public latestProposalIdByCID;
    mapping(uint256 => bytes32) public proposalToProject;

    uint256 private _votingDelay;
    uint256 private _votingPeriod;

    // --- EVENTS ---
    event ProposalPackageCreated(
        uint256 indexed proposalId,
        bytes32 indexed projectId,
        string ipfsCID,
        address targetAddress
    );

    event StakeholderAdded(address indexed account);
    event StakeholderRemoved(address indexed account);

    // Flexible Identity System: allows stakeholders to link off-chain identities
    event IdentitySet(address indexed account, string key, string value);

    event BotAdded(address indexed botAddress, bytes32 role);
    event BotRemoved(address indexed botAddress, bytes32 role);
    event VotingDelaySet(uint256 oldVotingDelay, uint256 newVotingDelay);
    event VotingPeriodSet(uint256 oldVotingPeriod, uint256 newVotingPeriod);

    // --- MODIFIERS ---
    modifier onlyProposerOrStakeholder() {
        require(
            hasRole(PROPOSER_ROLE, msg.sender) ||
                hasRole(STAKEHOLDER_ROLE, msg.sender),
            "Governor: caller is not a proposer or a stakeholder"
        );
        _;
    }

    modifier onlyExecutorOrStakeholder() {
        require(
            hasRole(EXECUTOR_ROLE, msg.sender) ||
                hasRole(STAKEHOLDER_ROLE, msg.sender),
            "Governor: caller is not an executor or stakeholder"
        );
        _;
    }

    constructor(
        string memory name,
        TimelockController timelock,
        address[] memory _initialStakeholders,
        // REMOVED: string[] memory _usernames
        address[] memory _proposerBots,
        address[] memory _executorBots,
        uint256 initialVotingDelay,
        uint256 initialVotingPeriod
    ) Governor(name) GovernorTimelockControl(timelock) {
        _votingDelay = initialVotingDelay;
        _votingPeriod = initialVotingPeriod;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // 1. Setup Stakeholders (Purely Address based now)
        for (uint256 i = 0; i < _initialStakeholders.length; i++) {
            address stakeholder = _initialStakeholders[i];

            _grantRole(STAKEHOLDER_ROLE, stakeholder);
            _grantRole(PROPOSER_ROLE, stakeholder);
            _grantRole(EXECUTOR_ROLE, stakeholder);

            emit StakeholderAdded(stakeholder);
        }
        stakeholderCount = _initialStakeholders.length;

        // 2. Setup Proposer Bots
        for (uint256 i = 0; i < _proposerBots.length; i++) {
            _grantRole(PROPOSER_ROLE, _proposerBots[i]);
            emit BotAdded(_proposerBots[i], PROPOSER_ROLE);
        }

        // 3. Setup Executor Bots
        for (uint256 i = 0; i < _executorBots.length; i++) {
            _grantRole(EXECUTOR_ROLE, _executorBots[i]);
            emit BotAdded(_executorBots[i], EXECUTOR_ROLE);
        }
    }

    // --- CONFIGURATION FUNCTIONS ---
    function setVotingDelay(uint256 newVotingDelay) external onlyGovernance {
        uint256 oldVotingDelay = _votingDelay;
        _votingDelay = newVotingDelay;
        emit VotingDelaySet(oldVotingDelay, newVotingDelay);
    }

    function setVotingPeriod(uint256 newVotingPeriod) external onlyGovernance {
        uint256 oldVotingPeriod = _votingPeriod;
        _votingPeriod = newVotingPeriod;
        emit VotingPeriodSet(oldVotingPeriod, newVotingPeriod);
    }

    function addBot(
        address _botAddress,
        bytes32 _role
    ) external onlyGovernance {
        require(_botAddress != address(0), "Cannot add zero address");
        require(
            _role == PROPOSER_ROLE || _role == EXECUTOR_ROLE,
            "Invalid bot role"
        );
        _grantRole(_role, _botAddress);
        emit BotAdded(_botAddress, _role);
    }

    function removeBot(
        address _botAddress,
        bytes32 _role
    ) external onlyGovernance {
        require(hasRole(_role, _botAddress), "Bot does not have role");
        _revokeRole(_role, _botAddress);
        emit BotRemoved(_botAddress, _role);
    }

    function addStakeholder(address account) external onlyGovernance {
        require(!hasRole(STAKEHOLDER_ROLE, account), "Already stakeholder");
        _grantRole(STAKEHOLDER_ROLE, account);
        stakeholderCount++;
        emit StakeholderAdded(account);
    }

    function removeStakeholder(address account) external onlyGovernance {
        require(hasRole(STAKEHOLDER_ROLE, account), "Not stakeholder");
        _revokeRole(STAKEHOLDER_ROLE, account);
        stakeholderCount--;
        emit StakeholderRemoved(account);
    }

    // --- SELF-SOVEREIGN IDENTITY ---
    /**
     * @notice Allows a stakeholder to set their own off-chain identity keys.
     * @param key The platform identifier (e.g., "github", "gitlab", "email", "name")
     * @param value The username or handle (e.g., "dev-wizard", "alice@example.com")
     */
    function setIdentity(
        string calldata key,
        string calldata value
    ) external onlyRole(STAKEHOLDER_ROLE) {
        // Emitting this event allows the Dobby Indexer to update the SQL database
        // without requiring expensive on-chain string storage.
        emit IdentitySet(msg.sender, key, value);
    }

    // --- OVERRIDES ---

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) onlyRole(STAKEHOLDER_ROLE) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    function proposePackage(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        bytes32 projectId,
        string memory ipfsCID,
        address targetAddress
    ) public onlyProposerOrStakeholder returns (uint256) {
        uint256 existingProposalId = latestProposalIdByCID[ipfsCID];
        if (existingProposalId != 0) {
            ProposalState status = state(existingProposalId);
            require(
                status != ProposalState.Pending &&
                    status != ProposalState.Active,
                "Governor: active proposal exists"
            );
        }

        uint256 newProposalId = super.propose(
            targets,
            values,
            calldatas,
            description
        );

        latestProposalIdByCID[ipfsCID] = newProposalId;
        proposalToProject[newProposalId] = projectId;

        emit ProposalPackageCreated(
            newProposalId,
            projectId,
            ipfsCID,
            targetAddress
        );
        return newProposalId;
    }

    function queue(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public override(Governor) onlyExecutorOrStakeholder returns (uint256) {
        return super.queue(targets, values, calldatas, descriptionHash);
    }

    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        public
        payable
        override(Governor)
        onlyExecutorOrStakeholder
        returns (uint256)
    {
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    // --- REQUIRED IMPLEMENTATIONS ---

    function _getVotes(
        address account,
        uint256 /* timepoint */,
        bytes memory /* params */
    ) internal view override returns (uint256) {
        return hasRole(STAKEHOLDER_ROLE, account) ? 1 : 0;
    }

    function votingDelay() public view override returns (uint256) {
        return _votingDelay;
    }

    function votingPeriod() public view override returns (uint256) {
        return _votingPeriod;
    }

    function quorum(uint256) public view override returns (uint256) {
        return (stakeholderCount / 2) + 1;
    }

    function clock() public view virtual override returns (uint48) {
        return uint48(block.number);
    }

    function CLOCK_MODE() public pure virtual override returns (string memory) {
        return "mode=blocknumber&from=default";
    }

    function state(
        uint256 proposalId
    )
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(
        uint256 proposalId
    ) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return
            super._queueOperations(
                proposalId,
                targets,
                values,
                calldatas,
                descriptionHash
            );
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(Governor, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
