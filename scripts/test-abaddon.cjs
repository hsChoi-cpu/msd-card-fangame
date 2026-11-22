const assert = require('node:assert/strict');
const entry = require('../.test-dist/abaddon.js');
const {RaidBattle,validateCard} = require('../.test-dist/engine.js');
const {bosses} = require('../.test-dist/raid.js');
const encounter = entry.encounters.OMEN;
const hunger = 'ABADDON_HUNGER', satiety = 'ABADDON_SATIETY', frustration = 'ABADDON_FRUSTRATION';
const names = ['abaddon-cut','abaddon-mince','abaddon-tear','abaddon-eat','abaddon-devour'];
const byId = id => structuredClone(encounter.moves.find(move=>move.id===`abaddon-${id}`));
const make = (rng=()=>0) => new RaidBattle(rng,{encounter});
const value = (game,id) => game.kw(game.boss,id);
const essential = game => game.boss.intents.filter(intent=>['abaddon-eat','abaddon-devour'].includes(intent.card.id));
const results = game => game.events.filter(event=>event.type==='CLASH');
function clash(game, card, power, originalCost=0, costModifier=0) {
  const ally=game.allies[0], slot=ally.slots[0];
  const intent={id:'fixture',targetId:ally.id,card,speed:1};
  const player={id:'fixture-strike',uid:'fixture-strike',name:'Fixture strike',type:'ATTACK',power,manaCost:originalCost,costModifier,effects:[]};
  ally.hand.push(player);
  game.boss.intents=[intent];
  assert.equal(game.assignCard(slot.id,player.uid).ok,true);
  assert.equal(game.linkIntent(slot.id,intent.id).ok,true);
  assert.equal(game.consumeAction(slot),true);
  game.resolveLinked(slot,intent);
  game.finishConsumed(slot);
}

assert.equal(bosses[0],entry);
assert.deepEqual(Object.keys(entry.encounters),['OMEN']);
assert.deepEqual(encounter.moves.map(move=>move.id),names);
assert.deepEqual(encounter.moves.map(move=>move.power),[8,9,6,11,18]);
assert.equal(encounter.passives.length,3);
for(const card of [...encounter.moves,...encounter.passives])assert.deepEqual(validateCard(card),[]);
assert.equal(entry.portrait,undefined);
assert.equal(encounter.sprite,undefined);

{
  const g=make();
  assert.equal(g.boss.hp,559);
  assert.deepEqual(g.boss.speed,[2,5]);
  assert.deepEqual([hunger,satiety,frustration].map(id=>value(g,id)),[1,0,0]);
  assert.deepEqual(essential(g).map(intent=>intent.card.id),['abaddon-eat']);
  g.rng=()=>.999;
  g.startTurn();
  assert.deepEqual(g.allies[0].slots.map(slot=>slot.speed),[6,6]);
  assert.deepEqual(g.boss.intents.map(intent=>intent.speed),[5,5,5,5]);
  assert.equal(value(g,hunger),2);
  g.apply(g.boss,'BIND',{potency:2});
  g.startTurn();
  assert.ok(g.boss.intents.every(intent=>intent.speed===3));
  g.reset();
  assert.deepEqual([hunger,satiety,frustration].map(id=>value(g,id)),[1,0,0]);
}

{
  const g=make(), cut=byId('cut');
  g.apply(g.boss,'ATTACK_UP',{potency:2});
  g.apply(g.boss,'POWER_UP',{potency:1});
  for(const [stage,power,outgoing] of [[1,11,1],[2,11,1.1],[3,12,1.2],[4,13,1.3],[5,13,1.3],[3,12,1.2]]){
    g.setBossResource(hunger,stage);
    assert.equal(g.finalPower(g.boss,cut),power);
    const ally=g.allies[0], before=ally.hp;
    g.dealAttack(g.boss,ally,cut);
    assert.equal(before-ally.hp,Math.floor(power*outgoing+1e-9));
    ally.hp=ally.maxHp;
  }
  assert.equal(value(g,'ATTACK_UP'),2);
  g.setBossResource(hunger,100);
  g.executeEffectAction({action:'REMOVE_KEYWORD',keyword:hunger,target:'TARGET'},g.allies[0],g.boss);
  g.executeEffectAction({action:'MODIFY_KEYWORD',keyword:hunger,potency:-10,target:'TARGET'},g.allies[0],g.boss);
  assert.equal(value(g,hunger),5);
  g.modifyKeyword(g.boss,hunger,{potency:-10});
  assert.equal(value(g,hunger),1);
}

for(const [keyword,costModifier,expected] of [[null,0,3],['MANA_EFFICIENCY',0,2],['MANA_LEAK',0,5],[null,-2,1]]){
  const g=make();
  if(keyword)g.apply(g.allies[0],keyword,{potency:keyword==='MANA_LEAK'?2:1});
  clash(g,byId('eat'),1,3,costModifier);
  assert.equal(results(g).at(-1).bossPower,13);
  assert.equal(value(g,satiety),expected);
  assert.deepEqual(g.allies[0].keywords.BLEED,{potency:2,count:2});
}

{
  const g=make();
  g.boss.hp=500;
  g.setBossResource(hunger,5);
  g.setBossResource(satiety,9);
  clash(g,byId('eat'),1,4);
  assert.equal(value(g,satiety),10);
  g.endTurn();
  assert.deepEqual([g.boss.hp,value(g,satiety),value(g,hunger)],[555,10,1]);
  g.startTurn();
  assert.equal(essential(g)[0].card.id,'abaddon-eat');
  g.endTurn();
  assert.deepEqual([g.boss.hp,value(g,satiety)],[559,9]);
  g.startTurn();g.endTurn();
  assert.equal(value(g,satiety),7);
  g.startTurn();g.endTurn();
  assert.equal(value(g,satiety),4);
  g.startTurn();clash(g,byId('eat'),1,1);g.endTurn();
  assert.equal(value(g,satiety),5);
  g.startTurn();g.endTurn();
  assert.equal(value(g,satiety),4);
}

{
  const g=make(), target=g.allies[0];
  g.setBossResource(hunger,5);
  g.endTurn();
  assert.equal(essential(g)[0].card.id,'abaddon-eat');
  g.startTurn();
  const [intent]=essential(g);
  assert.equal(intent.card.id,'abaddon-devour');
  assert.equal(g.finalPower(g.boss,intent.card),20);
  g.activate(intent.card,g.boss,target);
  assert.equal(value(g,hunger),1);
  assert.equal(g.finalPower(g.boss,intent.card),20);
  assert.equal(g.finalPower(g.boss,byId('cut')),8);
  const before=target.hp;
  g.dealAttack(g.boss,target,intent.card);
  assert.equal(before-target.hp,27);
  assert.equal(value(g,satiety),5);
  assert.equal(value(g,frustration),0);
  assert.deepEqual(target.keywords.BLEED,{potency:4,count:2});
  assert.deepEqual(target.keywords.ATTACK_DOWN,{potency:1,count:2});
  const victim=g.allies[1];
  victim.hp=1;
  g.dealAttack(g.boss,victim,intent.card);
  assert.equal(victim.hp,0);
  assert.equal(value(g,satiety),10);
}

{
  const g=make();
  for(let repeat=0;repeat<3;repeat++){
    g.setBossResource(hunger,5);
    g.endTurn();g.startTurn();
    const card=essential(g)[0].card;
    assert.equal(card.enhanced,undefined);
    clash(g,card,40);
    assert.equal(value(g,frustration),repeat+1);
    assert.equal(value(g,hunger),1);
  }
  g.endTurn();g.startTurn();
  assert.equal(value(g,hunger),3);
  const enhanced=essential(g)[0].card;
  assert.equal(enhanced.enhanced,true);
  assert.equal(enhanced.power,23);
  clash(g,enhanced,40);
  assert.equal(results(g).at(-1).bossPower,24);
  assert.equal(value(g,frustration),0);
  assert.equal(value(g,'VULNERABLE'),0);
  assert.equal(g.boss.pending.find(item=>item.id==='VULNERABLE').potency,3);
  g.endTurn();g.startTurn();
  assert.equal(value(g,hunger),3);
  assert.equal(value(g,'VULNERABLE'),3);
  assert.equal(essential(g)[0].card.id,'abaddon-eat');
}

{
  const g=make();
  g.setBossResource(frustration,2);
  clash(g,byId('devour'),1);
  assert.equal(value(g,frustration),0);
  assert.equal(value(g,'ATTACK_UP'),0);
  g.endTurn();g.startTurn();
  assert.equal(value(g,'ATTACK_UP'),1);
  assert.equal(value(g,'HASTE'),1);
}

{
  const g=make( ()=>.999 ), target=g.allies[0];
  g.boss.hp=540;
  g.dealAttack(g.boss,target,byId('mince'));
  assert.deepEqual(target.keywords.BLEED,{potency:2,count:1});
  assert.equal(g.kw(target,'VULNERABLE'),0);
  g.activate(byId('tear'),g.boss,target);
  g.dealAttack(target,g.boss,{id:'fixture',name:'Fixture',type:'ATTACK',power:1,effects:[]});
  assert.deepEqual(target.keywords.BLEED,{potency:1,count:3});
  assert.equal(g.boss.hp,544);
  assert.equal(target.pending.filter(item=>item.id==='VULNERABLE').length,2);
  g.endTurn();g.startTurn();
  assert.equal(g.kw(target,'VULNERABLE'),2);
}

{
  const g=make(()=>.999);
  g.startTurn();g.startTurn();g.startTurn();
  assert.equal(g.boss.intents.length,6);
  assert.equal(essential(g).length,1);
  assert.equal(g.boss.intents.filter(intent=>intent.card.id==='abaddon-tear').length,2);
  assert.equal(g.boss.intents.filter(intent=>intent.card.id==='abaddon-mince').length,3);
  for(const [random,id] of [[0,'abaddon-cut'],[.45,'abaddon-mince'],[.9,'abaddon-tear']]){
    const sample=encounter.planMoves({...g,randint:(min,max)=>Math.floor(random*(max-min+1))+min},2);
    assert.ok(sample.some(card=>card.id===id));
    assert.equal(sample.findIndex(card=>card.id==='abaddon-eat'),random<.5?1:0);
  }
}
console.log('PASS Abaddon OMEN: turn hooks, card rolls, resource limits, paid mana, healing, counters, and both Devour variants');
