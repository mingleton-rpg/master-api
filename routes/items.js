/** 
 * Handles all endpoints & functions surrounding item creation & transferral
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();



// FILES ------------------------------------------------------------------------------
const itemRarities = require('../json/rarities.json');
const itemTypes = require('../json/types.json');



// FUNCTIONS ---------------------------------------------------------------------------
/** Creates items with the given parameters
 * @param {client} client a registered PostgreSQL object
 * @param {String} name name of the item
 * @param {Int} rarityID ID of the rarity class for that item
 * @param {Int} typeID ID of the type of item
 * @param {String} itemIdentifier item-config-specific identifier, used for stacking
 * @param {Int} amount number of items in this stack. Must be below the item's type's value
 * @param {DiscordID} ownerID Discord-generated ID of the user this item belongs to
 * @param {Object} attributes item and type-specific attributes assigned to this item
 */
async function createItems(client, name, rarityID, typeID, amount, ownerID, attributes) {

    // Find an item with that type
    const type = itemTypes.find(item => item.id == typeID);
    if (!type) { return [ false, 'Type supplied does not exist' ]; }

    // Check if stackAmount is valid
    if (amount > type.maxStackAmount) { return [ false, 'Stack amount exceeds item type parameters' ]; }

    // Check for item rarity
    const rarity = itemRarities.find(item => item.id == rarityID);
    if (!rarity) { return [ false, 'Rarity supplied does not exist' ]; }

    // Create the item/s
    var returnIDs = [];
    for (var i = 0; i < amount; i++) {
        var query = 'INSERT INTO items (name, rarity_id, type_id, owner_id, attributes) VALUES ($1, $2, $3, $4, $5) RETURNING id;';
        var params = [ name, rarityID, typeID, ownerID, JSON.stringify(attributes) ];
        var err, result = await client.query(query, params);
        if (err) { return [ false, 'Error occurred while creating' ]; }

        returnIDs.push(result.rows[0].id);
    }

    console.log('Created items with IDs', returnIDs);
    return [ true, returnIDs ];
}

/** Transfers ownership of an item from it's original owner to the new owner
 * @param {client} client a registered PostgreSQL object
 * @param {UUID} itemID server-generated ID for the item to transfer
 * @param {DiscordID} newOwnerID Discord-generated ID of the user to transfer this item to
 */
async function transferItem(client, itemID, newOwnerID) { 

    // Check if that item exists
    var query = 'SELECT * FROM items WHERE id = $1;';
    var params = [ itemID ];
    var err, result = await client.query(query, params);
    if (err || result.rows.length === 0) { return [ false, 'This item does not exist' ]; }
    const itemInfo = result.rows[0];

    // Check if new owner exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ newOwnerID ];
    var err, result = await client.query(query, params);
    if (err || result.rows.length === 0) { return [ false, 'This user does not exist' ]; }

    var query = 'UPDATE items SET owner_id = $1 WHERE id = $2;';
    var params = [ newOwnerID, itemID ];
    var err, result = await client.query(query, params);
    if (err) { return [ false, 'An error occurred while transferring item' ]; }

    console.log('Transferred item', itemID, 'to user', newOwnerID);
    return [ true, 'Successfully transferred item' ];
}



// ENDPOINTS ---------------------------------------------------------------------------
router.get('/:id', async function (req, res) {                   // Get item by ID
    const client = req.client;

    var query = 'SELECT  * FROM items WHERE id = $1;';
    var params = [ req.params.id ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send('Internal server error'); }
    if (result.rows.length === 0) { res.status(404).send('Nothing was found'); }

    // Assemble object
    const item = {
        name: result.rows[0].name,
        ownerID: result.rows[0].owner_id,
        rarity: itemRarities.find(item => item.id === result.rows[0].rarity_id),
        type: itemTypes.find(item => item.id === result.rows[0].type_id),
        attributes: result.rows[0].attributes
    }

    res.status(200).send(JSON.stringify(item));
});

router.post('/create/', async function (req, res) {              // Create an item
    const client = req.client;

    const itemInfo = {
        name: req.body.name,
        rarityID: req.body.rarityID,
        typeID: req.body.typeID,
        amount: req.body.amount,
        ownerID: req.body.ownerID,
        attributes: req.body.attributes,
    }

    if (Object.values(itemInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided');
    }

    const [ success, response ] = await createItems(client, itemInfo.name, itemInfo.rarityID, itemInfo.typeID, itemInfo.amount, itemInfo.ownerID, itemInfo.attributes);

    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    // Return ID
    res.status(200).send(JSON.stringify({ itemIDs: response }));
});

router.post('/:id/transfer/:newOwnerID/', async function (req, res) {           // Transfer an item
    const client = req.client;

    const transferInfo = {
        itemID: req.params.id,
        newOwnerID: req.params.newOwnerID
    }

    if (Object.values(transferInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided');
    }

    const [ success, response ] = await transferItem(client, transferInfo.itemID, transferInfo.newOwnerID);
    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    res.status(200).send('Item transferred successfully');
});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router
}