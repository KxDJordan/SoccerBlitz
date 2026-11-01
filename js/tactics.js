'use strict';
// ── TACTICS: roles, formations, instructions ──────────────────────
// A team has two shapes: the in-possession (IP) formation it attacks in and the out-of-possession (OOP)
// formation it defends in. Every player owns one OOP slot, is mapped onto one IP slot, and carries a role
// for each phase: the IP role drives what he does with and without the ball when his side has it, the OOP
// role drives how he presses, tackles and holds his zone when it doesn't.

const TAC = (() => {
  const BASE = { pass: 1, dribble: 1, shoot: 1, cross: 1, run: 1, press: 1, direct: 1, tackle: 1, aerial: 1, curl: 1 };
  const LIST = [];
  // role(id, name, short, positions, description, weights, attack offset, defend offset, extra, training keys)
  function role(id, name, short, slots, desc, w, attack = {}, defend = {}, extra = {}, keys = []) {
    LIST.push({ id, name, short, slots, desc, w: { ...BASE, ...w }, attack: { du: 0, dv: 0, ...attack }, defend: { du: 0, dv: 0, ...defend }, keys, ...extra });
  }
  const FB = ['LB', 'RB'];
  const WIDE_MID = ['LM', 'RM'];
  const WIDE_ALL = ['LM', 'RM', 'LW', 'RW'];
  const WINGS = ['LW', 'RW'];

  // goalkeepers
  role('gk', 'Goalkeeper', 'GK', ['GK'], 'Stays on the line and keeps distribution simple.', { dribble: 0.05, direct: 1.2, run: 0 }, {}, {}, {}, ['goalkeeping', 'positioning', 'composure']);
  role('sk', 'Sweeper Keeper', 'SK', ['GK'], 'Starts high to sweep behind the defensive line and plays short out from the back.', { dribble: 0.05, pass: 1.15, direct: 0.8, run: 0 }, {}, {}, { sweeper: true }, ['goalkeeping', 'passing', 'accel']);

  // centre-backs
  role('cd', 'Central Defender', 'CD', ['CB'], 'Defends first. Clears danger and keeps passes simple.', { dribble: 0.35, shoot: 0.3, run: 0.05, direct: 1.15, press: 0.9 }, {}, {}, {}, ['tackling', 'marking', 'heading']);
  role('bpd', 'Ball-Playing Defender', 'BPD', ['CB'], 'Steps into midfield with the ball and looks for line-breaking passes.', { dribble: 0.6, shoot: 0.3, run: 0.05, pass: 1.25, direct: 1.35 }, {}, {}, {}, ['passing', 'vision', 'composure']);
  role('stp', 'Stopper', 'STP', ['CB'], 'Steps out of the line aggressively to attack the ball.', { dribble: 0.35, shoot: 0.3, run: 0.05, press: 1.6, tackle: 1.3 }, {}, { du: 0.04 }, {}, ['tackling', 'aggression', 'strength']);
  role('cov', 'Covering Defender', 'COV', ['CB'], 'Drops off to sweep up behind the line and reads danger early.', { dribble: 0.3, shoot: 0.2, run: 0, press: 0.6, tackle: 0.9 }, { du: -0.02 }, { du: -0.04 }, {}, ['positioning', 'pace', 'marking']);
  role('wcb', 'Wide Centre-Back', 'WCB', ['CB'], 'Splits wide in possession to carry the ball into the channels and overlap.', { dribble: 0.8, cross: 0.8, run: 0.4, pass: 1.1 }, { du: 0.06, dv: -0.1 }, {}, {}, ['dribbling', 'stamina', 'crossing']);
  role('lib', 'Libero', 'LIB', ['CB'], 'Steps out of the back line into midfield with the ball, then sweeps behind it without.', { dribble: 0.9, pass: 1.3, direct: 1.2, run: 0.3, shoot: 0.5 }, { du: 0.16 }, { du: -0.03 }, { roam: 1.1 }, ['passing', 'vision', 'positioning']);

  // full-backs
  role('fb', 'Full-Back', 'FB', FB, 'Balanced: supports attacks down the flank but prioritises defending.', { run: 0.6, cross: 1.0, shoot: 0.4 }, { du: 0.12, dv: -0.02 }, {}, {}, ['tackling', 'stamina', 'crossing']);
  role('nfb', 'No-Nonsense Full-Back', 'NFB', FB, 'Stays home, wins his duels and clears his lines.', { run: 0.2, cross: 0.6, shoot: 0.2, dribble: 0.4, tackle: 1.2 }, { du: 0.02 }, { du: -0.01 }, {}, ['tackling', 'marking', 'strength']);
  role('wb', 'Wing-Back', 'WB', FB, 'Bombs forward to provide width and crosses; leaves space behind.', { run: 1.4, cross: 1.4, dribble: 1.1, shoot: 0.5 }, { du: 0.28, dv: -0.04 }, { du: 0.03 }, {}, ['stamina', 'crossing', 'pace']);
  role('ifb', 'Inverted Full-Back', 'IFB', FB, 'Tucks into midfield in possession to add a passer centrally.', { run: 0.4, cross: 0.4, pass: 1.2, shoot: 0.4 }, { du: 0.12, dv: 0.2 }, {}, {}, ['passing', 'positioning', 'composure']);
  role('flb', 'Falseback', 'FLB', FB, 'Steps right up into central midfield in possession as an extra playmaker.', { run: 0.35, cross: 0.3, pass: 1.3, direct: 1.1, shoot: 0.5, dribble: 0.8 }, { du: 0.3, dv: 0.3 }, {}, {}, ['passing', 'vision', 'dribbling']);
  role('awb', 'Attacking Wing-Back', 'AWB', FB, 'Plays almost as a winger in possession: overlaps high and crosses early.', { run: 1.9, cross: 1.5, dribble: 1.2, shoot: 0.7 }, { du: 0.42, dv: -0.06 }, { du: 0.06 }, { roam: 1.2 }, ['pace', 'crossing', 'dribbling']);
  role('iwb', 'Inverted Wing-Back', 'IWB', FB, 'Pushes high through the half-space and arrives as an extra attacker.', { run: 1.4, cross: 0.7, pass: 1.15, dribble: 1.1, shoot: 0.9 }, { du: 0.34, dv: 0.18 }, { du: 0.03 }, { roam: 1.15 }, ['passing', 'dribbling', 'stamina']);

  // defensive midfield
  role('anc', 'Anchor', 'A', ['DM'], 'Sits in front of the defence, screens passing lanes and rarely leaves position.', { run: 0.1, press: 0.6, dribble: 0.6, shoot: 0.5 }, { du: -0.06 }, { du: -0.03 }, { roam: 0.8 }, ['positioning', 'marking', 'tackling']);
  role('ch', 'Centre-Half', 'CH', ['DM'], 'Drops between the centre-backs to make a back three in possession.', { run: 0.05, pass: 1.2, direct: 1.15, dribble: 0.5, shoot: 0.3, press: 0.7 }, { du: -0.11 }, { du: -0.04 }, { roam: 0.8 }, ['passing', 'positioning', 'heading']);
  role('bwm', 'Ball-Winning Midfielder', 'BWM', ['DM', 'MF'], 'Hunts the ball, presses and tackles relentlessly.', { run: 0.5, press: 1.8, tackle: 1.4, pass: 0.9 }, {}, {}, { roam: 1.3 }, ['tackling', 'aggression', 'stamina']);
  role('dlp', 'Deep-Lying Playmaker', 'DLP', ['DM', 'MF'], 'Dictates play from deep with long, progressive passing.', { run: 0.3, pass: 1.4, direct: 1.3, press: 0.8, dribble: 0.8, curl: 1.2 }, { du: -0.04 }, {}, {}, ['passing', 'vision', 'curve']);
  role('reg', 'Regista', 'REG', ['DM'], 'A free-roaming deep creator who takes every risk to unlock the defence.', { run: 0.4, pass: 1.55, direct: 1.45, dribble: 1.0, press: 0.6, curl: 1.3 }, { du: 0.02 }, {}, { roam: 1.2 }, ['vision', 'passing', 'curve']);
  role('vol', 'Segundo Volante', 'VOL', ['DM'], 'Starts deep but bursts forward late to arrive on the edge of the box.', { run: 1.5, shoot: 1.3, press: 1.1, pass: 0.95 }, { du: 0.16 }, {}, { roam: 1.4 }, ['stamina', 'finishing', 'tackling']);

  // central midfield
  role('cm', 'Central Midfielder', 'CM', ['MF', 'DM'], 'All-round midfielder who links defence and attack.', { run: 0.8 }, {}, {}, {}, ['passing', 'stamina', 'tackling']);
  role('b2b', 'Box-to-Box', 'B2B', ['MF'], 'Covers every blade of grass, arriving in the box and pressing back.', { run: 1.5, press: 1.25, shoot: 1.1 }, { du: 0.1 }, {}, { roam: 1.8 }, ['stamina', 'tackling', 'finishing']);
  role('bc', 'Box Crasher', 'BC', ['MF'], 'Makes late, lung-busting runs to arrive in the box as a second striker.', { run: 1.9, shoot: 1.3, pass: 0.9, press: 1.1 }, { du: 0.16 }, {}, { roam: 1.4 }, ['finishing', 'stamina', 'positioning']);
  role('mez', 'Mezzala', 'MEZ', ['MF'], 'Drifts into the half-space wide of the box to combine and create.', { run: 1.3, dribble: 1.25, pass: 1.15, shoot: 1.1, cross: 1.1 }, { du: 0.14, dv: -0.12 }, {}, { roam: 1.2 }, ['dribbling', 'passing', 'vision']);
  role('car', 'Carrilero', 'CAR', ['MF'], 'Shuttles across to cover the flank and keeps the ball moving simply.', { run: 0.5, pass: 1.05, press: 1.1, tackle: 1.1, dribble: 0.7, shoot: 0.6 }, { dv: -0.05 }, { dv: -0.05 }, { roam: 1.3 }, ['stamina', 'positioning', 'passing']);
  role('hw', 'Half-Winger', 'HW', ['MF', 'AM'], 'Drifts out into the half-space high up the pitch to combine with the winger.', { run: 1.2, dribble: 1.2, pass: 1.15, cross: 1.2 }, { du: 0.14, dv: -0.14 }, {}, {}, ['crossing', 'dribbling', 'pace']);

  // attacking midfield
  role('ap', 'Advanced Playmaker', 'AP', ['AM', 'MF'], 'Finds pockets between the lines and creates chances.', { pass: 1.4, dribble: 1.1, direct: 1.2, run: 0.8, press: 0.8, curl: 1.2 }, { du: 0.05 }, {}, {}, ['vision', 'passing', 'dribbling']);
  role('ss', 'Shadow Striker', 'SS', ['AM'], 'Runs beyond the striker to attack the box.', { run: 1.7, shoot: 1.4, pass: 0.8 }, { du: 0.18 }, { du: 0.04 }, {}, ['finishing', 'accel', 'positioning']);
  role('c10', 'Classic 10', 'C10', ['AM'], 'A free-roaming number ten: finds space anywhere to create, but barely defends.', { pass: 1.5, dribble: 1.25, direct: 1.25, shoot: 1.1, run: 0.6, press: 0.45, curl: 1.3 }, { du: 0.08 }, { du: 0.12 }, {}, ['vision', 'curve', 'composure']);
  role('tre', 'Trequartista', 'TRQ', ['AM', 'ST'], 'Free to wander anywhere in the final third, pulling defenders out of shape.', { pass: 1.35, dribble: 1.4, shoot: 1.25, run: 0.7, press: 0.35, curl: 1.4 }, { du: 0.04 }, { du: 0.14 }, { roam: 1.6 }, ['dribbling', 'curve', 'vision']);
  role('enz', 'Enganche', 'ENG', ['AM'], 'A static hub behind the striker; everything goes through his feet.', { pass: 1.55, dribble: 0.9, run: 0.2, shoot: 0.9, press: 0.5, direct: 1.3 }, { du: -0.04 }, { du: 0.1 }, { roam: 0.8 }, ['vision', 'passing', 'composure']);

  // wide players
  role('wm', 'Wide Midfielder', 'WM', WIDE_MID, 'Works up and down the flank, tracking back diligently.', { run: 0.9, press: 1.15, cross: 1.1 }, {}, {}, { roam: 1.25 }, ['stamina', 'crossing', 'tackling']);
  role('dw', 'Defensive Winger', 'DW', WIDE_ALL, 'A winger who presses the full-back and doubles up without the ball.', { run: 0.8, press: 1.5, tackle: 1.2, cross: 1.1 }, {}, { du: -0.04 }, { roam: 1.3 }, ['stamina', 'tackling', 'crossing']);
  role('wng', 'Winger', 'W', WIDE_ALL, 'Hugs the touchline, beats the full-back and delivers crosses.', { cross: 1.6, dribble: 1.3, run: 1.1, press: 0.8 }, { du: 0.1, dv: -0.06 }, { du: 0.06, dv: -0.03 }, {}, ['pace', 'dribbling', 'crossing']);
  role('if', 'Inside Forward', 'IF', WIDE_ALL, 'Cuts inside from the flank as a goal threat, attacking crosses at the far post.', { shoot: 1.6, dribble: 1.3, cross: 0.4, run: 1.45, press: 0.8, curl: 1.4 }, { du: 0.2, dv: 0.24 }, { du: 0.08 }, {}, ['finishing', 'dribbling', 'curve']);
  role('iw', 'Inverted Winger', 'IW', WIDE_ALL, 'Drives inside onto his stronger foot to whip in-swinging balls and slide passes.', { pass: 1.25, dribble: 1.25, cross: 1.1, shoot: 1.1, run: 1.0, curl: 1.5 }, { du: 0.12, dv: 0.14 }, { du: 0.05 }, {}, ['curve', 'passing', 'dribbling']);
  role('wp', 'Wide Playmaker', 'WP', WIDE_ALL, 'Starts wide, then drifts inside and a little deeper to dictate play.', { pass: 1.4, direct: 1.2, dribble: 1.1, cross: 0.8, run: 0.5, shoot: 0.9 }, { du: -0.02, dv: 0.2 }, {}, {}, ['vision', 'passing', 'composure']);
  role('rau', 'Raumdeuter', 'RAU', WINGS, 'A space investigator: ghosts into the box from the flank to poach.', { shoot: 1.7, run: 1.7, dribble: 0.8, cross: 0.4, pass: 0.7, press: 0.6 }, { du: 0.24, dv: 0.28 }, { du: 0.1 }, {}, ['positioning', 'finishing', 'composure']);
  role('wtm', 'Wide Target Man', 'WTM', WIDE_ALL, 'A big body on the flank who wins long diagonals and lays them off.', { dribble: 0.6, aerial: 1.5, run: 0.7, pass: 1.05 }, { du: 0.08 }, { du: 0.04 }, {}, ['heading', 'strength', 'passing']);

  // strikers
  role('af', 'Advanced Forward', 'AF', ['ST'], 'Plays on the shoulder of the last defender and runs into the gaps in behind.', { run: 1.5, shoot: 1.1, press: 0.8 }, { du: 0.03 }, { du: 0.1 }, {}, ['pace', 'finishing', 'accel']);
  role('tm', 'Target Man', 'TM', ['ST'], 'Physical focal point who wins headers and holds the ball up.', { dribble: 0.5, run: 0.6, aerial: 1.5, press: 0.7 }, { du: -0.02 }, { du: 0.1 }, { holdUp: true }, ['heading', 'strength', 'composure']);
  role('pch', 'Poacher', 'P', ['ST'], 'Lurks in the box waiting for chances. Barely defends.', { shoot: 1.6, pass: 0.7, press: 0.45, run: 1.2 }, { du: 0.05 }, { du: 0.17 }, {}, ['finishing', 'positioning', 'composure']);
  role('f9', 'False Nine', 'F9', ['ST'], 'Drops deep to link play and drag centre-backs out of position.', { pass: 1.4, dribble: 1.2, run: 0.4, shoot: 0.9 }, { du: -0.18 }, {}, {}, ['passing', 'vision', 'dribbling']);
  role('dlf', 'Deep-Lying Forward', 'DLF', ['ST'], 'Comes short to receive with his back to goal and brings others in.', { pass: 1.25, dribble: 0.9, run: 0.6, shoot: 1.0, aerial: 1.1 }, { du: -0.1 }, { du: 0.06 }, { holdUp: true }, ['passing', 'strength', 'composure']);
  role('cf', 'Complete Forward', 'CF', ['ST'], 'Does it all: holds it up, runs in behind, creates and finishes.', { pass: 1.15, dribble: 1.15, shoot: 1.25, run: 1.15, aerial: 1.2 }, {}, { du: 0.08 }, {}, ['finishing', 'dribbling', 'heading']);
  role('pf', 'Pressing Forward', 'PF', ['ST', 'LW', 'RW'], 'Leads the press from the front, harrying defenders into mistakes.', { press: 2.0, tackle: 1.3, run: 1.1 }, {}, {}, { roam: 1.4 }, ['stamina', 'aggression', 'tackling']);

  const ROLES = Object.fromEntries(LIST.map(r => [r.id, r]));
  const rolesFor = pos => LIST.filter(r => r.slots.includes(pos));
  const DEFAULT_ROLE = { GK: 'gk', CB: 'cd', LB: 'fb', RB: 'fb', DM: 'anc', MF: 'cm', LM: 'wm', RM: 'wm', AM: 'ap', LW: 'wng', RW: 'wng', ST: 'af' };
  const defaultRole = pos => DEFAULT_ROLE[pos];

  // ── formations: slot 0 is always the keeper; u = depth in the block (0 back line, 1 strikers), v = left..right ──
  const s = (pos, u, v) => ({ pos, u, v });
  const GK = s('GK', 0, 0.5);
  const B4 = [s('LB', 0, 0.1), s('CB', 0, 0.37), s('CB', 0, 0.63), s('RB', 0, 0.9)];
  const B3 = [s('CB', 0, 0.24), s('CB', 0, 0.5), s('CB', 0, 0.76)];
  const B5 = [s('LB', 0.05, 0.07), s('CB', 0, 0.28), s('CB', 0, 0.5), s('CB', 0, 0.72), s('RB', 0.05, 0.93)];
  const F = (id, slots, note) => ({ id, name: id, slots: [GK, ...slots], note });
  const FORMATIONS = {};
  [
    F('4-4-2', [...B4, s('LM', 0.45, 0.1), s('MF', 0.45, 0.38), s('MF', 0.45, 0.62), s('RM', 0.45, 0.9), s('ST', 1, 0.38), s('ST', 1, 0.62)], 'The classic. Two banks of four, two up top.'),
    F('4-3-3', [...B4, s('DM', 0.25, 0.5), s('MF', 0.45, 0.3), s('MF', 0.45, 0.7), s('LW', 0.85, 0.12), s('ST', 1, 0.5), s('RW', 0.85, 0.88)], 'Width from the wingers, control from the midfield three.'),
    F('4-2-3-1', [...B4, s('DM', 0.25, 0.38), s('DM', 0.25, 0.62), s('LW', 0.7, 0.12), s('AM', 0.7, 0.5), s('RW', 0.7, 0.88), s('ST', 1, 0.5)], 'A double pivot protects the back four; a 10 pulls the strings.'),
    F('4-1-4-1', [...B4, s('DM', 0.22, 0.5), s('LM', 0.5, 0.1), s('MF', 0.5, 0.38), s('MF', 0.5, 0.62), s('RM', 0.5, 0.9), s('ST', 1, 0.5)], 'Compact and hard to play through.'),
    F('4-4-1-1', [...B4, s('LM', 0.45, 0.1), s('MF', 0.45, 0.38), s('MF', 0.45, 0.62), s('RM', 0.45, 0.9), s('AM', 0.75, 0.5), s('ST', 1, 0.5)], 'A 4-4-2 with a striker dropping off into the hole.'),
    F('4-1-2-1-2', [...B4, s('DM', 0.22, 0.5), s('MF', 0.45, 0.28), s('MF', 0.45, 0.72), s('AM', 0.7, 0.5), s('ST', 1, 0.38), s('ST', 1, 0.62)], 'The diamond: overload the middle, full-backs give the width.'),
    F('4-3-2-1', [...B4, s('MF', 0.4, 0.28), s('DM', 0.3, 0.5), s('MF', 0.4, 0.72), s('AM', 0.74, 0.34), s('AM', 0.74, 0.66), s('ST', 1, 0.5)], 'The Christmas tree: two tens behind a lone striker.'),
    F('4-2-4', [...B4, s('MF', 0.4, 0.38), s('MF', 0.4, 0.62), s('LW', 0.92, 0.1), s('ST', 1, 0.38), s('ST', 1, 0.62), s('RW', 0.92, 0.9)], 'Throw the kitchen sink. Four forwards, no apologies.'),
    F('3-5-2', [...B3, s('LM', 0.4, 0.06), s('DM', 0.25, 0.5), s('MF', 0.45, 0.32), s('MF', 0.45, 0.68), s('RM', 0.4, 0.94), s('ST', 1, 0.38), s('ST', 1, 0.62)], 'Three at the back, wing-backs on the flanks.'),
    F('3-4-3', [...B3, s('LM', 0.45, 0.06), s('MF', 0.4, 0.38), s('MF', 0.4, 0.62), s('RM', 0.45, 0.94), s('LW', 0.86, 0.16), s('ST', 1, 0.5), s('RW', 0.86, 0.84)], 'Aggressive width with a front three.'),
    F('3-2-4-1', [...B3, s('DM', 0.36, 0.38), s('DM', 0.36, 0.62), s('LW', 0.7, 0.08), s('AM', 0.66, 0.34), s('AM', 0.66, 0.66), s('RW', 0.7, 0.92), s('ST', 1, 0.5)], 'The modern box midfield: build with three, attack with five.'),
    F('3-2-5', [...B3, s('DM', 0.36, 0.38), s('DM', 0.36, 0.62), s('LW', 0.86, 0.05), s('AM', 0.66, 0.32), s('ST', 1, 0.5), s('AM', 0.66, 0.68), s('RW', 0.86, 0.95)], 'In-possession shape: five lanes occupied across the front.'),
    F('2-3-5', [s('CB', 0, 0.36), s('CB', 0, 0.64), s('LM', 0.32, 0.12), s('DM', 0.26, 0.5), s('RM', 0.32, 0.88), s('LW', 0.9, 0.05), s('AM', 0.7, 0.3), s('ST', 1, 0.5), s('AM', 0.7, 0.7), s('RW', 0.9, 0.95)], 'The old pyramid, reborn as an all-out attacking shape.'),
    F('5-3-2', [...B5, s('MF', 0.45, 0.28), s('DM', 0.36, 0.5), s('MF', 0.45, 0.72), s('ST', 1, 0.38), s('ST', 1, 0.62)], 'A back five behind a hard-working three.'),
    F('5-4-1', [...B5, s('LM', 0.45, 0.1), s('MF', 0.42, 0.38), s('MF', 0.42, 0.62), s('RM', 0.45, 0.9), s('ST', 1, 0.5)], 'Ten men behind the ball. Good luck getting through.'),
  ].forEach(f => { FORMATIONS[f.id] = f; });
  // 3-2-5 and 2-3-5 were attacking-only shapes; roles now build those (inverted full-backs, inside forwards)
  const FORMATION_IDS = Object.keys(FORMATIONS).filter(id => id !== '3-2-5' && id !== '2-3-5');

  // 5-a-side academy shapes
  const FORMATIONS5 = {};
  [
    F('1-2-1', [s('CB', 0, 0.5), s('LM', 0.5, 0.15), s('RM', 0.5, 0.85), s('ST', 1, 0.5)], 'The diamond.'),
    F('2-1-1', [s('CB', 0, 0.3), s('CB', 0, 0.7), s('MF', 0.5, 0.5), s('ST', 1, 0.5)], 'Solid at the back.'),
    F('2-2', [s('CB', 0, 0.3), s('CB', 0, 0.7), s('ST', 1, 0.3), s('ST', 1, 0.7)], 'The box.'),
    F('1-1-2', [s('CB', 0, 0.5), s('MF', 0.45, 0.5), s('LW', 1, 0.22), s('RW', 1, 0.78)], 'Three going forward.'),
  ].forEach(f => { FORMATIONS5[f.id] = f; });

  const formation = id => FORMATIONS[id] || FORMATIONS5[id] || FORMATIONS['4-4-2'];

  // ── IP <-> OOP mapping: which in-possession slot each defensive slot moves to ──
  // A minimum-movement assignment: greedy by distance, then improved by pairwise swaps.
  function autoMap(oopId, ipId) {
    const A = formation(oopId).slots, B = formation(ipId).slots, n = A.length;
    const cost = (i, j) => Math.hypot(A[i].u - B[j].u, (A[i].v - B[j].v) * 1.4) + (A[i].pos === B[j].pos ? 0 : 0.06);
    const map = new Array(n).fill(-1);
    map[0] = 0;
    const pairs = [];
    for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) pairs.push([cost(i, j), i, j]);
    pairs.sort((a, b) => a[0] - b[0]);
    const usedB = new Set([0]);
    for (const [, i, j] of pairs) if (map[i] < 0 && !usedB.has(j)) { map[i] = j; usedB.add(j); }
    for (let pass = 0; pass < 6; pass++) {
      let better = false;
      for (let i = 1; i < n; i++) for (let k = i + 1; k < n; k++) {
        if (cost(i, map[k]) + cost(k, map[i]) < cost(i, map[i]) + cost(k, map[k]) - 1e-9) { [map[i], map[k]] = [map[k], map[i]]; better = true; }
      }
      if (!better) break;
    }
    return map;
  }

  // ── instructions ──
  const defaultTeam = () => ({ mentality: 0, width: 0, lineHeight: 0, pressing: 0, tackling: 0, tempo: 0, directness: 0 });
  const three = (lo, mid, hi) => [{ value: -1, label: lo }, { value: 0, label: mid }, { value: 1, label: hi }];
  const TEAM_OPTIONS = [
    { key: 'mentality', label: 'Mentality', options: [{ value: -2, label: 'Defensive' }, { value: -1, label: 'Cautious' }, { value: 0, label: 'Balanced' }, { value: 1, label: 'Positive' }, { value: 2, label: 'All-out' }] },
    { key: 'width', label: 'Width', options: three('Narrow', 'Normal', 'Wide') },
    { key: 'lineHeight', label: 'Defensive line', options: three('Deep', 'Normal', 'High') },
    { key: 'pressing', label: 'Pressing', options: three('Low', 'Normal', 'High') },
    { key: 'tackling', label: 'Tackling', options: three('Stay on feet', 'Normal', 'Hit hard') },
    { key: 'tempo', label: 'Tempo', options: three('Slow', 'Normal', 'Fast') },
    { key: 'directness', label: 'Passing', options: three('Short', 'Mixed', 'Direct') },
  ];
  const PLAYER_OPTIONS = [
    { key: 'agg', label: 'Aggression', options: three('Low', 'Normal', 'High') },
    { key: 'runs', label: 'Role focus', options: three('Defend', 'Balanced', 'Attack') },
    { key: 'shoot', label: 'Shooting', options: three('Less', 'Normal', 'More') },
  ];
  const defaultInstr = () => ({ agg: 0, runs: 0, shoot: 0 });

  // a fresh tactics object: lineup filled later by the caller
  // One shape, one role per player. The role is what moves him: where he drifts when his side has the ball
  // and where he holds when it doesn't. (The engine still reads ip/map/rIP; they always mirror the shape.)
  function make(form, _unused, team) {
    const fo = formation(form);
    return {
      oop: form, ip: form, map: fo.slots.map((_, i) => i),
      lineup: new Array(fo.slots.length).fill(null),
      rOOP: fo.slots.map(sl => defaultRole(sl.pos)),
      rIP: fo.slots.map(sl => defaultRole(sl.pos)),
      instr: fo.slots.map(defaultInstr),
      team: { ...defaultTeam(), ...(team || {}) },
      bench: [],
    };
  }
  const ipPos = (t, i) => formation(t.oop).slots[i].pos;
  const oopPos = (t, i) => formation(t.oop).slots[i].pos;
  const roleOf = (t, i) => t.rOOP[i];
  // keep the engine's two-phase fields in step with the single shape (also migrates older saves)
  function normalize(t) {
    if (!t) return t;
    if (!FORMATIONS[t.oop] || !FORMATION_IDS.includes(t.oop)) t.oop = FORMATION_IDS.includes(t.ip) ? t.ip : '4-3-3';
    const fo = formation(t.oop);
    t.ip = t.oop;
    t.map = fo.slots.map((_, i) => i);
    t.rOOP = fo.slots.map((sl, i) => (ROLES[t.rOOP && t.rOOP[i]] && ROLES[t.rOOP[i]].slots.includes(sl.pos) ? t.rOOP[i] : defaultRole(sl.pos)));
    t.rIP = [...t.rOOP];
    t.instr = fo.slots.map((_, i) => ({ ...defaultInstr(), ...((t.instr && t.instr[i]) || {}) }));
    if (t.lineup.length !== fo.slots.length) t.lineup = fo.slots.map((_, i) => t.lineup[i] ?? null);
    return t;
  }
  function setFormation(t, _which, id) {
    const old = formation(t.oop).slots;
    t.oop = id;
    const nu = formation(id).slots;
    t.rOOP = nu.map((sl, i) => (old[i] && old[i].pos === sl.pos && ROLES[t.rOOP[i]] && ROLES[t.rOOP[i]].slots.includes(sl.pos) ? t.rOOP[i] : defaultRole(sl.pos)));
    normalize(t);
  }
  function setRole(t, i, id) { if (ROLES[id]) { t.rOOP[i] = id; t.rIP[i] = id; } }
  // where a role takes a player, in team-block units (for the board): +u is upfield, +v toward the middle
  function zones(roleId, focus = 0) {
    const r = ROLES[roleId];
    if (!r) return { att: { du: 0, dv: 0 }, def: { du: 0, dv: 0 } };
    return {
      att: { du: r.attack.du * (1 + 0.45 * focus) + 0.035 * focus, dv: r.attack.dv * (1 + 0.3 * focus) },
      def: { du: r.defend.du + 0.03 * focus, dv: r.defend.dv },
    };
  }
  function clone(t) {
    return { ...t, map: [...t.map], lineup: [...t.lineup], rOOP: [...t.rOOP], rIP: [...t.rIP], instr: t.instr.map(x => ({ ...x })), team: { ...t.team }, bench: [...(t.bench || [])] };
  }

  // how comfortable a player is in a position, 0.35..1
  function fam(p, pos) {
    if (p.pos === pos) return 1;
    let f;
    if (p.alt && p.alt.includes(pos)) f = 0.96;
    else if (p.pos === 'GK' || pos === 'GK') f = 0.35;
    else { const a = DATA.POS_UV[p.pos], b = DATA.POS_UV[pos]; f = U.clamp(1 - Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.85) * 0.6, 0.55, 0.92); }
    // retraining into a position: he gets more comfortable there week by week
    if (p.trainPos === pos && p.retrain) f += (0.97 - f) * p.retrain;
    return f;
  }

  return { ROLES, LIST, rolesFor, defaultRole, FORMATIONS, FORMATION_IDS, FORMATIONS5, formation, autoMap, TEAM_OPTIONS, PLAYER_OPTIONS, defaultTeam, defaultInstr, make, ipPos, oopPos, roleOf, normalize, setFormation, setRole, zones, clone, fam };
})();
