// Build-time movie themes. Only public film metadata is written to the site.
const THEMES = [
  { id:'vampire', prompt:'Name a movie featuring a vampire.', keywords:[3133] },
  { id:'kidnapping', prompt:'Name a movie where someone gets kidnapped.', keywords:[1930,235261], extraTitles:[['Don\'t Say a Word',2001]] },
  { id:'time-loop', prompt:'Name a movie with a time loop. (The same stretch of time repeats.)', keywords:[10854] },
  { id:'heist', prompt:'Name a movie about a heist. (A planned theft drives the story.)', keywords:[10051] },
  { id:'haunted-house', prompt:'Name a movie set in a haunted house.', keywords:[3358] },
  { id:'spaceship', prompt:'Name a movie featuring a spaceship.', keywords:[252937], extraTitles:[['First Man',2018]] },
  { id:'zombie', prompt:'Name a movie featuring zombies.', keywords:[12377] },
  { id:'alien-invasion', prompt:'Name a movie about an alien invasion.', keywords:[14909] },
  { id:'serial-killer', prompt:'Name a movie featuring a serial killer.', keywords:[10714] },
  { id:'time-travel', prompt:'Name a movie involving time travel.', keywords:[4379] },
  { id:'road-trip', prompt:'Name a movie about a road trip.', keywords:[7312] },
  { id:'prison', prompt:'Name a movie set partly in a prison.', keywords:[378] },
  { id:'witch', prompt:'Name a movie featuring a witch.', keywords:[616] },
  { id:'amnesia', prompt:'Name a movie where someone has amnesia.', keywords:[1453] },
  { id:'dragon', prompt:'Name a movie featuring a dragon.', keywords:[12554] },
  { id:'body-swap', prompt:'Name a movie where characters swap bodies.', keywords:[33721] },
  { id:'treasure-hunt', prompt:'Name a movie about a treasure hunt.', keywords:[6956] },
  { id:'artificial-intelligence', prompt:'Name a movie featuring artificial intelligence.', keywords:[310] },
  { id:'apocalypse', prompt:'Name a movie about an apocalypse.', keywords:[12332] },
  { id:'addiction', prompt:'Name a movie about addiction.', keywords:[6782,1803,726], extraMovieIds:[10474] },
  { id:'ghost', prompt:'Name a movie featuring a ghost.', keywords:[162846] },
  { id:'superhero', prompt:'Name a movie featuring a superhero.', keywords:[9715] },
  { id:'robot', prompt:'Name a movie featuring a robot.', keywords:[14544] },
  { id:'detective', prompt:'Name a movie featuring a detective.', keywords:[703] },
  { id:'spy', prompt:'Name a movie featuring a spy.', keywords:[470] },
  { id:'monster', prompt:'Name a movie featuring a monster.', keywords:[1299] },
  { id:'revenge', prompt:'Name a movie about revenge.', keywords:[9748] },
  { id:'survival', prompt:'Name a movie about surviving against the odds.', keywords:[10349] },
  { id:'courtroom', prompt:'Name a movie featuring a courtroom scene.', keywords:[33519,214780] },
  { id:'wedding', prompt:'Name a movie featuring a wedding.', keywords:[13027] },
  { id:'christmas', prompt:'Name a movie set around Christmas.', keywords:[207317] },
  { id:'musician', prompt:'Name a movie about a musician.', keywords:[4048] },
  { id:'boxing', prompt:'Name a movie featuring boxing.', keywords:[209476] },
  { id:'submarine', prompt:'Name a movie featuring a submarine.', keywords:[339] },
  { id:'cult', prompt:'Name a movie featuring a cult.', keywords:[6158] },
  { id:'werewolf', prompt:'Name a movie featuring a werewolf.', keywords:[12564], extraMovieIds:[8966] },
  { id:'pirate', prompt:'Name a movie featuring pirates.', keywords:[12988] },
  { id:'dinosaur', prompt:'Name a movie featuring a dinosaur.', keywords:[12616] },
  { id:'car-race', prompt:'Name a movie featuring a car race.', keywords:[830] },
  { id:'circus', prompt:'Name a movie featuring a circus.', keywords:[291] },
  { id:'magic', prompt:'Name a movie featuring magic.', keywords:[2343] },
  { id:'coming-of-age', prompt:'Name a coming-of-age movie. (A story about growing up or entering adulthood.)', keywords:[10683] },
  { id:'volcano', prompt:'Name a movie featuring a volcano.', keywords:[3347] },
  { id:'shark', prompt:'Name a movie featuring a shark.', keywords:[15097] },
  { id:'disaster', prompt:'Name a movie about a major disaster.', keywords:[10617] },
  { id:'train', prompt:'Name a movie featuring a train.', keywords:[13008] },
  { id:'deserted-island', prompt:'Name a movie where someone is stranded on an island.', keywords:[155746] },
  { id:'casino', prompt:'Name a movie with a casino scene.', keywords:[585] },
  { id:'masked-killer', prompt:'Name a movie featuring a masked killer.', keywords:[305666] },
  { id:'talking-animal', prompt:'Name a movie featuring a talking animal.', keywords:[267848] },
  { id:'video-game', prompt:'Name a movie featuring or based on a video game. (The game must appear or inspire the story.)', keywords:[282,41645], extraTitles:[
    ['A Minecraft Movie',2025],['TRON',1982],['TRON: Legacy',2010],
    ['Pixels',2015],['Stay Alive',2006],['Spy Kids 3-D: Game Over',2003],
  ] },
  { id:'assassin', prompt:'Name a movie featuring an assassin.', keywords:[782] },
  { id:'plane-crash', prompt:'Name a movie featuring a plane crash.', keywords:[249530] },
  { id:'desert', prompt:'Name a movie set partly in a desert.', keywords:[18034] },
  { id:'ocean', prompt:'Name a movie featuring the ocean.', keywords:[270] },
  { id:'bank-robbery', prompt:'Name a movie featuring a bank robbery.', keywords:[15363] },
  { id:'secret-identity', prompt:'Name a movie where someone has a secret identity.', keywords:[1308] },
  { id:'twins', prompt:'Name a movie featuring twins.', keywords:[15016,321873], extraTitles:[
    ['The Parent Trap',1998],['The Parent Trap',1961],['Twins',1988],
    ['It Takes Two',1995],['Dead Ringers',1988],['Big Business',1988],
  ] },
  { id:'hypnosis', prompt:'Name a movie featuring hypnosis.', keywords:[3363] },
  { id:'missing-person', prompt:'Name a movie about a missing person.', keywords:[156091,10941,281776], extraTitles:[
    ['The Secret Life of Walter Mitty',2013],['Missing',2023],['Searching',2018],
    ['Prisoners',2013],['Gone Girl',2014],['Changeling',2008],
    ['Flightplan',2005],['Gone Baby Gone',2007],
  ] },
  { id:'dream-sequence', prompt:'Name a movie with a dream sequence.', keywords:[160840], extraMovieIds:[27205] },
  { id:'curse', prompt:'Name a movie featuring a curse.', keywords:[10541,190821,287762,234753,301472], extraMovieIds:[1339713], extraTitles:[
    ['The Mummy',1999],['Pirates of the Caribbean: The Curse of the Black Pearl',2003],
    ['The Ring',2002],['Drag Me to Hell',2009],['The Grudge',2004],
  ] },
  { id:'shipwreck', prompt:'Name a movie featuring a shipwreck.', keywords:[2580] },
  { id:'murder-mystery', prompt:'Name a movie built around a murder mystery.', keywords:[207046] },
  { id:'high-school', prompt:'Name a movie set at a high school.', keywords:[6270] },
  { id:'space-travel', prompt:'Name a movie about space travel.', keywords:[3801] },
  { id:'martial-arts', prompt:'Name a movie featuring martial arts.', keywords:[779] },
  { id:'supernatural', prompt:'Name a movie featuring the supernatural.', keywords:[6152] },
  { id:'father-daughter', prompt:'Name a movie about a father and daughter.', keywords:[384153,240303] },
  { id:'mother-daughter', prompt:'Name a movie about a mother and daughter.', keywords:[240315,266503] },
  { id:'found-family', prompt:'Name a movie about a found family. (People become family through choice, not birth.)', keywords:[248927], extraMovieIds:[334543] },
  { id:'war', prompt:'Name a movie set during a war.', keywords:[273967] },
  { id:'dystopia', prompt:'Name a movie set in a dystopia. (An imagined society with harsh control or oppression.)', keywords:[4565] },
  { id:'love-triangle', prompt:'Name a movie featuring a love triangle.', keywords:[128] },
  { id:'rivalry', prompt:'Name a movie about a rivalry.', keywords:[9823] },
  { id:'journalist', prompt:'Name a movie featuring a journalist.', keywords:[736] },
  { id:'beach', prompt:'Name a movie with a beach scene.', keywords:[966] },
  { id:'mountain', prompt:'Name a movie set partly on a mountain.', keywords:[1262] },
  { id:'snow', prompt:'Name a movie set partly in the snow.', keywords:[10794] },
  { id:'hotel', prompt:'Name a movie set partly in a hotel.', keywords:[612] },
  { id:'hospital', prompt:'Name a movie with a hospital scene.', keywords:[11612] },
  { id:'summer-camp', prompt:'Name a movie set at a summer camp.', keywords:[5767] },
  { id:'rescue-mission', prompt:'Name a movie about a rescue mission.', keywords:[11107] },
  { id:'magic-spell', prompt:'Name a movie featuring a magic spell.', keywords:[249692] },
  { id:'friendship', prompt:'Name a movie about friendship.', keywords:[6054] },
  { id:'adoption', prompt:'Name a movie involving adoption.', keywords:[2393] },
  { id:'invention', prompt:'Name a movie featuring an invention.', keywords:[3338] },
  { id:'movie-theater', prompt:'Name a movie with a movie theater scene.', keywords:[274951,363188] },
  { id:'secret-passage', prompt:'Name a movie featuring a secret passage.', keywords:[352] },
  { id:'music-competition', prompt:'Name a movie featuring a music competition.', keywords:[6383] },
  { id:'based-on-video-game', prompt:'Name a movie adapted from a video game.', keywords:[41645] },
  { id:'cooking', prompt:'Name a movie featuring cooking.', keywords:[1918], extraMovieIds:[593643] },
  { id:'restaurant', prompt:'Name a movie set partly in a restaurant.', keywords:[1946] },
  { id:'chef', prompt:'Name a movie featuring a chef.', keywords:[18293] },
  { id:'teacher', prompt:'Name a movie featuring a teacher.', keywords:[10508] },
  { id:'football', prompt:'Name a movie featuring football or soccer.', keywords:[13042,579] },
  { id:'basketball', prompt:'Name a movie featuring basketball.', keywords:[6496] },
  { id:'rock-band', prompt:'Name a movie featuring a rock band.', keywords:[18001] },
  { id:'dance-competition', prompt:'Name a movie featuring a dance competition.', keywords:[10104] },
  { id:'amusement-park', prompt:'Name a movie set partly in an amusement park.', keywords:[155582] },
  { id:'museum', prompt:'Name a movie with a museum scene.', keywords:[2598] },
  { id:'underwater', prompt:'Name a movie with an underwater scene.', keywords:[14785], extraTitles:[['Avatar: The Way of Water',2022]] },
  { id:'jungle', prompt:'Name a movie set partly in a jungle.', keywords:[10787] },
  { id:'astronaut', prompt:'Name a movie featuring an astronaut.', keywords:[14626] },
  { id:'scientist', prompt:'Name a movie featuring a scientist.', keywords:[14760] },
  { id:'lawyer', prompt:'Name a movie featuring a lawyer.', keywords:[10909] },
  { id:'politician', prompt:'Name a movie featuring a politician.', keywords:[6083] },
  { id:'family-vacation', prompt:'Name a movie about a family vacation.', keywords:[14724] },
  { id:'concert', prompt:'Name a movie featuring a concert.', keywords:[6029] },
  { id:'space-station', prompt:'Name a movie featuring a space station.', keywords:[156039] },
  { id:'medieval', prompt:'Name a movie set in medieval times.', keywords:[161257] },
  { id:'ancient-rome', prompt:'Name a movie set in ancient Rome.', keywords:[5049] },
  { id:'bodyguard', prompt:'Name a movie featuring a bodyguard.', keywords:[3088] },
  { id:'mistaken-identity', prompt:'Name a movie about mistaken identity.', keywords:[10325] },
  { id:'split-personality', prompt:'Name a movie featuring a split personality. (One character has distinct identities.)', keywords:[156761] },
  { id:'prison-escape', prompt:'Name a movie featuring a prison escape.', keywords:[9777,329486] },
  { id:'storm', prompt:'Name a movie featuring a major storm.', keywords:[14527] },
  { id:'tornado', prompt:'Name a movie featuring a tornado.', keywords:[2213] },
  { id:'siege', prompt:'Name a movie featuring a siege.', keywords:[4063] },
  { id:'radio-station', prompt:'Name a movie featuring a radio station.', keywords:[1224] },
  { id:'haunted-hotel', prompt:'Name a movie set in a haunted hotel.', keywords:[196986] },
  { id:'sibling-rivalry', prompt:'Name a movie about sibling rivalry.', keywords:[11157] },
  { id:'wilderness', prompt:'Name a movie set in the wilderness.', keywords:[3593] },
  { id:'animal-rescue', prompt:'Name a movie featuring an animal rescue.', keywords:[223378] },
  { id:'dog', prompt:'Name a movie featuring a dog.', keywords:[15162] },
  { id:'cat', prompt:'Name a movie featuring a cat.', keywords:[977] },
  { id:'horse', prompt:'Name a movie featuring a horse.', keywords:[2673] },
  { id:'orphan', prompt:'Name a movie about an orphan.', keywords:[13014] },
  { id:'library', prompt:'Name a movie with a library scene.', keywords:[295] },
  { id:'nightclub', prompt:'Name a movie with a nightclub scene.', keywords:[2334] },
  { id:'funeral', prompt:'Name a movie featuring a funeral.', keywords:[3739] },
  { id:'cemetery', prompt:'Name a movie with a cemetery scene.', keywords:[1227] },
  { id:'cabin', prompt:'Name a movie set partly in a cabin.', keywords:[3623] },
  { id:'lighthouse', prompt:'Name a movie featuring a lighthouse.', keywords:[4079] },
  { id:'cruise-ship', prompt:'Name a movie set partly on a cruise ship.', keywords:[11095] },
  { id:'airplane', prompt:'Name a movie set partly on an airplane.', keywords:[3800] },
  { id:'airport', prompt:'Name a movie with an airport scene.', keywords:[822] },
  { id:'police-officer', prompt:'Name a movie featuring a police officer.', keywords:[15090] },
  { id:'forest', prompt:'Name a movie set partly in a forest.', keywords:[5774] },
  { id:'college', prompt:'Name a movie set partly at a college.', keywords:[3616,13160] },
  { id:'house-party', prompt:'Name a movie featuring a house party.', keywords:[10275] },
  { id:'birthday-party', prompt:'Name a movie featuring a birthday party.', keywords:[5732] },
  { id:'family-reunion', prompt:'Name a movie featuring a family reunion.', keywords:[18187] },
  { id:'parallel-universe', prompt:'Name a movie featuring a parallel universe.', keywords:[243230] },
  { id:'cloning', prompt:'Name a movie featuring human cloning.', keywords:[11628,226039] },
  { id:'hacker', prompt:'Name a movie featuring a hacker.', keywords:[2157] },
  { id:'hostage', prompt:'Name a movie with a hostage situation.', keywords:[1562,18233] },
  { id:'jury', prompt:'Name a movie featuring a jury.', keywords:[8881] },
  { id:'firefighter', prompt:'Name a movie featuring a firefighter.', keywords:[192094] },
  { id:'earthquake', prompt:'Name a movie featuring an earthquake.', keywords:[3521] },
  { id:'blackmail', prompt:'Name a movie involving blackmail.', keywords:[1936] },
  { id:'fairy-tale', prompt:'Name a movie inspired by a fairy tale.', keywords:[3205] },
  { id:'pregnancy', prompt:'Name a movie featuring a pregnancy.', keywords:[3725] },
  { id:'war-veteran', prompt:'Name a movie featuring a war veteran.', keywords:[1543] },
  { id:'therapy', prompt:'Name a movie featuring a therapy session.', keywords:[40952,350762] },
  { id:'gangster', prompt:'Name a movie featuring a gangster.', keywords:[3149] },
  { id:'baseball', prompt:'Name a movie featuring baseball.', keywords:[1480] },
  { id:'tennis', prompt:'Name a movie featuring tennis.', keywords:[1488] },
  { id:'painting', prompt:'Name a movie featuring a painting.', keywords:[5918] },
  { id:'helicopter', prompt:'Name a movie featuring a helicopter.', keywords:[720], extraTitles:[['The Dictator',2012]] },
  { id:'castle', prompt:'Name a movie set partly in a castle.', keywords:[3098] },
  { id:'nightmare', prompt:'Name a movie featuring a nightmare. (Being scared at night counts.)', keywords:[3030], extraMovieIds:[585] },
  { id:'ballet', prompt:'Name a movie featuring ballet.', keywords:[10551] },
  { id:'queen', prompt:'Name a movie featuring a queen.', keywords:[2011] },
  { id:'undercover', prompt:'Name a movie featuring someone undercover.', keywords:[1568] },
  { id:'alien-planet', prompt:'Name a movie set partly on an alien planet.', keywords:[10158] },
  { id:'game-show', prompt:'Name a movie featuring a game show.', keywords:[4325] },
  { id:'escape-room', prompt:'Name a movie featuring an escape room.', keywords:[240252] },
  { id:'inheritance', prompt:'Name a movie where an inheritance matters to the story.', keywords:[10911] },
  { id:'haunted-doll', prompt:'Name a movie featuring a haunted doll.', keywords:[249694] },
  { id:'treasure-map', prompt:'Name a movie featuring a treasure map.', keywords:[11088] },
  { id:'childhood-friends', prompt:'Name a movie about childhood friends.', keywords:[160246] },
  { id:'theater', prompt:'Name a movie with a theater in the story.', keywords:[285695,220201] },
  { id:'election', prompt:'Name a movie featuring an election.', keywords:[15134] },
  { id:'fashion', prompt:'Name a movie set in the fashion world.', keywords:[236197] },
  { id:'small-town', prompt:'Name a movie set in a small town.', keywords:[1415] },
  { id:'mountain-climbing', prompt:'Name a movie featuring mountain climbing.', keywords:[159212] },
  { id:'puppet', prompt:'Name a movie featuring a puppet.', keywords:[6300] },
  { id:'tournament', prompt:'Name a movie featuring a tournament.', keywords:[12380] },
  { id:'archaeology', prompt:'Name a movie featuring an archaeologist.', keywords:[184134,383073] },
  // Story beats, scenes, and weapons. `classify` themes have no reliable keyword, so
  // build-daily-story-prompts.mjs keeps only candidates that an AI check confirms, and
  // answers outside the catalog are judged the same way at play time.
  ...[
    ['plot-twist','Name a movie featuring a major plot twist. (A surprise that changes how the story is understood.)',[275311,326438]],
    ['unlikely-friendship','Name a movie involving an unlikely friendship. (Two people or creatures who would not normally be friends.)',[167982,187376]],
    ['public-fight','Name a movie with a fight in a public place. (Like a bar, street, or restaurant.)',[188933,174244,186150,188934,180195]],
    ['presumed-dead','Name a movie where a character is presumed dead but is actually alive.',[155402,155750,344754]],
    ['framed','Name a movie where a character is framed for a crime.',[180172,15124,157210,271331]],
    ['self-sacrifice','Name a movie where a character sacrifices themselves to save others.',[1430,318075]],
    ['car-crash','Name a movie with a car crash.',[9844,13063]],
    ['weapon-sword','Name a movie where someone uses a sword.',[9725,1938,175245,320529]],
    ['weapon-bow','Name a movie where someone uses a bow and arrow.',[18101,4393,53995,166735]],
    ['weapon-knife','Name a movie where someone uses a knife.',[4728,18106,281079]],
    ['weapon-axe','Name a movie where someone uses an axe.',[157758,326201,317733]],
    ['weapon-chainsaw','Name a movie where someone uses a chainsaw.',[12394,338242,259879]],
    ['weapon-machete','Name a movie where someone uses a machete.',[3544]],
    ['weapon-shotgun','Name a movie where someone uses a shotgun.',[1366,344250,361161]],
    ['weapon-sniper','Name a movie where someone uses a sniper rifle.',[1589,12355,157218,314765]],
    ['weapon-machine-gun','Name a movie where someone uses a machine gun.',[156650,4276]],
    ['weapon-grenade','Name a movie where someone uses a grenade.',[4301,4709,156816]],
    ['weapon-dynamite','Name a movie where someone uses dynamite.',[1560]],
    ['weapon-bomb','Name a movie where someone uses a bomb.',[258,2528]],
    ['weapon-whip','Name a movie where someone uses a whip.',[1294,207668]],
    ['weapon-poison','Name a movie where someone uses poison.',[351,235507]],
    ['booby-trap','Name a movie featuring a booby trap.',[163841]],
    ['betrayal','Name a movie with a major betrayal. (Someone turns on a person who trusted them.)',[10085]],
    ['redemption','Name a movie about redemption. (A character tries to make up for past wrongs.)',[11436]],
    ['underdog','Name a movie about an underdog. (Someone expected to lose who fights for a win.)',[240]],
    ['forbidden-love','Name a movie about a forbidden love. (A romance that others try to prevent.)',[3691]],
    ['love-at-first-sight','Name a movie featuring love at first sight.',[699]],
    ['explosion','Name a movie featuring a big explosion.',[14601]],
    ['shootout','Name a movie with a shootout.',[10950,193309,275100,12371,208009]],
    ['duel','Name a movie featuring a duel. (A fight between two people under agreed rules.)',[12965,175245]],
    ['terminal-illness','Name a movie about a character with a terminal illness.',[6564]],
    ['dance-scene','Name a movie with a dance scene.',[246,4345,194729]],
    ['prom','Name a movie featuring a prom.',[10266,166229,226226]],
    ['talent-show','Name a movie featuring a talent show.',[8290]],
    ['whistleblower','Name a movie about a whistleblower. (Someone who exposes wrongdoing.)',[209799,302151]],
    ['conspiracy','Name a movie about a conspiracy. (A secret plan by a powerful group.)',[10410,298530,298532]],
    ['double-agent','Name a movie with a double agent.',[3637]],
    ['stalker','Name a movie featuring a stalker.',[6844,18051,324849]],
    ['lost-in-the-woods','Name a movie where someone gets lost in the woods.',[223620]],
    ['elevator','Name a movie with an elevator scene.',[188960]],
    ['karaoke','Name a movie with a karaoke scene.',[1005,155058]],
    ['flashbacks','Name a movie told partly in flashbacks.',[9856,171826]],
    ['unreliable-narrator','Name a movie with an unreliable narrator. (A storyteller who cannot be trusted.)',[174089]],
    ['foot-chase','Name a movie with a chase on foot.',[14967]],
    ['ambush','Name a movie featuring an ambush.',[502]],
    ['chess','Name a movie featuring chess.',[316,12969,275348,182210]],
    ['disguise','Name a movie where a character wears a disguise.',[18118,174523]],
    ['makeover','Name a movie featuring a makeover.',[34130]],
    ['love-letter','Name a movie featuring a love letter.',[3452,355083]],
    ['diary','Name a movie featuring a diary.',[2913,212755,221021]],
    ['poker','Name a movie featuring a poker game.',[383,14852]],
    ['board-game','Name a movie featuring a board game.',[10090]],
    ['secret-society','Name a movie featuring a secret society.',[2908]],
    ['bounty-hunter','Name a movie featuring a bounty hunter.',[801]],
    ['estranged-father','Name a movie about an estranged father.',[161194]],
  ].map(([id,prompt,keywords]) => ({ id, prompt, keywords, batch:'story-prompts' })),
  { id:'most-die', prompt:'Name a movie where most characters die. (Most of the main cast does not survive.)',
    keywords:[], candidates:[364573,14546,1583,161240,237593,10089,183435,11249], classify:true, batch:'story-prompts' },
  { id:'non-human-lead', prompt:'Name a movie where the main character is not human. (An animal, robot, monster, toy, or similar lead.)',
    keywords:[], candidates:[11477,338226,269765], classify:true, batch:'story-prompts' },
];
export const themesInBatch = (batch) => THEMES.filter((theme) => theme.batch === batch);
export const scenarioIds = THEMES.map((theme) => `scenario-${theme.id}`);
export const scenarioKeywords = Object.fromEntries(THEMES.map((theme) =>
  [`scenario-${theme.id}`, theme.keywords]));

// This prompt requires judgment about the central character, so its answers are curated.
const BALD_LEADS = [
  ['The Transporter',2002],['Transporter 2',2005],['Transporter 3',2008],
  ['Crank',2006],['Crank: High Voltage',2009],['The Mechanic',2011],
  ['Mechanic: Resurrection',2016],['The Meg',2018],['Meg 2: The Trench',2023],
  ['Wrath of Man',2021],['The Beekeeper',2024],
  ['Pitch Black',2000],['The Chronicles of Riddick',2004],['Riddick',2013],
  ['xXx',2002],['xXx: Return of Xander Cage',2017],['The Pacifier',2005],
  ['Bloodshot',2020],['Fast Five',2011],['Fast & Furious 6',2013],
  ['Furious 7',2015],['The Fate of the Furious',2017],['F9',2021],['Fast X',2023],
  ['Black Adam',2022],['Jumanji: Welcome to the Jungle',2017],
  ['Jumanji: The Next Level',2019],['Red Notice',2021],
  ['Central Intelligence',2016],['Skyscraper',2018],['Rampage',2018],
  ['San Andreas',2015],['Jungle Cruise',2021],
  ['Live Free or Die Hard',2007],['A Good Day to Die Hard',2013],
  ['Split',2016],['Glass',2019],['Hitman',2007],['Hitman: Agent 47',2015],
  ['The Last Airbender',2010],['Despicable Me',2010],['Despicable Me 2',2013],
  ['Despicable Me 3',2017],['Despicable Me 4',2024],['Megamind',2010],
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = new Date().toISOString().slice(0,10);

async function tmdb(key, path, params = {}, retries = 5) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.search = new URLSearchParams({ ...params, api_key:key, language:'en-US' });
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await wait(1100 * (attempt + 1));
      continue;
    }
    throw new Error(`TMDB ${response.status} for ${path}`);
  }
}

function movie(item) {
  if (!item?.id || !item.title || !item.release_date || item.release_date > today || item.adult) return null;
  return {
    id:item.id, title:item.title, originalTitle:item.original_title || item.title,
    year:Number(item.release_date.slice(0,4)), votes:item.vote_count || 0,
  };
}

function uniqueMovies(items) {
  return [...new Map(items.map(movie).filter(Boolean).map((item) => [item.id,item])).values()]
    .sort((a,b) => b.votes - a.votes || a.title.localeCompare(b.title));
}

async function discoverTheme(key, theme) {
  const params = {
    with_keywords:(theme.candidates || theme.keywords).join('|'), sort_by:'vote_count.desc',
    include_adult:'false', include_video:'false', without_genres:'99',
    'primary_release_date.lte':today,
  };
  const first = await tmdb(key,'/discover/movie',{...params,page:'1'});
  const totalPages = Math.min(first.total_pages,500);
  const pages = new Set([1]);
  for (let page=2; page<=Math.min(30,totalPages); page++) pages.add(page);
  if (totalPages > 30) {
    for (let step=1; step<=8; step++) {
      pages.add(30 + Math.ceil((totalPages-30)*step/8));
    }
  }
  const results = [first];
  const remaining = [...pages].filter((page) => page!==1);
  for (let i=0; i<remaining.length; i+=4) {
    results.push(...await Promise.all(remaining.slice(i,i+4).map((page) =>
      tmdb(key,'/discover/movie',{...params,page:String(page)}))));
  }
  const extras = await Promise.all((theme.extraMovieIds || []).map((id) => tmdb(key,`/movie/${id}`)));
  for (const [title,year] of theme.extraTitles || []) {
    const data = await tmdb(key,'/search/movie',{query:title,page:'1'});
    const exact = data.results.find((item) =>
      (item.title.toLowerCase() === title.toLowerCase() ||
       item.original_title?.toLowerCase() === title.toLowerCase()) &&
      Number(item.release_date?.slice(0,4)) === year);
    if (!exact) throw new Error(`Could not find supplement ${title} (${year}) for ${theme.id}`);
    extras.push(exact);
  }
  const movies = uniqueMovies([...results.flatMap((page) => page.results),...extras]);
  // Classified themes are filtered afterwards, so only the weak ones are dropped here.
  if (movies.length < (theme.classify ? 5 : 30)) { console.log(`Skipped ${theme.id}: only ${movies.length} answers`); return null; }
  console.log(`scenario: ${theme.id}: ${movies.length} answers`);
  return { id:`scenario-${theme.id}`,kind:'scenario',label:theme.id,prompt:theme.prompt,movies };
}

async function baldLeadQuestion(key) {
  const results = [];
  for (let i=0; i<BALD_LEADS.length; i+=4) {
    results.push(...await Promise.all(BALD_LEADS.slice(i,i+4).map(async ([title,year]) => {
      const data = await tmdb(key,'/search/movie',{query:title,page:'1'});
      const exact = data.results.find((item) =>
        (item.title.toLowerCase() === title.toLowerCase() ||
          item.original_title?.toLowerCase() === title.toLowerCase()) &&
        Number(item.release_date?.slice(0,4)) === year);
      if (!exact) console.warn(`Could not resolve bald-lead film: ${title} (${year})`);
      return exact;
    })));
  }
  const movies = uniqueMovies(results);
  if (movies.length < 30) throw new Error(`Only ${movies.length} bald-lead answers resolved`);
  console.log(`scenario: bald-lead: ${movies.length} answers`);
  return { id:'scenario-bald-lead',kind:'scenario',label:'bald-lead',
    prompt:'Name a movie with a bald main character.',movies };
}

export async function buildScenarios(key, onlyIds = null) {
  const questions = [];
  for (const theme of THEMES.filter((item) => !onlyIds || onlyIds.has(`scenario-${item.id}`))) {
    const question=await discoverTheme(key,theme);
    if(question) questions.push(question);
  }
  if (!onlyIds || onlyIds.has('scenario-bald-lead')) questions.push(await baldLeadQuestion(key));
  return questions;
}
