// Importing pool conncetion
const pool = require('../dataBaseConnection.js');

// Importing helper function
const { calculateApprovedLimit } = require("../helpers/helpers.js")

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
  
      const connection = await pool.getConnection();
      await connection.beginTransaction();
  
      // Check if a customer with the same phone_number already exists
      const [existingCustomer] = await connection.query(
        'SELECT customer_id FROM customer_data WHERE phone_number = ?',
        [phone_number]
      );
  
      if (existingCustomer.length > 0) {
        connection.release();
        return res.status(409).json({ error: 'Conflict', message: 'Customer with the same phone number already exists.' });
      }
  
      // Insert customer data into the database
      const [result] = await connection.query(
        'INSERT INTO customer_data (first_name, last_name, age, monthly_salary, approved_limit, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
        [first_name, last_name, age, monthly_salary, approved_limit, phone_number]
      );
  
      // Commit the transaction
      await connection.commit();
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
      console.log("Monthly Income : ", monthly_salary);
      res.status(201).json(response);
    } catch (error) {
      console.error('Error in /register:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
    }
  }
  


// Exporting register module
module.exports = { register };