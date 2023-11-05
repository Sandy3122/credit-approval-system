// Importing pool from dbConfig.js
const pool = require('../helpers/dbConfig.js');

const { calculateMonthlyInstallment } = require('../helpers/helpers.js')


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
    pool.query('SELECT approved_limit, monthly_salary FROM customer_data WHERE customer_id = ?', [customer_id], (error, customerData) => {
      if (error) {
        console.error('Error fetching customer data:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
      }

      if (customerData.length === 0) {
        return res.status(404).json({
          error: 'Customer not found',
          message: 'No customer with the provided customer_id was found in the database.',
        });
      }

      const { approved_limit, monthly_salary } = customerData[0];

      // Fetching loan history for the customer from the database
      pool.query('SELECT emis_paid_on_time, start_date FROM loan_data WHERE customer_id = ?', [customer_id], (error, loanHistory) => {
        if (error) {
          console.error('Error fetching loan history:', error);
          return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
        }

        
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

    // Calculating compound interest for total payable amount
    let compoundInterestRate = (1 + interest_rate / 100) ** (tenure / 12);
    let total_payable_amount = Math.round(loan_amount * compoundInterestRate);


    // Calculating monthly_installments
    let monthly_installment = Math.round(total_payable_amount / tenure);


    // Additional credit score rules
    if (creditScore > 50) {
      // Approve the loan
      console.log("CS: 50", monthly_installment)
      return res.status(200).json({
        customer_id,
        approval: true,
        interest_rate: interest_rate_from_user,
        corrected_interest_rate: interest_rate,
        tenure,
        monthly_installment: monthly_installment
      });
    } else if (creditScore > 30) {
      if (interest_rate <= 12) {
        interest_rate = 12; // Correct interest rate
        // Recalculating monthly_installments with the corrected interest rate
        let compoundInterestRate = (1 + interest_rate / 100) ** (tenure / 12);
        total_payable_amount = Math.round(loan_amount * compoundInterestRate)
        monthly_installment = calculateMonthlyInstallment(total_payable_amount, tenure);
        console.log("CS: 12", monthly_installment)
      }
    } else if (creditScore > 10) {
      if (interest_rate <= 16) {
        interest_rate = 16;

        let compoundInterestRate = (1 + interest_rate / 100) ** (tenure / 12);
        total_payable_amount = Math.round(loan_amount * compoundInterestRate)
        monthly_installment = calculateMonthlyInstallment(total_payable_amount, tenure);
        console.log("CS: 16", monthly_installment)
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
        pool.query('SELECT SUM(monthly_payment) AS total_emis FROM loan_data WHERE customer_id = ?', [customer_id], (error, currentLoans) => {
          if (error) {
            console.error('Error fetching current loans:', error);
            return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
          }

          if (currentLoans[0].total_emis >= 0.5 * monthly_salary) {
            return res.status(400).json({
              error: 'Loan not approved',
              message: 'Total EMIs exceed 50% of your monthly salary. You are not eligible for a new loan at this time.',
            });
          }

          // If everything is fine, then only we will approve the loan
          return res.status(200).json({
            customer_id,
            approval: true,
            interest_rate: interest_rate_from_user,
            corrected_interest_rate: interest_rate,
            tenure,
            monthly_installment,
          });
        });
      });
    });
  } catch (error) {
    console.error('Error in /check-eligibility:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
  }
};

module.exports = { checkEligibility };
