// Function to calculate the approved limit
function calculateApprovedLimit(monthlyIncome) {
    return Math.round(36 * monthlyIncome);
}


// Calculating monthly installments
const calculateMonthlyInstallment = (loanAmount, tenure) => {
    return Math.round((loanAmount / tenure));
  };


module.exports = {
    calculateMonthlyInstallment,
    calculateApprovedLimit,
}