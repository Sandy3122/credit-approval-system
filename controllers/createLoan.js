// Import the required modules
const pool = require('../helpers/dbConfig.js');


const createLoan = async (req, res) => {
    try {
        let {
            customer_id,
            loan_amount,
            interest_rate,
            tenure,
        } = req.body;

        // Fetching customer details from the database
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error getting connection:', err);
                res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                return;
            }

            connection.query(
                'SELECT approved_limit, monthly_salary FROM customer_data WHERE customer_id = ?',
                [customer_id],
                (error, customerData) => {
                    if (error) {
                        connection.release();
                        console.error('Error executing SELECT query:', error);
                        res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                        return;
                    }

                    // Checking for the customer
                    if (customerData.length === 0) {
                        connection.release();
                        return res.status(404).json({ error: 'Customer not found', message: 'No customer with the specified ID was found.' });
                    }

                    const { approved_limit, monthly_salary } = customerData[0];

                    // Checking if the loan amount exceeds the approved limit
                    if (loan_amount > approved_limit) {
                        connection.release();
                        return res.status(400).json({ loan_id: null, customer_id, loan_approved: false, message: 'Loan amount exceeds approved limit' });
                    }

                    // Checking if a loan with the same customer_id already exists
                    connection.query(
                        'SELECT * FROM loans WHERE customer_id = ?',
                        [customer_id],
                        (error, existingLoan) => {
                            if (error) {
                                connection.release();
                                console.error('Error executing SELECT query:', error);
                                res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                                return;
                            }

                            if (existingLoan.length > 0) {
                                connection.release();
                                return res.status(400).json({ loan_id: existingLoan[0].loan_id, customer_id, loan_approved: false, message: 'A loan already exists for this customer' });
                            }

                            // Retrieving the appropriate loan_id from loan_data
                            connection.query(
                                'SELECT loan_id FROM loan_data WHERE customer_id = ?',
                                [customer_id],
                                (error, loanData) => {
                                    if (error) {
                                        connection.release();
                                        console.error('Error executing SELECT query:', error);
                                        res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                                        return;
                                    }

                                    if (loanData.length === 0) {
                                        connection.release();
                                        return res.status(400).json({ loan_id: null, customer_id, loan_approved: false, message: 'No loan data found for this customer' });
                                    }

                                    const loan_id = loanData[0].loan_id;

                                    // Calculating compound interest for total payable amount
                                    const compoundInterestRate = (1 + interest_rate / 100) ** (tenure / 12);
                                    const total_payable_amount = parseFloat((loan_amount * compoundInterestRate).toFixed(2));

                                    // Calculating monthly_installments
                                    const monthly_installment = parseFloat((total_payable_amount / tenure).toFixed(2));

                                    // Checking if the sum of all current EMIs exceeds 50% of monthly salary
                                    connection.query(
                                        'SELECT SUM(monthly_payment) AS total_emis FROM loans WHERE customer_id = ?',
                                        [customer_id],
                                        (error, currentLoans) => {
                                            if (error) {
                                                connection.release();
                                                console.error('Error executing SELECT query:', error);
                                                res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                                                return;
                                            }

                                            if (currentLoans[0].total_emis >= 0.5 * monthly_salary) {
                                                connection.release();
                                                return res.status(400).json({ loan_id: null, customer_id, loan_approved: false, message: 'Total EMIs exceed 50% of monthly salary' });
                                            }

                                            const remainingLoanAmount = total_payable_amount;
                                            const updatedTenure = tenure;
                                            const successfulPayments = 0;

                                            connection.query(
                                                'INSERT INTO loans(customer_id, loan_id, loan_amount, interest_rate, tenure, monthly_payment, successful_payments, remaining_loan_amount, remaining_tenure, total_payable_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                                [customer_id, loan_id, loan_amount, interest_rate, tenure, monthly_installment, successfulPayments, remainingLoanAmount, updatedTenure, total_payable_amount],
                                                (error, result) => {
                                                    if (error) {
                                                        connection.release();
                                                        console.error('Error executing INSERT query:', error);
                                                        res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
                                                    } else {
                                                        connection.release();
                                                        res.status(201).json({ loan_id, customer_id, loan_approved: true, monthly_installment, successfulPayments, total_payable_amount, remaining_loan_amount: remainingLoanAmount, remaining_tenure: updatedTenure });
                                                    }
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred while processing your request.' });
    }
}

// Exporting createLoan module
module.exports = { createLoan };