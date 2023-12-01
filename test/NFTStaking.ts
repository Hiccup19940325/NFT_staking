import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/dist/src/signer-with-address'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    StakingToken,
    RewardToken,
    NFTStaking
} from '../typechain-types'

import {
    ether,
    deployStakingToken,
    deployNFTStaking,
    deployRewardToken
} from './helper'

describe("NFTStaking", function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let john: SignerWithAddress;

    let stakingToken: StakingToken;
    let rewardToken: RewardToken;
    let nftStaking: NFTStaking;

    before(async () => {
        const signer: SignerWithAddress[] = await ethers.getSigners();

        owner = signer[0];
        alice = signer[1];
        bob = signer[2];
        john = signer[3];

        stakingToken = await deployStakingToken();
        await stakingToken.mint(alice.address, 0);
        await stakingToken.mint(alice.address, 1);
        await stakingToken.mint(alice.address, 2);
        await stakingToken.mint(alice.address, 3);
        await stakingToken.mint(alice.address, 4);

        await stakingToken.mint(bob.address, 5);
        await stakingToken.mint(bob.address, 6);
        await stakingToken.mint(bob.address, 7);

        rewardToken = await deployRewardToken();

        nftStaking = await deployNFTStaking(stakingToken.getAddress(), rewardToken.getAddress(), 1e6);

        await rewardToken.mint(nftStaking.getAddress(), ether(100));

    })

    describe("Stake", function () {
        it("Failed - empty tokenId", async function () {
            await expect(nftStaking.stake([])).to.be.revertedWith("amount should be more than 0");
        });

        it("Success", async function () {

            //alice approved the token [0,1,2,3] to stakingPool
            await stakingToken.connect(alice).approve(nftStaking.getAddress(), 0);
            await stakingToken.connect(alice).approve(nftStaking.getAddress(), 1);
            await stakingToken.connect(alice).approve(nftStaking.getAddress(), 2);
            await stakingToken.connect(alice).approve(nftStaking.getAddress(), 3);

            //bob approved the token [5,6] to stakingPool
            await stakingToken.connect(bob).approve(nftStaking.getAddress(), 5);
            await stakingToken.connect(bob).approve(nftStaking.getAddress(), 6);

            //initial pending is 0
            const pending0 = await nftStaking.pendingRewards(bob.address);
            expect(pending0).to.equal(0n);

            //alice staked the token [0,1,2,3] to the pool
            await nftStaking.connect(alice).stake([0, 1, 2, 3]);
        });

        it("Success - confirm the stakingPool balance", async function () {
            expect(await stakingToken.balanceOf(nftStaking.getAddress())).to.equal(4n)
        });

        it("Success - confirm the updated staker info", async function () {
            const stakerInfo = await nftStaking.stakers(alice.address);
            expect(stakerInfo).to.eql([4n, 0n]);

            expect(await nftStaking.viewStakeInfo(alice.address)).to.eql([0n, 1n, 2n, 3n]);
        });
    });

    describe("Claim", function () {
        it("Success - confirm the reward increase", async function () {

            //alice rewardToken balance before alice claiming 
            const balance0 = await rewardToken.balanceOf(alice.address);

            //bob staked token [5,6] to the pool
            await nftStaking.connect(bob).stake([5, 6]);

            //alice pending reward is greater than 0
            const pending = await nftStaking.pendingRewards(alice.address);
            expect(pending).to.gt(0n);

            //alice claim the rewards
            await nftStaking.connect(alice).claimRewards();

            const balance1 = await rewardToken.balanceOf(alice.address);

            //confirm the alice reward token increasement
            expect(balance0).to.lt(balance1);
        });
    });

    describe("Withdraw", function () {
        it("Failed - amount should be more than 0", async function () {
            await expect(nftStaking.connect(john).withDraw([])).to.be.revertedWith("amount should be more than 0")
        });

        it("Failed - John is not a staker", async function () {
            await expect(nftStaking.connect(john).withDraw([0])).to.be.revertedWith("you are not a staker")
        });

        it("Failed - withdrawl tokens are more than your staked amount", async function () {
            await expect(nftStaking.connect(bob).withDraw([0, 1, 2, 3, 4, 5, 6])).to.be.revertedWith("your staked tokens is less than your required tokens")
        });

        it("Failed - tokenId 0 is not bob's token", async function () {
            await expect(nftStaking.connect(bob).withDraw([0])).to.be.revertedWith("it is not token you staked")
        });

        it("Success - confirm the updated staker's tokenId", async function () {

            //alice withdraw the token [0]
            await nftStaking.connect(alice).withDraw([0]);
            const token = await nftStaking.viewStakeInfo(alice.address);

            //alice's staked token is updated to [3,1,2]
            expect(token).to.eql([3n, 1n, 2n])
        });

        it("Success - confirm the staker's tokenId after rewithdraw", async function () {

            //alice withdraw the token [3]
            await nftStaking.connect(alice).withDraw([3]);
            const token = await nftStaking.viewStakeInfo(alice.address);

            //alice's staked token is updated to [2,1]
            expect(token).to.eql([2n, 1n])
        });
    });
});
