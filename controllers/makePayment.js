// Importing pool conncetion
const pool = require('../dataBaseConnection.js');


const makePayment = async (req, res) => {
  try {
    const customer_id = req.params.customer_id;
    const loan_id = req.params.loan_id;
    let paymentAmount = parseFloat(req.body.paymentAmount); // Parsing paymentAmount as a float

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
    let remainingLoanAmount = loan.remaining_loan_amount;
    let monthlyPayment = loan.monthly_payment;
    let initialTenure = loan.tenure;
    let remainingTenure = loan.remaining_tenure;
    let numberOfPayments = loan.successful_payments; // Get the number of successful payments from the database

    console.log(remainingLoanAmount)
    console.log(remainingTenure)

    // Calculating the updated remaining loan amount
    let updatedRemainingLoanAmount = parseFloat((remainingLoanAmount - paymentAmount).toFixed(2));

    let updatedTenure;

    if (initialTenure === remainingTenure) {
      // Checking if payment amount is less than monthly installment
      if (paymentAmount < monthlyPayment) {
        return res.status(400).json({
          error: 'Invalid payment amount',
          message: 'The payment amount should not be less than the monthly installment amount',
          monthly_installment: monthlyPayment
        });
      } else {
        updatedTenure = Math.round((updatedRemainingLoanAmount) / monthlyPayment);
      }

      // Checking if the payment is not a multiple of monthlyPayment or exceeds 4 months
      if (paymentAmount % monthlyPayment !== 0 || paymentAmount > 4 * monthlyPayment) {
        return res.status(400).json({
          error: 'Invalid payment amount',
          message: 'The payment amount should be a multiple of the monthly installment and should not exceed 4 months.',
          monthly_installment: monthlyPayment
        });
      }

    } else if (remainingTenure == 1) {
      if (paymentAmount == remainingLoanAmount) {

        // Updating the values to zero
        updatedTenure = updatedRemainingLoanAmount = 0;

        // Updating the database
        await pool.execute(
          'UPDATE loans SET remaining_loan_amount = ?, remaining_tenure = ?, successful_payments = ? WHERE loan_id = ? AND customer_id = ?',
          [updatedRemainingLoanAmount, updatedTenure, numberOfPayments + paymentAmount / monthlyPayment, loan_id, customer_id] // Increment successful_payments
        );
    
        return res.status(200).json({
          success: "Congratulations! Your Loan Is Cleared",
          message: 'You have successfully paid off your loan.',
          remaining_loan_amount: updatedRemainingLoanAmount,
          loan_id: loan.loan_id,
          tenure: updatedTenure,
          successful_payments: Math.round(numberOfPayments + paymentAmount / monthlyPayment)
        });

      }
      else if (paymentAmount > remainingLoanAmount) {
        return res.status(400).json({
          error: 'Invalid EMI payment',
          message: 'The last EMI payment should not exceed one remaining loan amount',
          remainingLoanAmount: remainingLoanAmount
        });
      }
      else if (paymentAmount < remainingLoanAmount) {
        return res.status(400).json({
          error: 'Invalid EMI payment',
          message: 'The last EMI payment should not be less than remaining loan amount',
          remainingLoanAmount: remainingLoanAmount
        });
      }
    } else if (remainingTenure == 0) {
      return res.status(400).json({
        error: "Your Loan Is Cleared",
        message: "You have successfully paid off your loan.",
      });
    } else {
      if (paymentAmount < monthlyPayment) {
        return res.status(400).json({
          error: 'Invalid payment amount',
          message: 'The EMI payment amount should not be less than the monthly installment amount.',
          monthly_installment: monthlyPayment
        });
      } else if (paymentAmount > 4 * monthlyPayment) {
        return res.status(400).json({
          error: 'Invalid EMI payment',
          message: 'The EMI payment should not exceed 4 times the monthly installment,',
          four_installments: 4 * monthlyPayment
        });
      } else if (paymentAmount > monthlyPayment && paymentAmount % monthlyPayment !== 0) {
        return res.status(400).json({
          error: 'Invalid payment amount',
          message: 'The EMI payment should be a multiple of the monthly installment, and should not exceed one monthly installment.',
          monthly_installment: monthlyPayment
        });
      } else if(updatedRemainingLoanAmount < 0) {
        return res.status(400).json({
          error: 'Payment exceeds remaining loan amount',
          message: `The payment amount of ${paymentAmount} exceeds the remaining loan amount of ${loan.remaining_loan_amount}. Please make a lower payment.`,
        });
      } 
      else {
        // Calculatig the updated tenure based on the remaining loan amount and monthly payment
        updatedTenure = Math.round((remainingLoanAmount - paymentAmount) / monthlyPayment);
      }
    }

    // Updating the loan with the new remaining loan amount, tenure, and number_of_successful_payments
    await pool.execute(
      'UPDATE loans SET remaining_loan_amount = ?, remaining_tenure = ?, successful_payments = ? WHERE loan_id = ? AND customer_id = ?',
      [updatedRemainingLoanAmount, updatedTenure, numberOfPayments + paymentAmount / monthlyPayment, loan_id, customer_id] // Increment successful_payments
    );

    return res.status(200).json({
      message: 'Payment made successfully',
      remaining_loan_amount: updatedRemainingLoanAmount,
      loan_id: loan.loan_id,
      tenure: updatedTenure,
      successful_payments: Math.round(numberOfPayments + paymentAmount / monthlyPayment)
    });
  } catch (error) {
    console.error('Database query error:', error);

    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });

  }
}


module.exports = { makePayment }