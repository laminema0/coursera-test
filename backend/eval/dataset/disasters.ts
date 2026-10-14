import { a, DENIAL, ev, type LabeledEvent } from "../dsl.ts";

// Earthquakes, storms, floods, fires, collapses and accidents. Invented incidents in real places,
// written in the style of each outlet's feed (USGS/GDACS machine titles, wire ledes, broadcaster headlines).
export const disasters: LabeledEvent[] = [
  ev("peru-quake", "2026-10-12T03:14:00Z", "confirmed", [
    a("reddit-worldnews", 6, "Strong earthquake felt in Arequipa, Peru right now, people running into the streets", ""),
    a("usgs-quakes", 9, "M 6.8 - 41 km SW of Arequipa, Peru", "Magnitude 6.8 · 41 km SW of Arequipa, Peru · depth 35 km · PAGER alert: orange", "magnitude 6.8"),
    a("gdacs", 25, "Orange earthquake alert (Magnitude 6.8M, Depth:35km) in Peru 12/10/2026 03:14 UTC", "On 12/10/2026 03:14 UTC, an earthquake of magnitude 6.8M occurred in Peru. 1.2 million people live within 100 km.", "magnitude 6.8"),
    a("reuters-bluesky", 40, "Magnitude 6.8 earthquake strikes southern Peru near Arequipa", "A magnitude 6.8 earthquake struck southern Peru early on Monday, damaging homes in the city of Arequipa, the country's geophysical institute said.", "magnitude 6.8 official"),
    a("bbc-world", 55, "Peru earthquake: At least four dead as strong quake hits Arequipa", "At least four people were killed when a 6.8-magnitude earthquake struck southern Peru, local authorities said, with several buildings collapsed in Arequipa's historic centre.", "killed >=4 official", "magnitude 6.8 official"),
    a("france24-en", 70, "Strong earthquake shakes southern Peru, killing at least four", "A powerful earthquake hit near the city of Arequipa in southern Peru on Monday, killing at least four people and injuring dozens, according to Peru's civil defence institute.", "killed >=4 official"),
    a("rfi-en", 75, "Peru: at least four killed in Arequipa earthquake", "At least four people died after a magnitude 6.8 quake struck the Arequipa region, Peruvian authorities said.", "killed >=4 official", "magnitude 6.8 official"),
    a("guardian-world", 140, "Peru earthquake death toll rises to nine as rescuers search rubble in Arequipa", "Rescuers in Arequipa were searching collapsed adobe homes after Monday's earthquake, which Peru's health ministry said had killed nine people and injured 112.", "killed 9 official", "injured 112 official"),
    a("cbc-world", 150, "Southern Peru earthquake kills 9, injures more than 100", "The magnitude 6.8 quake damaged hundreds of homes around Arequipa, Peru's health ministry said.", "killed 9", "injured >100", "magnitude 6.8 official"),
    a("ap-bluesky", 300, "Death toll from Peru earthquake climbs to 17 as rescuers dig through rubble", "Peruvian officials said Monday that 17 people were killed and more than 200 injured in the quake that struck near Arequipa.", "killed 17 official", "injured >200 official"),
    a("nyt-world", 330, "Earthquake in Peru Kills at Least 17 and Damages Colonial-Era Churches", "The quake, centered southwest of Arequipa, toppled church towers and adobe homes, officials said.", "killed >=17"),
    a("aljazeera", 360, "Peru quake toll rises to 17 as aftershocks rattle Arequipa", "At least 17 people have died and 3,000 have been displaced after the earthquake in southern Peru, the government said.", "killed >=17 official", "displaced 3000 official"),
    a("un-news", 2146, "Peru: UN releases $3 million in emergency funds after Arequipa earthquake", "The Central Emergency Response Fund allocation will help provide shelter and water to families affected by Monday's magnitude 6.8 earthquake.", "magnitude 6.8"),
    a("reuters-bluesky", 2206, "UN releases $3 million for Peru earthquake relief", ""),
  ], "multi-source quake with a rising toll; official seismic feeds"),

  ev("japan-quake", "2026-10-12T11:20:00Z", "confirmed", [
    a("usgs-quakes", 5, "M 5.9 - 63 km E of Namie, Japan", "Magnitude 5.9 · 63 km E of Namie, Japan · depth 40 km", "magnitude 5.9"),
    a("reddit-worldnews", 8, "Just felt a strong earthquake in Sendai, long shaking", ""),
    a("nhk-world", 12, "Earthquake off Fukushima Prefecture; no tsunami expected", "A strong earthquake with a preliminary magnitude of 5.9 struck off the coast of Fukushima Prefecture. The Japan Meteorological Agency said there is no threat of a tsunami.", "magnitude 5.9"),
    a("japantimes", 30, "Magnitude 5.9 quake jolts Fukushima, no reports of damage", "The quake shook buildings in Fukushima and Miyagi prefectures. Tokyo Electric Power said there were no abnormalities at the Fukushima No. 1 nuclear plant.", "magnitude 5.9"),
    a("reuters-bluesky", 35, "Earthquake of magnitude 5.9 strikes off Fukushima, Japan - USGS", "No tsunami warning was issued, the Japan Meteorological Agency said.", "magnitude 5.9 official"),
    a("japantimes", 200, "Fukushima nuclear operator denies reports of leak after quake", "Tokyo Electric Power denied social media claims that radioactive water leaked from tanks at the Fukushima No. 1 plant after Monday's magnitude 5.9 earthquake.", "magnitude 5.9", DENIAL),
  ], "a headline denial of a side rumour (leak) must not dispute a confirmed quake"),

  ev("sulawesi-quake", "2026-10-12T19:05:00Z", "confirmed", [
    a("usgs-quakes", 0, "M 6.2 - 18 km NNW of Mamuju, Indonesia", "Magnitude 6.2 · 18 km NNW of Mamuju, Indonesia · depth 10 km", "magnitude 6.2"),
    a("gdacs", 20, "Green earthquake alert (Magnitude 6.2M, Depth:10km) in Indonesia 12/10/2026 19:05 UTC", "On 12/10/2026 19:05 UTC, an earthquake of magnitude 6.2M occurred in Indonesia. The earthquake happened in a region with a population of 410,000 within 100 km.", "magnitude 6.2"),
    a("reddit-worldnews", 30, "Earthquake in Sulawesi again, Mamuju hospital damaged (video)", ""),
    a("afp-bluesky", 60, "Indonesia quake on Sulawesi island kills at least three", "A 6.2-magnitude earthquake struck West Sulawesi province overnight, killing at least three people and damaging a hospital, the national disaster agency said.", "killed >=3 official", "magnitude 6.2 official"),
    a("abc-au", 90, "Deadly earthquake hits Indonesia's Sulawesi island", "At least three people have died and 26 were injured in Mamuju, Indonesia's disaster mitigation agency BNPB said.", "killed >=3 official", "injured 26 official"),
    a("scmp-world", 120, "Indonesia earthquake: 3 dead, hundreds of homes damaged in Mamuju", "The quake struck at a shallow depth of 10km, sending residents fleeing in panic, according to local media.", "killed 3"),
    a("cna", 240, "Death toll in Sulawesi earthquake rises to 7, about 2,000 evacuated", "Indonesian authorities said seven people were killed and around 2,000 residents of Mamuju were moved to temporary shelters.", "killed 7 official", "evacuated ~2000 official"),
  ], "same type as peru-quake, same day, different place"),

  ev("chile-quake", "2026-10-12T08:40:00Z", "confirmed", [
    a("usgs-quakes", 0, "M 5.4 - 35 km NW of Calama, Chile", "Magnitude 5.4 · 35 km NW of Calama, Chile · depth 110 km", "magnitude 5.4"),
    a("mercopress", 60, "Moderate earthquake shakes northern Chile, no damage reported", "A magnitude 5.4 earthquake struck near Calama in Chile's Antofagasta region, the national seismological centre said.", "magnitude 5.4 official"),
  ], "small quake in a neighbouring country while the Peru quake is still developing"),

  ev("hurricane-lorena", "2026-10-10T12:00:00Z", "confirmed", [
    a("nyt-home", 0, "Hurricane Lorena Strengthens to Category 3 as Florida Orders Evacuations", "Officials in seven Florida counties ordered residents of coastal areas to leave ahead of the storm, expected to make landfall in the Big Bend region on Thursday night."),
    a("fox-world", 60, "Florida governor orders evacuations as Hurricane Lorena barrels toward Big Bend", "More than 300,000 residents are under mandatory evacuation orders, state emergency officials said.", "evacuated >300000 official"),
    a("whitehouse", 120, "President approves emergency declaration for Florida ahead of Hurricane Lorena", "The President today declared that an emergency exists in the State of Florida and ordered Federal assistance to supplement State and local response efforts due to Hurricane Lorena."),
    a("reddit-news", 600, "Hurricane Lorena eye about to make landfall near Cedar Key, winds insane", ""),
    a("ap-bluesky", 660, "Hurricane Lorena makes landfall in Florida's Big Bend as a Category 3 storm", "The storm came ashore near Cedar Key with 120 mph winds, knocking out power to more than 800,000 homes and businesses."),
    a("npr-news", 900, "Hurricane Lorena: at least 2 dead in Florida as storm moves into Georgia", "Two people were killed by falling trees in Tallahassee, the Leon County sheriff's office said.", "killed >=2 official"),
    a("cbs-world", 960, "Lorena kills 2 in Florida, leaves 1 million without power", "Hurricane Lorena weakened to a tropical storm over Georgia after killing two people in Florida, officials said.", "killed 2 official"),
    a("wapo-world", 1500, "Death toll from Hurricane Lorena rises to 6 across Florida and Georgia", "Officials in Georgia reported four storm-related deaths, adding to two in Florida, as crews worked to restore power to more than a million customers.", "killed 6"),
    a("nbc-world", 1560, "Hurricane Lorena death toll climbs to 6; Florida, Georgia begin cleanup", "At least six people died in the storm, officials said. More than 1,500 people remain in shelters.", "killed >=6 official"),
    a("guardian-world", 2400, "Hurricane Lorena: Florida death toll reaches 11 as bodies found in flooded homes", "Florida officials said five more bodies had been recovered in Taylor County, bringing the storm's death toll across the south-east US to 11.", "killed 11 official"),
    a("ap-bluesky", 2450, "Hurricane Lorena death toll rises to 11 in Florida and Georgia", "Searchers found five more bodies in flooded homes in Taylor County, Florida, raising the death toll from Hurricane Lorena to 11.", "killed 11"),
    a("reuters-bluesky", 2500, "Lorena's death toll hits 11 as Florida surveys damage", "Insured losses from Hurricane Lorena could reach $9 billion, catastrophe modeler Verisk estimated.", "killed 11"),
    a("whitehouse", 2700, "President to visit Florida and Georgia communities affected by Hurricane Lorena", "The President will survey damage in Perry, Florida, and Valdosta, Georgia, and meet families affected by the storm."),
    a("fox-world", 2760, "Hurricane Lorena: 11 dead, hundreds rescued from flooded homes", "Florida Highway Patrol and the Coast Guard rescued more than 400 people, officials said.", "killed 11"),
  ], "three-day developing story; official White House posts; rising toll"),

  ev("storm-isla", "2026-10-12T05:00:00Z", "confirmed", [
    a("ukgov-news", 0, "Environment Agency issues flood warnings as Storm Isla brings heavy rain", "Over 100 flood warnings are in place across England, with severe disruption expected in the North West."),
    a("bbc-top", 60, "Storm Isla: Man dies after tree falls on car in Cumbria", "Cumbria Police said the man, in his 60s, died at the scene."),
    a("sky-world", 90, "Storm Isla: One dead as 80mph winds batter UK", "", "killed 1"),
    a("guardian-world", 120, "Storm Isla: thousands without power and rail services cancelled", ""),
    a("independent-world", 200, "Storm Isla latest: Amber warnings extended as one person killed in Cumbria", "", "killed 1"),
  ], "a storm on the other side of the Atlantic while Hurricane Lorena is still in the news"),

  ev("typhoon-lusong", "2026-10-11T06:00:00Z", "confirmed", [
    a("gdacs", 0, "Red alert for tropical cyclone LUSONG-26 in Philippines", "Tropical cyclone LUSONG-26 can have a high humanitarian impact based on the maximum sustained wind speed, exposed population and vulnerability. 4.1 million people in Category 1 or higher wind speeds."),
    a("inquirer-ph", 90, "Typhoon Lusong slams into Isabela; 120,000 flee homes", "Some 120,000 residents of Isabela and Cagayan were evacuated ahead of the typhoon's landfall, the Office of Civil Defense said.", "evacuated ~120000 official"),
    a("reddit-worldnews", 100, "Typhoon Lusong live footage from Tuguegarao, flooding everywhere", ""),
    a("rappler", 150, "Typhoon Lusong: 3 dead in landslides in Benguet", "Three people were killed when landslides buried houses in Benguet province, the provincial disaster office reported.", "killed 3 official"),
    a("afp-bluesky", 240, "Typhoon Lusong kills at least 5 in northern Philippines", "At least five people were killed and 12 are missing after Typhoon Lusong lashed northern Luzon with torrential rain, disaster officials said.", "killed >=5 official", "missing 12 official"),
    a("bbc-world", 300, "Philippines: Typhoon Lusong leaves five dead and 12 missing", "Tens of thousands of people fled to evacuation centres as the storm brought winds of 185km/h to Luzon.", "killed 5", "missing 12"),
    a("aljazeera", 420, "Typhoon Lusong: Death toll rises to 8 in the Philippines", "Eight people have died and 14 remain missing, the National Disaster Risk Reduction and Management Council said on Sunday.", "killed 8 official", "missing 14 official"),
    a("cna", 450, "Typhoon Lusong toll climbs to 8, more than 200,000 displaced", "More than 200,000 people have been displaced across northern Luzon, according to the Philippine disaster agency.", "killed 8", "displaced >200000 official"),
    a("un-news", 1500, "Philippines: UN agencies support response as Typhoon Lusong displaces 240,000", "The UN and humanitarian partners are supporting the Government-led response after Typhoon Lusong, which has displaced some 240,000 people and damaged 35,000 homes, according to OCHA.", "displaced ~240000 official"),
    a("inquirer-ph", 1600, "Lusong death toll climbs to 11; 9 still missing", "The NDRRMC said 11 people were killed, mostly in landslides, while nine others remain missing.", "killed 11 official", "missing 9 official"),
  ], "two-day typhoon coverage with displaced/missing counts from agencies"),

  ev("bangladesh-floods", "2026-10-11T02:00:00Z", "confirmed", [
    a("dhakatribune", 0, "Flash floods hit Sylhet and Sunamganj as rivers overflow", "Heavy rain upstream in India's Meghalaya caused the Surma and Kushiyara rivers to burst their banks, inundating hundreds of villages."),
    a("dhakatribune", 400, "Sylhet floods: 4 dead, 300,000 stranded", "At least four people drowned in Sunamganj, local officials said, as floodwater cut off roads across the region.", "killed >=4 official"),
    a("reuters-bluesky", 600, "Floods in northeast Bangladesh kill at least 6, strand hundreds of thousands", "Floods triggered by monsoon rains killed at least six people in northeast Bangladesh and left about 300,000 stranded, officials said.", "killed >=6 official"),
    a("aljazeera", 700, "Bangladesh floods leave hundreds of thousands stranded in Sylhet", "Rescuers used boats to reach marooned villagers as the army was deployed to help with evacuation."),
    a("toi-world", 900, "Assam, Bangladesh floods: toll rises as Brahmaputra swells", "In Bangladesh, at least 9 people have died in floods in Sylhet division, officials said, while in Assam over 50,000 people are in relief camps.", "killed >=9 official"),
    a("un-news", 1300, "Bangladesh: UNICEF warns 772,000 children at risk as floods engulf Sylhet", "More than 1.6 million people are affected by flooding in northeast Bangladesh, and at least 12 people have died, according to the government.", "killed >=12 official"),
    a("dhakatribune", 1500, "Sylhet flood death toll rises to 14; 25,000 in shelters", "The district administration said 14 people had died since Tuesday, most of them by drowning, and 25,000 people were sheltering in 180 flood centres.", "killed 14 official"),
  ]),

  ev("valencia-floods", "2026-10-13T04:00:00Z", "corroborated", [
    a("euronews", 0, "Flash floods hit Spain's Valencia region after torrential rain", "Spain's weather agency AEMET issued a red alert as more than 300mm of rain fell in some areas."),
    a("reuters-bluesky", 180, "Flash floods in eastern Spain kill at least 5, officials say", "Emergency services rescued dozens of people trapped in cars and homes in the Valencia region, regional officials said.", "killed >=5 official"),
    a("guardian-world", 300, "Spain floods: at least seven dead in Valencia as cars swept away", "Regional president said seven bodies had been recovered and several people were missing.", "killed >=7 official"),
    a("bbc-world", 320, "Valencia floods: Seven killed as torrential rain hits eastern Spain", "", "killed 7"),
    a("france24-en", 900, "Spain floods death toll rises to 12, dozens still missing", "Spain's interior ministry said 12 people had died in the Valencia region.", "killed 12 official"),
    a("rte-news", 950, "Twelve dead in Spanish floods as rescue efforts continue", "", "killed 12"),
    a("dw-en", 1000, "Spain: Valencia flood toll climbs to 12", "", "killed 12"),
  ], "same type as bangladesh-floods; rising toll"),

  ev("gujarat-blast", "2026-10-12T07:00:00Z", "corroborated", [
    a("toi-world", 30, "Blast at chemical factory in Gujarat's Bharuch; several feared dead", "A massive explosion ripped through a reactor at a pharmaceutical chemicals unit in Dahej industrial estate in Bharuch district."),
    a("hindu-intl", 90, "Seven killed, 30 injured in explosion at Gujarat chemical plant", "Seven workers were killed and 30 others injured when a reactor exploded at a chemical factory in Dahej, Bharuch district, police said.", "killed 7 official", "injured 30 official"),
    a("reuters-bluesky", 120, "Explosion at Indian chemical plant kills 7, injures 30", "An explosion at a chemical factory in India's western state of Gujarat killed seven workers and injured 30, a police official said.", "killed 7 official", "injured 30 official"),
    a("bbc-world", 180, "Gujarat: Deadly blast at Dahej chemical plant", "Rescue teams are searching for workers believed to be trapped, officials said."),
    a("aljazeera", 200, "India: Explosion at Gujarat chemical factory kills seven workers", "At least 30 people were also injured in the blast in Bharuch district, according to local police.", "killed 7", "injured >=30 official"),
    a("toi-world", 600, "Dahej blast toll rises to 9 as two injured workers die in hospital", "Two more workers succumbed to burns at a hospital in Vadodara, taking the toll in the Dahej chemical unit explosion to nine, officials said.", "killed 9 official"),
    a("hindu-intl", 620, "Gujarat factory explosion: owner arrested, death toll at 9", "Police arrested the owner and manager of the chemical unit for negligence.", "killed 9"),
  ]),

  ev("paris-explosion", "2026-10-13T08:10:00Z", "corroborated", [
    a("france24-en", 20, "Explosion rocks apartment building in Paris's 11th arrondissement", "Firefighters were at the scene of a powerful explosion that tore through the facade of a residential building on Rue Oberkampf."),
    a("afp-bluesky", 40, "Paris building explosion injures 12, two missing", "A suspected gas explosion in an apartment block in eastern Paris injured 12 people, four of them seriously, and two people are missing, the fire service said.", "injured 12 official", "missing 2 official"),
    a("rfi-en", 60, "Paris: twelve injured in suspected gas explosion", "Two people remain unaccounted for, according to the Paris fire brigade.", "injured 12", "missing 2 official"),
    a("bbc-world", 75, "Paris explosion: 12 hurt as blast rips through apartment block", "Paris police chief said a gas leak was the likely cause.", "injured 12"),
    a("guardian-world", 90, "Paris gas explosion leaves 12 injured and two missing", "Emergency services were searching the rubble of the building in the 11th arrondissement, the interior minister said.", "injured 12", "missing 2"),
    a("euronews", 120, "Paris: Rescuers search for two missing after apartment explosion", "", "missing 2"),
    a("france24-en", 600, "Paris explosion: Body found in rubble, one person still missing", "Rescuers found a body in the rubble of the building on Rue Oberkampf, prosecutors said. One person is still missing and 12 were injured.", "missing 1", "injured 12"),
  ], "same type as gujarat-blast; France 24 and RFI share an owner"),

  ev("tultepec-fireworks", "2026-10-11T22:00:00Z", "corroborated", [
    a("reddit-worldnews", 30, "Huge explosion in Tultepec Mexico (fireworks again)", ""),
    a("reuters-bluesky", 60, "Explosion at fireworks warehouse in central Mexico kills 9", "An explosion at an illegal fireworks warehouse in Tultepec, in Mexico State, killed nine people and injured 15, state authorities said.", "killed 9 official", "injured 15 official"),
    a("ap-bluesky", 90, "Fireworks blast in Mexico's fireworks capital Tultepec kills 9, injures 15", "", "killed 9", "injured 15"),
    a("latimes-world", 200, "Another deadly fireworks explosion in Tultepec, Mexico's pyrotechnics hub", "At least nine people died. The town has suffered repeated blasts, including one in 2016 that killed 42 people.", "killed >=9"),
  ], "background sentence mentions an old toll (42) that is not this event's number"),

  ev("lagos-collapse", "2026-10-11T13:00:00Z", "corroborated", [
    a("premiumtimes", 30, "Building collapses in Lagos Island, many feared trapped", "A seven-storey building under construction collapsed on Adeniji Adele Road in Lagos Island on Saturday, the Lagos State Emergency Management Agency said."),
    a("reddit-worldnews", 50, "Another building collapse in Lagos, Nigeria", ""),
    a("afp-bluesky", 120, "Building collapse in Nigeria's Lagos kills at least 3, dozens trapped", "At least three people were killed when a seven-storey building collapsed in Lagos, emergency officials said, with dozens of workers feared trapped.", "killed >=3 official"),
    a("bbc-world", 180, "Lagos building collapse: Rescuers search for survivors", "Emergency workers have pulled 12 people alive from the rubble of the seven-storey building, LASEMA said."),
    a("africanews", 400, "Nigeria: Death toll in Lagos building collapse rises to 6", "The Lagos State Emergency Management Agency said six bodies had been recovered and 14 people rescued.", "killed 6 official"),
    a("premiumtimes", 1500, "Lagos building collapse: death toll rises to 12", "LASEMA said 12 bodies had been recovered as of Sunday afternoon and search efforts were continuing.", "killed 12 official"),
    a("reuters-bluesky", 1560, "Death toll from Lagos building collapse rises to 12, rescue continues", "Nigerian emergency officials said on Sunday that 12 people had died and at least 20 were rescued from the collapsed tower.", "killed 12 official"),
    a("euronews", 1600, "Lagos building collapse: 12 dead as search for survivors continues", "", "killed 12"),
    a("aljazeera", 2900, "Lagos building collapse: 21 dead as rescue operation ends", "Nigerian authorities said 21 people were killed and 28 rescued after the building collapsed on Saturday.", "killed 21 official"),
    a("premiumtimes", 2950, "Lagos collapse: Govt orders arrest of developer as death toll hits 21", "Lagos State governor ordered the arrest of the developer and the structural engineer.", "killed 21"),
    a("africanews", 2990, "Nigeria: Lagos building collapse toll rises to 21", "Rescue operations ended on Monday, with 21 confirmed dead and 28 survivors pulled from the rubble.", "killed 21"),
  ], "three-day story; Euronews and Africanews share an owner"),

  ev("ridge-fire", "2026-10-11T19:00:00Z", "corroborated", [
    a("latimes-world", 0, "Ridge fire explodes in Ventura County, forcing evacuations", "The fast-moving brush fire has burned 4,000 acres near Ojai and forced the evacuation of about 15,000 residents, fire officials said.", "evacuated ~15000 official"),
    a("reddit-news", 40, "Massive fire visible from Ojai, evacuation orders coming in", ""),
    a("nbc-world", 120, "Ridge fire: 15,000 evacuated as wind-driven blaze grows near Ojai", "Santa Ana winds gusting to 60 mph pushed the fire toward homes, Cal Fire said.", "evacuated 15000"),
    a("ap-bluesky", 600, "California wildfire burns homes near Ojai; 15,000 people ordered to evacuate", "The Ridge fire has destroyed at least 40 structures, Ventura County fire officials said.", "evacuated 15000"),
    a("fox-world", 1500, "Ridge fire doubles in size; 30,000 now under evacuation orders", "The blaze has scorched 11,000 acres and is 5% contained, officials said.", "evacuated 30000"),
    a("cbs-world", 1560, "2 dead in Ridge fire as evacuations expand to 30,000 in Ventura County", "Two people were found dead in a burned home in Upper Ojai, the Ventura County sheriff said.", "killed 2 official", "evacuated 30000"),
    a("npr-news", 1700, "The Ridge fire has killed 2 and forced 30,000 to flee in Southern California", "Firefighters made progress overnight as winds eased.", "killed 2", "evacuated 30000"),
    a("latimes-world", 2900, "Ridge fire 40% contained; some Ojai evacuation orders lifted", "Fire officials said 120 homes were destroyed and two people were killed.", "killed 2 official"),
  ]),

  ev("nepal-plane", "2026-10-12T05:30:00Z", "corroborated", [
    a("reddit-worldnews", 15, "Plane crash reported near Pokhara airport, smoke visible", ""),
    a("toi-world", 60, "Plane with 18 on board crashes near Nepal's Pokhara", "A Himal Air plane carrying 18 people crashed shortly after take-off from Pokhara, Nepal's civil aviation authority said."),
    a("reuters-bluesky", 90, "All 18 aboard killed in Nepal plane crash, officials say", "A Himal Air turboprop crashed into a gorge shortly after take-off from Pokhara on Monday, killing all 18 people on board, officials said.", "killed 18 official"),
    a("bbc-world", 120, "Nepal plane crash: 18 killed near Pokhara", "Rescuers recovered 16 bodies from the crash site, police said.", "killed 18"),
    a("dawn", 200, "Nepal: 18 dead as passenger plane crashes after take-off from Pokhara", "", "killed 18"),
    a("aljazeera", 210, "Nepal plane crash: no survivors as Himal Air flight goes down", "All 18 people on board, including two crew members, were killed, Nepal's civil aviation authority said.", "killed 18 official"),
    a("hindu-intl", 400, "Nepal plane crash: Five Indian nationals among 18 dead", "Nepal's civil aviation authority said the flight data recorder had been recovered.", "killed 18"),
  ]),

  ev("sulawesi-ferry", "2026-10-13T01:00:00Z", "corroborated", [
    a("afp-bluesky", 60, "Ferry capsizes off Indonesia's Sulawesi island, 30 missing", "A ferry carrying about 80 passengers capsized in rough seas off Buton island in Southeast Sulawesi, with 30 people missing, the search and rescue agency said.", "missing 30 official"),
    a("abc-au", 90, "Indonesian ferry sinks off Sulawesi; 9 dead, dozens missing", "Rescuers pulled 41 survivors from the water near Buton island, Indonesia's search and rescue agency Basarnas said.", "killed 9"),
    a("scmp-world", 120, "Indonesia ferry disaster: at least 9 killed off Buton island", "Some 30 people are still missing after the overcrowded ferry capsized, according to Basarnas.", "killed >=9", "missing ~30 official"),
    a("cna", 130, "Ferry capsizes in Southeast Sulawesi with about 80 on board", "Indonesian authorities said nine bodies had been recovered and search operations were continuing.", "killed 9 official"),
    a("inquirer-ph", 300, "Indonesia ferry capsize: death toll rises to 14", "", "killed 14"),
    a("reuters-bluesky", 320, "Death toll in Indonesia ferry sinking rises to 14, 16 still missing", "Indonesia's search and rescue agency said 14 bodies had been recovered.", "killed 14 official", "missing 16"),
  ], "same island as sulawesi-quake, a few hours later: a different story"),

  ev("brazil-bridge", "2026-10-12T18:00:00Z", "corroborated", [
    a("mercopress", 60, "Bridge collapses between Brazilian states of Tocantins and Maranhão; vehicles plunge into river", "At least four people were killed and 13 are missing, Brazil's Federal Highway Police said.", "killed >=4 official", "missing 13 official"),
    a("reuters-bluesky", 90, "Bridge collapse in northern Brazil leaves 4 dead, 13 missing", "", "killed 4", "missing 13"),
    a("aljazeera", 150, "Brazil bridge collapse: Divers search Tocantins river for missing", "Navy divers were searching for 13 people missing after the bridge gave way, officials said.", "missing 13 official"),
    a("ap-bluesky", 900, "Death toll in Brazil bridge collapse rises to 9 as divers recover bodies", "Four people remain missing, the Brazilian navy said.", "killed 9", "missing 4 official"),
    a("euronews", 950, "Brazil: Nine dead after bridge collapse in Tocantins, four still missing", "", "killed 9", "missing 4"),
  ]),

  ev("ohio-derailment", "2026-10-12T23:00:00Z", "confirmed", [
    a("reddit-news", 0, "Train derailment and fire in East Liverpool Ohio, huge flames", ""),
    a("ap-bluesky", 60, "Freight train derails in eastern Ohio, sparking fire; residents told to evacuate", "About 2,000 residents within a mile of the derailment in East Liverpool were ordered to evacuate, the fire chief said.", "evacuated ~2000 official"),
    a("cbs-world", 90, "Ohio train derailment: Hazardous materials on board, 2,000 evacuated", "The 120-car freight train was carrying vinyl chloride, officials said.", "evacuated 2000"),
    a("nbc-world", 120, "Ohio train derailment forces evacuation of 2,000 in East Liverpool", "No injuries were reported, officials said.", "evacuated 2000"),
    a("fox-world", 150, "East Liverpool derailment: Evacuation order for 2,000 residents as fire burns", "", "evacuated 2000"),
    a("npr-news", 300, "Ohio derailment: officials lift some evacuation orders as fire is contained", "The NTSB is sending investigators to East Liverpool."),
    a("whitehouse", 900, "Statement from the Press Secretary on the train derailment in East Liverpool, Ohio", "The President has been briefed on the derailment and the Administration is in close contact with state and local officials."),
  ], "social post first, then news, then an official statement"),

  ev("iceland-volcano", "2026-10-12T22:30:00Z", "corroborated", [
    a("bbc-world", 30, "Iceland volcano erupts near Grindavik for the tenth time", "A fissure opened on the Reykjanes peninsula, the Icelandic Met Office said, and the town of Grindavik was evacuated."),
    a("reuters-bluesky", 60, "Volcano erupts on Iceland's Reykjanes peninsula, Blue Lagoon evacuated", "About 1,000 guests and staff were evacuated from the Blue Lagoon spa, police said.", "evacuated ~1000 official"),
    a("guardian-world", 90, "Iceland volcano: eruption near Grindavík forces evacuation of Blue Lagoon", ""),
    a("euronews", 120, "Volcanic eruption in Iceland: lava flows towards Grindavik defences", "Authorities said the eruption posed no threat to Keflavik airport."),
    a("rte-news", 150, "Volcano erupts in Iceland's Reykjanes peninsula", ""),
  ]),

  ev("lampedusa-shipwreck", "2026-10-13T05:00:00Z", "confirmed", [
    a("ap-bluesky", 0, "Migrant boat capsizes off Italy's Lampedusa; 4 rescued, dozens missing", "Italian coast guard said four survivors were brought to Lampedusa."),
    a("reuters-bluesky", 60, "Dozens missing after migrant boat sinks off Lampedusa, coast guard says", ""),
    a("un-news", 300, "IOM: 41 migrants feared dead after boat capsizes off Lampedusa", "Survivors told IOM staff that the boat left Sfax in Tunisia carrying 45 people; only four were rescued.", "missing 41 official"),
    a("guardian-world", 400, "Lampedusa shipwreck: 41 people missing after boat from Tunisia capsizes", "The UN migration agency said survivors reported that 45 people had been on board.", "missing 41"),
    a("africanews", 450, "Tunisia: 41 migrants missing after shipwreck off Italy", "", "missing 41"),
  ]),
];
