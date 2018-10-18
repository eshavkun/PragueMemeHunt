const memeFactory = artifacts.require('./memeFactory.sol');

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

contract('memeFactory', async (accounts) => {
    let contract;  
    let _owner = accounts[0];
    let _player1 = accounts[1];
    let _player2 = accounts[2];
    let _players = [accounts[1], accounts[2]];
    let _location1 = accounts[3];
    let _location2 = accounts[4];
    let _location3 = accounts[5];
    let _locations = [accounts[3], accounts[4], accounts[5]];
    const name = "MemeFactory test";
    const symbol = "MHNT";
    const memes = ["Meme1","Meme2"];

    describe('Adding memes', () => {

        beforeEach(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});

        })

        it('Should allow adding new meme types to owner', async() => {
            await contract.addMemeType(memes[0],_location1,{from:_owner});
            const id = await contract.getMemeIdAtLocation(_location1);
            assert.notEqual(id,0,"Meme is not found at location");
            const name = await contract.getMemeName(id);
            assert.equal(name,memes[0],"Meme names do not match");
        })
        it('Should not allow adding new meme types to anyone except owner', async() => {
            await expectThrow(contract.addMemeType(memes[0],_location1,{from:_player1}));
        })
        it('Should not allow adding another meme to existing location', async() => {
            await contract.addMemeType(memes[0],_location1,{from:_owner});
            await expectThrow(contract.addMemeType(memes[1],_location1,{from:_owner}));
        })
    })

    describe('Collecting memes', () => {
        
        beforeEach(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});
            await contract.addMemeType(memes[0],_location1,{from:_owner});
            await contract.addMemeType(memes[1],_location2,{from:_owner});
        })
        
        it('Should allow collecting a meme given correct signature', async() => {
            const h = web3.utils.soliditySha3(_player1);
            let sig = await web3.eth.sign(h, _location1);
            sig = sig.slice(2);
            const r = `0x${sig.slice(0, 64)}`;
            const s = `0x${sig.slice(64, 128)}`;
            const v = web3.utils.toDecimal(sig.slice(128, 130)) + 27;

            await contract.claimMeme(_location1,v,r,s,{from:_player1});

            //Balance and ownership checks
            const balance = await contract.balanceOf(_player1);
            const collectedMemeId = await contract.getClaimedMemeAtLocation(_player1, _location1);
            const player = await contract.ownerOf(collectedMemeId);                         
            const collectedMemes = await contract.getMemesByOwner(_player1);
            const collectedMeme = await contract.getMemeDetails(collectedMemes[0]);
            console.log("Collected meme: " + collectedMeme);
            const collectedMemeName = await contract.getMemeName(collectedMeme[0]);
            
            assert.equal(balance, 1, "Player meme balance is not correct");
            assert.equal(player, _player1, "Meme doesn't belong to player");
            assert.equal(collectedMemeName, memes[0], "Player meme balance is not correct");                            
        })

        it('Should not allow collecting a meme without valid signature', async() => {
            const h = web3.utils.soliditySha3(_player2);
            let sig = await web3.eth.sign(h, _location2);
            sig = sig.slice(2);
            const r = `0x${sig.slice(0, 64)}`;
            const s = `0x${sig.slice(64, 128)}`;
            const v = web3.utils.toDecimal(sig.slice(128, 130)) + 27;

            await expectThrow(contract.claimMeme(_location1,v,r,s,{from:_player2})); //Using wrong location
            await expectThrow(contract.claimMeme(_location2,v,r,s,{from:_player1})); //Using wrong player (from)            
        })

        it('Should not allow collecting already collected meme', async() => {
            const h = web3.utils.soliditySha3(_player2);
            let sig = await web3.eth.sign(h, _location2);
            sig = sig.slice(2);
            const r = `0x${sig.slice(0, 64)}`;
            const s = `0x${sig.slice(64, 128)}`;
            const v = web3.utils.toDecimal(sig.slice(128, 130)) + 27;

            await contract.claimMeme(_location2,v,r,s,{from:_player2});
            await expectThrow(contract.claimMeme(_location2,v,r,s,{from:_player2})); //Trying to collect from the same location            
        })

        it('Should allow collecting the same meme by different players', async() => {
            let sig;
            
            sig = await signMemeClaim(_locations[0], _players[0]);
            await contract.claimMeme(_locations[0],sig.v,sig.r,sig.s,{from:_players[0]});
            sig = await signMemeClaim(_locations[0], _players[1]);
            await contract.claimMeme(_locations[0],sig.v,sig.r,sig.s,{from:_players[1]});
        })
    })

    describe('Redeeming swag', () => {
        beforeEach(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});
            await contract.addMemeType(memes[0],_locations[0],{from:_owner});
            sig = await signMemeClaim(_locations[0], _players[0]);
            await contract.claimMeme(_locations[0],sig.v,sig.r,sig.s,{from:_players[0]});
        })

        it('Should allow player to redeem a swag using their meme', async() => {
            await contract.redeemSwag(1, {from:_players[0]});
        })

        it('Should not allow player to redeem using already used meme', async() => {
            await contract.redeemSwag(1, {from:_players[0]});
            await expectThrow(contract.redeemSwag(1), {from:_players[0]});
        })

        it('Should not allow using meme ownned by other', async() => {
            await expectThrow(contract.redeemSwag(1), {from:_players[1]});
        })
    })
})

async function signMemeClaim(location, player) {
    const h = web3.utils.soliditySha3(player);
    let sig = await web3.eth.sign(h, location);
    sig = sig.slice(2);
    const r = `0x${sig.slice(0, 64)}`;
    const s = `0x${sig.slice(64, 128)}`;
    const v = web3.utils.toDecimal(sig.slice(128, 130)) + 27;

    return {
        v:v,
        r:r,
        s:s
    };
}

async function expectThrow(promise) {
    const errMsg = 'Expected throw not received';
    try {
        await promise;
    } catch (err) {
        assert(err.toString().includes('revert'), errMsg);
        return;
    }

    assert(false, errMsg);
}