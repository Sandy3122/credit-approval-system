const pool = require('../helpers/dbConfig.js');

const makePayment = async (req, res) => {
  try {
    const customer_id = req.params.customer_id;
    const loan_id = req.params.loan_id;
    const paymentAmount = parseFloat(req.body.paymentAmount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid payment amount',
        message: 'The payment amount should be a valid number greater than zero.',
      });
    }

    pool.query(
      'SELECT * FROM loans WHERE loan_id = ? AND customer_id = ?',
      [loan_id, customer_id],
      (error, results) => {
        if (error) {
          console.error('Error executing SELECT query:', error);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'An error occurred while processing your request.',
          });
        }

        const loanData = results;

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
        const numberOfPayments = loan.successful_payments;

        let updatedRemainingLoanAmount = parseFloat((remainingLoanAmount - paymentAmount).toFixed(2));
        let updatedTenure;

        if (initialTenure === remainingTenure) {
          if (paymentAmount < monthlyPayment || paymentAmount % monthlyPayment !== 0 || paymentAmount > 4 * monthlyPayment) {
            return res.status(400).json({
              error: 'Invalid payment amount',
              message: 'Invalid payment amount for the initial tenure.',
              monthly_installment: monthlyPayment
            });
          }
          updatedTenure = Math.round((updatedRemainingLoanAmount) / monthlyPayment);
        } else if (remainingTenure === 1) {
          if (paymentAmount === remainingLoanAmount) {
            updatedTenure = 0;
            updatedRemainingLoanAmount = 0;
          } else if (paymentAmount > remainingLoanAmount || paymentAmount < remainingLoanAmount) {
            return res.status(400).json({
              error: 'Invalid EMI payment',
              message: 'Invalid EMI payment for the remaining tenure.',
              remainingLoanAmount: remainingLoanAmount
            });
          }
        } else if (remainingTenure === 0) {
          return res.status(400).json({
            error: "Your Loan Is Cleared",
            message: "You have successfully paid off your loan.",
          });
        } else {
          if (paymentAmount < monthlyPayment || paymentAmount > 4 * monthlyPayment || (paymentAmount > monthlyPayment && paymentAmount % monthlyPayment !== 0) || updatedRemainingLoanAmount < 0) {
            return res.status(400).json({
              error: 'Invalid payment amount',
              message: 'Invalid payment amount for the remaining tenure.',
              monthly_installment: monthlyPayment
            });
          }
          updatedTenure = Math.round((remainingLoanAmount - paymentAmount) / monthlyPayment);
        }

        pool.query(
          'UPDATE loans SET remaining_loan_amount = ?, remaining_tenure = ?, successful_payments = ? WHERE loan_id = ? AND customer_id = ?',
          [
            updatedRemainingLoanAmount,
            updatedTenure,
            numberOfPayments + paymentAmount / monthlyPayment,
            loan_id,
            customer_id,
          ],
          (updateError) => {
            if (updateError) {
              console.error('Error updating loan:', updateError);
              return res.status(500).json({
                error: 'Internal Server Error',
                message: 'An error occurred while processing your request.',
              });
            }
            res.status(200).json({
              message: 'Payment made successfully',
              remaining_loan_amount: updatedRemainingLoanAmount,
              loan_id: loan.loan_id,
              tenure: updatedTenure,
              successful_payments: Math.round(numberOfPayments + paymentAmount / monthlyPayment),
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Database query error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request.',
    });
  }
};

module.exports = { makePayment };
