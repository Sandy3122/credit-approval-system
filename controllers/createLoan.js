// controllers/registerController.js
const pool = require('../dataBaseConnection.js');

// Define a function to calculate the monthly installment with compound interest
function calculateMonthlyInstallment(loanAmount, interestRate, tenure) {
    // Calculate the monthly interest rate with compound interest
    const monthlyInterestRate = (Math.pow(1 + interestRate / 100, 1 / 12) - 1);

    // Calculate the monthly installment using the compound interest formula
    const monthlyInstallment = (loanAmount * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -tenure));

    return monthlyInstallment;
}

const createLoan = async (req, res) => {
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
}


module.exports = { createLoan };