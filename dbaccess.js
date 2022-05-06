require('dotenv').config();

const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
client.connect();



// SETUP THE DB --------------------------------------------------
(async () => {

    // DROP TABLES
    // var query = 'DROP TABLE IF EXISTS accounts;';
    // var params = [];
    // client.query(query, params, function(err, result) { if (err) { console.log(err); }});

    // var query = 'DROP TABLE IF EXISTS items;';
    // var params = [];
    // client.query(query, params, function(err, result) { if (err) { console.log(err); }});

    var query = 'DROP TABLE IF EXISTS factions;';
    var params = [];
    client.query(query, params, function(err, result) { if (err) { console.log(err); }});
    
    // CREATE ACCOUNTS TABLE
    var query = 'CREATE TABLE IF NOT EXISTS accounts (id BIGINT, dollars INT DEFAULT 100, hp INT DEFAULT 100, faction_id UUID DEFAULT null);';
    var err, result = await client.query(query);
    if (err) { console.log(err); }
    console.log('Created accounts table');

    // CREATE ITEMS TABLE
    var query = 'CREATE TABLE IF NOT EXISTS items (id UUID DEFAULT gen_random_uuid(), owner_id BIGINT, name VARCHAR, type_id INT, rarity_id INT, is_equipped BOOLEAN DEFAULT false, is_dropped BOOLEAN DEFAULT false, attributes JSONB);';
    var err, result = await client.query(query);
    if (err) { console.log(err); }
    console.log('Created items table');

    // CREATE FACTIONS TABLE
    var query = 'CREATE TABLE IF NOT EXISTS factions (id UUID DEFAULT gen_random_uuid(), name VARCHAR, emoji_name VARCHAR);';
    var err, result = await client.query(query);
    if (err) { console.log(err); }
    console.log('Created factions table');

    // var query = 'ALTER TABLE accounts DROP COLUMN factionid;';
    // var err, result = await client.query(query);
    // if (err) { console.log(err); }
    // console.log('Created e table');

    // var query = 'UPDATE accounts SET faction_id = null;';
    // var err, result = await client.query(query);
    // if (err) { console.log(err); }
    // console.log('Created e table');
}) ();