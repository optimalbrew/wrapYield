// deploy all contracts
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.30;

import "../lib/forge-std/src/Script.sol";
import "../src/WETH.sol";
import "../src/EtherSwap.sol";
import "../src/MyVault.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        WETH weth = new WETH();
        console.log("Deployed WETH: ", address(weth));
        EtherSwap etherSwap = new EtherSwap();
        console.log("Deployed EtherSwap: ", address(etherSwap));
        // Deploy MyVault contract
        MyVault myVault = new MyVault(weth);
        // Log the address of the deployed MyVault contract
        console.log("Deployed MyVault: ", address(myVault));

        vm.stopBroadcast();
    }
}