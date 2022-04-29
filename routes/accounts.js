/** 
 * Handles all endpoints & functions for account management & inventory management
 */

// MODULES -----------------------------------------------------------------------------
const express = require('express');
const router = express.Router();



// FILES ------------------------------------------------------------------------------
const itemRarities = require('../json/rarities.json');
const itemTypes = require('../json/types.json');



// HELPER FUNCTIONS -------------------------------------------------------------------
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

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



// FUNCTIONS ---------------------------------------------------------------------------
/** Gets the inventory of any user, stacking items where relevant 
 * @param {Client} client Postgres-registered client object
 * @param {String} userID Discord-issued user identifier
*/
async function getInventory(client, userID) { 

    // Check if new owner exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params);
    if (err || result.rows.length === 0) { return [ false, 'This user does not exist' ]; }

    // Get their inventory
    var query = 'SELECT * FROM items WHERE owner_id = $1 ORDER BY type_id;';
    var params = [ userID ];
    var err, result = await client.query(query, params);
    if (err) { return [ false, 'An error occurred whilst retrieving user items' ]; }

    // Group items by name
    const itemStacks = groupArrayOfObjects(result.rows, 'name');

    // Create new item objects
    let inventory = [];
    for (item of Object.values(itemStacks)) {
        const itemInfo = {
            id: item[0].id,
            ownerID: item[0].owner_id,
            name: item[0].name,
            type: itemTypes.find(x => x.id == item[0].type_id),
            rarity: itemRarities.find(x => x.id == item[0].rarity_id),
            amount: item.length,
            isEquipped: item[0].is_equipped,
            isDropped: item[0].is_dropped,
            attributes: item[0].attributes
        }

        inventory.push(itemInfo);
    }

    return(inventory);
}



// ENDPOINTS --------------------------------------------------------------------------
router.get('/leaderboard/', async function (req, res) {      // Get a list of all users, ordered by dollars
    console.log('Requesting account leaderboard');
    const client = req.client;

    var query = 'SELECT * FROM accounts ORDER BY dollars DESC;';
    var err, result = await client.query(query); 
    if (err) { res.status(500).send('Internal server error'); return; }

    // Assemble JSON information for each
    let accountList = [];
    for (account of result.rows) { 
        const accountInfo = {
            id: account.id,
            dollars: account.dollars
        }
        accountList.push(accountInfo);
    }

    // Send to caller
    res.status(200).send(JSON.stringify(accountList));
});

router.get('/:id/', async function (req, res) {                          // Get an account by ID
    console.log('Requesting account by ID with params', req.params);
    const client = req.client;

    const userID = req.params.id;
    if (!userID) { res.status(400).send('User ID parameter not supplied.'); return; }

    // Get user information
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { res.status(404).send('A user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Get inventory information
    const inventory = await getInventory(client, userID);

    // Assemble account object
    const account = { 
        id: userID,
        dollars: userInfo.dollars,
        hp: userInfo.hp,
        inventory: inventory
    }

    // Send to caller
    res.status(200).send(JSON.stringify(account));
});

router.post('/create/:id/', async function (req, res) {         // Creates an account with default stats
    console.log('Requesting to create account with params', req.params);
    const client = req.client;

    const userID = req.params.id;
    if (!userID) { res.status(400).send('User ID parameter not supplied.'); return; }

    // Check if this user already exists
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length !== 0) { res.status(403).send('A user with that ID already exists'); return; }

    // Create a new account
    const account = {
        id: userID,
        dollars: 100,
        hp: 100
    }

    var query = 'INSERT INTO accounts (id, dollars, hp) VALUES ($1, $2, $3);';
    var params = [ account.id, account.dollars, account.hp ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    // Send to caller
    res.status(200).send(JSON.stringify(account));
});

router.post('/:id/add-hp/:amount/', async function (req, res) {          // Add or remove account HP
    console.log('Attempting to modify account HP with params', req.params);
    const client = req.client;

    const userID = req.params.id;
    const healthAmount = parseInt(req.params.amount);
    if (!userID || !healthAmount) { res.status(400).send('User ID & health amount parameters not supplied'); return; }

    // Get user information
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { res.status(404).send('A user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Calculate the player's new health value
    const userNewHealth = clamp(userInfo.hp + healthAmount, 0, 100);

    // [ TODO ] - Check if the user has died (userNewHealth = 0)

    // Save to server
    var query = 'UPDATE accounts SET hp = $1 WHERE id = $2;';
    var params = [ userNewHealth, userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    res.status(200).send(JSON.stringify({ hp: userNewHealth }));
});

router.post('/:id/add-dollars/:amount/', async function (req, res) {     // Add or remove account dollars
    console.log('Attempting to modify account dollars with params', req.params);
    const client = req.client;

    const userID = req.params.id;
    const dollarsAmount = parseInt(req.params.amount);
    if (!userID || !dollarsAmount) { res.status(400).send('User ID & dollars amount parameters not supplied'); return; }

    // Get user information
    var query = 'SELECT * FROM accounts WHERE id = $1;';
    var params = [ userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    if (result.rows.length === 0) { res.status(404).send('A user with that ID does not exist'); return; }
    const userInfo = result.rows[0];

    // Calculate the player's new dollars value
    const userNewDollars = userInfo.dollars + dollarsAmount;

    // Save to server
    var query = 'UPDATE accounts SET dollars = $1 WHERE id = $2;';
    var params = [ userNewDollars, userID ];
    var err, result = await client.query(query, params); 
    if (err) { res.status(500).send('Internal server error'); return; }

    res.status(200).send(JSON.stringify({ dollars: userNewDollars }));
});



// EXPORT ------------------------------------------------------------------------------
module.exports = { 
    router: router,
    getInventory: getInventory
}