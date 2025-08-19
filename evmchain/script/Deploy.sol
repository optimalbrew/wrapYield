// deploy all contracts
// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.30;

import "../lib/forge-std/src/Script.sol";
import "../src/WETH.sol";
import "../src/EtherSwap.sol";
import "../src/MyVault.sol";
import "../src/BtcCollateralLoan.sol";
import "../src/LoanFactory.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        
        // Deploy WETH contract
        //WETH weth = new WETH();
        //console.log("Deployed WETH: ", address(weth));

        // Deploy MyVault contract
        //MyVault myVault = new MyVault(weth);
        //console.log("Deployed MyVault: ", address(myVault));

        // Deploy LoanFactory contract
        LoanFactory loanFactory = new LoanFactory();
        console.log("Deployed LoanFactory: ", address(loanFactory));

        // Deploy EtherSwap contract
        //EtherSwap etherSwap = new EtherSwap(address(loanFactory));
        //console.log("Deployed EtherSwap: ", address(etherSwap));

        // Valid BTC Schnorr public key (32 characters) - this is a placeholder for testing
        // In production, this would be the actual lender's Bitcoin public key
        // The contract expects exactly 32 characters as a string
        string memory lenderBtcPubkey = "12345678901234567890123456789012";
        
        // Deploy BtcCollateralLoan contract using factory
        (address etherSwapAddress, address loanAddress) = loanFactory.deployContracts(
            lenderBtcPubkey, // lenderBtcPubkey (32 bytes)
            3000*180, // loanDuration (6 months on Rootstock: 3000 blocks per day * 180 days)
            100, // timelockLoanReq (t_B: 100 blocks)
            200, // timelockBtcEscrow (t_0: 200 blocks, must be > t_B)
            150, // timelockRepaymentAccept (t_L: 150 blocks)
            250  // timelockBtcCollateral (t_1: 250 blocks, must be > t_L)
        );
        
        console.log("Deployed EtherSwap through factory: ", etherSwapAddress);
        console.log("Deployed BtcCollateralLoan through factory: ", loanAddress);

        // Print the addresses to the console for the frontend to use e.g. Wagmi dapp environment variables
        console.log("NEXT_PUBLIC_LOAN_FACTORY_ADDRESS=", address(loanFactory));
        console.log("NEXT_PUBLIC_ETHER_SWAP_ADDRESS=",address (etherSwapAddress));
        console.log("NEXT_PUBLIC_BTC_COLLATERAL_LOAN_ADDRESS=", address(loanAddress));

        vm.stopBroadcast();
    }
}
