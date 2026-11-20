const assert=require('node:assert/strict');
const {RaidBattle}=require('./.test-dist/engine.js');
const make=()=>new RaidBattle(()=>.4);
const c=(name,type,power,effects=[])=>({id:name,name,type,power,effects});
const tests=[];
function test(name,fn){fn();tests.push(name);}
test('처음 부여 시 누락한 count만 1',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:3});assert.deepEqual(u.keywords.ATTACK_UP,{potency:3,count:1});});
test('기존 키워드에 위력만 추가하면 횟수 그대로',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:3,count:2});g.apply(u,'ATTACK_UP',{potency:2});assert.deepEqual(u.keywords.ATTACK_UP,{potency:5,count:2});});
test('기존 키워드에 횟수만 추가하면 위력 그대로',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:3,count:2});g.apply(u,'ATTACK_UP',{count:3});assert.deepEqual(u.keywords.ATTACK_UP,{potency:3,count:5});});
test('최초 횟수만 부여 시 위력 1',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{count:3});assert.equal(u.keywords.ATTACK_UP.potency,1);});
test('회피는 높은 값 유지',()=>{const g=make(),u=g.allies[0];g.apply(u,'EVADE',{potency:12});g.apply(u,'EVADE',{potency:8});assert.equal(g.kw(u,'EVADE'),12);g.apply(u,'EVADE',{potency:15});assert.equal(g.kw(u,'EVADE'),15);});
test('회피 성공 유지, 실패 소멸',()=>{const g=make(),u=g.allies[0];g.apply(u,'EVADE',{potency:12});assert.equal(g.evade(u,11),true);assert.equal(g.kw(u,'EVADE'),12);assert.equal(g.evade(u,13),false);assert.equal(g.kw(u,'EVADE'),0);});
test('방어막과 보호 취약 합산, 실제 HP 피해',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(b,'PROTECTION',{potency:2,count:2});g.apply(b,'VULNERABLE',{potency:3,count:2});g.apply(b,'SHIELD',{potency:8});const hp=b.hp;g.dealAttack(a,b,c('test','ATTACK',20));assert.equal(b.hp,hp-14);assert.equal(g.kw(b,'SHIELD'),0);});
test('합 승리 효과 이후 피해 위력 재계산',()=>{const g=make(),a=g.allies[0],b=g.boss;const attack=c('boost','ATTACK',15,[{trigger:'ON_CLASH_WIN',action:'APPLY_KEYWORD',keyword:'ATTACK_UP',potency:3,target:'SELF'}]);a.hand.push({...attack,uid:'test-card'});const slot=a.slots[0];slot.cardUid='test-card';const intent=b.intents[0];intent.card=c('enemy','ATTACK',12);intent.targetId=a.id;g.resolveLinked(slot,intent);assert.equal(b.hp,b.maxHp-18);});
test('합 동률이면 양쪽 공격 취소',()=>{const g=make(),a=g.allies[0],b=g.boss;const attack=c('tie','ATTACK',12);a.hand.push({...attack,uid:'tie'});a.slots[0].cardUid='tie';const intent=b.intents[0];intent.card=c('enemy','ATTACK',12);intent.targetId=a.id;const hp=a.hp,bhp=b.hp;g.resolveLinked(a.slots[0],intent);assert.equal(a.hp,hp);assert.equal(b.hp,bhp);});
test('높은 보스 속도의 합에 회피를 조기 활성화',()=>{const g=make(),a=g.allies[1],b=g.boss;const evade=c('ev','EVADE',20);a.hand.push({...evade,uid:'ev'});const slot=a.slots[0];slot.cardUid='ev';slot.speed=3;const intent=b.intents[0];intent.card=c('strike','ATTACK',12);intent.speed=8;intent.targetId=a.id;g.resolveLinked(slot,intent);assert.equal(g.kw(a,'EVADE'),20);assert.equal(a.hp,a.maxHp);});
test('가로채기 속도 엄격한 초과 비교',()=>{const g=make(),slot=g.allies[0].slots[0],intent=g.boss.intents[0];const hero=g.allies[0];hero.hand.push({...c('x','ATTACK',10),uid:'x'});slot.cardUid='x';intent.card=c('e','ATTACK',12);intent.targetId=g.allies[1].id;slot.speed=5;intent.speed=5;assert.equal(g.linkIntent(slot.id,intent.id).ok,false);slot.speed=6;assert.equal(g.linkIntent(slot.id,intent.id).ok,true);});
test('속도 예약이 다음 턴부터 적용',()=>{const g=make(),a=g.allies[0];g.apply(a,'HASTE',{potency:2});assert.equal(g.kw(a,'HASTE'),0);g.resolveTurn();g.nextTurn();assert.equal(g.kw(a,'HASTE'),2);});
test('반격 피격 후 한 번 발동, 방어막 있어도 발동',()=>{const g=make(),a=g.allies[0],b=g.boss;a.counter={card:c('counter','COUNTER',14),remaining:1};g.apply(a,'SHIELD',{potency:30});const bHp=b.hp;g.dealAttack(b,a,c('strike','ATTACK',10));assert.equal(b.hp,bHp-14);assert.equal(a.counter.remaining,0);g.dealAttack(b,a,c('strike2','ATTACK',10));assert.equal(b.hp,bHp-14);});
test('턴 종료 횟수 감소, 비횟수 제거',()=>{const g=make(),a=g.allies[0];g.apply(a,'ATTACK_UP',{potency:3,count:2});g.apply(a,'SHIELD',{potency:8});g.endTurn();assert.equal(a.keywords.ATTACK_UP.count,1);assert.equal(g.kw(a,'SHIELD'),0);g.endTurn();assert.equal(g.kw(a,'ATTACK_UP'),0);});
test('보스 상대로 정상 턴 해결과 다음 턴 진행',()=>{const g=make();g.resolveTurn();assert.equal(g.status,'REVIEW');g.nextTurn();assert.equal(g.turn,2);assert.equal(g.status,'PLANNING');});
// V2 regression and event-system tests
function fx(trigger,action,opts={}){return {trigger,action,...opts};}
test('합 패배 후 활성화된 회피에 재판정하고 유지',()=>{
  const g=make(),a=g.allies[1],b=g.boss;
  g.apply(a,'EVADE',{potency:20});
  const atk=c('lose','ATTACK',3);a.hand.push({...atk,uid:'lose'});a.slots[0].cardUid='lose';
  const intent=b.intents[0];intent.card=c('enemy','ATTACK',12);intent.targetId=a.id;
  g.resolveLinked(a.slots[0],intent);
  assert.equal(a.hp,a.maxHp);assert.equal(g.kw(a,'EVADE'),20);
  assert.equal(g.events.some(e=>e.type==='EVADE_SUCCESS'),true);
});
test('회피 실패 시 방어막으로 피해 막아도 회피 소멸',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  g.apply(a,'EVADE',{potency:5});g.apply(a,'SHIELD',{potency:30});
  g.dealAttack(b,a,c('strong','ATTACK',12));
  assert.equal(a.hp,a.maxHp);assert.equal(g.kw(a,'EVADE'),0);
  assert.equal(g.kw(a,'SHIELD'),18);
});
test('효과 우선순위: 동일 트리거 높은 우선순위부터',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const cardX=c('prio','ATTACK',1,[
    fx('ON_USE','APPLY_KEYWORD',{keyword:'ATTACK_UP',potency:2,priority:0}),
    fx('ON_USE','REMOVE_KEYWORD',{keyword:'ATTACK_UP',priority:10})
  ]);
  g.activate(cardX,a,b);
  assert.equal(g.kw(a,'ATTACK_UP'),2);
});
test('추가 효과 묶음(actions) 및 발동 조건',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const spell=c('bundle','ATTACK',10,[{
    trigger:'ON_USE',conditions:[{kind:'MISSING_KEYWORD',keyword:'ATTACK_UP'}],actions:[
      {action:'APPLY_KEYWORD',keyword:'ATTACK_UP',potency:2},
      {action:'APPLY_KEYWORD',keyword:'POWER_UP',potency:1}
    ]
  }]);
  g.activate(spell,a,b);g.activate(spell,a,b);
  assert.equal(g.kw(a,'ATTACK_UP'),2);assert.equal(g.kw(a,'POWER_UP'),1);
});
test('MODIFY_KEYWORD는 존재하는 키워드 수치만 조정',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const spell=c('mod','ATTACK',1,[fx('ON_USE','MODIFY_KEYWORD',{keyword:'PROTECTION',potency:-2,count:1})]);
  g.activate(spell,a,b);assert.equal(g.kw(a,'PROTECTION'),0);
  g.apply(a,'PROTECTION',{potency:5,count:2});g.activate(spell,a,b);
  assert.deepEqual(a.keywords.PROTECTION,{potency:3,count:3});
});
test('키워드 수정으로 0이 되면 제거됨',()=>{
  const g=make(),a=g.allies[0];g.apply(a,'VULNERABLE',{potency:2,count:1});
  g.modifyKeyword(a,'VULNERABLE',{count:-1});assert.equal(g.kw(a,'VULNERABLE'),0);
});
test('적중 취약은 현재 피해에 소급되지 않는다',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const atk=c('vuln','ATTACK',10,[fx('ON_HIT','APPLY_KEYWORD',{target:'TARGET',keyword:'VULNERABLE',potency:2})]);
  const hp=b.hp;g.dealAttack(a,b,atk);
  assert.equal(b.hp,hp-10);assert.equal(g.kw(b,'VULNERABLE'),2);
  g.dealAttack(a,b,c('second','ATTACK',10));assert.equal(b.hp,hp-22);
});
test('피격 관련 이벤트: 보호막 전부 흡수는 HIT지만 HP_DAMAGED 아님',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  g.apply(a,'SHIELD',{potency:50});g.dealAttack(b,a,c('block','ATTACK',10));
  assert.equal(g.events.some(e=>e.type==='HIT'),true);
  assert.equal(g.events.some(e=>e.type==='HP_DAMAGED'),false);
});
test('반격 중 재귀 반격 없이 일회만 실행',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  a.counter={card:c('a-counter','COUNTER',8),remaining:1};
  b.counter={card:c('b-counter','COUNTER',8),remaining:1};
  g.dealAttack(b,a,c('poke','ATTACK',4));
  assert.equal(g.events.filter(e=>e.type==='COUNTER_TRIGGERED').length,1);
});
test('전투 이벤트의 순서 번호는 증가한다',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  g.dealAttack(a,b,c('order','ATTACK',5));
  assert.equal(g.events.every((e,i)=>!i||g.events[i-1].order<e.order),true);
});
test('특수 조건 체력 이하일 때만 발동',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const spell=c('heal','GUARD',1,[fx('ON_USE','HEAL',{value:9,conditions:[{kind:'HP_AT_MOST_PERCENT',value:50}]})]);
  a.hp=60;g.activate(spell,a,b);assert.equal(a.hp,60);
  a.hp=40;g.activate(spell,a,b);assert.equal(a.hp,49);
});

// V3: declarative effects, opt-in lifecycle subscriptions, guards.
test('V3 데이터 유효성 검사: 정상 카드',()=>{
  const {validateCard}=require('./.test-dist/engine.js');
  assert.deepEqual(validateCard(c('ok','ATTACK',9,[fx('ON_HIT','DEAL_DAMAGE',{target:'TARGET',value:2})])),[]);
});
test('V3 데이터 유효성 검사: 잘못된 명령과 대상 거부',()=>{
  const {validateCard}=require('./.test-dist/engine.js');
  const errors=validateCard(c('bad','ATTACK',2,[fx('ON_USE','MAGIC',{target:'UNKNOWN'})]));
  assert.equal(errors.some(x=>x.includes('action')),true);
  assert.equal(errors.some(x=>x.includes('target')),true);
});
test('V3 사용 시 카드 드로우 효과',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const before=a.hand.length;
  g.activate(c('draw','ATTACK',1,[fx('ON_USE','DRAW_CARDS',{value:2})]),a,b);
  assert.equal(a.hand.length,before+2);
  assert.equal(g.events.some(e=>e.type==='CARDS_DRAWN'&&e.count===2),true);
});
test('V3 추가 피해는 기존 취약·보호·방어막을 반영',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  g.apply(b,'VULNERABLE',{potency:2,count:2});g.apply(b,'PROTECTION',{potency:1,count:2});g.apply(b,'SHIELD',{potency:3});
  g.activate(c('bonus','ATTACK',1,[fx('ON_USE','DEAL_DAMAGE',{target:'TARGET',value:10})]),a,b);
  assert.equal(b.hp,b.maxHp-8);
  assert.equal(g.kw(b,'SHIELD'),0);
});
test('V3 추가 피해는 ON_HIT를 재발동하지 않음',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const atk=c('bonus-hit','ATTACK',10,[fx('ON_HIT','DEAL_DAMAGE',{target:'TARGET',value:5})]);
  g.dealAttack(a,b,atk);
  assert.equal(b.hp,b.maxHp-15);
  assert.equal(g.events.filter(e=>e.type==='EFFECT_DAMAGE').length,1);
  assert.equal(g.events.filter(e=>e.type==='HIT').length,1);
});
test('V3 광역 아군 강화는 살아있는 아군 모두에게 부여',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  g.allies[2].hp=0;
  g.activate(c('team','GUARD',0,[fx('ON_USE','APPLY_KEYWORD',{target:'ALL_ALLIES',keyword:'POWER_UP',potency:2})]),a,b);
  assert.equal(g.kw(g.allies[0],'POWER_UP'),2);
  assert.equal(g.kw(g.allies[1],'POWER_UP'),2);
  assert.equal(g.kw(g.allies[2],'POWER_UP'),0);
});
test('V3 보스 광역 약화는 살아있는 아군에게만',()=>{
  const g=make(),b=g.boss;g.allies[1].hp=0;
  g.activate(c('mass','GUARD',0,[fx('ON_USE','APPLY_KEYWORD',{target:'ALL_ENEMIES',keyword:'ATTACK_DOWN',potency:2})]),b,g.allies[0]);
  assert.equal(g.kw(g.allies[0],'ATTACK_DOWN'),2);
  assert.equal(g.kw(g.allies[1],'ATTACK_DOWN'),0);
  assert.equal(g.kw(g.allies[2],'ATTACK_DOWN'),2);
});
test('V3 ON_TURN_START OWNED 지속 효과가 다음 턴 시작에 실행',()=>{
  const g=make(),a=g.allies[0];
  const passive=c('passive','ATTACK',1,[fx('ON_TURN_START','APPLY_KEYWORD',{keyword:'ATTACK_UP',potency:2,count:2,scope:'OWNED'})]);
  a.deck.push(passive);
  g.resolveTurn();g.nextTurn();
  assert.equal(g.kw(a,'ATTACK_UP'),2);
});
test('V3 OWNED 효과는 카드 사용 시 실행하지 않음',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const passive=c('passive','ATTACK',1,[fx('ON_USE','APPLY_KEYWORD',{keyword:'ATTACK_UP',potency:2,scope:'OWNED'})]);
  g.activate(passive,a,b);assert.equal(g.kw(a,'ATTACK_UP'),0);
});
test('V3 ON_TURN_END OWNED가 키워드 정리보다 먼저 실행',()=>{
  const g=make(),a=g.allies[0];
  const passive=c('end','GUARD',1,[fx('ON_TURN_END','APPLY_KEYWORD',{keyword:'PROTECTION',potency:2,count:2,scope:'OWNED'})]);
  a.discard.push(passive);g.endTurn();
  assert.equal(g.kw(a,'PROTECTION'),2);
  assert.equal(a.keywords.PROTECTION.count,1);
});
test('V3 같은 카드 id 복사본의 지속 효과는 한 번만 적용',()=>{
  const g=make(),a=g.allies[0];
  const passive=c('unique-passive','ATTACK',1,[fx('ON_TURN_START','APPLY_KEYWORD',{keyword:'ATTACK_UP',potency:2,count:3,scope:'OWNED'})]);
  a.deck.push(passive,{...passive});
  g.resolveTurn();g.nextTurn();assert.equal(g.kw(a,'ATTACK_UP'),2);
});
test('V3 추가 조건: 키워드 횟수와 턴',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  g.apply(a,'PROTECTION',{potency:2,count:3});
  const effect=c('conditional','ATTACK',1,[fx('ON_USE','HEAL',{value:10,conditions:[{kind:'KEYWORD_COUNT_AT_LEAST',keyword:'PROTECTION',value:3},{kind:'TURN_AT_MOST',value:1}]})]);
  a.hp-=20;g.activate(effect,a,b);assert.equal(a.hp,a.maxHp-10);
  g.turn=2;g.activate(effect,a,b);assert.equal(a.hp,a.maxHp-10);
});
test('V3 복합 actions의 대상별 우선순위가 유지됨',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  const spell=c('mixed','ATTACK',1,[{trigger:'ON_USE',actions:[
    {action:'APPLY_KEYWORD',target:'TARGET',keyword:'VULNERABLE',potency:2},
    {action:'DEAL_DAMAGE',target:'TARGET',value:10}
  ]}]);
  g.activate(spell,a,b);assert.equal(b.hp,b.maxHp-12);
});
test('V3 회피 키워드 수치 유지 규칙 회귀',()=>{
  const g=make(),u=g.allies[0];g.apply(u,'EVADE',{potency:14});g.apply(u,'EVADE',{potency:11});
  assert.equal(g.kw(u,'EVADE'),14);assert.equal(g.evade(u,12),true);
});
test('V3 ON_KILL은 공격으로 적을 처치할 때 실행',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  b.hp=5;
  const kill=c('finish','ATTACK',9,[fx('ON_KILL','HEAL',{value:7})]);
  a.hp-=12;g.dealAttack(a,b,kill);
  assert.equal(b.hp,0);
  assert.equal(a.hp,a.maxHp-5);
});
test('V3 추가 효과 피해는 반격 및 ON_HIT를 자동 발생시키지 않음',()=>{
  const g=make(),a=g.allies[0],b=g.boss;
  b.counter={card:c('boss-counter','COUNTER',9),remaining:1};
  const hp=a.hp;
  g.activate(c('effect','ATTACK',1,[fx('ON_USE','DEAL_DAMAGE',{target:'TARGET',value:5})]),a,b);
  assert.equal(a.hp,hp);
  assert.equal(g.events.filter(e=>e.type==='COUNTER_TRIGGERED').length,0);
});

// V4 boundary regression tests
test('일반 키워드 최초 위력·횟수 99 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:120,count:150});assert.equal(u.keywords.ATTACK_UP.potency,99);assert.equal(u.keywords.ATTACK_UP.count,99);});
test('기존 키워드 합산 시 99 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'VULNERABLE',{potency:98,count:98});g.apply(u,'VULNERABLE',{potency:10,count:10});assert.deepEqual(u.keywords.VULNERABLE,{potency:99,count:99});});
test('위력만 추가 시 횟수 유지 + 99 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:95,count:2});g.apply(u,'ATTACK_UP',{potency:20});assert.deepEqual(u.keywords.ATTACK_UP,{potency:99,count:2});});
test('횟수만 추가 시 위력 유지 + 99 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:3,count:90});g.apply(u,'ATTACK_UP',{count:20});assert.deepEqual(u.keywords.ATTACK_UP,{potency:3,count:99});});
test('회피와 방어막 99 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'EVADE',{potency:200});g.apply(u,'SHIELD',{potency:70});g.apply(u,'SHIELD',{potency:80});assert.equal(g.kw(u,'EVADE'),99);assert.equal(g.kw(u,'SHIELD'),99);});
test('신속 예약·활성 위력과 횟수 99 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'HASTE',{potency:90,count:90});g.apply(u,'HASTE',{potency:30,count:30});assert.deepEqual(u.pending[0],{id:'HASTE',potency:99,count:99});g.activatePending(u);assert.deepEqual(u.keywords.HASTE,{potency:99,count:99});});
test('키워드 직접 조정은 99로 제한',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_UP',{potency:20,count:10});g.modifyKeyword(u,'ATTACK_UP',{potency:999,count:999});assert.deepEqual(u.keywords.ATTACK_UP,{potency:99,count:99});});
test('과도한 속박에도 속도 최솟값은 1',()=>{const g=make(),u=g.allies[0];g.apply(u,'BIND',{potency:99});g.activatePending(u);assert.equal(g.speedFor(u),1);});
test('과도한 위력 감소에도 카드 최종 위력 0',()=>{const g=make(),u=g.allies[0];g.apply(u,'ATTACK_DOWN',{potency:99});assert.equal(g.finalPower(u,c('weak','ATTACK',5)),0);});
// V5 roster, deck, mana, hand retention and passive regression tests.
const {HEROES}=require('./.test-dist/engine.js');
test('V5 모든 캐릭터 덱은 10장, 6종 카드',()=>{
  assert.equal(HEROES.length,6);
  for(const hero of HEROES){
    assert.equal(hero.deck.length,10,hero.id);
    assert.equal(new Set(hero.deck.map(c=>c.id)).size,6,hero.id);
    assert.ok(hero.deck.every(c=>Number.isInteger(c.manaCost)&&c.manaCost>=0));
  }
});
test('V5 출전 1~6명 슬롯 배분과 첫 턴 슬롯+2 드로우',()=>{
  for(let n=1;n<=6;n++){
    const g=new RaidBattle(()=>.4,{partyIds:HEROES.slice(0,n).map(h=>h.id)});
    const expected=Array.from({length:n},(_,i)=>Math.floor(6/n)+(i<6%n?1:0));
    assert.deepEqual(g.allies.map(h=>h.slots.length),expected);
    assert.deepEqual(g.allies.map(h=>h.hand.length),expected.map(x=>x+2));
    assert.equal(g.allies.reduce((sum,h)=>sum+h.slots.length,0),6);
  }
});
test('V5 4명 출전 시 2/2/1/1 슬롯',()=>{
  const g=new RaidBattle(()=>.4,{partyIds:HEROES.slice(0,4).map(h=>h.id)});
  assert.deepEqual(g.allies.map(h=>h.slots.length),[2,2,1,1]);
});
test('V5 잘못된 편성(중복, 초과, 미등록)을 거부',()=>{
  assert.throws(()=>new RaidBattle(()=>.4,{partyIds:['knight','knight']}));
  assert.throws(()=>new RaidBattle(()=>.4,{partyIds:['unknown']}));
  assert.throws(()=>new RaidBattle(()=>.4,{partyIds:[]}));
  assert.throws(()=>new RaidBattle(()=>.4,{maxPartySize:2,partyIds:['knight','rogue','mage']}));
});
test('V5 첫 턴 미사용 손패는 다음 턴 이월, 사용 0이면 추가 드로우 0',()=>{
  const g=make(),before=g.allies[0].hand.map(c=>c.uid);
  g.resolveTurn();g.nextTurn();
  assert.deepEqual(g.allies[0].hand.map(c=>c.uid),before);
  assert.equal(g.allies[0].lastTurnUsed,0);
});
test('V5 실제 사용한 카드만 버림으로, 다음 턴 사용 수만큼 드로우',()=>{
  const g=make(),a=g.allies[0];
  const first=a.hand.map(c=>c.uid),card=a.hand[0];
  assert.equal(g.assignCard(a.slots[0].id,card.uid).ok,true);
  g.resolveTurn();
  assert.equal(a.lastTurnUsed,1);
  assert.equal(a.discard.some(c=>c.uid===card.uid),true);
  assert.deepEqual(a.hand.map(c=>c.uid),first.filter(uid=>uid!==card.uid));
  g.nextTurn();
  assert.equal(a.hand.length,first.length);
});
test('V5 카드 드로우 중 덱이 바닥나면 버림 더미 재셔플',()=>{
  const g=make(),a=g.allies[0];
  a.hand=[];
  a.deck=[];
  a.discard=[{...c('a','ATTACK',1),uid:'a'},{...c('b','ATTACK',2),uid:'b'}];
  g.draw(a,2);
  assert.deepEqual(new Set(a.hand.map(x=>x.uid)),new Set(['a','b']));
  assert.equal(a.deck.length,0);assert.equal(a.discard.length,0);
});
test('V5 카드 예약 비용 합계 초과 시 배치 거부',()=>{
  const g=make(),a=g.allies[0];
  a.mana=2;
  a.hand[0].manaCost=2;a.hand[1].manaCost=2;
  assert.equal(g.assignCard(a.slots[0].id,a.hand[0].uid).ok,true);
  assert.equal(g.assignCard(a.slots[1].id,a.hand[1].uid).ok,false);
  assert.equal(a.slots[1].cardUid,null);
});
test('V5 같은 카드를 다른 슬롯으로 이동하면 비용 중복 예약하지 않음',()=>{
  const g=make(),a=g.allies[0];a.mana=2;a.hand[0].manaCost=2;
  assert.equal(g.assignCard(a.slots[0].id,a.hand[0].uid).ok,true);
  assert.equal(g.assignCard(a.slots[1].id,a.hand[0].uid).ok,true);
  assert.equal(g.totalPlannedMana(a),2);
  assert.equal(a.slots[0].cardUid,null);
});
test('V5 실행 시 마력 소비하고, 다음 턴 자연 회복',()=>{
  const g=make(),a=g.allies[0];
  const chosen=a.hand[0];chosen.manaCost=2;
  assert.equal(g.assignCard(a.slots[0].id,chosen.uid).ok,true);
  g.resolveTurn();assert.equal(a.mana,a.maxMana-2);
  g.nextTurn();assert.equal(a.mana,a.maxMana);
});
test('V5 마력 회복 카드 효과는 최대 마력을 초과하지 않음',()=>{
  const g=make(),a=g.allies[0];a.mana=1;
  const healing=c('mana','ATTACK',3,[fx('ON_USE','RESTORE_MANA',{value:999})]);
  g.activate(healing,a,g.boss);
  assert.equal(a.mana,a.maxMana);
  assert.ok(g.events.some(e=>e.type==='MANA_RESTORED'));
});
test('V5 패시브는 캐릭터 별도 보유 및 이벤트로 발동',()=>{
  const g=make(),mage=g.allies.find(u=>u.id==='mage');
  assert.ok(mage.passive?.name);
  mage.mana=3;
  g.passive(mage,'ON_CLASH_WIN',g.boss);
  assert.equal(mage.mana,4);
});
test('V5 패시브와 카드 데이터 모두 선언적으로 유효',()=>{
  const {validateCard,PASSIVES}=require('./.test-dist/engine.js');
  for(const hero of HEROES){
    for(const card of hero.deck)assert.deepEqual(validateCard(card),[],hero.id+':'+card.id);
    assert.deepEqual(validateCard(PASSIVES[hero.id]),[],hero.id+' passive');
  }
});
test('V5 캐릭터별 자연 회복 + 고유 패시브 회복',()=>{
  const g=new RaidBattle(()=>.4,{partyIds:['scholar']});
  const a=g.allies[0];a.mana=1;
  g.resolveTurn();g.nextTurn();
  assert.equal(a.mana,1+a.manaRegen+1);
});
test('V5 카드는 비용만큼 마력을 지불한 경우에만 사용 기록',()=>{
  const g=make(),a=g.allies[0],slot=a.slots[0],chosen=a.hand[0];
  chosen.manaCost=3;
  g.assignCard(slot.id,chosen.uid);
  a.mana=0; // 타 효과로 마력이 소진된 상황을 가정
  g.resolveTurn();
  assert.equal(a.lastTurnUsed,0);
  assert.ok(a.hand.some(c=>c.uid===chosen.uid));
});
// V5.3 test additions follow below.

// V5.3 regression tests
const {sortSlotsBySpeed, validateCard}=require('./.test-dist/engine.js');
test('V5.3 아군/보스 공통 속도 내림차순 렌더 순서, 같은 속도 안정',()=>{
  const slots=[{id:'a',speed:3},{id:'b',speed:8},{id:'c',speed:5},{id:'d',speed:8}];
  assert.deepEqual(sortSlotsBySpeed(slots).map(x=>x.id),['b','d','c','a']);
  assert.deepEqual(slots.map(x=>x.id),['a','b','c','d']);
});
test('V5.3 특수 카드는 일반 행동 슬롯에 장착 불가능',()=>{
  const g=make(),a=g.allies[0];
  const x={...c('special','SPECIAL',0),manaCost:0,uid:'instant'};
  a.hand.push(x);
  assert.equal(g.assignCard(a.slots[0].id,x.uid).ok,false);
});
test('V5.3 특수 카드는 슬롯을 소모하지 않고 즉시 사용 및 버림',()=>{
  const g=make(),a=g.allies[0];
  const x={...c('instant','SPECIAL',0,[fx('ON_USE','APPLY_KEYWORD',{keyword:'ATTACK_UP',potency:3})]),manaCost:1,uid:'instant'};
  a.hand.push(x);const n=a.slots.length,mp=a.mana,hand=a.hand.length;
  const r=g.playSpecial(a.id,x.uid);
  assert.equal(r.ok,true);assert.equal(g.kw(a,'ATTACK_UP'),3);
  assert.equal(a.mana,mp-1);assert.equal(a.slots.length,n);
  assert.equal(a.slots.every(s=>!s.cardUid),true);
  assert.equal(a.hand.length,hand-1);assert.equal(a.discard.includes(x),true);
  assert.equal(a.usedThisTurn,1);
});
test('V5.3 특수 대상 제한: 아군 대상과 적 대상 검증',()=>{
  const g=make(),a=g.allies[0],b=g.allies[1];
  const x={...c('gift','SPECIAL',0,[fx('ON_USE','HEAL',{target:'TARGET',value:3})]),manaCost:0,specialTarget:'ALLY',uid:'gift'};
  b.hp-=5;a.hand.push(x);
  assert.equal(g.playSpecial(a.id,x.uid,'boss').ok,false);
  assert.equal(a.hand.includes(x),true);
  assert.equal(g.playSpecial(a.id,x.uid,b.id).ok,true);
  assert.equal(b.hp,b.maxHp-2);
  const y={...c('hex','SPECIAL',0,[fx('ON_USE','APPLY_KEYWORD',{target:'TARGET',keyword:'VULNERABLE',potency:2})]),manaCost:0,specialTarget:'ENEMY',uid:'hex'};
  a.hand.push(y);
  assert.equal(g.playSpecial(a.id,y.uid,b.id).ok,false);
  assert.equal(g.playSpecial(a.id,y.uid,'boss').ok,true);
  assert.equal(g.kw(g.boss,'VULNERABLE'),2);
});
test('V5.3 특수 사용 전 예약된 마력 비용은 보호',()=>{
  const g=make(),a=g.allies[0],slot=a.slots[0];
  const normal={...c('normal','ATTACK',1),manaCost:a.mana,uid:'normal'};
  a.hand.push(normal);assert.equal(g.assignCard(slot.id,normal.uid).ok,true);
  const instant={...c('inst','SPECIAL',0),manaCost:1,uid:'inst'};
  a.hand.push(instant);
  assert.equal(g.playSpecial(a.id,instant.uid).ok,false);
  assert.equal(a.hand.includes(instant),true);
});
test('V5.3 특수 사용 장수는 다음 턴 드로우량에 포함',()=>{
  const g=make(),a=g.allies[0];
  const x={...c('instant','SPECIAL',0),manaCost:0,uid:'instant'};
  a.hand.push(x);assert.equal(g.playSpecial(a.id,x.uid).ok,true);
  g.resolveTurn();assert.equal(a.lastTurnUsed,1);
  g.nextTurn();assert.equal(a.turn,undefined); // no persistent special slot state
  assert.equal(a.usedThisTurn,0);
});
test('V5.3 종료 시 손패 7장 상한, 무작위 버림 더미로 이동',()=>{
  const g=make(),a=g.allies[0];
  a.deck=[];a.discard=[];a.hand=Array.from({length:10},(_,i)=>({...c(`c${i}`,'ATTACK',1),uid:`c${i}`}));
  const initial=a.hand.map(c=>c.uid);
  g.endTurn();
  assert.equal(a.hand.length,7);assert.equal(a.discard.length,3);
  assert.equal(new Set([...a.hand,...a.discard].map(c=>c.uid)).size,10);
  assert.deepEqual([...a.hand,...a.discard].map(c=>c.uid).sort(),initial.sort());
});
test('V5.3 턴 종료 효과로 늘어난 카드도 7장 제한',()=>{
  const g=make(),a=g.allies[0];
  a.hand=Array.from({length:7},(_,i)=>({...c(`h${i}`,'ATTACK',1),uid:`h${i}`}));
  const x={...c('passive draw','ATTACK',0,[{trigger:'ON_TURN_END',scope:'OWNED',action:'DRAW_CARDS',value:2}]),uid:'passive'};
  a.deck=[...Array.from({length:2},(_,i)=>({...c(`deck${i}`,'ATTACK',1),uid:`deck${i}`})),x];
  g.endTurn();assert.equal(a.hand.length,7);assert.equal(a.discard.length,2);
});
test('V5.3 특수 카드의 데이터 target 범위 검증',()=>{
  assert.deepEqual(validateCard({...c('ok','SPECIAL',0),specialTarget:'ANY'}),[]);
  assert.ok(validateCard({...c('bad','SPECIAL',0),specialTarget:'INVALID'}).length);
});
// V6 keyword, multi-hit and deck-manipulation regression tests.
test('V6 power split distributes remainder from last hit',()=>{const g=make();assert.deepEqual(g.splitPower(30,3),[10,10,10]);assert.deepEqual(g.splitPower(32,3),[10,11,11]);assert.deepEqual(g.splitPower(17,4),[4,4,4,5]);assert.deepEqual(g.splitPower(2,4),[0,0,1,1]);});
test('V6 multi attack deals same total without mitigation',()=>{const g=make(),a=g.allies[0],b=g.boss;g.dealAttack(a,b,{...c('multi','MULTI_ATTACK',32),hitCount:3});assert.equal(b.hp,b.maxHp-32);assert.equal(g.events.filter(e=>e.type==='HIT'&&e.cardId==='multi').length,3);});
test('V6 evade checked independently per hit',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(b,'EVADE',{potency:10});g.dealAttack(a,b,{...c('multi','MULTI_ATTACK',32),hitCount:3});assert.equal(b.hp,b.maxHp-22);assert.equal(g.kw(b,'EVADE'),0);assert.equal(g.events.filter(e=>e.type==='EVADE_SUCCESS').length,1);});
test('V6 rupture triggers on shielded hits, but not on evaded ones',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(b,'SHIELD',{potency:40});g.apply(b,'RUPTURE',{potency:5,count:2});g.dealAttack(a,b,{...c('triple','MULTI_ATTACK',30),hitCount:3});assert.equal(g.kw(b,'RUPTURE'),0);assert.equal(g.kw(b,'SHIELD'),0);assert.equal(b.hp,b.maxHp);});
test('V6 rupture does not decay at end of turn',()=>{const g=make(),b=g.boss;g.apply(b,'RUPTURE',{potency:3,count:2});g.apply(b,'BLEED',{potency:3,count:2});g.endTurn();assert.equal(b.keywords.RUPTURE.count,2);assert.equal(b.keywords.BLEED.count,2);});
test('V6 bleed hits before each multi hit and cancels later hits after death',()=>{const g=make(),a=g.allies[0],b=g.boss;a.hp=6;g.apply(a,'BLEED',{potency:3,count:3});g.dealAttack(a,b,{...c('m','MULTI_ATTACK',30),hitCount:3});assert.equal(a.hp,0);assert.equal(b.hp,b.maxHp-20);assert.equal(g.events.filter(e=>e.type==='HIT'&&e.cardId==='m').length,2);assert.equal(a.keywords.BLEED.count,1);});
test('V6 guard activates and then takes bleeding',()=>{const g=make(),a=g.allies[0];g.apply(a,'BLEED',{potency:4,count:1});g.activate(c('guard','GUARD',10),a,a);assert.equal(a.hp,a.maxHp);assert.equal(g.kw(a,'SHIELD'),6);});
test('V6 poison grows per hit before multi attacks',()=>{const g=new RaidBattle(()=>0),a=g.allies[0],b=g.boss;g.apply(a,'POISON',{potency:5,count:5});g.dealAttack(a,b,{...c('multi','MULTI_ATTACK',12),hitCount:3});assert.equal(g.events.filter(e=>e.type==='POISON_GREW').length,3);assert.equal(g.kw(a,'POISON'),11);assert.equal(a.keywords.POISON.count,11);});
test('V6 poison bypasses shield at end of turn while burn does not',()=>{const g=make(),a=g.allies[0];g.apply(a,'SHIELD',{potency:10});g.apply(a,'BURN',{potency:4,count:2});g.apply(a,'POISON',{potency:3,count:2});g.endTurn();assert.equal(a.hp,a.maxHp-3);assert.equal(g.kw(a,'SHIELD'),0);assert.equal(a.keywords.BURN.count,1);assert.equal(a.keywords.POISON.count,1);});
test('V6 blessing nullifies hit and on-hit effects but preserves on-attack effect',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(b,'BLESSING',{potency:1});const attack=c('special','ATTACK',10,[{trigger:'ON_ATTACK',action:'APPLY_KEYWORD',keyword:'ATTACK_UP',potency:2},{trigger:'ON_HIT',action:'APPLY_KEYWORD',target:'TARGET',keyword:'BURN',potency:3,count:2}]);g.dealAttack(a,b,attack);assert.equal(b.hp,b.maxHp);assert.equal(g.kw(b,'BURN'),0);assert.equal(g.kw(a,'ATTACK_UP'),2);assert.equal(g.kw(b,'BLESSING'),0);});
test('V6 blessing absorbs first two of triple hits',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(b,'BLESSING',{potency:2});g.dealAttack(a,b,{...c('multi','MULTI_ATTACK',30),hitCount:3});assert.equal(b.hp,b.maxHp-10);assert.equal(g.events.filter(e=>e.type==='HIT_NEGATED').length,2);});
test('V6 outgoing/critical/protection apply in configured order',()=>{const g=new RaidBattle(()=>0),a=g.allies[0],b=g.boss;g.apply(a,'DAMAGE_UP',{potency:2,count:2});g.apply(a,'BREATH',{potency:20,count:2});g.apply(b,'PROTECTION',{potency:1,count:2});g.dealAttack(a,b,c('atk','ATTACK',20));assert.equal(b.hp,b.maxHp-25);assert.equal(a.keywords.BREATH.count,1);});
test('V6 lifesteal counts only HP damage and never shields',()=>{const g=make(),a=g.allies[0],b=g.boss;a.hp=50;g.apply(a,'LIFESTEAL',{potency:3});g.apply(b,'SHIELD',{potency:5});g.dealAttack(a,b,c('a','ATTACK',15));assert.equal(a.hp,53);});
test('V6 corrosion ignores shields, regeneration uses max HP',()=>{const g=make(),a=g.allies[0];a.hp=50;g.apply(a,'SHIELD',{potency:10});g.apply(a,'CORROSION',{potency:10});g.apply(a,'REGEN',{potency:2});g.tickStartKeywords();assert.equal(a.hp,42);assert.equal(g.kw(a,'SHIELD'),10);assert.equal(g.kw(a,'CORROSION'),9);assert.equal(g.kw(a,'REGEN'),1);});
test('V6 taunt latest overwrites, invalid dead source never falls back',()=>{const g=make(),a=g.allies[0],b=g.allies[1];g.apply(g.boss,'TAUNT',{sourceId:a.id});g.apply(g.boss,'TAUNT',{sourceId:b.id});b.hp=0;g.activatePending(g.boss);assert.equal(g.kw(g.boss,'TAUNT'),0);});
test('V6 active taunt forces boss attack targets to source',()=>{const g=make(),a=g.allies[0];g.apply(g.boss,'TAUNT',{sourceId:a.id});g.boss.pending=g.boss.pending.filter(p=>p.id==='TAUNT');g.resolveTurn();g.nextTurn();assert.ok(g.boss.intents.filter(x=>x.card.type!=='GUARD').every(x=>x.targetId===a.id));g.endTurn();assert.equal(g.kw(g.boss,'TAUNT'),0);});
test('V6 lockdown forces one turn speed 1',()=>{const g=make(),a=g.allies[0];g.apply(a,'LOCKDOWN',{potency:1});g.activatePending(a);assert.equal(g.speedFor(a),1);g.endTurn();assert.equal(g.kw(a,'LOCKDOWN'),0);});
test('V6 mana leak and efficiency affect all card costs and expire',()=>{const g=make(),a=g.allies[0],c0={...c('s','SPECIAL',0),manaCost:3};g.apply(a,'MANA_LEAK',{potency:3});g.apply(a,'MANA_EFFICIENCY',{potency:2});assert.equal(g.manaCost(a,c0),4);g.endTurn();assert.equal(g.manaCost(a,c0),3);});
test('V6 mana backflow stops both natural and effect regen',()=>{const g=make(),a=g.allies[0];a.mana=2;g.apply(a,'MANA_BACKFLOW',{potency:2});assert.equal(g.restoreMana(a,4),0);assert.equal(a.mana,2);g.endTurn();assert.equal(g.kw(a,'MANA_BACKFLOW'),1);});
test('V6 paralyze/focus/distraction untouched by special, consumed by ordinary card',()=>{const g=make(),a=g.allies[0];g.apply(a,'PARALYSIS',{potency:2});g.apply(a,'FOCUS',{potency:4});g.apply(a,'DISTRACTION',{potency:2});g.activate(c('special','SPECIAL',0),a,a);assert.equal(g.kw(a,'PARALYSIS'),2);assert.equal(g.kw(a,'FOCUS'),4);assert.equal(g.kw(a,'DISTRACTION'),2);assert.equal(g.finalPower(a,c('atk','ATTACK',20)),12);g.consumePowerStatuses(a,c('atk','ATTACK',20));assert.equal(g.kw(a,'PARALYSIS'),1);assert.equal(g.kw(a,'FOCUS'),0);});
test('V6 replenishes 3 minimum at 1 mana per card',()=>{const g=make(),a=g.allies[0];a.hand=[];a.mana=2;g.replenishHand(a);assert.equal(a.hand.length,2);assert.equal(a.mana,0);});
test('V6 generated card by default exhausts and override recycles',()=>{const g=make(),a=g.allies[0],template=c('made','ATTACK',4);const x=g.createCard(a,template);assert.equal(x.generated,true);g.moveUsedCard(a,x);assert.ok(a.exhaust.includes(x));const y=g.createCard(a,template,{recycleGenerated:true});g.moveUsedCard(a,y);assert.ok(a.discard.includes(y));});
test('V6 choose discard waits for selected physical hand card',()=>{const g=make(),a=g.allies[0];const before=a.hand.length;g.executeEffectAction({action:'DISCARD_CARDS',target:'SELF',value:1,selection:'CHOOSE'},a,a);assert.equal(a.hand.length,before);assert.equal(g.pendingDiscards.length,1);const chosen=a.hand[0];assert.equal(g.chooseDiscard(a.id,chosen.uid).ok,true);assert.equal(a.hand.length,before-1);assert.ok(a.discard.includes(chosen));});
test('V6 mark source IDs remain separate',()=>{const g=make(),a=g.allies[0],b=g.allies[1];g.apply(g.boss,'MARK',{potency:2,sourceId:a.id});g.apply(g.boss,'MARK',{potency:3,sourceId:b.id});assert.equal(g.kw(g.boss,`MARK:${a.id}`),2);assert.equal(g.kw(g.boss,`MARK:${b.id}`),3);});
test('V6 multi card validation requires hit count',()=>{const {validateCard}=require('./.test-dist/engine.js');assert.ok(validateCard(c('bad','MULTI_ATTACK',15)).length);assert.deepEqual(validateCard({...c('ok','MULTI_ATTACK',15),hitCount:3}),[]);});

test('V6 counter power respects paralysis on activation',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(a,'PARALYSIS',{potency:1});g.activate(c('counter','COUNTER',14),a,a);g.consumePowerStatuses(a,c('counter','COUNTER',14));const hp=b.hp;g.dealAttack(b,a,c('attack','ATTACK',6));assert.equal(b.hp,hp-4);assert.equal(g.kw(a,'PARALYSIS'),0);});
test('V6 counter does not double-trigger bleed from the same card',()=>{const g=make(),a=g.allies[0],b=g.boss;g.apply(a,'SHIELD',{potency:20});g.apply(a,'BLEED',{potency:2,count:2});g.activate(c('counter','COUNTER',12),a,a);assert.equal(a.keywords.BLEED.count,1);g.dealAttack(b,a,c('attack','ATTACK',5));assert.equal(a.keywords.BLEED.count,1);});
test('V6 status at turn start can terminate battle before boss targeting',()=>{const g=make();for(const u of g.allies){u.hp=1;g.apply(u,'CORROSION',{potency:99});}g.resolveTurn();if(g.status==='REVIEW'){g.nextTurn();assert.equal(g.status,'LOST');}});
console.log('PASS '+tests.length+' tests (including V6)');
