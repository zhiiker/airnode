import * as ethereum from './ethereum';
import * as state from './state';
import { go } from './utils/promise-utils';
import * as logger from './utils/logger';

export async function main() {
  // =========================================================
  // STEP 1: Create a fresh state
  // =========================================================
  const state1 = await state.initialize();

  // =========================================================
  // STEP 2: Get the expected gas price to use when making
  // transactions
  // =========================================================
  const gasPrice = await ethereum.getGasPrice(state1);
  logger.logJSON('INFO', `Gas price set to ${ethereum.weiToGwei(gasPrice)} Gwei`);
  const state2 = state.update(state1, { gasPrice });

  // =========================================================
  // STEP 3: Get the current block
  //
  // NOTE: This should ideally be done as late as possible in
  // case the block increments during a previous step
  // =========================================================
  const [blockErr, currentBlock] = await go(state2.provider.getBlockNumber());
  if (blockErr || !currentBlock) {
    // TODO: Provider calls should retry on failure (issue #11)
    throw new Error(`Unable to get current block. ${blockErr}`);
  }
  logger.logJSON('INFO', `Using Block ${currentBlock} as the latest block`);
  const state3 = state.update(state2, { currentBlock });

  // =========================================================
  // STEP 4: Detect new flux requests that need to be processed
  // =========================================================
  // TODO: enable this and assign to the state somewhere
  // fluxAggregator.detectEvents(state3, specs);

  return [state3];
}