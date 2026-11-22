const assert = require('node:assert/strict');
const {
  bosses, difficulties, regularClearCount, readProgress, isUnlocked, isCleared, recordClear
} = require('../.test-dist/raid.js');
const {RaidBattle} = require('../.test-dist/engine.js');

assert.equal(bosses.length, 12);
assert.deepEqual(difficulties, ['OMEN', 'CALAMITY', 'OBLIVION']);
let progress = readProgress(null);
assert.equal(isUnlocked(progress, 0, 'OMEN'), true);
assert.equal(isUnlocked(progress, 0, 'CALAMITY'), false);
assert.equal(isUnlocked(progress, 1, 'OMEN'), false);
assert.equal(recordClear(progress, 0, 'CALAMITY'), progress);
assert.equal(recordClear(progress, 2, 'OMEN'), progress);
assert.equal(recordClear(progress, 12, 'OMEN'), progress);
assert.equal(recordClear(progress, -1, 'OBLIVION'), progress);
assert.equal(recordClear(progress, 0, 'UNKNOWN'), progress);

for (let index = 0; index < bosses.length; index++) {
  assert.equal(isUnlocked(progress, index, 'OMEN'), true);
  assert.equal(isUnlocked(progress, index, 'CALAMITY'), false);
  progress = recordClear(progress, index, 'OMEN');
  assert.equal(isCleared(progress, index, 'OMEN'), true);
  assert.equal(recordClear(progress, index, 'OMEN'), progress);
  assert.equal(isUnlocked(progress, index, 'CALAMITY'), true);
  for(let boss = 0; boss < bosses.length; boss++) assert.equal(isUnlocked(progress, boss, 'OBLIVION'), false);
  progress = recordClear(progress, index, 'CALAMITY');
  assert.equal(isCleared(progress, index, 'CALAMITY'), true);
  assert.equal(recordClear(progress, index, 'CALAMITY'), progress);
}
assert.equal(progress.regularClears, regularClearCount);
assert.equal(progress.announcedClears, 0);
for(let boss = 0; boss < bosses.length; boss++) assert.equal(isUnlocked(progress, boss, 'OBLIVION'), true);
progress = recordClear(progress, 3, 'OBLIVION');
assert.equal(isCleared(progress, 3, 'OBLIVION'), true);
assert.equal(isCleared(progress, 4, 'OBLIVION'), false);
assert.equal(recordClear(progress, 3, 'OBLIVION'), progress);
assert.deepEqual(readProgress(JSON.parse(JSON.stringify(progress))), progress);
assert.deepEqual(readProgress({regularClears:3, announcedClears:70, oblivionClears:[0]}), {
  regularClears:3, announcedClears:3, oblivionClears:[], announcedOblivion:0
});
assert.deepEqual(readProgress({regularClears:99, oblivionClears:[3,3,12,'1',-1],announcedOblivion:10}), {
  regularClears:24, announcedClears:0, oblivionClears:[3], announcedOblivion:1
});

const moves = [
  {id:'fixture-a', name:'Fixture A', type:'ATTACK', power:1, effects:[]},
  {id:'fixture-b', name:'Fixture B', type:'ATTACK', power:2, effects:[]}
];
const passive = {
  id:'fixture-passive', name:'Fixture passive', type:'SPECIAL', power:0,
  effects:[
    {trigger:'ON_BATTLE_START', action:'APPLY_KEYWORD', keyword:'TEST_HUNGER', potency:1, count:3},
    {trigger:'ON_TURN_END', action:'MODIFY_KEYWORD', keyword:'TEST_HUNGER', potency:1}
  ]
};
const encounter = {
  name:'Fixture', maxHp:559, speed:[2,5], moves, passives:[passive],
  slotCount:battle=>battle.turn===1?1:2,
  pickMove:(battle,index)=>moves[(index+battle.kw(battle.boss,'TEST_HUNGER')-1)%2]
};
const battle = new RaidBattle(()=>0,{encounter});
assert.equal(battle.boss.id,'boss');
assert.equal(battle.boss.hp,559);
assert.equal(battle.boss.intents[0].speed,2);
assert.deepEqual(battle.boss.intents.map(intent=>intent.card.id),['fixture-a']);
battle.resolveTurn();
battle.nextTurn();
assert.deepEqual(battle.boss.intents.map(intent=>intent.card.id),['fixture-b','fixture-a']);
assert.equal(battle.kw(battle.boss,'TEST_HUNGER'),2);
battle.reset();
assert.deepEqual(battle.boss.intents.map(intent=>intent.card.id),['fixture-a']);
assert.equal(new RaidBattle(()=>0).boss.maxHp,260);
console.log('PASS raid progression, save normalization, and encounter integration');
