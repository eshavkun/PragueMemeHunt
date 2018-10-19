const memeFactory = artifacts.require('./memeFactory.sol');

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

contract('memeFactory', async (accounts) => {
    let contract;  
    const _owner = accounts[0];
    const _collectors = [accounts[1], accounts[2]];
    const _doge = {loc: accounts[3], name: "Doge"};
    const _grumpy = {loc: accounts[4], name: "Grumpy Cat"};
    const _trollface = {loc: accounts[5], name: "Trollface"};
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
            const collectedMeme = await contract.getMemeDetails(collectedMemes[0]);
            //console.log("Collected meme: " + collectedMeme);
            
            assert.equal(balance, 1, "Player meme balance is not correct");
            assert.equal(player, _collectors[0], "Meme doesn't belong to player");                         
        })

        it('Should not allow collecting a meme without valid signature', async() => {
            let sig;

            sig = await signMemeClaim(_grumpy.loc, _collectors[1]);            
            await expectThrow(contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[1]})); //Using wrong location
            await expectThrow(contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[0]})); //Using wrong player (from)
            
            const balances = [
                await contract.balanceOf(_collectors[0]),
                await contract.balanceOf(_collectors[1])
            ];
            assert.equal(balances[0], 0, "Player meme balance is not correct");
            assert.equal(balances[1], 0, "Player meme balance is not correct");
        })

        it('Should not allow collecting already collected meme', async() => {
            let sig;

            sig = await signMemeClaim(_grumpy.loc, _collectors[1]);
            await contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[1]});
            await expectThrow(contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[1]})); //Trying to collect from the same location
            
            const balance = await contract.balanceOf(_collectors[1]);
            assert.equal(balance, 1, "Player meme balance is not correct");
        })

        it('Should allow collecting the same meme by different players', async() => {
            let sig;
            
            sig = await signMemeClaim(_doge.loc, _collectors[0]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});
            sig = await signMemeClaim(_doge.loc, _collectors[1]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[1]});

            const balances = [
                await contract.balanceOf(_collectors[0]),
                await contract.balanceOf(_collectors[1])
            ];
            assert.equal(balances[0], 1, "Player meme balance is not correct");
            assert.equal(balances[1], 1, "Player meme balance is not correct");
        })

        it('Should allow collecting different memes by the same player', async() => {
            let sig;
            
            sig = await signMemeClaim(_doge.loc, _collectors[0]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});
            sig = await signMemeClaim(_grumpy.loc, _collectors[0]);
            await contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});

            const balance = await contract.balanceOf(_collectors[0]);
            assert.equal(balance, 2, "Player meme balance is not correct");
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
            const collectedMeme = await contract.getMemeDetails(1);
            assert.equal(collectedMeme[2], true, "Meme is not marked as reddemed");
        })

        it('Should not allow player to redeem using already used meme', async() => {
            await contract.redeemSwag(1, {from:_collectors[0]});
            await expectThrow(contract.redeemSwag(1), {from:_collectors[0]});
        })

        it('Should not allow using meme ownned by other', async() => {
            await expectThrow(contract.redeemSwag(1), {from:_collectors[1]});
            const collectedMeme = await contract.getMemeDetails(1);
            assert.equal(collectedMeme[2],false,"Another player's meme is marked as redeemed");
        })
    })

    describe('Getters with several players collecting several memes', () => {
        before(async() => {
            contract = await memeFactory.new(name,symbol,{from: _owner});
            await contract.addMemeType(_doge.name,_doge.loc,{from:_owner});
            await contract.addMemeType(_grumpy.name,_grumpy.loc,{from:_owner});
            await contract.addMemeType(_trollface.name,_trollface.loc,{from:_owner});

            //Player 1 collecting 3 memes:
            sig = await signMemeClaim(_doge.loc, _collectors[0]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});
            sig = await signMemeClaim(_grumpy.loc, _collectors[0]);
            await contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});
            sig = await signMemeClaim(_trollface.loc, _collectors[0]);
            await contract.claimMeme(_trollface.loc,sig.v,sig.r,sig.s,{from:_collectors[0]});

            //Player 2 collecting 2 memes:
            sig = await signMemeClaim(_grumpy.loc, _collectors[1]);
            await contract.claimMeme(_grumpy.loc,sig.v,sig.r,sig.s,{from:_collectors[1]});
            sig = await signMemeClaim(_doge.loc, _collectors[1]);
            await contract.claimMeme(_doge.loc,sig.v,sig.r,sig.s,{from:_collectors[1]});

            //Player 1 redeeming 1 swag:
            await contract.redeemSwag(2, {from:_collectors[0]});
        })

        it('Should return all meme ids collected by players', async() => {
            const collectedMemes = [
                await contract.getMemesByOwner(_collectors[0]),
                await contract.getMemesByOwner(_collectors[1])
            ];
            assert.deepEqual(collectedMemes[0].map(Number), [1,2,3], "Wrong player 1 owned memes returned");
            assert.deepEqual(collectedMemes[1].map(Number), [4,5], "Wrong player 2 owned memes returned");
        })

        it('Should return only unredeedmed memes', async() => {
            const collectedMemes = [
                await contract.getRedeemableMemesByOwner(_collectors[0]),
                await contract.getRedeemableMemesByOwner(_collectors[1])
            ];
            assert.deepEqual(collectedMemes[0].map(Number), [1,3], "Wrong player 1 redeemable memes returned");
            assert.deepEqual(collectedMemes[1].map(Number), [4,5], "Wrong player 2 redeemable memes returned");
        })

        it('Should return collected meme by id', async() => {
            const expectedMemeNames = [_doge.name, _grumpy.name, _trollface.name, _grumpy.name, _doge.name];
            let collectedMeme;
            let collectedMemeName;
            
            for(let i=1;i<=5;i++){
                collectedMeme = await contract.getMemeDetails(i);
                collectedMemeName = await contract.getMemeName(collectedMeme[0]);
                assert.equal(collectedMemeName,expectedMemeNames[i-1], "Collected meme name is not correct");                
            }
            
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