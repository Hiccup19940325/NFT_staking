import { ethers } from 'hardhat';
import { BaseContract } from 'ethers';

import {
    StakingToken,
    RewardToken,
    NFTStaking
} from '../../typechain-types'

export const deployContract = async<ContractType extends BaseContract>(
    contractName: string,
    args: any[],
    library?: {}
) => {
    const signers = await ethers.getSigners();
    const contract = await (await ethers.getContractFactory(contractName, signers[0], {
        libraries: {
            ...library
        }
    })).deploy(...args) as ContractType;
    return contract;
}

export const deployStakingToken = async () => {
    return await deployContract<StakingToken>('StakingToken', ['Staking Token', "ST"]);
}

export const deployRewardToken = async () => {
    return await deployContract<RewardToken>('RewardToken', ['Reward Token', 'RT']);
}

export const deployNFTStaking = async (
    _stakingToken: any,
    _rewardToken: any,
    _rewardPerBlock: any
) => {
    return await deployContract<NFTStaking>('NFTStaking', [
        _stakingToken,
        _rewardToken,
        _rewardPerBlock
    ])
}