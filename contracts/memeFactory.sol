pragma solidity ^0.4.24;

import "./openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";

//import "github.com/OpenZeppelin/openzeppelin-solidity/contracts/ownership/Ownable.sol";
//import "github.com/OpenZeppelin/openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

contract memeFactory is Ownable, ERC721Full{
  constructor(string _name, string _symbol) ERC721Full(_name, _symbol) Ownable()
    public
  {
  }
 
  struct Meme {
    uint typeId;
    uint geneCode; //for possible unique modifications (colores, clothes etc.). Generated from original owner address + location + meme name
    bool swagRedeemed; //if meme was used to redeem swag or price; if true meme shouldn't be tradable/redeemable anymore
  }

  ///@dev To be refactored! Structure for possible meme pairs to get 3rd meme. Not used yet
  struct MemePair {
    uint sourceType1;
    uint sourceType2;
    uint targetType;
  }
  
  ///@dev Mapping of location to meme type
  mapping (address=>uint) internal memeLocation;
  ///@dev Mapping of players to collected memes
  mapping (address=>mapping(address=>uint)) internal collectedMemes;

  string[] private memeTypes;
  Meme[] internal memes;
  MemePair[] internal memePairs; //not used yet

  event MemeAdded(uint id, string name, address location);
  event MemeLocationChanged(uint id, address oldLocation, address newLocation);
  event MemeClaimed(uint memeType, uint geneCode, address owner, address location);
  event SwagRedeemed(uint memeId);

  ///@dev Log events for debugging
  event LogBytes32(string message, bytes32 value);
  event LogString(string message, string value);
  event LogAddress(string message, address value);
  event LogInt(string message, uint value);

  function addMemeType(string _name, address _location) public onlyOwner {
    require(_location != address(0));
    require(memeLocation[_location] == 0, "Location already has a meme registered to it");
    
    uint id = memeTypes.push(_name);
    memeLocation[_location] = id;
    emit MemeAdded(id, _name, _location);
  }

  function changeMemeLocation(uint _id, address _oldLocation, address _newLocation) public onlyOwner {
    require(memeLocation[_oldLocation] == _id, "Meme is not found at provided location");
    require(_newLocation != address(0));
    require(memeLocation[_newLocation] == 0, "New location already has a meme registered to it");
    
    memeLocation[_oldLocation] = 0;
    memeLocation[_newLocation] = _id;
    emit MemeLocationChanged(_id, _oldLocation, _newLocation);
  }

  function getMemeIdAtLocation(address _location) external view returns(uint) {
    return memeLocation[_location];
  }

  function getMemeName(uint _id) external view returns(string) {
    return memeTypes[_id - 1];
  }

  function getClaimedMemeAtLocation(address _owner, address _location) external view returns(uint) {
    return collectedMemes[_owner][_location];
  }

  function getMemesByOwner(address _owner) external view returns(uint[]) {
    require (_owner != address(0));

    uint[] memory result = new uint[](balanceOf(_owner));

    uint counter = 0;
    for (uint i = 1; i <= memes.length; i++) {
      if (ownerOf(i) == _owner) {
        result[counter] = i;
        counter++;
      }
    }

    return result;
  }

  function getRedeemableMemesByOwner(address _owner) external view returns(uint[]) {
    require (_owner != address(0));

    uint[] memory result = new uint[](balanceOf(_owner));

    uint counter = 0;
    for (uint i = 1; i <= memes.length; i++) {
      if (ownerOf(i) == _owner && memes[i-1].swagRedeemed == false) {
        result[counter] = i;
        counter++;
      }
    }

    uint[] memory trimmedResult = new uint[](counter);
    for (uint j = 0; j < trimmedResult.length; j++) {
      trimmedResult[j] = result[j];
    }

    return trimmedResult;
  }
  
  function getMemeDetails(uint _id) external view returns(uint,uint,bool) {
    Meme memory m = memes[_id - 1];

    return (m.typeId, m.geneCode, m.swagRedeemed);
  }

  function claimMeme(address _location, uint8 _v, bytes32 _r, bytes32 _s) public {
    require(memeLocation[_location] != 0, "There is not meme at location");
    require(collectedMemes[msg.sender][_location] == 0, "Meme is already collected");

    bytes32 hashedSender = keccak256(abi.encodePacked(msg.sender));
    bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",hashedSender));
    require(ecrecover(prefixedHash,_v,_r,_s) == _location, "Signature is not recognized");

    uint geneCode = _generateGeneCode(msg.sender, _location);
    uint id = memes.push(Meme(memeLocation[_location], geneCode, false));
    _addTokenTo(msg.sender, id);
    collectedMemes[msg.sender][_location] = id;
    emit MemeClaimed(memeLocation[_location], geneCode, msg.sender, _location);
  }


  
  function redeemSwag(uint _id) public {
    require(ownerOf(_id) == msg.sender, "Token doesn't belong to sender");
    require(memes[_id-1].swagRedeemed == false, "The swag is already redeemed");

    memes[_id].swagRedeemed = true;
    emit SwagRedeemed(_id);
  }

  function _generateGeneCode(address _owner, address _location) internal view returns(uint){
    string memory name = memeTypes[memeLocation[_location] - 1];
    uint code = uint(keccak256(abi.encodePacked(_owner, _location, name)));

    return code % (10 ** 8);
  }
}