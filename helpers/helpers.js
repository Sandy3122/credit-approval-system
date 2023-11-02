// Defining a function to calculate the monthly installment with compound interest
function calculateMonthlyInstallment(loanAmount, interestRate, tenure) {
    // Calculating the monthly interest rate with compound interest
    const monthlyInterestRate = (Math.pow(1 + interestRate / 100, 1 / 12) - 1);

    // Calculating the monthly installment using the compound interest formula
    const monthlyInstallment = (loanAmount * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -tenure));

    return monthlyInstallment;
}


// Function to calculate the approved limit
function calculateApprovedLimit(monthlyIncome) {
    return Math.round(36 * monthlyIncome);
}


module.exports = {
    calculateMonthlyInstallment,
    calculateApprovedLimit
}