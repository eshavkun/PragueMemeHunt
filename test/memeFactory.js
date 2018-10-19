const memeFactory = artifacts.require('./memeFactory.sol');

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

contract('memeFactory', async (accounts) => {
    let contract;  
    let _owner = accounts[0];
    let _collectors = [accounts[1], accounts[2]];
    let _doge = {loc: accounts[3], name: "Doge"};
    let _grumpy = {loc: accounts[4], name: "Grumpy Cat"};
    let _trollface = {loc: accounts[5], name: "Trollface"};
    const name = "MemeFactory test";
    const symbol = "MHNT";

    describe('Adding memes', () => {

        beforeEach(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});

        })

        it('Should allow adding new meme types to owner', async() => {
            await contract.addMemeType(_doge.name,_doge.loc,{from:_owner});
            const id = await contract.getMemeIdAtLocation(_doge.loc);
            assert.notEqual(id,0,"Meme is not found at location");
            const name = await contract.getMemeName(id);
            assert.equal(name,_doge.name,"Meme names do not match");
        })
        it('Should not allow adding new meme types to anyone except owner', async() => {
            await expectThrow(contract.addMemeType(_doge.name,_doge.loc,{from:_collectors[0]}));
        })
        it('Should not allow adding another meme to existing location', async() => {
            await contract.addMemeType(_doge.name,_doge.loc,{from:_owner});
            await expectThrow(contract.addMemeType(_grumpy.name,_doge.loc,{from:_owner}));
        })
    })

    describe('Collecting memes', () => {
        
        beforeEach(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});
            await contract.addMemeType(_doge.name,_doge.loc,{from:_owner});
            await contract.addMemeType(_grumpy.name,_grumpy.loc,{from:_owner});
        })
        
        it('Should allow collecting a meme given correct signature', async() => {
            let sig;

            sig = await signMemeClaim(_doge.loc, _collectors[0]); 
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});

            //Balance and ownership checks
            const balance = await contract.balanceOf(_collectors[0]);
            const collectedMemeId = await contract.getClaimedMemeAtLocation(_collectors[0], _doge.loc);
            const player = await contract.ownerOf(collectedMemeId);                         
            const collectedMemes = await contract.getMemesByOwner(_collectors[0]);
            const collectedMeme = await contract.getMemeDetails(collectedMemes);
            //console.log("Collected meme: " + collectedMeme);
            const collectedMemeName = await contract.getMemeName(collectedMeme[0]);
            
            assert.equal(balance, 1, "Player meme balance is not correct");
            assert.equal(player, _collectors[0], "Meme doesn't belong to player");
            assert.equal(collectedMemeName, _doge.name, "Player meme balance is not correct");                            
        })

        it('Should not allow collecting a meme without valid signature', async() => {
            let sig;

            sig = await signMemeClaim(_grumpy.loc, _collectors[1]);            
            await expectThrow(contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[1]})); //Using wrong location
            await expectThrow(contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[0]})); //Using wrong player (from)            
        })

        it('Should not allow collecting already collected meme', async() => {
            let sig;

            sig = await signMemeClaim(_grumpy.loc, _collectors[1]);
            await contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[1]});
            await expectThrow(contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[1]})); //Trying to collect from the same location            
        })

        it('Should allow collecting the same meme by different players', async() => {
            let sig;
            
            sig = await signMemeClaim(_doge.loc, _collectors[0]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});
            sig = await signMemeClaim(_doge.loc, _collectors[1]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[1]});
        })
    })

    describe('Redeeming swag', () => {
        beforeEach(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});
            await contract.addMemeType(_doge.name,_doge.loc,{from:_owner});
            sig = await signMemeClaim(_doge.loc, _collectors[0]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});
        })

        it('Should allow player to redeem a swag using their meme', async() => {
            await contract.redeemSwag(1, {from:_collectors[0]});
        })

        it('Should not allow player to redeem using already used meme', async() => {
            await contract.redeemSwag(1, {from:_collectors[0]});
            await expectThrow(contract.redeemSwag(1), {from:_collectors[0]});
        })

        it('Should not allow using meme ownned by other', async() => {
            await expectThrow(contract.redeemSwag(1), {from:_collectors[1]});
        })
    })
})

async function signMemeClaim(location, collector) {
    const h = web3.utils.soliditySha3(collector);
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