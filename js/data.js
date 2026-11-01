'use strict';
// ── STATIC GAME DATA ──────────────────────────────────────────────
// Everything here is fictional: invented nations, leagues, cities and clubs.

const DATA = (() => {
  // ── positions ──
  const POS = ['GK', 'CB', 'LB', 'RB', 'DM', 'MF', 'LM', 'RM', 'AM', 'LW', 'RW', 'ST'];
  const POS_NAME = {
    GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back', DM: 'Defensive Midfielder', MF: 'Midfielder',
    LM: 'Left Midfielder', RM: 'Right Midfielder', AM: 'Attacking Midfielder', LW: 'Left Winger', RW: 'Right Winger', ST: 'Striker',
  };
  const POS_GROUP = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MID', MF: 'MID', LM: 'MID', RM: 'MID', AM: 'MID', LW: 'FWD', RW: 'FWD', ST: 'FWD' };
  // where each position lives on the pitch (u = depth 0..1, v = left..right): familiarity falls off with distance
  const POS_UV = { GK: [-0.3, 0.5], CB: [0, 0.5], LB: [0.05, 0.08], RB: [0.05, 0.92], DM: [0.25, 0.5], MF: [0.45, 0.5], LM: [0.5, 0.1], RM: [0.5, 0.9], AM: [0.7, 0.5], LW: [0.82, 0.12], RW: [0.82, 0.88], ST: [1, 0.5] };
  const SQUAD_QUOTA = { GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, MF: 3, LM: 1, RM: 1, AM: 2, LW: 1, RW: 1, ST: 3 };
  const NUM_PREF = { GK: [1, 13, 25], CB: [4, 5, 6, 15, 24], LB: [3, 12, 22], RB: [2, 21, 26], DM: [6, 16, 18], MF: [8, 14, 16], LM: [11, 17, 27], RM: [7, 17, 19], AM: [10, 20, 23], LW: [11, 7, 29], RW: [7, 17, 28], ST: [9, 19, 18] };

  // ── attributes (stored as an array on each player, in this order) ──
  const ATTRS = ['pace', 'accel', 'stamina', 'strength', 'passing', 'vision', 'dribbling', 'finishing', 'crossing', 'curve', 'heading', 'tackling', 'marking', 'positioning', 'composure', 'aggression', 'goalkeeping'];
  const AK = Object.fromEntries(ATTRS.map((k, i) => [k, i]));
  const ATTR_SHORT = { pace: 'PAC', accel: 'ACC', stamina: 'STA', strength: 'STR', passing: 'PAS', vision: 'VIS', dribbling: 'DRI', finishing: 'FIN', crossing: 'CRO', curve: 'CUR', heading: 'HEA', tackling: 'TAC', marking: 'MAR', positioning: 'POS', composure: 'COM', aggression: 'AGG', goalkeeping: 'GK' };
  const ATTR_NAME = { pace: 'Pace', accel: 'Acceleration', stamina: 'Stamina', strength: 'Strength', passing: 'Passing', vision: 'Vision', dribbling: 'Dribbling', finishing: 'Finishing', crossing: 'Crossing', curve: 'Curve', heading: 'Heading', tackling: 'Tackling', marking: 'Marking', positioning: 'Positioning', composure: 'Composure', aggression: 'Aggression', goalkeeping: 'Goalkeeping' };
  const ATTR_GROUPS = [
    { id: 'phy', label: 'Physical', keys: ['pace', 'accel', 'stamina', 'strength'] },
    { id: 'tec', label: 'Technical', keys: ['passing', 'dribbling', 'finishing', 'crossing', 'curve', 'heading', 'tackling'] },
    { id: 'men', label: 'Mental', keys: ['vision', 'positioning', 'marking', 'composure', 'aggression'] },
    { id: 'gk', label: 'Goalkeeping', keys: ['goalkeeping'] },
  ];
  const PHYSICAL = new Set([0, 1, 2, 3]);

  // overall weights per position (normalised below)
  const RAW_W = {
    GK: { goalkeeping: 70, positioning: 9, composure: 9, passing: 5, accel: 4, strength: 3 },
    CB: { tackling: 20, marking: 20, positioning: 15, heading: 14, strength: 12, pace: 6, composure: 6, passing: 7 },
    LB: { pace: 14, accel: 6, stamina: 10, tackling: 15, marking: 12, positioning: 10, crossing: 12, dribbling: 7, passing: 9, strength: 3, curve: 2 },
    RB: { pace: 14, accel: 6, stamina: 10, tackling: 15, marking: 12, positioning: 10, crossing: 12, dribbling: 7, passing: 9, strength: 3, curve: 2 },
    DM: { tackling: 16, marking: 10, positioning: 16, passing: 16, vision: 8, composure: 10, strength: 8, stamina: 10, aggression: 6 },
    MF: { passing: 20, vision: 15, dribbling: 10, stamina: 10, composure: 10, positioning: 8, tackling: 8, finishing: 5, curve: 4, pace: 5, accel: 5 },
    LM: { pace: 14, accel: 8, crossing: 16, dribbling: 14, stamina: 12, passing: 12, vision: 6, curve: 6, finishing: 4, tackling: 4, positioning: 4 },
    RM: { pace: 14, accel: 8, crossing: 16, dribbling: 14, stamina: 12, passing: 12, vision: 6, curve: 6, finishing: 4, tackling: 4, positioning: 4 },
    AM: { vision: 18, passing: 16, dribbling: 16, finishing: 12, composure: 10, curve: 8, accel: 8, pace: 4, positioning: 8 },
    LW: { pace: 16, accel: 12, dribbling: 18, crossing: 10, finishing: 12, curve: 8, passing: 8, vision: 6, composure: 5, positioning: 5 },
    RW: { pace: 16, accel: 12, dribbling: 18, crossing: 10, finishing: 12, curve: 8, passing: 8, vision: 6, composure: 5, positioning: 5 },
    ST: { finishing: 24, positioning: 14, composure: 12, heading: 10, pace: 10, accel: 8, dribbling: 8, strength: 8, curve: 3, passing: 3 },
  };
  const OVR_W = {};
  for (const pos of POS) {
    const w = new Array(ATTRS.length).fill(0), raw = RAW_W[pos];
    const tot = Object.values(raw).reduce((a, b) => a + b, 0);
    for (const k in raw) w[AK[k]] = raw[k] / tot;
    OVR_W[pos] = w;
  }

  // ── nations, leagues, cities ──
  const NATIONS = [
    {
      id: 0, name: 'Albion', adj: 'Albion', flag: ['#C8102E', '#F4F5F7', '#13294B'], tiers: ['Crown League', 'Shield League'], short: ['CRL', 'SHL'], cup: 'Lionheart Cup',
      cities: ['Ashbury', 'Kingsbridge', 'Thornwick', 'Harrowgate', 'Blackmere', 'Redcliffe', 'Ironford', 'Wexley', 'Stormhaven', 'Brackenridge', 'Coldwater', 'Marlow Vale', 'Eastbrook', 'Saltmarsh', 'Highgrove', 'Dunmoor', 'Fenwick', 'Hollowmere', 'Oakhurst', 'Rookwood', 'Westerby', 'Lockridge', 'Pennington', 'Granby'],
      fmt: ['{c} United', '{c} City', '{c} Rovers', '{c} Athletic', '{c} Wanderers', '{c} Town', '{c} Rangers', '{c} County', '{c} Harriers', '{c} Forest', 'AFC {c}', '{c} Albion'],
      stadium: ['{c} Park', 'The {c} Ground', 'Old {c} Road', '{c} Lane', 'St. Ives Park', 'The Foundry', 'Kingsmeadow', 'The Den', 'Crown Ground'],
    },
    {
      id: 1, name: 'Iberica', adj: 'Iberican', flag: ['#F2B705', '#B3122E', '#F2B705'], tiers: ['Liga Solar', 'Liga Plata'], short: ['SOL', 'PLA'], cup: 'Copa del Sol',
      cities: ['Costavera', 'Montealto', 'San Calixto', 'Villamar', 'Puerto Brava', 'Sierranova', 'Torreluz', 'Valdeoro', 'Ribamonte', 'Lagosol', 'Castellsur', 'Almadora', 'Belcastro', 'Riofuego', 'Santa Brisa', 'Navalcruz', 'Pedrafina', 'Olmedilla', 'Aguaclara', 'Monteverde', 'Peñaroja', 'Calaterra', 'Soria Alta', 'Bahía Azul'],
      fmt: ['Real {c}', 'Atlético {c}', 'Deportivo {c}', 'Sporting {c}', 'CD {c}', '{c} CF', 'Racing {c}', 'Unión {c}', 'Club {c}', 'Juventud {c}', 'Estrella {c}', 'Real Club {c}'],
      stadium: ['Estadio {c}', 'Campo del Sol', 'El Fortín', 'La Caldera', 'Estadio Municipal', 'Nuevo {c}', 'La Bombonera de {c}'],
    },
    {
      id: 2, name: 'Rheinmark', adj: 'Rheinmark', flag: ['#15181E', '#E0262F', '#F2B705'], tiers: ['Meisterliga', 'Stahlliga'], short: ['MST', 'STH'], cup: 'Adlerpokal',
      cities: ['Rheinfeld', 'Steinburg', 'Kaltenbach', 'Wolfsau', 'Eisenhafen', 'Grünwald', 'Hohenmark', 'Falkenstadt', 'Dornholm', 'Brückhausen', 'Lindenau', 'Silberberg', 'Altmoor', 'Kronbach', 'Nordhaven', 'Ostwalde', 'Hagenfurt', 'Rotheim', 'Schwarzwasser', 'Adlersee', 'Morgenthal', 'Wendelburg', 'Tiefenbrunn', 'Ulmenau'],
      fmt: ['FC {c}', 'SV {c}', 'Fortuna {c}', 'Eintracht {c}', 'VfB {c}', 'TSV {c}', 'Union {c}', 'Dynamo {c}', '{c} 04', 'SC {c}', 'Viktoria {c}', 'Rot-Weiss {c}'],
      stadium: ['{c} Arena', 'Waldstadion', 'Stahlpark', 'Adlerhorst', '{c} Kampfbahn', 'Volksparkstadion {c}', 'Hafenarena'],
    },
    {
      id: 3, name: 'Valtoria', adj: 'Valtorian', flag: ['#1F4FBF', '#F4F5F7', '#1F8A3C'], tiers: ['Serie Oro', 'Serie Argento'], short: ['ORO', 'ARG'], cup: 'Coppa Corona',
      cities: ['Valcorte', 'Montefiora', 'San Lucero', 'Portoviva', 'Castelrosa', 'Rochebrune', 'Verdano', 'Aquila Nova', 'Torrebianca', "Sant'Elia", 'Mirafiore', 'Corvalle', 'Brezzano', 'Monteluce', 'Vallombra', 'Fontaine', 'Lazzaro', 'Belvento', 'Salvia', 'Pontecalda', 'Roccamare', 'Lucerna', 'Isola Fosca', 'Marenzo'],
      fmt: ['AC {c}', '{c} Calcio', 'Olympique {c}', 'AS {c}', 'Racing {c}', 'US {c}', 'Stade {c}', 'Inter {c}', 'Virtus {c}', 'Sporting {c}', 'Real {c}', 'FC {c}'],
      stadium: ['Stadio {c}', 'Arena Corona', 'Stade du Lac', 'Il Catino', 'Stadio dei Pini', 'Parc de {c}'],
    },
  ];
  const CONTINENTAL = 'Blitz Champions Cup';
  const INVITATIONAL = 'Summer Invitational';
  const SHOWCASE = 'Winter Showcase';

  // ── name pools ──
  const NAMES = {
    albion: {
      f: ['Jack', 'Harry', 'Oliver', 'George', 'Charlie', 'Alfie', 'Freddie', 'Archie', 'Theo', 'Leo', 'Oscar', 'Callum', 'Connor', 'Kieran', 'Declan', 'Jordan', 'Mason', 'Reece', 'Tyler', 'Lewis', 'Ryan', 'Ben', 'Sam', 'Joe', 'Tom', 'Will', 'Max', 'Ethan', 'Rhys', 'Owen', 'Jamie', 'Kai', 'Marcus', 'Bukayo', 'Jarrod', 'Danny', 'Aaron', 'Ashley', 'Ross', 'Liam'],
      l: ['Walker', 'Ashworth', 'Barnes', 'Collins', 'Davies', 'Edwards', 'Fletcher', 'Gibbs', 'Hargreaves', 'Holloway', 'Jenkins', 'Kirby', 'Lambert', 'Mills', 'Norris', 'Oakes', 'Pritchard', 'Quinn', 'Rowe', 'Sterling', 'Thornton', 'Underwood', 'Vickers', 'Whitlock', 'Yardley', 'Bramble', 'Cartwright', 'Dempsey', 'Ellison', 'Fenwick', 'Garland', 'Hendry', 'Ingram', 'Kettle', 'Lockwood', 'Marsh', 'Neville', 'Pemberton', 'Radford', 'Stokes', 'Tilbury', 'Wainwright', 'Blackwood', 'Croft', 'Dunmore'],
    },
    iberica: {
      f: ['Alejandro', 'Pablo', 'Sergio', 'Diego', 'Javier', 'Álvaro', 'Iker', 'Mateo', 'Hugo', 'Marco', 'Rodrigo', 'Gonzalo', 'Raúl', 'Fernando', 'Íñigo', 'Joaquín', 'Rúben', 'João', 'Tiago', 'Bruno', 'Nuno', 'Rafael', 'André', 'Gonçalo', 'Pedro', 'Dani', 'Nico', 'Adrián', 'Carlos', 'Luis'],
      l: ['García', 'Fernández', 'Martínez', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Serrano', 'Molina', 'Ortega', 'Delgado', 'Castro', 'Rubio', 'Marín', 'Iglesias', 'Medina', 'Silva', 'Costa', 'Pereira', 'Almeida', 'Carvalho', 'Moura', 'Figueiredo', 'Lobo', 'Herrera', 'Soler', 'Llorente', 'Arrieta', 'Echeverría', 'Zubiri'],
    },
    rheinmark: {
      f: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Maximilian', 'Paul', 'Niklas', 'Tim', 'Florian', 'Kai', 'Julian', 'Timo', 'Mats', 'Thomas', 'Sven', 'Jens', 'Daan', 'Bram', 'Sem', 'Thijs', 'Ruben', 'Joris', 'Matthijs', 'Leroy', 'Kevin', 'Marco', 'Robin', 'Dennis', 'Malte', 'Henrik'],
      l: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Brandt', 'Krüger', 'Hartmann', 'Lange', 'Vogel', 'Kessler', 'de Jong', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'de Vries', 'van den Berg', 'Mulder', 'Bosman', 'Steiner', 'Falkner', 'Eisenberg'],
    },
    valtoria: {
      f: ['Lorenzo', 'Matteo', 'Alessandro', 'Federico', 'Gianluca', 'Riccardo', 'Davide', 'Nicolò', 'Andrea', 'Simone', 'Giacomo', 'Antoine', 'Théo', 'Lucas', 'Hugo', 'Kylian', 'Raphaël', 'Mathis', 'Enzo', 'Adrien', 'Ciro', 'Sandro', 'Fabio', 'Paolo', 'Bastien', 'Olivier', 'Rémi', 'Florent', 'Marco', 'Dario'],
      l: ['Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Ferrara', 'Dubois', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Bonnet', 'Mercier', 'Fournier', 'Chevalier', 'Rousseau', 'Garnier', 'Vidal'],
    },
    // players from beyond the four leagues
    world: [
      { nat: 'Brazilia', f: ['Gabriel', 'Vinícius', 'Thiago', 'Matheus', 'Rodrygo', 'Endrick', 'Lucas', 'Arthur', 'Caio', 'Wesley', 'Raphinha', 'Danilo'], l: ['Santos', 'Oliveira', 'Souza', 'Lima', 'Ribeiro', 'Gomes', 'Nascimento', 'Barbosa', 'Araújo', 'Cardoso', 'Teixeira', 'Rocha'] },
      { nat: 'Kwenda', f: ['Kwame', 'Kofi', 'Yaw', 'Emeka', 'Chidi', 'Samuel', 'Victor', 'Ademola', 'Moussa', 'Ibrahima', 'Sadio', 'Idrissa'], l: ['Mensah', 'Boateng', 'Okafor', 'Adeyemi', 'Diallo', 'Traoré', 'Koné', 'Ndiaye', 'Asante', 'Osei', 'Eze', 'Sarr'] },
      { nat: 'Nordvik', f: ['Erik', 'Magnus', 'Lars', 'Oskar', 'Anders', 'Sindre', 'Martin', 'Viktor', 'Emil', 'Rasmus', 'Kasper', 'Elias'], l: ['Hansen', 'Johansen', 'Lindqvist', 'Berg', 'Halvorsen', 'Nyström', 'Eriksen', 'Dahl', 'Solberg', 'Lund', 'Andersson', 'Holm'] },
      { nat: 'Slavonia', f: ['Luka', 'Ivan', 'Marko', 'Dušan', 'Nikola', 'Mateo', 'Josip', 'Filip', 'Andrej', 'Milan', 'Dominik', 'Petar'], l: ['Modrić', 'Petrović', 'Jovanović', 'Kovač', 'Horvat', 'Novak', 'Babić', 'Vlahović', 'Marić', 'Perić', 'Kostić', 'Brozović'] },
      { nat: 'Kaiyo', f: ['Takumi', 'Kaoru', 'Daichi', 'Ritsu', 'Hiroki', 'Min-jae', 'Heung-min', 'Kang-in', 'Wataru', 'Junya', 'Takefusa', 'Ji-sung'], l: ['Tanaka', 'Endo', 'Kubo', 'Mitoma', 'Doan', 'Kim', 'Lee', 'Park', 'Hwang', 'Ito', 'Suzuki', 'Kamada'] },
      { nat: 'Pampas', f: ['Julián', 'Lautaro', 'Enzo', 'Alexis', 'Facundo', 'Thiago', 'Nahuel', 'Valentín', 'Federico', 'Rodrigo', 'Darwin', 'Luis'], l: ['Álvarez', 'Martínez', 'Fernández', 'Mac Allister', 'Pellegrini', 'Almada', 'Valverde', 'Núñez', 'Ugarte', 'Bentancur', 'Molina', 'Paredes'] },
      { nat: 'Maghreb', f: ['Achraf', 'Hakim', 'Youssef', 'Sofiane', 'Riyad', 'Ismaël', 'Nayef', 'Bilal', 'Amine', 'Azzedine', 'Selim', 'Karim'], l: ['Hakimi', 'Ziyech', 'Mazraoui', 'Boufal', 'Mahrez', 'Bennacer', 'Aguerd', 'Ounahi', 'Amrabat', 'Saïss', 'Belhanda', 'El Khannouss'] },
    ],
  };
  const NAT_KEY = ['albion', 'iberica', 'rheinmark', 'valtoria'];
  // flag colours for every nationality a player can have
  const NAT_FLAG = { Albion: NATIONS[0].flag, Iberica: NATIONS[1].flag, Rheinmark: NATIONS[2].flag, Valtoria: NATIONS[3].flag, Brazilia: ['#1F8A3C', '#F2B705', '#1F4FBF'], Kwenda: ['#E0262F', '#F2B705', '#1F8A3C'], Nordvik: ['#1F4FBF', '#F4F5F7', '#E0262F'], Slavonia: ['#E0262F', '#F4F5F7', '#1F4FBF'], Kaiyo: ['#F4F5F7', '#E0262F', '#F4F5F7'], Pampas: ['#6CACE4', '#F4F5F7', '#6CACE4'], Maghreb: ['#C8102E', '#1F8A3C', '#C8102E'] };

  // ── kits & crests ──
  const KIT_STYLES = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'pin', 'chevron', 'band'];
  const CREST_SHAPES = ['shield', 'circle', 'crest', 'hex', 'diamond', 'pennant', 'badge'];
  const CREST_ICONS = ['ball', 'lion', 'star', 'crown', 'eagle', 'tower', 'anchor', 'bolt', 'flame', 'wolf', 'oak', 'ship', 'sun', 'key', 'stag', 'cross'];
  const PALETTE = ['#B3122E', '#E0262F', '#C8102E', '#E5671B', '#F2B705', '#C8A24A', '#1F8A3C', '#0F4D2C', '#0E8C8C', '#6CACE4', '#1F4FBF', '#13294B', '#4B2A85', '#6D1A36', '#15181E', '#A7B1BC', '#F4F5F7', '#7A3E1D', '#E83E8C', '#22C55E'];

  // ── weather (multipliers are 1 / 0 in clear weather) ──
  const WBASE = { groundK: 1, arrive: 0, touch: 1, footing: 1, stamina: 1, passErr: 1, grip: 1, slick: 0, visibility: 1, rain: 0, snow: 0, fog: 0, gloom: 0, lightning: false, heat: 0, clouds: 0, gust: 0 };
  const wx = (id, name, icon, tip, w) => ({ ...WBASE, id, name, icon, tip, ...w });
  const WEATHER = {
    clear: wx('clear', 'Clear', '☀️', 'Perfect conditions. Play your normal game.', {}),
    cloudy: wx('cloudy', 'Overcast', '☁️', 'Grey skies, no real effect on play.', { clouds: 0.7, gloom: 0.08 }),
    rain: wx('rain', 'Rain', '🌧️', 'The ball skids on: first touches and keepers get less reliable. Shoot from distance.', { groundK: 0.78, arrive: 2.5, touch: 1.6, footing: 0.97, grip: 0.72, slick: 0.3, passErr: 1.1, rain: 0.6, gloom: 0.15, clouds: 0.5 }),
    storm: wx('storm', 'Thunderstorm', '⛈️', 'Heavy rain and wind. Keep it simple: long balls drift and keepers spill.', { groundK: 0.72, arrive: 3, touch: 1.9, footing: 0.95, grip: 0.62, slick: 0.35, passErr: 1.25, visibility: 0.85, rain: 1, gloom: 0.32, lightning: true, clouds: 0.9, gust: 1 }),
    snow: wx('snow', 'Snow', '🌨️', 'The ball holds up in the snow and players slip. Short, simple passing wins.', { groundK: 1.35, touch: 1.4, footing: 0.92, stamina: 1.1, passErr: 1.12, grip: 0.85, visibility: 0.9, snow: 1, gloom: 0.05 }),
    fog: wx('fog', 'Fog', '🌫️', 'Players can barely pick out long passes. Keep the ball and work it short.', { visibility: 0.6, passErr: 1.08, fog: 0.75, gloom: 0.1 }),
    heat: wx('heat', 'Heatwave', '🔥', 'Legs go fast in this heat. Pressing will cost you; rotate and sub early.', { stamina: 1.4, footing: 0.99, heat: 1 }),
    wind: wx('wind', 'Gale', '💨', 'Balls in the air drift with the wind. Play it on the ground — or curl it with the gusts.', { passErr: 1.1, clouds: 0.4, gust: 1 }),
  };
  // seasonal odds: [clear, cloudy, rain, storm, snow, fog, heat, wind] by part of the season (0 summer → 1 winter)
  function weatherOdds(f) {
    return { clear: 30 - 14 * f, cloudy: 18, rain: 14 + 6 * f, storm: 4 + 3 * f, snow: 14 * Math.max(0, f - 0.35), fog: 4 + 4 * f, heat: 12 * Math.max(0, 0.5 - f) * 2, wind: 8 + 4 * f };
  }
  const KICKOFF = [{ id: 'day', label: 'Afternoon', gloom: 0 }, { id: 'dusk', label: 'Evening', gloom: 0.12 }, { id: 'night', label: 'Floodlights', gloom: 0.22 }];

  // ── identities ──
  // Club DNA: stays with the club; changes how fans, board and the engine treat them.
  const CLUB_IDS = {
    academy: { name: 'Academy Pride', icon: '🎓', desc: 'Youth grow 25% faster and the intake is richer. Fans adore academy debuts.', fans: 'Play the kids!' },
    fortress: { name: 'Home Fortress', icon: '🏰', desc: 'Home advantage is twice as strong. Losing at home stings the board.', fans: 'Nobody wins here.' },
    moneyball: { name: 'Moneyball', icon: '📈', desc: 'Scouting costs half and players sell for 15% more.', fans: 'Buy low, sell high.' },
    galactico: { name: 'Star Power', icon: '🌟', desc: 'Sponsors pay 30% more, but the board expects silverware.', fans: 'Only the best will do.' },
    workhorse: { name: 'Blue Collar', icon: '🔨', desc: 'Players tire 12% slower. Fans love effort over flair.', fans: 'Run through walls.' },
    entertainers: { name: 'Entertainers', icon: '🎆', desc: 'Every goal sells extra tickets. Fans demand attacking football.', fans: 'Attack, attack, attack!' },
    underdog: { name: 'Underdog Spirit', icon: '🐺', desc: 'Players lift 6% against stronger opponents.', fans: 'Nobody believes in us. Good.' },
    oldguard: { name: 'Old Guard', icon: '🏛️', desc: 'A patient board and veterans who age gracefully.', fans: 'Tradition. Class. Patience.' },
  };
  // Coach philosophy: follows the coach wherever he goes, and sets his teams' tactics.
  const COACH_IDS = {
    gegenpress: { name: 'Gegenpress', icon: '⚡', desc: 'Win it back high and fast. High line, relentless press.', ip: '4-3-3', oop: '4-3-3', team: { mentality: 1, pressing: 1, lineHeight: 1, tempo: 1, tackling: 0, width: 0, directness: 0 }, bonus: 'press' },
    tiki: { name: 'Tiki-Taka', icon: '🔁', desc: 'Short passes, patient probing, and a swarm to win it straight back.', ip: '4-3-3', oop: '4-3-3', team: { mentality: 0, pressing: 1, lineHeight: 0, tempo: 0, tackling: 0, width: 0, directness: -1 }, bonus: 'pass' },
    positional: { name: 'Positional Play', icon: '♟️', desc: 'Defends in a 4-3-3, then a full-back steps inside to build in a 3-2-4-1 box. Every zone occupied.', ip: '3-2-4-1', oop: '4-3-3', team: { mentality: 1, pressing: 1, lineHeight: 0, tempo: 0, tackling: 0, width: 1, directness: 0 }, bonus: 'pass' },
    bus: { name: 'Park the Bus', icon: '🚌', desc: 'Deep, compact and hard to break down. Nick one on the break.', ip: '4-4-2', oop: '5-4-1', team: { mentality: -1, pressing: 0, lineHeight: -1, tempo: 1, tackling: 0, width: -1, directness: 1 }, bonus: 'def' },
    longball: { name: 'Route One', icon: '🎯', desc: 'Get it forward early to a big man and feed off second balls.', ip: '4-4-2', oop: '4-4-2', team: { mentality: 0, pressing: 0, lineHeight: 0, tempo: 1, tackling: 1, width: 0, directness: 1 }, bonus: 'aerial' },
    counter: { name: 'Counter Punch', icon: '🥊', desc: 'Sit off, absorb, then break at lightning speed.', ip: '4-2-3-1', oop: '4-4-1-1', team: { mentality: -1, pressing: -1, lineHeight: -1, tempo: 1, tackling: 0, width: 0, directness: 1 }, bonus: 'counter' },
    wingplay: { name: 'Wing Play', icon: '🪽', desc: 'Stretch the pitch, beat the full-back, whip it in.', ip: '4-4-2', oop: '4-4-2', team: { mentality: 0, pressing: 0, lineHeight: 0, tempo: 0, tackling: 0, width: 1, directness: 0 }, bonus: 'cross' },
    blitz: { name: 'Blitz Ball', icon: '💥', desc: 'All-out chaos. Everybody attacks, everybody hits. Scorelines get silly.', ip: '2-3-5', oop: '4-2-4', team: { mentality: 2, pressing: 1, lineHeight: 1, tempo: 1, tackling: 1, width: 1, directness: 0 }, bonus: 'blitz' },
    developer: { name: 'Youth Whisperer', icon: '🌱', desc: 'Balanced football, and young players flourish under him.', ip: '4-2-3-1', oop: '4-2-3-1', team: { mentality: 0, pressing: 0, lineHeight: 0, tempo: 0, tackling: 0, width: 0, directness: 0 }, bonus: 'youth' },
    motivator: { name: 'Motivator', icon: '📣', desc: 'Squeezes every drop out of the squad. Morale never dips for long.', ip: '4-4-2', oop: '4-4-2', team: { mentality: 0, pressing: 1, lineHeight: 0, tempo: 0, tackling: 1, width: 0, directness: 0 }, bonus: 'morale' },
  };

  const PERSONALITIES = {
    leader: { name: 'Leader', desc: 'Lifts team morale and keeps heads up after defeats.' },
    pro: { name: 'Model Pro', desc: 'Trains hard: grows faster and declines slower.' },
    ambitious: { name: 'Ambitious', desc: 'Wants trophies and big wages. Asks to leave if the club stalls.' },
    loyal: { name: 'Loyal', desc: 'Happy to stay; accepts lower wages to remain.' },
    hothead: { name: 'Hothead', desc: 'Plays on the edge: more tackles, more cards.' },
    flair: { name: 'Flair', desc: 'Tries the outrageous: more curlers, flicks and long-range shots.' },
    clutch: { name: 'Big-Game Player', desc: 'Raises his level in cup ties and late in games.' },
    steady: { name: 'Steady', desc: 'Consistent. Never too high, never too low.' },
  };

  // prize money ($M)
  const PRIZE = {
    league: [[18, 14, 11, 9, 7.5, 6.5, 5.5, 4.5, 3.8, 3.2, 2.6, 2], [6, 5, 4, 3.4, 3, 2.6, 2.3, 2, 1.8, 1.6, 1.4, 1.2]],
    cup: { R1: 0.15, R16: 0.3, QF: 0.6, SF: 1.2, F: 2.5, W: 5 },
    cont: { QF: 3, SF: 6, F: 9, W: 18 },
    invitational: { W: 1.6, F: 0.8, P: 0.4 },
    showcase: 1.2,
  };

  // ── season calendar (days) ──
  const SEASON = {
    LEN: 172, ROUNDS: 22, LEAGUE0: 14, WEEK: 7,
    WINDOWS: [[1, 21], [84, 98]],
    CUP: { R1: 24, R16: 52, QF: 80, SF: 115, F: 150 },
    CONT: { QF: 38, SF: 101, F: 157 },
    INVIT: { SF: 6, F: 9 },
    SHOWCASE: 87,
    END: 165,
  };

  const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

  return {
    POS, POS_NAME, POS_GROUP, POS_UV, SQUAD_QUOTA, NUM_PREF,
    ATTRS, AK, ATTR_SHORT, ATTR_NAME, ATTR_GROUPS, PHYSICAL, OVR_W,
    NATIONS, CONTINENTAL, INVITATIONAL, SHOWCASE, NAMES, NAT_KEY, NAT_FLAG,
    KIT_STYLES, CREST_SHAPES, CREST_ICONS, PALETTE,
    WEATHER, weatherOdds, KICKOFF, CLUB_IDS, COACH_IDS, PERSONALITIES, PRIZE, SEASON, MONTHS,
  };
})();
