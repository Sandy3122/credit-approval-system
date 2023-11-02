// controllers/registerController.js
const pool = require('../dataBaseConnection.js');


const makePayment = async (req, res) => {
    try {
      const customer_id = req.params.customer_id;
      const loan_id = req.params.loan_id;
      const paymentAmount = parseFloat(req.body.paymentAmount); // Parse paymentAmount as a float
  
      // Check if paymentAmount is a valid number
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ error: 'Invalid payment amount' });
      }
  
      // Fetch loan details
      const [loanData] = await pool.execute(
        'SELECT * FROM loans WHERE loan_id = ? AND customer_id = ?',
        [loan_id, customer_id]
      );
  
      if (loanData.length === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }
  
      const loan = loanData[0];
      const remainingLoanAmount = loan.remaining_loan_amount;
      const monthlyPayment = loan.monthly_payment;
      const initialTenure = loan.tenure;
      const remainingTenure = loan.remaining_tenure;
      const numberOfPayments = loan.successful_payments; // Get the number of successful payments from the database
  
      // Check if the payment is not a multiple of monthlyPayment or exceeds 4 months
      if (paymentAmount % monthlyPayment !== 0 || paymentAmount > 4 * monthlyPayment) {
        return res.status(400).json({ error: 'Invalid payment amount. It should be a multiple of monthly installment and not exceed 4 months.' });
      }
  
      // Calculate the updated remaining loan amount
      const updatedRemainingLoanAmount = remainingLoanAmount - paymentAmount;
  
      // Check if the updated remaining loan amount is negative (payment exceeds the remaining amount)
      if (updatedRemainingLoanAmount < 0) {
        return res.status(400).json({ error: 'Payment exceeds remaining loan amount' });
      }
  
      let updatedTenure;
  
      if (initialTenure === remainingTenure) {
        updatedTenure = Math.ceil((updatedRemainingLoanAmount) / monthlyPayment);
      } else {
        // Calculate the updated tenure based on the remaining loan amount and monthly payment
        updatedTenure = Math.ceil((remainingLoanAmount - paymentAmount) / monthlyPayment);
      }
  
      // Update the loan with the new remaining loan amount, tenure, and number_of_successful_payments
      await pool.execute(
        'UPDATE loans SET remaining_loan_amount = ?, remaining_tenure = ?, successful_payments = ? WHERE loan_id = ? AND customer_id = ?',
        [updatedRemainingLoanAmount, updatedTenure, numberOfPayments + paymentAmount / monthlyPayment, loan_id, customer_id] // Increment successful_payments
      );
  
      return res.status(200).json({
        message: 'Payment made successfully',
        remaining_loan_amount: updatedRemainingLoanAmount,
        loan_id: loan.loan_id,
        tenure: updatedTenure,
        successful_payments: numberOfPayments + paymentAmount / monthlyPayment
      });
    } catch (error) {
      console.error('Database query error:', error);
      res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }


module.exports = { makePayment }