// SPDX-License-Identifier: ISC
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*
An example of a simple Ponzi scheme. Play Ponzi on testnets, not in the
real world.

Any user can invest an arbitrary amount of ether using the payable deposit()
function and receive an equal number of tokens in return. Every midnight,
the number of tokens on the account of each user increases. The growth of
tokens is exponential, doubling every 32 days. At any time, tokens can be
exchanged for an equal amount of ether using the withdraw(amount) or
withdrawAll() functions. But this can only be done as long as there is a
sufficient amount of ether on the smart contract account, that is, as long as
other users contribute this ether.

In order not to recalculate all balances every midnight, the user's balance is
calculated when the function balanceOf(...) is called. That is, if the user
has 1 token, then after 32 days the balanceOf(...) function will return 2
tokens, after 64 days - 4 tokens. When depositing ether, the number of tokens
is converted to the time the contract was created. That is, when depositing 1
ether after 32 days after contract creation, the user will receive 0.5 internal
tokens. But since the internal token will cost 2 ether by this time, the
balanceOf(...) function will return the value of 1 token. The same conversions
are done in transfer(...), transferFrom(...) and totalSupply() functions.

No conversions are done in the approve(...) function. The permission to
transfer a token equal to 1 ether will remain the same regardless of the
elapsed time.

Problems:
1. Since the recalculation takes place at UTC midnight, if you deposit ether
before midnight, then immediately after midnight you can withdraw 2.19%
(= 2**(1/32) - 1) more ether. This allows you to extract ether from the smart
contract balance with almost no risk.
2. An overflow is possible in the convertToCurrentTime(amount) and
convertToInitialTime(amount) functions due to the lack of floating point
operations in Solidity. But this will require an extremely large amount
of ether.
3. The event logs record the number of internal tokens, since the logs cannot
change over time.
*/
contract Ponzi is ERC20("Ponzi Token", "PONZI") {
    // UTC midnight on the day the contract was created
    uint256 private _initTimestamp;

    constructor() {
        // Current timestamp modified to UTC midnight
        _initTimestamp = block.timestamp - (block.timestamp % 1 days);
    }

    // Deposit ether and mint Ponzi tokens
    function deposit() external payable returns (bool) {
        uint256 amount0 = convertToInitialTime(msg.value);
        _mint(msg.sender, amount0);
        return true;
    }

    // Burn Ponzi tokens and return ether
    function withdraw(uint256 amount) external returns (bool) {
        uint256 amount0 = convertToInitialTime(amount);
        _burn(msg.sender, amount0);
        require(
            amount <= address(this).balance,
            "Sorry, you lost the Ponzi game"
        );
        payable(msg.sender).transfer(amount);
        return true;
    }

    // Burn all Ponzi tokens and return ether
    function withdrawAll() external returns (bool) {
        uint256 amount0 = internalBalanceOf(msg.sender);
        uint256 amount = convertToCurrentTime(amount0);
        _burn(msg.sender, amount0);
        require(
            amount <= address(this).balance,
            "Sorry, you lost the Ponzi game"
        );
        payable(msg.sender).transfer(amount);
        return true;
    }

    // Returns balance converted to current time
    function balanceOf(
        address addr
    ) public view virtual override returns (uint256) {
        return convertToCurrentTime(super.balanceOf(addr));
    }

    // Returns internal tokens balance
    function internalBalanceOf(address addr) public view returns (uint256) {
        return super.balanceOf(addr);
    }

    // Total supply converted to current time
    function totalSupply() public view virtual override returns (uint256) {
        return convertToCurrentTime(super.totalSupply());
    }

    // Standard transfer
    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 amount0 = convertToInitialTime(amount);
        _transfer(msg.sender, to, amount0);
        return true;
    }

    // Standard transferFrom
    // (tokens are scaled, approved amount is not scaled)
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 amount0 = convertToInitialTime(amount);
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount0);
        return true;
    }

    // Converts internal tokens to their current value
    function convertToCurrentTime(
        uint256 amount
    ) internal view returns (uint256) {
        // Should always be true in the correct blockchain
        //require(block.timestamp >= _initTimestamp);

        // No computation required for zero value
        if (amount == 0) return 0;

        // Time passed after contract creation
        uint256 dt = block.timestamp - _initTimestamp;

        // Increase by a power of 2 for each of the 32 days passed
        amount = amount * (2 ** (dt / 32 days));
        dt = dt % 32 days;

        // Solidity floating point computations
        if (dt >= 16 days) {
            // amount *= 2**(16/32)
            amount = (amount * 1414213562373095168) / 1000000000000000000;
            dt -= 16 days;
        }
        if (dt >= 8 days) {
            // amount *= 2**(8/32)
            amount = (amount * 1189207115002721024) / 1000000000000000000;
            dt -= 8 days;
        }
        if (dt >= 4 days) {
            // amount *= 2**(4/32)
            amount = (amount * 1090507732665257728) / 1000000000000000000;
            dt -= 4 days;
        }
        if (dt >= 2 days) {
            // amount *= 2**(2/32)
            amount = (amount * 1044273782427413760) / 1000000000000000000;
            dt -= 2 days;
        }
        if (dt >= 1 days) {
            // amount *= 2**(1/32)
            amount = (amount * 1021897148654116608) / 1000000000000000000;
        }
        return amount;
    }

    // Converts the value of tokens at the current moment to the value of
    // internal tokens at the time of the creation of the contract
    function convertToInitialTime(
        uint256 amount
    ) internal view returns (uint256) {
        // Should always be true in the correct blockchain
        //require(block.timestamp >= _initTimestamp);

        // No computation required for zero value
        if (amount == 0) return 0;

        // Time passed after contract creation
        uint256 dt = block.timestamp - _initTimestamp;

        // Decrease by a power of 2 for each of the 32 days passed
        amount = amount / (2 ** (dt / 32 days));
        dt = dt % 32 days;

        // Solidity floating point computations
        if (dt >= 16 days) {
            amount = (amount * 1000000000000000000) / 1414213562373095168;
            dt -= 16 days;
        }
        if (dt >= 8 days) {
            amount = (amount * 1000000000000000000) / 1189207115002721024;
            dt -= 8 days;
        }
        if (dt >= 4 days) {
            amount = (amount * 1000000000000000000) / 1090507732665257728;
            dt -= 4 days;
        }
        if (dt >= 2 days) {
            amount = (amount * 1000000000000000000) / 1044273782427413760;
            dt -= 2 days;
        }
        if (dt >= 1 days) {
            amount = (amount * 1000000000000000000) / 1021897148654116608;
        }
        return amount;
    }
}
