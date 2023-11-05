// Importing pool from dbConfig.js
const pool = require('../helpers/dbConfig.js');

const viewStatement = async (req, res) => {
  try {
    const customer_id = req.params.customer_id;
    const loan_id = req.params.loan_id;

    // Fetching loan details
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
        return;
      }

      connection.query(
        'SELECT * FROM loans WHERE loan_id = ? AND customer_id = ?',
        [loan_id, customer_id],
        (queryError, results) => {
          connection.release(); // Release the connection back to the pool

          if (queryError) {
            console.error('Database query error:', queryError);
            res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
            return;
          }

          if (results.length === 0) {
            return res.status(404).json({ error: 'Loan not found' });
          }

          const loan = results[0];
          const amountPaid = loan.successful_payments * loan.monthly_payment;
          const repaymentsLeft = loan.remaining_tenure;

          const statement = {
            customer_id: loan.customer_id,
            loan_id: loan.loan_id,
            principal: loan.loan_amount,
            interest_rate: loan.interest_rate,
            amount_paid: amountPaid,
            monthly_installment: loan.monthly_payment,
            repayments_left: repaymentsLeft,
          };

          return res.status(200).json(statement);
        }
      );
    });
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
  }
};

module.exports = { viewStatement };
