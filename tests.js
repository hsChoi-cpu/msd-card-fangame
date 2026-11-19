const assert=require('node:assert/strict');
const {RaidBattle}=require('./engine.js');
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
console.log(`PASS ${tests.length} tests\n`+tests.map(t=>'✓ '+t).join('\n'));
