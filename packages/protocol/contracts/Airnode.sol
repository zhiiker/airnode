// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "./Convenience.sol";
import "./interfaces/IAirnode.sol";

/// @title The contract used to make and fulfill requests
/// @notice Clients use this contract to make requests and Airnodes use it to
/// fulfill them. In addition, it inherits from the contracts that keep records
/// or providers, requesters and templates. It also includes some convenience
/// methods that Airnodes use to reduce the number of calls they make to
/// blockchain providers.
contract Airnode is Convenience, IAirnode {
    mapping(bytes32 => bytes32) private requestIdToFulfillmentParameters;
    mapping(bytes32 => bool) public requestWithIdHasFailed;

    /// @dev Reverts if the incoming fulfillment parameters do not match the
    /// ones provided in the request
    /// @param requestId Request ID
    /// @param providerId Provider ID from ProviderStore
    /// @param fulfillAddress Address that will be called to fulfill
    /// @param fulfillFunctionId Signature of the function that will be called
    /// to fulfill
    modifier onlyCorrectFulfillmentParameters(
        bytes32 requestId,
        bytes32 providerId,
        address fulfillAddress,
        bytes4 fulfillFunctionId
        )
    {
        bytes32 incomingFulfillmentParameters = keccak256(abi.encodePacked(
            providerId,
            msg.sender,
            fulfillAddress,
            fulfillFunctionId
            ));
        require(
            incomingFulfillmentParameters == requestIdToFulfillmentParameters[requestId],
            "Incorrect fulfillment parameters"
            );
        _;
    }

    /// @notice Called by the client to make a regular request. A regular
    /// request refers to a template for the provider, endpoint and parameters.
    /// @param templateId Template ID from TemplateStore
    /// @param requesterIndex Requester index from RequesterStore
    /// @param designatedWallet Designated wallet that is requested to fulfill
    /// the request
    /// @param fulfillAddress Address that will be called to fulfill
    /// @param fulfillFunctionId Signature of the function that will be called
    /// to fulfill
    /// @param parameters Parameters provided by the client in addition to the
    /// parameters in the template.
    /// @return requestId Request ID
    function makeRequest(
        bytes32 templateId,
        uint256 requesterIndex,
        address designatedWallet,
        address fulfillAddress,
        bytes4 fulfillFunctionId,
        bytes calldata parameters
        )
        external
        override
        returns (bytes32 requestId)
    {
        require(
            requesterIndexToClientAddressToEndorsementStatus[requesterIndex][msg.sender],
            "Client not endorsed by requester"
            );
        uint256 clientNoRequests = clientAddressToNoRequests[msg.sender];
        requestId = keccak256(abi.encode(
            clientNoRequests,
            msg.sender,
            templateId,
            parameters
            ));
        bytes32 providerId = templates[templateId].providerId;
        requestIdToFulfillmentParameters[requestId] = keccak256(abi.encodePacked(
            providerId,
            designatedWallet,
            fulfillAddress,
            fulfillFunctionId
            ));
        emit ClientRequestCreated(
            providerId,
            requestId,
            clientNoRequests,
            msg.sender,
            templateId,
            requesterIndex,
            designatedWallet,
            fulfillAddress,
            fulfillFunctionId,
            parameters
        );
        clientAddressToNoRequests[msg.sender]++;
    }

    /// @notice Called by the client to make a full request. A full request
    /// provides all of its parameters as arguments and does not refer to a
    /// template.
    /// @param providerId Provider ID from ProviderStore
    /// @param endpointId Endpoint ID from EndpointStore
    /// @param requesterIndex Requester index from RequesterStore
    /// @param designatedWallet Designated wallet that is requested to fulfill
    /// the request
    /// @param fulfillAddress Address that will be called to fulfill
    /// @param fulfillFunctionId Signature of the function that will be called
    /// to fulfill
    /// @param parameters All request parameters
    /// @return requestId Request ID
    function makeFullRequest(
        bytes32 providerId,
        bytes32 endpointId,
        uint256 requesterIndex,
        address designatedWallet,
        address fulfillAddress,
        bytes4 fulfillFunctionId,
        bytes calldata parameters
        )
        external
        override
        returns (bytes32 requestId)
    {
        require(
            requesterIndexToClientAddressToEndorsementStatus[requesterIndex][msg.sender],
            "Client not endorsed by requester"
            );
        uint256 clientNoRequests = clientAddressToNoRequests[msg.sender];
        requestId = keccak256(abi.encode(
            clientNoRequests,
            msg.sender,
            endpointId,
            parameters
            ));
        requestIdToFulfillmentParameters[requestId] = keccak256(abi.encodePacked(
            providerId,
            designatedWallet,
            fulfillAddress,
            fulfillFunctionId
            ));
        emit ClientFullRequestCreated(
            providerId,
            requestId,
            clientNoRequests,
            msg.sender,
            endpointId,
            requesterIndex,
            designatedWallet,
            fulfillAddress,
            fulfillFunctionId,
            parameters
        );
        clientAddressToNoRequests[msg.sender]++;
    }

    /// @notice Called by Airnode to fulfill the request (regular or full)
    /// @dev `statusCode` being zero indicates a successful fulfillment, while
    /// non-zero values indicate error (the meanings of these values are
    /// implementation-dependent).
    /// The data is ABI-encoded as a `bytes` type, with its format depending on
    /// the request specifications.
    /// @param requestId Request ID
    /// @param providerId Provider ID from ProviderStore
    /// @param statusCode Status code of the fulfillment
    /// @param data Fulfillment data
    /// @param fulfillAddress Address that will be called to fulfill
    /// @param fulfillFunctionId Signature of the function that will be called
    /// to fulfill
    /// @return callSuccess If the fulfillment call succeeded
    /// @return callData Data returned by the fulfillment call (if there is
    /// any)
    function fulfill(
        bytes32 requestId,
        bytes32 providerId,
        uint256 statusCode,
        bytes calldata data,
        address fulfillAddress,
        bytes4 fulfillFunctionId
        )
        external
        override
        onlyCorrectFulfillmentParameters(
            requestId,
            providerId,
            fulfillAddress,
            fulfillFunctionId
            )
        returns(
            bool callSuccess,
            bytes memory callData
        )
    {
        delete requestIdToFulfillmentParameters[requestId];
        emit ClientRequestFulfilled(
            providerId,
            requestId,
            statusCode,
            data
            );
        (callSuccess, callData) = fulfillAddress.call(  // solhint-disable-line
            abi.encodeWithSelector(fulfillFunctionId, requestId, statusCode, data)
            );
    }

    /// @notice Called by Airnode if the request cannot be fulfilled
    /// @dev Airnode should fall back to this if a request cannot be fulfilled
    /// because fulfill() reverts
    /// @param requestId Request ID
    /// @param providerId Provider ID from ProviderStore
    /// @param fulfillAddress Address that will be called to fulfill
    /// @param fulfillFunctionId Signature of the function that will be called
    /// to fulfill
    function fail(
        bytes32 requestId,
        bytes32 providerId,
        address fulfillAddress,
        bytes4 fulfillFunctionId
        )
        external
        override
        onlyCorrectFulfillmentParameters(
            requestId,
            providerId,
            fulfillAddress,
            fulfillFunctionId
            )
    {
        delete requestIdToFulfillmentParameters[requestId];
        // Failure is recorded so that it can be checked externally
        requestWithIdHasFailed[requestId] = true;
        emit ClientRequestFailed(
            providerId,
            requestId
            );
    }
}
