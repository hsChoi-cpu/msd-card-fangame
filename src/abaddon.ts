(function (root: any) {
  const HUNGER = 'ABADDON_HUNGER';
  const SATIETY = 'ABADDON_SATIETY';
  const FRUSTRATION = 'ABADDON_FRUSTRATION';
  const hungerBonuses: readonly BossCardModifiers[] = [
    {}, {}, {damage:.1}, {damage:.2,attack:1}, {damage:.3,attack:1,power:1}, {damage:.3,power:2}
  ];
  const resources: Record<string,BossResource> = {
    [HUNGER]: {name:'채워지지 않는 허기', min:1,max:5,
      tooltip:'최소 1, 최대 5. 외부 효과로 제거되지 않음. 1: 효과 없음 / 2: 피해량 증가 1 / 3: 피해량 증가 2, 공격력 증가 1 / 4: 피해량 증가 3, 공격력 증가 1, 위력 증가 1 / 5: 피해량 증가 3, 위력 증가 2. 턴 종료 시 5이면 다음 턴 포식 예약.'},
    [SATIETY]: {name:'포만감', min:0,max:10,
      tooltip:'최대 10. 턴 종료 시 연속 미획득 턴 수만큼 감소. 감소 후 수치만큼 최대 체력의 %를 회복하고 수치의 절반(버림)만큼 허기를 감소시킴.'},
    [FRUSTRATION]: {name:'좌절감', min:0,max:3,
      tooltip:'최대 3. 포식의 합 패배 시 1 획득. 턴 종료 시 3이면 다음 턴 강화 포식(위력 +5) 사용.'}
  };

  const cut:CardDefinition = {id:'abaddon-cut',name:'잘라내기',type:'ATTACK',power:8,
    description:'[적중 시] 출혈 위력 3 · 횟수 2 부여.',
    effects:[{trigger:'ON_HIT',action:'APPLY_KEYWORD',target:'TARGET',keyword:'BLEED',potency:3,count:2}]};
  const mince:CardDefinition = {id:'abaddon-mince',name:'다지기',type:'ATTACK',power:9,
    description:'[적중 시] 다음 턴 대상에게 취약 1. 출혈 위력 2 · 횟수 1 부여.',
    effects:[{trigger:'ON_HIT',action:'APPLY_KEYWORD',target:'TARGET',keyword:'BLEED',potency:2,count:1}]};
  const tear:CardDefinition = {id:'abaddon-tear',name:'뜯어먹기',type:'COUNTER',power:6,
    description:'[적중 시] 다음 턴 대상에게 취약 1. 출혈 횟수 3 부여. 자신의 체력 1~5 회복.',
    effects:[{trigger:'ON_HIT',action:'APPLY_KEYWORD',target:'TARGET',keyword:'BLEED',count:3}]};
  const eat:CardDefinition = {id:'abaddon-eat',name:'섭취',type:'ATTACK',power:11,
    description:'포만감이 없으면 위력 +2. [합 승리 시] 상대 카드의 최종 소모 마력만큼 포만감 획득. [적중 시] 출혈 위력 2 · 횟수 2 부여.',
    effects:[{trigger:'ON_HIT',action:'APPLY_KEYWORD',target:'TARGET',keyword:'BLEED',potency:2,count:2}]};
  const devour:CardDefinition = {id:'abaddon-devour',name:'포식',type:'ATTACK',power:18,
    description:'좌절감으로 예약되면 위력 +5. [사용 시] 허기를 최대 4 소모(최소 1). 소모 전 허기 보정을 유지하며 소모한 허기 1당 피해량 +2%. [합 패배 시] 다음 턴 허기 최소 3. 일반 포식은 좌절감 1 획득, 강화 포식은 좌절감 제거 및 다음 턴 취약 3. [합 승리 시] 좌절감이 있으면 모두 제거하고 다음 턴 공격력 증가 1 및 신속 1. [적중 시] 포만감 5(이 공격으로 처치 시 추가 5), 출혈 위력 4 · 횟수 2, 공격력 감소 위력 1 · 횟수 2.',
    effects:[{trigger:'ON_HIT',actions:[
      {action:'APPLY_KEYWORD',target:'TARGET',keyword:'BLEED',potency:4,count:2},
      {action:'APPLY_KEYWORD',target:'TARGET',keyword:'ATTACK_DOWN',potency:1,count:2}
    ]}]};
  const normalMoves = [cut,mince,tear];

  const [beelzebub, starving, letMeEat]:CardDefinition[] = [
    {id:'abaddon-beelzebub',name:'벨제부브',type:'SPECIAL',power:0,effects:[],
      description:'전투 시작 및 2턴부터 매 턴 시작 시 허기 1 획득. 턴 종료 시 포만감의 절반(버림)만큼 허기 감소. 감소 후 허기가 5이면 다음 턴 포식 예약.'},
    {id:'abaddon-starving',name:'배... 고파...',type:'SPECIAL',power:0,effects:[],
      description:'매 턴 섭취 1장 사용. 섭취 합 승리 시 포만감 획득. 턴 종료 시 포만감만큼 최대 체력의 % 회복. 포식이 예약되면 섭취를 대체.'},
    {id:'abaddon-let-me-eat',name:'먹게... 해줘...',type:'SPECIAL',power:0,effects:[],
      description:'포식의 합 패배 시 좌절감 획득. 턴 종료 시 좌절감 3이면 다음 턴 강화 포식. 강화 포식의 합 패배 시 좌절감을 제거하고 다음 턴 취약 3 획득.'}
  ];

  interface AbaddonState {
    gainedSatiety: boolean;
    turnsWithoutSatiety: number;
    hungerFloor: boolean;
    reservation: 'normal'|'enhanced'|null;
    devourBonuses: WeakMap<CardDefinition,BossCardModifiers>;
  }
  const states = new WeakMap<Combatant,AbaddonState>();
  const value = (battle:BossBattleContext,id:KeywordId) => battle.kw(battle.boss,id);
  const hungerBonus = (battle:BossBattleContext) => hungerBonuses[value(battle,HUNGER)];

  function gainSatiety(battle:BossBattleContext,state:AbaddonState,amount:number):void {
    if(amount<=0)return;
    state.gainedSatiety=true;
    battle.setBossResource(SATIETY,value(battle,SATIETY)+amount);
  }

  function onEffect(battle:BossBattleContext,card:CardDefinition,trigger:EffectTrigger,target:Combatant,extra:BossEffectContext):void {
    if(card.id===beelzebub.id&&trigger==='ON_BATTLE_START'){
      states.set(battle.boss,{gainedSatiety:false,turnsWithoutSatiety:0,hungerFloor:false,reservation:null,devourBonuses:new WeakMap()});
      for(const [id,resource] of Object.entries(resources))battle.setBossResource(id,resource.min);
      return;
    }
    const state=states.get(battle.boss);
    switch(card.id){
      case beelzebub.id:
        if(trigger==='ON_TURN_START'&&battle.turn>1){
          battle.setBossResource(HUNGER,Math.max(state.hungerFloor?3:1,value(battle,HUNGER)+1));
          state.hungerFloor=false;
        }
        if(trigger==='ON_TURN_END'){
          // Resolve the satiety decay, healing and hunger before reserving the next card.
          state.turnsWithoutSatiety=state.gainedSatiety?0:state.turnsWithoutSatiety+1;
          battle.setBossResource(SATIETY,value(battle,SATIETY)-state.turnsWithoutSatiety);
          state.gainedSatiety=false;
          const satiety=value(battle,SATIETY);
          if(satiety>0){
            battle.executeEffectAction({action:'HEAL',value:Math.floor(battle.boss.maxHp*satiety/100)},battle.boss,battle.boss);
            battle.setBossResource(HUNGER,value(battle,HUNGER)-Math.floor(satiety/2));
          }
          const enhanced=value(battle,FRUSTRATION)===3;
          state.reservation=enhanced?'enhanced':value(battle,HUNGER)===5?'normal':null;
          if(state.reservation)battle.note(`아바돈: 다음 턴 ${enhanced?'강화 포식':'포식'} 예약`);
        }
        break;
      case mince.id:
      case tear.id:
        if(trigger==='ON_HIT'){
          battle.reserveKeyword(target,'VULNERABLE',1);
          if(card.id===tear.id)battle.executeEffectAction({action:'HEAL',value:battle.randint(1,5)},battle.boss,target);
        }
        break;
      case eat.id:
        if(trigger==='ON_CLASH_WIN')gainSatiety(battle,state,extra.paidMana??0);
        break;
      case devour.id:
        if(trigger==='ON_USE'){
          const hunger=value(battle,HUNGER);
          const spent=hunger-1;
          const bonus=hungerBonus(battle);
          state.devourBonuses.set(card,{...bonus,damage:(bonus.damage??0)+spent*.02});
          battle.setBossResource(HUNGER,hunger-spent);
        }
        if(trigger==='ON_CLASH_LOSE'){
          state.hungerFloor=true;
          if(card.enhanced){
            battle.setBossResource(FRUSTRATION,0);
            battle.reserveKeyword(battle.boss,'VULNERABLE',3);
          }else battle.setBossResource(FRUSTRATION,value(battle,FRUSTRATION)+1);
        }
        if(trigger==='ON_CLASH_WIN'&&value(battle,FRUSTRATION)>0){
          battle.setBossResource(FRUSTRATION,0);
          battle.reserveKeyword(battle.boss,'ATTACK_UP',1);
          battle.reserveKeyword(battle.boss,'HASTE',1);
        }
        if(trigger==='ON_HIT')gainSatiety(battle,state,5);
        if(trigger==='ON_KILL'&&extra.defeatedByHit)gainSatiety(battle,state,5);
        break;
    }
  }

  const encounter:BossEncounter = {
    name:'아바돈',maxHp:559,speed:[2,5],moves:[...normalMoves,eat,devour],
    passives:[beelzebub,starving,letMeEat],resources,onEffect,
    cardModifiers(battle,card){
      const bonus=states.get(battle.boss).devourBonuses.get(card)??hungerBonus(battle);
      if(card.id===eat.id&&value(battle,SATIETY)===0)return {...bonus,power:(bonus.power??0)+2};
      return bonus;
    },
    planMoves(battle,count){
      const state=states.get(battle.boss);
      const reservation=state.reservation;
      state.reservation=null;
      const moves=[reservation==='enhanced'?{...devour,power:devour.power+5,enhanced:true}:reservation?devour:eat];
      let counters=0;
      while(moves.length<count){
        const move=normalMoves[battle.randint(0,counters<2?2:1)];
        moves.push(move);
        if(move===tear)counters++;
      }
      for(let i=moves.length-1;i>0;i--){
        const other=battle.randint(0,i);
        [moves[i],moves[other]]=[moves[other],moves[i]];
      }
      return moves;
    }
  };

  const entry:RaidBossEntry={name:encounter.name,encounters:{OMEN:encounter}};
  if(typeof module!=='undefined'&&module.exports)module.exports=entry;
  root.AbaddonRaid=entry;
})(typeof window!=='undefined'?window:globalThis);
