const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const app = express();

// Middleware to parse JSON request body
app.use(bodyParser.json());

// MySQL Database Configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Sandeep@3122',
  database: 'credit_approval',
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Function to calculate the approved limit
function calculateApprovedLimit(monthlyIncome) {
  return Math.round(36 * monthlyIncome);
}

// Register a new customer
app.post('/register', async (req, res) => {
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
});

// Check loan eligibility
app.post('/check-eligibility', async (req, res) => {
  try {
    // console.log("Request Body :", req.body);

    let {
      customer_id,
      loan_amount,
      interest_rate,
      tenure,
    } = req.body;

    let interest_rate_from_user = interest_rate;

    // Fetch customer details from the database
    const [customerData] = await pool.execute(
      'SELECT approved_limit, monthly_salary FROM customer_data WHERE customer_id = ?',
      [customer_id]
    );

    if (customerData.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { approved_limit, monthly_salary } = customerData[0];

    // Fetch loan history for the customer from the database
    const [loanHistory] = await pool.execute(
      'SELECT emis_paid_on_time, start_date FROM loan_data WHERE customer_id = ?',
      [customer_id]
    );

    // Calculate credit score based on the provided components
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

    // Check if sum of all current EMIs > 50% of monthly salary
    const [currentLoans] = await pool.execute(
      'SELECT SUM(monthly_payment) AS total_emis FROM loan_data WHERE customer_id = ?',
      [customer_id]
    );

    if (currentLoans[0].total_emis >= 0.5 * monthly_salary) {
      return res.status(200).json({
        customer_id,
        approval: false,
        interest_rate: interest_rate_from_user,
        corrected_interest_rate: interest_rate,
        tenure,
        monthly_installment: 0,
      });
    }

    // If everything is fine, approve the loan
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
    console.error('Database query error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

// Define a function to calculate the monthly installment with compound interest
function calculateMonthlyInstallment(loanAmount, interestRate, tenure) {
  // Calculate the monthly interest rate with compound interest
  const monthlyInterestRate = (Math.pow(1 + interestRate / 100, 1 / 12) - 1);

  // Calculate the monthly installment using the compound interest formula
  const monthlyInstallment = (loanAmount * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -tenure));

  return monthlyInstallment;
}

app.post('/create-loan', async (req, res) => {
  try {
    let {
      customer_id,
      loan_amount,
      interest_rate,
      tenure,
    } = req.body;

    // Fetch customer details from the database
    const connection = await pool.getConnection();
    const [customerData] = await connection.execute(
      'SELECT approved_limit, monthly_salary FROM customer_data WHERE customer_id = ?',
      [customer_id]
    );

    if (customerData.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { approved_limit, monthly_salary } = customerData[0];

    // Check if the loan amount exceeds the approved limit
    if (loan_amount > approved_limit) {
      connection.release();
      return res.status(400).json({ loan_id: null, customer_id, loan_approved: false, message: 'Loan amount exceeds approved limit' });
    }

    // Check if a loan with the same customer_id already exists
    const [existingLoan] = await connection.execute(
      'SELECT * FROM loans WHERE customer_id = ?',
      [customer_id]
    );

    if (existingLoan.length > 0) {
      connection.release();
      return res.status(400).json({ loan_id: existingLoan[0].loan_id, customer_id, loan_approved: false, message: 'A loan already exists for this customer' });
    }

    // Retrieve the appropriate loan_id from loan_data
    const [loanData] = await connection.execute(
      'SELECT loan_id FROM loan_data WHERE customer_id = ?',
      [customer_id]
    );

    if (loanData.length === 0) {
      connection.release();
      return res.status(400).json({ loan_id: null, customer_id, loan_approved: false, message: 'No loan data found for this customer' });
    }

    const loan_id = loanData[0].loan_id;

    const monthly_installment = Math.round(calculateMonthlyInstallment(loan_amount, interest_rate, tenure));

    // Calculate compound interest for total payable amount
    const compoundInterestRate = (1 + interest_rate / 100) ** (tenure / 12);
    const total_payable_amount = Math.round(loan_amount * compoundInterestRate);

    // Check if the sum of all current EMIs exceeds 50% of monthly salary
    const [currentLoans] = await connection.execute(
      'SELECT SUM(monthly_payment) AS total_emis FROM loans WHERE customer_id = ?',
      [customer_id]
    );

    if (currentLoans[0].total_emis >= 0.5 * monthly_salary) {
      connection.release();
      return res.status(400).json({ loan_id: null, customer_id, loan_approved: false, message: 'Total EMIs exceed 50% of monthly salary' });
    }

    const remainingLoanAmount = total_payable_amount;

    const updatedTenure = Math.ceil((remainingLoanAmount) / monthly_installment);

    const successfulPayments = 0

    await connection.execute(
      'INSERT INTO loans(customer_id, loan_id, loan_amount, interest_rate, tenure, monthly_payment, successful_payments, remaining_loan_amount, remaining_tenure, total_payable_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [customer_id, loan_id, loan_amount, interest_rate, tenure = updatedTenure, monthly_installment, successfulPayments, remainingLoanAmount, updatedTenure, total_payable_amount]
    );

    connection.release();

    return res.status(201).json({ loan_id, customer_id, loan_approved: true, monthly_installment, successfulPayments, total_payable_amount, remaining_loan_amount: remainingLoanAmount, remaining_tenure: updatedTenure });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});


app.get('/view-loan/:loan_id', async (req, res) => {
  try {
    const loan_id = req.params.loan_id;

    // Fetch loan details
    const [loanData] = await pool.execute(
      'SELECT * FROM loans WHERE loan_id = ?',
      [loan_id]
    );

    if (loanData.length === 0) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loan = loanData[0];

    // Fetch customer details
    const [customerData] = await pool.execute(
      'SELECT * FROM customer_data WHERE customer_id = ?',
      [loan.customer_id]
    );

    if (customerData.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
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
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});


// Make a payment towards an EMI
app.post('/make-payment/:customer_id/:loan_id', async (req, res) => {
  try {
    const customer_id = req.params.customer_id;
    const loan_id = req.params.loan_id;
    const paymentAmount = parseFloat(req.body.paymentAmount); // Parse paymentAmount as a float

    // Check if paymentAmount is a valid number
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // Fetch loan details
    const [loanData] = await pool.query(
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
    await pool.query(
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
});







const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
