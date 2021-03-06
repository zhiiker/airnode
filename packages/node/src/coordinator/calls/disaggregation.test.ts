import * as fixtures from 'test/fixtures';
import * as coordinatorState from '../state';
import * as providerState from '../../providers/state';
import * as disaggregation from './disaggregation';
import { GroupedRequests, RequestErrorCode, RequestStatus } from 'src/types';

describe('disaggregate - ClientRequests', () => {
  it('maps aggregated responses back to requests for each provider', () => {
    const requests: GroupedRequests = {
      apiCalls: [fixtures.requests.buildApiCall()],
      withdrawals: [],
    };

    let provider0 = fixtures.buildEVMProviderState();
    let provider1 = fixtures.buildEVMProviderState();
    let provider2 = fixtures.buildEVMProviderState();

    provider0 = providerState.update(provider0, { requests });
    provider1 = providerState.update(provider1, { requests });
    provider2 = providerState.update(provider2, { requests });

    const aggregatedApiCall = fixtures.createAggregatedApiCall({
      responseValue: '0x00000000000000000000000000000000000000000000000000000000000001b9',
    });
    const aggregatedApiCallsById = { apiCallId: aggregatedApiCall };

    const config = fixtures.buildConfig();
    let state = coordinatorState.create(config);
    state = coordinatorState.update(state, { aggregatedApiCallsById, EVMProviders: [provider0, provider1, provider2] });

    const [logs, res] = disaggregation.disaggregate(state);
    expect(logs).toEqual([]);
    expect(res[0].requests.apiCalls[0].responseValue).toEqual(
      '0x00000000000000000000000000000000000000000000000000000000000001b9'
    );
    expect(res[1].requests.apiCalls[0].responseValue).toEqual(
      '0x00000000000000000000000000000000000000000000000000000000000001b9'
    );
    expect(res[2].requests.apiCalls[0].responseValue).toEqual(
      '0x00000000000000000000000000000000000000000000000000000000000001b9'
    );
  });

  it('does not update the request if the parameters are different', () => {
    const requests0: GroupedRequests = {
      apiCalls: [fixtures.requests.buildApiCall({ id: 'ethCall', parameters: { from: 'ETH' } })],
      withdrawals: [],
    };
    const requests1: GroupedRequests = {
      apiCalls: [fixtures.requests.buildApiCall({ id: 'btcCall', parameters: { from: 'BTC' } })],
      withdrawals: [],
    };

    let provider0 = fixtures.buildEVMProviderState();
    let provider1 = fixtures.buildEVMProviderState();

    provider0 = providerState.update(provider0, { requests: requests0 });
    provider1 = providerState.update(provider1, { requests: requests1 });

    const aggregatedApiCall = fixtures.createAggregatedApiCall({
      id: 'btcCall',
      parameters: { from: 'BTC' },
      responseValue: '0x123',
    });
    const aggregatedApiCallsById = { btcCall: aggregatedApiCall };

    const config = fixtures.buildConfig();
    let state = coordinatorState.create(config);
    state = coordinatorState.update(state, { aggregatedApiCallsById, EVMProviders: [provider0, provider1] });

    const [logs, res] = disaggregation.disaggregate(state);
    expect(logs).toEqual([
      { level: 'ERROR', message: 'Unable to find matching aggregated API calls for Request:ethCall' },
    ]);
    expect(res[0].requests.apiCalls[0].responseValue).toEqual(undefined);
    expect(res[0].requests.apiCalls[0].status).toEqual(RequestStatus.Blocked);
    expect(res[0].requests.apiCalls[0].errorCode).toEqual(RequestErrorCode.NoMatchingAggregatedCall);
    expect(res[1].requests.apiCalls[0].responseValue).toEqual('0x123');
    expect(res[1].requests.apiCalls[0].status).toEqual(RequestStatus.Pending);
    expect(res[1].requests.apiCalls[0].errorCode).toEqual(undefined);
  });
});
