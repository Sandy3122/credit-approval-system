// Import the required modules
const { calculateApprovedLimit } = require("../helpers/helpers.js");

const pool = require('../helpers/dbConfig.js');


const register = async (req, res) => {
  try {
    console.log('Request Body:', req.body);

    const {
      first_name,
      last_name,
      age,
      monthly_salary,
      phone_number,
    } = req.body;

    const approved_limit = calculateApprovedLimit(monthly_salary);

    // Get a connection from the pool
    pool.getConnection((connectionError, connection) => {
      if (connectionError) {
        console.error('Error getting a database connection:', connectionError);
        res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
        return;
      }

      // Check if a customer with the same phone_number already exists
      connection.query(
        'SELECT customer_id FROM customer_data WHERE phone_number = ?',
        [phone_number],
        (queryError, results) => {
          if (queryError) {
            console.error('Error executing SELECT query:', queryError);
            connection.release();
            res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
            return;
          }

          if (results.length > 0) {
            connection.release();
            res.status(409).json({ error: 'Conflict', message: 'Customer with the same phone number already exists.' });
            return;
          }

          // Insert customer data into the database
          connection.query(
            'INSERT INTO customer_data (first_name, last_name, age, monthly_salary, approved_limit, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
            [first_name, last_name, age, monthly_salary, approved_limit, phone_number],
            (insertError, result) => {
              if (insertError) {
                console.error('Error executing INSERT query:', insertError);
                connection.release();
                res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                return;
              }

              // Commit the transaction and release the connection
              connection.commit((commitError) => {
                if (commitError) {
                  console.error('Error committing the transaction:', commitError);
                  connection.release();
                  res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                  return;
                }

                connection.release();

                const customer_id = result.insertId;

                const response = {
                  customer_id,
                  name: `${first_name} ${last_name}`,
                  age,
                  monthly_salary,
                  approved_limit,
                  phone_number,
                };

                console.log(response);
                console.log("Monthly Income: ", monthly_salary);
                res.status(201).json(response);
              });
            }
          );
        }
      );
    });
  } catch (error) {
    console.error('Error in /register:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
  }
};

// Export the register module
module.exports = { register };
