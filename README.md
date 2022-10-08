# Master API
This is the primary API system for the Mingleton RPG Discord game. All bots that need access to the Mingleton RPG database should do so through these endpoints. 

The API docs are available [here](https://docs.google.com/document/d/1ADcJ4RlrIf6Xl4Sdye9g8lSOXnixWa5tEoChZ80VUys/edit?usp=sharing).

## High-level breakdown

### Rarities
- Rarities (as stored in the [rarities.json](./json/rarities.json)) file are ordered from `-5` to `14`, with the higher numbers equating to better rarities. `0` is the baseline rarity - items generated with this rarity should have their exact regular stats, with anything below reducing the stats, above increasing.
- Each rarity also has a custom emoji, this will support an UTF-8 emoji or a Discord emoji identifier.
- Attributes refer to how this rarity modifies an item's attributes.

### Types
- Type numbering is not too important, but note that some bots will use comparative operators for item groups such as armour and weapons
- `maxStackamount` tells the game how many of a particular item can be stacked at once
- `isEquippable` refers to whether the user can "equip" that item type, showing it in their inventory
- Functions are what that item can do when shown in the inventory, generally shown in the form of message Buttons. Some bots will choose to show only some of a particular item's functions, depending on their purpose. What a bot decides to with each function is up to them.
