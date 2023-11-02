// Importing pool conncetion
const pool = require('../dataBaseConnection.js');


const makePayment = async (req, res) => {
  try {
    const customer_id = req.params.customer_id;
    const loan_id = req.params.loan_id;
    const paymentAmount = parseFloat(req.body.paymentAmount); // Parsing paymentAmount as a float

    // Checking if paymentAmount is a valid number
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid payment amount',
        message: 'The payment amount should be a valid number greater than zero.',
      });
    }


    // Fetching loan details
    const [loanData] = await pool.execute(
      'SELECT * FROM loans WHERE loan_id = ? AND customer_id = ?',
      [loan_id, customer_id]
    );

    // Checking for the loan
    if (loanData.length === 0) {
      return res.status(404).json({
        error: 'Loan not found',
        message: 'The specified loan does not exist.',
      });
    }


    const loan = loanData[0];
    const remainingLoanAmount = loan.remaining_loan_amount;
    const monthlyPayment = loan.monthly_payment;
    const initialTenure = loan.tenure;
    const remainingTenure = loan.remaining_tenure;
    const numberOfPayments = loan.successful_payments; // Get the number of successful payments from the database

    // Checking if payment amount is less than monthly installment
    if (paymentAmount < monthlyPayment) {
      return res.status(400).json({
        error: 'Invalid payment amount',
        message: `The payment amount should not be less than the monthly installment amount, which is ${loan.monthly_payment}`,
      });
    }


    // Checking if the payment is not a multiple of monthlyPayment or exceeds 4 months
    if (paymentAmount % monthlyPayment !== 0 || paymentAmount > 4 * monthlyPayment) {
      return res.status(400).json({
        error: 'Invalid payment amount',
        message: 'The payment amount should be a multiple of the monthly installment and should not exceed 4 months.',
      });
    }


    // Calculating the updated remaining loan amount
    const updatedRemainingLoanAmount = remainingLoanAmount - paymentAmount;

    // Checking if the updated remaining loan amount is negative (payment exceeds the remaining amount)
    if (updatedRemainingLoanAmount < 0) {
      return res.status(400).json({
        error: 'Payment exceeds remaining loan amount',
        message: `The payment amount of ${paymentAmount} exceeds the remaining loan amount of ${loan.remaining_loan_amount}. Please make a lower payment.`,
      });
    }

    let updatedTenure;

    if (initialTenure === remainingTenure) {
      updatedTenure = Math.ceil((updatedRemainingLoanAmount) / monthlyPayment);
    } else {
      // Calculatig the updated tenure based on the remaining loan amount and monthly payment
      updatedTenure = Math.ceil((remainingLoanAmount - paymentAmount) / monthlyPayment);
    }

    // Updating the loan with the new remaining loan amount, tenure, and number_of_successful_payments
    await pool.execute(
      'UPDATE loans SET remaining_loan_amount = ?, remaining_tenure = ?, successful_payments = ? WHERE loan_id = ? AND customer_id = ?',
      [updatedRemainingLoanAmount, updatedTenure, numberOfPayments + paymentAmount / monthlyPayment, loan_id, customer_id] // Increment successful_payments
    );

    // If everything is successful, commit the transaction and release the connection
    await connection.commit();
    connection.release();

    return res.status(200).json({
      message: 'Payment made successfully',
      remaining_loan_amount: updatedRemainingLoanAmount,
      loan_id: loan.loan_id,
      tenure: updatedTenure,
      successful_payments: numberOfPayments + paymentAmount / monthlyPayment
    });
  } catch (error) {
    console.error('Database query error:', error);

    // If an error occurs, rollback the transaction and release the connection
    await connection.rollback();
    connection.release();

    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });

  }
}


module.exports = { makePayment }