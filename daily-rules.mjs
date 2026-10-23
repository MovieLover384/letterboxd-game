const rules = {
  color:/\b(red|blue|green|black|white|yellow|pink|purple|gold|golden|silver|orange|violet)\b/i,
  number:/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)\b/i,
  animal:/\b(dogs?|cats?|lions?|tigers?|bears?|horses?|wolves?|fox(?:es)?|monkeys?|birds?|fish|sharks?|snakes?|dragons?|rabbits?)\b/i,
  season:/\b(spring|summer|autumn|fall|winter)\b/i,
  'one-word':/^[\p{L}\p{N}'’\-]+$/u,
  city:/\b(new york|paris|london|tokyo|rome|chicago|berlin|amsterdam|las vegas|los angeles|madrid|venice|seoul|mumbai)\b/i,
  night:/\bnight\b/i,
  question:/\?/,
  family:/\b(mother|father|mom|dad|brother|sister|son|daughter|grandma|grandpa|family)\b/i,
  food:/\b(cake|pizza|chocolate|candy|bread|pie|soup|sushi|coffee|tea|wine|beer|milk|banana|apple|cherry|lemon|sugar|sausage|burger|hamburger|steak|bacon|egg|eggs|cookie|cookies|donut|doughnut|pasta|spaghetti|rice|noodle|noodles|fish|chicken|turkey|beef|pork|sandwich|hot dog|hotdog|ice cream|water|juice|whiskey|whisky|vodka|champagne|rum|gin|honey|salt|pepper)\b/i,
  vehicle:/\b(cars?|trains?|planes?|airplanes?|buses?|taxi|trucks?|motorcycles?|bikes?|boats?|ships?|submarines?|rockets?)\b/i,
  weather:/\b(rain|snow|storm|wind|thunder|lightning|sun|sunshine|cloud|hurricane|tornado)\b/i,
  royalty:/\b(king|queen|prince|princess|emperor|empress|duke|duchess)\b/i,
  profession:/\b(doctor|teacher|chef|lawyer|detective|spy|agent|officer|pilot|cowboy|artist|singer|dancer|writer|beekeeper|baker|butcher|barber|nurse|surgeon|dentist|firefighter|policeman|policewoman|police|soldier|sailor|captain|astronaut|scientist|engineer|architect|journalist|reporter|photographer|actor|actress|director|producer|musician|painter|poet|author|librarian|farmer|driver|taxi driver|mechanic|plumber|electrician|carpenter|janitor|waiter|waitress|bartender|banker|accountant|professor|priest|preacher|pastor|rabbi|monk|judge|president|mayor|governor|politician|assassin|hitman|thief|burglar|robber|pirate|magician|clown|wrestler|boxer|athlete|coach|gardener|fisherman|hunter)\b/i,
  month:/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  body:/\b(heart|hand|head|eye|eyes|foot|feet|leg|arm|mouth|nose|skin|face)\b/i,
  name:/\b(john|jack|james|mary|alice|peter|harry|tom|sam|jane|anna|emma|lucy|max|rocky|annie|ben|bob|charlie|david|frank|george|henry|jimmy|joe|johnny|kate|larry|michael|nick|paul|ray|ruby|sarah|steve|will|william|carol|eddie|elvis|forrest|juno|matilda|oliver|romeo|juliet|alfie|billy|bruce|clara|emily|hannah|mia|rudy|ted)\b/i,
  place:/\b(america|american|africa|african|china|chinese|india|indian|japan|japanese|russia|russian|italy|italian|spain|spanish|france|french|mexico|mexican|brazil|texas|california|hawaii|alaska|vegas|ireland|irish|scotland|england|english|egypt|vietnam|korea|jamaica|cuba|canada|germany|german|berlin|manhattan|brooklyn|hollywood|miami|detroit|boston|vienna|moscow|casablanca)\b/i,
  time:/\b(day|days|hour|hours|midnight|morning|tomorrow|yesterday|today|forever|week|weekend|year|years|time|times|minute|minutes|dawn|dusk|evening)\b/i,
  love:/\b(love|loves|lover|lovers|kiss|kisses|romance|wedding|bride|married|marriage|date|valentine)\b/i,
  death:/\b(death|dead|die|dies|dying|kill|kills|killer|killers|murder|blood|grave|bloody|deadly)\b/i,
  space:/\b(star|stars|moon|planet|planets|space|galaxy|universe|earth|mars|cosmos|alien|aliens)\b/i,
  water:/\b(sea|ocean|river|lake|island|islands|beach|water|bay|wave|waves|coast|bridge|pool|swamp)\b/i,
  fire:/\b(fire|flame|flames|ice|frozen|burn|burning|smoke|volcano|ash|ashes)\b/i,
  building:/\b(house|home|castle|palace|hotel|school|church|prison|room|garden|tower|mansion|cabin|factory|hospital|inn)\b/i,
  music:/\b(song|songs|music|dance|dancing|rock|rhythm|band|sing|singing|blues|jazz|opera|concert|rap|punk)\b/i,
  battle:/\b(war|wars|battle|army|warrior|warriors|fight|fighter|combat|mission|commando|soldier|soldiers|siege)\b/i,
  heaven:/\b(god|gods|devil|angel|angels|heaven|hell|demon|demons|saint|holy|church|evil|sin)\b/i,
  size:/\b(big|little|small|tiny|giant|great|long|short|old|young|new|first|last)\b/i,
  'two-words':/^[\p{L}\p{N}'’\-.&!?]+\s[\p{L}\p{N}'’\-.&!?]+$/u,
  'long-title':/^(?:\S+\s+){5,}\S+$/,
  colon:/:/,
  possessive:/['’]s\b/,
  and:/(?:\band\b|&)/i,
  dark:/\b(dark|darkness|shadow|shadows|black|midnight|noir|ghost|ghosts|haunted|nightmare|secret|secrets|lost|hidden)\b/i,
};
// Role names from a TMDB cast credit ("Rick Deckard / Replicant (voice)"), without the filler
// credits that are not characters (self appearances, extras, uncredited bits).
export function rolesOf(character = '') {
  return character.replace(/\s*\((?:voice|uncredited|archive footage|as [^)]*)\)/gi, '')
    .split(/\s+\/\s+/).map((role) => role.trim()).filter((role) => role &&
      !/^(self|himself|herself|themselves|narrator|host|guest|additional voices?|uncredited|voice|various|extra|background|unknown|cameo)\b/i.test(role) &&
      !/^(man|woman|boy|girl|child|guard|officer|soldier|customer|passenger|reporter|student)\s*\d*$/i.test(role));
}
const standaloneNumberTitles = new Set(['district 9','8 mile','9','se7en','oceans 8']);
// Rules about the shape of a title, which a joined word like "WarGames" must not change.
const shapeRules = new Set(['one-word','two-words','long-title','colon','possessive','question','and']);
// The other rules are word lists ("city" lists fourteen cities), so a title they miss may still fit.
export const isShapeRule = (rule) => shapeRules.has(rule);
export function titleFits(rule,title) {
  if (rule === 'number' && !standaloneNumberTitles.has(
    title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()) &&
    /\b(?:part\s*)?(?:[2-9]|II|III|IV|V|VI|VII|VIII|IX)\s*$/i.test(title)) return false;
  if (rules[rule]?.test(title) === true) return true;
  if (shapeRules.has(rule)) return false;
  // "WarGames" and "WarCraft" are two words written as one, so each part counts.
  const separated = title.replace(/([a-z])([A-Z])/g,'$1 $2');
  return separated !== title && rules[rule]?.test(separated) === true;
}
