import { ethers } from 'ethers';
import STAKING_ABI from '../Contract_Files/stakingAbi.json';
import {
  STAKING_ADDRESS,
  VDO_ADDRESS,
  ERC20_ABI,
  POOL_DURATIONS,
  RPC_URL,
} from '../Contract_Files/constants';

let readProvider;
let readContract;

export function getReadContract() {
  if (!readContract) {
    readProvider = new ethers.JsonRpcProvider(RPC_URL);
    readContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, readProvider);
  }
  return readContract;
}

export function getWriteContract(signer) {
  return new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
}

export function getVdoContract(signer) {
  return new ethers.Contract(VDO_ADDRESS, ERC20_ABI, signer);
}

export async function fetchAllApys(contract = getReadContract()) {
  const [magic30, magic60, magic120, poison30, poison60, poison120] = await Promise.all([
    contract.rewardRates(0, POOL_DURATIONS[0]),
    contract.rewardRates(0, POOL_DURATIONS[1]),
    contract.rewardRates(0, POOL_DURATIONS[2]),
    contract.rewardRates(1, POOL_DURATIONS[0]),
    contract.rewardRates(1, POOL_DURATIONS[1]),
    contract.rewardRates(1, POOL_DURATIONS[2]),
  ]);

  return [
    { rewardToken: 'MAGIC', lockupDays: 30, apy: Number(magic30) / 100, duration: POOL_DURATIONS[0] },
    { rewardToken: 'MAGIC', lockupDays: 60, apy: Number(magic60) / 100, duration: POOL_DURATIONS[1] },
    { rewardToken: 'MAGIC', lockupDays: 120, apy: Number(magic120) / 100, duration: POOL_DURATIONS[2] },
    { rewardToken: 'POISON', lockupDays: 30, apy: Number(poison30) / 100, duration: POOL_DURATIONS[0] },
    { rewardToken: 'POISON', lockupDays: 60, apy: Number(poison60) / 100, duration: POOL_DURATIONS[1] },
    { rewardToken: 'POISON', lockupDays: 120, apy: Number(poison120) / 100, duration: POOL_DURATIONS[2] },
  ];
}

export async function fetchUserStakes(userAddress, contract = getReadContract()) {
  return contract.getAllUserStakings(userAddress);
}

export async function stake(signer, amount, rewardType, duration) {
  const tx = await getWriteContract(signer).stake(amount, rewardType, duration);
  return tx.wait();
}

export async function unstake(signer, stakingIndex) {
  const tx = await getWriteContract(signer).unstake(stakingIndex);
  return tx.wait();
}

export async function approveVdo(signer) {
  const contract = getVdoContract(signer);
  const tx = await contract.approve(STAKING_ADDRESS, ethers.MaxUint256);
  return tx.wait();
}

export async function checkAllowance(userAddress, signer) {
  const contract = getVdoContract(signer);
  const allowance = await contract.allowance(userAddress, STAKING_ADDRESS);
  return allowance > 0n;
}