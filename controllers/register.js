// controllers/registerController.js
const pool = require('../dataBaseConnection.js');


// Function to calculate the approved limit
function calculateApprovedLimit(monthlyIncome) {
    return Math.round(36 * monthlyIncome);
}

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
        console.log("Monthly Income : ", monthly_salary)
        // console.log(`${first_name} ${last_name}`)
        res.status(201).json(response);
    } catch (error) {
        console.error('Error in /register:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
}


// Exporting register module
module.exports = { register };