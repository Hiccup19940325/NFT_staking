// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract NFTStaking is ERC721Holder, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    IERC721 public stakingToken;
    IERC20 public rewardToken;

    uint private accRewardsPerShare;
    uint public totalAmount;
    uint public lastUpdatedBlock;
    uint public rewardPerBlock;
    uint REWARD_PRECISION = 1e12;

    struct stakerInfo {
        EnumerableSet.UintSet tokenIds;
        uint amount;
        uint rewardsDebt;
    }

    mapping(address => stakerInfo) private stakers;
    mapping(uint => address) public owner;

    event Stake(address staker, uint[] tokenId);
    event ClaimRewards(address staker, uint amount);
    event Withdraw(address staler, uint[] tokenId);

    constructor(
        address _stakingToken,
        address _rewardToken,
        uint _rewardPerBlock
    ) {
        stakingToken = IERC721(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardPerBlock = _rewardPerBlock;
    }

    /**
     * @dev deposit the NFT into staking pool
     * @param _tokenIds deposited tokenIds
     */
    function stake(uint[] calldata _tokenIds) external nonReentrant {
        require(_tokenIds.length != 0, "amount should be more than 0");

        stakerInfo storage staker = stakers[msg.sender];

        for (uint i = 0; i < _tokenIds.length; i++) {
            stakingToken.safeTransferFrom(
                msg.sender,
                address(this),
                _tokenIds[i]
            );

            //update the staker tokenIds
            staker.tokenIds.add(_tokenIds[i]);

            //update the owner and index info
            owner[_tokenIds[i]] = msg.sender;
            // _index.add(_tokenIds[i]);
        }

        updateState();
        claim();

        staker.amount += _tokenIds.length;

        staker.rewardsDebt =
            (staker.amount * accRewardsPerShare) /
            REWARD_PRECISION;

        totalAmount += _tokenIds.length;

        emit Stake(msg.sender, _tokenIds);
    }

    /**
     * @dev withdraw the deposited tokens
     * @param _tokenIds tokenIds of the withdrawl token
     */
    function withDraw(uint[] calldata _tokenIds) external nonReentrant {
        require(_tokenIds.length != 0, "amount should be more than 0");
        stakerInfo storage staker = stakers[msg.sender];

        require(staker.amount != 0, "you are not a staker");
        require(
            _tokenIds.length <= staker.amount,
            "your staked tokens is less than your required tokens"
        );

        updateState();
        claim();

        uint length = _tokenIds.length;

        staker.amount -= length;
        staker.rewardsDebt =
            (staker.amount * accRewardsPerShare) /
            REWARD_PRECISION;
        totalAmount -= length;

        for (uint i = 0; i < length; i++) {
            uint token = _tokenIds[i];

            // //staker's tokenIds length
            // uint stakerLength = staker.tokenIds.length;
            require(owner[token] == msg.sender, "it is not token you staked");

            staker.tokenIds.remove(token);

            stakingToken.safeTransferFrom(address(this), msg.sender, token);
        }

        emit Withdraw(msg.sender, _tokenIds);
    }

    /**
     * @dev show the tokenIds user staked
     * @param _staker address of staker
     * @return tokenIds return the staked tokenIds
     */
    function viewStakeInfo(
        address _staker
    ) external view returns (uint256[] memory) {
        return stakers[_staker].tokenIds.values();
    }

    function updateState() internal {
        if (totalAmount == 0) {
            lastUpdatedBlock = block.number;
            return;
        }

        uint rewards = (block.number - lastUpdatedBlock) * rewardPerBlock;

        accRewardsPerShare += (rewards * REWARD_PRECISION) / totalAmount;
        lastUpdatedBlock = block.number;
    }

    function claim() internal {
        stakerInfo storage staker = stakers[msg.sender];
        uint rewardsToHarvest = (staker.amount * accRewardsPerShare) /
            REWARD_PRECISION -
            staker.rewardsDebt;

        if (rewardsToHarvest == 0) {
            staker.rewardsDebt =
                (staker.amount * accRewardsPerShare) /
                REWARD_PRECISION;
            return;
        }

        staker.rewardsDebt =
            (staker.amount * accRewardsPerShare) /
            REWARD_PRECISION;

        rewardToken.transfer(msg.sender, rewardsToHarvest);

        emit ClaimRewards(msg.sender, rewardsToHarvest);
    }

    /**
     * @dev update the states and claim the pending reward token
     */
    function claimRewards() external nonReentrant {
        updateState();
        claim();
    }

    /**
     * @dev show the pending Rewards
     * @return pendingReward pending reward
     */
    function pendingRewards(
        address _staker
    ) external view returns (uint pendingReward) {
        stakerInfo storage staker = stakers[_staker];

        uint accPerShare = accRewardsPerShare;

        if (totalAmount != 0 && lastUpdatedBlock <= block.number) {
            uint rewards = (block.number - lastUpdatedBlock) * rewardPerBlock;

            accPerShare += (rewards * REWARD_PRECISION) / totalAmount;
        }

        pendingReward =
            (staker.amount * accPerShare) /
            REWARD_PRECISION -
            staker.rewardsDebt;
    }
}
