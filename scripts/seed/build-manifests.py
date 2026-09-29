#!/usr/bin/env python3
"""Seed manifests/*.json from the occ prompt v1 (sections 7, 9, 11).
Re-run only to regenerate the seed; after OCR, edit the JSON directly and
use scripts/manifest-report.ts to flag mismatches."""
import json, re, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

def areas(s, **extra):
    """'E5a Hall; E5b Doru's Bedroom' -> list of {key,name}. Parenthesised sub-areas become children."""
    out = []
    for part in [p.strip() for p in s.split(';') if p.strip()]:
        m = re.match(r'^(\S+)\s+(.*)$', part)
        key, rest = m.group(1), m.group(2)
        subs = None
        sm = re.search(r'\((.*)\)\s*$', rest)
        if sm and re.match(r'^[A-Z]?\d+[a-z]\b', sm.group(1)):
            subs, rest = sm.group(1), rest[:sm.start()].strip()
        a = {'key': key, 'name': rest, 'page': None, **extra}
        out.append(a)
        if subs:
            for sp in [x.strip() for x in subs.split(',')]:
                m2 = re.match(r'^(\S+)\s*(.*)$', sp)
                out.append({'key': m2.group(1), 'name': m2.group(2) or m2.group(1), 'page': None, 'parent': key, **extra})
    return out

def seq(prefix, names, start=1, **extra):
    return [{'key': f'{prefix}{i}', 'name': n, 'page': None, **extra} for i, n in enumerate(names, start)]

def loc(id, name, chapter, status, *, pages=None, scale=None, poster=False, areas=(), levels=None, insets=(), events=(), notes=None, placement=None):
    d = {'id': id, 'name': name, 'chapter': chapter, 'status': status,
         'mapPages': pages or [], 'bookScaleFt': scale, 'poster': poster,
         'path': f'locations/{chapter}/{id}', 'areas': list(areas)}
    if levels: d['levels'] = levels
    if placement: d['placementLayer'] = placement
    if insets: d['insets'] = list(insets)
    if events: d['events'] = list(events)
    if notes: d['notes'] = notes
    return d

def inset(id, name, why, **kw):
    return {'id': id, 'name': name, 'reason': why, **kw}

L = []
# ---------------- Chapter 2
regional_pins = [('A','Old Svalich Road'),('B','Gates of Barovia'),('C','Svalich Woods'),('D','River Ivlis'),('E','Village of Barovia'),('F','River Ivlis Crossroads'),('G','Tser Pool Encampment'),('H','Tser Falls'),('I','Black Carriage'),('J','Gates of Ravenloft'),('K','Castle Ravenloft'),('L','Lake Zarovich'),('M','Mount Baratok'),('N','Town of Vallaki'),('O','Old Bonegrinder'),('P','Luna River Crossroads'),('Q','Argynvostholt'),('R','Raven River Crossroads'),('S','Village of Krezk'),('T','Tsolenka Pass'),('U','Ruins of Berez'),('V',"Van Richten's Tower"),('W','The Wizard of Wines'),('X','The Amber Temple'),('Y','Yester Hill'),('Z','Werewolf Den')]
L.append(loc('barovia-region', 'The Lands of Barovia (regional map)', 'ch02', 'regional', pages=[35], poster=True,
    areas=[{'key': k, 'name': n, 'page': None, 'pin': True} for k, n in regional_pins],
    placement={'hexFt': 1320, 'hexOrientation': 'pointy', 'note': "Book legend reads 'One square = 1/4 mile' but prints hexes; treat as 1 hex = 1/4 mile."},
    notes='Features: Old Svalich Road, Ravenloft/Vallaki road, Rivers Ivlis/Luna/Raven, Tser Pool & Falls, Lakes Zarovich/Baratok/Luna, Mounts Baratok/Ghakis, Balinok range, Svalich Woods, the Mists.'))
L.append(loc('G', 'Tser Pool Encampment', 'ch02', 'mapped', pages=[36], scale=5, poster=True,
    areas=[{'key': 'G', 'name': 'Tser Pool Encampment', 'page': None}],
    notes="Vistani wagons, Madam Eva's tent, the pool and falls approach. Sub-keys to be completed from OCR."))
possible_regional = [
 ('A','Old Svalich Road','road through pines, mist wall'),('B','Gates of Barovia','stone gate with headless statues'),
 ('C','Svalich Woods','forest road segments: straight, bend, fork'),('D','River Ivlis','50-ft-wide river, two arching stone bridges, 5–10 ft deep', {'widthFt': 50, 'depthFt': [5, 10]}),
 ('F','River Ivlis Crossroads','gallows, signpost, small graveyard'),('H','Tser Falls','bridge over the falls, Tser Pool below'),
 ('I','Black Carriage','road encounter stage'),('J','Gates of Ravenloft','approach, drawbridge and chasm'),
 ('L','Lake Zarovich',"shore, Bluto's rowboat, fishing spot"),('M','Mount Baratok','rocky slopes, the Mad Mage encounter'),
 ('P','Luna River Crossroads','bridge, signpost, treeline'),('R','Raven River Crossroads','bridge, signpost, treeline')]
for k, n, d, *dims in possible_regional:
    L.append(loc(k, n, 'ch02', 'possible', areas=[{'key': k, 'name': n, 'page': None, **({'dims': dims[0]} if dims else {})}], notes=d))

# ---------------- Chapter 3
L.append(loc('E', 'The Village of Barovia', 'ch03', 'placement', pages=[42], poster=True,
    placement={'ftPerSquare': 40},
    areas=[{'key':'E1','name':"Bildrath's Mercantile",'page':None,'inset':True},
           {'key':'E2','name':'Blood of the Vine Tavern','page':None,'inset':True,'dims':{'footprintFt':[60,60]}},
           {'key':'E3','name':"Mad Mary's Townhouse",'page':None,'inset':True,'dims':{'footprintFt':[40,40]}},
           {'key':'E4','name':"Burgomaster's Mansion",'page':None,'inset':True},
           {'key':'E5','name':'Church','page':None}],
    insets=[inset('E1','Bildrath\'s Mercantile','no interior map'), inset('E2','Blood of the Vine Tavern','no map; ~60 ft square'),
            inset('E3',"Mad Mary's Townhouse",'no map; ~40 ft square, boarded'), inset('E4',"Burgomaster's Mansion",'no map; Kolyan\'s wake')],
    events=[{'id':'march-of-the-dead','name':'March of the Dead','page':48}],
    notes='Death House (Appendix B) exterior is placed on this layer.'))
L.append(loc('E5', 'Church (Village of Barovia)', 'ch03', 'mapped', pages=[46], scale=5,
    levels=[{'id':'ground','name':'Ground floor'},{'id':'basement','name':'Basement'}],
    areas=areas("E5a Hall; E5b Doru's Bedroom; E5c Donavich's Bedroom; E5d Trapdoor; E5e Office; E5f Chapel; E5g Undercroft")))

# ---------------- Chapter 4
K = []
def kmap(mapname, page, s): K.extend(areas(s, map=mapname, mapPage=page))
kmap('Map 2', 53, "K1 Front Courtyard; K2 Center Court Gate; K3 Servants' Courtyard; K4 Carriage House; K5 Chapel Garden; K6 Overlook")
kmap('Map 3', 55, "K7 Entry; K8 Great Entry; K9 Guests' Hall; K10 Dining Hall; K11 South Archers' Post; K12 Turret Post; K13 Turret Post Access Hall; K14 Hall of Faith; K15 Chapel; K16 North Chapel Access; K17 South Chapel Access; K18 High Tower Staircase; K18a High Tower Shaft; K19 Grand Landing; K20 Heart of Sorrow; K20a Tower Hall Stair; K21 South Tower Stair; K22 North Archers' Post; K23 Servants' Entrance; K24 Servants' Quarters")
kmap('Map 4', 62, "K25 Audience Hall; K26 Guards' Post; K27 King's Hall; K28 King's Balcony; K29 Creaky Landing; K30 King's Accountant; K31 Trapworks (K31a, K31b); K32 Maid in Hell; K33 King's Apartment Stair; K34 Servants' Upper Floor")
kmap('Map 5', 65, "K35 Guardian Vermin; K36 Dining Hall of the Count; K37 Study; K38 False Treasury; K39 Hall of Webs; K40 Belfry; K41 Treasury; K42 King's Bedchamber; K43 Bath Chamber; K44 Closet; K45 Hall of Heroes; K46 Parapets")
kmap('Maps 6–10', 71, "K47 Portrait of Strahd; K48 Offstair; K49 Lounge; K50 Guest Room; K51 Closet; K52 Smokestack; K53 Rooftop; K54 Familiar Room; K55 Element Room; K56 Cauldron; K57 Tower Roof; K58 Bridge; K59 High Tower Peak; K60 North Tower Peak; K60a North Tower Rooftop")
kmap('Map 11', 75, "K61 Elevator Trap; K62 Servants' Hall; K63 Wine Cellar; K64 Guards' Stair; K65 Kitchen; K66 Butler's Quarters; K67 Hall of Bones; K68 Guards' Run; K69 Guards' Quarters; K70 Kingsmen Hall; K71 Kingsmen Quarters; K72 Chamberlain's Office")
kmap('Map 12', 75, "K73 Dungeon Hall; K74 North Dungeon; K75 South Dungeon; K76 Torture Chamber; K77 Observation Balcony; K78 Brazier Room; K79 Western Stair; K80 Center Stair; K81 Tunnel; K82 Marble Slide; K83 Spiral Stair; K83a Spiral Stair Landing; K84 Catacombs; K85 Sergei's Tomb; K86 Strahd's Tomb; K87 Guardians; K88 Tomb of King Barov and Queen Ravenovia")
# sub-cells
out = []
for a in K:
    out.append(a)
    if a['key'] in ('K74', 'K75'):
        for c in 'abcdefgh':
            out.append({'key': f"{a['key']}{c}", 'name': f"{a['name']} cell {c}", 'page': None, 'parent': a['key'], 'map': a['map'], 'mapPage': a['mapPage']})
    if a['key'] == 'K84':
        for n in range(1, 41):
            out.append({'key': f'K84-{n}', 'name': f'Crypt {n}', 'page': None, 'parent': 'K84', 'map': a['map'], 'mapPage': a['mapPage']})
K = out
for a in K:
    if a['key'] == 'K12': a['dims'] = {'shape': 'octagon', 'widthFt': 30, 'bookSquares': 3, 'check': 'scale acceptance: 6 cells'}
L.append(loc('K', 'Castle Ravenloft', 'ch04', 'mapped', pages=[53, 55, 62, 65, 71, 72, 73, 75, 76, 80], scale=10, poster=True,
    levels=[{'id':'map1','name':'Map 1 Ravenloft Heights','role':'elevation diagram, poster only'},
            {'id':'map2','name':'Map 2 Walls of Ravenloft','page':53},{'id':'map3','name':'Map 3 Main Floor','page':55},
            {'id':'map4','name':'Map 4 Court of the Count','page':62},{'id':'map5','name':'Map 5 Rooms of Weeping','page':65},
            {'id':'map6-10','name':'Maps 6–10 Spires of Ravenloft','page':71},{'id':'map11','name':'Map 11 Larders of Ill Omen','page':75},
            {'id':'map12','name':'Map 12 Dungeon and Catacombs','page':75}],
    areas=K,
    insets=[inset('K61-elevator','Elevator Trap','book inset', page=76), inset('K73-traps','Traps in Area K73','book inset', page=80)],
    notes='Isometric poster maps; 10-ft squares subdivide 2x2. K12 is a 30-ft octagon (scale acceptance test). Crypt keys use K84-N.'))

# ---------------- Chapter 5
L.append(loc('N', 'The Town of Vallaki', 'ch05', 'placement', pages=[97], poster=True,
    placement={'scaleBar': True, 'note': 'no grid; digitize from the scale bar'},
    areas=[{'key':'N1','name':"St. Andral's Church",'page':None,'inset':True},{'key':'N2','name':'Blue Water Inn','page':None},
           {'key':'N3','name':"Burgomaster's Mansion",'page':None},{'key':'N4','name':'Wachterhaus','page':None},
           {'key':'N5','name':'Arasek Stockyard','page':None,'inset':True},{'key':'N6','name':"Coffin Maker's Shop",'page':None},
           {'key':'N7','name':'Blinsky Toys','page':None,'inset':True},{'key':'N8','name':'Town Square','page':None,'inset':True},
           {'key':'N9','name':'Vistani Camp','page':None}],
    insets=[inset('N1',"St. Andral's Church",'book: reuse E5 church without the undercroft', cloneOf='E5', omit=['E5g']),
            inset('N5','Arasek Stockyard',"sheds, warehouse, Rictavio's carnival wagon"), inset('N7','Blinsky Toys','no map'),
            inset('N8','Town Square','stocks, festival stage'), inset('vallaki-gates','Vallaki gates and palisade','unmapped')],
    events=[{'id':'st-andrals-feast','name':"St. Andral's Feast",'stage':'N1'},{'id':'festival-of-the-blazing-sun','name':'Festival of the Blazing Sun','stage':'N8'},
            {'id':'lady-wachters-wish','name':"Lady Wachter's Wish",'stage':'N4'}]))
L.append(loc('N2', 'Blue Water Inn', 'ch05', 'mapped', pages=[99], scale=5,
    levels=[{'id':'ground','name':'Ground floor'},{'id':'upper','name':'Upper floor'},{'id':'attic','name':'Attic / roof'}],
    areas=areas("N2a Well; N2b Outside Staircase; N2c Taproom; N2d Wine Storage; N2e Kitchen; N2f Stable; N2g Storage; N2h Ravens' Loft; N2i Secret Stairs and Hall; N2j Great Balcony; N2k Guest Balcony; N2l Guest Rooms; N2m Guest Room; N2n Private Guest Room; N2o Boys' Bedroom; N2p Master Bedroom; N2q Secret Attic")))
L.append(loc('N3', "Burgomaster's Mansion (Vallaki)", 'ch05', 'mapped', pages=[104], scale=5,
    areas=areas("N3a Entrance Hall and Vestibule; N3b Parlor; N3c Dining Room; N3d Preparation Room; N3e Den; N3f Servants' Quarters; N3g Kitchen; N3h Pantry; N3i Upstairs Gallery; N3j Izek's Bedroom; N3k Victor's Bedroom; N3l Library; N3m Locked Closet; N3n Master Bedroom Closet; N3o Master Bedroom; N3p Bridal Gown and Spirit Mirror; N3q Bathroom; N3r Attic Room; N3s Attic Storage; N3t Victor's Workroom")))
L.append(loc('N4', 'Wachterhaus', 'ch05', 'mapped', pages=[111], scale=5,
    levels=[{'id':'ground','name':'Ground floor'},{'id':'upper','name':'Upper floor'},{'id':'cellar','name':'Cellar'}],
    areas=areas("N4a Front Door and Vestibule; N4b Staircase; N4c Kitchen; N4d Storage Room; N4e Back Vestibule; N4f Servants' Closet; N4g Secret Staircase; N4h Servants' Quarters; N4i Parlor; N4j Dining Room; N4k Den; N4l Upstairs Hall; N4m Brothers' Rooms; N4n Stella's Room; N4o Master Bedroom; N4p Library; N4q Storage Room; N4r Cellar Entrance; N4s Cellar; N4t Cult Headquarters")))
L.append(loc('N6', "Coffin Maker's Shop", 'ch05', 'mapped', pages=[116], scale=5,
    areas=areas("N6a Coffin Storage; N6b Junk Room; N6c Workshop; N6d Kitchen; N6e Henrik's Bedroom; N6f Vampire Nest and Piccolo")))
L.append(loc('N9', 'Vistani Camp', 'ch05', 'mapped', pages=[120], scale=10,
    areas=areas("N9a Kasimir's Hovel; N9b Dusk Elf Hovels; N9c Vistani Tent; N9d Horses; N9e Luvash's Wagon; N9f Wagon of Sleeping Vistani; N9g Wagon of Gambling Vistani; N9h Vistani Family Wagon; N9i Vistani Treasure Wagon")))

# ---------------- Chapter 6
L.append(loc('O', 'Old Bonegrinder', 'ch06', 'mapped', pages=[127], scale=5,
    areas=areas("O1 Ground Floor; O2 Bone Mill; O3 Bedroom; O4 Domed Attic"),
    insets=[inset('megaliths','The Megaliths','unmapped ring of standing stones', page=128)]))

# ---------------- Chapter 7
L.append(loc('Q', 'Argynvostholt', 'ch07', 'mapped', pages=[131, 137], scale=10,
    levels=[{'id':'ground','name':'Ground floor','page':131},{'id':'second','name':'Second floor','page':131},
            {'id':'third','name':'Third floor','page':137},{'id':'roof','name':'Rooftop','page':137},{'id':'beacon','name':'Beacon','page':137}],
    areas=areas("Q1 Dragon Statue; Q2 Main Entrance; Q3 Dragon's Foyer; Q4 Spiders' Ballroom; Q5 Ruined Stable; Q6 Dragon's Den; Q7 Parlor; Q8 Iron Gate; Q9 Servants' Quarters; Q10 Kitchen; Q11 Wine Storage; Q12 Dining Hall; Q13 Chapel of Morning; Q14 Chapel Staircases; Q15 Cemetery; Q16 Dragon's Mausoleum; Q17 West Staircases; Q18 Balconies; Q19 Ruined Bedchambers; Q20 South Alcove; Q21 North Alcove; Q22 Bathroom; Q23 Storage Room; Q24 Chapel Balcony; Q25 Trapped Hallway; Q26 Northeast Guest Room; Q27 Knights' Quarters; Q28 Knights' Quarters; Q29 Northwest Guest Room; Q30 Curtained Staircase; Q31 East Staircases; Q32 Ruined Bedchambers; Q33 Collapsed Ceiling; Q34 Ruined Bathroom; Q35 Upstairs Gallery; Q36 Dragon's Audience Hall; Q37 Knights of the Order; Q38 Closet; Q39 Vladimir's Bedroom; Q40 Argynvost's Study; Q41 Dragon's Vault; Q42 Argynvost's Bedroom; Q43 Hole in Roof; Q44 Dragon Gargoyle; Q45 Ancient Ballista; Q46 Destroyed Ballista; Q47 Roof Turrets; Q48 Roof's Edge; Q49 Beacon Tower Door; Q50 Beacon, Lower Landing; Q51 Beacon, Upper Landing; Q52 Beacon Turrets; Q53 Beacon of Argynvostholt"),
    events=[{'id':'special-delivery','name':'Special Delivery'},{'id':'arrigals-hunt','name':"Arrigal's Hunt"},{'id':'lighting-the-beacon','name':'Lighting the Beacon','regionalState':'beacon'}]))

# ---------------- Chapter 8
L.append(loc('S', 'The Village of Krezk', 'ch08', 'placement', pages=[144], poster=True, placement={'ftPerSquare': 50},
    areas=areas("S1 Road Junction; S2 Gatehouse; S3 Village of Krezk; S4 Pool and Shrine; S5 Winding Road; S6 North Gate; S7 Graveyard; S8 Garden Gatehouse; S9 Gardens"),
    insets=[inset('S2','Gatehouse and walls','interior unmapped'), inset('S4','Pool and Shrine','battle inset'), inset('krezk-burgomaster-cottage',"Burgomaster's cottage",'unmapped')],
    events=[{'id':'something-old-new-blue','name':'Something Old, Something New, Something Blue','stage':'S13/S12, S4'}]))
L.append(loc('S10', 'Abbey of Saint Markovia', 'ch08', 'mapped', pages=[149, 153], scale=10,
    levels=[{'id':'ground','name':'Ground floor','page':149},{'id':'upper','name':'Upper floor','page':153},{'id':'cellar','name':'Cellar','page':153}],
    areas=areas("S10 Abbey Entrance; S11 Inner Gatehouses; S12 Courtyard (S12a Well, S12b Old Troughs, S12c Chicken Sheds, S12d Tethering Posts); S13 Main Hall; S14 Foyer; S15 Madhouse (S15a Fearful Mongrelfolk, S15b Quarreling Mongrelfolk, S15c Incanting Mongrelfolk, S15d Hungry Mongrelfolk, S15e Mongrelfolk Horde, S15f Singing and Dancing Mongrelfolk, S15g Mongrelfolk Babies, S15h Mongrelfolk Fort); S16 Wine Cellar; S17 Loft and Belfry; S18 Curtain Wall; S19 Barracks; S20 Upstairs Office; S21 Haunted Hospital; S22 Operating Room; S23 Nursery; S24 Morgue")))

# ---------------- Chapter 9
L.append(loc('T', 'Tsolenka Pass', 'ch09', 'mapped', pages=[158], scale=10,
    areas=areas("T1 Gatehouse Portcullis; T2 Demon Statues; T3 Curtain of Green Flame; T4 Guard Tower, Ground Floor; T5 Guard Tower, Upper Floor; T6 Guard Tower Rooftop; T7 Western Arch; T8 Stone Bridge; T9 Eastern Arch"),
    events=[{'id':'bloodhorns-charge','name':"Bloodhorn's Charge",'stage':'T8'}],
    notes='Side-view elevation contours +100 to +900 ft: the floor plane climbs.'))

# ---------------- Chapter 10
L.append(loc('U', 'The Ruins of Berez', 'ch10', 'placement', pages=[164], poster=True, placement={'ftPerSquare': 100},
    areas=areas("U1 Abandoned Cottages; U2 Ulrich Mansion; U3 Baba Lysaga's Hut; U4 Churchyard; U5 Marina's Monument; U6 Standing Stones"),
    events=[{'id':'creeping-hut','name':'Creeping Hut'},{'id':'lost-battlefield','name':'Lost Battlefield'}], notes='Marsh floor throughout.'))
L.append(loc('U3', "Baba Lysaga's Creeping Hut", 'ch10', 'mapped', pages=[163], scale=5,
    areas=[{'key':'U3','name':"Baba Lysaga's Hut (interior)",'page':None}], notes='The hut walks: movable footprint on the Berez layer.'))

# ---------------- Chapter 11
L.append(loc('V', "Van Richten's Tower", 'ch11', 'mapped', pages=[170], scale=5,
    levels=[{'id':'grounds','name':'Grounds (Lake Baratok shore, causeway)'},{'id':'f1','name':'First floor'},{'id':'f2','name':'Second floor'},{'id':'f3','name':'Third floor'},{'id':'f4','name':'Fourth floor'}],
    areas=areas("V1 Ezmerelda's Magic Wagon; V2 Tower Door; V3 Rickety Scaffolding; V4 Tower, First Floor; V5 Tower, Second Floor; V6 Tower, Third Floor; V7 Tower, Fourth Floor"),
    events=[{'id':'pack-attack','name':'Pack Attack'},{'id':'ezmereldas-retreat','name':"Ezmerelda's Retreat"}]))

# ---------------- Chapter 12
L.append(loc('W', 'The Wizard of Wines', 'ch12', 'mapped', pages=[175], scale=5,
    areas=areas("W1 Stables; W2 Loading Dock; W3 Barrel Maker's Workshop; W4 Barrel Storage; W5 Veranda; W6 Well; W7 Outhouse; W8 Storage; W9 Fermentation Vats; W10 Glassblower's Workshop; W11 Spiral Staircase; W12 Ramp; W13 Back Staircase; W14 Wine Cellar; W15 Brown Mold; W16 Loading Winch; W17 Master Bedroom; W18 Kitchen and Dining Room; W19 Sleeping Quarters; W20 Printing Press"),
    insets=[inset('vineyard','Vineyard approach','unmapped rows of vines')],
    events=[{'id':'wine-delivery','name':'Wine Delivery'},{'id':'wintersplinter-attacks','name':'Wintersplinter Attacks','needs':'Huge clear zone'}]))

# ---------------- Chapter 13
L.append(loc('X', 'The Amber Temple', 'ch13', 'mapped', pages=[182, 190], scale=10,
    levels=[{'id':'upper','name':'Upper level','page':182},{'id':'lower','name':'Lower level','page':190}],
    areas=areas("X1 Temple Facade (X1a Narrow Fissure); X2 Entrance (X2a Guard Room, X2b Guard Room); X3 Empty Barracks; X4 Overlook; X5 Temple of Lost Secrets (X5a God of Secrets, X5b Secret Door, X5c Locked Doors, X5d Amber Reflections); X6 Southeast Annex; X7 Secret Scroll Repository; X8 Upper East Hall; X9 Lecture Hall; X10 Northeast Annex; X11 Northeast Balcony; X12 East Shrine; X13 East Archer Post; X14 North Staircase (X14a Collapsed Lower Hall); X15 Southwest Annex; X16 West Scroll Repository; X17 Upper West Hall; X18 Hallway; X19 Potion Storage; X20 Architect's Room; X21 West Staircase; X22 Northwest Annex; X23 Northwest Balcony; X24 West Shrine; X25 West Archer Post; X26 Secret Alcove; X27 Lich's Lair; X28 Hidden Phylactery; X29 Secret Room; X30 Preserved Library; X31 Central Catacombs (X31a West Catacombs, X31b East Catacombs); X32 Lower East Hall; X33 Amber Vaults (X33a Vault of Shalx, X33b Vault of Maverus, X33c Ghastly Vault, X33d Breached Vault, X33e Vault of Harkotha, X33f Vault of Thangob); X34 Wizard's Bedchamber; X35 Sleeping Guardian; X36 Lower West Hall; X37 Wizard's Bedchamber; X38 Haunted Room; X39 Plundered Treasury; X40 Sealed Treasury; X41 Fissure; X42 Amber Vault"),
    events=[{'id':'rahadins-prayer','name':"Rahadin's Prayer"}], notes='Amber sarcophagi are hidden-object slots. Snow and ice outside.'))

# ---------------- Chapter 14
L.append(loc('Y', 'Yester Hill', 'ch14', 'placement', pages=[199], placement={'ftPerSquare': 50},
    areas=areas("Y1 Trail; Y2 Berserker Cairns; Y3 Druids' Circle; Y4 Gulthias Tree; Y5 Wall of Fog"),
    insets=[inset('summit','Yester Hill summit','battle inset')],
    events=[{'id':'druids-ritual','name':"Druids' Ritual",'needs':'Huge footprint (Wintersplinter)'}]))

# ---------------- Chapter 15
L.append(loc('Z', 'Werewolf Den', 'ch15', 'mapped', pages=[202], scale=10,
    areas=areas("Z1 Cave Mouth; Z2 Guard Post; Z3 Wolf Den; Z4 Underground Spring; Z5 Deep Caves (Z5a South Cave, Z5b North Cave); Z6 Kiril's Cave; Z7 Shrine of Mother Night; Z8 Ring of Stone"),
    events=[{'id':'leader-of-the-pack','name':'Leader of the Pack'}]))

# ---------------- Appendix B
dh = ["Entrance","Main Hall","Den of Wolves","Kitchen and Pantry","Dining Room","Upper Hall","Servants' Room","Library","Secret Room","Conservatory","Balcony","Master Suite","Bathroom","Storage Room","Nursemaid's Suite","Attic Hall","Spare Bedroom","Storage Room","Spare Bedroom","Children's Room","Secret Stairs","Dungeon Level Access","Family Crypts","Cult Initiates' Quarters","Well and Cultist Quarters","Hidden Spiked Pit","Dining Hall","Larder","Ghoulish Encounter","Stairs Down","Darklord's Shrine","Hidden Trapdoor","Cult Leaders' Den","Cult Leaders' Quarters","Reliquary","Prison","Portcullis","Ritual Chamber"]
L.append(loc('death-house', 'Death House', 'appB', 'mapped', pages=[216], scale=5,
    levels=[{'id':'f1','name':'Ground floor'},{'id':'f2','name':'Second floor'},{'id':'f3','name':'Third floor'},{'id':'attic','name':'Attic'},{'id':'dungeon','name':'Dungeon'}],
    areas=seq('', dh), notes='Keys are the bare numbers; UI label is "Death House N". Exterior placed on the Village of Barovia layer. Milestone M1.'))

# Unmapped interiors from §9 not already covered
L.append(loc('encounter-terrain', 'Encounter terrain kit', 'ch02', 'kit', areas=[],
    notes='Reusable terrain from the Ch. 2 random-encounter tables and the castle table; see manifests/encounters.json.'))

chapters = [('ch02',2,'The Lands of Barovia'),('ch03',3,'The Village of Barovia'),('ch04',4,'Castle Ravenloft'),('ch05',5,'The Town of Vallaki'),
            ('ch06',6,'Old Bonegrinder'),('ch07',7,'Argynvostholt'),('ch08',8,'The Village of Krezk'),('ch09',9,'Tsolenka Pass'),('ch10',10,'The Ruins of Berez'),
            ('ch11',11,"Van Richten's Tower"),('ch12',12,'The Wizard of Wines'),('ch13',13,'The Amber Temple'),('ch14',14,'Yester Hill'),('ch15',15,'Werewolf Den'),
            ('appB',None,'Appendix B: Death House')]
locations = {'schema': 1, 'source': 'occ prompt v1 §7/§9 seed — verify with scripts/manifest-report.ts after OCR',
    'chapters': [{'id': c, 'number': n, 'title': t} for c, n, t in chapters], 'locations': L}

# ---------------- characters
def ch(id, name, tier, size='medium', vis='hidden-creature', tags=(), variants=None, kind='npc'):
    d = {'id': id, 'name': name, 'tier': tier, 'size': size, 'baseIn': {'tiny':0.5,'small':1,'medium':1,'large':2,'huge':3,'gargantuan':4}[size], 'visibility': vis, 'tags': list(tags), 'kind': kind}
    if variants: d['variants'] = variants
    return d
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')
C = []
t1 = [("Strahd von Zarovich",'medium',['K'],['humanoid','bat','wolf','mist']),("Ireena Kolyana",'medium',['E4'],None),("Ismark Kolyanovich",'medium',['E2','E4'],None),
 ("Kolyan Indirovich",'medium',['E4'],['corpse']),("Rahadin",'medium',['K'],None),("Ezmerelda d'Avenir",'medium',['V1'],None),("Rudolph van Richten",'medium',['N5'],['rictavio']),
 ("Madam Eva",'medium',['G'],None),("The Abbot",'medium',['S10'],None),("Vasilka",'medium',['S10'],None),("Baba Lysaga",'medium',['U'],None),("Kasimir Velikov",'medium',['N9a','X'],None),
 ("Vladimir Horngaard",'medium',['Q'],None),("Sir Godfrey Gwilym",'medium',['Q'],None),("Izek Strazni",'medium',['N3'],None),("Baron Vargas Vallakovich",'medium',['N3'],None),
 ("Baroness Lydia Petrovna",'medium',['N3'],None),("Victor Vallakovich",'medium',['N3t'],None),("Lady Fiona Wachter",'medium',['N4'],None),("Stella Wachter",'medium',['N4n'],None),
 ("Nikolai Wachter",'medium',['N4'],None),("Karl Wachter",'medium',['N4'],None),("Father Lucian Petrovich",'medium',['N1'],None),("Urwin Martikov",'medium',['N2'],None),
 ("Danika Martikov",'medium',['N2'],None),("Brom Martikov",'small',['N2'],None),("Bray Martikov",'small',['N2'],None),("Davian Martikov",'medium',['W'],None),
 ("Szoldar Szoldarovich",'medium',['N2'],None),("Yevgeni Krushkin",'medium',['N2'],None),("Morgantha",'medium',['O'],['hag','old-woman']),("Bella Sunbane",'medium',['O'],['hag','old-woman']),
 ("Offalia Wormwiggle",'medium',['O'],['hag','old-woman']),("Gadof Blinsky",'medium',['N7'],None),("Henrik van der Voort",'medium',['N6'],None),("Luvash",'medium',['N9'],None),
 ("Arrigal",'medium',['N9'],None),("Arabelle",'small',['L','N9'],None),("Kiril Stoyanovich",'medium',['Z'],['human','hybrid','wolf']),("Emil Toranescu",'medium',['Z'],['human','hybrid','wolf']),
 ("Zuleika Toranescu",'medium',['Z'],['human','hybrid','wolf']),("Exethanter",'medium',['X'],None),("Neferon",'medium',['X'],None),("Vilnius",'medium',['V'],None),
 ("Pidlwick II",'small',['K'],None),("Escher",'medium',['K'],None),("Ludmilla Vilisevic",'medium',['K'],None),("Anastrasya Karelova",'medium',['K'],None),("Volenta Popofsky",'medium',['K'],None),
 ("Patrina Velikovna",'medium',['K84'],None),("Sergei von Zarovich",'medium',['K85'],['ghost']),("Tatyana",'medium',['K'],None),("Rose Durst",'small',['death-house'],['ghost']),
 ("Thorn Durst",'small',['death-house'],['ghost']),("Gustav Durst",'medium',['death-house'],None),("Elisabeth Durst",'medium',['death-house'],None),("Donavich",'medium',['E5'],None),
 ("Doru",'medium',['E5g'],None),("Mad Mary",'medium',['E3'],None),("Gertruda",'medium',['E3','K'],None),("Bildrath Cantemir",'medium',['E1'],None),("Parriwimple",'medium',['E1'],None),
 ("Milivoj",'medium',['S'],None),("Bluto Krogarov",'medium',['L'],None),("Dmitri Krezkov",'medium',['S'],None),("Anna Krezkov",'medium',['S'],None),
 ("Clovin Belview",'small',['S10'],None),("Otto Belview",'small',['S10'],None),("Zygfrek Belview",'small',['S10'],None),("Cyrus Belview",'medium',['K'],None),
 ("Lief Lipsiege",'medium',['K30'],None),("Helga Ruvak",'medium',['K'],None),("Ernst Larnak",'medium',['V'],None),("Mordenkainen",'medium',['M'],['mad-mage']),
 ("Argynvost",'huge',['Q'],['dragon-spirit','beacon']),("Beucephalus",'large',['K'],None),("Lorghoth the Decayer",'large',['Q'],None),("Wintersplinter",'huge',['Y','W'],None)]
for n, s, tags, var in t1:
    C.append(ch(slug(n), n, 1, s, tags=tags, variants=var))
t2 = [("Barovian witch",'medium'),("Broom of animated attack",'small'),("Baba Lysaga's creeping hut",'gargantuan'),("Tree blight",'huge'),("Mongrelfolk",'medium'),
 ("Phantom warrior",'medium'),("Strahd zombie",'medium'),("Wereraven",'medium'),("Vistani bandit",'medium'),("Vistani thug",'medium'),("Dusk elf",'medium'),("Skeletal rider",'medium'),
 ("Amber golem",'large'),("Flesh golem (the Abbot's)",'medium'),("Clay golem (Van Richten's tower)",'large'),("Gulthias tree",'huge'),("Heart of Sorrow",'large')]
t2var = {'Mongrelfolk':['body-a','body-b','body-c','body-d'],'Strahd zombie':['standing','crawling'],'Wereraven':['human','hybrid','raven']}
for n, s in t2:
    C.append(ch(slug(n), n, 2, s, variants=t2var.get(n), kind='creature'))
t3 = [('wolf','medium'),('dire wolf','large'),('werewolf','medium',['human','hybrid','wolf']),('bat','tiny'),('swarm of bats','medium'),('raven','tiny'),('swarm of ravens','medium'),
 ('swarm of rats','medium'),('swarm of insects','medium',['spiders']),('giant spider','large'),('ghoul','medium'),('ghast','medium'),('zombie','medium'),('skeleton','medium'),('shadow','medium'),
 ('specter','medium'),('poltergeist','medium'),('wraith','medium'),('wight','medium'),('ghost','medium'),('banshee','medium'),('revenant','medium'),('vampire spawn','medium'),
 ('scarecrow','medium'),('twig blight','small'),('needle blight','medium'),('vine blight','medium'),('druid','medium'),('berserker','medium'),('will-o\'-wisp','tiny'),('night hag','medium'),
 ('gargoyle','medium'),('animated armor','medium'),('flying sword','small'),('rug of smothering','large'),('crawling claw','tiny'),('gray ooze','medium'),('red dragon wyrmling','medium'),
 ('mimic','medium'),('grick','medium'),('shambling mound','large'),('flameskull','tiny'),('shield guardian','large'),('arcanaloth','medium'),('lich','medium'),('deva','medium'),
 ('hell hound','medium'),('nightmare','large'),('vrock','large'),('roc','gargantuan'),('saber-toothed tiger','large'),('quasit','tiny'),('imp','tiny'),('invisible stalker','medium'),
 ('black cat','tiny'),('riding horse','large'),('draft horse','large'),('mastiff','medium'),
 ('commoner','medium'),('noncombatant child','small'),('scout','medium'),('guard','medium'),('priest','medium'),('acolyte','medium'),('mage','medium'),('noble','medium'),('knight','medium'),
 ('bandit','medium'),('bandit captain','medium'),('cultist','medium'),('cult fanatic','medium'),('assassin','medium'),('spy','medium'),('thug','medium'),('veteran','medium')]
for e in t3:
    C.append(ch(slug(e[0]), e[0][0].upper() + e[0][1:], 3, e[1], variants=e[2] if len(e) > 2 else None, kind='monster-manual'))
C.append(ch('barovian-generic', 'Barovian (generic)', 3, vis='player', variants=['adult-m','adult-f','child','elder'], kind='generic'))
C.append(ch('vistana-generic', 'Vistana (generic)', 3, vis='player', variants=['adult-m','adult-f','child'], kind='generic'))
C.append(ch('pc-kit', 'Player character kit', 4, vis='player', variants=['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard'], kind='pc'))
C.append(ch('standee', 'Flat standee (fallback)', 4, vis='player', variants=['tiny','small','medium','large','huge','gargantuan'], kind='token'))
characters = {'schema': 1, 'source': 'occ prompt v1 §11 seed — complete from OCR (appendix D refs, bold stat blocks)',
    'notes': 'Night hags are Tier 3 stat blocks but the three Bonegrinder hags get Tier 1 models.', 'characters': C}

# ---------------- encounters
terrain = ['forest-road-day','forest-road-night','forest-clearing','riverbank','lakeshore','mountain-trail','foggy-graveyard','ruined-tower','hunting-trap-thicket',
 'roadside-grave','corpse-marker','hidden-bundle','marsh','snowfield','ice','vistani-wagon-circle','barovian-cottage-interior','barovian-cottage-exterior']
spawns = ['commoner','scout','vistani-bandit','skeletal-rider','swarm-of-ravens','swarm-of-bats','wereraven','wolf','dire-wolf','berserker','werewolf','druid','twig-blight',
 'needle-blight','scarecrow','zombie','strahd-zombie','will-o-wisp','revenant','ghost']
events = []
for l in L:
    for e in l.get('events', []):
        events.append({**e, 'location': l['id']})
events += [{'id':'strahds-dinner','name':"Strahd's dinner",'location':'K','stage':'K10/K36'},{'id':'heart-of-sorrow','name':'The Heart of Sorrow','location':'K','stage':'K20'},
           {'id':'k61-elevator','name':'K61 elevator','location':'K','stage':'K61','moving':True},{'id':'k82-slide','name':'K82 marble slide','location':'K','stage':'K82','moving':True}]
encounters = {'schema': 1, 'source': 'occ prompt v1 §9 seed; table rows (d-results) to be keyed from OCR, no book text',
    'tables': [{'id':'ch02-day','name':'Barovia random encounters (day)','page':None,'rows':[]},{'id':'ch02-night','name':'Barovia random encounters (night)','page':None,'rows':[]},
               {'id':'ravenloft','name':'Castle Ravenloft random encounters','page':None,'rows':[],'restCheckMinutes':10}],
    'terrain': [{'id': t, 'spawnSlots': spawns} for t in terrain], 'specialEvents': events}

for name, obj in [('locations', locations), ('characters', characters), ('encounters', encounters)]:
    with open(os.path.join(ROOT, 'manifests', f'{name}.json'), 'w') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False); f.write('\n')
print(len(L), 'locations', sum(len(l['areas']) for l in L), 'areas', len(C), 'characters')
