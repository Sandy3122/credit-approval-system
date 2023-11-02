// databaseConnection.js
const mysql = require('mysql2/promise');

// // MySQL Database Configuration
// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// };


// MySQL Database Configuration
const dbConfig = {
  host: "localhost",
  user: 'root',
  password: 'Sandeep@3122',
  database: 'credit_approval',
};

let pool; // Declare the connection pool outside the try-catch block

try {
  // Create a connection pool
  pool = mysql.createPool(dbConfig);
  console.log('Database connection successful.');
} catch (error) {
  console.error('Error connecting to a database:', error);
  process.exit(1); // Terminate the application on connection failure
}

module.exports = pool;