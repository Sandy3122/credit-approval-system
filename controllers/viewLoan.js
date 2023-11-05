// Importing pool from dbConfig.js
const pool = require('../helpers/dbConfig.js');


const viewLoan = (req, res) => {
  try {
    const loan_id = req.params.loan_id;

    // Fetching loan details
    pool.query('SELECT * FROM loans WHERE loan_id = ?', [loan_id], (error, loanData) => {
      if (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
      }

      // Checking for the loan
      if (loanData.length === 0) {
        return res.status(404).json({
          error: 'Loan not found',
          message: 'No loan with the provided ID was found in the database.',
        });
      }

      const loan = loanData[0];

      // Fetching customer details
      pool.query('SELECT * FROM customer_data WHERE customer_id = ?', [loan.customer_id], (error, customerData) => {
        if (error) {
          console.error('Database query error:', error);
          return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
        }

        // Checking for the customer
        if (customerData.length === 0) {
          return res.status(404).json({
            error: 'Customer not found',
            message: 'No customer with the provided ID was found in the database.',
          });
        }

        const customer = customerData[0];

        const response = {
          loan_id: loan.loan_id,
          customer: {
            id: customer.customer_id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone_number: customer.phone_number,
            age: customer.age,
          },
          loan_amount: loan.loan_amount,
          interest_rate: loan.interest_rate,
          monthly_installment: loan.monthly_payment,
          total_payable: Math.round(loan.total_payable_amount),
          tenure: loan.tenure,
        };

        return res.status(200).json(response);
      });
    });
  } catch (error) {
    console.error('Error in viewLoan:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
  }
};

module.exports = { viewLoan };
