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
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}



// FUNCTIONS ---------------------------------------------------------------------------
/** Creates items with the given parameters
 * @param {client} client a registered PostgreSQL object
 * @param {String} name name of the item
 * @param {String} description short lore for the item
 * @param {Int} rarityID ID of the rarity class for that item
 * @param {Int} typeID ID of the type of item
 * @param {String} itemIdentifier item-config-specific identifier, used for stacking
 * @param {Int} amount number of items in this stack. Must be below the item's type's value
 * @param {DiscordID} ownerID Discord-generated ID of the user this item belongs to
 * @param {Object} attributes item and type-specific attributes assigned to this item
 */
async function createItems(client, name, description, rarityID, typeID, amount, ownerID, attributes) {

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
        var query = 'INSERT INTO items (name, description, rarity_id, type_id, owner_id, attributes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;';
        var params = [ name, description, rarityID, typeID, ownerID, JSON.stringify(attributes) ];
        var err, result = await client.query(query, params);
        if (err) { return [ false, 'Error occurred while creating' ]; }

        returnIDs.push(result.rows[0].id);
    }

    console.log('Created items with IDs', returnIDs);
    return [ true, returnIDs ];
}

/** Transfers ownership of an item from it's original owner to the new owner
 * @param {client} client a registered PostgreSQL object
 * @param {String/UUID} itemID server-generated item instance ID
 * @param {DiscordID} newOwnerID Discord-generated ID of the user to transfer this item to
 * @param {Boolean} isStack whether to transfer any stackable items owned by this user
 */
async function transferItems(client, itemID, newOwnerID, isStack) { 

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

    // Check for a stack of items (that aren't dropped)
    if (isStack === 'true') {
        var query = 'SELECT * FROM items WHERE name = $1 AND owner_id = $2 AND is_dropped = $3;';
        var params = [ itemInfo.name, itemInfo.owner_id, false ];
        var err, result = await client.query(query, params);
        if (err) { res.status(500).send('Internal server error'); }

        if (result.rows.length > 1) {   // If more than the one item can be found...
            // Transfer all items
            for (const item of result.rows) { 
                var query = 'UPDATE items SET owner_id = $1 WHERE id = $2;';
                var params = [ newOwnerID, item.id ];
                var err, result = await client.query(query, params);
                if (err) { res.status(500).send(err); console.log(err); return; }
            }

            return [ true, 'Successfully transferred items' ];
        }
    }

    var query = 'UPDATE items SET owner_id = $1 WHERE id = $2;';
    var params = [ newOwnerID, itemID ];
    var err, result = await client.query(query, params);
    if (err) { return [ false, 'An error occurred while transferring item' ]; }

    console.log('Transferred items to user ', newOwnerID);
    return [ true, 'Successfully transferred item' ];
}

/** Groups an array of objects by it's key value
 * @param {Array} list list to sort
 * @param {String} key key to sort by
 */
function groupArrayOfObjects(list, key) {
    return list.reduce(function(rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};



// ENDPOINTS ---------------------------------------------------------------------------
router.get('/:id/:isStack', async function (req, res) {                 // Get item by ID
    const client = req.client;

    // Retrieve the item's information
    var query = 'SELECT * FROM items WHERE id = $1;';
    var params = [ req.params.id ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send('Internal server error'); }
    if (result.rows.length === 0) { res.status(404).send('Nothing was found'); }
    const itemInfo = result.rows[0];

    // Get a full stack of similar items
    if (req.params.isStack === 'true') {
        var query = 'SELECT * FROM items WHERE name = $1 AND owner_id = $2;';
        var params = [ itemInfo.name, itemInfo.owner_id ];
        var err, result = await client.query(query, params);
        if (err) { res.status(500).send('Internal server error'); }

        if (result.rows.length > 1) {   // More than just the one item can be found...

            // Collate these items by whether they've been dropped
            const itemStacks = groupArrayOfObjects(result.rows, 'is_dropped');

            const itemList = [];
            for (const item of Object.values(itemStacks)) {
                const itemInfo = {
                    id: item[0].id,
                    ownerID: item[0].owner_id,
                    name: item[0].name,
                    description: item[0].description,
                    type: itemTypes.find(x => x.id == item[0].type_id),
                    rarity: itemRarities.find(x => x.id == item[0].rarity_id),
                    amount: item.length,
                    isEquipped: item[0].is_equipped,
                    isDropped: item[0].is_dropped,
                    attributes: item[0].attributes
                }

                itemList.push(itemInfo);
            }

            res.status(200).send(JSON.stringify(itemList));
            return;
        }
    } 

    // Either isStack is false, or no stackable items could be found
    // Assemble single item object
    const item = {
        id: itemInfo.id,
        name: itemInfo.name,
        description: itemInfo.description,
        ownerID: itemInfo.owner_id,
        type: itemTypes.find(item => item.id === itemInfo.type_id),
        rarity: itemRarities.find(item => item.id === itemInfo.rarity_id),
        amount: 1,
        attributes: itemInfo.attributes,
        isEquipped: itemInfo.is_equipped,
        isDropped: itemInfo.is_dropped,
    }

    res.status(200).send(JSON.stringify([ item ]));
});

router.post('/create/', async function (req, res) {                     // Create an item
    const client = req.client;

    let itemInfo = {
        name: req.body.name,
        rarityID: req.body.rarityID,
        typeID: req.body.typeID,
        amount: req.body.amount,
        ownerID: req.body.ownerID,
        attributes: req.body.attributes,
    }

    if (Object.values(itemInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided'); return;
    }

    // Add non-required variables
    itemInfo.description = req.body.description || null;

    console.log(itemInfo);

    const [ success, response ] = await createItems(client, itemInfo.name, itemInfo.description, itemInfo.rarityID, itemInfo.typeID, itemInfo.amount, itemInfo.ownerID, itemInfo.attributes);

    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    // Return IDs
    res.status(200).send(JSON.stringify({ itemIDs: response }));
});

router.post('/:id/edit/', async function (req, res) {                   // Edit item attributes

    const client = req.client;

    let itemInfo = {
        itemID: req.params.id,
        name: req.body.name,
        rarityID: req.body.rarityID,
        typeID: req.body.typeID,
        ownerID: req.body.ownerID,
        attributes: req.body.attributes,
    }

    console.log(itemInfo);

    if (Object.values(itemInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided'); return;
    }

    // Add non-required variables
    itemInfo.description = req.body.description || null;

    // Check for item type
    const type = itemTypes.find(item => item.id == itemInfo.typeID);
    if (!type) { res.status(403).send('Type with that ID does not exist'); return; }

    // Check for item rarity
    const rarity = itemRarities.find(item => item.id == itemInfo.rarityID);
    if (!rarity) { res.status(403).send('Rarity with that ID does not exist'); return; }

    // Check if that item exists
    var query = 'SELECT * FROM items WHERE id = $1;';
    var params = [ req.params.id ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send('Internal server error'); }
    if (result.rows.length === 0) { res.status(404).send('Nothing was found'); }

    // Update that item
    var query = 'UPDATE items SET name = $1, description = $2, rarity_id = $3, type_id = $4, owner_id = $5, attributes = $6 WHERE id  = $7;';
    var params = [ itemInfo.name, itemInfo.description, itemInfo.rarityID, itemInfo.typeID, itemInfo.ownerID, JSON.stringify(itemInfo.attributes), itemInfo.itemID ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send('Internal server error'); return; }

    // Return success
    res.status(200).send('Successfully edited item');
});

router.post('/:id/delete/', async function (req, res) {                 // Delete a variable
    
    const client = req.client;

    if (!req.params.id) { res.status(400).send('Missing ID parameter'); return; }

    // Delete the item
    var query = 'DELETE FROM items WHERE id = $1;';
    var params = [ req.params.id ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send('Internal server error'); }

    res.status(200).send('Successfully removed item');
});

router.post('/:id/equip/:isEquipping/', async function (req, res) {     // Equip/unequip item
    const client = req.client;

    const itemID = req.params.id;
    const isEquipping = req.params.isEquipping;
    if (!itemID || !isEquipping) { res.status(400).send('Missing itemID and/or isEquipping values'); return; }

    // Check if the item exists
    var query = 'SELECT * FROM items WHERE id = $1;';
    var params = [ itemID ]; 
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send(err); console.log(err); return; }
    if (result.rows.length === 0) { res.status(404).send('An item with that ID does not exist'); return; }

    // Check if this item can be equipped
    const itemType = itemTypes.find(item => item.id === result.rows[0].type_id);
    if (itemType.isEquippable === false) { res.status(403).send('This item cannot be equipped'); return; }

    // Equip/unequip item
    var query = 'UPDATE items SET is_equipped = $1 WHERE id = $2;';
    var params = [ isEquipping, itemID ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send(err); console.log(err); return; }

    res.status(200).send('Item equipped/unequipped successfully');
});

router.post('/:id/drop/:isDropping/:isStack', async function (req, res) {   // Drop/pickup items
    const client = req.client;

    const itemID = req.params.id;
    const isDropping = req.params.isDropping;
    const isStack = req.params.isStack || false;    // Value is false by default
    if (!itemID || !isDropping) { res.status(400).send('Missing itemID and/or isDropping values'); return; }

    // Check if the item exists
    var query = 'SELECT * FROM items WHERE id = $1;';
    var params = [ itemID ]; 
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send(err); console.log(err); return; }
    if (result.rows.length === 0) { res.status(404).send('An item with that ID does not exist'); return; }
    const itemInfo = result.rows[0];

    // Check for a stack of items
    if (isStack === 'true') {
        var query = 'SELECT * FROM items WHERE name = $1 AND owner_id = $2;';
        var params = [ itemInfo.name, itemInfo.owner_id ];
        var err, result = await client.query(query, params);
        if (err) { res.status(500).send('Internal server error'); }

        if (result.rows.length > 1) {   // If more than the one item can be found...
            // Drop/pickup all items
            for (const item of result.rows) { 
                var query = 'UPDATE items SET is_dropped = $1 AND is_equipped = $2 WHERE id = $3;';
                var params = [ isDropping, false, item.id ];
                var err, result = await client.query(query, params);
                if (err) { res.status(500).send(err); console.log(err); return; }
            }

            return;
        }
    }

    // Drop/pickup single item
    var query = 'UPDATE items SET is_dropped = $1 AND is_equipped = $2 WHERE id = $3;';
    var params = [ isDropping, false, itemID ];
    var err, result = await client.query(query, params);
    if (err) { res.status(500).send(err); console.log(err); return; }

    res.status(200).send('Item/s dropped/picked up successfully');
});

router.post('/:id/transfer/:newOwnerID/:isStack', async function (req, res) {   // Transfer items
    const client = req.client;

    const transferInfo = {
        itemID: req.params.id,
        newOwnerID: req.params.newOwnerID,
        isStack: req.params.isStack || false
    }

    if (Object.values(transferInfo).every(x => x === null || x === '')) { 
        res.status(400).send('Not all required values were provided'); return;
    }

    const [ success, response ] = await transferItems(client, transferInfo.itemID, transferInfo.newOwnerID, transferInfo.isStack);
    if (success === false) { res.status(500).send(response); console.log(response); return; } 

    res.status(200).send('Item/s transferred successfully');
});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router
}