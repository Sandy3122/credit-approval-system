// Importing pool conncetion
const pool = require('../dataBaseConnection.js');

// Importing helper function
const { calculateMonthlyInstallment } = require("../helpers/helpers.js");

const checkEligibility = async (req, res) => {
  try {
    // console.log("Request Body :", req.body);

    let {
      customer_id,
      loan_amount,
      interest_rate,
      tenure,
    } = req.body;

    let interest_rate_from_user = interest_rate;

    // Fetching customer details from the database
    const [customerData] = await pool.execute(
      'SELECT approved_limit, monthly_salary FROM customer_data WHERE customer_id = ?',
      [customer_id]
    );

    // Checking for the customer
    if (customerData.length === 0) {
      connection.release();
      return res.status(404).json({
        error: 'Customer not found',
        message: 'No customer with the provided customer_id was found in the database.',
      });
    }
    

    const { approved_limit, monthly_salary } = customerData[0];

    // Fetching loan history for the customer from the database
    const [loanHistory] = await pool.execute(
      'SELECT emis_paid_on_time, start_date FROM loan_data WHERE customer_id = ?',
      [customer_id]
    );

    // Calculating credit score based on the provided components
    let creditScore = 0;

    if (loanHistory.length > 0) {
      const totalLoans = loanHistory.length;
      const currentYear = new Date().getFullYear();
      let totalEmisPaidOnTime = 0;

      for (const loan of loanHistory) {
        totalEmisPaidOnTime += loan.emis_paid_on_time;
        const loanYear = new Date(loan.start_date).getFullYear();

        if (loanYear === currentYear) {
          creditScore += 10;
        }
      }

      if (totalLoans > 0) {
        creditScore += totalLoans * 5;
      }

      if (totalEmisPaidOnTime / totalLoans >= 0.8) {
        creditScore += 10;
      }

      if (loan_amount + totalLoans > approved_limit) {
        creditScore = 0;
      }
    }

    // Additional credit score rules
    if (creditScore > 50) {
      // Approve the loan
      return res.status(200).json({
        customer_id,
        approval: true,
        interest_rate: interest_rate_from_user,
        corrected_interest_rate: interest_rate,
        tenure,
        monthly_installment: calculateMonthlyInstallment(loan_amount, interest_rate, tenure),
      });
    } else if (creditScore > 30) {
      if (interest_rate <= 12) {
        interest_rate = 12; // Correct interest rate
      }
    } else if (creditScore > 10) {
      if (interest_rate <= 16) {
        interest_rate = 16; // Correct interest rate
      } else {
        correctedInterestRate = interest_rate; // Use the original interest rate
      }
    } else {
      // Credit score is 10 or lower, don't approve the loan
      return res.status(200).json({
        customer_id,
        approval: false,
        interest_rate: interest_rate_from_user,
        corrected_interest_rate: interest_rate,
        tenure,
        monthly_installment: 0,
      });
    }

    // Checking if sum of all current EMIs > 50% of monthly salary
    const [currentLoans] = await pool.execute(
      'SELECT SUM(monthly_payment) AS total_emis FROM loan_data WHERE customer_id = ?',
      [customer_id]
    );

    if (currentLoans[0].total_emis >= 0.5 * monthly_salary) {
      connection.release();
      return res.status(400).json({
        error: 'Loan not approved',
        message: 'Total EMIs exceed 50% of your monthly salary. You are not eligible for a new loan at this time.',
      });
    }
    

    // If everything is fine, Then only we will approve the loan
    connection.release();
    return res.status(200).json({
      customer_id,
      approval: true,
      interest_rate: interest_rate_from_user,
      corrected_interest_rate: interest_rate,
      tenure,
      monthly_installment: calculateMonthlyInstallment(
        loan_amount,
        interest_rate,
        tenure
        ),
      });
      
    } catch (error) {
    console.error('Error in /check-eligibility:', error);
    connection.release();
    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
  }
}

module.exports = { checkEligibility };