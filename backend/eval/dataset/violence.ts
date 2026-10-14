import { a, DENIAL, ev, type LabeledEvent } from "../dsl.ts";

// Shootings, stabbings, attacks and conflict. Invented incidents; names of private people are invented.
export const violence: LabeledEvent[] = [
  ev("lubbock-school-shooting", "2026-10-13T14:40:00Z", "corroborated", [
    a("reddit-news", 0, "Active shooter reported at Monterey High School in Lubbock TX", ""),
    a("kxan", 15, "Police respond to reports of shooting at Lubbock high school", "Lubbock police said officers were responding to reports of shots fired at Monterey High School. Parents are asked to avoid the area."),
    a("ap-bluesky", 50, "Shooting at Texas high school leaves 2 dead, 5 injured; suspect in custody", "Two people were killed and five wounded in a shooting at Monterey High School in Lubbock, Texas, police said. A 16-year-old suspect was taken into custody.", "killed 2 official", "injured 5 official"),
    a("cbs-world", 70, "2 killed, 5 wounded in shooting at Lubbock, Texas, high school, police say", "A student opened fire in a hallway at Monterey High School, police said, killing two people.", "killed 2 official", "injured 5 official"),
    a("fox-world", 80, "Texas school shooting: Two dead at Lubbock high school, suspect arrested", "Lubbock Police Chief said a 16-year-old student was arrested shortly after the shooting.", "killed 2"),
    a("nbc-world", 90, "Lubbock school shooting: What we know about the Monterey High attack", "Two students were killed and five others injured. The suspected shooter, a 16-year-old student, was arrested at the scene, police said.", "killed 2", "injured 5"),
    a("npr-news", 120, "Two killed in shooting at Texas high school", "A 16-year-old student is in custody after two people were killed and five were injured at Monterey High School in Lubbock, authorities said.", "killed 2 official", "injured 5 official"),
    a("abc-us-intl", 130, "Lubbock high school shooting: 2 dead, 5 hurt", "", "killed 2", "injured 5"),
    a("kxan", 400, "Lubbock ISD cancels classes after Monterey High School shooting", "Counseling will be available for students and staff, the district said. Two people died in Tuesday's shooting.", "killed 2"),
  ]),

  ev("chicago-block-party", "2026-10-13T03:30:00Z", "corroborated", [
    a("cbs-world", 0, "1 killed, 11 wounded in shooting at South Side block party in Chicago", "Gunmen opened fire on a crowd at a block party in Chicago's Englewood neighborhood late Monday, police said.", "killed 1", "injured 11"),
    a("reddit-news", 10, "Shooting in Englewood right now, a lot of people hit", ""),
    a("nbc-world", 30, "Chicago block party shooting leaves 1 dead, 11 hurt in Englewood", "Chicago police said a 34-year-old man was killed and 11 others were wounded; no arrests have been made.", "killed 1", "injured 11 official"),
    a("fox-world", 60, "Chicago mass shooting: 12 shot at Englewood block party", "Police said one person died and 11 were wounded when two gunmen fired into the crowd.", "killed 1 official", "injured 11 official"),
    a("ap-bluesky", 120, "Gunfire at Chicago block party kills 1, wounds 11", "Two gunmen fired into a crowd at a block party on Chicago's South Side, killing a man and wounding 11 other people, police said.", "killed 1", "injured 11 official"),
  ], "same type as lubbock-school-shooting, same day"),

  ev("atlanta-mall-shooting", "2026-10-13T20:10:00Z", "corroborated", [
    a("wsb-atlanta", 0, "Shooting at Lenox Square mall; police on scene", "Atlanta police said one person was shot at Lenox Square in Buckhead on Tuesday afternoon. Shoppers were told to shelter in place."),
    a("ap-bluesky", 60, "1 dead after shooting at Atlanta's Lenox Square mall", "A man was killed in a shooting at Lenox Square mall in Atlanta that police said stemmed from a dispute between two groups.", "killed 1"),
    a("cbs-world", 80, "Lenox Square shooting: 1 killed, suspect sought, Atlanta police say", "", "killed 1 official"),
    a("axios", 120, "Atlanta police seek suspect in deadly Lenox Square mall shooting", "Police said the victim, a 22-year-old man, died at the hospital."),
  ], "WSB and Axios share an owner (Cox); third US shooting the same day"),

  ev("nyc-subway-stabbing", "2026-10-11T23:00:00Z", "corroborated", [
    a("nbc-world", 0, "2 stabbed at Times Square subway station; suspect arrested", "Police said a 41-year-old man was arrested after two people were stabbed on a platform at the Times Square station."),
    a("cbs-world", 30, "Two people stabbed in Times Square subway station, NYPD says", "Both victims were taken to Bellevue Hospital in stable condition, police said."),
    a("fox-world", 60, "NYC subway stabbing: 2 hurt at Times Square station, suspect in custody", "", "injured 2"),
    a("ap-bluesky", 90, "2 people stabbed in New York City subway station; suspect arrested", ""),
  ]),

  ev("mannheim-stabbing", "2026-10-12T09:30:00Z", "corroborated", [
    a("reddit-worldnews", 20, "Knife attack in Mannheim city centre, police everywhere", ""),
    a("dw-en", 45, "Germany: Several injured in Mannheim knife attack", "Police in the southwestern German city of Mannheim said a man attacked people with a knife at a market square, injuring several. The suspect was detained."),
    a("reuters-bluesky", 70, "Three injured in knife attack in German city of Mannheim, police say", "A man stabbed three people at a market in central Mannheim on Monday before being overpowered by police, a police spokesperson said.", "injured 3 official"),
    a("bbc-world", 90, "Mannheim: Three hurt in market square stabbing", "German police said a 31-year-old Afghan man was arrested after the attack. The motive is unclear.", "injured 3"),
    a("euronews", 110, "Mannheim knife attack: three people injured, suspect arrested", "German police have arrested a man after three people were injured in a knife attack at Mannheim's Marktplatz.", "injured 3"),
    a("dw-en", 300, "Mannheim attack: Prosecutors investigate possible Islamist motive", "Federal prosecutors took over the investigation into Monday's knife attack in Mannheim, in which three people were injured, one seriously.", "injured 3"),
    a("guardian-world", 320, "German prosecutors take over Mannheim stabbing inquiry", "The suspect, 31, was arrested at the scene of the market square attack."),
  ]),

  ev("el-fasher-market", "2026-10-12T10:00:00Z", "confirmed", [
    a("aljazeera", 60, "Sudan: Shelling of El Fasher market kills at least 40, witnesses say", "At least 40 people were killed when shells hit a crowded market in El Fasher, the capital of North Darfur, residents said.", "killed >=40 witness"),
    a("middleeasteye", 120, "RSF accused of shelling El Fasher market, killing dozens", "Medical sources in El Fasher said at least 40 civilians were killed and more than 70 injured in the attack blamed on the Rapid Support Forces.", "killed >=40 official", "injured >70 official"),
    a("reuters-bluesky", 200, "Shelling kills dozens at market in Sudan's El Fasher, residents say", "Residents and a local aid group said at least 43 people were killed when artillery shells struck the Abu Shouk market area.", "killed >=43 witness"),
    a("bbc-world", 260, "Sudan war: Dozens killed in attack on El Fasher market", "The Sudanese army blamed the paramilitary Rapid Support Forces for the shelling."),
    a("guardian-world", 300, "RSF denies shelling El Fasher market, blames Sudanese army", "The Rapid Support Forces denied responsibility for the attack that residents say killed at least 43 people, accusing the army of fabricating the claim.", "killed >=43 witness", DENIAL),
    a("france24-en", 330, "Sudan's RSF rejects accusations over deadly El Fasher market shelling", "", DENIAL),
    a("un-news", 1400, "Sudan: UN rights chief condemns deadly attack on El Fasher market", "The UN human rights office said at least 45 civilians were killed in the shelling of the market, calling for an independent investigation.", "killed >=45 official"),
  ], "the accused side denies responsibility, not the attack: the attack itself is confirmed (needs stance understanding)"),

  ev("qatar-sudan-truce", "2026-10-13T13:00:00Z", "corroborated", [
    a("aljazeera", 0, "Qatar says Sudan's warring parties agree to humanitarian truce in Doha talks", "Qatar's foreign ministry spokesman said the army and the RSF agreed to a 72-hour truce to allow aid into El Fasher."),
    a("reuters-bluesky", 60, "Sudan's army and RSF agree to 72-hour truce, Qatar says", ""),
    a("bbc-world", 100, "Sudan war: Army and RSF agree three-day truce after Qatar mediation", ""),
    a("arabnews", 120, "Saudi Arabia welcomes Sudan truce announced in Doha", ""),
  ], "Qatari and Saudi state media on their own governments; shares 'El Fasher'/'RSF' with the market attack"),

  ev("kyiv-drones", "2026-10-13T00:30:00Z", "corroborated", [
    a("reddit-worldnews", 30, "Explosions in Kyiv right now, air defense working", ""),
    a("kyivindependent", 60, "Russian drone attack on Kyiv kills 2, injures 9", "Russia launched a large-scale drone attack on Kyiv overnight, killing two people and injuring nine, the city's mayor said.", "killed 2 official", "injured 9 official"),
    a("reuters-bluesky", 120, "Russian drones hit Kyiv apartment blocks, killing 2, officials say", "Ukraine's air force said it shot down 84 of 110 drones launched overnight.", "killed 2 official"),
    a("bbc-world", 200, "Ukraine war: Deadly Russian drone strikes hit Kyiv", "At least four people were killed and 19 injured, Kyiv's military administration said, as the toll rose during the morning.", "killed >=4 official", "injured 19 official"),
    a("dw-en", 230, "Kyiv: Death toll from Russian drone attack rises to 4", "Ukrainian officials said 19 people were injured in the overnight attack on the capital.", "killed 4", "injured 19 official"),
    a("tass", 240, "Russian forces strike Ukrainian military-industrial facilities in Kyiv, defence ministry says", "The Russian Defence Ministry said all designated targets were hit by precision weapons and drones."),
    a("guardian-world", 260, "Russia-Ukraine war live: four killed in Kyiv drone attack", "Russia's defence ministry said it struck military-industrial facilities in Kyiv with drones.", "killed 4"),
    a("kyivindependent", 400, "Kyiv drone attack: death toll rises to 4, 19 injured", "Rescue workers pulled a body from the rubble of an apartment building in Kyiv's Solomianskyi district, the State Emergency Service said.", "killed 4", "injured 19"),
  ], "Russian state media covers the same strike from its side"),

  ev("belgorod-drone", "2026-10-11T18:00:00Z", "reported", [
    a("tass", 0, "Ukrainian drone attack on Belgorod kills 3 civilians, governor says", "Belgorod Region Governor said three civilians were killed and seven injured when a Ukrainian drone struck a car.", "killed 3 official", "injured 7 official"),
    a("rt", 30, "Kiev regime drone strike kills three in Belgorod", "", "killed 3"),
    a("reuters-bluesky", 120, "Ukrainian drone kills 3 in Russia's Belgorod region, governor says", "Reuters could not independently verify the report. There was no immediate comment from Kyiv.", "killed 3 official"),
  ], "Russian state media on Russia: only Reuters counts; another drone strike (Kyiv) follows within 36 h"),

  ev("haiti-gang-attack", "2026-10-11T12:00:00Z", "confirmed", [
    a("reuters-bluesky", 0, "Gang attack in Haiti town of Liancourt kills at least 20, officials say", "Gang members armed with automatic weapons attacked the town overnight, killing at least 20 people, a local official said.", "killed >=20 official"),
    a("reddit-worldnews", 100, "Massacre in Haiti, gang attacked a town in Artibonite", ""),
    a("ap-bluesky", 120, "Gang attack in central Haiti kills dozens, including women and children", "Haiti's government said at least 30 people were killed in the attack on Liancourt, in the Artibonite region.", "killed >=30 official"),
    a("france24-en", 200, "Haiti: Gang massacre in Artibonite kills at least 30", "", "killed >=30"),
    a("un-news", 600, "Haiti: UN condemns gang attack that killed at least 45 in Artibonite", "The UN human rights office said at least 45 people were killed and more than 6,000 displaced by the attack on Liancourt.", "killed >=45 official", "displaced >6000 official"),
    a("aljazeera", 700, "Haiti gang attack death toll rises to 45 as thousands flee Liancourt", "", "killed 45"),
  ]),

  ev("delhi-factory-fire", "2026-10-13T19:00:00Z", "corroborated", [
    a("toi-world", 30, "Fire breaks out at factory in Delhi's Mundka; 30 fire tenders at spot", ""),
    a("hindu-intl", 120, "11 killed in fire at Delhi factory building", "At least 11 people were killed and several injured in a fire at a four-storey factory building in outer Delhi's Mundka, police said.", "killed >=11 official"),
    a("reuters-bluesky", 180, "Fire at New Delhi factory kills 11, police say", "", "killed 11 official"),
    a("bbc-world", 240, "Delhi fire: 11 dead in blaze at Mundka factory building", "Firefighters rescued 50 people from the building, Delhi Fire Service said.", "killed 11"),
    a("toi-world", 900, "Mundka fire: toll rises to 13, factory owners arrested", "Delhi Police arrested the two owners of the building on charges of culpable homicide.", "killed 13"),
    a("dawn", 1000, "India: Death toll in Delhi factory fire climbs to 13", "", "killed 13"),
  ]),

  ev("nairobi-fuel-protests", "2026-10-12T09:00:00Z", "corroborated", [
    a("nation-ke", 0, "Police fire tear gas at fuel price protesters in Nairobi CBD", "Hundreds of protesters marched on Parliament Road against the new fuel levy, police said."),
    a("reuters-bluesky", 120, "Kenyan police fire tear gas at protesters angry over fuel tax rise", "Police fired tear gas and arrested at least 30 people in Nairobi, a Reuters witness said.", "arrested >=30 witness"),
    a("bbc-world", 200, "Kenya fuel protests: Two killed as police clash with demonstrators", "Two people were shot dead in Nairobi's Mathare area, witnesses said.", "killed 2 witness"),
    a("aljazeera", 260, "Kenya: Deadly clashes as fuel tax protests spread beyond Nairobi", "At least three people were killed in protests in Nairobi and Kisumu, police said, as demonstrators burned tyres and blocked roads.", "killed >=3 official"),
    a("nation-ke", 300, "Fuel protests: 52 arrested in Nairobi and Kisumu, police say", "The Inspector General said officers had shown restraint.", "arrested 52 official"),
  ], "same city as the Kenyan election a day earlier, different story"),

  ev("iran-spy-arrests", "2026-10-13T06:00:00Z", "corroborated", [
    a("presstv", 0, "Iran's intelligence ministry arrests 12 members of Mossad-linked spy network", "The Intelligence Ministry said 12 people were arrested in four provinces for spying for Israel.", "arrested 12 official"),
    a("reuters-bluesky", 120, "Iran says it arrested 12 people spying for Israel, state media reports", "", "arrested 12 official"),
    a("timesofisrael", 180, "Iran claims arrest of 12 'Mossad agents' in sweeping crackdown", "", "arrested 12 official"),
  ], "Iranian state media on Iran does not count; Reuters and Times of Israel do"),

  ev("peru-bus-crash", "2026-10-12T16:00:00Z", "reported", [
    a("ap-bluesky", 0, "Bus plunges into ravine in Peru's Andes, killing 24", "A bus carrying farmworkers plunged 200 meters into a ravine in the Cusco region of Peru, killing 24 people and injuring 13, police said.", "killed 24 official", "injured 13 official"),
    a("cbs-world", 20, "Bus plunges into ravine in Peru's Andes, killing 24 (AP)", "LIMA, Peru (AP) — A bus carrying farmworkers plunged 200 meters into a ravine in the Cusco region of Peru, killing 24 people and injuring 13, police said.", "killed 24 official", "injured 13 official"),
    a("abc-us-intl", 25, "Bus plunges into ravine in Peru's Andes, killing 24", "LIMA, Peru (AP) — A bus carrying farmworkers plunged 200 meters into a ravine in the Cusco region, killing 24 people, police said.", "killed 24 official"),
    a("latimes-world", 40, "Peru bus crash kills 24 in Andes ravine", "LIMA, Peru (AP) — A bus plunged into a ravine in the Cusco region, killing 24 people and injuring 13, police said.", "killed 24 official", "injured 13 official"),
    a("reddit-news", 50, "24 dead after bus falls into ravine in Peru", "", "killed 24"),
  ], "one AP story republished by three outlets: one independent origin"),
];
