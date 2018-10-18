var memeFactory = artifacts.require("./memeFactory.sol");

module.exports = function(deployer) {
  deployer.deploy(memeFactory, "Meme test", "MEM");
};
