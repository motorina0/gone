import {describe,expect,it} from 'vitest';import {angleBetween,distance} from '../src/core/math';import {hasLineOfSight,inVision,updateExposure} from '../src/vision/vision';import {transitionGuard} from '../src/ai/guardAI';import {canHear} from '../src/sound/events';import {canTakedown} from '../src/interaction/takedown';import {evaluateMission,objectiveReached,OBJECTIVE,EXTRACTION} from '../src/mission/mission';import {defaults,parseSettings,serializeSettings} from '../src/persistence/settings';import type {GuardData} from '../src/core/types';
const guard=(over:Partial<GuardData>={}):GuardData=>({id:1,position:{x:0,z:0},facing:{x:1,z:0},route:[{x:0,z:0}],waypoint:0,state:'patrol',stateTime:0,exposure:0,defeated:false,...over});
describe('vision',()=>{it('calculates distances and angles',()=>{expect(distance({x:0,z:0},{x:3,z:4})).toBe(5);expect(angleBetween({x:1,z:0},{x:0,z:1})).toBeCloseTo(Math.PI/2)});it('uses range, angle and occlusion',()=>{expect(inVision({x:0,z:0},{x:1,z:0},{x:3,z:0})).toBe(true);expect(inVision({x:0,z:0},{x:1,z:0},{x:-3,z:0})).toBe(false);expect(hasLineOfSight({x:0,z:0},{x:4,z:0},[{x:2,z:0,w:1,h:1}])).toBe(false)});it('requires exposure time',()=>{expect(updateExposure(1,true,.3,1.4).detected).toBe(false);expect(updateExposure(1.2,true,.3,1.4).detected).toBe(true)})});
describe('systems',()=>{it('transitions through investigation and return',()=>{let g=transitionGuard(guard(),'heard',.1);expect(g.state).toBe('suspicious');g=transitionGuard(g,'none',.7);expect(g.state).toBe('investigate');g=transitionGuard(g,'none',4.1);expect(g.state).toBe('return')});it('checks sound radius',()=>{expect(canHear({x:0,z:0},{position:{x:3,z:4},radius:5})).toBe(true);expect(canHear({x:0,z:0},{position:{x:6,z:0},radius:5})).toBe(false)});it('requires a close rear takedown',()=>{expect(canTakedown({x:-1,z:0},guard())).toBe(true);expect(canTakedown({x:1,z:0},guard())).toBe(false);expect(canTakedown({x:-1,z:0},guard({state:'alert'}))).toBe(false)});it('completes objective and mission outcomes',()=>{expect(objectiveReached(OBJECTIVE)).toBe(true);expect(evaluateMission(true,EXTRACTION,false)).toBe('won');expect(evaluateMission(false,EXTRACTION,false)).toBe('playing');expect(evaluateMission(true,EXTRACTION,true)).toBe('lost')});it('round trips and validates settings',()=>{expect(parseSettings(serializeSettings(defaults))).toEqual(defaults);expect(parseSettings('{"volume":9}').volume).toBe(1);expect(parseSettings('bad')).toEqual(defaults);expect(parseSettings('{"visionCones":false}').visionCones).toBe(false)})});

describe('pointer input',()=>{
  it('accepts a short stationary press as a tap',async()=>{
    const {isTap}=await import('../src/input/input');
    expect(isTap({x:10,y:20,time:100},{x:18,y:25,time:450})).toBe(true);
  });
  it('does not turn camera gestures or long presses into movement taps',async()=>{
    const {isTap}=await import('../src/input/input');
    expect(isTap({x:10,y:20,time:100},{x:30,y:20,time:200})).toBe(false);
    expect(isTap({x:10,y:20,time:100},{x:10,y:20,time:601})).toBe(false);
  });
});

describe('camera framing',()=>{
  it('uses a wider horizontal field of view in portrait',async()=>{
    const {cameraFraming}=await import('../src/rendering/framing');
    expect(cameraFraming(390/844)).toEqual({fov:1.35,horizontal:true});
    expect(cameraFraming(16/9)).toEqual({fov:0.8,horizontal:false});
  });
});

describe('camera controls',()=>{
  it('zooms within camera limits',async()=>{
    const {updateCamera}=await import('../src/camera/controls');
    expect(updateCamera({alpha:0,radius:16},'zoom-in').radius).toBe(14);
    expect(updateCamera({alpha:0,radius:37},'zoom-out').radius).toBe(38);
  });
  it('rotates in both directions without changing zoom',async()=>{
    const {updateCamera}=await import('../src/camera/controls');
    const left=updateCamera({alpha:0,radius:28},'rotate-left');
    const right=updateCamera({alpha:0,radius:28},'rotate-right');
    expect(left.alpha).toBeCloseTo(-Math.PI/8);
    expect(right.alpha).toBeCloseTo(Math.PI/8);
    expect(left.radius).toBe(28);
    expect(right.radius).toBe(28);
  });
});

describe('phase two movement and accessibility',()=>{
  it('moves crouched players more slowly',async()=>{const {movePlayer}=await import('../src/movement/movement');const standing={position:{x:0,z:0},selected:true,path:[{x:4,z:0}],crouched:false};const crouched={...standing,position:{x:0,z:0},path:[{x:4,z:0}],crouched:true};movePlayer(standing,.25);movePlayer(crouched,.25);expect(standing.position.x).toBeGreaterThan(crouched.position.x)});
  it('requires longer exposure while crouched',()=>{expect(updateExposure(0,true,1.5,2.1).detected).toBe(false);expect(updateExposure(0,true,1.5,1.4).detected).toBe(true)});
  it('persists accessibility settings',()=>{expect(parseSettings('{"reducedMotion":true,"highContrast":true}')).toMatchObject({reducedMotion:true,highContrast:true})});
});

describe('crouch state',()=>{
  it('toggles only while playing and resets on restart',async()=>{const {Game,LEVEL_OBSTACLES}=await import('../src/core/game');const game=new Game(LEVEL_OBSTACLES);game.toggleCrouch();expect(game.player.crouched).toBe(true);game.toggleCrouch();expect(game.player.crouched).toBe(false);game.toggleCrouch();game.phase='paused';game.toggleCrouch();expect(game.player.crouched).toBe(true);game.restart();expect(game.player.crouched).toBe(false)});
});

describe('phase two hardening',()=>{it('shares configured vision geometry',async()=>{const {VISION_RANGE,VISION_HALF_ANGLE}=await import('../src/vision/config');expect(inVision({x:0,z:0},{x:1,z:0},{x:VISION_RANGE,z:0},VISION_RANGE,VISION_HALF_ANGLE)).toBe(true)});it('rejects paths with blocked starts',async()=>{const {GridNavigator}=await import('../src/navigation/grid');expect(new GridNavigator(10,[{x:0,z:0,w:2,h:2}]).findPath({x:0,z:0},{x:4,z:4})).toEqual([])})});

describe('guard state hardening',()=>{it('alert ignores sound and returns only after losing sight',()=>{const alerted=guard({state:'alert',stateTime:4});expect(transitionGuard(alerted,'heard',1).state).toBe('alert');expect(transitionGuard(alerted,'lost',.1).state).toBe('return')});it('defeated guards never transition',()=>{const defeated=guard({defeated:true,state:'patrol'});expect(transitionGuard(defeated,'see',10)).toBe(defeated)})});

describe('paused interactions and action results',()=>{it('reports distraction success only when emitted',async()=>{const {Game,LEVEL_OBSTACLES}=await import('../src/core/game');const game=new Game(LEVEL_OBSTACLES);expect(game.sound()).toBe(true);expect(game.sound()).toBe(false);game.phase='paused';game.cooldown=0;expect(game.sound()).toBe(false)});it('prevents takedowns while paused and reports failures',async()=>{const {Game,LEVEL_OBSTACLES}=await import('../src/core/game');const game=new Game(LEVEL_OBSTACLES);game.player.position={x:-11,z:-8};expect(game.takedown()).toBe(true);game.restart();game.player.position={x:-11,z:-8};game.phase='paused';expect(game.takedown()).toBe(false);expect(game.guards[0].defeated).toBe(false)})});

describe('reliable guard detection',()=>{it('detects sustained standing exposure promptly',async()=>{const {Game}=await import('../src/core/game');const game=new Game([]);game.player.position={x:-6,z:-8};game.update(.76);expect(game.phase).toBe('lost')});it('retains partial exposure across brief visibility interruptions',()=>{const built=updateExposure(.5,false,.2);expect(built.value).toBeGreaterThan(.4);expect(updateExposure(built.value,true,.35,.75).detected).toBe(true)});it('still gives crouched operatives a longer reaction window',async()=>{const {Game}=await import('../src/core/game');const game=new Game([]);game.player.position={x:-6,z:-8};game.player.crouched=true;game.update(.8);expect(game.phase).toBe('playing');game.update(.46);expect(game.phase).toBe('lost')})});
