import { ethers } from 'ethers';
import * as contracts from '../contracts';
import * as fixtures from 'test/fixtures';
import * as apiCalls from './api-calls';
import { EVMEventLogWithMetadata, RequestErrorCode, RequestStatus } from 'src/types';

describe('initialize (ApiCall)', () => {
  it('builds a new ApiCall request', () => {
    const event = fixtures.evm.buildClientRequest();
    const airnodeInterface = new ethers.utils.Interface(contracts.Airnode.ABI);
    const parsedLog = airnodeInterface.parseLog(event);
    const parsedLogWithMetadata = {
      parsedLog,
      blockNumber: 10716082,
      currentBlock: 10716085,
      ignoreBlockedRequestsAfterBlocks: 20,
      transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
    };
    expect(apiCalls.initialize(parsedLogWithMetadata)).toEqual({
      clientAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      designatedWallet: '0x3580C27eDAafdb494973410B794f3F07fFAEa5E5',
      endpointId: null,
      fulfillAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      fulfillFunctionId: '0xd3bd1464',
      encodedParameters:
        '0x316200000000000000000000000000000000000000000000000000000000000066726f6d000000000000000000000000000000000000000000000000000000004554480000000000000000000000000000000000000000000000000000000000',
      id: '0xca83cf24dc881ae41b79ee66ed11f7f09d235bd801891b1223a3cceb753ec3d5',
      metadata: {
        blockNumber: 10716082,
        currentBlock: 10716085,
        ignoreBlockedRequestsAfterBlocks: 20,
        transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
      },
      parameters: {},
      providerId: '0x9e5a89de5a7e780b9eb5a61425a3a656f0c891ac4c56c07037d257724af490c9',
      requestCount: '1',
      requesterIndex: '2',
      status: RequestStatus.Pending,
      templateId: '0x3576f03d33eb6dd0c6305509117a9501a938aab52bb466a21fe536c1e37511b4',
      type: 'regular',
    });
  });

  it('sets the API call type', () => {
    const event = fixtures.evm.buildClientRequest();
    const airnodeInterface = new ethers.utils.Interface(contracts.Airnode.ABI);
    const parsedLog = airnodeInterface.parseLog(event);
    const base = {
      parsedLog,
      blockNumber: 10716082,
      currentBlock: 10716085,
      ignoreBlockedRequestsAfterBlocks: 20,
      transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
    };
    const short = {
      ...base,
      parsedLog: { ...base.parsedLog, topic: '0xfcbcd5adb2d26ecd4ad50e6267e977fd479fcd0a6c82bde8eea85290ab3b46e6' },
    };
    const regular = {
      ...base,
      parsedLog: { ...short.parsedLog, topic: '0xaff6f5e5548953a11cbb1cfdd76562512f969b0eba0a2163f2420630d4dda97b' },
    };
    const full = {
      ...base,
      parsedLog: { ...short.parsedLog, topic: '0x775e78a8e7375d14ad03d31edd0a27b29a055f732bca987abfe8082c16ed7e44' },
    };

    expect(apiCalls.initialize(short).type).toEqual('short');
    expect(apiCalls.initialize(regular).type).toEqual('regular');
    expect(apiCalls.initialize(full).type).toEqual('full');
  });
});

describe('applyParameters', () => {
  let parsedLogWithMetadata: EVMEventLogWithMetadata;

  beforeEach(() => {
    const event = fixtures.evm.buildShortRequest();
    const airnodeInterface = new ethers.utils.Interface(contracts.Airnode.ABI);
    const parsedLog = airnodeInterface.parseLog(event);
    parsedLogWithMetadata = {
      parsedLog,
      blockNumber: 10716082,
      currentBlock: 10716085,
      ignoreBlockedRequestsAfterBlocks: 20,
      transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
    };
  });

  it('does nothing if encodedParameters is falsey', () => {
    const request = apiCalls.initialize(parsedLogWithMetadata);
    expect(request.parameters).toEqual({});
    const withEncodedParams = { ...request, encodedParameters: '' };
    const [logs, withDecodedParameters] = apiCalls.applyParameters(withEncodedParams);
    expect(logs).toEqual([]);
    expect(withDecodedParameters).toEqual(withEncodedParams);
  });

  it('decodes and adds the parameters to the request', () => {
    const request = apiCalls.initialize(parsedLogWithMetadata);
    expect(request.parameters).toEqual({});
    const [logs, withDecodedParameters] = apiCalls.applyParameters(request);
    expect(logs).toEqual([]);
    expect(withDecodedParameters).toEqual({ ...request, parameters: { from: 'ETH' } });
  });

  it('sets the request to errored if the parameters cannot be decoded', () => {
    const request = apiCalls.initialize(parsedLogWithMetadata);
    expect(request.parameters).toEqual({});
    const withEncodedParams = { ...request, encodedParameters: '0xincorrectparameters' };
    const [logs, withDecodedParameters] = apiCalls.applyParameters(withEncodedParams);
    expect(logs).toEqual([
      {
        level: 'ERROR',
        message: `Request ID:${request.id} submitted with invalid parameters: 0xincorrectparameters`,
      },
    ]);
    expect(withDecodedParameters).toEqual({
      ...withEncodedParams,
      status: RequestStatus.Errored,
      errorCode: RequestErrorCode.RequestParameterDecodingFailed,
    });
  });
});

describe('updateFulfilledRequests (ApiCall)', () => {
  it('updates the status of fulfilled API calls', () => {
    const id = '0xca83cf24dc881ae41b79ee66ed11f7f09d235bd801891b1223a3cceb753ec3d5';
    const apiCall = fixtures.requests.createApiCall({ id });
    const [logs, requests] = apiCalls.updateFulfilledRequests([apiCall], [id]);
    expect(logs).toEqual([
      {
        level: 'DEBUG',
        message: `Request ID:${id} (API call) has already been fulfilled`,
      },
    ]);
    expect(requests).toEqual([
      {
        id,
        clientAddress: 'clientAddress',
        designatedWallet: 'designatedWallet',
        endpointId: 'endpointId',
        fulfillAddress: 'fulfillAddress',
        fulfillFunctionId: 'fulfillFunctionId',
        encodedParameters: 'encodedParameters',
        metadata: {
          blockNumber: 10716082,
          currentBlock: 10716090,
          ignoreBlockedRequestsAfterBlocks: 20,
          transactionHash: 'logTransactionHash',
        },
        parameters: { from: 'ETH' },
        providerId: 'providerId',
        requestCount: '12',
        requesterIndex: '3',
        status: 'Fulfilled',
        templateId: null,
        type: 'regular',
      },
    ]);
  });

  it('returns the request if it is not fulfilled', () => {
    const apiCall = fixtures.requests.createApiCall();
    const [logs, requests] = apiCalls.updateFulfilledRequests([apiCall], []);
    expect(logs).toEqual([]);
    expect(requests).toEqual([apiCall]);
  });
});

describe('mapRequests (ApiCall)', () => {
  it('initializes, applies parameters and returns API call requests', () => {
    const event = fixtures.evm.buildShortRequest();
    const airnodeInterface = new ethers.utils.Interface(contracts.Airnode.ABI);
    const parsedLog = airnodeInterface.parseLog(event);
    const parsedLogWithMetadata = {
      parsedLog,
      blockNumber: 10716082,
      currentBlock: 10716085,
      ignoreBlockedRequestsAfterBlocks: 20,
      transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
    };
    const [logs, res] = apiCalls.mapRequests([parsedLogWithMetadata]);
    expect(logs).toEqual([]);
    expect(res).toEqual([
      {
        clientAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        designatedWallet: null,
        endpointId: null,
        fulfillAddress: null,
        fulfillFunctionId: null,
        encodedParameters:
          '0x316200000000000000000000000000000000000000000000000000000000000066726f6d000000000000000000000000000000000000000000000000000000004554480000000000000000000000000000000000000000000000000000000000',
        id: '0xca7a8ca59129647699cc998215b325f8c535bbe5378f42097e408eaafbec2216',
        metadata: {
          blockNumber: 10716082,
          currentBlock: 10716085,
          ignoreBlockedRequestsAfterBlocks: 20,
          transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
        },
        parameters: { from: 'ETH' },
        providerId: '0x9e5a89de5a7e780b9eb5a61425a3a656f0c891ac4c56c07037d257724af490c9',
        requestCount: '0',
        requesterIndex: null,
        status: RequestStatus.Pending,
        templateId: '0x3576f03d33eb6dd0c6305509117a9501a938aab52bb466a21fe536c1e37511b4',
        type: 'short',
      },
    ]);
  });

  it('updates the status of fulfilled ApiCall requests', () => {
    const requestEvent = fixtures.evm.buildClientRequest();
    const fulfillEvent = fixtures.evm.buildClientRequestFulfilled();
    const airnodeInterface = new ethers.utils.Interface(contracts.Airnode.ABI);
    const requestLog = airnodeInterface.parseLog(requestEvent);
    const fulfillLog = airnodeInterface.parseLog(fulfillEvent);

    const requestLogWithMetadata = {
      parsedLog: requestLog,
      blockNumber: 10716082,
      currentBlock: 10716085,
      ignoreBlockedRequestsAfterBlocks: 20,
      transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
    };
    const fulfillLogWithMetadata = {
      parsedLog: fulfillLog,
      blockNumber: 10716084,
      currentBlock: 10716087,
      ignoreBlockedRequestsAfterBlocks: 20,
      transactionHash: '0x61c972d98485da38115a5730b6741ffc4f3e09ae5e1df39a7ff18a68777ab318',
    };

    const [logs, requests] = apiCalls.mapRequests([requestLogWithMetadata, fulfillLogWithMetadata]);
    expect(logs).toEqual([
      {
        level: 'DEBUG',
        message: `Request ID:${requestLog.args.requestId} (API call) has already been fulfilled`,
      },
    ]);
    expect(requests.length).toEqual(1);
    expect(requests[0].id).toEqual(requestLog.args.requestId);
    expect(requests[0].status).toEqual(RequestStatus.Fulfilled);
  });
});
